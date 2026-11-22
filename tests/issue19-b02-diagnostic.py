#!/usr/bin/env python3
"""Read-only, isolated B02 browser pixel diagnostic; never a release acceptance.

Capture the shipped candidate, exact published baseline, and independently
constructed source planes before applying any comparison. No runtime or
existing test assertion is changed. The report preserves every disputed
coordinate and all source-plane values, including canvas-context variants.
"""
import argparse
import base64
import functools
import hashlib
import importlib.util
import io
import json
import os
import subprocess
import sys
import threading
import traceback
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright


EXPECTED_RUNTIME = '44233e6c33a9bb02c1e04ab47d0312115908ba19cfcb9cc08f16b8b1cc1a1f12'
BASELINE_HTML = '4670d41cc6139d12956dfbd064692e92fe28c719160ec2e142754b2e22de718b'
COLLAR_SOURCE = '49eeb2268fd308a87392fa6cdd6321e4b4b86d12005fc65a46d26a8363c18827'
ROI = (0, 350, 996, 600)
B02_PARTIAL_XY = {(392, 407), (392, 408), (392, 409), (392, 410)}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')


def changed_mask(a, b):
    channels = ImageChops.difference(a, b).split()
    combined = channels[0]
    for channel in channels[1:]:
        combined = ImageChops.lighter(combined, channel)
    return combined.point(lambda value: 255 if value else 0)


def points(mask, ox=0, oy=0):
    box = mask.getbbox()
    if not box:
        return set()
    pixels = mask.load()
    return {(x + ox, y + oy)
            for y in range(box[1], box[3]) for x in range(box[0], box[2])
            if pixels[x, y]}


def crop_global(image, xywh, region=ROI):
    x, y, width, height = xywh
    left, top = max(region[0], x), max(region[1], y)
    right, bottom = min(region[2], x + width), min(region[3], y + height)
    if right <= left or bottom <= top:
        return None, None
    return image.crop((left - x, top - y, right - x, bottom - y)), (left, top, right, bottom)


def plane_at(plane, xy):
    image, origin = plane
    x, y = xy
    ox, oy, width, height = origin
    return list(image.getpixel((x - ox, y - oy))) if ox <= x < ox + width and oy <= y < oy + height else None


