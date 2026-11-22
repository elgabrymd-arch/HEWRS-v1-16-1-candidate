#!/usr/bin/env python3
"""Real shipped-app Issue 22 eligibility, full-avatar and preservation gate.

Runs in isolated browser profiles, through the real Home engine and the real
reviewed B01 controls. No owner approval, production request or saved user data
is used. Pixel checks support a separately recorded human visual inspection;
they do not grant visual approval. Shards are one-based and partition every
matrix deterministically. The non-sharded run covers all 84 contexts.
"""
import argparse
import base64
import functools
import hashlib
import importlib.util
import io
import json
import math
import threading
import traceback
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASELINE = 'avatar-v3-issue22-baseline.html'
BASELINE_COMMIT = '95d14073e33f2b699bdb0cdbd42504b1a1be2274'
BASELINE_SHA256 = 'dd7c401d29ab12cf3fb2d9d2938ddd9753291c42982d60f326c3bf367dd9afba'
GARMENTS = ['S06', 'S13', 'S14', 'B01', 'B06', 'B08', 'B10']
LINEN = {'B01', 'B06', 'B10'}
STYLES = ['AUTO', 'CLASSIC', 'HYBRID', 'MODERN']
OCCASIONS = ['work', 'dinner', 'weekend']
AVATAR = {
    'avatar': '4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93',
    'left_hand': '26af452854f6f89c86617d83e9848ae71922d2ff4701877e7903f59c55ebb2b8',
    'right_hand': 'cfca4394b3d208184fef4f267671af834432ac2f6bd89acea83242a9e118863b',
}
DETAILS = {'collar': (248, 300, 748, 800), 'waist': (280, 950, 716, 1320),
           'cuffs': (0, 1120, 996, 1625), 'cloth': (260, 650, 736, 1220)}
spec = importlib.util.spec_from_file_location('issue22_existing_fit', ROOT / 'tests/avatar-v3-fit-browser.py')
FIT = importlib.util.module_from_spec(spec)
spec.loader.exec_module(FIT)

# Reuse the established actual-UI capture route. Add the exact engine context
# without persisting it, and retain B01's dialog until its screenshot is taken.
FRAME = FIT.FRAME.replace('async ({selected,ignoredHashes})', 'async ({selected,ignoredHashes,context})')
FRAME = FRAME.replace("origin:'manual',save:false,keepPreferences:true", "origin:'manual',save:false,keepPreferences:true,context")
FRAME = FRAME.replace('if(reviewed)HEWRSReviewedIntegration.close();', '')
assert 'async ({selected,ignoredHashes,context})' in FRAME
assert "origin:'manual',save:false,keepPreferences:true,context" in FRAME
PROTECTED = r'''() => ({wear:HEWRSApp.store.snapshot(),
 favorites:HEWRSApp.favorites.snapshot(),feedback:HEWRSApp.ownerFeedback.snapshot().events,
 saved_preferences:Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('hewrs:home-preferences:')).sort().map(k=>[k,localStorage.getItem(k)]))})'''
SEED = r'''async () => {
 const app=HEWRSApp,s={suitId:'S05',shirtId:'DS001',state:'NO_TIE',shoeId:'shoe-8',watchId:null};
 const event=app.connection.createHistoryEvent(s,{id:'issue22_preservation_fixture',localDate:'2026-11-21',origin:'manual'});
 await app.store.exclusive(()=>app.store.addEvent(event));
 await app.store.exclusive(()=>app.store.saveSession({selection:s,origin:'manual',mode:'anchor',localDate:'2026-11-21',context:{occasion:'dinner',requiredFormality:'any'}}));
 await app.favorites.exclusive(()=>app.favorites.add(s,{id:'favorite_issue22_preserved',created_at:'2026-11-21T12:00:00.000Z'}));
 return {events:app.store.snapshot().events.length,favorites:app.favorites.snapshot().items.length};
}'''

