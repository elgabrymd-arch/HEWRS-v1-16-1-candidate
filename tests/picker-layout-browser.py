#!/usr/bin/env python3
"""Actual application in Chromium. Mobile sizes and synthetic visual viewport
changes are NOT physical Safari or software-keyboard/device certification.
No real user data or network connection is used by this harness.
"""
import os,sys,json,time,base64,hashlib,io,traceback
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];B=Path(os.environ['HEWRS_BASELINE_V1163'])
E=R/'evidence/picker_v1_16_4/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];cases=[];frames=[];errors=[];start=time.monotonic()
def save():
 (E/'RESULT.json').write_text(json.dumps({'schema':'hewrs.picker-layout.chromium.v1_16_4','scope':'Actual scripts/images in Chromium. Simulated mobile dimensions and explicit synthetic VisualViewport. Not physical Safari, keyboard, hosted or browser-restart certification.','passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'layout_cases':cases,'outfit_frames':frames,'errors':errors,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+': '+str(detail))
def load(p,r):h.R=r;h.load(p,storage={'picker-sentinel':'UNCHANGED'})
def ensure(p,r,s):h.R=r;h.ensure(p,s)
def O(shirt='DS023',state='T017'):return dict(shirtOnly=True,pantId='PG002',shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def BL(b='B03',shirt='DS023',state='T017'):return dict(blazerId=b,pantId='PG002',shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def S(id='DS023',state='T017',suit='S05'):return dict(suitId=suit,shirtId=id,state=state,shoeId='shoe-8',watchId=None)
def digest(p):
 raw=p.evaluate('document.querySelector("#avatar").toDataURL("image/png")').split(',')[1]
 return hashlib.sha256(Image.open(io.BytesIO(base64.b64decode(raw))).convert('RGBA').tobytes()).hexdigest()
def prefs(p,s):p.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.showPage("home");HEWRSApp.setMode("anchor");}',s)
def close(p):p.locator('#fx-sheet-close').click()
def metrics(p):return p.evaluate('''()=>{const q=id=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right,client:e.clientHeight,scroll:e.scrollHeight}};return {sheet:q('fx-sheet'),body:q('fx-sheet-body'),actions:q('fx-sheet-actions'),search:q('picker-search'),list:q('picker-list'),active:document.activeElement.id,viewport:{height:innerHeight,width:innerWidth},sideways:document.querySelector('#fx-sheet-body').scrollWidth>document.querySelector('#fx-sheet-body').clientWidth+1};}''')
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=browser.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True)
 p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R);ck('Updated application and existing renderer load',p.evaluate('HEWRS_READY&&HEWRSApp.version==="HEWRS_CONNECTED_APP_V1_16_4"'))
  old=browser.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True);load(old,B)
  # Actual image routes unchanged. Includes approved DS023 corrections.
  matrix=[S(id,t)for id in ['DS023','DS035']for t in ['T017','NO_TIE']]+[BL(b,'DS023',t)for b in ['B01','B02','B03']for t in ['T017','NO_TIE']]+[O(id,t)for id in ['DS023','DS027','DS001']for t in ['T017','NO_TIE']]
  ensure(p,R,matrix);ensure(old,B,matrix)
  for s in matrix:
   p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);old.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
   a,b=digest(p),digest(old);frames.append({'selection':s,'before':b,'after':a,'equal':a==b})
  ck('16 original outfit frames including DS023 remain pixel-identical',len(frames)==16 and all(x['equal']for x in frames))
  prefs(p,BL());prefs(old,BL())
  ck('Home page remains pixel-identical',p.screenshot()==old.screenshot())
  # Reproduce the documented layout stress without calling it actual Safari.
  old.evaluate('HEWRSApp.openPicker("topwear")');old.add_style_tag(content='.fx-sheet-body{flex-basis:0px !important}')
  before=metrics(old);old.screenshot(path=str(E/'ZERO_BASIS_STRESS_BEFORE.png'));close(old)
  ck('Zero-basis stress recreates collapsed body in the old build',before['body']['height']<=40,before)
  old.close()
  stress=p.add_style_tag(content='.fx-sheet-body{flex-basis:0px !important}')
  p.evaluate('HEWRSApp.openPicker("topwear")');after=metrics(p);p.screenshot(path=str(E/'ZERO_BASIS_STRESS_AFTER.png'))
  ck('Definite picker height remains usable under the same zero-basis stress',after['body']['height']>=400,after);close(p);stress.evaluate('(n)=>n.remove()')
  cats=['topwear','shirt','tie','shoes','bottoms','watch']
  for width,height in [(320,568),(375,667),(390,700),(430,820),(844,390),(390,320)]:
   p.set_viewport_size({'width':width,'height':height});p.wait_for_timeout(40);prefs(p,BL())
   for cat in cats:
    p.evaluate('cat=>HEWRSApp.openPicker(cat)',cat);m=metrics(p)
    assert m['body']['height']>=140,(cat,m)
    assert m['sheet']['y']>=0 and m['sheet']['bottom']<=height+1,(cat,m)
    assert not m['sideways'] and m['sheet']['right']<=width+1,(cat,m)
    assert m['active']=='fx-sheet-close',(cat,m['active'])
    # Reach last row through the single scrolling body; actions stay onscreen.
    last=p.locator('#picker-list .fx-choice').last;last.scroll_into_view_if_needed();lm=last.bounding_box();a=p.locator('#fx-sheet-actions').bounding_box()
    assert lm['y']+lm['height']<=a['y']+1,(cat,lm,a)
    cases.append({'category':cat,'viewport':[width,height],'keyboard_simulated':False,'metrics':m,'last_choice_reachable':True,'touch_opens_without_search_focus':True})
    if (width,height,cat)==(390,700,'shirt'):
     p.locator('#fx-sheet-body').evaluate('(e)=>e.scrollTop=0');p.screenshot(path=str(E/'SHIRT_PICKER_390x700.png'))
     p.locator('#picker-search').fill('DS023');p.locator('[data-item-id="DS023"]').scroll_into_view_if_needed();p.screenshot(path=str(E/'SEARCH_DS023_390x700.png'))
    close(p)
   ck(f'All six pickers are scrollable with visible actions at {width}x{height}',True)
  # Real mouse/keyboard controls on desktop remain focused and operable.
  desktop=browser.new_page(viewport={'width':1100,'height':800});load(desktop,R);prefs(desktop,BL());desktop.evaluate('HEWRSApp.openPicker("shirt")')
  ck('Desktop search still receives keyboard focus',desktop.evaluate('document.activeElement.id')=='picker-search');close(desktop);desktop.close()
  p.set_viewport_size({'width':390,'height':700});prefs(p,BL());before=p.evaluate('HEWRSApp.ui.snapshot()');ledger=p.evaluate('HEWRSApp.store.exportText()')
  p.evaluate('HEWRSApp.openPicker("shirt")');p.locator('#picker-search').fill('DS027');p.locator('[data-item-id="DS027"]').click();close(p)
  ck('Search/select then Cancel preserves every preference',p.evaluate('HEWRSApp.ui.snapshot()')==before)
  p.evaluate('HEWRSApp.openPicker("shirt")');p.locator('#picker-search').fill('DS027');p.locator('[data-item-id="DS027"]').click();p.locator('#picker-apply').click();now=p.evaluate('HEWRSApp.ui.snapshot()')
  ck('Apply changes only the selected shirt',now['shirt']['id']=='DS027'and all(now[k]==before[k]for k in before if k!='shirt'))
  p.evaluate('HEWRSApp.openPicker("shirt")');p.locator('#picker-search').fill('NOT_A_SHIRT');ck('Empty filter results remain explicit; Apply is disabled',p.locator('#picker-list .fx-empty').is_visible()and p.locator('#picker-apply').is_disabled());close(p)
  for s,enabled in [(S(),50),(BL(),18),(O(),18)]:
   prefs(p,s);p.evaluate('HEWRSApp.openPicker("shirt")');ck('Picker identity count and gating for '+('suit'if'suitId'in s else'blazer'if'blazerId'in s else'shirt-only'),p.locator('[data-item-id]').count()==50 and p.locator('[data-item-id]:not([disabled])').count()==enabled);close(p)
  p.evaluate('HEWRSApp.showPage("wardrobe")');p.locator('[data-category="shirts"]').click();ck('Wardrobe uses the same definite, scrollable list sheet',p.locator('#fx-sheet').get_attribute('data-list-sheet')=='true'and p.locator('#fx-sheet-body').bounding_box()['height']>300);p.locator('[data-record-id]').last.scroll_into_view_if_needed();close(p)
  p.evaluate('HEWRSApp.showPage("home")');p.locator('#style-button').click();ck('Non-list dialogs keep content-sized panels',p.locator('#fx-sheet').get_attribute('data-list-sheet')=='false'and 100<p.locator('#fx-sheet').bounding_box()['height']<400);close(p)
  ck('Modal interactions do not change wear/session storage',p.evaluate('HEWRSApp.store.exportText()')==ledger and p.evaluate('__STORAGE_MAP.get("picker-sentinel")')=='UNCHANGED')
  # A synthetic VisualViewport tests the actual resize/scroll listeners.
  q=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  q.evaluate('''()=>{const v=new EventTarget();Object.assign(v,{height:844,offsetTop:0,scale:1});globalThis.__FAKE_VV=v;Object.defineProperty(window,'visualViewport',{configurable:true,value:v});}''')
  load(q,R);prefs(q,BL());q.evaluate('HEWRSApp.openPicker("shirt")');q.locator('#picker-search').fill('DS023')
  for height,offset in [(340,0),(340,60),(260,100),(844,0)]:
   q.evaluate('a=>{Object.assign(__FAKE_VV,{height:a[0],offsetTop:a[1]});__FAKE_VV.dispatchEvent(new Event("resize"));}',[height,offset]);q.wait_for_timeout(50)
   m=metrics(q);assert m['sheet']['y']>=offset-1 and m['sheet']['bottom']<=offset+height+1,(height,offset,m)
   assert m['body']['height']>=90,(height,offset,m)
   q.locator('[data-item-id="DS023"]').scroll_into_view_if_needed();r=q.locator('[data-item-id="DS023"]').bounding_box();a=q.locator('#fx-sheet-actions').bounding_box();assert r['y']+r['height']<=a['y']+1
   cases.append({'category':'shirt','synthetic_visual_viewport':{'height':height,'offsetTop':offset},'metrics':m,'choice_reachable':True})
   if height==340 and offset==0:q.screenshot(path=str(E/'KEYBOARD_GEOMETRY_SIMULATION.png'))
  ck('Synthetic keyboard open, panned viewport and keyboard close preserve usable list/actions',True)
  prior=q.locator('#fx-sheet').get_attribute('style');q.evaluate('()=>{__FAKE_VV.scale=2;__FAKE_VV.height=422;__FAKE_VV.dispatchEvent(new Event("resize"));}');q.wait_for_timeout(30)
  ck('Pinch zoom does not trigger counter-scaling of the sheet',q.locator('#fx-sheet').get_attribute('style')==prior);q.evaluate('__FAKE_VV.scale=1');close(q)
  ck('Closing removes temporary viewport properties',q.locator('#fx-sheet').get_attribute('style') in ['',None]);q.close()
  ck('No uncaught runtime errors',not errors,errors)
 except Exception:
  checks.append({'name':'Test suite completion','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except Exception:pass
 finally:save();browser.close()
if any(not c['passed']for c in checks):raise SystemExit(1)
