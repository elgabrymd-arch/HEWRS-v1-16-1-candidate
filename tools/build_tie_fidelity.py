#!/usr/bin/env python3
"""Rebuild 47 tie displays directly from the supplied source library.
The original opacity bytes, logical canvas, physical IDs, and non-tie pixels
are preserved. No sharpening, generated weave, image upscaler or RGB recolour
is applied. --check reconstructs and compares without modifying source files.
Requires Pillow, NumPy and SciPy, as in the retained garment construction code.
"""
from pathlib import Path
import sys,os,argparse,json,hashlib,io,importlib.util
sys.dont_write_bytecode=True
from PIL import Image
import numpy as np
from scipy.ndimage import map_coordinates,binary_fill_holes,label
A=argparse.ArgumentParser(description=__doc__);A.add_argument('--check',action='store_true');args=A.parse_args()
R=Path(__file__).resolve().parents[1];S=R/'provenance/tie_fidelity_v1_17_2';E=R/'evidence/tie_fidelity_v1_17_2';E.mkdir(parents=True,exist_ok=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def json_file(p):return json.loads((R/p).read_text())
for row in json_file('provenance/tie_fidelity_v1_17_2/SOURCE_FILES.json')['files']:
 raw=(S/row['path']).read_bytes();assert len(raw)==row['bytes']and sha(raw)==row['sha256'],row['path']
os.environ['HEWRS_ASSETS']=str(S)
def module(n):
 spec=importlib.util.spec_from_file_location(n,R/f'provenance/open_collar_v1_13/original_code/{n}.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
TS=module('tie_source');KR=module('knot_r3');shade,ka=KR.shading_field()
yk,xk=np.where(ka>=128);kb=(int(xk.min()),int(yk.min()),int(xk.max()+1),int(yk.max()+1));sf=shade[kb[1]:kb[3],kb[0]:kb[2]]
P=json_file('data/inputs.json');B=json_file('data/blazer-connection.json');D=json_file('data/batch10.json');ED=json_file('data/ds023-edges.json')
paths={**P['assets'],**B['assetPaths'],**D['assetPaths'],**ED['assetPaths']};IDS=[f'T{i:03}'for i in range(1,48)]

def load(d):
 p=R/paths[d['sha256']];assert sha(p.read_bytes())==d['sha256'];return np.array(Image.open(p).convert('RGBA'))

def sample(src,y,x):
 y=np.clip(y,0,src.shape[0]-1);x=np.clip(x,0,src.shape[1]-1)
 y0=np.floor(y).astype(int);x0=np.floor(x).astype(int);y1=np.minimum(y0+1,src.shape[0]-1);x1=np.minimum(x0+1,src.shape[1]-1)
 fy=(y-y0)[:,None];fx=(x-x0)[:,None]
 return (src[y0,x0,:3]*(1-fx)+src[y0,x1,:3]*fx)*(1-fy)+(src[y1,x0,:3]*(1-fx)+src[y1,x1,:3]*fx)*fy

def texture(old,src,kind,mask=None):
 out=old.copy();aa=old[:,:,3]if mask is None else mask
 ys,xs=np.where(aa>0);ymin,ymax=int(ys.min()),int(ys.max());knotbottom=549 if kind=='legacy'else 530
 cy=np.where((src[:,:,3]>=250).any(1))[0];sbot=int(cy.max());medsource=float(np.median([np.count_nonzero(src[y,:,3]>=250)for y in range(sbot-250,sbot-80)]))
 targetwidth=max(np.count_nonzero(aa[y]>127)for y in range(knotbottom,ymax+1));factor=medsource/max(targetwidth,1);start=max(int(cy.min()),sbot-(ymax-knotbottom)*factor)
 nky,nkx=np.where(aa[:knotbottom]>0);kx0,kx1=int(nkx.min()),int(nkx.max())
 for y in range(ymin,ymax+1):
  xx=np.where(aa[y]>0)[0]
  if not len(xx):continue
  if y<knotbottom:
   yn=(y-ymin)/max(1,knotbottom-ymin-1);sy=1150+yn*95
   sx=498+(xx-(kx0+kx1)/2)*(130/max(1,kx1-kx0))
   rgb=sample(src,np.full(len(xx),sy),sx)
   shx=(xx-kx0)/max(1,kx1-kx0)*(sf.shape[1]-1);shy=np.full(len(xx),yn*(sf.shape[0]-1))
   sh=map_coordinates(sf,[shy,shx],order=1,mode='nearest',prefilter=False)
   rgb=rgb*np.clip(sh,.62,1.30)[:,None]
  else:
   sy=np.interp(y,[knotbottom,ymax],[start,sbot]);yi=int(round(sy));v=np.where(src[yi,:,3]>=250)[0];assert len(v)
   sx=np.interp(xx,[xx[0],xx[-1]],[v[0],v[-1]])if len(xx)>1 else np.array([(v[0]+v[-1])/2])
   rgb=sample(src,np.full(len(xx),sy),sx)
  out[y,xx,:3]=np.clip(np.rint(rgb),0,255).astype('uint8')
 return out,{'kind':kind,'knot_source_band':[1150,1245],'knot_photographic_form_source':kb,'knot_form_sigma':KR.FORM_SIGMA,'knot_form_clip':list(KR.FORM_CLIP),'blade_source_rows':[float(start),sbot],'target_blade_rows':[knotbottom,ymax],'native_source_body_width':medsource,'target_max_body_width':int(targetwidth),'sampling':'one bilinear sampling of source RGB at each output coordinate; no sharpening or repeated scaling; source crop avoids compression of the complete blade into short suit opening'}

# The legacy DS001/DS014 routes bake ties into full-shirt images. Differing
# pixels across all 47 same-shirt masters identify tie ownership; crop to the
# retained documented tie rectangle and retain its exact nonzero shape.
ref=load(B['assembly']['ties']['T001']);variation=np.zeros(ref.shape[:2],bool)
for tid in IDS:variation|=np.any(load(B['assembly']['ties'][tid])[:,:,:3]!=ref[:,:,:3],axis=2)
roi=np.zeros_like(variation);roi[433:1188,422:575]=1
candidate=variation&roi;labs,n=label(candidate);sizes=np.bincount(labs.ravel());sizes[0]=0
legacy_mask=(labs==int(sizes.argmax()))&roi
legacy_mask=binary_fill_holes(legacy_mask)&roi
assert not legacy_mask[:433].any()and not legacy_mask[1188:].any()

entries=[];tie_records={};assetPaths={};metrics=[]
def write_bytes(p,raw):
 q=R/p
 if q.exists():assert q.read_bytes()==raw,'Different existing bytes: '+p
 elif args.check:raise AssertionError('Missing output '+p)
 else:q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(raw)
def emit(old_desc,old,new,tid,role,method,visible_mask):
 assert np.array_equal(old[:,:,3],new[:,:,3]),'Changed source opacity'
 assert np.array_equal(old[~visible_mask],new[~visible_mask]),'Changed nontie RGB'
 buf=io.BytesIO();Image.fromarray(new).save(buf,format='PNG');raw=buf.getvalue();h=sha(raw);p='assets/'+h+'.png';write_bytes(p,raw);assetPaths[h]=p
 d={'url':p,'sha256':h,'rect':[0,0,996,2748],'role':tid+'_'+role.upper()+'_DIRECT_SOURCE_TEXTURE'}
 yy,xx=np.where(np.any(old!=new,axis=2));bounds=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
 entries.append({'id':tid,'kind':role,'baseline':old_desc,'layer':d,'allowed_mask':'legacy_ownership'if role=='legacy'else'baseline_alpha','mapping':method})
 metrics.append({'id':tid,'kind':role,'alpha_changed':int(np.count_nonzero(old[:,:,3]!=new[:,:,3])),'rgb_changed_pixels':int(len(xx)),'changed_bounds':bounds,'outside_allowed_changed_pixels':int(np.count_nonzero(np.any(old!=new,axis=2)&~visible_mask)),'rgba_sha256':sha(new.tobytes())})
 return d

mask_img=np.zeros((2748,996,4),np.uint8);mask_img[:,:,:3]=legacy_mask[:,:,None]*255;mask_img[:,:,3]=255
buf=io.BytesIO();Image.fromarray(mask_img).save(buf,format='PNG');mask_raw=buf.getvalue();mask_hash=sha(mask_raw);mask_path='assets/'+mask_hash+'.png';write_bytes(mask_path,mask_raw);assetPaths[mask_hash]=mask_path
mask_desc={'url':mask_path,'sha256':mask_hash,'rect':[0,0,996,2748],'role':'TIE_ONLY_LEGACY_DIFFERENCE_OWNERSHIP_MASK'}
for tid in IDS:
 src,source_method=TS.load(tid);used=['ties_clean/'+tid+'-generated.webp']
 if tid in TS.REPAIRED and tid not in TS.REPAIR_REJECTED:used.append('padded_repaired/'+tid+'-generated.webp')
 tie_records[tid]={'id':tid,'sources':[{'path':n,'sha256':sha((S/n).read_bytes())}for n in used],'source_policy':source_method,'repair_rejected':tid in TS.REPAIR_REJECTED,'layers':{}}
 for kind,desc in [('suit',P['manifest']['ties'][tid]['display_layer']),('non_suit',D['ties'][tid]),('legacy',B['assembly']['ties'][tid])]:
  old=load(desc);vm=legacy_mask if kind=='legacy'else old[:,:,3]>0;new,mapping=texture(old,src,kind,legacy_mask.astype('uint8')*255 if kind=='legacy'else None)
  nd=emit(desc,old,new,tid,kind,mapping,vm);tie_records[tid]['layers'][kind]=nd
  if tid=='T017'and kind=='non_suit':
   special_desc=ED['layers']['T017']['layer'];special_old=load(special_desc);special=special_old.copy();sel=special_old[:,:,3]>0;special[sel,:3]=new[sel,:3]
   tie_records[tid]['layers']['ds023_T017']=emit(special_desc,special_old,special,tid,'ds023_T017',{'inherits':'non_suit direct source RGB','alpha':'unchanged accepted DS023/T017 edge correction'},sel)
 print(tid,source_method,flush=True)
record={'schema':'hewrs.tie-fidelity.v1_17_2','version':'1.17.2','canvas':[996,2748],'source_input_sha256':sha((R/'data/inputs.json').read_bytes()),'baseline_version':'1.17.1','ids':IDS,'ties':tie_records,'bindings':entries,'assetPaths':assetPaths,'legacy_ownership_mask':mask_desc,'legacy_mask_source':'same-shirt 47-master RGB differences, largest tie component within original extraction rectangle [422,433,575,1188]','current_frozen_geometry_retained':True,'native_runtime_resolution_unchanged':True,'quality_boundary':'Source texture detail is restored directly, not invented by upscaling. Source tie artwork is approximately 153 pixels wide, not 996; current logical 996x2748 canvas and tie opacity remain fixed. Display zoom still magnifies finite source pixels. Existing alpha notches are deliberately unchanged. Recorded source-selection policy retains repaired cloth for 12 IDs and rejects repairs for T003/T005/T006/T009. Source RGB is sampled for cloth; existing photographic knot-form shading is applied only to the knot.'}
for name,txt in [('data/tie-fidelity.json',json.dumps(record,indent=2)+'\n'),('data/tie-fidelity.js','globalThis.HEWRS_TIE_FIDELITY='+json.dumps(record,separators=(',',':'))+';\n'),('evidence/tie_fidelity_v1_17_2/DERIVATION.json',json.dumps({'schema':'hewrs.tie-fidelity.derivation.v1_17_2','ties':47,'image_bindings':len(entries),'runtime_outputs':len(assetPaths),'checks':metrics,'no_new_opacity':True,'no_nontie_pixels_changed':True,'legacy_mask_pixels':int(legacy_mask.sum())},indent=2)+'\n')]:
 if args.check:assert (R/name).read_text()==txt,'Output registry differs: '+name
 else:(R/name).parent.mkdir(parents=True,exist_ok=True);(R/name).write_text(txt)
print(json.dumps({'status':'PASS','ids':len(IDS),'bindings':len(entries),'runtime_outputs':len(assetPaths),'read_only_check':args.check}))
