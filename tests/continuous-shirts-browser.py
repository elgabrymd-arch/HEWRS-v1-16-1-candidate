#!/usr/bin/env python3
"""Review complete continuous-shirt outfits in an isolated real browser.

This verifies exact selections, immutable source bindings, full native frames,
phone layout and unaffected delegation. Captures require a separate visual
decision; a passing browser contract is not owner approval of the garment.
The existing five-round-state-browser.py supplies the focused Favorites,
rejection, two-tab persistence and transport-cancellation regression separately.
"""
import argparse
import base64
import functools
import hashlib
import importlib.util
import io
import json
import shutil
import sys
import threading
import traceback
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from playwright.sync_api import sync_playwright
from avatar_geometry_contract import (AVATAR_PROFILE, PLAN_SOURCES, SOURCE_LAYERS, comparison_policy,
                                      native_difference, validate_profile)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from verify_active_delivery import describe
IDS = ['DS001', 'DS014', 'DS017', 'DS023', 'DS034', 'DS035', 'DS036', 'DS051']
MODES = ['shirt-only', 'B03', 'B02', 'S05', 'S11']


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def serve(root):
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, 'http://127.0.0.1:%d/' % server.server_address[1]


def selection(shirt, state, mode):
    value = dict(shirtId=shirt, state=state, shoeId='shoe-8', watchId=None)
    if mode == 'shirt-only':
        value.update(shirtOnly=True, pantId='PG002')
    elif mode.startswith('B'):
        value.update(blazerId=mode, pantId='PG002')
    else:
        value['suitId'] = mode
    return value


def fixtures(ids, modes):
    # Keep each mesh warm across the actual jacket/suit routes.
    rows = [dict(selection=selection(shirt, state, mode), mode=mode, primary=True)
            for shirt in ids for state in ['NO_TIE', 'T001'] for mode in modes]
    for shirt, tie in [('DS001', 'T017'), ('DS023', 'T028'), ('DS035', 'T029'), ('DS051', 'T017')]:
        if shirt in ids:
            rows.extend(dict(selection=selection(shirt, tie, mode), mode=mode, primary=False) for mode in modes)
    return rows


def capture_full_app(selected, mode):
    if mode == 'shirt-only' and selected['state'] in ['NO_TIE', 'T001']:
        return True
    return (selected['shirtId'], mode, selected['state']) in {
        ('DS001', 'B03', 'NO_TIE'), ('DS035', 'B02', 'T029'),
        ('DS034', 'S05', 'NO_TIE'), ('DS051', 'S11', 'T001'),
        ('DS051', 'S11', 'T017'),
    }


# Read the bytes directly: writing them to another canvas before capture would
# introduce the very alpha conversion that this diagnostic needs to measure.
HEAD_SNAPSHOT = r'''async canvas => {
 const bytes=canvas.getContext('2d').getImageData(0,0,996,350).data;
 let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
 return {dimensions:[996,350],canvas_dimensions:[canvas.width,canvas.height],rgba_base64:btoa(binary),
  rgba_sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')};
}'''

HEAD_REFERENCES = r'''async()=>{
 const app=HEWRSApp,d=app.connection.manifest.static.avatar,image=new Image();
 image.src=app.resolveUrl(d);await image.decode();
 const make=(height,frequent)=>{const c=document.createElement('canvas');c.width=996;c.height=height;
  return [c,c.getContext('2d',frequent?{willReadFrequently:true}:undefined)];};
 const [raw,rc]=make(350,false);rc.drawImage(image,0,0);
 const [native,nc]=make(2748,true);nc.drawImage(image,0,0);
 const [committed,cc]=make(2748,true);cc.putImageData(nc.getImageData(0,0,996,2748),0,0);
 const capture=(''' + HEAD_SNAPSHOT + r''');
 return {source_sha256:d.sha256,source_url:app.resolveUrl(d),
  raw_head:await capture(raw),native_source:await capture(native),native_commit:await capture(committed)};
}'''


