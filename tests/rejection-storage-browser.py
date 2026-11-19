#!/usr/bin/env python3
"""Actual integrated candidate, native IndexedDB and 30,000 active exclusions.

Fresh synthetic profiles. Runs in Chromium and WebKit; this is not an owner
iPhone or its history. No external/provider access or deployment.
"""
import argparse
import functools
import hashlib
import json
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
F_PREFIX = 'hewrs:outfit-feedback:v1:event:'
T_PREFIX = 'hewrs:tie-feedback:v1:event:'
F_SCHEMA = 'hewrs.outfit-feedback.event.v1'
T_SCHEMA = 'hewrs.tie-feedback.event.v1'
F_EXPORT = 'hewrs.outfit-feedback.export.v1'
STAMP = '2026-11-18T12:00:00.000Z'
FIRST = {'suitId': 'S18', 'shirtId': 'DS001', 'state': 'T019', 'shoeId': 'shoe-3', 'watchId': 'watch-AP09'}
SECOND = {**FIRST, 'state': 'T020'}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', choices=['chromium', 'webkit'], default='chromium')
    args = parser.parse_args()
    evidence = ROOT / 'evidence/rejection_storage' / args.browser
    evidence.mkdir(parents=True, exist_ok=True)
    fixture = json.loads((ROOT / 'evidence/tie_coverage_rejection_scale/rejection-scale-browser-fixture.json').read_text())
    events = fixture['events'][:30000]
    extra, aborted = fixture['events'][30000:30002]
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = 'http://127.0.0.1:' + str(server.server_address[1])
    checks, observations, external, errors = [], {}, [], []
    result = {'schema': 'hewrs.rejection-storage-browser.v1', 'browser': args.browser,
              'synthetic_profiles_only': True, 'owner_data_accessed': False,
              'checks': checks, 'observations': observations, 'external_requests': external,
              'page_errors': errors, 'deployment_performed': False}

    def check(name, value):
        checks.append({'name': name, 'passed': bool(value)})
        print(('PASS: ' if value else 'FAIL: ') + name, flush=True)
        assert value, name

    def context(browser, init=None):
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
        if init:
            ctx.add_init_script(init)

        def route(r):
            if r.request.url.startswith(origin + '/'):
                r.continue_()
            else:
                external.append(r.request.url)
                r.abort()

        ctx.route('**/*', route)
        ctx.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
        page = ctx.new_page()
        page.set_default_timeout(90000)
        return ctx, page

    def shell(page):
        page.wait_for_function('()=>globalThis.HEWRS_READY===true && !!HEWRSApp.rejection', timeout=90000)

    def ready(page):
        shell(page)
        page.evaluate('async()=>{await HEWRSApp.rejection.ready; await HEWRSApp.ownerFeedback.sync();}')
        page.wait_for_function('()=>HEWRSApp.ownerFeedback.status().ready && !HEWRSApp.feedbackReadError && !document.getElementById("generate-options").disabled')

    def legacy(page):
        return page.evaluate('''()=>Object.keys(localStorage).filter(k=>
            k.startsWith('hewrs:outfit-feedback:v1:event:')||k.startsWith('hewrs:tie-feedback:v1:event:'))
            .sort().map(k=>[k,localStorage.getItem(k)])''')

    def rows(page):
        return page.evaluate('''()=>HEWRSApp.state().report.options.map(o=>({
            selection:o._hewrsConnected.canonical_selection,value:HEWRSOutfitFeedback.stable(o)}))''')

    def generate(page):
        page.evaluate("()=>HEWRSApp.showPage('home')")
        page.click('#generate-options')
        page.wait_for_function('''()=>{const a=HEWRSApp,s=a.state();return !s.busy && s.page==='outfits'
            && s.optionCount>0 && Array.isArray(s.report?.options) && document.getElementById('avatar').dataset.status==='ready';}''', timeout=360000)
        return rows(page)

    def open_manager(page):
        page.evaluate("()=>HEWRSApp.showPage('home')")
        page.click('#home-outfit-rejections')
        page.wait_for_selector('#rejection-records')

    try:
        with tempfile.TemporaryDirectory(prefix='hewrs-rejection-test-') as scratch, sync_playwright() as p:
            scratch = Path(scratch)
            browser = getattr(p, args.browser).launch(headless=True)
            result['browser_version'] = browser.version

            # Both old namespaces, an explicit Undo, and notes are migrated by
            # the actual startup path without modifying a byte of old storage.
            old_hide = {'schema': F_SCHEMA, 'id': 'legacy_original', 'at': STAMP, 'type': 'hide',
                        'actor': 'owner', 'selection': FIRST, 'scope': 'outfit', 'occasion': 'work',
                        'reason': 'colors', 'note': 'Preserve this exact original note.'}
            duplicate = {**old_hide, 'id': 'legacy_duplicate'}
            restore = {'schema': F_SCHEMA, 'id': 'legacy_restore', 'at': STAMP, 'type': 'restore', 'target': duplicate['id']}
            old_tie = {'schema': T_SCHEMA, 'id': 'tie_legacy_original', 'at': STAMP, 'type': 'hide',
                       'actor': 'owner', 'selection': SECOND, 'scope': 'shirt_tie', 'occasion': 'all', 'reason': None, 'note': 'Pair only.'}
            old = [[F_PREFIX + e['id'], json.dumps(e, separators=(',', ':'))] for e in [old_hide, duplicate, restore]]
            old.append([T_PREFIX + old_tie['id'], json.dumps(old_tie, separators=(',', ':'))])
            migration_ctx, migration = context(browser)
            migration.goto(origin + '/tests/', wait_until='domcontentloaded')
            migration.evaluate('rows=>rows.forEach(([k,v])=>localStorage.setItem(k,v))', old)
            migration.goto(origin + '/', wait_until='domcontentloaded')
            ready(migration)
            migrated = migration.evaluate('''({first,second})=>{const f=HEWRSApp.ownerFeedback,s=f.snapshot();return {
                status:f.status(),events:s.events,active:s.active.map(e=>e.id),
                firstWork:f.allowed(first,'work'),firstDinner:f.allowed(first,'dinner'),pair:f.allowed(second,'dinner')};}''', {'first': FIRST, 'second': SECOND})
            observations['migration'] = migrated
            check('Both legacy namespaces migrate with exact IDs, notes, scope, occasion and Undo preserved',
                  len(migrated['events']) == 4 and set(migrated['active']) == {old_hide['id'], old_tie['id']}
                  and not migrated['firstWork'] and migrated['firstDinner'] and not migrated['pair']
                  and sorted(legacy(migration)) == sorted(old)
                  and next(e for e in migrated['events'] if e['id'] == old_hide['id']) == old_hide)
            migration.reload(wait_until='domcontentloaded')
            ready(migration)
            check('Reload verifies the migration without duplicating events or changing old bytes',
                  migration.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().events.length') == 4 and sorted(legacy(migration)) == sorted(old))
            migration.evaluate('async id=>{await HEWRSApp.ownerFeedback.restore(id);}', old_hide['id'])
            check('Undo targets one original hide and does not reactivate a separately restored duplicate',
                  migration.evaluate('s=>HEWRSApp.ownerFeedback.allowed(s,"work")', FIRST)
                  and sorted(legacy(migration)) == sorted(old))
            migration_ctx.close()

            # Failed migration must remain blocked, including the first record.
            corrupt_ctx, corrupt = context(browser)
            corrupt.goto(origin + '/tests/', wait_until='domcontentloaded')
            corrupt.evaluate('rows=>rows.forEach(([k,v])=>localStorage.setItem(k,v))', [old[0], [F_PREFIX + 'broken', '{broken']])
            corrupt.goto(origin + '/', wait_until='domcontentloaded')
            shell(corrupt)
            corrupt.evaluate('async()=>await HEWRSApp.rejection.ready')
            corrupt.wait_for_function('()=>!!HEWRSApp.feedbackReadError')
            before_retry = legacy(corrupt)
            check('Malformed legacy data blocks migration and generation without clearing either record',
                  corrupt.is_disabled('#generate-options') and before_retry == sorted([old[0], [F_PREFIX + 'broken', '{broken']]))
            fixed = {**old_hide, 'id': 'broken', 'selection': {**FIRST, 'state': 'T021'}}
            corrupt.evaluate('''([k,v])=>document.getElementById('retry-rejection-check').addEventListener(
                'click',()=>localStorage.setItem(k,v),{capture:true,once:true})''', [F_PREFIX + 'broken', json.dumps(fixed)])
            corrupt.click('#retry-rejection-check')
            ready(corrupt)
            check('Retry completes the same migration only after valid bytes are restored',
                  corrupt.evaluate('s=>HEWRSApp.ownerFeedback.snapshot().active.length===2 && !HEWRSApp.ownerFeedback.allowed(s,"work")', FIRST))
            corrupt_ctx.close()

            # Native IndexedDB holds 30,000 distinct active bans, imported via
            # the actual manager, not direct writes into its object stores.
            scale_ctx, page = context(browser)
            page.goto(origin + '/', wait_until='domcontentloaded')
            ready(page)
            untouched = page.evaluate('()=>({wear:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.snapshot()})')
            import_path = scratch / '30000-rejections.json'
            import_path.write_text(json.dumps({'schema': F_EXPORT, 'events': events}))
            open_manager(page)
            page.set_input_files('#rejection-import-file', str(import_path))
            started = time.perf_counter()
            page.click('#import-rejections')
            page.wait_for_function('()=>HEWRSApp.ownerFeedback.status().ready && HEWRSApp.ownerFeedback.snapshot().active.length===30000', timeout=360000)
            page.wait_for_function('()=>document.getElementById("rejection-records").dataset.total==="30000"')
            observations['import_30000_seconds'] = round(time.perf_counter() - started, 4)
            check('The actual UI imports a backup above 5 MiB with 30,000 distinct active exclusions',
                  import_path.stat().st_size > 5 * 1024 * 1024 and page.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().events.length') == 30000)
            check('Manager renders 50 records per page instead of 30,000 DOM records',
                  page.locator('#rejection-records article').count() == 50
                  and '600' in page.locator('#rejection-page-status').inner_text())
            first_id = page.locator('#rejection-records article').first.get_attribute('data-event-id')
            page.click('#rejection-next-page')
            check('Manager pagination reaches distinct records without changing exclusions',
                  page.locator('#rejection-records article').count() == 50
                  and page.locator('#rejection-records article').first.get_attribute('data-event-id') != first_id
                  and page.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active.length') == 30000)
            page.locator('#outfit-rejection-dialog').screenshot(path=str(evidence / 'manager-30000-390x844.png'))

            # Preserve/export the full supported dataset; the UI must be able to
            # import its own full export without the former 20k/5MiB mismatch.
            page.click('#export-rejections')
            page.wait_for_selector('#save-rejection-backup')
            with page.expect_download() as downloaded:
                page.click('#save-rejection-backup')
            backup_path = scratch / 'roundtrip-backup.json'
            downloaded.value.save_as(str(backup_path))
            backup = json.loads(backup_path.read_text())
            observations['backup'] = {'bytes': backup_path.stat().st_size,
                                      'sha256': hashlib.sha256(backup_path.read_bytes()).hexdigest()}
            check('Full UI export contains every original event and exceeds the previous import limit',
                  len(backup['outfit_feedback']['events']) == 30000
                  and backup['outfit_feedback']['events'] == events
                  and backup_path.stat().st_size > 5 * 1024 * 1024)
            page.set_input_files('#rejection-import-file', str(backup_path))
            page.click('#import-rejections')
            page.wait_for_function('()=>!document.getElementById("import-rejections").disabled')
            check('Reimporting the complete 30,000-record export is idempotent',
                  page.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().events.length') == 30000)
            page.click('#rejections-close')
            performance = page.evaluate('''selections=>{
                const f=HEWRSApp.ownerFeedback,before=f.diagnostics?.()||null,start=performance.now();
                let rejected=0;for(let i=0;i<20000;i++)if(!f.allowed(selections[i%selections.length],{occasion:'work'}))rejected++;
                return {checks:20000,rejected,milliseconds:performance.now()-start,before,after:f.diagnostics?.()||null,
                    tokenLength:f.token().length};
            }''', [events[0]['selection'], events[14999]['selection'], events[-1]['selection']])
            observations['cached_matching'] = performance
            check('20,000 exclusion matches retain oldest/middle/newest bans with a compact revision token',
                  performance['rejected'] == 20000 and performance['tokenLength'] < 512)
            check('Cached matches perform no additional database or legacy storage reads',
                  performance['before'] is not None and all(performance['before'][k] == performance['after'][k]
                      for k in ['metaReads', 'eventRowsRead', 'legacyScans', 'legacyKeyReads']))
            page.reload(wait_until='domcontentloaded')
            ready(page)
            check('All 30,000 active bans survive an actual browser reload',
                  page.evaluate('selections=>{const f=HEWRSApp.ownerFeedback;return f.snapshot().active.length===30000 && selections.every(s=>!f.allowed(s,"work"));}', [events[0]['selection'], events[-1]['selection']]))

            # Fail after a real IndexedDB event request has been queued. A
            # transaction abort must not publish success or mutate the cache.
            failed = page.evaluate('''async event=>{
                const f=HEWRSApp.ownerFeedback,before=f.snapshot().events.length;
                const add=IDBObjectStore.prototype.add,put=IDBObjectStore.prototype.put;
                let fired=false,error=null;
                const wrap=original=>function(...args){const request=Reflect.apply(original,this,args);
                    if(this.name==='events'&&!fired){fired=true;this.transaction.abort();}return request;};
                IDBObjectStore.prototype.add=wrap(add);IDBObjectStore.prototype.put=wrap(put);
                try{await f.importData({schema:'hewrs.outfit-feedback.export.v1',events:[event]});}
                catch(e){error=e.message;}
                finally{IDBObjectStore.prototype.add=add;IDBObjectStore.prototype.put=put;}
                await f.sync({forceLegacy:true});
                return {fired,error,before,after:f.snapshot().events.length,has:f.snapshot().events.some(e=>e.id===event.id)};
            }''', aborted)
            observations['aborted_transaction'] = failed
            check('An aborted native transaction reports failure and retains exactly the prior committed history',
                  failed['fired'] and bool(failed['error']) and failed['before'] == failed['after'] == 30000 and not failed['has'])
            await_recovery = page.evaluate('async()=>HEWRSApp.rejection.retry()')
            check('A failed save can recover without replacing the original database', bool(await_recovery))
            appended = page.evaluate('''async event=>{const f=HEWRSApp.ownerFeedback;
                await f.importData({schema:'hewrs.outfit-feedback.export.v1',events:[event]});
                return {events:f.snapshot().events.length,active:f.snapshot().active.length,blocked:!f.allowed(event.selection,'work')};}''', extra)
            check('A further rejection succeeds after 30,000 without evicting an old record',
                  appended == {'events': 30001, 'active': 30001, 'blocked': True})
            page.evaluate('async id=>{await HEWRSApp.ownerFeedback.restore(id);}', extra['id'])
            check('Undo appends history beyond 30,000 while preserving original event identity',
                  page.evaluate('id=>{const s=HEWRSApp.ownerFeedback.snapshot();return s.events.length===30002 && s.active.length===30000 && s.events.some(e=>e.id===id);}', extra['id']))

            # Two live app tabs commit independently; no shared JSON document can
            # overwrite the other's rejection. Explicit sync also checks the
            # durable revision independently of timely BroadcastChannel delivery.
            second = scale_ctx.new_page()
            second.set_default_timeout(90000)
            second.goto(origin + '/', wait_until='domcontentloaded')
            ready(second)
            concurrent = [FIRST, {**FIRST, 'state': 'T021'}]
            page.evaluate('s=>{globalThis.__pendingReject=HEWRSApp.ownerFeedback.hide(s,{scope:"outfit",context:"all"});}', concurrent[0])
            second.evaluate('s=>{globalThis.__pendingReject=HEWRSApp.ownerFeedback.hide(s,{scope:"outfit",context:"all"});}', concurrent[1])
            page.evaluate('async()=>await __pendingReject')
            second.evaluate('async()=>await __pendingReject')
            page.evaluate('async()=>await HEWRSApp.ownerFeedback.sync()')
            second.evaluate('async()=>await HEWRSApp.ownerFeedback.sync()')
            check('Concurrent tabs retain both independent writes and every earlier ban',
                  all(tab.evaluate('selections=>{const f=HEWRSApp.ownerFeedback;return f.snapshot().active.length===30002 && selections.every(s=>!f.allowed(s,"work"));}', concurrent + [events[0]['selection'], events[-1]['selection']]) for tab in [page, second]))
            stale = page.evaluate('()=>HEWRSApp.ownerFeedback.token()')
            third_selection = {**FIRST, 'state': 'T022'}
            second.evaluate('async s=>await HEWRSApp.ownerFeedback.hide(s,{scope:"outfit",context:"all"})', third_selection)
            guarded = page.evaluate('''async token=>{let published=false,error=null;try{await HEWRSApp.ownerFeedback.withCurrent(token,()=>{published=true;});}catch(e){error=e.message;}return {published,error};}''', stale)
            check('A durable cross-tab revision change prevents stale result publication', not guarded['published'] and bool(guarded['error']))
            second.close()
            page.evaluate('async()=>await HEWRSApp.rejection.retry()')

            # One real native generation, followed by 20 real UI rejections and
            # automatic refills inside that generation. Every surviving option
            # must retain its original serialized record and order.
            current = generate(page)
            check('Actual generation still returns 20 valid native outfits with more than 30,000 active bans',
                  len(current) == 20 and page.evaluate('()=>{const a=HEWRSApp,s=a.state();return a.connection.controller.verifyOptionSet(s.report.options,s.request) && s.report.options.every(o=>a.ownerFeedback.allowed(o._hewrsConnected.canonical_selection,s.request.context));}'))
            page.screenshot(path=str(evidence / 'native-after-30000-390x844.png'), full_page=True)
            removed = []
            refill_started = time.perf_counter()
            for number in range(20):
                selected = page.evaluate('()=>HEWRSApp.state().selection')
                removed.append(selected)
                key = page.evaluate('s=>HEWRSOutfitFeedback.key(s,"clothing")', selected)
                kept = [r for r in current if page.evaluate('s=>HEWRSOutfitFeedback.key(s,"clothing")', r['selection']) != key]
                before_count = page.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active.length')
                page.click('#reject-outfit')
                page.select_option('#rejection-scope', 'clothing')
                page.click('#rejection-permanent')
                page.wait_for_function('''count=>{const a=HEWRSApp,s=a.state(),d=document.getElementById('outfit-rejection-dialog');
                    return a.ownerFeedback.status().ready && a.ownerFeedback.snapshot().active.length>count && !s.busy
                    && !d.open && !document.getElementById('reject-outfit').disabled && s.optionCount===20;}''', arg=before_count, timeout=360000)
                current = rows(page)
                check('30k ledger refill ' + str(number + 1) + ': 20 valid choices, accepted rows unchanged, all previous rejections excluded',
                      len(current) == 20 and [r['value'] for r in current[:len(kept)]] == [r['value'] for r in kept]
                      and page.evaluate('''removed=>{const a=HEWRSApp,s=a.state(),k=x=>HEWRSOutfitFeedback.key(x,'clothing');
                        return a.connection.controller.verifyOptionSet(s.report.options,s.request)
                          && s.report.options.every(o=>a.ownerFeedback.allowed(o._hewrsConnected.canonical_selection,s.request.context)
                            && removed.every(x=>k(x)!==k(o._hewrsConnected.canonical_selection)));}''', removed))
            observations['twenty_ui_refills_seconds'] = round(time.perf_counter() - refill_started, 4)
            observations['final_status'] = page.evaluate('()=>HEWRSApp.ownerFeedback.status()')
            check('Migration, imports, save failures, Undo and 20 refills leave wear and Favorites unchanged',
                  page.evaluate('()=>({wear:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.snapshot()})') == untouched)
            check('New database writes do not backfill 30,000 localStorage records', legacy(page) == [])
            scale_ctx.close()
            check('No external or paid-provider requests', not external)
            check('No uncaught browser exceptions', not errors)
            result['status'] = 'passed'
            browser.close()
    except Exception as error:
        result['status'] = 'failed'
        result['error'] = str(error)
        raise
    finally:
        server.shutdown()
        result['passed'] = sum(c['passed'] for c in checks)
        result['failed'] = sum(not c['passed'] for c in checks)
        (evidence / 'RESULT.json').write_text(json.dumps(result, indent=2) + '\n')


if __name__ == '__main__':
    main()
