#!/usr/bin/env python3
"""Capture actual shipped/candidate HEWRS collars and compare native pixels.

Every run uses a new isolated browser profile and serves the specified on-disk
entrypoint unchanged. No image is substituted in the rendering path. Baselines
and candidate captures are compared only within the same browser engine.
"""
import argparse
import base64
import functools
import hashlib
import io
import json
import shutil
import threading
import traceback
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
IDS = 'DS001,DS014,DS017,DS023,DS034,DS035,DS036,DS051'
COLLAR_BBOX = (320, 350, 680, 590)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def serve(root):
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, 'http://127.0.0.1:%d/' % server.server_address[1]


def selection(mode, shirt, state, top=None, pants='PG002'):
    value = dict(shirtId=shirt, state=state, shoeId='shoe-8', watchId=None)
    if mode == 'suit':
        value['suitId'] = top or 'S05'
    elif mode == 'blazer':
        value.update(blazerId=top or 'B03', pantId=pants)
    elif mode == 'shirt-only':
        value.update(shirtOnly=True, pantId=pants)
    else:
        raise ValueError(mode)
    return value


FRAME = r'''async selection => {
 const app=HEWRSApp;
 const applied=await app.apply(selection,{origin:'manual',save:false,keepPreferences:true});
 if(applied?.cancelled)throw Error('Unexpected render cancellation');
 const canvas=document.getElementById('avatar');
 const rgba=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
 const digest=await crypto.subtle.digest('SHA-256',rgba);
 const cards=app.cardSnapshot();
 const photos=Array.from(document.querySelectorAll('#option-card-items img'));
 await Promise.all(photos.map(image=>image.decode()));
 return {selection:app.state().selection,last:app.renderer.last(),
   status:canvas.dataset.status,dimensions:[canvas.width,canvas.height],
   rgba_sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),
   png:canvas.toDataURL('image/png'),
   card_shirt:cards.items.find(item=>item.role==='Shirt'),
   card_tie:cards.items.find(item=>item.role==='Tie'),
   photos_decoded:photos.length>0&&photos.every(image=>!image.hidden&&image.naturalWidth>0&&image.naturalHeight>0),
   plan:app.renderer.plan(selection)};
}'''


REVIEWED_B01_FRAME = r'''async selected => {
 const app=HEWRSApp,panel=HEWRSReviewedIntegration,before=app.state().selection;
 await panel.load({initialUpdate:false});
 const settings={
  'rd-view':'explore','rd-style':'AUTO','rd-occasion':'dinner',
  'rd-mode':'blazer','rd-formality':'open_collar_allowed',
  'rd-b01-context':'summer_weekend_dinner','rd-topwear':selected.blazerId,
  'rd-pants':selected.pantId,'rd-shirt':selected.shirtId,'rd-tie':'__NONE__',
  'rd-shoe':selected.shoeId,'rd-watch-choice':'__NONE__'
 };
 for(const [id,value]of Object.entries(settings)){
  const control=document.getElementById(id);control.value=value;
  if(control.value!==value)throw Error('Missing exact reviewed choice: '+id+'='+value);
 }
 document.getElementById('rd-watch-choice').dispatchEvent(new Event('change',{bubbles:true}));
 const dialog=document.getElementById('rd-dialog');if(!dialog.open)dialog.showModal();
 const context=panel.ownerContext(),policy=HEWRSOutfitFeedback.ownerRuleCheck(selected,{context});
 if(!policy.allowed||!app.ownerFeedback.allowed(selected,context))throw Error('B01 fixture violates owner context');
 const search=await panel.update();
 if(!search||search.all_possibilities.length!==1||search.counts.clothing_considered!==1||search.counts.footwear_expansions!==1)throw Error('Exact B01 search must return exactly one supported possibility');
 const entry=search.all_possibilities[0],rendered=await panel.render(entry.id);
 if(rendered?.status!=='ready'||!rendered.unreviewed||entry.owner_approved!==false)throw Error('B01 preview must stay explicitly unreviewed');
 const canvas=document.getElementById('rd-canvas');
 const rgba=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
 const digest=await crypto.subtle.digest('SHA-256',rgba);
 const photos=Array.from(document.querySelectorAll('#rd-component-cards img'));
 await Promise.all(photos.map(image=>image.decode()));
 const selection=panel.discovery().nativeSelection(panel.currentEntry().outfit,panel.watch());
 const result={selection,last:rendered.selection,status:canvas.dataset.status,
  dimensions:[canvas.width,canvas.height],png:canvas.toDataURL('image/png'),
  rgba_sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),
  photos_decoded:photos.length>0&&photos.every(image=>!image.hidden&&image.naturalWidth>0&&image.naturalHeight>0),
  route:'reviewed-explicit-b01-use-case',context,policy,entry_kind:entry.kind,owner_approved:entry.owner_approved,
  main_selection_unchanged:JSON.stringify(before)===JSON.stringify(app.state().selection)};
 panel.close();return result;
}'''


