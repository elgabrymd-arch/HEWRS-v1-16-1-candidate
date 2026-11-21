#!/usr/bin/env python3
"""Exercise the shipped app's full shirt roster, collar states and photo controls.

Fresh profiles only. Optional baseline rendering compares decoded native pixels,
not screenshots or compressed thumbnails. No owner storage or private PDF is read.
"""
import argparse
import base64
import functools
import hashlib
import importlib.util
import io
import json
import sys
import threading
import traceback
import urllib.parse
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright
from avatar_geometry_contract import (AVATAR_PROFILE, PLAN_SOURCES, comparison_policy,
                                      native_difference, validate_profile)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from verify_active_delivery import AVATAR_SHA256, INPUT_SHA256, TARGET_IDS, describe
MODES = ('suit', 'blazer', 'shirt-only')
NATIVE_COLLAR_BBOX = (170, 330, 656, 826)  # Full-canvas x, y, width, height.
COLLAR_DETAIL_BBOX = (320, 330, 360, 260)  # Entire registered collar, at 1:1 pixels.


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


FRAME = r'''async input => {
 const selection=input.selection||input,captureNativeCollar=input.captureNativeCollar===true;
 const app=HEWRSApp;
 const result=await app.apply(selection,{origin:'manual',save:false,keepPreferences:true});
 if(result?.cancelled)throw Error('Unexpected audit render cancellation');
 const canvas=document.getElementById('avatar'),cx=canvas.getContext('2d',{willReadFrequently:true});
 const rgba=cx.getImageData(0,0,canvas.width,canvas.height).data;
 const digest=await crypto.subtle.digest('SHA-256',rgba);
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const headDigest=await crypto.subtle.digest('SHA-256',cx.getImageData(0,0,996,350).data);
 const headHash=Array.from(new Uint8Array(headDigest),b=>b.toString(16).padStart(2,'0')).join('');
 const detail=document.createElement('canvas');detail.width=262;detail.height=306;
 detail.getContext('2d').drawImage(canvas,170,390,656,766,0,0,262,306);
 let nativeCollar=null;
 if(captureNativeCollar){
  const crop=document.createElement('canvas');crop.width=656;crop.height=826;
  const cropContext=crop.getContext('2d',{willReadFrequently:true});
  cropContext.putImageData(cx.getImageData(170,330,656,826),0,0);
  const cropDigest=await crypto.subtle.digest('SHA-256',cropContext.getImageData(0,0,656,826).data);
  nativeCollar={png:crop.toDataURL('image/png'),source_bbox:[170,330,656,826],
   source_canvas_dimensions:[canvas.width,canvas.height],native_dimensions:[656,826],
   rgba_sha256:Array.from(new Uint8Array(cropDigest),b=>b.toString(16).padStart(2,'0')).join('')};
 }
 const model=app.cardSnapshot();
 const sourceBindings=(''' + PLAN_SOURCES + r''')(app.renderer.plan(selection));
 const thumbnails=Array.from(document.querySelectorAll('#option-card-items img'));
 await Promise.all(thumbnails.map(image=>image.decode()));
 if(thumbnails.some(image=>image.hidden||!image.naturalWidth||!image.naturalHeight))throw Error('An actual card photograph did not decode');
 return {selection:app.state().selection,last:app.renderer.last(),status:canvas.dataset.status,
  width:canvas.width,height:canvas.height,rgba_sha256:hash,detail:detail.toDataURL('image/png'),native_collar:nativeCollar,
  comparison_png:input.captureComparison===true?canvas.toDataURL('image/png'):null,
  head_rgba_sha256:headHash,
  source_bindings:sourceBindings,
  actual_render:{operation:result?.source_result?.operation||null,
   shirt_id:result?.source_result?.shirt_id||null,
   avatar_source_sha256:result?.source_result?.avatar_source_sha256||null,
   legacy_shirt_layers_used:result?.source_result?.legacy_shirt_layers_used??null},
  shirt:model.items.find(x=>x.role==='Shirt'),tie:model.items.find(x=>x.role==='Tie')};
}'''

