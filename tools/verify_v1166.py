#!/usr/bin/env python3
"""Read-only V1.16.6 package, 18-shirt scope and regression verification."""
from pathlib import Path,PurePosixPath
import hashlib,json
R=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(n):return json.loads((R/n).read_text())
def files():return {p.relative_to(R).as_posix()for p in R.rglob('*')if p.is_file()and'.git'not in p.parts and'__pycache__'not in p.parts and p.suffix!='.pyc'and p.name not in ['.gitattributes','.DS_Store']}
def need(v,m):
 if not v:raise AssertionError(m)
def main():
 manifest=read('PACKAGE_SHA256.json');need(manifest['version']=='1.16.6','Wrong package version');listed={}
 for row in manifest['files']:
  n=row['path'];p=R/n;q=PurePosixPath(n);need(not q.is_absolute()and'..'not in q.parts and'\\'not in n and n not in listed,'Unsafe/duplicate path')
  need(p.is_file()and p.stat().st_size==row['bytes']and sha(p)==row['sha256'],'Changed payload: '+n);listed[n]=row
 actual=files();need(actual==set(listed)|{'PACKAGE_SHA256.json'},'Unlisted/missing payloads')
 old=read('rollback/favorites_v1_16_6/BASELINE_FILES.json')['files'];changed={n for n in old if n not in actual or sha(R/n)!=old[n]['sha256']}
 allowed={'src/application.js','tools/build.py','app.template.html','index.html','app.html','README.md','RELEASE_STATUS.json','RELEASE_SCOPE.json','CHANGED_FILES.json','PACKAGE_SHA256.json'}
 need(changed<=allowed,'Unexpected original edit: '+str(changed-allowed));images=0
 for n,d in old.items():
  if n.startswith(('assets/','assemblies/'))and Path(n).suffix in ['.png','.webp','.jpg','.jpeg']:need(sha(R/n)==d['sha256'],'Changed garment image');images+=1
  if n in changed:need(sha(R/'rollback/favorites_v1_16_6/original'/n)==d['sha256'],'Missing rollback bytes: '+n)
 need(images==705,'Unexpected image count');need(not[n for n in actual-set(old)if n.startswith(('assets/','assemblies/'))],'New clothing image')
 scope=read('RELEASE_SCOPE.json');need(len(scope['enabled_non_suit_shirt_ids'])==18 and len(scope['deferred_non_suit_shirt_ids'])==32 and'DS041'not in scope['enabled_non_suit_shirt_ids'],'Scope mismatch')
 need(scope['all_50_suit_shirt_routes_retained']is True and scope['deferred_shirts_block_this_release']is False,'Changed scope policy')
 status=read('RELEASE_STATUS.json');need(status['version']=='1.16.6'and status['connected_non_suit_shirt_count']==18 and status['favorites_installed']is True,'Wrong status')
 for flag in ['shirt_only_numerical_ranking_installed','garment_approvals_reopened','deployment_performed_this_release','physical_iphone_safari_certified','complete_product_release']:need(status[flag]is False,'Unsupported claim '+flag)
 f=read('evidence/favorites_v1_16_6/FUNCTIONAL.json');b=read('evidence/favorites_v1_16_6/browser/RESULT.json');x=read('evidence/favorites_v1_16_6/EXTRA_BROWSER.json')
 need(f['passed']==31 and not f['failed'],'Functional checks incomplete');need(b['passed']==21 and not b['failed']and not b['errors'],'Browser checks incomplete');need(x['passed']==4 and not x['failed'],'Additional checks incomplete')
 need(len(b['outfit_frames'])==90 and all(r['equal']and r['before']==r['after']for r in b['outfit_frames']),'Changed outfit frames')
 need(len(b['layout_cases'])==5 and all(r['passed']for r in b['layout_cases']),'Layout checks incomplete')
 for n,h in read('evidence/favorites_v1_16_6/TESTED_RUNTIME_SHA256.json')['files'].items():need(sha(R/n)==h,'Runtime changed after test: '+n)
 need(read('evidence/favorites_v1_16_6/HTTP.json')['status']=='PASS','HTTP bytes incomplete')
 need(read('evidence/favorites_v1_16_6/LOCAL_ORIGIN.json')['status']in['BLOCKED','PASS'],'Unexplained local-origin result')
 rb=read('evidence/favorites_v1_16_6/ROLLBACK.json');need(rb['status']=='PASS'and rb['baseline_files']==1393 and rb['write_performed']is True and rb['browser_data_accessed']is False,'Rollback not executed')
 ledger=read('CHANGED_FILES.json');need(ledger['version']=='1.16.6','Wrong changed-file list')
 expected={n for n in actual|set(old)if n not in ['PACKAGE_SHA256.json','CHANGED_FILES.json']and(n not in old or n not in actual or sha(R/n)!=old[n]['sha256'])}
 need(expected=={x['path']for x in ledger['changes']},'Incomplete changed-file list')
 for d in ledger['changes']:
  n=d['path'];need(d['before_sha256']==(old[n]['sha256']if n in old else None),'Wrong old hash: '+n);need(d['after_sha256']==(sha(R/n)if n in actual else None),'Wrong new hash: '+n)
 print(json.dumps({'status':'PASS','version':'1.16.6','payload_files':len(listed),'garment_images_preserved':images,'functional_checks':31,'chromium_checks':25,'pixel_equal_frames':90,'scope':'18 non-suit; 50 suit shirts; no new scores','deployment_performed':False},indent=2))
if __name__=='__main__':main()
