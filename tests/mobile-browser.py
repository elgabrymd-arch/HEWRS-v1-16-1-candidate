#!/usr/bin/env python3
"""Actual source and canvas tests in memory-loaded touch Chromium. All successful
weather/GPS responses are synthetic fixtures. Not live-provider or iPhone proof."""
from pathlib import Path
import sys,os,json,time,base64,io,hashlib,traceback
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];BASE=Path(os.environ.get('HEWRS_BASELINE_V1170',str(R.parent/'HEWRS_CONNECTED_APP_V1_17_0')));E=R/'evidence/mobile_v1_17_1/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];frames=[];layouts=[];engine_frames=[];errors=[];start=time.monotonic()
def save():
 (E/'RESULT.json').write_text(json.dumps({'version':'1.17.1','scope':__doc__,'passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'outfit_regressions':frames,'layouts':layouts,'new_engine_frames':engine_frames,'errors':errors,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+': '+str(detail))
def supply(page,hashes):
 present=set(page.evaluate('()=>Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hashes.items():
  if sha in present:continue
  val=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=val;size+=len(val)
  if size>2000000:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
MOCK=r'''()=>{
 globalThis.__CALLS=[];globalThis.__GPS_CALLS=0;globalThis.__GPS_MODE='success';globalThis.__NETWORK='success';globalThis.__RELEASE=null;
 const d=new Date();globalThis.__TODAY=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 // Synthetic secure-origin/permission fixture. No native geolocation or network.
 Object.defineProperty(globalThis,'isSecureContext',{configurable:true,value:true});
 Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok,no){__GPS_CALLS++;if(__GPS_MODE==='denied')no({code:1});else if(__GPS_MODE==='success')ok({coords:{latitude:52.52312,longitude:13.40723}});else globalThis.__GPS_FINISH=()=>ok({coords:{latitude:52.52312,longitude:13.40723}});}}});
 globalThis.fetch=async(url,opts)=>{__CALLS.push({url:String(url),credentials:opts.credentials});if(__NETWORK==='offline')throw TypeError('Fixture network failure');if(__NETWORK==='429')return {ok:false,status:429,json:async()=>({reason:'Fixture request limit'})};
 const value=String(url).includes('geocoding-api.')?{results:[{name:'Berlin TEST FIXTURE',admin1:'Berlin',country:'Germany',latitude:52.52312,longitude:13.40723},{name:'Berlin TEST FIXTURE',admin1:'Connecticut',country:'US',latitude:41.62,longitude:-72.74}]}:{timezone:'Europe/Berlin',current_units:{temperature_2m:'°F',apparent_temperature:'°F',precipitation:'mm'},current:{time:__TODAY+'T12:00',temperature_2m:70,apparent_temperature:62,precipitation:0,weather_code:3},daily_units:{temperature_2m_max:'°F',apparent_temperature_max:'°F',precipitation_sum:'mm'},daily:{time:[__TODAY],temperature_2m_max:[75],temperature_2m_min:[51],apparent_temperature_max:[74],precipitation_sum:[0],weather_code:[3]}};
 if(__NETWORK==='hold')await new Promise(resolve=>{globalThis.__RELEASE=resolve;});return {ok:true,json:async()=>value};};
}'''
def load(p,r,mock=False,seed=None,preload=None):
 if mock:p.evaluate(MOCK)
 h.R=r;h.load(p,storage=seed or {'sentinel':'UNCHANGED'},preload=preload)
def ensure(p,r,sels):h.R=r;h.ensure(p,sels)
def run(p,s):return p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
def pix(p,sel='#avatar'):return Image.open(io.BytesIO(base64.b64decode(p.evaluate('(sel)=>document.querySelector(sel).toDataURL("image/png")',sel).split(',')[1]))).convert('RGBA')
def digest(p,sel='#avatar'):return hashlib.sha256(pix(p,sel).tobytes()).hexdigest()
def noWrites(p):return p.evaluate('()=>({wear:HEWRSApp.store.exportText(),fav:HEWRSApp.favorites.exportText()})')
def openweather(p):p.evaluate('()=>HEWRSApp.showPage("home")');p.click('#weather-button')
def close(p):p.click('#fx-sheet-close')
def B(id='DS023',t='T017'):return dict(blazerId='B03',shirtId=id,state=t,pantId='PG002',shoeId='shoe-8',watchId=None)
def O(id='DS023',t='T017'):return dict(shirtOnly=True,shirtId=id,state=t,pantId='PG002',shoeId='shoe-8',watchId=None)
def S(id='DS023',t='T017',sid='S05'):return dict(suitId=sid,shirtId=id,state=t,shoeId='shoe-8',watchId=None)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);p=browser.new_page(viewport={'width':390,'height':700},has_touch=True,is_mobile=True);p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R,True);ck('Updated app loads, no automatic GPS/provider request',p.evaluate('()=>HEWRSApp.version==="HEWRS_CONNECTED_APP_V1_17_1"&&__GPS_CALLS===0&&__CALLS.length===0'))
  before_data=noWrites(p);prefs=p.evaluate('()=>HEWRSApp.ui.snapshot()')
  openweather(p);ck('Weather work date visible; incomplete Apply disabled',p.locator('#weather-date').input_value()==p.evaluate('()=>HEWRSApp.state().context.localDate') and p.locator('#weather-apply').is_disabled())
  # Enter must work on a software-keyboard search action.
  p.fill('#weather-city','Berlin');p.press('#weather-city','Enter');p.wait_for_selector('[data-weather-location]');ck('Search Enter returns ambiguous cities without requesting GPS',p.locator('[data-weather-location]').count()==2 and p.evaluate('()=>__GPS_CALLS')==0)
  p.locator('[data-weather-location]').first.click();p.wait_for_function('()=>document.querySelector("#weather-result").textContent.includes("Current model estimate")');ck('Search result stays draft until Apply, no weather substitution',p.evaluate('()=>HEWRSApp.weather.snapshot()') is None and p.locator('#weather-apply').is_enabled())
  p.screenshot(path=str(E/'WEATHER_FIXTURE_READY_390x700.png'));p.click('#weather-apply');saved=p.evaluate('()=>HEWRSApp.weather.snapshot()');ck('Apply commits chosen city and actual fixture feels-like band',saved['source']=='live' and saved['temperatureBand']=='cool' and 'TEST FIXTURE' in saved['place']['label'])
  # Permission failure code; city route and previous weather remain usable.
  openweather(p);p.evaluate('()=>{__GPS_MODE="denied";}');p.click('#weather-use-location');p.wait_for_function('()=>document.querySelector("#weather-result").textContent.includes("LOCATION_DENIED")');ck('Phone permission-denied error is explicit and retains saved weather',p.evaluate('()=>HEWRSApp.weather.snapshot()')==saved and p.locator('#weather-search').is_enabled());p.screenshot(path=str(E/'LOCATION_DENIED_390x700.png'))
  p.evaluate('()=>{__NETWORK="offline";__GPS_MODE="success";}');p.click('#weather-refresh');p.wait_for_function('()=>document.querySelector("#weather-result").textContent.includes("NETWORK_UNREACHABLE")');ck('Provider connectivity failure is not mislabeled a GPS failure',p.evaluate('()=>HEWRSApp.weather.snapshot()')==saved and p.locator('#weather-retry').is_visible());p.screenshot(path=str(E/'PROVIDER_UNREACHABLE_390x700.png'))
  p.evaluate('()=>{__NETWORK="success";}');gps=p.evaluate('()=>__GPS_CALLS');p.click('#weather-retry');p.wait_for_function('()=>document.querySelector("#weather-result").textContent.includes("Review, then tap Apply")');ck('Retry saved location fetches weather without new permission request',p.evaluate('()=>__GPS_CALLS')==gps);close(p)
  # Stale saved date identified, explicit Today not a hidden change.
  p.click('#work-button');p.fill('#local-date','2026-09-23');p.press('#local-date','Tab');p.get_by_role('button',name='Apply',exact=True).click();old_date=p.evaluate('()=>HEWRSApp.state().context.localDate');openweather(p);p.click('#weather-refresh');p.wait_for_function('()=>document.querySelector("#weather-result").textContent.includes("DATE_OUTSIDE_FORECAST")');ck('Restored old work date is explained with Today action',old_date=='2026-09-23' and p.evaluate('()=>HEWRSApp.state().context.localDate')==old_date)
  p.click('#weather-today');ck('Today remains draft until Apply, does not rewrite log or preferences',p.evaluate('()=>HEWRSApp.state().context.localDate')==old_date and p.locator('#weather-apply').is_disabled() and p.evaluate('()=>HEWRSApp.ui.snapshot()')==prefs)
  p.click('#weather-refresh');p.wait_for_function('()=>!document.querySelector("#weather-apply").disabled');p.click('#weather-apply');ck('Today+Refresh+Apply recovers old-date lookup failure',p.evaluate('()=>HEWRSApp.state().context.localDate===__TODAY&&HEWRSApp.weather.snapshot().date===__TODAY'))
  # Prevent committing a previous weather value during an active request.
  saved=p.evaluate('()=>HEWRSApp.weather.snapshot()');openweather(p);p.evaluate('()=>{__NETWORK="hold";}');p.click('#weather-refresh');p.wait_for_function('()=>!!__RELEASE');ck('Apply is disabled during pending lookup; cancellation remains accessible',p.locator('#weather-apply').is_disabled() and p.locator('#weather-cancel-lookup').is_visible());p.click('#weather-cancel-lookup');p.evaluate('()=>{__RELEASE();__NETWORK="success";}');p.wait_for_timeout(30);ck('Cancelled late provider response cannot replace saved conditions',p.evaluate('()=>HEWRSApp.weather.snapshot()')==saved);close(p)
  # Manual weather cancels pending GPS to avoid a later overwrite.
  openweather(p);p.evaluate('()=>{__GPS_MODE="hold";}');p.click('#weather-use-location');p.select_option('#weather-temperature','mildWarm');p.select_option('#weather-precipitation','dry');p.select_option('#weather-season','Fall');p.fill('#weather-manual-location','MANUAL TEST ONLY');p.press('#weather-manual-location','Tab');p.evaluate('()=>{__GPS_FINISH();__GPS_MODE="success";}');p.wait_for_timeout(30);ck('Manual fallback can replace a pending GPS draft without late overwrites',p.locator('#weather-apply').is_enabled() and 'Manual conditions' in p.locator('#weather-result').inner_text());p.click('#weather-apply');ck('Manual fallback commits explicit manual source, not invented live readings',p.evaluate('()=>HEWRSApp.weather.snapshot().source==="manual"'))
  ck('Weather UI did not alter wear, Favorites, preference locks',noWrites(p)==before_data and p.evaluate('()=>HEWRSApp.ui.snapshot()')==prefs)
  # Regular font + modal controls with reduced height, not a real iOS keyboard.
  for w,hh in [(320,568),(390,700),(390,350),(430,932),(1024,768)]:
   p.set_viewport_size({'width':w,'height':hh});openweather(p);p.fill('#weather-city','Boston');p.focus('#weather-city');p.wait_for_timeout(40)
   val=p.evaluate('()=>{const b=document.querySelector("#fx-sheet-actions").getBoundingClientRect(),s=document.querySelector("#fx-sheet"),body=document.querySelector("#fx-sheet-body");return {footerTop:b.top,footerBottom:b.bottom,width:s.getBoundingClientRect().width,body:body.clientHeight,font:parseFloat(getComputedStyle(document.querySelector("#weather-city")).fontSize),horizontal:document.documentElement.scrollWidth<=innerWidth};}')
   ok=val['footerTop']>=0 and val['footerBottom']<=hh+1 and val['body']>30 and val['width']<=w+1 and val['font']>=16 and val['horizontal'];layouts.append({'width':w,'height':hh,'passed':ok,**val});close(p)
  ck('Weather controls remain reachable in five viewport/keyboard-sized cases',all(x['passed']for x in layouts),layouts)
  p.set_viewport_size({'width':390,'height':700});p.evaluate('()=>HEWRSApp.showPage("outfits")');old=browser.new_page(viewport={'width':390,'height':700},has_touch=True,is_mobile=True);load(old,BASE);old.evaluate('()=>HEWRSApp.showPage("outfits")')
  bounds=lambda q:q.evaluate('()=>{const r=document.querySelector("#avatar").getBoundingClientRect();return {width:r.width,height:r.height};}')
  aa,bb=bounds(p),bounds(old);ck('Default phone avatar is at least 1.8x larger in both dimensions',aa['height']>=bb['height']*1.8 and aa['width']>=bb['width']*1.8,{'before':bb,'after':aa})
  old.screenshot(path=str(E/'OUTFIT_BEFORE_390x700.png'));p.screenshot(path=str(E/'OUTFIT_AFTER_390x700.png'))
  # Full/collar/enlarge are CSS/read-only display operations.
  native=digest(p);data=noWrites(p);p.click('#large-view');ck('Enlarged viewer copies every native pixel without a second outfit render',digest(p,'#large-avatar')==native and noWrites(p)==data);p.screenshot(path=str(E/'ENLARGED_390x700.png'));p.click('#large-outfit-fit');ck('Fit and Larger do not alter canvas pixels or history',digest(p,'#large-avatar')==native and noWrites(p)==data);p.click('#large-outfit-zoom');close(p);p.click('#detail-view');p.screenshot(path=str(E/'COLLAR_DETAIL_390x700.png'));p.click('#full-view');ck('Returning from enlarged/collar view retains exact current outfit',digest(p)==native)
  # Current image bytes / selectors unchanged on 90 actual configurations.
  ids=p.evaluate('()=>HEWRSApp.connection.nonSuitSources.connectedIds');controls=[fn(id,t) for id in ids for t in ['NO_TIE','T017']for fn in [B,O]]+[S(sid='S'+str(i).zfill(2))for i in range(1,19)]
  ensure(p,R,controls);ensure(old,BASE,controls)
  for n,s in enumerate(controls):
   run(p,s);run(old,s);a,b=digest(p),digest(old);frames.append({'selection':s,'after':a,'before':b,'equal':a==b});assert a==b
   if(n+1)%20==0:print('FRAMES',n+1,flush=True);save()
  ck('90 outfit renderings are pixel-identical to V1.17.0',len(frames)==90 and all(x['equal']for x in frames));old.close()
  # The entire 15-option route still runs with weather and locked DNA.
  p.evaluate('()=>{HEWRSApp.ui.reset();HEWRSApp.setMode("engine");HEWRSApp.showPage("home");}');sels=p.evaluate('()=>{const a=HEWRSApp,ctx=a.state().context,op=a.ui.operation("engine",{...ctx,environment:a.weather.request(ctx.localDate)});const opts=a.connection.controller.generate(op.request,a.connection.catalogue,a.store.snapshot().events);return opts.options.map(x=>x._hewrsConnected.canonical_selection);}')
  ensure(p,R,sels);preEvents=p.evaluate('()=>HEWRSApp.store.snapshot().events');p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().optionCount===15',timeout=60000)
  for i in range(15):
   ss=p.evaluate('()=>HEWRSApp.state()');sel=ss['selection'];expected=ss['report']['options'][i]['_hewrsConnected']['canonical_selection'];assert expected==sel;engine_frames.append({'index':i+1,'selection':sel,'rgba_sha256':digest(p)})
   if i<14:p.click('#next-option');p.wait_for_function('i=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===i',arg=i+1,timeout=30000)
  ck('Generate and arrows still render all 15 distinct options with unchanged wear',len({json.dumps(x['selection'],sort_keys=True)for x in engine_frames})==15 and p.evaluate('()=>HEWRSApp.store.snapshot().events')==preEvents)
  # Reload from synthetic browser storage, not process-restart certification.
  seed=p.evaluate('()=>Object.fromEntries(__STORAGE_MAP)');last=p.evaluate('()=>HEWRSApp.state().selection');q=browser.new_page(viewport={'width':390,'height':700},has_touch=True,is_mobile=True);load(q,R,True,seed,[last]);ck('Saved weather and outfit restore from isolated storage without auto-fetch',q.evaluate('()=>HEWRSApp.weather.snapshot()')==p.evaluate('()=>HEWRSApp.weather.snapshot()') and q.evaluate('()=>HEWRSApp.state().selection')==last and q.evaluate('()=>__CALLS.length')==0);q.close()
  ck('No uncaught browser errors',not errors,errors)
 except Exception:
  checks.append({'name':'Completed browser suite','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except:pass
 finally:save();browser.close()
if any(not x['passed'] for x in checks):raise SystemExit(1)
