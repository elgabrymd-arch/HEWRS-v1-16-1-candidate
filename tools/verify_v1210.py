#!/usr/bin/env python3
"""Read-only exact source/wardrobe verification for V1.21.0. No network or data writes."""
from pathlib import Path
import json,hashlib,sys
sys.dont_write_bytecode=True
R=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 m=json.loads((R/'PACKAGE_SHA256.json').read_text());assert m['version']=='1.21.0','Wrong source version'
 wanted={x['path']for x in m['files']}|{'PACKAGE_SHA256.json'}
 actual={str(f.relative_to(R))for f in R.rglob('*')if f.is_file()and '.git'not in f.parts and '__pycache__'not in f.parts}
 metadata=(actual-wanted)&{'.gitattributes','.DS_Store','desktop.ini','Thumbs.db'};actual-=metadata
 assert wanted==actual,('Extra/missing files',sorted(actual-wanted),sorted(wanted-actual))
 for x in m['files']:
  f=R/x['path'];assert f.stat().st_size==x['bytes']and sha(f)==x['sha256'],'File mismatch: '+x['path']
 p=json.loads((R/'evidence/twenty_ties_v1_21_0/SOURCE_PRESERVATION.json').read_text())
 # A separately configured service variant may change only its documented endpoint/CSP/build files.
 cfg=json.loads((R/'VISUAL_SERVICE_CONFIGURATION.json').read_text())if (R/'VISUAL_SERVICE_CONFIGURATION.json').exists()else None
 variant={'data/stylist-service-config.js','app.template.html','index.html','app.html'}if cfg else set()
 for x in p['protected_files']:
  if x['path']not in variant:assert sha(R/x['path'])==x['sha256'],'Changed protected source: '+x['path']
 images=[f for sub in ['assets','assemblies']for f in (R/sub).rglob('*')if f.is_file()and f.suffix.lower()in ['.png','.webp','.jpg','.jpeg']]
 assert len(images)==848,'Changed runtime image count'
 status=json.loads((R/'RELEASE_STATUS.json').read_text());assert status['version']=='1.21.0'and status['connected_non_suit_shirt_count']==18
 assert status['target_options']==20 and status['max_per_unanchored_tie']==1 and status['max_per_unanchored_other_item']==2
 assert 'src/researched-preference.js' in (R/'tools/build.py').read_text()
 print(json.dumps({'status':'PASS','version':'1.21.0','payloads':len(m['files']),'protected_files':len(p['protected_files']),'runtime_images':len(images),'endpoint_variant':bool(cfg),'no_network_or_browser_data_access':True},indent=2))
if __name__=='__main__':main()
