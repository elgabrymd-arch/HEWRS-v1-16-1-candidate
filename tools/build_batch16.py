#!/usr/bin/env python3
"""Expand V1.15 non-suit source registrations to 16 approved uploaded donors.
Never overwrites original runtime assets; only writes additive derived assets and
registry updates. --check reconstructs in memory and compares against the
installed derivative bytes.
"""
from pathlib import Path
import argparse,sys
sys.dont_write_bytecode=True
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
from PIL import Image,ImageDraw
from scipy import ndimage
import numpy as np, json,hashlib,io,importlib.util

R=Path(__file__).resolve().parents[1]
P=json.load(open(R/'data/inputs.json'))
M=P['manifest']
B=json.load(open(R/'data/blazer-connection.json'))
paths={**P['assets'],**B['assetPaths']}
W,H=996,2748
IDS=["DS004","DS005","DS007","DS015","DS018","DS019","DS023","DS024","DS025","DS047","DS002","DS006","DS008","DS021","DS022","DS027"]
CENTERS={'DS002':307,'DS004':295,'DS005':294,'DS006':302,'DS007':295,'DS008':304,'DS015':298,'DS018':292,'DS019':295,'DS021':307,'DS022':303,'DS023':297,'DS024':303,'DS025':303,'DS027':302,'DS047':302}
SOURCE_FILES={sid:next((R/'provenance/batch16_v1_16').glob(f'shirt-{sid}-generated*.webp')) for sid in IDS}
E=R/'evidence/batch16_v1_16';E.mkdir(parents=True,exist_ok=True)
PROV=R/'provenance/batch16_v1_16';PROV.mkdir(parents=True,exist_ok=True)

def load(d): return np.array(Image.open(R/paths[d['sha256']]).convert('RGBA'))
def sha(b):return hashlib.sha256(b).hexdigest()
def save_asset(arr,role):
 buf=io.BytesIO();Image.fromarray(arr).save(buf,format='PNG');raw=buf.getvalue();h=sha(raw);p='assets/'+h+'.png';f=R/p
 if f.exists():
  assert f.read_bytes()==raw
 else:
  if args.check: raise AssertionError('Missing derived asset: '+p)
  f.write_bytes(raw)
 paths[h]=p
 return {'sha256':h,'url':p,'rect':[0,0,W,H],'role':role}

spec=importlib.util.spec_from_file_location('frozen_torso',R/'provenance/open_collar_v1_13/original_code/torso.py');T=importlib.util.module_from_spec(spec);spec.loader.exec_module(T)
TA=T.alpha();Y,X=np.indices((H,W));template=load(B['assembly']['ties']['T001']);A=template[:,:,3]
body_edges={y:np.where(TA[y]>0)[0][[0,-1]] for y in range(H) if (TA[y]>0).any()}

