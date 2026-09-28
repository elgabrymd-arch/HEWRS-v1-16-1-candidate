#!/usr/bin/env python3
"""Actual scripts/images/UI in in-memory Chromium. Simulated provider and browser
permission responses; not a live weather request or physical iPhone permission test.
"""
from pathlib import Path
import os,json,time,base64,io,hashlib,traceback
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];BASE=Path(os.environ['HEWRS_BASELINE_V1173']);E=R/'evidence/suits_auto_weather_v1_17_4/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];comparisons=[];engine_frames=[];errors=[];started=time.monotonic()
def save():
 (E/'RESULT.json').write_text(json.dumps({'scope':__doc__,'passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'native_comparisons':comparisons,'engine_frames':engine_frames,'errors':errors,'seconds':round(time.monotonic()-started,2)},indent=2)+'\n')
def ck(name,yes,detail=None):
 checks.append({'name':name,'passed':bool(yes),'detail':detail});print(('PASS 'if yes else'FAIL ')+name,flush=True);save()
 if not yes:raise AssertionError(name+': '+str(detail))
def supply(p,hs):
 present=set(p.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hs.items():
  if sha in present:continue
  val=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=val;size+=len(val)
  if size>2000000:p.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:p.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
MOCK=r'''()=>{
 globalThis.__GPS=0;globalThis.__HTTP=0;globalThis.__PERMISSION='prompt';globalThis.__OFFLINE=false;globalThis.__HOLD=false;
 Object.defineProperty(globalThis,'isSecureContext',{configurable:true,value:true});
 Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:__PERMISSION})}});
 Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok,fail){__GPS++;if(__PERMISSION==='denied')fail({code:1});else{__PERMISSION='granted';ok({coords:{latitude:42.1264,longitude:-71.2367}});}}}});
 globalThis.fetch=async(url,opt)=>{__HTTP++;if(__OFFLINE)throw TypeError('Simulated offline');if(__HOLD)await new Promise(r=>globalThis.__UNBLOCK=r);
 const n=new Date(),d=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
 return {ok:true,json:async()=>({timezone:'America/New_York',current_units:{temperature_2m:'°F',apparent_temperature:'°F',precipitation:'mm'},current:{time:d+'T12:00',temperature_2m:68,apparent_temperature:67,precipitation:0,weather_code:3},daily_units:{temperature_2m_max:'°F',apparent_temperature_max:'°F',precipitation_sum:'mm'},daily:{time:[d],temperature_2m_max:[72],temperature_2m_min:[48],apparent_temperature_max:[70],precipitation_sum:[0],weather_code:[3]}})};
 };
}'''
def load(p,r,seed=None,permission='prompt'):
 p.evaluate(MOCK);p.evaluate('v=>__PERMISSION=v',permission);h.R=r
 preload=[]
 for value in (seed or {}).values():
  try:
   saved=json.loads(value)
   if isinstance(saved,dict)and isinstance(saved.get('session'),dict)and saved['session'].get('selection'):preload.append(saved['session']['selection'])
  except (ValueError,TypeError):pass
 h.load(p,storage=seed or {'audit-sentinel':'UNCHANGED'},preload=preload)
 if r==R:p.wait_for_function('()=>!HEWRSApp.autoWeather.status().pending',timeout=30000)
def ensure(p,r,sels):h.R=r;h.ensure(p,sels)
S=lambda shirt='DS029',state='T028',suit='S05':dict(suitId=suit,shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
B=lambda shirt='DS023',state='T017',blazer='B03':dict(blazerId=blazer,pantId='PG002',shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
O=lambda shirt='DS023',state='T017':dict(shirtOnly=True,pantId='PG002',shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def pixels(p):return Image.open(io.BytesIO(base64.b64decode(p.evaluate('document.querySelector("#avatar").toDataURL("image/png")').split(',')[1]))).convert('RGBA')
COMPARE='''()=>{const a=['old','now'].map(id=>document.querySelector('#'+id).contentWindow.document.querySelector('#avatar').getContext('2d',{willReadFrequently:true}).getImageData(0,0,996,2748).data);let n=0;for(let i=0;i<a[0].length;i++)if(a[0][i]!==a[1][i])n++;return {changed_samples:n,equal:n===0};}'''
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);page=None;p=None
 def reset():
  global page,frames
  if page:page.close()
  page=browser.new_page(viewport={'width':820,'height':850});page.on('pageerror',lambda e:errors.append(str(e)));page.set_content('<iframe id="old" style="width:390px;height:700px"></iframe><iframe id="now" style="width:390px;height:700px"></iframe>');frames=[page.locator('#'+id).element_handle().content_frame()for id in ['old','now']]
  for f,r in zip(frames,[BASE,R]):load(f,r)
 try:
  reset();ck('Verified baseline and corrected source load independently',frames[0].evaluate('HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_17_3'and frames[1].evaluate('HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_17_4')
  shirts=frames[1].evaluate('HEWRSApp.connection.manifest.shirt_order');nonsuits=frames[1].evaluate('HEWRSApp.connection.nonSuitSources.connectedIds')
  seq=[S(s,'NO_TIE')for s in shirts]+[S('DS029',f'T{i:03}')for i in range(1,48)]+[S('DS035','T017',f'S{i:02}')for i in range(1,19)]+[B('DS023','NO_TIE',f'B{i:02}')for i in range(1,15)]+[O(s,t)for s in nonsuits for t in ['NO_TIE','T017']]+[S('DS035','REFERENCE')]
  for i,s in enumerate(seq):
   if i and i%36==0:reset()
   for f,r in zip(frames,[BASE,R]):ensure(f,r,[s]);f.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
   z=page.evaluate(COMPARE);comparisons.append({'selection':s,**z});assert z['equal'],str(s)
   if(i+1)%20==0:print('Native frames',i+1,flush=True);save()
  ck('All 166 existing suit, tie, shirt, blazer and no-tie/reference frames remain pixel-identical',len(comparisons)==166)
  page.close();page=None;p=browser.new_page(viewport={'width':390,'height':700},has_touch=True);p.on('pageerror',lambda e:errors.append(str(e)));load(p,R)
  ck('First visit does not request GPS/provider when permission is prompt',p.evaluate('__GPS===0&&__HTTP===0&&HEWRSApp.autoWeather.status().status==="needs_permission"'))
  # Exact S10/S11 selections through actual picker, with current weather logic.
  thumbs=[]
  for sid in ['S10','S11']:
   p.evaluate('()=>{const a=HEWRSApp;a.autoWeather.disable();a.weather.apply({source:"manual",date:a.state().context.localDate,temperatureBand:"mildWarm",precipitation:"dry",season:"Fall"});a.ui.reset();a.setMode("engine");a.showPage("home");}')
   p.click('#pref-topwear');p.locator('[data-item-id="'+sid+'"]').click();p.click('#picker-apply')
   sels=p.evaluate('()=>{const a=HEWRSApp,ctx=a.state().context,op=a.ui.operation("engine",{...ctx,environment:a.weather.request(ctx.localDate)});return a.connection.controller.generate(op.request,a.connection.catalogue,[]).options.map(o=>o._hewrsConnected.canonical_selection);}')
   ensure(p,R,sels);p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().optionCount===15',timeout=90000)
   ck(sid+' actual picker + Generate yields 15 in Fall and respects every other two-use cap',p.evaluate('(id)=>{const r=HEWRSApp.state().report;return r.options.every(o=>o._hewrsConnected.canonical_selection.suitId===id)&&Object.entries(r.option_policy.item_counts).every(([key,n])=>key===HEWRSApp.connection.aliases.get(id)||n<=2)&&r.option_policy.no_tie_options<=2;}',sid))
   for i in range(15):
    s=p.evaluate('HEWRSApp.state().selection');assert s==sels[i];engine_frames.append({'suit':sid,'option':i+1,'selection':s})
    if i==0:thumbs.append((sid,pixels(p)));p.screenshot(path=str(E/(sid+'_OPTION_1_390x700.png')))
    if i<14:p.click('#next-option');p.wait_for_function('(i)=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===i',arg=i+1)
  ck('All 30 S10/S11 navigation frames match their actual option IDs',len(engine_frames)==30)
  im=Image.new('RGB',(560,800),(235,232,226));dr=ImageDraw.Draw(im);dr.text((12,10),'V1.17.4 / S10 AND S11 / MILD DRY FALL TEST',fill=(25,25,25))
  for i,(sid,pic)in enumerate(thumbs):
   th=pic.resize((245,676),Image.Resampling.LANCZOS);im.paste(th,(15+280*i,55),th);dr.text((20+280*i,35),sid+' - option 1 of 15',fill=(25,25,25))
  dr.text((12,752),'Actual app render. Weather/history are test fixtures.',fill=(25,25,25));im.save(E/'S10_S11_OPTIONS.png')
  before=p.evaluate('({wear:HEWRSApp.store.exportText(),favorites:HEWRSApp.favorites.exportText(),prefs:HEWRSApp.ui.snapshot()})')
  p.evaluate('HEWRSApp.showPage("home")');p.click('#weather-button');p.click('#weather-auto-enable');p.wait_for_function('()=>HEWRSApp.autoWeather.status().status==="ready"&&!HEWRSApp.autoWeather.status().pending')
  ck('One explicit Enable gets permission, fetches weather, and saves automatically without Apply',p.evaluate('__GPS===1&&__HTTP===1&&HEWRSApp.weather.snapshot().source==="live"&&HEWRSApp.autoWeather.settings().mode==="device"'))
  p.screenshot(path=str(E/'AUTO_WEATHER_390x700.png'));p.click('#fx-sheet-close')
  ck('Automatic weather does not modify the outfit locks, wear or Favorites',before==p.evaluate('({wear:HEWRSApp.store.exportText(),favorites:HEWRSApp.favorites.exportText(),prefs:HEWRSApp.ui.snapshot()})'))
  seed=p.evaluate('Object.fromEntries(__STORAGE_MAP)');before_data={k:v for k,v in seed.items()if k not in ['hewrs:weather-context:v1','hewrs:automatic-weather:v1']};p.close()
  p=browser.new_page(viewport={'width':390,'height':700},has_touch=True);p.on('pageerror',lambda e:errors.append(str(e)));load(p,R,seed=seed,permission='granted')
  ck('New page with saved opt-in and granted browser permission silently refreshes current location',p.evaluate('__GPS===1&&__HTTP===1&&HEWRSApp.weather.snapshot().locationBasis==="current_device_fix"&&HEWRSApp.autoWeather.status().status==="ready"'))
  ck('Reloaded automatic refresh preserves all non-weather storage bytes',before_data==p.evaluate('Object.fromEntries([...__STORAGE_MAP].filter(([k])=>!["hewrs:weather-context:v1","hewrs:automatic-weather:v1"].includes(k)))'))
  # Expired browser permission must never cause repeated prompts.
  seed=p.evaluate('Object.fromEntries(__STORAGE_MAP)');p.close();p=browser.new_page(viewport={'width':390,'height':700},has_touch=True);p.on('pageerror',lambda e:errors.append(str(e)));load(p,R,seed=seed,permission='prompt')
  ck('Expired/prompt permission refreshes saved coordinates with zero GPS prompts',p.evaluate('__GPS===0&&__HTTP===1&&HEWRSApp.weather.snapshot().locationBasis==="saved_coordinates"&&HEWRSApp.autoWeather.status().usingSavedLocation'))
  ck('Saved-location fallback is labelled rather than passed off as a new location fix', 'Saved location' in p.locator('#weather-button').get_attribute('title'))
  before_weather=p.evaluate('HEWRSApp.weather.snapshot()');p.evaluate('__OFFLINE=true');p.evaluate('HEWRSApp.refreshAutomaticWeather("test",true)')
  ck('Provider failure keeps the previous saved weather and reports a specific error',p.evaluate('HEWRSApp.autoWeather.status().errorCode')=='NETWORK_UNREACHABLE'and p.evaluate('HEWRSApp.weather.snapshot()')==before_weather)
  p.evaluate('__OFFLINE=false');p.click('#weather-button');p.select_option('#weather-temperature','hot');p.select_option('#weather-precipitation','dry');p.select_option('#weather-season','Fall');p.click('#weather-apply')
  ck('Manual fallback Apply explicitly pauses automatic refresh',p.evaluate('HEWRSApp.weather.snapshot().source==="manual"&&HEWRSApp.autoWeather.settings().mode==="off"'))
  n=p.evaluate('__HTTP');p.evaluate('HEWRSApp.refreshAutomaticWeather("resume",true)');ck('Manual weather is not overwritten on foreground refresh',p.evaluate('__HTTP')==n)
  # Explicit work dates and existing modal cancellation preserve state.
  p.click('#work-button');p.fill('#local-date','2026-09-28');p.press('#local-date','Tab');p.get_by_role('button',name='Apply',exact=True).click()
  ck('Changing the work date opts out of follow-today instead of silently overwriting the chosen date',p.evaluate('HEWRSApp.state().context.localDate==="2026-09-28"&&HEWRSApp.autoWeather.settings().dateMode==="selected"'))
  p.click('#weather-button');before_cancel=p.evaluate('JSON.stringify(HEWRSApp.weather.snapshot())');p.click('#weather-today');p.get_by_role('button',name='Cancel',exact=True).click()
  ck('Existing date/weather Cancel preserves settings and selected work date',p.evaluate('JSON.stringify(HEWRSApp.weather.snapshot())')==before_cancel and p.evaluate('HEWRSApp.state().context.localDate')=='2026-09-28')
  for w,hh in [(320,568),(390,700),(390,350),(430,932),(1024,768)]:
   p.set_viewport_size({'width':w,'height':hh});p.click('#weather-button');p.wait_for_timeout(50);measure=p.evaluate('()=>{const b=document.querySelector("#fx-sheet-body"),a=document.querySelector("#fx-sheet-actions").getBoundingClientRect(),d=document.documentElement;return {bodyWidth:b.clientWidth,bodyScroll:b.scrollWidth,actionsBottom:a.bottom,window:innerHeight,width:innerWidth,scrollWidth:d.scrollWidth};}')
   assert measure['bodyScroll']<=measure['bodyWidth']+1,measure;assert measure['actionsBottom']<=hh+1,measure;assert measure['scrollWidth']<=w+1,measure;p.click('#fx-sheet-close')
  ck('Auto-weather panel scrolls with reachable controls and no horizontal overflow at five viewport sizes',True)
  ck('No uncaught browser errors',not errors,errors)
 except Exception:
  checks.append({'name':'Browser test completion','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:(p or page).screenshot(path=str(E/'FAILURE.png'))
  except:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):raise SystemExit(1)
