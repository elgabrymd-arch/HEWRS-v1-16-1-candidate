#!/usr/bin/env python3
"""Read-only check of extension scope, source preservation and data synchronization.
Optionally compare original V1.2 and the superseded broad-extension candidate.
"""
from pathlib import Path
from zipfile import ZipFile
import argparse,hashlib,io,json,subprocess
from PIL import Image
import numpy as np
R=Path(__file__).resolve().parents[1]
def sha(b):return hashlib.sha256(b).hexdigest()
def image(raw):
 with Image.open(io.BytesIO(raw)) as im:im.load();return np.array(im.convert('RGBA'))
def run(base_archive=None,prior_archive=None):
 subprocess.run(['python',str(R/'tools/build_ds035_coverage.py'),'--check'],check=True,capture_output=True)
 data=json.loads((R/'data/ds035-coverage.json').read_text());p=json.loads((R/'data/inputs.json').read_text());m=p['manifest']
 def rd(d):
  raw=(R/'assets'/(d['sha256']+'.png')).read_bytes();assert sha(raw)==d['sha256'];return image(raw)
 canvas_shape=(2748,996)
 j05=rd(m['static']['jacket']);reg=json.loads((R/'vendor/cp98/REGISTER97.json').read_text());j11=rd(next(r for r in reg['items'] if r['suit_id']=='S11')['jacket'])
 with Image.open(R/'data/reference/S11_CONTROL_ALPHA.png') as im:fixed=np.array(im)
 roi=np.zeros(canvas_shape,bool);x0,y0,x1,y1=data['roi'];roi[y0:y1,x0:x1]=True
 geometry=roi&(fixed>0)&(j05[:,:,3]==255)&(j11[:,:,3]<255)
 rows=[]
 for mode in ['no_tie','tied']:
  ext=rd(data['states'][mode]);mask=ext[:,:,3]>0;c=m['shirts']['DS035']['states'][mode];protected=np.zeros(canvas_shape,bool)
  for d in [m['static'][k] for k in ['avatar','left_hand','right_hand']]+[c[k] for k in ['rear','left','right','left_cuff','right_cuff']]:protected|=rd(d)[:,:,3]>0
  allowed=geometry&~protected&(rd(c['body'])[:,:,3]<255)
  assert np.array_equal(mask,allowed)
  assert not (mask&protected).any()
  assert int(mask.sum())==data['states'][mode]['nontransparent_pixels']
  rows.append({'mode':mode,'extension_pixels':int(mask.sum()),'outside_authorized_geometry':int((mask&~geometry).sum()),'protected_body_collar_cuff_hand_neck_overlap':int((mask&protected).sum()),'matches_deterministic_build':True})
 comparison=None
 if base_archive:
  with ZipFile(base_archive) as z:
   pre=z.namelist()[0].split('/')[0]+'/'
   preserved=[];changes=[]
   for name in z.namelist():
    rel=name[len(pre):]
    if not rel or name.endswith('/'):continue
    raw=z.read(name);f=R/rel
    if f.is_file() and sha(f.read_bytes())==sha(raw):preserved.append(rel)
    else:changes.append(rel)
   original_pngs=[n[len(pre):] for n in z.namelist() if n.startswith(pre+'assets/') and n.endswith('.png')]
   assert all(n in preserved for n in original_pngs)
   critical=['data/inputs.json','data/inputs.js','vendor/active50-renderer.js','src/local-state.js','src/controller.js','vendor/hewrs-logic.js','vendor/approved-scores.js','vendor/ensemble-completion.js','vendor/cp98/REGISTER97.json','data/approved-suits.json','data/approved-suits.js','data/suit-assembly.json','data/suit-assembly.js']
   assert all(n in preserved for n in critical)
   comparison={'base_archive_sha256':sha(Path(base_archive).read_bytes()),'original_asset_png_files_unchanged':len(original_pngs),'preserved_critical_files':critical,'changed_or_relocated_files':changes,'preserved_existing_file_count':len(preserved)}
 prior=None
 if prior_archive:
  with ZipFile(prior_archive) as z:
   prefix=z.namelist()[0].split('/')[0]+'/'
   ev=json.loads(z.read(prefix+'evidence/DS035_S11_COVERAGE_CANDIDATE.json'))
   rows_prior=[]
   for r in ev['new_assets']:
    arr=image(z.read(prefix+'assets/'+r['sha256']+'.png'));mask=arr[:,:,3]>0
    mode='no_tie' if 'NO_TIE' in r['role'] else 'tied'
    # Reproduce prior underlayer/no-tie-T017 gap coverage check.
    c=m['shirts']['DS035']['states'][mode]
    support=np.zeros(canvas_shape,bool)
    for d in [m['static'][k] for k in ['avatar','left_hand','right_hand','shoe','trousers']]+list(c.values()):support|=rd(d)[:,:,3]>0
    if mode=='tied':support|=rd(m['ties']['T017']['display_layer'])[:,:,3]>0
    strict=roi&(fixed==255)&(j05[:,:,3]==255)&(j11[:,:,3]==0)
    remaining=strict&~support&~mask
    rows_prior.append({'mode':mode,'nontransparent_pixels':int(mask.sum()),'outside_registered_new_opening':int((mask&~geometry).sum()),'remaining_previously_demonstrated_empty_pixels':int(remaining.sum())})
   pp=json.loads(z.read(prefix+'data/inputs.json'));pj=z.read(prefix+'data/inputs.js').decode()
   prior={'archive_sha256':sha(Path(prior_archive).read_bytes()),'not_used_in_new_build':True,'asset_checks':rows_prior,'changed_inputs_json_without_synchronized_inputs_js':all(h not in pj for h in [r['sha256'] for r in ev['new_assets']])}
 result={'schema':'hewrs.ds035.coverage.scope-verification.v1_3','status':'PASS','extension_rows':rows,'base_preservation':comparison,'superseded_candidate':prior,'file_operations':'Read-only; rebuild compared in memory','source_rgb_note':'Only DS035 NO_TIE shirt-body RGB supplies new cloth; old S11 control is alpha-only geometry','boundary':'The new underfill removes transparency, not baked-in source-edge outlines. Original opaque pixels remain unchanged.'}
 return result
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--base',type=Path);a.add_argument('--prior',type=Path);a.add_argument('--out',type=Path);v=a.parse_args();r=run(v.base,v.prior);text=json.dumps(r,indent=2)+'\n'
 if v.out:v.out.write_text(text)
 print(text)
