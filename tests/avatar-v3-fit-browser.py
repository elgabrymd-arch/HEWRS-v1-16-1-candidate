#!/usr/bin/env python3
"""Capture and verify the AVATAR_V3 garment-fit matrix in fresh browser profiles.

This is a source-preservation and complete-frame gate, plus a reproducible
visual-review packet. It never grants visual approval from pixel comparisons.
Every active shirt is exercised open and, where supported, tied in all three
render routes. All connected suits and blazers receive independent fit cases.
"""
import argparse
import base64
import functools
import hashlib
import io
import json
import math
import shutil
import threading
import traceback
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CORRECTED = ['DS001', 'DS014', 'DS017', 'DS023', 'DS034', 'DS035', 'DS036', 'DS051']
COLLAR = (248, 300, 748, 800)
CUFFS = (75, 1250, 921, 1625)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def selection(shirt, state, mode):
    result = dict(shirtId=shirt, state=state, shoeId='shoe-8', watchId=None)
    if mode == 'shirt-only':
        result.update(shirtOnly=True, pantId='PG002')
    elif mode.startswith('B'):
        result.update(blazerId=mode, pantId='PT006' if mode == 'B01' else 'PG002')
    else:
        result['suitId'] = mode
    return result


def fixtures(inventory):
    """Fixed coverage rules, with explicit existing no-tie restrictions."""
    rows, seen = [], set()

    def add(shirt, state, mode, purpose):
        key = (shirt, state, mode)
        if key in seen:
            return
        seen.add(key)
        rows.append(dict(name='-'.join([mode, shirt, state]), mode=mode,
                         purpose=purpose, selection=selection(shirt, state, mode)))

    for shirt in sorted(inventory['shirts']):
        states = ['NO_TIE'] if shirt in inventory['no_tie_only'] else ['NO_TIE', 'T001']
        for state in states:
            for mode in ['S05', 'B03', 'shirt-only']:
                add(shirt, state, mode, 'all-active-shirts-three-render-routes')
    for mode in sorted(inventory['suits']):
        for state in ['NO_TIE', 'T001']:
            add('DS035', state, mode, 'all-suit-collars-and-sleeves')
    for mode in sorted(inventory['blazers']):
        # B01 requires the explicit summer-weekend-dinner reviewed route,
        # chinos and no tie. B11 also prohibits ties. Prohibited B01 requests
        # are checked separately; they are not rendered as supported cases.
        for state in (['NO_TIE'] if mode in ('B01', 'B11') else ['NO_TIE', 'T001']):
            add('DS035', state, mode, 'all-blazer-collars-and-sleeves')
    for shirt in CORRECTED:
        for state in ['NO_TIE', 'T001']:
            add(shirt, state, 'B02', 'corrected-shirt-narrow-jacket-opening')
    # The B15 collar now has its own V3 registration. Every supported shirt
    # must be inspected through both the continuous and legacy render paths.
    for shirt in sorted(inventory['shirts']):
        states = ['NO_TIE'] if shirt in inventory['no_tie_only'] else ['NO_TIE', 'T001']
        for state in states:
            add(shirt, state, 'B15', 'all-active-shirts-b15-collar-refit')
    return rows


INVENTORY = r'''() => {
 const c=HEWRSApp.connection;
 return {shirts:c.limits.shirt_ids,suits:c.limits.suits,
  blazers:c.blazerConnection.availableIds,
  no_tie_only:Object.values(c.records).filter(x=>x.no_tie_only).map(x=>x.id),
  source_lock:globalThis.HEWRS_INPUT_SHA256,
  corrected:c.continuousShirts.ids};
}'''

PROTECTED = r'''() => ({wear:HEWRSApp.store.snapshot(),
 favorites:HEWRSApp.favorites.snapshot(),
 feedback:HEWRSApp.ownerFeedback.snapshot().events,
 preferences:HEWRSApp.homePreferences?.snapshot?.()||null})'''

