#!/usr/bin/env python3
"""Read-only package/source preservation checks for the B01/B02 addition."""
from pathlib import Path,PurePosixPath
import hashlib,json,re,sys
R=Path(__file__).resolve().parents[1]
ALLOWED={'README.md','PACKAGE_SHA256.json','app.template.html','app.html','index.html','tools/build.py','data/blazer-connection.json','data/blazer-connection.js'}
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def need(ok,m):
 if not ok:raise ValueError(m)
def file(name):
 p=PurePosixPath(name);need(not p.is_absolute() and '..' not in p.parts and '\\' not in name,'Unsafe path')
 f=R.joinpath(*p.parts);need(f.is_file() and not f.is_symlink() and f.resolve().is_relative_to(R.resolve()),'Missing/unsafe '+name);return f
def main():
 m=json.loads(file('PACKAGE_SHA256.json').read_text());need(m['schema']=='hewrs.package.sha256.v1','Wrong manifest');seen=set()
 for row in m['files']:
  name=row['path'];need(name not in seen and name!='PACKAGE_SHA256.json','Duplicate/self manifest');seen.add(name);p=file(name);need(sha(p)==row['sha256'] and p.stat().st_size==row['bytes'],'Payload mismatch: '+name)
 actual={p.relative_to(R).as_posix() for p in R.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name!='.DS_Store' and p != R/'PACKAGE_SHA256.json'}
 need(actual==seen,'Unlisted/missing payloads: '+str(sorted(actual^seen)))
 b=json.loads(file('evidence/b01_b02_v1_12/BASELINE_V1_11.json').read_text());protected=0;images=0;changed=[]
 for name,h in b['files'].items():
  current=sha(file(name))
  if current!=h:need(name in ALLOWED,'Unexpected baseline change: '+name);changed.append(name)
  if name not in ALLOWED:need(current==h,'Protected file changed');protected+=1
  if name.startswith(('assets/','assemblies/')) and name.endswith('.png'):need(current==h,'Original image changed');images+=1
 d=json.loads(file('data/blazer-connection.json').read_text());literal=file('data/blazer-connection.js').read_text();need(json.loads(literal.split('=',1)[1].strip().removesuffix(';'))==d,'JS/JSON binding mismatch')
 need(len(d['blazers'])==14 and all(x['availability']=='CONNECTED' for x in d['blazers'].values()),'Blazer routes incomplete')
 rep=json.loads(file('evidence/b01_b02_v1_12/DERIVATION.json').read_text())
 for x in rep['sources']:
  new=x['output'];id=x['id'];need(sha(file(new['url']))==new['sha256'],'Derived layer hash mismatch');need(d['blazers'][id]['assembly']['jacket']==new,'Wrong appearance binding');need(x['alpha_pixels_changed']==0 and x['original_alpha_sha256']==x['output_alpha_sha256'],'Frozen alpha mismatch');need(x['max_edge_resample_distance_px']<30,'Excessive boundary extension')
 for n,h in d['assetPaths'].items():need(sha(file(h))==n,'Blazer asset unresolved '+h)
 need(file('index.html').read_bytes()==file('app.html').read_bytes(),'Entry mismatch');text=file('index.html').read_text();need('V1.12' in text,'Wrong entry version')
 for name in re.findall(r'<script src="([^"]+)"',text)+re.findall(r'<link[^>]+href="([^"]+)"',text):file(name)
 need(text.count('src/b01-b02-renderer.js')==1,'Missing/duplicate new renderer adapter')
 need(not any(p.suffix.lower() in {'.ttf','.otf','.woff','.woff2'} for p in R.rglob('*') if p.is_file()),'Font binaries present')
 print(json.dumps({'status':'PASS','payload_hashes':len(seen),'baseline_files':len(b['files']),'protected_baseline_files':protected,'original_image_files_preserved':images,'changed_original_paths':sorted(changed),'new_coat_appearance_derivatives':2,'original_geometry_images_unchanged':True,'scope':'Package/source identity; not complete product or physical-device certification'},indent=2))
if __name__=='__main__':
 try:main()
 except Exception as e:print(json.dumps({'status':'FAIL','error':str(e)}),file=sys.stderr);raise SystemExit(1)
