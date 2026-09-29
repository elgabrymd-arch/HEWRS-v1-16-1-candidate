#!/usr/bin/env python3
"""Real local compositor and UI, isolated synthetic storage. Not hosted/iOS certification."""
import os,sys,json,io,base64,hashlib,traceback,textwrap,time
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];B=Path(os.environ['HEWRS_BASELINE']);E=R/'evidence/twenty_ties_v1_21_0/browser';E.mkdir(parents=True,exist_ok=True)
boards=E/'boards';boards.mkdir(exist_ok=True);checks=[];comparisons=[];frames=[];errors=[];started=time.time()
M=json.loads((E.parent/'MATRIX_target.json').read_text())['rows'];by={x['id']:x for x in M}
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15);SM=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12);BF=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',23)
def save():
 (E/'RESULT.json').write_text(json.dumps(dict(passed=sum(x['passed']for x in checks),failed=sum(not x['passed']for x in checks),checks=checks,unchanged_frames=comparisons,navigated_frames=frames,scope='Actual local app modules and original images in memory-loaded Chromium. Synthetic storage and no live provider.',errors=errors,seconds=round(time.time()-started,1)),indent=2))
def ck(name,ok,detail=None):
 checks.append(dict(name=name,passed=bool(ok),detail=detail));save();print('PASS'if ok else'FAIL',name,flush=True)
 if not ok:raise AssertionError(name+': '+str(detail))