ELIGIBILITY = r'''async ({id,style,occasion}) => {
 await HEWRSRuntimeLoader.ensureIndex();
 const c=HEWRSApp.connection,selected={shirtId:'DS001',state:'NO_TIE',shoeId:'shoe-8',watchId:null,
   ...(id.startsWith('B')?{blazerId:id,pantId:id==='B01'?'PT006':'PG002'}:{suitId:id})};
 const alias=c.historyIds(selected).topwear;
 const config={automatic:true,stylistMode:'research',preferences:{
   ...Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(k=>[k,{mode:'any'}])),
   topwear:{mode:'item',id:alias},watch:{mode:'none'}},
   localDate:'2026-11-22',occasion,style,formality:'any',environment:{source:'not_assessed',date:'2026-11-22'}};
 const q=c.makeRequest(config),result=c.controller.generate(q,c.catalogue,[]);
 if(!c.controller.verifyOptionSet(result.options,q))throw Error('Actual engine option-set verification failed');
 const rows=result.options.map(option=>{
   const selection=c.selectionFromOption(option,q).selection,owner=HEWRSOutfitFeedback.ownerRuleCheck(selection,{context:q.context});
   if((selection.suitId||selection.blazerId)!==id)throw Error('Engine substituted the locked garment');
   if(!owner.allowed)throw Error('Engine returned an owner-prohibited option');
   if(['B01','B06','B10'].includes(id)&&selection.state!=='NO_TIE')throw Error('Engine returned tied linen');
   return {selection,owner,classification:option._hewrsConnected?.compatibility?.style||null};
 });
 const directOwner=HEWRSOutfitFeedback.ownerRuleCheck(selected,{context:q.context});
 const d=result.diagnostics||{};
 return {id,style,occasion,request:q,status:result.status,returned:rows.length,
   options:rows,first_selection:rows[0]?.selection||null,reason:result.reason||null,no_match:result.no_match||null,
   direct_owner:directOwner,diagnostics:{enumerated:d.enumerated,score_statuses:d.score_statuses,
    rejection_reasons:d.rejection_reasons,feedback_excluded_clothing:d.feedback_excluded_clothing,
    search_completion:d.search_completion},
   b01_restrictions:id==='B01'?{home_has_no_use_case_selector:true,work_prohibited:true,
    required_explicit_use_case:'summer_weekend_dinner',required_pants:'PT006',required_tie:'NO_TIE'}:null};
}'''

RENDER_GUARD = r'''async () => {
 const app=HEWRSApp,c=document.getElementById('avatar'),before=c.toDataURL(),last=JSON.stringify(app.renderer.last());
 const saved=JSON.stringify({wear:app.store.snapshot(),favorites:app.favorites.snapshot(),feedback:app.ownerFeedback.snapshot().events});
 const ties=Object.keys(app.connection.manifest.ties).sort(),records=[];
 for(const id of ['B01','B06','B10'])for(const tie of ties){
  const s={blazerId:id,pantId:id==='B01'?'PT006':'PG002',shirtId:'DS001',state:tie,shoeId:'shoe-8',watchId:null};
  let planError=null,renderError=null;
  try{app.renderer.plan(s);}catch(error){planError=error.code;}
  try{await app.renderer.render(s);}catch(error){renderError=error.code;}
  if(planError!=='HEWRS_LINEN_NO_TIE'||renderError!=='HEWRS_LINEN_NO_TIE')throw Error('Linen render guard failed for '+id+'/'+tie);
  records.push({id,tie,plan_error:planError,render_error:renderError});
 }
 return {cases:records.length,tie_ids:ties,records,
  frame_preserved:before===c.toDataURL(),last_preserved:last===JSON.stringify(app.renderer.last()),
  data_preserved:saved===JSON.stringify({wear:app.store.snapshot(),favorites:app.favorites.snapshot(),feedback:app.ownerFeedback.snapshot().events})};
}'''


