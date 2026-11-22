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
import re
import tempfile
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
JACKET_LOWER_OPENING_RECT = (422, 615, 575, 850)
JACKET_OUTER_SHOULDER_RECTS = ((0, 350, 330, 600), (666, 350, 996, 600))
TIED_NECK_CORNER_RECTS = ((422, 401, 441, 420), (560, 405, 575, 420))
TIE_RECT = (422, 467, 575, 1251)
CUFF_RECTS = ((20, 1180, 260, 1426), (736, 1180, 976, 1426))
DETAILS = {'collar': (248, 300, 748, 800), 'cuffs': (0, 1120, 996, 1625),
           'tie': (350, 430, 646, 1250), 'shoulders': (0, 355, 996, 615)}
SEAMS = json.loads((ROOT / 'tests/issue19-collar-seam-fixtures.json').read_text())
SHOULDERS = json.loads((ROOT / 'tests/issue19-shoulder-contour-fixtures.json').read_text())
JACKET_GAPS = json.loads((ROOT / 'tests/issue19-jacket-gap-fixtures.json').read_text())
PARTIAL_TIES = json.loads((ROOT / 'tests/issue19-partial-tie-backing-fixtures.json').read_text())
SHOULDER_EDGES = json.loads((ROOT / 'tests/issue19-outer-shoulder-fixtures.json').read_text())
B02_MASK = json.loads((ROOT / 'tests/issue19-b02-mask-fixtures.json').read_text())
CUFF_UNDERLAYS = json.loads((ROOT / 'tests/issue19-cuff-underlay-fixtures.json').read_text())
assert hashlib.sha256((ROOT / B02_MASK['data_path']).read_bytes()).hexdigest() == B02_MASK['data_sha256']
assert CUFF_UNDERLAYS['baseline_commit'] == BASELINE
assert CUFF_UNDERLAYS['cuff_bounds_xywh'] == [[x, y, r - x, b - y] for x, y, r, b in CUFF_RECTS]
assert hashlib.sha256((ROOT / 'src/avatar-v3-pose.js').read_bytes()).hexdigest() == CUFF_UNDERLAYS['approved_pose_source_sha256']

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
            if mode == 'S02':
                # These independently observed aperture and partial tie-edge
                # regressions reach below the unscaled knot. Exercise every
                # projected physical tie on all three affected shirts here.
                for shirt in ('DS027', 'DS037', 'DS048'):
                    for index in range(2, 48):
                        state = f'T{index:03}'
                        rows.append({'name': '-'.join((mode, shirt, state)), 'mode': mode,
                                     'selection': FIT.selection(shirt, state, mode)})
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


def change_check(old, new, selected, hand_mask, avatar_source, jacket_shoulder_source=None):
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
        rectangles.append(JACKET_LOWER_OPENING_RECT)
        rectangles.extend(JACKET_OUTER_SHOULDER_RECTS)
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
    outer_checked, outer_wrong, jacket_opaque_wrong = 0, 0, 0
    b02_opaque_checked, b02_opaque_wrong_source = 0, 0
    if not selected.get('shirtOnly'):
        if jacket_shoulder_source is None:
            raise AssertionError('Jacket routes require the browser-decoded original shoulder source')
        shoulder_changes = changed.crop((0, 350, 996, 600))
        jacket_opaque = jacket_shoulder_source.getchannel('A').point(lambda alpha: 255 if alpha == 255 else 0)
        jacket_opaque_wrong = ImageChops.multiply(shoulder_changes, jacket_opaque).histogram()[255]
        if selected.get('blazerId') == 'B02':
            # Check the complete current source-owned region as well as the
            # unchanged baseline preservation gate. Equal old/new pixels alone
            # would not establish that either frame uses the original source.
            source_channels = ImageChops.difference(new.crop((0, 350, 996, 600)), jacket_shoulder_source).split()
            source_changed = source_channels[0]
            for channel in source_channels[1:]:
                source_changed = ImageChops.lighter(source_changed, channel)
            source_changed = source_changed.point(lambda value: 255 if value else 0)
            b02_opaque_checked = jacket_opaque.histogram()[255]
            b02_opaque_wrong_source = ImageChops.multiply(source_changed, jacket_opaque).histogram()[255]
        for rectangle in JACKET_OUTER_SHOULDER_RECTS:
            if not changed.crop(rectangle).getbbox():
                continue
            left, top, right, bottom = rectangle
            for y in range(top, bottom):
                for x in range(left, right):
                    if not changed.getpixel((x, y)):
                        continue
                    source = jacket_shoulder_source.getpixel((x, y - 350))
                    outer_checked += 1
                    outer_wrong += (new.getpixel((x, y)) != source or avatar_source.getpixel((x, y))[3] != 0
                                    or old.getpixel((x, y))[3] <= source[3])
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
            'outer_original_jacket_pixels_checked': outer_checked,
            'outer_wrong_source_pixels': outer_wrong,
            'opaque_original_jacket_shoulder_pixels_changed': jacket_opaque_wrong,
            'b02_effective_opaque_jacket_pixels_checked': b02_opaque_checked,
            'b02_effective_opaque_jacket_wrong_source_pixels': b02_opaque_wrong_source,
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

