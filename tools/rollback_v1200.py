#!/usr/bin/env python3
"""Reconstruct exact V1.19.0 in a NEW folder; never changes browser data."""
from pathlib import Path
import argparse,json,hashlib,shutil,sys
sys.dont_write_bytecode=True
R=Path(__file__).resolve().parents[1];P=R/'rollback/research_v1_20_0'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--output',type=Path);ap.add_argument('--check',action='store_true');a=ap.parse_args()
 m=json.loads((P/'BASELINE_MANIFEST.json').read_text());assert m['version']=='1.19.0';rows=[]
 for x in m['files']:
  f=P/'originals'/x['path'];f=f if f.is_file()else R/x['path'];assert f.is_file()and f.stat().st_size==x['bytes']and sha(f)==x['sha256'],'Rollback source mismatch: '+x['path'];rows.append((x,f))
 if a.output:
  out=a.output.resolve();assert not out.exists(),'Refuse existing destination';out.mkdir(parents=True)
  for x,f in rows:
   dst=out/x['path'];dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dst)
  shutil.copy2(P/'BASELINE_MANIFEST.json',out/'PACKAGE_SHA256.json')
  for x,_ in rows:assert sha(out/x['path'])==x['sha256']
 elif not a.check:ap.error('Specify --output NEW_FOLDER or --check')
 print(json.dumps({'status':'PASS','restored_version':'1.19.0','payloads':len(rows),'output':str(a.output)if a.output else None,'browser_data_accessed':False},indent=2))
if __name__=='__main__':main()
