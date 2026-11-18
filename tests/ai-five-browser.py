#!/usr/bin/env python3
"""Actual shipped HEWRS runtime and AI Five UI, using intercepted HTTP fixtures.

Fresh browser storage only. Every external request is intercepted or blocked.
No provider request, service activation, user credential or user ledger is used.
"""
import functools
import json
import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SERVICE = "https://hewrs-ai-service.onrender.com"
TOKEN = "browser-fixture-service-token-0000000000000000"
MODEL = "browser-fixture-model"
DATE = "2026-10-20"


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def wait_until(page, expression, timeout_ms=180000):
    """Poll through DevTools without evaluating strings inside the page.

    Playwright wait_for_function currently uses globalThis.eval in the main
    world; the app's unchanged CSP correctly forbids it. page.evaluate sends
    this function directly through the browser protocol instead.
    """
    deadline = time.monotonic() + timeout_ms / 1000
    predicate = "() => Boolean(" + expression + ")"
    while True:
        if page.evaluate(predicate):
            return
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise AssertionError("Timed out waiting for browser condition: " + expression)
        time.sleep(min(0.1, remaining))


SNAPSHOT = """() => {
  const app=HEWRSApp, state=app.state();
  const data=document.getElementById('avatar').getContext('2d').getImageData(0,0,996,2748).data;
  let hash=2166136261;for(const byte of data)hash=Math.imul(hash^byte,16777619);
  const saved=storage=>Object.fromEntries(Object.keys(storage).sort().map(k=>[k,storage.getItem(k)]));
  return {selection:state.selection,origin:state.origin,mode:state.mode,page:state.page,busy:state.busy,
    report:state.report,request:state.request,optionCount:state.optionCount,
    optionIndex:state.optionIndex,score:state.score,context:state.context,
    preferences:state.preferences,sourceLock:state.sourceLock,
    avatarHash:hash>>>0,localStorage:saved(localStorage),sessionStorage:saved(sessionStorage)};
}"""

