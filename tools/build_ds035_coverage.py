#!/usr/bin/env python3
"""Deterministic DS035-only extension. Never overwrites inherited source PNGs.

Uses native DS035 NO_TIE cloth for both presentations, and original alpha masks
only to locate the newly exposed opening. New RGB is reflected interior cloth
with a 1.1-pixel Gaussian smoothing of the derived field, never of a source.
"""
from pathlib import Path
import json,hashlib,sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
R=Path(__file__).resolve().parents[1]
BOX=(340,350,660,950)
CHECK_ONLY='--check' in sys.argv
p=json.loads((R/'data/inputs.json').read_text());m=p['manifest']
reg=json.loads((R/'vendor/cp98/REGISTER97.json').read_text())
h=lambda b:hashlib.sha256(b).hexdigest()
def read(d):
 path=R/'assets'/(d['sha256']+'.png');raw=path.read_bytes()
 assert h(raw)==d['sha256']
 with Image.open(path) as im:
  assert im.size==(996,2748) and im.mode=='RGBA'
  return np.array(im.crop(BOX))
def save(a):
 import io
 b=io.BytesIO();Image.fromarray(a).save(b,format='PNG');raw=b.getvalue();sha=h(raw)
 path=R/'assets'/(sha+'.png')
 if CHECK_ONLY:assert path.is_file() and path.read_bytes()==raw
 elif path.exists():assert path.read_bytes()==raw
 else:path.write_bytes(raw)
 return {'url':'assets/'+sha+'.png','sha256':sha,'rect':[0,0,996,2748]}
j5=read(m['static']['jacket']);j11=read(next(r for r in reg['items'] if r['suit_id']=='S11')['jacket'])
with Image.open(R/'data/reference/S11_CONTROL_ALPHA.png') as im:fixed=np.array(im.crop(BOX))
geom=(fixed>0)&(j5[:,:,3]==255)&(j11[:,:,3]<255)
cloth=read(m['shirts']['DS035']['states']['no_tie']['body'])
# Opaque neutral cloth only: exclude buttons, skin and source edge antialiasing.
valid=(cloth[:,:,3]==255)&(cloth[:,:,:3].min(2)>180)&(np.ptp(cloth[:,:,:3].astype('int16'),axis=2)<9)
valid=ndi.binary_erosion(valid,iterations=3)
assert valid.any()
_,indices=ndi.distance_transform_edt(~valid,return_indices=True)
yy,xx=np.indices(valid.shape)
wy=np.clip(2*indices[0]-yy,0,valid.shape[0]-1);wx=np.clip(2*indices[1]-xx,0,valid.shape[1]-1)
sy=indices[0][wy,wx];sx=indices[1][wy,wx]
field=cloth[sy,sx,:3].astype(float)
for k in range(3):field[:,:,k]=ndi.gaussian_filter(field[:,:,k],sigma=1.1)
field=np.rint(field).clip(0,255).astype('uint8')
result={'schema':'hewrs.ds035.s11.coverage.v1_3','source_shirt_id':'DS035','canvas':[996,2748],'roi':list(BOX),
 'owner_authorization_utc':'2026-09-22T04:42:10Z','new_integration_derivative':True,'owner_appearance_approval_claim':False,
 'wider_suit_ids':[r['suit_id'] for r in reg['items'] if r['template_in_cp93']=='S11'],
 'source_no_tie_body_sha256':m['shirts']['DS035']['states']['no_tie']['body']['sha256'],
 'operation':'Destination-underfill of nonopaque pixels in authorized masks; selected tie alpha support excluded at runtime. No scaling. No source modification.',
 'allowed_region_rule':'Within fixed S11 shirt-alpha support AND original S05 jacket alpha 255 AND S11 jacket alpha less than 255; subtract avatar/hands/collar/cuff support and fully opaque current body. Selected tie support is excluded at runtime.',
 'method':{'name':'reflected DS035 opaque neutral cloth with derived-field-only smoothing','erosion_pixels':3,'min_channel_gt':180,'max_channel_range_lt':9,'smoothing_sigma':1.1},'states':{}}
for mode in ['no_tie','tied']:
 c=m['shirts']['DS035']['states'][mode];body=read(c['body']);protected=np.zeros(geom.shape,bool)
 for d in [m['static'][k] for k in ['avatar','left_hand','right_hand']]+[c[k] for k in ['rear','left','right','left_cuff','right_cuff']]:protected|=read(d)[:,:,3]>0
 allow=geom&~protected&(body[:,:,3]<255)
 small=np.zeros_like(cloth);small[allow,:3]=field[allow];small[allow,3]=255
 full=np.zeros((2748,996,4),dtype='uint8');full[BOX[1]:BOX[3],BOX[0]:BOX[2]]=small
 desc=save(full);ys,xs=np.where(allow)
 result['states'][mode]={**desc,'role':'DS035_S11_'+mode.upper()+'_COVERAGE_EXTENSION','nontransparent_pixels':int(allow.sum()),'bbox_xyxy':[int(xs.min()+BOX[0]),int(ys.min()+BOX[1]),int(xs.max()+BOX[0]+1),int(ys.max()+BOX[1]+1)]}
result['assetPaths']={v['sha256']:v['url'] for v in result['states'].values()}
text=json.dumps(result,indent=2)+'\n';js='globalThis.HEWRS_DS035_COVERAGE='+json.dumps(result,separators=(',',':'))+';\n'
if CHECK_ONLY:
 assert (R/'data/ds035-coverage.json').read_text()==text
 assert (R/'data/ds035-coverage.js').read_text()==js
else:
 (R/'data/ds035-coverage.json').write_text(text)
 (R/'data/ds035-coverage.js').write_text(js)
print(json.dumps(result['states'],indent=2))
