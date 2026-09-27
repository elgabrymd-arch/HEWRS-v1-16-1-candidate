#!/usr/bin/env python3
"""Current local scripts/assets in two isolated in-memory Chromium frames.
No hosted-browser, provider-network, native iOS or real-origin persistence claim.
"""
from pathlib import Path
import sys,os,json,time,base64,io,traceback,hashlib
sys.dont_write_bytecode=True
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];BASE=Path(os.environ.get('HEWRS_BASELINE_V1171',str(R.parent/'baseline/HEWRS_CONNECTED_APP_V1_17_1')));E=R/'evidence/tie_fidelity_v1_17_2/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];comparisons=[];engine_frames=[];errors=[];begin=time.monotonic();IDs=[f'T{i:03}'for i in range(1,48)];selected=[]
D=json.loads((R/'data/tie-fidelity.json').read_text());OD=json.loads((BASE/'data/inputs.json').read_text());OB=json.loads((BASE/'data/batch10.json').read_text());EDGE=json.loads((BASE/'data/ds023-edges.json').read_text())
def save():
 (E/'RESULT.json').write_text(json.dumps({'version':'1.17.2','scope':__doc__,'passed':sum(c['passed']for c in checks),'failed':sum(not c['passed']for c in checks),'checks':checks,'comparisons':comparisons,'engine_frames':engine_frames,'errors':errors,'seconds':round(time.monotonic()-begin,2)},indent=2)+'\n')
def ck(n,v,d=None):
 checks.append({'name':n,'passed':bool(v),'detail':d});print(('PASS 'if v else'FAIL ')+n,flush=True);save()
 if not v:raise AssertionError(n+': '+str(d))