CUFF_UNDERLAY_IDENTITY = r'''s=>{
 const c=HEWRSApp.connection,p=HEWRSApp.renderer.plan(s);
 let sources;
 if(s.blazerId){
  const b=c.blazerConnection.knownBlazer(s.blazerId);
  sources={avatar:c.manifest.static.avatar,shoes:c.shoeLayers[s.shoeId],
   pants:c.blazerConnection.knownPant(s.pantId).layer,jacket:b.assembly?.jacket||b.checkpoint_layer,
   hands:c.blazerConnection.data.assembly.hands};
 }else{
  const m=c.assemblies.forSelection(s.suitId,s.shoeId,s.shirtId).static;
  sources={avatar:m.avatar,shoes:m.shoe,pants:m.trousers,jacket:m.jacket,hands:[m.left_hand,m.right_hand]};
 }
 // This runs in the immutable published baseline, independently of the
 // candidate cuff wrapper. The original suit renderer and continuous/blazer
 // renderers have different lower-source orders; establish both explicitly.
 const legacySuit=!s.blazerId&&!c.continuousShirts.ids.includes(s.shirtId);
 if(Array.isArray(p)!==legacySuit)throw Error('Original lower-source route differs');
 const order=legacySuit?['shoes','pants','avatar']:['avatar','shoes','pants'];
 const expected=order.map(role=>sources[role].sha256);
 const actual=legacySuit?p.filter(d=>expected.includes(d.sha256)).map(d=>d.sha256):[p.avatar,p.shoes,p.pants].map(d=>d.sha256);
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Original lower-source order differs');
 return JSON.stringify({sources,order});
}'''

CUFF_UNDERLAY_SOURCE = r'''async ({identity,points,rectangles})=>{
 if(HEWRSAvatarV3ArmPose.spec.revision!=='AVATAR_V3_ARM_POSE_CANDIDATE_1')throw Error('Approved original pose differs');
 const W=996,H=2748,canvases=[],verified=new Set();
 function canvas(){const c=document.createElement('canvas');c.width=W;c.height=H;canvases.push(c);return c;}
 async function image(d){
  if(d.rect.join(',')!=='0,0,996,2748')throw Error('Original cuff source dimensions differ');
  const url=HEWRSApp.resolveUrl(d),response=await fetch(url);
  if(!response.ok)throw Error('Original cuff source request failed');
  const bytes=await response.arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==d.sha256)throw Error('Original cuff source bytes differ');verified.add(hash);
  const im=new Image();im.src=url;await im.decode();
  if(im.naturalWidth!==W||im.naturalHeight!==H)throw Error('Decoded original source dimensions differ');
  const c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);
  if(d.display_alpha_mask){ctx.globalCompositeOperation='destination-in';ctx.drawImage(await image(d.display_alpha_mask),0,0);ctx.globalCompositeOperation='source-over';}
  return c;
 }
 function posed(c){const ctx=c.getContext('2d',{willReadFrequently:true}),p=ctx.getImageData(0,0,W,H);HEWRSAvatarV3ArmPose.apply(p);return p;}
 const pixel=(frame,[x,y])=>Array.from(frame.data.slice((y*W+x)*4,(y*W+x)*4+4));
 try{
  const source=identity.sources,images={},frames={};
  for(const role of ['avatar','shoes','pants']){images[role]=await image(source[role]);frames[role]=posed(images[role]);}
  const lower=canvas(),lc=lower.getContext('2d',{willReadFrequently:true});
  for(const role of identity.order)lc.drawImage(images[role],0,0);
  const stack=posed(lower);let compared=0,overlap=0,wrong=0;
  for(const [x,y,r,b]of rectangles)for(let yy=y;yy<b;yy++)for(let xx=x;xx<r;xx++){
   const i=(yy*W+xx)*4;if(!frames.pants.data[i+3])continue;compared++;
   if(frames.avatar.data[i+3]||frames.shoes.data[i+3])overlap++;
   if([0,1,2,3].some(k=>stack.data[i+k]!==frames.pants.data[i+k]))wrong++;
  }
  if(!compared||overlap||wrong)throw Error('Selected trousers are not independent of the original lower-source stack in cuff bounds');
  const output=canvas();output.getContext('2d',{willReadFrequently:true}).putImageData(frames.pants,0,0);
  const controls=[];
  if(points.length){
   frames.jacket=posed(await image(source.jacket));
   frames.hands=[];for(const hand of source.hands)frames.hands.push(posed(await image(hand)));
   const original=canvas(),oc=original.getContext('2d',{willReadFrequently:true});
   oc.putImageData(frames.jacket,0,0);oc.globalCompositeOperation='destination-over';oc.drawImage(output,0,0);
   const jacketOverTrousers=oc.getImageData(0,0,W,H);
   for(const xy of points)controls.push({xy,avatar:pixel(frames.avatar,xy),pants:pixel(frames.pants,xy),
    jacket:pixel(frames.jacket,xy),jacket_over_trousers:pixel(jacketOverTrousers,xy),
    hands:frames.hands.map(frame=>pixel(frame,xy))});
  }
  return {png:output.toDataURL('image/png'),controls,original_stack_pixels_compared:compared,
   original_stack_disagreements:wrong,original_avatar_or_shoe_overlap:overlap,verified_source_sha256:[...verified].sort()};
 }finally{for(const c of canvases)c.width=c.height=1;}
}'''


