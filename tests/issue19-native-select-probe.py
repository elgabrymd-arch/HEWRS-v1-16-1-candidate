#!/usr/bin/env python3
"""Test native reviewed-panel controls against the exact Issue 19 app bytes.

Upload this file as tests/issue19-native-select-probe.py on an isolated branch
based on APP_COMMIT. No application styles or values are injected to repair UI.
The existing fixture establishes the authorized B01 outfit; subsequent native
selection and restoration use actual keyboard events in fresh browser storage.
"""
import argparse
import functools
import hashlib
import importlib.util
import json
import subprocess
import threading
import traceback
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path.cwd()
APP_COMMIT = '3072f2250ecab527b18f9c3ee6087161b4aa9eb3'
PINS = {
    'index.html': '558276016823a8c05d0e13e79e2ef4f84fc72754a0b45d414ee1a7be3f742372',
    'app.html': '558276016823a8c05d0e13e79e2ef4f84fc72754a0b45d414ee1a7be3f742372',
    'runtime/avatar-v3-candidate-eaf343e290d4fa8c9bcb.js': 'eaf343e290d4fa8c9bcbbd5da2d833911520cd61502cc77d7fa026ca13e67333',
    'src/avatar-v3-review-layout.css': '95c2df959c25f67489feeee21c0fc22bc03b268968d23a30cc128d86aa400063',
}
TEST_FILES = {'tests/issue19-native-select-probe.py', '.github/workflows/issue19-native-select-probe.yml'}
WIDTHS = (320, 390, 430, 768)
CONTROLS = r'''()=>Array.from(document.querySelectorAll('#rd-dialog select'), s=>({
 id:s.id,value:s.value,disabled:s.disabled,
 options:Array.from(s.options,o=>({value:o.value,text:o.text,disabled:o.disabled}))
}))'''
SETTLE = r'''async()=>{
 await document.fonts.ready;
 await Promise.all(Array.from(document.images).filter(i=>i.getClientRects().length&&i.currentSrc).map(i=>i.decode()));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}'''
GEOMETRY = r'''()=>{
 const d=document.getElementById('rd-dialog'),r=d.getBoundingClientRect();
 const s=document.getElementById('rd-topwear'),b=s.getBoundingClientRect(),c=getComputedStyle(s);
 const margin=parseFloat(c.outlineWidth)+parseFloat(c.outlineOffset);
 const clipAncestors=[];
 for(let p=s.parentElement;p;p=p.parentElement){
  const style=getComputedStyle(p),q=p.getBoundingClientRect();
  if(/hidden|clip|auto|scroll/.test(style.overflowX+' '+style.overflowY))
   clipAncestors.push({tag:p.tagName,id:p.id,left:q.left+p.clientLeft,right:q.left+p.clientLeft+p.clientWidth,
    top:q.top+p.clientTop,bottom:q.top+p.clientTop+p.clientHeight,overflowX:style.overflowX,overflowY:style.overflowY});
 }
 let popupOpen=null,popupSelectorSupported=false;
 try{popupSelectorSupported=CSS.supports('selector(select:open)');if(popupSelectorSupported)popupOpen=s.matches(':open');}catch(_){}
 return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
  dialog:{open:d.open,width:d.clientWidth,scrollWidth:d.scrollWidth,left:r.left,right:r.right},
  focused:document.activeElement?.id,focusVisible:s.matches(':focus-visible'),
  select:{left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height,contain:c.contain,
    outline:c.outline,outlineWidth:c.outlineWidth,outlineOffset:c.outlineOffset},
  ring:{left:b.left-margin,right:b.right+margin,top:b.top-margin,bottom:b.bottom+margin},
  clipAncestors,popupSelectorSupported,popupOpen};
}'''


def digest(value):
    return hashlib.sha256(value).hexdigest()


