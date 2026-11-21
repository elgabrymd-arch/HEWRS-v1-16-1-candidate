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
import io
import json
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
IDS = ['DS001', 'DS014', 'DS017', 'DS023', 'DS034', 'DS035', 'DS036', 'DS051']
MODES = ['shirt-only', 'B03', 'B02', 'S05', 'S11']
AVATAR = 'a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d'


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
  photos_decoded:photos.length>0&&photos.every(image=>image.naturalWidth>0&&image.naturalHeight>0),
  card_shirt:card.items.find(x=>x.role==='Shirt'),card_tie:card.items.find(x=>x.role==='Tie'),
  plan:{operation:p.operation,kind:p.kind,avatar:p.avatar?.sha256,tie:p.tie?.sha256||null,
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
     p.avatar?.sha256!==HEWRSContinuousShirts.avatarSource||p.garment!==c.continuousShirts.shirts[id].modes.tied)
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
    ids, modes = args.ids.split(','), args.modes.split(',')
    output = args.output.resolve() / args.browser
    for directory in [output, output / 'native', output / 'upper', output / 'phone']:
        directory.mkdir(parents=True, exist_ok=True)
    checks, frames, errors, failures, http_errors, external = [], [], [], [], [], []
    report = dict(schema='hewrs.continuous-shirts.browser.v1', browser=args.browser,
                  started_at=datetime.now(timezone.utc).isoformat(), entrypoint=args.entrypoint,
                  entrypoint_sha256=hashlib.sha256((args.root / args.entrypoint).read_bytes()).hexdigest(),
                  owner_data_accessed=False, fresh_browser_context=True,
                  visual_approval='NOT_GRANTED_BY_AUTOMATED_CHECKS', ids=ids, modes=modes,
                  checks=checks, frames=frames, page_errors=errors, failed_requests=failures,
                  http_errors=http_errors, blocked_external_requests=external)

    def save():
        report.update(passed=sum(c['passed'] for c in checks), failed=sum(not c['passed'] for c in checks))
        (output / 'RESULT.json').write_text(json.dumps(report, indent=2) + '\n')

    def check(name, okay, detail=None):
        checks.append(dict(name=name, passed=bool(okay), detail=detail))
        if not okay:
            raise AssertionError(name + ': ' + str(detail))

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

            def open_page(base, label):
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
                response = page.goto(base + args.entrypoint, wait_until='domcontentloaded', timeout=120000)
                check(label + ': actual entrypoint loads', response is not None and response.status == 200)
                page.wait_for_function('()=>globalThis.HEWRS_READY && HEWRSApp.rejection', timeout=120000)
                page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
                return context, page

            context, page = open_page(origin, 'candidate')
            actual = page.evaluate('()=>HEWRSApp.connection.continuousShirts.ids')
            check('Candidate enables every requested exact shirt ID', all(sid in actual for sid in ids), actual)
            check('Fresh synthetic rejection state is empty and ready', page.evaluate('()=>HEWRSApp.ownerFeedback.status().ready&&!HEWRSApp.feedbackReadError&&HEWRSApp.ownerFeedback.snapshot().active.length===0'))
            report['runtime'] = page.evaluate('()=>({version:HEWRSApp.version,scripts:Array.from(document.querySelectorAll("script[src]"),x=>({src:x.getAttribute("src"),integrity:x.integrity}))})')
            before = protected(page)
            report['all_tie_bindings'] = page.evaluate(ALL_TIES)
            check('All 47 exact tie bindings survive all enabled shirts in three rendering modes', report['all_tie_bindings']['checked'] == len(actual) * 47 * 3 and not report['all_tie_bindings']['failures'], report['all_tie_bindings'])
            head = page.evaluate('''async()=>{const app=HEWRSApp,d=app.connection.manifest.static.avatar,image=new Image();image.src=app.resolveUrl(d);await image.decode();const c=document.createElement('canvas');c.width=996;c.height=350;c.getContext('2d').drawImage(image,0,0);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,996,350).data)),b=>b.toString(16).padStart(2,'0')).join('');}''')
            if args.baseline_root:
                baseline_server, baseline_origin = serve(args.baseline_root.resolve())
                servers.append(baseline_server)
                baseline_context, baseline_page = open_page(baseline_origin, 'baseline')
                controls = [('DS005', 'NO_TIE', 'shirt-only'), ('DS015', 'T017', 'B03'), ('DS029', 'T029', 'S05')]
                report['unaffected_controls'] = []
                for shirt, state, mode in controls:
                    selected = selection(shirt, state, mode)
                    current, original = page.evaluate(FRAME, selected), baseline_page.evaluate(FRAME, selected)
                    check('Unchanged delegated full frame: ' + shirt + '/' + mode, current['rgba_sha256'] == original['rgba_sha256'])
                    report['unaffected_controls'].append(dict(selection=selected, rgba_sha256=current['rgba_sha256'], identical=True))
                baseline_context.close()
            for row in fixtures(ids, modes):
                selected, mode = row['selection'], row['mode']
                label = selected['shirtId'] + '-' + mode + '-' + selected['state']
                result = page.evaluate(FRAME, selected)
                raw = base64.b64decode(result.pop('png').split(',', 1)[1])
                picture = Image.open(io.BytesIO(raw)).convert('RGBA')
                check(label + ': selected and committed outfit identities agree', result['selection'] == selected and result['last'] == selected)
                check(label + ': complete native frame', result['status'] == 'ready' and result['dimensions'] == [996, 2748] and picture.size == (996, 2748))
                check(label + ': decoded pixels match browser digest', hashlib.sha256(picture.tobytes()).hexdigest() == result['rgba_sha256'])
                check(label + ': corrected whole garment route excludes old ownership', result['plan']['operation'] == 'CONTINUOUS_SOURCE_SHIRT' and result['plan']['body'] and not result['plan']['borrowed_ownership'])
                check(label + ': frozen avatar registration and head pixels remain exact', result['plan']['avatar'] == AVATAR and result['head_sha256'] == head)
                check(label + ': registered garment previews and exact shirt/tie identities remain available', result['photos_decoded'] and result['card_shirt']['id'] == selected['shirtId'] and result['card_tie']['id'] == (None if selected['state'] == 'NO_TIE' else selected['state']))
                layout = result['layout']
                check(label + ': native outfit remains inside 390px phone layout', layout['viewport'] == 390 and layout['document_width'] <= 391 and layout['canvas_left'] >= -1 and layout['canvas_right'] <= 391 and layout['canvas_height'] > 0, layout)
                native_path, upper_path, phone_path = 'native/' + label + '.png', 'upper/' + label + '.png', 'phone/' + label + '.png'
                (output / native_path).write_bytes(raw)
                picture.crop((0, 0, 996, 1440)).save(output / upper_path)
                page.locator('#avatar').screenshot(path=str(output / phone_path))
                result.update(mode=mode, primary=row['primary'], native_path=native_path, upper_path=upper_path, phone_path=phone_path)
                frames.append(result)
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
