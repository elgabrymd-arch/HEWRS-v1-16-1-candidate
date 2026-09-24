#!/usr/bin/env python3
"""New No Tie/shared-source routes, actual Chromium. Does not certify Safari/iPhone."""
import os,json,time,traceback,base64,hashlib,io
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1]
BASE=Path(os.environ.get('HEWRS_BASELINE_V112','/mnt/data/continue_v113/HEWRS_CONNECTED_APP_V1_12'))
E=Path(os.environ.get('HEWRS_V113_BROWSER',str(R/'evidence/open_collar_v1_13/browser')));E.mkdir(parents=True,exist_ok=True)
checks=[];renders=[];regressions=[];errors=[];start=time.monotonic()
def save():
 (E/'BROWSER.json').write_text(json.dumps({'scope':'Actual packaged scripts and image bytes in Chromium via in-memory loader; no hosted/physical device or browser restart certification.','passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'new_native_comparisons':renders,'regressions':regressions,'errors':errors,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+': '+str(detail))
def S(b='B03',shirt='DS001',state='NO_TIE',pant='PG002',shoe='shoe-8'):
 return dict(blazerId=b,pantId=pant,shirtId=shirt,state=state,shoeId=shoe,watchId='watch-P05')
def SO(shirt='DS001',state='NO_TIE',pant='PG002',shoe='shoe-8'):
 return dict(shirtOnly=True,pantId=pant,shirtId=shirt,state=state,shoeId=shoe,watchId=None)
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hashes.items():
  if sha in present:continue
  b64=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=b64;size+=len(b64)
  if size>2_000_000:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply

def ensure(page,root,selections):h.R=root;h.ensure(page,selections)
def load(page,root,selections):h.R=root;h.load(page,preload=selections,storage={'production_sentinel':'UNCHANGED'})
def rgba_sha(page):
 raw=base64.b64decode(page.evaluate("document.getElementById('avatar').toDataURL('image/png')").split(',')[1]);return hashlib.sha256(Image.open(io.BytesIO(raw)).convert('RGBA').tobytes()).hexdigest()
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);p=browser.new_page(viewport={'width':390,'height':844},accept_downloads=True);p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R,[S(),S('B01'),SO()]);ck('Current application and default source load',p.evaluate('HEWRS_READY===true'))
  # Expected frame assembles source images independently of the runtime plan/render.
  p.evaluate('''()=>{const W=996,H=2748,cache=new Map();globalThis.__im=async d=>{if(cache.has(d.sha256))return cache.get(d.sha256);const q=new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=HEWRSApp.resolveUrl(d);});cache.set(d.sha256,q);while(cache.size>14)cache.delete(cache.keys().next().value);return q;};globalThis.__expected=async s=>{const c=HEWRSApp.connection,a=c.blazerConnection.data.assembly,frame=document.createElement('canvas'),shirt=document.createElement('canvas');frame.width=shirt.width=W;frame.height=shirt.height=H;const fc=frame.getContext('2d',{willReadFrequently:true}),sc=shirt.getContext('2d',{willReadFrequently:true});for(const d of [c.manifest.static.avatar,c.shoeLayers[s.shoeId],c.blazerConnection.knownPant(s.pantId).layer])fc.drawImage(await __im(d),0,0);sc.drawImage(await __im(a.no_tie),0,0);if(!s.shirtOnly){const b=c.blazerConnection.knownBlazer(s.blazerId),reg=b.assembly||a,own=reg.ownership||c.blazerConnection.knownBlazer('B02').assembly.ownership,temp=document.createElement('canvas');temp.width=W;temp.height=H;const tc=temp.getContext('2d');tc.drawImage(await __im(own),0,0);const m=tc.getImageData(0,0,W,H).data,q=sc.getImageData(0,0,W,H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(m[i]||y>=(reg.sourceCuffOwnershipStart??1339))q.data.fill(0,i,i+4);}sc.putImageData(q,0,0);temp.width=temp.height=1;fc.drawImage(shirt,0,0);fc.drawImage(await __im(reg.jacket),0,0);for(const d of a.cuffs)fc.drawImage(await __im(d),0,0);}else fc.drawImage(shirt,0,0);for(const d of a.hands)fc.drawImage(await __im(d),0,0);const out=fc.getImageData(0,0,W,H).data;frame.width=frame.height=shirt.width=shirt.height=1;return out;};globalThis.__compare=async s=>{await HEWRSApp.apply(s,{save:false});const a=document.getElementById('avatar').getContext('2d').getImageData(0,0,996,2748).data,b=await __expected(s);let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])n++;return {selection:s,different_pixels:n,status:document.getElementById('avatar').dataset.status};};}''')
  no_ties=[S('B'+str(i).zfill(2),shirt) for i in range(1,15) for shirt in ['DS001','DS014']]+[SO(shirt)for shirt in ['DS001','DS014']]
  no_ties += [S('B03','DS014',pant=x)for x in p.evaluate('HEWRSApp.connection.blazerConnection.pantIds') if x!='PG002']
  no_ties += [SO('DS014',shoe=x)for x in p.evaluate('Object.keys(HEWRSApp.connection.shoeLayers)')if x!='shoe-8']
  ensure(p,R,no_ties)
  for i,s in enumerate(no_ties):
   row=p.evaluate('__compare',s);renders.append(row)
   if row['different_pixels']:raise AssertionError(row)
   if(i+1)%20==0:print('RENDER',i+1,flush=True);save()
  ck('87 no-tie outfit renders match direct native component composition',len(renders)==87 and all(x['different_pixels']==0 for x in renders))
  # Shared full-source identity is checked as a visual alias, while actual IDs stay distinct.
  shared=[S('B03','DS014','T'+str(i).zfill(3))for i in range(1,48)]+[SO('DS014','T'+str(i).zfill(3))for i in range(1,48)]
  ensure(p,R,shared+[dict(s,shirtId='DS001')for s in shared]);equal=[]
  for s in shared:
   p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);a=rgba_sha(p);actual=p.evaluate('HEWRSApp.state().selection.shirtId');p.evaluate('s=>HEWRSApp.apply(s,{save:false})',dict(s,shirtId='DS001'));b=rgba_sha(p);equal.append(a==b and actual=='DS014')
  ck('94 DS014 tied outputs match the documented shared visual without merging IDs',all(equal),{'count':len(equal)})
  baseline=browser.new_page(viewport={'width':390,'height':844})
  controls=[dict(suitId='S'+str(i).zfill(2),shirtId='DS035' if i%3==0 else 'DS036',state='NO_TIE'if i%2==0 else 'T017',shoeId='shoe-8',watchId=None)for i in range(1,19)]
  controls += [S('B'+str(i).zfill(2),state='T017')for i in range(1,15)]+[SO(state=t)for t in ['T001','T017','T022','T047']]
  load(baseline,BASE,controls);ensure(p,R,controls)
  for s in controls:
   p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);baseline.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);a,b=rgba_sha(p),rgba_sha(baseline);regressions.append({'selection':s,'new_sha':a,'prior_sha':b,'equal':a==b})
  baseline.close();ck('36 prior suit/blazer/shirt-only outputs remain pixel-identical',all(x['equal']for x in regressions),{'count':len(regressions)})
  # Actual Apply/Cancel picker interactions and generation.
  p.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.showPage("home");HEWRSApp.setMode("engine");}',S('B03',state='T017'))
  p.click('#pref-tie');p.locator('[data-item-id="NO_TIE"]').click();p.click('#picker-apply');ck('No Tie preference committed by real picker',p.evaluate('HEWRSApp.ui.snapshot().tie.mode')=='none')
  p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"',timeout=30000)
  ck('Engine returns and renders explicit No Tie',p.evaluate('HEWRSApp.state().selection')==S());ck('Viewing/generating adds no wear',p.evaluate('HEWRSApp.store.snapshot().events.length')==0)
  p.screenshot(path=str(E/'B03_DS001_NO_TIE_390x844.png'))
  p.click('#record-wear');p.click('#confirm-wear');ck('Confirmed wear records a null tie',p.evaluate('HEWRSApp.store.snapshot().events.at(-1).items.tie')is None)
  # Change shirt through the real picker; keep every other preference.
  p.evaluate('HEWRSApp.showPage("home");HEWRSApp.setMode("anchor");');before=p.evaluate('HEWRSApp.ui.snapshot()');p.click('#pref-shirt');p.fill('#picker-search','DS014');p.locator('[data-item-id="DS014"]').click();p.click('#picker-apply');after=p.evaluate('HEWRSApp.ui.snapshot()');ck('DS014 Apply preserves all other category preferences',all(before[k]==after[k]for k in before if k!='shirt')and after['shirt']['id']=='DS014')
  p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"',timeout=30000);ck('Anchor displays actual DS014 identity',p.evaluate('HEWRSApp.state().selection')==S(shirt='DS014'))
  p.evaluate('s=>HEWRSApp.apply(s,{save:false})',SO('DS014'));p.screenshot(path=str(E/'DS014_SHIRT_ONLY_NO_TIE_390x844.png'))
  p.evaluate('HEWRSApp.showPage("home");');before=p.evaluate('HEWRSApp.ui.snapshot()');p.click('#pref-tie');p.locator('[data-item-id="T017"]').click();p.keyboard.press('Escape');ck('Picker Cancel retains intentional No Tie',p.evaluate('HEWRSApp.ui.snapshot()')==before)
  before=rgba_sha(p);rejected=p.evaluate('''async s=>{try{await HEWRSApp.apply({...s,shirtId:'DS036'},{save:false});return false}catch{return true}}''',S());ck('Unsupported shirt retains complete previous frame',rejected and before==rgba_sha(p))
  ensure(p,R,[S('B01'),SO()]);state=p.evaluate('''async([a,b])=>{await Promise.allSettled([HEWRSApp.apply(a,{save:false}),HEWRSApp.apply(b,{save:false}),HEWRSApp.apply(a,{save:false})]);return HEWRSApp.state().selection}''',[S('B01'),SO()]);ck('Rapid cross-mode switching commits only final selection',state==S('B01'))
  text=p.evaluate('HEWRSApp.store.exportText()');p.evaluate('HEWRSApp.showPage("wardrobe")');p.click('#data-button')
  with p.expect_download() as dl:p.click('#export-backup')
  dl.value.save_as(str(E/'TEST_BACKUP.json'));ck('Export button downloads original backup format with null tie',json.loads((E/'TEST_BACKUP.json').read_text())==json.loads(text));p.keyboard.press('Escape')
  before=p.evaluate('HEWRSApp.store.snapshot()');p.evaluate('''()=>{const p=HEWRSApp.store.previewImport(HEWRSApp.store.exportText());HEWRSApp.store.restore(p)}''');ck('Restore preserves no-tie event identities',p.evaluate('HEWRSApp.store.snapshot().events')==before['events']);ck('Production sentinel unchanged',p.evaluate('__STORAGE_MAP.get("production_sentinel")')=='UNCHANGED')
  # Frozen exterior, source controls, and visibly complete portrait stages.
  p.evaluate('HEWRSApp.showPage("home")');layout=p.evaluate('''()=>{const e=document.getElementById('page-home'),g=document.getElementById('generate-options').getBoundingClientRect(),n=document.querySelector('.bottom-nav').getBoundingClientRect();return {client:e.clientHeight,scroll:e.scrollHeight,button:g.bottom,nav:n.top}}''');ck('Closed-sheet facelift Home fits phone viewport',layout['scroll']<=layout['client']+1 and layout['button']<=layout['nav'],layout)
  ck('No runtime page errors',not errors,errors);save()
 except Exception as ex:
  errors.append('TEST_FAILURE: '+str(ex));save();p.screenshot(path=str(E/'FAILURE.png'));traceback.print_exc();raise
 finally:browser.close()