HAND_MASK = r'''async ({source,candidate}) => {
 const make=()=>{const c=document.createElement('canvas');c.width=996;c.height=2748;return c;};
 const mask=make(),posed=make(),ctx=mask.getContext('2d',{willReadFrequently:true}),pc=posed.getContext('2d',{willReadFrequently:true});
 async function draw(hash,context){const image=new Image();image.src=HEWRSApp.resolveUrl({url:'assets/'+hash+'.png',sha256:hash,rect:[0,0,996,2748]});await image.decode();context.drawImage(image,0,0);}
 for(const hash of source)await draw(hash,ctx);
 for(const hash of candidate)await draw(hash,pc);
 const pixels=pc.getImageData(0,0,996,2748);
 HEWRSAvatarV3ArmPose.apply(pixels);pc.putImageData(pixels,0,0);ctx.drawImage(posed,0,0);
 return {png:mask.toDataURL('image/png'),source_hands:source,candidate_hands:candidate,
  pose_revision:HEWRSAvatarV3ArmPose.spec.revision};
}'''

FRAME = r'''async ({selected,ignoredHashes}) => {
 const app=HEWRSApp,plan=app.renderer.plan(selected),ignored=new Set(ignoredHashes);
 const before={wear:JSON.stringify(app.store.snapshot()),favorites:JSON.stringify(app.favorites.snapshot()),
  feedback:JSON.stringify(app.ownerFeedback.snapshot().events)};
 const mainSelection=JSON.stringify(app.state().selection),reviewed=selected.blazerId==='B01';
 let result,c,committed,rendered,card,photos,ownerContext=null;
 if(reviewed){
  // Home has no B01 use-case selector. Exercise the existing real reviewed
  // controls, as the five-round photo audit does, without bypassing its veto.
  if(selected.state!=='NO_TIE'||selected.pantId!=='PT006')throw Error('B01 fit fixture violates its owner restrictions');
  const panel=HEWRSReviewedIntegration;await panel.load({initialUpdate:false});
  const settings={'rd-view':'explore','rd-style':'AUTO','rd-occasion':'dinner','rd-mode':'blazer',
   'rd-formality':'open_collar_allowed','rd-b01-context':'summer_weekend_dinner',
   'rd-topwear':'B01','rd-pants':selected.pantId,'rd-shirt':selected.shirtId,
   'rd-tie':'__NONE__','rd-shoe':selected.shoeId,'rd-watch-choice':'__NONE__'};
  for(const [id,value]of Object.entries(settings)){
   const control=document.getElementById(id);control.value=value;
   if(control.value!==value)throw Error('Missing exact B01 reviewed choice: '+id+'='+value);
  }
  document.getElementById('rd-watch-choice').dispatchEvent(new Event('change',{bubbles:true}));
  const dialog=document.getElementById('rd-dialog');if(!dialog.open)dialog.showModal();
  ownerContext=panel.ownerContext();
  if(!HEWRSOutfitFeedback.ownerRuleCheck(selected,{context:ownerContext}).allowed||!app.ownerFeedback.allowed(selected,ownerContext))
   throw Error('Exact B01 reviewed fixture violates the live owner gate');
  const search=await panel.update();
  if(!search||search.all_possibilities.length!==1||search.counts.clothing_considered!==1||search.counts.footwear_expansions!==1)
   throw Error('Exact B01 fit request did not yield one supported possibility');
  const entry=search.all_possibilities[0];result=await panel.render(entry.id);
  if(result?.status!=='ready'||!result.unreviewed||entry.owner_approved!==false)throw Error('B01 fit preview did not complete as an unreviewed native render');
  rendered=panel.discovery().nativeSelection(panel.currentEntry().outfit,panel.watch());
  committed=result.selection;c=document.getElementById('rd-canvas');
  card=HEWRSOptionCards.create(app.connection).model(rendered);
  photos=Array.from(document.querySelectorAll('#rd-component-cards img'));
  if(JSON.stringify(app.state().selection)!==mainSelection)throw Error('B01 reviewed fit changed the main outfit');
 }else{
  result=await app.apply(selected,{origin:'manual',save:false,keepPreferences:true});
  app.showPage('outfits');c=document.getElementById('avatar');
  rendered=app.state().selection;committed=app.renderer.last();card=app.cardSnapshot();
  photos=Array.from(document.querySelectorAll('#option-card-items img'));
 }
 if(result?.cancelled)throw Error('Unexpected cancelled full frame');
 const ctx=c.getContext('2d',{willReadFrequently:true});
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 const region=async (x,y,w,h)=>digest(ctx.getImageData(x,y,w,h).data);
 const sourceBindings=[];
 function sources(value,path='plan'){
  if(!value||typeof value!=='object')return;
  if(typeof value.sha256==='string'&&!ignored.has(value.sha256))
   sourceBindings.push({path,sha256:value.sha256,rect:value.rect||null});
  for(const key of Object.keys(value).sort())
   if(value[key]&&typeof value[key]==='object')sources(value[key],path+'/'+key);
 }
 sources(plan);
 await Promise.all(photos.map(image=>image.decode()));
 const after={wear:JSON.stringify(app.store.snapshot()),favorites:JSON.stringify(app.favorites.snapshot()),
  feedback:JSON.stringify(app.ownerFeedback.snapshot().events)};
 const bounds=c.getBoundingClientRect();
 const captured={selection:rendered,last:committed,status:c.dataset.status,
  render_route:reviewed?'reviewed-explicit-b01-use-case':'main-outfit',owner_context:ownerContext,
  selection_authority:reviewed?'reviewed-current-entry-and-completed-native-render':'main-state-and-renderer-last',
  dimensions:[c.width,c.height],png:c.toDataURL('image/png'),
  full_sha256:await region(0,0,996,2748),head_sha256:await region(0,0,996,350),
  centre_sha256:await region(250,800,496,900),lower_sha256:await region(0,1700,996,1048),
  source_bindings:sourceBindings,source_binding_sha256:await digest(new TextEncoder().encode(JSON.stringify(sourceBindings))),
  connection_avatar:app.connection.manifest.static.avatar.sha256,plan_avatar:plan.avatar?.sha256||null,
  hands:(plan.hands||[]).map(x=>x.sha256),operation:plan.operation||plan.kind||null,
  v3:app.connection.avatarV3||null,pose_revision:app.renderer.stats().avatarV3Pose||null,
  collar_fit:globalThis.HEWRSAvatarV3CollarFit?.spec||null,
  state_unchanged:JSON.stringify(before)===JSON.stringify(after),
  photos_decoded:photos.length>0&&photos.every(image=>image.naturalWidth>0&&image.naturalHeight>0),
  card_shirt:card.items.find(x=>x.role==='Shirt')?.id,
  card_tie:card.items.find(x=>x.role==='Tie')?.id??null,
  layout:{viewport:innerWidth,width:document.documentElement.scrollWidth,left:bounds.left,right:bounds.right,height:bounds.height}};
 if(reviewed)HEWRSReviewedIntegration.close();
 return captured;
}'''