def cuff_underlay_source(baseline_page, selected, cache):
    """Decode original pants and the original pose in the pinned baseline page."""
    if selected.get('shirtOnly'):
        return None
    key = baseline_page.evaluate(CUFF_UNDERLAY_IDENTITY, selected)
    if key not in cache:
        identity = json.loads(key)
        mode = selected.get('suitId') or selected.get('blazerId')
        cases = [row for row in CUFF_UNDERLAYS['cases'] if row['mode'] == mode]
        points = sorted({tuple(xy) for row in cases for kind in
                         ('exact_underlay_points_xy', 'transparent_exterior_points_xy', 'avatar_only_exposure_controls_xy',
                          'positive_jacket_coverage_points_xy', 'exact_original_jacket_points_xy',
                          'exact_original_jacket_over_trousers_points_xy', 'exact_original_jacket_aa_points_xy')
                         for xy in row.get(kind, [])})
        captured = baseline_page.evaluate(CUFF_UNDERLAY_SOURCE,
                                         {'identity': identity, 'points': points, 'rectangles': CUFF_RECTS})
        image = Image.open(io.BytesIO(base64.b64decode(captured.pop('png').split(',', 1)[1]))).convert('RGBA')
        assert image.size == (996, 2748)
        proof = {'identity_sha256': digest(key.encode()), 'identity': identity, **captured,
                 'posed_original_trousers_rgba_sha256': digest(image.tobytes()),
                 'reference': 'exact_published_baseline_sources_and_approved_pose_once'}
        cache[key] = {'image': image, 'proof': proof, 'cases': cases,
                      'controls': {tuple(row['xy']): row for row in captured['controls']}}
        # Cases are grouped by jacket; its legacy and continuous source
        # orders need at most two originals. Bound retained native RGBA data
        # independently of the number of captures in the complete matrix.
        while len(cache) > 4:
            del cache[next(iter(cache))]
    else:
        value = cache.pop(key)
        cache[key] = value
    return cache[key]


