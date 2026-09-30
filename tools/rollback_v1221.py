#!/usr/bin/env python3
"""Reconstruct exact V1.22.0 into a NEW folder. Never opens browser stores."""
from pathlib import Path,PurePosixPath
import argparse,hashlib,json,shutil
R=Path(__file__).resolve().parents[1];F=R/'rollback/performance_v1_22_1'
def sha(p):
 with p.open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 a=argparse.ArgumentParser();a.add_argument('--check',action='store_true');a.add_argument('--output',type=Path);v=a.parse_args();m=json.loads((F/'BASELINE_MANIFEST.json').read_text());assert m['version']=='1.22.0';rows=[]
 for row in m['files']:
  name=row['path'];q=PurePosixPath(name);assert not q.is_absolute()and'..'not in q.parts
  old=F/'originals'/name;p=old if old.is_file()else R/name
  assert p.is_file()and p.stat().st_size==row['bytes']and sha(p)==row['sha256'],'Rollback source mismatch '+name;rows.append((name,p))
 if v.output:
  assert not v.output.exists(),'Refusing an existing destination';v.output.mkdir(parents=True)
  for name,p in rows:
   dest=v.output/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
  shutil.copy2(F/'BASELINE_MANIFEST.json',v.output/'PACKAGE_SHA256.json')
 print(json.dumps({'status':'PASS','restored_version':'1.22.0','payloads':len(rows),'output':str(v.output)if v.output else None,'browser_data_access':False}))
if __name__=='__main__':main()
