#!/usr/bin/env python3
"""Stage 10 Home preference regression against the freshly built HTTP app.

Uses isolated browser storage. Never opens or edits real saved wardrobe data.
"""
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def main():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_address[1]}"
    checks = []

    def check(label, condition):
        assert condition, label
        checks.append(label)
        print("PASS:", label, flush=True)

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda err: errors.append(str(err)))
            page.goto(origin + "/index.html", wait_until="domcontentloaded")
            page.wait_for_function("globalThis.HEWRS_READY === true", timeout=60000)
            check("Initial six categories unlocked", page.evaluate(
                "() => Object.values(HEWRSApp.ui.snapshot()).every(p => p.mode === 'any')"))
            wear_before = page.evaluate("() => JSON.stringify(HEWRSApp.store.snapshot())")
            favorites_before = page.evaluate("() => JSON.stringify(HEWRSApp.favorites.snapshot())")

            page.click("#pref-tie")
            page.locator('[data-item-id="NO_TIE"]').click()
            page.click("#picker-apply")
            check("NO TIE applied", page.evaluate("() => HEWRSApp.ui.snapshot().tie.mode === 'none'"))
            storage_key = page.evaluate("() => 'hewrs:home-preferences:v1:' + HEWRS_INPUT_SHA256")
            stored = page.evaluate("(key) => localStorage.getItem(key)", storage_key)
            check("Six category choices are written to separate source-locked storage",
                  bool(stored) and json.loads(stored)["preferences"]["tie"]["mode"] == "none")

            page.click("#mode-anchor")
            page.click("#mode-engine")
            page.click('[data-page="wardrobe"]')
            page.click('[data-page="home"]')
            check("Mode and page navigation preserve NO TIE",
                  page.evaluate("() => HEWRSApp.ui.snapshot().tie.mode === 'none'"))
            page.reload(wait_until="domcontentloaded")
            page.wait_for_function("globalThis.HEWRS_READY === true", timeout=60000)
            check("Refresh restores NO TIE", page.evaluate(
                "() => HEWRSApp.ui.snapshot().tie.mode === 'none'"))
            check("Wear history unchanged", page.evaluate(
                "() => JSON.stringify(HEWRSApp.store.snapshot())") == wear_before)
            check("Favorites unchanged", page.evaluate(
                "() => JSON.stringify(HEWRSApp.favorites.snapshot())") == favorites_before)

            page.click("#reset-preferences")
            page.get_by_role("button", name="Confirm reset").click()
            page.reload(wait_until="domcontentloaded")
            page.wait_for_function("globalThis.HEWRS_READY === true", timeout=60000)
            check("Explicit Reset persists all ANY", page.evaluate(
                "() => Object.values(HEWRSApp.ui.snapshot()).every(p => p.mode === 'any')"))
            check("Reset leaves wear history untouched", page.evaluate(
                "() => JSON.stringify(HEWRSApp.store.snapshot())") == wear_before)
            check("Reset leaves Favorites untouched", page.evaluate(
                "() => JSON.stringify(HEWRSApp.favorites.snapshot())") == favorites_before)

            page.evaluate("([key, value]) => localStorage.setItem(key, value)",
                          [storage_key, "{broken-json"])
            page.reload(wait_until="domcontentloaded")
            page.wait_for_function("globalThis.HEWRS_READY === true", timeout=60000)
            check("Corrupt preference record retained without overwrite",
                  page.evaluate("(key) => localStorage.getItem(key)", storage_key) == "{broken-json")
            check("Corrupt preference record reports warning", "could not be restored" in page.locator("#home-notice").inner_text())
            check("No page errors", not errors)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    print(json.dumps({"passed": len(checks), "failed": 0, "checks": checks}, indent=2))

if __name__ == "__main__":
    main()
