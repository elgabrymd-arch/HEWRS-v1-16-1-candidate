#!/usr/bin/env python3
"""Current source and actual images in memory-loaded Chromium. Synthetic test
records only; not a hosted, real localStorage, iPhone, or browser-restart test."""
import os,sys,json,time,base64,hashlib,io,traceback
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];B=Path(os.environ.get('HEWRS_BASELINE_V1166',str(R.parent/'HEWRS_CONNECTED_APP_V1_16_6')))
E=R/'evidence/insights_v1_16_7/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];frames=[];layouts=[];errors=[];start=time.monotonic()
IDs=json.loads((R/'RELEASE_SCOPE.json').read_text())['enabled_non_suit_shirt_ids']
WKEY='hewrs:connected-app:v1';FKEY='hewrs:connected-app:favorites:v1'
def save():
 (E/'RESULT.json').write_text(json.dumps({'schema':'hewrs.insights.chromium.v1_16_7','scope':__doc__,'passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'outfit_frames':frames,'layout_cases':layouts,'errors':errors,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(str((name,detail)))
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hashes.items():
  if sha in present:continue
  value=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=value;size+=len(value)
  if size>2_000_000:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply

def load(p,r,seed=None,preload=None):h.R=r;h.load(p,storage=seed if seed is not None else {'insights-sentinel':'KEEP'},preload=preload)
def ensure(p,r,ss):h.R=r;h.ensure(p,ss)
def O(id='DS023',t='T017'):return dict(shirtOnly=True,pantId='PG002',shirtId=id,state=t,shoeId='shoe-8',watchId=None)
def BL(id='DS023',t='T017',b='B03'):return dict(blazerId=b,pantId='PG002',shirtId=id,state=t,shoeId='shoe-8',watchId=None)
def S(id='DS023',t='T017',suit='S05',watch=None):return dict(suitId=suit,shirtId=id,state=t,shoeId='shoe-8',watchId=watch)
def pixels(p):return Image.open(io.BytesIO(base64.b64decode(p.evaluate('document.querySelector("#avatar").toDataURL("image/png")').split(',')[1]))).convert('RGBA')
def digest(p):return hashlib.sha256(pixels(p).tobytes()).hexdigest()
def apply(p,s):ensure(p,R,[s]);p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
def close(p):p.click('#fx-sheet-close')
def insights(p):p.evaluate('HEWRSApp.showPage("rotation")');p.click('#insights-button')
def raw_storage(p):return p.evaluate('JSON.stringify(Object.fromEntries(__STORAGE_MAP))')
def writes(p):return p.evaluate('__STORAGE_CALLS.filter(x=>x[0]!=="get").length')
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=browser.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True);p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R);ck('Current app initializes with read-only Insights and unchanged Favorites',p.evaluate('HEWRS_READY&&HEWRSApp.version==="HEWRS_CONNECTED_APP_V1_16_7"&&HEWRSApp.usage&&HEWRSApp.favorites.snapshot().items.length===0'))
  # Empty ledger is stated as unknown real wear, never sampled demo history.
  before=raw_storage(p);w0=writes(p);insights(p)
  ck('Empty real UI shows zero logged records without inferring wear from current outfit',p.locator('#insights-summary .fx-stat-number').all_text_contents()==['0','0']and'No confirmed wear logged' in p.locator('#insights-summary').inner_text()and p.locator('[data-usage-id]').count()==50)
  p.locator('#insights-category').select_option('watches');p.locator('#insights-search').fill('watch-P05')
  ck('Watch lookup shows ID/name and no-record language, not image requirement',p.locator('[data-usage-id]').count()==1 and'No wear recorded' in p.locator('#insights-list').inner_text())
  close(p);ck('Opening, searching and closing Insights performs zero storage writes',writes(p)==w0 and raw_storage(p)==before)
  # Compare current application to independent V1.16.6 with full actual frames.
  old=browser.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True);load(old,B)
  matrix=[s for id in IDs for t in ['NO_TIE','T017']for s in [O(id,t),BL(id,t)]]+[S(suit='S'+str(i).zfill(2))for i in range(1,19)]
  ensure(p,R,matrix);ensure(old,B,matrix)
  for n,s in enumerate(matrix):
   p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);old.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
   a,b=digest(p),digest(old);frames.append({'selection':s,'before':b,'after':a,'equal':a==b})
   if a!=b:raise AssertionError('Changed outfit '+str(s))
   if(n+1)%18==0:print('COMPARE',n+1,flush=True);save()
  ck('All 90 outfit frames match V1.16.6 exactly, including corrected DS023',len(frames)==90 and all(f['equal']for f in frames));old.close();apply(p,O())
  # Seven explicit synthetic confirmed records plus an unrelated Favorite.
  inputs=[(O('DS002'),'2026-08-28','old','manual',False),(BL('DS001','NO_TIE'),'2026-08-29','edge','manual',False),(S('DS036',watch='watch-P05'),'2026-09-10','suit','engine',False),(O(),'2026-09-25','first','manual',True),(O(),'2026-09-25','second','manual',False),(BL('DS024','NO_TIE'),'2026-09-27','cutoff','engine',False),(BL('DS025'),'2026-09-28','future','manual',False)]
  p.evaluate('''rows=>{for(const[s,date,id,origin,repeat]of rows)HEWRSApp.store.addEvent(HEWRSApp.connection.createHistoryEvent(s,{id:'SYNTHETIC_INSIGHTS_'+id,localDate:date,origin,controlledRepetition:repeat}));HEWRSApp.favorites.add(HEWRSApp.state().selection,{id:'favorite_SYNTHETIC_INSIGHTS',created_at:'2026-09-27T04:28:56.000Z'});}''',inputs)
  before=raw_storage(p);w0=writes(p);state=p.evaluate('HEWRSApp.state()');frame=digest(p);insights(p)
  p.locator('#insights-through').fill('2026-09-27');p.locator('#insights-through').press('Tab');p.locator('#insights-range').select_option('30')
  ck('Thirty-day UI reports five entries across four recorded days',p.locator('#insights-summary .fx-stat-number').all_text_contents()==['5','4'] and'2026-08-29 to 2026-09-27' in p.locator('#insights-summary').inner_text())
  ck('Future and older records are explicitly excluded rather than deleted', '1 records after cutoff; 1 earlier records' in p.locator('#insights-summary').inner_text()and p.evaluate('HEWRSApp.store.snapshot().events.length')==7)
  ck('Repetition flags are labeled as recorded, not newly inferred incidents','1 records marked as controlled repetition' in p.locator('#insights-summary').inner_text())
  p.locator('#insights-sort').select_option('count');ck('Count order places DS023 first with two records',p.locator('[data-usage-id]').first.get_attribute('data-usage-id')=='DS023' and'2 records' in p.locator('[data-usage-id="DS023"]').inner_text())
  p.locator('#insights-search').fill('DS002');ck('Zero-in-range DS002 still discloses its older last-recorded date','0 records' in p.locator('#insights-list').inner_text() and '2026-08-28' in p.locator('#insights-list').inner_text())
  p.locator('#insights-search').fill('DS041');ck('DS041 stays suit-only/deferred in factual roster',p.locator('[data-usage-id]').count()==1 and'non-suit deferred' in p.locator('#insights-list').inner_text())
  p.locator('#insights-search').fill('');p.locator('#insights-recorded-only').check();ck('Recorded-only means four shirts in the selected range',p.locator('[data-usage-id]').count()==4);p.locator('#insights-recorded-only').uncheck()
  p.locator('#insights-search').fill('does not exist');ck('No-match filter changes neither ledger nor Favorites',p.locator('[data-usage-id]').count()==0 and raw_storage(p)==before);p.locator('#insights-search').fill('')
  p.locator('#insights-range').select_option('all');ck('All dates through cutoff includes six records on five dates, not the future record',p.locator('#insights-summary .fx-stat-number').all_text_contents()==['6','5'])
  p.locator('#insights-through').fill('');p.locator('#insights-through').press('Tab');ck('Invalid cutoff clears stale metrics and shows an error',p.locator('#insights-summary').inner_text()=='' and p.locator('[data-usage-id]').count()==0 and len(p.locator('#fx-sheet-error').inner_text())>0)
  p.locator('#insights-through').fill('2026-09-27');p.locator('#insights-through').press('Tab');p.locator('#insights-range').select_option('30')
  ck('Valid cutoff recovers without changing Work/date preference',p.locator('#insights-summary .fx-stat-number').all_text_contents()==['5','4']and p.evaluate('HEWRSApp.state().context')==state['context'])
  p.locator('#insights-category').select_option('pants');ck('Matching suit trousers never appear as an extra physical pant record','4 records' in p.locator('[data-usage-id="PG002"]').inner_text())
  p.locator('#insights-category').select_option('shirts');p.locator('#insights-sort').select_option('count')
  # Plainly identify the screenshot as synthetic; no fixture is included in app data.
  p.evaluate('''()=>{const n=document.createElement('p');n.id='test-image-label';n.textContent='SYNTHETIC TEST RECORDS — NOT OWNER HISTORY';n.className='fx-caption';document.querySelector('#fx-sheet-body').prepend(n);document.querySelector('#fx-sheet-body').scrollTop=0;}''')
  p.screenshot(path=str(E/'INSIGHTS_SUMMARY_390x700.png'))
  p.locator('[data-usage-id="DS023"]').scroll_into_view_if_needed();p.screenshot(path=str(E/'INSIGHTS_ITEMS_390x700.png'))
  p.evaluate('document.querySelector("#test-image-label").remove()')
  for size in [(320,568),(390,700),(390,350),(430,932),(1024,768)]:
   p.set_viewport_size({'width':size[0],'height':size[1]});p.wait_for_timeout(100)
   d=p.evaluate('''()=>{const s=document.querySelector('#fx-sheet'),a=document.querySelector('#fx-sheet-actions'),b=document.querySelector('#fx-sheet-body');const r=s.getBoundingClientRect(),ar=a.getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,actionsBottom:ar.bottom,bodyHeight:b.clientHeight,bodyScroll:b.scrollHeight,w:innerWidth,h:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};}''')
   ok=not d['overflow']and d['x']>=-1 and d['right']<=d['w']+1 and d['top']>=-1 and d['actionsBottom']<=d['h']+1 and d['bodyHeight']>0
   layouts.append({'viewport':size,**d,'passed':ok})
   if not ok:raise AssertionError(str(d))
   p.locator('[data-usage-id]').last.scroll_into_view_if_needed()
  ck('Long Insights roster and Close remain accessible at five viewport sizes',all(x['passed']for x in layouts)and len(layouts)==5)
  ck('All Insights controls leave the exact storage bytes, current frame, selection and preferences unchanged',writes(p)==w0 and raw_storage(p)==before and digest(p)==frame and all(p.evaluate('HEWRSApp.state()')[k]==state[k]for k in ['selection','origin','mode','score','preferences','context','optionCount']))
  close(p);p.set_viewport_size({'width':390,'height':700});p.evaluate('HEWRSApp.showPage("home")')
  home=p.evaluate('({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight})');ck('Accepted one-screen Home remains unchanged',home['sw']<=home['w']and home['sh']<=home['h'],home)
  p.click('#pref-shirt');n=p.locator('[data-item-id]').count();prefs=p.evaluate('HEWRSApp.ui.snapshot()');p.locator('[data-item-id="DS027"]').click();p.keyboard.press('Escape');ck('18-shirt picker scope and Cancel remain unchanged',n==18 and p.evaluate('HEWRSApp.ui.snapshot()')==prefs)
  # Retain Favorites and its existing separation from wear.
  p.evaluate('HEWRSApp.showPage("rotation")');p.click('#favorites-button');ck('Favorite saved before Insights is still present and duplicate-save remains guarded',p.locator('[data-favorite-id]').count()==1 and p.locator('#save-favorite').is_disabled());close(p)
  # The old Engine report remains explicitly preserved, not replaced by scores.
  insights(p);ck('Existing Engine report remains available as a separate disclosure',p.locator('#insights-engine-report').count()==1 and'No current computed rotation report' in p.locator('#insights-engine-report pre').text_content());close(p)
  # Another page initialized from identical synthetic storage produces same counts.
  seed=p.evaluate('Object.fromEntries(__STORAGE_MAP)');other=browser.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True);load(other,R,seed)
  insights(other);other.locator('#insights-through').fill('2026-09-27');other.locator('#insights-through').press('Tab');other.locator('#insights-range').select_option('30')
  ck('Same synthetic ledger reinitializes with the same metrics without adding wear',other.locator('#insights-summary .fx-stat-number').all_text_contents()==['5','4'] and other.evaluate('HEWRSApp.store.snapshot().events.length')==7 and other.evaluate('HEWRSApp.favorites.snapshot().items.length')==1 and writes(other)==0);other.close()
  # Corrupt real-schema data must not be shown as a clean zero ledger.
  bad=browser.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True);load(bad,R,{WKEY:'{BROKEN',FKEY:seed[FKEY]});bad_raw=raw_storage(bad);insights(bad)
  ck('Blocked ledger shows unavailable, not zero usage, and keeps raw bytes',bad.locator('#insights-summary').count()==0 and'Wear records unavailable' in bad.locator('#fx-sheet-body').inner_text()and raw_storage(bad)==bad_raw and writes(bad)==0);bad.close()
  ck('No uncaught browser errors, sentinel mutation or new wear records',not errors and p.evaluate('__STORAGE_MAP.get("insights-sentinel")')=='KEEP'and p.evaluate('HEWRSApp.store.snapshot().events.length')==7,errors)
 except Exception:
  checks.append({'name':'Suite completion','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except Exception:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):raise SystemExit(1)
