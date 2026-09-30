"""Actual local app/renderer with isolated synthetic storage; not live-site or Safari certification."""
import sys,os,json,time,base64,hashlib,io,traceback
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import option_card_harness as h
R=Path(__file__).resolve().parents[1];B=Path(os.environ['HEWRS_BASELINE']);E=R/'evidence/local_preference_v1_22_0/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];frames=[];errors=[];pilot=json.loads((R/'data/preference-pilot.json').read_text())['records'];start=time.time()
def save(): (E/'RESULT.json').write_text(json.dumps({'scope':'Actual local scripts/compositor, synthetic storage and synthetic votes; no live provider or owner data','passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'pixel_comparisons':frames,'errors':errors,'seconds':time.time()-start},indent=2))
def ck(n,v,d=None):
 checks.append({'name':n,'passed':bool(v),'detail':d});save();print('PASS'if v else'FAIL',n,flush=True)
 if not v:raise AssertionError(n+' '+str(d))
def data(p):return p.evaluate('({wear:HEWRSApp.store.snapshot(),favorites:HEWRSApp.favorites.snapshot(),items:Array.from(__STORAGE_MAP.entries()).filter(([k])=>k!==HEWRSOutfitLearning.KEY),selection:HEWRSApp.renderer.last(),prefs:HEWRSApp.ui.snapshot()})')
def native(p):return p.evaluate('()=>{const d=document.getElementById("avatar").getContext("2d").getImageData(0,0,996,2748).data;let h=2166136261;for(const v of d)h=Math.imul(h^v,16777619);return h>>>0;}')
def prepare(p,sels):h.ensure(p,R,sels)
def state_seed(p):return dict(p.evaluate('Array.from(__STORAGE_MAP.entries())'))
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  p=browser.new_page(viewport={'width':1100,'height':980},accept_downloads=True);p.on('pageerror',lambda e:errors.append(str(e)));h.load(p,R)
  before=data(p);p.click('#style-button');p.get_by_text('Stylist settings · research',exact=True).click();p.click('#stylist-preferences')
  ck('Style settings opens actual feedback controls; empty data does not activate ranking',p.locator('#pref-learning-counts').inner_text().startswith('0 informative'))
  prepare(p,[pilot[0]['a'],pilot[0]['b']]);p.click('#pref-start-pilot');p.wait_for_function('()=>!document.getElementById("pref-vote-A").disabled')
  ck('Both actual garment images must load before voting',p.evaluate('Array.from(document.querySelectorAll(".pref-compare-card img")).every(x=>x.complete&&x.naturalWidth>0)'))
  p.screenshot(path=str(E/'PAIR_DESKTOP.png'));p.set_viewport_size({'width':390,'height':780});p.screenshot(path=str(E/'PAIR_PHONE.png'))
  bounds=[]
  for w,hh in [(320,568),(390,350),(390,780),(430,932),(1100,980)]:
   p.set_viewport_size({'width':w,'height':hh});v=p.evaluate('''()=>{const a=document.getElementById('fx-sheet-actions').getBoundingClientRect(),b=document.getElementById('fx-sheet-body');return {x:document.documentElement.scrollWidth<=innerWidth+1,footer:a.left>=-1&&a.right<=innerWidth+1&&a.bottom<=innerHeight+1,scrolling:b.scrollHeight>=b.clientHeight};}''');bounds.append(dict(w=w,h=hh,**v));assert v['x'] and v['footer'],v
  ck('Five viewports keep voting controls in bounds with internal scrolling',True,bounds)
  p.locator('#pref-pair-grid').get_by_text('Collar detail',exact=True).first.click();p.wait_for_function('()=>document.getElementById("pref-image-A").naturalHeight===490');ck('Collar detail uses a second crop of the actual source render',p.locator('#pref-image-A').evaluate('x=>x.complete&&x.naturalHeight===490'));p.locator('#pref-pair-grid').get_by_text('Full outfit',exact=True).click()
  p.click('#pref-vote-A');p.wait_for_selector('#pref-next');after=data(p);ck('A vote writes only the preference namespace; wear/Favorites/current render/pickers unchanged',before==after)
  ck('First explicit vote is stored without fabricated feedback',p.evaluate('HEWRSApp.learning.snapshot().comparisons.length')==1)
  p.get_by_text('Learning status',exact=True).click();p.click('#pref-export');a=p.locator('a.lb-download');
  with p.expect_download()as dl:a.click()
  dl.value.save_as(str(E/'SYNTHETIC_PREFERENCE_EXPORT.json'));backup=json.loads((E/'SYNTHETIC_PREFERENCE_EXPORT.json').read_text());ck('Actual preference download contains separate schema, no wear/Favorites payload',backup['schema']=='hewrs.outfit-preferences.v1'and len(backup['comparisons'])==1)
  # Resume sequentially from the pilot: two neutral responses must not act as preferences.
  prepare(p,[pilot[1]['a'],pilot[1]['b']]);
  # Previous statement opens before images are embedded: retry through explicit panel so no false successful load.
  p.evaluate('HEWRSApp.preferencePanel.open()');p.click('#pref-start-pilot');p.wait_for_function('()=>!document.getElementById("pref-vote-both").disabled');p.click('#pref-vote-both');
  ck('Both-work stays neutral in the fitted model',p.evaluate('HEWRSApp.learning.model().model.counts.neutral')==1 and p.evaluate('HEWRSApp.learning.model().model.counts.informative')==1)
  # Add six more comparisons through actual controls, always load source images first.
  for i in range(2,9):
   prepare(p,[pilot[i]['a'],pilot[i]['b']]);p.evaluate('HEWRSApp.preferencePanel.open()');p.click('#pref-start-pilot');p.wait_for_function('()=>!document.getElementById("pref-vote-A").disabled');p.click('#pref-vote-A' if i%2 else '#pref-vote-B');p.wait_for_selector('#pref-next')
  model=p.evaluate('HEWRSApp.learning.model().model');ck('Actual comparison votes activate only after8 informative decisions and3 groups',model['active'] and model['counts']['informative']==8 and model['counts']['topwear_groups']>=3,model['counts'])
  saved=state_seed(p);p.close();p=browser.new_page(viewport={'width':1100,'height':980});p.on('pageerror',lambda e:errors.append(str(e)));h.load(p,R,storage=saved);ck('Reinitialized page recreates same preference model from stored votes',p.evaluate('HEWRSApp.learning.model().model.id')==model['id'])
  # Validation rows never enter fitting; save through the actual four-way interface.
  prep=pilot[16];prepare(p,[prep['a'],prep['b']]);weights=p.evaluate('HEWRSApp.learning.model().model.weights');p.evaluate('r=>HEWRSApp.preferencePanel.showPair(r,()=>{},()=>{})',prep);p.wait_for_function('()=>!document.getElementById("pref-vote-B").disabled');p.click('#pref-vote-B');ck('Held-out feedback is recorded but does not change coefficients',weights==p.evaluate('HEWRSApp.learning.model().model.weights'))
  p.evaluate('HEWRSApp.preferencePanel.open()');p.click('#pref-learning-toggle');ck('Pause retains comparisons and disables only learned adjustment',not p.evaluate('HEWRSApp.learning.model().model.active') and p.evaluate('HEWRSApp.learning.snapshot().comparisons.length')==10)
  p.click('#pref-learning-toggle');ck('Resume uses existing feedback without creating new votes',p.evaluate('HEWRSApp.learning.model().model.active') and p.evaluate('HEWRSApp.learning.snapshot().comparisons.length')==10)
  # A simultaneous-tab write after the images are visible is refused.
  prep=pilot[10];prepare(p,[prep['a'],prep['b']]);p.evaluate('r=>HEWRSApp.preferencePanel.showPair(r,()=>{},()=>{})',prep);p.wait_for_function('()=>!document.getElementById("pref-vote-A").disabled');p.evaluate('()=>{const k=HEWRSOutfitLearning.KEY,v=JSON.parse(__STORAGE_MAP.get(k));v.revision++;__STORAGE_MAP.set(k,JSON.stringify(v));}');changed=p.evaluate('__STORAGE_MAP.get(HEWRSOutfitLearning.KEY)');p.click('#pref-vote-A');ck('Stale-tab vote is refused without overwriting newer feedback',changed==p.evaluate('__STORAGE_MAP.get(HEWRSOutfitLearning.KEY)') and bool(p.locator('#fx-sheet-error').inner_text()))
  p.evaluate('HEWRSApp.preferencePanel.open()');p.get_by_text('Close',exact=True).last.click()
  # S02 source correction is present in real displayed item names and warning; not a recolor.
  s02={'suitId':'S02','shirtId':'DS032','state':'NO_TIE','shoeId':'shoe-4','watchId':None};prepare(p,[s02]);p.evaluate('s=>HEWRSApp.apply(s,{save:false,localDate:"2026-09-29"})',s02);p.evaluate('HEWRSApp.showPage("outfits")');ck('S02 card shows corrected brown source and explicit rendering limitation', 'muted medium-brown' in p.locator('#option-card-items').inner_text() and p.locator('#s02-source-note').is_visible())
  p.screenshot(path=str(E/'S02_CURRENT_CARD.png'))
  p.evaluate('()=>{globalThis.HEWRS_EMBEDDED_SOURCE_EVIDENCE={};}')
  p.evaluate('s=>{HEWRS_EMBEDDED_SOURCE_EVIDENCE.S02=s}', 'data:image/png;base64,'+base64.b64encode((R/'ui/source-evidence/S02-owner-crop.png').read_bytes()).decode());p.click('#s02-source-photo');p.wait_for_function('()=>{const i=document.querySelector("#fx-sheet-body img");return i&&i.complete&&i.naturalWidth>0;}');ck('Confirmed owner fabric photo is accessible without changing the outfit',p.locator('#fx-sheet-body img').evaluate('x=>x.complete&&x.naturalWidth>0'));p.get_by_text('Close',exact=True).last.click()
  # Corrupt preference state must not fall back to fabricated empty history/model.
  p.close();p=browser.new_page();h.load(p,R,storage={'hewrs:outfit-preferences:v1':'{invalid','wear-sentinel':'KEEP'});p.evaluate('HEWRSApp.preferencePanel.open()');ck('Corrupt feedback produces an explicit retained-data warning', 'unavailable' in p.locator('#fx-sheet-body').inner_text() and p.evaluate('__STORAGE_MAP.get(HEWRSOutfitLearning.KEY)')=='{invalid');p.close()
  # Existing source frames are pixel identical after the code update.
  controls=[{'suitId':f'S{i:02}','shirtId':'DS023','state':'T017','shoeId':'shoe-8','watchId':None} for i in range(1,19)]
  controls += [{'blazerId':f'B{i:02}','pantId':'PG002','shirtId':'DS001','state':'NO_TIE','shoeId':'shoe-8','watchId':None}for i in range(1,15)]
  for starti in range(0,len(controls),8):
   new=browser.new_page();old=browser.new_page();h.load(new,R);h.load(old,B)
   for s in controls[starti:starti+8]:
    h.ensure(new,R,[s]);h.ensure(old,B,[s]);new.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);old.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
    # Direct raw RGBA comparison via exact decoded PNG bytes (not screenshot size).
    x=Image.open(io.BytesIO(base64.b64decode(new.evaluate('document.getElementById("avatar").toDataURL().split(",")[1]')))).convert('RGBA').tobytes();y=Image.open(io.BytesIO(base64.b64decode(old.evaluate('document.getElementById("avatar").toDataURL().split(",")[1]')))).convert('RGBA').tobytes();assert x==y;frames.append({'selection':s,'equal':True,'sha256':hashlib.sha256(x).hexdigest()})
   new.close();old.close();save()
  ck('32 native suit/blazer controls are pixel-identical including S02',len(frames)==32)
  ck('No uncaught browser errors in final workflows',not errors,errors)
 except Exception as ex:
  errors.append(traceback.format_exc());save()
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except:pass
  raise
 finally:browser.close()
