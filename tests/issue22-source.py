#!/usr/bin/env python3
"""Independent immutable-source check against the last released application.

Issue 22 may add explicitly registered material/reference data. It may not
modify any pre-existing garment, avatar, catalogue, scoring or behavior file.
The original V3 builders gain new V3-only insertion points.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE='95d14073e33f2b699bdb0cdbd42504b1a1be2274'
PROTECTED=('assets','assemblies','data','ui','ui-assets','vendor','src','provenance','runtime','feedback-candidate',
           'avatar-v2-reference.html','CONTINUOUS_CANDIDATE.json','STANDARD_RELEASE.json',
           'avatar-v3-issue19-baseline.html','runtime/outfit-refill-preview.js',
           'outfit-feedback.js','tools/build.py','tools/build_tie_candidate.py',
           'tools/build_continuous_candidate.py')


def git(*args):
    return subprocess.check_output(['git',*args],cwd=ROOT)


def main():
    original=git('ls-tree','-r',BASE,'--',*PROTECTED).decode().splitlines()
    checked=0
    for line in original:
        mode,kind,identity,name=line.replace('\t',' ',1).split(' ',3)
        if kind!='blob':
            raise AssertionError('Unexpected protected object: '+line)
        target=ROOT/name
        if not target.is_file() or target.is_symlink():
            raise AssertionError('Protected source missing: '+name)
        raw=target.read_bytes()
        actual=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
        if actual!=identity:
            raise AssertionError('Original protected source changed: '+name)
        checked+=1
    baseline=git('show',BASE+':index.html')
    if (ROOT/'avatar-v3-issue22-baseline.html').read_bytes()!=baseline:
        raise AssertionError('Issue 22 comparison page differs from original release')
    sys.path.insert(0,str(ROOT/'tools'))
    from verify_active_delivery import describe
    from issue22_delivery import verify
    active=describe()
    release=json.loads((ROOT/'AVATAR_V3_RELEASE.json').read_text())
    verify(release['issue22'])
    if active['kind']!='avatar-v3':
        raise AssertionError('Approved V3 profile not active')
    for name,sha in active['avatar_layers'].items():
        if hashlib.sha256((ROOT/('assets/'+sha+'.png')).read_bytes()).hexdigest()!=sha:
            raise AssertionError('Approved avatar layer changed: '+name)
    report={'schema':'hewrs.issue22.source-verification.v1','status':'PASS','baseline_commit':BASE,
            'protected_original_files':checked,'original_sources_changed':0,'avatar_layers':active['avatar_layers'],
            'runtime':active['runtime'],'runtime_sha256':active['runtime_sha256'],
            'storage_migration':'none','production_target_unchanged':True}
    output=ROOT/'evidence/issue22/source.json';output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))


if __name__=='__main__':
    main()
