#!/usr/bin/env python3
"""Cumulative, reversible HEWRS local update. Standard library; no network/storage APIs."""
from pathlib import Path, PurePosixPath
import argparse,hashlib,json,os,shutil,sys,tempfile
ROOT=Path(__file__).resolve().parent

def fail(message):raise ValueError(message)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def safe(root,relative):
 p=PurePosixPath(relative)
 if p.is_absolute() or '..' in p.parts or '\\' in relative or not p.parts:fail('Unsafe path '+relative)
 out=root.joinpath(*p.parts)
 for n in [out,*out.parents]:
  if n==root:break
  if n.is_symlink():fail('Symlink refused: '+str(n))
 return out

def matches(path,row):return path.is_file() and not path.is_symlink() and path.stat().st_size==row['bytes'] and sha(path)==row['sha256']
def table(patch,version):
 meta=patch['manifests'][version];p=safe(ROOT,meta['path'])
 if sha(p)!=meta['sha256']:fail('Package manifest changed for '+version)
 m=json.loads(p.read_text());out={}
 for row in m['files']:
  if row['path'] in out:fail('Duplicate manifest path')
  safe(ROOT,row['path']);out[row['path']]=row
 out['PACKAGE_SHA256.json']={'path':'PACKAGE_SHA256.json','bytes':p.stat().st_size,'sha256':sha(p)}
 return out

def verify(root,files):
 known=set(files);actual=set()
 for p in root.rglob('*'):
  rel=p.relative_to(root)
  if '.git' in rel.parts or '__pycache__' in rel.parts:continue
  if p.is_symlink():fail('Symlink refused: '+str(rel))
  if p.is_file():actual.add(rel.as_posix())
 if actual!=known:fail('Unexpected/missing app files: '+', '.join(sorted(actual^known)[:12]))
 for rel,row in files.items():
  if not matches(safe(root,rel),row):fail('File does not match required baseline: '+rel)

def main():
 a=argparse.ArgumentParser(description=__doc__);a.add_argument('app',type=Path);a.add_argument('--dry-run',action='store_true');a.add_argument('--rollback-to',choices=['1.23.0','1.23.1-shoe15']);opts=a.parse_args()
 if opts.app.is_symlink():fail('App folder must not be a symlink')
 app=opts.app.resolve()
 if not app.is_dir() or not (app/'PACKAGE_SHA256.json').is_file():fail('Target must be the existing app folder containing PACKAGE_SHA256.json')
 if app==ROOT or ROOT in app.parents or app in ROOT.parents:fail('Patch and target must be separate folders')
 patch=json.loads((ROOT/'PATCH.json').read_text());target=patch['target_version'];manifests={v:table(patch,v) for v in patch['manifests']}
 if opts.rollback_to:
  source=target;dest=opts.rollback_to;baseline=dest
 else:
  digest=sha(app/'PACKAGE_SHA256.json');choices=[v for v in patch['baseline_versions'] if manifests[v]['PACKAGE_SHA256.json']['sha256']==digest]
  if len(choices)!=1:fail('Not an exact supported baseline. Expected V1.23.0 or V1.23.1-shoe15; existing later changes are retained.')
  source=choices[0];dest=target;baseline=source
 verify(app,manifests[source])
 rows=patch['deltas'][baseline];expected=[]
 for rel in sorted(set(manifests[source])|set(manifests[dest])):
  if manifests[source].get(rel)!=manifests[dest].get(rel):expected.append(rel)
 if [r['path'] for r in rows]!=expected:fail('Patch delta does not match complete manifests')
 operations=[]
 for row in rows:
  rel=row['path'];before=manifests[source].get(rel);after=manifests[dest].get(rel)
  # Validate both sides of package metadata, not only file names.
  orig=manifests[baseline].get(rel);final=manifests[target].get(rel)
  if row['before']!=orig or row['after']!=final:fail('Bad delta metadata: '+rel)
  payload=safe(ROOT,('ROLLBACK/'+dest+'/' if opts.rollback_to else 'UPDATE/')+rel) if after else None
  if after and not matches(payload,after):fail('Missing/changed update payload: '+rel)
  operations.append((rel,before,after,payload))
 print(f'Verified {source} -> {dest}: {len(operations)} changed/added/removed paths. Browser data is not accessed.')
 if opts.dry_run:print('Dry run complete. No files changed.');return
 # Prepare every replacement first. Roll back completed operations if a write fails.
 with tempfile.TemporaryDirectory(prefix='.hewrs-card-update-',dir=app.parent) as work:
  work=Path(work);completed=[]
  for i,(rel,before,after,payload) in enumerate(operations):
   if before:shutil.copy2(safe(app,rel),work/f'{i}.old')
   if after:shutil.copy2(payload,work/f'{i}.new')
  try:
   verify(app,manifests[source])
   for i,(rel,before,after,payload) in enumerate(operations):
    out=safe(app,rel);out.parent.mkdir(parents=True,exist_ok=True)
    if after:os.replace(work/f'{i}.new',out)
    else:out.unlink()
    completed.append(i)
   verify(app,manifests[dest])
  except Exception:
   for i in reversed(completed):
    rel,before,after,payload=operations[i];out=safe(app,rel)
    if before:os.replace(work/f'{i}.old',out)
    elif out.exists():out.unlink()
   raise
 print(f'Completed and verified {dest} in the local app folder. Nothing was published.')
if __name__=='__main__':
 try:main()
 except Exception as e:print('REFUSED: '+str(e),file=sys.stderr);sys.exit(1)
