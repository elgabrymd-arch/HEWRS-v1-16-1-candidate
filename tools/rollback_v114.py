#!/usr/bin/env python3
"""Reconstruct exact V1.13 source in a NEW folder; never touch browser data.
Refuses existing/inside-source destinations. Runs a complete hash preflight.
"""
from pathlib import Path,PurePosixPath
import argparse,hashlib,json,os,shutil,tempfile
ROOT=Path(__file__).resolve().parents[1]
BACK=ROOT/'rollback/source_routes_v1_14'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for chunk in iter(lambda:f.read(2**20),b''):h.update(chunk)
 return h.hexdigest()
def require(value,message):
 if not value:raise ValueError(message)
def plan():
 manifest=json.loads((BACK/'PACKAGE_SHA256_V113.json').read_text())
 sources=[];names=set()
 for row in manifest['files']:
  name=row['path'];p=PurePosixPath(name)
  require(not p.is_absolute()and'..'not in p.parts and name not in names,'Unsafe or repeated original path')
  names.add(name);saved=BACK/'original'/name;src=saved if saved.is_file()else ROOT/name
  require(src.is_file()and src.stat().st_size==row['bytes']and sha(src)==row['sha256'],'Original bytes unavailable: '+name)
  sources.append((row,src))
 return sources
def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--destination',type=Path);parser.add_argument('--check',action='store_true')
 a=parser.parse_args();sources=plan()
 if a.check or a.destination is None:
  print(json.dumps({'status':'PASS','original_payload_files_available':len(sources),'source_tree_and_browser_data_modified':False}));return
 dest=a.destination.resolve()
 require(not dest.exists(),'Destination already exists; no files overwritten')
 require(dest!=ROOT and ROOT not in dest.parents,'Destination must be outside the current source tree')
 require(dest.parent.is_dir(),'Destination parent must already exist')
 temp=Path(tempfile.mkdtemp(prefix='.hewrs-v113-restore-',dir=dest.parent))
 try:
  for row,src in sources:
   out=temp/row['path'];out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,out)
   require(out.stat().st_size==row['bytes']and sha(out)==row['sha256'],'Restored file verification failed: '+row['path'])
  shutil.copyfile(BACK/'PACKAGE_SHA256_V113.json',temp/'PACKAGE_SHA256.json')
  require(not dest.exists(),'Destination appeared during restoration; no overwrite')
  # Rename the completed, verified source; user browser storage is never opened.
  os.rename(temp,dest)
 except Exception:
  shutil.rmtree(temp,ignore_errors=True);raise
 print(json.dumps({'status':'PASS','restored_root':str(dest),'restored_files':len(sources)+1,'current_source_modified':False,'browser_data_accessed':False}))
if __name__=='__main__':main()
