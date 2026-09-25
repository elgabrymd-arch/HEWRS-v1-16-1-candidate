#!/usr/bin/env python3
"""Reconstruct exact packaged V1.16.1 into a separate new folder.
Read-only with --check. Never accesses browser data, GitHub or a live site.
"""
from pathlib import Path,PurePosixPath
import json,hashlib,argparse,shutil
R=Path(__file__).resolve().parents[1];F=R/'rollback/ds023_v1_16_2'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__);g=p.add_mutually_exclusive_group(required=True);g.add_argument('--check',action='store_true');g.add_argument('--output',type=Path);a=p.parse_args()
 entries=json.loads((F/'BASELINE_FILES.json').read_text())['files'];sources={}
 for name,v in entries.items():
  q=PurePosixPath(name)
  if q.is_absolute() or '..' in q.parts or '\\' in name:raise ValueError('Unsafe rollback path')
  src=R/name
  if not src.is_file() or sha(src)!=v['sha256']:src=F/'original'/name
  if not src.is_file() or src.stat().st_size!=v['bytes']or sha(src)!=v['sha256']:raise ValueError('Unavailable rollback bytes: '+name)
  sources[name]=src
 if a.output:
  out=a.output.resolve()
  if out.exists() or out==R or R in out.parents:raise ValueError('Use a new destination outside the current source tree')
  out.mkdir(parents=True)
  for name,src in sources.items():
   dest=out/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dest)
  for name,v in entries.items():
   if sha(out/name)!=v['sha256']:raise ValueError('Rollback verification failed: '+name)
 print(json.dumps({'status':'PASS','restored_version':'1.16.1','baseline_files':len(entries),'write_performed':bool(a.output),'browser_data_accessed':False,'current_source_changed':False},indent=2))
if __name__=='__main__':main()