records={};metrics=[]
for sid in IDS:
 f=SOURCE_FILES[sid]
 raw=f.read_bytes();src=np.array(Image.open(f).convert('RGBA'));sh,sw=src.shape[:2];center=CENTERS[sid]
 rgb=np.zeros((H,W,3),np.uint8)
 def sample(y_source,ss,xx):
  yy=int(np.clip(round(y_source),0,sh-1)); valid=np.where(src[yy,:,3]>=128)[0]
  valid=valid[(valid>=ss[0])&(valid<=ss[1])]
  if len(valid)==0: raise RuntimeError(sid+': no opaque source panel at '+str((yy,ss)))
  sx=np.interp(xx,[0,1],[valid[0],valid[-1]])
  li=np.clip(np.searchsorted(valid,sx),0,len(valid)-1);lo=np.maximum(li-1,0)
  use=np.where(abs(valid[li]-sx)<abs(valid[lo]-sx),valid[li],valid[lo])
  left=np.floor(sx).astype(int);right=np.minimum(left+1,sw-1);adj=(src[yy,left,3]>=128)&(src[yy,right,3]>=128)
  v=src[yy,use,:3].astype(float);frac=(sx-left)[:,None]
  v[adj]=(src[yy,left[adj],:3]*(1-frac[adj])+src[yy,right[adj],:3]*frac[adj])
  return np.rint(v).astype('uint8')
 for y in range(405,1290):
  xs=np.where(A[y]>0)[0]
  if len(xs)==0: continue
  outerL,outerR=xs[0],xs[-1]
  torsoLR=body_edges.get(y)
  if torsoLR is None: left,right=195,800
  else: left,right=torsoLR
  sy=np.interp(y,[405,500,1250],[36,70,sh-20])
  left_src=np.interp(sy,[36,100,sh-20],[242,214,214]);right_src=np.interp(sy,[36,100,sh-20],[365,390,385])
  for lx,rx,sl,sr in [(left,498,left_src,center),(499,right,center+1,right_src)]:
   if rx<lx: continue
   xx=np.arange(int(lx),int(rx)+1);t=(xx-lx)/max(1,rx-lx)
   rgb[y,xx]=sample(sy,(sl,sr),t)
  for side,lx,rx in [('L',outerL,left-1),('R',right+1,outerR)]:
   if rx<lx: continue
   yy=np.interp(y,[472,1290],[70,sh-2]);syi=int(np.clip(round(yy),0,sh-1));ssx=np.where(src[syi,:,3]>=128)[0]
   sleft,sright=ssx[0],ssx[-1]
   if side=='L': sl=sleft;sr=np.interp(yy,[70,150,sh-2],[207,213,208])
   else: sl=np.interp(yy,[70,150,sh-2],[399,390,390]);sr=sright
   if sl>sr: sl,sr=sorted([sl,sr])
   xx=np.arange(int(lx),int(rx)+1);rgb[y,xx]=sample(yy,(sl,sr),(xx-lx)/max(1,rx-lx))
 cc=dict(M['shirts'][sid]['states']['tied']);derived_cuffs={}
 for side,role in [('L','left_cuff'),('R','right_cuff')]:
  cf=load(cc[role]);ca=cf[:,:,3]
  if not (ca>0).any():
   stencil=load(B['assembly']['cuffs'][0 if side=='L' else 1]);cf=np.zeros_like(stencil);cf[:,:,3]=stencil[:,:,3];ca=cf[:,:,3]
   cy,cx=np.where(ca>0);y0,y1=cy.min(),cy.max()
   for yy in range(y0,y1+1):
    xx=np.where(ca[yy]>0)[0]
    if len(xx):
     sy=np.interp(yy,[y0,y1],[sh-45,sh-2]);lim=(0,208)if side=='L'else(391,599)
     cf[yy,xx,:3]=sample(sy,lim,(xx-xx[0])/max(1,xx[-1]-xx[0]))
   cc[role]=save_asset(cf,sid+'_'+role.upper()+'_SOURCE_DERIVED_FROM_UPLOADED_SLEEVE_EXISTING_CUFF_ALPHA');derived_cuffs[role]=cc[role]
  ys,xs=np.where(ca>128);by0,by1=ys.min(),ys.max()
  for y in range(1290,1389):
   sel=(A[y]>0)&((np.arange(W)<498)if side=='L'else(np.arange(W)>498));xx=np.where(sel)[0]
   if not len(xx): continue
   sy=int(round(np.interp(y,[1290,1388],[by0,by1])));vx=np.where(ca[sy]>128)[0]
   if not len(vx): sy=int(ys[np.argmin(abs(ys-sy))]);vx=np.where(ca[sy]>128)[0]
   sx=np.rint(np.interp(xx,[xx[0],xx[-1]],[vx[0],vx[-1]])).astype(int);rgb[y,xx]=cf[sy,sx,:3]
 base0=np.dstack((rgb,A.copy()))
 base0[330:426,345:657]=0
 modes={}
 for mode in ['no_tie','tied']:
  c=M['shirts'][sid]['states'][mode];new=base0.copy();upper=Image.new('RGBA',(W,H))
  for k in ['rear','body','left','right']: upper.alpha_composite(Image.fromarray(load(c[k])))
  u=np.array(upper)
  if mode=='no_tie':
   region=(Y>=330)&(Y<535)&(X>=375)&(X<620)
   labels,_=ndimage.label((u[:,:,3]==0)&region);seed=labels[335,498]
   if seed: new[(labels==seed)&region]=0
  out=Image.fromarray(new)
  body=load(c['body']).copy();edge=np.clip(np.minimum(X-350,649-X)/55,0,1);low=np.clip((837-Y)/165,0,1)
  body[:,:,3]=np.rint(body[:,:,3]*edge*low).astype('uint8')
  out.alpha_composite(Image.fromarray(body));out.alpha_composite(Image.fromarray(load(c['rear'])))
  new=np.array(out)
  allowed=(A>0)|((u[:,:,3]>0)&(Y<555));new[~allowed]=0
  new[555:,:,3]=A[555:]
  d=save_asset(new,sid+'_'+mode.upper()+'_SOURCE_REGISTERED_BASE_WITHOUT_FRONT_LEAVES')
  modes[mode]={'base':d,'left':c['left'],'right':c['right'],'left_cuff':cc['left_cuff'],'right_cuff':cc['right_cuff']}
  metrics.append({'id':sid,'mode':mode,'outside_existing_exterior_except_current_upper':int(np.sum((new[:,:,3]>0)&~allowed)),'unchanged_lower_exterior_alpha':bool(np.array_equal(new[555:,:,3],A[555:])),'rgba_sha256':sha(new.tobytes())})
 records[sid]={'id':sid,'history_id':'shirt-'+sid,'source_file':f.name,'source_sha256':sha(raw),'source_dimensions':[sw,sh],'placket_source_x':center,'derived_cuffs_for_empty_current_components':derived_cuffs,'modes':modes,'states':M['shirts'][sid]['available_modes'],'status':'CONNECTED_SOURCE_DERIVED_REGISTRATION','approval':'EXISTING_GARMENT_APPROVAL_UNCHANGED_NOT_NEW_DERIVATIVE_OWNER_ACCEPTANCE'}
 print('built body',sid,flush=True)

