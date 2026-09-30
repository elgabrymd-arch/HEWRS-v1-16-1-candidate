"""Real shipped bundle and compositor; in-memory delivery, not network/device certification."""
from pathlib import Path
import sys,os,json,re,base64,hashlib,time,traceback,importlib.util,subprocess
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).parent));import option_card_harness as h
R=Path(__file__).resolve().parents[1];B=Path(os.environ['HEWRS_BASELINE']);E=R/'evidence/performance_v1_22_1/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];frames=[];errors=[];started=time.time();resources=json.loads((R/'STARTUP_RESOURCES.json').read_text())
def save(): (E/'RESULT.json').write_text(json.dumps({'scope':'Shipped bundle/code + exact source images; injected script delivery and synthetic storage. No real HTTP/Safari performance claim.','passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'frames':frames,'errors':errors,'seconds':time.time()-started},indent=2))
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});save();print('PASS'if ok else'FAIL',name,flush=True)
 if not ok:raise AssertionError(name+' '+str(detail))
def native(p):return p.evaluate('()=>{const a=document.getElementById("avatar").getContext("2d").getImageData(0,0,996,2748).data;let h=2166136261;for(const x of a)h=Math.imul(h^x,16777619);return h>>>0;}')
def ui_images(p):
 p.evaluate('d=>globalThis.HEWRS_EMBEDDED_UI_IMAGES=d',{f.stem:'data:image/png;base64,'+base64.b64encode(f.read_bytes()).decode()for f in (R/'ui/option-cards').glob('*.png')})
def load(p,seed=None):
 p.set_default_timeout(45000);p.set_content((R/'app.template.html').read_text().replace('<!--STYLE-->','<style>'+(R/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->',''))
 p.evaluate('''seed=>{const m=new Map(Object.entries(seed));globalThis.__STORAGE_MAP=m;globalThis.__STORAGE_CALLS=[];Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>{__STORAGE_CALLS.push([k,v]);m.set(k,v)},removeItem:k=>m.delete(k)}});globalThis.HEWRS_EMBEDDED_IMAGES={};globalThis.__INDEX_TAGS=[];const append=document.head.appendChild.bind(document.head);document.head.appendChild=function(n){if(n.dataset?.hewrsLazyIndex){__INDEX_TAGS.push(n);return n;}return append(n);};}''',seed or {'performance-sentinel':'KEEP'})
 html=(R/'index.html').read_text();tag=re.search(r'<script[^>]+data-boot="true"[^>]*>',html).group(0);attrs=dict(re.findall(r'(data-[a-z-]+)="([^"]*)"',tag))
 p.evaluate('x=>{const s=document.createElement("script");for(const[k,v]of Object.entries(x.attrs))s.setAttribute(k,v);s.textContent=x.code;document.head.appendChild(s);}',{'attrs':attrs,'code':(R/'src/runtime-loader.js').read_text()})
 p.add_script_tag(content=(R/'data/inputs.js').read_text());p.add_script_tag(content=(R/resources['startup_scripts'][2]).read_text())
 p.wait_for_function('()=>globalThis.HEWRS_READY===true||globalThis.HEWRS_LOAD_ERROR')
 err=p.evaluate('globalThis.HEWRS_LOAD_ERROR||null');assert not err,err
 p.on('pageerror',lambda e:errors.append(str(e)))
def date(p):
 p.click('#work-button');p.locator('#local-date').fill('2026-09-29');p.locator('#local-date').dispatch_event('change');p.locator('#fx-sheet-actions').get_by_text('Apply',exact=True).click()
 p.evaluate('HEWRSApp.weather.apply({source:"not_assessed",date:"2026-09-29"})')
def setup(p,top):
 p.evaluate('top=>{HEWRSApp.showPage("home");HEWRSApp.ui.reset();if(top)HEWRSApp.ui.set("topwear",{mode:"item",id:HEWRSApp.connection.aliases.get(top)||HEWRSApp.connection.blazerConnection.knownBlazer(top).historyId});HEWRSApp.setMode("engine");}',top);date(p)
def supply_index(p):
 p.add_script_tag(content=(R/'data/option-index.js').read_text());p.evaluate('()=>__INDEX_TAGS[__INDEX_TAGS.length-1].onload()')
def protection(p):return p.evaluate('({events:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.snapshot(),feedback:__STORAGE_MAP.get(HEWRSOutfitLearning.KEY)||null,sentinel:__STORAGE_MAP.get("performance-sentinel")})')
with sync_playwright()as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  p=b.new_page(viewport={'width':390,'height':780});req=[];p.on('request',lambda r:req.append(r.url));load(p)
  ck('Home becomes interactive without loading the outfit index or any garment image',p.evaluate('HEWRS_READY&&!HEWRS_OUTFIT_READY&&!globalThis.HEWRS_OPTION_INDEX&&!HEWRSApp.state().busy&&HEWRSApp.renderer.last()===null')and p.locator('#generate-options').is_enabled(),p.evaluate('HEWRSRuntimeLoader.stats()'))
  ck('Startup creates no external image/provider request and no user-store write',not req and not p.evaluate('__STORAGE_CALLS'),req)
  p.screenshot(path=str(E/'HOME_READY_WITHOUT_IMAGES.png'))
  p.click('#pref-topwear');p.click('#fx-sheet-close');p.evaluate('HEWRSApp.showPage("wardrobe")');p.evaluate('HEWRSApp.showPage("rotation")');p.evaluate('HEWRSApp.showPage("home")');ck('Home picker, Wardrobe and Rotation operate before the index is downloaded',not p.evaluate('!!globalThis.HEWRS_OPTION_INDEX')and not p.evaluate('__STORAGE_CALLS'))
  # Record exactly what opening the old invisible default image required.
  plan=p.evaluate('''()=>{const a=HEWRSApp,out={};function walk(v){if(!v||typeof v!=='object')return;if(v.sha256&&a.connection.assetPaths[v.sha256])out[v.sha256]=a.connection.assetPaths[v.sha256];Object.values(v).forEach(walk);}walk(a.renderer.plan({suitId:'S05',shirtId:'DS036',state:'T017',shoeId:'shoe-8',watchId:null}));return out;}''')
  bytes_initial=sum((R/path).stat().st_size for path in set(plan.values()));ck('The hidden startup garment download is now deferred, not removed',len(plan)>0,{'original_distinct_layers':len(plan),'original_source_image_bytes':bytes_initial})
  ui_images(p);h.ensure(p,R,[h.h.DEFAULT]);before=protection(p);p.click('#view-current');p.wait_for_function('()=>HEWRS_OUTFIT_READY&&!HEWRSApp.state().busy');ck('View current outfit lazily restores the exact default without index or data changes',p.evaluate('HEWRSApp.renderer.last()')==h.h.DEFAULT and not p.evaluate('!!globalThis.HEWRS_OPTION_INDEX')and protection(p)==before)
  # Save a real session as a test fixture; reinitializing Home must not fetch images.
  s={'suitId':'S02','shirtId':'DS022','state':'T019','shoeId':'shoe-4','watchId':'watch-P05'};h.ensure(p,R,[s]);p.evaluate('s=>HEWRSApp.apply(s,{localDate:"2026-09-29"})',s);saved_native=native(p);seed=dict(p.evaluate('Array.from(__STORAGE_MAP.entries())'));p.close();p=b.new_page(viewport={'width':390,'height':780});load(p,seed)
  ck('Saved outfit and all stored keys survive a fresh page without eager rendering',dict(p.evaluate('Array.from(__STORAGE_MAP.entries())'))==seed and p.evaluate('HEWRSApp.renderer.last()===null')and p.locator('#view-current').is_visible())
  ui_images(p);h.ensure(p,R,[s]);p.click('#view-current');p.wait_for_function('()=>HEWRS_OUTFIT_READY&&!HEWRSApp.state().busy');ck('Deferred saved S02 restores identical native pixels and IDs',p.evaluate('HEWRSApp.renderer.last()')==s and native(p)==saved_native)
  p.screenshot(path=str(E/'SAVED_OUTFIT_RESTORED.png'))
  # First index request fails. Existing outfit pixels and user data must survive.
  setup(p,'S10');before=protection(p);pix=native(p);p.click('#generate-options');p.wait_for_function('()=>__INDEX_TAGS.length===1');ck('Generate requests the integrity-pinned index once with honest loading status',p.evaluate('HEWRSRuntimeLoader.stats().indexRequests')==1 and 'Loading outfit index' in p.locator('#home-notice').inner_text() and p.evaluate('!!__INDEX_TAGS[0].integrity'))
  p.evaluate('()=>__INDEX_TAGS[0].onerror()');p.wait_for_function('()=>!HEWRSApp.state().busy');ck('Index network failure ends the wait with an actionable message and retains user data/pixels', 'could not be downloaded' in p.locator('#status').inner_text() and protection(p)==before and native(p)==pix)
  # Retry through the actual Generate button and supply exact delivered index bytes.
  baseline=json.loads((B/'evidence/local_preference_v1_22_0/GENERATION_MATRIX_cold.json').read_text());row=next(r for r in baseline['rows']if r['id']=='S10');h.ensure(p,R,row['selections']);setup(p,'S10');t=time.monotonic();p.click('#generate-options');p.wait_for_function('()=>__INDEX_TAGS.length===2');supply_index(p);p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"',timeout=120000)
  actual=p.evaluate('HEWRSApp.state().report.options');(E/'ACTUAL_S10.json').write_text(json.dumps({'request':p.evaluate('HEWRSApp.state().request'),'model':p.evaluate('HEWRSApp.learning.model().model'),'actual':actual,'expected':row['options']},indent=2));subprocess.run(['node',str(R/'tests/performance-browser-baseline.cjs'),str(E/'ACTUAL_S10.json'),str(E/'BASELINE_S10_SAME_BROWSER_MODEL.json')],check=True);browser_expected=json.loads((E/'BASELINE_S10_SAME_BROWSER_MODEL.json').read_text());ck('Retried actual Generate returns every original S10 option and score in the same order',actual==browser_expected,{'seconds_with_test_delivery':time.monotonic()-t,'options':len(actual)})
  for i,s in enumerate(row['selections']):
   if i:p.click('#next-option');p.wait_for_function('i=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===i',arg=i)
   assert p.evaluate('HEWRSApp.renderer.last()')==s;assert p.evaluate('HEWRSApp.cardSnapshot().selection')==s;frames.append({'kind':'S10-navigation','position':i+1,'selection':s,'native_fnv1a':native(p)})
  ck('All20 real card positions keep exact IDs and one-use ties',len(frames)==20)
  ck('Index stays loaded and navigation does not request it again',p.evaluate('HEWRSRuntimeLoader.stats().indexRequests')==2)
  ck('Generating and navigating creates no wear, Favorites or feedback',protection(p)==before)
  # Cancel a new computation after the data are loaded.
  setup(p,None);pix=native(p);p.click('#generate-options');p.wait_for_function('HEWRSApp.state().busy');p.click('#cancel-work');p.wait_for_function('()=>!HEWRSApp.state().busy');p.wait_for_timeout(300);ck('Cancel remains responsive and retains the preceding complete outfit',native(p)==pix and protection(p)==before)
  # The real comparison screen works with bundled modules, and its first vote
  # writes only feedback. No synthetic preference is silently seeded.
  pilot=json.loads((R/'data/preference-pilot.json').read_text())['records'];h.ensure(p,R,[pilot[0]['a'],pilot[0]['b']]);p.evaluate('HEWRSApp.preferencePanel.open()');p.click('#pref-start-pilot');p.wait_for_function('()=>!document.getElementById("pref-vote-A").disabled');guard=protection(p);p.click('#pref-vote-A');after=protection(p);a=dict(guard);a.pop('feedback');z=dict(after);z.pop('feedback');ck('A/B feedback remains operational and touches only its own namespace',a==z and p.evaluate('HEWRSApp.learning.snapshot().comparisons.length')==1)
  p.evaluate('HEWRSApp.showPage("home")');p.locator('#fx-sheet-close').click()
  layouts=[]
  for w,hh in [(320,568),(390,350),(390,780),(430,932),(1280,1000)]:
   p.set_viewport_size({'width':w,'height':hh});v=p.evaluate('()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,ready:HEWRS_READY,button:!!document.getElementById("generate-options")})');layouts.append({'w':w,'h':hh,**v});assert not v['overflow']
  ck('Fast-start Home retains five responsive viewport layouts',True,layouts);p.close()
  # Compositor/native regression: all18 suits and14 blazers, no renderer changes.
  new=b.new_page();load(new);ui_images(new);old=b.new_page();h.load(old,B)
  controls=[{'suitId':f'S{i:02}','shirtId':'DS023','state':'T017','shoeId':'shoe-8','watchId':None}for i in range(1,19)]+[{'blazerId':f'B{i:02}','pantId':'PG002','shirtId':'DS001','state':'NO_TIE','shoeId':'shoe-8','watchId':None}for i in range(1,15)]
  for s in controls:
   h.ensure(new,R,[s]);h.ensure(old,B,[s]);new.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);old.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);a=native(old);z=native(new);assert a==z;frames.append({'kind':'unchanged-native-control','selection':s,'baseline_fnv1a':a,'target_fnv1a':z})
  ck('All18 suits and14 blazers retain exact native outfit pixels',sum(f['kind']=='unchanged-native-control'for f in frames)==32);new.close();old.close()
  # Failures do not become an empty history or fabricated model at lazy startup.
  bad=b.new_page();load(bad,{'hewrs:outfit-preferences:v1':'{invalid','performance-sentinel':'KEEP'});bad.evaluate('HEWRSApp.preferencePanel.open()');ck('Corrupt feedback is still explicitly retained and blocked',bad.evaluate('__STORAGE_MAP.get(HEWRSOutfitLearning.KEY)')=='{invalid'and 'unavailable' in bad.locator('#fx-sheet-body').inner_text());bad.close()
  ck('No uncaught application errors',not errors,errors)
 except Exception:
  errors.append(traceback.format_exc());checks.append({'name':'Browser run completed','passed':False,'detail':errors[-1]});print(errors[-1],flush=True)
  try:p.screenshot(path=str(E/'ATTEMPT_FAILURE.png'))
  except:pass
 finally:save();b.close()
if any(not x['passed']for x in checks):sys.exit(1)
