#!/usr/bin/env python3
"""Actual local app scripts and images in in-memory Chromium, synthetic storage.
Not an independently observed iPhone test, hosted deployment or real-origin test.
Requires HEWRS_BASELINE_V1164 pointing at the complete V1.16.4 source folder.
"""
import os,sys,json,time,base64,hashlib,io,traceback
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];B=Path(os.environ['HEWRS_BASELINE_V1164']);E=R/'evidence/scope18_v1_16_5/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];frames=[];layouts=[];errors=[];start=time.monotonic()
ids=json.loads((R/'RELEASE_SCOPE.json').read_text())['enabled_non_suit_shirt_ids']
def save():
 (E/'RESULT.json').write_text(json.dumps({'schema':'hewrs.scope18.chromium.v1_16_5','scope':__doc__,'passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'outfit_frames':frames,'layout_cases':layouts,'errors':errors,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(str((name,detail)))
# Do not serialize the entire growing image store back across the harness pipe.
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hashes.items():
  if sha in present:continue
  value=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=value;size+=len(value)
  if size>2_000_000:
   page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
def load(p,r):h.R=r;h.load(p,storage={'scope18-sentinel':'UNCHANGED'})
def ensure(p,r,ss):h.R=r;h.ensure(p,ss)
def O(id='DS023',t='T017'):return dict(shirtOnly=True,pantId='PG002',shirtId=id,state=t,shoeId='shoe-8',watchId=None)
def BL(id='DS023',t='T017',b='B03'):return dict(blazerId=b,pantId='PG002',shirtId=id,state=t,shoeId='shoe-8',watchId=None)
def S(id='DS023',t='T017',suit='S05'):return dict(suitId=suit,shirtId=id,state=t,shoeId='shoe-8',watchId=None)
def pixels(p):return Image.open(io.BytesIO(base64.b64decode(p.evaluate('document.querySelector("#avatar").toDataURL("image/png")').split(',')[1]))).convert('RGBA')
def digest(p):return hashlib.sha256(pixels(p).tobytes()).hexdigest()
def prefs(p,s):p.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.showPage("home");HEWRSApp.setMode("anchor");}',s)
def close(p):p.locator('#fx-sheet-close').click()
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=browser.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True);p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R);ck('New scope build loads with accepted controller and garment renderers',p.evaluate('HEWRS_READY&&HEWRSApp.version==="HEWRS_CONNECTED_APP_V1_16_5"'))
  old=browser.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True);load(old,B)
  matrix=[s for id in ids for t in ['NO_TIE','T017']for s in [O(id,t),BL(id,t)]]+[S(suit='S'+str(i).zfill(2))for i in range(1,19)]
  ensure(p,R,matrix);ensure(old,B,matrix)
  for n,s in enumerate(matrix):
   p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);old.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
   a,b=digest(p),digest(old);frames.append({'selection':s,'before':b,'after':a,'equal':a==b});assert a==b,s
   if(n+1)%18==0:print('FRAME COMPARISONS',n+1,flush=True);save()
  ck('90 complete baseline comparisons retain exact pixels, including all 18 non-suit shirts and all 18 suits',len(frames)==90 and all(x['equal']for x in frames))
  for q in [p,old]:q.evaluate('s=>HEWRSApp.apply(s,{save:false})',O());q.evaluate('HEWRSApp.showPage("outfits")');q.locator('#detail-view').click()
  ck('Actual accepted DS023 Collar Detail view remains pixel-identical',p.locator('#stage').screenshot()==old.locator('#stage').screenshot());p.screenshot(path=str(E/'DS023_COLLAR_DETAIL.png'))
  for q in [p,old]:q.locator('#full-view').click();prefs(q,BL())
  ck('Accepted Home appearance unchanged',p.screenshot()==old.screenshot());old.close()
  for mode,s,n in [('blazer',BL(),18),('shirt-only',O(),18),('suit',S(),50)]:
   prefs(p,s);p.evaluate('HEWRSApp.openPicker("shirt")');count=p.locator('[data-item-id]').count();enabled=p.locator('[data-item-id]:not([disabled])').count()
   ck(mode+' picker has correct visible choices',count==n and enabled==n,{'visible':count,'enabled':enabled})
   if mode!='suit':ck(mode+' picker explicitly retains the other 32 for suits', 'other 32 remain in Wardrobe and suit mode' in p.locator('#picker-count').inner_text())
   if mode=='blazer':p.screenshot(path=str(E/'18_SHIRT_PICKER_390x700.png'))
   close(p)
  prefs(p,BL());before=p.evaluate('HEWRSApp.ui.snapshot()');ledger=p.evaluate('HEWRSApp.store.exportText()')
  p.evaluate('HEWRSApp.openPicker("shirt")');p.locator('#picker-search').fill('DS027');p.locator('[data-item-id="DS027"]').click();close(p)
  ck('Scoped search/select then Cancel preserves all preferences',p.evaluate('HEWRSApp.ui.snapshot()')==before)
  p.evaluate('HEWRSApp.openPicker("shirt")');p.locator('#picker-search').fill('DS027');p.locator('[data-item-id="DS027"]').click();p.locator('#picker-apply').click();after=p.evaluate('HEWRSApp.ui.snapshot()')
  ck('Scoped Apply changes only one shirt preference',after['shirt']['id']=='DS027'and all(after[k]==before[k]for k in before if k!='shirt'))
  p.evaluate('HEWRSApp.openPicker("shirt")');p.locator('#picker-search').fill('DS036');ck('Deferred non-suit search yields no substitute and disabled Apply',p.locator('[data-item-id]').count()==0 and p.locator('#picker-apply').is_disabled());close(p)
  prefs(p,S('DS036'));p.evaluate('''()=>{const row=HEWRSApp.ui.rows.topwear.find(x=>x.kind==='blazer'&&x.sourceId==='B03');HEWRSApp.ui.set('topwear',{mode:'item',id:row.id});HEWRSApp.openPicker('shirt');}''')
  prior=p.evaluate('HEWRSApp.ui.snapshot()');ck('Deferred suit preference cannot be applied in a non-suit mode and is not replaced',p.locator('#picker-apply').is_disabled()and 'retained from your suit selection' in p.locator('#fx-sheet-body').inner_text()and prior['shirt']['id']=='DS036');close(p);ck('Cancel retains the suit shirt after mode change',p.evaluate('HEWRSApp.ui.snapshot()')==prior)
  prefs(p,S('DS036'));p.evaluate('HEWRSApp.openPicker("shirt")');p.locator('#picker-search').fill('DS036');ck('DS036 remains selectable in suits',p.locator('[data-item-id="DS036"]').is_enabled());close(p)
  p.evaluate('HEWRSApp.showPage("wardrobe")');p.locator('[data-category="shirts"]').click();ck('Wardrobe retains all 50 physical shirts',p.locator('[data-record-id]').count()==50);close(p)
  p.evaluate('HEWRSApp.showPage("wardrobe")');p.locator('#data-button').click();ck('Backup/restore UI is still available, restore is confirmation-gated',p.locator('#export-backup').is_enabled()and p.locator('#confirm-restore').is_disabled());close(p)
  ck('All picker and backup interactions leave synthetic ledger bytes intact',p.evaluate('HEWRSApp.store.exportText()')==ledger and p.evaluate('__STORAGE_MAP.get("scope18-sentinel")')=='UNCHANGED')
  for w,ht in [(320,568),(390,700),(430,820),(844,390),(390,320)]:
   p.set_viewport_size({'width':w,'height':ht});p.wait_for_timeout(50);prefs(p,BL())
   for cat in ['topwear','shirt','tie','shoes','bottoms','watch']:
    p.evaluate('cat=>HEWRSApp.openPicker(cat)',cat);p.locator('#picker-list .fx-choice').last.scroll_into_view_if_needed()
    m=p.evaluate('''()=>{const q=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom,right:r.right,height:r.height,client:e.clientWidth,scroll:e.scrollWidth}};return {sheet:q('fx-sheet'),body:q('fx-sheet-body'),actions:q('fx-sheet-actions'),active:document.activeElement.id}}''')
    last=p.locator('#picker-list .fx-choice').last.bounding_box();assert last['y']+last['height']<=m['actions']['y']+1,m
    assert m['sheet']['y']>=-1 and m['sheet']['bottom']<=ht+1 and m['sheet']['right']<=w+1,m
    assert m['body']['height']>=140 and m['body']['scroll']<=m['body']['client']+1,m
    layouts.append({'category':cat,'viewport':[w,ht],'last_choice_reachable':True,'metrics':m});close(p)
  ck('All six pickers remain usable in 30 mobile/short viewport cases',len(layouts)==30)
  ck('No uncaught browser exceptions',not errors,errors)
 except Exception:
  checks.append({'name':'Browser suite completion','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except Exception:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):raise SystemExit(1)