def S(t='T028',shirt='DS029',suit='S05'):return dict(suitId=suit,shirtId=shirt,state=t,shoeId='shoe-8',watchId=None)
def B(t='T028',shirt='DS023',blazer='B03'):return dict(blazerId=blazer,pantId='PG002',shirtId=shirt,state=t,shoeId='shoe-8',watchId=None)
def O(t='T028',shirt='DS023'):return dict(shirtOnly=True,pantId='PG002',shirtId=shirt,state=t,shoeId='shoe-8',watchId=None)
def supply(p,hs):
 existing=set(p.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hs.items():
  if sha in existing:continue
  val=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=val;size+=len(val)
  if size>2000000:p.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:p.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
COMPARE=r'''async spec=>{
 const wins=[document.querySelector('#old').contentWindow,document.querySelector('#now').contentWindow],can=w=>w.document.querySelector('#avatar');
 const a=can(wins[0]).getContext('2d',{willReadFrequently:true}).getImageData(0,0,996,2748).data,b=can(wins[1]).getContext('2d',{willReadFrequently:true}).getImageData(0,0,996,2748).data;
 let mask=null;if(spec){const w=wins[spec.frame];globalThis.__MASKS||=new Map();let raw=__MASKS.get(spec.sha256);
 if(!raw){const im=new Image();im.src='data:image/png;base64,'+w.HEWRS_EMBEDDED_IMAGES[spec.sha256];await im.decode();const c=document.createElement('canvas');c.width=996;c.height=2748;const cc=c.getContext('2d',{willReadFrequently:true});cc.drawImage(im,0,0);raw=cc.getImageData(0,0,996,2748).data;c.width=c.height=1;__MASKS.set(spec.sha256,raw);while(__MASKS.size>3)__MASKS.delete(__MASKS.keys().next().value);}mask=raw;}
 let changed=0,outside=0,alpha=0,x0=996,y0=2748,x1=0,y1=0;
 for(let i=0;i<a.length;i+=4){if(a[i+3]!==b[i+3])alpha++;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3]){changed++;if(!mask||!mask[i+(spec.channel==='red'?0:3)])outside++;const p=i/4,x=p%996,y=Math.floor(p/996);x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);}}
 return {changed_pixels:changed,alpha_changed_pixels:alpha,outside_tie_changed_pixels:outside,bounds:changed?[x0,y0,x1,y1]:null,exactly_equal:changed===0};
}'''

def mask_for(s,frames):
 if s['state']in ['NO_TIE','REFERENCE']:return None
 if 'suitId'in s:desc=OD['manifest']['ties'][s['state']]['display_layer'];root=BASE;frame=0;channel='alpha';paths=OD['assets']
 elif s['shirtId']in ['DS001','DS014']:desc=D['legacy_ownership_mask'];root=R;frame=1;channel='red';paths=D['assetPaths']
 else:
  desc=EDGE['layers']['T017']['layer']if s['shirtId']=='DS023'and s['state']=='T017'else OB['ties'][s['state']];root=BASE;frame=0;channel='alpha';paths={**OB['assetPaths'],**EDGE['assetPaths']}
 h.R=root;h.supply(frames[frame],{desc['sha256']:paths[desc['sha256']]})
 return dict(sha256=desc['sha256'],frame=frame,channel=channel)
def picture(f):return Image.open(io.BytesIO(base64.b64decode(f.evaluate('document.querySelector("#avatar").toDataURL("image/png")').split(',')[1]))).convert('RGBA')
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':830,'height':850});page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content('<iframe id="old" style="width:390px;height:700px;border:0"></iframe><iframe id="now" style="width:390px;height:700px;border:0"></iframe>')
 frames=[page.locator('#'+id).element_handle().content_frame()for id in ['old','now']]
 try:
  for f,r in zip(frames,[BASE,R]):h.R=r;h.load(f,storage={'sentinel':'UNCHANGED'})
  ck('Baseline and updated app loaded independently',frames[0].evaluate('HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_17_1'and frames[1].evaluate('HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_17_2')
  initial=frames[1].evaluate('({wear:HEWRSApp.store.exportText(),favorites:HEWRSApp.favorites.exportText(),weather:HEWRSApp.weather.exportText?.()||JSON.stringify(HEWRSApp.weather.snapshot())})')
  def compare(s,preview=False):
   global page,frames
   # Bound test-fixture and decoded-image retention across the large matrix.
   if comparisons and len(comparisons)%40==0:
    page.close();page=browser.new_page(viewport={'width':830,'height':850});page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('<iframe id="old" style="width:390px;height:700px;border:0"></iframe><iframe id="now" style="width:390px;height:700px;border:0"></iframe>')
    frames=[page.locator('#'+id).element_handle().content_frame()for id in ['old','now']]
    for f,r in zip(frames,[BASE,R]):h.R=r;h.load(f,storage={'sentinel':'UNCHANGED'})
   for f,r in zip(frames,[BASE,R]):h.R=r;h.ensure(f,[s]);f.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
   v=page.evaluate(COMPARE,mask_for(s,frames));v['selection']=s;comparisons.append(v)
   if s['state']in ['NO_TIE','REFERENCE']:assert v['exactly_equal'],str(v)
   else:assert v['outside_tie_changed_pixels']==0 and v['alpha_changed_pixels']==0,str(v)
   for f in frames:assert f.evaluate('HEWRSApp.renderer.last()')==s
   if preview:
    ims=[picture(f)for f in frames];selected.append((s,ims));
    for i,im in enumerate(ims):im.save(E/(s['state']+'_'+s['shirtId']+'_'+('suit'if'suitId'in s else'non_suit')+'_'+['BEFORE','AFTER'][i]+'.png'))
   if len(comparisons)%25==0:print('COMPARED',len(comparisons),flush=True);save()
  # All 47 physical tie choices across each independent displayed image class.
  for t in IDs:compare(S(t),t in ['T001','T003','T017','T022','T028','T033','T046','T047'])
  ck('All 47 selectable suit tie replacements rendered within original tie opacity',len(comparisons)==47)
  for t in IDs:compare(O(t))
  ck('All 47 separate shirt-only ties, including accepted DS023/T017 edge opacity, rendered',len(comparisons)==94)
  for t in IDs:compare(O(t,'DS001'))
  ck('All 47 legacy DS001 full-shirt/tie replacements rendered',len(comparisons)==141)
  for t in IDs:compare(B(t,'DS014'))
  ck('All 47 DS014 legacy blazer tie replacements rendered, including formerly baked T001',len(comparisons)==188)
  for id in range(1,15):
   for shirt in ['DS001','DS023']:
    for t in ['T001','T017','T028']:compare(B(t,shirt,f'B{id:02}'))
  ck('All 14 blazers exercised with both legacy/current tie paths',len(comparisons)==272)
  for i in range(1,19):
   compare(S('T028','DS035',f'S{i:02}'));compare(S('T017','DS051',f'S{i:02}'))
  ck('All 18 suits plus DS035 wide-opening and DS051 stored-RGB profiles retained',len(comparisons)==308)
  for id in frames[1].evaluate('HEWRSApp.connection.nonSuitSources.connectedIds'):
   compare(O('NO_TIE',id));compare(B('NO_TIE',id))
  for i in range(1,19):compare(S('NO_TIE','DS035',f'S{i:02}'))
  compare(S('REFERENCE','DS035','S05'))
  ck('55 No Tie/historical reference frames remain exactly pixel-identical',sum(v['exactly_equal']and v['selection']['state']in ['NO_TIE','REFERENCE']for v in comparisons)==55)
  ck('Every tied-frame change stays within pre-existing tie ownership and every output alpha is unchanged',all(v['outside_tie_changed_pixels']==0 and v['alpha_changed_pixels']==0 for v in comparisons))
  # Representative source restoration board, same crop and uniform scale only.
  sheet=Image.new('RGB',(1120,4*360),(20,25,30));dr=ImageDraw.Draw(sheet)
  for k,(s,ims)in enumerate(selected):
   for j,im in enumerate(ims):
    crop=im.crop((345,405,650,815)).resize((265,325),Image.Resampling.LANCZOS);x=(k%2)*560+j*280;y=(k//2)*360+25;sheet.paste(crop,(x,y),crop);dr.text((x+5,y-20),s['state']+' '+['BEFORE','DIRECT SOURCE'][j],fill='white')
  sheet.save(E/'EIGHT_TIES_ACTUAL_COMPARISON.png')
  s=S('T028');compare(s)
  for i,f in enumerate(frames):f.evaluate('HEWRSApp.showPage("outfits")');f.click('#detail-view');f.evaluate('()=>{document.querySelector("#page-outfits").scrollTop=0;}');page.locator('#'+['old','now'][i]).screenshot(path=str(E/('T028_COLLAR_DETAIL_'+['BEFORE','AFTER'][i]+'.png')))
  ck('Every tied comparison uses changed source texture, not an unused replacement',all(v['changed_pixels']>0 for v in comparisons if v['selection']['state']not in ['NO_TIE','REFERENCE']))
  ck('Actual Collar Detail and Full Outfit controls display the rebuilt tie',frames[1].locator('#detail-view').get_attribute('aria-pressed')=='true')
  for f in frames:f.click('#full-view')
  f=frames[1];f.evaluate('()=>{HEWRSApp.ui.reset();HEWRSApp.setMode("engine");HEWRSApp.showPage("home");}')
  sels=f.evaluate('()=>{const a=HEWRSApp,ctx=a.state().context,op=a.ui.operation("engine",{...ctx,environment:a.weather.request(ctx.localDate)});return a.connection.controller.generate(op.request,a.connection.catalogue,a.store.snapshot().events).options.map(x=>x._hewrsConnected.canonical_selection);}')
  ck('Automatic Engine produces 15 unique unchanged-ID selections without mandatory locks',len(sels)==15 and len({json.dumps(s,sort_keys=True)for s in sels})==15)
  h.R=R;h.ensure(f,sels);before=f.evaluate('HEWRSApp.store.snapshot().events');f.click('#generate-options');f.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().optionCount===15',timeout=60000)
  for i in range(15):
   if i:f.click('#next-option');f.wait_for_function('(i)=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===i',arg=i,timeout=60000)
   q=f.evaluate('({selection:HEWRSApp.renderer.last(),status:document.querySelector("#avatar").dataset.status})');assert q['status']=='ready';engine_frames.append(q)
  ck('Actual Generate button and arrows display all 15 options without logging wear',len(engine_frames)==15 and f.evaluate('HEWRSApp.store.snapshot().events')==before)
  # Keep session UI operations and old records separate from display assets.
  f.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.showPage("home");HEWRSApp.setMode("anchor");}',O())
  prefs=f.evaluate('HEWRSApp.ui.snapshot()');f.click('#pref-tie');f.locator('[data-item-id="T001"]').click();f.get_by_role('button',name='Cancel',exact=True).click();ck('Picker Cancel keeps exact preferences',f.evaluate('HEWRSApp.ui.snapshot()')==prefs)
  f.click('#pref-tie');f.locator('[data-item-id="T003"]').click();f.click('#picker-apply');ck('Picker Apply changes the intended tie only',f.evaluate('HEWRSApp.ui.snapshot().tie.id')=='T003')
  # Missing new tie resource: no replacement by old low-quality or other tie.
  target=S('T028');new_sha=D['ties']['T028']['layers']['suit']['sha256'];h.R=R;h.ensure(f,[target,S('T001')]);f.evaluate('s=>HEWRSApp.apply(s,{save:false})',S('T001'))
  failure=f.evaluate('''async x=>{const c=document.createElement('canvas'),before=document.querySelector('#avatar');const r=HEWRSAtomicRenderer.create(c,HEWRSApp.connection,{resolveUrl:d=>{if(d.sha256===x.sha)throw Error('SYNTHETIC_TIE_LOAD_FAILURE');return HEWRSApp.resolveUrl(d);}});try{await r.render(x.selection);return false;}catch(e){return String(e).includes('SYNTHETIC_TIE_LOAD_FAILURE');}}''',{'sha':new_sha,'selection':target})
  ck('A missing rebuilt tie fails explicitly instead of silently substituting',failure)
  data=f.evaluate('({wear:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.exportText(),weather:HEWRSApp.weather.exportText?.()||JSON.stringify(HEWRSApp.weather.snapshot())})')
  ck('Confirmed wear, Favorites and weather are not mutated by tie rendering',data['wear']==[] and data['favorites']==initial['favorites']and data['weather']==initial['weather'])
  ck('Synthetic storage sentinel is unchanged',f.evaluate('__STORAGE_MAP.get("sentinel")')=='UNCHANGED')
  ck('No uncaught application errors',not errors,errors)
 except Exception:
  checks.append({'name':'Browser test completion','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  page.screenshot(path=str(E/'FAILURE.png'))
 finally:save();browser.close()
if any(not c['passed']for c in checks):raise SystemExit(1)
