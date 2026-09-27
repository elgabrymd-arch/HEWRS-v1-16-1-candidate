#!/usr/bin/env python3
"""Restore exact packaged V1.16.4 into a new folder. No browser or GitHub access.
--check verifies restoration bytes without writing; --output refuses existing destinations.
"""
from pathlib import Path,PurePosixPath
import json,hashlib,argparse,shutil
R=Path(__file__).resolve().parents[1];RB=R/'rollback/scope18_v1_16_5'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def main():
 parser=argparse.ArgumentParser(description=__doc__);group=parser.add_mutually_exclusive_group(required=True);group.add_argument('--check',action='store_true');group.add_argument('--output',type=Path);a=parser.parse_args()
 entries=json.loads((RB/'BASELINE_FILES.json').read_text())['files'];sources={}
 for n,d in entries.items():
  q=PurePosixPath(n)
  if q.is_absolute()or'..'in q.parts or'\\'in n:raise ValueError('Unsafe path')
  src=R/n
  if not src.is_file()or sha(src)!=d['sha256']:src=RB/'original'/n
  if not src.is_file()or src.stat().st_size!=d['bytes']or sha(src)!=d['sha256']:raise ValueError('Unavailable original bytes: '+n)
  sources[n]=src
 if a.output:
  out=a.output.resolve()
  if out.exists()or out==R or R in out.parents:raise ValueError('Use a NEW folder outside the source tree')
  out.mkdir(parents=True)
  for n,src in sources.items():
   dest=out/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dest)
  for n,d in entries.items():
   if sha(out/n)!=d['sha256']:raise ValueError('Restoration failed: '+n)
 print(json.dumps({'status':'PASS','restored_version':'1.16.4','baseline_files':len(entries),'write_performed':bool(a.output),'browser_data_accessed':False,'current_source_changed':False},indent=2))
if __name__=='__main__':main()