def head_difference(reference, actual):
    """Exact channel diagnostics; this deliberately defines no tolerance."""
    if reference.size != actual.size:
        return dict(equal=False, reference_size=reference.size, actual_size=actual.size)
    changed = alpha_changed = opaque_changed = partial_changed = transparent_changed = 0
    maxima = [0, 0, 0, 0]
    bounds = [reference.width, reference.height, -1, -1]
    samples = []
    for index, (expected, observed) in enumerate(zip(reference.getdata(), actual.getdata())):
        if expected == observed:
            continue
        changed += 1
        alpha_changed += expected[3] != observed[3]
        opaque_changed += expected[3] == observed[3] == 255
        transparent_changed += expected[3] == observed[3] == 0
        partial_changed += 0 < expected[3] < 255 or 0 < observed[3] < 255
        x, y = index % reference.width, index // reference.width
        bounds = [min(bounds[0], x), min(bounds[1], y), max(bounds[2], x), max(bounds[3], y)]
        maxima = [max(maxima[channel], abs(expected[channel] - observed[channel])) for channel in range(4)]
        if len(samples) < 16:
            samples.append(dict(x=x, y=y, expected=list(expected), actual=list(observed)))
    return dict(equal=changed == 0, changed_pixels=changed, alpha_changed_pixels=alpha_changed,
                opaque_changed_pixels=opaque_changed, partial_alpha_changed_pixels=partial_changed,
                transparent_rgb_changed_pixels=transparent_changed, max_channel_delta=maxima,
                difference_bounds=None if not changed else bounds, samples=samples)


FRAME = r'''async selected => {
 const app=HEWRSApp,applied=await app.apply(selected,{origin:'manual',save:false,keepPreferences:true});
 if(applied?.cancelled)throw Error('Unexpected complete-frame cancellation');
 app.showPage('outfits');
 const canvas=document.getElementById('avatar'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const p=app.renderer.plan(selected),card=app.cardSnapshot();
 const photos=Array.from(document.querySelectorAll('#option-card-items img'));await Promise.all(photos.map(image=>image.decode()));
 const source=s=>s?({type:s.type,sha256:s.type==='mesh'?s.source.sha256:s.layer.sha256,
   photo_dimensions:s.type==='mesh'?s.source.rect.slice(2):null,triangles:s.triangles?.length||0,
   clip_rect:s.clip_rect||null,patches:(s.source_patches||[]).map(x=>({sha256:x.source.sha256,
     source_rect:x.source_rect,destination_rect:x.destination_rect,ink_mask:x.ink_mask||null,feather:x.feather||null,boundary_blend:x.boundary_blend||false}))}):null;
 const bounds=canvas.getBoundingClientRect();
 return {selection:app.state().selection,last:app.renderer.last(),status:canvas.dataset.status,
  dimensions:[canvas.width,canvas.height],png:canvas.toDataURL('image/png'),
  rgba_sha256:await digest(ctx.getImageData(0,0,canvas.width,canvas.height).data),
  head_sha256:await digest(ctx.getImageData(0,0,996,350).data),
  source_bindings:(''' + PLAN_SOURCES + r''')(p),
  photos_decoded:photos.length>0&&photos.every(image=>image.naturalWidth>0&&image.naturalHeight>0),
  card_images:photos.map(image=>({src:image.getAttribute('src'),alt:image.alt,natural_width:image.naturalWidth,natural_height:image.naturalHeight})),
  card_shirt:card.items.find(x=>x.role==='Shirt'),card_tie:card.items.find(x=>x.role==='Tie'),
  plan:{operation:p.operation,kind:p.kind,avatar:p.avatar?.sha256,hands:(p.hands||[]).map(h=>h.sha256),tie:p.tie?.sha256||null,
    jacket:p.jacket?.sha256||null,pants:p.pants?.sha256||null,
    body:source(p.garment?.body),front_collar:source(p.garment?.front_collar),jacket_rear:source(p.jacketRear),
    cuffs:(p.garment?.cuffs||[]).map(source),borrowed_ownership:!!p.ownership},
  layout:{viewport:innerWidth,document_width:document.documentElement.scrollWidth,
    canvas_left:bounds.left,canvas_right:bounds.right,canvas_width:bounds.width,canvas_height:bounds.height},
  renderer_stats:app.renderer.stats()};
}'''