def file_sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size=16):
    try:
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', size)
    except OSError:
        return ImageFont.load_default()


def on_background(image):
    background = Image.new('RGBA', image.size, '#e9eaec')
    background.alpha_composite(image)
    return background.convert('RGB')


def retain_frame(output, name, old, new, centre_hand_mask):
    """Unchanged browser canvas plus diagnostic crops, never source assets."""
    for profile, row in [('v2', old), ('v3', new)]:
        raw = base64.b64decode(row.pop('png').split(',', 1)[1])
        picture = Image.open(io.BytesIO(raw)).convert('RGBA')
        if profile == 'v3':
            native = output / 'native' / (name + '.png')
            native.write_bytes(raw)
            row['native_path'] = str(native.relative_to(output))
        # A native detail pair preserves baseline context without retaining a
        # second copy of every full canvas in the Actions artifact.
        row['decoded_rgba_matches'] = hashlib.sha256(picture.tobytes()).hexdigest() == row['full_sha256']
        row['_image'] = picture
    # The newly rotated right hand can extend to x733..745. It is not a
    # garment pixel. Mask only the union of actual original and posed V3 hand
    # alpha, retaining exact comparison of every remaining centre pixel.
    centre = (250, 800, 746, 1700)
    previous, current = old['_image'].crop(centre), new['_image'].crop(centre)
    previous.paste((0, 0, 0, 0), (0, 0), centre_hand_mask)
    current.paste((0, 0, 0, 0), (0, 0), centre_hand_mask)
    old['centre_excluding_registered_hands_sha256'] = hashlib.sha256(previous.tobytes()).hexdigest()
    new['centre_excluding_registered_hands_sha256'] = hashlib.sha256(current.tobytes()).hexdigest()
    for part, box in [('collar', COLLAR), ('cuffs', CUFFS)]:
        a, b = old['_image'].crop(box), new['_image'].crop(box)
        pair = Image.new('RGB', (a.width * 2, a.height + 26), '#e9eaec')
        draw = ImageDraw.Draw(pair)
        for column, image in enumerate([a, b]):
            pair.paste(on_background(image), (column * a.width, 26))
            draw.text((column * a.width + 8, 4), name + ' / ' + ('V2' if column == 0 else 'V3'), fill='#151515', font=font(14))
        target = output / part / (name + '.jpg')
        pair.save(target, quality=94, subsampling=0)
        new[part + '_comparison_path'] = str(target.relative_to(output))
    for row in (old, new):
        del row['_image']


