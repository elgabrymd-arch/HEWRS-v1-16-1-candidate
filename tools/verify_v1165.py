#!/usr/bin/env python3
"""Read-only package, scope, regression and rollback checks for V1.16.5."""
from pathlib import Path,PurePosixPath
import json,hashlib
R=Path(__file__).resolve().parents[1]
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def read(n):return json.loads((R/n).read_text())
def need(ok,msg):
 if not ok:raise AssertionError(msg)
def names():return {p.relative_to(R).as_posix() for p in R.rglob('*') if p.is_file()and'.git'not in p.parts and'__pycache__'not in p.parts and p.suffix!='.pyc'and p.name not in ['.gitattributes','.DS_Store']}
def main():
 m=read('PACKAGE_SHA256.json');need(m['version']=='1.16.5','Wrong version');listed={}
 for d in m['files']:
  n=d['path'];q=PurePosixPath(n);need(not q.is_absolute()and'..'not in q.parts and'\\'not in n and n not in listed,'Unsafe/duplicate path');p=R/n
  need(p.is_file()and p.stat().st_size==d['bytes']and sha(p)==d['sha256'],'Changed payload: '+n);listed[n]=d
 actual=names();need(actual==set(listed)|{'PACKAGE_SHA256.json'},'Unlisted or missing payloads')
 old=read('rollback/scope18_v1_16_5/BASELINE_FILES.json')['files'];images=0
 changed={n for n in old if n not in actual or sha(R/n)!=old[n]['sha256']}
 allowed={'src/application.js','src/source-aware-pickers.js','tools/build.py','app.template.html','index.html','app.html','README.md','RELEASE_STATUS.json','CHANGED_FILES.json','PACKAGE_SHA256.json'}
 need(changed<=allowed,'Unexpected baseline edit: '+str(changed-allowed))
 for n,d in old.items():
  if n.startswith(('assets/','assemblies/'))and Path(n).suffix in ['.png','.webp','.jpg','.jpeg']:
   need(sha(R/n)==d['sha256'],'Changed image: '+n);images+=1
  if n in changed:need(sha(R/'rollback/scope18_v1_16_5/original'/n)==d['sha256'],'Missing restoration bytes: '+n)
 need(images==705,'Incorrect image count');need(not[n for n in actual-set(old)if n.startswith(('assets/','assemblies/'))],'New garment artwork not allowed')
 scope=read('RELEASE_SCOPE.json');need(len(scope['enabled_non_suit_shirt_ids'])==18 and len(scope['deferred_non_suit_shirt_ids'])==32,'Wrong scope');need(scope['deferred_shirts_block_this_release']is False and scope['all_50_suit_shirt_routes_retained']is True,'Wrong scope semantics')
 f=read('evidence/scope18_v1_16_5/FUNCTIONAL.json');b=read('evidence/scope18_v1_16_5/browser/RESULT.json')
 need(f['passed']==24 and not f['failed'],'Functional tests incomplete');need(b['passed']>=20 and not b['failed']and not b['errors'],'Browser tests incomplete')
 need(len(b['outfit_frames'])==90 and all(x['equal']and x['before']==x['after']for x in b['outfit_frames']),'Frame regression failure');need(len(b['layout_cases'])==30,'Layout checks incomplete')
 for n,h in read('evidence/scope18_v1_16_5/TESTED_RUNTIME_SHA256.json')['files'].items():need(sha(R/n)==h,'Runtime changed after tests: '+n)
 r=read('RELEASE_STATUS.json');need(r['version']=='1.16.5'and r['connected_non_suit_shirt_count']==18 and r['deferred_non_suit_shirt_count']==32,'Release status mismatch');need(r['deferred_non_suit_shirts_block_current_scope']is False,'Deferred shirts still block scope')
 for flag in ['shirt_only_numerical_ranking_installed','garment_approvals_reopened','deployment_performed_this_release','physical_iphone_safari_certified','complete_product_release']:need(r[flag]is False,'Unsupported claim: '+flag)
 rb=read('evidence/scope18_v1_16_5/ROLLBACK.json');need(rb['status']=='PASS'and rb['baseline_files']==1369 and rb['write_performed']is True and rb['browser_data_accessed']is False,'Rollback test incomplete')
 ledger=read('CHANGED_FILES.json');need(ledger['version']=='1.16.5','Wrong change list')
 expected={n for n in actual|set(old)if n not in ['CHANGED_FILES.json','PACKAGE_SHA256.json']and(n not in old or n not in actual or sha(R/n)!=old[n]['sha256'])}
 need(expected=={d['path']for d in ledger['changes']},'Incomplete changed-file list')
 for d in ledger['changes']:
  n=d['path'];need(d['before_sha256']==(old[n]['sha256']if n in old else None),'Incorrect old hash');need(d['after_sha256']==(sha(R/n)if n in actual else None),'Incorrect new hash')
 print(json.dumps({'status':'PASS','version':'1.16.5','payload_files':len(listed),'original_images_preserved':images,'functional_checks':f['passed'],'chromium_checks':b['passed'],'unchanged_outfit_frames':90,'layout_cases':30,'scope':'18 connected non-suit shirts; other 32 deferred, all 50 retained for suits','deployment_performed':False},indent=2))
if __name__=='__main__':main()
