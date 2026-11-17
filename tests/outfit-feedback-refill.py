"""Real-app regression coverage for preserving and refilling rejected options.

Runs the actual preview, generator, renderer, garment files and storage in fresh
browser contexts. No generated results, catalogue rows or network images are
substituted. Set HEWRS_TEST_LOCAL_ONLY=1 for local cases, or TEST_BASE_URL to
exercise a known hosted directory instead of constructing it from GITHUB_SHA.
"""
import functools
import hashlib
import json
import os
import threading
import time
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "rejection-verification"
OUT.mkdir(exist_ok=True)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def wait(frame, expression, seconds=120):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            if frame.evaluate(expression):
                return
        except Exception:
            pass
        time.sleep(0.15)
    raise TimeoutError(expression)


def clothing_key(row):
    items = row["items"]
    return tuple((items.get(role) or {}).get("id") for role in ("topwear", "shirt", "tie", "pants"))


def outfit_key(selection):
    return tuple(selection.get(k) for k in ("suitId", "blazerId", "pantId", "shirtId", "state", "shoeId"))


def rows(state):
    return (state.get("report") or {}).get("options", [])


def selection(row):
    return row["_hewrsConnected"]["canonical_selection"]


def checked_baseline():
    release = json.loads((ROOT / "STANDARD_RELEASE.json").read_text())
    for name in release["standard_entrypoints"]:
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == release["entrypoint_sha256"], name
    assert hashlib.sha256((ROOT / release["runtime"]).read_bytes()).hexdigest() == release["runtime_sha256"]
    for name, expected in release.get("modules", {}).items():
        # Some source-only inputs were never included in the published folder;
        # the frozen combined runtime above covers their delivered bytes.
        if (ROOT / name).is_file():
            assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, name


