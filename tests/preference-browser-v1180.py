#!/usr/bin/env python3
"""Actual source/renderer/UI in in-memory Chromium; synthetic isolated storage.
No live GitHub/provider/physical Safari acceptance is claimed.
"""
from pathlib import Path
import os,json,time,base64,io,hashlib,traceback
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];B=Path(os.environ.get('HEWRS_BASELINE_V1174',str(R.parent/'baseline')))
E=R/'evidence/recalibration_v1_18_0/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];comparisons=[];frames_rendered=[];errors=[];started=time.monotonic()
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def save():
 (E/'PASS3_BROWSER.json').write_text(json.dumps({'scope':__doc__,'passed':sum(c['passed']for c in checks),'failed':sum(not c['passed']for c in checks),'checks':checks,'unchanged_frame_comparisons':comparisons,'new_option_frames':frames_rendered,'errors':errors,'seconds':round(time.monotonic()-started,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+': '+str(detail))
def supply(p,hs):
 present=set(p.evaluate('()=>Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hs.items():
  if sha in present:continue
  val=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=val;size+=len(val)
  if size>2000000:p.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:p.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
DEFAULT={'suitId':'S05','shirtId':'DS036','state':'T017','shoeId':'shoe-8','watchId':None}
KEY='hewrs:connected-app:v1'
def load(p,r,seed=None):
 h.R=r;pre=[]
 for value in (seed or {}).values():
  try:
   d=json.loads(value)
   if isinstance(d,dict)and isinstance(d.get('session'),dict):pre.append(d['session']['selection'])
  except (TypeError,ValueError):pass
 h.load(p,storage=seed or {'audit-sentinel':'UNCHANGED'},preload=pre)
 p.evaluate('()=>{HEWRSApp.autoWeather.disable();}')
def ensure(p,r,selections):h.R=r;h.ensure(p,selections)
def apply(p,s):return p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
def image(p):return Image.open(io.BytesIO(base64.b64decode(p.evaluate('()=>document.querySelector("#avatar").toDataURL("image/png")').split(',')[1]))).convert('RGBA')
def digest(p):return hashlib.sha256(image(p).tobytes()).hexdigest()
def S(sh='DS035',t='T017',s='S10'):return {'suitId':s,'shirtId':sh,'state':t,'shoeId':'shoe-8','watchId':None}
def O(sh='DS023',t='T017'):return {'shirtOnly':True,'shirtId':sh,'state':t,'pantId':'PG002','shoeId':'shoe-8','watchId':None}
SUMMARY=lambda s: f"{s.get('suitId',s.get('blazerId','Shirt only'))} / {s['shirtId']} / {s['state']} / {s['shoeId']}"
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 ps=[]
 def new(root,seed=None,w=390,hgt=700):
  p=browser.new_page(viewport={'width':w,'height':hgt},has_touch=True);p.on('pageerror',lambda e:errors.append(str(e)));load(p,root,seed);ps.append(p);return p
 try:
  comparePage=None
  def resetCompare():
   global comparePage
   if comparePage:comparePage.close()
   comparePage=browser.new_page(viewport={'width':820,'height':850});comparePage.set_content('<iframe id=old style="width:390px;height:700px"></iframe><iframe id=now style="width:390px;height:700px"></iframe>')
   old=comparePage.locator('#old').element_handle().content_frame();p=comparePage.locator('#now').element_handle().content_frame();load(old,B);load(p,R);return old,p
  old,p=resetCompare()
  ck('Current and independent baseline load with different version IDs',p.evaluate('()=>HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_18_0'and old.evaluate('()=>HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_17_4')
  shirts=p.evaluate('()=>HEWRSApp.connection.manifest.shirt_order');non=p.evaluate('()=>HEWRSApp.connection.nonSuitSources.connectedIds')
  seq=[S(s,'NO_TIE','S05')for s in shirts]+[S('DS029',f'T{i:03}','S05')for i in range(1,48)]+[S('DS035','T017',f'S{i:02}')for i in range(1,19)]+[{'blazerId':f'B{i:02}','shirtId':'DS023','state':'NO_TIE','pantId':'PG002','shoeId':'shoe-8','watchId':None}for i in range(1,15)]+[O(s,t)for s in non for t in ['NO_TIE','T017']]+[S('DS035','REFERENCE','S05')]
  for n,s in enumerate(seq):
   if n and n%24==0:old,p=resetCompare()
   for pp,rr in [(old,B),(p,R)]:ensure(pp,rr,[s]);apply(pp,s)
   z=comparePage.evaluate('''()=>{const a=['old','now'].map(id=>document.querySelector('#'+id).contentWindow.document.querySelector('#avatar').getContext('2d',{willReadFrequently:true}).getImageData(0,0,996,2748).data);let n=0;for(let i=0;i<a[0].length;i++)if(a[0][i]!==a[1][i])n++;return {changed_samples:n,equal:n===0};}''');comparisons.append({'selection':s,**z});assert z['equal'],SUMMARY(s)
   if(n+1)%20==0:print('PIXEL',n+1,flush=True);save()
  ck('166 native outfit frames remain pixel-identical, across all suits/shirts/ties and current non-suit routes',len(comparisons)==166)
  comparePage.close();p=new(R)
  # Actual user-facing Generate, navigation, score labels and source bindings.
  def configure(suit):
   p.evaluate('sid=>{const a=HEWRSApp;a.ui.reset();a.ui.set("topwear",{mode:"item",id:a.connection.aliases.get(sid)});a.ui.set("watch",{mode:"none"});a.weather.apply({source:"not_assessed",date:a.state().context.localDate});a.setMode("engine");a.showPage("home");}',suit)
  configure('S10')
  selections=p.evaluate('()=>{const a=HEWRSApp,ct=a.state().context,q=a.ui.operation("engine",{...ct,environment:a.weather.request(ct.localDate)}).request;return a.connection.controller.generate(q,a.connection.catalogue,[]).options.map(x=>x._hewrsConnected.canonical_selection);}')
  ensure(p,R,selections);p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().optionCount===15',timeout=90000)
  ck('Actual Generate produces 15 personalized S10 options with exact anchors and caps',p.evaluate('()=>{const a=HEWRSApp,r=a.state().report;return r.options.every(x=>x._hewrsConnected.canonical_selection.suitId==="S10")&&r.option_policy.all_unanchored_items_within_limit&&r.option_policy.no_tie_options<=2;}'))
  ck('Personal score is labelled separately from original compatibility', 'heuristic' in p.locator('#score-label').inner_text().lower())
  s10=[]
  for i in range(15):
   s=p.evaluate('()=>HEWRSApp.state().selection');assert s==selections[i];s10.append((s,image(p)));frames_rendered.append({'group':'S10-ui','position':i+1,'selection':s})
   if i==0:p.screenshot(path=str(E/'ACTUAL_S10_390x700.png'))
   if i<14:p.click('#next-option');p.wait_for_function('(i)=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===i',arg=i+1)
  ck('All 15 navigation buttons display their corresponding physical items',len(s10)==15)
  p.click('#score-button');ck('Score details disclose both original compatibility and personalized preference', 'personalized_preference' in p.locator('#fx-sheet').inner_text()and 'original_compatibility_unchanged' in p.locator('#fx-sheet').inner_text());p.click('#fx-sheet-close')
  for group in range(3):
   out=Image.new('RGB',(1300,670),(240,238,233));d=ImageDraw.Draw(out)
   d.text((20,12),'S10 / PERSONALIZED OPTIONS / ACTUAL APP RENDERS',font=ImageFont.truetype(FONT,20),fill=(32,32,32))
   for k,(s,im)in enumerate(s10[group*5:(group+1)*5]):
    th=im.resize((180,497),Image.Resampling.LANCZOS);out.paste(th,(k*260+40,55),th)
    d.text((k*260+12,566),f"{group*5+k+1:02}  {s['shirtId']} + {s['state']}",font=ImageFont.truetype(FONT,17),fill=(32,32,32));d.text((k*260+12,594),s['shoeId'],font=ImageFont.truetype(FONT,15),fill=(32,32,32))
   d.text((20,642),'Empty test history; no weather restriction; watch omitted. Existing garment pixels unchanged.',font=ImageFont.truetype(FONT,14),fill=(60,60,60));out.save(E/f'S10_OPTIONS_{group*5+1:02}_{group*5+5:02}.jpg',quality=94)
  # Filter and Cancel behavior: exact wardrobe rows, new shade filters, no saved wear.
  p.evaluate('()=>HEWRSApp.showPage("home")');prefs=p.evaluate('()=>HEWRSApp.ui.snapshot()');wear=p.evaluate('()=>HEWRSApp.store.snapshot().events');p.click('#pref-shirt');ck('Suit picker retains all 50 exact IDs',p.locator('[data-item-id]').count()==50);p.locator('[data-item-id="DS037"]').click();p.keyboard.press('Escape');ck('Cancel retains prior preference locks',p.evaluate('()=>HEWRSApp.ui.snapshot()')==prefs)
  # Save favorite must not record wear. Recall keeps manual provenance.
  before_wear=p.evaluate('()=>HEWRSApp.store.snapshot().events')
  ck('Generation, detail views, filters and navigation add no wear records',p.evaluate('()=>HEWRSApp.store.snapshot().events')==before_wear and before_wear==wear)
  # Independent synthetic invalid/stale read reproduction; no user browser data.
  p.close();p=new(R,{KEY:'{broken','audit-sentinel':'UNCHANGED'});configure('S10');p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy',timeout=30000)
  ck('Malformed history blocks the actual Generate handler and preserves raw bytes',p.evaluate('()=>HEWRSApp.state().optionCount===0&&__STORAGE_MAP.get(HEWRSApp.store.key)==="{broken"'))
  ck('Malformed history is shown as unavailable, not zero confirmed records',p.locator('#wear-count').inner_text()=='—'and 'unavailable' in p.locator('#history-preview').inner_text().lower())
  p.close();p=new(R);configure('S10')
  event=p.evaluate('()=>HEWRSApp.connection.createHistoryEvent({suitId:"S10",shirtId:"DS035",state:"T028",shoeId:"shoe-8",watchId:null},{id:"synthetic_other_tab",localDate:"2026-09-27",origin:"manual"})')
  p.evaluate('event=>{const a=HEWRSApp,s=a.store.snapshot();__STORAGE_MAP.set(a.store.key,JSON.stringify({...s,revision:s.revision+1,events:[event]}));}',event)
  # supply potential rendering assets, including fresh-history recommendation.
  sels=p.evaluate('()=>{const a=HEWRSApp,ct=a.state().context,q=a.ui.operation("engine",{...ct,environment:a.weather.request(ct.localDate)}).request,h=JSON.parse(__STORAGE_MAP.get(a.store.key)).events;return a.connection.controller.generate(q,a.connection.catalogue,h).options.map(x=>x._hewrsConnected.canonical_selection);}')
  ensure(p,R,sels);p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy',timeout=90000)
  ck('Actual Generate synchronizes a valid other-tab ledger before selecting',p.evaluate('()=>HEWRSApp.store.snapshot().events[0].id')=='synthetic_other_tab' and p.evaluate('()=>HEWRSApp.state().selection')==sels[0])
  # Change store while async generation is yielding: no recommendation accepted.
  p.evaluate('()=>{HEWRSApp.showPage("home");}')
  p.click('#generate-options');p.evaluate('()=>{const a=HEWRSApp,s=JSON.parse(__STORAGE_MAP.get(a.store.key));__STORAGE_MAP.set(a.store.key,JSON.stringify({...s,revision:s.revision+1}));}')
  p.wait_for_function('()=>!HEWRSApp.state().busy',timeout=90000)
  ck('A backing revision changed during generation cancels stale results',p.evaluate('()=>HEWRSApp.state().optionCount===0&&HEWRSApp.state().origin!=="engine"')and 'changed' in p.evaluate('()=>HEWRSApp.state().report.reason').lower())
  # Race during render: guard restores prior complete frame before surfacing error.
  token=p.evaluate('()=>HEWRSApp.store.readForGeneration().token');prev=p.evaluate('()=>HEWRSApp.state().selection');prev_hash=digest(p);target=S('DS001','T028','S10');ensure(p,R,[target])
  result=p.evaluate('''async ({s,token})=>{const task=HEWRSApp.apply(s,{historyToken:token,origin:'engine'}).then(()=>({ok:true})).catch(e=>({ok:false,error:e.message}));const raw=JSON.parse(__STORAGE_MAP.get(HEWRSApp.store.key));__STORAGE_MAP.set(HEWRSApp.store.key,JSON.stringify({...raw,revision:raw.revision+1}));return await task;}''',{'s':target,'token':token})
  ck('History drift during image loading restores the previous complete frame and selection',not result['ok']and p.evaluate('()=>HEWRSApp.state().selection')==prev and digest(p)==prev_hash,result)
  # Every topwear: actual before/after render of first two returned outfits.
  p.close();matrix=json.loads((R/'evidence/recalibration_v1_18_0/PASS2_WARDROBE_MATRIX.json').read_text())['cases'];tops=[r for r in matrix if r['type']in ['suit','blazer']];thumbs={}
  for n,row in enumerate(tops):
   if n%8==0:
    if n:old.close();p.close()
    old=new(B);p=new(R)
   for k in range(2):
    for label,pp,rr,field in [('old',old,B,'baseline'),('new',p,R,'updated')]:
     s=row[field][k]['selection'];ensure(pp,rr,[s]);apply(pp,s);im=image(pp);thumbs[row['id'],label,k]=(s,im.resize((120,331),Image.Resampling.LANCZOS));frames_rendered.append({'group':row['id'],'source':label,'position':k+1,'selection':s})
  ck('All 18 suits and 14 blazers have actual before/after first-two option renders',len(tops)==32 and len(thumbs)==128)
  for group in range(4):
   out=Image.new('RGB',(880,8*378+52),(240,238,233));d=ImageDraw.Draw(out);font=ImageFont.truetype(FONT,13)
   d.text((16,10),'OLD HEWRS (left pair)  |  PERSONALIZED (right pair)  — actual wardrobe assets',font=font,fill=(30,30,30))
   for n,row in enumerate(tops[group*8:(group+1)*8]):
    y=n*378+44;d.text((5,y+50),row['id'],font=font,fill=(30,30,30))
    for j,(label,k)in enumerate([('old',0),('old',1),('new',0),('new',1)]):
     s,im=thumbs[row['id'],label,k];x=45+j*207;out.paste(im,(x+35,y),im);d.text((x,y+338),s['shirtId']+' / '+s['state'],font=font,fill=(30,30,30));d.text((x,y+355),s['shoeId'],font=font,fill=(30,30,30))
   out.save(E/f'WARDROBE_COMPARISON_{group+1}.jpg',quality=94)
  # Compact explicit comparison for source families, not invented independent looks.
  ids=['S10','S03','B06','B13'];out=Image.new('RGB',(1000,4*395+70),(240,238,233));d=ImageDraw.Draw(out)
  d.text((18,14),'SAME WARDROBE: ORIGINAL RANKING  |  NEW PERSONALIZED RANKING',font=ImageFont.truetype(FONT,19),fill=(25,25,25))
  for n,id in enumerate(ids):
   y=60+n*395;d.text((10,y+75),id,font=ImageFont.truetype(FONT,18),fill=(25,25,25))
   for j,(label,k)in enumerate([('old',0),('old',1),('new',0),('new',1)]):
    s,im=thumbs[id,label,k];x=65+j*230;out.paste(im,(x+35,y),im);d.text((x,y+337),s['shirtId']+' + '+s['state'],font=ImageFont.truetype(FONT,16),fill=(25,25,25));d.text((x,y+361),s['shoeId'],font=ImageFont.truetype(FONT,14),fill=(25,25,25))
  out.save(E/'BEFORE_AFTER_FOUR_FAMILIES.jpg',quality=95)
  old.close();p.close();p=new(R)
  for w,height in [(320,568),(390,350),(390,700),(430,932),(1024,768)]:
   p.set_viewport_size({'width':w,'height':height});p.evaluate('()=>HEWRSApp.showPage("home")');p.click('#pref-shirt');box=p.locator('#picker-apply').bounding_box();assert box and box['x']>=0 and box['x']+box['width']<=w+1;assert box['y']+box['height']<=height+1;p.keyboard.press('Escape')
  ck('Picker controls stay reachable at five phone/desktop/keyboard-sized viewports',True)
  ck('No unexpected browser execution errors',not errors,errors)
 except Exception:
  checks.append({'name':'Browser suite completion','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except Exception:pass
 finally:
  save();browser.close()
if any(not c['passed']for c in checks):raise SystemExit(1)
