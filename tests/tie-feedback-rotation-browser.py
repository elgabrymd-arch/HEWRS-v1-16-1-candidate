#!/usr/bin/env python3
"""Real candidate HTTP/Chromium checks with empty synthetic browser storage.

Exercises packaged scripts, native generation, native avatar, feedback controls,
refill, persistence and exposure commits. No owner browser, production write or
provider access; all requests outside the local test server are blocked.
"""
import functools
import json
import threading
from collections import Counter
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'evidence/tie_feedback_rotation'


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = 'http://127.0.0.1:' + str(server.server_address[1])
    checks, errors, external = [], [], []
    pages = []

    def check(name, condition):
        checks.append({'name': name, 'passed': bool(condition)})
        print(('PASS: ' if condition else 'FAIL: ') + name, flush=True)
        assert condition, name

    def ready(page):
        page.wait_for_function('()=>globalThis.HEWRS_READY===true && !!HEWRSApp.tieExposure && !!HEWRSApp.rejection', timeout=60000)

    def exposure(page):
        return page.evaluate('()=>HEWRSApp.tieExposure.snapshot()')

    def rows(page):
        return page.evaluate('''()=>HEWRSApp.state().report.options.map(o=>({
            selection:o._hewrsConnected.canonical_selection,
            value:HEWRSOutfitFeedback.stable(o)
        }))''')

    def count_rows(items):
        return Counter(r['selection']['state'] for r in items if r['selection']['state'] != 'NO_TIE')

    def check_delta(name, before, after, inserted, occasion='work'):
        expected = Counter(before['counts'][occasion]) + count_rows(inserted)
        check(name, after['ok'] and after['counts'][occasion] == dict(expected))

    def generate(page):
        page.evaluate("()=>HEWRSApp.showPage('home')")
        page.click('#generate-options')
        page.wait_for_function("()=>{const s=HEWRSApp.state();return !s.busy && s.page==='outfits' && Array.isArray(s.report?.options);}", timeout=360000)
        data = page.evaluate('''()=>{const s=HEWRSApp.state();return {
            count:s.optionCount,valid:HEWRSApp.connection.controller.verifyOptionSet(s.report.options,s.request),
            avatar:document.getElementById('avatar').dataset.status,reason:s.report.reason,
            exposure:s.report.diagnostics?.tie_exposure
        }}''')
        check('Generated list has 20 validated outfits and a ready native avatar', data['count'] == 20 and data['valid'] and data['avatar'] == 'ready')
        print('GENERATION:', json.dumps(data), flush=True)
        return rows(page)

    def move_to_tie(page):
        for _ in range(20):
            selected = page.evaluate('()=>HEWRSApp.state().selection')
            if selected and selected['state'] not in ('NO_TIE', 'REFERENCE'):
                return selected
            previous = page.evaluate('()=>HEWRSApp.state().optionIndex')
            page.click('#next-option')
            page.wait_for_function('(i)=>!HEWRSApp.state().busy && HEWRSApp.state().optionIndex!==i', arg=previous)
        raise AssertionError('Default Work list contained no tie.')

    def reject(page, scope, occasion='all'):
        page.click('#reject-outfit')
        page.select_option('#rejection-scope', scope)
        page.check('#rejection-issue-footwear')
        check('A diagnostic checkbox preserves the explicitly selected rejection scope', page.input_value('#rejection-scope') == scope)
        page.select_option('#rejection-occasion', occasion)
        page.check('#rejection-issue-patterns')
        check('An explanatory reason cannot override the explicitly chosen rejection scope', page.input_value('#rejection-scope') == scope)
        page.locator('#outfit-rejection-dialog').screenshot(path=str(EVIDENCE / (scope + '-rejection-dialog.png')))
        page.click('#rejection-permanent')
        page.wait_for_function("()=>!HEWRSApp.state().busy && !document.getElementById('outfit-rejection-dialog').open && !document.getElementById('reject-outfit').disabled", timeout=360000)
        check('Rejection refill retains 20 verified choices', page.evaluate('()=>{const s=HEWRSApp.state();return s.optionCount===20 && HEWRSApp.connection.controller.verifyOptionSet(s.report.options,s.request);}'))
        return rows(page)

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)

            def route(request):
                if request.request.url.startswith(origin + '/'):
                    request.continue_()
                else:
                    external.append(request.request.url)
                    request.abort()

            context.route('**/*', route)
            page = context.new_page()
            pages.append(page)
            page.set_default_timeout(60000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(origin + '/', wait_until='domcontentloaded')
            ready(page)
            empty = exposure(page)
            check('New exposure history starts empty without inferred past use', empty['ok'] and empty['eventCount'] == 0 and empty['startedAt'] is None)
            wear = page.evaluate('()=>HEWRSApp.store.snapshot().events')
            favorites = page.evaluate('()=>HEWRSApp.favorites.snapshot()')

            initial = generate(page)
            first = exposure(page)
            check_delta('First displayed list counts each tied option once', empty, first, initial)
            check('One successful generation creates one immutable exposure event', first['eventCount'] == 1)

            previous = page.evaluate('()=>HEWRSApp.state().optionIndex')
            page.click('#next-option')
            page.wait_for_function('(i)=>!HEWRSApp.state().busy && HEWRSApp.state().optionIndex!==i', arg=previous)
            check('Navigating an existing list adds no exposure', exposure(page) == first)
            selected = move_to_tie(page)

            # Real second tab, same origin; save:false leaves the first tab's
            # session/history token unchanged while rendering the same garment.
            second = context.new_page()
            pages.append(second)
            second.on('pageerror', lambda error: errors.append(str(error)))
            second.goto(origin + '/', wait_until='domcontentloaded')
            ready(second)
            second.evaluate("s=>HEWRSApp.apply(s,{origin:'manual',save:false})", selected)
            second.evaluate("()=>HEWRSApp.showPage('outfits')")

            kept = [r for r in initial if r['selection']['state'] != selected['state']]
            replacement = reject(page, 'tie')
            check('Tie rejection removes that tie across all clothing combinations', all(r['selection']['state'] != selected['state'] for r in replacement))
            check('Tie refill retains every accepted option byte-for-byte and in order', replacement[:len(kept)] == kept)
            check_delta('Refill counts only new choices, without recounting retained options', first, exposure(page), replacement[len(kept):])
            second.wait_for_function("()=>document.getElementById('outfit-output').hasAttribute('data-rejection-hidden')", timeout=60000)
            check('A real storage event hides the rejected tie in the second tab', second.evaluate('()=>!HEWRSApp.ownerFeedback.allowed(HEWRSApp.state().selection,HEWRSApp.state().context)'))
            second.close()

            before_reload = exposure(page)
            page.reload(wait_until='domcontentloaded')
            ready(page)
            check('Reload preserves exposure history without adding a view', exposure(page) == before_reload)
            check('Saved tie ban survives reload', page.evaluate("s=>!HEWRSApp.ownerFeedback.allowed(s,{occasion:'work',requiredFormality:'any'})", selected))
            regenerated = generate(page)
            check('A fresh native generation also excludes the rejected tie', all(r['selection']['state'] != selected['state'] for r in regenerated))
            check_delta('A new displayed generation records its own list once', before_reload, exposure(page), regenerated)

            pair = move_to_tie(page)
            before_pair = exposure(page)
            kept_pair = [r for r in regenerated if not (r['selection']['state'] == pair['state'] and r['selection']['shirtId'] == pair['shirtId'])]
            pair_replacement = reject(page, 'shirt_tie', 'current')
            check('Shirt–tie rejection removes the exact pair from the Work list', all(not (r['selection']['state'] == pair['state'] and r['selection']['shirtId'] == pair['shirtId']) for r in pair_replacement))
            check('Pair refill leaves the other outfits byte-for-byte unchanged', pair_replacement[:len(kept_pair)] == kept_pair)
            check_delta('Pair refill counts only its new tied options', before_pair, exposure(page), pair_replacement[len(kept_pair):])
            semantics = page.evaluate('''s=>{
                const fb=HEWRSApp.ownerFeedback, event=fb.snapshot().active.find(e=>e.scope==='shirt_tie');
                const banned=(selection,occasion)=>fb.match(selection,{occasion,requiredFormality:'any'}).reasons.some(r=>r.id===event.id);
                const otherShirt=s.shirtId==='DS001'?'DS002':'DS001';
                return {scope:event.scope,occasion:event.occasion,
                    same:banned(s,'work'),otherOccasion:banned(s,'dinner'),
                    otherShirt:banned({...s,shirtId:otherShirt},'work')};
            }''', pair)
            check('Explicit pair scope does not become a global tie or all-occasion ban', semantics == {'scope': 'shirt_tie', 'occasion': 'work', 'same': True, 'otherOccasion': False, 'otherShirt': False})

            page.click('#manage-outfit-rejections')
            check('Manager labels the tie and shirt–tie scopes', page.locator('#rejection-records [data-scope="tie"]').count() == 1 and page.locator('#rejection-records [data-scope="shirt_tie"]').count() == 1)
            page.click('#export-rejections')
            with page.expect_download() as download_info:
                page.get_by_role('link', name='Save rejection backup', exact=True).click()
            backup_path = EVIDENCE / 'synthetic-feedback-backup.json'
            download_info.value.save_as(str(backup_path))
            backup = json.loads(backup_path.read_text())
            check('UI backup preserves separate old and new feedback schemas', backup['schema'] == 'hewrs.outfit-and-tie-feedback.export.v1' and backup['outfit_feedback']['schema'] == 'hewrs.outfit-feedback.export.v1' and backup['tie_feedback']['schema'] == 'hewrs.tie-feedback.export.v1')
            page.click('#rejections-close')
            page.click('#undo-outfit-rejection')
            check('Undo restores the pair while retaining the separate tie ban', page.evaluate('''([pair,tie])=>{
                const fb=HEWRSApp.ownerFeedback,s=fb.snapshot();
                return !s.active.some(e=>e.scope==='shirt_tie') &&
                    !fb.allowed(tie,{occasion:'work',requiredFormality:'any'}) &&
                    !fb.match(pair,{occasion:'work',requiredFormality:'any'}).reasons.some(r=>r.scope==='shirt_tie');
            }''', [pair, selected]))

            before_no_tie = exposure(page)
            page.evaluate("()=>HEWRSApp.showPage('home')")
            page.click('#pref-tie')
            page.locator('[data-item-id="NO_TIE"]').click()
            page.click('#picker-apply')
            no_tie_rows = generate(page)
            check('Exact No Tie preference remains respected', all(r['selection']['state'] == 'NO_TIE' for r in no_tie_rows))
            check('A No Tie list adds no tie-exposure event', exposure(page) == before_no_tie)
            page.click('#reject-outfit')
            scopes = page.locator('#rejection-scope option').evaluate_all('(nodes)=>nodes.map(n=>n.value)')
            check('No Tie outfits cannot be rejected as a tie or shirt–tie pair', 'tie' not in scopes and 'shirt_tie' not in scopes)
            page.click('#rejection-cancel')
            page.screenshot(path=str(EVIDENCE / 'candidate-mobile-390x844.png'), full_page=True)

            check('Generation, navigation and feedback never create wear events', page.evaluate('()=>HEWRSApp.store.snapshot().events') == wear)
            check('Favorites remain unchanged', page.evaluate('()=>HEWRSApp.favorites.snapshot()') == favorites)

            # A separate empty profile exercises abort/error paths without
            # disturbing the successful-list lifecycle assertions above.
            faults = {'block_assets': False, 'blocked': []}
            fault_context = browser.new_context(viewport={'width': 390, 'height': 844})

            def fault_route(request):
                url = request.request.url
                if not url.startswith(origin + '/'):
                    external.append(url)
                    request.abort()
                elif faults['block_assets'] and any(url.startswith(origin + '/' + folder + '/') for folder in ('assets', 'assemblies')):
                    faults['blocked'].append(url)
                    request.abort()
                else:
                    request.continue_()

            fault_context.route('**/*', fault_route)
            fault_page = fault_context.new_page()
            pages.append(fault_page)
            fault_page.set_default_timeout(360000)
            fault_page.on('pageerror', lambda error: errors.append(str(error)))
            fault_page.goto(origin + '/', wait_until='domcontentloaded')
            ready(fault_page)
            before_cancel = exposure(fault_page)
            cancelled = fault_page.evaluate('''async()=>{
                const a=HEWRSApp,s=a.state(),op=a.ui.operation(s.mode,{...s.context,environment:a.weather.request(s.context.localDate)});
                if(op.kind!=='engine')throw Error('Cancellation test requires an automatic request.');
                const pending=a.generate(op.config,{prefs:op.prefs});
                a.cancel();
                return await pending;
            }''')
            check('Cancellation before list display reports cancellation and adds no exposure', cancelled.get('cancelled') is True and exposure(fault_page) == before_cancel)

            faults['block_assets'] = True
            failed = fault_page.evaluate('''async()=>{
                const a=HEWRSApp,s=a.state(),op=a.ui.operation(s.mode,{...s.context,environment:a.weather.request(s.context.localDate)});
                try{await a.generate(op.config,{prefs:op.prefs});return {error:null,status:a.state().report?.status};}
                catch(error){return {error:error.message,status:a.state().report?.status};}
            }''')
            check('A real avatar resource failure rejects generation without recording suggestions', bool(faults['blocked']) and bool(failed['error']) and failed['status'] == 'error' and exposure(fault_page) == before_cancel)

            faults['block_assets'] = False
            corrupt_key = 'hewrs:tie-exposure:v1:event:corrupt_browser_fixture'
            fault_page.evaluate("key=>localStorage.setItem(key,'{broken-json')", corrupt_key)
            fault_page.reload(wait_until='domcontentloaded')
            ready(fault_page)
            generate(fault_page)
            corrupt = fault_page.evaluate('''key=>({
                value:localStorage.getItem(key),
                keys:Object.keys(localStorage).filter(k=>k.startsWith(HEWRSTieExposure.prefix)),
                exposure:HEWRSApp.tieExposure.snapshot(),
                saved:HEWRSApp.state().report.diagnostics.tie_exposure.last_commit.saved,
                notice:document.getElementById('tie-exposure-notice').textContent,
                wear:HEWRSApp.store.snapshot().events
            })''', corrupt_key)
            check('Corrupt exposure preserves a valid generated list and reports tracking unavailable', corrupt['exposure']['ok'] is False and corrupt['saved'] is False and 'could not be saved' in corrupt['notice'])
            check('Corrupt exposure is retained without new records or fabricated wear', corrupt['value'] == '{broken-json' and corrupt['keys'] == [corrupt_key] and corrupt['wear'] == [])
            fault_context.close()

            check('No external or paid-provider requests', not external)
            check('No uncaught page errors', not errors)
            context.close()
            browser.close()
    except Exception:
        for i, page in enumerate(pages):
            try:
                if not page.is_closed():
                    page.screenshot(path=str(EVIDENCE / ('failure-' + str(i) + '.png')), full_page=True)
            except Exception:
                pass
        raise
    finally:
        server.shutdown()
        server.server_close()
        report = {'scope': __doc__, 'checks': checks, 'passed': sum(c['passed'] for c in checks),
                  'failed': sum(not c['passed'] for c in checks), 'errors': errors,
                  'external_requests': external, 'owner_data_accessed': False,
                  'deployment_performed': False}
        (EVIDENCE / 'RESULT.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()
