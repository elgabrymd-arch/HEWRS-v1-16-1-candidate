#!/usr/bin/env python3
"""Execute actual V1.6 Engine/Anchor/display paths with unchanged image bytes.
All newly connected suit/shirt IDs execute; selected tie sets are tested in full
on S11 for DS017/DS051 and corrected DS035. This is not a 39,817-state render run.
"""
from pathlib import Path
import base64,hashlib,importlib.util,json,shutil,time,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];E=R/'evidence/all_suits_v1_6';E.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('build',R/'tools/build.py');build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
checks=[];rows=[];oldrows=[];errors=[];requests=[];failure=None;t0=time.monotonic()
def check(name,ok,detail=None):
 checks.append({'name':name,'pass':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name+': '+str(detail))
def wait(p,expr,seconds=90):
 end=time.monotonic()+seconds
 while time.monotonic()<end:
  if p.evaluate('()=>Boolean('+expr+')'):return
  time.sleep(.04)
 raise TimeoutError(expr)
def save_canvas(p,expr,name):
 raw=p.evaluate('()=>'+expr+".toDataURL('image/png').split(',')[1]")
 (E/name).write_bytes(base64.b64decode(raw))
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 p=b.new_page(viewport={'width':390,'height':844},device_scale_factor=3)
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
 try:
  html=(R/'app.template.html').read_text().replace('<!--STYLE-->','<style>'+(R/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->','')
  p.set_content(html,wait_until='load');p.evaluate('globalThis.HEWRS_EMBEDDED_IMAGES={}');batch={};n=0
  for f in sorted([*(R/'assets').glob('*.png'),*(R/'assemblies').glob('*.png')]):
   v=base64.b64encode(f.read_bytes()).decode();batch[f.stem]=v;n+=len(v)
   if n>4_000_000:p.evaluate('(v)=>Object.assign(HEWRS_EMBEDDED_IMAGES,v)&&true',batch);batch={};n=0
  if batch:p.evaluate('(v)=>Object.assign(HEWRS_EMBEDDED_IMAGES,v)&&true',batch)
  for f in build.SCRIPTS:p.add_script_tag(content=(R/f).read_text())
  wait(p,'globalThis.HEWRS_READY===true')
  check('V1.6 exact packaged code starts',p.evaluate("HEWRSApp.version==='HEWRS_CONNECTED_APP_V1_6'"))
  p.add_script_tag(content=(E/'baseline/src/suit-assemblies.js').read_text().replace('root.HEWRSSuitAssemblies=', 'root.HEWRSBaselineSuitAssemblies='))
  p.evaluate('''()=>{
   globalThis.W=996;globalThis.H=2748;
   globalThis.pix=c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;
   globalThis.same=(a,b)=>{const aa=new Uint32Array(a.buffer,a.byteOffset,a.length/4),bb=new Uint32Array(b.buffer,b.byteOffset,b.length/4);return aa.length===bb.length&&aa.every((v,i)=>v===bb[i]);};
   globalThis.oldAssemblies=HEWRSBaselineSuitAssemblies.create(HEWRSApp.connection.suitSources,HEWRS_INPUTS.manifest,HEWRS_INPUTS.shoeLayers);
   globalThis.refcanvas=null;globalThis.refRenderer=null;globalThis.refkey=null;
   globalThis.audit=async(s)=>{
    const app=HEWRSApp,source=app.connection.suitSources.resolveCanonical(s.suitId),wasSupported=oldAssemblies.supported(s.suitId,s.shirtId,s.state),key=s.suitId+'/'+s.shirtId+'/'+s.shoeId;
    if(refkey!==key){
     if(refRenderer)refRenderer.cancel();if(refcanvas)refcanvas.width=refcanvas.height=1;
     refcanvas=document.createElement('canvas');let m;
     if(wasSupported)m=oldAssemblies.forSelection(s.suitId,s.shoeId,s.shirtId);
     else{
      // Independent assembly from pinned source descriptors. No new RGB, mask or fit.
      m=structuredClone(HEWRS_INPUTS.manifest);m.static.jacket={...structuredClone(source.jacket),display_alpha_mask:structuredClone(HEWRS_INPUTS.manifest.static.jacket.display_alpha_mask)};
      m.static.trousers=structuredClone(source.trousers);
      if(s.shoeId!=='shoe-8')m.static.shoe=structuredClone(HEWRS_INPUTS.shoeLayers[s.shoeId]);
     }
     refRenderer=HEWRSDS035EdgeRenderer.create(refcanvas,m,app.resolveUrl);refkey=key;
    }
    await refRenderer.render({suitId:'S05',shirtId:s.shirtId,state:s.state});
    const old=app.state().selection,before=pix(document.getElementById('avatar')),pending=app.apply(s,{save:false});
    const held=same(before,pix(document.getElementById('avatar'))),labelHeld=JSON.stringify(app.state().selection)===JSON.stringify(old);
    const r=await pending,after=pix(document.getElementById('avatar')),expected=pix(refcanvas);
    const identity=JSON.stringify(s)===JSON.stringify(app.state().selection)&&document.getElementById('avatar').dataset.suitId===s.suitId&&document.getElementById('avatar').dataset.shirtId===s.shirtId&&document.getElementById('avatar').dataset.state===s.state;
    const words=new Uint32Array(after.buffer);let nonempty=false;for(let i=0;i<words.length;i+=97)if(after[i*4+3]){nonempty=true;break;}
    return {...s,wasSupported,identical:same(after,expected),held,labelHeld,identity,nonempty,ready:r.status==='ready'};
   };
  }''')
  # Every newly connected shirt ID under every newly connected suit.
  m=p.evaluate('HEWRS_INPUTS.manifest');wide=p.evaluate('HEWRSApp.connection.assemblies.widerTemplateSuitIds')
  modes=lambda shirt:['NO_TIE']+([] if m['shirts'][shirt].get('mode_policy')=='NO_TIE_ONLY' else list(m['ties']))
  sequence=[];seen=set()
  def add(suit,shirt,state):
   k=(suit,shirt,state)
   if k not in seen:sequence.append({'suitId':suit,'shirtId':shirt,'state':state,'shoeId':'shoe-8','watchId':None});seen.add(k)
  for suit in wide:
   for shirt in m['shirt_order']:add(suit,shirt,'NO_TIE' if m['shirts'][shirt].get('mode_policy')=='NO_TIE_ONLY' else 'T017')
  for shirt in m['shirt_order']:add('S11',shirt,'NO_TIE')
  for shirt in ['DS017','DS051','DS035']:
   for state in modes(shirt):add('S11',shirt,state)
  # Group by suit/shirt to exercise tie switching while respecting the original bounded caches.
  sequence.sort(key=lambda s:(s['suitId'],s['shirtId'],s['state']))
  for i in range(0,len(sequence),8):
   got=p.evaluate('async seq=>{const out=[];for(const s of seq)out.push(await audit(s));return out;}',sequence[i:i+8]);rows+=got
   bad=[r for r in got if not all(r[k] for k in ['identical','held','labelHeld','identity','nonempty','ready'])]
   if bad:raise AssertionError('Composition mismatch '+json.dumps(bad))
   if i%80==0:print('RENDERS',len(rows),'/',len(sequence),flush=True)
   (E/'BROWSER_PROGRESS.json').write_text(json.dumps({'renders':len(rows),'planned':len(sequence),'elapsed_seconds':round(time.monotonic()-t0,1)}))
  check('884 wider-suit executions match exact source composition',len(rows)==884 and all(r['identical'] for r in rows),{'all_14_suits':True,'all_50_shirts':True,'all_47_ties_on_S11':['DS017','DS051','DS035']})
  check('Every new frame and label commits atomically to the exact selected identity',all(r['held'] and r['labelHeld'] and r['identity'] for r in rows))
  # Preserved S05 and other originally supported paths compared with V1.5.
  originalSequence=[]
  for state in modes('DS035')+['REFERENCE']:originalSequence.append({'suitId':'S05','shirtId':'DS035','state':state,'shoeId':'shoe-8','watchId':None})
  controls=[['DS017','T017'],['DS036','NO_TIE'],['DS051','T001'],['DS051','T047'],['DS051','NO_TIE'],['DS027','NO_TIE'],['DS047','T022'],['DS041','NO_TIE']]
  for suit in ['S05','S01','S04','S16']:
   for shirt,state in controls:originalSequence.append({'suitId':suit,'shirtId':shirt,'state':state,'shoeId':'shoe-8','watchId':None})
  for i in range(0,len(originalSequence),8):oldrows+=p.evaluate('async seq=>{const out=[];for(const s of seq)out.push(await audit(s));return out;}',originalSequence[i:i+8])
  check('81 original-template outputs are pixel-identical to V1.5, including all 49 S05/DS035 states',len(oldrows)==81 and all(r['identical'] and r['identity'] for r in oldrows))
  # 35 actual footwear choices with a newly enabled shirt.
  shoes=p.evaluate('Object.keys(HEWRSApp.connection.shoeLayers)');shoeRows=[]
  for i in range(0,len(shoes),5):shoeRows+=p.evaluate("async ids=>{const out=[];for(const shoeId of ids)out.push(await audit({suitId:'S11',shirtId:'DS036',state:'T017',shoeId,watchId:null}));return out;}",shoes[i:i+5])
  check('35 registered footwear selections render under a newly connected shirt/suit',len(shoeRows)==35 and all(r['identical'] and r['identity'] for r in shoeRows))
  # Native UI uses exactly the same public app connection.
  p.evaluate("HEWRSApp.showPage('home')");p.click('#mode-anchor')
  check('Anchor exposes all 18 suit choices',p.locator('#suit-select option').count()==18 and p.locator('#suit-select option:disabled').count()==0)
  p.select_option('#shirt-select','DS017');p.select_option('#tie-select','T017');p.select_option('#suit-select','S12')
  check('Suit changes preserve chosen shirt and tie; all 50 shirts enabled',p.input_value('#shirt-select')=='DS017' and p.input_value('#tie-select')=='T017' and p.locator('#shirt-select option').count()==50 and p.locator('#shirt-select option:disabled').count()==0 and not p.is_disabled('#apply-selection'))
  p.click('#apply-selection');wait(p,"HEWRSApp.state().selection?.suitId==='S12'&&HEWRSApp.state().selection?.shirtId==='DS017'&&document.getElementById('avatar').dataset.loading==='false'")
  check('Anchor applies the requested wider suit and non-DS035 shirt',p.evaluate("HEWRSApp.state().selection.state==='T017'"))
  # No-tie restriction, including cuff/body/collar load.
  p.click('#mode-anchor');p.select_option('#shirt-select','DS042')
  check('No-tie-only shirt has only its supported mode; no tied fallback',p.input_value('#tie-select')=='NO_TIE' and p.locator('#tie-select option').count()==1)
  p.click('#apply-selection');wait(p,"HEWRSApp.state().selection?.shirtId==='DS042'&&document.getElementById('avatar').dataset.loading==='false'")
  check('Unscored approved manual shirt stays visible without a fabricated score',p.evaluate("HEWRSApp.state().selection.state==='NO_TIE'&&HEWRSApp.connection.scoreSelection(HEWRSApp.state().selection).status==='canonical_data_hold'"))
  # Engine free selection and category requests through genuine UI.
  p.click('#mode-engine');p.select_option('#suit-select','S11');p.select_option('#shirt-select','ANY');p.select_option('#tie-select','ANY')
  check('Engine free shirt/tie selection is enabled for S11',not p.is_disabled('#apply-selection') and p.locator('#shirt-select option:disabled').count()==0)
  p.click('#apply-selection');wait(p,"HEWRSApp.state().origin==='engine'&&HEWRSApp.state().selection?.suitId==='S11'&&!document.getElementById('stage').classList.contains('busy')")
  check('Engine generates applicable wider-suit options and logs no wear',p.evaluate("HEWRSApp.state().optionCount>0&&HEWRSApp.state().selection.suitId==='S11'&&HEWRSApp.store.snapshot().events.length===0"),p.evaluate("({options:HEWRSApp.state().optionCount,selection:HEWRSApp.state().selection})"))
  engineRows=[]
  for suit in wide:
   engineRows.append(p.evaluate("""async suitId=>{const a=HEWRSApp,r=await a.generate({suitId,shirt:'ANY',tie:'T017',shoeId:'shoe-8',watchId:null,localDate:'2026-09-22',occasion:'clinic',formality:'any',style:'AUTO'});return {suitId,options:r.options.length,selection:a.state().selection,ready:document.getElementById('avatar').dataset.status==='ready',events:a.store.snapshot().events.length};}""",suit))
  check('Engine free-shirt requests display correct suit across all 14 wider routes',len(engineRows)==14 and all(r['options']>0 and r['selection']['suitId']==r['suitId'] and r['ready'] and r['events']==0 for r in engineRows),engineRows)
  p.click('#mode-engine');p.select_option('#suit-select','S11');p.select_option('#shirt-select','FAMILY:cream');p.select_option('#tie-select','T017')
  check('Shirt-family request no longer blocked by DS035 lock',not p.is_disabled('#apply-selection'))
  p.click('#apply-selection');wait(p,"!document.getElementById('stage').classList.contains('busy')&&HEWRSApp.state().request?.shirt?.category==='cream'")
  check('Family reaches controller with exact category; returned outfit source remains valid',p.evaluate("HEWRSApp.state().optionCount>0&&HEWRSApp.state().request.shirt.category==='cream'&&HEWRSApp.connection.validateSelection(HEWRSApp.state().selection).suitId==='S11'"))
  p.evaluate("HEWRSApp.showPage('outfits')")
  check('Outfits displays live results',p.locator('#results button').count()>0)
  p.locator('#results button').first.click();wait(p,"!document.getElementById('stage').classList.contains('busy')")
  # Rapid requests include corrected / uncorrected DS035 routes to detect leaked patches.
  rapid=p.evaluate('''async()=>{const a=HEWRSApp,seq=[['S11','DS035','T017'],['S12','DS017','NO_TIE'],['S18','DS051','T047'],['S05','DS035','T001'],['S11','DS036','T017']];const pending=seq.map(([suitId,shirtId,state])=>a.apply({suitId,shirtId,state,shoeId:'shoe-8',watchId:null},{save:false}));const r=await Promise.all(pending);return{cancelled:r.slice(0,-1).every(x=>x.cancelled),last:a.state().selection,lastReady:r.at(-1).status==='ready'};}''')
  check('Rapid cross-shirt/suit requests retain only last complete outfit',rapid['cancelled'] and rapid['lastReady'] and rapid['last']['shirtId']=='DS036' and rapid['last']['suitId']=='S11',rapid)
  invalid=p.evaluate('''async()=>{const a=HEWRSApp,before=pix(document.getElementById('avatar')),s=a.state().selection;let n=0;for(const extra of [{shirtId:'DS049'},{suitId:'S19'},{shirtId:'DS042',state:'T017'},{shirtId:'DS035',state:'REFERENCE'}]){try{await a.apply({...s,...extra},{save:false});}catch{n++;}}return{rejected:n,retained:same(before,pix(document.getElementById('avatar')))&&JSON.stringify(s)===JSON.stringify(a.state().selection)};}''')
  check('Invalid selections retain actual previous frame and identity',invalid['rejected']==4 and invalid['retained'],invalid)
  cancel=p.evaluate('''async()=>{const a=HEWRSApp,before=pix(document.getElementById('avatar')),s=a.state().selection,pending=a.apply({...s,suitId:'S18',shirtId:'DS017'},{save:false});a.cancel();const r=await pending;return{cancelled:r.cancelled,retained:same(before,pix(document.getElementById('avatar')))&&JSON.stringify(s)===JSON.stringify(a.state().selection)};}''')
  check('Cancellation retains completed frame',cancel['cancelled'] and cancel['retained'],cancel)
  # Simulated failed component load on separate atomic display; actual code, no persistent state.
  loading=p.evaluate('''async()=>{const a=HEWRSApp,c=document.createElement('canvas'),s=a.state().selection;let fail=false;const rr=HEWRSAtomicRenderer.create(c,a.connection,{resolveUrl:d=>{if(fail&&d.sha256===a.connection.suitSources.resolveCanonical('S09').jacket.sha256)throw Error('simulated missing selected jacket');return a.resolveUrl(d);}});await rr.render(s);const before=pix(c);fail=true;let rejected=false;try{await rr.render({...s,suitId:'S09'});}catch{rejected=true;}const retained=same(before,pix(c));rr.cancel();c.width=c.height=1;return{rejected,retained};}''')
  check('Failed suit component load cannot erase completed outfit',loading['rejected'] and loading['retained'],loading)
  # Source identities used by Wardrobe, no direct candidate or label substitution.
  p.evaluate("HEWRSApp.showPage('wardrobe')");p.select_option('#wardrobe-category','shirts');p.fill('#wardrobe-search','DS047')
  p.locator('#wardrobe-list button').first.click();wait(p,"HEWRSApp.state().selection?.shirtId==='DS047'&&!document.getElementById('stage').classList.contains('busy')")
  check('Wardrobe applies an existing approved shirt on wider suit',p.evaluate("HEWRSApp.state().selection.suitId==='S11'&&HEWRSApp.state().selection.shirtId==='DS047'"))
  # Confirmed wear and backup actions; memory-only origin explicitly retained.
  p.click('#record-wear');check('Opening wear dialog alone creates no event',p.evaluate("HEWRSApp.store.snapshot().events.length===0"))
  p.fill('#wear-date','2026-09-22');p.click('#confirm-wear')
  check('Explicit wear stores exact new canonical and unchanged historical IDs',p.evaluate("HEWRSApp.store.snapshot().events.length===1&&HEWRSApp.store.snapshot().events[0].items.shirt.id==='shirt-DS047'&&HEWRSApp.store.snapshot().events[0].items.topwear.id==='suit-10'"))
  p.click('#data-button')
  with p.expect_download() as download:p.click('#export-backup')
  backup=Path(download.value.path()).read_bytes();(E/'TEST_BACKUP.json').write_bytes(backup)
  p.set_input_files('#backup-file',{'name':'test-backup.json','mimeType':'application/json','buffer':backup})
  wait(p,"!document.getElementById('confirm-restore').disabled")
  check('Backup preview does not change confirmed wear',p.evaluate("HEWRSApp.store.snapshot().events.length===1"))
  p.click('#confirm-restore');wait(p,"!document.getElementById('backup-dialog').open&&!document.getElementById('stage').classList.contains('busy')")
  check('Explicit restore reopens new shirt/suit identity without resetting wear',p.evaluate("HEWRSApp.store.snapshot().events.length===1&&HEWRSApp.state().selection.shirtId==='DS047'&&HEWRSApp.state().selection.suitId==='S11'"))
  # Capture final same-code result: new connection, no new garment imagery.
  p.evaluate("async()=>{HEWRSApp.showPage('home');await HEWRSApp.apply({suitId:'S11',shirtId:'DS017',state:'T017',shoeId:'shoe-8',watchId:null},{save:false});}")
  save_canvas(p,'document.getElementById("avatar")','S11_DS017_T017_NATIVE.png')
  p.screenshot(path=str(E/'APP_S11_DS017_PHONE_DPR3.png'),scale='device')
  p.screenshot(path=str(E/'APP_S11_DS017_PHONE_CSS.png'),scale='css')
  p.click('#detail-view');p.screenshot(path=str(E/'APP_S11_DS017_COLLAR_CSS.png'),scale='css');p.click('#full-view')
  layouts=[]
  for width,height in [(375,667),(390,844),(430,932)]:
   p.set_viewport_size({'width':width,'height':height});time.sleep(.1)
   layouts.append(p.evaluate('''()=>{const c=document.getElementById('avatar').getBoundingClientRect(),s=document.getElementById('stage').getBoundingClientRect();return{width:innerWidth,height:innerHeight,left:c.left,top:c.top,right:c.right,bottom:c.bottom,canvasWidth:c.width,canvasHeight:c.height,insideStage:c.left>=s.left&&c.right<=s.right&&c.top>=s.top&&c.bottom<=s.bottom,horizontalOverflow:document.documentElement.scrollWidth>innerWidth};}'''))
  check('Full avatar fits same phone-stage layout at three tested viewports',all(r['insideStage'] and r['bottom']<=r['height'] and not r['horizontalOverflow'] for r in layouts),layouts)
  check('No script errors or external network attempts',not errors and not requests,{'pageerrors':errors,'external_requests':requests})
 except Exception as exc:
  failure=traceback.format_exc();print(failure,flush=True)
 finally:
  output={'version':'V1.6','passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks)+(1 if failure else 0),'checks':checks,'wider_suit_comparisons':rows,'original_route_comparisons':oldrows,'footwear_comparisons':locals().get('shoeRows',[]),'engine_requests':locals().get('engineRows',[]),'failure':failure,'errors':errors,'external_requests':requests,'seconds':round(time.monotonic()-t0,2),'browser_version':b.version,'transport':'Exact packaged code and original PNG bytes supplied in memory to Chromium. No generated/replacement garment imagery.','not_claimed':['All 39,817 states rendered in browser','New garment approval','Physical iPhone','Safari','Hosted delivery','Real-origin persistent restart']}
  (E/'BROWSER.json').write_text(json.dumps(output,indent=2)+'\n');b.close()
if failure:raise SystemExit(1)
print('DONE',json.dumps({'passed':output['passed'],'failed':output['failed'],'wider_renders':len(rows),'original_controls':len(oldrows),'footwear_renders':len(output['footwear_comparisons'])}),flush=True)
