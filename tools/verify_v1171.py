#!/usr/bin/env python3
"""Read-only full package, preservation, final-test and rollback checks."""
from pathlib import Path,PurePosixPath
import json,hashlib
R=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads((R/p).read_text())
def need(v,s):
 if not v:raise AssertionError(s)
def actual():return {p.relative_to(R).as_posix()for p in R.rglob('*')if p.is_file()and'.git'not in p.parts and'__pycache__'not in p.parts and p.suffix!='.pyc'and p.name not in ['.gitattributes','.DS_Store']}
def main():
 m=read('PACKAGE_SHA256.json');need(m['version']=='1.17.1','Wrong version');seen=set()
 for row in m['files']:
  n=row['path'];q=PurePosixPath(n);need(not q.is_absolute()and'..'not in q.parts and'\\'not in n and n not in seen,'Unsafe/duplicate entry');p=R/n;need(p.is_file()and p.stat().st_size==row['bytes']and sha(p)==row['sha256'],'Changed payload '+n);seen.add(n)
 need(actual()==seen|{'PACKAGE_SHA256.json'},'Missing/unlisted file')
 rb='rollback/mobile_v1_17_1';old=read(rb+'/BASELINE_FILES.json')['files'];modified={n for n in old if not(R/n).exists()or sha(R/n)!=old[n]['sha256']}
 allowed={'src/application.js','src/application.css','src/weather-context.js','app.template.html','app.html','index.html','tools/build.py','README.md','RELEASE_STATUS.json','RELEASE_SCOPE.json','CHANGED_FILES.json','PACKAGE_SHA256.json'}
 need(modified<=allowed,'Unexpected baseline change '+str(modified-allowed))
 for n in modified:need(sha(R/rb/'original'/n)==old[n]['sha256'],'Missing rollback '+n)
 proof=read('evidence/mobile_v1_17_1/PRESERVATION.json');need(proof['runtime_images']==705,'Wrong image count')
 for row in proof['files']:need(sha(R/row['path'])==row['before_sha256']==row['after_sha256'],'Changed protected image/data/logic: '+row['path'])
 need(not any(n.startswith(('assets/','assemblies/'))for n in actual()-old.keys()),'New image prohibited')
 st=read('RELEASE_STATUS.json');need(st['version']=='1.17.1'and st['connected_non_suit_shirt_count']==18 and st['remaining_non_suit_shirt_count']==32,'Wrong release/scope')
 need(read('RELEASE_SCOPE.json')['enabled_non_suit_shirt_ids']==read(rb+'/original/RELEASE_SCOPE.json')['enabled_non_suit_shirt_ids'],'Changed enabled shirt IDs')
 for field in ['complete_product_release','phone_weather_success_certified','fresh_current_provider_http_verified','physical_iphone_safari_certified','deployment_performed_this_release','weather_eligibility_policy_changed','render_geometry_changed']:need(st[field] is False,'Unsupported assertion '+field)
 ep='evidence/mobile_v1_17_1/';total=0
 for file,count in [('WEATHER_NEW.json',22),('INHERITED_WEATHER.json',21),('core/FUNCTIONAL.json',25)]:
  x=read(ep+file);need(x['passed']==count and x['failed']==0,'Failed functional suite '+file);total+=count
 b=read(ep+'browser/RESULT.json');need(b['passed']==25 and b['failed']==0 and not b['errors'],'Failed browser suite')
 need(len(b['outfit_regressions'])==90 and all(x['equal']and x['before']==x['after']for x in b['outfit_regressions']),'Changed outfit frames')
 need(len(b['new_engine_frames'])==15 and len({json.dumps(x['selection'],sort_keys=True)for x in b['new_engine_frames']})==15,'Incorrect 15-option test')
 need(len(b['layouts'])==5 and all(x['passed']for x in b['layouts']),'Failed viewport case')
 for n,h in read(ep+'TESTED_RUNTIME_SHA256.json')['files'].items():need(sha(R/n)==h,'Runtime modified since final tests '+n)
 need(read(ep+'HTTP.json')['status']=='PASS','HTTP byte test failed');need(read(ep+'LOCAL_ORIGIN.json')['status']in['BLOCKED','PASS'],'Undisclosed origin failure');need(read(ep+'PROVIDER_HTTP.json')['status']in['UNAVAILABLE','PASS'],'Undisclosed provider failure')
 need(read(ep+'ROLLBACK.json')['status']=='PASS'and read(ep+'ROLLBACK.json')['write_performed'],'Rollback not executed')
 ledger=read('CHANGED_FILES.json')['changes'];expected={n for n in actual()|old.keys()if n not in ['CHANGED_FILES.json','PACKAGE_SHA256.json']and(n not in old or not (R/n).exists()or sha(R/n)!=old[n]['sha256'])}
 need(expected=={x['path']for x in ledger},'Incomplete changed-file list')
 for row in ledger:need(row['after_sha256']==sha(R/row['path']) and row['before_sha256']==old.get(row['path'],{}).get('sha256'),'Bad changed-file hash')
 print(json.dumps({'status':'PASS','version':'1.17.1','payloads':len(seen),'functional_checks':total,'chromium_checks':b['passed'],'unchanged_runtime_images':705,'unchanged_native_outfit_frames':90,'actual_fifteen_option_frames':15,'live_weather_on_owner_phone':'NOT_VERIFIED','deployment_performed':False},indent=2))
if __name__=='__main__':main()
