#!/usr/bin/env python3
"""Verify fixed partial-tie backing in the actual current browser runtime.

The comparison page differs by omission of only the exact compiled collar
wrapper. It is an explicit diagnostic, never the candidate delivery. Every
selected tie is independently projected from its original image in the same
browser engine, and compared with the production loader's projection. This
checks foreground preservation as well as final coverage; alpha255 alone is
not a tie-preservation oracle. Fresh profiles never access an owner's data.
"""
import argparse
import base64
import functools
import hashlib
import io
import json
import re
import tempfile
import threading
import time
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MODULE = 'src/avatar-v3-shirt-collar-fit.js'
TIE_RECT = (422, 467, 575, 1251)
# Literal coordinates and donors were independently measured from the
# original registered shirt images, not supplied by runtime fit counters.
POINTS = {
    'DS027': [{'xy': [458, 699], 'donor_xy': [458, 698]}],
    'DS037': [{'xy': [537, 689], 'donor_xy': [537, 689]},
              {'xy': [538, 699], 'donor_xy': [538, 699]}],
}
SUITS = [f'S{number:02}' for number in range(1, 19)]
PROTECTED = """()=>({wear:HEWRSApp.store.snapshot(),favorites:HEWRSApp.favorites.snapshot(),
feedback:HEWRSApp.ownerFeedback.snapshot().events,preferences:HEWRSApp.homePreferences?.snapshot?.()||null})"""

FRAME = r'''async ({selected,points})=>{
 const app=HEWRSApp,before=JSON.stringify((()=>(__PROTECTED__))()),
  result=await app.apply(selected,{origin:'manual',save:false,keepPreferences:true});
 if(result?.cancelled)throw Error('Cancelled partial-tie case');
 const surface=document.getElementById('avatar'),ctx=surface.getContext('2d',{willReadFrequently:true}),
  plan=app.renderer.plan(selected),manifest=app.connection.assemblies.forSelection(selected.suitId,selected.shoeId,selected.shirtId),
  shirt=manifest.shirts[selected.shirtId].states.tied,parts=[shirt.body,shirt.left,shirt.right].filter(Boolean),
  descriptor=manifest.ties[selected.state].display_layer,source=app.connection.tieFidelity.data.ties[selected.state].layers.non_suit;
 if(descriptor.sha256!==source.sha256||descriptor.avatar_v3_tie_fit?.target_end!==1211)
  throw Error('Wrong same-ID suit tie projection');
 const make=()=>{const c=document.createElement('canvas');c.width=996;c.height=2748;return c;},
  raw=async d=>{const image=new Image();image.src=app.resolveUrl(d);await image.decode();
   if(image.naturalWidth!==996||image.naturalHeight!==2748)throw Error('Wrong original source dimensions');return image;},
  hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join(''),
  crop=c=>{const out=document.createElement('canvas');out.width=153;out.height=784;
   out.getContext('2d').putImageData(c.getContext('2d').getImageData(422,467,153,784),0,0);return out.toDataURL('image/png');};
 // Independently reconstruct the documented photographic mapping; do not
 // call HEWRSAvatarV3TieFit.project to manufacture the expected projection.
 const original=await raw(source),projected=make(),pc=projected.getContext('2d',{willReadFrequently:true});
 pc.drawImage(original,0,0,996,530,0,0,996,530);
 pc.drawImage(original,0,530,996,658,0,530,996,681);
 const loader=HEWRSRenderImageLoader.create({limit:1,width:996,height:2748,resolveUrl:app.resolveUrl}),actual=make();
 actual.getContext('2d').drawImage(await loader.load(descriptor),0,0);
 const material=make(),mc=material.getContext('2d',{willReadFrequently:true});
 for(const part of parts){
  const image=await raw(part);
  if(part.display_alpha_mask){const layer=make(),lc=layer.getContext('2d');lc.drawImage(image,0,0);
   lc.globalCompositeOperation='destination-in';lc.drawImage(await raw(part.display_alpha_mask),0,0);mc.drawImage(layer,0,0);layer.width=layer.height=1;
  }else mc.drawImage(image,0,0);
 }
 const jacket=make(),jc=jacket.getContext('2d',{willReadFrequently:true}),jd=manifest.static.jacket;
 jc.drawImage(await raw(jd),0,0);
 if(jd.display_alpha_mask){jc.globalCompositeOperation='destination-in';jc.drawImage(await raw(jd.display_alpha_mask),0,0);}
 const sample=(context,xy)=>Array.from(context.getImageData(xy[0],xy[1],1,1).data),samples=points.map(point=>({...point,
  rgba:sample(ctx,point.xy),projected_tie_rgba:sample(pc,point.xy),donor_rgba:sample(mc,point.donor_xy),
  original_cloth_rgba:sample(mc,point.xy),original_jacket_rgba:sample(jc,point.xy)})),
  alpha=pixels=>{const out=new Uint8Array(pixels.length/4);for(let n=0;n<out.length;n++)out[n]=pixels[n*4+3];return out;},
  projectedPixels=pc.getImageData(0,0,996,2748).data;
 const rendered={selection:app.state().selection,last:app.renderer.last(),status:surface.dataset.status,
  dimensions:[surface.width,surface.height],source_sha256:source.sha256,source_parts:parts.map(d=>({sha256:d.sha256,rect:d.rect})),
  target_end:descriptor.avatar_v3_tie_fit.target_end,tie_crop:crop(surface),projected_crop:crop(projected),samples,
  full_rgba_sha256:await hash(ctx.getImageData(0,0,996,2748).data),
  projected_rgba_sha256:await hash(projectedPixels),projected_alpha_sha256:await hash(alpha(projectedPixels)),
  original_jacket_sha256:jd.sha256,original_jacket_mask_sha256:jd.display_alpha_mask?.sha256||null,
  effective_jacket_alpha_sha256:await hash(alpha(jc.getImageData(0,0,996,2748).data)),
  actual_loader_rgba_sha256:await hash(actual.getContext('2d').getImageData(0,0,996,2748).data),
  state_unchanged:before===JSON.stringify((()=>(__PROTECTED__))())};
 projected.width=projected.height=actual.width=actual.height=material.width=material.height=jacket.width=jacket.height=1;
 return rendered;
}'''.replace('__PROTECTED__', PROTECTED.removeprefix('()=>'))

