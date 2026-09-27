#!/usr/bin/env python3
"""Read-only verification of V1.17.0 source, preserved DNA/images, and evidence."""
from pathlib import Path,PurePosixPath
import json,hashlib
R=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(n):return json.loads((R/n).read_text())
def need(ok,msg):
 if not ok:raise AssertionError(msg)
def actual():return {p.relative_to(R).as_posix()for p in R.rglob('*')if p.is_file()and'.git'not in p.parts and'__pycache__'not in p.parts and p.suffix!='.pyc'and p.name not in['.gitattributes','.DS_Store']}
def main():
 m=read('PACKAGE_SHA256.json');need(m['version']=='1.17.0','Wrong package version');seen=set()
 for d in m['files']:
  n=d['path'];q=PurePosixPath(n);need(not q.is_absolute()and'..'not in q.parts and'\\'not in n and n not in seen,'Unsafe or duplicate payload');p=R/n;need(p.is_file()and p.stat().st_size==d['bytes']and sha(p)==d['sha256'],'Changed payload '+n);seen.add(n)
 need(actual()==seen|{'PACKAGE_SHA256.json'},'Unlisted or missing payload')
 old=read('rollback/core_v1_17_0/BASELINE_FILES.json')['files'];modified={n for n,d in old.items()if sha(R/n)!=d['sha256']}
 allowed={'src/application.js','app.template.html','index.html','app.html','tools/build.py','README.md','RELEASE_STATUS.json','RELEASE_SCOPE.json','CHANGED_FILES.json','PACKAGE_SHA256.json'}
 need(modified<=allowed,'Unexpected existing edit '+str(modified-allowed))
 for n in modified:need(sha(R/'rollback/core_v1_17_0/original'/n)==old[n]['sha256'],'Missing rollback bytes '+n)
 images=[n for n in old if n.startswith(('assets/','assemblies/'))and Path(n).suffix.lower()in['.png','.webp','.jpg','.jpeg']]
 need(len(images)==705 and all(sha(R/n)==old[n]['sha256']for n in images),'Garment image change')
 need(not any(n.startswith(('assets/','assemblies/'))for n in actual()-set(old)),'Unexpected new image')
 proof=read('evidence/core_v1_17_0/DNA_LOGIC_IMAGE_PRESERVATION.json')
 for f in proof['files']:need(sha(R/f['path'])==f['baseline_sha256']==f['current_sha256'],'DNA/logic change '+f['path'])
 status=read('RELEASE_STATUS.json');scope=read('RELEASE_SCOPE.json');need(status['version']==scope['version']=='1.17.0','Wrong metadata')
 need(status['connected_non_suit_shirt_count']==18 and status['remaining_non_suit_shirt_count']==32,'Wrong clothing scope')
 need(len(scope['enabled_non_suit_shirt_ids'])==18 and'DS041'not in scope['enabled_non_suit_shirt_ids'],'Wrong scope IDs')
 for k in ['automatic_engine_choice_installed','partial_anchor_generation_installed','location_permission_flow_installed','weather_context_and_eligibility_installed']:need(status[k]is True,'Missing implementation '+k)
 for k in ['complete_product_release','deployment_performed_this_release','physical_iphone_safari_certified','fresh_current_provider_http_verified','shirt_only_numerical_ranking_installed']:need(status[k]is False,'Unsupported claim '+k)
 ep='evidence/core_v1_17_0/';counts=[]
 for f,n in [('FUNCTIONAL.json',25),('WEATHER_FUNCTIONAL.json',21),('favorites-regression/FUNCTIONAL.json',31),('insights-regression/FUNCTIONAL.json',32)]:
  t=read(ep+f);need(t['passed']==n and not t['failed'],'Functional failures '+f);counts.append(n)
 b=read(ep+'browser/RESULT.json');need(b['passed']==26 and not b['failed']and not b['errors'],'Browser failures')
 need(len(b['outfit_frames'])==90 and all(x['equal']and x['before']==x['after']for x in b['outfit_frames']),'Image regressions')
 need(len(b['new_engine_frames'])==15 and len({json.dumps(x['selection'],sort_keys=True)for x in b['new_engine_frames']})==15,'Missing real 15-option renders')
 need(len(b['layout_cases'])==5 and all(x['passed']for x in b['layout_cases']),'Layout failures')
 for n,h in read(ep+'TESTED_RUNTIME_SHA256.json')['files'].items():need(sha(R/n)==h,'Runtime changed after final test '+n)
 need(read(ep+'HTTP.json')['status']=='PASS','HTTP delivery failed')
 need(read(ep+'LOCAL_ORIGIN.json')['status']in['BLOCKED','PASS'],'Undisclosed local-origin failure')
 need(read(ep+'PROVIDER_HTTP.json')['status']in['UNAVAILABLE','PASS'],'Undisclosed provider failure')
 rb=read(ep+'ROLLBACK.json');need(rb['status']=='PASS'and rb['version']=='1.16.7'and rb['write_performed'],'Rollback not tested')
 changes=read('CHANGED_FILES.json');files=actual();expected={n for n in files|set(old)if n not in['CHANGED_FILES.json','PACKAGE_SHA256.json']and(n not in old or n not in files or sha(R/n)!=old[n]['sha256'])}
 need(expected=={r['path']for r in changes['changes']},'Incomplete change ledger')
 for r in changes['changes']:
  n=r['path'];need(r['after_sha256']==sha(R/n),'Wrong changed-file hash '+n);need(r['before_sha256']==(old[n]['sha256']if n in old else None),'Wrong baseline hash '+n)
 print(json.dumps({'status':'PASS','version':'1.17.0','payloads':len(seen),'preserved_runtime_images':len(images),'preserved_data_logic_paths':len(proof['files']),'functional_checks':sum(counts),'chromium_checks':b['passed'],'unchanged_outfit_frames':90,'new_engine_frames':15,'live_provider_and_device_acceptance':'not verified','deployment':False},indent=2))
if __name__=='__main__':main()
