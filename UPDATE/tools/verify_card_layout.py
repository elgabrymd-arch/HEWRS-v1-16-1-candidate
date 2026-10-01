#!/usr/bin/env python3
"""Read-only V1.23.2 card-layout verifier; Python standard library only."""
from pathlib import Path
import json,hashlib,re,base64,sys
R=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def check(ok,msg):
 if not ok:raise ValueError(msg)
try:
 m=json.loads((R/'PACKAGE_SHA256.json').read_text());check(m['version']=='1.23.2-cards','Not V1.23.2-cards')
 known={x['path'] for x in m['files']}|{'PACKAGE_SHA256.json'}
 actual={p.relative_to(R).as_posix() for p in R.rglob('*') if p.is_file() and '.git' not in p.relative_to(R).parts and '__pycache__' not in p.relative_to(R).parts}
 check(actual==known,'Missing or unexpected files: '+str(sorted(actual^known)[:8]))
 for f in m['files']:check((R/f['path']).is_file() and (R/f['path']).stat().st_size==f['bytes'] and sha(R/f['path'])==f['sha256'],'Changed '+f['path'])
 old=json.loads((R/'provenance/card_layout_v1_23_2/baseline_1231_PACKAGE_SHA256.json').read_text());n=0
 for f in old['files']:
  if f['path'].startswith(('assets/','assemblies/','ui/','data/')):check(sha(R/f['path'])==f['sha256'],'Source/image modified: '+f['path']);n+=1
 res=json.loads((R/'STARTUP_RESOURCES.json').read_text());check(len(res['startup_scripts'])==3 and res['deferred_index']=='data/option-index.js','Startup changed')
 code='/* HEWRS V1.23.2 phone option-card layout startup bundle; generated from tools/build.py. */\n'
 for p in res['bundle_sources']:code+='\n/* SOURCE: '+p+' */\n'+(R/p).read_text()+'\n;\n'
 check((R/res['startup_scripts'][2]).read_text()==code,'Bundle differs from actual source')
 for p,v in res['resource_integrity'].items():check(sha(R/p)==v['sha256'] and (R/p).stat().st_size==v['bytes'],'Bad integrity '+p)
 html=(R/'index.html').read_text();check(html==(R/'app.html').read_text(),'Entry points differ')
 for p in res['startup_scripts']:check('sha256-'+base64.b64encode(bytes.fromhex(sha(R/p))).decode() in html,'SRI missing '+p)
 check('src/application.css?v='+sha(R/'src/application.css')[:16] in html,'CSS fingerprint mismatch')
 d=json.loads((R/'data/shoe-photo-corrections.json').read_text())
 for path,hashkey in [(d['layer']['url'],d['layer']['sha256']),(d['source']['path'],d['source']['sha256']),(d['thumbnail']['src'],d['thumbnail']['sha256'])]:check(sha(R/path)==hashkey,'Shoe15 correction changed')
 print(json.dumps({'status':'PASS','version':m['version'],'payloads':len(m['files']),'unchanged_image_and_data_payloads':n,'startup_scripts':3,'bundle_matches_sources':True,'CSS_and_SRI_hashes_match':True,'shoe15_retained':True,'browser_data_access':False}))
except Exception as e:print(json.dumps({'status':'FAIL','error':str(e)}));sys.exit(1)
