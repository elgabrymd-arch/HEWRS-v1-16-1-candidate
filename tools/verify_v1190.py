#!/usr/bin/env python3
"""Read-only V1.19.0 source and preserved wardrobe verification."""
from pathlib import Path
import hashlib,json,sys
sys.dont_write_bytecode=True
R=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 m=json.loads((R/'PACKAGE_SHA256.json').read_text());assert m['version']=='1.19.0','Wrong package'
 wanted={x['path']for x in m['files']}|{'PACKAGE_SHA256.json'}
 actual={str(f.relative_to(R))for f in R.rglob('*')if f.is_file()and '.git'not in f.parts and '__pycache__'not in f.parts}
 allowed_metadata=(actual-wanted)&{'.gitattributes','.DS_Store','desktop.ini','Thumbs.db'}
 actual-=allowed_metadata
 assert wanted==actual,('Extra/missing files',sorted(actual-wanted),sorted(wanted-actual))
 for x in m['files']:
  f=R/x['path'];assert f.stat().st_size==x['bytes']and sha(f)==x['sha256'],'Payload mismatch: '+x['path']
 p=json.loads((R/'evidence/hybrid_v1_19_0/SOURCE_PRESERVATION.json').read_text())
 for x in p['protected_files']:assert sha(R/x['path'])==x['sha256'],'Changed protected data: '+x['path']
 images=[f for sub in ['assets','assemblies']for f in (R/sub).rglob('*')if f.is_file()and f.suffix.lower()in ['.png','.jpg','.jpeg','.webp']]
 assert len(images)==848,'Runtime image universe changed'
 library=json.loads((R/'data/stylist-library.json').read_text());assert len(library['records'])==94 and len({r['id']for r in library['records']})==94
 print(json.dumps({'status':'PASS','version':'1.19.0','payloads':len(m['files']),'protected_files':len(p['protected_files']),'runtime_images_preserved':len(images),'live_provider_calls_performed':0,'verification_only':True,'non_runtime_repository_metadata':sorted(allowed_metadata)},indent=2))
if __name__=='__main__':main()