def cuff_underlay_samples(image, reference):
    """Check current frames against original trousers, never new fit counters."""
    if reference is None:
        return None
    source, proof = reference['image'], reference['proof']
    checked, lost = 0, 0
    for rectangle in CUFF_RECTS:
        opaque = source.crop(rectangle).getchannel('A').point(lambda alpha: 255 if alpha == 255 else 0)
        missing = image.crop(rectangle).getchannel('A').point(lambda alpha: 0 if alpha == 255 else 255)
        checked += opaque.histogram()[255]
        lost += ImageChops.multiply(opaque, missing).histogram()[255]
    assert checked > 0, 'Original selected trousers have no cuff-bound coverage'
    result = {'reference_identity_sha256': proof['identity_sha256'], 'opaque_original_trouser_pixels': checked,
              'opaque_trouser_pixels_lost': lost, 'positive_points_checked': 0, 'positive_points_wrong': 0,
              'exact_original_trouser_controls': [], 'transparent_exterior_controls': [],
              'original_jacket_points_checked': 0, 'original_jacket_coverage_lost': 0,
              'exact_original_jacket_controls': [], 'exact_original_jacket_over_trousers_controls': [],
              'exact_original_jacket_antialias_controls': [],
              'concealed_avatar_exterior_controls': [], 'fixed_control_failures': []}
    sources = proof['identity']['sources']
    for fixture in reference['cases']:
        expected = fixture['source_hashes']
        for role in ('avatar', 'pants', 'shoes', 'jacket'):
            assert sources[role]['sha256'] == expected[role], ('Original cuff source binding', role)
        assert [d['sha256'] for d in sources['hands']] == expected['hands']
        assert (sources['jacket'].get('display_alpha_mask') or {}).get('sha256') == expected.get('jacket_alpha_mask')
        for xy in fixture.get('positive_coverage_points_xy', []):
            assert source.getpixel(tuple(xy))[3] == 255, ('Audited original trouser coverage', xy)
            result['positive_points_checked'] += 1
            result['positive_points_wrong'] += image.getpixel(tuple(xy))[3] != 255
        for xy in fixture.get('exact_underlay_points_xy', []):
            point = tuple(xy); control = reference['controls'][point]
            assert control['jacket'][3] == 0 and all(hand[3] == 0 for hand in control['hands'])
            rgba, original = image.getpixel(point), source.getpixel(point)
            result['exact_original_trouser_controls'].append({'xy': xy, 'rgba': rgba, 'original_rgba': original})
            if rgba != original:
                result['fixed_control_failures'].append({'kind': 'original_trousers', 'xy': xy, 'rgba': rgba, 'expected': original})
        for xy in fixture.get('transparent_exterior_points_xy', []):
            point = tuple(xy); control = reference['controls'][point]
            assert source.getpixel(point)[3] == control['jacket'][3] == 0 and all(hand[3] == 0 for hand in control['hands'])
            rgba = image.getpixel(point)
            result['transparent_exterior_controls'].append({'xy': xy, 'rgba': rgba})
            if rgba[3] != 0:
                result['fixed_control_failures'].append({'kind': 'true_exterior', 'xy': xy, 'rgba': rgba})
        for xy in fixture.get('avatar_only_exposure_controls_xy', []):
            point = tuple(xy); control = reference['controls'][point]
            assert source.getpixel(point)[3] == 0 and control['avatar'][3] > 0
            rgba = image.getpixel(point)
            result['concealed_avatar_exterior_controls'].append({'xy': xy, 'rgba': rgba, 'original_avatar_rgba': control['avatar']})
            if rgba[3] != 0:
                result['fixed_control_failures'].append({'kind': 'unwanted_avatar_exposure', 'xy': xy, 'rgba': rgba})
        for xy in fixture.get('positive_jacket_coverage_points_xy', []):
            point = tuple(xy); control = reference['controls'][point]
            assert control['jacket'][3] > 0 and all(hand[3] == 0 for hand in control['hands'])
            result['original_jacket_points_checked'] += 1
            result['original_jacket_coverage_lost'] += image.getpixel(point)[3] < control['jacket'][3]
        for xy in fixture.get('exact_original_jacket_points_xy', []):
            point = tuple(xy); control = reference['controls'][point]
            assert control['jacket'][3] == 255 and all(hand[3] == 0 for hand in control['hands'])
            rgba, original = image.getpixel(point), tuple(control['jacket'])
            result['exact_original_jacket_controls'].append({'xy': xy, 'rgba': rgba, 'original_rgba': original})
            if rgba != original:
                result['fixed_control_failures'].append({'kind': 'original_jacket', 'xy': xy, 'rgba': rgba, 'expected': original})
        # These frozen points had zero fitted foreground in the rejected
        # runtime. Their expected original jacket over selected trousers is
        # independent of the new seam implementation. Other partially fitted
        # points use the source-coverage gate, not a doubled old foreground.
        for xy in fixture.get('exact_original_jacket_over_trousers_points_xy', []):
            point = tuple(xy); control = reference['controls'][point]
            assert control['jacket'][3] > 0 and all(hand[3] == 0 for hand in control['hands'])
            rgba, original = image.getpixel(point), tuple(control['jacket_over_trousers'])
            result['exact_original_jacket_over_trousers_controls'].append({'xy': xy, 'rgba': rgba, 'original_rgba': original})
            if rgba != original:
                result['fixed_control_failures'].append({'kind': 'original_jacket_over_trousers', 'xy': xy, 'rgba': rgba, 'expected': original})
        for xy in fixture.get('exact_original_jacket_aa_points_xy', []):
            point = tuple(xy); control = reference['controls'][point]
            assert 0 < control['jacket'][3] < 255 and control['pants'][3] == 0
            assert all(hand[3] == 0 for hand in control['hands'])
            rgba, original = image.getpixel(point), tuple(control['jacket_over_trousers'])
            result['exact_original_jacket_antialias_controls'].append({'xy': xy, 'rgba': rgba, 'original_rgba': original})
            if rgba != original:
                result['fixed_control_failures'].append({'kind': 'original_jacket_antialias', 'xy': xy, 'rgba': rgba, 'expected': original})
    return result


JACKET_SHOULDER_SOURCE = r'''async s=>{
 const c=HEWRSApp.connection,p=HEWRSApp.renderer.plan(s);
 const d=Array.isArray(p)?c.assemblies.forSelection(s.suitId,s.shoeId,s.shirtId).static.jacket:p.jacket;
 if(!d)throw Error('Missing selected original jacket');
 // B02's immutable source record explicitly identifies this contour as
 // foreign gray material. The all-shirt fit now reuses that same contour
 // on every B02 route; other masks retain their original plan scope.
 const mask=s.blazerId==='B02'?c.continuousShirts.jacket_masks.B02:p.jacketMask||null;
 if(mask&&mask.source_sha256!==d.sha256)throw Error('Original jacket mask source differs');
 function path(ctx,lines){ctx.beginPath();for(const line of lines){ctx.moveTo(...line[0]);for(const point of line.slice(1))ctx.lineTo(...point);ctx.closePath();}}
 const canvas=document.createElement('canvas');canvas.width=996;canvas.height=250;
 // Retain the protected, previously approved V3 B15 registration as well as
 // each original photograph and its existing source-bound jacket mask.
 // Construct the effective source independently of the new fit wrapper.
 // Match the original continuous renderer and production jacket mask context.
 // WebKit's default context rasterizes this fractional contour differently;
 // the independent full/cropped willReadFrequently references agree exactly.
 const loader=HEWRSRenderImageLoader.create({resolveUrl:HEWRSApp.resolveUrl,width:996,height:2748,limit:2});
 const bitmap=document.createElement('canvas');bitmap.width=996;bitmap.height=2748;
 const bc=bitmap.getContext('2d',{willReadFrequently:true}),image=await loader.load(d);bc.drawImage(image,0,0);
 if(d.display_alpha_mask){const alpha=new Image();alpha.src=HEWRSApp.resolveUrl(d.display_alpha_mask);await alpha.decode();bc.globalCompositeOperation='destination-in';bc.drawImage(alpha,0,0);}
 const effective=document.createElement('canvas');effective.width=996;effective.height=2748;
 const ec=effective.getContext('2d',{willReadFrequently:true});ec.save();
 if(mask?.keep_contours){path(ec,mask.keep_contours);ec.clip('evenodd');}
 ec.drawImage(bitmap,0,0);ec.restore();
 if(mask?.erase_contours){ec.save();ec.globalCompositeOperation='destination-out';path(ec,mask.erase_contours);ec.fill('evenodd');ec.restore();}
 canvas.getContext('2d',{willReadFrequently:true}).drawImage(effective,0,-350);bitmap.width=bitmap.height=effective.width=effective.height=1;
 return canvas.toDataURL('image/png');
}'''

