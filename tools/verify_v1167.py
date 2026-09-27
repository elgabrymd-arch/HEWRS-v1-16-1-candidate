#!/usr/bin/env python3
"""Read-only exact V1.16.7 package, scope, preserved runtime and test verifier."""
from pathlib import Path,PurePosixPath
import json,hashlib
R=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads((R/p).read_text())
def files():return {p.relative_to(R).as_posix()for p in R.rglob('*')if p.is_file()and'.git'not in p.parts and'__pycache__'not in p.parts and p.suffix!='.pyc'and p.name not in['.gitattributes','.DS_Store']}
def need(v,m):
 if not v:raise AssertionError(m)
def main():
 m=read('PACKAGE_SHA256.json');need(m['version']=='1.16.7','Wrong version');found={}
 for d in m['files']:
  n=d['path'];q=PurePosixPath(n);p=R/n;need(not q.is_absolute()and'..'not in q.parts and'\\'not in n and n not in found,'Unsafe or duplicate path')
  need(p.is_file()and p.stat().st_size==d['bytes']and sha(p)==d['sha256'],'Changed payload: '+n);found[n]=d
 actual=files();need(actual==set(found)|{'PACKAGE_SHA256.json'},'Unlisted/missing payload')
 old=read('rollback/insights_v1_16_7/BASELINE_FILES.json')['files'];changed={n for n,d in old.items()if n not in actual or sha(R/n)!=d['sha256']}
 allowed={'src/application.js','tools/build.py','app.template.html','index.html','app.html','README.md','RELEASE_STATUS.json','RELEASE_SCOPE.json','CHANGED_FILES.json','PACKAGE_SHA256.json'}
 need(changed<=allowed,'Unexpected original edit '+str(changed-allowed));images=0
 for n,d in old.items():
  if n.startswith(('assets/','assemblies/'))and Path(n).suffix.lower()in['.png','.webp','.jpg','.jpeg']:need(sha(R/n)==d['sha256'],'Changed original garment image');images+=1
  if n in changed:need(sha(R/'rollback/insights_v1_16_7/original'/n)==d['sha256'],'Missing exact rollback bytes '+n)
 need(images==705,'Unexpected image count');need(not[n for n in actual-set(old)if n.startswith(('assets/','assemblies/'))],'New clothing images')
 scope=read('RELEASE_SCOPE.json');status=read('RELEASE_STATUS.json');need(scope['version']==status['version']=='1.16.7','Wrong scope/status version')
 need(len(scope['enabled_non_suit_shirt_ids'])==18 and len(scope['deferred_non_suit_shirt_ids'])==32 and'DS041'not in scope['enabled_non_suit_shirt_ids'],'Wrong 18-shirt scope')
 need(scope['all_50_suit_shirt_routes_retained']is True and scope['deferred_shirts_block_this_release']is False,'Changed scope policy')
 for k in ['insights_installed','favorites_installed']:need(status[k]is True,'Missing feature '+k)
 for k in ['insights_storage_writes','insights_new_scores','insights_new_rotation_policy','shirt_only_numerical_ranking_installed','deployment_performed_this_release','physical_iphone_safari_certified','complete_product_release']:need(status[k]is False,'Unsupported claim '+k)
 e='evidence/insights_v1_16_7/'
 f=read(e+'FUNCTIONAL.json');fav=read(e+'favorites-regression/FUNCTIONAL.json');b=read(e+'browser/RESULT.json')
 need(f['passed']==32 and not f['failed'],'Insights functional checks incomplete');need(fav['passed']==31 and not fav['failed'],'Favorites regression incomplete')
 need(b['passed']==26 and not b['failed']and not b['errors'],'Browser checks incomplete')
 need(len(b['outfit_frames'])==90 and all(x['equal']and x['before']==x['after']for x in b['outfit_frames']),'Outfit regression')
 need(len(b['layout_cases'])==5 and all(x['passed']for x in b['layout_cases']),'Incomplete layout checks')
 for n,h in read(e+'TESTED_RUNTIME_SHA256.json')['files'].items():need(sha(R/n)==h,'Runtime changed after test '+n)
 need(read(e+'HTTP.json')['status']=='PASS'and read(e+'HTTP.json')['count']==49,'HTTP byte checks incomplete')
 need(read(e+'LOCAL_ORIGIN.json')['status']in['BLOCKED','PASS'],'Unexplained real-origin test')
 rb=read(e+'ROLLBACK.json');need(rb['status']=='PASS'and rb['version']=='1.16.6'and rb['baseline_files']==1422 and rb['write_performed']is True and rb['browser_data_accessed']is False,'Rollback not executed')
 ledger=read('CHANGED_FILES.json');need(ledger['version']=='1.16.7','Wrong change ledger')
 expected={n for n in actual|set(old)if n not in['CHANGED_FILES.json','PACKAGE_SHA256.json']and(n not in old or n not in actual or sha(R/n)!=old[n]['sha256'])}
 need(expected=={x['path']for x in ledger['changes']},'Incomplete changed-file list')
 for d in ledger['changes']:
  n=d['path'];need(d['before_sha256']==(old[n]['sha256']if n in old else None),'Wrong prior hash '+n);need(d['after_sha256']==(sha(R/n)if n in actual else None),'Wrong current hash '+n)
 print(json.dumps({'status':'PASS','version':'1.16.7','payload_files':len(found),'original_runtime_images_preserved':images,'functional_checks':63,'chromium_checks':26,'pixel_equal_frames':90,'scope':'18 non-suit shirts; all50 suit shirts; read-only recorded wear','deployment_performed':False},indent=2))
if __name__=='__main__':main()
