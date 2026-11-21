#!/usr/bin/env python3
"""Independent UI audit of every rejection reason and rejection lifecycle.

All profiles are synthetic and isolated. Garments come from the native engine;
reason/scope/save/Undo actions use the actual controls. Matching expectations
are computed here, independently of the application's key/match functions.
--url tests the real published application without substituting responses.
"""
import argparse
import functools
import hashlib
import json
import threading
import urllib.parse
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REASONS = (
    ('entire', 'clothing', ()),
    ('shirt_tie_suit', 'topwear_shirt_tie', ('shirtId', 'state')),
    ('tie_shirt', 'shirt_tie', ('state',)),
    ('shirt_suit', 'topwear_shirt', ('shirtId',)),
    ('shirt_appearance', 'shirt', ('shirtId',)),
    ('tie_suit', 'topwear_tie', ('state',)),
    ('footwear', 'outfit', ('shoeId',)),
    ('colors', 'clothing', ()),
    ('patterns', 'clothing', ()),
    ('formality', 'clothing', ()),
    ('other', 'clothing', ()),
)
SCOPES = ('clothing', 'outfit', 'shirt', 'topwear_shirt',
          'topwear_shirt_tie', 'shirt_tie', 'topwear_tie', 'tie')
PARTS = ('suitId', 'blazerId', 'shirtOnly', 'pantId', 'shirtId', 'state', 'shoeId', 'watchId')


