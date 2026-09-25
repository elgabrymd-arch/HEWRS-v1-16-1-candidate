#!/usr/bin/env python3
"""Reproduce four bounded alpha-only DS023 edge derivatives. --check is read-only.
No fitting or resampling during replay: all contour positions are pinned at
1/256 native pixel. RGB is copied unchanged, including RGB under transparency.
Requires Pillow and NumPy. Does not access GitHub or browser user data.
"""
from pathlib import Path
import argparse,hashlib,io,json,sys
sys.dont_write_bytecode=True
from PIL import Image
import numpy as np
R=Path(__file__).resolve().parents[1]
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--check',action='store_true');args=ap.parse_args()
 sha=lambda b:hashlib.sha256(b).hexdigest()
 def readj(n):return json.loads((R/n).read_text())
 P=readj('data/inputs.json');B=readj('data/batch10.json');F=readj('data/ds023-cleanup.json');prof=readj('provenance/edges_v1_16_3/PROFILES.json')
 paths={**P['assets'],**B['assetPaths'],**F['assetPaths']};W,H=996,2748
 original={'base':F['modes']['tied']['base'],**{k:B['shirts']['DS023']['modes']['tied'][k]for k in ['left','right']},'T017':B['ties']['T017']}
 arrays={}
 for k,d in original.items():
  raw=(R/paths[d['sha256']]).read_bytes();assert sha(raw)==d['sha256'];v=np.array(Image.open(io.BytesIO(raw)).convert('RGBA'));assert v.shape==(H,W,4);arrays[k]=v
 def write(n,raw):
  p=R/n
  if p.exists():assert p.read_bytes()==raw,'Different existing output: '+n
  elif args.check:raise AssertionError('Missing output: '+n)
  else:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
 n=prof['neck'];x0,x1=n['x_start'],n['x_end_exclusive'];y0,y1=n['y_start'],n['y_end_exclusive']
 z=np.array(n['boundary_y_256'],float)/256;assert len(z)==x1-x0
 neck=np.rint(np.clip(np.arange(y0,y1)[:,None]-z[None,:]+.5,0,1)*255).astype('uint8')
 t=prof['knot'];ty0,ty1=t['y_start'],t['y_end_exclusive'];left=np.array(t['left_x_256'],float)/256;right=np.array(t['right_x_256'],float)/256
 assert len(left)==len(right)==ty1-ty0;assert np.all(right>left)
 xs=np.arange(W)[None,:];tie=np.rint(255*np.minimum(np.clip(xs-left[:,None]+.5,0,1),np.clip(right[:,None]-xs+.5,0,1))).astype('uint8')
 records={};checks=[]
 for k,a in arrays.items():
  new=a.copy();roi=np.zeros((H,W),bool)
  if k=='T017':
   new[ty0:ty1,:,3]=np.minimum(a[ty0:ty1,:,3],tie);roi[ty0:ty1]=True
  else:
   new[y0:y1,x0:x1,3]=np.minimum(a[y0:y1,x0:x1,3],neck);roi[y0:y1,x0:x1]=True
  assert np.array_equal(new[:,:,:3],a[:,:,:3]);assert np.all(new[:,:,3]<=a[:,:,3]);changed=new[:,:,3]!=a[:,:,3]
  assert not np.any(changed&~roi);yy,xx=np.where(changed)
  buf=io.BytesIO();Image.fromarray(new).save(buf,format='PNG');raw=buf.getvalue();h=sha(raw);url='assets/'+h+'.png';write(url,raw)
  records[k]={'baseline':original[k],'layer':{'url':url,'sha256':h,'rect':[0,0,W,H],'role':'DS023_TIED_'+k.upper()+'_EDGE_MATTE_V1163'}}
  checks.append({'role':k,'rgba_before_sha256':sha(a.tobytes()),'rgba_after_sha256':sha(new.tobytes()),'alpha_changed_pixels':int(changed.sum()),'changed_bounds':[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)] if len(xx) else None,'rgb_changed_pixels':0,'alpha_added_pixels':0,'outside_bounded_matte_changed_pixels':0})
  assert len(xx)>0
 record={'schema':'hewrs.ds023-local-edges.v1_16_3','id':'DS023','history_id':'shirt-DS023','canvas':[W,H],'source_input_sha256':sha((R/'data/inputs.json').read_bytes()),'profile_sha256':sha((R/'provenance/edges_v1_16_3/PROFILES.json').read_bytes()),'applies_to_modes':['blazer','shirt-only'],'applies_to_neck':'DS023_TIED_ONLY','applies_to_knot':'DS023_T017_ONLY','layers':records,'assetPaths':{v['layer']['sha256']:v['layer']['url']for v in records.values()},'scope':'Separate matte-trimmed body, front-collar leaves and T017 derivative. NO_TIE, all suits, all other shirts, avatar, garment transforms, tie-pattern RGB, remaining tie registrations and lower garment content unchanged.','limits':'Original avatar outer-neck cutout and simplified straight waistband remain. Low-resolution cloth and tie source detail are not reconstructed. Edge trimming does not imply new owner acceptance.'}
 for path,text in [('data/ds023-edges.json',json.dumps(record,indent=2)+'\n'),('data/ds023-edges.js','globalThis.HEWRS_DS023_EDGES='+json.dumps(record,separators=(',',':'))+';\n'),('evidence/edges_v1_16_3/DERIVATION.json',json.dumps({'schema':'hewrs.ds023-local-edges.derivation.v1_16_3','checks':checks,'no_source_overwrite':True,'new_rgb_generated':False,'original_geometry_or_avatar_changed':False},indent=2)+'\n')]:write(path,text.encode())
 print(json.dumps({'status':'PASS','checks':checks},indent=2))
if __name__=='__main__':main()
