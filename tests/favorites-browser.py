#!/usr/bin/env python3
"""Actual current scripts/images in memory-loaded Chromium; isolated synthetic
storage. Not a hosted/iPhone/restart certification. Run from a complete tree
with HEWRS_BASELINE_V1165 set to the independent eighteen-shirt V1.16.5 tree.
"""
import os,sys,json,time,base64,hashlib,io,traceback
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];B=Path(os.environ.get('HEWRS_BASELINE_V1165',str(R.parent/'HEWRS_CONNECTED_APP_V1_16_5')))
E=R/'evidence/favorites_v1_16_6/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];frames=[];layouts=[];errors=[];start=time.monotonic()
ids=json.loads((R/'RELEASE_SCOPE.json').read_text())['enabled_non_suit_shirt_ids']
FKEY='hewrs:connected-app:favorites:v1';WKEY='hewrs:connected-app:v1'
def save():
 (E/'RESULT.json').write_text(json.dumps({'schema':'hewrs.favorites.chromium.v1_16_6','scope':__doc__,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'outfit_frames':frames,'layout_cases':layouts,'errors':errors,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else 'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(str((name,detail)))
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hashes.items():
  if sha in present:continue
  value=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=value;size+=len(value)
  if size>2_000_000:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
def load(p,r,storage=None,preload=None):h.R=r;h.load(p,storage=storage or {'favorite-sentinel':'KEEP'},preload=preload)
def ensure(p,r,ss):h.R=r;h.ensure(p,ss)
def O(id='DS023',t='T017'):return dict(shirtOnly=True,pantId='PG002',shirtId=id,state=t,shoeId='shoe-8',watchId=None)
def BL(id='DS023',t='T017',b='B03'):return dict(blazerId=b,pantId='PG002',shirtId=id,state=t,shoeId='shoe-8',watchId=None)
def S(id='DS023',t='T017',suit='S05'):return dict(suitId=suit,shirtId=id,state=t,shoeId='shoe-8',watchId=None)
def pixels(p):return Image.open(io.BytesIO(base64.b64decode(p.evaluate('document.querySelector("#avatar").toDataURL("image/png")').split(',')[1]))).convert('RGBA')
def digest(p):return hashlib.sha256(pixels(p).tobytes()).hexdigest()
def apply(p,s):ensure(p,R,[s]);p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
def favorites(p):p.evaluate('HEWRSApp.showPage("rotation")');p.click('#favorites-button')
def close(p):p.click('#fx-sheet-close')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=browser.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True);p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R);ck('Build loads with existing controller and new Favorites store',p.evaluate('HEWRS_READY&&HEWRSApp.version==="HEWRS_CONNECTED_APP_V1_16_6"&&HEWRSApp.favorites.snapshot().items.length===0'))
  old=browser.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True);load(old,B)
  matrix=[s for id in ids for t in ['NO_TIE','T017'] for s in [O(id,t),BL(id,t)]]+[S(suit='S'+str(i).zfill(2)) for i in range(1,19)]
  ensure(p,R,matrix);ensure(old,B,matrix)
  for n,s in enumerate(matrix):
   p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);old.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
   a,b=digest(p),digest(old);frames.append({'selection':s,'before':b,'after':a,'equal':a==b})
   if a!=b:raise AssertionError('Changed frame '+str(s))
   if (n+1)%18==0:print('COMPARE',n+1,flush=True);save()
  ck('All 90 comparison frames remain pixel-identical, including accepted DS023 routes',len(frames)==90 and all(x['equal'] for x in frames));old.close()
  apply(p,O());before=digest(p)
  # Seed one explicitly synthetic wear event for isolation checks, never owner data.
  p.evaluate('''()=>{HEWRSApp.store.addEvent(HEWRSApp.connection.createHistoryEvent(HEWRSApp.state().selection,{id:'SYNTHETIC_FAVORITES_BROWSER',localDate:'2026-09-27',origin:'manual'}));HEWRSApp.showPage('rotation');}''')
  raw=p.evaluate('HEWRSApp.store.exportText()');favorites(p)
  ck('Favorites panel is connected, empty, with explicit non-wear scope',p.locator('#fx-sheet-title').inner_text()=='Favorites' and p.locator('#save-favorite').is_enabled() and 'do not count as wear' in p.locator('#fx-sheet-body').inner_text())
  p.click('#save-favorite');item=p.evaluate('HEWRSApp.favorites.snapshot().items[0]')
  ck('Save current outfit stores exact DS023 IDs without a wear/session write',item['selection']==O() and p.evaluate('HEWRSApp.store.exportText()')==raw and digest(p)==before)
  ck('Duplicate current favorite is disabled, no extra entry',p.locator('#save-favorite').is_disabled() and p.evaluate('HEWRSApp.favorites.snapshot().items.length')==1)
  close(p);apply(p,O('DS024','NO_TIE'));favorites(p);p.click('#save-favorite');close(p);apply(p,O('DS025','NO_TIE'));favorites(p);p.click('#save-favorite')
  ck('DS024 and DS025 save as different physical outfits',p.evaluate('HEWRSApp.favorites.snapshot().items.map(x=>x.selection.shirtId)')==['DS023','DS024','DS025'])
  p.locator('#favorite-search').fill('DS024');ck('Search finds the exact saved shirt ID',p.locator('[data-favorite-id]').count()==1 and 'DS024' in p.locator('#favorites-list').inner_text());p.locator('#favorite-search').fill('no such outfit');ck('Search reports no match without changing favorites',p.locator('[data-favorite-id]').count()==0 and p.evaluate('HEWRSApp.favorites.snapshot().items.length')==3);p.locator('#favorite-search').fill('')
  # Cancel removal then confirm it once.
  remove=p.locator('[data-favorite-remove]').first;remove.click();p.get_by_role('button',name='Cancel',exact=True).click();ck('Cancel removal preserves all saved IDs',p.evaluate('HEWRSApp.favorites.snapshot().items.length')==3)
  p.locator('[data-favorite-remove]').first.click();p.click('#confirm-favorite-removal');ck('Confirmed removal affects Favorites only',p.evaluate('HEWRSApp.favorites.snapshot().items.length')==2 and p.evaluate('HEWRSApp.store.exportText()')==raw)
  # Open first saved DS023 through the visible UI.
  target=item['id'];p.locator('[data-favorite-open="'+target+'"]').click()
  ck('Open favorite applies exact manual outfit and preserves all wear records',p.evaluate('HEWRSApp.state().selection')==O() and p.evaluate('HEWRSApp.state().mode')=='anchor' and p.evaluate('HEWRSApp.state().origin')=='manual' and p.evaluate('HEWRSApp.store.snapshot().events')==json.loads(raw)['events'] and digest(p)==before)
  ck('Opening favorite remembers the current selection without a saved Engine score',p.evaluate('HEWRSApp.store.snapshot().session.selection')==O() and p.evaluate('HEWRSApp.state().optionCount')==0 and p.evaluate('HEWRSApp.state().score.score') is None)
  # Favorites exports are separate and contain no wear ledger.
  favorites(p);p.click('#favorite-data')
  with p.expect_download() as info:p.click('#export-favorites')
  downloaded=info.value;dest=E/'SYNTHETIC_FAVORITES_EXPORT.json';downloaded.save_as(str(dest));data=json.loads(dest.read_text())
  ck('Export downloads valid Favorites JSON, not wear data',data['schema']=='hewrs.connected-app.favorites.v1' and len(data['items'])==2 and 'events' not in data and downloaded.suggested_filename.startswith('HEWRS_FAVORITES_'))
  # Main wear backup is rejected with no writes.
  fraw=p.evaluate('HEWRSApp.favorites.exportText()');wraw=p.evaluate('HEWRSApp.store.exportText()')
  p.set_input_files('#favorites-file',{'name':'wear.json','mimeType':'application/json','buffer':wraw.encode()});p.wait_for_function('document.querySelector("#fx-sheet-error").textContent.length>0')
  ck('Wear backup cannot be imported as Favorites',p.locator('#confirm-favorites-import').is_disabled() and p.evaluate('HEWRSApp.favorites.exportText()')==fraw)
  incoming=json.loads(fraw);incoming['items']=[{'id':'favorite_IMPORTED_SYNTHETIC','created_at':'2026-09-27T03:41:53.000Z','selection':BL('DS002','NO_TIE')}]
  p.set_input_files('#favorites-file',{'name':'favorites.json','mimeType':'application/json','buffer':json.dumps(incoming).encode()});p.wait_for_function('!document.querySelector("#confirm-favorites-import").disabled')
  ck('Import preview discloses additions without writing',p.evaluate('HEWRSApp.favorites.exportText()')==fraw and '"add": 1' in p.locator('#favorites-import-preview').inner_text())
  p.click('#confirm-favorites-import');ck('Confirmed import preserves existing Favorites, current outfit and wear',p.evaluate('HEWRSApp.favorites.snapshot().items.length')==3 and p.evaluate('HEWRSApp.store.exportText()')==wraw and p.evaluate('HEWRSApp.state().selection')==O())
  # Seed additional synthetic Favorites to exercise long scrolling sheets.
  p.evaluate('''()=>{for(const id of HEWRSApp.connection.nonSuitSources.connectedIds){const s={shirtOnly:true,pantId:'PG002',shirtId:id,state:'T017',shoeId:'shoe-8',watchId:null};HEWRSApp.favorites.add(s,{id:'favorite_LAYOUT_'+id,created_at:'2026-09-27T03:41:53.000Z'});}}''')
  close(p);favorites(p);p.screenshot(path=str(E/'FAVORITES_390x700.png'))
  for size in [(320,568),(390,700),(390,350),(430,932),(1024,768)]:
   p.set_viewport_size({'width':size[0],'height':size[1]});p.wait_for_timeout(120)
   bounds=p.evaluate('''()=>{const s=document.querySelector('#fx-sheet'),a=document.querySelector('#fx-sheet-actions'),b=document.querySelector('#fx-sheet-body');const r=s.getBoundingClientRect(),ar=a.getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,bottom:r.bottom,actionsTop:ar.top,actionsBottom:ar.bottom,bodyHeight:b.clientHeight,bodyScroll:b.scrollHeight,w:innerWidth,h:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};}''')
   ok=not bounds['overflow'] and bounds['x']>=-1 and bounds['right']<=bounds['w']+1 and bounds['top']>=-1 and bounds['actionsBottom']<=bounds['h']+1 and bounds['bodyHeight']>0
   layouts.append({'viewport':size,**bounds,'passed':ok})
   if not ok:raise AssertionError('Favorite sheet bounds '+str(bounds))
   p.locator('[data-favorite-open]').last.scroll_into_view_if_needed();p.wait_for_timeout(60)
  ck('Long Favorites lists and footer controls remain accessible in five viewports',len(layouts)==5 and all(x['passed'] for x in layouts))
  p.set_viewport_size({'width':390,'height':700});close(p);p.evaluate('HEWRSApp.showPage("home")')
  home=p.evaluate('({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight})');ck('Accepted one-screen Home layout is unchanged',home['sw']<=home['w'] and home['sh']<=home['h'],home)
  # Existing picker Apply/Cancel is not disturbed.
  p.click('#pref-shirt');n=p.locator('[data-item-id]').count();prefs=p.evaluate('HEWRSApp.ui.snapshot()');p.locator('[data-item-id="DS027"]').click();p.keyboard.press('Escape');ck('Existing 18-shirt picker and Cancel remain intact',n==18 and p.evaluate('HEWRSApp.ui.snapshot()')==prefs)
  # New page with the same synthetic storage simulates reinitialization, NOT a physical restart.
  seed=p.evaluate('Object.fromEntries(__STORAGE_MAP)');other=browser.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True);load(other,R,seed,preload=[O()]);
  ck('Favorites and saved current outfit reinitialize from identical synthetic storage',other.evaluate('HEWRSApp.favorites.snapshot()')==p.evaluate('HEWRSApp.favorites.snapshot()') and other.evaluate('HEWRSApp.state().selection')==O() and other.evaluate('HEWRSApp.store.snapshot().events')==json.loads(raw)['events']);other.close()
  ck('No unexpected namespace changes, uncaught errors or synthetic wear additions',p.evaluate('__STORAGE_MAP.get("favorite-sentinel")')=='KEEP' and p.evaluate('HEWRSApp.store.snapshot().events.length')==1 and not errors,errors)
 except Exception:
  checks.append({'name':'Suite completion','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except Exception:pass
 finally:save();browser.close()
if any(not x['passed'] for x in checks):raise SystemExit(1)
