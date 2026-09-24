#!/usr/bin/env python3
"""Build the DS035 image-right extraction-edge derivative. Original files are read-only.

This is a local colour correction, not a new garment render. Its only donor RGB
is existing DS035 fabric. A separate per-mode mask excludes the real collar,
neck and hands. The dark non-fabric fringe stored in the right-collar cutout is
explicitly identified separately from the light collar fabric. Tie exclusion
and the selected jacket's antialiasing are applied by the runtime.
"""
from pathlib import Path
import hashlib, io, json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
R=Path(__file__).resolve().parents[1]
CHECK='--check' in sys.argv
BOX=(340,350,660,950);x0,y0,x1,y1=BOX
sha=lambda b:hashlib.sha256(b).hexdigest()
p=json.loads((R/'data/inputs.json').read_text());m=p['manifest']
reg=json.loads((R/'vendor/cp98/REGISTER97.json').read_text())
cov=json.loads((R/'data/ds035-coverage.json').read_text())
inputs={}
def read(d):
 f=R/'assets'/(d['sha256']+'.png');b=f.read_bytes();assert sha(b)==d['sha256'];inputs[str(f.relative_to(R))]=sha(b)
 with Image.open(f) as im:
  assert im.size==(996,2748) and im.mode=='RGBA'
  return np.array(im.crop(BOX))
def write_bytes(f,b):
 if CHECK:assert f.is_file() and f.read_bytes()==b,str(f)
 else:f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(b)
def asset(arr,role):
 full=np.zeros((2748,996,4),dtype=np.uint8);full[y0:y1,x0:x1]=arr
 out=io.BytesIO();Image.fromarray(full).save(out,format='PNG');b=out.getvalue();h=sha(b);rel='assets/'+h+'.png'
 write_bytes(R/rel,b)
 return {'url':rel,'sha256':h,'rect':[0,0,996,2748],'role':role}
j5=read(m['static']['jacket']);j11=read(next(r for r in reg['items'] if r['suit_id']=='S11')['jacket'])
f=R/'data/reference/S11_CONTROL_ALPHA.png';inputs[str(f.relative_to(R))]=sha(f.read_bytes())
with Image.open(f) as im:fixed=np.array(im.crop(BOX))
distance=ndi.distance_transform_edt(j5[:,:,3]<128)
yy,xx=np.indices(fixed.shape);gx=xx+x0;gy=yy+y0
corridor=(distance<=14)&(gx>=490)&(gy>=430)&(gy<=820)&(fixed>0)&(j11[:,:,3]<255)
result={'schema':'hewrs.ds035.s11.edge.v1_5','canvas':[996,2748],'roi':list(BOX),'source_shirt_id':'DS035',
 'owner_instruction_utc':'2026-09-22T17:07:54Z','owner_appearance_approval_claim':False,
 'wider_suit_ids':cov['wider_suit_ids'],'original_body_hashes':{mode:m['shirts']['DS035']['states'][mode]['body']['sha256'] for mode in ['tied','no_tie']},
 'operation':'Local RGB edge cleanup after existing coverage; residual transparent dots filled only inside the same edge mask; selected tie support excluded; true jacket antialiasing recomposed with its original RGB and alpha.',
 'limits':['DS035 only','S11-template suits only','NO_TIE and 47 selectable ties only','No change to source images, wardrobe IDs, geometry, scoring or history'],
 'method':{'mask':'14-pixel inward corridor from prior S05 edge to S11 opening, image-right x>=490,y=430..820; 3-pixel inner feather',
 'collar_protection':'All collar supports except the recorded outer non-fabric fringe of the right-collar cutout are excluded. White collar shape and all neck/head pixels stay unchanged.',
 'right_collar_fringe_rule':'x>=570, y=438..518, within four source pixels of the old jacket edge, nonzero right-collar alpha and minimum RGB <175',
 'donor':'Current mode DS035 body; DS035 NO_TIE body below y=656 for tied mode where tied cloth is absent; opaque neutral pixels minRGB>185 and channel spread<7, more than 16 pixels inside original jacket boundary, x>480',
 'interpolation':'Nearest admissible donor with 1.25-pixel Gaussian smoothing of derived colour field only; original RGB is not blurred'},
 'states':{},'measurements':{}}