def digest(value):
    return hashlib.sha256(value).hexdigest()


def fixtures():
    rows = []
    # A continuous shirt, a legacy batch shirt and a legacy no-tie-only shirt
    # exercise the actual independent shirt/compositor routes on each jacket.
    for garment in GARMENTS:
        for shirt in ['DS001', 'DS013', 'DS040']:
            rows.append({'name': f'{garment}-{shirt}-NO_TIE', 'garment': garment,
                         'purpose': 'corrected-garment-real-app', 'selection': FIT.selection(shirt, 'NO_TIE', garment)})
        if garment not in LINEN:
            for shirt in ['DS001', 'DS013']:
                rows.append({'name': f'{garment}-{shirt}-T001', 'garment': garment,
                             'purpose': 'permitted-tie-real-app', 'selection': FIT.selection(shirt, 'T001', garment)})
    for garment in ['S01', 'S05', 'B02', 'B07', 'B15', 'shirt-only']:
        for shirt, state in [('DS001', 'NO_TIE'), ('DS013', 'T001')]:
            rows.append({'name': f'control-{garment}-{shirt}-{state}', 'garment': garment,
                         'purpose': 'unaffected-full-frame-control', 'selection': FIT.selection(shirt, state, garment)})
    return rows


def context_rows():
    return [dict(id=garment, style=style, occasion=occasion)
            for garment in GARMENTS for style in STYLES for occasion in OCCASIONS]


def part(rows, args):
    return [row for index, row in enumerate(rows) if index % args.shards == args.shard - 1]