def state_hash(value):
    return digest(json.dumps(value, sort_keys=True, separators=(',', ':')).encode())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', required=True, choices=('chromium', 'webkit'))
    args = parser.parse_args()
    output = ROOT / 'evidence/issue19-native-select-probe' / args.browser
    output.mkdir(parents=True, exist_ok=True)
    checks, rows, page_errors, failed_requests, http_errors, external = [], [], [], [], [], []
    report = {'schema': 'hewrs.issue19.native-select-probe.v1', 'browser': args.browser,
              'app_commit': APP_COMMIT, 'app_pins': PINS, 'checks': checks, 'rows': rows,
              'page_errors': page_errors, 'failed_requests': failed_requests,
              'http_errors': http_errors, 'external_requests': external,
              'owner_data_accessed': False, 'fresh_browser_context': True,
              'started_at': datetime.now(timezone.utc).isoformat(),
              'popup_visual_evidence': 'Capture attempts require independent inspection. Native OS/browser popups may be omitted by page screenshots; closed-select screenshots do not prove an open menu.'}

    def save():
        report.update(passed=sum(c['passed'] for c in checks), failed=sum(not c['passed'] for c in checks))
        (output / 'RESULT.json').write_text(json.dumps(report, indent=2) + '\n')

    def check(name, condition, detail=None):
        checks.append({'name': name, 'passed': bool(condition), 'detail': detail})
        if not condition:
            raise AssertionError(name + ': ' + repr(detail))

    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass

    server = None
    try:
        for path, expected in PINS.items():
            check('Exact application file: ' + path, digest((ROOT / path).read_bytes()) == expected)
        head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        changed = subprocess.check_output(['git', 'diff', '--name-only', APP_COMMIT, head], cwd=ROOT, text=True).splitlines()
        report['probe_commit'], report['test_branch_changes'] = head, changed
        check('Isolated branch changes only the two probe files', set(changed) == TEST_FILES, changed)
        spec = importlib.util.spec_from_file_location('issue19_matrix', ROOT / 'tests/issue19-browser.py')
        matrix = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(matrix)
        server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = f'http://127.0.0.1:{server.server_port}/'
        with sync_playwright() as pw:
            browser = getattr(pw, args.browser).launch(headless=True)
            context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)

            def route(request):
                if urlsplit(request.request.url)[:2] == urlsplit(origin)[:2]:
                    request.continue_()
                else:
                    external.append(request.request.url)
                    request.abort()

            context.route('**/*', route)
            page = context.new_page()
            page.set_default_timeout(120000)
            page.on('pageerror', lambda error: page_errors.append(str(error)))
            page.on('requestfailed', lambda request: failed_requests.append({'url': request.url, 'error': request.failure}))
            page.on('response', lambda response: http_errors.append({'url': response.url, 'status': response.status})
                    if response.status >= 400 and not response.url.endswith('/favicon.ico') else None)
            response = page.goto(origin + 'index.html', wait_until='domcontentloaded')
            check('Exact pinned primary page is served', response.status == 200 and digest(response.body()) == PINS['index.html'])
            for path, expected in PINS.items():
                received = page.request.get(origin + path)
                check('Served pinned bytes: ' + path, received.status == 200 and digest(received.body()) == expected)
            page.wait_for_function('globalThis.HEWRS_READY&&HEWRSApp.rejection')
            page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
            protected = page.evaluate(matrix.FIT.PROTECTED)
            main_selection = page.evaluate('()=>HEWRSApp.state().selection')
            selected = matrix.FIT.selection('DS001', 'NO_TIE', 'B01')

            def render_b01():
                frame = page.evaluate(matrix.FIT_FRAME, {'selected': selected, 'ignoredHashes': []})
                check('Exact B01 reviewed preview is ready', frame['status'] == 'ready' and frame['last'] == selected
                      and frame['state_unchanged'] and frame['photos_decoded'])
                page.wait_for_function('!HEWRSReviewedIntegration.state().busy')
                page.evaluate(SETTLE)
                return frame['full_sha256']

            original_frame = render_b01()
            original_controls = page.evaluate(CONTROLS)
            (output / 'select-options.json').write_text(json.dumps(original_controls, indent=2) + '\n')
            check('All fifteen exact reviewed select controls exist', len(original_controls) == 15)
            check('Topwear native keyboard exercise has enabled adjacent B01/B02 choices',
                  next(x for x in original_controls if x['id'] == 'rd-topwear')['value'] == 'B01'
                  and page.evaluate("()=>{const s=document.getElementById('rd-topwear');return s.options[s.selectedIndex+1].value==='B02'&&!s.options[s.selectedIndex+1].disabled}"))
            page.evaluate("""()=>{
              globalThis.__issue19ControlEvents=[];
              for(const type of ['input','change'])document.getElementById('rd-topwear').addEventListener(type,
               e=>__issue19ControlEvents.push({type:e.type,value:e.target.value,isTrusted:e.isTrusted}));
            }""")

            for width in WIDTHS:
                page.set_viewport_size({'width': width, 'height': 844})
                page.evaluate(SETTLE)
                before_controls = page.evaluate(CONTROLS)
                check(f'{width}: all values and complete option arrays remain exact', before_controls == original_controls)
                page.evaluate('()=>document.getElementById("rd-dialog").scrollTop=0')
                tab_path = []
                for _ in range(60):
                    page.keyboard.press('Tab')
                    active = page.evaluate('()=>document.activeElement?.id||document.activeElement?.tagName')
                    tab_path.append(active)
                    if active == 'rd-topwear':
                        break
                page.evaluate(SETTLE)
                geometry = page.evaluate(GEOMETRY)
                check(f'{width}: actual keyboard Tab reaches visible native select focus',
                      geometry['focused'] == 'rd-topwear' and geometry['focusVisible'], tab_path)
                check(f'{width}: pinned paint containment is applied with original focus style',
                      geometry['select']['contain'] == 'paint' and geometry['select']['outlineWidth'] == '2px'
                      and geometry['select']['outlineOffset'] == '3px', geometry)
                check(f'{width}: dialog and complete focus ring fit',
                      geometry['dialog']['open'] and geometry['documentWidth'] <= width + 1
                      and geometry['dialog']['scrollWidth'] <= geometry['dialog']['width'] + 1
                      and geometry['ring']['left'] >= 0 and geometry['ring']['right'] <= width
                      and geometry['ring']['top'] >= 0 and geometry['ring']['bottom'] <= 844
                      and all(geometry['ring']['left'] >= a['left'] and geometry['ring']['right'] <= a['right']
                              and geometry['ring']['top'] >= a['top'] and geometry['ring']['bottom'] <= a['bottom']
                              for a in geometry['clipAncestors']), geometry)
                page.screenshot(path=str(output / f'{width}-keyboard-focus.png'))
                row = {'width': width, 'before_controls_sha256': state_hash(before_controls),
                       'keyboard_tab_path': tab_path, 'focus_geometry': geometry}
                rows.append(row)
                start_events = page.evaluate('()=>__issue19ControlEvents.length')
                page.keyboard.press('Space')
                row['popup_activation'] = {'method': 'trusted keyboard Space on focused native select',
                                           'state': page.evaluate(GEOMETRY),
                                           'screenshot': f'{width}-native-popup-attempt.png',
                                           'visual_status': 'REQUIRES_INDEPENDENT_SCREENSHOT_INSPECTION'}
                page.screenshot(path=str(output / f'{width}-native-popup-attempt.png'))
                page.keyboard.press('ArrowDown')
                page.keyboard.press('Enter')
                # Escape on an already closed menu would close the modal.
                # Only dismiss an observably still-open native select popup.
                if page.evaluate(GEOMETRY)['popupOpen'] is True:
                    page.keyboard.press('Escape')
                page.wait_for_function("document.getElementById('rd-topwear').value==='B02'&&!HEWRSReviewedIntegration.state().busy")
                changed_controls = page.evaluate(CONTROLS)
                expected_controls = json.loads(json.dumps(original_controls))
                next(x for x in expected_controls if x['id'] == 'rd-topwear')['value'] = 'B02'
                row['change_events'] = page.evaluate('start=>__issue19ControlEvents.slice(start)', start_events)
                row['changed_controls_sha256'] = state_hash(changed_controls)
                row['request_after_change'] = page.evaluate('()=>HEWRSReviewedIntegration.request()')
                check(f'{width}: native keyboard selects B02 with trusted change event',
                      changed_controls == expected_controls and any(e['type'] == 'change' and e['value'] == 'B02'
                      and e['isTrusted'] for e in row['change_events']), row['change_events'])
                check(f'{width}: reviewed change processing settles without error',
                      page.evaluate("()=>!HEWRSReviewedIntegration.state().busy&&!HEWRSReviewedIntegration.state().error&&!document.getElementById('rd-error').textContent"))
                page.keyboard.press('Space')
                page.keyboard.press('ArrowUp')
                page.keyboard.press('Enter')
                if page.evaluate(GEOMETRY)['popupOpen'] is True:
                    page.keyboard.press('Escape')
                page.wait_for_function("document.getElementById('rd-topwear').value==='B01'&&!HEWRSReviewedIntegration.state().busy")
                restored = page.evaluate(CONTROLS)
                row['restored_controls_sha256'] = state_hash(restored)
                row['all_change_events'] = page.evaluate('start=>__issue19ControlEvents.slice(start)', start_events)
                check(f'{width}: native keyboard restores B01 and every original control',
                      restored == original_controls and any(e['type'] == 'change' and e['value'] == 'B01'
                      and e['isTrusted'] for e in row['all_change_events']), row['all_change_events'])
                check(f'{width}: restored reviewed outfit has identical native pixels', render_b01() == original_frame)
                page.locator('#rd-canvas').scroll_into_view_if_needed()
                page.evaluate(SETTLE)
                page.screenshot(path=str(output / f'{width}-restored-preview.png'))
                check(f'{width}: selection exercise preserves isolated protected records and main outfit',
                      page.evaluate(matrix.FIT.PROTECTED) == protected
                      and page.evaluate('()=>HEWRSApp.state().selection') == main_selection)
                save()
                print(json.dumps({'browser': args.browser, 'width': width, 'status': 'PASS_NATIVE_KEYBOARD_AND_RESTORATION'}), flush=True)
            check('No uncaught page or HTTP errors and no external requests', not page_errors and not http_errors and not external,
                  {'page_errors': page_errors, 'http_errors': http_errors, 'external': external})
            check('No unexpected transport failures', not failed_requests, failed_requests)
            report['status'] = 'PASS_PINNED_NATIVE_CONTROLS_VISUAL_REVIEW_REQUIRED'
            context.close()
            browser.close()
    except Exception:
        report['status'] = 'FAIL'
        report['exception'] = traceback.format_exc()
        raise
    finally:
        report['finished_at'] = datetime.now(timezone.utc).isoformat()
        save()
        if server:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    main()
