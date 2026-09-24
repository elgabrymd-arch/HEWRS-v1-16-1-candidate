#!/usr/bin/env python3
"""Read-only DS035 edge reconstruction and saved test-evidence verification."""
from pathlib import Path
import hashlib,json,subprocess,sys
R=Path(__file__).resolve().parents[1]
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
subprocess.run([sys.executable,str(R/'tools/build_ds035_edge.py'),'--check'],check=True)
e=json.loads((R/'data/ds035-edge.json').read_text())
for rel,h in e['input_hashes'].items():assert sha(R/rel)==h,rel
for h,rel in e['assetPaths'].items():assert sha(R/rel)==h,rel
b=json.loads((R/'evidence/edge_v1_5/BROWSER.json').read_text())
assert b['failure'] is None and b['checks_failed']==0
assert len(b['edge_comparisons'])==14*48
for row in b['edge_comparisons']:
 for k in ['outside','protectedChanged','tieChanged','jacketChanged','headChanged','residualEmptyPixels']:assert row[k]==0,(row['suitId'],row['state'],k)
 assert row['held'] and row['identity']
assert len(b['original_route_controls'])==193 and all(r['identical'] for r in b['original_route_controls'])
print(json.dumps({'status':'PASS','deterministic_derivatives_reproduced':True,'browser_evidence_checked':672,'original_route_evidence_checked':193,'browser_rerun_by_this_script':False}))