def fixtures(args):
    rows = []
    def add(mode, shirt, state, top=None, pants='PG002', unchanged=False):
        value = selection(mode, shirt, state, top, pants)
        if any(row['selection'] == value for row in rows):
            return
        rows.append(dict(selection=value, mode=value.get('suitId') or value.get('blazerId') or mode,
            shirt=shirt, state=state, expected_unchanged=unchanged))
    for mode in args.modes.split(','):
        for shirt in args.ids.split(','):
            for state in args.states.split(','):
                add(mode, shirt, state, unchanged=mode == 'suit')
    if args.extra_controls:
        for shirt in ['DS001', 'DS014']:
            # T028 exercises native photograph tie fidelity; T029 is the prior audit reference.
            for state in ['T017', 'T028', 'T029']:
                add('shirt-only', shirt, state)
                add('blazer', shirt, state)
            for state in ['NO_TIE', 'T001', 'T028', 'T029']:
                add('blazer', shirt, state, top='B02')
            # B01 is valid only through its explicit no-tie summer-dinner route.
            add('blazer', shirt, 'NO_TIE', top='B01', pants='PT006')
        for top in ['S05', 'S11']:
            for shirt in ['DS035', 'DS023']:
                for state in ['NO_TIE', 'T017', 'T028']:
                    add('suit', shirt, state, top=top, unchanged=True)
        for shirt in ['DS002', 'DS015', 'DS026']:
            for state in ['NO_TIE', 'T017']:
                for mode in ['shirt-only', 'blazer', 'suit']:
                    add(mode, shirt, state, unchanged=True)
    return rows


def protected(page):
    return page.evaluate('()=>({wear:HEWRSApp.store.snapshot(),favorites:HEWRSApp.favorites.snapshot(),rejections:HEWRSApp.ownerFeedback.snapshot().events})')


def rgba_hash(image):
    return hashlib.sha256(image.tobytes()).hexdigest()


