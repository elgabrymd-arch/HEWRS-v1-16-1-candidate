#!/usr/bin/env python3
"""Restore exact 18-shirt V1.16.5 source to a new folder, never browser data.
--check only verifies the source restoration bytes. Existing outputs are refused.
Favorites remain in their separate browser namespace; V1.16.5 has no Favorites
UI, but this rollback does not remove those stored records.
"""
from pathlib import Path,PurePosixPath
import argparse,hashlib,json,shutil
R=Path(__file__).resolve().parents[1];B=R/'rollback/favorites_v1_16_6'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def restore(output=None):
 m=json.loads((B/'BASELINE_FILES.json').read_text())['files'];sources={}
 for name,d in m.items():
  q=PurePosixPath(name)
  if q.is_absolute()or'..'in q.parts or'\\'in name:raise ValueError('Unsafe baseline path')
  p=B/'original'/name
  if not p.is_file():p=R/name
  if not p.is_file()or p.stat().st_size!=d['bytes']or digest(p)!=d['sha256']:raise ValueError('Invalid rollback source: '+name)
  sources[name]=p
 if output:
  output=Path(output).resolve()
  if output.exists()or R==output or R in output.parents:raise ValueError('Output must be a new folder outside the application tree')
  output.mkdir(parents=True)
  for name,p in sources.items():
   dest=output/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
  for name,d in m.items():
   if digest(output/name)!=d['sha256']:raise ValueError('Rollback output mismatch: '+name)
 return {'status':'PASS','version':'1.16.5','scope':'18 non-suit shirts','baseline_files':len(m),'write_performed':output is not None,'browser_data_accessed':False,'output':str(output)if output else None}
if __name__=='__main__':
 ap=argparse.ArgumentParser(description=__doc__);g=ap.add_mutually_exclusive_group(required=True);g.add_argument('--check',action='store_true');g.add_argument('--output',type=Path);args=ap.parse_args();print(json.dumps(restore(args.output),indent=2))
