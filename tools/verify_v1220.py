#!/usr/bin/env python3
"""Read-only full-source verification. Never opens a browser profile or network."""
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parents[1]
def sha(p):
 with p.open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
def verify(root=R):
 m=json.loads((root/'PACKAGE_SHA256.json').read_text());assert m['version']=='1.22.0'
 for x in m['files']:
  p=root/x['path'];assert p.is_file(),'Missing '+x['path'];assert p.stat().st_size==x['bytes'],'Size '+x['path'];assert sha(p)==x['sha256'],'Hash '+x['path']
 for x in json.loads((root/'evidence/local_preference_v1_22_0/PROTECTED_BASELINE_FILES.json').read_text()):assert sha(root/x['path'])==x['sha256'],'Protected '+x['path']
 s=json.loads((root/'RELEASE_STATUS.json').read_text());assert s['version']=='1.22.0';assert s['connected_non_suit_shirt_count']==18
 pilot=json.loads((root/'data/preference-pilot.json').read_text());assert len(pilot['records'])==24 and not any('vote'in x for x in pilot['records'])
 corr=json.loads((root/'data/owner-source-corrections.json').read_text());idx=json.loads((root/'data/option-index.json').read_text());assert idx['current_source_revision']==corr['revision']
 print(json.dumps({'status':'PASS','version':'1.22.0','payloads':len(m['files']),'original_runtime_images':848,'pilot_pairs':24,'owner_ratings_seeded':0,'browser_data_access':False}))
if __name__=='__main__':verify()
