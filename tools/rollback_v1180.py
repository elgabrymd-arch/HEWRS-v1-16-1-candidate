#!/usr/bin/env python3
"""Restore exact V1.17.4 into a NEW folder. No browser, history or network access."""
from pathlib import Path
import argparse,json,hashlib,shutil
R=Path(__file__).resolve().parents[1];D=R/'rollback/recalibration_v1_18_0'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(output=None):
 m=json.loads((D/'BASELINE_PACKAGE_SHA256.json').read_text());assert m['version']=='1.17.4'
 for row in m['files']:
  p=D/'originals'/row['path'];p=p if p.is_file() else R/row['path']
  assert p.is_file() and p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],'Cannot reconstruct original: '+row['path']
 if output:
  output=Path(output).resolve();assert not output.exists(),'Output already exists; no overwrite'
  assert not output.is_relative_to(R),'Output must be outside the current application'
  output.mkdir(parents=True)
  for row in m['files']:
   p=D/'originals'/row['path'];p=p if p.is_file() else R/row['path'];dest=output/row['path'];assert dest.resolve().is_relative_to(output)
   dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
  shutil.copy2(D/'BASELINE_PACKAGE_SHA256.json',output/'PACKAGE_SHA256.json')
  for row in m['files']:assert sha(output/row['path'])==row['sha256']
 return {'status':'PASS','restored_version':'1.17.4','payloads_verified':len(m['files']),'output':str(output)if output else None,'browser_data_accessed':False}
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output');p.add_argument('--check',action='store_true');a=p.parse_args();print(json.dumps(run(a.output),indent=2))
