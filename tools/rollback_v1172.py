#!/usr/bin/env python3
"""Restore exact V1.17.1 into a new folder; never access browser data or GitHub."""
from pathlib import Path,PurePosixPath
import argparse,json,hashlib,shutil
R=Path(__file__).resolve().parents[1];B=R/'rollback/tie_fidelity_v1_17_2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def restore(output=None):
 rows=json.loads((B/'BASELINE_FILES.json').read_text())['files'];sources={}
 for n,v in rows.items():
  q=PurePosixPath(n)
  if q.is_absolute()or'..'in q.parts or'\\'in n:raise ValueError('Unsafe baseline path')
  p=B/'original'/n
  if not p.is_file():p=R/n
  if not p.is_file()or p.stat().st_size!=v['bytes']or sha(p)!=v['sha256']:raise ValueError('Invalid rollback source '+n)
  sources[n]=p
 if output:
  output=Path(output).resolve()
  if output.exists()or output==R or R in output.parents:raise ValueError('Choose a new directory outside the application')
  output.mkdir(parents=True)
  for n,p in sources.items():
   dest=output/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
  for n,v in rows.items():
   if sha(output/n)!=v['sha256']:raise ValueError('Rollback output mismatch '+n)
 return {'status':'PASS','version':'1.17.1','files':len(rows),'write_performed':output is not None,'browser_data_accessed':False,'output':str(output)if output else None}
if __name__=='__main__':
 a=argparse.ArgumentParser(description=__doc__);g=a.add_mutually_exclusive_group(required=True);g.add_argument('--check',action='store_true');g.add_argument('--output',type=Path);opts=a.parse_args();print(json.dumps(restore(opts.output),indent=2))
