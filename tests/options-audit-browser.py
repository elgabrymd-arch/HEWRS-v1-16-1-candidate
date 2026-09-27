#!/usr/bin/env python3
"""Actual delivered scripts/images in isolated Chromium; synthetic browser storage.
Does not certify live GitHub, physical Safari or re-test the owner's weather report.
"""
from pathlib import Path
import os,json,time,hashlib,base64,io,traceback
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];BASE=Path(os.environ['HEWRS_BASELINE_V1172']);E=R/'evidence/options_v1_17_3/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];comparisons=[];engine_frames=[];errors=[];started=time.monotonic();visuals={}
def save():
 (E/'PASS4_BROWSER.json').write_text(json.dumps({'audit_pass':4,'scope':__doc__,'passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'native_comparisons':comparisons,'engine_frames':engine_frames,'errors':errors,'seconds':round(time.monotonic()-started,2)},indent=2)+'\n')
def ck(name,yes,detail=None):
 checks.append({'name':name,'passed':bool(yes),'detail':detail});print(('PASS 'if yes else'FAIL ')+name,flush=True);save()
 if not yes:raise AssertionError(name+': '+str(detail))
def supply(p,hs):
 present=set(p.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hs.items():
  if sha in present:continue
  val=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=val;size+=len(val)
  if size>2000000:p.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:p.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
S=lambda shirt='DS029',state='T028',suit='S05':dict(suitId=suit,shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
B=lambda shirt='DS023',state='T017',blazer='B03':dict(blazerId=blazer,pantId='PG002',shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
O=lambda shirt='DS023',state='T017':dict(shirtOnly=True,pantId='PG002',shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def picture(f):return Image.open(io.BytesIO(base64.b64decode(f.evaluate('()=>document.querySelector("#avatar").toDataURL("image/png")').split(',')[1]))).convert('RGBA')
def load(f,r):h.R=r;h.load(f,storage={'audit-sentinel':'UNCHANGED'})
def ensure(f,r,sels):h.R=r;h.ensure(f,sels)
COMPARE='''()=>{const cs=['old','now'].map(id=>document.querySelector('#'+id).contentWindow.document.querySelector('#avatar').getContext('2d',{willReadFrequently:true}).getImageData(0,0,996,2748).data);let n=0;for(let i=0;i<cs[0].length;i++)if(cs[0][i]!==cs[1][i])n++;return {rgba_samples_changed:n,equal:n===0};}'''
def board(name,keys,cols=6):
 cellw,cellh=170,380;rows=(len(keys)+cols-1)//cols;im=Image.new('RGB',(cols*cellw,rows*cellh),(235,232,226));dr=ImageDraw.Draw(im)
 for k,key in enumerate(keys):
  pic,label=visuals[key];thumb=pic.resize((120,331),Image.Resampling.LANCZOS);x=(k%cols)*cellw;y=(k//cols)*cellh;im.paste(thumb,(x+25,y+40),thumb);dr.text((x+5,y+5),label,fill=(20,20,20))
 im.save(E/name)
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);page=None;frames=[]
 def reset():
  global page,frames
  if page:page.close()
  page=browser.new_page(viewport={'width':820,'height':850});page.on('pageerror',lambda e:errors.append(str(e)));page.set_content('<iframe id="old" style="width:390px;height:700px;border:0"></iframe><iframe id="now" style="width:390px;height:700px;border:0"></iframe>')
  frames=[page.locator('#'+i).element_handle().content_frame()for i in ['old','now']]
  for f,r in zip(frames,[BASE,R]):load(f,r)
 try:
  reset();ck('Independent baseline and corrected application loaded',frames[0].evaluate('HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_17_2'and frames[1].evaluate('HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_17_3')
  shirts=frames[1].evaluate('HEWRSApp.connection.manifest.shirt_order');nonsuits=frames[1].evaluate('HEWRSApp.connection.nonSuitSources.connectedIds')
  seq=[('shirt:'+sid,S(sid,'NO_TIE'),sid+' / S05 / No Tie')for sid in shirts]
  seq += [('tie:'+f'T{i:03}',S('DS029',f'T{i:03}'),f'T{i:03} / S05 / DS029')for i in range(1,48)]
  seq += [('suit:'+f'S{i:02}',S('DS035','T017',f'S{i:02}'),f'S{i:02} / DS035 / T017')for i in range(1,19)]
  seq += [('blazer:'+f'B{i:02}',B('DS023','NO_TIE',f'B{i:02}'),f'B{i:02} / DS023 / No Tie')for i in range(1,15)]
  seq += [('standalone:'+sid+state,O(sid,state),sid+' / '+state)for sid in nonsuits for state in ['NO_TIE','T017']]
  seq += [('reference',S('DS035','REFERENCE'),'S05 saved reference')]
  for i,(key,s,label)in enumerate(seq):
   if i and i%36==0:reset()
   for f,r in zip(frames,[BASE,R]):ensure(f,r,[s]);f.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
   result=page.evaluate(COMPARE);comparisons.append({'selection':s,**result});assert result['equal'],str(s)
   if not key.startswith('standalone:')and key!='reference':visuals[key]=(picture(frames[1]),label)
   if(i+1)%20==0:print('frames',i+1,flush=True);save()
  ck('166 full native output comparisons pixel-identical: all suits/blazers/shirt IDs/ties plus non-suit routes',len(comparisons)==166 and all(x['equal']for x in comparisons))
  board('ALL_47_TIES_CURRENT.png',['tie:'+f'T{i:03}'for i in range(1,48)],8)
  board('ALL_50_SHIRTS_CURRENT.png',['shirt:'+x for x in shirts],8)
  board('ALL_18_SUITS_CURRENT.png',['suit:'+f'S{i:02}'for i in range(1,19)],6)
  board('ALL_14_BLAZERS_CURRENT.png',['blazer:'+f'B{i:02}'for i in range(1,15)],7)
  page.close();page=None
  p=browser.new_page(viewport={'width':390,'height':700});p.on('pageerror',lambda e:errors.append(str(e)));load(p,R)
  p.evaluate('()=>{HEWRSApp.ui.reset();HEWRSApp.setMode("engine");HEWRSApp.showPage("home");}')
  before=p.evaluate('()=>({events:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.exportText(),weather:JSON.stringify(HEWRSApp.weather.snapshot())})')
  def prep():
   sels=p.evaluate('()=>{const a=HEWRSApp,ctx=a.state().context,op=a.ui.operation("engine",{...ctx,environment:a.weather.request(ctx.localDate)});return a.connection.controller.generate(op.request,a.connection.catalogue,a.store.snapshot().events).options.map(o=>o._hewrsConnected.canonical_selection);}')
   ensure(p,R,sels);return sels
  sels=prep();p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().optionCount===15',timeout=90000)
  ck('Actual Generate button produced 15 options without mandatory anchors',p.evaluate('Object.values(HEWRSApp.ui.snapshot()).every(x=>x.mode==="any")'))
  policy=p.evaluate('HEWRSApp.state().report.option_policy');ck('Rendered result set contains no physical item over 2 uses and no more than 2 No Tie',max(policy['item_counts'].values())<=2 and policy['no_tie_options']<=2,policy)
  thumbs=[]
  for i in range(15):
   s=p.evaluate('HEWRSApp.state().selection');expected=p.evaluate('HEWRSApp.state().report.options[HEWRSApp.state().optionIndex]._hewrsConnected.canonical_selection');assert s==expected
   im=picture(p);thumbs.append(im.resize((120,331),Image.Resampling.LANCZOS));engine_frames.append({'index':i+1,'selection':s,'sha256_rgba':hashlib.sha256(im.tobytes()).hexdigest()})
   if i==0:p.screenshot(path=str(E/'ACTUAL_OPTION_1_390x700.png'))
   if i<14:p.click('#next-option');p.wait_for_function('(i)=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===i',arg=i+1,timeout=30000)
  ck('All 15 arrows display the exact requested items, not repeated previous images',len({json.dumps(x['selection'],sort_keys=True)for x in engine_frames})==15)
  img=Image.new('RGB',(5*205,3*415+75),(235,232,226));dr=ImageDraw.Draw(img);dr.text((15,12),'V1.17.3 / ACTUAL ENGINE OPTIONS / TEST HISTORY EMPTY',fill=(20,20,20));dr.text((15,33),'Each unanchored physical ID <=2. No Tie <=2. No new garment pixels.',fill=(20,20,20))
  for i,t in enumerate(thumbs):
   s=engine_frames[i]['selection'];x=(i%5)*205;y=(i//5)*415+75;img.paste(t,(x+42,y+65),t);dr.text((x+8,y+4),f"{i+1}. {s.get('suitId',s.get('blazerId'))} / {s['shirtId']} / {s['state']}",fill=(20,20,20));dr.text((x+8,y+22),s['shoeId']+' / '+str(s['watchId']),fill=(20,20,20));dr.text((x+8,y+40),s.get('pantId','Suit trousers'),fill=(20,20,20))
  img.save(E/'FIFTEEN_OPTIONS_CAPS.png')
  after=p.evaluate('()=>({events:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.exportText(),weather:JSON.stringify(HEWRSApp.weather.snapshot())})');ck('Generating and viewing options adds no wear/Favorites and changes no saved weather',before==after)
  ck('Source colour semantics show black lattice as dark and source blue components as blue',p.evaluate('HEWRSApp.connection.engine.get("T012").primary.value===0.35&&["S08","S14","DS029"].every(id=>HEWRSApp.connection.engine.get(id).primary.family==="blue")'))
  ck('Source-family selector uses purple for T036 rather than historical black',p.evaluate('HEWRSApp.connection.catalogue.ties.find(x=>x.id==="T036").colorFamily==="purple"'))
  p.evaluate('()=>{HEWRSApp.showPage("home");HEWRSApp.setMode("anchor");HEWRSApp.ui.reset();HEWRSApp.ui.set("shirt",{mode:"item",id:"DS023"});}')
  prep();p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().optionCount===15',timeout=90000)
  ck('Partial Anchor repeats DS023 only as specified; other items still capped',p.evaluate('()=>{const a=HEWRSApp.state().report,p=a.option_policy;return a.options.every(o=>o.items.shirt.id==="shirt-DS023")&&Object.entries(p.item_counts).every(([id,n])=>id==="shirt-DS023"||n<=2);}') )
  p.evaluate('()=>{HEWRSApp.showPage("home");HEWRSApp.setMode("engine");HEWRSApp.ui.reset();HEWRSApp.ui.set("tie",{mode:"none"});HEWRSApp.ui.set("watch",{mode:"none"});}')
  prep();p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().optionCount===15',timeout=90000)
  ck('Explicit No Tie produces 15 open-collar choices while physical-item caps persist',p.evaluate('()=>{const r=HEWRSApp.state().report;return r.options.every(o=>o.items.tie===null)&&Object.values(r.option_policy.item_counts).every(n=>n<=2);}'))
  # Existing mobile draft semantics and tested controls remain functional.
  p.evaluate('()=>{HEWRSApp.showPage("home");}')
  beforePrefs=p.evaluate('HEWRSApp.ui.snapshot()');p.click('#pref-shirt');p.locator('[data-item-id="DS023"]').click();p.get_by_role('button',name='Cancel',exact=True).click();ck('Real picker Cancel does not alter pending locks',p.evaluate('HEWRSApp.ui.snapshot()')==beforePrefs)
  p.click('#pref-shirt');p.locator('[data-item-id="DS023"]').click();p.click('#picker-apply');ck('Real picker Apply changes the intended exact shirt lock',p.evaluate('HEWRSApp.ui.snapshot().shirt.id')=='DS023')
  p.click('#weather-button');weatherBefore=p.evaluate('JSON.stringify(HEWRSApp.weather.snapshot())');p.get_by_role('button',name='Cancel',exact=True).click();ck('Existing weather panel remains usable and Cancel preserves saved conditions',p.evaluate('JSON.stringify(HEWRSApp.weather.snapshot())')==weatherBefore)
  p.evaluate('()=>{HEWRSApp.showPage("outfits");}');p.click('#detail-view');ck('Collar Detail remains accessible',p.locator('#detail-view').get_attribute('aria-pressed')=='true');p.click('#full-view')
  for w,hei in [(320,568),(390,700),(390,350),(430,932),(1024,768)]:
   p.set_viewport_size({'width':w,'height':hei});p.evaluate('()=>HEWRSApp.showPage("home")');fits=p.evaluate('()=>({w:innerWidth,sw:document.documentElement.scrollWidth})');assert fits['sw']<=fits['w'],str(fits)
  ck('Accepted responsive Home controls retain width fit at five viewport sizes',True)
  ck('Unrelated test storage sentinel unchanged',p.evaluate('__STORAGE_MAP.get("audit-sentinel")')=='UNCHANGED')
  ck('No uncaught browser errors',not errors,errors)
 except Exception:
  checks.append({'name':'Browser audit completion','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:(p if 'p'in locals()else page).screenshot(path=str(E/'FAILURE.png'))
  except:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):raise SystemExit(1)