PLAN_SCOPE = r'''({suits,shirts})=>{
 const c=HEWRSApp.connection,rows=[];
 for(const suit of suits)for(const shirt of shirts){
  const m=c.assemblies.forSelection(suit,'shoe-8',shirt),parts=m.shirts[shirt].states.tied;
  rows.push({suit,shirt,source_parts:[parts.body,parts.left,parts.right].filter(Boolean).map(d=>d.sha256),
   original_jacket_sha256:m.static.jacket.sha256,original_jacket_mask_sha256:m.static.jacket.display_alpha_mask?.sha256||null,
   ties:Array.from({length:47},(_,n)=>{const state='T'+String(n+1).padStart(3,'0'),d=m.ties[state].display_layer;
    return {state,source_sha256:d.sha256,original_same_id_sha256:c.tieFidelity.data.ties[state].layers.non_suit.sha256,
     target_end:d.avatar_v3_tie_fit?.target_end};})});
 }
 return rows;
}'''


def digest(data):
    return hashlib.sha256(data).hexdigest()


def wait_ready(page):
    # Host-side polling avoids page-side eval under the real application CSP.
    deadline = time.monotonic() + 120
    while not page.evaluate('()=>Boolean(globalThis.HEWRS_READY&&HEWRSApp.rejection)'):
        if time.monotonic() > deadline:
            raise TimeoutError('Current application did not become ready')
        page.wait_for_timeout(50)
    page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')


