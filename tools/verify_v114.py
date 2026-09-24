#!/usr/bin/env python3
"""Read-only V1.14 package, source preservation, registry and release-boundary checks.
Standard library only; no image generation, localStorage, network or deployment.
"""
from pathlib import Path,PurePosixPath
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
def sha(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for chunk in iter(lambda:f.read(2**20),b''):h.update(chunk)
 return h.hexdigest()
def require(x,message):
 if not x:raise AssertionError(message)
def visible(p):return p.is_file()and'__pycache__'not in p.parts and p.suffix!='.pyc'
def load(name):return json.loads((ROOT/name).read_text())
m=load('PACKAGE_SHA256.json');require(m['version']=='1.14','Different package version')
listed=set()
for row in m['files']:
 name=row['path'];p=PurePosixPath(name)
 require(not p.is_absolute()and'..'not in p.parts and name not in listed,'Unsafe/duplicate package path')
 listed.add(name);f=ROOT/name
 require(f.is_file()and f.stat().st_size==row['bytes']and sha(f)==row['sha256'],'Payload mismatch: '+name)
actual={p.relative_to(ROOT).as_posix()for p in ROOT.rglob('*')if visible(p)}
require(actual==listed|{'PACKAGE_SHA256.json'},'Unlisted or missing package payload: '+str(actual^(listed|{'PACKAGE_SHA256.json'})))
base=load('rollback/source_routes_v1_14/PACKAGE_SHA256_V113.json')['files']
allowed={'README.md','RELEASE_STATUS.json','app.html','index.html','tools/build.py'}
changed=[];unchanged=0;images=0
for x in base:
 name=x['path'];p=ROOT/name;require(p.is_file(),'Deleted baseline file: '+name)
 if sha(p)!=x['sha256']:
  require(name in allowed,'Unexpected preexisting source change: '+name);changed.append(name)
  q=ROOT/'rollback/source_routes_v1_14/original'/name
  require(q.is_file()and sha(q)==x['sha256'],'Missing exact rollback original: '+name)
 else:
  unchanged+=1
  if name.startswith(('assets/','assemblies/'))and p.suffix in {'.png','.jpg','.jpeg','.webp'}:images+=1
require(set(changed)==allowed,'Unexpected changed-file scope')
require(images==611,'Runtime image preservation count changed')
source=load('data/non-suit-sources.json')
prefix='globalThis.HEWRS_NON_SUIT_SOURCES='
text=(ROOT/'data/non-suit-sources.js').read_text();require(text.startswith(prefix),'Bad registry wrapper')
require(json.loads(text[len(prefix):].strip().removesuffix(';'))==source,'Registry JSON/JS mismatch')
require(source['source_input_sha256']==sha(ROOT/'data/inputs.json'),'Input source lock changed')
require(source['counts']=={'identities':50,'assembly_groups':44,'existing_full_shirt_ids':2,'source_component_only_ids':48,'current_component_references':576,'newly_connected_visual_ids':0},'Unsupported coverage claim')
refs=0
for sid,x in source['shirts'].items():
 require(x['id']==sid and x['history_id']=='shirt-'+sid,'Changed physical/history ID')
 for parts in x['components'].values():
  for d in parts.values():
   require(sha(ROOT/d['runtime_path'])==d['sha256'],'Component hash mismatch');refs+=1
require(refs==576,'Wrong component inventory')
release=load('RELEASE_STATUS.json')
require(release['complete_product_release']is False and release['new_non_suit_visual_route_count']==0 and release['remaining_non_suit_shirt_count']==48,'False clothing completion claim')
require(release['shirt_only_numerical_ranking_installed']is False and release['deployment_authorized']is False,'Changed release authorization or numerical policy')
# The file-change ledger excludes itself and the self-referential package manifest.
changes=load('CHANGED_FILES.json')
for row in changes['changes']:
 p=ROOT/row['path'];require(sha(p)==row['after_sha256'],'Change ledger after-hash mismatch: '+row['path'])
for filename in ['FUNCTIONAL.json','BASELINE_FUNCTIONAL.json','browser/RESULT.json']:
 result=load('evidence/source_routes_v1_14/'+filename);require(result['failed']==0,'Packaged functional/browser failure: '+filename)
print(json.dumps({'status':'PASS','package_payload_hashes_verified':len(m['files']),'unchanged_v113_payload_files':unchanged,'declared_existing_file_changes':sorted(changed),'original_runtime_images_preserved':images,'current_component_references_verified':refs,'new_non_suit_visual_ids':0,'source_lock_and_storage_schema':'UNCHANGED','certifies':'Package/source integrity and supplied test receipt; not hosted/device/restart persistence or clothing completion'}))
