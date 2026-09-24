#!/usr/bin/env python3
"""Rejected diagnostic: existing upper inserts alone do NOT form full shirts.
This deliberately shows the insufficient-coverage approach, NOT an installed
renderer, owner-approval candidate, or proposed new garment. No input is edited.
"""
from pathlib import Path
import argparse,json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',type=Path,required=True);a=p.parse_args()
inputs=json.loads((ROOT/'data/inputs.json').read_text())
blazer=json.loads((ROOT/'data/blazer-connection.json').read_text())
m=inputs['manifest'];paths={**inputs['assets'],**blazer['assetPaths']}
def read(d):return Image.open(ROOT/paths[d['sha256']]).convert('RGBA')
page=Image.new('RGB',(6*220,2*640),(215,215,215));draw=ImageDraw.Draw(page)
for n,(bid,sid)in enumerate([(bid,sid)for bid in ['B01','B03','B06']for sid in ['DS017','DS027','DS035','DS040']]):
 b=blazer['blazers'][bid].get('assembly',blazer['assembly'])
 c=m['shirts'][sid]['states']['no_tie'];out=Image.new('RGBA',(996,2748))
 pants=next(iter(blazer['pants'].values()))['layer']
 for d in [m['static']['avatar'],m['static']['shoe'],pants,c['rear'],c['body'],c['left'],c['right'],b['jacket'],c['left_cuff'],c['right_cuff'],*blazer['assembly']['hands']]:out.alpha_composite(read(d))
 out.thumbnail((220,606));x=(n%6)*220;y=(n//6)*640
 page.paste(out,(x,y+24),out);draw.text((x+6,y+5),bid+' '+sid+' INSERT ONLY',fill='black')
a.output.parent.mkdir(parents=True,exist_ok=True);page.save(a.output)
