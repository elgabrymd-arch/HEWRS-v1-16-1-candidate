#!/usr/bin/env python3
"""Restore exact V1.22.1 in a NEW folder. No browser data is accessed."""
from pathlib import Path,PurePosixPath
import hashlib,json,argparse,shutil
R=Path(__file__).resolve().parents[1];D=R/'rollback/acceptability_v1_23_0'
def sha(p):
 with p.open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 a=argparse.ArgumentParser();a.add_argument('--check',action='store_true');a.add_argument('--output',type=Path);v=a.parse_args();m=json.loads((D/'BASELINE_MANIFEST.json').read_text());assert m['version']=='1.22.1';rows=[]
 for r in m['files']:
  name=r['path'];q=PurePosixPath(name);assert not q.is_absolute()and'..'not in q.parts
  old=D/'originals'/name;p=old if old.is_file()else R/name
  assert p.is_file()and p.stat().st_size==r['bytes']and sha(p)==r['sha256'],'Rollback mismatch '+name;rows.append((name,p))
 if v.output:
  assert not v.output.exists(),'Refusing an existing output folder';v.output.mkdir(parents=True)
  for name,p in rows:
   dest=v.output/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
  shutil.copy2(D/'BASELINE_MANIFEST.json',v.output/'PACKAGE_SHA256.json')
 print(json.dumps({'status':'PASS','restored_version':'1.22.1','payloads':len(rows),'output':str(v.output)if v.output else None,'browser_data_access':False}))
if __name__=='__main__':main()
