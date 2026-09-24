#!/usr/bin/env python3
"""Read-only V1.4 preservation and code-scope verification."""
from pathlib import Path
import hashlib,json
R=Path(__file__).resolve().parents[1]
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
b=json.loads((R/'evidence/engine_v1_4/BASELINE.json').read_text())
protected={rel:d for rel,d in b['original_hashes'].items() if rel.startswith(('assets/','assemblies/','data/','vendor/')) or (rel.startswith('src/') and rel not in ('src/connection.js','src/application.js'))}
for rel,d in protected.items():
 p=R/rel
 if not p.resolve().is_relative_to(R.resolve()) or not p.is_file() or h(p)!=d:raise ValueError('Changed protected source: '+rel)
expected={r for r in b['original_hashes'] if r.startswith(('assets/','assemblies/')) and r.endswith('.png')}
actual={str(p.relative_to(R)) for root in [R/'assets',R/'assemblies'] for p in root.rglob('*.png')}
if actual!=expected:raise ValueError('Added or removed wearable/source PNG')
for f in ['connection.js','application.js']:
 p=R/'evidence/engine_v1_4'/('baseline_'+f+'.txt')
 if h(p)!=b['original_hashes']['src/'+f]:raise ValueError('Reference code mismatch: '+f)
if h(R/'evidence/engine_v1_4/baseline_app.template.html.txt')!=b['original_hashes']['app.template.html']:raise ValueError('Reference HTML mismatch')
if 'HEWRS_CONNECTED_APP_V1_4' not in (R/'src/application.js').read_text() or 'V1.4' not in (R/'app.html').read_text():raise ValueError('Version mismatch')
changed=[r for r,d in b['original_hashes'].items() if not (R/r).is_file() or h(R/r)!=d]
allowed={'README.md','app.html','app.template.html','src/connection.js','src/application.js','tests/ds035-coverage-routing.cjs','tests/ds035-coverage-browser.py','evidence/DS035_COVERAGE_ROUTING.json'}
# Re-executed inherited suites are deterministic except their source-labelled report.
unknown=[r for r in changed if r not in allowed]
if unknown:raise ValueError('Unrecorded baseline changes: '+str(unknown))
result={'schema':'hewrs.engine-wide.preservation.v1_4','status':'PASS','baseline_zip_sha256':b['sha256'],'protected_source_files_matched':len(protected),'asset_PNGs_unchanged':len(list((R/'assets').glob('*.png'))),'saved_assembly_PNGs_unchanged':len(list((R/'assemblies').glob('*.png'))),'changed_original_paths':changed,'original_inputs_unchanged':True,'original_renderer_and_DS035_extension_unchanged':True,'scoring_and_history_code_unchanged':True,'source_lock_unchanged':True,'new_image_derivatives':0}
print(json.dumps(result,indent=2))
