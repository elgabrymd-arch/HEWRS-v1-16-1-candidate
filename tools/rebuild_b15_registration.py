from pathlib import Path
import json,hashlib,shutil
import numpy as np,cv2
from PIL import Image,ImageOps
from scipy.interpolate import RBFInterpolator
import argparse
parser=argparse.ArgumentParser(description='Reproduce the B15 source registration into a new output folder; no app edits.')
parser.add_argument('--app',type=Path,default=Path(__file__).resolve().parents[1])
parser.add_argument('--output',type=Path,required=True)
a=parser.parse_args();base=a.app.resolve();W=a.output.resolve();W.mkdir(parents=True,exist_ok=False)
record=json.loads((base/'data/additional-blazers.json').read_text())['records'][0]['binding']
photo=base/record['sourcePhoto']['path']
assert hashlib.sha256(photo.read_bytes()).hexdigest()==record['sourcePhoto']['sha256'],'Changed source photo'
im=ImageOps.exif_transpose(Image.open(photo)).convert('RGB');src=np.array(im);print('src',src.shape)
# Dense inverse mapping is registration only. Pixels come from this owner photo.
# Remove retail hanging labels/thread from the sampling field by shifting the
# sample into adjacent uninterrupted cloth. Original photo remains byte-exact.
clean=src.copy()
# Tag below second front button is outside the left panel's structural details.
# Here clone neighbouring cloth row pixels, avoiding tag/thread with no hue filter.
for y in range(990,1328):
 for x in range(519,653):
  if (y<1110 and abs(x-(580+(y-990)*.07))<12) or (y>=1110 and x>=523 and x<=650):
   clean[y,x]=src[y,max(345,x-180)]
# Retail tie-through label threads only; do not remove the garment buttons.
for y in range(938,1140):
 for x in range(552,615):
  if src[y,x].max()<110 and ((y<972 and x>574) or (y>991)):
   clean[y,x]=src[y, x-170]
# Coordinates are in native avatar canvas (996x2748) and supplied 984x1536 image.
left=[
((398,380),(421,112)),((317,445),(372,189)),((223,468),(300,172)),((126,475),(211,220)),
((286,510),(365,256)),((350,565),(416,342)),((424,785),(532,622)),
((419,540),(452,303)),((433,875),(567,804)),((449,1070),(573,978)),((438,1240),(575,1170)),((397,1438),(566,1370)),
((258,603),(328,403)),((234,800),(326,603)),((218,1003),(324,825)),
((225,1397),(299,1350)),((260,1428),(366,1380)),((363,1427),(501,1374)),
((257,1037),(326,949)),((372,1035),(458,949)),((357,1270),(461,1240)),((239,1274),(314,1237)),
((169,555),(260,299)),((96,632),(159,443)),((64,815),(120,662)),((57,950),(107,865)),
((74,1145),(113,1080)),((96,1324),(149,1276)),((178,1336),(250,1319)),
((196,1110),(275,1073)),((199,913),(285,892)),((210,717),(292,618)),
((152,1030),(214,993)),((143,850),(202,775)),((140,680),(201,550))]
right=[
((618,380),(661,246)),((690,449),(741,273)),((795,474),(846,356)),((872,482),(872,435)),
((615,532),(660,408)),((597,646),(622,543)),((573,793),(625,717)),((558,959),(628,866)),((544,1180),(633,1080)),((602,1440),(628,1340)),
((702,569),(736,495)),((765,690),(830,591)),((753,850),(838,776)),((771,1030),(837,937)),((751,1415),(828,1313)),
((627,1040),(696,959)),((749,1040),(831,939)),((741,1281),(830,1207)),((635,1290),(707,1233)),
((827,580),(862,550)),((913,630),(886,611)),((929,800),(899,758)),((942,940),(904,913)),((931,1132),(911,1092)),((884,1330),(910,1237)),((799,1342),(845,1242)),
((794,1115),(847,1087)),((786,920),(846,903)),((786,748),(843,729)),
((849,1030),(879,993)),((857,835),(876,826)),((852,673),(871,670)),
# pocket-side upper chest containing the owner's small metallic Z pin
((686,512),(711,345))]
alpha=np.array(Image.open(base/'assets/7e772b95f1268946fc0f23ba9d12428869117d086167636d470350008edb2387.png').getchannel('A'))
out=np.zeros((2748,996,4),dtype=np.uint8);out[:,:,3]=alpha
for pts,x0,x1 in [(left,0,499),(right,499,996)]:
 t=np.array([x[0] for x in pts],float);s=np.array([x[1] for x in pts],float)
 warp=RBFInterpolator(t,s,kernel='thin_plate_spline',smoothing=1)
 for y0 in range(375,1460,65):
  y1=min(1460,y0+65);yy,xx=np.mgrid[y0:y1,x0:x1];uv=warp(np.stack((xx,yy),axis=-1).reshape(-1,2)).reshape(y1-y0,x1-x0,2).astype(np.float32)
  out[y0:y1,x0:x1,:3]=cv2.remap(clean,uv[:,:,0],uv[:,:,1],cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
out[out[:,:,3]==0,:3]=0
image=Image.fromarray(out);p=W/'B15_NATIVE_DRAFT.png';image.save(p)
bg=Image.new('RGBA',image.size,'#18242f');bg.alpha_composite(image);bg.crop((15,365,975,1470)).convert('RGB').save(W/'B15_REGISTERED_PREVIEW.jpg')
(W/'REGISTRATION_CONTROL_POINTS.json').write_text(json.dumps({'owner_photo':photo.name,'left':left,'right':right,'target_template_alpha':'7e772b95f1268946fc0f23ba9d12428869117d086167636d470350008edb2387','method':'inverse thin plate spline; resampled owner photograph; garment-only alpha template','retail_tag_exclusion':'source sampling shift to adjacent cloth; original preserved'},indent=2))
print('image',p)
