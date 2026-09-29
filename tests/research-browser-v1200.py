#!/usr/bin/env python3
"""Actual current source/images through in-memory Chromium, isolated synthetic data.
No live site, physical iPhone, provider call or image generation is asserted.
"""
import os,sys,json,base64,io,hashlib,time,traceback,textwrap
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];BASE=Path(os.environ['HEWRS_BASELINE']);E=R/'evidence/research_v1_20_0/browser';E.mkdir(parents=True,exist_ok=True)
BOARDS=E/'boards';BOARDS.mkdir(exist_ok=True);FRAMES=E/'frames';FRAMES.mkdir(exist_ok=True)
checks=[];comparisons=[];observed=[];errors=[];start=time.monotonic()
def save():
 (E/'PASS4_BROWSER.json').write_text(json.dumps({'scope':'Actual local executable scripts/images in memory-loaded Chromium. Synthetic wear/Favorites/storage; no hosted or physical-device certification.','checks':checks,'passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'unchanged_frame_comparisons':comparisons,'navigated_new_frames':observed,'errors':errors,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+': '+str(detail))
def supply(page,hashes):
 have=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};n=0
 for k,f in hashes.items():
  if k in have:continue
  v=base64.b64encode((h.R/f).read_bytes()).decode();batch[k]=v;n+=len(v)
  if n>2000000:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};n=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
def load(p,r,storage=None,preload=None):h.R=r;h.load(p,storage=storage if storage is not None else {'research-sentinel':'UNCHANGED'},preload=preload)
def ensure(p,r,s):h.R=r;h.ensure(p,s)
def im(p):return Image.open(io.BytesIO(base64.b64decode(p.evaluate("document.querySelector('#avatar').toDataURL('image/png').split(',')[1]")))).convert('RGBA')
def digest(p):return hashlib.sha256(im(p).tobytes()).hexdigest()
def apply(p,s):return p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
FONT=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16);BOLD=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',21);SMALL=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
def selection(o):return o['_hewrsConnected']['canonical_selection']
def label(s):return ' / '.join(str(x)for x in [s.get('suitId',s.get('blazerId','Shirt-only')),s['shirtId'],s['state'],s.get('pantId'),s['shoeId'],s['watchId']]if x is not None)
def tile(canvas,draw,frame,s,x,y,w=250,h=700,title=''):
 draw.rectangle((x,y,x+w-1,y+h-1),outline=(180,181,179),width=1);draw.text((x+10,y+8),title,font=FONT,fill=(35,38,40))
 thumb=frame.resize((170,469),Image.Resampling.LANCZOS);canvas.paste(thumb,(x+(w-170)//2,y+32),thumb)
 lines=textwrap.wrap(label(s),max(30,(w-20)//8))
 for j,line in enumerate(lines):draw.text((x+10,y+509+j*18),line,font=SMALL,fill=(25,28,30))
 meta=DETAILS.get(json.dumps(s,sort_keys=True),{})
 offset=y+514+18*len(lines)
 for role in ['shirt','tie','shoes']:
  item=meta.get(role);name=(item.get('name')or item.get('color')or item.get('id'))if item else 'No tie'if role=='tie'else ''
  for line in textwrap.wrap(role.title()+': '+name,max(28,(w-20)//8))[:2]:
   draw.text((x+10,offset),line,font=SMALL,fill=(45,49,50));offset+=16

def board(tag,items,title):
 sheet=Image.new('RGB',(1250,70+700*3),(240,240,236));d=ImageDraw.Draw(sheet);d.text((16,12),title,font=BOLD,fill=(22,28,33));d.text((16,42),'Actual wardrobe renders | controlled no-weather / empty-history test | watches listed, not pictured',font=SMALL,fill=(65,66,66))
 for i,(s,f)in enumerate(items):tile(sheet,d,f,s,(i%5)*250,70+(i//5)*700,title=f'{i+1:02d}')
 sheet.save(BOARDS/(tag+'_15_OPTIONS.jpg'),quality=93,subsampling=0)
 return sheet
CONF={'automatic':True,'stylistMode':'research','preferences':{k:{'mode':'any'}for k in ['topwear','shirt','tie','shoes','bottoms','watch']},'occasion':'clinic','formality':'any','style':'AUTO','localDate':'2026-09-28','environment':{'source':'not_assessed','date':'2026-09-28'}}
# Node completed topwear matrix is independent of browser execution.
for _ in range(180):
 try:
  matrix=json.loads((E.parent/'PASS3_ALL32_OUTPUTS.json').read_text());free=json.loads((E.parent/'NO_ANCHOR.json').read_text())
  if len(matrix)==32:break
 except (FileNotFoundError,json.JSONDecodeError):pass
 time.sleep(2)
else:raise RuntimeError('Complete current Node matrix unavailable')
DETAILS={}
for row in matrix+[{'research':free['after'],'baseline_curated':free['before'],'baseline_heuristic':free['heuristic']}]:
 for key in ['research','baseline_curated','baseline_heuristic']:
  for o in row[key]['result']['options']:DETAILS[json.dumps(selection(o),sort_keys=True)]=o['items']
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=browser.new_page(viewport={'width':390,'height':700});old=browser.new_page(viewport={'width':390,'height':700});p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R);load(old,BASE);ck('New app loads research generator; independent V1.19.0 loads curated default',p.evaluate('HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_20_0'and p.evaluate('HEWRSApp.connection.hybrid.mode()')=='research'and old.evaluate('HEWRSApp.connection.hybrid.mode()')=='curated')
  ids=p.evaluate('HEWRSApp.connection.nonSuitSources.connectedIds');controls=[]
  for sid in ids:
   for tie in ['NO_TIE','T017']:
    controls.extend([{'blazerId':'B03','pantId':'PG002','shirtId':sid,'state':tie,'shoeId':'shoe-8','watchId':None},{'shirtOnly':True,'pantId':'PG002','shirtId':sid,'state':tie,'shoeId':'shoe-8','watchId':None}])
  controls.extend([{'suitId':f'S{i:02}','shirtId':'DS023','state':'T017','shoeId':'shoe-8','watchId':None}for i in range(1,19)])
  for n,s in enumerate(controls):
   ensure(p,R,[s]);ensure(old,BASE,[s]);apply(p,s);apply(old,s);a,b=digest(p),digest(old);comparisons.append({'selection':s,'equal':a==b,'current_rgba':a,'baseline_rgba':b})
   if a!=b:raise AssertionError('Changed outfit pixels '+label(s))
   if(n+1)%15==0:print('PIXELS',n+1,flush=True);save()
  ck('90 existing outfit frames pixel-identical, including DS023 under every suit',len(comparisons)==90 and all(x['equal']for x in comparisons))
  # Actual Home Generate button and exact next/previous navigation. No manual substitution.
  old.close()
  jobs=[{'id':'NO_ANCHOR','research':free['after'],'baseline_curated':free['before'],'baseline_heuristic':free['heuristic']},*matrix];summary=[]
  for row in jobs:
   # Bound decoded image/cache memory in the test harness; app sources unchanged.
   p.close();p=browser.new_page(viewport={'width':390,'height':700});p.on('pageerror',lambda e:errors.append(str(e)));load(p,R)
   old=browser.new_page(viewport={'width':390,'height':700});load(old,BASE)
   wanted=[selection(o)for o in row['research']['result']['options']];ensure(p,R,wanted)
   p.evaluate('top=>{HEWRSApp.ui.reset();if(top)HEWRSApp.ui.set("topwear",{mode:"item",id:top});HEWRSApp.connection.hybrid.setMode("research");HEWRSApp.showPage("home");HEWRSApp.setMode("engine");}',None if row['id']=='NO_ANCHOR'else row['research']['q']['prefs']['topwear']['id'])
   # Explicit date for reproducibility while preserving the visible workflow.
   p.evaluate('()=>{HEWRSApp.weather.apply({source:"not_assessed",date:"2026-09-28"});}')
   p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"',timeout=90000)
   state=p.evaluate('HEWRSApp.state()');assert state['optionCount']==15,(row['id'],state['report'])
   expected=set(json.dumps(s,sort_keys=True)for s in wanted);actual=[selection(o)for o in state['report']['options']]
   assert actual==wanted,(row['id'],'Browser vs Node list mismatch')
   assert all(v['mode']=='any'for v in state['request']['prefs'].values())if row['id']=='NO_ANCHOR'else state['request']['prefs']['topwear']['mode']=='item'
   # Navigate starts at remembered index on repeat request; use real arrow until0.
   while p.evaluate('HEWRSApp.state().optionIndex')>0:
    prev=p.evaluate('HEWRSApp.state().optionIndex');p.click('#prev-option');p.wait_for_function('i=>HEWRSApp.state().optionIndex===i&&!HEWRSApp.state().busy',arg=prev-1)
   frames=[]
   for i,s in enumerate(wanted):
    if i:
     p.click('#next-option');p.wait_for_function('i=>HEWRSApp.state().optionIndex===i&&!HEWRSApp.state().busy',arg=i,timeout=30000)
    assert p.evaluate('HEWRSApp.renderer.last()')==s
    image=im(p);frames.append((s,image));observed.append({'topwear_test':row['id'],'index':i+1,'selection':s,'rgba':hashlib.sha256(image.tobytes()).hexdigest()})
    if row['id']in ['NO_ANCHOR','S01','S02','S03','S10','B06','B13']:
     # Native frame, lossless pixels; other full boards remain available.
     image.save(FRAMES/f'{row["id"]}_{i+1:02}.png')
   board(row['id'],frames,row['id']+' | RESEARCH-BASED GENERATOR | 15 OPTIONS')
   # Previous default and previous wide-pool heuristic first two actual same-source frames.
   comp=Image.new('RGB',(1500,80+700*2),(240,240,236));d=ImageDraw.Draw(comp);d.text((15,13),row['id']+' | V1.19 CURATED / V1.19 HEURISTIC / NEW GENERATOR',font=BOLD,fill=(25,28,30))
   d.text((15,48),'Not a live-AI result. Old and new use the same wardrobe, context and empty test history.',font=SMALL,fill=(65,67,69))
   for col,key in enumerate(['baseline_curated','baseline_heuristic','research']):
    options=row[key]['result']['options'];labelhead=['V1.19 Curated','V1.19 Heuristic','V1.20 Local rules'][col]
    for j,o in enumerate(options[:2]):
     s=selection(o)
     if key=='research':z=frames[j][1]
     else:ensure(old,BASE,[s]);apply(old,s);z=im(old)
     tile(comp,d,z,s,col*500,j*700+80,w=500,title=labelhead+f' ({len(options)} available) / {j+1}')
   comp.save(BOARDS/(row['id']+'_BEFORE_AFTER.jpg'),quality=93,subsampling=0)
   summary.append({'id':row['id'],'current':15,'old_curated':len(row['baseline_curated']['result']['options']),'matches_independent_node':True})
   old.close();print('ALL FIFTEEN',row['id'],flush=True);save()
  ck('Actual Generate and navigation:15 outputs on all32 anchors plus true unanchored',len(summary)==33 and len(observed)==495,summary)
  ck('Displayed method and score clearly identify local researched rules, not AI or source grades','Research-informed fit' in p.locator('#score-label').inner_text()and'no live AI'in p.locator('#outfit-summary').inner_text())
  p.click('#details-button');ck('Outfit Details contains reasoning and exact item IDs',bool(p.locator('#fx-sheet').inner_text().find('pattern')>=0 or p.locator('#fx-sheet').inner_text().find('tie')>=0));p.locator('#fx-sheet-close').click()
  p.click('#score-button');scoretxt=p.locator('#fx-sheet').inner_text();ck('Score details retains original compatibility and separate rule components','original' in scoretxt.lower()and 'reference_structure' in scoretxt);p.locator('#fx-sheet-close').click()
  p.click('#detail-view');p.screenshot(path=str(E/'COLLAR_DETAIL_390x700.png'));p.click('#full-view')
  before=p.evaluate('({e:HEWRSApp.store.snapshot().events,f:HEWRSApp.favorites.snapshot(),p:HEWRSApp.ui.snapshot(),s:HEWRSApp.state().selection})')
  p.evaluate('HEWRSApp.stylistSheet()');p.select_option('#stylist-method','curated');p.locator('#fx-sheet-close').click()
  ck('Settings Cancel preserves mode, preferences, image selection, wear and favorites',p.evaluate('HEWRSApp.connection.hybrid.mode()')=='research'and before==p.evaluate('({e:HEWRSApp.store.snapshot().events,f:HEWRSApp.favorites.snapshot(),p:HEWRSApp.ui.snapshot(),s:HEWRSApp.state().selection})'))
  p.evaluate('HEWRSApp.stylistSheet()');p.select_option('#stylist-method','visual');p.get_by_text('Apply method',exact=True).click();ck('Paused private AI cannot activate and never falls back silently',p.evaluate('HEWRSApp.connection.hybrid.mode()')=='research'and'not connected'in p.locator('#fx-sheet').inner_text());p.locator('#fx-sheet-close').click()
  sizes=[(320,568),(390,350),(390,700),(430,932),(1024,768)];cases=[]
  for w,hh in sizes:
   p.set_viewport_size({'width':w,'height':hh});p.evaluate('HEWRSApp.stylistSheet()');b=p.get_by_text('Apply method',exact=True).bounding_box();ok=b and b['y']>=0 and b['y']+b['height']<=hh+1 and p.evaluate('document.documentElement.scrollWidth<=innerWidth+1');cases.append({'size':[w,hh],'pass':bool(ok)});p.locator('#fx-sheet-close').click()
  ck('Method panel Apply/Cancel remains accessible at5 screen sizes',all(x['pass']for x in cases),cases)
  p.set_viewport_size({'width':390,'height':700});p.evaluate('HEWRSApp.showPage("home");HEWRSApp.stylistSheet()');p.screenshot(path=str(E/'METHOD_390x700.png'));p.locator('#fx-sheet-close').click()
  # Upgrade old finite-default setting without modifying the old key.
  newp=browser.new_page(viewport={'width':390,'height':700});load(newp,R,{'hewrs:stylist-mode:v1':'curated','research-sentinel':'UNCHANGED'})
  newp.evaluate('HEWRSApp.stylistSheet()');ck('Upgrade explains broad-generator default and preserves old saved mode for rollback',newp.evaluate('HEWRSApp.connection.hybrid.mode()')=='research'and newp.evaluate('__STORAGE_MAP.get("hewrs:stylist-mode:v1")')=='curated'and'old saved method'in newp.locator('#fx-sheet').inner_text())
  newp.select_option('#stylist-method','curated');newp.get_by_text('Apply method',exact=True).click();ck('Explicit finite-reference selection persists to separate mode key',newp.evaluate('__STORAGE_MAP.get("hewrs:stylist-mode:v2")')=='curated');newp.close()
  newp=browser.new_page(viewport={'width':390,'height':700});load(newp,R,{'hewrs:stylist-mode:v2':'curated'});ck('Explicit finite-library preference survives reconstruction and is not relabelled',newp.evaluate('HEWRSApp.connection.hybrid.mode()')=='curated');newp.close()
  key=p.evaluate('HEWRSLocalState.KEY');bad=browser.new_page(viewport={'width':390,'height':700});load(bad,R,{key:'{BAD_HISTORY_TEST_ONLY'})
  result=bad.evaluate('async conf=>{try{await HEWRSApp.generate(conf);return "BAD";}catch(e){return e.message;}}',CONF);ck('Unreadable history blocks generation without losing raw bytes',result!='BAD'and bad.evaluate('k=>__STORAGE_MAP.get(k)',key)=='{BAD_HISTORY_TEST_ONLY');bad.close()
  ck('Generation/navigation never add confirmed wear or Favorites',p.evaluate('HEWRSApp.store.snapshot().events.length')==0 and len(p.evaluate('HEWRSApp.favorites.snapshot().favorites||[]'))==0)
  ck('No uncaught browser errors; sentinel unchanged',not errors and p.evaluate('__STORAGE_MAP.get("research-sentinel")')=='UNCHANGED',errors)
 except Exception:
  checks.append({'name':'Browser completion','passed':False,'detail':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):raise SystemExit(1)
