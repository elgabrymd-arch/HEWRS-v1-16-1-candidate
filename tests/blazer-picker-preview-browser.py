#!/usr/bin/env python3
"""Exercise the opt-in picker with isolated synthetic browser storage."""
import argparse
import functools
import hashlib
import json
import shutil
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f"http://127.0.0.1:{server.server_address[1]}"
    checks, errors, external, missing = [], [], [], []

    def check(label, condition):
        checks.append({"name": label, "passed": bool(condition)})
        print(("PASS " if condition else "FAIL ") + label, flush=True)
        assert condition, label

    def state(page):
        return page.evaluate("() => ({prefs: HEWRSApp.ui.snapshot(), wear: HEWRSApp.store.snapshot(), favorites: HEWRSApp.favorites.snapshot(), storage: {...localStorage}})")

    def open_picker(page, category="topwear", type_filter=None):
        page.click("#pref-" + category)
        if type_filter:
            page.select_option("#picker-type", type_filter)
        if category == "topwear":
            if type_filter == "suit":
                page.wait_for_function("() => document.querySelectorAll('#picker-list .hewrs-suit-picker-choice').length === 18")
            else:
                page.wait_for_function("() => document.querySelectorAll('#picker-list .hewrs-blazer-picker-choice').length === 15")

    def close_picker(page):
        page.locator("#fx-sheet-actions").get_by_role("button", name="Cancel", exact=True).click()

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, executable_path=shutil.which("chromium"), args=["--no-sandbox"])
            for width, height, touch in ((390, 844, True), (1280, 900, False)):
                context = browser.new_context(viewport={"width": width, "height": height}, is_mobile=touch, has_touch=touch)
                def route(request):
                    if request.request.url.startswith(origin + "/"):
                        request.continue_()
                    else:
                        external.append(request.request.url)
                        request.abort()
                context.route("**/*", route)
                page = context.new_page()
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.on("response", lambda response: missing.append(response.url) if response.status >= 400 else None)
                page.goto(origin + "/blazer-picker-preview.html", wait_until="domcontentloaded")
                page.wait_for_function("globalThis.HEWRS_READY === true && !!globalThis.HEWRSBlazerPickerPreview")
                baseline = state(page)
                labels_before = page.evaluate("() => HEWRSApp.ui.rows.topwear.map(r => ({...r}))")
                open_picker(page, type_filter="blazer")
                check(f"{width}px: 15 canonical blazer buttons", page.locator("#picker-list .hewrs-blazer-picker-choice").count() == 15)
                for number in range(1, 16):
                    identifier = f"B{number:02d}"
                    button = page.locator(f'#picker-list button[data-item-id="{identifier}"]')
                    button.scroll_into_view_if_needed()
                    button.locator("img").wait_for(state="visible")
                    page.wait_for_function("id => {const im=document.querySelector('#picker-list button[data-item-id=\"'+id+'\"] img');return im?.complete && im.naturalWidth>0;}", arg=identifier)
                    button.locator("img").click()
                    check(f"{width}px: {identifier} image selects exact existing identity", page.evaluate("id => {const r=HEWRSApp.ui.rows.topwear.find(r=>r.sourceId===id);return HEWRSApp.ui.draft().choice.id===r.id && document.querySelector('#picker-list button[data-item-id=\"'+id+'\"]').getAttribute('aria-pressed')==='true';}", identifier))
                check(f"{width}px: draft clicks do not write saved data", state(page) == baseline)
                close_picker(page)
                check(f"{width}px: Cancel retains all previous preferences", state(page) == baseline)

                open_picker(page, type_filter="blazer")
                page.locator('button[data-item-id="B11"] img').click()
                page.click("#picker-apply")
                applied = state(page)
                check(f"{width}px: Apply stores B11 canonical mapping", applied["prefs"]["topwear"] == {"mode": "item", "id": "blazer-source-B11"})
                check(f"{width}px: Apply changes no other category", all(applied["prefs"][key] == baseline["prefs"][key] for key in baseline["prefs"] if key != "topwear"))
                check(f"{width}px: Favorites and wear unchanged", applied["wear"] == baseline["wear"] and applied["favorites"] == baseline["favorites"])
                page.reload(wait_until="domcontentloaded")
                page.wait_for_function("globalThis.HEWRS_READY === true")
                check(f"{width}px: selected B11 persists after reload", state(page) == applied)
                open_picker(page, type_filter="blazer")
                check(f"{width}px: restored B11 visibly selected", page.locator('button[data-item-id="B11"]').get_attribute("aria-pressed") == "true")
                page.fill("#picker-search", "B12")
                check(f"{width}px: search retains exact B12 image", page.locator("#picker-list button").count() == 1 and page.locator("#picker-list img").get_attribute("data-source-id") == "B12")
                close_picker(page)

                open_picker(page, type_filter="blazer")
                page.locator('button[data-item-id="B13"]').focus()
                page.locator('button[data-item-id="B13"]').press("Enter")
                check(f"{width}px: keyboard selection preserves B13 mapping", page.evaluate("() => HEWRSApp.ui.draft().choice.id === 'blazer-source-B13'"))
                close_picker(page)
                open_picker(page, type_filter="blazer")
                page.click("#picker-engine")
                page.click("#picker-apply")
                check(f"{width}px: Engine Choice retained", page.evaluate("() => HEWRSApp.ui.snapshot().topwear.mode === 'any'"))

                suit_baseline = state(page)
                open_picker(page)
                page.wait_for_function("() => document.querySelectorAll('#picker-list .hewrs-suit-picker-choice').length === 18")
                check(f"{width}px: mixed picker keeps all 15 Blazers and 18 Suits", page.locator("#picker-list .hewrs-blazer-picker-choice").count() == 15 and page.locator("#picker-list .hewrs-suit-picker-choice").count() == 18)
                page.select_option("#picker-type", "suit")
                page.wait_for_function("() => document.querySelectorAll('#picker-list .hewrs-suit-picker-choice').length === 18")
                check(f"{width}px: suits filter shows only 18 suit images", page.locator("#picker-list .hewrs-suit-picker-choice").count() == 18 and page.locator("#picker-list .hewrs-blazer-picker-choice").count() == 0)
                for number in range(1, 19):
                    identifier = f"S{number:02d}"
                    button = page.locator(f'#picker-list button[data-item-id="{identifier}"]')
                    button.scroll_into_view_if_needed()
                    button.locator("img").wait_for(state="visible")
                    page.wait_for_function("id => {const im=document.querySelector('#picker-list button[data-item-id=\"'+id+'\"] img');return im?.complete && im.naturalWidth>0;}", arg=identifier)
                    button.locator("img").click()
                    check(f"{width}px: {identifier} image selects its exact suit identity and source", page.evaluate("""id => {
                      const row=HEWRSApp.ui.rows.topwear.find(r=>r.kind==='suit' && r.sourceId===id);
                      const descriptor=HEWRS_SUIT_PICKER_IMAGES.items[id];
                      const button=document.querySelector('#picker-list button[data-item-id="'+id+'"]');
                      const image=button.querySelector('img');
                      return row && descriptor.history_id===row.id && HEWRSApp.ui.draft().choice.id===row.id &&
                        button.getAttribute('aria-pressed')==='true' && image.dataset.sourceId===id &&
                        image.dataset.sourceSha256===descriptor.sha256 && image.getAttribute('src')===descriptor.src &&
                        button.querySelector('.hewrs-blazer-picker-image').dataset.sourceKind===
                          (id==='S02'?'owner_reference_photo':'native_avatar_preview');
                    }""", identifier))
                check(f"{width}px: suit draft clicks leave saved data unchanged", state(page) == suit_baseline)
                close_picker(page)
                check(f"{width}px: suit Cancel retains all saved data", state(page) == suit_baseline)

                open_picker(page, type_filter="suit")
                page.evaluate("document.getElementById('fx-sheet-body').scrollTop = 0")
                page.wait_for_function("() => document.querySelector('#picker-list img')?.complete")
                check(f"{width}px: suit dialog and Apply fit the viewport", page.evaluate("() => {const d=document.getElementById('fx-sheet').getBoundingClientRect();const a=document.getElementById('picker-apply').getBoundingClientRect();const b=document.getElementById('fx-sheet-body');return d.left>=-1 && d.right<=innerWidth+1 && d.top>=-1 && d.bottom<=innerHeight+1 && a.bottom<=innerHeight+1 && b.scrollWidth<=b.clientWidth+1;}"))
                page.screenshot(path=str(args.output / f"suit-picker-{width}.png"), full_page=True)
                page.fill("#picker-search", "S02")
                page.wait_for_function("() => {const im=document.querySelector('#picker-list button[data-item-id=\"S02\"] img');return im?.complete && im.naturalWidth>0;}")
                check(f"{width}px: S02 visibly identifies the original cloth photo", page.locator("#picker-list button").count() == 1 and page.locator('button[data-item-id="S02"]').get_by_text("Original cloth photo", exact=True).is_visible())
                page.screenshot(path=str(args.output / f"suit-picker-S02-{width}.png"), full_page=True)
                close_picker(page)

                open_picker(page, type_filter="suit")
                page.locator('button[data-item-id="S05"] img').click()
                page.click("#picker-apply")
                suit_applied = state(page)
                check(f"{width}px: suit Apply preserves S05 to suit-4 mapping", suit_applied["prefs"]["topwear"] == {"mode": "item", "id": "suit-4"})
                check(f"{width}px: suit Apply changes no other category or ledgers", all(suit_applied["prefs"][key] == suit_baseline["prefs"][key] for key in suit_baseline["prefs"] if key != "topwear") and suit_applied["wear"] == suit_baseline["wear"] and suit_applied["favorites"] == suit_baseline["favorites"])
                changed_storage = {key for key in suit_baseline["storage"].keys() | suit_applied["storage"].keys() if suit_baseline["storage"].get(key) != suit_applied["storage"].get(key)}
                blazer_storage = {key for key in baseline["storage"].keys() | applied["storage"].keys() if baseline["storage"].get(key) != applied["storage"].get(key)}
                check(f"{width}px: suit Apply writes only the existing preference record", len(changed_storage) == 1 and changed_storage == blazer_storage)
                page.reload(wait_until="domcontentloaded")
                page.wait_for_function("globalThis.HEWRS_READY === true")
                check(f"{width}px: applied suit persists after reload", state(page) == suit_applied)
                open_picker(page, type_filter="suit")
                check(f"{width}px: restored S05 is visibly selected", page.locator('button[data-item-id="S05"]').get_attribute("aria-pressed") == "true")
                page.fill("#picker-search", "S18")
                check(f"{width}px: suit search retains the exact S18 image", page.locator("#picker-list button").count() == 1 and page.locator("#picker-list img").get_attribute("data-source-id") == "S18")
                page.locator('button[data-item-id="S18"]').focus()
                page.locator('button[data-item-id="S18"]').press("Enter")
                check(f"{width}px: keyboard selection preserves S18 identity", page.evaluate("() => HEWRSApp.ui.draft().choice.id === HEWRSApp.ui.rows.topwear.find(r=>r.kind==='suit' && r.sourceId==='S18').id"))
                close_picker(page)
                check(f"{width}px: cancelling searched suit retains applied S05", state(page) == suit_applied)
                open_picker(page, type_filter="suit")
                page.click("#picker-engine")
                page.click("#picker-apply")
                open_picker(page, "shirt")
                check(f"{width}px: shirt picker remains unchanged", page.locator("#picker-list .hewrs-blazer-picker-choice, #picker-list .hewrs-suit-picker-choice").count() == 0)
                close_picker(page)

                open_picker(page, type_filter="blazer")
                page.evaluate("document.getElementById('fx-sheet-body').scrollTop = 0")
                page.wait_for_function("() => document.querySelector('#picker-list img')?.complete")
                check(f"{width}px: dialog and Apply stay inside viewport", page.evaluate("() => {const d=document.getElementById('fx-sheet').getBoundingClientRect();const a=document.getElementById('picker-apply').getBoundingClientRect();const b=document.getElementById('fx-sheet-body');return d.left>=-1 && d.right<=innerWidth+1 && d.top>=-1 && d.bottom<=innerHeight+1 && a.bottom<=innerHeight+1 && b.scrollWidth<=b.clientWidth+1;}"))
                check(f"{width}px: garment DNA and rows unchanged", page.evaluate("() => HEWRSApp.ui.rows.topwear.map(r=>({...r}))") == labels_before)
                page.screenshot(path=str(args.output / f"blazer-picker-{width}.png"), full_page=True)
                page.fill("#picker-search", "B15")
                page.wait_for_function("() => {const im=document.querySelector('#picker-list button[data-item-id=\"B15\"] img');return im?.complete && im.naturalWidth===996 && im.naturalHeight===2748;}")
                check(f"{width}px: B15 uses the existing native avatar", page.locator('#picker-list button[data-item-id="B15"] .hewrs-blazer-picker-image').get_attribute("data-source-kind") == "native_avatar_preview")
                page.screenshot(path=str(args.output / f"blazer-picker-B15-{width}.png"), full_page=True)
                context.close()

            context = browser.new_context(viewport={"width": 390, "height": 844})
            context.route("**/*", route)
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("response", lambda response: missing.append(response.url) if response.status >= 400 else None)
            page.route("**/evidence/blazers_v1_9/source/B04_PHONE.jpg", lambda route: route.abort())
            page.goto(origin + "/blazer-picker-preview.html?show=blazers", wait_until="domcontentloaded")
            page.wait_for_function("globalThis.HEWRS_READY === true")
            check("Direct review link opens Blazers", page.locator("#picker-type").input_value() == "blazer")
            broken = page.locator('button[data-item-id="B04"]')
            broken.scroll_into_view_if_needed()
            broken.get_by_text("Image unavailable").wait_for(state="visible")
            broken.click()
            check("Missing image retains B04 identity and choice", page.evaluate("() => HEWRSApp.ui.draft().choice.id === 'blazer-3'"))
            page.goto(origin + "/blazer-picker-preview.html?show=blazers&item=B15", wait_until="domcontentloaded")
            page.wait_for_function("globalThis.HEWRS_READY === true")
            check("B15 review link opens the corrected item directly", page.locator("#picker-search").input_value() == "B15" and page.locator('#picker-list button[data-item-id="B15"]').count() == 1 and page.locator("#picker-list button").count() == 1)
            page.goto(origin + "/blazer-picker-preview.html?show=suits", wait_until="domcontentloaded")
            page.wait_for_function("globalThis.HEWRS_READY === true && document.querySelectorAll('#picker-list .hewrs-suit-picker-choice').length === 18")
            check("Suit review link opens all 18 Suits directly", page.locator("#picker-type").input_value() == "suit" and page.locator("#picker-list .hewrs-blazer-picker-choice").count() == 0)
            page.goto(origin + "/blazer-picker-preview.html?show=suits&item=S02", wait_until="domcontentloaded")
            page.wait_for_function("globalThis.HEWRS_READY === true && !!document.querySelector('#picker-list .hewrs-suit-picker-choice img')")
            check("S02 review link preserves its explicit source label", page.locator("#picker-search").input_value() == "S02" and page.locator("#picker-list button").count() == 1 and page.locator('button[data-item-id="S02"]').get_by_text("Original cloth photo", exact=True).is_visible())
            context.close()
            browser.close()
        release = json.loads((ROOT / "STANDARD_RELEASE.json").read_text())
        for path in ("index.html", "app.html"):
            check(path + " remains accepted Standard", hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == release["entrypoint_sha256"])
        check("Accepted runtime remains unchanged", hashlib.sha256((ROOT / release["runtime"]).read_bytes()).hexdigest() == release["runtime_sha256"])
        check("No page errors", not errors)
        check("No external requests", not external)
        check("No missing local resources", not missing)
    finally:
        server.shutdown()
        server.server_close()
        report = {"checks": checks, "passed": sum(c["passed"] for c in checks), "failed": sum(not c["passed"] for c in checks), "errors": errors, "external": external, "missing": missing, "owner_browser_accessed": False}
        (args.output / "RESULT.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
