#!/usr/bin/env python3
"""Exact scripts/PNGs loaded in-memory. Not hosted, real storage or physical Safari.
Run with HEWRS_BASELINE_V1162 pointing to an independent V1.16.2 source folder.
"""
import os,io,json,time,base64,hashlib,traceback,sys
sys.dont_write_bytecode=True
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];BASE=Path(os.environ['HEWRS_BASELINE_V1162']);E=R/'evidence/edges_v1_16_3/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];reg=[];changed=[];errors=[];start=time.monotonic()
def save():
 (E/'RESULT.json').write_text(json.dumps({'schema':'hewrs.ds023-edges.chromium.v1_16_3','loading':'Memory-loaded actual scripts and PNGs in Chromium; isolated Map storage, not hosted/restart/physical-device acceptance.','passed':sum(c['passed']for c in checks),'failed':sum(not c['passed']for c in checks),'checks':checks,'unaffected_frames':reg,'changed_route_frames':changed,'errors':errors,'elapsed_seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+' '+str(detail))
def S(suit='S05',shirt='DS036',state='T017'):return dict(suitId=suit,shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def B(bid='B03',shirt='DS023',state='T017',pant='PG002'):return dict(blazerId=bid,shirtId=shirt,state=state,pantId=pant,shoeId='shoe-8',watchId=None)
def O(shirt='DS023',state='T017',pant='PG002'):return dict(shirtOnly=True,shirtId=shirt,state=state,pantId=pant,shoeId='shoe-8',watchId=None)
def uniq(xs):return list({json.dumps(x,sort_keys=True):x for x in xs}.values())
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sh,p in hashes.items():
  if sh in present:continue
  b64=base64.b64encode((h.R/p).read_bytes()).decode();batch[sh]=b64;size+=len(b64)
  if size>2_000_000:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
def load(p,r):h.R=r;h.load(p,storage={'edge_sentinel':'UNTOUCHED'})
def ensure(p,r,ss):h.R=r;h.ensure(p,ss)
def run(p,s):p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
def pixels(p):return Image.open(io.BytesIO(base64.b64decode(p.evaluate('document.querySelector("#avatar").toDataURL()').split(',')[1]))).convert('RGBA')
def sh(im):return hashlib.sha256(im.tobytes()).hexdigest()
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=browser.new_page(viewport={'width':390,'height':844});old=browser.new_page(viewport={'width':390,'height':844});p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R);load(old,BASE)
  ck('V1.16.3 loads with exact current controller and version',p.evaluate('HEWRS_READY&&HEWRSApp.version==="HEWRS_CONNECTED_APP_V1_16_3"&&document.title.endsWith("V1.16.3")'))
  for page,root,suffix in [(old,BASE,'BEFORE'),(p,R,'AFTER')]:
   ensure(page,root,[O()]);run(page,O());page.evaluate('HEWRSApp.showPage("outfits")');page.click('#detail-view')
   assert page.locator('#detail-view').get_attribute('aria-pressed')=='true'
   assert page.locator('#stage').evaluate('e=>e.classList.contains("detail")')
   page.screenshot(path=str(E/('COLLAR_DETAIL_UI_'+suffix+'_390x844.png')))
   page.locator('#stage').screenshot(path=str(E/('COLLAR_DETAIL_STAGE_'+suffix+'.png')))
   pixels(page).save(E/('DS023_T017_'+suffix+'.png'))
   page.click('#full-view');assert page.locator('#detail-view').get_attribute('aria-pressed')=='false'
  ck('Actual Collar Detail and Full Outfit controls switch on corrected render',True)
  before=Image.open(E/'DS023_T017_BEFORE.png').convert('RGBA');after=Image.open(E/'DS023_T017_AFTER.png').convert('RGBA')
  font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
  board=Image.new('RGB',(864,775),(34,34,34));draw=ImageDraw.Draw(board)
  for i,(label,f)in enumerate([('V1.16.2 — BEFORE',before),('V1.16.3 — AFTER',after)]):
   x=i*432;draw.text((x+14,12),label,font=font,fill=(240,240,240));z=f.crop((370,345,635,735)).resize((424,624),Image.Resampling.LANCZOS);board.paste(z,(x+4,42),z)
   z=f.resize((36,99),Image.Resampling.LANCZOS);board.paste(z,(x+24,674),z);draw.text((x+75,695),'Same original RGB',font=font,fill=(220,220,220));draw.text((x+75,724),'Local transparency trim',font=font,fill=(220,220,220))
  board.save(E/'DS023_T017_EDGE_COMPARISON.png')
  connected=p.evaluate('HEWRSApp.connection.nonSuitSources.connectedIds');others=[i for i in connected if i!='DS023']
  controls=[S('S'+str(i).zfill(2),shirt,t)for i in range(1,19)for shirt,t in [('DS023','T017'),('DS023','NO_TIE'),('DS035','T017'),('DS035','NO_TIE'),('DS051','T017')]]
  controls+=[s for i in others for t in ['NO_TIE','T017']for s in [O(i,t),B(shirt=i,state=t)]]
  controls+=[B('B'+str(i).zfill(2),'DS014',t)for i in range(1,15)for t in ['NO_TIE','T017']]+[S('S05','DS035','REFERENCE')]
  controls+=[O(state='NO_TIE')]+[B('B'+str(i).zfill(2),state='NO_TIE')for i in range(1,15)];controls=uniq(controls)
  for i,s in enumerate(controls):
   ensure(p,R,[s]);ensure(old,BASE,[s]);run(p,s);run(old,s);aa=pixels(p);bb=pixels(old);equal=aa.tobytes()==bb.tobytes();reg.append({'selection':s,'before_sha256':sh(bb),'after_sha256':sh(aa),'equal':equal})
   if not equal:raise AssertionError('Unaffected change '+str(s))
   if(i+1)%25==0:print('UNCHANGED',i+1,'/',len(controls),flush=True);save()
  ck('200 unaffected frames exactly match V1.16.2 including all 18 suit and DS023 NO_TIE blazer controls',len(reg)==200 and all(x['equal']for x in reg))
  ties=['T'+str(i).zfill(3)for i in range(1,48)];pants=p.evaluate('HEWRSApp.connection.blazerConnection.pantIds')
  matrix=uniq([s for t in ties for s in [O(state=t),B(state=t)]]+[B('B'+str(i).zfill(2))for i in range(1,15)]+[O(pant=q)for q in pants])
  for i,s in enumerate(matrix):
   ensure(p,R,[s]);ensure(old,BASE,[s]);run(p,s);run(old,s);a=np.array(pixels(p));b=np.array(pixels(old));diff=np.any(a!=b,axis=2);roi=np.zeros(diff.shape,bool);roi[398:586,386:619]=True;assert not np.any(diff&~roi),'Changed outside local matte region'
   assert p.evaluate('HEWRSApp.renderer.last()')==s and p.evaluate('document.querySelector("#avatar").dataset.status')=='ready'
   changed.append({'selection':s,'changed_pixels':int(diff.sum()),'outside_local_region_changed':0,'face_above_y398_equal':bool(np.array_equal(a[:398],b[:398])),'all_pixels_y586_and_below_equal':bool(np.array_equal(a[586:],b[586:]))})
   if(i+1)%25==0:print('LOCAL',i+1,'/',len(matrix),flush=True);save()
  ck('130 changed-route exercises complete; all changes within the local neck/knot region',len(changed)==130 and all(x['outside_local_region_changed']==0 for x in changed))
  old.close()
  ck('Protected upper face and lower outfit pixels remain exact',all(x['face_above_y398_equal']and x['all_pixels_y586_and_below_equal']for x in changed))
  p.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.showPage("home");HEWRSApp.setMode("anchor");}',O())
  snap=p.evaluate('HEWRSApp.ui.snapshot()');p.click('#pref-tie');p.locator('[data-item-id="T028"]').click();p.keyboard.press('Escape');ck('Cancel keeps complete preferences',p.evaluate('HEWRSApp.ui.snapshot()')==snap)
  p.click('#pref-tie');p.locator('[data-item-id="T028"]').click();p.click('#picker-apply');a=p.evaluate('HEWRSApp.ui.snapshot()');ck('Apply changes only requested tie',a['tie']['id']=='T028'and all(snap[k]==a[k]for k in snap if k!='tie'))
  p.click('#pref-shirt');ck('Picker remains 18 connected / 32 gated / 50 IDs',p.locator('[data-item-id]').count()==50 and p.locator('[data-item-id][disabled]').count()==32);p.keyboard.press('Escape')
  run(p,O());frame=sh(pixels(p));ledger=p.evaluate('HEWRSApp.store.exportText()')
  err=p.evaluate('async()=>{try{await HEWRSApp.apply({shirtOnly:true,pantId:"PG002",shirtId:"DS036",state:"NO_TIE",shoeId:"shoe-8",watchId:null},{save:false});return null;}catch(e){return e.code;}}');ck('Unsupported selection keeps last good frame and raw ledger',err=='NON_SUIT_SOURCE_COVERAGE_UNBOUND'and sh(pixels(p))==frame and p.evaluate('HEWRSApp.store.exportText()')==ledger)
  ensure(p,R,[O(state='NO_TIE'),O(state='T047')])
  res=p.evaluate('''async()=>{const c=HEWRSApp.connection,cv=document.createElement('canvas');const r=HEWRSAtomicRenderer.create(cv,c,{resolveUrl:d=>d.sha256===c.ds023Edges.layers.T017.layer.sha256?'data:image/png;base64,AA==':HEWRSApp.resolveUrl(d)});const s={shirtOnly:true,pantId:'PG002',shirtId:'DS023',state:'NO_TIE',shoeId:'shoe-8',watchId:null};await r.render(s);const b=cv.toDataURL();let failed=false;try{await r.render({...s,state:'T017'});}catch(e){failed=true;}return{failed,retained:b===cv.toDataURL()};}''');ck('Failed edge image load cannot publish partial output',res['failed']and res['retained'],res)
  p.evaluate('''async()=>{const s={shirtOnly:true,pantId:'PG002',shirtId:'DS023',shoeId:'shoe-8',watchId:null};await Promise.all(['T017','NO_TIE','T047'].map(state=>HEWRSApp.apply({...s,state},{save:false})));}''');ck('Rapid tied/open selection publishes latest complete state',p.evaluate('HEWRSApp.renderer.last().state')=='T047')
  ck('Synthetic ledger and sentinel unchanged by render tests',p.evaluate('HEWRSApp.store.exportText()')==ledger and p.evaluate('__STORAGE_MAP.get("edge_sentinel")')=='UNTOUCHED')
  dims=p.evaluate('({h:innerHeight,sh:document.documentElement.scrollHeight,w:innerWidth,sw:document.documentElement.scrollWidth})');ck('Home remains one screen at 390x844',dims['sh']<=dims['h']and dims['sw']<=dims['w'],dims)
  ck('No uncaught runtime errors',not errors,errors)
 except Exception:
  checks.append({'name':'Browser suite completed','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except Exception:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):raise SystemExit(1)
