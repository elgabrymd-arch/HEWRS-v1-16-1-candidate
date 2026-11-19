#!/usr/bin/env python3
"""Exercise the S05 dark-navy-tie rejection through reason checkboxes only.

Every case uses a new synthetic browser context. The suit is selected through
the real picker; the tie remains Engine Choice and comes from the native list.
No feedback is injected, no owner browser is accessed, and no provider is called.
--expect-legacy characterizes the old clothing-only reason behavior. --url reads
the actual hosted app without substituting any local application response.
"""
import argparse
import functools
import hashlib
import json
import threading
import time
import urllib.parse
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CASES = (('tie_suit', 'topwear_tie'), ('tie_shirt', 'shirt_tie'), ('colors', 'clothing'))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', choices=('chromium', 'webkit'), default='chromium')
    parser.add_argument('--url', help='Actual live URL; omit to test the local checkout.')
    parser.add_argument('--expect-legacy', action='store_true', help='Record the old checkbox-only defect.')
    parser.add_argument('--case', choices=tuple(reason for reason, _ in CASES), help='Run one targeted reason.')
    args = parser.parse_args()
    server = None
    if args.url:
        base_url = args.url
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base_url = 'http://127.0.0.1:' + str(server.server_address[1]) + '/'
    parsed_url = urllib.parse.urlsplit(base_url)
    origin = (parsed_url.scheme, parsed_url.netloc)
    evidence = ROOT / 'evidence/tie_reason_scope' / (
        ('live' if args.url else 'local') + ('-legacy' if args.expect_legacy else '-fixed')) / args.browser
    evidence.mkdir(parents=True, exist_ok=True)
    checks, page_errors, external, failed_requests, http_errors, cases = [], [], [], [], [], []
    result = {
        'schema': 'hewrs.tie-reason-scope-browser.v1',
        'started_at': datetime.now(timezone.utc).isoformat(),
        'url': base_url,
        'browser': args.browser,
        'timezone': 'America/New_York',
        'expect_legacy': args.expect_legacy,
        'fresh_isolated_context_per_case': True,
        'owner_data_accessed': False,
        'application_response_source': 'live_https_only' if args.url else 'local_checkout',
        'checks': checks,
        'cases': cases,
        'page_errors': page_errors,
        'external_requests': external,
        'failed_requests': failed_requests,
        'http_errors': http_errors,
    }
    page = None

    def check(name, condition):
        checks.append({'name': name, 'passed': bool(condition)})
        print(('PASS: ' if condition else 'FAIL: ') + name, flush=True)
        assert condition, name

    def ready(current):
        current.wait_for_function('()=>globalThis.HEWRS_READY===true && !!HEWRSApp.rejection', timeout=120000)
        current.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
        current.wait_for_function('()=>HEWRSApp.ownerFeedback.status().ready && !HEWRSApp.feedbackReadError && !document.getElementById("generate-options").disabled')

    def rows(current):
        return current.evaluate('''()=>HEWRSApp.state().report.options.map(o=>({
            selection:o._hewrsConnected.canonical_selection,value:HEWRSOutfitFeedback.stable(o)
        }))''')

    def generate(current, label):
        current.locator('[data-page="home"]').first.click()
        current.click('#generate-options')
        current.wait_for_function('''()=>{const a=HEWRSApp,s=a.state();return !s.busy && s.page==='outfits'
          && Array.isArray(s.report?.options) && s.optionCount>0
          && document.getElementById('avatar').dataset.status==='ready';}''', timeout=360000)
        valid = current.evaluate('''()=>{const a=HEWRSApp,s=a.state();return s.optionCount===20
          && a.connection.controller.verifyOptionSet(s.report.options,s.request)
          && s.report.options.every(o=>o._hewrsConnected.canonical_selection.suitId==='S05'
            && a.ownerFeedback.allowed(o._hewrsConnected.canonical_selection,s.request.context));}''')
        check(label + ': 20 valid S05 options and ready avatar', valid)
        return rows(current)

    def choose_dark_navy(current, label):
        # Metadata identifies an actual generated tie; it never constructs or
        # inserts an outfit. Prefer the first dark-navy row to reproduce the
        # owner's normal navigation (baseline S05/DS029/T029).
        candidates = current.evaluate('''()=>{const a=HEWRSApp;return a.state().report.options.map((o,index)=>{
          const selection=o._hewrsConnected.canonical_selection;
          const tie=a.connection.catalogue.ties.find(t=>t.id===selection.state);
          return {index,selection,tie:tie?{id:tie.id,name:tie.name,primaryColor:tie.primaryColor,
            color:tie.color,colorFamily:tie.colorFamily,displayDesc:tie.displayDesc}:null};
        }).filter(x=>x.tie && /navy/i.test([x.tie.primaryColor,x.tie.color,x.tie.name].join(' '))
          && /dark|midnight|deep|near.black/i.test([x.tie.primaryColor,x.tie.color,x.tie.name].join(' ')));}''')
        check(label + ': native S05 list contains a documented dark-navy tie', bool(candidates))
        target = candidates[0]
        for _ in range(20):
            index = current.evaluate('()=>HEWRSApp.state().optionIndex')
            if index == target['index']:
                break
            current.click('#next-option')
            current.wait_for_function('i=>!HEWRSApp.state().busy && HEWRSApp.state().optionIndex!==i', arg=index)
        selected = current.evaluate('()=>HEWRSApp.state().selection')
        check(label + ': displayed target is the generated dark-navy tie with S05', selected == target['selection'])
        check(label + ': tie preference remains Engine Choice', current.evaluate('()=>HEWRSApp.ui.snapshot().tie.mode==="any"'))
        current.wait_for_function('''()=>{const images=[...document.querySelectorAll('#option-card-items img')];
          return images.length>0 && images.every(i=>i.complete && i.naturalWidth>0);}''')
        current.screenshot(path=str(evidence / (label + '-before.png')), full_page=True)
        return selected, target['tie'], candidates

    def scope_matches(selection, target, scope):
        if scope == 'topwear_tie':
            return (selection.get('suitId') or selection.get('blazerId')) == (target.get('suitId') or target.get('blazerId')) and selection['state'] == target['state']
        if scope == 'shirt_tie':
            return selection['shirtId'] == target['shirtId'] and selection['state'] == target['state']
        return all(selection.get(key) == target.get(key) for key in ('suitId', 'blazerId', 'pantId', 'shirtId', 'state'))

    try:
        with sync_playwright() as playwright:
            browser = getattr(playwright, args.browser).launch(headless=True)
            result['browser_version'] = browser.version
            for reason, fixed_scope in CASES:
                if args.case and args.case != reason:
                    continue
                context = browser.new_context(viewport={'width': 390, 'height': 844}, timezone_id='America/New_York', accept_downloads=False)

                def route(request):
                    address = urllib.parse.urlsplit(request.request.url)
                    if (address.scheme, address.netloc) == origin:
                        request.continue_()
                    else:
                        external.append(request.request.url)
                        request.abort()

                context.route('**/*', route)
                page = context.new_page()
                page.set_default_timeout(90000)
                page.on('pageerror', lambda error: page_errors.append(str(error)))
                page.on('requestfailed', lambda request: failed_requests.append({'url': request.url, 'failure': request.failure}))
                page.on('response', lambda response: http_errors.append({'url': response.url, 'status': response.status})
                        if response.status >= 400 and urllib.parse.urlsplit(response.url).path != '/favicon.ico' else None)
                response = page.goto(base_url, wait_until='domcontentloaded', timeout=120000)
                check(reason + ': application HTML loads successfully', response is not None and response.status == 200)
                case = {'reason': reason, 'intended_scope': fixed_scope, 'html_sha256': hashlib.sha256(response.body()).hexdigest()}
                cases.append(case)
                ready(page)
                check(reason + ': feedback starts empty in a new isolated profile', page.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active.length===0'))
                untouched = page.evaluate('()=>({wear:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.snapshot()})')
                page.click('#pref-topwear')
                page.locator('#picker-list [data-item-id="S05"]').click()
                page.click('#picker-apply')
                check(reason + ': S05 picker sets its exact catalogue anchor', page.evaluate('()=>HEWRSApp.ui.snapshot().topwear.id==="suit-4"'))
                initial = generate(page, reason + ' initial')
                selected, tie, candidates = choose_dark_navy(page, reason)
                case.update({'selected': selected, 'tie': tie, 'navy_candidates': candidates})
                page.click('#reject-outfit')
                page.wait_for_selector('#rejection-scope', state='visible')
                check(reason + ': dialog starts at clothing scope', page.input_value('#rejection-scope') == 'clothing')
                # This is the regression: do not select the scope dropdown.
                page.check('#rejection-issue-' + reason)
                scope = page.input_value('#rejection-scope')
                expected_scope = 'clothing' if args.expect_legacy else fixed_scope
                case['scope_after_reason_only'] = scope
                case['reason_label'] = page.locator('#rejection-issue-' + reason).locator('..').inner_text()
                case['scope_description'] = page.locator('#rejection-scope-description').inner_text()
                check(reason + ': reason-only selection chooses ' + expected_scope, scope == expected_scope)
                check(reason + ': only the requested reason is checked', page.locator('#rejection-issues input:checked').evaluate_all('(nodes)=>nodes.map(n=>n.value)') == [reason])
                page.locator('#outfit-rejection-dialog').screenshot(path=str(evidence / (reason + '-dialog.png')))
                kept = [row for row in initial if not scope_matches(row['selection'], selected, expected_scope)]
                start = time.monotonic()
                page.click('#rejection-permanent')
                page.wait_for_function('''()=>{const a=HEWRSApp,s=a.state(),d=document.getElementById('outfit-rejection-dialog');
                  return a.ownerFeedback.status().ready && a.ownerFeedback.snapshot().active.length===1
                    && !s.busy && !d.open && !document.getElementById('reject-outfit').disabled;}''', timeout=360000)
                replacement = rows(page)
                case['refill_seconds'] = round(time.monotonic() - start, 4)
                case['replacement_selections'] = [row['selection'] for row in replacement]
                event = page.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active[0]')
                case['saved_event'] = event
                check(reason + ': stored rejection has the selected scope and every-occasion coverage', event['scope'] == expected_scope and event['occasion'] == 'all')
                check(reason + ': refill retains 20 validated alternatives', len(replacement) == 20 and page.evaluate('()=>{const a=HEWRSApp,s=a.state();return a.connection.controller.verifyOptionSet(s.report.options,s.request);}'))
                check(reason + ': unaffected options retain exact records and order', replacement[:len(kept)] == kept)
                check(reason + ': all combinations covered by the saved scope are absent', not any(scope_matches(row['selection'], selected, expected_scope) for row in replacement))
                check(reason + ': other ties remain available', any(row['selection']['state'] not in (selected['state'], 'NO_TIE') for row in replacement))
                displayed = page.evaluate('()=>HEWRSApp.state().selection')
                case['displayed_immediate_replacement'] = displayed
                if not args.expect_legacy and fixed_scope in ('topwear_tie', 'shirt_tie'):
                    non_tie_fields = ('suitId', 'blazerId', 'pantId', 'shirtOnly', 'shirtId', 'shoeId', 'watchId')
                    check(reason + ': immediate replacement keeps every non-tie item exact',
                          all(displayed.get(key) == selected.get(key) for key in non_tie_fields))
                    check(reason + ': immediate replacement changes to a different genuine tie',
                          displayed['state'] != selected['state'] and displayed['state'].startswith('T')
                          and page.evaluate('id=>HEWRSApp.connection.catalogue.ties.some(t=>t.id===id)', displayed['state']))
                probes = page.evaluate('''([selection,id])=>{
                  const a=HEWRSApp,context=a.state().request.context;
                  const blocked=(s,occasion=context.occasion)=>a.ownerFeedback.match(s,{...context,occasion}).reasons.some(r=>r.id===id);
                  const otherShirt=selection.shirtId==='DS001'?'DS002':'DS001';
                  const otherTie=selection.state==='T017'?'T019':'T017';
                  const otherSuit=selection.suitId==='S04'?'S05':'S04';
                  return {same:blocked(selection),differentShoes:blocked({...selection,shoeId:selection.shoeId==='shoe-11'?'shoe-12':'shoe-11'}),
                    differentWatch:blocked({...selection,watchId:null}),sameTieOtherShirt:blocked({...selection,shirtId:otherShirt}),
                    samePairOtherSuit:blocked({...selection,suitId:otherSuit}),otherTieSameClothes:blocked({...selection,state:otherTie}),
                    noTieSameClothes:blocked({...selection,state:'NO_TIE'}),otherOccasion:blocked(selection,'dinner')};
                }''', [selected, event['id']])
                case['scope_probes'] = probes
                if reason == 'colors':
                    case['same_tie_with_other_clothes_remains_permitted'] = not probes['sameTieOtherShirt']
                expected_probes = {
                    'same': True, 'differentShoes': True, 'differentWatch': True,
                    'sameTieOtherShirt': expected_scope == 'topwear_tie',
                    'samePairOtherSuit': expected_scope == 'shirt_tie',
                    'otherTieSameClothes': False, 'noTieSameClothes': False, 'otherOccasion': True,
                }
                check(reason + ': saved rule blocks precisely its pairing without globally banning the tie', probes == expected_probes)
                if args.expect_legacy:
                    case['same_tie_still_displayed'] = any(row['selection']['state'] == selected['state'] for row in replacement)
                    if reason == 'tie_suit':
                        check('Legacy defect: dark-navy tie remains eligible with S05 after changing only the shirt', probes['sameTieOtherShirt'] is False)
                        # The browser records suggestion exposure after initial
                        # generation, so its next chosen tie can differ from a
                        # fresh engine replay. Characterize that observation;
                        # the invariant defect is that S05 + this tie remains
                        # allowed after a reason explicitly rejecting that pair.
                        print('LEGACY IMMEDIATE TIE RETURN:', case['same_tie_still_displayed'], flush=True)
                    if reason == 'tie_shirt':
                        check('Legacy defect: rejected shirt–tie pair remains eligible with another suit', probes['samePairOtherSuit'] is False)
                else:
                    page.reload(wait_until='domcontentloaded')
                    ready(page)
                    check(reason + ': saved event and exact scope survive reload', page.evaluate('id=>HEWRSApp.ownerFeedback.snapshot().active.some(e=>e.id===id)', event['id']))
                    regenerated = generate(page, reason + ' after reload')
                    case['regenerated_selections'] = [row['selection'] for row in regenerated]
                    check(reason + ': fresh generation continues to exclude the rejected scope', not any(scope_matches(row['selection'], selected, fixed_scope) for row in regenerated))
                    if fixed_scope == 'topwear_tie':
                        check('S05 never reuses the rejected dark-navy tie after reload and generation', all(row['selection']['state'] != selected['state'] for row in regenerated))
                page.screenshot(path=str(evidence / (reason + '-after.png')), full_page=True)
                check(reason + ': wear history and Favorites remain unchanged', page.evaluate('()=>({wear:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.snapshot()})') == untouched)
                context.close()
                page = None
            check('No provider or other external request was made', not external)
            check('No application request failed or returned an HTTP error', not failed_requests and not http_errors)
            check('No uncaught browser error occurred', not page_errors)
            result['status'] = 'passed'
            browser.close()
    except Exception as error:
        result['status'] = 'failed'
        result['error'] = str(error)
        if page is not None:
            try:
                page.screenshot(path=str(evidence / 'failure.png'), full_page=True)
            except Exception:
                pass
        raise
    finally:
        result['finished_at'] = datetime.now(timezone.utc).isoformat()
        result['passed'] = sum(check['passed'] for check in checks)
        result['failed'] = sum(not check['passed'] for check in checks)
        (evidence / 'RESULT.json').write_text(json.dumps(result, indent=2) + '\n')
        if server is not None:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    main()