def decode(value):
    return Image.open(io.BytesIO(base64.b64decode(value.split(',', 1)[1]))).convert('RGBA')


def check_pixels(old, new, projected, shirt, before_samples, after_samples, expected_points=None):
    allowed = {tuple(row['xy']) for row in POINTS[shirt]} if expected_points is None else set(map(tuple, expected_points))
    literal_points = {tuple(row['xy']) for row in POINTS[shirt]}
    assert allowed.issubset(literal_points), 'Only the independently fixed coordinates may receive backing'
    assert len(before_samples) == len(after_samples) == len(literal_points)
    assert {tuple(row['xy']) for row in before_samples} == literal_points
    assert {tuple(row['xy']) for row in after_samples} == literal_points
    old_pixels, new_pixels, tie_pixels = old.load(), new.load(), projected.load()
    changed = ImageChops.difference(old, new).split()
    mask = changed[0]
    for channel in changed[1:]:
        mask = ImageChops.lighter(mask, channel)
    changed_mask = mask.load()
    total, opaque, preserved, exceptions = 0, 0, 0, []
    for y in range(784):
        for x in range(153):
            alpha = tie_pixels[x, y][3]
            if not alpha:
                continue
            total += 1
            opaque += alpha == 255
            if not changed_mask[x, y]:
                preserved += 1
                continue
            xy = (x + 422, y + 467)
            prior, current = old_pixels[x, y], new_pixels[x, y]
            assert xy in allowed and 0 < alpha < 255 and prior[3] < 255 and current[3] == 255, (
                'Unapproved selected tie pixel change', shirt, xy, prior, current, alpha)
            exceptions.append(list(xy))
    assert set(map(tuple, exceptions)) == allowed, ('Missing fixed-point repair', shirt, exceptions)
    assert old.crop((0, 0, 153, 63)).tobytes() == new.crop((0, 0, 153, 63)).tobytes(), 'Full knot corridor changed'
    samples, negative_controls = [], []
    for prior, current in zip(before_samples, after_samples):
        assert prior['xy'] == current['xy'] and prior['donor_rgba'] == current['donor_rgba']
        assert prior['projected_tie_rgba'] == current['projected_tie_rgba']
        assert prior.get('original_cloth_rgba') == current.get('original_cloth_rgba')
        assert prior.get('original_jacket_rgba') == current.get('original_jacket_rgba')
        old_rgba, new_rgba, donor = prior['rgba'], current['rgba'], current['donor_rgba']
        if tuple(prior['xy']) not in allowed:
            assert old_rgba == new_rgba and old_rgba[3] == 255, ('Opaque geometry control changed', shirt, prior, current)
            negative_controls.append({'xy': prior['xy'], 'rgba': new_rgba, 'exact_preservation': True})
            continue
        assert 0 < prior['projected_tie_rgba'][3] < 255 and old_rgba[3] < 255 and new_rgba[3] == 255
        assert donor[3] >= 248, 'The independently fixed original cloth donor is no longer opaque cloth'
        expected = [int(old_rgba[k] * old_rgba[3] / 255 + donor[k] * (1 - old_rgba[3] / 255) + .5) for k in range(3)]
        # One channel unit covers the additional get/put premultiplication
        # round trip of the omitted-wrapper diagnostic. Only these literal
        # partial points have this tolerance; opaque tie and knot are exact.
        delta = [new_rgba[k] - expected[k] for k in range(3)]
        assert all(abs(value) <= 1 for value in delta), ('Foreground source-over contribution changed', shirt, prior['xy'], old_rgba, new_rgba, donor, expected)
        samples.append({**current, 'prior_rgba': old_rgba, 'expected_source_over_rgb': expected,
                        'rgb_rounding_delta': delta, 'maximum_rounding_tolerance': 1})
    return {'selected_tie_pixels': total, 'opaque_tie_pixels_preserved_exactly': opaque,
            'selected_tie_pixels_preserved_exactly': preserved,
            'fixed_partial_edge_exceptions': exceptions, 'knot_corridor_exact': True,
            'source_over_samples': samples, 'opaque_geometry_negative_controls': negative_controls}


