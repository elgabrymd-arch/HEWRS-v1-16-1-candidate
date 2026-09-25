#!/usr/bin/env python3
"""Read-only V1.16.4 integrity, scope, runtime and evidence checks."""
from pathlib import Path,PurePosixPath
import hashlib,json
R=Path(__file__).resolve().parents[1]
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for part in iter(lambda:f.read(1024*1024),b''):h.update(part)
 return h.hexdigest()
def read(p):return json.loads((R/p).read_text())
def need(ok,msg):
 if not ok:raise AssertionError(msg)
def names():return {p.relative_to(R).as_posix()for p in R.rglob('*')if p.is_file()and'.git'not in p.parts and'__pycache__'not in p.parts and p.suffix!='.pyc'and p.name not in ['.gitattributes','.DS_Store']}
def main():
 m=read('PACKAGE_SHA256.json');need(m['version']=='1.16.4','Wrong package version');rows={}
 for d in m['files']:
  n=d['path'];q=PurePosixPath(n);need(not q.is_absolute()and'..'not in q.parts and'\\'not in n and n not in rows,'Unsafe/duplicate path')
  p=R/n;need(p.is_file()and p.stat().st_size==d['bytes']and sha(p)==d['sha256'],'Changed payload: '+n);rows[n]=d
 actual=names();need(actual==set(rows)|{'PACKAGE_SHA256.json'},'Unlisted or missing payloads')
 old=read('rollback/picker_v1_16_4/BASELINE_FILES.json')['files'];images=0
 for n,d in old.items():
  if n.startswith(('assets/','assemblies/')) and Path(n).suffix in ['.png','.webp','.jpg','.jpeg']:
   need(sha(R/n)==d['sha256'],'Changed original image');images+=1
  if not(R/n).is_file()or sha(R/n)!=d['sha256']:
   need(sha(R/'rollback/picker_v1_16_4/original'/n)==d['sha256'],'Missing rollback bytes: '+n)
 need(images==705,'Unexpected original image count')
 need(not[n for n in actual-set(old)if n.startswith(('assets/','assemblies/'))],'Unexpected new artwork')
 allowed={'src/application.js','src/application.css','tools/build.py','app.template.html','index.html','app.html','README.md','RELEASE_STATUS.json','CHANGED_FILES.json','PACKAGE_SHA256.json'}
 changed={n for n in old if n not in actual or sha(R/n)!=old[n]['sha256']};need(changed<=allowed,'Unexpected baseline edit: '+str(changed-allowed))
 for n,h in read('evidence/picker_v1_16_4/TESTED_RUNTIME_SHA256.json')['files'].items():need(sha(R/n)==h,'Changed after tests: '+n)
 f=read('evidence/picker_v1_16_4/FUNCTIONAL.json');b=read('evidence/picker_v1_16_4/browser/RESULT.json')
 need(f['passed']==16 and not f['failed'],'Functional evidence incomplete');need(b['passed']==25 and not b['failed']and not b['errors'],'Browser evidence incomplete')
 need(len(b['layout_cases'])==40,'Wrong layout case count');need(len(b['outfit_frames'])==16 and all(x['equal']and x['before']==x['after']for x in b['outfit_frames']),'Frame regression evidence')
 r=read('RELEASE_STATUS.json');need(r['version']=='1.16.4'and r['connected_non_suit_shirt_count']==18 and r['remaining_non_suit_shirt_count']==32,'Release metadata')
 for k in ['physical_iphone_safari_certified','webkit_executed','browser_restart_persistence_certified','deployment_performed_this_release','complete_product_release']:need(r[k] is False,'Unsupported certification: '+k)
 rollback=read('evidence/picker_v1_16_4/ROLLBACK.json');need(rollback['status']=='PASS'and rollback['baseline_files']==1341 and rollback['browser_data_accessed']is False,'Rollback not verified')
 ledger=read('CHANGED_FILES.json');need(ledger['version']=='1.16.4','Wrong change ledger')
 expected={n for n in actual|set(old)if n not in ['CHANGED_FILES.json','PACKAGE_SHA256.json']and(n not in old or n not in actual or sha(R/n)!=old[n]['sha256'])}
 need(expected=={d['path']for d in ledger['changes']},'Changed-file list mismatch')
 for d in ledger['changes']:
  n=d['path'];need(d['before_sha256']==(old[n]['sha256']if n in old else None),'Wrong before hash');need(d['after_sha256']==(sha(R/n)if n in actual else None),'Wrong after hash')
 print(json.dumps({'status':'PASS','version':'1.16.4','payload_files':len(rows),'original_images_preserved':images,'functional_checks':16,'chromium_checks':25,'layout_cases':40,'unchanged_outfit_frames':16,'physical_safari_certified':False,'deployment_performed':False},indent=2))
if __name__=='__main__':main()
