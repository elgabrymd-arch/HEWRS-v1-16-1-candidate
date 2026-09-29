#!/usr/bin/env python3
"""Actual local UI/render regression; injected images and synthetic storage. No hosted/iOS claim."""
import os,json,base64,hashlib,io,sys,traceback,time
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];B=Path(os.environ['HEWRS_BASELINE']);E=R/'evidence/option_cards_v1_21_1/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];frames=[];errors=[]
def save():
 (E/'RESULT.json').write_text(json.dumps({'version':'1.21.1','passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'pixel_comparisons':frames,'page_errors':errors,'scope':'Actual local scripts/native garment pixels and presentation thumbnails in in-memory Chromium. Synthetic empty history; no hosted/iOS test.'},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});save();print('PASS'if ok else'FAIL',name,flush=True)
 if not ok:raise AssertionError(name+': '+str(detail))
registry=json.loads((R/'data/option-card-thumbnails.json').read_text());TI={d['sha256']:'data:image/png;base64,'+base64.b64encode((R/d['url']).read_bytes()).decode()for group in ['shirts','ties','shoes']for d in registry[group].values()}
original_supply=h.supply
def supply(p,hs):
 original_supply(p,hs)
 if h.R==R and not p.evaluate('!!globalThis.HEWRS_OPTION_CARD_IMAGES'):p.evaluate('x=>globalThis.HEWRS_OPTION_CARD_IMAGES=x',TI)
h.supply=supply
def load(p,root):h.R=root;h.load(p,storage={'cards-sentinel':'UNCHANGED'});p.set_default_timeout(60000)
def ensure(p,root,sels):h.R=root;h.ensure(p,sels)
def apply(p,s):return p.evaluate('s=>HEWRSApp.apply(s,{save:false,localDate:"2026-09-29"})',s)
def pixels(p):return base64.b64decode(p.evaluate('document.querySelector("#avatar").toDataURL("image/png").split(",")[1]'))
def card_ready(p):p.wait_for_function('()=>[...document.querySelectorAll(".card-thumbnail img")].every(x=>x.complete&&x.naturalWidth>0)')
def s_of(o):return o['_hewrsConnected']['canonical_selection']
M=json.loads((R/'evidence/twenty_ties_v1_21_0/MATRIX_target.json').read_text());by={x['id']:x for x in M['rows']}
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  p=browser.new_page(viewport={'width':390,'height':844});old=browser.new_page(viewport={'width':390,'height':844});p.on('pageerror',lambda e:errors.append(str(e)));load(p,R);load(old,B);card_ready(p)
  saved=json.loads((E/'PHASE1_GENERATION.json').read_text());checks.extend(saved['checks']);frames.extend(saved['pixel_comparisons']);save();old.close()
  # Fresh S10 generated card is the principal design preview, not relabelled manual selections.
  ensure(p,R,[s_of(x)for x in by['S10']['result']['options']]);apply(p,s_of(by['S10']['result']['options'][0]));p.evaluate('()=>{HEWRSApp.ui.reset();HEWRSApp.ui.set("topwear",{mode:"item",id:"suit-9"});HEWRSApp.showPage("home");HEWRSApp.setMode("engine");HEWRSApp.weather.apply({source:"not_assessed",date:"2026-09-29"});}')
  p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"',timeout=240000);card_ready(p)
  ck('S10 actual Generate returns unchanged20-option ordering',[s_of(x)for x in p.evaluate('HEWRSApp.state().report.options')]==[s_of(x)for x in by['S10']['result']['options']])
  p.set_viewport_size({'width':1150,'height':1020});p.locator('#editorial-card').screenshot(path=str(E/'DESKTOP_OPTION_CARD.png'));p.screenshot(path=str(E/'DESKTOP_APP.png'))
  p.click('#detail-view');ck('Collar Detail preserves native canvas and remains available',p.locator('#stage').evaluate('n=>n.classList.contains("detail")'));p.click('#full-view');p.click('#large-view');ck('Enlarge keeps existing full-image modal reachable',p.locator('#fx-sheet').evaluate('n=>n.open'));p.locator('#fx-sheet-close').click()
  p.click('#details-button');ck('Original exact item-details modal remains accessible','S10'in p.locator('#fx-sheet-body').inner_text());p.locator('#fx-sheet-close').click();p.click('#open-results');ck('20-option list remains reachable from card header',p.locator('#fx-sheet').evaluate('n=>n.open')and '20'in p.locator('#fx-sheet-body').inner_text());p.locator('#fx-sheet-close').click()
  sizes=[]
  for w,hh in [(320,568),(390,350),(390,700),(390,844),(430,932),(768,900),(1150,1020)]:
   p.set_viewport_size({'width':w,'height':hh});p.evaluate('document.querySelector("#page-outfits").scrollTop=0');card_ready(p);sizes.append({'width':w,'height':hh,'no_horizontal_scroll':p.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector("#page-outfits").scrollWidth<=document.querySelector("#page-outfits").clientWidth+1'),'thumbnails_visible':p.locator('.card-thumbnail img').count()==3})
  ck('Seven viewport layouts have no horizontal overflow,labels remain complete',all(x['no_horizontal_scroll']and x['thumbnails_visible']for x in sizes),sizes)
  p.set_viewport_size({'width':390,'height':844});p.evaluate('document.querySelector("#page-outfits").scrollTop=0');p.screenshot(path=str(E/'PHONE_FULL_OUTFIT.png'));p.evaluate('document.querySelector("#page-outfits").scrollTop=document.querySelector("#card-topwear").offsetTop-document.querySelector("#page-outfits").offsetTop-12');p.screenshot(path=str(E/'PHONE_ITEMS.png'))
  p.evaluate('HEWRSApp.showPage("home")');p.click('#pref-shirt');p.locator('#fx-sheet-close').click();ck('Picker Cancel retains current garment selection',p.evaluate('HEWRSApp.state().selection')==s_of(by['S10']['result']['options'][0]))
  before=p.evaluate('HEWRSApp.state().selection');beforeframe=pixels(p)
  try:apply(p,{**before,'shirtId':'DS999'})
  except Exception:pass
  ck('Rejected selection leaves previous frame,card and current IDs intact',p.evaluate('HEWRSApp.state().selection')==before and p.evaluate('HEWRSApp.optionCards.snapshot().selection')==before and pixels(p)==beforeframe)
  p.evaluate('HEWRSApp.showPage("outfits")');p.locator('.card-thumbnail img').first.evaluate('im=>im.src="data:image/png;base64,invalid"');p.wait_for_function('()=>document.querySelector(".card-thumbnail").dataset.status==="unavailable"');ck('A missing UI thumbnail shows unavailable without changing the actual outfit',pixels(p)==beforeframe and p.locator('.card-preview-fallback').inner_text()=='Preview unavailable')
  ck('Viewing/generating cards adds no wear/Favorites or unrelated writes',p.evaluate('HEWRSApp.store.snapshot().events.length')==0 and p.evaluate('HEWRSApp.favorites.snapshot().items.length')==0 and p.evaluate('__STORAGE_MAP.get("cards-sentinel")')=='UNCHANGED')
  ck('No uncaught application errors',not errors,errors)
  p.close()
 except Exception:
  checks.append({'name':'Complete browser run','passed':False,'detail':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):sys.exit(1)
