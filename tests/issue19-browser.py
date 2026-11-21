#!/usr/bin/env python3
"""Exhaustive Issue 19 V3 render capture and preservation checks.

Every active shirt is rendered with every supported jacket in both permitted
collar states. An additional suite renders every tie in every supported route.
The complete 70,884 selection-plan universe is also checked. Browser captures
and machine gates are evidence for a separate visual review, never approval.
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
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageChops, ImageDraw, ImageFilter
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASELINE = 'ee6bdb7c0986597e569056499ff9eedca1ec3c98'
SHIRTS = [f'DS{i:03}' for i in range(1, 49)] + ['DS050', 'DS051']
NO_TIE_ONLY = {'DS040', 'DS041', 'DS042', 'DS043'}
MODES = [f'S{i:02}' for i in range(1, 19)] + [f'B{i:02}' for i in range(1, 16)] + ['shirt-only']
NO_TIE_JACKETS = {'B01', 'B11'}
V3_SOURCES = {
    'avatar': '4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93',
    'left_hand': '26af452854f6f89c86617d83e9848ae71922d2ff4701877e7903f59c55ebb2b8',
    'right_hand': 'cfca4394b3d208184fef4f267671af834432ac2f6bd89acea83242a9e118863b',
}
# Independent maximum correction envelopes. These are deliberately separate
# from runtime declarations; widening a runtime transform cannot widen a test.
COLLAR_RECTS = ((330, 355, 422, 615), (575, 355, 666, 615))
TIED_NECKBAND_RECT = (422, 420, 575, 467)
LOWER_COLLAR_BACKING_RECT = (422, 530, 575, 615)
TIED_NECK_CORNER_RECTS = ((422, 401, 441, 420), (560, 405, 575, 420))
TIE_RECT = (422, 467, 575, 1251)
CUFF_RECTS = ((20, 1180, 260, 1426), (736, 1180, 976, 1426))
DETAILS = {'collar': (248, 300, 748, 800), 'cuffs': (75, 1250, 921, 1625),
           'tie': (350, 430, 646, 1250)}
SEAMS = json.loads((ROOT / 'tests/issue19-collar-seam-fixtures.json').read_text())
SHOULDERS = json.loads((ROOT / 'tests/issue19-shoulder-contour-fixtures.json').read_text())

spec = importlib.util.spec_from_file_location('existing_v3_fit', ROOT / 'tests/avatar-v3-fit-browser.py')
FIT = importlib.util.module_from_spec(spec)
spec.loader.exec_module(FIT)


def fixtures(suite):
    rows = []
    for mode in MODES:
        if suite == 'shirts':
            for shirt in SHIRTS:
                states = ['NO_TIE'] if shirt in NO_TIE_ONLY or mode in NO_TIE_JACKETS else ['NO_TIE', 'T001']
                for state in states:
                    rows.append({'name': '-'.join((mode, shirt, state)), 'mode': mode,
                                 'selection': FIT.selection(shirt, state, mode)})
        elif mode not in NO_TIE_JACKETS:
            # T001 already has all 46 tied shirt registrations in the matrix.
            for index in range(2, 48):
                state = f'T{index:03}'
                rows.append({'name': '-'.join((mode, 'DS035', state)), 'mode': mode,
                             'selection': FIT.selection('DS035', state, mode)})
    return rows


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def source_identity(rows, state, fidelity):
    """Only exact same-ID registered tie images can normalize a display change."""
    allowed = set()
    if state != 'NO_TIE':
        for binding in fidelity['bindings']:
            if binding['id'] == state:
                allowed.add(binding['layer']['sha256'])
    normalized = []
    for row in rows:
        item = dict(row)
        if item['sha256'] in allowed:
            item['sha256'] = 'registered-same-tie:' + state
        normalized.append(item)
    return normalized


def decode_frame(record):
    raw = base64.b64decode(record.pop('png').split(',', 1)[1])
    image = Image.open(io.BytesIO(raw)).convert('RGBA')
    if image.size != (996, 2748) or digest(image.tobytes()) != record['full_sha256']:
        raise AssertionError('Browser PNG is not the exact native RGBA frame')
    return image, raw


def collar_seams(image, name):
    """Independent audited pixels; no renderer profile or fit counters."""
    return [{'xy': row['xy'], 'rgba': image.getpixel(tuple(row['xy'])),
             'minimum_alpha': SEAMS['minimum_alpha']}
            for row in SEAMS['fixtures']
            if '-'.join((row['mode'], row['shirt'], row['state'])) == name]


def collar_join_diagnostics(image):
    """Retain interior alpha-hole observations for every actual browser case.

    The five-pixel inset excludes the independently observed outer-edge
    antialiasing. Diagnostics on previously unreviewed jacket geometry require
    inspection; the fixed audit regressions above are unconditional gates.
    """
    pixels = image.load()
    count, samples, minimum = 0, [], 255
    for y in range(420, 615):
        opaque = [x for x in range(330, 666) if pixels[x, y][3] >= 248]
        if not opaque:
            continue
        for x in range(opaque[0] + 5, opaque[-1] - 4):
            alpha = pixels[x, y][3]
            minimum = min(minimum, alpha)
            if alpha < 248 and any(pixels[x, y - step][3] >= 248 for step in range(1, 6)) \
                    and any(pixels[x, y + step][3] >= 248 for step in range(1, 6)):
                count += 1
                if len(samples) < 12:
                    samples.append({'xy': [x, y], 'rgba': pixels[x, y]})
    return {'interior_low_alpha_pixels': count, 'minimum_alpha': minimum, 'samples': samples}


def change_check(old, new, selected, hand_mask, avatar_source):
    channels = ImageChops.difference(old, new).split()
    changed = channels[0]
    for channel in channels[1:]:
        changed = ImageChops.lighter(changed, channel)
    changed = changed.point(lambda value: 255 if value else 0)
    permitted = Image.new('L', old.size, 0)
    draw = ImageDraw.Draw(permitted)
    rectangles = list(COLLAR_RECTS) + [LOWER_COLLAR_BACKING_RECT]
    if selected['state'] != 'NO_TIE':
        rectangles.append(TIED_NECKBAND_RECT)
        rectangles.append(TIE_RECT)
        rectangles.extend(TIED_NECK_CORNER_RECTS)
    if not selected.get('shirtOnly'):
        rectangles.extend(CUFF_RECTS)
    for left, top, right, bottom in rectangles:
        draw.rectangle((left, top, right - 1, bottom - 1), fill=255)
    forbidden = ImageChops.subtract(changed, permitted)
    hands = ImageChops.multiply(changed, hand_mask)
    hand_points = []
    if hands.getbbox():
        left, top, right, bottom = hands.getbbox()
        for y in range(top, bottom):
            for x in range(left, right):
                if hands.getpixel((x, y)):
                    hand_points.append({'xy': [x, y], 'before': old.getpixel((x, y)), 'after': new.getpixel((x, y))})
                    if len(hand_points) >= 12:
                        break
            if len(hand_points) >= 12:
                break
    corner_wrong, corner_restored, corner_checked = 0, 0, 0
    if selected['state'] != 'NO_TIE':
        for left, top, right, bottom in TIED_NECK_CORNER_RECTS:
            for y in range(top, bottom):
                for x in range(left, right):
                    source = avatar_source.getpixel((x, y))
                    if source[3] == 255:
                        corner_checked += 1
                        corner_wrong += new.getpixel((x, y)) != source
                        corner_restored += old.getpixel((x, y)) != new.getpixel((x, y))
                    elif old.getpixel((x, y)) != new.getpixel((x, y)):
                        corner_wrong += 1
    return {'changed_pixels': changed.histogram()[255], 'changed_bbox': changed.getbbox(),
            'outside_allowed_pixels': forbidden.histogram()[255],
            'outside_allowed_bbox': forbidden.getbbox(),
            'opaque_hand_pixels_changed': hands.histogram()[255],
            'opaque_hand_difference_samples': hand_points,
            'neck_corner_wrong_source_pixels': corner_wrong,
            'neck_corner_exact_avatar_pixels': corner_checked,
            'neck_corner_restored_pixels': corner_restored,
            'permitted_rectangles_xyxy': rectangles}


HAND_MASK = r'''async()=>{
 const c=document.createElement('canvas');c.width=996;c.height=2748;
 const ctx=c.getContext('2d',{willReadFrequently:true});
 for(const name of ['left_hand','right_hand']){
  const d=HEWRSApp.connection.manifest.static[name],i=new Image();
  i.src=HEWRSApp.resolveUrl(d);await i.decode();ctx.drawImage(i,0,0);
 }
 const p=ctx.getImageData(0,0,996,2748);HEWRSAvatarV3ArmPose.apply(p);ctx.putImageData(p,0,0);
 return c.toDataURL('image/png');
}'''

AVATAR_SOURCE = r'''async()=>{
 const c=document.createElement('canvas');c.width=996;c.height=2748;
 const d=HEWRSApp.connection.manifest.static.avatar,i=new Image();
 i.src=HEWRSApp.resolveUrl(d);await i.decode();c.getContext('2d').drawImage(i,0,0);
 return c.toDataURL('image/png');
}'''

# The shared historical helper closes B01's reviewed dialog after its native
# capture. Keep that exact rendered surface open until THIS test has captured
# the phone screen and measured it at each viewport width.
_REVIEW_CLOSE = 'if(reviewed)HEWRSReviewedIntegration.close();'
assert FIT.FRAME.count(_REVIEW_CLOSE) == 1, 'Reviewed mobile capture lifecycle anchor differs'
_OPEN_REVIEW_FRAME = FIT.FRAME.replace(_REVIEW_CLOSE, '')
FIT_FRAME = r'''async input=>{
 const captured=await (''' + _OPEN_REVIEW_FRAME + r''')(input),s=input.selected,c=HEWRSApp.connection;
 const surface=document.getElementById(s.blazerId==='B01'?'rd-canvas':'avatar'),face=surface.getContext('2d').getImageData(422,0,153,420).data;
 // Only these independently inspected shirt-fragment slots may reveal the
 // original neck. Their actual pixels are separately checked against the
 // browser-decoded approved avatar, not merely omitted from protection.
 if(s.state!=='NO_TIE')for(const [x,y,w,h]of [[422,401,19,19],[560,405,15,15]])for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)face.fill(0,(yy*153+xx-422)*4,(yy*153+xx-422)*4+4);
 captured.face_and_chin_sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',face)),x=>x.toString(16).padStart(2,'0')).join('');
 const targets=[];
 function visit(value){if(!value||typeof value!=='object')return;
  if(value.avatar_v3_tie_fit)targets.push({sha256:value.sha256,...value.avatar_v3_tie_fit});
  for(const key of Object.keys(value))if(value[key]&&typeof value[key]==='object')visit(value[key]);}
 visit(HEWRSApp.renderer.plan(s));
 const continuous=c.continuousShirts.ids.includes(s.shirtId),row=c.batch10.shirts[s.shirtId];
 const foreground=!!s.shirtOnly&&row?.shirt_only_trouser_ownership==='EXACT_EXISTING_TROUSER_LAYER_FOREGROUND_AT_WAIST';
 captured.issue19={tie_targets:targets,
  expected_tie_end:(s.shirtOnly||s.blazerId)&&!continuous&&!foreground?1251:1211,
  same_tie_full_sha256:s.state==='NO_TIE'?null:c.tieFidelity.data.ties[s.state].layers.non_suit.sha256};
 return captured;
}'''

PLAN_MATRIX = r'''({modes,shirts})=>{
 const c=HEWRSApp.connection,renderer=HEWRSApp.renderer;
 let accepted=0,forbidden=0;
 for(const mode of modes)for(const shirtId of shirts){
  const base={shirtId,shoeId:'shoe-8',watchId:null,...(mode==='shirt-only'?{shirtOnly:true,pantId:'PG002'}:
   mode.startsWith('B')?{blazerId:mode,pantId:mode==='B01'?'PT006':'PG002'}:{suitId:mode})};
  renderer.plan({...base,state:'NO_TIE'});accepted++;
  const prohibited=c.records[shirtId].no_tie_only||['B01','B11'].includes(mode);
  if(prohibited){
   const s={...base,state:'T001'};
   if(c.records[shirtId].no_tie_only){let denied=false;try{renderer.plan(s);}catch(_){denied=true;}
    if(!denied)throw Error('No-tie-only shirt accepted a tie: '+mode+'/'+shirtId);}
   else if(HEWRSOutfitFeedback.ownerRuleCheck(s,{context:{occasion:'work',requiredFormality:'any'}}).allowed)
    throw Error('Owner no-tie jacket accepted a tie: '+mode);
   forbidden++;continue;
  }
  for(let t=1;t<=47;t++){
   const state='T'+String(t).padStart(3,'0'),s={...base,state};renderer.plan(s);accepted++;
  }
 }
 return {accepted,forbidden};
}'''


def shoulder_contour_samples(image, selected):
    """Check independent original-photo fixtures, including rejected browser controls."""
    if not selected.get('shirtOnly'):
        return []
    samples = []
    for fixture in SHOULDERS['fixtures'] + SHOULDERS.get('antialias_fixtures', []):
        if (fixture['shirt'] != selected['shirtId']
                or (fixture['state'] == 'NO_TIE') != (selected['state'] == 'NO_TIE')):
            continue
        rgba = list(image.getpixel(tuple(fixture['xy'])))
        assert rgba[3] == fixture['expected_alpha'], (selected, fixture['xy'], rgba)
        if fixture.get('expected_rendered_rgba'):
            assert rgba == fixture['expected_rendered_rgba'], (selected, fixture['xy'], rgba)
        patch_pixels = 0
        if fixture.get('region_3x3'):
            patch = fixture['region_3x3']
            x, y, width, height = patch['xywh']
            for yy in range(y, y + height):
                for xx in range(x, x + width):
                    assert image.getpixel((xx, yy))[3] == patch['expected_alpha'], (selected, xx, yy)
                    patch_pixels += 1
        samples.append({'xy': fixture['xy'], 'rgba': rgba,
                        'body_source_sha256': fixture['body_source_sha256'], 'patch_pixels': patch_pixels})
    return samples


def save_details(output, name, old, new, native=False):
    for kind, rectangle in DETAILS.items():
        a, b = old.crop(rectangle), new.crop(rectangle)
        pair = Image.new('RGBA', (a.width * 2, a.height), '#e9eaec')
        pair.alpha_composite(a, (0, 0)); pair.alpha_composite(b, (a.width, 0))
        pair.convert('RGB').save(output / kind / (name + '.jpg'), quality=92)
    if native:
        new.save(output / 'native' / (name + '.png'))
    return {'detail_pair_order': ['published-v3-baseline', 'issue19-candidate'],
            'native_saved': native}


def contact_sheets(output, rows):
    """Every retained detail appears in a numbered, reproducible review sheet."""
    index = []
    for kind in DETAILS:
        for start in range(0, len(rows), 12):
            subset = rows[start:start + 12]
            tile_w = 600
            tile_h = 322
            sheet = Image.new('RGB', (tile_w * 2, tile_h * math.ceil(len(subset) / 2)), '#e9eaec')
            draw = ImageDraw.Draw(sheet)
            for offset, row in enumerate(subset):
                item = Image.open(output / kind / (row['name'] + '.jpg'))
                item.thumbnail((tile_w, 290))
                x, y = (offset % 2) * tile_w, (offset // 2) * tile_h
                draw.text((x + 6, y + 5), row['name'] + '  baseline | candidate', fill='black')
                sheet.paste(item, (x, y + 25))
            name = f'{kind}-{start // 12 + 1:03}.jpg'
            sheet.save(output / 'sheets' / name, quality=91)
            index.append({'path': 'sheets/' + name, 'kind': kind,
                          'cases': [row['name'] for row in subset]})
    (output / 'VISUAL_REVIEW_INDEX.json').write_text(json.dumps(index, indent=2) + '\n')


def run(args):
    rows = [row for row in fixtures(args.suite) if MODES.index(row['mode']) % args.shards == args.shard]
    if args.only_mode:
        rows = [row for row in rows if row['mode'] == args.only_mode]
    if args.limit:
        rows = rows[:args.limit]
    if args.list:
        print(json.dumps({'suite': args.suite, 'total_cases': len(fixtures(args.suite)),
                          'shard': args.shard, 'shards': args.shards, 'cases': len(rows)}))
        return
    baseline = ROOT / args.baseline_entrypoint
    if not baseline.resolve().is_relative_to(ROOT):
        raise ValueError('Baseline entrypoint must be inside the working tree')
    if digest(baseline.read_bytes()) != '4670d41cc6139d12956dfbd064692e92fe28c719160ec2e142754b2e22de718b':
        raise AssertionError('Baseline page differs from the exact published V3 checkpoint')
    output = args.output.resolve() / args.browser / args.suite / f'shard-{args.shard}'
    for part in ['collar', 'cuffs', 'tie', 'native', 'phone', 'sheets']:
        (output / part).mkdir(parents=True, exist_ok=True)
    checks, captures, errors, bad_requests, external = [], [], [], [], []
    report = {'schema': 'hewrs.issue19.browser-matrix.v1', 'browser': args.browser,
              'baseline_commit': BASELINE, 'suite': args.suite, 'shard': args.shard,
              'shards': args.shards, 'mode_filter': args.only_mode, 'case_limit': args.limit,
              'expected_cases': len(rows), 'checks': checks,
              'captures': captures, 'page_errors': errors, 'bad_requests': bad_requests,
              'external_requests': external, 'owner_data_accessed': False,
              'visual_acceptance': 'requires_independent_inspection_of_actual_captures'}

    def check(name, condition, detail=None):
        checks.append({'name': name, 'passed': bool(condition), 'detail': detail})
        if not condition:
            raise AssertionError(name + ': ' + repr(detail))

    def write_report():
        report.update(passed=sum(row['passed'] for row in checks), failed=sum(not row['passed'] for row in checks))
        (output / 'RESULT.json').write_text(json.dumps(report, indent=2) + '\n')

    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
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
            contexts = []

            def open_page(relative, label):
                context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
                contexts.append(context)
                def route(request):
                    if urlsplit(request.request.url)[:2] == urlsplit(origin)[:2]:
                        request.continue_()
                    else:
                        external.append({'page': label, 'url': request.request.url}); request.abort()
                context.route('**/*', route)
                page = context.new_page(); page.set_default_timeout(120000)
                page.on('pageerror', lambda error: errors.append({'page': label, 'error': str(error)}))
                page.on('requestfailed', lambda request: bad_requests.append({'page': label, 'url': request.url, 'error': request.failure}))
                page.on('response', lambda response: bad_requests.append({'page': label, 'url': response.url, 'status': response.status})
                        if response.status >= 400 and not response.url.endswith('/favicon.ico') else None)
                response = page.goto(origin + relative, wait_until='domcontentloaded', timeout=120000)
                check(label + ': entrypoint HTTP 200', response.status == 200)
                page.wait_for_function('globalThis.HEWRS_READY && HEWRSApp.rejection', timeout=120000)
                page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
                return page

            before = open_page(str(baseline.relative_to(ROOT)), 'published-v3')
            after = open_page('index.html', 'issue19-candidate')
            old_inventory, inventory = before.evaluate(FIT.INVENTORY), after.evaluate(FIT.INVENTORY)
            check('Wardrobe inventory and source lock remain exact', inventory == old_inventory)
            check('Exactly all 50 active shirts and all 33 jackets remain supported',
                  sorted(inventory['shirts']) == SHIRTS and len(inventory['suits']) == 18
                  and len(inventory['blazers']) == 15 and set(inventory['no_tie_only']) == NO_TIE_ONLY)
            for label, page in [('published-v3', before), ('issue19-candidate', after)]:
                pins = page.evaluate("()=>Object.fromEntries(['avatar','left_hand','right_hand'].map(k=>[k,HEWRSApp.connection.manifest.static[k].sha256]))")
                check(label + ': exact approved V3 avatar and hands', pins == V3_SOURCES, pins)
            features = after.evaluate("()=>({collar:globalThis.HEWRSAvatarV3ShirtCollarFit?.spec||null,cuff:globalThis.HEWRSAvatarV3CuffFit?.spec||null,tie:globalThis.HEWRSAvatarV3TieFit?.spec||null})")
            check('All three coordinated fit corrections are installed', all(features.values()), features)
            check('All 50 collars use the bounded V3 registration contract',
                  features['collar']['revision'] == 'AVATAR_V3_ALL_SHIRT_COLLAR_FIT_5'
                  and features['collar']['active_ids'] == SHIRTS
                  and features['collar']['bounds'] == [330, 355, 336, 260]
                  and features['collar']['modified_strips'] == [[330, 355, 92, 260], [575, 355, 91, 260]]
                  and features['collar']['top_center_bounds'] == [422, 420, 153, 47]
                  and features['collar']['protected_knot_corridor'] == [422, 467, 153, 63]
                  and features['collar']['lower_center_backing_bounds'] == [422, 530, 153, 85]
                  and features['collar']['tied_neck_corner_cleanup'] == [[422, 401, 19, 19], [560, 405, 15, 15]])
            check('Concealed cuffs use bounded selected-jacket sleeves and preserve shirt-only',
                  features['cuff']['revision'] == 'AVATAR_V3_CONCEALED_CUFFS_2'
                  and features['cuff']['bounds'] == [[20, 1180, 240, 246], [736, 1180, 240, 246]]
                  and features['cuff']['shirt_only'] == 'exact_pass_through'
                  and features['cuff']['opaque_hand_pixels'] == 'inherited_finished_frame_exact')
            report['fit_contracts'] = features
            report['runtime'] = after.evaluate("()=>document.querySelector('script[src^=\"runtime/\"]').getAttribute('src')")
            fidelity = after.evaluate('()=>HEWRSApp.connection.tieFidelity.data')
            check('Original 47-tie fidelity bindings remain exact', fidelity == before.evaluate('()=>HEWRSApp.connection.tieFidelity.data'))
            modes = [mode for index, mode in enumerate(MODES) if index % args.shards == args.shard]
            if args.only_mode:
                modes = [mode for mode in modes if mode == args.only_mode]
            if args.suite == 'shirts':
                plans = after.evaluate(PLAN_MATRIX, {'modes': modes, 'shirts': SHIRTS})
                expected = sum(50 + (0 if mode in NO_TIE_JACKETS else 46 * 47) for mode in modes)
                check('All permitted shirt and tie plans in these routes succeed', plans['accepted'] == expected, plans)
                report['selection_plan_coverage'] = plans
            hand_raw = base64.b64decode(after.evaluate(HAND_MASK).split(',', 1)[1])
            hand_alpha = Image.open(io.BytesIO(hand_raw)).getchannel('A')
            hand_mask = hand_alpha.point(lambda alpha: 255 if alpha == 255 else 0)
            hand_shape = hand_alpha.point(lambda alpha: 255 if alpha else 0)
            avatar_raw = base64.b64decode(after.evaluate(AVATAR_SOURCE).split(',', 1)[1])
            avatar_source = Image.open(io.BytesIO(avatar_raw)).convert('RGBA')
            report['opaque_hand_mask_sha256'] = digest(hand_mask.tobytes())
            old_state, new_state = before.evaluate(FIT.PROTECTED), after.evaluate(FIT.PROTECTED)
            wrist_references = {}
            phone_modes = set()
            previous_mode = None
            for index, row in enumerate(rows):
                selected, name = row['selection'], row['name']
                if row['mode'] != previous_mode:
                    check('Completed route preserves both isolated state stores',
                          before.evaluate(FIT.PROTECTED) == old_state and after.evaluate(FIT.PROTECTED) == new_state)
                    before.context.close(); after.context.close()
                    before = open_page(str(baseline.relative_to(ROOT)), 'published-v3')
                    after = open_page('index.html', 'issue19-candidate')
                    old_state, new_state = before.evaluate(FIT.PROTECTED), after.evaluate(FIT.PROTECTED)
                    previous_mode = row['mode']
                report['current_case'] = row
                old = before.evaluate(FIT_FRAME, {'selected': selected, 'ignoredHashes': []})
                new = after.evaluate(FIT_FRAME, {'selected': selected, 'ignoredHashes': []})
                old_image, _ = decode_frame(old); new_image, native_png = decode_frame(new)
                # Every case retains full-frame RGBA hashes and paired details.
                # Keep full native PNGs for priority shirts and two additional
                # ties per route, without duplicating all 1,472 tie PNGs.
                keep_native = (args.suite == 'shirts' and selected['shirtId'] in {'DS013', 'DS019', 'DS034', 'DS038', 'DS035'}
                               or args.suite == 'ties' and selected['state'] in {'T017', 'T047'})
                details = save_details(output, name, old_image, new_image, native=keep_native)
                seam_samples = collar_seams(new_image, name)
                if seam_samples:
                    check(name + ': independently audited collar gaps are closed',
                          all(sample['rgba'][3] >= sample['minimum_alpha'] for sample in seam_samples), seam_samples)
                join_diagnostics = collar_join_diagnostics(new_image)
                check(name + ': exact native frame, requested selection and completed render',
                      all(record['selection'] == selected and record['last'] == selected and record['status'] == 'ready'
                          and record['dimensions'] == [996, 2748] for record in (old, new)))
                check(name + ': original garment sources and same physical tie identity',
                      source_identity(old['source_bindings'], selected['state'], fidelity)
                      == source_identity(new['source_bindings'], selected['state'], fidelity))
                targets = new['issue19']['tie_targets']
                if selected['state'] == 'NO_TIE':
                    check(name + ': no tie registration leaks into the no-tie route', not targets)
                else:
                    check(name + ': same-ID full tie reaches its actual registered waistband',
                          bool(targets) and all(target['target_end'] == new['issue19']['expected_tie_end']
                              and target['sha256'] == new['issue19']['same_tie_full_sha256']
                              and target['revision'] == 'AVATAR_V3_TIE_FIT_1' for target in targets), targets)
                differences = change_check(old_image, new_image, selected, hand_mask, avatar_source)
                check(name + ': corrections stay inside independent fit boundaries', differences['outside_allowed_pixels'] == 0, differences)
                check(name + ': approved opaque hand pixels remain exact', differences['opaque_hand_pixels_changed'] == 0, differences)
                check(name + ': approved head, legs and footwear remain exact', old['head_sha256'] == new['head_sha256'] and old['lower_sha256'] == new['lower_sha256'])
                check(name + ': approved central face and chin remain exact outside source-restoration slots', old['face_and_chin_sha256'] == new['face_and_chin_sha256'])
                check(name + ': tied neck cleanup restores exact original avatar pixels', differences['neck_corner_wrong_source_pixels'] == 0, differences)
                shoulder_samples = shoulder_contour_samples(new_image, selected)
                if shoulder_samples:
                    check(name + ': independently observed original shoulder BODY coverage remains intact', True, shoulder_samples)
                if selected.get('shirtOnly'):
                    check(name + ': shirt-only sleeves stay exact',
                          [digest(new_image.crop(rect).tobytes()) for rect in CUFF_RECTS]
                          == [digest(old_image.crop(rect).tobytes()) for rect in CUFF_RECTS])
                else:
                    # The original fully composed hand pixels are retained
                    # exactly above. Test shirt-independent jacket cloth
                    # separately from its hand silhouette; browser rounding
                    # in preserved hand pixels is not a fabric substitution.
                    wrists = []
                    for rect in CUFF_RECTS:
                        cloth = new_image.crop(rect)
                        cloth.paste((0, 0, 0, 0), (0, 0), hand_shape.crop(rect))
                        wrists.append(digest(cloth.tobytes()))
                    key = row['mode']
                    if key not in wrist_references:
                        wrist_references[key] = wrists
                    check(name + ': concealed sleeve cloth does not depend on shirt or tie choice', wrists == wrist_references[key])
                check(name + ': render preserves saved records and correct garment card',
                      all(record['state_unchanged'] and record['photos_decoded'] and record['card_shirt'] == selected['shirtId']
                          and record['card_tie'] == (None if selected['state'] == 'NO_TIE' else selected['state']) for record in (old, new)))
                check(name + ': 390px phone canvas fits without horizontal overflow',
                      new['layout']['viewport'] == 390 and new['layout']['width'] <= 391 and new['layout']['left'] >= -1
                      and new['layout']['right'] <= 391 and new['layout']['height'] > 0, new['layout'])
                if row['mode'] not in phone_modes:
                    if row['mode'] == 'B01':
                        check(name + ': B01 mobile evidence retains its actual reviewed render',
                              after.evaluate("()=>document.getElementById('rd-dialog').open&&document.getElementById('rd-canvas').dataset.status==='ready'"))
                        after.locator('#rd-canvas').scroll_into_view_if_needed()
                    after.screenshot(path=str(output / 'phone' / (name + '-390.png')), full_page=True)
                    for width in (320, 390, 430, 768):
                        after.set_viewport_size({'width': width, 'height': 844})
                        after.evaluate("""async()=>{
                          await document.fonts.ready;
                          await Promise.all(Array.from(document.images).filter(image=>image.getClientRects().length&&image.currentSrc).map(image=>image.decode()));
                          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                        }""")
                        if row['mode'] == 'B01':
                            after.locator('#rd-canvas').scroll_into_view_if_needed()
                        geometry = after.evaluate("""reviewed=>{
                          const canvas=document.getElementById(reviewed?'rd-canvas':'avatar'),rect=canvas.getBoundingClientRect(),dialog=document.getElementById('rd-dialog');
                          return {viewport:innerWidth,width:document.documentElement.scrollWidth,canvas_left:rect.left,canvas_right:rect.right,canvas_height:rect.height,
                            reviewed_dialog_open:!!dialog?.open,dialog_width:reviewed?dialog.clientWidth:null,dialog_scroll_width:reviewed?dialog.scrollWidth:null};
                        }""", row['mode'] == 'B01')
                        check(name + f': {width}px actual outfit presentation has no horizontal overflow',
                              geometry['width'] <= width + 1 and geometry['canvas_left'] >= -1
                              and geometry['canvas_right'] <= width + 1 and geometry['canvas_height'] > 0
                              and (row['mode'] != 'B01' or (geometry['reviewed_dialog_open']
                                   and geometry['dialog_scroll_width'] <= geometry['dialog_width'] + 1)), geometry)
                        after.screenshot(path=str(output / 'phone' / (name + f'-{width}.png')), full_page=True)
                    after.set_viewport_size({'width': 390, 'height': 844})
                    phone_modes.add(row['mode'])
                if row['mode'] == 'B01':
                    before.evaluate('()=>HEWRSReviewedIntegration.close()')
                    after.evaluate('()=>HEWRSReviewedIntegration.close()')
                captures.append({**row, 'original_rgba_sha256': old['full_sha256'], 'candidate_rgba_sha256': new['full_sha256'],
                                 'original_source_binding_sha256': old['source_binding_sha256'],
                                 'candidate_source_binding_sha256': new['source_binding_sha256'],
                                 'tie_registration': new['issue19'],
                                 'collar_seam_regressions': seam_samples, 'collar_join_diagnostics': join_diagnostics,
                                 'shoulder_contour_regressions': shoulder_samples,
                                 'differences': differences, **details})
                if index % 12 == 0 or index == len(rows) - 1:
                    write_report(); print(f'ISSUE19_CAPTURED {args.browser} {args.suite} {args.shard} {index + 1}/{len(rows)} {name}', flush=True)
            check('All planned cases captured', len(captures) == len(rows))
            check('Complete render matrix preserves both isolated state stores', before.evaluate(FIT.PROTECTED) == old_state and after.evaluate(FIT.PROTECTED) == new_state)
            check('All application, photograph and native image requests succeed', not errors and not bad_requests,
                  {'errors': errors, 'bad_requests': bad_requests})
            check('No external service was requested', not external, external)
            for context in contexts:
                context.close()
            browser.close()
        contact_sheets(output, captures)
        report['status'] = 'PASS_RENDER_AND_PRESERVATION_GATES_VISUAL_REVIEW_REQUIRED'
    except Exception:
        report['status'] = 'FAIL'; report['exception'] = traceback.format_exc(); raise
    finally:
        if captures and not (output / 'VISUAL_REVIEW_INDEX.json').exists():
            contact_sheets(output, captures)
        write_report(); server.shutdown(); server.server_close()
    print(json.dumps({'status': report['status'], 'browser': args.browser, 'suite': args.suite,
                      'shard': args.shard, 'captures': len(captures), 'passed': report['passed'], 'failed': report['failed']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', choices=['chromium', 'webkit'], default='chromium')
    parser.add_argument('--suite', choices=['shirts', 'ties'], default='shirts')
    parser.add_argument('--shard', type=int, default=0)
    parser.add_argument('--shards', type=int, default=4)
    parser.add_argument('--baseline-entrypoint', default='avatar-v3-issue19-baseline.html')
    parser.add_argument('--output', type=Path, default=ROOT / 'evidence/issue19/browser')
    parser.add_argument('--executable')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--only-mode', choices=MODES, help='Explicit targeted preflight; the unfiltered suites remain the exhaustive gates')
    parser.add_argument('--list', action='store_true')
    arguments = parser.parse_args()
    if not (arguments.shards > 0 and 0 <= arguments.shard < arguments.shards):
        parser.error('shard must be inside [0, shards)')
    run(arguments)
