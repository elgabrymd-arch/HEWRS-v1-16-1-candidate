#!/usr/bin/env python3
import os,json,time,base64,hashlib,io
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1]
E=R/'evidence/batch16_v1_16/browser';E.mkdir(parents=True,exist_ok=True)
IDs=['DS002','DS006','DS008','DS021','DS022','DS023','DS024','DS025','DS027','DS047']
checks=[]
def ck(name,ok,detail=None):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok: raise AssertionError(f'{name}: {detail}')
def B(bid='B03',shirt='DS023',state='NO_TIE',pant='PG002',shoe='shoe-8'): return dict(blazerId=bid,pantId=pant,shirtId=shirt,state=state,shoeId=shoe,watchId=None)
def O(shirt='DS023',state='NO_TIE',pant='PG002',shoe='shoe-8'): return dict(shirtOnly=True,pantId=pant,shirtId=shirt,state=state,shoeId=shoe,watchId=None)
def supply(page,hashes):
    present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
    for sha,path in hashes.items():
        if sha in present: continue
        val=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=val;size+=len(val)
        if size>2_000_000:
            page.evaluate('x=>Object.assign(HEWRS_EMBEDDED_IMAGES,x)',batch);batch={};size=0
    if batch: page.evaluate('x=>Object.assign(HEWRS_EMBEDDED_IMAGES,x)',batch)
h.supply=supply

def load(p,root): h.R=root; h.load(p,storage={'v116-sentinel':'UNCHANGED'})
def ensure(p,root,sels): h.R=root; h.ensure(p,sels)
def run(p,s): return p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
def pixels(p): return Image.open(io.BytesIO(base64.b64decode(p.evaluate("document.querySelector('#avatar').toDataURL('image/png')").split(',')[1]))).convert('RGBA')
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    p=browser.new_page(viewport={'width':390,'height':844})
    load(p,R)
    ck('V1.16 loads', p.evaluate('HEWRS_READY&&HEWRSApp.connection.implementationVersion==="1.16-batch16"'))
    ensure(p,R,[B('B03','DS002','NO_TIE'),O('DS022','T017')])
    run(p,B('B03','DS002','NO_TIE'))
    ck('DS002 blazer render ready', p.evaluate('document.querySelector("#avatar").dataset.status')=='ready')
    img1=pixels(p).resize((120,331),Image.Resampling.LANCZOS)
    p.evaluate('s=>HEWRSApp.ui.fromSelection(s)', O('DS022','T017'))
    run(p,O('DS022','T017'))
    ck('DS022 shirt-only tied render ready', p.evaluate('document.querySelector("#avatar").dataset.status')=='ready')
    img2=pixels(p).resize((120,331),Image.Resampling.LANCZOS)
    # picker enablement
    p.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.showPage("home");HEWRSApp.setMode("anchor");}', B())
    p.click('#pref-shirt')
    count=p.locator('[data-item-id]').count(); enabled=count-p.locator('[data-item-id][disabled]').count()
    ck('Blazer picker enablement is 18/50', count==50 and enabled==18, {'count':count,'enabled':enabled})
    p.screenshot(path=str(E/'PICKER_390x844.png'))
    p.keyboard.press('Escape')
    # sample board
    sheet=Image.new('RGB',(260,360),(230,230,230));draw=ImageDraw.Draw(sheet)
    sheet.paste(img1,(5,25),img1);draw.text((5,5),'B03 DS002 NO_TIE',fill=(20,20,20))
    sheet.paste(img2,(135,25),img2);draw.text((135,5),'SO DS022 T017',fill=(20,20,20))
    sheet.save(E/'SAMPLE_PHONE_BOARD.png')
    p.evaluate('HEWRSApp.showPage("home")')
    p.screenshot(path=str(E/'HOME_390x844.png'))
    ck('Synthetic sentinel unchanged', p.evaluate('__STORAGE_MAP.get("v116-sentinel")')=='UNCHANGED')
    (E/'RESULT.json').write_text(json.dumps({'schema':'hewrs.batch16.browser.smoke.v1_16','passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks},indent=2)+'\n')
    browser.close()
