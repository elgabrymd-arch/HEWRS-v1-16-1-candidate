#!/usr/bin/env python3
"""Reconstruct the DS001/DS014 no-tie connection. Originals stay immutable."""
from pathlib import Path
from PIL import Image
import numpy as np,json
from scipy import ndimage
R=Path(__file__).resolve().parents[1];p=json.loads((R/'data/inputs.json').read_text());b=json.loads((R/'data/blazer-connection.json').read_text());W,H=996,2748
load=lambda d: np.array(Image.open(R/(p['assets'].get(d['sha256']) or d['url'])).convert('RGBA'))
old=load(b['assembly']['ties']['T001']);pre=np.array(Image.open(R/'provenance/open_collar_v1_13/DS001_ORIGINAL_PRE_TIE_RECONSTRUCTION.png').convert('RGBA'))
s=p['manifest']['shirts']['DS001']['states']['no_tie'];upper=Image.new('RGBA',(W,H))
for k in ['rear','body','left','right']:upper.alpha_composite(Image.fromarray(load(s[k])))
u=np.array(upper)
# Source reconstruction replaces only the old baked-in tie and its edge shadow.
region=np.zeros((H,W),bool);region[420:1198,375:624]=True
removed=ndimage.binary_dilation((np.max(abs(old[:,:,:3].astype(int)-pre[:,:,:3].astype(int)),axis=2)>12)&region,iterations=5)&region&(old[:,:,3]>0)
new=old.copy();new[removed,:3]=pre[removed,:3]
# Strip the older closed collar within its original narrow upper-neck envelope.
neck=np.zeros((H,W),bool);neck[330:426,345:657]=True
new[neck]=0
# For the exposed neck below that envelope, the newer source opening is used.
# Top-connected transparency distinguishes the neck opening from shirt fabric.
bounds=np.zeros((H,W),bool);bounds[330:535,375:620]=True
zero=(u[:,:,3]==0)&bounds
lab,n=ndimage.label(zero);seed=lab[335,498];open_neck=(lab==seed)&bounds if seed else np.zeros_like(bounds)
new[open_neck]=0
# Native current open-collar/body inserted in place. Only its lower and lateral
# photo crop transitions are feathered; collar leaves and buttons at the neck
# keep their native source pixels.
source=load(s['body']);a=source[:,:,3].astype(float)/255
Y,X=np.indices((H,W));edge=np.clip(np.minimum(X-350,649-X)/55,0,1);low=np.clip((837-Y)/165,0,1)
weight=edge*low;source=source.copy();source[:,:,3]=np.rint(source[:,:,3]*weight).astype('uint8')
base=Image.fromarray(new);base.alpha_composite(Image.fromarray(source))
for k in ['rear','left','right']:
 # rear is empty for this source; front leaves remain native.
 base.alpha_composite(Image.fromarray(load(s[k])))
new=np.array(base)
# The fullshirt never acquires a pixel outside the old exterior except the
# exact newly bound collar/body source above its upper trunk.
allowed=(old[:,:,3]>0)|((u[:,:,3]>0)&(Y<555));new[~allowed]=0
import io,hashlib,argparse
buf=io.BytesIO();Image.fromarray(new).save(buf,format='PNG');raw=buf.getvalue();sha=hashlib.sha256(raw).hexdigest()
expected=b['assembly']['no_tie']['sha256']
assert sha==expected, f'Derivative reconstruction mismatch: {sha}'
parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
if args.check:assert (R/'assets'/f'{sha}.png').read_bytes()==raw
else:(R/'assets'/f'{sha}.png').write_bytes(raw)
mask=np.any(new!=old,axis=2);Y,X=np.indices((H,W));permitted=(X>=345)&(X<657)&(Y>=330)&(Y<1198)
assert not np.any(mask&~permitted), 'Out-of-scope pixel change'
assert np.array_equal(new[1198:],old[1198:])
print(json.dumps({'sha256':sha,'changed_pixels':int(mask.sum()),'outside_permitted_change_region':int((mask&~permitted).sum()),'mode':'exact source-derived reconstruction','old_full_shirt_sha256':b['assembly']['ties']['T001']['sha256']}))