JACKET_SHOULDER_IDENTITY = r'''s=>{
 const c=HEWRSApp.connection,p=HEWRSApp.renderer.plan(s);
 const d=Array.isArray(p)?c.assemblies.forSelection(s.suitId,s.shoeId,s.shirtId).static.jacket:p.jacket;
 if(!d)throw Error('Missing selected original jacket');
 const mask=s.blazerId==='B02'?c.continuousShirts.jacket_masks.B02:p.jacketMask||null;
 return JSON.stringify({source:d,mask});
}'''


def jacket_shoulder_source(page, selected, cache):
    if selected.get('shirtOnly'):
        return None
    # Bind the cache to the independently selected effective source, including
    # the exact existing B02 contour now reused across all active shirts.
    key = page.evaluate(JACKET_SHOULDER_IDENTITY, selected)
    if selected.get('blazerId') == 'B02':
        identity = json.loads(key)
        assert identity['source']['sha256'] == B02_MASK['jacket_source_sha256']
        assert identity['mask']['source_sha256'] == B02_MASK['jacket_source_sha256']
        assert identity['mask']['erase_contours'] == B02_MASK['erase_contours'], 'Literal B02 erase contour differs'
        assert not identity['source'].get('display_alpha_mask') and not identity['mask'].get('keep_contours')
    if key not in cache:
        png = page.evaluate(JACKET_SHOULDER_SOURCE, selected)
        cache[key] = Image.open(io.BytesIO(base64.b64decode(png.split(',', 1)[1]))).convert('RGBA')
        assert cache[key].size == (996, 250)
    return cache[key]

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
    for fixture in SHOULDERS['fixtures'] + SHOULDERS.get('antialias_fixtures', []) + SHOULDERS.get('enclosed_fixtures', []):
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


@functools.lru_cache(maxsize=14)
def original_jacket_control_source(suit):
    row = next(item for item in JACKET_GAPS['same_effective_alpha_geometry'] if item['suit'] == suit)
    source = ROOT / 'assets' / (row['jacket_source_sha256'] + '.png')
    assert digest(source.read_bytes()) == row['jacket_source_sha256'], 'Original jacket bytes changed'
    return Image.open(source).convert('RGBA')


def jacket_aperture_samples(image, selected):
    """Literal independent interior, exterior and selected-jacket controls."""
    rows = [row for row in JACKET_GAPS['fixtures']
            if row['shirt'] == selected['shirtId'] and selected.get('suitId') in row['suit_ids']]
    if not rows:
        return None
    samples = []
    for row in rows:
        rgba = list(image.getpixel(tuple(row['xy'])))
        assert rgba[3] == row['expected_alpha'], (selected, 'jacket aperture', row['xy'], rgba)
        samples.append({'xy': row['xy'], 'rgba': rgba, 'component_id': row['component_id']})
    exterior, opaque = 0, 0
    for row in JACKET_GAPS['negative_exterior_fixtures']:
        if (row['shirt'] == selected['shirtId'] and selected.get('suitId') in row['suit_ids']
                and selected['state'] == row['state']):
            assert list(image.getpixel(tuple(row['xy']))) == row['expected_rgba'], (selected, 'true exterior', row['xy'])
            exterior += 1
    source = original_jacket_control_source(selected['suitId'])
    for row in JACKET_GAPS['opaque_jacket_control_regions']:
        if row['shirt'] != selected['shirtId'] or selected.get('suitId') not in row['suit_ids']:
            continue
        x, y, width, height = row['xywh']
        for yy in range(y, y + height):
            for xx in range(x, x + width):
                rgba = source.getpixel((xx, yy))
                assert rgba[3] == 255 and image.getpixel((xx, yy)) == rgba, (selected, 'original opaque jacket', xx, yy)
                opaque += 1
    return {'points': samples, 'transparent_exterior_controls': exterior,
            'opaque_original_jacket_control_pixels': opaque}


def partial_tie_backing_samples(image, selected):
    rows = [row for row in PARTIAL_TIES['fixtures'] if row['shirt'] == selected['shirtId']
            and selected.get('suitId') in row['suit_ids'] and selected['state'] != 'NO_TIE']
    result = []
    for row in rows:
        rgba = list(image.getpixel(tuple(row['xy'])))
        assert rgba[3] == row['expected_alpha'], (selected, 'partial tie backing', row['xy'], rgba)
        result.append({'xy': row['xy'], 'rgba': rgba})
    return result