# full-length tie derivatives identical in logic to V1.15
old=load(B['assembly']['ties']['T001'])
pre=np.array(Image.open(R/'provenance/open_collar_v1_13/DS001_ORIGINAL_PRE_TIE_RECONSTRUCTION.png').convert('RGBA'))
region=(X>=375)&(X<624)&(Y>=520)&(Y<1198)
changed=(np.max(abs(old[:,:,:3].astype(int)-pre[:,:,:3].astype(int)),axis=2)>12)&region
labels,_=ndimage.label(changed);target=labels[700,498];assert target
full_mask=ndimage.binary_fill_holes(labels==target);mask=(full_mask*255).astype('uint8')
mask_desc=save_asset(np.dstack([mask,mask,mask,np.full_like(mask,255)]),'SOURCE_DIFFERENCE_FULL_TIE_BLADE_MASK')
ties={}
for tid in ['T'+str(i).zfill(3)for i in range(1,48)]:
 full=load(B['assembly']['ties'][tid]);cur=load(M['ties'][tid]['display_layer']);tie=np.zeros_like(full)
 keep=(mask>0)&(Y>=530);tie[keep]=full[keep];tie[keep,3]=mask[keep]
 top=cur.copy();top[530:]=0;out=Image.fromarray(tie);out.alpha_composite(Image.fromarray(top));tie=np.array(out)
 ties[tid]=save_asset(tie,tid+'_CURRENT_KNOT_EXISTING_FULL_LENGTH_BLADE')
 cp=cur[:530];assert np.array_equal(tie[:530],cp)
 assert all((tie[y,:,3]>0).any() for y in range(480,1186))

v11_sha='db02da603f7ce80be52e5cfe038d81a5f2d6ba8454f2634bf20999a346a2bd08'
record={'schema':'hewrs.non-suit-batch16.v1_16','canvas':[W,H],'source_input_sha256':sha((R/'data/inputs.json').read_bytes()),'ids':IDS,'shirts':records,'ties':ties,'assetPaths':{d['sha256']:d['url'] for row in records.values() for m in row['modes'].values() for d in [m['base'],m['left_cuff'],m['right_cuff']] if d['url'].startswith('assets/') and d['url'].count('/')==1} | {d['sha256']:d['url'] for d in ties.values()},'registration_scope':'Sixteen uploaded original-cohort shirt donors mapped into the existing DS001 full-shirt exterior; native current Active50 collars and nonempty cuffs preserved. DS002, DS004, DS005, DS015 and DS022 use separately documented source-derived cuffs for empty current components. The V11 replacement manifest does not replace these protected-original IDs and is metadata only.','source_resolution_limit':'Uploaded torso images are 600px wide and cropped at the lower sleeve/waist. This is a deterministic registration of available panels, NOT recovery of missing higher-resolution full-garment source bytes. Sleeves are fitted to the existing full-shirt geometry; cuff RGB is from the current same-ID cuff plates except the disclosed empty-cuff IDs, whose empty current cuffs are replaced only by separate derivatives sampled from their uploaded lower sleeves.','full_blade_source_mask':mask_desc,'v11_sha256':v11_sha}
json_text=json.dumps(record,indent=2)+'\n'
js_text='globalThis.HEWRS_BATCH10='+json.dumps(record,separators=(',',':'))+';\n'
for file,text in [('data/batch10.json',json_text),('data/batch10.js',js_text)]:
 if args.check:
  actual=(R/file).read_text()
  parse=lambda s:json.loads(s[len('globalThis.HEWRS_BATCH10='):].rstrip().removesuffix(';')) if s.startswith('globalThis.HEWRS_BATCH10=') else json.loads(s)
  assert parse(actual)==parse(text), 'Changed derivative registry: '+file
 else:
  (R/file).write_text(text)

ev={'schema':'hewrs.batch16.derivation.v1_16','shirts':metrics,'current_knots_preserved':47,'new_body_state_descriptors':len(IDS)*2,'unique_body_base_images':len({v['base']['sha256'] for r in records.values() for v in r['modes'].values()}),'new_tie_derivatives':47,'geometry_source':B['assembly']['ties']['T001'],'mapping':'Source panel coordinate registration with disclosed spatial interpolation and source-over blending; no procedural cloth, hue edit, tiling or AI generation. Current insert blending follows V1.13 edge/low feather; current collar leaves are composited after the tie.'}
evidence_text=json.dumps(ev,indent=2)+'\n'
if args.check:
 actual=json.loads((E/'DERIVATION_CHECKS.json').read_text());expected=json.loads(evidence_text)
 for obj in [actual,expected]:obj['shirts']=sorted(obj['shirts'],key=lambda r:(r['id'],r['mode']))
 assert actual==expected, 'Changed derivation result'
else: (E/'DERIVATION_CHECKS.json').write_text(evidence_text)
print('DONE',len(record['assetPaths']))
