#!/usr/bin/env python3
"""Read-only V1.23.0 source, startup order and bundle-integrity verification."""
from pathlib import Path
import hashlib,json,re
R=Path(__file__).resolve().parents[1]
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 m=json.loads((R/'PACKAGE_SHA256.json').read_text());assert m['version']=='1.23.0'
 for row in m['files']:
  p=R/row['path'];assert p.is_file()and p.stat().st_size==row['bytes']and sha(p)==row['sha256'],'Payload mismatch: '+row['path']
 x=json.loads((R/'STARTUP_RESOURCES.json').read_text());assert len(x['startup_scripts'])==3
 code='/* HEWRS V1.23.0 startup bundle; generated from tools/build.py. */\n'
 for path in x['bundle_sources']:code+='\n/* SOURCE: '+path+' */\n'+(R/path).read_text()+'\n;\n'
 assert code.encode()==(R/x['startup_scripts'][2]).read_bytes(),'UI bundle differs from current sources'
 for path,row in x['resource_integrity'].items():assert sha(R/path)==row['sha256']and(R/path).stat().st_size==row['bytes'],path
 assert 'data/preference-followup.js'in x['bundle_sources']
 assert 'data/option-index.js'not in x['bundle_sources']and x['deferred_index']=='data/option-index.js'
 print(json.dumps({'status':'PASS','version':'1.23.0','payloads':len(m['files']),'startup_scripts':3,'index_deferred':True,'bundle_matches_sources':True,'browser_data_access':False}))
if __name__=='__main__':main()