def matches(selection, target, scope):
    """Scope oracle: deliberately does not call application key helpers."""
    top = lambda value: value.get('suitId') or value.get('blazerId')
    if scope == 'shirt':
        return selection['shirtId'] == target['shirtId']
    if scope == 'tie':
        return selection['state'] == target['state']
    if scope == 'shirt_tie':
        return selection['shirtId'] == target['shirtId'] and selection['state'] == target['state']
    if scope == 'topwear_tie':
        return bool(top(selection)) and top(selection) == top(target) and selection['state'] == target['state']
    if scope == 'topwear_shirt':
        return bool(top(selection)) and top(selection) == top(target) and selection['shirtId'] == target['shirtId']
    if scope == 'topwear_shirt_tie':
        return (bool(top(selection)) and top(selection) == top(target)
                and selection['shirtId'] == target['shirtId'] and selection['state'] == target['state'])
    fields = ('suitId', 'blazerId', 'shirtOnly', 'pantId', 'shirtId', 'state')
    if scope == 'outfit':
        fields += ('shoeId',)
    return all(selection.get(key) == target.get(key) for key in fields)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', choices=('chromium', 'webkit'), default='chromium')
    parser.add_argument('--section', choices=('reasons', 'lifecycle'), required=True)
    parser.add_argument('--url')
    parser.add_argument('--baseline', action='store_true')
    args = parser.parse_args()
    if args.baseline and args.section != 'reasons':
        parser.error('--baseline is a reason-scope characterization only')
    server = None
    if args.url:
        base = args.url
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = 'http://127.0.0.1:' + str(server.server_address[1]) + '/'
    parsed = urllib.parse.urlsplit(base)
    origin = parsed.scheme, parsed.netloc
    evidence = ROOT / 'evidence/all_rejections' / ('live' if args.url else 'local') / args.browser / args.section
    if args.baseline:
        evidence = evidence / 'baseline'
    evidence.mkdir(parents=True, exist_ok=True)
    checks, cases, errors, external, failed, http_errors = [], [], [], [], [], []
    result = dict(schema='hewrs.all-rejections-browser.v1', url=base, browser=args.browser,
                  section=args.section, baseline=args.baseline, owner_data_accessed=False,
                  fresh_isolated_profiles=True,
                  application_response_source='live_https_only' if args.url else 'local_checkout',
                  started_at=datetime.now(timezone.utc).isoformat(), checks=checks, cases=cases,
                  page_errors=errors, external_requests=external, failed_requests=failed, http_errors=http_errors)
    browser = page = None
    page_phases = {}
    image_checks, navigation_events = [], []
    result['card_image_readiness'] = image_checks
    result['navigation_events'] = navigation_events

    def now():
        return datetime.now(timezone.utc).isoformat()

    def phase(p, name):
        page_phases[p].update(phase=name, phase_started_at=now())

    # Inspect the real card model and mounted DOM. No image fetches, transport
    # retries, application mutations or exemptions from the network-error gate.
    card_state = r"""()=>{
      const app=globalThis.HEWRSApp,box=document.getElementById('option-card-items');
      if(!app||!box)return {ready:false,reason:'Application/card container unavailable'};
      const state=app.state(),model=app.cardSnapshot(),rows=[...box.querySelectorAll('.lb-item')],images=[...box.querySelectorAll('img.lb-swatch')];
      const expected=(model?.items||[]).map(item=>({role:item.role,id:item.id||'',image:item.image?{
        url:new URL(globalThis.HEWRS_EMBEDDED_UI_IMAGES?.[item.image.sha256]||item.image.src,document.baseURI).href,
        sha256:item.image.sha256,source_key:String(item.image.source_key)}:null}));
      const expectedImages=expected.filter(item=>item.image),actual=images.map(img=>({
        role:img.closest('.lb-item')?.dataset.role,id:img.closest('.lb-item')?.dataset.itemId,
        url:img.currentSrc||img.src,source_key:img.dataset.sourceKey,complete:img.complete,
        width:img.naturalWidth,height:img.naturalHeight,hidden:img.hidden,connected:img.isConnected,
        fallback:!!img.closest('.lb-image-unavailable')}));
      const selectionMatches=model?JSON.stringify(model.selection)===JSON.stringify(state.selection)
        &&box.dataset.selection===JSON.stringify(model.selection):state.selection===null&&rows.length===0&&images.length===0;
      const rowIdentityMatches=rows.length===expected.length&&rows.every((row,i)=>row.dataset.role===expected[i].role&&row.dataset.itemId===expected[i].id);
      const sourcesMatch=actual.length===expectedImages.length&&actual.every((img,i)=>img.role===expectedImages[i].role&&img.id===expectedImages[i].id
        &&img.url===expectedImages[i].image.url&&img.source_key===expectedImages[i].image.source_key);
      const decoded=actual.every(img=>img.complete&&img.width>0&&img.height>0&&!img.hidden&&img.connected&&!img.fallback);
      const fallback=!!box.querySelector('.lb-image-unavailable');
      return {ready:!state.busy&&selectionMatches&&rowIdentityMatches&&sourcesMatch&&decoded&&!fallback,
        busy:state.busy,selection:state.selection,fingerprint:JSON.stringify({selection:model?.selection||null,items:expected}),
        selection_matches:selectionMatches,row_identity_matches:rowIdentityMatches,sources_match:sourcesMatch,
        expected_count:expectedImages.length,actual_count:actual.length,expected,actual,fallback};
    }"""

    def card_images_ready(p, boundary):
        phase(p, 'card_readiness: ' + boundary)
        observation = dict(case=page_phases[p]['case'], boundary=boundary,
                           started_at=now(), status='pending')
        image_checks.append(observation)
        try:
            # Wait only for observable load readiness. A current error fallback
            # terminates immediately. No failed image is reset or retried.
            handle = p.wait_for_function('()=>{const inspect=' + card_state +
                                         ';const state=inspect();return state.ready||state.fallback?state:false;}',
                                         timeout=30000)
            observed = handle.json_value()
            handle.dispose()
            observation['state'] = observed
            if not observed['ready']:
                raise AssertionError('A current registered thumbnail entered its error fallback')
            observation['state'] = p.evaluate('''async expected=>{
              const inspect=''' + card_state + ''';
              const box=document.getElementById('option-card-items'),images=[...box.querySelectorAll('img.lb-swatch')],before=inspect();
              if(!before.ready||before.fingerprint!==expected.fingerprint)throw Error('Current card changed before decode verification');
              let timer;
              try{await Promise.race([Promise.all(images.map(img=>img.decode())),new Promise((_,reject)=>{
                timer=setTimeout(()=>reject(Error('Current thumbnail decode did not settle')),10000);})]);}
              finally{clearTimeout(timer);}
              const after=inspect(),mounted=[...box.querySelectorAll('img.lb-swatch')];
              if(!after.ready||after.fingerprint!==expected.fingerprint||mounted.length!==images.length
                 ||mounted.some((img,i)=>img!==images[i]))throw Error('Current card changed or failed during decode verification');
              return {...after,decode_verified:true};
            }''', observed)
            observation['status'] = 'passed'
            phase(p, 'card_ready: ' + boundary)
        except Exception as error:
            observation.update(status='failed', error=str(error))
            try:
                observation['failure_state'] = p.evaluate(card_state)
            except Exception as state_error:
                observation['failure_state_error'] = str(state_error)
            raise AssertionError('Current card images were not ready before ' + boundary + ': ' + str(error)) from error
        finally:
            observation['finished_at'] = now()

    def reload_page(p):
        card_images_ready(p, 'scripted reload')
        phase(p, 'scripted_reload')
        return p.reload(wait_until='domcontentloaded')

    def close_context(context, p):
        card_images_ready(p, 'synthetic context teardown')
        phase(p, 'context_teardown')
        context.close()

    def check(name, condition):
        checks.append(dict(name=name, passed=bool(condition)))
        print(('PASS: ' if condition else 'FAIL: ') + name, flush=True)
        assert condition, name

    def ready(p):
        p.wait_for_function('()=>globalThis.HEWRS_READY && HEWRSApp.rejection', timeout=120000)
        p.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
        p.wait_for_function('()=>HEWRSApp.ownerFeedback.status().ready && !HEWRSApp.feedbackReadError && !document.getElementById("generate-options").disabled')

    def context_page(label):
        nonlocal page
        context = browser.new_context(viewport=dict(width=390, height=844),
                                      timezone_id='America/New_York', accept_downloads=True)
        def route(route):
            address = urllib.parse.urlsplit(route.request.url)
            if (address.scheme, address.netloc) == origin:
                route.continue_()
            else:
                external.append(route.request.url)
                route.abort()
        context.route('**/*', route)
        page = context.new_page()
        page.set_default_timeout(90000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        created_page = page
        page_phases[created_page] = dict(case=label, phase='initial_navigation', phase_started_at=now())
        in_flight = {}

        def request_started(request):
            in_flight[request] = dict(request_started_at=now(),
                                      request_start_phase=page_phases[created_page]['phase'])

        def request_failed(request):
            failed.append(dict(url=request.url, error=request.failure,
                               resource_type=request.resource_type, failed_at=now(),
                               **page_phases[created_page], **in_flight.pop(request, {})))

        def response_received(response):
            if response.status >= 400 and urllib.parse.urlsplit(response.url).path != '/favicon.ico':
                http_errors.append(dict(url=response.url, status=response.status,
                                        observed_at=now(), **page_phases[created_page]))

        page.on('request', request_started)
        page.on('requestfinished', lambda request: in_flight.pop(request, None))
        page.on('requestfailed', request_failed)
        page.on('response', response_received)
        page.on('framenavigated', lambda frame: navigation_events.append(
            dict(event='main_frame_navigation', url=frame.url, observed_at=now(), **page_phases[created_page]))
            if frame == created_page.main_frame else None)
        page.on('close', lambda: navigation_events.append(
            dict(event='page_closed', observed_at=now(), **page_phases[created_page])))
        response = page.goto(base, wait_until='domcontentloaded', timeout=120000)
        check(label + ': HTML loads', response is not None and response.status == 200)
        ready(page)
        check(label + ': isolated rejection history starts empty', page.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active.length===0'))
        phase(page, 'application_ready')
        return context, page, hashlib.sha256(response.body()).hexdigest()

    def protected(p):
        return p.evaluate('()=>({wear:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.snapshot(),preferences:HEWRSApp.ui.snapshot()})')

    def rows(p):
        return p.evaluate('()=>HEWRSApp.state().report.options.map(o=>({selection:o._hewrsConnected.canonical_selection,value:HEWRSOutfitFeedback.stable(o)}))')

    def event_records(p):
        # IDB getAll uses key order after reopening; an in-memory write cache
        # can retain insertion order. Compare every original record by ID,
        # independently of this nonsemantic traversal order.
        return sorted(p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().events'), key=lambda event: event['id'])

    def generate(p, label, initial=False):
        card_images_ready(p, label + ': new generation')
        phase(p, 'generation_setup: ' + label)
        p.locator('[data-page="home"]').first.click()
        if initial:
            p.click('#pref-topwear')
            p.locator('#picker-list [data-item-id="S05"]').click()
            p.click('#picker-apply')
        phase(p, 'generate_click: ' + label)
        p.click('#generate-options')
        p.wait_for_function('''()=>{const s=HEWRSApp.state();return !s.busy&&s.page==='outfits'
          && Array.isArray(s.report?.options)&&s.optionCount>0&&document.getElementById('avatar').dataset.status==='ready';}''', timeout=360000)
        r = rows(p)
        check(label + ': generated options are valid and obey the S05 anchor', p.evaluate('''()=>{const a=HEWRSApp,s=a.state();
          return a.connection.controller.verifyOptionSet(s.report.options,s.request)
          && s.report.options.every(o=>o._hewrsConnected.canonical_selection.suitId==='S05'
             && a.ownerFeedback.allowed(o._hewrsConnected.canonical_selection,s.request.context));}'''))
        check(label + ': eligible S05 fixture supplies 20 options', len(r) == 20)
        card_images_ready(p, label + ': generation complete')
        return r

    def tied(p):
        for index in range(20):
            card_images_ready(p, 'tied selection ' + str(index))
            selected = p.evaluate('()=>HEWRSApp.state().selection')
            if selected['state'].startswith('T'):
                return selected
            previous = p.evaluate('()=>HEWRSApp.state().optionIndex')
            phase(p, 'next_option_click')
            p.click('#next-option')
            p.wait_for_function('i=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex!==i', arg=previous)
        raise AssertionError('No tied option in native fixture')

    def open_reject(p):
        phase(p, 'open_rejection_dialog')
        p.click('#reject-outfit')
        p.wait_for_selector('#rejection-scope', state='visible')

    def commit(p, permanent=True):
        action = 'permanent rejection' if permanent else 'temporary rejection'
        card_images_ready(p, 'before ' + action)
        phase(p, action + '_click')
        p.click('#rejection-permanent' if permanent else '#rejection-once')
        p.wait_for_function('''()=>{const d=document.getElementById('outfit-rejection-dialog');
          return !d.open&&!HEWRSApp.state().busy&&!document.getElementById('undo-outfit-rejection').disabled;}''', timeout=360000)
        card_images_ready(p, 'after ' + action)

    def probe(p, selected, scope, identifier, occasion='all'):
        variants = [dict(selected), {**selected, 'watchId': None},
                    {**selected, 'shoeId': 'shoe-11' if selected['shoeId'] != 'shoe-11' else 'shoe-12'},
                    {**selected, 'shirtId': 'DS001' if selected['shirtId'] != 'DS001' else 'DS002'},
                    {**selected, 'state': 'T017' if selected['state'] != 'T017' else 'T019'},
                    {**selected, 'state': 'NO_TIE'}]
        other_suit = {key: value for key, value in selected.items() if key not in ('suitId', 'blazerId', 'shirtOnly', 'pantId')}
        other_suit['suitId'] = 'S04' if selected.get('suitId') != 'S04' else 'S05'
        variants.append(other_suit)
        no_jacket = {key: value for key, value in selected.items() if key not in ('suitId', 'blazerId')}
        no_jacket.update(shirtOnly=True, pantId='PG002')
        variants.append(no_jacket)
        requests = [dict(selection=s, occasion=o) for s in variants for o in ('work', 'clinic', 'dinner', 'weekend')]
        actual = p.evaluate('''([requests,id])=>requests.map(q=>HEWRSApp.ownerFeedback.match(q.selection,
          {occasion:q.occasion,requiredFormality:'any'}).reasons.some(r=>r.id===id))''', [requests, identifier])
        expected = [matches(q['selection'], selected, scope) and
                    (occasion == 'all' or ('work' if q['occasion'] == 'clinic' else q['occasion']) == occasion)
                    for q in requests]
        check(scope + ': independent garment/occasion boundary matrix matches', actual == expected)

    def validate_refill(p, before, selected, scope, label, changed=()):
        current = rows(p)
        kept = [row for row in before if not matches(row['selection'], selected, scope)]
        check(label + ': unaffected records and order preserved', current[:len(kept)] == kept)
        check(label + ': no rejected combination returns', all(not matches(r['selection'], selected, scope) for r in current))
        check(label + ': valid option set after refill', p.evaluate('()=>{const a=HEWRSApp,s=a.state();return a.connection.controller.verifyOptionSet(s.report.options,s.request);}'))
        displayed = p.evaluate('()=>HEWRSApp.state().selection')
        if changed:
            check(label + ': displayed replacement preserves every accepted piece',
                  all(displayed.get(k) == selected.get(k) for k in PARTS if k not in changed))
            check(label + ': each rejected component changes', all(displayed.get(k) != selected.get(k) for k in changed))
            if 'state' in changed:
                check(label + ': tie replacement is a genuine different tie', displayed['state'].startswith('T'))
        check(label + ': fixture refills to 20 without recycling rejected options', len(current) == 20)
        return displayed, len(kept)

    def reason_cases():
        for reason, expected_scope, changed in REASONS:
            if args.baseline and reason not in ('shirt_suit', 'shirt_appearance', 'shirt_tie_suit', 'footwear'):
                continue
            context, p, html = context_page(reason)
            before = generate(p, reason, initial=True)
            selected = tied(p)
            unchanged = protected(p)
            open_reject(p)
            if reason != 'entire':
                p.check('#rejection-issue-' + reason)
            if reason == 'other':
                p.fill('#rejection-note', 'Synthetic audit: the selected combination is unsuitable.')
            actual_scope = p.input_value('#rejection-scope')
            scope = ('outfit' if reason == 'footwear' else 'clothing') if args.baseline else expected_scope
            check(reason + ': checkbox selects the documented scope', actual_scope == scope)
            case = dict(reason=reason, selected=selected, expected_scope=expected_scope,
                        stored_scope=actual_scope, html_sha256=html)
            cases.append(case)
            p.locator('#outfit-rejection-dialog').screenshot(path=str(evidence / (reason + '-dialog.png')))
            commit(p)
            event = p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active[0]')
            case['event'] = event
            check(reason + ': committed event retains the selected scope and occasion', event['scope'] == scope and event['occasion'] == 'all')
            displayed, retained = validate_refill(p, before, selected, scope, reason, () if args.baseline else changed)
            case.update(displayed_replacement=displayed, retained=retained, count=len(rows(p)))
            probe(p, selected, scope, event['id'])
            if args.baseline:
                case['accepted_pieces_changed'] = [k for k in PARTS if k not in changed and displayed.get(k) != selected.get(k)]
                case['diagnosis_retains_wrong_scope'] = actual_scope != expected_scope
                if reason in ('shirt_suit', 'shirt_appearance'):
                    alternate = {**selected, 'state': 'T017' if selected['state'] != 'T017' else 'T019'}
                    escaped = p.evaluate('([s,id])=>!HEWRSApp.ownerFeedback.match(s,{occasion:"work"}).reasons.some(r=>r.id===id)', [alternate, event['id']])
                    check(reason + ': baseline proves rejected shirt target remains eligible after changing tie', escaped)
                print('BASELINE OBSERVATION: ' + json.dumps(case), flush=True)
            else:
                p.screenshot(path=str(evidence / (reason + '-immediate.png')), full_page=True)
                reload_page(p)
                ready(p)
                check(reason + ': exact saved event survives reload', p.evaluate('id=>HEWRSApp.ownerFeedback.snapshot().events.find(e=>e.id===id)', event['id']) == event)
                after_reload = generate(p, reason + ' after reload')
                check(reason + ': new generation still enforces the rejection', all(not matches(r['selection'], selected, scope) for r in after_reload))
                p.click('#manage-outfit-rejections')
                p.wait_for_selector('#undo-' + event['id'], state='visible')
                check(reason + ': manager exposes saved scope', p.locator('[data-event-id="' + event['id'] + '"]').get_attribute('data-scope') == scope)
                card_images_ready(p, 'before manager Undo')
                phase(p, 'manager_undo_click')
                p.click('#undo-' + event['id'])
                p.wait_for_function('id=>!HEWRSApp.ownerFeedback.snapshot().active.some(e=>e.id===id)', arg=event['id'])
                p.wait_for_function('()=>!document.getElementById("rejections-close").disabled')
                check(reason + ': manager Undo removes precisely the rejection', p.evaluate('([s,id])=>!HEWRSApp.ownerFeedback.match(s,{occasion:"work"}).reasons.some(r=>r.id===id)', [selected, event['id']]))
                p.click('#rejections-close')
            check(reason + ': wear, Favorites and Home preferences unchanged', protected(p) == unchanged)
            close_context(context, p)

    def reason_edges():
        context, p, _ = context_page('reason combinations')
        generate(p, 'reason combinations', initial=True)
        original = protected(p)
        selected = tied(p)
        open_reject(p)
        p.check('#rejection-issue-tie_shirt')
        p.check('#rejection-issue-colors')
        p.check('#rejection-issue-patterns')
        check('Color and pattern qualifiers retain the specific shirt–tie target', p.input_value('#rejection-scope') == 'shirt_tie')
        p.check('#rejection-issue-tie_suit')
        check('Different specific targets require an explicit scope', p.input_value('#rejection-scope') == ''
              and p.locator('#rejection-scope-validation').is_visible()
              and p.locator('#rejection-once').is_disabled() and p.locator('#rejection-permanent').is_disabled())
        check('An unresolved diagnosis saves no rejection', p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active.length===0'))
        p.uncheck('#rejection-issue-tie_suit')
        check('Removing the conflict restores the specific inference', p.input_value('#rejection-scope') == 'shirt_tie')
        p.check('#rejection-issue-footwear')
        check('Shoe and tie targets cannot silently override one another', p.input_value('#rejection-scope') == '' and p.locator('#rejection-permanent').is_disabled())
        p.select_option('#rejection-scope', 'shirt_tie')
        p.check('#rejection-issue-shirt_suit')
        check('Explicit manual scope resolves ambiguity and stays authoritative', p.input_value('#rejection-scope') == 'shirt_tie' and not p.locator('#rejection-permanent').is_disabled())
        commit(p)
        event = p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active[0]')
        check('Resolved multi-reason action saves exactly the reviewed scope', event['scope'] == 'shirt_tie' and event['reason'] == 'other')
        probe(p, selected, 'shirt_tie', event['id'])
        check('Resolved multi-reason action preserves personal stores/preferences', protected(p) == original)
        close_context(context, p)

        configurations = (
            ('suit without tie', dict(suitId='S05', shirtId='DS029', state='NO_TIE', shoeId='shoe-1', watchId=None),
             ('shirt_tie_suit', 'tie_shirt', 'tie_suit'), ('shirt_tie', 'topwear_tie', 'tie', 'topwear_shirt_tie')),
            ('shirt only with tie', dict(shirtOnly=True, pantId='PG002', shirtId='DS023', state='T017', shoeId='shoe-8', watchId=None),
             ('shirt_tie_suit', 'shirt_suit', 'tie_suit'), ('topwear_shirt', 'topwear_tie', 'topwear_shirt_tie')),
            ('shirt only without tie', dict(shirtOnly=True, pantId='PG002', shirtId='DS023', state='NO_TIE', shoeId='shoe-8', watchId=None),
             ('shirt_tie_suit', 'tie_shirt', 'shirt_suit', 'tie_suit'), ('shirt_tie', 'topwear_tie', 'tie', 'topwear_shirt', 'topwear_shirt_tie')),
        )
        for label, selection, absent_reasons, absent_scopes in configurations:
            context, p, _ = context_page(label)
            # Existing native manual-render entry point; no fabricated engine row.
            p.evaluate('async s=>{await HEWRSApp.apply(s,{origin:"manual",save:false});HEWRSApp.showPage("outfits");}', selection)
            p.wait_for_function('()=>!document.getElementById("reject-outfit").disabled')
            open_reject(p)
            check(label + ': impossible diagnoses are not offered', all(p.locator('#rejection-issue-' + reason).count() == 0 for reason in absent_reasons))
            scope_values = p.locator('#rejection-scope option').evaluate_all('(nodes)=>nodes.map(n=>n.value)')
            check(label + ': inapplicable scope choices are absent', not set(absent_scopes).intersection(scope_values))
            check(label + ': actual shirt remains independently rejectable', 'shirt' in scope_values)
            p.click('#rejection-cancel')
            check(label + ': Cancel leaves all rejection history empty', p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().events.length===0&&HEWRSApp.ownerFeedback.snapshot().temporary.length===0'))
            close_context(context, p)

        context, p, _ = context_page('blazer triple')
        selected = dict(blazerId='B03', pantId='PG002', shirtId='DS023', state='T017', shoeId='shoe-8', watchId=None)
        p.evaluate('async s=>{await HEWRSApp.apply(s,{origin:"manual",save:false});HEWRSApp.showPage("outfits");}', selected)
        p.wait_for_function('()=>!document.getElementById("reject-outfit").disabled')
        open_reject(p)
        p.check('#rejection-issue-shirt_tie_suit')
        check('Blazer shirt-and-tie reason selects the exact three-piece scope', p.input_value('#rejection-scope') == 'topwear_shirt_tie')
        commit(p)
        event = p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active[0]')
        alternate = {**selected, 'pantId': 'PG003'}
        check('Changing trousers cannot evade the rejected blazer/shirt/tie combination', p.evaluate('([s,id])=>HEWRSApp.ownerFeedback.match(s,{occasion:"work"}).reasons.some(r=>r.id===id)', [alternate, event['id']]))
        probe(p, selected, 'topwear_shirt_tie', event['id'])
        close_context(context, p)

    def lifecycle_cases():
        nonlocal page
        for scope in SCOPES:
            context, p, html = context_page(scope)
            generate(p, scope, initial=True)
            selected = tied(p)
            unchanged = protected(p)
            open_reject(p)
            p.select_option('#rejection-scope', scope)
            p.check('#rejection-issue-colors')
            p.check('#rejection-issue-patterns')
            p.select_option('#rejection-occasion', 'current')
            check(scope + ': manual scope survives reason/occasion changes', p.input_value('#rejection-scope') == scope)
            commit(p)
            event = p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active[0]')
            check(scope + ': current-occasion rejection saves Work only', event['scope'] == scope and event['occasion'] == 'work')
            probe(p, selected, scope, event['id'], 'work')
            case = dict(scope=scope, html_sha256=html, permanent_event=event)
            cases.append(case)
            p.click('#manage-outfit-rejections')
            p.click('#export-rejections')
            with p.expect_download() as download:
                p.click('#save-rejection-backup')
            backup_path = evidence / (scope + '-backup.json')
            download.value.save_as(str(backup_path))
            backup = json.loads(backup_path.read_text())
            exported = backup['outfit_feedback']['events'] + backup['tie_feedback']['events']
            check(scope + ': UI backup retains exact immutable record', event in exported)
            p.click('#rejections-close')
            card_images_ready(p, 'before Undo last')
            phase(p, 'undo_last_click')
            p.click('#undo-outfit-rejection')
            p.wait_for_function('()=>HEWRSApp.ownerFeedback.snapshot().active.length===0&&!document.getElementById("generate-options").disabled')
            card_images_ready(p, 'after Undo last')
            check(scope + ': Undo last removes the saved veto', p.evaluate('([s,id])=>!HEWRSApp.ownerFeedback.match(s,{occasion:"work"}).reasons.some(r=>r.id===id)', [selected, event['id']]))
            # Import into a distinct, initially empty synthetic browser profile.
            imported_context, imported, _ = context_page(scope + ' import')
            imported.click('#home-outfit-rejections')
            imported.set_input_files('#rejection-import-file', str(backup_path))
            imported.click('#import-rejections')
            imported.wait_for_function('()=>HEWRSApp.ownerFeedback.snapshot().active.length===1&&!document.getElementById("rejections-close").disabled')
            check(scope + ': UI import restores the exact scope and event bytes', imported.evaluate('id=>HEWRSApp.ownerFeedback.snapshot().active.find(e=>e.id===id)', event['id']) == event)
            probe(imported, selected, scope, event['id'], 'work')
            close_context(imported_context, imported)
            page = p
            # A temporary skip must never enter a durable backup.
            before_events = event_records(p)
            temporary_selected = tied(p)
            open_reject(p)
            p.select_option('#rejection-scope', scope)
            p.select_option('#rejection-occasion', 'all')
            commit(p, permanent=False)
            skipped = p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().temporary[0]')
            check(scope + ': Reject once stores only a temporary rule', skipped['scope'] == scope and event_records(p) == before_events)
            probe(p, temporary_selected, scope, skipped['id'])
            exported = p.evaluate('async()=>await HEWRSApp.ownerFeedback.exportData()')
            check(scope + ': temporary rules never appear in backups', skipped['id'] not in json.dumps(exported))
            generate(p, scope + ' after temporary skip')
            check(scope + ': explicit new Generate expires the skip', p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().temporary.length===0'))
            again = tied(p)
            open_reject(p)
            p.select_option('#rejection-scope', scope)
            commit(p, permanent=False)
            reload_page(p)
            ready(p)
            check(scope + ': reload expires temporary rules without deleting permanent history', p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().temporary.length===0&&HEWRSApp.ownerFeedback.snapshot().active.length===0') and event_records(p) == before_events)
            check(scope + ': wear, Favorites and Home preferences unchanged', protected(p) == unchanged)
            close_context(context, p)

    def reviewed_cases():
        for scope, occasion in (('outfit', 'all'), ('clothing', 'current')):
            label = 'reviewed ' + scope
            context, p, _ = context_page(label)
            unchanged = protected(p)
            # Initialize the real panel without its optional unreviewed search.
            p.evaluate('async()=>{await HEWRSReviewedIntegration.load({initialUpdate:false});document.getElementById("rd-view").value="qualified";}')
            p.click('#open-reviewed-dna')
            p.wait_for_function('''()=>HEWRSImageAssessmentUI.state().ready
              && HEWRSReviewedIntegration.state().ready&&!HEWRSReviewedIntegration.state().busy
              && !HEWRSReviewedIntegration.state().error&&document.getElementById('rd-dialog').open
              && document.getElementById('rd-view').value==='qualified'
              && document.querySelectorAll('#rd-results .rd-result').length>0''', timeout=180000)
            p.locator('#rd-results .rd-result').first.click()
            p.wait_for_selector('#rd-preview', state='visible')
            p.wait_for_function('()=>!document.getElementById("rd-hide").disabled')
            selected = p.evaluate('()=>HEWRSOutfitFeedback.normal({...HEWRSReviewedIntegration.currentEntry().outfit,watch:HEWRSReviewedIntegration.watch()})')
            p.get_by_text('Hide scope and optional reason', exact=True).click()
            p.select_option('#rd-hide-scope', scope)
            p.select_option('#rd-hide-occasion', occasion)
            p.select_option('#rd-hide-reason', 'footwear')
            p.click('#rd-hide')
            p.wait_for_function('()=>HEWRSApp.ownerFeedback.snapshot().active.length===1&&!document.getElementById("rd-undo").disabled', timeout=180000)
            event = p.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active[0]')
            check(label + ': actual hide saves selected scope and occasion', event['scope'] == scope and event['occasion'] == ('all' if occasion == 'all' else 'work'))
            probe(p, selected, scope, event['id'], event['occasion'])
            blocked = p.evaluate('''async s=>{try{await HEWRSApp.apply(s,{origin:'manual',save:false,context:{occasion:'work',style:'AUTO',formality:'any'}});return false;}catch(e){return /reject|hidden|veto/i.test(e.message);}}''', selected)
            check(label + ': main native renderer also refuses the reviewed-panel rejection', blocked)
            p.click('#rd-undo')
            p.wait_for_function('()=>HEWRSApp.ownerFeedback.snapshot().active.length===0&&document.getElementById("rd-undo").disabled')
            check(label + ': reviewed Undo removes its veto from the shared store', p.evaluate('([s,id])=>!HEWRSApp.ownerFeedback.match(s,{occasion:"work"}).reasons.some(r=>r.id===id)', [selected, event['id']]))
            check(label + ': wearer history, Favorites and Home preferences unchanged', protected(p) == unchanged)
            p.click('#rd-close')
            close_context(context, p)

    try:
        with sync_playwright() as playwright:
            browser = getattr(playwright, args.browser).launch(headless=True)
            result['browser_version'] = browser.version
            (reason_cases if args.section == 'reasons' else lifecycle_cases)()
            if args.section == 'reasons' and not args.baseline:
                reason_edges()
            elif args.section == 'lifecycle':
                reviewed_cases()
            check('No external/provider request occurred', not external)
            check('No browser exception occurred', not errors)
            check('All application requests completed successfully', not failed and not http_errors)
            result['status'] = 'passed'
            browser.close()
    except Exception as error:
        result['status'] = 'failed'
        result['error'] = str(error)
        if page and not page.is_closed():
            try:
                page.screenshot(path=str(evidence / 'failure.png'), full_page=True)
            except Exception:
                pass
        raise
    finally:
        result.update(finished_at=datetime.now(timezone.utc).isoformat(),
                      passed=sum(c['passed'] for c in checks), failed=sum(not c['passed'] for c in checks),
                      card_image_readiness_passed=sum(c['status'] == 'passed' for c in image_checks),
                      card_image_readiness_failed=sum(c['status'] != 'passed' for c in image_checks))
        (evidence / 'RESULT.json').write_text(json.dumps(result, indent=2) + '\n')
        if server:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    main()
