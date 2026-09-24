#!/usr/bin/env python3
"""Reconcile B01/B02 approved appearance references with their existing RGBA masks.
No generator, pose fitting, new silhouette, external photographs or catalogue remap.
The measured reference-to-canvas transforms apply to cloth RGB only. Alpha comes
byte-for-byte from each existing wearable layer. Originals are never overwritten.
"""
from pathlib import Path
import json,hashlib,io,zipfile,argparse
import numpy as np
from PIL import Image
import cv2
from scipy.ndimage import distance_transform_edt
R=Path(__file__).resolve().parents[1]
V=R/'vendor/b01_b02_v1_12'
# Fixed source-registration measurements, recorded from unchanged source controls.
TRANSFORMS={
 'B01':[[1.33439605,-0.00306439043,16.0669734],[0.00306439043,1.33439605,3.59149961]],
 'B02':[[1.38532327,0.00698141,-2.30857509],[-0.00698141,1.38532327,1.05864965]],
}
SOURCE_HASHES={
 'B01':'1ba95b711c267a1aa7f47086d44d36540e62dddf34e3f0e8684d283954dc04f6',
 'B02':'f4e06e9bd497cd275901e9619604f6699c7252a525a45e4fbd4653231fde1747',
}
def sha(data):return hashlib.sha256(data).hexdigest()
def arr(path):return np.asarray(Image.open(path).convert('RGBA')).copy()
def make(id,data):
 raw=(V/f'{id}_OWNER_APPROVED_VISUAL_REFERENCE.png').read_bytes()
 assert sha(raw)==SOURCE_HASHES[id], 'Approved reference changed'
 oldpath=R/data['blazers'][id]['checkpoint_layer']['url'];old=arr(oldpath)
 assert sha(oldpath.read_bytes())==data['blazers'][id]['checkpoint_layer']['sha256']
 ref=np.asarray(Image.open(io.BytesIO(raw)).convert('RGBA'))
 registered=cv2.warpAffine(ref,np.array(TRANSFORMS[id],dtype=np.float64),(996,2748),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
 alpha=old[:,:,3];area=alpha>0;rgb=registered[:,:,:3].astype(np.int16)
 # Reject source background, white shirt/cuffs and warm skin/tie pixels. These
 # navy source garments have blue >= red; this is a source-specific constraint,
 # not a generic wardrobe classifier. Only the coat mask is allowed to receive RGB.
 valid=area&(registered[:,:,3]>=240)&(rgb[:,:,2]>=rgb[:,:,0])&(rgb.max(2)<155)
 assert valid.any()
 assert (~valid&area).sum()/area.sum()<0.04, 'Excessive source-domain extension'
 distance,nearest=distance_transform_edt(~valid,return_indices=True)
 bad=area&~valid
 assert distance[bad].max()<30, 'Registration exceeds permitted boundary extension'
 out=np.zeros_like(old);out[:,:,:3][area]=registered[:,:,:3][area]
 out[:,:,:3][bad]=registered[nearest[0][bad],nearest[1][bad],:3]
 out[:,:,3]=alpha
 assert np.array_equal(out[:,:,3],old[:,:,3])
 assert not np.any(out[~area])
 # Audit the source of every output cloth sample. No RGB comes from another item.
 origin_y,origin_x=np.indices(area.shape)
 origin_y[bad]=nearest[0][bad];origin_x[bad]=nearest[1][bad]
 assert valid[origin_y[area],origin_x[area]].all()
 buf=io.BytesIO();Image.fromarray(out).save(buf,format='PNG',compress_level=9)
 payload=buf.getvalue();h=sha(payload)
 desc={'url':f'assets/{h}.png','sha256':h,'rect':[0,0,996,2748],'role':id+'_APPROVED_REFERENCE_RGB_EXISTING_WEARABLE_ALPHA'}
 result={'id':id,'source_reference_sha256':SOURCE_HASHES[id],'original_layer_sha256':data['blazers'][id]['checkpoint_layer']['sha256'],'source_reference_size':[ref.shape[1],ref.shape[0]],'cloth_rgb_registration_matrix':TRANSFORMS[id],'geometry_transform_applied':False,'original_alpha_sha256':sha(alpha.tobytes()),'output_alpha_sha256':sha(out[:,:,3].tobytes()),'alpha_pixels_changed':0,'nontransparent_coat_pixels':int(area.sum()),'direct_registered_reference_pixels':int(valid.sum()),'edge_source_resample_pixels':int(bad.sum()),'max_edge_resample_distance_px':float(distance[bad].max()) if bad.any() else 0,'rgb_sampling':'Fixed affine of this item’s approved reference only; invalid edge samples copy nearest valid same-item cloth. No skin, shirt, tie, shoe, background or another blazer sample.','output':desc,'new_layer_bytes':len(payload),'status':'OWNER_AUTHORIZED_RECONCILIATION_DERIVATIVE_NOT_AN_UNMODIFIED_ORIGINAL'}
 return payload,result

def main():
 a=argparse.ArgumentParser();a.add_argument('--check',action='store_true');args=a.parse_args()
 data=json.loads((R/'data/blazer-connection.json').read_text());results=[]
 for id in ['B01','B02']:
  payload,row=make(id,data);path=R/row['output']['url']
  if args.check:assert path.read_bytes()==payload, 'Derivative rebuild mismatch: '+id
  else:path.write_bytes(payload)
  results.append(row)
 report={'schema':'hewrs.b01-b02.appearance-bindings.v1_12','authorization':{'owner_message':'I approve b01/b02','owner_message_utc':'2026-09-23T03:57:47Z','scope':'Reconcile the existing layers with final B01 medium-navy appearance and B02 midnight micro-check/no-pocket-square references; use existing frozen garment masks and original IDs.'},'sources':results,'original_images_modified':0,'face_body_measurements_modified':False,'font_files_added':False,'dependencies':{'opencv':cv2.__version__,'numpy':np.__version__},'scope':'Clothing appearance connection, separate from the previously completed V1.11 UI-only facelift; no promotion of historical engine or avatar.'}
 if not args.check:(R/'evidence/b01_b02_v1_12/DERIVATION.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'check':args.check,'derivatives':len(results),'alpha_pixels_changed':0,'edge_source_resamples':{r['id']:r['edge_source_resample_pixels'] for r in results}}))
if __name__=='__main__':main()
