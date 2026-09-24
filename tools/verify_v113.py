#!/usr/bin/env python3
"""Read-only V1.13 package, preservation and new-route source checks."""
from pathlib import Path,PurePosixPath
import hashlib,json,sys
R=Path(__file__).resolve().parents[1]
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(2**20),b''):h.update(chunk)
 return h.hexdigest()
def require(x,message):
 if not x:raise AssertionError(message)
def visible(p):return p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc'
def load(file):return json.loads((R/file).read_text())
manifest=load('PACKAGE_SHA256.json'); rows=manifest['files']; listed=set()
for row in rows:
 path=row['path']; parts=PurePosixPath(path)
 require(not parts.is_absolute() and '..' not in parts.parts,'Unsafe manifest path: '+path)
 require(path not in listed,'Duplicate manifest entry: '+path);listed.add(path)
 p=R/path;require(p.is_file(),'Missing payload: '+path)
 require(p.stat().st_size==row['bytes'],'Wrong size: '+path)
 require(digest(p)==row['sha256'],'Wrong hash: '+path)
actual={p.relative_to(R).as_posix()for p in R.rglob('*')if visible(p)}
require(actual==listed|{'PACKAGE_SHA256.json'},'Package inventory differs: '+str(sorted(actual^ (listed|{'PACKAGE_SHA256.json'}))))
baseline=load('evidence/open_collar_v1_13/BASELINE_V1_12.json')
allowed={'README.md','PACKAGE_SHA256.json','data/blazer-connection.json','data/blazer-connection.js','data/shirt-only.json','data/shirt-only.js','src/blazer-connection.js','src/shirt-only-connection.js','src/b01-b02-renderer.js'}
changed=[];protected=0;images=0
for name,expected in baseline.items():
 p=R/name;require(p.is_file(),'Missing prior source: '+name)
 equal=digest(p)==expected
 if not equal:
  require(name in allowed,'Undeclared original-source edit: '+name);changed.append(name)
 else:
  protected+=1
  if name.startswith(('assets/','assemblies/'))and name.endswith('.png'):images+=1
for jf,var in [('data/blazer-connection.json','HEWRS_BLAZER_CONNECTION_DATA'),('data/shirt-only.json','HEWRS_SHIRT_ONLY_DATA')]:
 text=(R/jf.replace('.json','.js')).read_text();prefix='globalThis.'+var+'='
 require(text.startswith(prefix),'Bad data wrapper: '+jf)
 encoded=json.loads(text[len(prefix):].strip().removesuffix(';'))
 require(encoded==load(jf),'JSON/JS data mismatch: '+jf)
b=load('data/blazer-connection.json');s=load('data/shirt-only.json');inp=load('data/inputs.json')
require(b['available_shirts']==['DS001','DS014'],'Unexpected new shirt scope')
require(set(b['available_states'])==set(inp['manifest']['ties'])|{'NO_TIE'},'Wrong blazer mode set')
require(set(s['shirts'])=={'DS001','DS014'}and s['no_tie'] is True,'Wrong shirt-only mode scope')
require(s['numerical_ranking'] is False,'Unspecified shirt-only ranker activated')
require(len(b['blazers'])==14,'Missing existing blazer identity')
require(digest(R/'data/inputs.json')==baseline['data/inputs.json'],'Original score/source lock changed')
asset=b['assembly']['no_tie'];file=R/b['assetPaths'][asset['sha256']]
require(digest(file)==asset['sha256'],'Wrong new full-shirt image')
from PIL import Image
im=Image.open(file);im.load();require(im.size==(996,2748)and im.mode=='RGBA','Wrong image geometry')
for sid in ['DS001','DS014']:
 require(s['shirts'][sid]['layers']['NO_TIE']['sha256']==asset['sha256'],'Unbound open collar: '+sid)
for mode in ['no_tie','tied']:
 for key,d in inp['manifest']['shirts']['DS001']['states'][mode].items():
  require(d['sha256']==inp['manifest']['shirts']['DS014']['states'][mode][key]['sha256'],'Unproven shared component')
print(json.dumps({'payload_hashes_passed':len(rows),'old_files_preserved':protected,'old_asset_and_assembly_images_preserved':images,'declared_old_file_changes':sorted(changed),'checks':'PASS','source_lock':'UNCHANGED','new_derivative_sha256':asset['sha256'],'certifies':'Package/source integrity and stated routing metadata, not physical-device appearance or complete product release'}))
