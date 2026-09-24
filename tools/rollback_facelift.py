#!/usr/bin/env python3
"""Restore V1.10 UI only; never touch browser/user data. Default is read-only."""
from pathlib import Path
import argparse,hashlib,json,shutil
R=Path(__file__).resolve().parents[1]
FILES=['src/application.css','src/application.js','app.template.html','app.html','index.html','tools/build.py','README.md']
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 p=argparse.ArgumentParser();g=p.add_mutually_exclusive_group();g.add_argument('--check',action='store_true');g.add_argument('--apply',action='store_true');a=p.parse_args()
 baseline=json.loads((R/'evidence/facelift_v1_11/BASELINE_V1_10.json').read_text())['files'];saved=R/'rollback/facelift_v1_11'
 for name in FILES:
  if not (saved/name).is_file() or sha(saved/name)!=baseline[name]:raise ValueError('Missing/changed rollback original: '+name)
 for name,h in baseline.items():
  if name in FILES or name=='PACKAGE_SHA256.json':continue
  if not (R/name).is_file() or sha(R/name)!=h:raise ValueError('Protected core changed; manual version reconciliation required: '+name)
 if a.apply:
  for name in FILES:shutil.copyfile(saved/name,R/name)
 print(json.dumps({'status':'RESTORED_UI_ONLY' if a.apply else 'ROLLBACK_FILES_AND_PROTECTED_CORE_VERIFIED','files':FILES,'browser_data_touched':False,'package_manifest_will_differ_after_rollback':True},indent=2))
if __name__=='__main__':main()