def source_planes_js(helpers):
    # The helper fragment is the exact pinned production source, evaluated as
    # lexical code inside this isolated probe, never installed into the app.
    return r'''async s=>{
 const W=996,H=2748,X=330,Y=355,CW=336,CH=260,SHOULDER_Y=350,SHOULDER_HEIGHT=250;
 function canvas(w=W,h=H){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 function release(c){c.width=c.height=1;}
 function need(v,m){if(!v)throw Error(m);}
''' + helpers + r'''
 const app=HEWRSApp,connection=app.connection,p=app.renderer.plan(s);
 const d=Array.isArray(p)?connection.assemblies.forSelection(s.suitId,s.shoeId,s.shirtId).static.jacket:p.jacket;
 const mask=s.blazerId==='B02'?connection.continuousShirts.jacket_masks.B02:p.jacketMask||null;
 need(d,'Missing original selected jacket');
 if(mask)need(mask.source_sha256===d.sha256,'Jacket mask belongs to another source');
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const response=await fetch(app.resolveUrl(d));need(response.ok,'Original source did not load');
 const sourceHash=await digest(await response.arrayBuffer());need(sourceHash===d.sha256,'Original image hash differs');
 const loader=HEWRSRenderImageLoader.create({resolveUrl:app.resolveUrl,width:W,height:H,limit:4});
 const image=await loader.load(d),images=new Map([[d.sha256,image]]);
 if(d.display_alpha_mask)images.set(d.display_alpha_mask.sha256,await loader.load(d.display_alpha_mask));
 const records=[];globalThis.__B02_DIAGNOSTIC_PIXELS={};
 async function retain(name,c,xywh,requested){
  const ctx=c.getContext('2d'),data=ctx.getImageData(0,0,c.width,c.height).data;
  globalThis.__B02_DIAGNOSTIC_PIXELS[name]=new Uint8Array(data);
  records.push({name,xywh,png:c.toDataURL('image/png'),rgba_sha256:await digest(data),
    context_requested:requested,context_attributes:ctx.getContextAttributes?.()||null});
 }
 function context(c,cpu){return cpu?c.getContext('2d',{willReadFrequently:true}):c.getContext('2d');}
 // Independent full-image reference uses original native coordinates.
 function trace(ctx,contours){ctx.beginPath();for(const line of contours){ctx.moveTo(...line[0]);for(const point of line.slice(1))ctx.lineTo(...point);ctx.closePath();}}
 function originalBitmap(ctx,ox=0,oy=0){
  ctx.drawImage(image,-ox,-oy);
  if(d.display_alpha_mask){ctx.save();ctx.globalCompositeOperation='destination-in';ctx.drawImage(images.get(d.display_alpha_mask.sha256),-ox,-oy);ctx.restore();}
 }
 function fullEffective(cpu,intermediate){
  const c=canvas(),ctx=context(c,cpu);ctx.save();
  if(mask?.keep_contours){trace(ctx,mask.keep_contours);ctx.clip('evenodd');}
  if(intermediate){
   // No readback is allowed before this copy: preserve the existing oracle's
   // exact bitmap -> effective canvas pipeline as an independent variable.
   const raw=canvas(),rc=context(raw,cpu);originalBitmap(rc);ctx.drawImage(raw,0,0);release(raw);
  }else originalBitmap(ctx);
  ctx.restore();
  if(mask?.erase_contours){ctx.save();ctx.globalCompositeOperation='destination-out';trace(ctx,mask.erase_contours);ctx.fill('evenodd');ctx.restore();}
  return c;
 }
 for(const cpu of [false,true]){
  const tag=cpu?'cpu':'default',requested=cpu?{willReadFrequently:true}:{};
  const raw=canvas();originalBitmap(context(raw,cpu));await retain('raw_full_'+tag,raw,[0,0,W,H],requested);release(raw);
  for(const intermediate of [false,true]){
   const mode=intermediate?'bitmap':'direct',c=fullEffective(cpu,intermediate);
   await retain('independent_full_'+mode+'_'+tag,c,[0,0,W,H],requested);release(c);
  }
  for(const shoulder of [false,true]){
   const rect=shoulder?[0,350,996,250]:[330,355,336,260],name=shoulder?'shoulder':'collar';
   const c=canvas(rect[2],rect[3]),ctx=context(c,cpu);
   drawJacket(ctx,{jacket:d,jacketMask:mask},images,shoulder);
   await retain('actual_helper_'+name+'_'+tag,c,rect,requested);release(c);
  }
  // Mask coverage is retained independently from photograph decode and from
  // RGB premultiplication. Crop/full traces use the same fixed coordinates.
  for(const [name,rect]of [['full',[0,0,W,H]],['shoulder',[0,350,996,250]],['collar',[330,355,336,260]]]){
   const c=canvas(rect[2],rect[3]),ctx=context(c,cpu);ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
   if(mask?.erase_contours){ctx.globalCompositeOperation='destination-out';
    ctx.beginPath();for(const line of mask.erase_contours){ctx.moveTo(line[0][0]-rect[0],line[0][1]-rect[1]);for(const xy of line.slice(1))ctx.lineTo(xy[0]-rect[0],xy[1]-rect[1]);ctx.closePath();}ctx.fill('evenodd');}
   await retain('mask_'+name+'_'+tag,c,rect,requested);release(c);
  }
 }
 return {source:d,mask,source_hash_verified:sourceHash,selection:s,
  plan_is_legacy_array:Array.isArray(p),continuous:connection.continuousShirts.ids.includes(s.shirtId),records};
}'''


RAW_BYTES = r'''name=>{
 const data=name==='__visible__'?document.getElementById('avatar').getContext('2d',{willReadFrequently:true}).getImageData(0,0,996,2748).data:globalThis.__B02_DIAGNOSTIC_PIXELS[name];
 if(!data)throw Error('Missing retained diagnostic pixels '+name);
 let result='';for(let i=0;i<data.length;i+=16384)result+=String.fromCharCode(...data.subarray(i,i+16384));
 return btoa(result);
}'''


def save_plane(directory, name, record, page=None, snapshot=None):
    raw = base64.b64decode(record.pop('png').split(',', 1)[1])
    path = directory / (name + '.png')
    path.write_bytes(raw)
    image = Image.open(io.BytesIO(raw)).convert('RGBA')
    rgba_sha = sha(image.tobytes())
    expected = record.get('rgba_sha256')
    metadata = dict(record, path=path.name, png_sha256=sha(raw), decoded_rgba_sha256=rgba_sha,
                    png_roundtrip_exact=(expected is None or expected == rgba_sha))
    if expected and expected != rgba_sha:
        exact = base64.b64decode(page.evaluate(RAW_BYTES, snapshot or name))
        (directory / (name + '.rgba')).write_bytes(exact)
        metadata['raw_rgba_path'] = name + '.rgba'
        metadata['raw_rgba_sha256'] = sha(exact)
        metadata['raw_rgba_matches_capture'] = sha(exact) == expected
        write_json(directory / (name + '-integrity.json'), metadata)
        if not metadata['raw_rgba_matches_capture']:
            raise AssertionError('Retained raw RGBA differs from the captured digest: ' + name)
        image = Image.frombytes('RGBA', image.size, exact)
    return image, metadata