def sheets(output, captures):
    review = []
    for kind in ['full', *DETAILS]:
        for start in range(0, len(captures), 12):
            group = captures[start:start + 12]
            width, height = (450, 650) if kind == 'full' else (720, 380)
            sheet = Image.new('RGB', (width * 3, height * math.ceil(len(group) / 3)), '#e9eaec')
            draw = ImageDraw.Draw(sheet)
            for i, row in enumerate(group):
                path = output / ('native' if kind == 'full' else kind) / (row['name'] + '.png')
                picture = Image.open(path).convert('RGBA')
                picture.thumbnail((width - 10, height - 32))
                x, y = i % 3 * width, i // 3 * height
                draw.text((x + 6, y + 6), row['name'], fill='black', font=FIT.font(12))
                sheet.paste(FIT.on_background(picture), (x + (width - picture.width) // 2, y + 28))
            relative = f'sheets/{kind}-{start // 12 + 1:03}.jpg'
            sheet.save(output / relative, quality=92)
            review.append({'path': relative, 'kind': kind, 'cases': [row['name'] for row in group]})
    (output / 'VISUAL_REVIEW_INDEX.json').write_text(json.dumps(review, indent=2) + '\n')


def run(args):
    if args.shards < 1 or not 1 <= args.shard <= args.shards:
        raise ValueError('Shards are one-based; require 1 <= --shard <= --shards')
    rows, contexts = part(fixtures(), args), part(context_rows(), args)
    if args.list:
        print(json.dumps({'total_contexts': 84, 'total_render_fixtures': len(fixtures()),
                          'assigned_contexts': len(contexts), 'assigned_render_fixtures': len(rows),
                          'shard': args.shard, 'shards': args.shards}))
        return
    output = args.output.resolve() / args.browser / f'shard-{args.shard}'
    for folder in ['native', 'baseline', 'phone', 'sheets', *DETAILS]:
        (output / folder).mkdir(parents=True, exist_ok=True)
    checks, captures, eligibility, errors, bad_requests, external = [], [], [], [], [], []
    report = {'schema': 'hewrs.issue22.browser.v1', 'browser': args.browser,
              'baseline_commit': BASELINE_COMMIT, 'baseline_entrypoint': BASELINE,
              'shard': args.shard, 'shards': args.shards, 'shards_are_one_based': True,
              'expected_contexts': len(contexts), 'expected_render_fixtures': len(rows),
              'checks': checks, 'captures': captures, 'eligibility': eligibility,
              'page_errors': errors, 'bad_requests': bad_requests, 'external_requests': external,
              'owner_data_accessed': False, 'source': 'exact_local_shipped_index',
              'visual_acceptance': 'requires_independent_inspection_of_actual_captures',
              'started_at': datetime.now(timezone.utc).isoformat()}

    def check(name, condition, detail=None):
        checks.append({'name': name, 'passed': bool(condition), 'detail': detail})
        if not condition:
            raise AssertionError(name + ': ' + repr(detail))

    def write_report():
        report['checks_passed'] = sum(row['passed'] for row in checks)
        report['checks_failed'] = sum(not row['passed'] for row in checks)
        (output / 'RESULT.json').write_text(json.dumps(report, indent=2) + '\n')

    check('Frozen V3 baseline entrypoint SHA256', digest((ROOT / BASELINE).read_bytes()) == BASELINE_SHA256)
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(FIT.Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = 'http://127.0.0.1:%d/' % server.server_address[1]
    try:
        with sync_playwright() as pw:
            launch = {'headless': True}
            if args.browser == 'chromium':
                launch['args'] = ['--no-sandbox', '--disable-dev-shm-usage']
            if args.executable:
                launch['executable_path'] = args.executable
            browser = getattr(pw, args.browser).launch(**launch)

            def open_page(relative, label):
                context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)

                def route(request):
                    if urlsplit(request.request.url)[:2] == urlsplit(origin)[:2]:
                        request.continue_()
                    else:
                        external.append({'page': label, 'url': request.request.url})
                        request.abort()

                context.route('**/*', route)
                page = context.new_page()
                page.set_default_timeout(120000)
                page.on('pageerror', lambda error: errors.append({'page': label, 'error': str(error)}))
                page.on('requestfailed', lambda request: bad_requests.append({'page': label, 'url': request.url, 'error': request.failure}))
                page.on('response', lambda response: bad_requests.append({'page': label, 'url': response.url, 'status': response.status})
                        if response.status >= 400 and not response.url.endswith('/favicon.ico') else None)
                response = page.goto(origin + relative, wait_until='domcontentloaded', timeout=120000)
                check(label + ': exact entrypoint served', response.status == 200 and digest(response.body()) == digest((ROOT / relative).read_bytes()))
                page.wait_for_function('globalThis.HEWRS_READY && HEWRSApp.rejection', timeout=120000)
                page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
                seeded = page.evaluate(SEED)
                check(label + ': isolated nonempty history and favorites fixtures', seeded == {'events': 1, 'favorites': 1}, seeded)
                return page

            before, after = open_page(BASELINE, 'baseline'), open_page('index.html', 'candidate')
            inventories = [page.evaluate(FIT.INVENTORY) for page in [before, after]]
            check('Wardrobe inventory and historical source lock unchanged', inventories[0] == inventories[1])
            check('50 active shirts, 18 suits and 15 blazers remain', len(inventories[1]['shirts']) == 50
                  and len(inventories[1]['suits']) == 18 and len(inventories[1]['blazers']) == 15)
            for label, page in [('baseline', before), ('candidate', after)]:
                pins = page.evaluate("()=>Object.fromEntries(['avatar','left_hand','right_hand'].map(k=>[k,HEWRSApp.connection.manifest.static[k].sha256]))")
                check(label + ': immutable approved avatar and hand identities', pins == AVATAR, pins)
            modules = after.evaluate("()=>({matching:globalThis.HEWRSIssue22Matching?.revision,materials:globalThis.HEWRSIssue22Materials?.revision,b08:globalThis.HEWRSAvatarV3B08SeamFit?.spec?.revision,guard:HEWRSApp.renderer.stats().issue22_no_tie_revision})")
            check('All Issue 22 runtime modules active in actual shipped index', all(modules.values()) and len(modules) == 4, modules)
            report['runtime_modules'] = modules
            protected = {label: page.evaluate(PROTECTED) for label, page in [('baseline', before), ('candidate', after)]}

            def capture(row, context=None):
                name, selected = row['name'], row['selection']
                frames = []
                for label, page in [('baseline', before), ('candidate', after)]:
                    frame = page.evaluate(FRAME, {'selected': selected, 'ignoredHashes': [], 'context': context})
                    check(name + ': ' + label + ' committed exact selection', frame['selection'] == selected and frame['last'] == selected
                          and frame['status'] == 'ready', {'selection': frame['selection'], 'last': frame['last'], 'status': frame['status']})
                    check(name + ': ' + label + ' full avatar and original source identity', frame['dimensions'] == [996, 2748]
                          and frame['connection_avatar'] == AVATAR['avatar']
                          and frame['plan_avatar'] in (None, AVATAR['avatar'])
                          and any(binding['sha256'] == AVATAR['avatar'] for binding in frame['source_bindings']))
                    check(name + ': ' + label + ' saved state and component photos', frame['state_unchanged'] and frame['photos_decoded'])
                    layout = frame['layout']
                    check(name + ': ' + label + ' complete mobile canvas stays inside viewport',
                          layout['width'] <= layout['viewport'] + 1 and layout['left'] >= -1
                          and layout['right'] <= layout['viewport'] + 1 and layout['height'] > 0, layout)
                    check(name + ': ' + label + ' exact shirt and tie card identities', frame['card_shirt'] == selected['shirtId']
                          and frame['card_tie'] == (None if selected['state'] == 'NO_TIE' else selected['state']))
                    raw = base64.b64decode(frame.pop('png').split(',', 1)[1])
                    image = Image.open(io.BytesIO(raw)).convert('RGBA')
                    check(name + ': ' + label + ' decoded capture equals browser canvas', digest(image.tobytes()) == frame['full_sha256'])
                    folder = 'native' if label == 'candidate' else 'baseline'
                    (output / folder / (name + '.png')).write_bytes(raw)
                    frame['path'] = folder + '/' + name + '.png'
                    frames.append((frame, image))
                    if label == 'candidate':
                        # The reviewed dialog's controls precede its preview;
                        # retain the actual avatar in the mobile screenshot.
                        page.locator('#rd-canvas' if selected.get('blazerId') == 'B01' else '#avatar').scroll_into_view_if_needed()
                        page.screenshot(path=str(output / 'phone' / (name + '.png')), full_page=False)
                    if selected.get('blazerId') == 'B01':
                        page.evaluate('HEWRSReviewedIntegration.close()')
                    check(name + ': ' + label + ' nonempty saved fixtures unchanged', page.evaluate(PROTECTED) == protected[label])
                old, current = frames[0][0], frames[1][0]
                a, b = [np.asarray(item[1]) for item in frames]
                differences = np.any(a != b, axis=2)
                changed = int(differences.sum())
                check(name + ': immutable complete head region', old['head_sha256'] == current['head_sha256'])
                check(name + ': exact full-avatar alpha silhouette', np.array_equal(a[:, :, 3], b[:, :, 3]))
                old_sources = {(x['path'], x['sha256'], tuple(x['rect'] or [])) for x in old['source_bindings']}
                new_sources = {(x['path'], x['sha256'], tuple(x['rect'] or [])) for x in current['source_bindings']}
                check(name + ': original garment geometry bindings preserved', old_sources.issubset(new_sources))
                if row['purpose'] == 'unaffected-full-frame-control':
                    check(name + ': every unrelated full-frame RGBA pixel identical', changed == 0, changed)
                else:
                    check(name + ': requested correction present in actual browser frame', changed > 0, changed)
                    if row['garment'] == 'B08':
                        outside = differences.copy()
                        outside[1107:1144, 403:447] = False
                        outside[1117:1152, 509:568] = False
                        check(name + ': B08 differences confined to two confirmed scars', not bool(outside.any()))
                for kind, rectangle in DETAILS.items():
                    left, right = [item[1].crop(rectangle) for item in frames]
                    pair = Image.new('RGBA', (left.width * 2, left.height), '#e9eaec')
                    pair.alpha_composite(left, (0, 0)); pair.alpha_composite(right, (left.width, 0))
                    pair.save(output / kind / (name + '.png'))
                capture_row = {**row, 'context': context, 'baseline': old, 'candidate': current,
                               'changed_rgba_pixels': changed, 'detail_pair_order': ['baseline', 'candidate']}
                captures.append(capture_row)
                write_report()
                print(json.dumps({'capture': name, 'changed_pixels': changed}), flush=True)

            for row in rows:
                capture(row)
            guard = after.evaluate(RENDER_GUARD)
            report['render_guard'] = guard
            check('All 47 ties rejected by both renderer plan and render on all three linen blazers', guard['cases'] == 141 and len(guard['tie_ids']) == 47)
            check('Rejected tied linen preserves committed frame, selection and saved data', guard['frame_preserved'] and guard['last_preserved'] and guard['data_preserved'])
            for query in contexts:
                result = after.evaluate(ELIGIBILITY, query)
                eligibility.append(result)
                check('/'.join(query.values()) + ': actual engine checked all returned options', result['returned'] == len(result['options']))
                if query['id'] == 'B01':
                    check('/'.join(query.values()) + ': B01 Home use-case restriction retained', result['returned'] == 0 and not result['direct_owner']['allowed'], result['direct_owner'])
                if result['first_selection']:
                    capture({'name': 'context-' + '-'.join(query.values()), 'garment': query['id'],
                             'purpose': 'actual-style-occasion-engine-option', 'selection': result['first_selection']}, result['request']['context'])
                else:
                    check('/'.join(query.values()) + ': ineligible context explicitly explained', bool(result['reason'] or result['no_match'] or result['direct_owner']['reasons']))
                check('/'.join(query.values()) + ': generation did not persist synthetic requests', after.evaluate(PROTECTED) == protected['candidate'])
                write_report()
                print(json.dumps({'eligibility': query, 'returned': result['returned']}), flush=True)
            check('Every assigned style/occasion context checked', len(eligibility) == len(contexts))
            check('Every assigned exact garment/control fixture rendered', sum(row['purpose'] != 'actual-style-occasion-engine-option' for row in captures) == len(rows))
            check('Every eligible context has an actual complete browser frame', sum(row['purpose'] == 'actual-style-occasion-engine-option' for row in captures) == sum(bool(row['first_selection']) for row in eligibility))
            check('No browser page errors', not errors, errors)
            check('No failed local asset requests', not bad_requests, bad_requests)
            check('No external services or production endpoints contacted', not external, external)
            sheets(output, captures)
            report['status'] = 'passed'
            report['completed_at'] = datetime.now(timezone.utc).isoformat()
            write_report()
            browser.close()
    except Exception:
        report['status'] = 'failed'
        report['exception'] = traceback.format_exc()
        write_report()
        raise
    finally:
        server.shutdown()
        server.server_close()
    print('ISSUE22_BROWSER=' + json.dumps({'status': report['status'], 'contexts': len(eligibility),
          'captures': len(captures), 'checks': len(checks), 'report': str(output / 'RESULT.json')}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', choices=['chromium', 'webkit'], default='chromium')
    parser.add_argument('--executable', help='Optional local browser executable, e.g. /usr/bin/chromium')
    parser.add_argument('--output', type=Path, default=ROOT / 'evidence/issue22-browser')
    parser.add_argument('--shard', type=int, default=1, help='One-based shard number')
    parser.add_argument('--shards', type=int, default=1)
    parser.add_argument('--list', action='store_true')
    run(parser.parse_args())
