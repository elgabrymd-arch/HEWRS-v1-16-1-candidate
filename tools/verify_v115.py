#!/usr/bin/env python3
"""Read-only V1.15 file/identity/preservation/test-receipt verification.
Standard library only. No network, rendering, browser storage or deployment.
For fresh executable tests and real-origin limitations see README.md.
"""
from pathlib import Path, PurePosixPath
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
EXPECTED=['DS004','DS005','DS007','DS015','DS018','DS019','DS023','DS024','DS025','DS047']
ALLOWED={'README.md','RELEASE_STATUS.json','CHANGED_FILES.json','app.html','index.html','src/blazer-connection.js','src/non-suit-sources.js','src/shirt-only-connection.js','tools/build.py'}
def require(value,message):
 if not value:raise AssertionError(message)
def sha(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for chunk in iter(lambda:f.read(2**20),b''):h.update(chunk)
 return h.hexdigest()
def load(name):return json.loads((ROOT/name).read_text())
def visible(p):return p.is_file()and'__pycache__'not in p.parts and p.suffix!='.pyc'
def safe(name):
 p=PurePosixPath(name)
 return not p.is_absolute()and'..'not in p.parts and'\\'not in name
m=load('PACKAGE_SHA256.json');require(m['schema']=='hewrs.package.sha256.v1'and m['version']=='1.15','Wrong package identity')
listed=set()
for row in m['files']:
 name=row['path'];require(safe(name)and name not in listed,'Unsafe or repeated payload path');listed.add(name);p=ROOT/name
 require(p.is_file()and p.stat().st_size==row['bytes']and sha(p)==row['sha256'],'Payload mismatch: '+name)
actual={p.relative_to(ROOT).as_posix()for p in ROOT.rglob('*')if visible(p)}
require(actual==listed|{'PACKAGE_SHA256.json'},'Missing/unlisted payload: '+str(actual^(listed|{'PACKAGE_SHA256.json'})))
baseline=load('rollback/batch10_v1_15/PACKAGE_SHA256_V114.json');require(baseline['version']=='1.14','Wrong rollback identity')
old={row['path']:row for row in baseline['files']};changed=[];images=0;unchanged=0
for name,row in old.items():
 p=ROOT/name;require(p.is_file(),'Baseline file removed: '+name)
 if sha(p)!=row['sha256']:
  require(name in ALLOWED,'Undeclared original change: '+name);changed.append(name)
  q=ROOT/'rollback/batch10_v1_15/original'/name
  require(q.is_file()and q.stat().st_size==row['bytes']and sha(q)==row['sha256'],'Exact rollback original missing: '+name)
 else:
  unchanged+=1
  if name.startswith(('assets/','assemblies/'))and p.suffix.lower()in{'.png','.jpg','.jpeg','.webp'}:images+=1
require(set(changed)==ALLOWED,'Unexpected change scope: '+str(changed));require(images==611,'Original runtime image count changed')
ledger=load('CHANGED_FILES.json');require(ledger['version']=='1.15'and ledger['baseline_version']=='1.14','Wrong change ledger')
expected_changes=(listed-set(old))|set(changed)
expected_changes-={'CHANGED_FILES.json','PACKAGE_SHA256.json'}
require({r['path']for r in ledger['changes']}==expected_changes,'Incomplete changed-file ledger')
for row in ledger['changes']:
 p=ROOT/row['path'];require(p.stat().st_size==row['bytes']and sha(p)==row['after_sha256'],'Change after-hash mismatch: '+row['path'])
 prior=old.get(row['path']);require(row['before_sha256']==(prior['sha256']if prior else None),'Change before-hash mismatch')
 require(row['status']==('modified'if prior else'added'),'Wrong change classification')
batch=load('data/batch10.json');require(batch['ids']==EXPECTED and set(batch['shirts'])==set(EXPECTED),'Unexpected batch identities')
text=(ROOT/'data/batch10.js').read_text();prefix='globalThis.HEWRS_BATCH10='
require(text.startswith(prefix)and json.loads(text[len(prefix):].strip().removesuffix(';'))==batch,'JSON/browser batch mismatch')
require(batch['source_input_sha256']==sha(ROOT/'data/inputs.json'),'Current input identity changed')
for h,path in batch['assetPaths'].items():require(safe(path)and sha(ROOT/path)==h,'Bad new runtime layer: '+path)
require(len(batch['assetPaths'])==71,'Wrong runtime registration count')
for sid,row in batch['shirts'].items():
 require(row['id']==sid and row['history_id']=='shirt-'+sid,'Changed physical/history ID')
 require(sha(ROOT/'provenance/batch10_v1_15'/row['source_file'])==row['source_sha256'],'Source upload changed: '+sid)
 require(len(row['states'])==48,'Wrong state count: '+sid)
source=load('data/non-suit-sources.json');refs=0
for sid,row in source['shirts'].items():
 require(row['id']==sid and row['history_id']=='shirt-'+sid,'Pre-existing ID changed')
 for parts in row['components'].values():
  for d in parts.values():require(sha(ROOT/d['runtime_path'])==d['sha256'],'Current source component changed');refs+=1
require(refs==576,'Current component reference count changed')
new_png=[p for p in listed-set(old)if p.startswith('assets/')and p.endswith('.png')]
require(len(new_png)==72,'Wrong unique new PNG count')
release=load('RELEASE_STATUS.json')
require(release['version']=='1.15'and release['new_non_suit_shirts']==EXPECTED and release['new_non_suit_visual_route_count']==10,'Wrong activation claim')
require(release['connected_non_suit_shirt_count']==12 and release['remaining_non_suit_shirt_count']==38,'Wrong remaining scope')
require(release['complete_product_release']is False and release['shirt_only_numerical_ranking_installed']is False,'Unsupported completion/scoring claim')
require(release['deployment_authorized']is False and release['physical_iphone_safari_certified']is False and release['watch_images_required']is False,'Unsupported release/approval claim')
root='evidence/batch10_v1_15/'
for file,passed in [('FUNCTIONAL.json',24),('BASELINE_FUNCTIONAL.json',21),('browser/RESULT.json',16),('EDGE_BROWSER.json',4)]:
 d=load(root+file);require(d['failed']==0 and d['passed']==passed,'Bad/incomplete evidence: '+file)
browser=load(root+'browser/RESULT.json');reg=browser['baseline_render_regressions']
require(len(reg)==87 and all(v['equal']and v['v115_rgba_sha256']==v['v114_rgba_sha256']for v in reg),'Incomplete/failed frame regression')
require(len(browser['new_render_selections'])==760 and len(browser['additional_all47_blazer_selections'])==47 and not browser['errors'],'Incomplete new browser matrix')
der=load(root+'DERIVATION_CHECKS.json')
require(len(der['shirts'])==20 and all(v['outside_existing_exterior_except_current_upper']==0 and v['unchanged_lower_exterior_alpha']is True for v in der['shirts']),'Failed geometry preservation receipt')
require(der['current_knots_preserved']==47 and der['unique_body_base_images']==18,'Failed knot or source reuse receipt')
origin=load(root+'REAL_ORIGIN.json');require(origin['status']=='BLOCKED_BEFORE_APPLICATION_LOAD'and origin['application_loaded']is False and origin['storage_mocked']is False,'Changed origin evidence boundary')
rollback=load(root+'ROLLBACK.json');require(rollback['status']=='PASS'and rollback['restored_files']==1053 and rollback['browser_data_accessed']is False,'Incomplete rollback test')
# Evidence binding makes a stale test receipt detectable after code/asset edits.
for row in load(root+'TESTED_RUNTIME_SHA256.json')['files']:
 require(sha(ROOT/row['path'])==row['sha256'],'Runtime changed after final tests: '+row['path'])
print(json.dumps({'status':'PASS','package_payload_hashes_verified':len(m['files']),'unchanged_v114_payload_files':unchanged,'declared_original_file_changes':sorted(changed),'original_runtime_images_preserved':images,'current_components':refs,'new_non_suit_ids':10,'connected_non_suit_ids':12,'remaining_non_suit_ids':38,'new_png_files':len(new_png),'new_runtime_image_paths':len(batch['assetPaths']),'test_scope':'Recorded final package/source/functional/Chromium evidence; not hosted, real-origin persistence, Safari/iPhone or complete-product certification'},indent=2))
