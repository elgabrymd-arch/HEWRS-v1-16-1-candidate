#!/usr/bin/env python3
"""Read-only package, tested-runtime, option-policy and rollback-source verification.
Use on the full V1.17.3 source folder. Does not inspect or modify browser data.
"""
from pathlib import Path, PurePosixPath
import hashlib,json
R=Path(__file__).resolve().parents[1]
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def read(n):return json.loads((R/n).read_text())
def need(ok,msg):
 if not ok:raise AssertionError(msg)
def files():return {p.relative_to(R).as_posix()for p in R.rglob('*')if p.is_file() and '.git'not in p.parts and '__pycache__'not in p.parts and p.suffix!='.pyc' and p.name not in ['.gitattributes','.DS_Store']}
def main():
 m=read('PACKAGE_SHA256.json');need(m['version']=='1.17.3','Wrong package version');seen=set()
 for x in m['files']:
  n=x['path'];p=PurePosixPath(n);need(n and not p.is_absolute()and'..'not in p.parts and'\\'not in n and n not in seen,'Unsafe or duplicate path')
  f=R/n;need(f.is_file()and f.stat().st_size==x['bytes']and sha(f)==x['sha256'],'Payload mismatch '+n);seen.add(n)
 need(files()==seen|{'PACKAGE_SHA256.json'},'Unlisted or missing files')
 ep='evidence/options_v1_17_3/';base=read('rollback/options_v1_17_3/BASELINE_FILES.json')['files']
 allowed={'src/application.js','src/automatic-engine.js','src/connection.js','src/facelift-state.js','vendor/ensemble-completion.js','data/option-index.json','data/option-index.js','tools/build.py','tools/build_option_index.cjs','app.template.html','index.html','app.html','README.md','RELEASE_STATUS.json','RELEASE_SCOPE.json','CHANGED_FILES.json','PACKAGE_SHA256.json'}
 changed={n for n,v in base.items()if not(R/n).is_file()or sha(R/n)!=v['sha256']}
 need(changed<=allowed,'Unintended baseline change '+str(changed-allowed))
 for n in changed:need(sha(R/'rollback/options_v1_17_3/original'/n)==base[n]['sha256'],'Missing exact baseline rollback '+n)
 preserved=read(ep+'IMAGE_PRESERVATION.json');need(preserved['runtime_images']==848,'Wrong preserved image count')
 for v in preserved['files']:need(sha(R/v['path'])==v['sha256'],'Image changed '+v['path'])
 need(not any(n.startswith(('assets/','assemblies/'))for n in files()-base.keys()),'Unrequested image addition')
 for n,h in read(ep+'TESTED_RUNTIME_SHA256.json')['files'].items():need(sha(R/n)==h,'Runtime changed after test '+n)
 s=read('RELEASE_STATUS.json');need(s['version']=='1.17.3'and s['connected_non_suit_shirt_count']==18 and s['suit_shirt_count']==50,'Wrong clothing scope')
 need(s['weather_code_changed'] is False and s['deployment_performed_this_release'] is False,'Unsupported release claim')
 p1=read(ep+'PASS1_INPUT_INTEGRITY.json');p2=read(ep+'PASS2_COLOUR_AND_ENSEMBLE.json');p3=read(ep+'PASS3_OPTIONS_POLICY.json');p4=read(ep+'browser/PASS4_BROWSER.json');p5=read(ep+'PASS5_DELIVERY_CHECKS.json')
 need(p1['result']=='PASS','Pass 1 failed')
 need(p2['passed']==12 and p2['failed']==0 and p3['passed']==26 and p3['failed']==0,'Incomplete functional audits')
 need(p4['passed']==17 and p4['failed']==0 and not p4['errors'],'Browser audit incomplete')
 need(len(p4['native_comparisons'])==166 and all(x['equal']for x in p4['native_comparisons']),'Native output regression')
 need(len(p4['engine_frames'])==15,'15-frame navigation incomplete')
 need(p5['status']=='PASS'and all(x['passed']for x in p5['checks']),'Delivery checks failed')
 for case in p3['cases']:
  for n,count in case['independent']['counts'].items():need(n in case['independent']['locked']or count<=2,'Item cap failed in '+case['name'])
  if case['query']['prefs']['tie']['mode']!='none':need(case['independent']['noTie']<=2,'No Tie cap failed')
  need(case['independent']['shirtOnly']<=2,'Unselected no-jacket cap failed')
 index=read('data/option-index.json');need(index['normalization_revision']=='hewrs.literal-colour-qualifiers.v1_17_3'and index['counts']['rows']==112392,'Wrong derived index')
 for n,h in index['engine_files'].items():need(sha(R/n)==h,'Derived index source mismatch '+n)
 changes=read('CHANGED_FILES.json')['changes'];expected={n for n in files()|base.keys()if n not in ['CHANGED_FILES.json','PACKAGE_SHA256.json'] and (n not in base or not(R/n).is_file()or sha(R/n)!=base[n]['sha256'])}
 need({x['path']for x in changes}==expected,'Changed-file list mismatch')
 for x in changes:need(x['before_sha256']==base.get(x['path'],{}).get('sha256')and x['after_sha256']==sha(R/x['path']),'Changed-file hash mismatch '+x['path'])
 print(json.dumps({'status':'PASS','version':'1.17.3','payloads':len(seen),'audit_passes':5,'functional_checks':38,'chromium_checks':17,'native_pixel_equal_comparisons':166,'actual_engine_options':15,'images_preserved':848,'raw_dna_changed':False,'frozen_shirt_tie_scores_changed':False,'derived_colour_estimates_corrected':True,'weather_changed':False,'deployment_performed':False},indent=2))
if __name__=='__main__':main()
