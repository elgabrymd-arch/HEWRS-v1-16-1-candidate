"""V3-only Issue 22 source bindings; retained V2 and Standard builds are exact.

The late renderer wrappers change only registered display material/repairs.
Matching is installed before connection creation and raw engine construction.
No source photograph, avatar, saved record or original catalogue is rewritten.
"""
import base64
import hashlib
import json
import re
from pathlib import Path
import issue22_reviewed

ROOT = Path(__file__).resolve().parents[1]
BASELINE_COMMIT = '95d14073e33f2b699bdb0cdbd42504b1a1be2274'
BASELINE_ENTRYPOINT = 'avatar-v3-issue22-baseline.html'
BASELINE_ENTRYPOINT_SHA256 = 'dd7c401d29ab12cf3fb2d9d2938ddd9753291c42982d60f326c3bf367dd9afba'
MATCHING_MODULES = ('data/issue22-garment-dna.js', 'src/issue22-matching.js')
RENDER_MODULES = ('data/issue22-materials.js', 'src/issue22-materials.js',
                  'src/issue22-b08.js', 'src/issue22-render-guard.js',
                  'src/issue22-s06-contours.js')
INDEX = 'data/issue22-option-index.js'
PREVIEWS = 'data/issue22-picker-images.js'
REVIEWED_MODULES = issue22_reviewed.MODULES


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def source_block(name):
    return '/* V3 ISSUE 22 SOURCE: '+name+' */\n'+(ROOT/name).read_text()+'\n;\n'


def after(code, name, addition):
    block = '/* SOURCE: '+name+' */\n'+(ROOT/name).read_text()+'\n;\n'
    if code.count(block) != 1:
        raise ValueError('Issue 22 requires one exact source block: '+name)
    return code.replace(block, block+addition)


def matching(code):
    code = after(code, 'src/source-corrections.js', ''.join(map(source_block, MATCHING_MODULES)))
    original = 'map.set(r.id,normalize(r));'
    corrected = 'map.set(r.id,globalThis.HEWRSIssue22Matching.normalizeProfile(r,normalize(r)));'
    if code.count(original) != 1:
        raise ValueError('Expected one exact raw garment normalization hook')
    code = code.replace(original, corrected)
    # The hook intentionally changes the one normalization expression, so use
    # the following source marker rather than reconstructing the vendor block.
    vendor = '/* SOURCE: vendor/ensemble-completion.js */'
    start = code.index(vendor)
    end = code.index('/* SOURCE:', start+len(vendor))
    code = code[:end]+'/* V3 ISSUE 22 ENGINE INSTALL */\nHEWRSIssue22Matching.installEngine();\n'+code[end:]
    return code


def rendering():
    return ''.join(map(source_block, RENDER_MODULES))


def tag(name):
    digest = hashlib.sha256((ROOT/name).read_bytes()).digest()
    return '<script defer src="'+name+'?v='+digest.hex()[:16]+'" integrity="sha256-'+base64.b64encode(digest).decode()+'"></script>'


def reviewed_panel():
    raw = issue22_reviewed.panel().encode()
    return {'path':'src/issue22-reviewed-panel-'+sha(raw)[:20]+'.js','sha256':sha(raw)}, raw


def pin_html(html, write=False):
    pattern = r'data-engine-index="data/option-index.js(?:\?[^\"]*)?" data-engine-integrity="[^\"]+"'
    digest = hashlib.sha256((ROOT/INDEX).read_bytes()).digest()
    replacement = 'data-engine-index="'+INDEX+'?v='+digest.hex()[:16]+'" data-engine-integrity="sha256-'+base64.b64encode(digest).decode()+'"'
    html, count = re.subn(pattern, replacement, html)
    if count != 1:
        raise ValueError('Expected exactly one frozen lazy index binding for Issue 22')
    anchor = re.search(r'<script defer src="src/blazer-picker-preview.js[^\"]*"[^>]*></script>', html)
    if not anchor or PREVIEWS in html:
        raise ValueError('Expected exactly one picker preview insertion point')
    html = html[:anchor.start()]+tag(PREVIEWS)+'\n'+html[anchor.start():]
    panel, raw = reviewed_panel()
    path = ROOT/panel['path']
    if write:
        path.write_bytes(raw)
    elif not path.is_file() or path.read_bytes() != raw:
        raise ValueError('Issue 22 reviewed panel is missing or stale')
    pattern = r'<script defer src="src/reviewed-rejection-integration.js(?:\?[^\"]*)?"[^>]*></script>'
    html, count = re.subn(pattern, tag(panel['path']), html)
    if count != 1:
        raise ValueError('Expected exactly one original reviewed panel binding')
    return html