def b02_mask_samples(image, selected, jacket, avatar):
    if selected.get('blazerId') != 'B02':
        return []
    result = []
    upper = B02_MASK['upper_neck_point']; xy = tuple(upper['xy'])
    rgba = image.getpixel(xy); approved = avatar.getpixel(xy)
    assert jacket.getpixel((xy[0], xy[1] - 350))[3] == 0
    assert approved[3] == 255 and rgba[3] == upper['expected_alpha']
    assert max(abs(rgba[k] - approved[k]) for k in range(3)) <= upper['maximum_rgb_distance_from_original_avatar'], (selected, 'B02 upper avatar point', rgba, approved)
    assert list(rgba) != upper['forbidden_raw_jacket_rgba']
    result.append({'kind': 'upper_neck', 'xy': xy, 'rgba': rgba, 'original_avatar_rgba': approved})
    for row in B02_MASK['cleared_cloth_points']:
        x, y = row['xy']; rgba = image.getpixel((x, y))
        assert jacket.getpixel((x, y - 350))[3] == 0
        assert rgba[3] == row['expected_alpha'] and list(rgba) != row['forbidden_raw_jacket_rgba'], (selected, 'B02 cleared shirt coverage', row['xy'], rgba)
        result.append({'kind': 'cleared_cloth', 'xy': row['xy'], 'rgba': rgba})
    for row in B02_MASK['opaque_navy_points']:
        x, y = row['xy']; rgba = image.getpixel((x, y)); source = jacket.getpixel((x, y - 350))
        assert source[3] == 255 and rgba == source, (selected, 'B02 true navy cloth', row['xy'], rgba, source)
        result.append({'kind': 'opaque_navy', 'xy': row['xy'], 'rgba': rgba})
    if selected['state'] != 'NO_TIE':
        for x, y in B02_MASK['partial_edge_source_over']['points']:
            rgba = image.getpixel((x, y)); fg = jacket.getpixel((x, y - 350)); bg = avatar.getpixel((x, y))
            assert 0 < fg[3] < 255 and bg[3] == rgba[3] == 255
            expected = [math.floor((fg[k] * fg[3] + bg[k] * (255 - fg[3])) / 255 + .5) for k in range(3)]
            error = max(abs(rgba[k] - expected[k]) for k in range(3))
            assert error <= B02_MASK['partial_edge_source_over']['browser_maximum_rgb_error'], (selected, 'B02 independent partial source-over', x, y, rgba, expected)
            result.append({'kind': 'partial_source_over', 'xy': [x, y], 'rgba': rgba,
                           'effective_jacket_rgba': fg, 'original_avatar_rgba': bg, 'expected_rgb': expected, 'max_rgb_error': error})
    return result


def matching_shoulder_edges(selected, key):
    mode = selected.get('suitId') or selected.get('blazerId')
    state_class = 'no_tie' if selected['state'] == 'NO_TIE' else 'tied'
    return [row for row in SHOULDER_EDGES[key] if row['mode'] == mode
            and row['shirt'] == selected['shirtId'] and row['state_class'] == state_class]


