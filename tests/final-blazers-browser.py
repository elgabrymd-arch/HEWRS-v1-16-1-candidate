#!/usr/bin/env python3
import os,json,time,traceback,hashlib,base64,io,threading,http.server,functools
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1]
BASE=Path(os.environ.get('HEWRS_BASELINE_V111','/mnt/data/next_v112/HEWRS_CONNECTED_APP_V1_11'))
E=Path(os.environ.get('HEWRS_V112_BROWSER',R/'evidence/b01_b02_v1_12/browser'));E.mkdir(parents=True,exist_ok=True)
checks=[];renders=[];regressions=[];errors=[];http_result={};start=time.monotonic()
def save():
 (E/'BROWSER.json').write_text(json.dumps({'scope':'Actual source/PNG bytes in Chromium; native-coordinate comparisons. Not a physical iPhone/Safari test.','passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'new_render_comparisons':renders,'unchanged_route_comparisons':regressions,'page_errors':errors,'http_probe':http_result,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+' '+str(detail))
def S(b='B01',p='PG002',t='T017',shoe='shoe-8'):return dict(blazerId=b,pantId=p,shirtId='DS001',state=t,shoeId=shoe,watchId='watch-P05')
def load(page,root,pre=None,storage=None):h.R=root;h.load(page,storage=storage,preload=pre or [])
def ensure(page,root,sel):h.R=root;h.ensure(page,sel)
def sha(page):
 png=base64.b64decode(page.evaluate("document.getElementById('avatar').toDataURL('image/png')").split(',')[1]);return hashlib.sha256(Image.open(io.BytesIO(png)).convert('RGBA').tobytes()).hexdigest()
def supply_without_return(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for key,name in hashes.items():
  if key in present:continue
  b64=base64.b64encode((h.R/name).read_bytes()).decode('ascii');batch[key]=b64;size+=len(b64)
  if size>2_000_000:page.evaluate('(x)=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:page.evaluate('(x)=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply_without_return
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);p=browser.new_page(viewport={'width':390,'height':844},accept_downloads=True);p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(R)));threading.Thread(target=server.serve_forever,daemon=True).start();probe=browser.new_page()
  try:
   response=probe.goto(f'http://127.0.0.1:{server.server_port}/index.html',timeout=10000);probe.wait_for_function('globalThis.HEWRS_READY===true',timeout=15000);http_result={'tested':True,'loaded':True,'status':response.status,'scope':'Loopback only, not deployed site'}
  except Exception as ex:http_result={'tested':True,'loaded':False,'error':str(ex)[:400],'fallback':'In-memory exact code and asset bytes'}
  finally:probe.close();server.shutdown();server.server_close()
  load(p,R,[S(),S('B02')],storage={'production_sentinel':'UNCHANGED'})
  ck('All fourteen blazer choices available in current facelift',p.evaluate("HEWRSApp.connection.blazerConnection.availableIds.length===14&&HEWRSApp.ui.rows.topwear.filter(x=>x.kind==='blazer').every(x=>x.available)"))
  # Independent expected compositor reads the immutable input contract. It does
  # not call or reuse the new renderer's plan/render functions.
  p.evaluate('''()=>{const cache=new Map();globalThis.__im=async d=>{if(cache.has(d.sha256))return cache.get(d.sha256);const p=new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=HEWRSApp.resolveUrl(d)});cache.set(d.sha256,p);while(cache.size>12)cache.delete(cache.keys().next().value);return p;};globalThis.__expected=async(s,old=false)=>{const c=HEWRSApp.connection,a=c.blazerConnection.data.assembly,b=c.blazerConnection.data.blazers[s.blazerId];const ds=[c.manifest.static.avatar,c.shoeLayers[s.shoeId],c.blazerConnection.knownPant(s.pantId).layer,a.ties[s.state],b.assembly.ownership,old?b.checkpoint_layer:b.assembly.jacket,...a.cuffs,...a.hands];const ims=await Promise.all(ds.map(__im));const make=()=>{const z=document.createElement('canvas');z.width=996;z.height=2748;return z;},o=make(),t=make(),oc=o.getContext('2d',{willReadFrequently:true}),tc=t.getContext('2d',{willReadFrequently:true});tc.drawImage(ims[4],0,0);const m=tc.getImageData(0,0,996,2748).data;tc.clearRect(0,0,996,2748);tc.drawImage(ims[3],0,0);const q=tc.getImageData(0,0,996,2748);for(let y=0;y<2748;y++)for(let x=0;x<996;x++){const i=(y*996+x)*4;if(m[i]||y>=b.assembly.sourceCuffOwnershipStart)q.data.fill(0,i,i+4);}tc.putImageData(q,0,0);ims.slice(0,3).forEach(im=>oc.drawImage(im,0,0));oc.drawImage(t,0,0);ims.slice(5).forEach(im=>oc.drawImage(im,0,0));const out=oc.getImageData(0,0,996,2748).data;o.width=o.height=t.width=t.height=1;return out;};globalThis.__compare=async s=>{await HEWRSApp.apply(s,{save:false});const a=document.getElementById('avatar').getContext('2d').getImageData(0,0,996,2748).data,b=await __expected(s);let d=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])d++;return {selection:s,changed_pixels:d,status:document.getElementById('avatar').dataset.status};};}''')
  selections=[S(b,t='T'+str(t).zfill(3)) for b in ['B01','B02'] for t in range(1,48)]
  selections +=[S('B01',p=x) for x in p.evaluate('HEWRSApp.connection.blazerConnection.pantIds') if x!='PG002']
  selections +=[S('B02',shoe=x) for x in p.evaluate('Object.keys(HEWRSApp.connection.shoeLayers)') if x!='shoe-8']
  ensure(p,R,selections)
  for i,s in enumerate(selections):
   row=p.evaluate('__compare',s);renders.append(row)
   if row['changed_pixels']:raise AssertionError(row)
   if (i+1)%20==0:print('RENDER',i+1,flush=True);save()
  ck('151 new tie/trouser/footwear renders match native source composition',len(renders)==151 and all(x['changed_pixels']==0 for x in renders))
  for id in ['B01','B02']:
   s=S(id);old=p.evaluate('(id)=>HEWRSApp.connection.blazerConnection.knownBlazer(id).checkpoint_layer',id);h.R=R;h.supply(p,{old['sha256']:old['url']})
   measure=p.evaluate('''async s=>{await HEWRSApp.apply(s,{save:false});const a=document.getElementById('avatar').getContext('2d').getImageData(0,0,996,2748).data,b=await __expected(s,true),d=HEWRSApp.connection.blazerConnection.knownBlazer(s.blazerId).checkpoint_layer,z=document.createElement('canvas');z.width=996;z.height=2748;const c=z.getContext('2d');c.drawImage(await __im(d),0,0);const m=c.getImageData(0,0,996,2748).data;let changed=0,outside=0,alpha=0;for(let i=0;i<a.length;i+=4){if(a[i+3]!==b[i+3])alpha++;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]){changed++;if(!m[i+3])outside++;}}z.width=z.height=1;return {changed_rgb_pixels:changed,outside_coat:outside,alpha_changes:alpha};}''',s)
   ck(id+' appearance change stays inside existing coat alpha',measure['outside_coat']==0 and measure['alpha_changes']==0,measure)
   p.evaluate('(s)=>{HEWRSApp.ui.fromSelection({...s,blazerId:"B03"});HEWRSApp.showPage("home");HEWRSApp.setMode("engine");}',s)
   p.click('#pref-topwear');p.fill('#picker-search',id);p.locator('[data-item-id="'+id+'"]').click();p.click('#picker-apply');p.click('#generate-options');p.wait_for_function('!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"',timeout=30000)
   state=p.evaluate('HEWRSApp.state().selection');ck(id+' real picker and Engine use the selected identity',state==s,state);ck(id+' Generate does not log actual wear',p.evaluate('HEWRSApp.store.snapshot().events.length')==0)
   p.screenshot(path=str(E/(id+'_ENGINE_390x844.png')));png=p.evaluate("document.getElementById('avatar').toDataURL('image/png')");(E/(id+'_NATIVE.png')).write_bytes(base64.b64decode(png.split(',')[1]))
  controls=[dict(suitId='S'+str(i).zfill(2),shirtId='DS035' if i%3==0 else 'DS036',state='NO_TIE' if i%2==0 else 'T017',shoeId='shoe-8',watchId=None) for i in range(1,19)]
  controls +=[S('B'+str(i).zfill(2)) for i in range(3,15)]
  controls +=[dict(shirtOnly=True,pantId='PN007',shirtId='DS001',state=t,shoeId='shoe-8',watchId=None) for t in ['T001','T017','T022','T047']]
  old=browser.new_page(viewport={'width':390,'height':844});load(old,BASE,controls);ensure(p,R,controls)
  for s in controls:
   p.evaluate('(s)=>HEWRSApp.apply(s,{save:false})',s);old.evaluate('(s)=>HEWRSApp.apply(s,{save:false})',s);a,b=sha(p),sha(old);regressions.append({'selection':s,'new_rgba_sha256':a,'baseline_rgba_sha256':b,'pixel_equal':a==b})
  old.close();ck('34 existing suit/blazer/shirt-only controls remain pixel-identical',all(x['pixel_equal'] for x in regressions),{'count':len(regressions)})
  ensure(p,R,[S(),S('B02')]);p.evaluate('(s)=>HEWRSApp.apply(s,{save:false})',S());before=sha(p)
  rejected=p.evaluate('''async s=>{try{await HEWRSApp.apply({...s,shirtId:'DS036'},{save:false});return false;}catch{return true;}}''',S());ck('Unsupported request retains complete displayed frame',rejected and before==sha(p))
  switch=p.evaluate('''async([a,b])=>{await Promise.allSettled([HEWRSApp.apply(a,{save:false}),HEWRSApp.apply(b,{save:false}),HEWRSApp.apply(a,{save:false})]);return HEWRSApp.state().selection;}''',[S('B02'),S()]);ck('Rapid switching commits last valid request',switch==S('B02'))
  p.evaluate('HEWRSApp.showPage("outfits")');p.click('#record-wear');p.click('#confirm-wear');ck('Confirmed wear retains B02, exact trousers and watch',p.evaluate('''()=>{const e=HEWRSApp.store.snapshot().events.at(-1);return e.items.topwear.id==='blazer-1'&&e.items.pants.id==='pants-PG002'&&e.items.watch.id==='watch-P05';}'''))
  p.evaluate('HEWRSApp.showPage("wardrobe")');p.click('#data-button');expected=p.evaluate('HEWRSApp.store.exportText()')
  with p.expect_download() as dl:p.click('#export-backup')
  dest=E/'TEST_BACKUP.json';dl.value.save_as(str(dest));ck('Actual export button downloads the unchanged backup schema',dest.read_text()==expected);p.keyboard.press('Escape')
  events=p.evaluate('HEWRSApp.store.snapshot().events');p.evaluate('''()=>{const v=HEWRSApp.store.previewImport(HEWRSApp.store.exportText());HEWRSApp.store.restore(v);}''');ck('Restore retains exact new identities',p.evaluate('HEWRSApp.store.snapshot().events')==events)
  ck('Production sentinel unchanged',p.evaluate('__STORAGE_MAP.get("production_sentinel")==="UNCHANGED"'))
  p.evaluate('HEWRSApp.showPage("home")');layout=p.evaluate('''()=>{const h=document.getElementById('page-home'),g=document.getElementById('generate-options').getBoundingClientRect(),n=document.querySelector('.bottom-nav').getBoundingClientRect();return {scroll:h.scrollHeight,client:h.clientHeight,g:g.bottom,nav:n.top};}''');ck('Normal phone-size facelift Home still fits',layout['scroll']<=layout['client']+1 and layout['g']<=layout['nav'],layout)
  ck('No page errors',not errors,errors);save()
 except Exception as e:errors.append('TEST_FAILURE: '+str(e));save();p.screenshot(path=str(E/'FAILURE.png'));traceback.print_exc();raise
 finally:browser.close()