for mode in ['tied','no_tie']:
 c=m['shirts']['DS035']['states'][mode];body=read(c['body']);right=read(c['right']);
 fringe=(right[:,:,3]>0)&(right[:,:,:3].min(2)<175)&(gx>=570)&(gy>=438)&(gy<=518)&(distance<=4)
 protected=np.zeros(fixed.shape,dtype=bool)
 for d in [m['static'][k] for k in ['left_hand','right_hand']]+[c[k] for k in ['rear','left','left_cuff','right_cuff']]:protected|=read(d)[:,:,3]>0
 protected|=(right[:,:,3]>0)&~fringe
 # Do not paint exposed skin. Opaque fabric lying over the avatar is fabric,
 # not part of the visible neck/face; its original avatar image remains intact.
 avatar=read(m['static']['avatar']);prior=read(cov['states'][mode])
 protected|=(avatar[:,:,3]>0)&(body[:,:,3]==0)&(prior[:,:,3]==0)&~fringe
 allow=corridor&~protected
 donor=body.copy()
 if mode=='tied':
  nt=read(m['shirts']['DS035']['states']['no_tie']['body']);donor[gy>656]=nt[gy>656]
 clean=(donor[:,:,3]==255)&(distance>16)&(gx>480)&(donor[:,:,:3].min(2)>185)&(np.ptp(donor[:,:,:3].astype('int16'),axis=2)<7)
 assert clean.any()
 _,ix=ndi.distance_transform_edt(~clean,return_indices=True)
 field=donor[ix[0],ix[1],:3].astype(float)
 for k in range(3):field[:,:,k]=ndi.gaussian_filter(field[:,:,k],sigma=1.25)
 blend=np.clip((14-distance)/3,0,1);blend[j5[:,:,3]>=128]=1
 mask=allow&(blend>0)
 patch=np.zeros((*fixed.shape,4),dtype=np.uint8)
 patch[mask,:3]=np.rint(field[mask]).clip(0,255).astype(np.uint8);patch[mask,3]=np.rint(blend[mask]*255).astype(np.uint8)
 # Keep quantised zero-alpha RGB canonical.
 patch[patch[:,:,3]==0]=0;mask=patch[:,:,3]>0
 assert not np.any(mask&protected)
 d=asset(patch,'DS035_S11_'+mode.upper()+'_RIGHT_EDGE_CLEANUP')
 result['states'][mode]=d
 ys,xs=np.where(mask)
 result['measurements'][mode]={'patch_pixels':int(mask.sum()),'opaque_patch_pixels':int((patch[:,:,3]==255).sum()),'bbox_xyxy':[int(xs.min()+x0),int(ys.min()+y0),int(xs.max()+x0+1),int(ys.max()+y0+1)],
 'right_collar_nonfabric_fringe_pixels':int((fringe&mask).sum()),'protected_support_overlap':int((mask&protected).sum()),'donor_pixels':int(clean.sum()),'minimum_donor_RGB':int(donor[clean,:3].min()),'maximum_donor_channel_spread':int(np.ptp(donor[clean,:3].astype('int16'),axis=1).max())}
 # Separate test masks: never loaded in the application.
 test=np.zeros_like(patch);test[mask]=[255,255,255,255]
 buf=io.BytesIO();Image.fromarray(test).save(buf,format='PNG')
 write_bytes(R/'evidence/edge_v1_5'/f'{mode}_PERMITTED_MASK_ROI.png',buf.getvalue())
 buf=io.BytesIO();Image.fromarray(protected.astype('uint8')*255).save(buf,format='PNG')
 write_bytes(R/'evidence/edge_v1_5'/f'{mode}_PROTECTED_MASK_ROI.png',buf.getvalue())
result['assetPaths']={v['sha256']:v['url'] for v in result['states'].values()};result['input_hashes']=inputs
write_bytes(R/'data/ds035-edge.json',(json.dumps(result,indent=2)+'\n').encode())
write_bytes(R/'data/ds035-edge.js',('globalThis.HEWRS_DS035_EDGE='+json.dumps(result,separators=(',',':'))+';\n').encode())
print(json.dumps({'status':'PASS','check_only':CHECK,'states':result['measurements']}))
