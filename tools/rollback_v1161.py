#!/usr/bin/env python3
"""Restore the exact delivered V1.16 tree to a new folder; never open browser data.
Uses independently measured baseline file hashes because V1.16's included
PACKAGE_SHA256.json was stale. --check is read-only. No in-place rollback.
"""
from pathlib import Path, PurePosixPath
import argparse,hashlib,json,os,shutil,tempfile
R=Path(__file__).resolve().parents[1]
META=R/'evidence/release_v1_16_1/BASELINE_V116_FILES.json'
BACK=R/'rollback/release_v1_16_1/original'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(2**20),b''):h.update(chunk)
 return h.hexdigest()
def need(ok,msg):
 if not ok:raise ValueError(msg)
def originals():
 m=json.loads(META.read_text());out=[]
 for name,row in m['files'].items():
  parts=PurePosixPath(name);need(not parts.is_absolute() and '..' not in parts.parts and '\\' not in name,'Unsafe original path')
  saved=(BACK.parent/'cache_bytes'/(row['sha256']+'.bin')) if '__pycache__' in parts.parts or parts.suffix=='.pyc' else BACK/name
  p=saved if saved.is_file() else R/name
  need(p.is_file() and p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],'Original bytes unavailable: '+name)
  out.append((name,row,p))
 return out
def main():
 a=argparse.ArgumentParser(description=__doc__);a.add_argument('--check',action='store_true');a.add_argument('--destination',type=Path);args=a.parse_args()
 rows=originals()
 if args.check or not args.destination:
  print(json.dumps({'status':'PASS','baseline_files_available':len(rows),'source_modified':False,'browser_data_accessed':False}));return
 dest=args.destination.resolve();need(not dest.exists(),'Existing destination refused; no overwrite')
 need(dest!=R and R not in dest.parents,'Destination must be outside the current source tree');need(dest.parent.is_dir(),'Destination parent must exist')
 temp=Path(tempfile.mkdtemp(prefix='.hewrs-v116-restore-',dir=dest.parent))
 try:
  for name,row,src in rows:
   target=temp/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,target)
   need(sha(target)==row['sha256'],'Copy did not match original: '+name)
  need(not dest.exists(),'Destination appeared during reconstruction');os.rename(temp,dest)
 except BaseException:
  shutil.rmtree(temp,ignore_errors=True);raise
 print(json.dumps({'status':'PASS','restored_root':str(dest),'restored_files':len(rows),'exact_v116_payload_bytes':True,'current_source_modified':False,'browser_data_accessed':False,'note':'Restores historical V1.16 metadata too, including its stale package manifest; use the independent baseline file ledger to verify it.'}))
if __name__=='__main__':main()
