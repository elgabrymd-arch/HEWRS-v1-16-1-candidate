#!/usr/bin/env python3
"""V1.14 exact-script, actual-image Chromium tests; memory loader, NOT hosting.
HEWRS_BASELINE_V113 must identify a separate unmodified V1.13 source tree.
No actual user data is accessed. The storage map is a synthetic test backend.
"""
import os,json,time,traceback,base64,hashlib,io
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1]
BASE=Path(os.environ['HEWRS_BASELINE_V113'])
E=Path(os.environ.get('HEWRS_V114_BROWSER',str(R/'evidence/source_routes_v1_14/browser')))
E.mkdir(parents=True,exist_ok=True)
checks=[];regressions=[];errors=[];start=time.monotonic()
def save():
 (E/'RESULT.json').write_text(json.dumps({'schema':'hewrs.non-suit-sources.chromium.v1_14', 'scope':'Actual packaged scripts and image bytes in Chromium through the in-memory loader. Synthetic Map storage only: not hosted, Safari/iPhone or restart persistence certification.', 'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'regressions':regressions,'errors':errors,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+': '+str(detail))
def S(suit='S05',shirt='DS036',state='T017'):
 return dict(suitId=suit,shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def B(blazer='B03',shirt='DS001',state='NO_TIE'):
 return dict(blazerId=blazer,pantId='PG002',shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def O(shirt='DS014',state='NO_TIE'):
 return dict(shirtOnly=True,pantId='PG002',shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hashes.items():
  if sha in present:continue
  b64=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=b64;size+=len(b64)
  if size>2_000_000:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
def ensure(p,root,selections):h.R=root;h.ensure(p,selections)
def load(p,root):h.R=root;h.load(p,storage={'production_sentinel':'UNCHANGED'})
def rgba_sha(p):
 raw=base64.b64decode(p.evaluate("document.getElementById('avatar').toDataURL('image/png')").split(',')[1])
 return hashlib.sha256(Image.open(io.BytesIO(raw)).convert('RGBA').tobytes()).hexdigest()
def prefs(p,s):p.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.showPage("home");HEWRSApp.setMode("anchor");}',s)
def disabled(p):return p.locator('[data-item-id][disabled]').count()
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=browser.new_page(viewport={'width':390,'height':844},accept_downloads=True)
 p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R)
  ck('Current source-routing application loads with the original controller',p.evaluate('HEWRS_READY===true&&HEWRSApp.connection.implementationVersion==="1.14-source-routing"'))
  baseline=browser.new_page(viewport={'width':390,'height':844});load(baseline,BASE)
  controls=[S('S'+str(i).zfill(2),shirt,state) for i in range(1,19) for shirt,state in [('DS035','NO_TIE'),('DS035','T017'),('DS051','T017')]]
  controls += [B('B'+str(i).zfill(2),'DS014'if i%2 else'DS001',state) for i in range(1,15) for state in ['T017','NO_TIE']]
  controls += [O(shirt,state) for shirt in ['DS001','DS014'] for state in ['T017','NO_TIE']]+[S()]
  for i,s in enumerate(controls):
   ensure(p,R,[s]);ensure(baseline,BASE,[s])
   p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);baseline.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
   a,b=rgba_sha(p),rgba_sha(baseline);regressions.append({'selection':s,'v114_rgba_sha256':a,'v113_rgba_sha256':b,'equal':a==b})
   if a!=b:raise AssertionError('Changed existing pixels '+str(s))
   if(i+1)%10==0:print('REGRESSION',i+1,flush=True);save()
  baseline.close()
  ck('87 actual existing outfit frames are pixel-identical to V1.13',len(regressions)==87 and all(x['equal']for x in regressions))
  prefs(p,S());p.click('#pref-shirt');ck('Suit picker keeps all 50 shirt IDs enabled',p.locator('[data-item-id]').count()==50 and disabled(p)==0);p.keyboard.press('Escape')
  prefs(p,B(shirt='DS014'));before=p.evaluate('HEWRSApp.ui.snapshot()');p.click('#pref-shirt')
  ck('Blazer picker shows all 50 identities and disables only 48 unbound routes',p.locator('[data-item-id]').count()==50 and disabled(p)==48)
  p.screenshot(path=str(E/'BLAZER_SOURCE_AWARE_PICKER_390x844.png'))
  p.locator('[data-item-id="DS001"]').click();p.keyboard.press('Escape')
  ck('Real picker Cancel preserves all preferences',p.evaluate('HEWRSApp.ui.snapshot()')==before)
  p.click('#pref-shirt');p.locator('[data-item-id="DS001"]').click();p.click('#picker-apply');after=p.evaluate('HEWRSApp.ui.snapshot()')
  ck('Real picker Apply changes only the selected shirt',after['shirt']['id']=='DS001' and all(after[k]==before[k]for k in before if k!='shirt'))
  prefs(p,O());p.click('#pref-shirt');ck('Shirt-only picker uses the same exact source boundary',p.locator('[data-item-id]').count()==50 and disabled(p)==48);p.keyboard.press('Escape')
  prefs(p,S(shirt='DS040',state='NO_TIE'));before=p.evaluate('HEWRSApp.ui.snapshot()');p.click('#pref-tie')
  ck('Four-shirt No Tie rule disables actual tie buttons without disabling No Tie',p.locator('[data-item-id]').count()==48 and disabled(p)==47 and p.locator('[data-item-id="NO_TIE"]').is_enabled())
  p.keyboard.press('Escape');ck('Inspecting incompatible tie choices does not edit preferences',p.evaluate('HEWRSApp.ui.snapshot()')==before)
  prefs(p,S());p.click('#pref-tie');ck('Tie-capable shirts retain all 47 selectable ties',p.locator('[data-item-id]').count()==48 and disabled(p)==0);p.keyboard.press('Escape')
  ensure(p,R,[O()]);p.evaluate('s=>HEWRSApp.apply(s,{save:false})',O());a=rgba_sha(p);ledger=p.evaluate('HEWRSApp.store.exportText()')
  rejected=p.evaluate('''async s=>{try{await HEWRSApp.apply(s,{save:false});return{rejected:false}}catch(e){return{rejected:true,code:e.code,detail:e.details}}}''',B(shirt='DS036'))
  ck('Unsupported route returns the exact source error and preserves the complete frame',rejected.get('code')=='NON_SUIT_SOURCE_COVERAGE_UNBOUND' and a==rgba_sha(p),rejected)
  ck('Rejected route does not alter the test ledger',ledger==p.evaluate('HEWRSApp.store.exportText()'))
  p.evaluate('HEWRSApp.showPage("outfits")');p.click('#record-wear');p.click('#confirm-wear')
  event=p.evaluate('HEWRSApp.store.snapshot().events.at(-1)')
  ck('Actual confirmation records exact DS014 and an intentional null tie',event['items']['shirt']=={'id':'shirt-DS014'} and event['items']['tie']is None and event['canonical_selection']==O())
  p.screenshot(path=str(E/'EXISTING_DS014_SHIRT_ONLY_390x844.png'))
  p.evaluate('HEWRSApp.showPage("home")')
  fits=p.evaluate('({viewport:innerHeight,scroll:document.documentElement.scrollHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth})')
  ck('Original Home fits the 390x844 test viewport',fits['scroll']<=fits['viewport'] and fits['scrollWidth']<=fits['width'],fits)
  p.screenshot(path=str(E/'HOME_PRESERVED_390x844.png'))
  ck('Synthetic sentinel remains unchanged',p.evaluate('__STORAGE_MAP.get("production_sentinel")')=='UNCHANGED')
  ck('No uncaught application browser errors',not errors,errors)
 except Exception:
  checks.append({'name':'Browser test completion','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except Exception:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):raise SystemExit(1)