def sheets(output, frames, baseline=None):
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
    cell_width, cell_height = 380, 275
    groups = {}
    for frame in frames:
        groups.setdefault(frame['mode'], []).append(frame)
    for mode, rows in groups.items():
        columns = 4
        sheet = Image.new('RGB', (columns * cell_width, ((len(rows) + columns - 1) // columns) * cell_height), '#e9e9e9')
        draw = ImageDraw.Draw(sheet)
        for i, row in enumerate(rows):
            x, y = (i % columns) * cell_width, (i // columns) * cell_height
            crop = Image.open(output / row['collar_path']).convert('RGBA')
            draw.text((x + 8, y + 5), f"{row['shirt']} {row['state']} {mode}", font=font, fill='#111111')
            sheet.paste(crop, (x + 10, y + 27), crop)
        sheet.save(output / f'{mode}-collars.png')
        if baseline:
            paired = Image.new('RGB', (760, len(rows) * cell_height), '#e9e9e9')
            draw = ImageDraw.Draw(paired)
            for i, row in enumerate(rows):
                y = i * cell_height
                for col, (directory, title) in enumerate([(baseline, 'BEFORE'), (output, 'AFTER')]):
                    crop = Image.open(directory / row['collar_path']).convert('RGBA')
                    draw.text((col * 380 + 8, y + 5), f"{title} {row['shirt']} {row['state']}", font=font, fill='#111111')
                    paired.paste(crop, (col * 380 + 10, y + 27), crop)
            paired.save(output / f'{mode}-before-after.png')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--entrypoint', default='index.html')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--browser', choices=('chromium', 'webkit'), default='chromium')
    parser.add_argument('--ids', default=IDS)
    parser.add_argument('--states', default='NO_TIE,T001')
    parser.add_argument('--modes', default='shirt-only,blazer')
    parser.add_argument('--extra-controls', action='store_true', help='Add legacy B01/B02 and tie-fidelity routes, protected S05/S11 suits and unaffected shirts.')
    parser.add_argument('--baseline-output', type=Path)
    parser.add_argument('--allowed-bbox', default='320,350,680,590', help='Permitted changed-pixel rectangle x0,y0,x1,y1; outside must match exactly.')
    args = parser.parse_args()
    output = args.output.resolve() / args.browser
    output.mkdir(parents=True, exist_ok=True)
    (output / 'native').mkdir(exist_ok=True)
    (output / 'collars').mkdir(exist_ok=True)
    baseline = args.baseline_output.resolve() / args.browser if args.baseline_output else None
    baseline_frames = {row['native_path']:row for row in json.loads((baseline / 'RESULT.json').read_text())['frames']} if baseline else {}
    allowed = tuple(map(int, args.allowed_bbox.split(',')))
    if len(allowed) != 4 or allowed[0] >= allowed[2] or allowed[1] >= allowed[3]:
        parser.error('--allowed-bbox must specify a nonempty x0,y0,x1,y1 rectangle')
    checks, frames, errors, failures, http_errors, external = [], [], [], [], [], []
    report = dict(schema='hewrs.collar-candidate-browser.v1', browser=args.browser,
        started_at=datetime.now(timezone.utc).isoformat(), root=str(args.root.resolve()), entrypoint=args.entrypoint,
        entrypoint_sha256=hashlib.sha256((args.root / args.entrypoint).read_bytes()).hexdigest(),
        output=str(output), owner_data_accessed=False, fresh_browser_context=True,
        collar_bbox_xyxy=list(COLLAR_BBOX), native_dimensions=[996, 2748],
        baseline_output=str(baseline) if baseline else None, allowed_changed_bbox_xyxy=list(allowed),
        checks=checks, frames=frames, page_errors=errors, failed_requests=failures,
        http_errors=http_errors, blocked_external_requests=external)
    def save():
        report.update(passed=sum(c['passed'] for c in checks), failed=sum(not c['passed'] for c in checks))
        (output / 'RESULT.json').write_text(json.dumps(report, indent=2) + '\n')
    def check(name, condition, detail=None):
        checks.append(dict(name=name, passed=bool(condition), detail=detail))
        if not condition:
            raise AssertionError(name + ': ' + str(detail))
    server, base = serve(args.root)
    try:
        with sync_playwright() as pw:
            launch = dict(headless=True)
            if args.browser == 'chromium':
                launch['args'] = ['--no-sandbox', '--disable-dev-shm-usage']
                if shutil.which('chromium'):
                    launch['executable_path'] = shutil.which('chromium')
            browser = getattr(pw, args.browser).launch(**launch)
            context = browser.new_context(viewport=dict(width=390, height=844), timezone_id='America/New_York')
            expected_origin = urlsplit(base)[:2]
            def route(request):
                if urlsplit(request.request.url)[:2] == expected_origin:
                    request.continue_()
                else:
                    external.append(request.request.url)
                    request.abort()
            context.route('**/*', route)
            page = context.new_page()
            page.set_default_timeout(90000)
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('requestfailed', lambda r: failures.append(dict(url=r.url, error=r.failure)))
            page.on('response', lambda r: http_errors.append(dict(url=r.url, status=r.status)) if r.status >= 400 and not r.url.endswith('/favicon.ico') else None)
            response = page.goto(base + args.entrypoint, wait_until='domcontentloaded', timeout=120000)
            check('Actual entrypoint returned HTTP 200', response and response.status == 200)
            page.wait_for_function('()=>globalThis.HEWRS_READY && HEWRSApp.rejection', timeout=120000)
            page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
            check('Fresh rejection database is ready and empty', page.evaluate('()=>HEWRSApp.ownerFeedback.status().ready && !HEWRSApp.feedbackReadError && HEWRSApp.ownerFeedback.snapshot().active.length===0'))
            report['runtime'] = page.evaluate('()=>({version:HEWRSApp.version,scripts:Array.from(document.querySelectorAll("script[src]"),s=>({src:s.getAttribute("src"),integrity:s.integrity}))})')
            before = protected(page)
            for fixture in fixtures(args):
                selected = fixture['selection']
                mode, shirt, state = fixture['mode'], fixture['shirt'], fixture['state']
                label = f'{shirt}-{mode}-{state}'
                result = page.evaluate(REVIEWED_B01_FRAME if selected.get('blazerId') == 'B01' else FRAME, selected)
                raw = base64.b64decode(result.pop('png').split(',', 1)[1])
                picture = Image.open(io.BytesIO(raw)).convert('RGBA')
                check(label + ': exact selected/rendered identity and state', result['selection'] == selected and result['last'] == selected, result['selection'])
                check(label + ': complete native frame', result['status'] == 'ready' and result['dimensions'] == [996, 2748] and picture.size == (996, 2748))
                check(label + ': decoded pixel hash matches browser', rgba_hash(picture) == result['rgba_sha256'])
                check(label + ': actual option-card photographs decode', result['photos_decoded'])
                if selected.get('blazerId') == 'B01':
                    check(label + ': explicit owner context and unreviewed route are preserved', result['main_selection_unchanged']
                        and result['owner_approved'] is False and result['entry_kind'] == 'unreviewed_possibility'
                        and result['policy']['allowed'] and result['context']['owner_use_case'] == 'summer_weekend_dinner')
                else:
                    check(label + ': contextual card keeps exact shirt and tie IDs', result['card_shirt']['id'] == shirt
                        and result['card_tie']['id'] == (None if state == 'NO_TIE' else state))
                native_path, crop_path = f'native/{label}.png', f'collars/{label}.png'
                (output / native_path).write_bytes(raw)
                picture.crop(COLLAR_BBOX).save(output / crop_path)
                result.update(shirt=shirt, state=state, mode=mode, expected_unchanged=fixture['expected_unchanged'], native_path=native_path, collar_path=crop_path,
                    png_sha256=hashlib.sha256(raw).hexdigest())
                if baseline:
                    previous = Image.open(baseline / native_path).convert('RGBA')
                    a, b = np.array(picture), np.array(previous)
                    changed = np.any(a != b, axis=2)
                    outside = changed.copy()
                    x0,y0,x1,y1 = allowed
                    outside[y0:y1,x0:x1] = False
                    ys,xs = np.where(changed)
                    result['comparison'] = dict(baseline_rgba_sha256=rgba_hash(previous), changed_pixels=int(changed.sum()),
                        changed_bbox_xyxy=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)] if len(xs) else None,
                        outside_allowed_changed_pixels=int(outside.sum()))
                    check(label + ': all pixels outside allowed collar region remain identical', not outside.any(), result['comparison'])
                    if fixture['expected_unchanged']:
                        check(label + ': protected control remains fully pixel-identical', not changed.any(), result['comparison'])
                    prior = baseline_frames[native_path]
                    check(label + ': original contextual photographs remain unchanged', all(result.get(key) == prior.get(key) for key in ['card_shirt','card_tie']))
                frames.append(result)
                save()
                print('CAPTURED ' + label, flush=True)
            check('Wear history, Favorites and rejection events untouched', protected(page) == before)
            check('No uncaught browser errors', not errors, errors)
            check('No failed asset requests', not failures, failures)
            check('No asset HTTP errors', not http_errors, http_errors)
            check('No external services contacted', not external, external)
            sheets(output, frames, baseline)
            context.close()
            browser.close()
    except Exception:
        report['error'] = traceback.format_exc()
        checks.append(dict(name='Browser capture completed', passed=False, detail=report['error']))
        print(report['error'], flush=True)
    finally:
        server.shutdown()
        report['finished_at'] = datetime.now(timezone.utc).isoformat()
        save()
    print(json.dumps({k:report[k] for k in ['browser','passed','failed','output']}) , flush=True)
    if report['failed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
