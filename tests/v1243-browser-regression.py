from pathlib import Path
import sys,time,json,base64,traceback,hashlib,io
from PIL import Image
import numpy as np
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];A=R/'app';B=R/'baseline';E=R/'results/browser';E.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(A/'tests'));import facelift_harness as h
checks=[];errors=[];attempt=[]
def ck(name,v,detail=None):
 checks.append({'name':name,'passed':bool(v),'detail':detail});print('PASS' if v else 'FAIL',name,flush=True);(E/'PROGRESS.json').write_text(json.dumps({'checks':checks,'page_errors':errors},indent=2));assert v,(name,detail)
def wait(p,j,t=100):
 end=time.monotonic()+t
 while time.monotonic()<end:
  if p.evaluate('()=>('+j+')'):return
  p.wait_for_timeout(50)
 raise TimeoutError(j)
def load(p,T,seed=None,index=True):
 p.set_default_timeout(12000);p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content((T/'app.template.html').read_text().replace('<!--STYLE-->','<style>'+(T/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->',''))
 p.evaluate('''seed=>{const m=new Map(Object.entries(seed||{}));m.set('unrelated-sentinel','KEEP');__MAP=m;__WRITES=[];Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>{__WRITES.push(k);m.set(k,v)},removeItem:k=>{__WRITES.push(k);m.delete(k)}}});HEWRS_EMBEDDED_IMAGES={};}''',seed)
 for f in json.loads((T/'STARTUP_RESOURCES.json').read_text())['startup_scripts']:p.add_script_tag(content=(T/f).read_text())
 wait(p,'globalThis.HEWRS_READY||globalThis.HEWRS_LOAD_ERROR');assert not p.evaluate('globalThis.HEWRS_LOAD_ERROR||false')
 p.evaluate('x=>globalThis.HEWRS_EMBEDDED_UI_IMAGES=x',{f.stem:'data:image/png;base64,'+base64.b64encode(f.read_bytes()).decode() for f in (T/'ui/option-cards').glob('*.png')})
 if index:p.add_script_tag(content=(T/'data/option-index.js').read_text())
def supply(p,T,ss):h.R=T;h.ensure(p,ss)
def occasion(p,oc,form='any'):
 p.evaluate("HEWRSApp.showPage('home')");p.click('#work-button');p.select_option('#occasion-select',oc);p.select_option('#formality-select',form);p.fill('#local-date','2026-10-12');p.locator('#fx-sheet-actions button',has_text='Apply').click()
def style(p,s):
 p.evaluate("HEWRSApp.showPage('home')");p.click('#style-button');p.select_option('#style-select',s);p.locator('#fx-sheet-actions button',has_text='Apply').click()
def anchor(p,id):
 p.evaluate("HEWRSApp.showPage('home')");p.click('#pref-topwear');p.fill('#picker-search',id);p.locator(f'#picker-list [data-item-id="{id}"]').click();p.click('#picker-apply');p.click('#mode-anchor')
def generate(p):
 p.evaluate("HEWRSApp.showPage('home')");p.click('#generate-options');wait(p,'!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"');return p.evaluate('HEWRSApp.state()')
def native(p):return base64.b64decode(p.evaluate('document.querySelector("#avatar").toDataURL().split(",")[1]'))
def apply(p,T,s):
 supply(p,T,[s]);p.evaluate('''s=>{__DONE=null;HEWRSApp.apply(s,{save:false,localDate:'2026-10-12',context:{occasion:'work',requiredFormality:'any'}}).then(()=>{HEWRSApp.showPage('outfits');__DONE=true}).catch(e=>__DONE=e.message)}''',s);wait(p,'__DONE!==null');assert p.evaluate('__DONE') is True
base={'blazerId':'B03','pantId':'PB001','shirtId':'DS001','state':'T017','shoeId':'shoe-15','watchId':None}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  old=b.new_page(viewport={'width':390,'height':844},has_touch=True);p=b.new_page(viewport={'width':390,'height':844},has_touch=True);load(old,B);load(p,A)
  ck('Home layout preserved',old.screenshot()==p.screenshot())
  for name,s in [('B03',base),('B15',{**base,'blazerId':'B15'}),('S05',{'suitId':'S05','shirtId':'DS001','state':'T017','shoeId':'shoe-15','watchId':None}),('Shirt-only',{'shirtOnly':True,'pantId':'PB001','shirtId':'DS007','state':'NO_TIE','shoeId':'shoe-15','watchId':None})]:
   apply(old,B,s);apply(p,A,s);ck('Original native image unchanged: '+name,np.array_equal(np.array(Image.open(io.BytesIO(native(old)))),np.array(Image.open(io.BytesIO(native(p))))))
  # All categories deliberately unlocked except the requested B03 anchor.
  for page in (old,p):page.evaluate("HEWRSApp.ui.reset()");anchor(page,'B03');occasion(page,'work');style(page,'MODERN')
  before=generate(old);old.screenshot(path=str(E/'BEFORE_B03_MODERN.png'));(E/'BEFORE_STATE.json').write_text(json.dumps({'status':before['report']['status'],'text':old.locator('#page-outfits').inner_text()},indent=2))
  state=generate(p);p.screenshot(path=str(E/'AFTER_B03_MODERN.png'))
  ck('Actual B03 + Modern completes as no-match, not exception',state['optionCount']==0 and state['report']['status']=='no_qualified_candidate' and state['report']['no_match']['code']=='STYLE_UNAVAILABLE')
  ck('B03 zero counter preserved even with a prior rendered outfit',p.locator('#option-count').inner_text()=='0 options' and p.locator('#outfit-output').is_hidden())
  ck('Empty result cannot log or export an old outfit as new',p.locator('#quick-log').is_disabled() and p.locator('#record-wear').is_disabled() and p.locator('#outfit-output').is_hidden())
  ck('Clear measured classifier explanation and recovery are shown','at most 2' in p.locator('#outfit-empty').inner_text() and p.locator('#recover-style-hybrid').is_visible())
  p.locator('#outfit-empty-actions button',has_text='Change style').click();p.select_option('#style-select','CLASSIC');p.locator('#fx-sheet-actions button',has_text='Cancel').click();ck('Cancel style change retains Modern and the B03 anchor',p.evaluate('HEWRSApp.state().context.style')=='MODERN' and p.evaluate('HEWRSApp.ui.snapshot().topwear.id')=='blazer-2')
  for w,hh in [(320,568),(390,350),(390,844),(430,932),(1280,1000)]:
   p.set_viewport_size({'width':w,'height':hh});p.evaluate('document.querySelector("#page-outfits").scrollTop=0');p.locator('#save-generation-diagnostic').scroll_into_view_if_needed();ck(f'Recovery touch targets reachable at {w}x{hh}',p.evaluate('''()=>{const r=document.querySelector('#save-generation-diagnostic').getBoundingClientRect(),n=document.querySelector('.bottom-nav').getBoundingClientRect();return r.height>=44&&r.top>=0&&r.bottom<=n.top+1&&document.documentElement.scrollWidth<=innerWidth+1}'''));p.screenshot(path=str(E/f'RECOVERY_{w}x{hh}.png'))
  p.set_viewport_size({'width':390,'height':844});p.evaluate('document.querySelector("#page-outfits").scrollTop=0')
  diag=p.evaluate('HEWRSApp.diagnosticSnapshot()');ck('Diagnostic identifies this build, B03, Modern and zero result',diag['app_version']=='HEWRS_CONNECTED_APP_V1_24_3_ANCHOR_RECOVERY' and diag['requested_style']=='MODERN' and diag['no_match']['anchor']=='B03')
  ck('Diagnostic omits stored record and precise-location fields',all(k not in json.dumps(diag) for k in ['comparisons','latitude','longitude','access_token']))
  with p.expect_download() as dl:p.click('#save-generation-diagnostic')
  dl.value.save_as(E/'DOWNLOADED_DIAGNOSTIC.json');ck('Diagnostic download contains actual snapshot',json.loads((E/'DOWNLOADED_DIAGNOSTIC.json').read_text())['no_match']['code']=='STYLE_UNAVAILABLE')
  # Preload actual expected B03 Hybrid selections from a current-source engine run.
  rows=[json.loads(l) for l in (R/'results/before/work.jsonl').read_text().splitlines()];hy=next(r for r in rows if r['anchor']=='B03' and r['style']=='HYBRID');supply(p,A,hy['selections']);prior=p.evaluate('HEWRSApp.ui.snapshot()')
  p.click('#recover-style-hybrid');wait(p,'!HEWRSApp.state().busy&&HEWRSApp.state().optionCount>0');state=p.evaluate('HEWRSApp.state()')
  ck('Explicit recovery changes only style and generates actual B03 Hybrid matches',state['optionCount']==18 and state['context']['style']=='HYBRID' and p.evaluate('HEWRSApp.ui.snapshot()')==prior)
  ck('Every recovery option keeps B03 and is labelled Hybrid',all(o['_hewrsConnected']['canonical_selection']['blazerId']=='B03' and o['_hewrsConnected']['compatibility']['style']['classification']=='HYBRID' for o in state['report']['options']))
  wait(p,'[...document.querySelectorAll("#option-card-items img")].every(i=>i.complete&&i.naturalWidth>0)');p.screenshot(path=str(E/'RECOVERED_B03_HYBRID.png'))
  exact=[o['_hewrsConnected']['canonical_selection'] for o in state['report']['options']]
  for i,s in enumerate(exact):
   if i:p.click('#next-option');wait(p,f'!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex==={i}')
   assert p.evaluate('HEWRSApp.state().selection')==s;wait(p,'[...document.querySelectorAll("#option-card-items img")].every(i=>i.complete&&i.naturalWidth>0)')
  ck('All 18 recovered cards navigated with correct IDs and decoded pictures',True)
  p.click('#next-option');wait(p,'!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===0');p.click('#prev-option');wait(p,'!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===17');ck('Circular arrows work at actual list length',True)
  p.evaluate('document.querySelector("#page-outfits").scrollTop=0');p.evaluate('''()=>{let el=document.querySelector('#avatar'),r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+80;let t=new Touch({identifier:1,target:el,clientX:x,clientY:y});el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t],changedTouches:[t]}));t=new Touch({identifier:1,target:el,clientX:x-70,clientY:y});el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[t],changedTouches:[t]}));el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[t]}));}''');wait(p,'!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===0');ck('Synthetic swipe wraps recovered list',True)
  ck('Card layout remains side-by-side after recovery',p.evaluate("document.querySelector('#avatar').getBoundingClientRect().right<=document.querySelector('#option-card-items').getBoundingClientRect().left+1"))
  p.locator('#option-card-items [data-role="Shirt"] button').click();wait(p,'document.querySelector(".lb-detail-picture")?.complete&&document.querySelector(".lb-detail-picture").naturalWidth>0');ck('Picture enlargement still works',p.locator('.lb-detail-picture').is_visible());p.click('#fx-sheet-close')
  png=p.evaluate('''async()=>{const blob=await HEWRSApp.optionCards.png(HEWRSApp.cardSnapshot(),document.querySelector('#avatar'));return await new Promise(r=>{const fr=new FileReader;fr.onload=()=>r(fr.result.split(',')[1]);fr.readAsDataURL(blob)})}''');(E/'RECOVERY_CARD_EXPORT.png').write_bytes(base64.b64decode(png));ck('Actual PNG card export works',Image.open(E/'RECOVERY_CARD_EXPORT.png').size==(1400,1900))
  ck('Recovery changes no feedback, wear events or Favorites',p.evaluate('__WRITES.every(k=>k==="hewrs:connected-app:v1")&&HEWRSApp.store.snapshot().events.length===0&&__MAP.get("unrelated-sentinel")==="KEEP"'))
  old.close();p.close()
  # Reproduce a separate real scope bug using labelled synthetic feedback only.
  raw=(R/'results/SYNTHETIC_ONLY_LEARNING.json').read_text();key='hewrs:outfit-preferences:v1'
  for T,expected in [(B,'old'),(A,'new')]:
   p=b.new_page(viewport={'width':390,'height':844},has_touch=True);load(p,T,{key:raw});anchor(p,'B03');occasion(p,'work');style(p,'MODERN');generate(p)
   ck(expected+' Work model is active',p.evaluate('HEWRSApp.connection.hybrid.researchPreference.learningStatus().active'))
   occasion(p,'dinner');p.click('#generate-options');wait(p,('/Learning context differs/.test(document.querySelector("#status").textContent)' if T==B else '!HEWRSApp.state().busy&&HEWRSApp.state().request?.context.occasion==="dinner"&&HEWRSApp.state().report?.status==="no_qualified_candidate"'),120)
   text=p.locator('#status').inner_text()
   if T==B:ck('Separate active-Work to Dinner validation failure reproduced','Learning context differs' in text);p.screenshot(path=str(E/'BEFORE_LEARNED_DINNER_FAILURE.png'))
   else:
    ck('Active-Work to Dinner now refreshes model before request validation','Learning context differs' not in text and p.evaluate('HEWRSApp.state().report.status')=='no_qualified_candidate')
    ck('Dinner does not reuse Work feedback',p.evaluate('HEWRSApp.connection.hybrid.researchPreference.learningStatus().context_scope.occasion')=='dinner' and not p.evaluate('HEWRSApp.connection.hybrid.researchPreference.learningStatus().active'))
    for oc in ['weekend','work']:
     occasion(p,oc);state=generate(p);ck('Correct isolated model after switch to '+oc,state['request']['context']['occasion']==oc and p.evaluate('HEWRSApp.connection.hybrid.researchPreference.learningStatus().context_scope.occasion')==oc)
    ck('Work feedback still active after returning',p.evaluate('HEWRSApp.connection.hybrid.researchPreference.learningStatus().active'))
    ck('No raw synthetic feedback bytes rewritten during context changes',p.evaluate('k=>__MAP.get(k)',key)==raw and p.evaluate('__WRITES.every(k=>k!=="hewrs:outfit-preferences:v1")'))
    p.evaluate('k=>__MAP.set(k,"{private-marker-DO-NOT-EXPORT")',key);p.evaluate("HEWRSApp.showPage('home')");p.click('#generate-options');wait(p,'HEWRSApp.state().report?.status==="error"');ck('Corrupt feedback gives recoverable error without deleting records',p.evaluate('k=>__MAP.get(k)',key)=='{private-marker-DO-NOT-EXPORT' and p.locator('#outfit-empty-actions').is_visible())
    ck('Diagnostic does not expose corrupt stored feedback', 'private-marker' not in json.dumps(p.evaluate('HEWRSApp.diagnosticSnapshot()')))
    p.evaluate('x=>__MAP.set(x.key,x.raw)',{'key':key,'raw':raw});p.locator('#outfit-empty-actions button',has_text='Retry same selections').click();wait(p,'!HEWRSApp.state().busy&&HEWRSApp.state().report?.status==="no_qualified_candidate"');ck('Retry recovers after data becomes readable without resetting preferences',p.evaluate('HEWRSApp.state().preferences.topwear.id')=='blazer-2')
    # Contradictions retain all choices and expose their specific cause.
    p.evaluate("HEWRSApp.ui.set('tie',{mode:'none'})");occasion(p,'work','tie_required');state=generate(p);ck('No Tie versus Tie required gets specific conflict',state['report']['no_match']['code']=='TIE_REQUIREMENT_CONFLICT')
    p.evaluate("HEWRSApp.ui.set('tie',{mode:'any'})");occasion(p,'work','suit_required');state=generate(p);ck('B03 versus Suit required gets specific conflict',state['report']['no_match']['code']=='SUIT_REQUIREMENT_CONFLICT')
   p.close()
  # A cold empty search must not restore a default outfit on tab navigation.
  for T in [B,A]:
   p=b.new_page(viewport={'width':390,'height':844});load(p,T);anchor(p,'B03');occasion(p,'work');style(p,'MODERN');generate(p)
   default={'suitId':'S05','shirtId':'DS036','state':'T017','shoeId':'shoe-8','watchId':None};supply(p,T,[default])
   p.click('[data-page="home"]');p.click('[data-page="outfits"]')
   if T==B:
    wait(p,'HEWRSApp.state().selection!==null&&!HEWRSApp.state().busy');ck('Existing unwanted default-restoration bug reproduced after an empty search',p.evaluate('HEWRSApp.state().selection.suitId')=='S05');p.screenshot(path=str(E/'BEFORE_UNRELATED_DEFAULT.png'))
   else:
    p.wait_for_timeout(200);ck('Empty-search navigation no longer substitutes the default outfit',p.evaluate('HEWRSApp.state().selection===null&&HEWRSApp.state().report.status==="no_qualified_candidate"') and p.locator('#outfit-output').is_hidden());p.screenshot(path=str(E/'AFTER_NO_DEFAULT_SUBSTITUTION.png'))
    p.click('[data-page="home"]');p.click('#view-current');wait(p,'HEWRSApp.state().selection!==null&&!HEWRSApp.state().busy');ck('Explicit View current outfit still restores the saved/default selection',p.evaluate('HEWRSApp.state().selection.suitId')=='S05')
   p.close()
  ck('No uncaught JavaScript errors',not errors,errors)
 except Exception:
  attempt.append(traceback.format_exc());print(traceback.format_exc(),flush=True);checks.append({'name':'Suite completed','passed':False,'error':attempt[-1]})
  try:p.screenshot(path=str(E/'FAILED_ATTEMPT.png'))
  except Exception:pass
 finally:
  (E/'RESULT.json').write_text(json.dumps({'checks':checks,'page_errors':errors,'attempts':attempt,'scope':'Actual rebuilt bundles, offline Chromium, synthetic storage/touch; not live site or physical Safari.'},indent=2));b.close()
if not all(x['passed'] for x in checks):sys.exit(1)
