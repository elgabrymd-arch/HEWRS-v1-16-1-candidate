#!/usr/bin/env python3
"""Verify current V1.6 source identity against the included V1.5 file ledger.
No source, asset, application or saved-data modification is performed.
"""
from pathlib import Path
import hashlib,json
R=Path(__file__).resolve().parents[1];E=R/'evidence/all_suits_v1_6'
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
rows=json.loads((E/'V1_5_BASELINE_FILES.json').read_text())['files']
protected=[]
for row in rows:
 s=row['path']
 if s.startswith(('assets/','assemblies/','data/','vendor/')) or s in [
  'src/atomic-renderer.js','src/ds035-coverage-renderer.js','src/ds035-edge-renderer.js',
  'src/application.css','src/canonical-bindings-browser.js','src/approved-suit-sources.js',
  'src/suit-resolver97-browser.js','src/controller.js','src/local-state.js']:
  p=R/s;assert p.is_file() and h(p)==row['sha256'],s;protected.append(row)
assert len(list((R/'assets').glob('*.png')))==sum(x['path'].startswith('assets/') and x['path'].endswith('.png') for x in protected)
assert len(list((R/'assemblies').glob('*.png')))==18
approval=json.loads((E/'OWNER_APPROVAL.json').read_text())
assert approval['owner_message']=='Approve next'
assert approval['approved_artifact_sha256']==json.loads((E/'V1_5_BASELINE_FILES.json').read_text())['zip_sha256']
assert not (R/'index.html').exists()
print(json.dumps({'protected_parent_files':len(protected),'original_assets_and_data':'UNCHANGED','new_garment_images':0,'V1_5_approval_bound':True}))
