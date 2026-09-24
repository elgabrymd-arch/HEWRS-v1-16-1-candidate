#!/usr/bin/env python3
"""Exact-source shirt-only integration and V1.9 rendering regressions in Chromium."""
from pathlib import Path
import base64,importlib.util,json,os,time,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];E=Path(os.environ.get('HEWRS_BROWSER_OUTPUT',R/'evidence/shirt_only_v1_10/browser'));E.mkdir(parents=True,exist_ok=True)
checks=[];renders=[];errors=[];start=time.monotonic()
def check(name,ok,detail=None):
 checks.append({'name':name,'pass':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name+' '+str(detail))
def save():
 (E/'BROWSER.json').write_text(json.dumps({'schema':'hewrs.shirt-only-browser.v1_10','passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'checks':checks,'renders':renders,'page_errors':errors,'seconds':round(time.monotonic()-start,2),'scope':'Exact packaged scripts and PNG bytes in memory-loaded Chromium, not hosted navigation, Safari, physical iPhone or persistent-browser restart.'},indent=2)+'\n')
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1);page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  spec=importlib.util.spec_from_file_location('build',R/'tools/build.py');build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
  page.set_content((R/'app.template.html').read_text().replace('<!--STYLE-->','<style>'+(R/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->',''))
  page.evaluate('globalThis.HEWRS_EMBEDDED_IMAGES={}');batch={};n=0
  for f in sorted([*(R/'assets').glob('*.png'),*(R/'assemblies').glob('*.png')]):
   s=base64.b64encode(f.read_bytes()).decode();batch[f.stem]=s;n+=len(s)
   if n>4000000:page.evaluate('(x)=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};n=0
  if batch:page.evaluate('(x)=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
  for file in build.SCRIPTS:page.add_script_tag(content=(R/file).read_text())
  page.wait_for_function('globalThis.HEWRS_READY===true',timeout=20000)
  check('Updated app loads; existing suit and blazer source sets remain intact',page.evaluate("HEWRSApp.version==='HEWRS_CONNECTED_APP_V1_10'&&HEWRSApp.connection.suitSources.ids.length===18&&HEWRSApp.connection.blazerConnection.availableIds.length===12&&HEWRSApp.connection.shirtOnlyConnection.ids.join()==='DS001'"))
  page.evaluate('''()=>{globalThis.pix=c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,996,2748).data;globalThis.visible=()=>pix(document.getElementById('avatar'));globalThis.same=(a,b)=>{if(a.length!==b.length)return false;const x=new Uint32Array(a.buffer,a.byteOffset,a.length/4),y=new Uint32Array(b.buffer,b.byteOffset,b.length/4);return x.every((v,i)=>v===y[i]);};globalThis.SEL={shirtOnly:true,pantId:'PG002',shirtId:'DS001',state:'T017',shoeId:'shoe-8',watchId:null};globalThis.nextAtomic=HEWRSAtomicRenderer;globalThis.HEWRSAtomicRenderer=HEWRSSuitAtomicRendererV16;}''')
  page.add_script_tag(content=(R/'vendor/shirt-only-v1_10/mixed-renderer_v19.js').read_text())
  page.evaluate('''()=>{globalThis.oldConnection=HEWRSJacketedConnectionV19.create(HEWRS_INPUTS);globalThis.oldCanvas=document.createElement('canvas');globalThis.oldRenderer=HEWRSAtomicRenderer.create(oldCanvas,oldConnection,{resolveUrl:HEWRSApp.resolveUrl});globalThis.HEWRSAtomicRenderer=nextAtomic;}''')
  # Oracle uses the already-installed V1.9 receipts, not the new renderer's plan.
  page.evaluate('''()=>{const cache=new Map();async function source(d){if(cache.has(d.sha256))return cache.get(d.sha256);const p=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=HEWRSApp.resolveUrl(d);});cache.set(d.sha256,p);while(cache.size>12)cache.delete(cache.keys().next().value);return p;}
   globalThis.expected=async s=>{const d=oldConnection.blazerConnection.data;const descriptors=[oldConnection.manifest.static.avatar,oldConnection.shoeLayers[s.shoeId],d.pants[s.pantId].layer,d.assembly.ties[s.state],...d.assembly.hands];const images=await Promise.all(descriptors.map(source));const cv=document.createElement('canvas');cv.width=996;cv.height=2748;const ctx=cv.getContext('2d',{willReadFrequently:true});images.forEach(im=>ctx.drawImage(im,0,0));const out=pix(cv);cv.width=cv.height=1;return out;};}''')
  for category,values in [('ties',page.evaluate('HEWRSApp.connection.shirtOnlyConnection.states')),('pants',page.evaluate('HEWRSApp.connection.blazerConnection.pantIds')),('shoes',page.evaluate('Object.keys(HEWRSApp.connection.shoeLayers)'))]:
   rows=page.evaluate('''async ({category,values})=>{const out=[];for(const value of values){const s={...SEL,...(category==='ties'?{state:value}:category==='pants'?{pantId:value}:{shoeId:value})};const before=visible(),events=HEWRSApp.store.snapshot().events.length,p=HEWRSApp.apply(s,{save:false}),held=same(before,visible());await p;out.push({category,value,exact:same(visible(),await expected(s)),held,identity:JSON.stringify(HEWRSApp.state().selection)===JSON.stringify(s),noWear:events===HEWRSApp.store.snapshot().events.length,kind:document.getElementById('avatar').dataset.kind});}return out;}''',{'category':category,'values':values});renders.extend(rows)
   check('Native shirt-only '+category+' selectors match exact-source composition',all(x['exact'] and x['held'] and x['identity'] and x['noWear'] and x['kind']=='shirt-only' for x in rows),len(rows));save()
  controls=[{'suitId':f'S{i:02d}','shirtId':'DS036','state':'T017','shoeId':'shoe-8','watchId':None} for i in range(1,19)]
  controls += [{'suitId':suit,'shirtId':shirt,'state':state,'shoeId':'shoe-8','watchId':None} for suit,shirt,state in [('S05','DS035','REFERENCE'),('S11','DS035','T017'),('S18','DS051','NO_TIE'),('S11','DS041','NO_TIE')]]
  controls += [{'blazerId':f'B{i:02d}','pantId':'PG002','shirtId':'DS001','state':'T022','shoeId':'shoe-8','watchId':None} for i in range(3,15)]
  for s in controls:
   row=page.evaluate('''async s=>{await HEWRSApp.apply(s,{save:false});await oldRenderer.render(s);return {category:'previous_mode',selection:s,exact:same(visible(),pix(oldCanvas))};}''',s);renders.append(row)
  check('All previous suit/blazer rendering controls match unmodified V1.9 renderer',all(x['exact'] for x in renders if x['category']=='previous_mode'),len(controls))
  page.click('#mode-anchor');page.select_option('#topwear-kind','shirt-only');page.select_option('#shirt-select','DS001');page.select_option('#tie-select','T017');page.select_option('#pant-select','PG002');page.select_option('#shoe-select','shoe-8');page.select_option('#watch-select','');page.fill('#local-date','2026-09-23');check('Shirt-only controls expose trousers, not suit or blazer',page.locator('#suit-field').is_hidden() and page.locator('#blazer-field').is_hidden() and page.locator('#pant-field').is_visible() and not page.locator('#apply-selection').is_disabled())
  page.click('#apply-selection');page.wait_for_function("!document.getElementById('selection-dialog').open&&HEWRSApp.state().selection.shirtOnly===true&&document.getElementById('avatar').dataset.loading==='false'")
  check('Anchor displays exact requested no-jacket selection without fake topwear',page.evaluate("JSON.stringify(HEWRSApp.state().selection)===JSON.stringify(SEL)&&HEWRSApp.connection.historyIds(SEL).topwear===null&&!document.getElementById('avatar').dataset.blazerId&&!document.getElementById('avatar').dataset.suitId"))
  page.click('#full-view');page.screenshot(path=str(E/'APP_DS001_SHIRT_ONLY_PHONE.png'));page.click('#detail-view');page.screenshot(path=str(E/'APP_DS001_SHIRT_ONLY_COLLAR.png'));page.click('#full-view')
  check('Viewing new and prior modes never creates wear',page.evaluate('HEWRSApp.store.snapshot().events.length')==0)
  page.click('#mode-engine');check('Engine cannot present shirt-only as a ranked outfit',page.locator('#apply-selection').is_disabled() and 'no shirt-only ensemble ranking' in page.locator('#selection-error').inner_text());page.click('[data-close="selection-dialog"]')
  page.click('#mode-anchor');page.select_option('#shirt-select','DS036');check('Another shirt is not silently replaced by DS001',page.locator('#apply-selection').is_disabled() and page.locator('#shirt-select').input_value()=='DS036');page.select_option('#shirt-select','DS001');page.select_option('#tie-select','NO_TIE');check('Unsupported no-tie does not reuse a tied collar',page.locator('#apply-selection').is_disabled());page.click('[data-close="selection-dialog"]')
  check('Invalid direct requests retain last pixels, identity and history',page.evaluate('''async()=>{const before=visible(),s=JSON.stringify(HEWRSApp.state().selection),h=JSON.stringify(HEWRSApp.store.snapshot());try{await HEWRSApp.apply({...SEL,shirtId:'DS036'},{save:false});return false;}catch(e){return same(before,visible())&&s===JSON.stringify(HEWRSApp.state().selection)&&h===JSON.stringify(HEWRSApp.store.snapshot());}}'''))
  check('Cross-mode race commits only the last selection',page.evaluate('''async()=>{await Promise.all([HEWRSApp.apply({suitId:'S18',shirtId:'DS017',state:'T047',shoeId:'shoe-8',watchId:null},{save:false}),HEWRSApp.apply({...SEL,state:'T022'},{save:false}),HEWRSApp.apply({...SEL,state:'T017'},{save:false})]);return JSON.stringify(HEWRSApp.state().selection)===JSON.stringify(SEL)&&same(visible(),await expected(SEL));}'''))
  check('Cancelled request leaves previous complete frame intact',page.evaluate('''async()=>{const before=visible(),p=HEWRSApp.apply({...SEL,pantId:'PN007',shoeId:'shoe-49'},{save:false});HEWRSApp.cancel();await p;return same(before,visible())&&JSON.stringify(HEWRSApp.state().selection)===JSON.stringify(SEL);}'''))
  page.evaluate('HEWRSApp.apply(SEL,{origin:"manual"})')
  page.click('#record-wear');page.fill('#wear-date','2026-09-23');page.click('#confirm-wear');check('Confirmed wear keeps topwear null and actual physical trousers',page.evaluate("HEWRSApp.store.snapshot().events.length===1&&HEWRSApp.store.snapshot().events[0].items.topwear===null&&HEWRSApp.store.snapshot().events[0].items.pants.id==='pants-PG002'&&HEWRSApp.store.snapshot().events[0].items.shirt.id==='shirt-DS001'"))
  page.click('#data-button')
  with page.expect_download() as dl:page.click('#export-backup')
  dl.value.save_as(str(E/'TEST_BACKUP.json'));before=page.evaluate('JSON.stringify(HEWRSApp.store.snapshot())');page.set_input_files('#backup-file',str(E/'TEST_BACKUP.json'));page.wait_for_function('!document.getElementById("confirm-restore").disabled');check('Import preview makes no state change',before==page.evaluate('JSON.stringify(HEWRSApp.store.snapshot())'));page.click('#confirm-restore');page.wait_for_function('!document.getElementById("backup-dialog").open&&document.getElementById("avatar").dataset.loading==="false"');check('Explicit restoration preserves shirt-only state',page.evaluate('HEWRSApp.state().selection.shirtOnly===true&&HEWRSApp.store.snapshot().events[0].items.topwear===null'))
  page.evaluate('HEWRSApp.showPage("wardrobe")');page.select_option('#wardrobe-category','pants');page.locator('#wardrobe-list .card').filter(has_text='PN007').locator('button').click();page.wait_for_function('HEWRSApp.state().selection.pantId==="PN007"&&document.getElementById("avatar").dataset.loading==="false"');check('Wardrobe trouser choice retains shirt-only identity',page.evaluate('HEWRSApp.state().selection.shirtOnly===true'))
  check('Shirt-only image cache bounded',page.evaluate('HEWRSApp.renderer.stats().shirtOnly.imageCache<=10'))
  layout=[]
  for w,h in [(375,667),(390,844),(430,932)]:
   page.set_viewport_size({'width':w,'height':h});layout.append(page.evaluate('''()=>{const a=document.getElementById('avatar').getBoundingClientRect(),n=document.querySelector('.bottom-nav').getBoundingClientRect();return {width:innerWidth,height:innerHeight,bottom:a.bottom,navTop:n.top,overflow:document.documentElement.scrollWidth>innerWidth};}'''))
  check('Native full-shirt frame fits three phone-size viewports',all(x['bottom']<=x['navTop']+1 and not x['overflow'] for x in layout),layout)
  check('No JavaScript errors',not errors,errors);save()
 except Exception as e:errors.append('TEST_ERROR '+str(e));save();traceback.print_exc();raise
 finally:b.close()
