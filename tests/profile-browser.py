#!/usr/bin/env python3
"""Targeted V1.8 controller-to-render tests. Exact sources/PNGs in memory-only Chromium.
No network delivery, Safari, physical-iPhone or persistent-origin certification.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import importlib.util,base64,json,time,traceback,os
R=Path(__file__).resolve().parents[1];E=Path(os.environ.get('HEWRS_BROWSER_OUTPUT',R/'evidence/profiles_v1_8'));E.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];rows=[];beg=time.monotonic()
def check(name,ok,details=None):
 checks.append({'name':name,'pass':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name+' '+str(details))
def dump():
 (E/'BROWSER.json').write_text(json.dumps({'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'checks':checks,'render_results':rows,'page_errors':errors,'seconds':round(time.monotonic()-beg,2),'transport':'Chromium packaged scripts and unchanged original PNGs supplied in memory. No hosted/device/persistent-origin validation.'},indent=2)+'\n')
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 p=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1);p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  spec=importlib.util.spec_from_file_location('build',R/'tools/build.py');build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
  p.set_content((R/'app.template.html').read_text().replace('<!--STYLE-->','<style>'+(R/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->',''))
  p.evaluate('globalThis.HEWRS_EMBEDDED_IMAGES={}');batch={};n=0
  for f in sorted([*(R/'assets').glob('*.png'),*(R/'assemblies').glob('*.png')]):
   v=base64.b64encode(f.read_bytes()).decode();batch[f.stem]=v;n+=len(v)
   if n>4_000_000:p.evaluate('(x)=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};n=0
  if batch:p.evaluate('(x)=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
  for f in build.SCRIPTS:p.add_script_tag(content=(R/f).read_text())
  p.wait_for_function('() => (globalThis.HEWRS_READY===true)');check('Packaged V1.8 starts with 15 restored bindings and nine nulls',p.evaluate("HEWRSApp.version==='HEWRS_CONNECTED_APP_V1_8'&&HEWRSApp.connection.trouserProfiles.boundIds.length===15&&HEWRSApp.connection.trouserProfiles.unboundIds.length===9"))
  p.evaluate('''()=>{
    globalThis.savedDefs={controller:HEWRSConnectedPath,connection:HEWRSCleanConnection,suit:HEWRSSuitConnectionV16};
    globalThis.pix=c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,996,2748).data;
    globalThis.eq=(a,b)=>{if(a.length!==b.length)return false;const aa=new Uint32Array(a.buffer,a.byteOffset,a.length/4),bb=new Uint32Array(b.buffer,b.byteOffset,b.length/4);return aa.every((v,i)=>v===bb[i]);};
    globalThis.visible=()=>pix(document.getElementById('avatar'));
    globalThis.CFG={blazerId:'B03',pantId:'PG002',shirt:'DS001',tie:'T017',shoeId:'shoe-8',watchId:null,localDate:'2026-09-23',occasion:'clinic',style:'AUTO'};
    globalThis.S={blazerId:'B03',pantId:'PG002',shirtId:'DS001',state:'T017',shoeId:'shoe-8',watchId:null};
  }''')
  for f in ['controller_v17.js','connection_v17.js','blazer_connection_v17.js']:p.add_script_tag(content=(R/'vendor/profiles-v1_8'/f).read_text())
  p.evaluate('''()=>{globalThis.refConnection=HEWRSCleanConnection.create(HEWRS_INPUTS);globalThis.refCanvas=document.createElement('canvas');globalThis.refRenderer=HEWRSAtomicRenderer.create(refCanvas,refConnection,{resolveUrl:HEWRSApp.resolveUrl});globalThis.HEWRSConnectedPath=savedDefs.controller;globalThis.HEWRSCleanConnection=savedDefs.connection;globalThis.HEWRSSuitConnectionV16=savedDefs.suit;}''')
  # One real Engine request per restored physical binding, compared with unchanged V1.7 renderer.
  ids=p.evaluate('HEWRSApp.connection.trouserProfiles.boundIds')
  for id in ids:
   row=p.evaluate('''async pantId=>{const a=HEWRSApp,before=visible(),old=JSON.stringify(a.state().selection),events=a.store.snapshot().events.length;const pending=a.generate({...CFG,pantId});const held=eq(before,visible())&&JSON.stringify(a.state().selection)===old;const r=await pending,s=a.state().selection;await refRenderer.render(s);return {kind:'exact_engine',pantId,status:r.status,selected:s,held,referencePixelsEqual:eq(visible(),pix(refCanvas)),historyUnchanged:a.store.snapshot().events.length===events,requestedIdentity:s.blazerId==='B03'&&s.pantId===pantId&&s.shirtId==='DS001'&&s.state==='T017',numeric:typeof r.options[0]?._hewrsConnected.compatibility.score==='number'};}''',id);rows.append(row)
  check('15 exact Engine outputs preserve physical IDs and match V1.7 pixels',all(x['held'] and x['referencePixelsEqual'] and x['historyUnchanged'] and x['requestedIdentity'] and x['numeric'] for x in rows),15)
  check('Free tie search excludes unsupported NO_TIE before ranking',p.evaluate('''async()=>{const r=await HEWRSApp.generate({...CFG,tie:'ANY'});return r.options.length>0&&r.diagnostics.examined===47&&r.diagnostics.configuration_counts.independent_no_tie===0&&r.options.every(o=>o.items.tie&&HEWRSApp.connection.selectionFromOption(o,HEWRSApp.state().request).selection.state!=='NO_TIE');}'''))
  # Select one real generated alternative through the Outfits control.
  p.click('[data-page="outfits"]');check('Outfits shows scored selectable alternatives',p.locator('#results .card').count()>0)
  p.locator('#results .card button').nth(1).click();p.wait_for_function("() => (document.getElementById('avatar').dataset.loading==='false')")
  check('Selected alternative carries the matching exact source image',p.evaluate('''async()=>{const s=HEWRSApp.state().selection;await refRenderer.render(s);return eq(visible(),pix(refCanvas))&&s.pantId==='PG002'&&s.shirtId==='DS001';}'''))
  rows.append({'kind':'outfits_selection','referencePixelsEqual':True})
  check('Tie-family Engine candidates satisfy the selected family',p.evaluate('''async()=>{const r=await HEWRSApp.generate({...CFG,tie:'FAMILY:navy'});return r.options.length>0&&r.options.every(o=>o.items.tie.colorFamily==='navy'&&o.items.pants.id==='pants-PG002');}'''))
  # Null-profile generation must retain the complete previous display; Anchor remains usable.
  unresolved=[]
  for id in p.evaluate('HEWRSApp.connection.trouserProfiles.unboundIds'):
   row=p.evaluate('''async pantId=>{const before=visible(),ids=JSON.stringify(HEWRSApp.state().selection),r=await HEWRSApp.generate({...CFG,pantId});const retained=eq(before,visible())&&ids===JSON.stringify(HEWRSApp.state().selection);await HEWRSApp.apply({...S,pantId},{save:false});await refRenderer.render({...S,pantId});return {kind:'unbound_anchor',pantId,status:r.status,noOptions:r.options.length===0,retained,referencePixelsEqual:eq(visible(),pix(refCanvas))};}''',id);unresolved.append(row);rows.append(row)
  check('Nine unscored trousers retain manual exact images without invented scores',all(x['status']=='mapping_required' and x['noOptions'] and x['retained'] and x['referencePixelsEqual'] for x in unresolved),9)
  p.evaluate("HEWRSApp.showPage('home')");p.click('#mode-engine');p.select_option('#topwear-kind','blazer');p.select_option('#blazer-select','B03');p.select_option('#shirt-select','DS001');p.select_option('#tie-select','T017');p.select_option('#pant-select','PG002');p.select_option('#shoe-select','shoe-8');p.select_option('#watch-select','');p.fill('#local-date','2026-09-23')
  check('Engine controls report the recovered Medium Grey profile',p.locator('#selection-error').inner_text().startswith('Uses the existing Medium Grey scoring profile'))
  p.select_option('#pant-select','PN007');check('Unmapped trouser selection explicitly reports missing profile',p.locator('#selection-error').inner_text().startswith('No existing scoring profile'))
  p.select_option('#pant-select','PG002');p.click('#apply-selection');p.wait_for_function("() => (HEWRSApp.state().origin==='engine'&&HEWRSApp.state().selection?.pantId==='PG002'&&document.getElementById('avatar').dataset.loading==='false')")
  check('Native Engine controls display the requested B03/PG002/DS001/T017 outfit',p.evaluate("HEWRSApp.state().selection.blazerId==='B03'&&HEWRSApp.state().selection.state==='T017'&&HEWRSApp.state().selection.shirtId==='DS001'"))
  p.click('#full-view');p.screenshot(path=str(E/'APP_B03_PG002_ENGINE_PHONE.png'))
  check('Generation and viewing do not fabricate wear',p.evaluate('HEWRSApp.store.snapshot().events.length')==0)
  p.click('#record-wear');p.fill('#wear-date','2026-09-23');p.click('#confirm-wear')
  check('Explicit wear stores physical trouser and blazer IDs, not P01',p.evaluate("HEWRSApp.store.snapshot().events.length===1&&HEWRSApp.store.snapshot().events[0].items.pants.id==='pants-PG002'&&HEWRSApp.store.snapshot().events[0].items.topwear.id==='blazer-2'"))
  # Real download/import handlers. Origin remains memory only; no persistence claim.
  p.click('#data-button')
  with p.expect_download() as dl:p.click('#export-backup')
  dl.value.save_as(str(E/'TEST_BACKUP.json'))
  before=p.evaluate('JSON.stringify(HEWRSApp.store.snapshot())');p.set_input_files('#backup-file',str(E/'TEST_BACKUP.json'));p.wait_for_function("() => (!document.getElementById('confirm-restore').disabled)")
  check('Backup import preview is read-only',p.evaluate('JSON.stringify(HEWRSApp.store.snapshot())')==before)
  p.click('#confirm-restore');p.wait_for_function("() => (!document.getElementById('backup-dialog').open&&document.getElementById('avatar').dataset.loading==='false')")
  check('Explicit backup restoration keeps exact confirmed wear',p.evaluate("HEWRSApp.store.snapshot().events.length===1&&HEWRSApp.store.snapshot().events[0].items.pants.id==='pants-PG002'"))
  check('Forged numeric evidence cannot replace displayed outfit',p.evaluate('''()=>{const c=HEWRSApp.connection,q=c.makeRequest(CFG),pixels=visible(),ids=JSON.stringify(HEWRSApp.state().selection);q.pantBindings[0].evidence.source_sha256='forged';const r=c.controller.generate(q,c.catalogue,[]);return r.status==='request_blocked'&&eq(pixels,visible())&&ids===JSON.stringify(HEWRSApp.state().selection);}'''))
  check('Rapid competing Engine requests commit the latest physical trouser',p.evaluate('''async()=>{await Promise.all([HEWRSApp.generate({...CFG,pantId:'PT001',tie:'ANY'}),HEWRSApp.generate({...CFG,pantId:'PB001',tie:'T022'}),HEWRSApp.generate({...CFG,pantId:'PG002',tie:'T017'})]);return HEWRSApp.state().selection.pantId==='PG002'&&HEWRSApp.state().selection.state==='T017';}'''))
  check('Cancellation retains the last complete image and identity',p.evaluate('''async()=>{const pixels=visible(),s=JSON.stringify(HEWRSApp.state().selection),pending=HEWRSApp.generate({...CFG,pantId:'PT001',tie:'ANY'});HEWRSApp.cancel();await pending;return eq(pixels,visible())&&s===JSON.stringify(HEWRSApp.state().selection);}'''))
  controls=[{'suitId':sid,'shirtId':sh,'state':st,'shoeId':'shoe-8','watchId':None} for sid,sh,st in [('S05','DS035','T017'),('S05','DS035','REFERENCE'),('S05','DS051','NO_TIE'),('S11','DS035','T017'),('S18','DS036','T022'),('S01','DS017','NO_TIE')]]
  suite=[]
  for s in controls:
   row=p.evaluate('''async s=>{await HEWRSApp.apply(s,{save:false});await refRenderer.render(s);return {kind:'suit_regression',selection:s,referencePixelsEqual:eq(visible(),pix(refCanvas))};}''',s);rows.append(row);suite.append(row)
  check('Six suit controls remain pixel-identical to V1.7',all(x['referencePixelsEqual'] for x in suite),6)
  check('Only the explicit wear confirmation added a record',p.evaluate('HEWRSApp.store.snapshot().events.length')==1)
  check('No page errors',not errors,errors);dump()
 except Exception as e:
  errors.append('TEST_EXCEPTION '+str(e));dump();traceback.print_exc();raise
 finally:b.close()
