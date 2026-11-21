#!/usr/bin/env python3
"""Browser-visible, isolated V2 versus V3 comparison; no personal local state."""
import argparse
import base64
import functools
import hashlib
import io
import json
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence/avatar_v3/browser'

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass

def server():
    s=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=s.serve_forever,daemon=True).start()
    return s,'http://127.0.0.1:%d/'%s.server_address[1]

TESTS=[
 ('S05_DS036_tied',{'suitId':'S05','shirtId':'DS036','state':'T017','shoeId':'shoe-8','watchId':None}),
 ('S05_DS034_open',{'suitId':'S05','shirtId':'DS034','state':'NO_TIE','shoeId':'shoe-8','watchId':None}),
 ('S05_DS003_unchanged',{'suitId':'S05','shirtId':'DS003','state':'T001','shoeId':'shoe-8','watchId':None}),
 ('B03_DS001_open',{'blazerId':'B03','pantId':'PG002','shirtId':'DS001','state':'NO_TIE','shoeId':'shoe-8','watchId':None}),
 ('shirtOnly_DS001_open',{'shirtOnly':True,'pantId':'PG002','shirtId':'DS001','state':'NO_TIE','shoeId':'shoe-8','watchId':None}),
]

RENDER=r'''async input=>{
 const app=globalThis.HEWRSApp;
 if(!app)throw Error('Not loaded');
 const p=app.renderer.plan(input);
 const before={wear:JSON.stringify(app.store.snapshot()),favorites:JSON.stringify(app.favorites.snapshot()),feedback:JSON.stringify(app.ownerFeedback.snapshot())};
 const result=await app.apply(input,{origin:'manual',save:false,keepPreferences:true});
 if(result?.cancelled)throw Error('Render unexpectedly cancelled');
 const canvas=document.getElementById('avatar');
 const after={wear:JSON.stringify(app.store.snapshot()),favorites:JSON.stringify(app.favorites.snapshot()),feedback:JSON.stringify(app.ownerFeedback.snapshot())};
 return {
   status:canvas.dataset.status,appReady:globalThis.HEWRS_READY,
   dims:[canvas.width,canvas.height],
   img:canvas.toDataURL('image/png'),
   avatar:(p?.avatar?.sha256||null),
   hands:(p?.hands||[]).map(x=>x.sha256),
   connectionAvatar:app.connection.manifest.static.avatar.sha256,
   v3:app.connection.avatarV3||null,
   stateUnchanged:JSON.stringify(before)===JSON.stringify(after),
   stateBefore:before,stateAfter:after,
   planOperation:p?.operation||null,
   poseRevision:app.renderer.stats().avatarV3Pose||null,
   overflow:document.documentElement.scrollWidth>innerWidth+1,
   current:app.state().selection,
 };
}'''

def get_frame(page, selected):
    rec=page.evaluate(RENDER,selected)
    data=base64.b64decode(rec.pop('img').split(',',1)[1])
    im=Image.open(io.BytesIO(data)).convert('RGBA')
    assert rec['status']=='ready' and rec['appReady'] and rec['dims']==[996,2748],rec
    assert not rec['overflow'],'Phone layout unexpectedly overflows'
    assert rec['stateUnchanged'],'Protected saved state modified by preview render'
    return rec,im

def preview_sheet(results):
    cols=2;row_w,row_h=305,850
    out=Image.new('RGB',(cols*row_w,len(results)*row_h),'#e4e5e8')
    d=ImageDraw.Draw(out)
    for index,(name,a,b,_,_) in enumerate(results):
        y=index*row_h
        for col,img in enumerate((a,b)):
            bg=Image.new('RGBA',img.size,'#e4e5e8')
            bg.alpha_composite(img)
            thumb=bg.convert('RGB').resize((294,813),Image.Resampling.LANCZOS)
            out.paste(thumb,(col*row_w+5,y+30))
            d.text((col*row_w+8,y+8),name+' '+('V2' if col==0 else 'V3'),fill='#151515')
    OUT.mkdir(parents=True,exist_ok=True)
    out.save(OUT/'avatar-v2-v3-outfit-comparison.png',optimize=True)
    return out

