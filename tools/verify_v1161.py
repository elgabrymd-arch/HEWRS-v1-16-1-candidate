#!/usr/bin/env python3
"""Verify V1.16.1 package, protected sources, runtime identity and bound receipts.
Read-only; standard library; no network, browser profile, deployment or storage.
Historical verifiers stay in the archive for their respective older releases.
"""
from pathlib import Path, PurePosixPath
import json,hashlib
R=Path(__file__).resolve().parents[1]
E=R/'evidence/release_v1_16_1'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(2**20),b''):h.update(b)
 return h.hexdigest()
def need(ok,msg):
 if not ok:raise AssertionError(msg)
def load(p):return json.loads((R/p).read_text())
def safe(s):
 p=PurePosixPath(s);return not p.is_absolute() and '..' not in p.parts and '\\' not in s
m=load('PACKAGE_SHA256.json');need(m['version']=='1.16.1','Wrong release version')
listed={}
for row in m['files']:
 name=row['path'];need(safe(name) and name not in listed,'Unsafe or repeated payload path');listed[name]=row
 p=R/name;need(p.is_file() and p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],'Payload hash mismatch: '+name)
actual={p.relative_to(R).as_posix() for p in R.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc'}
need(actual==set(listed)|{'PACKAGE_SHA256.json'},'Unlisted or missing payloads: '+str(actual^(set(listed)|{'PACKAGE_SHA256.json'})))
baseline=json.loads((E/'BASELINE_V116_FILES.json').read_text())['files']
images=0
for name,row in baseline.items():
 p=R/name
 if name.startswith(('assets/','assemblies/')) and p.suffix.lower() in ['.png','.webp','.jpeg','.jpg']:
  need(p.is_file() and sha(p)==row['sha256'],'Previously connected image changed: '+name);images+=1
 if not p.exists() or sha(p)!=row['sha256']:
  saved=(R/'rollback/release_v1_16_1/cache_bytes'/(row['sha256']+'.bin')) if '__pycache__' in Path(name).parts or Path(name).suffix=='.pyc' else R/'rollback/release_v1_16_1/original'/name
  need(saved.is_file() and sha(saved)==row['sha256'],'Missing exact rollback bytes: '+name)
need(images==699,'Wrong original image preservation count')
old_runtime_images={n for n in baseline if n.startswith(('assets/','assemblies/')) and Path(n).suffix.lower() in ['.png','.jpg','.jpeg','.webp']}
need({n for n in actual if n.startswith(('assets/','assemblies/')) and Path(n).suffix.lower() in ['.png','.jpg','.jpeg','.webp']}==old_runtime_images,'Unexpected new or removed runtime image')
d=load('data/batch10.json');expected=['DS004','DS005','DS007','DS015','DS018','DS019','DS023','DS024','DS025','DS047','DS002','DS006','DS008','DS021','DS022','DS027']
need(d['ids']==expected and len(d['shirts'])==16,'Changed ordered source identities')
need(d['source_input_sha256']==sha(R/'data/inputs.json'),'Changed input/source lock')
s=(R/'data/batch10.js').read_text();prefix='globalThis.HEWRS_BATCH10='
need(s.startswith(prefix) and json.loads(s[len(prefix):].strip().removesuffix(';'))==d,'JSON/browser registry disagreement')
for id,row in d['shirts'].items():
 need(row['id']==id and row['history_id']=='shirt-'+id and len(row['states'])==48,'Changed physical ID or supported state')
 need(sha(R/'provenance/batch16_v1_16'/row['source_file'])==row['source_sha256'],'Changed uploaded source: '+id)
for h,p in d['assetPaths'].items():need(safe(p) and sha(R/p)==h,'Unbound source registration: '+p)
refs=0
for row in load('data/non-suit-sources.json')['shirts'].values():
 for parts in row['components'].values():
  for desc in parts.values():need(sha(R/desc['runtime_path'])==desc['sha256'],'Changed current insert or collar');refs+=1
need(refs==576,'Wrong current component count')
release=load('RELEASE_STATUS.json')
need(release['version']=='1.16.1' and release['connected_non_suit_shirt_count']==18 and release['remaining_non_suit_shirt_count']==32,'False completion count')
need(release['new_visual_ids_this_release']==0 and release['runtime_images_modified']==0,'Incorrect increment scope')
need(not release['complete_product_release'] and not release['shirt_only_numerical_ranking_installed'] and not release['deployment_authorized'] and not release['physical_iphone_safari_certified'],'Unsupported release claim')
for f,count in [('FUNCTIONAL.json',27),('EDGE_BROWSER.json',4)]:
 result=json.loads((E/f).read_text());need(result['failed']==0 and result['passed']==count,'Incomplete evidence: '+f)
browser=json.loads((E/'browser/RESULT.json').read_text());need(browser['failed']==0 and browser['passed']>=16 and not browser['errors'],'Browser checks incomplete')
reg=browser['baseline_render_regressions'];need(len(reg)==127 and all(x['equal'] and x['v1161_rgba_sha256']==x['v115_rgba_sha256'] for x in reg),'Old-frame regression not demonstrated')
need(len(browser['new_render_selections'])==456 and len(browser['additional_all47_blazer_selections'])==276,'Incomplete six-shirt matrix')
need(browser['render_exercises']==732,'Wrong new render count')
origin=json.loads((E/'REAL_ORIGIN.json').read_text());need(origin['status']=='BLOCKED_BEFORE_APPLICATION_LOAD' and not origin['application_loaded'] and not origin['storage_mocked'],'Misrepresented origin scope')
rollback=json.loads((E/'ROLLBACK.json').read_text());need(rollback['status']=='PASS' and rollback['restored_files']==len(baseline) and not rollback['browser_data_accessed'],'Rollback test not complete')
for row in json.loads((E/'TESTED_RUNTIME_SHA256.json').read_text())['files']:
 need(sha(R/row['path'])==row['sha256'],'Runtime drift since the recorded tests: '+row['path'])
ledger=load('CHANGED_FILES.json');need(ledger['version']=='1.16.1','Stale changed-file ledger')
for row in ledger['changes']:
 name=row['path'];old=baseline.get(name);need(row['before_sha256']==(old['sha256'] if old else None),'Wrong before hash')
 p=R/name
 need((not p.exists()) if row['status']=='removed' else p.is_file() and sha(p)==row['after_sha256'],'Wrong changed-file after hash: '+name)
expected_changes={n for n in set(baseline)|actual if n not in {'CHANGED_FILES.json','PACKAGE_SHA256.json'} and (n not in baseline or n not in actual or sha(R/n)!=baseline[n]['sha256'])}
need(expected_changes=={x['path'] for x in ledger['changes']},'Incomplete changed-file list')
print(json.dumps({'status':'PASS','payload_files_verified':len(listed),'runtime_images_preserved':images,'current_component_references':refs,'connected_non_suit_ids':18,'remaining_gated_ids':32,'new_visual_ids_in_this_correction':0,'regression_frames':127,'new_six_shirt_render_exercises':732,'browser_scope':'in-memory Chromium; not real-origin persistence, restart or physical iPhone/Safari'},indent=2))
