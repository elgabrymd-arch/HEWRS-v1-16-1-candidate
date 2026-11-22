#!/usr/bin/env python3
"""Build a separate AVATAR_V3 test entrypoint, never rewriting index.html/main.
Source-level avatar and wrist replacement is inserted after continuous-shirt
contracts and before the application creates its live renderer connection.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import json
import re
import issue22_delivery

ROOT=Path(__file__).resolve().parents[1]
OUT='avatar-v3-review.html'
REVIEW='AVATAR_V3_REVIEW_BUILD.json'
FIT_MODULES = ('src/avatar-v3-tie-fit.js', 'src/avatar-v3-shirt-collar-fit.js', 'src/avatar-v3-cuff-fit.js')
MOBILE_STYLE = 'src/avatar-v3-review-layout.css'

def h(data):
    return hashlib.sha256(data).hexdigest()

def main(write=False):
    data=json.loads((ROOT/'data/avatar-v3-candidate.json').read_text())
    assert data['schema']=='hewrs.avatar-v3-candidate.v1'
    assert data['enabled_in_production'] is False
    assert data['source_profile']=='AVATAR_V2_MASTER'
    assert data['stage']=='source_candidate_only'
    assert data['candidate_layers'].keys()=={'avatar','left_hand','right_hand'}
    for n, row in data['candidate_layers'].items():
        image=(ROOT/row['url']).read_bytes()
        assert h(image)==row['sha256'] and row['original_sha256']==data['source_layer_hashes'][n]
    source=(ROOT/'src/avatar-v3.js').read_text()
    collar_source=(ROOT/'src/avatar-v3-collar-fit.js').read_text()
    pose_source=(ROOT/'src/avatar-v3-pose.js').read_text()
    fit_sources={name:(ROOT/name).read_text() for name in FIT_MODULES}
    mobile_style=(ROOT/MOBILE_STYLE).read_bytes()
    mobile_style_sha=h(mobile_style)
    for n, row in data['candidate_layers'].items():
        assert row['sha256'] in source, 'unregistered V3 hash in '+n
    base_entrypoint = 'avatar-v2-reference.html' if (ROOT/'avatar-v2-reference.html').is_file() else 'index.html'
    index=(ROOT/base_entrypoint).read_text()
    match=re.search(r'<script defer src="(runtime/continuous-shirts-[a-f0-9]{20}\.js)\?v=[a-f0-9]{16}" integrity="sha256-([A-Za-z0-9+/=]+)"',index)
    assert match is not None, 'Current page does not use the reviewed continuous-shirt runtime'
    original=match.group(1)
    base=(ROOT/original).read_text()
    assert len(base)>2_000_000,'Unexpected current compiled runtime'
    marker="/* SOURCE: src/local-state.js */"
    assert base.count(marker)==1,'Unambiguous connection installation point not found'
    old="need(p.avatar.sha256===AVATAR,'changed avatar registration');return p;"
    assert base.count(old)==1,'Continuous-shirt source lock not found exactly once'
    code=base.replace(old,"need(p.avatar.sha256===(connection.avatarV3?.sha256||AVATAR),'changed avatar registration');return p;")
    code=issue22_delivery.matching(code)
    old_metadata="avatar_source_sha256:AVATAR,tie_source_sha256:"
    assert code.count(old_metadata)==1,'Avatar provenance metadata anchor absent'
    code=code.replace(old_metadata,"avatar_source_sha256:p.avatar.sha256,tie_source_sha256:")
    # The legacy renderer owns only the masked temporary returned by bitmap().
    # V3's registered tie loader can return a cached canvas; destroying that
    # borrowed image after one render makes later tie selections disappear.
    # Keep the frozen vendor/V2 files exact and bind this one V3 compatibility
    # change explicitly, with an exact-count guard.
    borrowed_canvas="if(im instanceof HTMLCanvasElement)im.width=im.height=1;"
    owned_canvas="if(d.display_alpha_mask&&im instanceof HTMLCanvasElement)im.width=im.height=1;"
    assert code.count(borrowed_canvas)==1, 'Legacy bitmap ownership anchor differs'
    code=code.replace(borrowed_canvas,owned_canvas)
    source_cache="const key=descriptor.sha256+'\\n'+url;"
    registered_cache="const key=descriptor.sha256+'\\n'+url+'\\n'+(descriptor.avatar_v3_tie_fit?.target_end||'native');"
    assert code.count(source_cache)==1, 'Display source cache anchor differs'
    code=code.replace(source_cache,registered_cache)
    cloth_capture="paint(sc,p.garment.body,at);native(sc,p.tie,at);"
    raw_cloth_capture="paint(sc,p.garment.body,at);if(options.captureShirtCloth)options.captureShirtCloth(sc,p);native(sc,p.tie,at);"
    assert code.count(cloth_capture)==1, 'Raw continuous shirt surface anchor differs'
    code=code.replace(cloth_capture,raw_cloth_capture)
    fit_code=''.join('/* V3 ISSUE 19 SOURCE: '+name+' */\n'+value+'\n;\n' for name,value in fit_sources.items() if name!='src/avatar-v3-cuff-fit.js')
    cuff_code='/* V3 ISSUE 19 SOURCE: src/avatar-v3-cuff-fit.js */\n'+fit_sources['src/avatar-v3-cuff-fit.js']+'\n;\n'
    code=code.replace(marker,"/* ISOLATED AVATAR_V3 SOURCE: src/avatar-v3.js */\n"+source+"\n;\n/* V3 SOURCE-BOUND COLLAR FIT: src/avatar-v3-collar-fit.js */\n"+collar_source+"\n;\n"+marker)
    # Full tie fidelity is installed later than the original V3 connection.
    # Collar/tie fitting requires those descriptors. The unchanged approved
    # pose follows them. Wrist fitting operates last in final coordinates so
    # its sleeve edge cannot acquire a step at the pose map's outer boundary.
    fit_marker='/* SOURCE: data/option-card-thumbnails.js */'
    assert code.count(fit_marker)==1, 'Missing post-tie-fidelity fit installation point'
    code=code.replace(fit_marker,fit_code+"/* ISOLATED V3 POSE: src/avatar-v3-pose.js */\n"+pose_source+"\n;\n"+cuff_code+issue22_delivery.rendering()+fit_marker)
    encoded=code.encode()
    digest=h(encoded)
    output='runtime/avatar-v3-candidate-'+digest[:20]+'.js'
    sri='sha256-'+base64.b64encode(hashlib.sha256(encoded).digest()).decode()
    old_tag=match.group(0)
    new_tag='<script defer src="'+output+'?v='+digest[:16]+'" integrity="'+sri+'"'
    preview=index.replace(old_tag,new_tag)
    assert preview!=index and preview.count(new_tag)==1,'Failed to pin preview runtime'
    preview=preview.replace('<title>HEWRS · Stage 10 integration candidate', '<title>HEWRS · AVATAR_V3 isolated review')
    preview=preview.replace('Loading source layers…','Loading AVATAR_V3 isolated preview source layers…')
    style_sri='sha256-'+base64.b64encode(hashlib.sha256(mobile_style).digest()).decode()
    style_tag='<link rel="stylesheet" href="'+MOBILE_STYLE+'?v='+mobile_style_sha[:16]+'" integrity="'+style_sri+'">'
    assert preview.count('</head>')==1 and MOBILE_STYLE not in preview, 'Unique V3 mobile stylesheet insertion required'
    preview=preview.replace('</head>',style_tag+'\n</head>')
    preview=issue22_delivery.pin_html(preview,write=write)
    evidence={
        'schema':'hewrs.avatar-v3-preview.v1',
        'preview_entrypoint':OUT,
        'runtime':output,
        'runtime_sha256':digest,
        'base_runtime':original,
        'base_entrypoint':base_entrypoint,
        'base_runtime_sha256':h(base.encode()),
        'base_index_sha256':h(index.encode()),
        'new_avatar_sha256':data['candidate_layers']['avatar']['sha256'],
        'pose_source_sha256':h(pose_source.encode()),
        'collar_fit_source_sha256':h(collar_source.encode()),
        'collar_fit_revision':'AVATAR_V3_B15_COLLAR_FIT_1',
        'issue19_fit_modules':{name:h(value.encode()) for name,value in fit_sources.items()},
        'issue19_mobile_stylesheet':{'path':MOBILE_STYLE,'sha256':mobile_style_sha},
        'issue19_runtime_compatibility':{'vendor/active50-renderer.js':'release_only_masked_temporary_canvas_never_borrowed_loader_canvas',
                                       'src/render-image-loader.js':'cache_includes_source_bound_tie_display_registration',
                                       'src/continuous-shirts.js':'capture_exact_registered_body_before_tie_and_avatar_composition'},
        'pose_approval':'CANDIDATE_GEOMETRY_OWNER_VISUAL_REVIEW_PENDING',
        'v2_avatar_sha256':data['source_layer_hashes']['avatar'],
        'layer_hashes':{n:v['sha256'] for n,v in data['candidate_layers'].items()},
        'app_production_entrypoints_unchanged':not (ROOT/'AVATAR_V3_RELEASE.json').is_file(),
        'approval':'ISOLATED_PREVIEW_ONLY_NOT_APPROVED_FOR_MAIN',
        'issue22':issue22_delivery.record(),
    }
    rec=json.dumps(evidence,indent=2)+'\n'
    if write:
        (ROOT/output).write_bytes(encoded)
        (ROOT/OUT).write_text(preview)
        (ROOT/REVIEW).write_text(rec)
    else:
        assert (ROOT/output).read_bytes()==encoded
        assert (ROOT/OUT).read_text()==preview
        assert (ROOT/REVIEW).read_text()==rec
    print('AVATAR_V3_APP_CANDIDATE='+json.dumps(evidence))

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--write',action='store_true')
    main(**vars(p.parse_args()))
