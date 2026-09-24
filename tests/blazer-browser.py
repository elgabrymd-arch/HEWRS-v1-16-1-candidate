#!/usr/bin/env python3
"""Run delivered code in memory-only Chromium; no hosting/device/persistent-origin claim."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import importlib.util,base64,json,time,traceback
R=Path(__file__).resolve().parents[1];E=R/'evidence/blazer_v1_7';checks=[];errors=[];rows=[];beg=time.monotonic()
def check(name,ok,details=None):
 checks.append({'name':name,'pass':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name+' '+str(details))
def dump():
 (E/'BROWSER.json').write_text(json.dumps({'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'checks':checks,'render_results':rows,'page_errors':errors,'seconds':round(time.monotonic()-beg,2),'transport':'Chromium exact packaged scripts and original PNGs provided in memory'},indent=2))
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);p=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1);p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  spec=importlib.util.spec_from_file_location('build',R/'tools/build.py');build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
  p.set_content((R/'app.template.html').read_text().replace('<!--STYLE-->','<style>'+(R/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->',''));p.evaluate('globalThis.HEWRS_EMBEDDED_IMAGES={}');batch={};n=0
  for f in sorted([*(R/'assets').glob('*.png'),*(R/'assemblies').glob('*.png')]):
   v=base64.b64encode(f.read_bytes()).decode();batch[f.stem]=v;n+=len(v)
   if n>4_000_000:p.evaluate('(x)=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x)}',batch);batch={};n=0
  if batch:p.evaluate('(x)=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x)}',batch)
  for f in build.SCRIPTS:p.add_script_tag(content=(R/f).read_text())
  p.wait_for_function('globalThis.HEWRS_READY===true');check('Packaged V1.7 starts',p.evaluate("HEWRSApp.version==='HEWRS_CONNECTED_APP_V1_7'"))
  p.evaluate('''()=>{
   globalThis.pix=c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,996,2748).data;
   globalThis.eq=(a,b)=>{if(a.length!==b.length)return false;const aa=new Uint32Array(a.buffer,a.byteOffset,a.length/4),bb=new Uint32Array(b.buffer,b.byteOffset,b.length/4);return aa.every((v,i)=>v===bb[i]);};
   globalThis.image=async d=>{const im=new Image();await new Promise((r,j)=>{im.onload=r;im.onerror=j;im.src=HEWRSApp.resolveUrl(d)});const c=document.createElement('canvas');c.width=996;c.height=2748;c.getContext('2d').drawImage(im,0,0);const a=pix(c);c.width=c.height=1;return a;};
   globalThis.S={blazerId:'B03',pantId:'PG002',shirtId:'DS001',state:'T001',shoeId:'shoe-8',watchId:null};
   globalThis.run=async s=>{const app=HEWRSApp,old=pix(document.getElementById('avatar')),oldS=JSON.stringify(app.state().selection),pending=app.apply(s,{save:false});const held=eq(old,pix(document.getElementById('avatar')))&&oldS===JSON.stringify(app.state().selection);const r=await pending;return {selection:s,held,ready:r.status==='ready',identity:JSON.stringify(s)===JSON.stringify(app.state().selection)};};
  }''')
  p.evaluate('''async()=>{await HEWRSApp.apply(S,{save:false});globalThis.control=pix(document.getElementById('avatar')).slice();globalThis.mask=await image(HEWRSApp.connection.blazerConnection.data.assembly.tie_mask);}''')
  ties=p.evaluate('Object.keys(HEWRSApp.connection.blazerConnection.data.assembly.ties)');tieRows=[]
  for i in range(0,len(ties),6):
   got=p.evaluate('''async ids=>{const out=[];for(const state of ids){const r=await run({...S,state}),after=pix(document.getElementById('avatar'));let outside=0;for(let i=0;i<after.length;i+=4)if(mask[i]===0&&(after[i]!==control[i]||after[i+1]!==control[i+1]||after[i+2]!==control[i+2]||after[i+3]!==control[i+3]))outside++;r.outsideTie=outside;out.push(r);}return out;}''',ties[i:i+6]);rows+=got;tieRows+=got
  check('47 tie switches confined to original visible-tie mask',all(x['ready'] and x['identity'] and x['held'] and x['outsideTie']==0 for x in tieRows),len(tieRows))
  check('Current canonical head preserved, not checkpoint head',p.evaluate('''async()=>{const a=await image(HEWRSApp.connection.manifest.static.avatar),f=pix(document.getElementById('avatar'));for(let i=0;i<996*350*4;i++)if(a[i]!==f[i])return false;return true;}'''))
  pants=p.evaluate('HEWRSApp.connection.blazerConnection.pantIds');pantRows=[]
  for pantId in pants:
   got=p.evaluate('''async pantId=>{const r=await run({...S,pantId}),pants=await image(HEWRSApp.connection.blazerConnection.knownPant(pantId).layer),out=pix(document.getElementById('avatar'));let wrong=0,count=0;for(let y=1600;y<2450;y++)for(let x=0;x<996;x++){const i=(y*996+x)*4;if(pants[i+3]===255){count++;if(out[i]!==pants[i]||out[i+1]!==pants[i+1]||out[i+2]!==pants[i+2]||out[i+3]!==255)wrong++;}}r.pantPixels=count;r.wrongPantPixels=wrong;return r;}''',pantId);pantRows.append(got);rows.append(got)
  check('24 exact trousers use original approved color pixels',all(x['ready'] and x['identity'] and x['held'] and x['wrongPantPixels']==0 and x['pantPixels']>0 for x in pantRows),len(pantRows))
  check('Same-color trousers keep different physical identities',p.evaluate('''async()=>{await HEWRSApp.apply({...S,pantId:'PT001'},{save:false});const a=pix(document.getElementById('avatar')),id1=HEWRSApp.connection.historyIds(HEWRSApp.state().selection).pants;await HEWRSApp.apply({...S,pantId:'PT002'},{save:false});return eq(a,pix(document.getElementById('avatar')))&&id1==='pants-PT001'&&HEWRSApp.connection.historyIds(HEWRSApp.state().selection).pants==='pants-PT002';}'''))
  shoes=p.evaluate('Object.keys(HEWRSApp.connection.shoeLayers)');shoeRows=[]
  for i in range(0,len(shoes),5):
   got=p.evaluate('async ids=>{const out=[];for(const shoeId of ids)out.push(await run({...S,shoeId}));return out;}',shoes[i:i+5]);rows+=got;shoeRows+=got
  check('35 registered footwear selections execute',all(x['ready'] and x['identity'] and x['held'] for x in shoeRows),len(shoeRows))
  p.evaluate('''()=>{globalThis.oldcanvas=document.createElement('canvas');globalThis.oldconnection=HEWRSSuitConnectionV16.create(HEWRS_INPUTS);globalThis.oldrenderer=HEWRSSuitAtomicRendererV16.create(oldcanvas,oldconnection,{resolveUrl:HEWRSApp.resolveUrl});}''')
  sequence=[{'suitId':f'S{i:02d}','shirtId':'DS036','state':'T017','shoeId':'shoe-8','watchId':None} for i in range(1,19)]+[{'suitId':'S05','shirtId':sh,'state':st,'shoeId':'shoe-8','watchId':None} for sh,st in [('DS035','T017'),('DS035','NO_TIE'),('DS035','REFERENCE'),('DS051','T047'),('DS051','NO_TIE'),('DS042','NO_TIE')]];oldrows=[]
  for s in sequence:
   got=p.evaluate('''async s=>{const r=await run(s);await oldrenderer.render(s);r.originalEqual=eq(pix(oldcanvas),pix(document.getElementById('avatar')));return r;}''',s);oldrows.append(got);rows.append(got)
  check('24 suit regression outputs pixel-identical to V1.6',all(x['originalEqual'] and x['held'] and x['identity'] for x in oldrows),len(oldrows))
  check('Unsupported sources retain complete previous frame and identity',p.evaluate('''async()=>{const before=pix(document.getElementById('avatar')),ids=JSON.stringify(HEWRSApp.state().selection);for(const extra of [{blazerId:'B01'},{blazerId:'B02'},{blazerId:'B04'},{shirtId:'DS035'},{state:'NO_TIE'},{pantId:'PW001'}]){try{await HEWRSApp.apply({...S,...extra},{save:false});return false;}catch{if(!eq(before,pix(document.getElementById('avatar')))||JSON.stringify(HEWRSApp.state().selection)!==ids)return false;}}return true;}'''))
  check('Rapid cross-mode switches commit last request only',p.evaluate('''async()=>{const reqs=[{suitId:'S05',shirtId:'DS017',state:'T022',shoeId:'shoe-6',watchId:null},{...S,pantId:'PN007',state:'T047'},{suitId:'S18',shirtId:'DS036',state:'NO_TIE',shoeId:'shoe-8',watchId:null},{...S,pantId:'PB003',state:'T017'}];await Promise.all(reqs.map(s=>HEWRSApp.apply(s,{save:false})));return JSON.stringify(HEWRSApp.state().selection)===JSON.stringify(reqs.at(-1))&&document.getElementById('avatar').dataset.blazerId==='B03'&&!document.getElementById('avatar').dataset.suitId;}'''))
  p.click('#mode-anchor');p.select_option('#topwear-kind','blazer');p.select_option('#blazer-select','B03');p.select_option('#shirt-select','DS001');p.select_option('#tie-select','T017');p.select_option('#pant-select','PN007');check('Native trouser selector exposes 24 physical IDs',p.locator('#pant-select option').count()==24)
  p.click('#apply-selection');p.wait_for_function("HEWRSApp.state().selection?.pantId==='PN007'");check('Native Anchor applies exact blazer/trouser tuple',p.evaluate("HEWRSApp.state().selection.blazerId==='B03'&&HEWRSApp.state().selection.shirtId==='DS001'"))
  p.click('#full-view');p.screenshot(path=str(E/'APP_B03_PN007_T017_PHONE.png'));p.click('#detail-view');p.screenshot(path=str(E/'APP_B03_PN007_T017_COLLAR.png'));p.click('#full-view')
  count=p.evaluate('HEWRSApp.store.snapshot().events.length');p.click('#record-wear');p.fill('#wear-date','2026-09-22');p.click('#confirm-wear')
  check('Wear confirmation stores physical pants and blazer identities',p.evaluate(f"HEWRSApp.store.snapshot().events.length==={count+1}&&HEWRSApp.store.snapshot().events.at(-1).items.pants.id==='pants-PN007'&&HEWRSApp.store.snapshot().events.at(-1).items.topwear.id==='blazer-2'"))
  check('Backup preview/restore retains blazer tuple',p.evaluate('''()=>{const s=HEWRSApp.store,b=s.exportText(),before=JSON.stringify(s.snapshot()),preview=s.previewImport(b);if(JSON.stringify(s.snapshot())!==before)return false;s.restore(preview);return s.snapshot().events.at(-1).items.pants.id==='pants-PN007';}'''))
  report=p.evaluate("async()=>await HEWRSApp.generate({blazerId:'B03',pantId:'PG002',shirt:'DS001',tie:'T017',shoeId:'shoe-8',watchId:null,localDate:'2026-09-22'})")
  check('Engine sends exact IDs; missing numeric mapping remains explicit',report['status']=='mapping_required' and not report['options'] and report['diagnostics']['mapping_holds'][0]['app_id']=='pants-PG002')
  check('Generation does not log synthetic wear',p.evaluate('HEWRSApp.store.snapshot().events.length')==count+1)
  check('No page errors',not errors,errors);dump()
 except Exception as e:errors.append('TEST_EXCEPTION '+str(e));dump();traceback.print_exc();raise
 finally:b.close()