def shoulder_edge_samples(image, selected, source, retained_reference=None):
    concealment, retained = [], []
    for row in matching_shoulder_edges(selected, 'concealment_points'):
        x, y = row['xy']; rgba = image.getpixel((x, y))
        assert rgba == source.getpixel((x, y - 350)) and rgba[3] == row['expected_alpha'], (selected, 'concealed source shoulder', row['xy'], rgba)
        concealment.append({'xy': row['xy'], 'rgba': rgba})
    for row in matching_shoulder_edges(selected, 'retained_reveal_points'):
        xy = tuple(row['xy']); rgba = image.getpixel(xy)
        assert retained_reference is not None, 'Retained reveal needs its same-engine pre-shoulder frame'
        assert rgba[3] >= row['minimum_alpha'] and rgba == retained_reference.getpixel(xy), (selected, 'retained neck reveal', xy, rgba)
        retained.append({'xy': row['xy'], 'rgba': rgba})
    return {'concealed_source_points': concealment, 'exact_retained_neck_reveal_points': retained}


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
    live_origin = None
    if args.url:
        live_origin = args.url.rstrip('/') + '/'
        if live_origin != 'https://elgabrymd-arch.github.io/HEWRS-v1-16-1-candidate/':
            raise ValueError('Live verification is restricted to the established HEWRS publication')
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
    # Four independently retained collar cases use the immutable pre-shoulder
    # runtime as a same-engine pixel oracle. This is a separate diagnostic
    # context, never the candidate application or its published delivery.
    reference_runtime = ROOT / 'runtime/avatar-v3-candidate-f39eace65c2a874a0b64.js'
    reference_sha = 'f39eace65c2a874a0b6436afe904bdc6f0059530ea858ceb8c8f4878af4def43'
    assert digest(reference_runtime.read_bytes()) == reference_sha
    reference_html = baseline.read_text()
    runtime_tags = re.findall(r'<script\b[^>]*\bsrc="runtime/[^\"]+"[^>]*></script>', reference_html)
    assert len(runtime_tags) == 1
    tag = re.sub(r'src="[^"]+"', 'src="' + str(reference_runtime.relative_to(ROOT)) + '?v=' + reference_sha[:16] + '"', runtime_tags[0])
    sri = base64.b64encode(bytes.fromhex(reference_sha)).decode()
    tag = re.sub(r'integrity="[^"]+"', 'integrity="sha256-' + sri + '"', tag)
    reference_html = reference_html.replace(runtime_tags[0], tag)
    with tempfile.NamedTemporaryFile('w', dir=ROOT, prefix='issue19-collar-reference-', suffix='.html', delete=False) as reference_file:
        reference_file.write(reference_html)
        reference_path = Path(reference_file.name)
    output = args.output.resolve() / args.browser / args.suite / f'shard-{args.shard}'
    for part in [*DETAILS, 'native', 'phone', 'sheets']:
        (output / part).mkdir(parents=True, exist_ok=True)
    checks, captures, errors, bad_requests, external = [], [], [], [], []
    report = {'schema': 'hewrs.issue19.browser-matrix.v1', 'browser': args.browser,
              'baseline_commit': BASELINE, 'suite': args.suite, 'shard': args.shard,
              'shards': args.shards, 'mode_filter': args.only_mode, 'case_limit': args.limit,
              'expected_cases': len(rows), 'checks': checks,
              'captures': captures, 'page_errors': errors, 'bad_requests': bad_requests,
              'external_requests': external, 'owner_data_accessed': False,
              'application_url': live_origin, 'application_response_source': 'live_https_only' if live_origin else 'local_checkout_http',
              'retained_collar_reference_runtime_sha256': reference_sha,
              'cuff_underlay_fixture_sha256': digest((ROOT / 'tests/issue19-cuff-underlay-fixtures.json').read_bytes()),
              'cuff_underlay_source_oracles': {},
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
                page_origin = live_origin if live_origin and label == 'issue19-candidate' else origin
                context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
                contexts.append(context)
                def route(request):
                    if urlsplit(request.request.url)[:2] == urlsplit(page_origin)[:2]:
                        request.continue_()
                    else:
                        external.append({'page': label, 'url': request.request.url}); request.abort()
                context.route('**/*', route)
                page = context.new_page(); page.set_default_timeout(120000)
                page.on('pageerror', lambda error: errors.append({'page': label, 'error': str(error)}))
                page.on('requestfailed', lambda request: bad_requests.append({'page': label, 'url': request.url, 'error': request.failure}))
                page.on('response', lambda response: bad_requests.append({'page': label, 'url': response.url, 'status': response.status})
                        if response.status >= 400 and not response.url.endswith('/favicon.ico') else None)
                response = page.goto(page_origin + relative, wait_until='domcontentloaded', timeout=120000)
                check(label + ': entrypoint HTTP 200', response.status == 200)
                check(label + ': exact expected entrypoint bytes', digest(response.body()) == digest((ROOT / relative).read_bytes()))
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
                  features['collar']['revision'] == 'AVATAR_V3_ALL_SHIRT_COLLAR_FIT_6'
                  and features['collar']['active_ids'] == SHIRTS
                  and features['collar']['bounds'] == [330, 355, 336, 260]
                  and features['collar']['modified_strips'] == [[330, 355, 92, 260], [575, 355, 91, 260]]
                  and features['collar']['top_center_bounds'] == [422, 420, 153, 47]
                  and features['collar']['protected_knot_corridor'] == [422, 467, 153, 63]
                  and features['collar']['lower_center_backing_bounds'] == [422, 530, 153, 85]
                  and features['collar']['jacket_lower_opening_backing_bounds'] == [422, 615, 153, 235]
                  and features['collar']['jacket_outer_shoulder_bounds'] == [[0, 350, 330, 250], [666, 350, 330, 250]]
                  and features['collar']['jacket_inner_shoulder_neck_distance'] == 50
                  and features['collar']['tied_neck_corner_cleanup'] == [[422, 401, 19, 19], [560, 405, 15, 15]])
            check('Concealed cuffs use bounded selected-jacket sleeves and preserve shirt-only',
                  features['cuff']['revision'] == 'AVATAR_V3_CONCEALED_CUFFS_3'
                  and features['cuff']['bounds'] == [[20, 1180, 240, 246], [736, 1180, 240, 246]]
                  and features['cuff']['shirt_only'] == 'exact_pass_through'
                  and features['cuff']['opaque_hand_pixels'] == 'inherited_finished_frame_exact'
                  and features['cuff']['underlay'] == 'selected-original-trousers-posed-once-no-avatar-exposure'
                  and features['cuff']['inner_seam'] == 'selected-original-jacket-retained-to-fitted-sleeve-boundary')
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
            original_cuff_underlays = {}
            original_shoulders = {}
            retained_references = {}
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
                # ties per route, without duplicating all 1,564 tie PNGs.
                keep_native = (args.suite == 'shirts' and selected['shirtId'] in {'DS013', 'DS019', 'DS027', 'DS034', 'DS038', 'DS035', 'DS048'}
                               or args.suite == 'ties' and selected['state'] in {'T017', 'T047'}
                               or (args.limit is not None and args.only_mode in {'S03', 'B15'}))
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
                original_shoulder = jacket_shoulder_source(after, selected, original_shoulders)
                b02_samples = b02_mask_samples(new_image, selected, original_shoulder, avatar_source)
                if b02_samples:
                    check(name + ': fixed B02 neck, shirt coverage, navy and source-over controls pass', True, b02_samples)
                differences = change_check(old_image, new_image, selected, hand_mask, avatar_source, original_shoulder)
                check(name + ': corrections stay inside independent fit boundaries', differences['outside_allowed_pixels'] == 0, differences)
                check(name + ': approved opaque hand pixels remain exact', differences['opaque_hand_pixels_changed'] == 0, differences)
                cuff_reference = cuff_underlay_source(before, selected, original_cuff_underlays)
                cuff_samples = cuff_underlay_samples(new_image, cuff_reference)
                if cuff_samples is not None:
                    proof = cuff_reference['proof']
                    report['cuff_underlay_source_oracles'][proof['identity_sha256']] = proof
                    check(name + ': original trouser and jacket ownership survives cuff fitting with fixed exterior controls',
                          cuff_samples['opaque_trouser_pixels_lost'] == 0
                          and cuff_samples['positive_points_wrong'] == 0
                          and cuff_samples['original_jacket_coverage_lost'] == 0
                          and not cuff_samples['fixed_control_failures'], cuff_samples)
                check(name + ': approved head, legs and footwear remain exact', old['head_sha256'] == new['head_sha256'] and old['lower_sha256'] == new['lower_sha256'])
                check(name + ': approved central face and chin remain exact outside source-restoration slots', old['face_and_chin_sha256'] == new['face_and_chin_sha256'])
                check(name + ': tied neck cleanup restores exact original avatar pixels', differences['neck_corner_wrong_source_pixels'] == 0, differences)
                check(name + ': shoulder concealment uses exact original jacket pixels and preserves opaque jacket cloth',
                      differences['outer_wrong_source_pixels'] == 0 and differences['opaque_original_jacket_shoulder_pixels_changed'] == 0, differences)
                if selected.get('blazerId') == 'B02':
                    check(name + ': every effective opaque B02 jacket pixel equals its independent original source',
                          differences['b02_effective_opaque_jacket_pixels_checked'] > 0
                          and differences['b02_effective_opaque_jacket_wrong_source_pixels'] == 0, differences)
                shoulder_samples = shoulder_contour_samples(new_image, selected)
                if shoulder_samples:
                    check(name + ': independently observed original shoulder BODY coverage remains intact', True, shoulder_samples)
                jacket_samples = jacket_aperture_samples(new_image, selected)
                if jacket_samples:
                    check(name + ': complete audited shirt opening and original jacket controls remain correct', True, jacket_samples)
                partial_tie_samples = partial_tie_backing_samples(new_image, selected)
                if partial_tie_samples:
                    check(name + ': independently audited partial tie edges have opaque shirt backing', True, partial_tie_samples)
                retained_reference = None
                if matching_shoulder_edges(selected, 'retained_reveal_points'):
                    reference_key = (row['mode'], selected['shirtId'], selected['state'] == 'NO_TIE')
                    if reference_key not in retained_references:
                        reference_page = open_page(reference_path.name, 'retained-collar-reference')
                        reference_capture = reference_page.evaluate(FIT_FRAME, {'selected': selected, 'ignoredHashes': []})
                        reference_image, _ = decode_frame(reference_capture)
                        retained_references[reference_key] = (reference_image, selected.copy())
                        reference_context = reference_page.context
                        reference_context.close(); contexts.remove(reference_context)
                    # The independent fixture proves all47 projected ties have
                    # zero alpha at these exact retained collar controls.
                    retained_reference, reference_selection = retained_references[reference_key]
                edge_samples = shoulder_edge_samples(new_image, selected, original_shoulder, retained_reference)
                if retained_reference is not None:
                    edge_samples['same_engine_reference_selection'] = reference_selection
                if any(edge_samples.values()):
                    check(name + ': independent shoulder leaks close while the same-engine neck reveal remains exact', True, edge_samples)
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
                                 'jacket_aperture_regressions': jacket_samples,
                                 'partial_tie_backing_regressions': partial_tie_samples,
                                 'b02_source_mask_regressions': b02_samples,
                                 'cuff_underlay_regressions': cuff_samples,
                                 'shoulder_edge_regressions': edge_samples,
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
        write_report(); server.shutdown(); server.server_close(); reference_path.unlink(missing_ok=True)
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
    parser.add_argument('--url', help='Verify the established live HTTPS application against the local retained V3 baseline')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--only-mode', choices=MODES, help='Explicit targeted preflight; the unfiltered suites remain the exhaustive gates')
    parser.add_argument('--list', action='store_true')
    arguments = parser.parse_args()
    if not (arguments.shards > 0 and 0 <= arguments.shard < arguments.shards):
        parser.error('shard must be inside [0, shards)')
    run(arguments)
