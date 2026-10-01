"""Deterministic source-photo registration, not generated footwear.
Only shoe-15 RGB changes. Both original assets and reference bytes are retained.
The existing native alpha/position/size are immutable. Source RGB is resampled
without a tint, palette quantization, gain, contrast filter or invented texture.
"""
from pathlib import Path
import hashlib, json, shutil
import numpy as np
from PIL import Image
import cv2
W=Path(__file__).resolve().parents[1]; R=W/'evidence/shoe15_v1_23_1/image_checks'; R.mkdir(parents=True,exist_ok=True)
SRC=W/'ui/source-evidence/shoe-15-owner-reference-20261001.jpeg'
OLD='e4b03f004ef9a7df64c0927be229b4be6fa07336668e4eda66eaaca1226a80c4'
old=np.array(Image.open(W/'assets'/f'{OLD}.png').convert('RGBA'))
photo=np.array(Image.open(SRC).convert('RGB'))
# Landmarks are in an inspection-only coordinate frame rotated from the actual
# photo. Each point maps back into the original JPEG; no rotated JPEG is used
# as a source. This explicitly records the perspective registration assumption.
# Columns traverse shoe width; rows traverse tongue, strap, vamp, toe and sole.
fractions=np.array([0,.22,.28,.43,.65,.85,.965,1.0])
u_nodes=np.array([0,.22,.5,.78,1.0])
points=np.array([
 [[207,65],[218,43],[270,44],[320,54],[371,94]],
 [[197,146],[235,151],[301,158],[368,165],[411,169]],
 [[182,190],[220,200],[282,206],[355,218],[447,198]],
 [[168,270],[224,275],[297,288],[363,294],[417,300]],
 [[121,423],[166,432],[236,442],[327,397],[425,409]],
 [[96,571],[120,555],[172,564],[233,548],[325,553]],
 [[105,658],[117,675],[153,686],[212,674],[271,643]],
 [[112,688],[132,705],[168,712],[217,692],[258,665]],
],dtype=float)
new=old.copy(); mapped=[]
for side,(x0,x1) in enumerate([(320,490),(506,676)]):
 alpha=old[2541:2736,x0:x1,3]
 h,w=alpha.shape
 yy,xx=np.mgrid[0:h,0:w];valid=alpha>0
 # Row extents are the exact existing silhouette, not a newly estimated contour.
 left=np.array([np.flatnonzero(row)[0] if row.any() else 0 for row in valid])
 right=np.array([np.flatnonzero(row)[-1] if row.any() else w-1 for row in valid])
 u=np.clip((xx-left[:,None])/np.maximum(1,right-left)[:,None],0,1)
 if side==1:u=1-u
 t=yy/(h-1)
 ox=np.zeros((h,w));oy=np.zeros((h,w))
 for y in range(h):
  rowx=np.array([np.interp(t[y,0],fractions,points[:,k,0]) for k in range(5)])
  rowy=np.array([np.interp(t[y,0],fractions,points[:,k,1]) for k in range(5)])
  ox[y]=np.interp(u[y],u_nodes,rowx);oy[y]=np.interp(u[y],u_nodes,rowy)
 # Inverse inspection rotation -> pixels of the unchanged owner reference.
 du=ox-220;dv=oy-30
 sx=(910+.844*du-.536*dv).astype('float32')
 sy=(326+.536*du+.844*dv).astype('float32')
 rgb=cv2.remap(photo,sx,sy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
 region=new[2541:2736,x0:x1,:3];region[valid]=rgb[valid]
 mapped.append({'side':side,'target_bbox':[x0,2541,x1,2736],
                'source_x_range':[float(sx[valid].min()),float(sx[valid].max())],
                'source_y_range':[float(sy[valid].min()),float(sy[valid].max())]})
assert np.array_equal(new[:,:,3],old[:,:,3])
assert np.array_equal(new[old[:,:,3]==0],old[old[:,:,3]==0])
asset=W/'assets'/'SHOE15_TEMP.png';Image.fromarray(new).save(asset)
newhash=hashlib.sha256(asset.read_bytes()).hexdigest();dest=asset.with_name(newhash+'.png');asset.rename(dest)
# A separate thumbnail uses the real reference photograph, not the front render.
# Crop only surrounding background; preserve the supplied colors and shoe detail.
crop=Image.open(SRC).convert('RGB').crop((150,140,1300,915))
crop.thumbnail((384,448),Image.Resampling.LANCZOS)
thumb=Image.new('RGBA',(384,448),(0,0,0,0));thumb.paste(crop,((384-crop.width)//2,(448-crop.height)//2))
temp=W/'ui/option-cards/SHOE15_TEMP.png';thumb.save(temp)
th=hashlib.sha256(temp.read_bytes()).hexdigest();temp.rename(temp.with_name(th+'.png'))
refdest=W/'ui/source-evidence/shoe-15-owner-reference-20261001.jpeg';refdest.parent.mkdir(exist_ok=True);shutil.copyfile(SRC,refdest) if SRC.resolve()!=refdest.resolve() else None
sourcehash=hashlib.sha256(SRC.read_bytes()).hexdigest()
d={
 'schema':'hewrs.shoe-photo-correction.v1','revision':'shoe-15-photo-2026-10-01',
 'id':'shoe-15','source_input_sha256':'3e60ce18a0295c6801983ce91dda296efec458b275f523523dee1e3915db7516',
 'source':{'path':str(refdest.relative_to(W)),'sha256':sourcehash,'owner_supplied_at':'2026-10-01T01:45:56Z','correction_authorized_at':'2026-10-01T02:02:11Z','authority':'Latest owner-supplied appearance reference; not a color-calibrated measurement'},
 'baseline':{'sha256':OLD,'rect':[0,0,996,2748]},
 'layer':{'url':'assets/'+newhash+'.png','sha256':newhash,'rect':[0,0,996,2748],'role':'selected_registered_shoe_pair'},
 'display_name':'Loro Piana Loafers — Warm Brown Suede Penny',
 'visual_description':'Warm tobacco/chestnut-brown appearance with subtle mottling and a black sole, matched to the supplied reference lighting.',
 'color_family_preserved':'brown','legacy_scoring_color_preserved':'Brown Suede Penny',
 'brand_basis':'Retained catalogue identity; not independently inferred from this photograph.',
 'registration':{'method':'Recorded source-photo pixel resampling into the exact pre-existing shoe-15 alpha; mirrored second shoe. No hue, saturation, brightness or contrast filter. Perspective is an approximation, not a recovered front photograph.',
 'target_canvas':[996,2748],'unchanged_alpha':True,'row_fractions':fractions.tolist(),'cross_shoe_fractions':u_nodes.tolist(),'oriented_source_landmarks':points.tolist(),'inverse_orientation':{'origin':[910,326],'u_axis':[.844,.536],'v_axis':[-.536,.844],'offset':[220,30]},'maps':mapped},
 'thumbnail':{'src':'ui/option-cards/'+th+'.png','sha256':th,'width':384,'height':448,'source_key':'shoe-15','source_kind':'owner_reference_photo','source_sha256':sourcehash,'crop':[150,140,1300,915]},
 'limits':['Only shoe-15 is corrected.','No other footwear is restored or recolored.','No physical iPhone or live-site validation is implied.','Existing silhouette and shoe placement are retained.','This asset is not an owner approval of a new front-view geometry.']
}
(W/'data/shoe-photo-corrections.json').write_text(json.dumps(d,indent=2)+'\n')
(W/'data/shoe-photo-corrections.js').write_text('globalThis.HEWRS_SHOE_PHOTO_CORRECTION='+json.dumps(d,separators=(',',':'))+';\n')
t=json.loads((W/'data/option-card-thumbnails.json').read_text());t['shoes']['shoe-15']=d['thumbnail']
(W/'data/option-card-thumbnails.json').write_text(json.dumps(t,indent=2)+'\n')
(W/'data/option-card-thumbnails.js').write_text('globalThis.HEWRS_OPTION_CARD_THUMBNAILS='+json.dumps(t,separators=(',',':'))+';\n')
# Internal visual check: displayed with the same neutral backing, not recolored.
for label,a in [('before',old),('after',new)]:
 im=Image.fromarray(a).crop((310,2535,686,2744));b=Image.new('RGBA',im.size,(235,232,225,255));b.alpha_composite(im)
 b.convert('RGB').resize((752,418),Image.Resampling.LANCZOS).save(R/(label+'_registration.jpg'))
print(json.dumps({'new_asset':newhash,'thumbnail':th,'reference':sourcehash,'changed_rgb_pixels':int(np.count_nonzero(np.any(new[:,:,:3]!=old[:,:,:3],axis=2))),'changed_alpha_pixels':int(np.count_nonzero(new[:,:,3]!=old[:,:,3]))},indent=2))