def run(args):
    output = args.output.resolve() / args.browser
    (output / 'pairs').mkdir(parents=True, exist_ok=True)
    (output / 'projections').mkdir(parents=True, exist_ok=True)
    release = json.loads((ROOT / 'AVATAR_V3_RELEASE.json').read_text())
    runtime_path = ROOT / release['runtime']
    runtime = runtime_path.read_bytes()
    source = (ROOT / MODULE).read_bytes()
    html = (ROOT / 'index.html').read_bytes()
    assert digest(runtime) == release['runtime_sha256']
    assert digest(source) == release['issue19_fit_modules'][MODULE]
    assert digest(html) == release['entrypoints']['index.html']
    block = ('/* V3 ISSUE 19 SOURCE: ' + MODULE + ' */\n').encode() + source + b'\n;\n'
    assert runtime.count(block) == 1, 'Exact compiled collar wrapper is not unique'
    diagnostic = runtime.replace(block, b'', 1)
    diagnostic_sha = digest(diagnostic)
    fixture = json.loads((ROOT / 'tests/issue19-partial-tie-backing-fixtures.json').read_text())
    assert {(row['shirt'], tuple(row['xy'])) for row in fixture['fixtures']} == {
        (shirt, tuple(row['xy'])) for shirt, rows in POINTS.items() for row in rows}
    geometry = fixture['geometry_extension_verification']
    revalidation = geometry['runtime_revalidation']
    assert revalidation['runtime_sha256'] == geometry['runtime_sha256'], 'Historical geometry evidence is inconsistent'
    geometry_binding = {'kind': 'exact_fixture_runtime', 'fixture_runtime_sha256': geometry['runtime_sha256']}
    if geometry['runtime_sha256'] != digest(runtime):
        # Issue 22 changes registered cloth RGB and effective DNA. Keep the
        # original fixture/runtime evidence exact, then independently prove
        # that the CURRENT renderer retains the same fit modules and garment
        # alpha before executing every original 162-case pixel assertion.
        issue22 = release.get('issue22', {})
        assert issue22.get('baseline_commit') == '95d14073e33f2b699bdb0cdbd42504b1a1be2274'
        retained_path = ROOT / ('runtime/avatar-v3-candidate-' + geometry['runtime_sha256'][:20] + '.js')
        retained_runtime = retained_path.read_bytes()
        assert digest(retained_runtime) == geometry['runtime_sha256'], 'Original geometry-proof runtime changed'
        modules = {}
        for name, expected_sha in release['source_modules'].items():
            module = (ROOT / name).read_bytes()
            assert digest(module) == expected_sha
            assert retained_runtime.count(module) == runtime.count(module) == 1, 'Current fit source differs from original geometry proof: ' + name
            modules[name] = expected_sha
        materials = json.loads((ROOT / 'data/issue22-materials.json').read_text())
        alpha_proofs = []
        for row in materials['bindings'].values():
            if not row['garment_id'].startswith('S'):
                continue
            original_bytes = (ROOT / row['source_url']).read_bytes()
            display_bytes = (ROOT / row['display_url']).read_bytes()
            assert digest(original_bytes) == row['source_sha256']
            assert digest(display_bytes) == row['display_sha256']
            original_image = Image.open(io.BytesIO(original_bytes)).convert('RGBA')
            display_image = Image.open(io.BytesIO(display_bytes)).convert('RGBA')
            assert original_image.size == display_image.size == (996, 2748)
            assert row['rect'] == [0, 0, 996, 2748]
            original_alpha = original_image.getchannel('A').tobytes()
            assert original_alpha == display_image.getchannel('A').tobytes(), 'Current suit material changed tie-occluding geometry'
            alpha_proofs.append({'id': row['garment_id'], 'layer': row['layer'],
                                 'source_sha256': row['source_sha256'], 'display_sha256': row['display_sha256'],
                                 'independent_alpha_sha256': digest(original_alpha)})
        assert len(alpha_proofs) == 6 and {row['id'] for row in alpha_proofs} == {'S06', 'S13', 'S14'}
        geometry_binding = {'kind': 'current_runtime_same_fit_sources_and_independently_exact_material_alpha',
                            'fixture_runtime_sha256': geometry['runtime_sha256'],
                            'current_runtime_sha256': digest(runtime), 'fit_modules': modules,
                            'material_alpha_proofs': alpha_proofs}
    assert revalidation['unchanged_tie_source_sha256'] == release['source_modules']['src/avatar-v3-tie-fit.js']
    assert revalidation['all18_suit_paths_same_no_mask_branch'] is True
    assert revalidation['selected_source_projection_plans'] == 1692
    assert revalidation['required_current_browser_cases_per_engine'] == 162
    assert sorted(geometry['suit_ids']) == SUITS, 'All 18 exact suit geometries require evidence'
    assert sorted(suit for group in geometry['suit_alpha_groups'] for suit in group['suit_ids']) == SUITS
    assert all(set(row['suit_ids']).issubset(SUITS) for row in fixture['fixtures']), 'No unverified fixture route'
    case_inputs = [(shirt, 'S02', f'T{index:03}') for shirt in POINTS for index in range(1, 48)]
    case_inputs += [(shirt, suit, state) for suit in SUITS if suit != 'S02'
                    for shirt in POINTS for state in ('T001', 'T047')]
    expected_points = {(shirt, suit): [row['xy'] for row in fixture['fixtures']
                                      if row['shirt'] == shirt and suit in row['suit_ids']]
                       for shirt in POINTS for suit in SUITS}
    checks, cases, errors, requests, external = [], [], [], [], []
    report = {'schema': 'hewrs.issue19.partial-tie-browser.v1', 'browser': args.browser,
              'runtime_sha256': digest(runtime), 'entrypoint_sha256': digest(html),
              'collar_source_sha256': digest(source), 'diagnostic_runtime_sha256': diagnostic_sha,
              'diagnostic_change': 'omit_exact_compiled_collar_wrapper_only',
              'fixture_sha256': digest((ROOT / 'tests/issue19-partial-tie-backing-fixtures.json').read_bytes()),
              'geometry_source_proof_sha256': geometry['source_projection_proof_sha256'],
              'geometry_render_proof_sha256': geometry['render_proof_sha256'],
              'current_geometry_binding': geometry_binding,
              'expected_cases': len(case_inputs), 'cases': cases, 'checks': checks, 'page_errors': errors,
              'coverage': {'S02_all47_actual_selections': 94, 'other17_suit_T001_T047_actual_selections': 68,
                           'other_ties_on_other_suits': 'source/endpoint plans and identical projected alpha geometry; not additional actual rendered selections'},
              'bad_requests': requests, 'external_requests': external, 'owner_data_accessed': False,
              'visual_acceptance': 'not_inferred_from_pixel_contracts'}

    def check(name, condition, detail=None):
        checks.append({'name': name, 'passed': bool(condition), 'detail': detail})
        if not condition:
            raise AssertionError(name + ': ' + repr(detail))

    def save():
        report.update(completed_cases=len(cases), passed=sum(c['passed'] for c in checks),
                      failed=sum(not c['passed'] for c in checks))
        (output / 'RESULT.json').write_text(json.dumps(report, indent=2) + '\n')

    temporary = []
    server = None
    try:
        with tempfile.NamedTemporaryFile('wb', dir=ROOT / 'runtime', prefix='issue19-omit-collar-', suffix='.js', delete=False) as handle:
            handle.write(diagnostic)
            temporary.append(Path(handle.name))
        tags = re.findall(rb'<script\b[^>]*\bsrc="runtime/[^\"]+"[^>]*></script>', html)
        assert len(tags) == 1
        tag = re.sub(rb'src="[^"]+"', ('src="' + str(temporary[0].relative_to(ROOT)) + '?v=' + diagnostic_sha[:16] + '"').encode(), tags[0])
        tag = re.sub(rb'integrity="[^"]+"', b'integrity="sha256-' + base64.b64encode(bytes.fromhex(diagnostic_sha)) + b'"', tag)
        diagnostic_html = html.replace(tags[0], tag)
        with tempfile.NamedTemporaryFile('wb', dir=ROOT, prefix='issue19-partial-tie-', suffix='.html', delete=False) as handle:
            handle.write(diagnostic_html)
            temporary.append(Path(handle.name))
        report['diagnostic_entrypoint_sha256'] = digest(diagnostic_html)

        class Quiet(SimpleHTTPRequestHandler):
            def log_message(self, *_):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = f'http://127.0.0.1:{server.server_port}/'
        with sync_playwright() as pw:
            launch = {'headless': True}
            if args.executable:
                launch['executable_path'] = args.executable
            if args.browser == 'chromium':
                launch['args'] = ['--no-sandbox', '--disable-dev-shm-usage']
            browser = getattr(pw, args.browser).launch(**launch)
            contexts = []

            def open_page(path, label, expected):
                context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
                contexts.append(context)

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
                page.on('requestfailed', lambda request: requests.append({'page': label, 'url': request.url, 'error': request.failure}))
                page.on('response', lambda response: requests.append({'page': label, 'url': response.url, 'status': response.status})
                        if response.status >= 400 and not response.url.endswith('/favicon.ico') else None)
                response = page.goto(origin + path, wait_until='domcontentloaded', timeout=120000)
                check(label + ': exact served entrypoint', response.status == 200 and digest(response.body()) == expected)
                wait_ready(page)
                return page

            before = open_page(temporary[1].name, 'omit-collar-diagnostic', digest(diagnostic_html))
            after = open_page('index.html', 'current-application', digest(html))
            check('Only diagnostic omits collar wrapper', before.evaluate('()=>!globalThis.HEWRSAvatarV3ShirtCollarFit')
                  and after.evaluate('()=>HEWRSAvatarV3ShirtCollarFit.spec.revision==="AVATAR_V3_ALL_SHIRT_COLLAR_FIT_6"'))
            old_state, new_state = before.evaluate(PROTECTED), after.evaluate(PROTECTED)
            scope_args = {'suits': SUITS, 'shirts': list(POINTS)}
            plans, diagnostic_plans = after.evaluate(PLAN_SCOPE, scope_args), before.evaluate(PLAN_SCOPE, scope_args)
            check('All 1,692 suit/shirt/tie plans agree before and after collar omission', plans == diagnostic_plans and len(plans) == 36)
            report['source_endpoint_plans'] = plans
            for row in plans:
                reference = next(item for item in plans if item['suit'] == 'S02' and item['shirt'] == row['shirt'])
                check(row['suit'] + '/' + row['shirt'] + ': exact source and endpoint equivalence for all47 ties',
                      row['source_parts'] == reference['source_parts'] and row['ties'] == reference['ties']
                      and all(tie['source_sha256'] == tie['original_same_id_sha256'] and tie['target_end'] == 1211 for tie in row['ties']))
            alpha_reference, jacket_alpha = None, {}
            for shirt, suit, state in case_inputs:
                points = POINTS[shirt]
                selected = dict(shirtId=shirt, state=state, suitId=suit, shoeId='shoe-8', watchId=None)
                name = '-'.join((suit, shirt, state))
                report['current_case'] = name
                old = before.evaluate(FRAME, {'selected': selected, 'points': points})
                new = after.evaluate(FRAME, {'selected': selected, 'points': points})
                check(name + ': both frames completed with exact selection and isolated data',
                      all(row['selection'] == selected and row['last'] == selected and row['status'] == 'ready'
                          and row['dimensions'] == [996, 2748] and row['state_unchanged'] for row in (old, new)))
                check(name + ': source-owned projected tie agrees with independent browser projection',
                      old['source_sha256'] == new['source_sha256'] and old['source_parts'] == new['source_parts']
                      and old['target_end'] == new['target_end'] == 1211
                      and old['projected_rgba_sha256'] == new['projected_rgba_sha256']
                      and all(row['projected_rgba_sha256'] == row['actual_loader_rgba_sha256'] for row in (old, new)))
                if alpha_reference is None:
                    alpha_reference = new['projected_alpha_sha256']
                check(name + ': projected tie alpha is identical across all47 and all18 suits',
                      old['projected_alpha_sha256'] == new['projected_alpha_sha256'] == alpha_reference)
                check(name + ': original effective jacket geometry agrees across the diagnostic pair',
                      old['effective_jacket_alpha_sha256'] == new['effective_jacket_alpha_sha256'])
                jacket_alpha[suit] = new['effective_jacket_alpha_sha256']
                old_image, new_image, projection = decode(old.pop('tie_crop')), decode(new.pop('tie_crop')), decode(new.pop('projected_crop'))
                assert decode(old.pop('projected_crop')).tobytes() == projection.tobytes()
                result = check_pixels(old_image, new_image, projection, shirt, old['samples'], new['samples'], expected_points[(shirt, suit)])
                check(name + ': exact tie/knot and fixed selected-cloth backing contract', True, result)
                pair = Image.new('RGBA', (306, 784))
                pair.paste(old_image, (0, 0)); pair.paste(new_image, (153, 0))
                pair.save(output / 'pairs' / (name + '.png'))
                if shirt == 'DS027' and suit == 'S02':
                    projection.save(output / 'projections' / (state + '.png'))
                cases.append({'name': name, 'selected': selected, 'before': old, 'after': new, 'pixel_contract': result,
                              'pair_path': 'pairs/' + name + '.png', 'pair_order': ['omit-collar-diagnostic', 'current-application']})
                if len(cases) % 12 == 0:
                    save()
                    print(json.dumps({'browser': args.browser, 'completed': len(cases), 'current': name}), flush=True)
            check('All 47 S02 ties and both representative ties on the other17 suits completed', len(cases) == len(case_inputs) == 162)
            for group in geometry['suit_alpha_groups']:
                check('Independent jacket alpha family: ' + ','.join(group['suit_ids']),
                      len({jacket_alpha[suit] for suit in group['suit_ids']}) == 1)
            check('Both isolated state stores remain unchanged', before.evaluate(PROTECTED) == old_state and after.evaluate(PROTECTED) == new_state)
            check('No browser or network errors', not errors and not requests and not external, {'errors': errors, 'requests': requests, 'external': external})
            for context in contexts:
                context.close()
            browser.close()
        check('Original delivery and source remain byte-exact', runtime_path.read_bytes() == runtime
              and (ROOT / 'index.html').read_bytes() == html and (ROOT / MODULE).read_bytes() == source)
        report['status'] = 'PASS_BROWSER_FIXED_TIE_FOREGROUND_AND_BACKING_CONTRACT'
    except Exception:
        report['status'] = 'FAIL'
        report['exception'] = traceback.format_exc()
        raise
    finally:
        if server:
            server.shutdown()
            server.server_close()
        for path in temporary:
            path.unlink(missing_ok=True)
        save()
    print(json.dumps({'status': report['status'], 'browser': args.browser, 'cases': len(cases),
                      'runtime_sha256': report['runtime_sha256'], 'report': str(output / 'RESULT.json')}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', required=True, choices=('chromium', 'webkit'))
    parser.add_argument('--executable')
    parser.add_argument('--output', type=Path, default=ROOT / 'evidence/issue19/partial-tie-browser')
    run(parser.parse_args())
