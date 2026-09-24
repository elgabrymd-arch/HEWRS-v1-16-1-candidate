#!/usr/bin/env python3
"""Read-only V1.10 package, source preservation and exact new-route verification."""
from pathlib import Path,PurePosixPath
import json,hashlib,sys
R=Path(__file__).resolve().parents[1]
ALLOWED={'PACKAGE_SHA256.json','README.md','index.html','app.html','app.template.html','tools/build.py','src/mixed-renderer.js','src/local-state.js','src/application.js'}
def need(ok,msg):
 if not ok:raise ValueError(msg)
def f(name):
 p=PurePosixPath(name);need(not p.is_absolute() and '..' not in p.parts and '\\' not in name,'Unsafe path '+name)
 x=R.joinpath(*p.parts);need(x.is_file() and not x.is_symlink() and x.resolve().is_relative_to(R.resolve()),'Missing/unsafe file '+name);return x
def sha(p):
 with p.open('rb') as h:return hashlib.file_digest(h,'sha256').hexdigest()
def main():
 manifest=json.loads(f('PACKAGE_SHA256.json').read_text());need(manifest['schema']=='hewrs.package.sha256.v1','Wrong schema');seen=set()
 for row in manifest['files']:
  name=row['path'];need(name not in seen and name!='PACKAGE_SHA256.json','Duplicate/self hash');seen.add(name);p=f(name);need(p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],'Changed payload '+name)
 actual={x.relative_to(R).as_posix() for x in R.rglob('*') if x.is_file() and '__pycache__' not in x.parts and x!=R/'PACKAGE_SHA256.json'}
 need(actual==seen,'Missing/extra package paths '+str(sorted(actual^seen)))
 baseline=json.loads(f('evidence/shirt_only_v1_10/BASELINE_V1_9.json').read_text());changed=[];image_count=0
 for name,h in baseline.items():
  value=sha(f(name))
  if value!=h:need(name in ALLOWED,'Unscoped original modification '+name);changed.append(name)
  if name.startswith(('assets/','assemblies/')) and name.endswith('.png'):need(value==h,'Original image changed '+name);image_count+=1
 old_assets={name for name in baseline if name.startswith(('assets/','assemblies/'))}
 new_assets={name for name in seen if name.startswith(('assets/','assemblies/'))}
 need(old_assets==new_assets,'Garment asset set changed')
 for name in ['data/inputs.json','data/inputs.js','data/blazer-connection.json','data/blazer-connection.js','src/controller.js','src/connection.js','src/blazer-connection.js','src/blazer-renderer.js','src/atomic-renderer.js','src/suit-assemblies.js','vendor/active50-renderer.js','vendor/hewrs-logic.js','vendor/ensemble-completion.js','vendor/approved-scores.js','data/trouser-profiles.js','src/trouser-profiles.js','src/ds035-edge-renderer.js','src/ds035-coverage-renderer.js']:
  need(sha(f(name))==baseline[name],'Protected source changed '+name)
 data=json.loads(f('data/shirt-only.json').read_text());bundle=f('data/shirt-only.js').read_text();parsed,_=json.JSONDecoder().raw_decode(bundle.split('globalThis.HEWRS_SHIRT_ONLY_DATA=',1)[1]);need(parsed==data,'JS/JSON new source contracts differ')
 b=json.loads(f('data/blazer-connection.json').read_text());p=json.loads(f('data/inputs.json').read_text());need(list(data['shirts'])==['DS001'],'Wrong shirt-only universe');need(data['states']==list(b['assembly']['ties']),'Wrong tied state universe')
 need(data['shirts']['DS001']['layers']==b['assembly']['ties'],'Not the existing full-shirt layer set');need(data['shirts']['DS001']['hands']==b['assembly']['hands'],'Hand source changed');need(data['avatar']==p['manifest']['static']['avatar'],'Avatar changed')
 need(data['no_tie'] is False and data['numerical_ranking'] is False,'Unsupported mode enabled')
 need(sha(f('vendor/shirt-only-v1_10/mixed-renderer_v19.js'))==baseline['src/mixed-renderer.js'],'Original-render comparator not exact')
 need(f('index.html').read_bytes()==f('app.html').read_bytes(),'Index differs from app')
 print(json.dumps({'status':'PASS','payload_hashes':len(seen),'baseline_files':len(baseline),'original_image_files_preserved':image_count,'changed_original_paths':sorted(changed),'new_asset_files':0,'source_inputs_and_storage_lock_preserved':True,'scope':'Package/source identity, not hosted or physical-device certification'},indent=2))
if __name__=='__main__':
 try:main()
 except (ValueError,TypeError,KeyError,OSError) as e:print(json.dumps({'status':'FAIL','error':str(e)}),file=sys.stderr);raise SystemExit(1)
