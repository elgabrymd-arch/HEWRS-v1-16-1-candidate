#!/usr/bin/env python3
"""Read-only V1.16.3 package/preservation/test receipt verifier, standard library.
No GitHub, browser data, original avatar or other source files are modified.
"""
from pathlib import Path,PurePosixPath
import hashlib,json
R=Path(__file__).resolve().parents[1]
def sha(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def need(ok,msg):
 if not ok:raise AssertionError(msg)
def read(n):return json.loads((R/n).read_text())
def safe(n):
 q=PurePosixPath(n);return not q.is_absolute()and'..'not in q.parts and'\\'not in n
def file_set():return {p.relative_to(R).as_posix()for p in R.rglob('*')if p.is_file()and'.git'not in p.parts and'__pycache__'not in p.parts and p.suffix!='.pyc'and p.name!='.gitattributes'}
def main():
 m=read('PACKAGE_SHA256.json');need(m['version']=='1.16.3','Wrong package version');listed={}
 for d in m['files']:
  n=d['path'];need(safe(n)and n not in listed,'Unsafe/duplicate path');p=R/n;need(p.is_file()and p.stat().st_size==d['bytes']and sha(p)==d['sha256'],'Changed package payload: '+n);listed[n]=d
 actual=file_set();need(actual==set(listed)|{'PACKAGE_SHA256.json'},'Unlisted or missing files')
 old=read('rollback/edges_v1_16_3/BASELINE_FILES.json')['files'];nimages=0
 for n,f in old.items():
  p=R/n
  if n.startswith(('assets/','assemblies/'))and p.suffix.lower()in['.png','.webp','.jpg','.jpeg']:
   need(p.is_file()and sha(p)==f['sha256'],'Original image changed: '+n);nimages+=1
  if not p.is_file()or sha(p)!=f['sha256']:
   b=R/'rollback/edges_v1_16_3/original'/n;need(b.is_file()and sha(b)==f['sha256'],'Missing rollback bytes: '+n)
 need(nimages==701,'Protected image count mismatch')
 data=read('data/ds023-edges.json');need(data['id']=='DS023'and data['history_id']=='shirt-DS023','Changed scope')
 need(data['source_input_sha256']==sha(R/'data/inputs.json'),'Changed input lock')
 need(data['profile_sha256']==sha(R/'provenance/edges_v1_16_3/PROFILES.json'),'Changed local alpha profile')
 need(json.loads((R/'data/ds023-edges.js').read_text().split('=',1)[1].strip().removesuffix(';'))==data,'JSON/JS registry mismatch')
 for h,p in data['assetPaths'].items():need(safe(p)and sha(R/p)==h,'Incorrect alpha derivative')
 new_images={n for n in actual if n.startswith(('assets/','assemblies/'))and Path(n).suffix.lower()in['.png','.webp','.jpg','.jpeg']and n not in old}
 need(new_images==set(data['assetPaths'].values())and len(new_images)==4,'Unexpected new runtime artwork')
 for row in read('evidence/edges_v1_16_3/DERIVATION.json')['checks']:
  need(row['rgb_changed_pixels']==row['alpha_added_pixels']==row['outside_bounded_matte_changed_pixels']==0,'Nonlocal or non-alpha edit')
 for p in ['data/inputs.json','data/batch10.json','data/ds023-cleanup.json','data/suit-assembly.json','data/non-suit-sources.json','data/blazer-connection.json','src/local-state.js','src/application.css','src/facelift-state.js','src/source-aware-pickers.js','vendor/hewrs-logic.js','vendor/approved-scores.js']:
  need(sha(R/p)==old[p]['sha256'],'Protected logic/input modified: '+p)
 f=read('evidence/edges_v1_16_3/FUNCTIONAL.json');i=read('evidence/edges_v1_16_3/INHERITED_FUNCTIONAL.json');b=read('evidence/edges_v1_16_3/browser/RESULT.json')
 need(f['passed']==10 and f['failed']==0 and i['passed']==33 and i['failed']==0,'Functional checks incomplete')
 need(b['failed']==0 and not b['errors']and b['passed']>=14,'Browser checks incomplete')
 need(len(b['unaffected_frames'])==200 and all(x['equal']and x['before_sha256']==x['after_sha256']for x in b['unaffected_frames']),'Regression evidence missing')
 need(len(b['changed_route_frames'])==130 and all(x['outside_local_region_changed']==0 and x['face_above_y398_equal']and x['all_pixels_y586_and_below_equal']for x in b['changed_route_frames']),'Nonlocal output differences')
 for p,h in read('evidence/edges_v1_16_3/TESTED_RUNTIME_SHA256.json')['files'].items():need(sha(R/p)==h,'Changed after tests: '+p)
 r=read('RELEASE_STATUS.json');need(r['version']=='1.16.3'and r['connected_non_suit_shirt_count']==18 and r['remaining_non_suit_shirt_count']==32 and r['new_visual_ids_this_release']==0,'Stale release state')
 for k in ['complete_product_release','shirt_only_numerical_ranking_installed','physical_iphone_safari_certified','browser_restart_persistence_certified','deployment_performed_this_release']:need(r[k]is False,'Unsupported claim: '+k)
 http=read('evidence/edges_v1_16_3/HTTP_DELIVERY.json');need(http['status']=='PASS'and http['checked']==752,'Static byte-delivery check incomplete')
 for d in http['files']:need(sha(R/d['path'])==d['sha256'],'Served file changed: '+d['path'])
 rollback=read('evidence/edges_v1_16_3/ROLLBACK.json');need(rollback['status']=='PASS'and rollback['baseline_files']==1301 and rollback['browser_data_accessed']is False,'Rollback not tested')
 changes=read('CHANGED_FILES.json');need(changes['version']=='1.16.3','Wrong change ledger version');expected={n for n in(actual|set(old))-{'CHANGED_FILES.json','PACKAGE_SHA256.json'}if n not in old or n not in actual or sha(R/n)!=old[n]['sha256']}
 need({x['path']for x in changes['changes']}==expected,'Incorrect changed-file inventory')
 for d in changes['changes']:
  n=d['path'];need(d['before_sha256']==(old[n]['sha256']if n in old else None),'Wrong baseline hash');need(d['after_sha256']==(sha(R/n)if (R/n).is_file()else None),'Wrong current hash')
 print(json.dumps({'status':'PASS','version':'1.16.3','payload_files_verified':len(listed),'old_runtime_images_unchanged':nimages,'new_alpha_only_derivatives':4,'functional_checks':43,'browser_checks':b['passed'],'unaffected_pixel_equal_frames':200,'local_edge_route_exercises':130,'deployment_performed':False},indent=2))
if __name__=='__main__':main()
