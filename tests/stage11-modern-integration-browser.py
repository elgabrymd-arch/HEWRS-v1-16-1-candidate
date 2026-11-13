#!/usr/bin/env python3
"""Stage 11 live-code candidate browser check, using empty synthetic browser storage.

No user data, production writes, or paid calls. Verifies native Stage 10 owner
feedback after the revised classification reaches the UI recommendation list.
"""
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def main():
    handler = functools.partial(Quiet, directory=str(ROOT))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = 'http://127.0.0.1:' + str(server.server_address[1])
    findings = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
            page = browser.new_page(viewport={'width':390,'height':844})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(origin + '/stage11-modern-test.html', wait_until='domcontentloaded')
            page.wait_for_function('globalThis.HEWRS_READY===true', timeout=60000)
            assert page.evaluate("()=>HEWRSApp.version.endsWith('_STAGE10') && !!HEWRSApp.ownerFeedback"), 'Stage 10 owner feedback missing'
            page.wait_for_function('globalThis.HEWRSReviewedIntegration !== undefined', timeout=60000)
            assert page.evaluate("()=>HEWRSOutfitFeedback.ownerRuleCheck({blazerId:'B11',pantId:'PG002',shirtId:'DS001',state:'T017',shoeId:'shoe-8',watchId:null},{context:{occasion:'work'}}).allowed===false"), 'B11 NO TIE rule missing'

            page.click('#style-button')
            page.select_option('#style-select', 'MODERN')
            page.get_by_role('button', name='Apply', exact=True).click()
            for occasion in ('work','dinner','weekend'):
                if occasion != 'work':
                    page.click('#work-button')
                    page.select_option('#occasion-select', occasion)
                    page.get_by_role('button', name='Apply', exact=True).click()
                assert page.evaluate("()=>HEWRSApp.state().context.style==='MODERN'"), 'Modern selection lost'
                page.click('#generate-options')
                page.wait_for_function("()=>{const s=HEWRSApp.state();return !s.busy&&s.page==='outfits'&&s.context.style==='MODERN'&&s.request?.context?.occasion===s.context.occasion&&Array.isArray(s.report?.options);}", timeout=360000)
                info=page.evaluate("""()=>{const a=HEWRSApp.state(),r=a.report||{},q=a.request;
                const invalid=(r.options||[]).filter(o=>{
                  const s=o._hewrsConnected.canonical_selection;
                  return !HEWRSOutfitFeedback.ownerRuleCheck(s,{context:q?.context}).allowed;
                });
                return {occasion:a.context.occasion,status:r.status,returned:a.optionCount,
                    requested:r.requested_options||20,owner_removed:r.owner_feedback_integration?.removed||0,
                    exact_owner_rule_violations:invalid.length,first_avatar_ready:document.querySelector('#avatar').dataset.status==='ready',
                    actual_styles:[...new Set((r.options||[]).map(o=>o._hewrsConnected.compatibility.style.classification))],
                    message:r.reason||null};}""")
                findings.append(info)
                print('BROWSER_MODERN', json.dumps(info, ensure_ascii=False), flush=True)
                assert info['occasion']==occasion, 'Wrong occasion'
                assert info['returned']==20, 'Not enough verified Modern choices after owner veto'
                assert info['exact_owner_rule_violations']==0, 'Owner rule violated'
                assert info['actual_styles']==['MODERN'], 'Misclassified result'
                assert info['first_avatar_ready'], 'Original avatar failed to render'
                page.click('[data-page="home"]')
            assert not errors, 'Page error: ' + repr(errors)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(json.dumps({'result':'PASS','findings':findings}, indent=2))

if __name__=='__main__':
    main()
