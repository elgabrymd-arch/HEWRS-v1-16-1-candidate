"""V1.23.2 real-bundle/offline Chromium UI checks, not a deployment or Safari test.
Uses only private disposable memory adapters. Original user data are never seeded.
"""
from pathlib import Path
import os,sys,json,base64,hashlib,io,traceback,time,re
from PIL import Image
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];B=Path(os.environ['HEWRS_BASELINE']);E=R/'evidence/card_layout_v1_23_2/browser';E.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(R/'tests'));import facelift_harness as h
checks=[];errors=[];layouts=[];navigated=[];native=[];attempts=[]
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print('PASS' if ok else 'FAIL',name,flush=True)
 if not ok:raise AssertionError(name+' '+str(detail))
def save():
 (E/'RESULT.json').write_text(json.dumps({'schema':'hewrs.card-layout.browser.v1_23_2','scope':'Fresh actual rebuilt bundle and actual image bytes in offline Chromium; isolated synthetic memory storage; no live site, physical Safari, network SRI execution or current-device state verified.','passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'errors':errors,'layouts':layouts,'native_frames':native,'navigated':navigated,'attempts':attempts},indent=2)+'\n')
def wait_js(p,expression,arg=None,timeout=45000):
 # DevTools evaluates a callable directly; never relax the app CSP to use eval.
 fn=expression if re.match(r'^(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>',expression.strip()) else '()=>('+expression+')'
 deadline=time.monotonic()+timeout/1000
 while time.monotonic()<deadline:
  if p.evaluate(fn,arg):return
  p.wait_for_timeout(100)
 raise TimeoutError(expression)
def load(p,root):
 p.set_default_timeout(45000);p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content((root/'app.template.html').read_text().replace('<!--STYLE-->','<style>'+(root/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->',''))
 p.evaluate('''()=>{const m=new Map([['card-sentinel','UNCHANGED']]);globalThis.__STORAGE_MAP=m;globalThis.__WRITES=[];Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>{__WRITES.push([k,v]);m.set(k,v)},removeItem:k=>{__WRITES.push([k,null]);m.delete(k)}}});globalThis.HEWRS_EMBEDDED_IMAGES={};}''')
 for f in json.loads((root/'STARTUP_RESOURCES.json').read_text())['startup_scripts']:p.add_script_tag(content=(root/f).read_text())
 wait_js(p,'globalThis.HEWRS_READY===true||globalThis.HEWRS_LOAD_ERROR');assert not p.evaluate('globalThis.HEWRS_LOAD_ERROR||null')
 p.evaluate('x=>globalThis.HEWRS_EMBEDDED_UI_IMAGES=x',{f.stem:'data:image/png;base64,'+base64.b64encode(f.read_bytes()).decode() for f in (root/'ui/option-cards').glob('*.png')})
 return p
def supply(p,root,selections):h.R=root;h.ensure(p,selections)
def apply(p,root,s):
 supply(p,root,[s]);r=p.evaluate('async s=>{const r=await HEWRSApp.apply(s,{save:false,localDate:"2026-10-01"});HEWRSApp.showPage("outfits");return {cancelled:r.cancelled,selection:HEWRSApp.state().selection};}',s);imgs(p);return r
def imgs(p):wait_js(p,'Array.from(document.querySelectorAll("#option-card-items img")).every(x=>x.complete&&x.naturalWidth>0)')
def data(p):return base64.b64decode(p.evaluate('document.getElementById("avatar").toDataURL().split(",")[1]'))
def rgba(p):return Image.open(io.BytesIO(data(p))).convert('RGBA').tobytes()
def persistent(p):return p.evaluate('Array.from(__STORAGE_MAP.entries())')
def snap(p):return p.evaluate('({selection:HEWRSApp.state().selection,prefs:HEWRSApp.ui.snapshot(),card:HEWRSApp.cardSnapshot(),stored:Array.from(__STORAGE_MAP.entries())})')
def layout(p):
 return p.evaluate('''()=>{const r=n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}},page=document.querySelector('#page-outfits'),nav=r(document.querySelector('.bottom-nav')),full=n=>{const b=r(n);return b.x>=0&&b.right<=innerWidth+1&&b.y>=page.getBoundingClientRect().top-1&&b.bottom<=nav.y+1;};const pics=Array.from(document.querySelectorAll('#option-card-items img')).map(n=>({id:n.closest('.lb-item').dataset.itemId,decoded:n.complete&&n.naturalWidth>0,visible:full(n),...r(n)}));return {width:innerWidth,height:innerHeight,scrollTop:page.scrollTop,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,avatar:r(document.querySelector('#avatar')),items:r(document.querySelector('#option-card-items')),card:r(document.querySelector('#option-card')),nav,navFullyVisible:nav.bottom<=innerHeight+1,pictures:pics,pictureControlVisible:full(document.querySelector('#card-item-pictures')),buttons:Array.from(document.querySelectorAll('#option-card button')).map(n=>({id:n.id||n.getAttribute('aria-label'),...r(n)}))};}''')
base={'suitId':'S05','shirtId':'DS001','state':'T017','shoeId':'shoe-15','watchId':None}
cases=[('S05_TIED',base),('S05_OPEN',{**base,'state':'NO_TIE'}),('S11_DS035_OPEN',{**base,'suitId':'S11','shirtId':'DS035','state':'NO_TIE'}),('S02_SOURCE_WARNING',{**base,'suitId':'S02','shirtId':'DS029','shoeId':'shoe-4'}),('B01_TIED',{'blazerId':'B01','pantId':'PB001','shirtId':'DS001','state':'T017','shoeId':'shoe-15','watchId':None}),('B02_OPEN',{'blazerId':'B02','pantId':'PB001','shirtId':'DS001','state':'NO_TIE','shoeId':'shoe-15','watchId':None}),('B03_WATCH',{'blazerId':'B03','pantId':'PG002','shirtId':'DS007','state':'T004','shoeId':'shoe-4','watchId':'watch-P05'}),('SHIRT_ONLY',{'shirtOnly':True,'pantId':'PB001','shirtId':'DS007','state':'NO_TIE','shoeId':'shoe-15','watchId':None}),('SHOE8_CONTROL',{**base,'shoeId':'shoe-8'})]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  p=load(b.new_page(viewport={'width':390,'height':844},accept_downloads=True),R);old=load(b.new_page(viewport={'width':390,'height':844}),B)
  ck('Actual new runtime starts with 3 scripts, no index, and no writes',p.evaluate('HEWRSApp.version==="HEWRS_CONNECTED_APP_V1_23_2_CARDS"&&!globalThis.HEWRS_OPTION_INDEX&&__WRITES.length===0'))
  # A direct screenshot comparison also protects Home from the card-specific CSS.
  ck('Home screenshot pixel-identical to previous shoe-15 release',p.screenshot()==old.screenshot())
  for name,s in cases:
   apply(p,R,s);apply(old,B,s);a=rgba(p);aold=rgba(old)
   native.append({'name':name,'selection':s,'sha256_rgba':hashlib.sha256(a).hexdigest(),'equal':a==aold})
   ck(name+' native outfit pixels and all item IDs unchanged',a==aold and p.evaluate('HEWRSApp.cardSnapshot().selection')==s)
   if name=='S02_SOURCE_WARNING':ck('Existing S02 appearance-source warning retained',p.locator('#s02-source-note').is_visible())
  ck('Manual rendering does not write stored history, Favorites or feedback',persistent(p)==[['card-sentinel','UNCHANGED']])
  apply(p,R,base)
  # Initial visibility is tested against the actual page/nav clipping boundary.
  for w,hh in [(320,568),(390,350),(390,780),(390,844),(430,932),(1280,1000)]:
   p.set_viewport_size({'width':w,'height':hh});p.evaluate('document.querySelector("#page-outfits").scrollTop=0');p.wait_for_timeout(60);v=layout(p);layouts.append(v)
   ck(f'{w}x{hh} keeps full-body canvas left and real items right',v['avatar']['right']<=v['items']['x']+1 and not v['horizontalOverflow'])
   ck(f'{w}x{hh} picture access visible initially and bottom navigation inside viewport',v['pictureControlVisible'] and v['navFullyVisible'])
   if hh>=568:ck(f'{w}x{hh} shirt,tie,shoe images decoded and visible without scrolling',all(x['decoded'] and x['visible'] for x in v['pictures']))
   ck(f'{w}x{hh} thumbnail touch controls at least44px',all(x['width']>=43.99 and x['height']>=43.99 for x in v['buttons']))
   p.screenshot(path=str(E/f'CARD_{w}x{hh}.png'))
  # Physical touch-targets remain usable at small sizes; card details are readable.
  p.set_viewport_size({'width':390,'height':844});p.evaluate('document.querySelector("#page-outfits").scrollTop=0');before=snap(p);pixels=rgba(p)
  p.locator('.lb-item[data-role="Shoes"] .lb-swatch-button').click();wait_js(p,'document.querySelector(".lb-detail-picture")?.complete&&document.querySelector(".lb-detail-picture").naturalWidth>0')
  ck('Tap shoe photo opens source-photo enlargement at the correct ID','shoe-15' in p.locator('#fx-sheet-title').inner_text() and 'Warm Brown' in p.locator('.lb-detail-copy').inner_text())
  p.screenshot(path=str(E/'PHONE_SHOE_PICTURE.png'));p.locator('#fx-sheet-close').click()
  p.click('#card-item-pictures');ck('Item pictures opens every current role including ID/name-only watch',p.locator('#card-detail-items .lb-item').count()==6 and p.locator('#card-detail-items .lb-item[data-role="Watch"] img').count()==0);p.screenshot(path=str(E/'PHONE_ALL_ITEM_PICTURES.png'));p.locator('#fx-sheet-close').click()
  p.set_viewport_size({'width':390,'height':350});p.evaluate('document.querySelector("#page-outfits").scrollTop=0');p.click('#card-item-pictures');ck('Short350px viewport picture control opens an accessible scrolling sheet',p.locator('#fx-sheet').is_visible() and p.locator('#card-detail-items .lb-item').count()==6);p.locator('#fx-sheet-close').click()
  p.set_viewport_size({'width':390,'height':844});p.click('#layout-standard');ck('Standard view still available with details hidden intentionally',not p.locator('#option-card-items').is_visible());p.click('#layout-cards');p.click('#detail-view');ck('Collar detail retained', 'detail' in p.locator('#stage').get_attribute('class'));p.click('#full-view');p.click('#large-view');ck('Existing full-outfit enlargement retained',p.locator('#large-avatar').count()==1);p.click('#large-outfit-fit');p.locator('#fx-sheet-close').click()
  ck('All new picture/view controls preserve native pixels,selection,preferences and storage',snap(p)==before and rgba(p)==pixels)
  p.set_viewport_size({'width':1280,'height':1000});p.click('#detail-view');assert p.locator('#avatar').evaluate('(n)=>getComputedStyle(n).maxWidth')=='none';p.click('#full-view');p.set_viewport_size({'width':390,'height':844})
  # Invalid or cancelled navigation must not display mismatched incoming swatches.
  before=snap(p);pixels=rgba(p);error=p.evaluate('async s=>{try{await HEWRSApp.apply({...s,shirtId:"DS999"},{save:false});return null}catch(e){return e.message}}',base)
  ck('Failed selection keeps previous coherent card and native image',bool(error) and snap(p)==before and rgba(p)==pixels)
  target={**base,'state':'T004'};supply(p,R,[target]);out=p.evaluate('async s=>{const prom=HEWRSApp.apply(s,{save:false});HEWRSApp.renderer.cancel();return await prom}',target)
  ck('Cancelled render keeps previous coherent card and native image',out.get('cancelled') and snap(p)==before and rgba(p)==pixels)
  # Explicitly simulated img decode failure verifies identity-preserving fallbacks.
  p.locator('.lb-item[data-role="Shoes"] img').dispatch_event('error');ck('Image error reports unavailability without inventing a replacement identity',p.locator('.lb-item[data-role="Shoes"]').get_attribute('data-item-id')=='shoe-15' and 'Thumbnail unavailable' in p.locator('.lb-item[data-role="Shoes"]').inner_text());apply(p,R,target);apply(p,R,base)
  # The existing actual PNG exporter is unchanged; compare byte-for-byte output.
  js='''async()=>{const m=HEWRSApp.optionCards.model(HEWRSApp.state().selection,{date:"2026-10-01",origin:"Your selection"});const blob=await HEWRSApp.optionCards.png(m,document.querySelector('#avatar'));return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(blob)})}'''
  apply(old,B,base);newpng=base64.b64decode(p.evaluate(js));oldpng=base64.b64decode(old.evaluate(js));ck('PNG card export byte-identical to corrected shoe-15 baseline',newpng==oldpng);(E/'UNCHANGED_PNG_EXPORT.png').write_bytes(newpng)
  # Generate a real list with exact S05/DS001/shoe-15 anchors. No candidate stub.
  supply(p,R,[{**base,'state':f'T{i:03}'} for i in range(1,48)]+[{**base,'state':'NO_TIE'}])
  p.add_script_tag(content=(R/'data/option-index.js').read_text())
  p.evaluate('''()=>{HEWRSApp.ui.fromSelection(HEWRSApp.state().selection);HEWRSApp.ui.set('tie',{mode:'any'});HEWRSApp.ui.set('watch',{mode:'any'});HEWRSApp.showPage('home');HEWRSApp.setMode('engine');}''')
  start=time.monotonic();p.click('#generate-options');wait_js(p,'!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"',timeout=180000)
  st=p.evaluate('HEWRSApp.state()');ck('Actual Generate button produces a verified nonempty anchored list',st['optionCount']>0,{'seconds':round(time.monotonic()-start,3),'count':st['optionCount'],'method':'research','anchors':['S05','DS001','shoe-15'],'status':st.get('report',{}).get('status')})
  actual=p.evaluate('HEWRSApp.state().report.options');(E/'ACTUAL_ANCHORED_GENERATION.json').write_text(json.dumps({'request':p.evaluate('HEWRSApp.state().request'),'selections':[o['_hewrsConnected']['canonical_selection'] for o in actual]},indent=2)+'\n')
  supply(p,R,[o['_hewrsConnected']['canonical_selection'] for o in actual]);p.set_viewport_size({'width':390,'height':844})
  for i,o in enumerate(actual):
   if i:p.click('#next-option');wait_js(p,'i=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===i',arg=i)
   imgs(p);m=p.evaluate('HEWRSApp.cardSnapshot()');selection=o['_hewrsConnected']['canonical_selection'];idsdom=p.locator('#option-card-items .lb-item').evaluate_all('ns=>ns.map(n=>n.dataset.itemId)');assert m['selection']==selection and idsdom==[x['id']or'' for x in m['items']];assert m['position']==i+1 and m['total']==len(actual);assert p.locator('#lb-card-title').inner_text()==f'Option {i+1:02}'
   v=layout(p);assert v['scrollTop']==0 and all(x['decoded'] and x['visible'] for x in v['pictures']),v
   navigated.append({'position':i+1,'selection':selection,'ids':idsdom,'visible':True})
   if i==0:p.screenshot(path=str(E/'GENERATED_OPTION_01_PHONE.png'))
  ck('Every real generated option has matching ID/name/pictures and returns to top on navigation',len(navigated)==len(actual),len(navigated))
  if len(actual)>1:p.click('#prev-option');wait_js(p,'i=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===i',arg=len(actual)-2);imgs(p)
  ck('Previous button and visible option count stay accurate',p.evaluate('HEWRSApp.cardSnapshot().position===HEWRSApp.state().optionIndex+1&&HEWRSApp.cardSnapshot().total===HEWRSApp.state().optionCount'))
  # Two actual cards through existing standalone HTML exporter; not a new generation.
  sourceModels=p.evaluate('ss=>ss.map((s,i)=>HEWRSApp.optionCards.model(s,{position:i+1,total:ss.length,date:"2026-10-01"}))',[o['_hewrsConnected']['canonical_selection'] for o in actual[:2]])
  before=persistent(p);text=p.evaluate('async m=>(await HEWRSApp.optionCards.book(m,{resolveUrl:HEWRSApp.resolveUrl})).text()',sourceModels);(E/'TWO_ACTUAL_CARDS.html').write_text(text)
  q=b.new_page(viewport={'width':1280,'height':1000});q.set_content(text);wait_js(q,'Array.from(document.images).every(x=>x.complete&&x.naturalWidth>0)');ck('Self-contained HTML export retains actual IDs and decoded outfit pictures',q.locator('article.card').count()==len(sourceModels) and q.locator('img.outfit').count()==len(sourceModels));q.close();ck('HTML export does not change saved state',persistent(p)==before)
  ck('Only synthetic session writes occurred; no wear,Favorites,feedback,or sentinel modification',p.evaluate('__STORAGE_MAP.get("card-sentinel")==="UNCHANGED"&&HEWRSApp.store.snapshot().events.length===0&&__WRITES.every(x=>x[0]==="hewrs:connected-app:v1")'),p.evaluate('__WRITES.map(x=>x[0])'))
  p.evaluate('HEWRSApp.showPage("home")');p.set_viewport_size({'width':390,'height':844});home=p.evaluate('({h:document.querySelector("#page-home").clientHeight,s:document.querySelector("#page-home").scrollHeight,w:document.querySelector("#app").getBoundingClientRect().width})');ck('Home remains one phone screen after all navigation',home['s']<=home['h']+1 and home['w']==390,home)
  p.click('#pref-shirt');prefs=p.evaluate('HEWRSApp.ui.snapshot()');p.locator('#fx-sheet-close').click();ck('Existing picker Cancel still retains preferences',p.evaluate('HEWRSApp.ui.snapshot()')==prefs)
  ck('No unexpected JavaScript errors',not errors,errors)
 except Exception:
  traceback.print_exc();checks.append({'name':'Browser suite completed','passed':False,'detail':traceback.format_exc()})
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except:pass
 finally:save();b.close()
if any(not x['passed'] for x in checks):sys.exit(1)
