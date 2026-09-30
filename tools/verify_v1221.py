#!/usr/bin/env python3
"""Read-only V1.22.1 source/bundle verification. No network/browser-data access."""
from pathlib import Path,PurePosixPath
import argparse,ast,base64,hashlib,json,re
R=Path(__file__).resolve().parents[1]
def sha(p):
 with p.open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
def safe(root,name):
 q=PurePosixPath(name)
 if q.is_absolute() or '..' in q.parts:raise ValueError('Unsafe manifest path')
 p=root.joinpath(*q.parts)
 if p.is_symlink():raise ValueError('Symbolic link not supported: '+name)
 return p

def verify(root=R):
 m=json.loads((root/'PACKAGE_SHA256.json').read_text());assert m['version']=='1.22.1'
 paths=set()
 for row in m['files']:
  name=row['path'];assert name not in paths,'Duplicate '+name;paths.add(name);p=safe(root,name)
  assert p.is_file() and p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],'Missing/changed '+name
 protected=json.loads((root/'evidence/performance_v1_22_1/UNCHANGED_BASELINE_FILES.json').read_text())
 for row in protected:assert sha(root/row['path'])==row['sha256'],'Protected '+row['path']
 rec=json.loads((root/'STARTUP_RESOURCES.json').read_text());scripts=ast.literal_eval(re.search(r'SCRIPTS=(\[[^\n]+\])',(root/'tools/build.py').read_text()).group(1))
 assert scripts==rec['script_order']
 excluded={'src/runtime-loader.js','data/inputs.js','data/option-index.js'}
 assert [p for p in scripts if p not in excluded]==rec['bundle_sources']
 code='/* HEWRS V1.22.1 startup bundle; generated from tools/build.py. */\n'
 for name in rec['bundle_sources']:code+='\n/* SOURCE: '+name+' */\n'+(root/name).read_text()+'\n;\n'
 bundle=rec['startup_scripts'][2];assert (root/bundle).read_text()==code,'Outdated startup bundle'
 assert hashlib.sha256(code.encode()).hexdigest()[:20] in bundle
 for name,row in rec['resource_integrity'].items():assert sha(root/name)==row['sha256']and(root/name).stat().st_size==row['bytes'],name
 html=(root/'index.html').read_text();assert html==(root/'app.html').read_text();tags=re.findall(r'<script\b[^>]*src="[^"]+"[^>]*>',html)
 assert len(tags)==3
 def sri(name):return 'sha256-'+base64.b64encode(bytes.fromhex(sha(root/name))).decode()
 for name,tag in zip(rec['startup_scripts'],tags):
  assert re.search(r'\bdefer\b',tag)and'src="'+name in tag and'integrity="'+sri(name)+'"'in tag
 index=rec['deferred_index'];assert 'data-engine-index="'+index+'?v='+sha(root/index)[:16]+'"'in tags[0]
 assert 'data-engine-integrity="'+sri(index)+'"'in tags[0]
 idx=json.loads((root/'data/option-index.json').read_text());corr=json.loads((root/'data/owner-source-corrections.json').read_text());assert idx['current_source_revision']==corr['revision']
 s=json.loads((root/'RELEASE_STATUS.json').read_text());assert s['version']=='1.22.1'and s['target_options']==20 and s['connected_non_suit_shirt_count']==18
 assert s['max_per_unanchored_tie']==1 and s['max_per_unanchored_other_item']==2 and s['preference_storage_unchanged']
 pilot=json.loads((root/'data/preference-pilot.json').read_text());assert len(pilot['records'])==24 and not any('vote'in x for x in pilot['records'])
 out={'status':'PASS','version':m['version'],'payloads':len(paths),'protected_baseline_files':len(protected),'startup_scripts':3,'bundle_matches_ordered_sources':True,'all_startup_and_index_integrity_verified':True,'browser_data_access':False};print(json.dumps(out));return out
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--root',type=Path,default=R);v=a.parse_args();verify(v.root.resolve())
