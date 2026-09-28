#!/usr/bin/env python3
"""Read-only package verification. Does not access browser data or a network."""
from pathlib import Path
import json,hashlib,argparse
R=Path(__file__).resolve().parents[1]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def verify(root=R):
 m=json.loads((root/'PACKAGE_SHA256.json').read_text());assert m['version']=='1.18.0','Wrong package version'
 expected={'PACKAGE_SHA256.json'}
 for row in m['files']:
  p=(root/row['path']).resolve();assert p.is_relative_to(root.resolve()),'Unsafe manifest path'
  assert p.is_file(),f"Missing {row['path']}";assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],f"Changed {row['path']}";expected.add(row['path'])
 actual={p.relative_to(root).as_posix()for p in root.rglob('*')if p.is_file() and '.git' not in p.relative_to(root).parts and '__pycache__' not in p.relative_to(root).parts and p.suffix!='.pyc' and p.relative_to(root).as_posix()!='.gitattributes'}
 assert actual==expected,{'extra':sorted(actual-expected),'missing':sorted(expected-actual)}
 protect=json.loads((root/'evidence/recalibration_v1_18_0/PROTECTED_BASELINE_HASHES.json').read_text())
 for name,h in protect['files'].items():assert sha(root/name)==h,'Protected input changed: '+name
 st=json.loads((root/'RELEASE_STATUS.json').read_text());assert st['version']=='1.18.0' and st['connected_non_suit_shirt_count']==18 and st['suit_shirt_count']==50
 return {'status':'PASS','version':'1.18.0','payloads':len(m['files']),'protected_files':len(protect['files']),'runtime_images_preserved':protect['runtime_images'],'browser_data_accessed':False,'ignored_git_metadata':['.gitattributes'] if (root/'.gitattributes').exists() else []}
if __name__=='__main__':print(json.dumps(verify(),indent=2))