CANONICAL_HEAD = r'''async () => {
 const app=HEWRSApp,descriptor=app.connection.manifest.static.avatar,url=app.resolveUrl(descriptor);
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const response=await fetch(url);if(!response.ok)throw Error('Frozen avatar source did not load');
 const sourceHash=await digest(await response.arrayBuffer());
 if(sourceHash!==descriptor.sha256)throw Error('Frozen avatar image bytes differ from source pin');
 const image=new Image();image.src=url;await image.decode();
 if(image.naturalWidth!==996||image.naturalHeight!==2748)throw Error('Frozen avatar native dimensions differ');
 // Match the application's full native CPU-backed render and atomic commit.
 // A 350-high/default-context canvas is a different WebKit decode/read path.
 const source=document.createElement('canvas');source.width=996;source.height=2748;
 const src=source.getContext('2d',{willReadFrequently:true});src.drawImage(image,0,0);
 const committed=document.createElement('canvas');committed.width=996;committed.height=2748;
 const dst=committed.getContext('2d',{willReadFrequently:true});
 dst.putImageData(src.getImageData(0,0,996,2748),0,0);
 return {source_sha256:sourceHash,canvas_dimensions:[996,2748],head_bbox_xywh:[0,0,996,350],
  construction:'full-native-willReadFrequently-source-and-ImageData-commit',
  head_rgba_sha256:await digest(dst.getImageData(0,0,996,350).data)};
}'''

REVIEWED_B01_FRAME = r'''async selection => {
 const app=HEWRSApp,panel=HEWRSReviewedIntegration,before=app.state().selection;
 await panel.load({initialUpdate:false});
 const settings={
  'rd-view':'explore','rd-style':'AUTO','rd-occasion':'dinner',
  'rd-mode':'blazer','rd-formality':'open_collar_allowed',
  'rd-b01-context':'summer_weekend_dinner','rd-topwear':'B01',
  'rd-pants':'PT006','rd-shirt':'DS026','rd-tie':'__NONE__',
  'rd-shoe':'shoe-8','rd-watch-choice':'__NONE__'
 };
 for(const [id,value]of Object.entries(settings)){
  const control=document.getElementById(id);control.value=value;
  if(control.value!==value)throw Error('Missing exact reviewed choice: '+id+'='+value);
 }
 // A change to the real watch control also updates the panel's captured watch.
 // Other filters are already exact, so this cannot start a broad search.
 document.getElementById('rd-watch-choice').dispatchEvent(new Event('change',{bubbles:true}));
 const dialog=document.getElementById('rd-dialog');if(!dialog.open)dialog.showModal();
 const context=panel.ownerContext(),policy=HEWRSOutfitFeedback.ownerRuleCheck(selection,{context});
 if(!policy.allowed||!app.ownerFeedback.allowed(selection,context))throw Error('B01 fixture violates its explicit owner context');
 const search=await panel.update();
 if(!search||search.all_possibilities.length!==1||search.counts.clothing_considered!==1||search.counts.footwear_expansions!==1)throw Error('Exact B01 search did not return exactly one supported possibility');
 const entry=search.all_possibilities[0],rendered=await panel.render(entry.id);
 if(rendered?.status!=='ready'||!rendered.unreviewed||entry.owner_approved!==false)throw Error('B01 preview was not an unreviewed exact native render');
 const canvas=document.getElementById('rd-canvas'),cx=canvas.getContext('2d',{willReadFrequently:true});
 const digest=await crypto.subtle.digest('SHA-256',cx.getImageData(0,0,canvas.width,canvas.height).data);
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const images=Array.from(document.querySelectorAll('#rd-component-cards img'));
 await Promise.all(images.map(image=>image.decode()));
 if(!images.length||images.some(image=>image.hidden||!image.naturalWidth||!image.naturalHeight))throw Error('B01 native component photographs did not decode');
 const selected=panel.discovery().nativeSelection(panel.currentEntry().outfit,panel.watch());
 const headDigest=await crypto.subtle.digest('SHA-256',cx.getImageData(0,0,996,350).data);
 return {route:'reviewed-explicit-b01-use-case',selection:selected,rendered_selection:rendered.selection,
  context,policy,request:panel.request(),search_counts:search.counts,entry_kind:entry.kind,
  owner_approved:entry.owner_approved,main_selection_unchanged:JSON.stringify(before)===JSON.stringify(app.state().selection),
  status:canvas.dataset.status,width:canvas.width,height:canvas.height,rgba_sha256:hash,
  comparison_png:canvas.toDataURL('image/png'),
  head_rgba_sha256:Array.from(new Uint8Array(headDigest),b=>b.toString(16).padStart(2,'0')).join(''),
  source_bindings:(''' + PLAN_SOURCES + r''')(app.renderer.plan(selection)),
  preview_visible:!document.getElementById('rd-preview').hidden};
}'''


