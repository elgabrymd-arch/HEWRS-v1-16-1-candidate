#!/usr/bin/env python3
"""Actual local wardrobe renderer, in-memory Chromium and fixture-only service.
No hosted origin, physical device or real AI-provider result is asserted.
"""
import os,sys,json,base64,io,hashlib,time,traceback
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];BASE=Path(os.environ['HEWRS_BASELINE_V1180']);E=R/'evidence/hybrid_v1_19_0/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];comparisons=[];start=time.monotonic()
def save():
 (E/'REGRESSION_AND_VISUAL_PIPELINE.json').write_text(json.dumps({'scope':'Actual current local scripts/images in in-memory Chromium; synthetic storage and service fixtures, no live provider or hosted-device test.','checks':checks,'passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'comparisons':comparisons,'live_provider_calls':0,'seconds':time.monotonic()-start},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+': '+str(detail))
def supply(page,hashes):
 have=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};n=0
 for k,p in hashes.items():
  if k in have:continue
  v=base64.b64encode((h.R/p).read_bytes()).decode();batch[k]=v;n+=len(v)
  if n>2000000:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};n=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
def load(p,r,storage=None):h.R=r;h.load(p,storage=storage or {'hybrid-sentinel':'unchanged'})
def ensure(p,r,s):h.R=r;h.ensure(p,s)
def im(p):return Image.open(io.BytesIO(base64.b64decode(p.evaluate("document.querySelector('#avatar').toDataURL('image/png').split(',')[1]")))).convert('RGBA')
def digest(p):return hashlib.sha256(im(p).tobytes()).hexdigest()
def apply(p,s):return p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
CONF={'automatic':True,'preferences':{k:{'mode':'any'}for k in ['topwear','shirt','tie','shoes','bottoms','watch']},'occasion':'clinic','formality':'any','style':'AUTO','localDate':'2026-09-28','environment':{'source':'not_assessed','date':'2026-09-28'}}
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=browser.new_page(viewport={'width':390,'height':700});old=browser.new_page(viewport={'width':390,'height':700});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R);load(old,BASE);ck('Current and independent V1.18.0 fixture load',p.evaluate('HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_19_0')
  ids=p.evaluate('HEWRSApp.connection.nonSuitSources.connectedIds');controls=[]
  for id in ids:
   for t in ['NO_TIE','T017']:
    controls+=[{'blazerId':'B03','pantId':'PG002','shirtId':id,'state':t,'shoeId':'shoe-8','watchId':None},{'shirtOnly':True,'pantId':'PG002','shirtId':id,'state':t,'shoeId':'shoe-8','watchId':None}]
  controls+=[{'suitId':f'S{i:02}','shirtId':'DS023','state':'T017','shoeId':'shoe-8','watchId':None}for i in range(1,19)]
  ensure(p,R,controls);ensure(old,BASE,controls)
  for i,s in enumerate(controls):
   apply(p,s);apply(old,s);a,b=digest(p),digest(old);comparisons.append({'selection':s,'current_rgba':a,'baseline_rgba':b,'equal':a==b})
   if a!=b:raise AssertionError('Pixel regression '+str(s))
   if(i+1)%15==0:print('PIXELS',i+1,flush=True);save()
  ck('90 exact native outfit frames equal; accepted DS023/tie/mode output unchanged',len(comparisons)==90 and all(x['equal']for x in comparisons));old.close()
  # All image bytes required for possible visual candidates are prepared in fixture only.
  sels=p.evaluate('(conf)=>{const c=HEWRSApp.connection;const q=c.makeRequest(conf);return c.hybrid.curatedPool(q).rows.slice(0,20).map(o=>o._hewrsConnected.canonical_selection);}',CONF);ensure(p,R,sels)
  p.evaluate('()=>{HEWRSApp.ui.reset();HEWRSApp.showPage("home");HEWRSApp.setMode("engine");}');p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"',timeout=30000)
  ck('Actual Generate produces15 curated references with all6 preferences unlocked',p.evaluate('HEWRSApp.state().optionCount===15&&Object.values(HEWRSApp.state().request.prefs).every(x=>x.mode==="any")&&!HEWRSApp.state().report.stylist.live_ai_used'))
  ck('Curated display does not masquerade as AI or numerical styling grade',p.locator('#outfit-summary').inner_text().find('no live AI')>=0 and p.locator('#score-value').inner_text().strip()=='—')
  before=p.evaluate('({events:HEWRSApp.store.snapshot().events,favs:HEWRSApp.favorites.snapshot(),selection:HEWRSApp.state().selection,prefs:HEWRSApp.ui.snapshot()})')
  p.evaluate('HEWRSApp.stylistSheet()');p.select_option('#stylist-method','visual');p.get_by_text('Apply method',exact=True).click()
  ck('Unconfigured visual mode is blocked in actual UI, not silently replaced',p.evaluate('HEWRSApp.connection.hybrid.mode()')=='curated' and p.locator('#fx-sheet').inner_text().find('not connected')>=0)
  p.locator('#fx-sheet-close').click();after=p.evaluate('({events:HEWRSApp.store.snapshot().events,favs:HEWRSApp.favorites.snapshot(),selection:HEWRSApp.state().selection,prefs:HEWRSApp.ui.snapshot()})');ck('Settings Cancel retains outfit/preferences/wear/Favorites',before==after)
  # Device-sized layouts, real existing modal owner and controls.
  sizes=[(320,568),(390,350),(390,700),(430,932),(1024,768)];cases=[]
  for w,hh in sizes:
   p.set_viewport_size({'width':w,'height':hh});p.evaluate('HEWRSApp.stylistSheet()')
   b=p.get_by_text('Apply method',exact=True).bounding_box();side=p.evaluate('document.documentElement.scrollWidth<=innerWidth+1');ok=bool(b and b['y']>=0 and b['y']+b['height']<=hh+1 and side);cases.append({'width':w,'height':hh,'apply':b,'pass':ok});p.locator('#fx-sheet-close').click()
  ck('Settings controls accessible at five viewports including keyboard-sized height',all(x['pass']for x in cases),cases)
  p.set_viewport_size({'width':390,'height':700})
  # Fixture service triggers the real offscreen wardrobe-image pipeline. No provider call.
  p.evaluate('''()=>{globalThis.__VISUAL_FIXTURE={calls:0,images:[]};HEWRSApp.connection.hybrid.setService({ready:()=>true,async propose(){__VISUAL_FIXTURE.calls++;return {job_id:'TEST_ONLY',proposals:[]};},async evaluate(q,images,job){__VISUAL_FIXTURE.calls++;__VISUAL_FIXTURE.images=images;return {method:'live_visual',provider:'OFFLINE_TEST_FIXTURE',model:'NOT_A_LIVE_MODEL',job_id:job,ranking:images.map(x=>({candidate_id:x.candidate_id,grade:'strong',explanation:'Controlled transport fixture only; not a live styling verdict.'}))};}});HEWRSApp.connection.hybrid.setMode('visual');}''')
  outcome=p.evaluate('async conf=>{const r=await HEWRSApp.generate({...conf,stylistMode:"visual"});return {n:r.options.length,method:r.stylist.method,provider:r.stylist.provider};}',CONF)
  ck('Two-phase proposal+visual-review pipeline completes with explicit fixture provider',outcome=={'n':15,'method':'visual','provider':'OFFLINE_TEST_FIXTURE'}and p.evaluate('__VISUAL_FIXTURE.calls')==2)
  images=p.evaluate('__VISUAL_FIXTURE.images');dims=[]
  for x in images:
   z=Image.open(io.BytesIO(base64.b64decode(x['image'].split(',')[1])));dims.append(z.size);assert z.format=='JPEG'
  ck('Every reviewed candidate received actual280x660 garment image, not text-only scoring',len(images)==20 and all(x==(280,660)for x in dims),{'images':len(images),'dimensions':[280,660],'source_crop':[0,400,996,2348]})
  # Compare actual offscreen crop for same registered selection; no alternate artwork.
  actualcrop=p.evaluate('s=>HEWRSApp.renderForStylist(s)',images[0]['selection']);ck('Visual review uses the actual same-ID registered compositor',actualcrop==images[0]['image'])
  ck('Visual generation leaves confirmed wear and Favorites unchanged',p.evaluate('HEWRSApp.store.snapshot().events')==before['events']and p.evaluate('HEWRSApp.favorites.snapshot()')==before['favs'])
  # A proposal taking time cannot survive a mid-generation valid revision change.
  beforeFrame=digest(p)
  p.evaluate('''()=>{HEWRSApp.connection.hybrid.setService({ready:()=>true,propose(){return new Promise(resolve=>globalThis.__RELEASE_PROPOSAL=resolve);},async evaluate(q,images,job){return {method:'live_visual',provider:'OFFLINE_FIXTURE',model:'NOT_LIVE',job_id:job,ranking:images.map(x=>({candidate_id:x.candidate_id,grade:'strong',explanation:'TEST'}))};}});}''')
  p.evaluate('conf=>{globalThis.__RACE_DONE=false;HEWRSApp.generate({...conf,stylistMode:"visual"}).then(()=>{__RACE_DONE="unexpected_success";}).catch(e=>{__RACE_DONE=e.message;});}',CONF)
  p.wait_for_function('()=>!!globalThis.__RELEASE_PROPOSAL')
  p.evaluate('''()=>{const c=HEWRSApp.connection,other=HEWRSLocalState.create(c,HEWRS_INPUT_SHA256,localStorage);other.addEvent(c.createHistoryEvent(HEWRSApp.state().selection,{id:'test_simulated_other_tab',localDate:'2026-09-27',origin:'manual'}));__RELEASE_PROPOSAL({job_id:'TEST_ONLY',proposals:[]});}''')
  p.wait_for_function('()=>!!globalThis.__RACE_DONE',timeout=60000)
  ck('History change during visual request cancels stale recommendation',p.evaluate('__RACE_DONE')!='unexpected_success'and p.evaluate('HEWRSApp.state().optionCount')==0, p.evaluate('__RACE_DONE'))
  ck('Stale visual result leaves preceding native frame intact',digest(p)==beforeFrame)
  # Separate corrupt fixture never produces a curated/visual rotation from empty fallback.
  corrupt=browser.new_page(viewport={'width':390,'height':700});key=p.evaluate('HEWRSLocalState.KEY');load(corrupt,R,{key:'{CORRUPT_HISTORY_TEST_ONLY'});
  result=corrupt.evaluate('async conf=>{try{await HEWRSApp.generate(conf);return "BAD";}catch(e){return e.message;}}',CONF)
  ck('Unreadable saved history is retained and blocks reference generation',result!='BAD'and corrupt.evaluate('k=>__STORAGE_MAP.get(k)',key)=='{CORRUPT_HISTORY_TEST_ONLY');corrupt.close()
  ck('No uncaught runtime errors or synthetic sentinel mutation',not errors and p.evaluate('__STORAGE_MAP.get("hybrid-sentinel")')=='unchanged',errors)
 except Exception:
  checks.append({'name':'Completed browser suite','passed':False,'detail':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'BROWSER_FAILURE.png'))
  except Exception:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):raise SystemExit(1)
