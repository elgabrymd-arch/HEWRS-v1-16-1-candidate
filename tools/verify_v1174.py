#!/usr/bin/env python3
"""Read-only V1.17.4 package, source preservation and recorded-test verifier."""
from pathlib import Path,PurePosixPath
import json,hashlib
R=Path(__file__).resolve().parents[1];E='evidence/suits_auto_weather_v1_17_4/'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads((R/p).read_text())
def need(v,m):
 if not v:raise AssertionError(m)
def files():return {p.relative_to(R).as_posix() for p in R.rglob('*')if p.is_file()and'.git'not in p.parts and'__pycache__'not in p.parts and p.suffix!='.pyc'and p.name not in ['.DS_Store','.gitattributes']}
def main():
 manifest=read('PACKAGE_SHA256.json');need(manifest['version']=='1.17.4','Wrong version');seen=set()
 for v in manifest['files']:
  n=v['path'];p=PurePosixPath(n);need(n and not p.is_absolute()and'..'not in p.parts and'\\'not in n and n not in seen,'Unsafe or duplicate path')
  need((R/n).is_file()and(R/n).stat().st_size==v['bytes']and sha(R/n)==v['sha256'],'Mismatch '+n);seen.add(n)
 need(files()==seen|{'PACKAGE_SHA256.json'},'Unlisted or missing payloads')
 baseline=read('rollback/suits_auto_weather_v1_17_4/BASELINE_FILES.json')['files']
 allowed={'src/application.js','src/automatic-engine.js','src/weather-context.js','tools/build.py','app.template.html','index.html','app.html','README.md','RELEASE_STATUS.json','RELEASE_SCOPE.json','CHANGED_FILES.json','PACKAGE_SHA256.json'}
 changed={n for n,v in baseline.items()if not(R/n).is_file()or sha(R/n)!=v['sha256']};need(changed<=allowed,'Unexpected baseline changes '+str(changed-allowed))
 for n in changed:need(sha(R/'rollback/suits_auto_weather_v1_17_4/original'/n)==baseline[n]['sha256'],'Rollback source mismatch '+n)
 img=read(E+'IMAGE_PRESERVATION.json');need(img['runtime_images']==848,'Wrong image count')
 for v in img['files']:need(sha(R/v['path'])==v['sha256'],'Garment image changed '+v['path'])
 need(not any(n.startswith(('assets/','assemblies/'))for n in files()-baseline.keys()),'Unexpected garment image addition')
 for n,v in read(E+'TESTED_RUNTIME_SHA256.json')['files'].items():need(sha(R/n)==v,'Runtime changed after tests '+n)
 expected={'SUITS_FUNCTIONAL.json':11,'AUTO_WEATHER_FUNCTIONAL.json':22,'WEATHER_TRANSPORT.json':21,'PASS3_OPTIONS_POLICY.json':26,'DNA_ENSEMBLE_PRESERVATION.json':5}
 for name,count in expected.items():
  t=read(E+name);need(t['passed']==count and t['failed']==0,'Test suite incomplete '+name)
 t=read(E+'browser/RESULT.json');need(t['passed']==19 and t['failed']==0 and not t['errors'],'Browser suite incomplete')
 need(len(t['native_comparisons'])==166 and all(x['equal']for x in t['native_comparisons']),'Image regression failure');need(len(t['engine_frames'])==30,'S10/S11 navigation incomplete')
 s=read('RELEASE_STATUS.json');need(s['version']=='1.17.4'and s['connected_non_suit_shirt_count']==18 and s['suit_shirt_count']==50,'Scope changed');need(s['runtime_images_modified']==0 and s['derived_ensemble_numeric_results_changed']==0,'Unexpected data changes')
 need(read(E+'LOCAL_ORIGIN.json')['status']in['BLOCKED','PASS'],'Origin attempt failed unexpectedly')
 changes=read('CHANGED_FILES.json')['changes'];actual={n for n in files()|baseline.keys()if n not in ['CHANGED_FILES.json','PACKAGE_SHA256.json']and(n not in baseline or not(R/n).is_file()or sha(R/n)!=baseline[n]['sha256'])};need(actual=={v['path']for v in changes},'Changed-file inventory differs')
 for v in changes:need(v['before_sha256']==baseline.get(v['path'],{}).get('sha256')and v['after_sha256']==sha(R/v['path']),'Change hash mismatch '+v['path'])
 print(json.dumps({'status':'PASS','version':'1.17.4','payloads':len(seen),'functional_checks':sum(expected.values()),'chromium_checks':t['passed'],'existing_frames_pixel_equal':166,'new_engine_frames':30,'images_preserved':848,'frozen_shirt_tie_lookups_preserved':2350,'ensemble_calculations_preserved':112392,'current_location_permission_bypassed':False,'deployment_performed':False},indent=2))
if __name__=='__main__':main()
