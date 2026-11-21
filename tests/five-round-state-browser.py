#!/usr/bin/env python3
"""Exercise current storage/UI races in fresh same-origin browser tabs.

Real UI handlers acquire the app's real Web Locks. Test-owned lock holders only
delay those handlers; no app store method or storage guard is replaced. All wear
records, Favorites, imports and rejections belong to disposable test profiles.
"""
import argparse
import copy
import functools
import hashlib
import contextlib
import io
import json
import sys
import threading
import time
import traceback
import urllib.parse
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from verify_active_delivery import describe
A = dict(suitId='S05', shirtId='DS029', state='T029', shoeId='shoe-8', watchId=None)
B = dict(suitId='S05', shirtId='DS007', state='T009', shoeId='shoe-8', watchId=None)
C = dict(suitId='S05', shirtId='DS036', state='T017', shoeId='shoe-8', watchId=None)
D = dict(suitId='S05', shirtId='DS025', state='T022', shoeId='shoe-8', watchId=None)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def serve():
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, 'http://127.0.0.1:%d/' % server.server_address[1]


def audited_delivery(url):
    """Bind the test to the requested, reproducibly built entrypoint.

    A V3 preview loads a distinct runtime. Validating that runtime against the
    production filename prevents the state tests from running at all; silently
    accepting any loaded script would lose their source-identity guarantee.
    """
    active = describe()
    if not url or Path(urllib.parse.urlsplit(url).path).name != 'avatar-v3-review.html':
        return active
    import build_avatar_v3_candidate
    with contextlib.redirect_stdout(io.StringIO()):
        build_avatar_v3_candidate.main(write=False)
    preview = json.loads((ROOT / 'AVATAR_V3_REVIEW_BUILD.json').read_text())
    baseline_runtime = active.get('continuous_runtime', active['runtime'])
    baseline_sha256 = active.get('continuous_runtime_sha256', active['runtime_sha256'])
    assert preview['base_runtime'] == baseline_runtime
    assert preview['base_runtime_sha256'] == baseline_sha256
    if active['kind'] == 'avatar-v3':
        assert preview['runtime'] == active['runtime']
        assert preview['runtime_sha256'] == active['runtime_sha256']
    files = ['AVATAR_V3_REVIEW_BUILD.json', preview['preview_entrypoint'], preview['runtime'],
             'src/avatar-v3.js', 'src/avatar-v3-pose.js', 'data/avatar-v3-candidate.json']
    return {**active, 'kind': 'avatar-v3-preview', 'runtime': preview['runtime'],
            'runtime_sha256': preview['runtime_sha256'], 'avatar_sha256': preview['new_avatar_sha256'],
            'base_runtime': baseline_runtime, 'base_runtime_sha256': baseline_sha256,
            'source_sha256': {**active['source_sha256'], **{
                name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in files}}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', choices=('chromium', 'webkit'), default='chromium')
    parser.add_argument('--url')
    args = parser.parse_args()
    active_delivery = audited_delivery(args.url)
    server, url = (None, args.url) if args.url else serve()
    output = ROOT / 'evidence/five_round_20261119/browser' / args.browser / ('live-state' if args.url else 'state')
    output.mkdir(parents=True, exist_ok=True)
    checks, errors, failures, http_errors, external, barriers, claims = [], [], [], [], [], [], []
    pages, contexts, deliberate_stalls = [], [], set()
    active_requests = {}
    phase = {'name': 'startup'}
    result = dict(schema='hewrs.five-round-state-browser.v1', browser=args.browser, url=url,
                  owner_data_accessed=False, test_profiles='fresh disposable profiles only',
                  started_at=datetime.now(timezone.utc).isoformat(), checks=checks, claims=claims,
                  barriers=barriers, page_errors=errors, request_failures=failures,
                  http_errors=http_errors, external_requests=external)

    def save():
        result['passed'] = sum(row['passed'] for row in checks)
        result['failed'] = sum(not row['passed'] for row in checks)
        (output / 'RESULT.json').write_text(json.dumps(result, indent=2) + '\n')

    def check(name, okay, detail=None):
        checks.append(dict(name=name, passed=bool(okay), detail=detail))
        print(('PASS: ' if okay else 'FAIL: ') + name, flush=True)
        save()
        if not okay:
            raise AssertionError(name + ': ' + str(detail))

    def new_context(browser, label):
        context = browser.new_context(viewport=dict(width=430, height=930), timezone_id='UTC', accept_downloads=True)
        contexts.append(context)
        origin = urllib.parse.urlsplit(url)[:2]

        def local_only(route):
            if urllib.parse.urlsplit(route.request.url)[:2] == origin:
                route.continue_()
            else:
                external.append(dict(profile=label, phase=phase['name'], url=route.request.url))
                route.abort()

        context.route('**/*', local_only)
        context.add_init_script("""window.__auditStorageEvents=[];window.__auditMessages=[];
window.addEventListener('storage',event=>window.__auditStorageEvents.push({key:event.key,newValue:event.newValue}));
let auditLastMessage='';new MutationObserver(()=>{const text=document.getElementById('fx-sheet-error')?.textContent||'';
if(text&&text!==auditLastMessage)window.__auditMessages.push(text);auditLastMessage=text;
}).observe(document,{subtree:true,childList:true,characterData:true});""")
        return context

    def ready(page, label, navigate=True):
        if navigate:
            response = page.goto(url, wait_until='domcontentloaded', timeout=120000)
            check(label + ': current HTML loads', response is not None and response.status == 200)
        page.wait_for_function('()=>globalThis.HEWRS_READY && HEWRSApp.rejection', timeout=120000)
        page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
        check(label + ': persistent stores and real Web Locks are available', page.evaluate('''()=>
            !!navigator.locks?.request && !!navigator.locks?.query &&
            HEWRSApp.store.status().persistent && HEWRSApp.favorites.status().persistent &&
            HEWRSApp.ownerFeedback.status().ready && !HEWRSApp.feedbackReadError'''))
        check(label + ': completed rejection check clears its loading status',
              page.locator('#rejection-status').inner_text() != 'Loading saved rejections…')

    def new_page(context, label):
        page = context.new_page()
        page.set_default_timeout(90000)
        pages.append((label, page))
        active_requests[page] = {}

        def started(request):
            active_requests[page][request.url] = active_requests[page].get(request.url, 0) + 1

        def ended(request):
            count = active_requests[page].get(request.url, 0) - 1
            if count > 0:
                active_requests[page][request.url] = count
            else:
                active_requests[page].pop(request.url, None)

        page.on('request', started)
        page.on('requestfinished', ended)
        page.on('requestfailed', ended)
        page.on('pageerror', lambda error: errors.append(dict(page=label, phase=phase['name'], error=str(error))))
        page.on('requestfailed', lambda request: failures.append(dict(page=label, phase=phase['name'], url=request.url, error=request.failure)))
        page.on('response', lambda response: http_errors.append(dict(page=label, phase=phase['name'], url=response.url, status=response.status))
                if response.status >= 400 and not response.url.endswith('/favicon.ico') else None)
        ready(page, label)
        return page

    def close_sheet(page):
        if page.locator('#fx-sheet').evaluate('(node)=>node.open'):
            page.locator('#fx-sheet-close').click()
            page.wait_for_function('()=>!document.getElementById("fx-sheet").open')

    def nav(page, name):
        close_sheet(page)
        page.locator('nav [data-page="' + name + '"]').click()
        page.wait_for_function('(name)=>HEWRSApp.state().page===name', arg=name)

    def current(page, selected):
        close_sheet(page)
        applied = page.evaluate('''async s=>{
            const r=await HEWRSApp.apply(s,{origin:'manual',save:false,keepPreferences:true});
            return {cancelled:!!r.cancelled,current:HEWRSApp.state().selection,last:HEWRSApp.renderer.last()};
        }''', selected)
        check('Setup renders exact ' + selected['shirtId'] + '/' + selected['state'], not applied['cancelled'] and applied['current'] == selected and applied['last'] == selected)
        nav(page, 'outfits')

    def favorites(page):
        nav(page, 'rotation')
        page.locator('#favorites-button').click()
        page.wait_for_function('()=>document.getElementById("fx-sheet-title").textContent==="Favorites"')

    def backup(page):
        nav(page, 'wardrobe')
        page.locator('#data-button').click()
        page.wait_for_selector('#backup-file')

    def wear(page):
        nav(page, 'outfits')
        page.locator('#record-wear').click()
        page.locator('#wear-date').fill('2026-11-19')

    def raw(page, key):
        return page.evaluate('(key)=>localStorage.getItem(key)', key)

    def durable(page, key):
        value = raw(page, key)
        return json.loads(value) if value is not None else None

    def hold(page, key, label):
        token = 'barrier_' + str(len(barriers))
        page.evaluate('''({key,token})=>{
            window.__auditLocks??={};const state={entered:false,done:false};window.__auditLocks[token]=state;
            state.promise=navigator.locks.request(key,{mode:'exclusive'},async()=>{
                state.entered=true;await new Promise(resolve=>state.release=resolve);
            }).then(()=>state.done=true,error=>{state.error=error.message;state.done=true;});
        }''', dict(key=key, token=token))
        page.wait_for_function('(token)=>window.__auditLocks[token].entered', arg=token)
        barriers.append(dict(token=token, key=key, label=label, pending=[]))
        return token

    def queued(page, key, count, token):
        page.wait_for_function('async({key,count})=>(await navigator.locks.query()).pending.filter(x=>x.name===key).length===count', arg=dict(key=key, count=count), timeout=15000)
        query = page.evaluate('async()=>navigator.locks.query()')
        barriers[-1]['pending'].append(dict(expected=count, query=query))
        check(barriers[-1]['label'] + ': ' + str(count) + ' actual UI operation(s) wait behind the held lock', len([row for row in query['held'] if row['name'] == key]) == 1)

    def release(page, key, token):
        page.evaluate('(token)=>window.__auditLocks[token].release()', token)
        page.wait_for_function('async({key,token})=>window.__auditLocks[token].done && !(await navigator.locks.query()).held.concat((await navigator.locks.query()).pending).some(x=>x.name===key)', arg=dict(key=key, token=token), timeout=15000)
        page.evaluate('async()=>{await new Promise(resolve=>setTimeout(resolve,0));}')
        barriers[-1]['released'] = True

    def refusal(page, label, message_start):
        page.wait_for_function('(start)=>window.__auditMessages.slice(start).some(text=>/changed|reload|review again|closed/i.test(text))', arg=message_start, timeout=15000)
        messages = page.evaluate('(start)=>window.__auditMessages.slice(start)', message_start)
        check(label + ': UI reports refusal of the stale queued write', bool(messages), messages)

    def favorite_refusal_or_refresh(page, key, message_start, storage_start):
        # A real storage event can replace the Favorites sheet before its queued
        # write rejects. The obsolete action then correctly suppresses its error.
        # Require that exact replacement notification plus the observed storage
        # event; durable records and the explicit retry remain checked below.
        state = '''({key,message_start,storage_start})=>{
          const messages=window.__auditMessages.slice(message_start).filter(text=>/changed|reload|review again|closed/i.test(text));
          const events=window.__auditStorageEvents.slice(storage_start).filter(event=>event.key===key&&event.newValue!==null);
          const notice=document.getElementById('favorite-notice')?.textContent||'';
          const refreshed=notice==='Favorites updated from another tab.'&&events.length>0;
          return {messages,events,notice,refreshed,settled:messages.length>0||refreshed};
        }'''
        params = dict(key=key, message_start=message_start, storage_start=storage_start)
        page.wait_for_function('args=>(' + state + ')(args).settled', arg=params, timeout=15000)
        outcome = page.evaluate(state, params)
        check('Second Favorite tab: stale queued write reports refusal or refreshes from the actual other-tab storage event',
              outcome['settled'], outcome)

    def favorite_success(page, selected, key, label):
        page.wait_for_function('()=>document.getElementById("favorite-notice")?.textContent.includes("saved as a Favorite")', timeout=15000)
        data = durable(page, key)
        matches = [row for row in data['items'] if row['selection'] == selected]
        check(label + ': claimed Favorite success exists in durable storage', len(matches) == 1)
        claims.append(dict(kind='favorite', label=label, id=matches[0]['id'], selection=selected))
        return matches[0]

    def wear_success(page, selected, key, label):
        page.wait_for_function('()=>!document.getElementById("fx-sheet").open && document.getElementById("status").textContent.includes("Wear recorded.")', timeout=15000)
        data = durable(page, key)
        matches = [row for row in data['events'] if row['canonical_selection'] == selected]
        check(label + ': claimed wear success exists in durable storage', len(matches) == 1)
        claims.append(dict(kind='wear', label=label, id=matches[0]['id'], selection=selected))
        return matches[0]

    def export_json(page, selector, filename):
        with page.expect_download(timeout=15000) as pending:
            page.locator(selector).click()
        pending.value.save_as(output / filename)
        return json.loads((output / filename).read_text())

    def file(page, selector, data, name):
        page.locator(selector).set_input_files(dict(name=name, mimeType='application/json', buffer=json.dumps(data).encode()))

    def cancel_queued(page, key, action, label):
        before = raw(page, key)
        token = hold(page, key, label)
        action.click()
        queued(page, key, 1, token)
        check(label + ': queued action has not written early', raw(page, key) == before)
        page.locator('#fx-sheet-close').click()
        page.wait_for_function('()=>!document.getElementById("fx-sheet").open')
        release(page, key, token)
        check(label + ': closing the modal prevents the queued mutation', raw(page, key) == before)
        check(label + ': completed cancellation does not reopen a modal', not page.locator('#fx-sheet').evaluate('(node)=>node.open'))

    def pixels(page):
        return page.evaluate('''async()=>{const c=document.getElementById('avatar');const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',p)),b=>b.toString(16).padStart(2,'0')).join('');}''')

    def unique_image_url(page, selected, previous):
        return page.evaluate('''({selected,previous})=>{
            const all=value=>Array.isArray(value)?value.flatMap(all):value&&typeof value==='object'?(value.sha256?[value]:Object.entries(value).filter(([key])=>key!=='selection').flatMap(([,v])=>all(v))):[];
            const old=new Set(all(HEWRSApp.renderer.plan(previous)).map(d=>d.sha256));
            const fresh=all(HEWRSApp.renderer.plan(selected)).find(d=>!old.has(d.sha256));
            if(!fresh)throw Error('No exact new source descriptor for stalled render test');
            return new URL(HEWRSApp.resolveUrl(fresh),document.baseURI).href;
        }''', dict(selected=selected, previous=previous))

    def stall(page, resource):
        pending = []
        deliberate_stalls.add(resource)

        def pause(route):
            pending.append(route)

        page.route(resource, pause)
        return pending, pause

    def unstall(page, resource, pending, callback):
        page.unroute(resource, callback)
        for route in pending:
            try:
                route.abort('aborted')
            except Exception:
                # Cancelling an Image may have already destroyed its paused request.
                pass

    def only_stalled_request(page, resource, pending):
        # Let the other exact source images complete first. Only the deliberately
        # held request is allowed to fail when Cancel is clicked; unrelated
        # aborted/error requests are never broadly exempted from health checks.
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            page.wait_for_timeout(25)
            if pending and set(active_requests[page]) == {resource}:
                return
        check('Only the intentionally stalled source remains in flight', False, active_requests[page])

    browser = None
    try:
        with sync_playwright() as pw:
            browser = getattr(pw, args.browser).launch(headless=True)
            context = new_context(browser, 'shared-storage')
            a, b = new_page(context, 'tab-A'), new_page(context, 'tab-B')
            keys = a.evaluate('()=>({wear:HEWRSApp.store.key,favorites:HEWRSApp.favorites.key,source:HEWRSApp.state().sourceLock})')
            result['identity'] = keys
            result['active_delivery'] = active_delivery
            result['source_sha256'] = {**active_delivery['source_sha256'], **{
                name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                for name in ['src/local-state.js', 'src/favorites-state.js', 'src/outfit-refill-application.js']}}
            for label, tab in [('tab-A', a), ('tab-B', b)]:
                scripts = tab.evaluate('()=>Array.from(document.scripts,s=>s.getAttribute("src")).filter(Boolean)')
                expected = active_delivery['runtime'] + '?v=' + active_delivery['runtime_sha256'][:16]
                check(label + ': audited source hashes match the actual loaded runtime', scripts.count(expected) == 1)
            check('Both tabs share one fresh origin and no owner records', a.evaluate('()=>HEWRSApp.store.snapshot().events.length===0 && HEWRSApp.favorites.snapshot().items.length===0') and b.evaluate('()=>HEWRSApp.store.snapshot().events.length===0 && HEWRSApp.favorites.snapshot().items.length===0'))
            current(a, A)
            current(b, B)

            phase['name'] = 'concurrent-favorites'
            favorites(a)
            favorites(b)
            favorite_messages = b.evaluate('()=>window.__auditMessages.length')
            favorite_storage = b.evaluate('()=>window.__auditStorageEvents.length')
            token = hold(a, keys['favorites'], 'Concurrent Favorite saves')
            a.locator('#save-favorite').click()
            queued(a, keys['favorites'], 1, token)
            b.locator('#save-favorite').click()
            queued(a, keys['favorites'], 2, token)
            check('Favorite writes remain pending before release', raw(a, keys['favorites']) is None)
            release(a, keys['favorites'], token)
            first_favorite = favorite_success(a, A, keys['favorites'], 'First tab')
            favorite_refusal_or_refresh(b, keys['favorites'], favorite_messages, favorite_storage)
            check('Refused Favorite did not overwrite or claim a second saved record', durable(a, keys['favorites'])['items'] == [first_favorite])
            favorites(b)
            b.locator('#save-favorite').click()
            second_favorite = favorite_success(b, B, keys['favorites'], 'Second tab retry')
            check('Both claimed Favorite successes survive after stale retry', durable(a, keys['favorites'])['items'] == [first_favorite, second_favorite])
            favorites(a)
            a.locator('#favorite-data').click()
            exported_favorites = export_json(a, '#export-favorites', 'FAVORITES_AFTER_CONCURRENT_SAVES.json')
            check('Real Favorite export includes the other tab latest durable save', exported_favorites == durable(a, keys['favorites']))

            phase['name'] = 'concurrent-wear'
            close_sheet(a)
            close_sheet(b)
            current(a, A)
            current(b, B)
            wear(a)
            wear(b)
            wear_messages = b.evaluate('()=>window.__auditMessages.length')
            token = hold(a, keys['wear'], 'Concurrent confirmed-wear saves')
            a.locator('#confirm-wear').click()
            queued(a, keys['wear'], 1, token)
            b.locator('#confirm-wear').click()
            queued(a, keys['wear'], 2, token)
            check('Wear writes remain pending before release', raw(a, keys['wear']) is None)
            release(a, keys['wear'], token)
            first_wear = wear_success(a, A, keys['wear'], 'First wear tab')
            refusal(b, 'Second wear tab', wear_messages)
            check('Refused wear save preserves the first confirmed record', durable(a, keys['wear'])['events'] == [first_wear])
            b.locator('#confirm-wear').click()
            second_wear = wear_success(b, B, keys['wear'], 'Second wear retry')
            check('Both claimed wear successes survive after stale retry', durable(a, keys['wear'])['events'] == [first_wear, second_wear])
            backup(a)
            exported_wear = export_json(a, '#export-backup', 'WEAR_AFTER_CONCURRENT_SAVES.json')
            check('Real wear export includes the other tab latest durable save', exported_wear == durable(a, keys['wear']))
            b.reload(wait_until='domcontentloaded')
            ready(b, 'tab-B reloaded', navigate=False)
            check('Reload retains both durable Favorites and wear events', b.evaluate('()=>HEWRSApp.favorites.snapshot().items.length===2 && HEWRSApp.store.snapshot().events.length===2'))

            phase['name'] = 'queued-modal-close'
            current(a, C)
            favorites(a)
            cancel_queued(a, keys['favorites'], a.locator('#save-favorite'), 'Favorite save')
            favorites(a)
            a.locator('[data-favorite-remove="' + first_favorite['id'] + '"]').click()
            cancel_queued(a, keys['favorites'], a.locator('#confirm-favorite-removal'), 'Favorite removal')
            favorites(a)
            a.locator('#favorite-data').click()
            incoming_favorites = copy.deepcopy(exported_favorites)
            incoming_favorites['revision'] = 0
            incoming_favorites['items'] = [dict(id='favorite_audit_import', created_at='2026-11-19T12:00:00.000Z', selection=D)]
            file(a, '#favorites-file', incoming_favorites, 'synthetic-favorites.json')
            a.wait_for_function('()=>!document.getElementById("confirm-favorites-import").disabled')
            cancel_queued(a, keys['favorites'], a.locator('#confirm-favorites-import'), 'Favorite import')
            current(a, C)
            wear(a)
            cancel_queued(a, keys['wear'], a.locator('#confirm-wear'), 'Wear save')
            backup(a)
            empty_wear = copy.deepcopy(exported_wear)
            empty_wear.update(revision=0, events=[], session=None)
            file(a, '#backup-file', empty_wear, 'synthetic-empty-wear.json')
            a.wait_for_function('()=>!document.getElementById("confirm-restore").disabled')
            cancel_queued(a, keys['wear'], a.locator('#confirm-restore'), 'Wear restore')
            nav(a, 'rotation')
            a.locator('#clear-log').click()
            cancel_queued(a, keys['wear'], a.get_by_role('button', name='Confirm clear', exact=True), 'Clear wear log')

            phase['name'] = 'stale-queued-restore'
            current(b, C)
            wear(b)
            backup(a)
            file(a, '#backup-file', empty_wear, 'synthetic-stale-wear.json')
            a.wait_for_function('()=>!document.getElementById("confirm-restore").disabled')
            restore_messages = a.evaluate('()=>window.__auditMessages.length')
            token = hold(a, keys['wear'], 'New wear save before queued restore')
            b.locator('#confirm-wear').click()
            queued(a, keys['wear'], 1, token)
            a.locator('#confirm-restore').click()
            queued(a, keys['wear'], 2, token)
            release(a, keys['wear'], token)
            third_wear = wear_success(b, C, keys['wear'], 'Wear before stale restore')
            refusal(a, 'Stale destructive restore', restore_messages)
            check('Stale restore preserves every claimed wear success', durable(a, keys['wear'])['events'] == [first_wear, second_wear, third_wear])
            backup(a)
            latest_wear = export_json(a, '#export-backup', 'WEAR_LATEST_DURABLE.json')
            check('Latest exported backup retains all three confirmed writes', latest_wear == durable(a, keys['wear']) and len(latest_wear['events']) == 3)
            (output / 'DURABLE_BEFORE_EXPLICIT_CLEAR.json').write_text(json.dumps(dict(wear=latest_wear, favorites=durable(a, keys['favorites'])), indent=2) + '\n')

            phase['name'] = 'storage-event-refresh'
            favorites(a)
            b.evaluate('(key)=>localStorage.removeItem(key)', keys['favorites'])
            a.wait_for_function('()=>HEWRSApp.favorites.snapshot().items.length===0 && document.querySelectorAll("#favorites-list [data-favorite-id]").length===0')
            check('Removing the Favorite storage key refreshes the open other-tab panel', a.evaluate('(key)=>window.__auditStorageEvents.some(e=>e.key===key&&e.newValue===null)', keys['favorites']))
            current(a, C)
            favorites(a)
            a.locator('#save-favorite').click()
            a.wait_for_function('()=>document.getElementById("favorite-notice")?.textContent.includes("saved as a Favorite")')
            b.evaluate('()=>localStorage.clear()')
            a.wait_for_function('()=>window.__auditStorageEvents.some(e=>e.key===null) && HEWRSApp.store.snapshot().events.length===0 && HEWRSApp.favorites.snapshot().items.length===0')
            check('Actual key=null storage event refreshes both other-tab stores', a.locator('#wear-count').inner_text() == '0' and a.locator('#favorites-list [data-favorite-id]').count() == 0)
            result['storage_events'] = a.evaluate('()=>window.__auditStorageEvents.map(({key,newValue})=>({key,deleted:newValue===null}))')
            a.screenshot(path=str(output / 'cleared-other-tab.png'))

            phase['name'] = 'manual-rejection-navigation'
            isolated = new_context(browser, 'rejection-and-render')
            p = new_page(isolated, 'render-tab')
            current(p, A)
            p.locator('#reject-outfit').click()
            p.locator('#rejection-issue-tie_shirt').check()
            p.locator('#rejection-permanent').click()
            p.wait_for_function('()=>!document.getElementById("outfit-rejection-dialog")?.open && document.getElementById("outfit-output").hidden')
            check('Manual UI rejection hides its retained outfit', p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active.some(e=>e.scope==="shirt_tie")'))
            nav(p, 'home')
            p.locator('#view-current').click()
            p.wait_for_function('()=>HEWRSApp.state().page==="outfits"')
            check('Home View current cannot re-expose a rejected retained outfit', p.locator('#outfit-output').is_hidden() and p.locator('#record-wear').is_disabled())
            check('Blocked retained outfit explains its rejection', 'rejected' in p.locator('#outfit-empty').inner_text().lower())
            p.screenshot(path=str(output / 'manual-rejection-view-current.png'))

            phase['name'] = 'stalled-native-render'
            current(p, C)
            before_pixels = pixels(p)
            target = dict(C, state='T031')
            resource = unique_image_url(p, target, C)
            pending, callback = stall(p, resource)
            nav(p, 'home')
            with p.expect_request(lambda request: request.url == resource, timeout=15000):
                p.evaluate('''s=>{window.__auditRender={state:'pending'};HEWRSApp.apply(s,{origin:'manual',save:false,keepPreferences:true}).then(value=>window.__auditRender={state:'settled',value},error=>window.__auditRender={state:'error',message:error.message});}''', target)
            p.wait_for_function('()=>HEWRSApp.state().busy')
            only_stalled_request(p, resource, pending)
            check('Native image route is genuinely held without a response', bool(pending))
            p.locator('#cancel-work').click()
            p.wait_for_function('()=>window.__auditRender.state!=="pending"', timeout=5000)
            outcome = p.evaluate('()=>window.__auditRender')
            check('Real Cancel settles the blocked native render before transport release', outcome['state'] == 'settled' and outcome['value'].get('cancelled'), outcome)
            check('Cancelled native work preserves exact prior selection and pixels', p.evaluate('()=>HEWRSApp.state().selection') == C and p.evaluate('()=>HEWRSApp.renderer.last()') == C and pixels(p) == before_pixels)
            unstall(p, resource, pending, callback)
            # WebKit may satisfy the new Image from its own decoded/network
            # cache. Observe transport without requiring another request; the
            # exact completed selection and changed native pixels prove retry.
            retry_requests = []

            def observe_retry(request):
                if request.url == resource:
                    retry_requests.append(request.url)

            p.on('request', observe_retry)
            try:
                current(p, target)
            finally:
                p.remove_listener('request', observe_retry)
            retry = dict(selection=p.evaluate('()=>HEWRSApp.state().selection'),
                         renderer_selection=p.evaluate('()=>HEWRSApp.renderer.last()'),
                         pixel_sha256=pixels(p), prior_pixel_sha256=before_pixels,
                         observed_network_requests=len(retry_requests), resource=resource)
            result['native_retry'] = retry
            check('Exact retry produces the requested selection and a new native frame',
                  retry['selection'] == target and retry['renderer_selection'] == target and
                  retry['pixel_sha256'] != before_pixels, retry)

            phase['name'] = 'stalled-comparison-render'
            compare_selection = dict(C, state='T030')
            resource = unique_image_url(p, compare_selection, target)
            pending, callback = stall(p, resource)
            before_pixels = pixels(p)
            with p.expect_request(lambda request: request.url == resource, timeout=15000):
                p.evaluate('''pair=>{window.__auditComparison={state:'pending'};HEWRSApp.preferencePanel.showPair(pair,()=>{},()=>{}).then(()=>window.__auditComparison={state:'settled'},error=>window.__auditComparison={state:'error',message:error.message});}''', dict(id=None, a=compare_selection, b=C, context=dict(occasion='work', requiredFormality='any'), partition='training'))
            p.wait_for_selector('#pref-pair-grid')
            only_stalled_request(p, resource, pending)
            check('Comparison image route is held while the real modal is open', bool(pending) and p.locator('#fx-sheet').evaluate('(node)=>node.open'))
            p.locator('#fx-sheet-close').click()
            p.wait_for_function('()=>window.__auditComparison.state!=="pending"', timeout=5000)
            check('Closing comparison settles its stalled private renderer before release', p.evaluate('()=>window.__auditComparison.state') == 'settled')
            check('Closed comparison neither reopens nor changes current pixels or preferences', not p.locator('#fx-sheet').evaluate('(node)=>node.open') and pixels(p) == before_pixels and p.evaluate('()=>HEWRSApp.learning.model({occasion:"work",requiredFormality:"any"}).state.comparisons.length===0'))
            unstall(p, resource, pending, callback)
            check('Synthetic rejection/render profile records no wear or Favorites', p.evaluate('()=>HEWRSApp.store.snapshot().events.length===0 && HEWRSApp.favorites.snapshot().items.length===0'))

            phase['name'] = 'final-health'
            unexpected = [row for row in failures if not (row['url'] in deliberate_stalls and any(word in str(row['error']).lower() for word in ('abort', 'cancel')))]
            check('No external or provider request was attempted', not external, external)
            check('No application browser exception occurred', not errors, errors)
            check('No failed HTTP asset response occurred', not http_errors, http_errors)
            check('Only deliberately held-and-cancelled image requests may fail', not unexpected, unexpected)
            result['deliberately_stalled_urls'] = sorted(deliberate_stalls)
            result['completed_at'] = datetime.now(timezone.utc).isoformat()
            save()
            for context in contexts:
                context.close()
            contexts.clear()
            browser.close()
            browser = None
    except Exception:
        checks.append(dict(name='State browser audit completion', passed=False, detail=traceback.format_exc(), phase=phase['name']))
        print(traceback.format_exc(), flush=True)
        for label, page in pages:
            try:
                page.screenshot(path=str(output / ('FAILURE-' + label.replace(' ', '-') + '.png')))
            except Exception:
                pass
    finally:
        result['completed_at'] = datetime.now(timezone.utc).isoformat()
        result['deliberately_stalled_urls'] = sorted(deliberate_stalls)
        save()
        if browser:
            try:
                browser.close()
            except Exception:
                pass
        if server:
            server.shutdown()
    if any(not row['passed'] for row in checks):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
