#!/usr/bin/env python3
"""Read-only package, original-source and profile-binding verification."""
from pathlib import Path, PurePosixPath
import hashlib,json,sys
R=Path(__file__).resolve().parents[1]
ALLOWED={'PACKAGE_SHA256.json','README.md','app.html','app.template.html','tools/build.py','src/application.js','src/blazer-connection.js','src/controller.js','src/connection.js'}
SOURCE_SHA='538cdf147e1af4c83c88a5b7bfbc6cf9bc5128b6461200be3ea01588348cb960'
def require(ok,msg):
 if not ok:raise ValueError(msg)
def path(name):
 p=PurePosixPath(name);require(not p.is_absolute() and '..' not in p.parts and '\\' not in name,'Unsafe path')
 f=R.joinpath(*p.parts);require(f.is_file() and not f.is_symlink() and f.resolve().is_relative_to(R.resolve()),'Missing/unsafe path: '+name);return f
def sha(f):
 with f.open('rb') as h:return hashlib.file_digest(h,'sha256').hexdigest()
def main():
 manifest=json.loads(path('PACKAGE_SHA256.json').read_text());require(manifest['schema']=='hewrs.package.sha256.v1','Wrong manifest')
 seen=set()
 for row in manifest['files']:
  name=row['path'];require(name not in seen and name!='PACKAGE_SHA256.json','Duplicate/self hash');seen.add(name);f=path(name)
  require(f.stat().st_size==row['bytes'] and sha(f)==row['sha256'],'File identity differs: '+name)
 actual={f.relative_to(R).as_posix() for f in R.rglob('*') if f.is_file() and '__pycache__' not in f.parts and f.name!='PACKAGE_SHA256.json'}
 # Only the root manifest is omitted (nested manifests are normal payload files).
 actual={f.relative_to(R).as_posix() for f in R.rglob('*') if f.is_file() and '__pycache__' not in f.parts and f!=R/'PACKAGE_SHA256.json'}
 require(actual==seen,'Missing/extra payloads: '+str(sorted(actual^seen)))
 baseline=json.loads(path('evidence/profiles_v1_8/BASELINE_V1_7.json').read_text());changed=[];images=0
 for name,h in baseline.items():
  current=sha(path(name))
  if current!=h:require(name in ALLOWED,'Unauthorized baseline change: '+name);changed.append(name)
  if name.startswith(('assets/','assemblies/')) and name.endswith('.png'):
   require(current==h,'Original image changed: '+name);images+=1
 for name in ['data/inputs.json','data/inputs.js','data/blazer-connection.json','data/blazer-connection.js','src/local-state.js','src/blazer-renderer.js','src/mixed-renderer.js','src/atomic-renderer.js','src/ds035-edge-renderer.js','src/ds035-coverage-renderer.js','vendor/ensemble-completion.js','vendor/hewrs-logic.js','vendor/approved-scores.js']:
  require(sha(path(name))==baseline[name],'Protected source changed: '+name)
 source_path='evidence/profiles_v1_8/source/HEWRS_Trouser_Profile_Bindings.json'
 require(sha(path(source_path))==SOURCE_SHA,'Recovered source differs from original recorded identity')
 source=json.loads(path(source_path).read_text());js=path('data/trouser-profiles.js').read_text();prefix='globalThis.HEWRS_TROUSER_PROFILE_SOURCE='
 decoder=json.JSONDecoder();bundle,end=decoder.raw_decode(js.split(prefix,1)[1]);require(bundle==source,'Profile source/bundle mismatch')
 require("globalThis.HEWRS_TROUSER_PROFILE_SOURCE_SHA256="+json.dumps(SOURCE_SHA)+';' in js,'Missing source binding identity')
 data=json.loads(path('data/blazer-connection.json').read_text());ids=set()
 for row in source['records']:
  k=row['physical_id'];require(k in data['pants'] and k not in ids,'Unknown/duplicate physical ID');ids.add(k);p=data['pants'][k]
  require(row['app_id']==p['historyId'] and row['asset_sha256']==p['layer']['sha256'],'Profile points to another garment')
  require(sha(path(p['layer']['url']))==row['asset_sha256'],'Wrong original trouser image')
 require(ids==set(data['pants']) and len(ids)==24,'Physical IDs not preserved')
 require(sum(x['profile_id'] is not None for x in source['records'])==15 and source['production_approval'] is False,'Scope changed')
 require(not (R/'index.html').exists(),'Unexpected production entry point')
 print(json.dumps({'status':'PASS','payload_hashes':len(seen),'baseline_files':len(baseline),'changed_baseline_files':sorted(changed),'unchanged_baseline_files':len(baseline)-len(changed),'original_images_preserved':images,'profile_source_sha256':SOURCE_SHA,'source_profile_rows':24,'existing_local_bindings':15,'null_profiles_preserved':9,'source_lock_and_storage_code_unchanged':True,'scope':'File/source identity checks only; functional/browser checks reported separately'},indent=2))
if __name__=='__main__':
 try:main()
 except (ValueError,KeyError,OSError,TypeError) as e:print(json.dumps({'status':'FAIL','error':str(e)}),file=sys.stderr);raise SystemExit(1)