FIXTURES = """() => {
  const app=HEWRSApp, state=app.state(), P=HEWRSAIFiveExclusion;
  const gate=HEWRSRejectionPreviewCore.attach(app), native=HEWRSAIFiveNative.create({app,feedback:gate});
  const baseline=state.report.options, excluded=new Set(baseline.map(P.garmentKey));
  const selections=['B11','B01'].map(blazerId=>({blazerId,pantId:'PG003',shirtId:'DS001',
    state:'T017',shoeId:'shoe-3',watchId:null}));
  selections.push(...app.connection.hybrid.library.records.map(row=>row.selection));
  const selected=[], seen=new Set(), context=state.request.context;
  for(const original of selections){
    const s={...original,watchId:'watch-R01'};
    if(!native.validate(s,context)||!native.ownerAllows(s,context)||!native.rotationAllows(s,state.request))continue;
    const key=P.garmentKey(s);if(excluded.has(key)||seen.has(key))continue;
    seen.add(key);selected.push(structuredClone(s));if(selected.length===5)break;
  }
  const nativeWatch=structuredClone(baseline[0]._hewrsConnected.canonical_selection);
  nativeWatch.watchId=nativeWatch.watchId==='watch-R01'?'watch-R03':'watch-R01';
  const aiWatch={...selected[0],watchId:'watch-R03'};
  const originalGate=selected.slice(0,2).map(s=>({id:s.blazerId,allowed:gate.match(s,context).allowed}));
  // Match the backend's fixed eight-field wire schema. The real transport
  // must validate/normalize it into the native exact suit/blazer field shape.
  const wire=s=>({suitId:s.suitId||null,blazerId:s.blazerId||null,pantId:s.pantId||null,
    shirtOnly:s.shirtOnly===true,shirtId:s.shirtId,state:s.state,shoeId:s.shoeId,watchId:s.watchId});
  const proposals=[nativeWatch,selected[0],aiWatch,...selected.slice(1)].map(selection=>({
    selection:wire(selection),occasion:context.occasion,rationale:'Browser HTTP fixture; this is not AI-generated content.'}));
  native.disconnect();
  return {selected,proposals,excluded:[...excluded],originalGate,occasion:context.occasion};
}"""


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = "http://127.0.0.1:" + str(server.server_address[1])
    requests, blocked, route_errors, page_errors, findings = [], [], [], [], []
    config, fixtures = {}, {}
    screenshot_dir = os.environ.get("AI_FIVE_SCREENSHOT_DIR")
    if screenshot_dir:
        Path(screenshot_dir).mkdir(parents=True, exist_ok=True)
    browser = None
    page = None
    pw = None

    def respond(route, status, payload=None):
        headers = {"Access-Control-Allow-Origin": origin,
                   "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                   "Access-Control-Allow-Headers": "Authorization, Content-Type",
                   "Cache-Control": "no-store", "Content-Type": "application/json"}
        route.fulfill(status=status, headers=headers, body="" if payload is None else json.dumps(payload))

    def intercept(route):
        request = route.request
        url = request.url
        path = urlsplit(url).path
        if url.startswith(origin + "/"):
            if path == "/data/ai-five-service-config.js":
                script = (ROOT / "data/ai-five-service-config.js").read_text()
                assert script.count("enabled:false") == 1, "Unexpected AI Five test configuration"
                route.fulfill(status=200, content_type="application/javascript",
                              body=script.replace("enabled:false", "enabled:true"))
            else:
                route.continue_()
            return
        if url in (SERVICE + "/v1/ai-five/status", SERVICE + "/v1/ai-five/generate"):
            if request.method == "OPTIONS":
                respond(route, 204)
                return
            try:
                assert request.headers.get("authorization") == "Bearer " + TOKEN, "Missing fixture access token"
                requests.append({"method": request.method, "path": path})
                if path.endswith("/status"):
                    assert request.method == "GET"
                    respond(route, 200, {"schema": "hewrs.ai-five.status.v1",
                        "configured": True, "authenticated": True, "blocked_by": [],
                        "source_lock": config["source_lock"],
                        "catalogue_fingerprint": config["catalogue_fingerprint"],
                        "model": MODEL, "capabilities": ["independent_outfit_generation_v1"]})
                    return
                assert request.method == "POST"
                packet = request.post_data_json
                assert packet["schema"] == "hewrs.ai-five.request.v1" and packet["consent"] is True
                q = packet["request"]
                assert set(q) == {"request_id", "source_lock", "catalogue_fingerprint", "context",
                                  "localDate", "weather", "excluded_outfit_keys"}, "Private data crossed service boundary"
                assert q["context"] == {"occasion": fixtures["occasion"], "requiredFormality": "any"}
                assert q["excluded_outfit_keys"] == fixtures["excluded"]
                assert q["source_lock"] == config["source_lock"]
                assert q["catalogue_fingerprint"] == config["catalogue_fingerprint"]
                assert q["localDate"] == DATE
                assert q["weather"] == {"source": "not_assessed", "temperatureBand": None,
                                         "precipitation": None, "season": None}
                respond(route, 200, {"schema": "hewrs.ai-five.response.v1", "request_id": q["request_id"],
                    "source_lock": q["source_lock"], "catalogue_fingerprint": q["catalogue_fingerprint"],
                    "proposals": fixtures["proposals"], "job_id": "browser-fixture-" + fixtures["occasion"],
                    "cached": False, "provider": {"name": "openai", "requested_model": MODEL,
                        "model": MODEL, "response_id": "fixture-only-" + fixtures["occasion"], "live_call": False}})
            except Exception as error:
                route_errors.append(str(error))
                respond(route, 500, {"error": {"message": "Browser test HTTP fixture assertion failed"}})
            return
        blocked.append(urlsplit(url).netloc + path)
        route.abort()

    try:
        pw = sync_playwright().start()
        executable = os.environ.get("CHROMIUM_PATH")
        if not executable and not Path(pw.chromium.executable_path).is_file():
            executable = "/usr/bin/chromium" if Path("/usr/bin/chromium").is_file() else None
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox"],
                                     **({"executable_path": executable} if executable else {}))
        context = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        context.route("**/*", intercept)
        page = context.new_page()
        page.set_default_timeout(180000)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.goto(origin + "/index.html", wait_until="domcontentloaded")
        wait_until(page, "globalThis.HEWRS_READY === true && !!globalThis.HEWRSAIFivePanel", timeout_ms=30000)
        config.update(page.evaluate("HEWRS_AI_FIVE_SERVICE_CONFIG"))
        assert config["enabled"] is True
        assert requests == [], "AI service requested before a user action"
        page.evaluate("HEWRSApp.autoWeather.cancel()")

        for index, occasion in enumerate(("work", "dinner", "weekend")):
            result = page.evaluate("""async ({occasion,date})=>{
              const app=HEWRSApp; app.autoWeather.cancel();
              await app.generate({automatic:true,stylistMode:'research',
                preferences:app.ui.snapshot(),occasion,formality:'any',style:'AUTO',localDate:date,
                environment:app.weather.request(date)});
              const state=app.state();
              return {count:state.optionCount,occasion:state.request?.context?.occasion,
                busy:state.busy,avatar:document.getElementById('avatar').dataset.status};
            }""", {"occasion": occasion, "date": DATE})
            assert result == {"count": 20, "occasion": occasion, "busy": False, "avatar": "ready"}, result
            wait_until(page, "HEWRSAIFivePanel.diagnostics().count === 0")
            fixtures.clear()
            fixtures.update(page.evaluate(FIXTURES))
            assert len(fixtures["selected"]) == 5, "Five valid distinct fixture selections unavailable"
            assert fixtures["originalGate"] == [{"id": "B11", "allowed": False}, {"id": "B01", "allowed": False}]

            if index == 0:
                page.locator("#hewrs-ai-five summary").click()
                page.fill("#ai-five-token", TOKEN)
                page.click("#ai-five-connect")
                wait_until(page, "HEWRSAIFivePanel.diagnostics().available === true || "
                           "document.getElementById('ai-five-status').textContent.startsWith('AI connection unavailable:')",
                           timeout_ms=20000)
                assert page.evaluate("() => HEWRSAIFivePanel.diagnostics().available"), page.inner_text("#ai-five-status")
                assert page.input_value("#ai-five-token") == "", "Service token remained in input"
                # Verify both UI consent enforcement and that no request is sent.
                page.click("#generate-ai-five")
                wait_until(page, "!HEWRSAIFivePanel.diagnostics().running")
                assert len(requests) == 1 and requests[0]["path"].endswith("/status")
                assert "Allow the paid request" in page.inner_text("#ai-five-status")
                page.check("#ai-five-consent")

            before = page.evaluate(SNAPSHOT)
            assert TOKEN not in json.dumps(before), "Fixture credential leaked into native storage/state"
            page.click("#generate-ai-five")
            wait_until(page, "!HEWRSAIFivePanel.diagnostics().running")
            diagnostic = page.evaluate("HEWRSAIFivePanel.diagnostics()")
            status = page.inner_text("#ai-five-status")
            assert diagnostic["hasResult"] and diagnostic["count"] == 5, {"diagnostic": diagnostic, "status": status}
            assert diagnostic["live_ai_used"] is False
            assert "Test fixtures; no live AI generation" in status
            assert page.locator("#ai-five-results > article").count() == 5
            assert page.locator("#ai-five-results > article > strong").all_text_contents() == ["Test fixture " + str(i) for i in range(1, 6)]
            displayed = page.locator("#ai-five-results > article > p.fx-caption:first-of-type").all_text_contents()
            assert "B11" in displayed[0] and "B01" in displayed[1]
            assert all("T017" in text and "shoe-3" in text for text in displayed[:2])
            assert page.evaluate(SNAPSHOT) == before, "AI generation changed native state, avatar or saved data"
            wait_until(page, "[...document.querySelectorAll('#ai-five-results img')].every(i=>i.complete && i.naturalWidth===420 && i.naturalHeight===1160)")

            for preview_index in (0, 1):
                page.locator('[data-ai-five-index="' + str(preview_index) + '"]').click()
                wait_until(page, "document.getElementById('ai-five-preview').open")
                assert occasion in page.inner_text("#ai-five-preview-title")
                page.locator("#ai-five-preview img").evaluate("image=>image.decode()")
                assert page.evaluate(SNAPSHOT) == before, "Full AI avatar preview mutated the native app"
                if screenshot_dir and index == 0 and preview_index == 0:
                    page.screenshot(path=str(Path(screenshot_dir) / "ai-five-full-avatar.png"))
                page.get_by_role("button", name="Close preview", exact=True).click()
            assert page.evaluate(SNAPSHOT) == before, "Closing the AI preview mutated native state"
            findings.append({"occasion": occasion, "native": 20, "independent_fixture_options": 5,
                "duplicate_watch_variants_removed": 2, "full_avatar_preview": "unchanged native state/pixels/storage",
                "legacy_B11_B01_garment_rules_exempted_only_for_AI": True,
                "explicit_fixture_label": True})
            print("AI_FIVE_BROWSER", json.dumps(findings[-1]), flush=True)

        # An actual explicit outfit rejection must invalidate the displayed
        # AI results and close their dialog, even for exempted B11 styling.
        page.locator('[data-ai-five-index="0"]').click()
        page.evaluate("""selection=>HEWRSRejectionPreviewCore.attach(HEWRSApp).hide(selection,
          {context:{occasion:'weekend',requiredFormality:'any'},scope:'outfit'})""", fixtures["selected"][0])
        wait_until(page, "HEWRSAIFivePanel.diagnostics().count===0 && !document.getElementById('ai-five-preview').open")
        assert page.locator("#ai-five-results > article").count() == 0
        assert not page.evaluate("document.querySelector('#ai-five-preview img').hasAttribute('src')")
        assert len([r for r in requests if r["path"].endswith("/generate")]) == 3
        assert not route_errors, route_errors
        assert not page_errors, page_errors
        print(json.dumps({"result": "PASS", "runtime": "actual index.html and outfit-refill-preview.js",
            "findings": findings, "explicit_rejection_invalidated_result": True,
            "intercepted_fixture_requests": requests, "external_requests_blocked": len(blocked),
            "provider_calls": 0}, indent=2), flush=True)
        browser.close()
        browser = None
    except Exception as error:
        failure = {"error": str(error), "page_errors": page_errors, "route_errors": route_errors}
        if page is not None:
            try:
                failure.update(page.evaluate("""() => ({
                  status:document.getElementById('ai-five-status')?.textContent ?? null,
                  diagnostic:globalThis.HEWRSAIFivePanel?.diagnostics?.() ?? null,
                  native_ready:globalThis.HEWRS_READY===true
                })"""))
            except Exception as capture_error:
                failure["diagnostic_error"] = str(capture_error)
            if screenshot_dir:
                try:
                    page.screenshot(path=str(Path(screenshot_dir) / "ai-five-failure.png"))
                except Exception as capture_error:
                    failure["screenshot_error"] = str(capture_error)
        print("AI_FIVE_BROWSER_FAILURE", json.dumps(failure), flush=True)
        raise
    finally:
        if browser is not None:
            try:
                browser.close()
            except Exception:
                pass
        if pw is not None:
            try:
                pw.stop()
            except Exception:
                pass
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
