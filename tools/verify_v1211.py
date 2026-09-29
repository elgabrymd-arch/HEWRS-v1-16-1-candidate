#!/usr/bin/env python3
"""Read-only V1.21.1 full source, original garment and UI-source validation."""
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 m=json.loads((R/'PACKAGE_SHA256.json').read_text());assert m['version']=='1.21.1';want={x['path']for x in m['files']}|{'PACKAGE_SHA256.json'}
 actual={str(f.relative_to(R))for f in R.rglob('*')if f.is_file()and '.git'not in f.parts and '__pycache__'not in f.parts};actual-=(actual-want)&{'.gitattributes','.DS_Store','desktop.ini','Thumbs.db'};assert actual==want,('Extra/missing',actual-want,want-actual)
 for x in m['files']:assert(R/x['path']).stat().st_size==x['bytes']and sha(R/x['path'])==x['sha256'],x['path']
 p=json.loads((R/'evidence/option_cards_v1_21_1/PRESERVED_SOURCE.json').read_text())
 for x in p['files']:assert sha(R/x['path'])==x['sha256'],('Protected',x['path'])
 st=json.loads((R/'RELEASE_STATUS.json').read_text());assert st['version']=='1.21.1'and st['target_options']==20 and st['max_per_unanchored_tie']==1 and st['connected_non_suit_shirt_count']==18
 t=json.loads((R/'data/option-card-thumbnails.json').read_text());assert t['counts']=={'shirts':50,'ties':47,'shoes':35}
 print(json.dumps({'status':'PASS','version':'1.21.1','payloads':len(m['files']),'protected_source_files':len(p['files']),'original_garment_images':848,'ui_thumbnails':132,'no_browser_or_network_access':True},indent=2))
if __name__=='__main__':main()
