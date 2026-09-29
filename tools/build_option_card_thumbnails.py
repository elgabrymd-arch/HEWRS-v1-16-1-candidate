#!/usr/bin/env python3
"""Presentation-only crops of existing wardrobe layers. No original pixels/files rewritten.
Run --check to replay deterministically and compare installed UI thumbnail bytes.
"""
from pathlib import Path
import argparse,json,hashlib,io
from PIL import Image
R=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser(description=__doc__);a.add_argument('--check',action='store_true');args=a.parse_args()
P=json.loads((R/'data/inputs.json').read_text());F=json.loads((R/'data/tie-fidelity.json').read_text());paths={**P['assets'],**F['assetPaths']}
thumbs={'shirts':{},'ties':{},'shoes':{}}
def sh(b):return hashlib.sha256(b).hexdigest()
def img(d):
 p=paths[d['sha256']];raw=(R/p).read_bytes();assert sh(raw)==d['sha256'];return Image.open(io.BytesIO(raw)).convert('RGBA')
def write(rel,raw):
 p=R/rel
 if args.check:assert p.read_bytes()==raw,rel
 else:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
def save(group,id,im,box,sources):
 cropped=im.crop(box);out=Image.new('RGBA',(240,240));cropped.thumbnail((224,224),Image.Resampling.LANCZOS);out.alpha_composite(cropped,((240-cropped.width)//2,(240-cropped.height)//2))
 b=io.BytesIO();out.save(b,format='PNG');raw=b.getvalue();h=sh(raw);rel='ui-assets/option-cards/'+id+'.png';write(rel,raw)
 thumbs[group][id]={'id':id,'url':rel,'sha256':h,'width':240,'height':240,'crop_xyxy':list(box),'source_layers':[{'path':paths[d['sha256']],'sha256':d['sha256']}for d in sources],'kind':'shirt-collar-source-detail'if group=='shirts'else'tie-source-detail'if group=='ties'else'registered-shoe-pair'}
for id,s in P['manifest']['shirts'].items():
 c=s['states']['no_tie'];im=Image.new('RGBA',(996,2748));sources=[c[k]for k in ['rear','body','left','right']]
 for d in sources:im.alpha_composite(img(d))
 save('shirts',id,im,(345,387,650,705),sources)
for b in F['bindings']:
 if b['kind']!='suit':continue
 im=img(b['layer']);bounds=im.getchannel('A').getbbox();x0,y0,x1,y1=bounds
 save('ties',b['id'],im,(x0-5,y0-5,x1+5,min(y1,y0+215)),[b['layer']])
for id,d in P['shoeLayers'].items():
 im=img(d);x0,y0,x1,y1=im.getchannel('A').getbbox();save('shoes',id,im,(max(0,x0-8),max(0,y0-8),min(996,x1+8),min(2748,y1+8)),[d])
record={'schema':'hewrs.option-card-thumbnails.v1_21_1','counts':{k:len(v)for k,v in thumbs.items()},'scope':'Existing wardrobe-layer crops only; previews are not new garment appearances. Shirt previews show the untied collar source detail independently of the selected outfit tie. Watches remain name/ID only.',**thumbs}
write('data/option-card-thumbnails.json',(json.dumps(record,indent=2)+'\n').encode())
write('data/option-card-thumbnails.js',('globalThis.HEWRS_OPTION_CARD_THUMBNAILS='+json.dumps(record,separators=(',',':'))+';\n').encode())
print(json.dumps({'status':'PASS','check_only':args.check,'counts':record['counts']}))
