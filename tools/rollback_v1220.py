#!/usr/bin/env python3
"""Restore exact LOOKBOOK V1.21.1 into a new folder. Browser data untouched."""
from pathlib import Path
import argparse,json,hashlib,shutil
R=Path(__file__).resolve().parents[1];F=R/'rollback/local_preference_v1_22_0'
def sha(p):
 with p.open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 a=argparse.ArgumentParser();a.add_argument('--check',action='store_true');a.add_argument('--output',type=Path);v=a.parse_args();m=json.loads((F/'BASELINE_MANIFEST.json').read_text());assert m['version']=='1.21.1';rows=[]
 for x in m['files']:
  old=F/'originals'/x['path'];p=old if old.is_file()else R/x['path'];assert p.is_file()and sha(p)==x['sha256'],x['path'];rows.append((x['path'],p))
 if v.output:
  assert not v.output.exists(),'New output directory required';v.output.mkdir(parents=True)
  for name,p in rows:
   out=v.output/name;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out)
  shutil.copy2(F/'BASELINE_MANIFEST.json',v.output/'PACKAGE_SHA256.json')
 print(json.dumps({'status':'PASS','restored':'1.21.1 LOOKBOOK','payloads':len(rows),'output':str(v.output)if v.output else None,'browser_data_access':False}))
if __name__=='__main__':main()
