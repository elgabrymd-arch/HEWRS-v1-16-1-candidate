#!/usr/bin/env python3
"""DS023-only background/neck alpha cleanup of V1.16.1 registrations.
Original image bytes, RGB, collar leaves, ties, avatar and all geometry inputs
are read-only. The two new derivatives change alpha only. Not a garment render.
Requires Pillow, NumPy, SciPy. --check recomputes without modifying the package.
"""
from pathlib import Path
import argparse, hashlib, io, json, sys
sys.dont_write_bytecode=True
from PIL import Image
import numpy as np
from scipy import ndimage
R=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
P=json.loads((R/'data/inputs.json').read_text());D=json.loads((R/'data/batch10.json').read_text())
B=json.loads((R/'data/blazer-connection.json').read_text());paths={**P['assets'],**B['assetPaths'],**D['assetPaths']}
W,H=996,2748;Y,X=np.indices((H,W));row=D['shirts']['DS023'];modes={};stats=[]
sha=lambda raw:hashlib.sha256(raw).hexdigest()
def read(d):
 raw=(R/paths[d['sha256']]).read_bytes();assert sha(raw)==d['sha256']
 return Image.open(io.BytesIO(raw)).convert('RGBA')
def write(path,raw):
 p=R/path
 if p.exists():assert p.read_bytes()==raw, 'Refuse overwrite: '+str(p)
 elif args.check:raise AssertionError('Missing installed result: '+str(p))
 else:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
for mode in ['tied','no_tie']:
 old=np.array(read(row['modes'][mode]['base']));out=old.copy();c=P['manifest']['shirts']['DS023']['states'][mode]
 upper=Image.new('RGBA',(W,H))
 for role in ['rear','body','left','right']:upper.alpha_composite(read(c[role]))
 upper=np.array(upper)
 # Two enclosed neutral backgrounds, already visibly present in the uploaded
 # burgundy-shirt donor. Spatial and connected-component restrictions exclude
 # shirt buttons, tie, cuffs and all unrelated material.
 roi=(Y>870)&(Y<1300)&(((X>140)&(X<240))|((X>745)&(X<865)))
 neutral=(np.ptp(old[:,:,:3].astype(float),axis=2)<23)&(old[:,:,:3].mean(2)>100)&(old[:,:,3]>0)&roi
 labels,_=ndimage.label(neutral);sizes=np.bincount(labels.ravel())
 components=np.flatnonzero((sizes>300)&(np.arange(len(sizes))!=0));assert len(components)==2
 cores=np.isin(labels,components);near=ndimage.binary_dilation(cores,iterations=3)
 # Alpha-only decontamination of the three-pixel mixed-color edge. No cloth
 # color substitution, extrusion, new sleeve silhouette or source resampling.
 factor=np.clip((old[:,:,0].astype(float)-old[:,:,1]-10)/35,0,1)
 fringe=near&(factor<1)&(Y>870)
 out[fringe,3]=np.rint(old[fringe,3]*factor[fringe]).astype('uint8')
 out[cores,3]=0
 # The current collar/body composites already supply the true neck opening.
 # V1.15 applied this visibility operation only to NO_TIE. Apply it to both,
 # preventing a second body registration from painting a rectangular throat.
 region=(Y>=330)&(Y<535)&(X>=375)&(X<620)
 lab,_=ndimage.label((upper[:,:,3]==0)&region);seed=lab[335,498];assert seed
 neck=(lab==seed)&region;out[neck,3]=0
 assert np.array_equal(out[:,:,:3],old[:,:,:3]),'RGB mutation forbidden'
 assert not np.any(out[:,:,3]>old[:,:,3]),'No geometry expansion permitted'
 changed=out[:,:,3]!=old[:,:,3];ys,xs=np.where(changed)
 rawio=io.BytesIO();Image.fromarray(out).save(rawio,format='PNG');raw=rawio.getvalue();h=sha(raw);url='assets/'+h+'.png';write(url,raw)
 modes[mode]={'baseline':row['modes'][mode]['base'],'base':{'url':url,'sha256':h,'rect':[0,0,W,H],'role':'DS023_'+mode.upper()+'_ALPHA_CLEANUP_V1162'}}
 stats.append({'mode':mode,'rgb_pixels_changed':0,'alpha_pixels_changed':int(changed.sum()),'neutral_background_core_pixels':int(cores.sum()),'core_opacity_after_max':int(out[cores,3].max()),'neck_obstruction_pixels_removed':int(np.sum(neck&(old[:,:,3]>0))), 'changed_bounds':[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],'outside_cleanup_regions_changed':int(np.sum(changed&~(fringe|neck))), 'alpha_expanded_pixels':0,'original_rgba_sha256':sha(old.tobytes()),'corrected_rgba_sha256':sha(out.tobytes())})
assert stats[0]['neck_obstruction_pixels_removed']>0 and stats[1]['neck_obstruction_pixels_removed']==0
record={'schema':'hewrs.ds023-alpha-composite.v1_16_2','id':'DS023','history_id':'shirt-DS023','canvas':[W,H],'source_input_sha256':sha((R/'data/inputs.json').read_bytes()),'baseline_registration_sha256':sha((R/'data/batch10.json').read_bytes()),'owner_source_file':row['source_file'],'owner_source_sha256':row['source_sha256'],'modes':modes,'shirt_only_trouser_ownership':'EXACT_EXISTING_TROUSER_LAYER_FOREGROUND_AT_WAIST','scope':'Only DS023 blazer/shirt-only body registrations. Suit renderer, other shirts, collar leaves, ties, trousers, avatar and hands unchanged.','limits':'Existing trousers have a straight upper edge and no separately supplied belt/waistband detail. Correct layer ownership does not reconstruct missing waistband detail. Small inherited source-collar/cuff transitions remain.','assetPaths':{m['base']['sha256']:m['base']['url']for m in modes.values()}}
for path,text in [('data/ds023-cleanup.json',json.dumps(record,indent=2)+'\n'),('data/ds023-cleanup.js','globalThis.HEWRS_DS023_CLEANUP='+json.dumps(record,separators=(',',':'))+';\n'),('evidence/ds023_v1_16_2/DERIVATION.json',json.dumps({'schema':'hewrs.ds023-derivation.v1_16_2','source_original_edited':False,'generative_image_tools_used':False,'new_rgb_generated':False,'checks':stats},indent=2)+'\n')]:write(path,text.encode())
print(json.dumps({'status':'PASS','new_base_layers':2,'checks':stats},indent=2))
