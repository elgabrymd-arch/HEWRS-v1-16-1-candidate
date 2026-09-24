#!/usr/bin/env python3
"""Verify package integrity, exact original assets and the CP46 -> CP47 binding.
Does not modify files or fabricate missing entries. Historical verifiers remain
in the tree for their original revisions; this is the V1.9 entry point.
"""
from pathlib import Path,PurePosixPath
import hashlib,json,sys
R=Path(__file__).resolve().parents[1]
ALLOWED={'PACKAGE_SHA256.json','README.md','app.html','app.template.html','tools/build.py','data/blazer-connection.json','data/blazer-connection.js','src/connection.js','src/blazer-connection.js','src/blazer-renderer.js','src/application.js'}
def need(ok,message):
 if not ok:raise ValueError(message)
def file(name):
 p=PurePosixPath(name);need(not p.is_absolute() and '..' not in p.parts and '\\' not in name,'Unsafe path '+name)
 f=R.joinpath(*p.parts);need(f.is_file() and not f.is_symlink() and f.resolve().is_relative_to(R.resolve()),'Missing/unsafe file '+name);return f
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 m=json.loads(file('PACKAGE_SHA256.json').read_text());need(m['schema']=='hewrs.package.sha256.v1','Wrong package schema');seen=set()
 for row in m['files']:
  name=row['path'];need(name not in seen and name!='PACKAGE_SHA256.json','Duplicate/self hash');seen.add(name);p=file(name);need(p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],'Payload changed '+name)
 actual={p.relative_to(R).as_posix() for p in R.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p!=R/'PACKAGE_SHA256.json'}
 need(actual==seen,'Missing or extra package paths '+str(sorted(actual^seen)))
 baseline=json.loads(file('evidence/blazers_v1_9/BASELINE_V1_8.json').read_text());changed=[];original_images=0
 for n,h in baseline.items():
  current=sha(file(n))
  if current!=h:need(n in ALLOWED,'Unscoped original-file modification '+n);changed.append(n)
  if n.startswith(('assets/','assemblies/')) and n.endswith('.png'):need(current==h,'Original image changed '+n);original_images+=1
 for n in ['data/inputs.json','data/inputs.js','src/controller.js','src/local-state.js','src/mixed-renderer.js','src/atomic-renderer.js','vendor/active50-renderer.js','src/ds035-edge-renderer.js','src/ds035-coverage-renderer.js','vendor/hewrs-logic.js','vendor/ensemble-completion.js','vendor/approved-scores.js','data/trouser-profiles.js','src/trouser-profiles.js']:
  need(sha(file(n))==baseline[n],'Protected input/runtime changed '+n)
 data=json.loads(file('data/blazer-connection.json').read_text());bundle=file('data/blazer-connection.js').read_text();x,_=json.JSONDecoder().raw_decode(bundle.split('globalThis.HEWRS_BLAZER_CONNECTION_DATA=',1)[1]);need(data==x,'JSON/JS source registry differ')
 for new,old in {'connection_v18.js':'src/connection.js','blazer-connection_code_v18.js':'src/blazer-connection.js','blazer-renderer_v18.js':'src/blazer-renderer.js','blazer-connection_v18.js':'data/blazer-connection.js','blazer-connection_v18.json':'data/blazer-connection.json'}.items():
  need(sha(file('vendor/blazers-v1_9/'+new))==baseline[old],'Baseline comparator is not exact '+new)
 receipt=json.loads(file('evidence/blazers_v1_9/SOURCE_CONNECTION.json').read_text());approval=json.loads(file('evidence/blazers_v1_9/source/BLAZER_APPROVAL_STATE.json').read_text())
 need(approval['status']=='OWNER_APPROVED_VISUAL_UNIVERSE','Missing inherited approval')
 expected=[f'B{i:02d}' for i in range(4,15)];need([r['id'] for r in receipt['newly_connected']]==expected,'Wrong new source ID universe')
 for row in receipt['newly_connected']:
  bid=row['id'];rec=data['blazers'][bid];need(bid in approval['approved_ids'],'Unapproved source ID')
  need(rec['approval']=='PRESERVED' and rec['availability']=='CONNECTED','Source state mismatch')
  need(sha(file('evidence/blazers_v1_9/source/'+bid+'_PHONE.jpg'))==rec['latest_reference']['sha256']==row['approved_phone_sha256'],'CP47 visual source differs')
  for desc in [row['layer'],row['control'],row['opening']]:
   need(sha(file(desc['url']))==desc['sha256'],'Registered source bytes differ')
   need(data['assetPaths'][desc['sha256']]==desc['url'],'Unbound original source file')
  need(rec['checkpoint_layer']==row['layer'] and rec['checkpoint_control']==row['control'],'Wrong blazer role')
  need(rec['assembly']['base']==row['control'] and rec['assembly']['jacket']==row['layer'],'Wrong full-assembly/jacket pair')
  if bid!='B04':need(rec['legacyHistoryId'] is None and rec['historyId']=='blazer-source-'+bid,'Historical identity silently reassigned')
  else:need(rec['historyId']==rec['legacyHistoryId']=='blazer-3','Existing B04 identity changed')
 need(len(data['blazers'])==14 and len(data['pants'])==24,'Canonical inventory changed')
 need(file('index.html').read_bytes()==file('app.html').read_bytes(),'Index is not the same application')
 print(json.dumps({'status':'PASS','payload_hashes':len(seen),'baseline_files':len(baseline),'original_runtime_images_preserved':original_images,'changed_baseline_paths':sorted(changed),'newly_connected_blazers':expected,'original_garment_changes':0,'source_profiles_scores_storage_lock_preserved':True,'scope':'Source/package identity, not hosted/physical-device certification'},indent=2))
if __name__=='__main__':
 try:main()
 except (ValueError,KeyError,TypeError,OSError) as e:print(json.dumps({'status':'FAIL','error':str(e)}),file=sys.stderr);raise SystemExit(1)
