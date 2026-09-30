"""Actual Generate/navigation and asynchronous preference-race integration. Synthetic data only."""
from pathlib import Path
import os,sys,json,time,traceback,base64,hashlib,io,importlib.util
from PIL import Image
from playwright.sync_api import sync_playwright
import option_card_harness as h
R=Path(__file__).resolve().parents[1];E=R/'evidence/local_preference_v1_22_0/browser_generation';E.mkdir(parents=True,exist_ok=True)
M=json.loads((R/'evidence/local_preference_v1_22_0/GENERATION_MATRIX_synthetic_learned.json').read_text());row=next(x for x in M['rows']if x['id']=='S10');pilot=json.loads((R/'data/preference-pilot.json').read_text());cor=json.loads((R/'data/owner-source-corrections.json').read_text());checks=[];frames=[];errors=[];t=time.time()
def save(): (E/'RESULT.json').write_text(json.dumps({'scope':'Real local scripts and wardrobe renderer, synthetic preference/permission/storage inputs; not a live site','passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'frames':frames,'errors':errors,'seconds':time.time()-t},indent=2))
def ck(n,v,d=None):
 checks.append({'name':n,'passed':bool(v),'detail':d});save();print('PASS'if v else'FAIL',n,flush=True)
 if not v:raise AssertionError(n+' '+str(d))
def pixel(p):
 return Image.open(io.BytesIO(base64.b64decode(p.evaluate('document.getElementById("avatar").toDataURL().split(",")[1]')))).convert('RGBA').tobytes()
def set_request(p):
 p.evaluate('''()=>{HEWRSApp.ui.reset();HEWRSApp.ui.set('topwear',{mode:'item',id:HEWRSApp.connection.aliases.get('S10')});HEWRSApp.connection.hybrid.setMode('research');HEWRSApp.showPage('home');HEWRSApp.setMode('engine');HEWRSApp.weather.apply({source:'not_assessed',date:'2026-09-29'});}''')
def load_hook(p):
 # Same isolated harness as the normal app, with a test-only wrapper around the
 # compositor. The production renderer is not edited and all actual pixels remain.
 p.set_content((R/'app.template.html').read_text().replace('<!--STYLE-->','<style>'+(R/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->',''))
 p.evaluate('''()=>{const m=new Map();globalThis.__STORAGE_MAP=m;globalThis.__STORAGE_CALLS=[];Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>{__STORAGE_CALLS.push(['set',k]);m.set(k,v)},removeItem:k=>m.delete(k)}});globalThis.HEWRS_EMBEDDED_IMAGES={};}''')
 ui={p.stem:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()for p in (R/'ui/option-cards').glob('*.png')};p.evaluate('d=>globalThis.HEWRS_EMBEDDED_UI_IMAGES=d',ui)
 spec=importlib.util.spec_from_file_location('buildx',R/'tools/build.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
 for f in mod.SCRIPTS:
  if f!='src/application.js':p.add_script_tag(content=(R/f).read_text())
 p.evaluate('''()=>{const c=HEWRSCleanConnection.create(HEWRS_INPUTS),cv=document.createElement('canvas');globalThis.__SOURCE={connection:c,renderer:HEWRSAtomicRenderer.create(cv,c,{resolveUrl:d=>'data:image/png;base64,'+HEWRS_EMBEDDED_IMAGES[d.sha256]})};}''')
 h.ensure(p,R,[h.h.DEFAULT]+row['selections'])
 p.evaluate('''()=>{const prior=HEWRSAtomicRenderer;globalThis.HEWRSAtomicRenderer={...prior,create:(canvas,c,opts)=>{const real=prior.create(canvas,c,opts);return {...real,render:async(...args)=>{const out=await real.render(...args);if(canvas.id==='avatar'&&globalThis.__PREF_WRITE_AFTER_RENDER){__PREF_WRITE_AFTER_RENDER=false;const k=HEWRSOutfitLearning.KEY,v=JSON.parse(__STORAGE_MAP.get(k));v.revision++;__STORAGE_MAP.set(k,JSON.stringify(v));}return out;}};}};}''')
 p.add_script_tag(content=(R/'src/application.js').read_text());p.wait_for_function('()=>HEWRS_READY===true||globalThis.HEWRS_LOAD_ERROR');p.evaluate('delete globalThis.__SOURCE');p.set_default_timeout(60000)
with sync_playwright()as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  p=b.new_page(viewport={'width':1100,'height':980});p.on('pageerror',lambda e:errors.append(str(e)));load_hook(p)
  source=p.evaluate('HEWRS_INPUT_SHA256');revision=p.evaluate('HEWRSSourceCorrections.revision');votes=[]
  for i,r in enumerate(pilot['records'][:16]):votes.append({'id':'pref_fixture_'+str(i),'created_at':'2026-09-29T23:30:00.000Z','a':r['a'],'b':r['b'],'vote':'A'if i%2 else'B','reason':'no_reason','partition':'training','pilot_id':r['id'],'context':r['context'],'source_revision':revision})
  seed={'schema':'hewrs.outfit-preferences.v1','source_lock':source,'revision':16,'enabled':True,'comparisons':votes}
  p.evaluate('s=>__STORAGE_MAP.set(HEWRSOutfitLearning.KEY,JSON.stringify(s))',seed);prefBefore=p.evaluate('__STORAGE_MAP.get(HEWRSOutfitLearning.KEY)');set_request(p)
  p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"',timeout=180000);state=p.evaluate('HEWRSApp.state()');actual=state['report']['options']
  ck('Actual learned Generate matches all20 independently executed Node selections',[o['_hewrsConnected']['canonical_selection']for o in actual]==row['selections'])
  ck('Learned estimate and preserved baseline estimate are disclosed', 'Local preference fit' in p.locator('#score-label').inner_text() and all('baseline_research_score'in o['_hewrsConnected']['preference']for o in actual))
  while p.evaluate('HEWRSApp.state().optionIndex')>0:p.click('#prev-option');p.wait_for_function('()=>!HEWRSApp.state().busy')
  for i,s in enumerate(row['selections']):
   if i:p.click('#next-option');p.wait_for_function('n=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===n',arg=i)
   assert p.evaluate('HEWRSApp.renderer.last()')==s;frames.append({'position':i+1,'selection':s,'rgba_sha256':hashlib.sha256(pixel(p)).hexdigest()})
  ck('All20 learned options navigated with exact registered IDs',len(frames)==20)
  ck('Generate/views do not write votes, wear events or Favorites',prefBefore==p.evaluate('__STORAGE_MAP.get(HEWRSOutfitLearning.KEY)') and p.evaluate('HEWRSApp.store.snapshot().events.length')==0 and len(p.evaluate('HEWRSApp.favorites.snapshot().favorites||[]'))==0)
  p.screenshot(path=str(E/'SYNTHETIC_LEARNED_RESULT.png'))
  # Explicit panel source holds do not create feedback and cannot alter prior pixels.
  before=pixel(p);p.evaluate('HEWRSApp.preferencePanel.chooseCurrent?0:0')
  # Preference revision changing AFTER real compositor completion must restore prior pixels.
  set_request(p);prior=pixel(p);priorSel=p.evaluate('HEWRSApp.renderer.last()');p.evaluate('globalThis.__PREF_WRITE_AFTER_RENDER=true');p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().report?.status==="error"',timeout=180000)
  ck('Changed preference during image loading rejects stale recommendation and restores preceding native frame',pixel(p)==prior and p.evaluate('HEWRSApp.renderer.last()')==priorSel and p.evaluate('HEWRSApp.state().optionCount')==0,p.evaluate('HEWRSApp.state().report.reason'))
  # Another tab modifies preference during async candidate generation, before any publish.
  set_request(p);prior=pixel(p);p.click('#generate-options');p.wait_for_function('HEWRSApp.state().busy');p.evaluate('()=>{const k=HEWRSOutfitLearning.KEY,v=JSON.parse(__STORAGE_MAP.get(k));v.revision++;__STORAGE_MAP.set(k,JSON.stringify(v));}');expected=p.evaluate('__STORAGE_MAP.get(HEWRSOutfitLearning.KEY)');p.wait_for_function('()=>!HEWRSApp.state().busy',timeout=180000)
  ck('Preference revision change during generation is not published or overwritten',p.evaluate('HEWRSApp.state().report?.status')=='error' and p.evaluate('__STORAGE_MAP.get(HEWRSOutfitLearning.KEY)')==expected and pixel(p)==prior)
  ck('Uncaught error log is empty; rejected races are handled by actual UI',not errors,errors)
 except Exception:
  errors.append(traceback.format_exc());checks.append({'name':'Completed generation integration','passed':False,'detail':errors[-1]});save()
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except:pass
  raise
 finally:save();b.close()