def record():
    return {
        'schema':'hewrs.issue22.delivery.v1',
        'issue_url':'https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/issues/22',
        'baseline_commit':BASELINE_COMMIT,
        'baseline_entrypoint':BASELINE_ENTRYPOINT,
        'baseline_entrypoint_sha256':BASELINE_ENTRYPOINT_SHA256,
        'garment_ids':['S06','S13','S14','B01','B06','B10','B08'],
        'modules':{p:sha((ROOT/p).read_bytes()) for p in (*MATCHING_MODULES,*RENDER_MODULES,*REVIEWED_MODULES)},
        'matching_index':{'path':INDEX,'sha256':sha((ROOT/INDEX).read_bytes())},
        'picker_previews':{'path':PREVIEWS,'sha256':sha((ROOT/PREVIEWS).read_bytes())},
        'reviewed_panel':reviewed_panel()[0],
        'original_sources':'unchanged; separate source-bound display materials and versioned DNA',
        'browser_storage_migration':'none',
        'merge_target':'main',
        'integration_branch':'integration/issue22-v3',
        'production_deployment_authorized':True,
        'production_authorization':{
            'date':'2026-11-22',
            'authority':'explicit_owner_instruction',
            'scope':'complete S06 appearance, DNA and compatibility validation; merge into the primary application and publish',
        },
        'continued_material_correction':{
            'date':'2026-11-22',
            'garment_id':'S14',
            'authority':'owner_requested_app_image_update_and_confirmed_same_process_as_B06',
            'baseline_commit':'457774146fa7d4a5494ceec553f187e27b126983',
            'scope':'S14 display weave and its native picker; retain existing color, registered construction, garment facts, matching and all other garments',
        },
        'additional_material_corrections':[{
            'date':'2026-11-23',
            'garment_id':'S13',
            'authority':'explicit_owner_request_for_the_same_prior_suit_correction_work_through_the_live_app',
            'baseline_commit':'f648cda6e577aa1b6ce7b75df1e71437eb5e6aae',
            'scope':'S13 fine crossed-check display texture and native picker; preserve photographic color, registered construction, garment DNA, matching rules, saved state and all prior garment corrections',
        }],
    }


def verify(recorded, root=ROOT):
    root = Path(root)
    if recorded.get('schema') != 'hewrs.issue22.delivery.v1':
        raise ValueError('Missing Issue 22 delivery contract')
    if root == ROOT and recorded != record():
        raise ValueError('Issue 22 source pins are stale')
    if recorded.get('baseline_commit') != BASELINE_COMMIT or recorded.get('baseline_entrypoint_sha256') != BASELINE_ENTRYPOINT_SHA256:
        raise ValueError('Issue 22 baseline identity changed')
    if sha((root/BASELINE_ENTRYPOINT).read_bytes()) != BASELINE_ENTRYPOINT_SHA256:
        raise ValueError('The original published Issue 19 application changed')
    expected = set((*MATCHING_MODULES,*RENDER_MODULES,*REVIEWED_MODULES))
    if set(recorded.get('modules',{})) != expected:
        raise ValueError('Unexpected Issue 22 source module scope')
    for name,digest in recorded['modules'].items():
        if sha((root/name).read_bytes()) != digest:
            raise ValueError('Issue 22 source bytes changed: '+name)
    for key,name in [('matching_index',INDEX),('picker_previews',PREVIEWS)]:
        if recorded.get(key) != {'path':name,'sha256':sha((root/name).read_bytes())}:
            raise ValueError('Issue 22 dependent delivery differs: '+key)
    panel = recorded.get('reviewed_panel',{})
    if not re.fullmatch(r'src/issue22-reviewed-panel-[a-f0-9]{20}\.js',panel.get('path','')):
        raise ValueError('Unexpected Issue 22 reviewed panel path')
    if sha((root/panel['path']).read_bytes()) != panel.get('sha256'):
        raise ValueError('Issue 22 reviewed panel bytes changed')
    return recorded
