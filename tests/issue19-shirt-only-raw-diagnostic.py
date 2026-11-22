#!/usr/bin/env python3
"""Observation-only wrapper around the immutable Issue19 browser gates.

Both browsers capture all 96 legal shirt-only selections, to be bound to the
main run's exact same-engine RGBA records after download. No application code,
fixture set or existing assertion is altered. Hooks only retain native images,
source bindings. Independent alpha topology is evaluated after download so the
diagnostic uses the exact main run's pinned browser and image dependencies.
"""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path
from types import SimpleNamespace
from PIL import Image

HEAD='c62ce06f949eda7dbda7f95d44c1d7d69573d283'
TREE='7da18482d263c129e77d4b61c7748c2ecef1eeb7'
RUNTIME='ed326c1f8f1b513a3a960ebf508c27e80df688ff41c9aad756e63fa35c34d8f1'
TEST='aa1f83d9f46e60d21a88f5aed37a431b12a5e23ad05a8d8c9fabf3975db57b95'
sha=lambda data:hashlib.sha256(data).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output',type=Path)
    parser.add_argument('--browser',choices=['chromium','webkit'],required=True)
    parser.add_argument('--executable')
    args=parser.parse_args()
    root=args.checkout.resolve();out=(args.output or root/'evidence/issue19/shirt-only-raw').resolve();out.mkdir(parents=True,exist_ok=True)
    identity_file=out/args.browser/'shirts/shard-0/DIAGNOSTIC_IDENTITY.json'
    identity_file.parent.mkdir(parents=True,exist_ok=True)
    git=lambda *cmd:subprocess.check_output(['git',*cmd],cwd=root,text=True).strip()
    assert git('rev-parse',HEAD+'^{tree}')==TREE
    git('diff','--exit-code',HEAD,'HEAD','--','.',':(exclude).github/workflows/issue19-shirt-only-raw-diagnostic.yml',':(exclude)tests/issue19-shirt-only-raw-diagnostic.py')
    assert sha((root/'runtime/avatar-v3-candidate-ed326c1f8f1b513a3a96.js').read_bytes())==RUNTIME
    test=root/'tests/issue19-browser.py';assert sha(test.read_bytes())==TEST
    spec=importlib.util.spec_from_file_location('immutable_browser_matrix',test)
    matrix=importlib.util.module_from_spec(spec);spec.loader.exec_module(matrix)
    all_shirt_rows=[r for r in matrix.fixtures('shirts') if r['mode']=='shirt-only']
    assert len(all_shirt_rows)==96
    original_save=matrix.save_details
    original_decode=matrix.decode_frame
    decoded_sources=[]
    def observe_decode(record):
        decoded_sources.append({'full_sha256':record['full_sha256'],'source_binding_sha256':record['source_binding_sha256'],'source_bindings':record['source_bindings'],'selection':record['selection']})
        del decoded_sources[:-2]
        return original_decode(record)
    matrix.decode_frame=observe_decode
    report={'schema':'hewrs.issue19.actual-shirt-join-raw-capture.v1','diagnostic_checkout_sha':git('rev-parse','HEAD'),'candidate_head_sha':HEAD,'candidate_tree_sha':TREE,'runtime_sha256':RUNTIME,'browser':args.browser,'matrix_test_sha256':TEST,'wrapper_sha256':sha(Path(__file__).read_bytes()),'source_main_run_id':44979582764,'diagnostic_only_not_full_matrix_acceptance':True,'current_main_run_frame_identity':'PENDING_INDEPENDENT_SAME_ENGINE_REPORT_BINDING_AFTER_DOWNLOAD','existing_machine_assertions':'Unchanged. Existing only-mode shirt-only option selects all96 legal shirt-only states.','rows':[]}
    def observe_save(output,name,old,new,native=False):
        details=original_save(output,name,old,new,native=True)
        baseline_dir=output/'native/baseline';baseline_dir.mkdir(exist_ok=True)
        old.save(baseline_dir/(name+'.png'))
        old_sha=sha(old.tobytes());new_sha=sha(new.tobytes())
        old_sources,sources=decoded_sources
        assert old_sources['full_sha256']==old_sha and sources['full_sha256']==new_sha
        diagnostic=matrix.collar_join_diagnostics(new)
        assert sources['selection']==old_sources['selection']
        current_file=output/'native'/(name+'.png');old_file=baseline_dir/(name+'.png')
        for path,digest in [(current_file,new_sha),(old_file,old_sha)]:
            assert sha(Image.open(path).convert('RGBA').tobytes())==digest
        report['rows'].append({'name':name,'selection':sources['selection'],'original_rgba_sha256':old_sha,'candidate_rgba_sha256':new_sha,'current_native_png_sha256':sha(current_file.read_bytes()),'baseline_native_png_sha256':sha(old_file.read_bytes()),'candidate_source_binding_sha256':sources['source_binding_sha256'],'original_source_binding_sha256':old_sources['source_binding_sha256'],'source_bindings':sources['source_bindings'],'diagnostics':diagnostic})
        identity_file.write_text(json.dumps(report,indent=2)+'\n')
        return details
    matrix.save_details=observe_save
    config=SimpleNamespace(browser=args.browser,suite='shirts',shard=0,shards=1,only_mode='shirt-only',limit=None,list=False,url=None,baseline_entrypoint='avatar-v3-issue19-baseline.html',output=out,executable=args.executable)
    matrix.run(config)
    assert len(report['rows'])==96
    report['status']='PASS_CAPTURE_INTEGRITY_AND_EXISTING_MACHINE_GATES_TOPOLOGY_REQUIRES_SOURCE_ADJUDICATION'
    report['counts']={'cases':len(report['rows']),'flagged_cases':sum(bool(r['diagnostics']['interior_low_alpha_pixels']) for r in report['rows']),'reported_points':sum(r['diagnostics']['interior_low_alpha_pixels'] for r in report['rows'])}
    identity_file.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'counts':report['counts']},indent=2),flush=True)

if __name__=='__main__':main()
