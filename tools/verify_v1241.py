#!/usr/bin/env python3
"""Read-only release/source/deployment verifier. Python standard library only."""
from pathlib import Path
import argparse,ast,base64,hashlib,json,re,sys
R=Path(__file__).resolve().parents[1]
def digest(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def require(ok,message):
 if not ok:raise ValueError(message)
def verify(root=R,runtime_only=False,strict_extras=False):
 root=Path(root).resolve();m=json.loads((root/'PACKAGE_SHA256.json').read_text());require(m.get('version')=='1.24.1-b15','Not the 1.24.1 B15 release manifest')
 rows=m['files'];by={e['path']:e for e in rows};require(len(by)==len(rows),'Duplicate manifest paths')
 required=set(json.loads((root/'RUNTIME_REQUIRED.json').read_text())['paths']) if runtime_only else set(by)
 for rel in sorted(required):
  require(rel in by,'Unmanifested dependency '+rel);p=root/rel;require(not p.is_symlink() and p.is_file(),'Missing or symlinked file '+rel);e=by[rel];require(p.stat().st_size==e['bytes'] and digest(p)==e['sha256'],'Wrong bytes: '+rel)
 if strict_extras:
  actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and '.git' not in p.relative_to(root).parts and '__pycache__' not in p.parts}
  require(actual==set(by)|{'PACKAGE_SHA256.json'},'Unexpected or missing files: '+repr(sorted(actual^(set(by)|{'PACKAGE_SHA256.json'}))[:30]))
 startup=json.loads((root/'STARTUP_RESOURCES.json').read_text());paths=startup['script_order'];tree=ast.parse((root/'tools/build.py').read_text());scripts=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SCRIPTS' for t in n.targets));require(paths==scripts,'Build/source dependency order differs')
 included=[x for x in scripts if x not in {'src/runtime-loader.js','data/inputs.js','data/option-index.js'}];require(included==startup['bundle_sources'],'Bundle dependency list differs')
 code='/* HEWRS V1.24.1 new B15 blazer startup bundle; generated from tools/build.py. */\n'
 for rel in included:code+='\n/* SOURCE: '+rel+' */\n'+(root/rel).read_text()+'\n;\n'
 h=hashlib.sha256(code.encode()).hexdigest();bundle='runtime/hewrs-'+h[:20]+'.js';require(startup['startup_scripts']==['src/runtime-loader.js','data/inputs.js',bundle],'Wrong startup scripts');require((root/bundle).read_bytes()==code.encode(),'Bundle is not generated from supplied sources')
 for rel,row in startup['resource_integrity'].items():require(digest(root/rel)==row['sha256'] and (root/rel).stat().st_size==row['bytes'],'Startup hash mismatch '+rel)
 sri=lambda p:'sha256-'+base64.b64encode(bytes.fromhex(digest(root/p))).decode()
 loader='src/runtime-loader.js';inputs='data/inputs.js';index='data/option-index.js'
 tags=[f'<script defer src="{loader}?v={digest(root/loader)[:16]}" integrity="{sri(loader)}" data-boot="true" data-engine-index="{index}?v={digest(root/index)[:16]}" data-engine-integrity="{sri(index)}"></script>',f'<script defer src="{inputs}?v={digest(root/inputs)[:16]}" integrity="{sri(inputs)}"></script>',f'<script defer src="{bundle}" integrity="{sri(bundle)}"></script>']
 html=(root/'app.template.html').read_text().replace('<!--STYLE-->','<link rel="stylesheet" href="src/application.css?v='+digest(root/'src/application.css')[:16]+'">').replace('<!--SCRIPTS-->','\n'.join(tags))
 require((root/'index.html').read_text()==html and (root/'app.html').read_text()==html,'Entrypoints are not generated from current template/source hashes')
 protected=json.loads((root/'provenance/new_blazer_B15_v1_24_1/PROTECTED_INPUTS.json').read_text())
 for rel,h in protected.items():require(digest(root/rel)==h,'Protected original image/data changed '+rel)
 registry=json.loads((root/'data/option-card-thumbnails.json').read_text());active=set()
 def walk(v):
  if isinstance(v,dict):
   if isinstance(v.get('src'),str) and v['src'].startswith('ui/option-cards/'):
    require(v['src'].endswith(v['sha256']+'.png'),'Thumbnail descriptor mismatch');require(digest(root/v['src'])==v['sha256'],'Thumbnail bytes mismatch');active.add(v['src'])
   for value in v.values():walk(value)
  elif isinstance(v,list):
   for value in v:walk(value)
 walk(registry);require(len(active)==174,'Wrong inherited thumbnail coverage')
 additional=json.loads((root/'data/additional-blazers.json').read_text());walk(additional)
 require(len(active)==175,'Wrong new thumbnail coverage')
 for item in additional['records']:
  binding=item['binding'];photo=binding['sourcePhoto'];require(digest(root/photo['path'])==photo['sha256'],'Changed owner photo')
  layer=binding['assembly']['jacket'];require(digest(root/layer['url'])==layer['sha256'],'Changed B15 source registration')
 require([x['binding']['id'] for x in additional['records']]==['B15'],'New item identity differs')
 return {'passed':True,'version':m['version'],'verified_files':len(required),'manifest_payloads':len(rows),'protected_image_data_files':len(protected),'active_thumbnails':len(active),'source_generated_bundle':bundle,'startup_scripts':3,'runtime_only':runtime_only,'strict_extras':strict_extras}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--app',type=Path,default=R);p.add_argument('--runtime-only',action='store_true');p.add_argument('--strict-extras',action='store_true');a=p.parse_args()
 try:print(json.dumps(verify(a.app,a.runtime_only,a.strict_extras),indent=2))
 except Exception as e:print('VERIFICATION FAILED: '+str(e),file=sys.stderr);sys.exit(1)
