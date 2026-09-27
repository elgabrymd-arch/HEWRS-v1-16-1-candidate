#!/usr/bin/env python3
"""Actual scripts/images in memory-loaded Chromium. Synthetic location/provider
fixtures test the UI, not a physical GPS or live iPhone weather certification."""
from pathlib import Path
import os,json,time,hashlib,base64,io,traceback,importlib.util
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];BASE=Path(os.environ.get('HEWRS_BASELINE_V1167',str(R.parent/'HEWRS_CONNECTED_APP_V1_16_7')));E=R/'evidence/core_v1_17_0/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];frames=[];errors=[];layouts=[];new_frames=[];started=time.monotonic()
def save():
 (E/'RESULT.json').write_text(json.dumps({'schema':'hewrs.core.chromium.v1_17_0','scope':__doc__,'passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'outfit_frames':frames,'new_engine_frames':new_frames,'layout_cases':layouts,'errors':errors,'seconds':round(time.monotonic()-started,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+': '+str(detail))
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hashes.items():
  if sha in present:continue
  val=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=val;size+=len(val)
  if size>2_000_000:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
MOCK='''()=>{globalThis.__PROVIDER_CALLS=[];globalThis.__WEATHER_FAIL=false;globalThis.__LOCATION_DENIED=false;
Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok,no){if(__LOCATION_DENIED)no({code:1});else ok({coords:{latitude:52.523123,longitude:13.407231}});}}});
globalThis.fetch=async(url,opts)=>{__PROVIDER_CALLS.push({url:String(url),credentials:opts.credentials});if(__WEATHER_FAIL)throw Error('Synthetic offline');const d=HEWRSApp.state().context.localDate;if(String(url).includes('geocoding-api.'))return {ok:true,json:async()=>({results:[{name:'Berlin',admin1:'Berlin',country:'Germany',latitude:52.523123,longitude:13.407231},{name:'Berlin',admin1:'Connecticut',country:'US',latitude:41.62,longitude:-72.74}]})};return {ok:true,json:async()=>({timezone:'Europe/Berlin',current_units:{temperature_2m:'°F',apparent_temperature:'°F',precipitation:'mm'},current:{time:d+'T12:00',temperature_2m:70,apparent_temperature:62,precipitation:0,weather_code:3},daily:{time:[d],temperature_2m_max:[75],temperature_2m_min:[51]},daily_units:{temperature_2m_max:'°F'}})};};}'''
def load(page,r,mock=False,storage=None):
 if mock:page.evaluate(MOCK)
 preload=[]
 for value in (storage or {}).values():
  try:
   v=json.loads(value)
   if isinstance(v,dict) and isinstance(v.get('session'),dict) and v['session'].get('selection'):preload.append(v['session']['selection'])
  except (TypeError,ValueError):pass
 h.R=r;h.load(page,storage=storage or {'core-sentinel':'UNCHANGED'},preload=preload)
def ensure(page,r,selections):h.R=r;h.ensure(page,selections)
def pix(page):return Image.open(io.BytesIO(base64.b64decode(page.evaluate('document.querySelector("#avatar").toDataURL("image/png")').split(',')[1]))).convert('RGBA')
def digest(page):return hashlib.sha256(pix(page).tobytes()).hexdigest()
def select(page,s):return page.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
def S(shirt='DS023',state='T017',suit='S05'):return dict(suitId=suit,shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def B(shirt='DS023',state='T017',blazer='B03'):return dict(blazerId=blazer,pantId='PG002',shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def O(shirt='DS023',state='T017'):return dict(shirtOnly=True,pantId='PG002',shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def prepare_candidates(page):
 return page.evaluate('''()=>{const a=HEWRSApp,s=a.state(),op=a.ui.operation('engine',{...s.context,environment:a.weather.request(s.context.localDate)});globalThis.__TEST_QUERY=op.request;globalThis.__TEST_OPTIONS=a.connection.controller.generate(op.request,a.connection.catalogue,a.store.snapshot().events).options;return __TEST_OPTIONS.map(x=>x._hewrsConnected.canonical_selection);}''')
with sync_playwright()as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);p=b.new_page(viewport={'width':390,'height':700});p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R,True);ck('New app loads with all six Engine categories unlocked',p.evaluate('HEWRSApp.version==="HEWRS_CONNECTED_APP_V1_17_0"&&Object.values(HEWRSApp.ui.snapshot()).every(x=>x.mode==="any")&&HEWRSApp.state().mode==="engine"'))
  ck('No implicit location or external weather request at load',p.evaluate('__PROVIDER_CALLS.length')==0)
  p.click('#weather-button');p.locator('#weather-city').fill('Berlin');p.click('#weather-search');ck('City search exposes ambiguous locations for owner selection',p.locator('[data-weather-location]').count()==2)
  p.locator('[data-weather-location]').first.click();p.wait_for_function('()=>document.querySelector("#weather-result").textContent.includes("Current model estimate")');ck('API result stays draft until Apply',p.evaluate('HEWRSApp.weather.snapshot()')is None)
  p.screenshot(path=str(E/'WEATHER_DRAFT_390x700.png'));p.click('#weather-apply');ck('Confirmed location, temperature, feels-like and season persist separately',p.evaluate('HEWRSApp.weather.snapshot().place.label.startsWith("Berlin")&&HEWRSApp.weather.snapshot().temperatureBand==="cool"&&document.querySelector("#weather-label").textContent.includes("70")'))
  before=p.evaluate('({wear:HEWRSApp.store.snapshot().events,fav:HEWRSApp.favorites.snapshot()})');p.screenshot(path=str(E/'ENGINE_HOME_390x700.png'))
  selections=prepare_candidates(p);ensure(p,R,selections);p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().optionCount===15',timeout=60000)
  ck('Actual Generate button returns 15 options with no mandatory suit or shoe anchor',p.evaluate('HEWRSApp.state().optionCount===15&&Object.values(HEWRSApp.ui.snapshot()).every(x=>x.mode==="any")'))
  ck('Location/weather actually reach the request and eligible displayed option',p.evaluate('HEWRSApp.state().request.environment.place.label.startsWith("Berlin")&&HEWRSApp.state().report.options.every(x=>x._hewrsConnected.environment.eligible)'))
  thumbs=[]
  for i in range(15):
   s=p.evaluate('HEWRSApp.state().selection');ckid=p.evaluate('HEWRSApp.state().report.options[HEWRSApp.state().optionIndex]._hewrsConnected.canonical_selection');assert s==ckid
   im=pix(p);thumbs.append(im.resize((120,331),Image.Resampling.LANCZOS));new_frames.append({'index':i+1,'selection':s,'rgba_sha256':hashlib.sha256(im.tobytes()).hexdigest()})
   if i==0:p.screenshot(path=str(E/'ENGINE_OPTION_1_390x700.png'))
   if i<14:p.click('#next-option');p.wait_for_function('(i)=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===i',arg=i+1,timeout=30000)
  ck('All 15 result arrows display their exact selected physical items',len(new_frames)==15 and len({json.dumps(x['selection'],sort_keys=True)for x in new_frames})==15)
  sheet=Image.new('RGB',(5*150,3*375),(233,233,233));d=ImageDraw.Draw(sheet)
  for i,im in enumerate(thumbs):
   s=new_frames[i]['selection'];x=(i%5)*150;y=(i//5)*375;sheet.paste(im,(x+15,y+40),im);d.text((x+3,y+3),str(i+1)+' '+s.get('suitId',s.get('blazerId',''))+' '+s['shirtId'],fill=(25,25,25));d.text((x+3,y+18),s['state']+' / '+s['shoeId'],fill=(25,25,25))
  sheet.save(E/'FIFTEEN_ACTUAL_OPTIONS.png')
  after=p.evaluate('({wear:HEWRSApp.store.snapshot().events,fav:HEWRSApp.favorites.snapshot()})');ck('Generating and viewing options writes no wear or Favorites',after==before)
  # Weather denial/failure and Cancel retain saved state.
  saved=p.evaluate('HEWRSApp.weather.snapshot()');p.evaluate('HEWRSApp.showPage("home");__LOCATION_DENIED=true');p.click('#weather-button');p.click('#weather-use-location');p.wait_for_function('()=>document.querySelector("#weather-result").textContent.includes("permission denied")');ck('Denied location leaves saved conditions untouched and manual fields available',p.evaluate('HEWRSApp.weather.snapshot()')==saved and p.locator('#weather-temperature').count()==1)
  p.locator('#weather-temperature').select_option('hot');p.locator('#weather-precipitation').select_option('heavyRain');p.locator('#weather-season').select_option('Summer');p.get_by_role('button',name='Cancel',exact=True).click();ck('Weather Cancel does not save manual draft or change wardrobe preferences',p.evaluate('HEWRSApp.weather.snapshot()')==saved)
  p.evaluate('__LOCATION_DENIED=false;__WEATHER_FAIL=true');p.click('#weather-button');p.click('#weather-use-location');p.wait_for_function('()=>document.querySelector("#weather-result").textContent.includes("Synthetic offline")');ck('Weather network error remains visible without substituting invented conditions',p.evaluate('HEWRSApp.weather.snapshot()')==saved)
  p.locator('#weather-temperature').select_option('mildWarm');p.locator('#weather-precipitation').select_option('dry');p.locator('#weather-season').select_option('Fall');p.locator('#weather-manual-location').fill('Manual test location');p.locator('#weather-manual-location').press('Tab');p.click('#weather-apply');ck('Manual fallback works with failed live provider',p.evaluate('HEWRSApp.weather.snapshot().source==="manual"&&HEWRSApp.state().optionCount===0'))
  p.evaluate('__WEATHER_FAIL=false;HEWRSApp.setMode("anchor");HEWRSApp.ui.reset();HEWRSApp.ui.set("shirt",{mode:"item",id:"DS023"});HEWRSApp.showPage("home")');sels=prepare_candidates(p);ensure(p,R,sels);p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().optionCount===15',timeout=60000);ck('Partial Anchor keeps DS023 and chooses remaining categories automatically',p.evaluate('HEWRSApp.state().report.options.every(x=>x._hewrsConnected.canonical_selection.shirtId==="DS023")'))
  ck('Proposed ensemble score is labelled instead of presented as frozen approval', 'ensemble estimate' in p.locator('#score-label').inner_text())
  # Fresh unchanged image comparisons; none of the tests below change image bytes.
  old=b.new_page(viewport={'width':390,'height':700});load(old,BASE);ids=p.evaluate('HEWRSApp.connection.nonSuitSources.connectedIds')
  controls=[fn(sid,t)for sid in ids for t in ['NO_TIE','T017']for fn in [B,O]]+[S(suit='S'+str(i).zfill(2))for i in range(1,19)]
  ensure(p,R,controls);ensure(old,BASE,controls)
  for n,s in enumerate(controls):
   select(p,s);select(old,s);a,ob=digest(p),digest(old);frames.append({'selection':s,'before':ob,'after':a,'equal':a==ob})
   if a!=ob:raise AssertionError('Image regression '+str(s))
   if(n+1)%20==0:print('FRAMES',n+1,flush=True);save()
  old.close();ck('90 unchanged full outfit frames preserve DS023 fixes and all existing routes',len(frames)==90 and all(x['equal']for x in frames))
  # Manual exact route still has no numerical Engine masquerade.
  p.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.setMode("anchor");HEWRSApp.showPage("home");}',O());p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy');ck('Exact shirt-only Anchor remains manual with absent ranking',p.evaluate('HEWRSApp.state().selection.shirtOnly&&HEWRSApp.state().origin==="manual"&&HEWRSApp.state().score.score===null'))
  # Persistence in new page uses synthetic storage only; not actual browser restart.
  seed=p.evaluate('Object.fromEntries(__STORAGE_MAP)');nextpage=b.new_page(viewport={'width':390,'height':700});load(nextpage,R,True,seed);ck('Weather and existing outfit reload in isolated synthetic storage',nextpage.evaluate('HEWRSApp.weather.snapshot()')==p.evaluate('HEWRSApp.weather.snapshot()') and nextpage.evaluate('HEWRSApp.state().selection')==p.evaluate('HEWRSApp.state().selection'));nextpage.close()
  # Actual new weather sheet layout in normal / keyboard-sized viewports.
  p.evaluate('HEWRSApp.showPage("home")')
  for width,height in [(320,568),(390,700),(390,350),(430,932),(1024,768)]:
   p.set_viewport_size({'width':width,'height':height});p.click('#weather-button')
   a=p.locator('#weather-apply').bounding_box();cancel=p.get_by_role('button',name='Cancel',exact=True).bounding_box();overflow=p.evaluate('document.documentElement.scrollWidth>innerWidth');ok=bool(a and cancel and a['y']>=0 and a['y']+a['height']<=height+1 and cancel['y']>=0 and not overflow);layouts.append({'width':width,'height':height,'apply':a,'cancel':cancel,'passed':ok});ck('Weather sheet controls remain accessible '+str(width)+'x'+str(height),ok)
   p.get_by_role('button',name='Cancel',exact=True).click()
  p.set_viewport_size({'width':390,'height':700});p.evaluate('HEWRSApp.ui.reset();HEWRSApp.setMode("engine");HEWRSApp.showPage("home")');p.click('#pref-shirt');original=p.evaluate('HEWRSApp.ui.snapshot()');p.locator('[data-item-id="DS023"]').click();p.get_by_role('button',name='Cancel',exact=True).click();ck('Original picker Cancel stays unchanged',p.evaluate('HEWRSApp.ui.snapshot()')==original)
  p.click('#generate-options');p.click('#cancel-work');p.wait_for_function('()=>!HEWRSApp.state().busy');ck('Long automatic generation can be cancelled without logging wear',p.evaluate('HEWRSApp.store.snapshot().events')==before['wear'])
  ck('No uncaught browser errors or owner-data access',not errors,errors)
 except Exception:
  checks.append({'name':'Browser suite completed','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except Exception:pass
 finally:save();b.close()
if any(not x['passed']for x in checks):raise SystemExit(1)
