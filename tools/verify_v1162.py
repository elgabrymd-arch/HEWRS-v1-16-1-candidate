#!/usr/bin/env python3
"""Read-only V1.16.2 package, preservation, correction and test-receipt verifier.
Standard library only. Does not access a browser profile, network or production.
"""
from pathlib import Path,PurePosixPath
import hashlib,json
R=Path(__file__).resolve().parents[1];E=R/'evidence/ds023_v1_16_2'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def need(value,message):
 if not value:raise AssertionError(message)
def read(p):return json.loads((R/p).read_text())
def safe(name):
 p=PurePosixPath(name);return not p.is_absolute()and'..'not in p.parts and'\\'not in name
m=read('PACKAGE_SHA256.json');need(m['version']=='1.16.2','Wrong package version');listed={}
for f in m['files']:
 name=f['path'];need(safe(name)and name not in listed,'Unsafe/repeated file path');p=R/name;need(p.is_file()and p.stat().st_size==f['bytes']and sha(p)==f['sha256'],'Changed package payload: '+name);listed[name]=f
actual={p.relative_to(R).as_posix()for p in R.rglob('*')if p.is_file()and'.git'not in p.parts and'__pycache__'not in p.parts and p.suffix!='.pyc'and p.name!='.gitattributes'}
need(actual==set(listed)|{'PACKAGE_SHA256.json'},'Unlisted/missing source files')
base=read('rollback/ds023_v1_16_2/BASELINE_FILES.json')['files'];images=0
for name,f in base.items():
 p=R/name
 if name.startswith(('assets/','assemblies/'))and p.suffix.lower()in['.png','.webp','.jpg','.jpeg']:
  need(p.is_file()and sha(p)==f['sha256'],'Original runtime image changed: '+name);images+=1
 if not p.is_file()or sha(p)!=f['sha256']:
  saved=R/'rollback/ds023_v1_16_2/original'/name;need(saved.is_file()and sha(saved)==f['sha256'],'Exact rollback bytes missing: '+name)
need(images==699,'Wrong protected runtime image count')
d=read('data/ds023-cleanup.json');need(d['id']=='DS023'and d['canvas']==[996,2748],'Wrong correction scope')
need(d['source_input_sha256']==sha(R/'data/inputs.json')and d['baseline_registration_sha256']==sha(R/'data/batch10.json'),'Changed current source registration')
need(json.loads((R/'data/ds023-cleanup.js').read_text().split('=',1)[1].strip().removesuffix(';'))==d,'Correction JSON/JS mismatch')
for h,p in d['assetPaths'].items():need(safe(p)and sha(R/p)==h,'Corrected alpha image mismatch')
new_images={n for n in actual if n.startswith(('assets/','assemblies/'))and Path(n).suffix.lower()in['.png','.webp','.jpg','.jpeg']and n not in base}
need(new_images==set(d['assetPaths'].values())and len(new_images)==2,'Unexpected runtime image change')
for f in ['data/inputs.json','data/batch10.json','data/batch10.js','data/blazer-connection.json','src/application.css','src/local-state.js','src/facelift-state.js','src/source-aware-pickers.js','vendor/hewrs-logic.js','vendor/approved-scores.js']:
 need(sha(R/f)==base[f]['sha256'],'Protected data/logic changed: '+f)
registry=read('data/non-suit-sources.json');n=0
for row in registry['shirts'].values():
 for parts in row['components'].values():
  for desc in parts.values():need(sha(R/desc['runtime_path'])==desc['sha256'],'Current component mismatch');n+=1
need(n==576,'Wrong source component count')
for item in read('evidence/ds023_v1_16_2/DERIVATION.json')['checks']:
 need(item['rgb_pixels_changed']==0 and item['core_opacity_after_max']==0 and item['outside_cleanup_regions_changed']==0 and item['alpha_expanded_pixels']==0,'Cleanup not alpha-only/local')
f=read('evidence/ds023_v1_16_2/FUNCTIONAL.json');b=read('evidence/ds023_v1_16_2/browser/RESULT.json')
need(f['failed']==0 and f['passed']==33,'Functional tests incomplete')
need(b['failed']==0 and b['passed']==17 and not b['errors'],'Browser tests incomplete')
need(len(b['unchanged_regressions'])==185 and all(x['equal']and x['before_rgba_sha256']==x['after_rgba_sha256']for x in b['unchanged_regressions']),'Unchanged frame coverage missing')
need(len(b['ds023_render_exercises'])==168,'Wrong DS023 matrix coverage')
need(all(x['protected_face_equal']and x['below_hands_equal']for x in b['before_after']),'Protected face/lower-pixel drift')
for name,hash in read('evidence/ds023_v1_16_2/TESTED_RUNTIME_SHA256.json')['files'].items():need(sha(R/name)==hash,'Runtime changed after tests: '+name)
http=read('evidence/ds023_v1_16_2/HTTP_DELIVERY.json');need(http['status']=='PASS'and http['checked']==746,'Static HTTP delivery incomplete')
for x in http['files']:need(sha(R/x['path'])==x['sha256'],'Changed served file: '+x['path'])
roll=read('evidence/ds023_v1_16_2/ROLLBACK.json');need(roll['status']=='PASS'and roll['baseline_files']==1257 and not roll['browser_data_accessed'],'Rollback not established')
r=read('RELEASE_STATUS.json');need(r['version']=='1.16.2'and r['corrected_shirt_ids']==['DS023']and r['new_visual_ids_this_release']==0 and r['connected_non_suit_shirt_count']==18 and r['remaining_non_suit_shirt_count']==32,'False release scope')
need(not r['complete_product_release']and not r['shirt_only_numerical_ranking_installed']and not r['physical_iphone_safari_certified']and not r['browser_restart_persistence_certified']and not r['deployment_performed_this_release'],'Unsupported completion/deployment claim')
ledger=read('CHANGED_FILES.json');need(ledger['version']=='1.16.2','Stale changed-file ledger')
expected={n for n in(actual|set(base))-{'PACKAGE_SHA256.json','CHANGED_FILES.json'}if n not in base or n not in actual or sha(R/n)!=base[n]['sha256']}
need({v['path']for v in ledger['changes']}==expected,'Incomplete changed-file inventory')
for f in ledger['changes']:
 name=f['path'];need(f['before_sha256']==(base[name]['sha256']if name in base else None),'Incorrect old hash');need(f['after_sha256']==(sha(R/name)if (R/name).is_file()else None),'Incorrect new hash')
print(json.dumps({'status':'PASS','version':'1.16.2','payload_files_verified':len(listed),'runtime_images_preserved':images,'new_alpha_only_base_images':2,'functional_checks':33,'browser_checks':b['passed'],'unaffected_pixel_equal_frames':185,'ds023_render_exercises':168,'connected_non_suit_ids':18,'remaining_gated_ids':32,'deployed_by_this_verifier':False},indent=2))