def main():
    checked_baseline()
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = "http://127.0.0.1:" + str(server.server_port)
    sha = os.environ.get("GITHUB_SHA", "")
    hosted = os.environ.get("TEST_BASE_URL", "").rstrip("/")
    if not hosted and sha:
        hosted = "https://rawcdn.githack.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/" + sha
    cases = [("refill-local-desktop", origin, 1280)]
    if os.environ.get("HEWRS_TEST_HOSTED_ONLY") == "1":
        cases = []
    if hosted and os.environ.get("HEWRS_TEST_LOCAL_ONLY") != "1":
        cases += [("refill-hosted-desktop", hosted, 1280), ("refill-hosted-phone", hosted, 390)]
    assert cases, "No browser case selected; supply TEST_BASE_URL or GITHUB_SHA."
    results = []
    try:
        with sync_playwright() as pw:
            launch = {"headless": True, "args": ["--no-sandbox"]}
            if os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"):
                launch["executable_path"] = os.environ["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
            browser = pw.chromium.launch(**launch)
            for name, base_url, width in cases:
                result = {"test": name, "url": base_url + "/outfit-feedback-preview.html", "checks": [],
                          "errors": [], "http_errors": [], "provider_requests": [], "blocked_requests": []}
                context = browser.new_context(viewport={"width": width, "height": 900}, is_mobile=width < 500,
                                              has_touch=width < 500, timezone_id="America/New_York")
                permitted_hosts = {urlparse(origin).netloc, urlparse(base_url).netloc,
                                   "rawcdn.githack.com", "raw.githack.com", "raw.githubusercontent.com"}

                def route(request):
                    url = request.request.url
                    if "hewrs-ai-service" in url:
                        result["provider_requests"].append(url)
                    if urlparse(url).netloc in permitted_hosts:
                        request.continue_()
                    else:
                        result["blocked_requests"].append(url)
                        request.abort()

                context.route("**/*", route)
                page = context.new_page()
                page.on("pageerror", lambda error: result["errors"].append(str(error)))
                page.on("response", lambda response: result["http_errors"].append([response.status, response.url])
                        if response.status >= 400 else None)

                def check(label, condition):
                    result["checks"].append({"name": label, "passed": bool(condition)})
                    print(("PASS " if condition else "FAIL ") + name + ": " + label, flush=True)
                    assert condition, label

                def ready():
                    wait(page, "() => document.querySelector('#shirt-preview-app')?.dataset.ready==='true'", 90)
                    frame = page.query_selector("#shirt-preview-app").content_frame()
                    wait(frame, "() => globalThis.HEWRS_READY === true && !!HEWRSApp.rejection", 30)
                    return frame

                def state(frame):
                    return frame.evaluate("() => HEWRSApp.state()")

                def generate(frame):
                    frame.locator('[data-page="home"]').click()
                    frame.locator("#generate-options").click()
                    wait(frame, "() => !HEWRSApp.state().busy && HEWRSApp.state().page==='outfits'", 180)
                    outcome = state(frame)
                    check("Generation completed without an application error", (outcome.get("report") or {}).get("status") != "error")
                    return outcome

                def stable_records(frame):
                    return frame.evaluate("() => ({prefs:HEWRSApp.ui.snapshot(), wear:HEWRSApp.store.readForGeneration().events, favorites:HEWRSApp.favorites.snapshot()})")

                def choose(frame, index):
                    frame.locator("#open-results").click()
                    frame.locator("#fx-sheet-body .fx-choice").nth(index).click()
                    wait(frame, "() => !HEWRSApp.state().busy && HEWRSApp.state().optionIndex===" + str(index))
                    return state(frame)

                def reject(frame, permanent=False):
                    old = state(frame)["selection"]
                    frame.locator("#reject-outfit").click()
                    frame.locator("#rejection-reason").select_option("colors")
                    frame.locator("#rejection-note").fill("Isolated browser regression: preserve accepted outfits.")
                    frame.locator("#rejection-permanent" if permanent else "#rejection-once").click()
                    wait(frame, "() => !HEWRSApp.state().busy && !document.getElementById('outfit-rejection-dialog')?.open && !document.getElementById('undo-outfit-rejection').disabled", 180)
                    return old, state(frame)

                def check_set(frame, outcome, label):
                    options = rows(outcome)
                    check(label + ": true option count matches the stored list", len(options) == outcome["optionCount"])
                    check(label + ": no duplicated clothing or watch-only variants", len({clothing_key(o) for o in options}) == len(options))
                    check(label + ": every row passes the real generator validation", frame.evaluate("() => {const a=HEWRSApp,s=a.state();return a.connection.controller.verifyOptionSet(s.report.options,s.request);}"))
                    check(label + ": every row passes current rejection rules", frame.evaluate("() => {const a=HEWRSApp,s=a.state();return s.report.options.every(o=>a.ownerFeedback.allowed(a.connection.selectionFromOption(o,s.request).selection,s.request.context));}"))
                    if options:
                        check(label + ": navigator shows the actual count", frame.locator("#option-count").inner_text().endswith(" of " + str(len(options))))
                        check(label + ": actual garment pixels rendered", frame.locator("#avatar").get_attribute("data-status") == "ready")

                def survivors_unchanged(before, after, rejected):
                    expected = [o for o in before if outfit_key(selection(o)) not in rejected]
                    current = {outfit_key(selection(o)): o for o in after}
                    return all(current.get(outfit_key(selection(o))) == o for o in expected)

                try:
                    page.goto(result["url"], wait_until="domcontentloaded", timeout=90000)
                    if page.get_by_text("Open the page", exact=True).count():
                        page.get_by_text("Open the page", exact=True).click()
                    frame = ready()
                    initial = generate(frame)
                    initial_rows = rows(initial)
                    check("Initial list contains 20 actual outfits", initial["optionCount"] == 20)
                    check_set(frame, initial, "Initial list")
                    original_records = stable_records(frame)
                    permanent_before = frame.evaluate("() => HEWRSApp.ownerFeedback.exportData().events")
                    rejected = set()

                    first, after_first = reject(frame)
                    rejected.add(outfit_key(first))
                    check("First rejection restores 20 without Generate", after_first["optionCount"] == 20)
                    check("All 19 original accepted rows are unchanged", survivors_unchanged(initial_rows, rows(after_first), rejected))
                    check_set(frame, after_first, "After first rejection")
                    original_keys = {outfit_key(selection(o)) for o in initial_rows}
                    second_index = next(i for i, o in enumerate(rows(after_first)) if outfit_key(selection(o)) in original_keys - rejected)
                    choose(frame, second_index)
                    second, after_second = reject(frame)
                    rejected.add(outfit_key(second))
                    check("Two rejections still leave 20 actual choices", after_second["optionCount"] == 20)
                    check("All 18 original accepted rows are unchanged", survivors_unchanged(initial_rows, rows(after_second), rejected))
                    check("Exactly 18 original rows plus two new rows remain", sum(outfit_key(selection(o)) in original_keys for o in rows(after_second)) == 18)
                    check("Both rejected combinations are absent", not rejected.intersection(outfit_key(selection(o)) for o in rows(after_second)))
                    check("New rows have genuinely new outfits, ignoring watch changes", len({outfit_key(selection(o)) for o in rows(after_second)} - original_keys) == 2)
                    check("Both temporary rejections survive automatic refill", frame.evaluate("() => HEWRSApp.ownerFeedback.snapshot().temporary.length") == 2)
                    check("Temporary rejection created no permanent entries", frame.evaluate("() => HEWRSApp.ownerFeedback.exportData().events") == permanent_before)
                    check("Pins, wear history and Favorites remain unchanged", stable_records(frame) == original_records)
                    check("Changing only the watch cannot evade the rejection", frame.evaluate("s => {const a=HEWRSApp,w=a.connection.catalogue.watches.find(w=>w.id!==s.watchId);return !a.ownerFeedback.allowed({...s,watchId:w.id},a.state().request.context);}", first))
                    check_set(frame, after_second, "After two rejections")

                    choose(frame, 0)
                    frame.locator("#prev-option").click()
                    wait(frame, "() => !HEWRSApp.state().busy && HEWRSApp.state().optionIndex===19")
                    check("Previous wraps from first to twentieth option", state(frame)["optionIndex"] == 19)
                    frame.locator("#next-option").click()
                    wait(frame, "() => !HEWRSApp.state().busy && HEWRSApp.state().optionIndex===0")
                    check("Next wraps from twentieth to first option", state(frame)["optionIndex"] == 0)
                    frame.locator("#undo-outfit-rejection").click()
                    check("Undo removes just the last temporary rejection", frame.evaluate("() => HEWRSApp.ownerFeedback.snapshot().temporary.length") == 1)
                    fresh = generate(frame)
                    check("Explicit Generate clears temporary skips and returns 20", fresh["optionCount"] == 20 and frame.evaluate("() => HEWRSApp.ownerFeedback.snapshot().temporary.length") == 0)

                    permanent, after_permanent = reject(frame, permanent=True)
                    check("Permanent rejection also refills to 20", after_permanent["optionCount"] == 20)
                    check("Permanent rejection preserves its 19 accepted rows", survivors_unchanged(rows(fresh), rows(after_permanent), {outfit_key(permanent)}))
                    events = frame.evaluate("() => HEWRSApp.ownerFeedback.snapshot().active")
                    check("Permanent reason and note are saved", len(events) == 1 and events[0]["reason"] == "colors" and events[0].get("note") == "Isolated browser regression: preserve accepted outfits.")
                    page.reload(wait_until="domcontentloaded")
                    frame = ready()
                    check("Permanent rejection persists after reload", len(frame.evaluate("() => HEWRSApp.ownerFeedback.snapshot().active")) == 1)
                    reloaded = generate(frame)
                    check("Regeneration cannot return permanent rejected outfit", outfit_key(permanent) not in {outfit_key(selection(o)) for o in rows(reloaded)})
                    frame.locator("#manage-outfit-rejections").click()
                    frame.locator("#rejection-records button").first.click()
                    frame.locator("#rejections-close").click()
                    check("Manager undo removes permanent rejection", len(frame.evaluate("() => HEWRSApp.ownerFeedback.snapshot().active")) == 0)

                    if name == "refill-local-desktop":
                        # Representative independent combinations; opt into the
                        # full 12-condition matrix when a change touches policy.
                        matrix = [("work", "CLASSIC"), ("dinner", "HYBRID"), ("weekend", "MODERN")]
                        if os.environ.get("HEWRS_TEST_MATRIX") == "1":
                            matrix = [(occasion, style) for occasion in ("work", "dinner", "weekend")
                                      for style in ("AUTO", "CLASSIC", "HYBRID", "MODERN")]
                        for occasion, style in matrix:
                            frame.locator('[data-page="home"]').click()
                            frame.locator("#work-button").click()
                            frame.locator("#occasion-select").select_option(occasion)
                            frame.locator("#fx-sheet-actions").get_by_role("button", name="Apply", exact=True).click()
                            frame.locator("#style-button").click()
                            frame.locator("#style-select").select_option(style)
                            frame.locator("#fx-sheet-actions").get_by_role("button", name="Apply", exact=True).click()
                            condition = occasion + "/" + style
                            before_condition = generate(frame)
                            check(condition + " generates real options", before_condition["optionCount"] > 0)
                            removed, after_condition = reject(frame)
                            check(condition + " preserves accepted rows", survivors_unchanged(rows(before_condition), rows(after_condition), {outfit_key(removed)}))
                            check(condition + " retains selected occasion and style", after_condition["context"]["occasion"] == occasion and after_condition["context"]["style"] == style)
                            check_set(frame, after_condition, condition)
                        frame.locator('[data-page="home"]').click()
                        frame.locator("#work-button").click()
                        frame.locator("#occasion-select").select_option("work")
                        frame.locator("#fx-sheet-actions").get_by_role("button", name="Apply", exact=True).click()
                        frame.locator("#style-button").click()
                        frame.locator("#style-select").select_option("AUTO")
                        frame.locator("#fx-sheet-actions").get_by_role("button", name="Apply", exact=True).click()

                    # Pick a real eligible shirt through the same public photo picker.
                    anchor = selection(initial_rows[0])["shirtId"]
                    frame.locator('[data-page="home"]').click()
                    frame.locator("#pref-shirt").click()
                    frame.locator('#picker-list [data-item-id="' + anchor + '"]').click()
                    frame.locator("#picker-apply").click()
                    pinned = generate(frame)
                    check("Pinned-shirt request has actual choices", pinned["optionCount"] > 1)
                    pinned_records = stable_records(frame)
                    pinned_rejected, pinned_after = reject(frame)
                    check("Refill preserves exact pinned shirt", all(selection(o)["shirtId"] == anchor for o in rows(pinned_after)))
                    check("Refill preserves every accepted pinned row", survivors_unchanged(rows(pinned), rows(pinned_after), {outfit_key(pinned_rejected)}))
                    check("Refill does not unlock pins or change records", stable_records(frame) == pinned_records)
                    check_set(frame, pinned_after, "Pinned shirt refill")

                    # Exact owned clothing and shoes leave one clothing identity.
                    # Use the production preference API, then Generate and Reject
                    # through the actual UI. The generator, rows and images remain real.
                    exact_selection = selection(rows(pinned_after)[0])
                    frame.evaluate("s => {HEWRSApp.ui.fromSelection(s);HEWRSApp.setMode('engine');}", exact_selection)
                    limited = generate(frame)
                    check("Tight exact pins produce only one unique outfit", limited["optionCount"] == 1)
                    locked_records = stable_records(frame)
                    _, exhausted = reject(frame)
                    check("Exhaustion is 0 actual choices, never fake replacements", exhausted["optionCount"] == 0 and len(rows(exhausted)) == 0)
                    check("Exhaustion retains all exact pins", stable_records(frame) == locked_records)
                    message = " ".join(frame.locator(selector).inner_text() for selector in ("#rejection-status", "#outfit-summary", "#option-count"))
                    check("Exhaustion reports the actual shortage", "0" in message and any(word in message.lower() for word in ("available", "remain", "eligible", "found", "match")))
                    check("Rejected exhausted outfit is hidden", frame.locator("#outfit-output").is_hidden() or frame.locator("#outfit-output").get_attribute("data-rejection-hidden") == "true")
                    check("Refill makes no paid provider requests", not result["provider_requests"])
                    check("No uncaught application error", not result["errors"])
                    check("All requested application resources load", not result["http_errors"])
                    result["passed"] = True
                    page.screenshot(path=str(OUT / (name + ".png")), full_page=True)
                except Exception as error:
                    result["passed"] = False
                    result["exception"] = str(error)
                    result["traceback"] = traceback.format_exc()
                    try:
                        result["body"] = page.locator("body").inner_text()[:4000]
                        for candidate in page.frames:
                            if candidate != page.main_frame:
                                result["frame_body"] = candidate.locator("body").inner_text()[:10000]
                                result["state"] = candidate.evaluate("() => globalThis.HEWRSApp?.state()")
                        page.screenshot(path=str(OUT / (name + "-error.png")), full_page=True)
                    except Exception:
                        pass
                finally:
                    print("SUMMARY " + json.dumps({key: result.get(key) for key in ("test", "passed", "exception", "errors", "http_errors")}), flush=True)
                    results.append(result)
                    (OUT / "REFILL_ACCEPTANCE.json").write_text(json.dumps(results, indent=2))
                    context.close()
            browser.close()
    finally:
        server.shutdown()
    assert all(result["passed"] for result in results), "Real-app refill validation failed."


if __name__ == "__main__":
    main()
