#!/usr/bin/env python3
"""Read-only V1.11 package and UI-only preservation verification."""
from pathlib import Path,PurePosixPath
import hashlib,json,re,sys
R=Path(__file__).resolve().parents[1]
ALLOWED={'README.md','PACKAGE_SHA256.json','app.template.html','app.html','index.html','src/application.css','src/application.js','tools/build.py'}
def need(v,m):
 if not v:raise ValueError(m)
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def f(name):
 n=PurePosixPath(name);need(not n.is_absolute() and '..' not in n.parts and '\\' not in name,'Unsafe path: '+name)
 p=R.joinpath(*n.parts);need(p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(R.resolve()),'Missing/unsafe file: '+name);return p
def main():
 m=json.loads(f('PACKAGE_SHA256.json').read_text());need(m['schema']=='hewrs.package.sha256.v1','Unexpected manifest');seen=set()
 for row in m['files']:
  name=row['path'];need(name not in seen and name!='PACKAGE_SHA256.json','Duplicate/self hash');seen.add(name);p=f(name);need(p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],'Payload mismatch: '+name)
 actual={p.relative_to(R).as_posix() for p in R.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name!='.DS_Store' and p!=R/'PACKAGE_SHA256.json'}
 need(actual==seen,'Unlisted/missing files: '+str(sorted(actual^seen)))
 b=json.loads(f('evidence/facelift_v1_11/BASELINE_V1_10.json').read_text());changed=[];protected=0;images=0
 for name,h in b['files'].items():
  current=sha(f(name))
  if current!=h:need(name in ALLOWED,'Unscoped baseline change: '+name);changed.append(name)
  if name not in ALLOWED:need(current==h,'Protected source changed: '+name);protected+=1
  if name.startswith(('assets/','assemblies/')) and name.endswith('.png'):need(current==h,'Original image changed: '+name);images+=1
 old_images={n for n in b['files'] if n.startswith(('assets/','assemblies/'))};new_images={n for n in seen if n.startswith(('assets/','assemblies/'))}
 need(old_images==new_images,'Image asset set changed')
 for name in ['data/inputs.js','data/inputs.json','src/controller.js','src/connection.js','src/blazer-connection.js','src/shirt-only-connection.js','src/atomic-renderer.js','src/mixed-renderer.js','src/local-state.js','vendor/hewrs-logic.js','vendor/ensemble-completion.js','vendor/active50-renderer.js','src/ds035-edge-renderer.js','src/ds035-coverage-renderer.js']:
  need(sha(f(name))==b['files'][name],'Protected runtime mismatch: '+name)
 for name in ['src/application.js','src/application.css','app.template.html','app.html','index.html','tools/build.py','README.md']:
  need(sha(f('rollback/facelift_v1_11/'+name))==b['files'][name],'Rollback mismatch: '+name)
 need(f('app.html').read_bytes()==f('index.html').read_bytes(),'Entry points differ')
 html=f('index.html').read_text();need('HEWRS · Connected application V1.11' in html,'Wrong entry point version');need('<iframe' not in html.lower(),'Prototype iframe imported')
 paths=re.findall(r'<script src="([^"]+)"',html)+re.findall(r'<link[^>]+href="([^"]+)"',html)
 for name in paths:f(name)
 need(paths.count('src/facelift-state.js')==1 and paths.count('src/application.js')==1,'Duplicate/absent UI initializer')
 need(not any(p.suffix.lower() in {'.ttf','.otf','.woff','.woff2'} for p in R.rglob('*') if p.is_file()),'Font binaries present')
 print(json.dumps({'status':'PASS','payload_hashes':len(seen),'baseline_files':len(b['files']),'protected_baseline_files':protected,'original_image_files_preserved':images,'changed_original_paths':sorted(changed),'new_garment_assets':0,'entry_script_and_stylesheet_paths':len(paths),'storage_and_score_sources_byte_identical':True,'scope':'Package and source identity; not hosted, iPhone/Safari or full-product completion'},indent=2))
if __name__=='__main__':
 try:main()
 except Exception as e:print(json.dumps({'status':'FAIL','error':str(e)}),file=sys.stderr);raise SystemExit(1)