ALL_TIES = r'''() => {
 const app=HEWRSApp,c=app.connection,failures=[],states=Array.from({length:47},(_,i)=>'T'+String(i+1).padStart(3,'0'));
 let checked=0;
 for(const id of c.continuousShirts.ids)for(const state of states)for(const kind of ['shirt-only','B03','S05']){
  const selected={shirtId:id,state,shoeId:'shoe-8',watchId:null,
   ...(kind==='shirt-only'?{shirtOnly:true,pantId:'PG002'}:kind==='B03'?{blazerId:'B03',pantId:'PG002'}:{suitId:'S05'})};
  const p=app.renderer.plan(selected),expected=c.tieFidelity.replace(c.batch10.ties[state]);
  if(p.operation!=='CONTINUOUS_SOURCE_SHIRT'||p.tie?.sha256!==expected.sha256||
     p.avatar?.sha256!==c.manifest.static.avatar.sha256||p.garment!==c.continuousShirts.shirts[id].modes.tied)
   failures.push({id,state,kind});
  checked++;
 }
 return {checked,failures,ids:c.continuousShirts.ids,states:states.length};
}'''


def protected(page):
    return page.evaluate('()=>({wear:HEWRSApp.store.snapshot(),favorites:HEWRSApp.favorites.snapshot(),rejections:HEWRSApp.ownerFeedback.snapshot().events})')