def compare_case(directory, planes, metadata, selection, contract):
    current, baseline = planes['current'][0], planes['baseline'][0]
    oracle = planes['oracle_default'][0]
    changed = changed_mask(baseline.crop(ROI), current.crop(ROI))
    opaque = oracle.getchannel('A').point(lambda a: 255 if a == 255 else 0)
    disputed = points(ImageChops.multiply(changed, opaque), ROI[0], ROI[1])
    source_names = [name for name in planes if name not in {'current', 'baseline', 'hand_mask', 'avatar'}
                    and not name.startswith('mask_')]
    comparisons, union = [], set(disputed) | B02_PARTIAL_XY
    reference_name = 'independent_full_direct_cpu'
    reference, reference_rect = planes[reference_name]
    for name in source_names:
        image, rect = planes[name]
        a, box = crop_global(image, rect)
        b, _ = crop_global(reference, reference_rect, box)
        diff = changed_mask(a, b)
        xy = points(diff, box[0], box[1])
        union.update(xy)
        comparisons.append({'name': name, 'reference': reference_name,
                            'region_xyxy': list(box), 'changed_pixels': len(xy),
                            'difference_bbox_in_crop': diff.getbbox()})
    opaque_comparisons = []
    for name in source_names:
        source, box = crop_global(*planes[name])
        candidate = current.crop(box)
        opaque = source.getchannel('A').point(lambda a: 255 if a == 255 else 0)
        wrong = ImageChops.multiply(changed_mask(source, candidate), opaque)
        xy = points(wrong, box[0], box[1])
        union.update(xy)
        opaque_comparisons.append({'source': name, 'region_xyxy': list(box),
                                   'opaque_source_pixels': opaque.histogram()[255],
                                   'candidate_wrong_source_pixels': len(xy),
                                   'wrong_bbox_in_crop': wrong.getbbox()})
    mask_comparisons = []
    full_mask, full_mask_rect = planes['mask_full_cpu']
    for name in [n for n in planes if n.startswith('mask_')]:
        image, box = crop_global(*planes[name])
        ref, _ = crop_global(full_mask, full_mask_rect, box)
        diff = changed_mask(image, ref)
        xy = points(diff, box[0], box[1])
        union.update(xy)
        mask_comparisons.append({'name': name, 'reference': 'mask_full_cpu',
                                 'region_xyxy': list(box), 'changed_pixels': len(xy),
                                 'difference_bbox_in_crop': diff.getbbox()})
    # Include every changed pixel at every effective-opaque source variant,
    # not only the original 30. Raw-photo differences are context because the
    # B02 contour deliberately removes original foreign matte material.
    pixel_rows = [{'xy': list(xy), 'original_gate_disputed': xy in disputed,
                   'fixed_partial_edge_control': xy in B02_PARTIAL_XY,
                   'rgba': {name: plane_at(plane, xy) for name, plane in planes.items()}}
                  for xy in sorted(union, key=lambda p: (p[1], p[0]))]
    write_json(directory / 'ALL_VARIANT_PIXEL_ROWS.json', pixel_rows)
    write_json(directory / 'ORIGINAL_GATE_DISPUTED_PIXELS.json',
               [row for row in pixel_rows if row['original_gate_disputed']])
    hands = planes['hand_mask'][0].getchannel('A').point(lambda a: 255 if a == 255 else 0)
    existing = contract.change_check(baseline, current, selection, hands, planes['avatar'][0], oracle)
    original_gate = (existing['outer_wrong_source_pixels'] == 0
                     and existing['opaque_original_jacket_shoulder_pixels_changed'] == 0)
    result = {'selection': selection, 'existing_change_check': existing,
              'existing_opaque_jacket_gate_passed': original_gate,
              'original_gate_disputed_count': len(disputed),
              'all_variant_pixel_row_count': len(pixel_rows),
              'source_plane_comparisons': comparisons,
              'candidate_vs_each_opaque_source': opaque_comparisons,
              'mask_coverage_comparisons': mask_comparisons,
              'captures': metadata,
              'original_gate_disputed_file': 'ORIGINAL_GATE_DISPUTED_PIXELS.json',
              'all_variant_rows_file': 'ALL_VARIANT_PIXEL_ROWS.json'}
    write_json(directory / 'COMPARISON.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', choices=('chromium', 'webkit'), required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--root', type=Path)
    args = parser.parse_args()
    candidates = [Path(__file__).resolve().parent, *Path(__file__).resolve().parents]
    root = args.root.resolve() if args.root else next(p for p in candidates if (p / 'AVATAR_V3_RELEASE.json').is_file())
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(root / 'tests'))
    photos = module(root / 'tests/five-round-photos-browser.py', 'b02_photos')
    contract = module(root / 'tests/issue19-browser.py', 'b02_contract')
    delivery = photos.describe()
    collar = (root / 'src/avatar-v3-shirt-collar-fit.js').read_text()
    if sha(collar.encode()) != COLLAR_SOURCE:
        raise AssertionError('Diagnostic must use the exact reviewed collar source')
    start, end = collar.index(' function draw(ctx,'), collar.index(' function cleanNativeMatte(')
    helpers = collar[start:end]
    probe = source_planes_js(helpers)
    (output / 'SOURCE_PLANES.js').write_text(probe + '\n')
    if sha((root / 'avatar-v3-issue19-baseline.html').read_bytes()) != BASELINE_HTML:
        raise AssertionError('Exact baseline HTML pin differs')
    runtime = next((root / 'runtime').glob('avatar-v3-candidate-' + EXPECTED_RUNTIME[:20] + '.js'))
    if sha(runtime.read_bytes()) != EXPECTED_RUNTIME:
        raise AssertionError('Current runtime pin differs')
    cases = [('DS026', 'T029', 'B02'), ('DS035', 'T002', 'B02'),
             ('DS001', 'NO_TIE', 'B02'), ('DS013', 'NO_TIE', 'B02'),
             ('DS026', 'T029', 'B03'), ('DS026', 'T029', 'B02')]
    report = {'schema': 'hewrs.issue19.B02-browser-source-diagnostic.v1',
              'status': 'CAPTURING_DIAGNOSTIC_ONLY', 'browser': args.browser,
              'started_at': datetime.now(timezone.utc).isoformat(),
              'runtime_sha256': EXPECTED_RUNTIME, 'baseline_html_sha256': BASELINE_HTML,
              'collar_module_sha256': sha(collar.encode()), 'actual_helper_sha256': sha(helpers.encode()),
              'diagnostic_script_sha256': sha(Path(__file__).read_bytes()),
              'probe_js_sha256': sha((probe + '\n').encode()),
              'checkout': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
              'github_run_id': os.environ.get('GITHUB_RUN_ID'), 'active_delivery': delivery,
              'owner_data_accessed': False, 'runtime_or_assertions_modified': False,
              'cases': [], 'page_errors': [], 'failed_requests': [], 'http_errors': [], 'external_requests': []}
    write_json(output / 'RESULT.json', report)
    server, url = photos.serve(root)
    contexts = []
    try:
        with sync_playwright() as p:
            browser = getattr(p, args.browser).launch(headless=True)
            report['browser_version'] = browser.version
            def open_page(entry, label):
                context = browser.new_context(viewport={'width': 390, 'height': 844}, timezone_id='America/New_York')
                contexts.append(context)
                origin = urlsplit(url)[:2]
                def route(r):
                    if urlsplit(r.request.url)[:2] == origin:
                        r.continue_()
                    else:
                        report['external_requests'].append({'surface': label, 'url': r.request.url})
                        r.abort()
                context.route('**/*', route)
                page = context.new_page()
                page.set_default_timeout(120000)
                page.on('pageerror', lambda error: report['page_errors'].append({'surface': label, 'error': str(error)}))
                page.on('requestfailed', lambda req: report['failed_requests'].append({'surface': label, 'url': req.url, 'failure': req.failure}))
                page.on('response', lambda res: report['http_errors'].append({'surface': label, 'url': res.url, 'status': res.status}) if res.status >= 400 and not res.url.endswith('/favicon.ico') else None)
                page.goto(url + entry, wait_until='domcontentloaded', timeout=120000)
                page.wait_for_function('()=>globalThis.HEWRS_READY && HEWRSApp.rejection', timeout=120000)
                page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
                return page
            before = open_page('avatar-v3-issue19-baseline.html', 'baseline')
            after = open_page('index.html', 'candidate')
            report['served_runtime'] = after.evaluate('()=>document.querySelector(\'script[src^="runtime/"]\').getAttribute("src")')
            if urlsplit(report['served_runtime']).path.lstrip('/') != runtime.relative_to(root).as_posix():
                raise AssertionError('The actual candidate entrypoint selected a different runtime')
            report['served_runtime_sha256'] = after.evaluate(r'''async()=>{
             const node=document.querySelector('script[src^="runtime/"]'),response=await fetch(node.src);
             if(!response.ok)throw Error('Actually served runtime could not be fetched');
             return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await response.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
            }''')
            if report['served_runtime_sha256'] != EXPECTED_RUNTIME:
                raise AssertionError('Actually served runtime bytes differ from the reviewed pin')
            protected = '()=>({wear:HEWRSApp.store.snapshot(),favorites:HEWRSApp.favorites.snapshot(),rejections:HEWRSApp.ownerFeedback.snapshot().events})'
            state_before = {'baseline': before.evaluate(protected), 'candidate': after.evaluate(protected)}
            oracle_cpu_js = contract.JACKET_SHOULDER_SOURCE.replace("getContext('2d')", "getContext('2d',{willReadFrequently:true})")
            for index, (shirt, tie, blazer) in enumerate(cases):
                selection = photos.outfit('blazer', shirt, tie, top=blazer)
                name = f'{index:02d}-{blazer}-{shirt}-{tie}'
                directory = output / name
                directory.mkdir(parents=True, exist_ok=True)
                planes, capture_records = {}, {}
                # The actual frames are saved before any pixel assertion.
                for label, page in [('baseline', before), ('current', after)]:
                    frame = page.evaluate(photos.FRAME, {'selection': selection, 'captureComparison': True})
                    png = frame.pop('comparison_png')
                    frame.pop('detail', None)
                    frame.pop('native_collar', None)
                    image, rec = save_plane(directory, label,
                                            {'png': png, 'xywh': [0, 0, 996, 2748], 'rgba_sha256': frame['rgba_sha256']},
                                            page, '__visible__')
                    planes[label] = (image, rec['xywh'])
                    capture_records[label] = rec
                    write_json(directory / (label + '-frame.json'), frame)
                captured = after.evaluate(probe, selection)
                for record in captured.pop('records'):
                    plane_name = record.pop('name')
                    image, rec = save_plane(directory, plane_name, record, after, plane_name)
                    planes[plane_name] = (image, rec['xywh'])
                    capture_records[plane_name] = rec
                write_json(directory / 'SOURCE_IDENTITY.json', captured)
                for label, js in [('oracle_default', contract.JACKET_SHOULDER_SOURCE),
                                  ('oracle_cpu', oracle_cpu_js), ('hand_mask', contract.HAND_MASK),
                                  ('avatar', contract.AVATAR_SOURCE)]:
                    png = after.evaluate(js, selection) if label.startswith('oracle_') else after.evaluate(js)
                    rect = [0, 350, 996, 250] if label.startswith('oracle_') else [0, 0, 996, 2748]
                    image, rec = save_plane(directory, label, {'png': png, 'xywh': rect})
                    planes[label] = (image, rect)
                    capture_records[label] = rec
                # Durable capture inventory exists even if comparison fails.
                write_json(directory / 'CAPTURES.json', capture_records)
                comparison = compare_case(directory, planes, capture_records, selection, contract)
                report['cases'].append({'name': name, 'selection': selection,
                                        'directory': directory.name,
                                        'old_gate_passed': comparison['existing_opaque_jacket_gate_passed'],
                                        'old_gate_disputed_count': comparison['original_gate_disputed_count'],
                                        'candidate_vs_opaque_sources': comparison['candidate_vs_each_opaque_source']})
                write_json(output / 'RESULT.json', report)
                print(json.dumps({'case': name, 'original_gate_disputed_count': comparison['original_gate_disputed_count'],
                                  'saved_source_planes': len(planes)}), flush=True)
            state_after = {'baseline': before.evaluate(protected), 'candidate': after.evaluate(protected)}
            report['isolated_storage_unchanged'] = state_before == state_after
            report['protected_before'] = state_before
            report['protected_after'] = state_after
            for context in contexts:
                context.close()
            contexts.clear()
            browser.close()
        report['status'] = 'CAPTURED_DIAGNOSTIC_ONLY_REQUIRES_INDEPENDENT_REVIEW'
        report['existing_gate_failures'] = sum(not row['old_gate_passed'] for row in report['cases'])
        # Completion means evidence was captured; it does not approve pixels,
        # ignore failing original gates, or authorize release acceptance.
        write_json(output / 'RESULT.json', report)
        print(json.dumps({'status': report['status'], 'cases': len(report['cases']),
                          'existing_gate_failures': report['existing_gate_failures']}), flush=True)
    except Exception:
        report['status'] = 'DIAGNOSTIC_CAPTURE_FAILED'
        report['exception'] = traceback.format_exc()
        write_json(output / 'RESULT.json', report)
        raise
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