def run(browser):
    browser_name=browser
    OUT.mkdir(parents=True,exist_ok=True)
    serv,url=server()
    expected=json.loads((ROOT/'data/avatar-v3-candidate.json').read_text())
    hashes={k:v['sha256'] for k,v in expected['candidate_layers'].items()}
    report={'schema':'hewrs.avatar-v3-browser-review.v1',
     'browser':browser_name,'timestamp_utc':datetime.now(timezone.utc).isoformat(),
     'preview':'avatar-v3-review.html','original':'index.html','results':[],
     'visual_approval':'REQUIRES_OWNER_REVIEW'}
    try:
        with sync_playwright() as play:
            browser=getattr(play,browser_name).launch(headless=True)
            v2=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
            v3=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
            p2=v2.new_page();p3=v3.new_page()
            p2.goto(url+'index.html',wait_until='domcontentloaded',timeout=90000)
            p3.goto(url+'avatar-v3-review.html',wait_until='domcontentloaded',timeout=90000)
            p2.wait_for_function('globalThis.HEWRS_READY===true',timeout=120000)
            p3.wait_for_function('globalThis.HEWRS_READY===true',timeout=120000)
            profiles=[]
            for name,selection in TESTS:
                print('TEST',browser_name,name,flush=True)
                old,old_img=get_frame(p2,selection)
                new,new_img=get_frame(p3,selection)
                assert old['connectionAvatar']==expected['source_layer_hashes']['avatar'],(name,old['connectionAvatar'])
                assert new['connectionAvatar']==hashes['avatar'],(name,new['connectionAvatar'])
                assert new['v3']['sha256']==hashes['avatar'] and new['v3']['hands']==[hashes['left_hand'],hashes['right_hand']],name
                if new['avatar'] is not None:assert new['avatar']==hashes['avatar'],(name,new['avatar'])
                if new['hands']:assert new['hands']==[hashes['left_hand'],hashes['right_hand']],(name,new['hands'])
                assert new['poseRevision']=='AVATAR_V3_ARM_POSE_CANDIDATE_1',name+' pose geometry absent'
                assert old_img.crop((0,1700,996,2748)).tobytes()==new_img.crop((0,1700,996,2748)).tobytes(),name+' changed lower body'
                changed=ImageChops.difference(old_img,new_img).getbbox()
                assert changed is not None,name+' has no avatar change'
                a=old_img.crop((0,0,996,350));b=new_img.crop((0,0,996,350))
                assert ImageChops.difference(a,b).getbbox(),name+' did not change head'
                arm_diff=ImageChops.difference(old_img.crop((0,850,996,1250)),new_img.crop((0,850,996,1250))).getbbox()
                assert arm_diff is not None,name+' arm silhouette did not change'
                old_img.save(OUT/(name+'-v2.png'))
                new_img.save(OUT/(name+'-v3.png'))
                report['results'].append({'name':name,'selection':selection,'original':{k:v for k,v in old.items() if k not in ('stateBefore','stateAfter')},'candidate':{k:v for k,v in new.items() if k not in ('stateBefore','stateAfter')},
                 'image_different_bounds':changed,'lower_body_exact':True,'head_changed':True,'arm_region_changed':True,'arm_diff_bbox':arm_diff})
                profiles.append((name,old_img,new_img,old,new))
            sheet=preview_sheet(profiles)
            sheet.thumbnail((390,1350))
            buf=io.BytesIO();sheet.save(buf,format='PNG',optimize=True)
            print('AVATAR_V3_FULL_OUTFITS_B64='+base64.b64encode(buf.getvalue()).decode(),flush=True)
            v2.close();v3.close();browser.close()
    finally:serv.shutdown()
    report['status']='PASS'
    (OUT/('result-'+browser_name+'.json')).write_text(json.dumps(report,indent=2)+'\n')
    print('AVATAR_V3_BROWSER_RESULT='+json.dumps({'browser':browser_name,'status':'PASS','outfits':[r['name'] for r in report['results']]}))

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--browser',choices=['chromium','webkit'],default='chromium')
    run(**vars(p.parse_args()))