def make_sheets(output, frames):
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
    except OSError:
        font = ImageFont.load_default()
    for mode in sorted({row['mode'] for row in frames if row['primary']}):
        for state in ['NO_TIE', 'T001']:
            rows = [row for row in frames if row['primary'] and row['mode'] == mode and row['selection']['state'] == state]
            if not rows:
                continue
            width, height, columns = 220, 650, 4
            sheet = Image.new('RGB', (width * columns, height * ((len(rows) + columns - 1) // columns)), '#ededed')
            draw = ImageDraw.Draw(sheet)
            for index, row in enumerate(rows):
                x, y = index % columns * width, index // columns * height
                draw.text((x + 8, y + 5), row['selection']['shirtId'] + ' ' + state, fill='#111', font=font)
                image = Image.open(output / row['native_path']).convert('RGBA')
                image.thumbnail((210, 610))
                sheet.paste(image, (x + (width - image.width) // 2, y + 30), image)
            sheet.save(output / ('FULL-' + mode + '-' + state + '.png'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--entrypoint', default='index.html')
    parser.add_argument('--browser', choices=('chromium', 'webkit'), default='chromium')
    parser.add_argument('--output', type=Path, default=ROOT / 'evidence/continuous_shirts/browser')
    parser.add_argument('--baseline-root', type=Path)
    parser.add_argument('--ids', default=','.join(IDS))
    parser.add_argument('--modes', default=','.join(MODES))
    args = parser.parse_args()
    active_delivery = describe(args.root)
    release = json.loads((args.root / 'AVATAR_V3_RELEASE.json').read_text()) if active_delivery['kind'] == 'avatar-v3' else {}
    issue19 = release.get('issue19_baseline', {}).get('entrypoint') == 'avatar-v3-issue19-baseline.html'
    issue19_contract = None
    if issue19:
        contract_spec = importlib.util.spec_from_file_location('issue19_preservation', ROOT / 'tests/issue19-browser.py')
        issue19_contract = importlib.util.module_from_spec(contract_spec)
        contract_spec.loader.exec_module(issue19_contract)
        assert hashlib.sha256((args.root / release['issue19_baseline']['entrypoint']).read_bytes()).hexdigest() == '4670d41cc6139d12956dfbd064692e92fe28c719160ec2e142754b2e22de718b'
    expected_delivery_avatar = (SOURCE_LAYERS['v3']['avatar'] if args.entrypoint == 'avatar-v3-review.html'
                                else active_delivery.get('avatar_sha256', SOURCE_LAYERS['v2']['avatar']))
    ids, modes = args.ids.split(','), args.modes.split(',')
    output = args.output.resolve() / args.browser
    for directory in [output, output / 'native', output / 'upper', output / 'phone',
                      output / 'full-page', output / 'option-card-items', output / 'head-diagnostics']:
        directory.mkdir(parents=True, exist_ok=True)
    checks, frames, errors, failures, http_errors, external = [], [], [], [], [], []
    report = dict(schema='hewrs.continuous-shirts.browser.v1', browser=args.browser,
                  active_delivery=active_delivery,
                  started_at=datetime.now(timezone.utc).isoformat(), entrypoint=args.entrypoint,
                  entrypoint_sha256=hashlib.sha256((args.root / args.entrypoint).read_bytes()).hexdigest(),
                  owner_data_accessed=False, fresh_browser_context=True,
                  visual_approval='NOT_GRANTED_BY_AUTOMATED_CHECKS', ids=ids, modes=modes,
                  checks=checks, frames=frames, full_app_captures=[], page_errors=errors, failed_requests=failures,
                  http_errors=http_errors, blocked_external_requests=external)

    def save():
        report.update(passed=sum(c['passed'] for c in checks), failed=sum(not c['passed'] for c in checks))
        (output / 'RESULT.json').write_text(json.dumps(report, indent=2) + '\n')

    def check(name, okay, detail=None):
        checks.append(dict(name=name, passed=bool(okay), detail=detail))
        if not okay:
            raise AssertionError(name + ': ' + str(detail))

    head_images = {}

    def retain_head(name, snapshot, selected=None):
        pixels = base64.b64decode(snapshot.pop('rgba_base64'))
        picture = Image.frombytes('RGBA', tuple(snapshot['dimensions']), pixels)
        path = 'head-diagnostics/' + name + '.png'
        picture.save(output / path)
        metadata = dict(snapshot, path=path, captured_rgba_sha256=hashlib.sha256(pixels).hexdigest())
        if selected is not None:
            metadata['selection'] = selected
        head_images[name] = picture
        return metadata

    servers = []
    server, origin = serve(args.root.resolve())
    servers.append(server)
    try:
        with sync_playwright() as pw:
            launch = dict(headless=True)
            if args.browser == 'chromium':
                launch['args'] = ['--no-sandbox', '--disable-dev-shm-usage']
                if shutil.which('chromium'):
                    launch['executable_path'] = shutil.which('chromium')
            browser = getattr(pw, args.browser).launch(**launch)
            contexts = []

            def open_page(base, label, entrypoint=None):
                context = browser.new_context(viewport=dict(width=390, height=844), timezone_id='UTC', has_touch=True, is_mobile=True)
                contexts.append(context)
                expected = urlsplit(base)[:2]

                def route(request):
                    if urlsplit(request.request.url)[:2] == expected:
                        request.continue_()
                    else:
                        external.append(dict(profile=label, url=request.request.url))
                        request.abort()

                context.route('**/*', route)
                page = context.new_page()
                page.set_default_timeout(120000)
                page.on('pageerror', lambda error: errors.append(dict(profile=label, error=str(error))))
                page.on('requestfailed', lambda request: failures.append(dict(profile=label, url=request.url, error=request.failure)))
                page.on('response', lambda response: http_errors.append(dict(profile=label, url=response.url, status=response.status)) if response.status >= 400 and not response.url.endswith('/favicon.ico') else None)
                response = page.goto(base + (entrypoint or args.entrypoint), wait_until='domcontentloaded', timeout=120000)
                check(label + ': actual entrypoint loads', response is not None and response.status == 200)
                page.wait_for_function('()=>globalThis.HEWRS_READY && HEWRSApp.rejection', timeout=120000)
                page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
                return context, page

            context, page = open_page(origin, 'candidate')
            avatar_profile = validate_profile(page.evaluate(AVATAR_PROFILE))
            expected_avatar = avatar_profile['avatar_sha256']
            expected_hands = [avatar_profile['sources']['left_hand'], avatar_profile['sources']['right_hand']]
            report['avatar_profile'] = avatar_profile
            report['baseline_geometry_policy'] = comparison_policy(avatar_profile)
            check('Active avatar and both hands have exact declared and fetched source bytes for the selected delivery',
                  expected_avatar == expected_delivery_avatar, avatar_profile)
            actual = page.evaluate('()=>HEWRSApp.connection.continuousShirts.ids')
            check('Candidate enables every requested exact shirt ID', all(sid in actual for sid in ids), actual)
            check('Fresh synthetic rejection state is empty and ready', page.evaluate('()=>HEWRSApp.ownerFeedback.status().ready&&!HEWRSApp.feedbackReadError&&HEWRSApp.ownerFeedback.snapshot().active.length===0'))
            report['runtime'] = page.evaluate('()=>({version:HEWRSApp.version,scripts:Array.from(document.querySelectorAll("script[src]"),x=>({src:x.getAttribute("src"),integrity:x.integrity}))})')
            before = protected(page)
            report['all_tie_bindings'] = page.evaluate(ALL_TIES)
            check('All 47 exact tie bindings survive all enabled shirts in three rendering modes', report['all_tie_bindings']['checked'] == len(actual) * 47 * 3 and not report['all_tie_bindings']['failures'], report['all_tie_bindings'])
            reference = page.evaluate(HEAD_REFERENCES)
            check('Canonical head reference uses the pinned active avatar', reference['source_sha256'] == expected_avatar)
            report['head_references'] = dict(source_sha256=reference['source_sha256'], source_url=reference['source_url'], images={})
            for name in ['raw_head', 'native_source', 'native_commit']:
                report['head_references']['images'][name] = retain_head(name, reference[name])
            # Use the same full-size read/commit path as the renderer. WebKit's
            # small default canvas has a different partial-alpha RGB readback.
            # The complete canonical head still requires exact byte equality.
            head = reference['native_commit']['rgba_sha256']
            report['head_reference_authority'] = 'native_commit'
            report['head_reference_comparisons'] = {
                name: head_difference(head_images['raw_head'], head_images[name])
                for name in ['native_source', 'native_commit']
            }
            save()
            baseline_page = None
            if args.baseline_root or issue19:
                baseline_server, baseline_origin = serve(args.root.resolve() if issue19 else args.baseline_root.resolve())
                servers.append(baseline_server)
                baseline_context, baseline_page = open_page(baseline_origin, 'baseline',
                    release['issue19_baseline']['entrypoint'] if issue19 else None)
                baseline_avatar_profile = validate_profile(baseline_page.evaluate(AVATAR_PROFILE))
                report['baseline_avatar_profile'] = baseline_avatar_profile
                if issue19:
                    fidelity = page.evaluate('()=>HEWRSApp.connection.tieFidelity.data')
                    check('Issue 19 retains the original 47-tie source registry',
                          fidelity == baseline_page.evaluate('()=>HEWRSApp.connection.tieFidelity.data'))
                    hand_png = page.evaluate(issue19_contract.HAND_MASK)
                    hand_mask = Image.open(io.BytesIO(base64.b64decode(hand_png.split(',', 1)[1]))).getchannel('A').point(
                        lambda alpha: 255 if alpha == 255 else 0).filter(ImageFilter.MinFilter(3))
                    avatar_png = page.evaluate(issue19_contract.AVATAR_SOURCE)
                    avatar_source = Image.open(io.BytesIO(base64.b64decode(avatar_png.split(',', 1)[1]))).convert('RGBA')
                    report['baseline_geometry_policy'] = {'policy': 'issue19_bounded_fit',
                        'baseline': release['issue19_baseline'],
                        'collar_strips_xyxy': issue19_contract.COLLAR_RECTS,
                        'cuffs_xyxy': issue19_contract.CUFF_RECTS, 'tie_xyxy': issue19_contract.TIE_RECT,
                        'complete_all_shirt_matrix': 'tests/issue19-browser.py'}
                controls = [('DS005', 'NO_TIE', 'shirt-only'), ('DS015', 'T017', 'B03'), ('DS029', 'T029', 'S05')]
                report['unaffected_controls'] = []
                for shirt, state, mode in controls:
                    selected = selection(shirt, state, mode)
                    current, original = page.evaluate(FRAME, selected), baseline_page.evaluate(FRAME, selected)
                    name = 'baseline-' + shirt + '-' + mode + '-' + state
                    report['head_references']['images'][name] = retain_head(
                        name, baseline_page.evaluate('() => (' + HEAD_SNAPSHOT + ')(document.getElementById("avatar"))'), selected)
                    if issue19:
                        images = []
                        for frame in (original, current):
                            image = Image.open(io.BytesIO(base64.b64decode(frame['png'].split(',', 1)[1]))).convert('RGBA')
                            check('Exact decoded native comparison pixels: ' + shirt + '/' + mode,
                                  image.size == (996, 2748) and hashlib.sha256(image.tobytes()).hexdigest() == frame['rgba_sha256'])
                            images.append(image)
                        difference = issue19_contract.change_check(images[0], images[1], selected, hand_mask, avatar_source)
                        difference['policy'] = 'issue19_bounded_fit'
                        check('Original garment sources and exact same-ID tie sources remain registered: ' + shirt + '/' + mode,
                              issue19_contract.source_identity(current['source_bindings'], state, fidelity)
                              == issue19_contract.source_identity(original['source_bindings'], state, fidelity))
                        check('Final collar, cuffs and tie stay inside independent Issue 19 boundaries: ' + shirt + '/' + mode,
                              difference['outside_allowed_pixels'] == 0, difference)
                        check('Approved posed hands remain exact: ' + shirt + '/' + mode,
                              difference['opaque_hand_pixels_changed'] == 0, difference)
                        check('Neck cleanup reveals exact original avatar pixels: ' + shirt + '/' + mode,
                              difference['neck_corner_wrong_source_pixels'] == 0, difference)
                        shoulder_samples = issue19_contract.shoulder_contour_samples(images[1], selected)
                        if shoulder_samples:
                            check('Original shoulder BODY coverage remains intact: ' + shirt + '/' + mode, True, shoulder_samples)
                        difference['shoulder_contour_regressions'] = shoulder_samples
                        check('Final frame uses the exact approved V3 head: ' + shirt + '/' + mode,
                              current['head_sha256'] == original['head_sha256'] == head)
                    elif avatar_profile['version'] == 'v3':
                        difference = native_difference(current['png'], original['png'], current['rgba_sha256'],
                            original['rgba_sha256'], avatar_profile, baseline_avatar_profile, args.root,
                            selection=selected, source_bindings=current['source_bindings'])
                        check('Delegated original garment sources stay exact: ' + shirt + '/' + mode,
                              current['source_bindings'] == original['source_bindings'])
                        check('Delegated frame changes only inside the declared V3 geometry mask for this selection: ' + shirt + '/' + mode,
                              difference['outside_permitted_mask_changed_pixels'] == 0, difference)
                        check('Delegated frame uses the exact active V3 head: ' + shirt + '/' + mode,
                              current['head_sha256'] == head)
                    else:
                        check('Unchanged delegated full frame: ' + shirt + '/' + mode, current['rgba_sha256'] == original['rgba_sha256'])
                        difference = dict(policy='exact_original_pixels', changed_pixels=0)
                    report['unaffected_controls'].append(dict(selection=selected, rgba_sha256=current['rgba_sha256'],
                        baseline_rgba_sha256=original['rgba_sha256'], head_sha256=original['head_sha256'],
                        head_reference=name, full_frame_identical=current['rgba_sha256'] == original['rgba_sha256'],
                        comparison=difference))
            for row in fixtures(ids, modes):
                selected, mode = row['selection'], row['mode']
                label = selected['shirtId'] + '-' + mode + '-' + selected['state']
                result = page.evaluate(FRAME, selected)
                raw = base64.b64decode(result.pop('png').split(',', 1)[1])
                picture = Image.open(io.BytesIO(raw)).convert('RGBA')
                # Preserve the failing frame before any assertion. A failed
                # browser gate must leave the exact pixels available for review.
                native_path, upper_path, phone_path = 'native/' + label + '.png', 'upper/' + label + '.png', 'phone/' + label + '.png'
                (output / native_path).write_bytes(raw)
                picture.crop((0, 0, 996, 1440)).save(output / upper_path)
                result.update(mode=mode, primary=row['primary'], native_path=native_path, upper_path=upper_path,
                              phone_path=phone_path, validation_complete=False)
                frames.append(result)
                save()
                page.locator('#avatar').screenshot(path=str(output / phone_path))
                if capture_full_app(selected, mode):
                    full_page_path = 'full-page/' + label + '.png'
                    option_items_path = 'option-card-items/' + label + '.png'
                    page.screenshot(path=str(output / full_page_path), full_page=True)
                    page.locator('#option-card-items').screenshot(path=str(output / option_items_path))
                    result['full_page_path'], result['option_card_items_path'] = full_page_path, option_items_path
                    capture = dict(selection=selected, mode=mode, viewport_width=390,
                                   full_page_path=full_page_path, option_card_items_path=option_items_path)
                    report['full_app_captures'].append(capture)
                    if label == 'DS035-B02-T029':
                        original_top = page.locator('#page-outfits').evaluate('(element)=>element.scrollTop')
                        try:
                            controls = page.evaluate('''async()=>{
                              const page=document.getElementById('page-outfits');page.scrollTop=page.scrollHeight;
                              await new Promise(requestAnimationFrame);
                              const bounds=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
                              return {scroll_top:page.scrollTop,scroll_height:page.scrollHeight,client_height:page.clientHeight,
                                page_bounds:bounds(page),toolbar_bounds:bounds(page.querySelector('.lb-toolbar')),
                                navigation_bounds:bounds(page.querySelector('.lb-card-controls'))};
                            }''')
                            controls['path'] = 'full-page/' + label + '-scrolled-controls.png'
                            page.screenshot(path=str(output / controls['path']), full_page=True)
                            result['scrolled_controls'] = controls
                            capture['scrolled_controls_path'] = controls['path']
                            save()
                            box, viewport = controls['toolbar_bounds'], controls['page_bounds']
                            check(label + ': toolbar remains reachable inside the scrolled phone page',
                                  box['height'] > 0 and box['top'] >= viewport['top'] and box['bottom'] <= viewport['bottom']
                                  and box['left'] >= viewport['left'] and box['right'] <= viewport['right'], controls)
                        finally:
                            page.locator('#page-outfits').evaluate('(element,top)=>{element.scrollTop=top;}', original_top)
                head_detail = dict(source_expected=expected_avatar, source_actual=result['plan']['avatar'],
                                   expected_reference='native_commit', expected_head_sha256=head,
                                   raw_head_sha256=reference['raw_head']['rgba_sha256'], actual_head_sha256=result['head_sha256'])
                if result['head_sha256'] != head:
                    name = 'actual-' + label
                    head_detail['actual'] = retain_head(
                        name, page.evaluate('() => (' + HEAD_SNAPSHOT + ')(document.getElementById("avatar"))'), selected)
                    if baseline_page is not None:
                        baseline_frame = baseline_page.evaluate(FRAME, selected)
                        baseline_native_path = 'head-diagnostics/baseline-matching-' + label + '-native.png'
                        (output / baseline_native_path).write_bytes(base64.b64decode(baseline_frame.pop('png').split(',', 1)[1]))
                        baseline_name = 'baseline-matching-' + label
                        report['head_references']['images'][baseline_name] = retain_head(
                            baseline_name, baseline_page.evaluate('() => (' + HEAD_SNAPSHOT + ')(document.getElementById("avatar"))'), selected)
                        head_detail['baseline_matching_native_path'] = baseline_native_path
                        head_detail['baseline_matching_head_reference'] = baseline_name
                    head_detail['comparisons'] = {
                        reference_name: head_difference(image, head_images[name])
                        for reference_name, image in head_images.items() if reference_name != name
                    }
                result['head_diagnostics'] = head_detail
                save()
                check(label + ': selected and committed outfit identities agree', result['selection'] == selected and result['last'] == selected)
                check(label + ': complete native frame', result['status'] == 'ready' and result['dimensions'] == [996, 2748] and picture.size == (996, 2748))
                check(label + ': decoded pixels match browser digest', hashlib.sha256(picture.tobytes()).hexdigest() == result['rgba_sha256'])
                check(label + ': corrected whole garment route excludes old ownership', result['plan']['operation'] == 'CONTINUOUS_SOURCE_SHIRT' and result['plan']['body'] and not result['plan']['borrowed_ownership'])
                check(label + ': pinned active avatar registration, hand sources and head pixels remain exact',
                      result['plan']['avatar'] == expected_avatar and result['plan']['hands'] == expected_hands
                      and result['head_sha256'] == head, head_detail)
                check(label + ': registered garment previews and exact shirt/tie identities remain available', result['photos_decoded'] and result['card_shirt']['id'] == selected['shirtId'] and result['card_tie']['id'] == (None if selected['state'] == 'NO_TIE' else selected['state']))
                layout = result['layout']
                check(label + ': native outfit remains inside 390px phone layout', layout['viewport'] == 390 and layout['document_width'] <= 391 and layout['canvas_left'] >= -1 and layout['canvas_right'] <= 391 and layout['canvas_height'] > 0, layout)
                result['validation_complete'] = True
                save()
                print('CAPTURED ' + label, flush=True)
            check('Render-only review leaves wear, Favorites and rejection records unchanged', protected(page) == before)
            check('No application exception or failed asset request', not errors and not failures and not http_errors, dict(errors=errors, requests=failures, http=http_errors))
            check('No external or provider request', not external, external)
            make_sheets(output, frames)
            for item in contexts:
                item.close()
            browser.close()
    except Exception:
        report['error'] = traceback.format_exc()
        checks.append(dict(name='Continuous garment browser review completed', passed=False, detail=report['error']))
        print(report['error'], flush=True)
    finally:
        for server in servers:
            server.shutdown()
        report['finished_at'] = datetime.now(timezone.utc).isoformat()
        save()
    print(json.dumps(dict(browser=args.browser, passed=report['passed'], failed=report['failed'], frames=len(frames), output=str(output))), flush=True)
    if report['failed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