def load(p,r):h.R=r;h.load(p,storage={'tie20-sentinel':'UNCHANGED'});p.set_default_timeout(60000)
def ensure(p,r,s):h.R=r;h.ensure(p,s)
def apply(p,s):return p.evaluate('s=>HEWRSApp.apply(s,{save:false,localDate:"2026-09-29"})',s)
def im(p):return Image.open(io.BytesIO(base64.b64decode(p.evaluate("document.querySelector('#avatar').toDataURL('image/png').split(',')[1]")))).convert('RGBA')
def sel(o):return o['_hewrsConnected']['canonical_selection']
def itemtitle(item):return (item.get('name') or item.get('color') or item['id']) if item else 'None'
def board(name,arr):
 n=len(arr);out=Image.new('RGB',(1250,78+670*((n+4)//5)),(244,243,239));d=ImageDraw.Draw(out);d.text((16,10),name+' / V1.21.0 / '+str(n)+' ACTUAL OPTIONS',font=BF,fill=(23,28,32));d.text((16,47),'Controlled empty history / no weather restriction / exact item IDs; watches listed, not pictured',font=SM,fill=(70,70,70))
 for i,(o,img)in enumerate(arr):
  x=(i%5)*250;y=78+(i//5)*670;s=sel(o);d.rectangle((x,y,x+248,y+668),outline=(196,194,190));d.text((x+10,y+9),f'{i+1:02d}  '+(s.get('suitId')or s.get('blazerId')),font=F,fill=(20,25,28));th=img.resize((165,455),Image.Resampling.LANCZOS);out.paste(th,(x+42,y+33),th);yy=y+492
  for role in ['shirt','tie','pants','shoes','watch']:
   it=o['items'].get(role)
   if role=='pants'and not it:continue
   text=(it['id']+' — '+itemtitle(it))if it else 'No tie'if role=='tie'else 'No watch'
   for line in textwrap.wrap(text,31)[:2]:d.text((x+8,yy),line,font=SM,fill=(26,30,35));yy+=15
  d.text((x+8,y+645),'Local styling estimate — not live AI',font=SM,fill=(88,88,85))
 out.save(boards/(name+'_OPTIONS.jpg'),quality=91,subsampling=0)
 return out
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  # Bound decoded-image lifetime: fifteen controls per page pair.
  g=browser.new_page();load(g,R);ids=g.evaluate('HEWRSApp.connection.nonSuitSources.connectedIds');g.close();controls=[]
  for shirt in ids:
   for tie in ['NO_TIE','T017']:
    controls += [dict(blazerId='B03',pantId='PG002',shirtId=shirt,state=tie,shoeId='shoe-8',watchId=None),dict(shirtOnly=True,pantId='PG002',shirtId=shirt,state=tie,shoeId='shoe-8',watchId=None)]
  controls += [dict(suitId=f'S{i:02}',shirtId='DS023',state='T017',shoeId='shoe-8',watchId=None)for i in range(1,19)]
  for offset in range(0,len(controls),15):
   p=browser.new_page(viewport={'width':390,'height':700});old=browser.new_page(viewport={'width':390,'height':700});load(p,R);load(old,B)
   for s in controls[offset:offset+15]:
    ensure(p,R,[s]);ensure(old,B,[s]);apply(p,s);apply(old,s);a=im(p).tobytes();b=im(old).tobytes();comparisons.append(dict(selection=s,equal=a==b,rgba_sha256=hashlib.sha256(a).hexdigest()));assert a==b,s
   p.close();old.close();print('PIXELS',len(comparisons),flush=True);save()
  ck('90 original outfit frames byte-identical including DS023, all suits and18 non-suit shirts',len(comparisons)==90 and all(x['equal']for x in comparisons))
  outputs={}
  for tag in ['FREE','S10','B14']:
   p=browser.new_page(viewport={'width':390,'height':700});p.on('pageerror',lambda e:errors.append(str(e)));load(p,R);row=by[tag];expected=row['result']['options'];ensure(p,R,[sel(o)for o in expected]);apply(p,sel(expected[0]))
   p.evaluate('top=>{HEWRSApp.ui.reset();if(top)HEWRSApp.ui.set("topwear",{mode:"item",id:top});HEWRSApp.connection.hybrid.setMode("research");HEWRSApp.showPage("home");HEWRSApp.setMode("engine");HEWRSApp.weather.apply({source:"not_assessed",date:"2026-09-29"});}',None if tag=='FREE'else row['q']['prefs']['topwear']['id'])
   p.click('#generate-options');p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"',timeout=240000)
   st=p.evaluate('HEWRSApp.state()');actual=st['report']['options'];ck(tag+' actual Generate matches independently executed Node options',[sel(x)for x in actual]==[sel(x)for x in expected],{'returned':len(actual),'requested':st['report']['requested_options']})
   ck(tag+' request has correct exact locks and20 target',st['request']['limit']==20 and (all(v['mode']=='any'for v in st['request']['prefs'].values()) if tag=='FREE'else st['request']['prefs']==row['q']['prefs']))
   count={};nt=0
   for o in actual:
    tid=o['items'].get('tie',{});tid=tid['id']if tid else None
    if tid:count[tid]=count.get(tid,0)+1
    else:nt+=1
   ck(tag+' independent counters: each tie once and no-tie at most2',max(count.values(),default=0)<=1 and nt<=2)
   # All navigation positions are real UI actions, not relabelled static frames.
   while p.evaluate('HEWRSApp.state().optionIndex')>0:
    index=p.evaluate('HEWRSApp.state().optionIndex');p.click('#prev-option');p.wait_for_function('n=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===n',arg=index-1)
   arr=[]
   for i,o in enumerate(actual):
    if i:p.click('#next-option');p.wait_for_function('n=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===n',arg=i)
    s=sel(o);assert p.evaluate('HEWRSApp.renderer.last()')==s;img=im(p);arr.append((o,img));frames.append(dict(case=tag,position=i+1,selection=s,rgba_sha256=hashlib.sha256(img.tobytes()).hexdigest()));save()
   board(tag,arr);outputs[tag]=[dict(position=i+1,selection=sel(o),items=o['items'])for i,o in enumerate(actual)]
   if tag=='FREE':p.screenshot(path=str(E/'OPTION20_390x700.png'));p.click('#detail-view');p.screenshot(path=str(E/'COLLAR_390x700.png'));p.click('#full-view')
   if tag=='B14':ck('B14 shortfall is explained by8 source-eligible physical trousers at2 uses',len(actual)==16 and '8 source-eligible physical trousers' in p.locator('#outfit-summary').inner_text())
   ck(tag+' generation/viewing does not add wear or Favorites',p.evaluate('HEWRSApp.store.snapshot().events.length')==0 and len(p.evaluate('HEWRSApp.favorites.snapshot().favorites||[]'))==0)
   if tag!='B14':p.close()
  ck('56 generated positions navigated with exact item identities',len(frames)==56)
  ck('Displayed summary states tie-once rule', 'ties: once per list'in p.locator('#outfit-summary').inner_text())
  p.evaluate('HEWRSApp.stylistSheet()');ck('Method selector advertises20 without silently enabling paid AI','up to 20'in p.locator('#stylist-method').inner_text()and p.evaluate('HEWRSApp.connection.hybrid.mode()')=='research');p.locator('#fx-sheet-close').click()
  # Family / formality and long-result lists are validated by Node; verify unchanged sheet layout at real rendered sizes.
  sizes=[]
  for w,hh in [(320,568),(390,350),(390,700),(430,932),(1024,768)]:
   p.set_viewport_size(dict(width=w,height=hh));p.evaluate('HEWRSApp.stylistSheet()');box=p.get_by_text('Apply method',exact=True).bounding_box();sizes.append(dict(width=w,height=hh,pass_=bool(box and box['y']>=0 and box['y']+box['height']<=hh+1 and p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))));p.locator('#fx-sheet-close').click()
  ck('Apply and Cancel accessible at5 viewport sizes without horizontal scrolling',all(x['pass_']for x in sizes),sizes)
  p.set_viewport_size(dict(width=390,height=700));before=p.evaluate('({p:HEWRSApp.ui.snapshot(),s:HEWRSApp.state().selection,e:HEWRSApp.store.snapshot().events,f:HEWRSApp.favorites.snapshot()})');p.evaluate('HEWRSApp.stylistSheet()');p.select_option('#stylist-method','curated');p.locator('#fx-sheet-close').click();after=p.evaluate('({p:HEWRSApp.ui.snapshot(),s:HEWRSApp.state().selection,e:HEWRSApp.store.snapshot().events,f:HEWRSApp.favorites.snapshot()})');ck('Method Cancel preserves outfit/preferences/history/Favorites',before==after and p.evaluate('HEWRSApp.connection.hybrid.mode()')=='research')
  ck('No uncaught browser errors; unrelated synthetic storage unchanged',not errors and p.evaluate('__STORAGE_MAP.get("tie20-sentinel")')=='UNCHANGED',errors)
  (E/'ITEMIZED_OUTPUTS.json').write_text(json.dumps(outputs,indent=2));p.close()
 except Exception:
  checks.append(dict(name='Browser completed',passed=False,detail=traceback.format_exc()));print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):sys.exit(1)
