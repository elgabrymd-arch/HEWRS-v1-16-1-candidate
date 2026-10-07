#!/usr/bin/env python3
"""Reproduce the garment-only B15 registration. Never modifies app files.
Requires numpy, opencv-python and Pillow. Defaults to hash verification in a
temporary directory. --output DIRECTORY saves the two reconstructed PNGs.
"""
from pathlib import Path
import argparse,hashlib,json,tempfile
import numpy as np,cv2
from PIL import Image
A=Path(__file__).resolve().parents[1];P=A/'provenance/b15_fit_v1_24_2'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def build(out):
 d=json.loads((P/'REGISTRATION.json').read_text());assert sha(P/'approved_card.png')==d['approved_source_sha256'];assert sha(P/'source_blazer_alpha.png')==d['source_mask_sha256']
 for n in ['visible_face_keep','source_shirt_aperture']:assert sha(P/(n+'.png'))==d[n+'_sha256']
 im=np.array(Image.open(P/'approved_card.png').convert('RGB'));m=np.array(Image.open(P/'source_blazer_alpha.png').convert('L'));inn=np.array(Image.open(P/'source_shirt_aperture.png').convert('L'));f=np.array(Image.open(P/'visible_face_keep.png').convert('L'))>0
 t=d['registration'];y,x=np.indices((2748,996),dtype=np.float32);sy=(y-t['target_neck_y'])/t['vertical_scale']+t['source_neck_y'];scale=np.interp(sy.ravel(),t['source_y_knots'],t['horizontal_scales']).reshape(sy.shape).astype(np.float32);center=np.interp(sy.ravel(),t['source_y_knots'],t['target_center_x']).reshape(sy.shape).astype(np.float32);sx=(x-center)/scale+t['source_center_x']
 alpha=cv2.remap(m,sx,sy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT);pm=im.astype(np.float32)*(m[...,None]/255.0);rgbpm=cv2.remap(pm,sx,sy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT);rgb=np.divide(rgbpm,np.maximum(alpha[...,None]/255.0,1e-6),out=np.zeros_like(rgbpm),where=alpha[...,None]>0);rgb=np.uint8(np.clip(np.rint(rgb),0,255));alpha[f]=0;rgb[alpha==0]=0
 out.mkdir(parents=True,exist_ok=True);lp=out/(d['output_layer_sha256']+'.png');assert not lp.exists(),'Refuse to overwrite';Image.fromarray(np.dstack([rgb,alpha]),'RGBA').save(lp);assert sha(lp)==d['output_layer_sha256'],'Registered pixels differ'
 allowed=cv2.remap(inn,sx,sy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT);allowed=cv2.dilate(np.uint8(allowed>32)*255,np.ones((9,9),np.uint8));own=np.full((2748,996),255,np.uint8);own[allowed>0]=0;own[:405]=0;op=out/(d['ownership_sha256']+'.png');assert not op.exists();Image.fromarray(own).save(op);assert sha(op)==d['ownership_sha256'],'Visibility mask differs'
 return {'passed':True,'registered_layer':lp.name,'ownership':op.name,'donor_avatar_and_other_garments_imported':False}
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path);a=p.parse_args()
 if a.output:print(json.dumps(build(a.output),indent=2))
 else:
  with tempfile.TemporaryDirectory() as t:print(json.dumps(build(Path(t)),indent=2))