def intentional_difference(current_png, baseline_png, current_hash, baseline_hash):
    images = [Image.open(io.BytesIO(base64.b64decode(value.split(',', 1)[1]))).convert('RGBA')
              for value in (current_png, baseline_png)]
    if any(image.size != (996, 2748) for image in images):
        raise AssertionError('Comparison is not a complete native frame')
    if [hashlib.sha256(image.tobytes()).hexdigest() for image in images] != [current_hash, baseline_hash]:
        raise AssertionError('Decoded comparison pixels do not match actual rendered pixels')
    channels = ImageChops.difference(*images).split()
    changed = channels[0]
    for channel in channels[1:]:
        changed = ImageChops.lighter(changed, channel)
    head_changed = changed.crop((0, 0, 996, 350))
    return dict(changed_pixels=sum(changed.histogram()[1:]), changed_bbox_xyxy=changed.getbbox(),
                head_changed_pixels=sum(head_changed.histogram()[1:]),
                head_changed_bbox_xyxy=head_changed.getbbox(), native_dimensions=[996, 2748])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', choices=('chromium', 'webkit'), default='chromium')
    parser.add_argument('--baseline-root', type=Path)
    parser.add_argument('--url')
    args = parser.parse_args()
    active_delivery = describe()
    continuous = active_delivery.get('target_ids') == list(TARGET_IDS)
    expected_avatar = active_delivery.get('avatar_sha256', AVATAR_SHA256)
    release = json.loads((ROOT / 'AVATAR_V3_RELEASE.json').read_text()) if active_delivery['kind'] == 'avatar-v3' else {}
    issue19 = release.get('issue19_baseline', {}).get('entrypoint') == 'avatar-v3-issue19-baseline.html'
    issue19_contract = None
    if issue19:
        # describe() has already validated every release/source/runtime pin.
        # The exact previous V3 page gives a stricter comparison for this
        # follow-up than adding new allowances to an older V2 geometry mask.
        if hashlib.sha256((ROOT / 'avatar-v3-issue19-baseline.html').read_bytes()).hexdigest() != '4670d41cc6139d12956dfbd064692e92fe28c719160ec2e142754b2e22de718b':
            raise AssertionError('Issue 19 requires the exact published V3 baseline page')
        fit_spec = importlib.util.spec_from_file_location('issue19_photo_contract', ROOT / 'tests/issue19-browser.py')
        issue19_contract = importlib.util.module_from_spec(fit_spec)
        fit_spec.loader.exec_module(issue19_contract)
    catalogue = json.loads((ROOT / 'evidence/five_round_20261119/CATALOGUE.json').read_text())
    shirts = sorted(catalogue['shirts'], key=lambda row: row['id'])
    # The catalogue retains the original photographic baseline. Only these
    # exact corrected card mappings are read from the current source manifest.
    if continuous:
        current_cards = json.loads((ROOT / 'data/option-card-thumbnails.json').read_text())
        for shirt in shirts:
            if shirt['id'] in TARGET_IDS:
                if shirt.get('nonSuitThumbnails'):
                    raise AssertionError('An unexpected non-suit override hides a corrected shirt card')
                shirt['thumbnails'] = current_cards['shirts'][shirt['id']]
    server = baseline_server = None
    if args.url:
        base = args.url
    else:
        server, base = serve(ROOT)
    baseline_base = None
    if issue19:
        baseline_server, baseline_base = serve(ROOT)
        baseline_base += '/avatar-v3-issue19-baseline.html'
    elif args.baseline_root:
        baseline_server, baseline_base = serve(args.baseline_root)
    output = ROOT / 'evidence/five_round_20261119/browser' / args.browser / ('live-photos' if args.url else 'photos')
    output.mkdir(parents=True, exist_ok=True)
    checks, frames, errors, failed_requests, http_errors, external_requests = [], [], [], [], [], []
    result = dict(schema='hewrs.five-round-shirt-browser.v1', browser=args.browser, url=base,
                  active_delivery=active_delivery,
                  baseline_policy=dict(original_garment_comparison=('exact approved V3 baseline; only bounded collar, same-ID tie and jacket cuff corrections' if issue19 else 'exact full native RGBA for V2; exact outside the declared V3 avatar/pose mask for V3'),
                      intentional_correction_ids=([row['id'] for row in shirts] if issue19 else list(TARGET_IDS) if continuous else []),
                      frozen_head_bbox_xywh=[0, 0, 996, 350],
                      frozen_head_reference=('exact canonical native commit of the pinned avatar; old baseline head differences are recorded' if continuous else None),
                      detailed_corrected_geometry_gate=('tests/issue19-browser.py' if issue19 else 'tests/continuous-shirts-browser.py' if continuous else None)),
                  baseline_compared=bool(baseline_base), owner_data_accessed=False,
                  started_at=datetime.now(timezone.utc).isoformat(), checks=checks, frames=frames,
                  page_errors=errors, failed_requests=failed_requests, http_errors=http_errors,
                  external_requests=external_requests,
                  collar_evidence=dict(source_canvas_dimensions=[996, 2748],
                      native_crop_bbox=list(NATIVE_COLLAR_BBOX), native_crop_dimensions=[656, 826],
                      bbox_units='full-canvas x, y, width, height',
                      original_sheet_crop_bbox=[170, 390, 656, 766],
                      detail_sheet_bbox=list(COLLAR_DETAIL_BBOX), detail_sheet_scale=1,
                      detail_sheet_description='Unscaled native RGBA crop on neutral background. Entire registered collar is included; wider native PNGs preserve neck/chest context.',
                      native_png_directory='native-collars', expected_native_png_count=288))
    pictures, native_pictures = {}, {}
    canonical_head = avatar_profile = baseline_avatar_profile = None
    issue19_hands = issue19_fidelity = issue19_avatar = None

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

    def issue19_comparison(frame, baseline, current_png, original_png, selection, label):
        current, _ = issue19_contract.decode_frame({'png': current_png, 'full_sha256': frame['rgba_sha256']})
        original, _ = issue19_contract.decode_frame({'png': original_png, 'full_sha256': baseline['rgba_sha256']})
        difference = issue19_contract.change_check(original, current, selection, issue19_hands, issue19_avatar)
        check(label + ': original garments and exact same physical tie sources remain registered',
              issue19_contract.source_identity(frame['source_bindings'], selection['state'], issue19_fidelity)
              == issue19_contract.source_identity(baseline['source_bindings'], selection['state'], issue19_fidelity))
        check(label + ': approved V3 head and opaque hand pixels remain exact',
              frame['head_rgba_sha256'] == baseline['head_rgba_sha256']
              and difference['opaque_hand_pixels_changed'] == 0, difference)
        check(label + ': every changed pixel stays inside the independent Issue 19 fit bounds',
              difference['outside_allowed_pixels'] == 0, difference)
        check(label + ': neck cleanup reveals exact original avatar pixels', difference['neck_corner_wrong_source_pixels'] == 0, difference)
        if selection.get('shirtOnly'):
            check(label + ': original shirt-only sleeves remain exact',
                  all(current.crop(rect).tobytes() == original.crop(rect).tobytes() for rect in issue19_contract.CUFF_RECTS))
        return dict(policy='issue19_bounded_fit', baseline_commit=issue19_contract.BASELINE, difference=difference)

    def render(page, selection, label, baseline_page=None, capture_key=None):
        corrected = continuous and selection['shirtId'] in TARGET_IDS
        compare_native = baseline_page is not None and (corrected or avatar_profile['version'] == 'v3')
        frame = page.evaluate(FRAME, dict(selection=selection, captureNativeCollar=bool(capture_key), captureComparison=compare_native))
        image = frame.pop('detail')
        native_collar = frame.pop('native_collar')
        comparison_png = frame.pop('comparison_png')
        check(label + ': exact selection and committed renderer agree', frame['selection'] == selection and frame['last'] == selection, frame['selection'])
        check(label + ': complete native frame is ready', frame['status'] == 'ready' and (frame['width'], frame['height']) == (996, 2748))
        if corrected:
            actual = frame['actual_render']
            check(label + ': actual completed render uses the exact continuous shirt and pinned active avatar',
                  actual['operation'] == 'CONTINUOUS_SOURCE_SHIRT'
                  and actual['shirt_id'] == selection['shirtId']
                  and actual['legacy_shirt_layers_used'] is False
                  and actual['avatar_source_sha256'] == expected_avatar, actual)
        else:
            check(label + ': original shirt does not enter the continuous correction', frame['actual_render']['operation'] != 'CONTINUOUS_SOURCE_SHIRT')
        if corrected or avatar_profile['version'] == 'v3':
            check(label + ': committed head pixels exactly match the pinned active avatar source',
                  frame['head_rgba_sha256'] == canonical_head['head_rgba_sha256'])
        if baseline_page is not None:
            baseline = baseline_page.evaluate(FRAME, dict(selection=selection, captureComparison=compare_native))
            frame['baseline_rgba_sha256'] = baseline['rgba_sha256']
            if issue19:
                frame['baseline_comparison'] = issue19_comparison(frame, baseline, comparison_png,
                    baseline['comparison_png'], selection, label)
            elif corrected and baseline['actual_render']['operation'] != 'CONTINUOUS_SOURCE_SHIRT':
                difference = intentional_difference(comparison_png, baseline['comparison_png'], frame['rgba_sha256'], baseline['rgba_sha256'])
                check(label + ': authorized garment correction changes native pixels', difference['changed_pixels'] > 0, difference)
                # The old DS051/S05 PARENT_DS051_STORED_RGB profile changes RGB
                # at partial-alpha head edges. Preserve that measured difference
                # while the canonical-source gate above still checks every pixel.
                frame['baseline_comparison'] = dict(policy='intentional_eight_shirt_correction',
                    active_avatar_policy=comparison_policy(avatar_profile, selection),
                    canonical_active_head_equal=True,
                    canonical_head_rgba_sha256=canonical_head['head_rgba_sha256'],
                    baseline_head_equal=frame['head_rgba_sha256'] == baseline['head_rgba_sha256'],
                    baseline_head_rgba_sha256=baseline['head_rgba_sha256'], **difference)
            elif avatar_profile['version'] == 'v3':
                difference = native_difference(comparison_png, baseline['comparison_png'],
                    frame['rgba_sha256'], baseline['rgba_sha256'], avatar_profile, baseline_avatar_profile, ROOT,
                    selection=selection, source_bindings=frame['source_bindings'])
                check(label + ': original garment source descriptors exactly match the baseline',
                      frame['source_bindings'] == baseline['source_bindings'])
                check(label + ': baseline pixel changes stay inside the declared V3 geometry mask for this selection',
                      difference['outside_permitted_mask_changed_pixels'] == 0, difference)
                frame['baseline_comparison'] = dict(policy='original_garments_v3_avatar_geometry', **{'difference': difference})
            else:
                check(label + ': approved native pixels equal the published baseline', baseline['rgba_sha256'] == frame['rgba_sha256'])
                frame['baseline_comparison'] = dict(policy='exact_original_pixels', changed_pixels=0)
        if capture_key:
            pictures[capture_key] = Image.open(io.BytesIO(base64.b64decode(image.split(',', 1)[1]))).convert('RGBA')
            native_bytes = base64.b64decode(native_collar.pop('png').split(',', 1)[1])
            native_pic = Image.open(io.BytesIO(native_bytes)).convert('RGBA')
            check(label + ': complete native-resolution collar evidence decodes exactly',
                  native_pic.size == (656, 826)
                  and native_collar['source_bbox'] == list(NATIVE_COLLAR_BBOX)
                  and native_collar['source_canvas_dimensions'] == [996, 2748]
                  and hashlib.sha256(native_pic.tobytes()).hexdigest() == native_collar['rgba_sha256'])
            native_path = output / 'native-collars' / ('-'.join(capture_key) + '.png')
            native_path.parent.mkdir(parents=True, exist_ok=True)
            native_path.write_bytes(native_bytes)
            native_collar.update(path=str(native_path.relative_to(output)),
                                 png_sha256=hashlib.sha256(native_bytes).hexdigest())
            frame['native_collar_capture'] = native_collar
            native_pictures[capture_key] = native_pic
        frames.append(dict(label=label, **frame))
        return frame

    def blocked_owner_fixture(page, selection, expected_reasons, label):
        blocked = page.evaluate('''async selection=>{
          const before=HEWRSApp.state().selection,context={occasion:'work',requiredFormality:'any'};
          const policy=HEWRSOutfitFeedback.ownerRuleCheck(selection,{context});
          try{await HEWRSApp.apply(selection,{save:false,context});return {blocked:false,policy};}
          catch(error){return {blocked:true,message:error.message,policy,
            unchanged:JSON.stringify(before)===JSON.stringify(HEWRSApp.state().selection)};}
        }''', selection)
        actual_reasons = [row['id'] for row in blocked['policy']['reasons']]
        check(label + ': invalid common fixture is blocked without changing the current outfit',
              blocked.get('blocked') and blocked.get('unchanged') and not blocked['policy']['allowed']
              and actual_reasons == expected_reasons, blocked)

    def render_b01(page, baseline_page):
        selected = outfit('blazer', 'DS026', 'NO_TIE', top='B01', pants='PT006')
        frame = page.evaluate(REVIEWED_B01_FRAME, selected)
        comparison_png = frame.pop('comparison_png')
        check('topwear/B01: exact supported preview uses the explicit summer weekend dinner context',
              frame['selection'] == selected and frame['rendered_selection'] == selected
              and frame['context']['occasion'] == 'dinner'
              and frame['context']['owner_use_case'] == 'summer_weekend_dinner'
              and frame['policy']['allowed'], frame)
        check('topwear/B01: exact unreviewed possibility does not claim owner approval or replace the Home outfit',
              frame['entry_kind'] == 'unreviewed_possibility' and frame['owner_approved'] is False
              and frame['main_selection_unchanged'])
        check('topwear/B01: complete native frame is ready in the supported reviewed route',
              frame['preview_visible'] and frame['status'] == 'ready'
              and (frame['width'], frame['height']) == (996, 2748))
        if avatar_profile['version'] == 'v3':
            check('topwear/B01: reviewed route uses the exact active V3 head',
                  frame['head_rgba_sha256'] == canonical_head['head_rgba_sha256'])
        if baseline_page is not None:
            baseline = baseline_page.evaluate(REVIEWED_B01_FRAME, selected)
            frame['baseline_rgba_sha256'] = baseline['rgba_sha256']
            check('topwear/B01: baseline exact native selection agrees',
                  baseline['selection'] == selected and baseline['rendered_selection'] == selected)
            if issue19:
                frame['baseline_comparison'] = issue19_comparison(frame, baseline, comparison_png,
                    baseline['comparison_png'], selected, 'topwear/B01')
            elif avatar_profile['version'] == 'v3':
                difference = native_difference(comparison_png, baseline['comparison_png'], frame['rgba_sha256'],
                    baseline['rgba_sha256'], avatar_profile, baseline_avatar_profile, ROOT,
                    selection=selected, source_bindings=frame['source_bindings'])
                check('topwear/B01: original garment sources remain exact and pixel changes stay inside the declared V3 geometry mask',
                      frame['source_bindings'] == baseline['source_bindings']
                      and difference['outside_permitted_mask_changed_pixels'] == 0, difference)
                frame['baseline_comparison'] = difference
            else:
                check('topwear/B01: approved native pixels equal the published baseline', baseline['rgba_sha256'] == frame['rgba_sha256'])
            baseline_page.evaluate('HEWRSReviewedIntegration.close()')
        page.screenshot(path=str(output / 'B01-explicit-summer-weekend-dinner.png'))
        page.evaluate('HEWRSReviewedIntegration.close()')
        frames.append(dict(label='topwear/B01', **frame))

    browser = page = baseline_context = None
    try:
        with sync_playwright() as pw:
            browser = getattr(pw, args.browser).launch(headless=True)
            context, page = new_page(browser, base, 'current')
            avatar_profile = validate_profile(page.evaluate(AVATAR_PROFILE))
            check('Active avatar and both hand sources match their exact declared and fetched byte pins',
                  avatar_profile['avatar_sha256'] == expected_avatar, avatar_profile)
            result['avatar_profile'] = avatar_profile
            result['baseline_policy']['avatar_geometry'] = comparison_policy(avatar_profile)
            loaded = page.evaluate('()=>({scripts:Array.from(document.scripts,s=>s.getAttribute("src")).filter(Boolean),ids:globalThis.HEWRSContinuousShirts?.allowedIds||null,source:HEWRSApp.connection.continuousShirts?.source_input_sha256||null,avatar:HEWRSApp.connection.manifest.static.avatar.sha256})')
            expected_runtime = active_delivery['runtime'] + '?v=' + active_delivery['runtime_sha256'][:16]
            check('Actual browser loads the exact audited runtime', loaded['scripts'].count(expected_runtime) == 1, loaded['scripts'])
            if continuous:
                check('Only the eight authorized shirts activate the continuous baseline exception', loaded['ids'] == list(TARGET_IDS) and loaded['source'] == INPUT_SHA256 and loaded['avatar'] == expected_avatar, loaded)
                canonical_head = page.evaluate(CANONICAL_HEAD)
                check('Canonical head reference verifies the immutable avatar bytes and native commit',
                      canonical_head['source_sha256'] == expected_avatar
                      and canonical_head['canvas_dimensions'] == [996, 2748]
                      and canonical_head['head_bbox_xywh'] == [0, 0, 996, 350])
                result['canonical_head_reference'] = canonical_head
            baseline_page = None
            if baseline_base:
                baseline_context, baseline_page = new_page(browser, baseline_base, 'baseline')
                baseline_avatar_profile = validate_profile(baseline_page.evaluate(AVATAR_PROFILE))
                result['baseline_avatar_profile'] = baseline_avatar_profile
            if issue19:
                fit = page.evaluate("()=>({collar:globalThis.HEWRSAvatarV3ShirtCollarFit?.spec,cuff:globalThis.HEWRSAvatarV3CuffFit?.spec,tie:globalThis.HEWRSAvatarV3TieFit?.spec})")
                check('Published Issue 19 runtime contains all three source-bound fit modules',
                      fit.get('collar', {}).get('revision') == 'AVATAR_V3_ALL_SHIRT_COLLAR_FIT_4'
                      and fit.get('cuff', {}).get('revision') == 'AVATAR_V3_CONCEALED_CUFFS_2'
                      and fit.get('tie', {}).get('revision') == 'AVATAR_V3_TIE_FIT_1', fit)
                issue19_fidelity = page.evaluate('()=>HEWRSApp.connection.tieFidelity.data')
                check('Published tie source registry equals the original V3 registry',
                      issue19_fidelity == baseline_page.evaluate('()=>HEWRSApp.connection.tieFidelity.data'))
                mask_png = page.evaluate(issue19_contract.HAND_MASK)
                mask = Image.open(io.BytesIO(base64.b64decode(mask_png.split(',', 1)[1]))).getchannel('A')
                issue19_hands = mask.point(lambda value: 255 if value == 255 else 0).filter(ImageFilter.MinFilter(3))
                avatar_png = page.evaluate(issue19_contract.AVATAR_SOURCE)
                issue19_avatar = Image.open(io.BytesIO(base64.b64decode(avatar_png.split(',', 1)[1]))).convert('RGBA')
                result['issue19_fit_contracts'] = fit
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
            check('All 288 complete native-resolution collar crops were saved', len(native_pictures) == 288)
            if continuous and baseline_page is not None:
                original_ids = sorted({row['selection']['shirtId'] for row in frames if row['selection']['shirtId'] not in TARGET_IDS
                    and row['baseline_comparison']['policy'] in ('exact_original_pixels', 'original_garments_v3_avatar_geometry', 'issue19_bounded_fit')})
                check('All 42 legacy shirts preserve original garment sources and pixels outside the exact authorized geometry', len(original_ids) == 42 and original_ids == sorted(set(live_roster['shirts']) - set(TARGET_IDS)))
                corrected_frames = [row for row in frames if row['selection']['shirtId'] in TARGET_IDS]
                check('All 48 corrected shirt/context/collar frames ran the source-locked renderer and preserved the pinned active head', len(corrected_frames) == 48)
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
                if top in ('B01', 'B11'):
                    reasons = ['OWNER-' + top + '-NO-TIE']
                    if top == 'B01':
                        reasons += ['OWNER-B01-NOT-WORK', 'OWNER-B01-SUMMER-CONTEXT', 'OWNER-B01-TROUSERS']
                    blocked_owner_fixture(page, outfit('blazer', 'DS026', 'T029', top=top), reasons, 'topwear/' + top)
                if top == 'B01':
                    # Home has no B01 use-case selector. The existing reviewed
                    # route exposes it and preserves the owner's exact rule.
                    render_b01(page, baseline_page)
                else:
                    state = 'NO_TIE' if top == 'B11' else 'T029'
                    render(page, outfit('blazer', 'DS026', state, top=top), 'topwear/' + top, baseline_page)
            check('All 15 active blazer identities rendered through policy-supported routes',
                  sorted(row['selection']['blazerId'] for row in frames if row['label'].startswith('topwear/B'))
                  == sorted(live_roster['blazers']) and len(live_roster['blazers']) == 15)
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
            await_result = page.evaluate('''async s=>{await HEWRSApp.apply(s,{save:false});const event=await HEWRSApp.ownerFeedback.hide(s,{scope:'shirt_tie',context:'work',reason:'other'});HEWRSApp.rejectionChanged();return event;}''', selected)
            check('Manual rejection hides the rendered outfit', page.locator('#outfit-output').is_hidden())
            page.evaluate('HEWRSApp.showPage("home")')
            page.locator('#view-current').click()
            page.wait_for_function('()=>HEWRSApp.state().page==="outfits"')
            check('View current cannot resurrect a rejected shirt/tie pairing', page.locator('#outfit-output').is_hidden() and page.locator('#record-wear').is_disabled())
            check('Blocked navigation explains the rejection', 'rejected' in page.locator('#outfit-empty').inner_text().lower())
            page.screenshot(path=str(output / 'rejected-view-current.png'))
            page.evaluate('async id=>{await HEWRSApp.ownerFeedback.restore(id);HEWRSApp.rejectionChanged();}', await_result['id'])
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
        try:
            try:
                font = ImageFont.truetype('DejaVuSans.ttf', 13)
            except OSError:
                font = ImageFont.load_default()
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
                # Keep a second sheet at native pixel scale, with the complete collar.
                # The separate 656x826 PNGs retain the wider, uncropped neck/chest context.
                detail_x, detail_y, detail_w, detail_h = COLLAR_DETAIL_BBOX
                local_box = (detail_x - NATIVE_COLLAR_BBOX[0], detail_y - NATIVE_COLLAR_BBOX[1],
                             detail_x - NATIVE_COLLAR_BBOX[0] + detail_w,
                             detail_y - NATIVE_COLLAR_BBOX[1] + detail_h)
                column_width, row_height = detail_w + 12, detail_h + 32
                detail_sheet = Image.new('RGB', (12 + len(headings) * column_width,
                                               52 + row_height * min(5, len(shirts) - offset)), '#e8e5df')
                detail_draw = ImageDraw.Draw(detail_sheet)
                detail_draw.text((12, 8), 'Native 1:1 collar detail; canvas bbox x320 y330 w360 h260', font=font, fill='#20242a')
                for column, (mode, state) in enumerate(headings):
                    detail_draw.text((12 + column * column_width, 28), mode + ' / ' + state, font=font, fill='#20242a')
                for row, shirt in enumerate(shirts[offset:offset + 5]):
                    y = 52 + row * row_height
                    detail_draw.text((12, y), shirt['id'], font=font, fill='#20242a')
                    for column, (mode, state) in enumerate(headings):
                        native_pic = native_pictures.get((shirt['id'], mode, state))
                        x = 12 + column * column_width
                        if native_pic is None:
                            detail_draw.text((x, y + 100), 'NO TIE ONLY' if not shirt['thumbnails'].get('tied') and state != 'NO_TIE' else 'NOT RENDERED', font=font, fill='#20242a')
                        else:
                            collar = native_pic.crop(local_box)
                            detail_sheet.paste(collar, (x, y + 20), collar)
                detail_sheet.save(output / ('complete-collar-details-%02d.png' % (offset // 5 + 1)))
            result['collar_evidence']['saved_native_png_count'] = len(native_pictures)
        except Exception:
            result['atlas_error'] = traceback.format_exc()
            checks.append(dict(name='Native collar atlas generation', passed=False, detail=result['atlas_error']))
            print(result['atlas_error'], flush=True)
        finally:
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
