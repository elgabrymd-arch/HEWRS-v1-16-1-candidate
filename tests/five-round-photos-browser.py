#!/usr/bin/env python3
"""Exercise the shipped app's full shirt roster, collar states and photo controls.

Fresh profiles only. Optional baseline rendering compares decoded native pixels,
not screenshots or compressed thumbnails. No owner storage or private PDF is read.
"""
import argparse
import base64
import functools
import hashlib
import io
import json
import threading
import traceback
import urllib.parse
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MODES = ('suit', 'blazer', 'shirt-only')


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def serve(root):
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, 'http://127.0.0.1:%d/' % server.server_address[1]


def outfit(mode, shirt, state='NO_TIE', top=None, pants='PG002'):
    result = dict(shirtId=shirt, state=state, shoeId='shoe-8', watchId=None)
    if mode == 'suit':
        result['suitId'] = top or 'S05'
    else:
        result['pantId'] = pants
        if mode == 'blazer':
            result['blazerId'] = top or 'B03'
        else:
            result['shirtOnly'] = True
    return result


FRAME = r'''async selection => {
 const app=HEWRSApp;
 const result=await app.apply(selection,{origin:'manual',save:false,keepPreferences:true});
 if(result?.cancelled)throw Error('Unexpected audit render cancellation');
 const canvas=document.getElementById('avatar'),cx=canvas.getContext('2d',{willReadFrequently:true});
 const rgba=cx.getImageData(0,0,canvas.width,canvas.height).data;
 const digest=await crypto.subtle.digest('SHA-256',rgba);
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const detail=document.createElement('canvas');detail.width=262;detail.height=306;
 detail.getContext('2d').drawImage(canvas,170,390,656,766,0,0,262,306);
 const model=app.cardSnapshot();
 const thumbnails=Array.from(document.querySelectorAll('#option-card-items img'));
 await Promise.all(thumbnails.map(image=>image.decode()));
 if(thumbnails.some(image=>image.hidden||!image.naturalWidth||!image.naturalHeight))throw Error('An actual card photograph did not decode');
 return {selection:app.state().selection,last:app.renderer.last(),status:canvas.dataset.status,
  width:canvas.width,height:canvas.height,rgba_sha256:hash,detail:detail.toDataURL('image/png'),
  shirt:model.items.find(x=>x.role==='Shirt'),tie:model.items.find(x=>x.role==='Tie')};
}'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', choices=('chromium', 'webkit'), default='chromium')
    parser.add_argument('--baseline-root', type=Path)
    parser.add_argument('--url')
    args = parser.parse_args()
    catalogue = json.loads((ROOT / 'evidence/five_round_20261119/CATALOGUE.json').read_text())
    shirts = sorted(catalogue['shirts'], key=lambda row: row['id'])
    server = baseline_server = None
    if args.url:
        base = args.url
    else:
        server, base = serve(ROOT)
    baseline_base = None
    if args.baseline_root:
        baseline_server, baseline_base = serve(args.baseline_root)
    output = ROOT / 'evidence/five_round_20261119/browser' / args.browser / ('live-photos' if args.url else 'photos')
    output.mkdir(parents=True, exist_ok=True)
    checks, frames, errors, failed_requests, http_errors, external_requests = [], [], [], [], [], []
    result = dict(schema='hewrs.five-round-shirt-browser.v1', browser=args.browser, url=base,
                  baseline_compared=bool(baseline_base), owner_data_accessed=False,
                  started_at=datetime.now(timezone.utc).isoformat(), checks=checks, frames=frames,
                  page_errors=errors, failed_requests=failed_requests, http_errors=http_errors,
                  external_requests=external_requests)
    pictures = {}

    def save():
        result['passed'] = sum(row['passed'] for row in checks)
        result['failed'] = sum(not row['passed'] for row in checks)
        (output / 'RESULT.json').write_text(json.dumps(result, indent=2) + '\n')

    def check(name, condition, detail=None):
        checks.append(dict(name=name, passed=bool(condition), detail=detail))
        print(('PASS: ' if condition else 'FAIL: ') + name, flush=True)
        if not condition:
            save()
            raise AssertionError(name + ': ' + str(detail))

    def new_page(browser, url, label):
        context = browser.new_context(viewport=dict(width=390, height=844), timezone_id='America/New_York')
        expected_origin = urllib.parse.urlsplit(url)[:2]

        def route(request):
            if urllib.parse.urlsplit(request.request.url)[:2] == expected_origin:
                request.continue_()
            else:
                external_requests.append(dict(surface=label, url=request.request.url))
                request.abort()

        context.route('**/*', route)
        page = context.new_page()
        page.set_default_timeout(90000)
        page.on('pageerror', lambda error: errors.append(dict(surface=label, error=str(error))))
        page.on('requestfailed', lambda request: failed_requests.append(dict(surface=label, url=request.url, error=request.failure)))
        page.on('response', lambda response: http_errors.append(dict(surface=label, url=response.url, status=response.status))
                if response.status >= 400 and not response.url.endswith('/favicon.ico') else None)
        response = page.goto(url, wait_until='domcontentloaded', timeout=120000)
        check(label + ': exact HTML loads', response is not None and response.status == 200)
        page.wait_for_function('()=>globalThis.HEWRS_READY && HEWRSApp.rejection', timeout=120000)
        page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
        check(label + ': fresh rejection profile is ready', page.evaluate('()=>HEWRSApp.ownerFeedback.status().ready && !HEWRSApp.feedbackReadError && HEWRSApp.ownerFeedback.snapshot().active.length===0'))
        return context, page

    def protected(page):
        return page.evaluate('()=>({wear:HEWRSApp.store.snapshot(),favorites:HEWRSApp.favorites.snapshot(),rejections:HEWRSApp.ownerFeedback.snapshot().events})')

    def render(page, selection, label, baseline_page=None, capture_key=None):
        frame = page.evaluate(FRAME, selection)
        image = frame.pop('detail')
        check(label + ': exact selection and committed renderer agree', frame['selection'] == selection and frame['last'] == selection, frame['selection'])
        check(label + ': complete native frame is ready', frame['status'] == 'ready' and (frame['width'], frame['height']) == (996, 2748))
        if baseline_page is not None:
            baseline = baseline_page.evaluate(FRAME, selection)
            frame['baseline_rgba_sha256'] = baseline['rgba_sha256']
            check(label + ': approved native pixels equal the published baseline', baseline['rgba_sha256'] == frame['rgba_sha256'])
        if capture_key:
            pictures[capture_key] = Image.open(io.BytesIO(base64.b64decode(image.split(',', 1)[1]))).convert('RGBA')
        frames.append(dict(label=label, **frame))
        return frame

    browser = page = baseline_context = None
    try:
        with sync_playwright() as pw:
            browser = getattr(pw, args.browser).launch(headless=True)
            context, page = new_page(browser, base, 'current')
            baseline_page = None
            if baseline_base:
                baseline_context, baseline_page = new_page(browser, baseline_base, 'baseline')
            before = protected(page)
            live_roster = page.evaluate('()=>({shirts:HEWRSApp.connection.manifest.shirt_order,suits:HEWRSApp.connection.suitSources.ids,blazers:HEWRSApp.connection.blazerConnection.availableIds})')
            check('Current browser contains the exact active 50 shirt identities', sorted(live_roster['shirts']) == [row['id'] for row in shirts])
            check('DS049 remains retired', 'DS049' not in live_roster['shirts'])
            for shirt in shirts:
                states = ['NO_TIE'] + (['T029'] if shirt['thumbnails'].get('tied') else [])
                for mode in MODES:
                    for state in states:
                        label = '/'.join((shirt['id'], mode, state))
                        selected = outfit(mode, shirt['id'], state)
                        frame = render(page, selected, label, baseline_page, (shirt['id'], mode, state))
                        kind = 'no_tie' if state == 'NO_TIE' else 'tied'
                        expected = (shirt.get('nonSuitThumbnails') or {}).get(kind) if mode != 'suit' else None
                        expected = expected or shirt['thumbnails'][kind]
                        actual = frame['shirt']
                        check(label + ': exact same-ID contextual card photograph', actual['id'] == shirt['id'] and actual['image']['sha256'] == expected['sha256'] and actual['image']['source_key'] == expected['source_key'])
                        check(label + ': tie state is explicit', frame['tie']['id'] == (None if state == 'NO_TIE' else state))
                save()
            check('All 288 supported shirt/context/collar frames were exercised', len(frames) == 288)
            for shirt in shirts:
                if shirt['thumbnails'].get('tied'):
                    for mode in MODES:
                        a = next(row['rgba_sha256'] for row in frames if row['label'] == '/'.join((shirt['id'], mode, 'NO_TIE')))
                        b = next(row['rgba_sha256'] for row in frames if row['label'] == '/'.join((shirt['id'], mode, 'T029')))
                        check(shirt['id'] + '/' + mode + ': actual tied frame differs from No Tie', a != b)
                else:
                    for mode in MODES:
                        selected = outfit(mode, shirt['id'], 'T029')
                        blocked = page.evaluate('''async s=>{const before=HEWRSApp.state().selection;try{await HEWRSApp.apply(s,{save:false});return {blocked:false};}catch(e){return {blocked:true,message:e.message,unchanged:JSON.stringify(before)===JSON.stringify(HEWRSApp.state().selection)};}}''', selected)
                        check(shirt['id'] + '/' + mode + ': incompatible tie cannot render or change identity', blocked.get('blocked') and blocked.get('unchanged'), blocked)
            for top in live_roster['suits']:
                render(page, outfit('suit', 'DS029', 'T029', top=top), 'topwear/' + top, baseline_page)
            for top in live_roster['blazers']:
                render(page, outfit('blazer', 'DS026', 'T029', top=top), 'topwear/' + top, baseline_page)
            wider = page.evaluate('HEWRSApp.connection.assemblies.widerDS035SuitIds')
            check('Wider DS035 source coverage includes all 14 registered suits', len(wider) == 14)
            for top in wider:
                for state in ('NO_TIE', 'T029'):
                    render(page, outfit('suit', 'DS035', state, top=top), 'DS035-wide/' + top + '/' + state, baseline_page)
            # Every actual tie must resolve and render; no alias or No Tie fallback.
            for tie in catalogue['roster']['ties']:
                frame = render(page, outfit('suit', 'DS029', tie), 'tie/' + tie)
                check(tie + ': exact tie ID remains in the card', frame['tie']['id'] == tie)
            # Exercise the actual photo-picker controls, including all contextual overrides.
            for mode in MODES:
                page.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.setMode("anchor");HEWRSApp.showPage("home");}', outfit(mode, 'DS026'))
                page.locator('#pref-shirt').click()
                page.wait_for_selector('#picker-list [data-item-id="DS001"] img')
                actual = page.locator('#picker-list [data-item-id]').evaluate_all('''async nodes=>{await Promise.all(nodes.map(n=>n.querySelector('img').decode()));return nodes.map(n=>{const image=n.querySelector('img');return {id:n.dataset.itemId,src:image.getAttribute('src'),key:image.dataset.sourceKey,label:n.querySelector('.fx-choice-name')?.textContent,disabled:n.disabled,decoded:!!image.naturalWidth&&!!image.naturalHeight&&!image.hidden&&getComputedStyle(image).display!=='none'};});}''')
                check(mode + ': photo picker has all 50 current shirts', len(actual) == 50)
                by_id = {row['id']: row for row in actual}
                for shirt in shirts:
                    expected = (shirt.get('nonSuitThumbnails') or {}).get('no_tie') if mode != 'suit' else None
                    expected = expected or shirt['thumbnails']['no_tie']
                    row = by_id[shirt['id']]
                    check(mode + '/' + shirt['id'] + ': picker photograph uses correct contextual source and decodes visibly', row['src'] == expected['src'] and not row['disabled'] and row['decoded'], row)
                check(mode + ': repair placeholders do not leak into garment names', all('source-repaired' not in row['label'] for row in actual))
                page.screenshot(path=str(output / ('picker-' + mode + '.png')))
                page.keyboard.press('Escape')
            for shirt in ('DS040', 'DS041', 'DS042', 'DS043'):
                for mode in MODES:
                    page.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.showPage("home");}', outfit(mode, shirt))
                    page.locator('#pref-tie').click()
                    controls = page.locator('#picker-list [data-item-id]').evaluate_all('nodes=>nodes.map(n=>({id:n.dataset.itemId,disabled:n.disabled}))')
                    check(shirt + '/' + mode + ': actual tie controls enforce No Tie only', len(controls) == 48 and all(row['disabled'] == (row['id'] != 'NO_TIE') for row in controls))
                    page.keyboard.press('Escape')
            # Manual rejection leaves the selection retained for Undo. Home must not reveal it.
            selected = outfit('suit', 'DS029', 'T029')
            await_result = page.evaluate('''async s=>{await HEWRSApp.apply(s,{save:false});const event=await HEWRSApp.ownerFeedback.hide(s,{scope:'shirt_tie',context:'work',reason:'tie_shirt'});HEWRSApp.rejectionChanged();return event;}''', selected)
            check('Manual rejection hides the rendered outfit', page.locator('#outfit-output').is_hidden())
            page.evaluate('HEWRSApp.showPage("home")')
            page.locator('#view-current').click()
            page.wait_for_function('()=>HEWRSApp.state().page==="outfits"')
            check('View current cannot resurrect a rejected shirt/tie pairing', page.locator('#outfit-output').is_hidden() and page.locator('#record-wear').is_disabled())
            check('Blocked navigation explains the rejection', 'rejected' in page.locator('#outfit-empty').inner_text().lower())
            page.screenshot(path=str(output / 'rejected-view-current.png'))
            page.evaluate('async id=>{await HEWRSApp.ownerFeedback.undo(id);HEWRSApp.rejectionChanged();}', await_result['id'])
            check('Undo restores the allowed complete frame', page.locator('#outfit-output').is_visible())
            after = protected(page)
            check('Photo and collar audit creates no wear or Favorites writes', before['wear'] == after['wear'] and before['favorites'] == after['favorites'])
            check('Only the explicit synthetic rejection and Undo were recorded', len(after['rejections']) == len(before['rejections']) + 2)
            check('No external service requests were made', not external_requests, external_requests)
            check('No application browser exceptions occurred', not errors, errors)
            check('No missing application or image responses occurred', not http_errors, http_errors)
            # Image requests cancelled by a superseding render are not HTTP failures.
            unexpected = [row for row in failed_requests if 'cancel' not in str(row['error']).lower() and 'abort' not in str(row['error']).lower()]
            check('No non-cancellation network failures occurred', not unexpected, unexpected)
            baseline_context and baseline_context.close()
            context.close()
            browser.close()
            browser = None
    except Exception:
        checks.append(dict(name='Photo audit completion', passed=False, detail=traceback.format_exc()))
        print(traceback.format_exc(), flush=True)
        if page:
            try:
                page.screenshot(path=str(output / 'FAILURE.png'))
            except Exception:
                pass
    finally:
        # Native collar crops are only presentation evidence. They never replace app assets.
        font = ImageFont.truetype('DejaVuSans.ttf', 13)
        headings = [(mode, state) for mode in MODES for state in ('NO_TIE', 'T029')]
        for offset in range(0, len(shirts), 5):
            sheet = Image.new('RGB', (1116, 60 + 240 * min(5, len(shirts) - offset)), '#e8e5df')
            draw = ImageDraw.Draw(sheet)
            for column, (mode, state) in enumerate(headings):
                draw.text((12 + column * 184, 10), mode + ' / ' + state, font=font, fill='#20242a')
            for row, shirt in enumerate(shirts[offset:offset + 5]):
                y = 40 + row * 240
                draw.text((12, y), shirt['id'], font=font, fill='#20242a')
                for column, (mode, state) in enumerate(headings):
                    pic = pictures.get((shirt['id'], mode, state))
                    if pic is None:
                        draw.text((12 + column * 184, y + 100), 'NO TIE ONLY' if not shirt['thumbnails'].get('tied') and state != 'NO_TIE' else 'NOT RENDERED', font=font, fill='#20242a')
                    else:
                        pic = pic.copy()
                        pic.thumbnail((176, 206), Image.Resampling.LANCZOS)
                        sheet.paste(pic, (12 + column * 184, y + 20), pic)
            sheet.save(output / ('native-collars-%02d.png' % (offset // 5 + 1)))
        result['completed_at'] = datetime.now(timezone.utc).isoformat()
        save()
        if server:
            server.shutdown()
        if baseline_server:
            baseline_server.shutdown()
    if any(not row['passed'] for row in checks):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