def sheets(output, rows):
    """Small indexed overview; native PNGs remain the inspection authority."""
    index = []
    for mode in sorted({row['mode'] for row in rows}):
        for state in ['NO_TIE', 'T001']:
            members = [row for row in rows if row['mode'] == mode and row['selection']['state'] == state]
            for start in range(0, len(members), 12):
                group = members[start:start + 12]
                if not group:
                    continue
                sheet = Image.new('RGB', (1800, 270 * math.ceil(len(group) / 3)), '#e9eaec')
                draw = ImageDraw.Draw(sheet)
                for n, row in enumerate(group):
                    image = Image.open(output / row['candidate']['collar_comparison_path']).convert('RGB')
                    image.thumbnail((596, 262), Image.Resampling.LANCZOS)
                    x, y = n % 3 * 600, n // 3 * 270
                    sheet.paste(image, (x, y))
                    draw.text((x + 5, y + 250), row['name'], fill='#151515', font=font(14))
                name = 'COLLARS-' + mode + '-' + state + '-' + str(start // 12 + 1).zfill(2) + '.jpg'
                sheet.save(output / 'sheets' / name, quality=93, subsampling=0)
                index.append(dict(path='sheets/' + name, cases=[r['name'] for r in group],
                                  visual_review='CAPTURED_NOT_AUTOMATICALLY_APPROVED'))
                cuff_sheet = Image.new('RGB', (1800, 180 * math.ceil(len(group) / 3)), '#e9eaec')
                full_sheet = Image.new('RGB', (900, 860 * math.ceil(len(group) / 3)), '#e9eaec')
                fd = ImageDraw.Draw(full_sheet)
                for n, row in enumerate(group):
                    cuff = Image.open(output / row['candidate']['cuffs_comparison_path']).convert('RGB')
                    cuff.thumbnail((596, 174), Image.Resampling.LANCZOS)
                    cuff_sheet.paste(cuff, (n % 3 * 600, n // 3 * 180))
                    native = on_background(Image.open(output / row['candidate']['native_path']).convert('RGBA'))
                    native.thumbnail((294, 812), Image.Resampling.LANCZOS)
                    x, y = n % 3 * 300, n // 3 * 860
                    full_sheet.paste(native, (x + 3, y + 30))
                    fd.text((x + 6, y + 6), row['name'], fill='#151515', font=font(15))
                for prefix, picture in [('CUFFS', cuff_sheet), ('FULL', full_sheet)]:
                    name = prefix + '-' + mode + '-' + state + '-' + str(start // 12 + 1).zfill(2) + '.jpg'
                    picture.save(output / 'sheets' / name, quality=93, subsampling=0)
                    index.append(dict(path='sheets/' + name, cases=[r['name'] for r in group],
                                      visual_review='CAPTURED_NOT_AUTOMATICALLY_APPROVED'))
    (output / 'VISUAL_REVIEW_INDEX.json').write_text(json.dumps(index, indent=2) + '\n')


def run(args):
    output = args.output.resolve() / args.browser
    for name in ['native', 'collar', 'cuffs', 'phone', 'sheets']:
        (output / name).mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / 'data/avatar-v3-candidate.json').read_text())
    expected = {k: v['sha256'] for k, v in manifest['candidate_layers'].items()}
    ignored = list(expected.values()) + list(manifest['source_layer_hashes'].values())
    errors, failed_requests, http_errors, external = [], [], [], []
    checks, captures = [], []
    report = dict(schema='hewrs.avatar-v3-fit-matrix.v1', browser=args.browser,
                  started_at=datetime.now(timezone.utc).isoformat(),
                  baseline_entrypoint=args.baseline, candidate_entrypoint=args.candidate,
                  entrypoint_sha256={p: file_sha(ROOT / p) for p in [args.baseline, args.candidate]},
                  review_does_not_mutate_source_files=True, owner_browser_data_accessed=False,
                  fresh_synthetic_profiles=True, visual_review='CAPTURED_NOT_AUTOMATICALLY_APPROVED',
                  checks=checks, captures=captures, errors=errors, failed_requests=failed_requests,
                  http_errors=http_errors, blocked_external_requests=external,
                  scope_limitations=['Rendering and source preservation do not establish styling suitability.',
                                     'Visual collar exposure and natural pose require inspection of the captured images.',
                                     'Four original NO_TIE_ONLY shirts are tested open; their tied states remain forbidden.',
                                     'B01 is tested without a tie and with PT006 through the explicit summer-weekend-dinner reviewed route; its prohibited Work/tied/dress-trouser route must still fail.',
                                     'B11 is exercised without a tie under the existing owner restriction.'])

    def save():
        report.update(passed=sum(x['passed'] for x in checks), failed=sum(not x['passed'] for x in checks))
        (output / 'RESULT.json').write_text(json.dumps(report, indent=2) + '\n')

    def check(name, value, detail=None):
        checks.append(dict(name=name, passed=bool(value), detail=detail))
        if not value:
            save()
            raise AssertionError(name + ': ' + str(detail))

    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = 'http://127.0.0.1:%d/' % server.server_address[1]
    try:
        with sync_playwright() as pw:
            launch = dict(headless=True)
            if args.browser == 'chromium':
                launch['args'] = ['--no-sandbox', '--disable-dev-shm-usage']
                if shutil.which('chromium'):
                    launch['executable_path'] = shutil.which('chromium')
            browser = getattr(pw, args.browser).launch(**launch)
            contexts = []

            def open_page(entrypoint, label):
                context = browser.new_context(viewport=dict(width=390, height=844),
                                              timezone_id='UTC', has_touch=True, is_mobile=True)
                contexts.append(context)

                def route(request):
                    if urlsplit(request.request.url)[:2] == urlsplit(origin)[:2]:
                        request.continue_()
                    else:
                        external.append(dict(profile=label, url=request.request.url))
                        request.abort()

                context.route('**/*', route)
                page = context.new_page()
                page.set_default_timeout(120000)
                page.on('pageerror', lambda error: errors.append(dict(profile=label, error=str(error))))
                page.on('requestfailed', lambda request: failed_requests.append(dict(profile=label, url=request.url, error=request.failure)))
                page.on('response', lambda response: http_errors.append(dict(profile=label, url=response.url, status=response.status))
                        if response.status >= 400 and not response.url.endswith('/favicon.ico') else None)
                response = page.goto(origin + entrypoint, wait_until='domcontentloaded', timeout=120000)
                check(label + ' entrypoint is served', response is not None and response.status == 200)
                page.wait_for_function('globalThis.HEWRS_READY && HEWRSApp.rejection', timeout=120000)
                page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
                return page

            v2, v3 = open_page(args.baseline, 'V2'), open_page(args.candidate, 'V3')
            if args.candidate in ['index.html', 'app.html']:
                check('Primary application declares the integrated V3 renderer',
                      v3.evaluate('()=>HEWRSApp.connection.avatarV3?.production_integrated===true'))
            collar_fit = v3.evaluate('''()=>({spec:HEWRSAvatarV3CollarFit.spec,
                frozen:Object.isFrozen(HEWRSAvatarV3CollarFit)&&Object.isFrozen(HEWRSAvatarV3CollarFit.spec)
                    &&['width_height','bounds','vertical_fade','target_tip'].every(k=>Object.isFrozen(HEWRSAvatarV3CollarFit.spec[k]))})''')
            report['collar_fit_contract'] = collar_fit
            check('B15 source and bounded V3 collar geometry are exact', collar_fit['frozen'] and all(
                collar_fit['spec'].get(key) == value for key, value in {
                    'revision': 'AVATAR_V3_B15_COLLAR_FIT_1', 'source_profile': 'AVATAR_V3', 'jacket_id': 'B15',
                    'source_sha256': 'e34e249bf344b0130e1f0b805285444758801a80a7c07b1c787687de7e36569a',
                    'width_height': [996, 2748], 'bounds': [280, 375, 460, 600], 'horizontal_shift': 46,
                    'horizontal_peak': 345, 'vertical_fade': [410, 600], 'target_tip': [391, 420],
                    'alpha_threshold': 128, 'source_pixels_replaced': False}.items()), collar_fit)
            check('V2 baseline has no V3 collar registration',
                  v2.evaluate('()=>globalThis.HEWRSAvatarV3CollarFit===undefined'))
            inventory = v3.evaluate(INVENTORY)
            report['inventory'] = inventory
            check('Active wardrobe inventory equals baseline', inventory == v2.evaluate(INVENTORY))
            check('All 50 active shirts, 18 suits and 15 blazers are available',
                  len(inventory['shirts']) == 50 and len(inventory['suits']) == 18 and len(inventory['blazers']) == 15, inventory)
            check('Retired DS049 remains excluded', 'DS049' not in inventory['shirts'])
            check('The existing four no-tie-only shirts remain restricted',
                  set(inventory['no_tie_only']) == {'DS040', 'DS041', 'DS042', 'DS043'}, inventory['no_tie_only'])
            forbidden = [selection(shirt, 'T001', mode) for shirt in inventory['no_tie_only']
                         for mode in ['S05', 'B03', 'shirt-only', 'B15']]
            for label, page in [('v2', v2), ('v3', v3)]:
                refused = page.evaluate('''rows=>rows.map(s=>{try{HEWRSApp.renderer.plan(s);return {selection:s,rejected:false};}
                    catch(error){return {selection:s,rejected:true,reason:error.message};}})''', forbidden)
                check(label + ': all sixteen prohibited tied-shirt requests are refused',
                      len(refused) == 16 and all(row['rejected'] for row in refused), refused)
                denied = page.evaluate('''async()=>{
                  const selected={blazerId:'B01',pantId:'PG002',shirtId:'DS035',state:'T001',shoeId:'shoe-8',watchId:null};
                  const context={occasion:'work',requiredFormality:'any'},before=JSON.stringify(HEWRSApp.state().selection);
                  const policy=HEWRSOutfitFeedback.ownerRuleCheck(selected,{context});
                  try{await HEWRSApp.apply(selected,{save:false,keepPreferences:true,context});return {blocked:false,policy};}
                  catch(error){return {blocked:true,policy,message:error.message,
                    selection_unchanged:JSON.stringify(HEWRSApp.state().selection)===before};}
                }''')
                check(label + ': prohibited B01 Work/tie/dress-trouser fixture remains rejected without changing the current outfit',
                      denied.get('blocked') and denied.get('selection_unchanged') and not denied['policy']['allowed']
                      and [r['id'] for r in denied['policy']['reasons']] == ['OWNER-B01-NO-TIE', 'OWNER-B01-NOT-WORK',
                          'OWNER-B01-SUMMER-CONTEXT', 'OWNER-B01-TROUSERS'], denied)
            report['scripts'] = {label: page.evaluate('()=>Array.from(document.querySelectorAll("script[src]"),x=>({src:x.getAttribute("src"),integrity:x.integrity}))')
                                 for label, page in [('v2', v2), ('v3', v3)]}
            hand_mask = v3.evaluate(HAND_MASK, dict(
                source=[manifest['source_layer_hashes'][key] for key in ['left_hand', 'right_hand']],
                candidate=[expected[key] for key in ['left_hand', 'right_hand']]))
            mask_raw = base64.b64decode(hand_mask.pop('png').split(',', 1)[1])
            alpha = Image.open(io.BytesIO(mask_raw)).getchannel('A').point(lambda value: 255 if value else 0)
            centre_hand_mask = alpha.crop((250, 800, 746, 1700))
            centre_hand_mask.save(output / 'centre-registered-hand-exclusion.png')
            report['centre_exclusion'] = dict(**hand_mask,
                reason='Actual registered original and posed V3 hand alpha may overlap the centre rectangle.',
                centre_rect=[250, 800, 746, 1700],
                path='centre-registered-hand-exclusion.png',
                excluded_pixels=centre_hand_mask.histogram()[255],
                mask_sha256=hashlib.sha256(centre_hand_mask.tobytes()).hexdigest())
            before = {label: page.evaluate(PROTECTED) for label, page in [('v2', v2), ('v3', v3)]}
            rows = fixtures(inventory)
            report['planned_cases'] = len(rows)
            report['coverage'] = {'shirts': sorted({r['selection']['shirtId'] for r in rows}),
                                  'suits': sorted({r['mode'] for r in rows if r['mode'].startswith('S')}),
                                  'blazers': sorted({r['mode'] for r in rows if r['mode'].startswith('B')}),
                                  'routes': ['suit', 'blazer', 'shirt-only']}
            check('Fixture selection covers every active ID',
                  set(report['coverage']['shirts']) == set(inventory['shirts'])
                  and set(report['coverage']['suits']) == set(inventory['suits'])
                  and set(report['coverage']['blazers']) == set(inventory['blazers']))
            b15 = [r for r in rows if r['mode'] == 'B15']
            check('B15 covers all fifty shirts and all ninety-six supported collar states',
                  len(b15) == 96 and {r['selection']['shirtId'] for r in b15} == set(inventory['shirts']))
            for index, case in enumerate(rows):
                selected, name = case['selection'], case['name']
                old = v2.evaluate(FRAME, dict(selected=selected, ignoredHashes=ignored))
                new = v3.evaluate(FRAME, dict(selected=selected, ignoredHashes=ignored))
                retain_frame(output, name, old, new, centre_hand_mask)
                captures.append(dict(**case, original=old, candidate=new))
                check(name + ': exact complete selections and native pixels',
                      all(r['selection'] == selected and r['last'] == selected and r['status'] == 'ready'
                          and r['dimensions'] == [996, 2748] and r['decoded_rgba_matches'] for r in [old, new]))
                if case['mode'] == 'B01':
                    check(name + ': B01 uses its explicit reviewed summer-weekend-dinner route without a tie and with chinos',
                          selected['state'] == 'NO_TIE' and selected['pantId'] == 'PT006'
                          and all(r['render_route'] == 'reviewed-explicit-b01-use-case'
                              and r['owner_context']['occasion'] == 'dinner'
                              and r['owner_context']['owner_use_case'] == 'summer_weekend_dinner' for r in [old, new]))
                check(name + ': V3 registered head and hands are active',
                      new['connection_avatar'] == expected['avatar']
                      and new['v3']['sha256'] == expected['avatar']
                      and new['v3']['hands'] == [expected['left_hand'], expected['right_hand']]
                      and (new['plan_avatar'] is None or new['plan_avatar'] == expected['avatar'])
                      and (not new['hands'] or new['hands'] == [expected['left_hand'], expected['right_hand']]))
                check(name + ': original source binding and changed head',
                      old['connection_avatar'] == manifest['source_layer_hashes']['avatar']
                      and old['head_sha256'] != new['head_sha256'])
                check(name + ': coordinated V3 arm pose is active', bool(new['pose_revision']))
                if case['mode'] == 'B15':
                    check(name + ': source-bound collar-fit revision is active',
                          new['collar_fit'] == collar_fit['spec'] and old['collar_fit'] is None)
                check(name + ': exact garment, tie, trouser and shoe source bindings',
                      old['source_bindings'] == new['source_bindings'],
                      {'original': old['source_binding_sha256'], 'candidate': new['source_binding_sha256']})
                check(name + ': centre garment pixels unchanged outside head and arm envelope',
                      old['centre_excluding_registered_hands_sha256'] == new['centre_excluding_registered_hands_sha256'])
                check(name + ': legs and footwear pixels unchanged', old['lower_sha256'] == new['lower_sha256'])
                check(name + ': read-only renders preserve saved state', old['state_unchanged'] and new['state_unchanged'])
                check(name + ': exact card identities and decoded item photos',
                      all(r['photos_decoded'] and r['card_shirt'] == selected['shirtId']
                          and r['card_tie'] == (None if selected['state'] == 'NO_TIE' else selected['state']) for r in [old, new]))
                check(name + ': phone layout stays usable',
                      all(r['layout']['viewport'] == 390 and r['layout']['width'] <= 391
                          and r['layout']['left'] >= -1 and r['layout']['right'] <= 391
                          and r['layout']['height'] > 0 for r in [old, new]))
                if ((selected['shirtId'] in CORRECTED and case['mode'] in ['B02', 'S11', 'shirt-only', 'B15'])
                        or (selected['shirtId'] == 'DS003' and case['mode'] == 'B15')):
                    path = output / 'phone' / (name + '.png')
                    v3.screenshot(path=str(path), full_page=True)
                    new['phone_path'] = str(path.relative_to(output))
                if index % 12 == 0 or index == len(rows) - 1:
                    save()
                    print('FIT_CAPTURED %s %d/%d %s' % (args.browser, index + 1, len(rows), name), flush=True)
            for label, page in [('v2', v2), ('v3', v3)]:
                check(label + ': complete matrix preserves protected state', before[label] == page.evaluate(PROTECTED))
            operations = {}
            for capture in captures:
                operation = capture['candidate']['operation']
                operations[operation] = operations.get(operation, 0) + 1
            report['render_route_counts'] = operations
            check('All application and asset requests succeeded', not errors and not failed_requests and not http_errors,
                  dict(errors=errors, failed_requests=failed_requests, http_errors=http_errors))
            check('No external service request was attempted', not external, external)
            for context in contexts:
                context.close()
            browser.close()
        sheets(output, captures)
        report['status'] = 'PASS_SOURCE_AND_RENDER_GATES_VISUAL_REVIEW_PENDING'
    except Exception:
        report['status'] = 'FAIL'
        report['exception'] = traceback.format_exc()
        raise
    finally:
        server.shutdown()
        report['completed_at'] = datetime.now(timezone.utc).isoformat()
        save()
    print('AVATAR_V3_FIT_RESULT=' + json.dumps(dict(status=report['status'], browser=args.browser,
                                                cases=len(captures), passed=report['passed'], failed=report['failed'])))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', choices=['chromium', 'webkit'], default='chromium')
    parser.add_argument('--baseline')
    parser.add_argument('--candidate')
    parser.add_argument('--output', type=Path, default=ROOT / 'evidence/avatar_v3/fit')
    options = parser.parse_args()
    integrated = (ROOT / 'AVATAR_V3_RELEASE.json').exists()
    options.baseline = options.baseline or ('avatar-v2-reference.html' if integrated else 'index.html')
    options.candidate = options.candidate or ('index.html' if integrated else 'avatar-v3-review.html')
    run(options)
