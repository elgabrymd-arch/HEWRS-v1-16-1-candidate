#!/usr/bin/env python3
"""Read-only verification of V1.17.2 source, preservation and executed evidence."""
from pathlib import Path,PurePosixPath
import json,hashlib
R=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(n):return json.loads((R/n).read_text())
def need(v,m):
 if not v:raise AssertionError(m)
def files():return {p.relative_to(R).as_posix()for p in R.rglob('*')if p.is_file()and'.git'not in p.parts and'__pycache__'not in p.parts and p.suffix!='.pyc'and p.name not in ['.gitattributes','.DS_Store']}
def main():
 m=read('PACKAGE_SHA256.json');need(m['version']=='1.17.2','Wrong package version');seen=set()
 for x in m['files']:
  n=x['path'];p=PurePosixPath(n);need(not p.is_absolute()and'..'not in p.parts and'\\'not in n and n not in seen,'Unsafe/duplicate path');f=R/n
  need(f.is_file()and f.stat().st_size==x['bytes']and sha(f)==x['sha256'],'Payload differs '+n);seen.add(n)
 need(files()==seen|{'PACKAGE_SHA256.json'},'Unlisted or missing files')
 baseline=read('rollback/tie_fidelity_v1_17_2/BASELINE_FILES.json')['files']
 changed={n for n,v in baseline.items()if not(R/n).is_file()or sha(R/n)!=v['sha256']}
 allowed={'src/application.js','src/batch10-renderer.js','src/blazer-renderer.js','src/b01-b02-renderer.js','src/shirt-only-renderer.js','tools/build.py','app.template.html','index.html','app.html','README.md','RELEASE_STATUS.json','RELEASE_SCOPE.json','CHANGED_FILES.json','PACKAGE_SHA256.json'}
 need(changed<=allowed,'Unintended previous file changes '+str(changed-allowed))
 for n in changed:need(sha(R/'rollback/tie_fidelity_v1_17_2/original'/n)==baseline[n]['sha256'],'Missing original rollback '+n)
 ep='evidence/tie_fidelity_v1_17_2/'
 protect=read(ep+'PRESERVATION.json');need(protect['runtime_images_preserved']==705,'Wrong baseline image count')
 for x in protect['files']:need(sha(R/x['path'])==x['sha256'],'Protected file changed '+x['path'])
 tie=read('data/tie-fidelity.json');need(tie['ids']==[f'T{i:03}'for i in range(1,48)]and len(tie['bindings'])==142,'Incomplete exact tie set')
 new_images={n for n in files()-baseline.keys()if n.startswith(('assets/','assemblies/'))};need(new_images==set(tie['assetPaths'].values()),'Unreferenced or missing runtime images')
 for h,n in tie['assetPaths'].items():need(sha(R/n)==h,'Tie file differs '+n)
 pix=read(ep+'PIXEL_INTEGRITY.json');need(pix['status']=='PASS'and len(pix['rows'])==142 and all(x['alpha_changed']==x['outside_tie_changed']==0 for x in pix['rows']),'Pixel boundary failed')
 need(read(ep+'REPLAY.json')['status']=='PASS','Source reconstruction not checked')
 for fname,count in [('FUNCTIONAL.json',14),('core/FUNCTIONAL.json',25)]:
  f=read(ep+fname);need(f['passed']==count and f['failed']==0,'Functional suite failed '+fname)
 br=read(ep+'browser/RESULT.json');need(br['failed']==0 and not br['errors'],'Browser suite incomplete/failed')
 need(len(br['comparisons'])==364,'Incomplete image matrix')
 need(all(x['alpha_changed_pixels']==0 and x['outside_tie_changed_pixels']==0 for x in br['comparisons']),'Pixels escaped tie ownership')
 need(sum(x['exactly_equal']and x['selection']['state']in ['NO_TIE','REFERENCE']for x in br['comparisons'])==55,'Unchanged control mismatch')
 need(len(br['engine_frames'])==15 and len({json.dumps(x['selection'],sort_keys=True)for x in br['engine_frames']})==15,'15-option workflow incomplete')
 for n,h in read(ep+'TESTED_RUNTIME_SHA256.json')['files'].items():need(sha(R/n)==h,'Runtime modified after tests '+n)
 need(read(ep+'ROLLBACK.json')['status']=='PASS'and read(ep+'ROLLBACK.json')['write_performed'],'Rollback was not exercised')
 need(read(ep+'HTTP.json')['status']=='PASS','HTTP file-byte test failed')
 st=read('RELEASE_STATUS.json');need(st['version']=='1.17.2'and st['connected_non_suit_shirt_count']==18,'Release scope mismatch');need(st['suit_shirt_count']==50 and st['restored_tie_count']==47,'Incomplete inventory count')
 need(st['native_geometry_changed']is False and st['scoring_changed']is False and st['deployment_performed_this_release']is False,'Unsupported claim')
 ledger=read('CHANGED_FILES.json')['changes'];expected={n for n in files()|baseline.keys()if n not in ['CHANGED_FILES.json','PACKAGE_SHA256.json']and(n not in baseline or not(R/n).is_file()or sha(R/n)!=baseline[n]['sha256'])}
 need({x['path']for x in ledger}==expected,'Changed-file list mismatch')
 for x in ledger:need(x['after_sha256']==sha(R/x['path'])and x['before_sha256']==baseline.get(x['path'],{}).get('sha256'),'Changed-file hash mismatch')
 print(json.dumps({'status':'PASS','version':'1.17.2','payloads':len(seen),'runtime_images_preserved':705,'new_runtime_images':len(new_images),'restored_ties':47,'display_bindings':142,'functional_checks':39,'chromium_checks':br['passed'],'native_comparisons':len(br['comparisons']),'unchanged_NoTie_and_reference_frames':55,'actual_engine_options':15,'scoring_changed':False,'deployment_performed':False},indent=2))
if __name__=='__main__':main()
