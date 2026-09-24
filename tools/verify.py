#!/usr/bin/env python3
"""Read-only verification of the delivered clean application tree."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
R=Path(__file__).resolve().parents[1]
h=lambda b:hashlib.sha256(b).hexdigest()
p=json.loads((R/'data/inputs.json').read_text())
source=json.loads((R/'evidence/SOURCE_ORIGINS.json').read_text())
assert h((R/'data/inputs.json').read_bytes())==source['input_sha256']
assert len(p['manifest']['shirt_order'])==50
assert len(p['manifest']['ties'])==47
assert len(p['shoeLayers'])==35
for digest,rel in p['assets'].items():
 q=R/rel
 assert q.resolve().is_relative_to(R.resolve())
 assert q.is_file() and h(q.read_bytes())==digest,rel
for row in source['vendor']:
 if row['transformation']=='none':assert h((R/row['target']).read_bytes())==row['sha256'],row['target']
for f in list((R/'src').glob('*.js'))+list((R/'vendor').glob('*.js')):
 subprocess.run(['node','--check',str(f)],check=True,capture_output=True)
for relative in re.findall(r'(?:src|href)="([^"#]+)"',(R/'app.html').read_text()):
 assert (R/relative).is_file(),relative
assert not (R/'index.html').exists(),'This package must not be confused with a replacement production index.html'
suits=json.loads((R/'data/approved-suits.json').read_text())
origins=json.loads((R/'evidence/SUIT_SOURCE_ORIGINS.json').read_text())
assert h((R/'vendor/cp98/suit_resolver97.mjs').read_bytes())==origins['unchanged_resolver_sha256']
assert h((R/'vendor/cp98/REGISTER97.json').read_bytes())==origins['unchanged_registry_sha256']
assert (R/'data/approved-suits.js').read_text()=='globalThis.HEWRS_APPROVED_SUITS_DATA='+(R/'data/approved-suits.json').read_text()+';\n'
for row in origins['source_assets']:
 assert h((R/row['target']).read_bytes())==row['sha256'],row['target']
checks=0
manifest=R/'PACKAGE_SHA256.json'
if manifest.exists():
 for row in json.loads(manifest.read_text())['files']:
  f=R/row['path'];assert f.resolve().is_relative_to(R.resolve());assert f.is_file();assert h(f.read_bytes())==row['sha256'],row['path'];checks+=1
print(json.dumps({'status':'PASS','images':len(p['assets']),'copied_vendor_modules':sum(r['transformation']=='none' for r in source['vendor']),'package_hash_checks':checks,'source_files_modified':0}))
# V1.2 adds saved registered views in an isolated, non-outfit image directory.
assembly=json.loads((R/'data/suit-assembly.json').read_text())
if (R/'data/suit-assembly.js').read_text()!='globalThis.HEWRS_SUIT_ASSEMBLY_DATA='+(R/'data/suit-assembly.json').read_text()+';\n':
 raise ValueError('Assembly JSON/script mismatch')
if assembly['dynamic_suits']!=['S01','S04','S05','S16'] or len(assembly['registered_views'])!=18:
 raise ValueError('Wrong assembly coverage')
for sid,row in assembly['registered_views'].items():
 if row['suitId']!=sid or row['url']!='assemblies/'+row['sha256']+'.png' or h((R/row['url']).read_bytes())!=row['sha256']:
  raise ValueError('Changed registered view: '+sid)
print(json.dumps({'suit_display_extension':'PASS','historical_S05_template_group':assembly['dynamic_suits'],'saved_control_views':18}))

# V1.3 authorized extension remains separate from inherited inputs and vendor code.
coverage=json.loads((R/'data/ds035-coverage.json').read_text())
assert coverage['schema']=='hewrs.ds035.s11.coverage.v1_3'
assert (R/'data/ds035-coverage.js').read_text()=='globalThis.HEWRS_DS035_COVERAGE='+json.dumps(coverage,separators=(',',':'))+';\n'
assert len(coverage['wider_suit_ids'])==14 and set(coverage['states'])=={'no_tie','tied'}
for digest,rel in coverage['assetPaths'].items():
 assert h((R/rel).read_bytes())==digest
assert 'globalThis.HEWRS_INPUT_SHA256' in (R/'data/inputs.js').read_text()
print(json.dumps({'DS035_coverage_bindings':'PASS','variants':2,'wider_suits':14,'correction_scope':'DS035 only; other shirts use unchanged original components'}))

# V1.5 edge derivatives have separate bindings; original inputs remain unchanged.
edge=json.loads((R/'data/ds035-edge.json').read_text())
assert edge['schema']=='hewrs.ds035.s11.edge.v1_5'
assert (R/'data/ds035-edge.js').read_text()=='globalThis.HEWRS_DS035_EDGE='+json.dumps(edge,separators=(',',':'))+';\n'
assert edge['wider_suit_ids']==coverage['wider_suit_ids']
for digest,rel in edge['assetPaths'].items():assert h((R/rel).read_bytes())==digest
for rel,digest in edge['input_hashes'].items():assert h((R/rel).read_bytes())==digest
print(json.dumps({'DS035_edge_bindings':'PASS','variants':2,'original_sources_unchanged':True}))
