#!/usr/bin/env python3
"""Actual V1.15 scripts/images, in-memory Chromium loader, not a hosted/iPhone test."""
import os,json,time,base64,hashlib,io,traceback
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];BASE=Path(os.environ['HEWRS_BASELINE_V114']);E=Path(os.environ.get('HEWRS_V115_BROWSER',str(R/'evidence/batch10_v1_15/browser')));E.mkdir(parents=True,exist_ok=True)
checks=[];regressions=[];new_frames=[];extra_frames=[];errors=[];thumbs={};start=time.monotonic()
IDs=['DS004','DS005','DS007','DS015','DS018','DS019','DS023','DS024','DS025','DS047']
def save():
 (E/'RESULT.json').write_text(json.dumps({'schema':'hewrs.batch10.chromium.v1_15','scope':'Actual current scripts/images through in-memory loading. Synthetic Map storage, not actual hosted origin/restart/iPhone/Safari.','passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'baseline_render_regressions':regressions,'new_render_selections':new_frames,'additional_all47_blazer_selections':extra_frames,'errors':errors,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+': '+str(detail))
def S(suit='S05',shirt='DS036',state='T017'):return dict(suitId=suit,shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def B(bid='B03',shirt='DS023',state='NO_TIE',pant='PG002',shoe='shoe-8'):return dict(blazerId=bid,pantId=pant,shirtId=shirt,state=state,shoeId=shoe,watchId=None)
def O(shirt='DS023',state='NO_TIE',pant='PG002',shoe='shoe-8'):return dict(shirtOnly=True,pantId=pant,shirtId=shirt,state=state,shoeId=shoe,watchId=None)
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hashes.items():
  if sha in present:continue
  val=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=val;size+=len(val)
  if size>2_000_000:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
def ensure(p,root,sels):h.R=root;h.ensure(p,sels)
def load(p,root):h.R=root;h.load(p,storage={'v115-sentinel':'UNCHANGED'})
def pixels(p):return Image.open(io.BytesIO(base64.b64decode(p.evaluate("document.querySelector('#avatar').toDataURL('image/png')").split(',')[1]))).convert('RGBA')
def digest(p):return hashlib.sha256(pixels(p).tobytes()).hexdigest()
def prefs(p,s):p.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.showPage("home");HEWRSApp.setMode("anchor");}',s)
def run(p,s):return p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=browser.new_page(viewport={'width':390,'height':844});p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R);ck('V1.15 loads using the existing controller and facelift',p.evaluate('HEWRS_READY&&HEWRSApp.connection.implementationVersion==="1.15-batch10"'))
  old=browser.new_page(viewport={'width':390,'height':844});load(old,BASE)
  controls=[S('S'+str(i).zfill(2),shirt,state)for i in range(1,19)for shirt,state in [('DS035','NO_TIE'),('DS035','T017'),('DS051','T017')]]
  controls+=[B('B'+str(i).zfill(2),'DS014'if i%2 else'DS001',t)for i in range(1,15)for t in ['T017','NO_TIE']]
  controls+=[O(id,t)for id in ['DS001','DS014']for t in ['T017','NO_TIE']]+[S()]
  for n,s in enumerate(controls):
   ensure(p,R,[s]);ensure(old,BASE,[s]);run(p,s);run(old,s);a,b=digest(p),digest(old);regressions.append({'selection':s,'v115_rgba_sha256':a,'v114_rgba_sha256':b,'equal':a==b})
   if a!=b:raise AssertionError('Regression '+str(s))
   if(n+1)%15==0:print('REGRESSION',n+1,flush=True);save()
  old.close();ck('87 current suit/blazer/shirt-only frames are pixel-identical to V1.14',len(regressions)==87 and all(x['equal']for x in regressions))
  matrix=[B('B'+str(i).zfill(2),id,t)for i in range(1,15)for id in IDs for t in ['NO_TIE','T017']]
  matrix+=[O(id,t)for id in IDs for t in ['NO_TIE']+['T'+str(i).zfill(3)for i in range(1,48)]]
  ensure(p,R,matrix)
  for n,s in enumerate(matrix):
   run(p,s);current=p.evaluate('({last:HEWRSApp.renderer.last(),status:document.querySelector("#avatar").dataset.status})')
   if current['last']!=s or current['status']!='ready':raise AssertionError('Wrong actual frame selection '+str(s))
   new_frames.append(s)
   if s['state']in ['NO_TIE','T017']and(s.get('shirtOnly')or s.get('blazerId')=='B03'):
    im=pixels(p);thumbs[(s['shirtId'],s['state'],'shirt-only'if s.get('shirtOnly')else'blazer')]=im.resize((120,331),Image.Resampling.LANCZOS)
   if(n+1)%50==0:print('NEW FRAMES',n+1,flush=True);save()
  ck('760 added actual frames: 280 blazer combinations and 480 shirt-only states',len(new_frames)==760)
  extra=[B('B06','DS023','T'+str(i).zfill(3))for i in range(1,48)];ensure(p,R,extra)
  for s in extra:
   run(p,s);assert p.evaluate('HEWRSApp.renderer.last()')==s;extra_frames.append(s)
  ck('All 47 ties render under B06 with exact DS023 identity',p.evaluate('HEWRSApp.renderer.last().state')=='T047')
  sheet=Image.new('RGB',(1200,4*360),(225,225,225));draw=ImageDraw.Draw(sheet)
  for j,(kind,state)in enumerate([('shirt-only','NO_TIE'),('shirt-only','T017'),('blazer','NO_TIE'),('blazer','T017')]):
   for i,id in enumerate(IDs):
    im=thumbs[id,state,kind];sheet.paste(im,(i*120,j*360+25),im);draw.text((i*120+4,j*360+5),id+' '+('open'if state=='NO_TIE'else'T017'),fill=(25,25,25))
  sheet.save(E/'BATCH10_ACTUAL_FRAMES_PHONE_SCALE.png')
  prefs(p,B());p.click('#pref-shirt');ck('Real blazer picker has 12 enabled, 38 gated, all 50 visible',p.locator('[data-item-id]').count()==50 and p.locator('[data-item-id][disabled]').count()==38);p.screenshot(path=str(E/'PICKER_390x844.png'));p.keyboard.press('Escape')
  prefs(p,O());p.click('#pref-shirt');ck('Real shirt-only picker enables the same exact 12 IDs',p.locator('[data-item-id]').count()==50 and p.locator('[data-item-id][disabled]').count()==38);p.keyboard.press('Escape')
  before=p.evaluate('HEWRSApp.ui.snapshot()');p.click('#pref-shirt');p.locator('[data-item-id="DS025"]').click();p.keyboard.press('Escape');ck('Real picker Cancel preserves all preferences',p.evaluate('HEWRSApp.ui.snapshot()')==before)
  p.click('#pref-shirt');p.locator('[data-item-id="DS025"]').click();p.click('#picker-apply');after=p.evaluate('HEWRSApp.ui.snapshot()');ck('Real picker Apply changes only the intended shirt',after['shirt']['id']=='DS025'and all(after[k]==before[k]for k in before if k!='shirt'))
  p.click('#pref-tie');ck('New shirt picker exposes all 47 ties plus No Tie',p.locator('[data-item-id]').count()==48 and p.locator('[data-item-id][disabled]').count()==0);p.keyboard.press('Escape')
  prefs(p,S(shirt='DS040',state='NO_TIE'));p.click('#pref-tie');ck('Existing DS040 no-tie restriction remains enforced',p.locator('[data-item-id][disabled]').count()==47 and p.locator('[data-item-id="NO_TIE"]').is_enabled());p.keyboard.press('Escape')
  target=O('DS025','NO_TIE');run(p,target);frame=digest(p);ledger=p.evaluate('HEWRSApp.store.exportText()')
  error=p.evaluate('''async s=>{try{await HEWRSApp.apply(s,{save:false});return null;}catch(e){return e.code;}}''',B(shirt='DS036'))
  ck('Unsupported route retains the preceding complete frame and ledger',error=='NON_SUIT_SOURCE_COVERAGE_UNBOUND'and digest(p)==frame and p.evaluate('HEWRSApp.store.exportText()')==ledger)
  p.evaluate('HEWRSApp.showPage("outfits")');p.click('#record-wear');p.click('#confirm-wear');event=p.evaluate('HEWRSApp.store.snapshot().events.at(-1)')
  ck('Wear confirmation records DS025, exact trousers and intentional null tie',event['items']['shirt']=={'id':'shirt-DS025'}and event['items']['tie']is None and event['canonical_selection']==target)
  ck('DS024/DS025 sharing source bytes never merges their wear IDs',p.evaluate('HEWRSApp.connection.historyIds({shirtOnly:true,pantId:"PG002",shirtId:"DS024",state:"NO_TIE",shoeId:"shoe-8",watchId:null}).shirt')=='shirt-DS024')
  preview=B('B03','DS023','T017');run(p,preview);p.evaluate('HEWRSApp.showPage("outfits")');p.screenshot(path=str(E/'OUTFIT_390x844.png'))
  p.evaluate('HEWRSApp.showPage("home")');fits=p.evaluate('({h:innerHeight,sh:document.documentElement.scrollHeight,w:innerWidth,sw:document.documentElement.scrollWidth})');ck('Home remains one screen at 390x844',fits['sh']<=fits['h']and fits['sw']<=fits['w'],fits);p.screenshot(path=str(E/'HOME_390x844.png'))
  ck('Synthetic sentinel remains unchanged',p.evaluate('__STORAGE_MAP.get("v115-sentinel")')=='UNCHANGED');ck('No uncaught runtime browser errors',not errors,errors)
 except Exception:
  checks.append({'name':'Browser test completion','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except Exception:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):raise SystemExit(1)
