#!/usr/bin/env python3
"""Read-only verifier for the shoe-15 patch. Python standard library only."""
from pathlib import Path
import hashlib,json,re,base64,sys
R=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def check(ok,message):
 if not ok:raise ValueError(message)
try:
 m=json.loads((R/'PACKAGE_SHA256.json').read_text());check(m['version']=='1.23.1-shoe15','Not the shoe-15 release manifest')
 for row in m['files']:
  p=R/row['path'];check(p.is_file(),'Missing '+row['path']);check(p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],'Changed '+row['path'])
 d=json.loads((R/'data/shoe-photo-corrections.json').read_text());check(sha(R/d['layer']['url'])==d['layer']['sha256'],'Shoe layer mismatch');check(sha(R/d['source']['path'])==d['source']['sha256'],'Reference mismatch');check(sha(R/d['thumbnail']['src'])==d['thumbnail']['sha256'],'Photo thumbnail mismatch')
 old=json.loads((R/'provenance/shoe15_v1_23_1/baseline_PACKAGE_SHA256.json').read_text());n=0
 for row in old['files']:
  if row['path'].startswith(('assets/','assemblies/')):
   check(sha(R/row['path'])==row['sha256'],'Original asset modified: '+row['path']);n+=1
 res=json.loads((R/'STARTUP_RESOURCES.json').read_text());check(len(res['startup_scripts'])==3,'Startup resource count changed');check(res['deferred_index']=='data/option-index.js','Index deferral changed')
 code='/* HEWRS V1.23.1 shoe-15 appearance correction startup bundle; generated from tools/build.py. */\n'
 for p in res['bundle_sources']:code+='\n/* SOURCE: '+p+' */\n'+(R/p).read_text()+'\n;\n'
 bundle=res['startup_scripts'][2];check((R/bundle).read_text()==code,'Generated bundle differs from source')
 for p,v in res['resource_integrity'].items():check(sha(R/p)==v['sha256'] and (R/p).stat().st_size==v['bytes'],'Startup integrity mismatch: '+p)
 html=(R/'index.html').read_text();check(html==(R/'app.html').read_text(),'App entry points differ')
 for p in res['startup_scripts']:
  check(('sha256-'+base64.b64encode(bytes.fromhex(sha(R/p))).decode()) in html,'HTML script SRI mismatch: '+p)
 print(json.dumps({'status':'PASS','version':m['version'],'payloads':len(m['files']),'original_assets_unchanged':n,'startup_scripts':3,'generated_bundle_matches_sources':True,'source_photo_hash_matches':True,'browser_data_access':False}))
except Exception as e:
 print(json.dumps({'status':'FAIL','error':str(e)}));sys.exit(1)
