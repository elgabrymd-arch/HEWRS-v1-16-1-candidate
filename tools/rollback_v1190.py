#!/usr/bin/env python3
"""Reconstruct exact V1.18.0 in a new folder. Never accesses browser data."""
from pathlib import Path
import argparse,hashlib,json,shutil,sys
sys.dont_write_bytecode=True
R=Path(__file__).resolve().parents[1];P=R/'rollback/hybrid_v1_19_0'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--output',type=Path);ap.add_argument('--check',action='store_true');a=ap.parse_args()
 manifest=json.loads((P/'BASELINE_MANIFEST.json').read_text());rest=[]
 for x in manifest['files']:
  f=P/'originals'/x['path'];f=f if f.is_file()else R/x['path'];assert f.is_file()and f.stat().st_size==x['bytes']and sha(f)==x['sha256'],'Rollback source mismatch: '+x['path'];rest.append((x,f))
 if a.output:
  out=a.output.resolve();assert not out.exists(),'Output already exists';out.mkdir(parents=True)
  for x,f in rest:
   dst=out/x['path'];dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dst)
  shutil.copy2(P/'BASELINE_MANIFEST.json',out/'PACKAGE_SHA256.json')
  for x,_ in rest:assert sha(out/x['path'])==x['sha256']
 elif not a.check:ap.error('Specify --output NEW_FOLDER or --check')
 print(json.dumps({'status':'PASS','restored_version':'1.18.0','baseline_payloads_checked':len(rest),'output':str(a.output)if a.output else None,'browser_data_accessed':False},indent=2))
if __name__=='__main__':main()
