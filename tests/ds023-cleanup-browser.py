#!/usr/bin/env python3
"""V1.16.2 actual-script/image Chromium tests. In-memory origin, synthetic storage.
No hosted/deployed, browser-process-restart or physical iPhone/Safari claim.
"""
from pathlib import Path
import os, json, base64, hashlib, io, time, traceback
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from scipy import ndimage
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];BASE=Path(os.environ['HEWRS_BASELINE_V1161']);E=R/'evidence/ds023_v1_16_2/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];reg=[];exercises=[];differences=[];errors=[];start=time.monotonic()
def save():
 (E/'RESULT.json').write_text(json.dumps({'schema':'hewrs.ds023.chromium.v1_16_2','scope':'Actual scripts and PNGs through in-memory Chromium. Synthetic test storage, not hosted or device acceptance.','passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks,'unchanged_regressions':reg,'ds023_render_exercises':exercises,'before_after':differences,'errors':errors,'seconds':round(time.monotonic()-start,2)},indent=2)+'\n')
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS 'if ok else'FAIL ')+name,flush=True);save()
 if not ok:raise AssertionError(name+': '+str(detail))
def S(suit='S05',shirt='DS023',state='T017'):return dict(suitId=suit,shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def B(b='B03',shirt='DS023',state='NO_TIE',pant='PG002'):return dict(blazerId=b,pantId=pant,shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def O(shirt='DS023',state='NO_TIE',pant='PG002'):return dict(shirtOnly=True,pantId=pant,shirtId=shirt,state=state,shoeId='shoe-8',watchId=None)
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hashes.items():
  if sha in present:continue
  val=base64.b64encode((h.R/path).read_bytes()).decode();batch[sha]=val;size+=len(val)
  if size>2_000_000:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch);batch={};size=0
 if batch:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',batch)
h.supply=supply
def ensure(page,r,sels):h.R=r;h.ensure(page,sels)
def load(page,r):h.R=r;h.load(page,storage={'ds023-test-sentinel':'UNCHANGED'})
def run(page,s):return page.evaluate('s=>HEWRSApp.apply(s,{save:false})',s)
def im(page):return Image.open(io.BytesIO(base64.b64decode(page.evaluate('document.querySelector("#avatar").toDataURL("image/png")').split(',')[1]))).convert('RGBA')
def sha(image):return hashlib.sha256(image.tobytes()).hexdigest()
def prefs(page,s):page.evaluate('s=>{HEWRSApp.ui.fromSelection(s);HEWRSApp.showPage("home");HEWRSApp.setMode("anchor");}',s)
def unique(items):return list({json.dumps(s,sort_keys=True):s for s in items}.values())
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=browser.new_page(viewport={'width':390,'height':844});old=browser.new_page(viewport={'width':390,'height':844});p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,R);load(old,BASE)
  ck('New application loads with exact V1.16.2 identity',p.evaluate('HEWRS_READY&&HEWRSApp.version==="HEWRS_CONNECTED_APP_V1_16_2"&&document.title.endsWith("V1.16.2")'))
  # Main before/after controls saved first, before bulk regression evidence.
  controls=[O(state='T017'),O(),B(state='T017'),B()];ensure(p,R,controls);ensure(old,BASE,controls)
  native={};new_images={};before_images={}
  for s in controls:
   run(p,s);run(old,s);a,b=im(p),im(old);k=('shirt-only' if s.get('shirtOnly')else'B03')+'_'+s['state'];a.save(E/(k+'_AFTER.png'));b.save(E/(k+'_BEFORE.png'));new_images[k]=a;before_images[k]=b
   aa,bb=np.array(a),np.array(b);changed=np.any(aa!=bb,axis=2);ys,xs=np.where(changed)
   differences.append({'selection':s,'before_rgba_sha256':sha(b),'after_rgba_sha256':sha(a),'changed_pixels':int(changed.sum()),'bounds':None if not len(xs)else[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],'protected_face_equal':bool(np.array_equal(aa[:398],bb[:398])),'below_hands_equal':bool(np.array_equal(aa[1390:],bb[1390:]))})
  ck('Protected face and all pixels below the hands remain exact in all four controls',all(x['protected_face_equal']and x['below_hands_equal'] for x in differences),differences)
  d=json.loads((R/'data/ds023-cleanup.json').read_text());data=json.loads((R/'data/inputs.json').read_text());bl=json.loads((R/'data/blazer-connection.json').read_text())
  orig=np.array(Image.open(R/d['modes']['tied']['baseline']['url']).convert('RGBA'));Y,X=np.indices(orig.shape[:2]);region=(Y>870)&(Y<1200)&(((X>140)&(X<240))|((X>745)&(X<865)))
  core=(np.ptp(orig[:,:,:3].astype(float),axis=2)<15)&(orig[:,:,:3].mean(2)>140)&(orig[:,:,3]>0)&region
  actual=np.array(new_images['shirt-only_T017']);actual_no=np.array(new_images['shirt-only_NO_TIE'])
  ck('Previously opaque neutral wedges are transparent in both actual shirt-only frames',int(core.sum())>15000 and not actual[core,3].any() and not actual_no[core,3].any(),{'sampled_background_pixels':int(core.sum())})
  avatar=np.array(Image.open(R/data['assets'][data['manifest']['static']['avatar']['sha256']]).convert('RGBA'))
  repaired=np.array(Image.open(R/d['modes']['tied']['base']['url']).convert('RGBA'))
  changed_neck=(Y<535)&(orig[:,:,3]>0)&(repaired[:,:,3]==0)&(avatar[:,:,3]==255)
  batch=json.loads((R/'data/batch10.json').read_text());paths={**data['assets'],**bl['assetPaths'],**batch['assetPaths']};overlay=Image.new('RGBA',(996,2748))
  for desc in [batch['ties']['T017'],batch['shirts']['DS023']['modes']['tied']['left'],batch['shirts']['DS023']['modes']['tied']['right']]:overlay.alpha_composite(Image.open(R/paths[desc['sha256']]).convert('RGBA'))
  free=changed_neck&(np.array(overlay)[:,:,3]==0)
  ck('Tied neckline exposes unchanged avatar skin rather than a duplicate opaque shirt block',int(free.sum())>0 and np.array_equal(actual[free],avatar[free]),{'unoccluded_neck_pixels':int(free.sum())})
  pant=np.array(Image.open(R/bl['pants']['PG002']['layer']['url']).convert('RGBA'));waist=(Y>=1210)&(Y<1240)&(pant[:,:,3]==255)
  ck('Exact existing trouser pixels now own the shirt-only waistband overlap',np.array_equal(actual[waist],pant[waist]) and np.array_equal(actual_no[waist],pant[waist]),{'waist_pixels':int(waist.sum()),'new_waistband_artwork':False})
  # Before/after at exact 120px whole-outfit presentation. No generated examples.
  font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
  sheet=Image.new('RGB',(1008,380),(38,38,38));draw=ImageDraw.Draw(sheet)
  for i,k in enumerate(new_images):
   x=i*252;draw.text((x+5,4),k.replace('_',' '),font=font,fill=(245,245,245));draw.text((x+5,24),'BEFORE',font=font,fill=(220,220,220));draw.text((x+131,24),'AFTER',font=font,fill=(220,220,220))
   for j,frame in enumerate([before_images[k],new_images[k]]):
    z=frame.resize((120,331),Image.Resampling.LANCZOS);sheet.paste(z,(x+5+j*126,45),z)
  sheet.save(E/'DS023_BEFORE_AFTER_PHONE.png')
  # Unaffected baseline output including the SAME shirt under EVERY suit.
  connected=p.evaluate('HEWRSApp.connection.nonSuitSources.connectedIds');other=[id for id in connected if id!='DS023']
  regressions=[S('S'+str(i).zfill(2),shirt,state)for i in range(1,19)for shirt,state in [('DS023','T017'),('DS023','NO_TIE'),('DS035','NO_TIE'),('DS035','T017'),('DS051','T017')]]
  regressions+=[sel for id in other for t in ['NO_TIE','T017']for sel in [O(id,t),B(shirt=id,state=t)]]
  regressions+=[B('B'+str(i).zfill(2),'DS014',t)for i in range(1,15)for t in ['NO_TIE','T017']]
  regressions+=[S('S05','DS035','REFERENCE')];regressions=unique(regressions)
  for i,s in enumerate(regressions):
   ensure(p,R,[s]);ensure(old,BASE,[s]);run(p,s);run(old,s);a,b=im(p),im(old);a_hash,b_hash=sha(a),sha(b);equal=a.tobytes()==b.tobytes();reg.append({'selection':s,'before_rgba_sha256':b_hash,'after_rgba_sha256':a_hash,'equal':equal})
   if not equal:raise AssertionError('Unaffected output changed: '+str(s))
   if(i+1)%25==0:print('UNCHANGED',i+1,'/',len(regressions),flush=True);save()
  ck('All unaffected control frames are pixel-identical, including DS023 under all 18 suits',all(x['equal']for x in reg),{'frames':len(reg)})
  old.close()
  states=['NO_TIE']+['T'+str(i).zfill(3)for i in range(1,48)];pants=p.evaluate('HEWRSApp.connection.blazerConnection.pantIds')
  matrix=[O(state=t)for t in states]+[B('B'+str(i).zfill(2),state=t)for i in range(1,15)for t in ['NO_TIE','T017']]+[B(state=t)for t in states]+[s for pantid in pants for s in [O(pant=pantid),B(pant=pantid)]];matrix=unique(matrix)
  ensure(p,R,matrix)
  for i,s in enumerate(matrix):
   run(p,s);last=p.evaluate('HEWRSApp.renderer.last()');status=p.evaluate('document.querySelector("#avatar").dataset.status');assert last==s and status=='ready';exercises.append(s)
   if(i+1)%30==0:print('DS023',i+1,'/',len(matrix),flush=True);save()
  ck('DS023 all 48 shirt-only/B03 states, all 14 blazer controls, all 24 trouser IDs render',len(exercises)==len(matrix),{'render_exercises':len(matrix)})
  prefs(p,O());p.click('#pref-shirt');ck('Picker retains 18 connected and 32 gated shirts',p.locator('[data-item-id]').count()==50 and p.locator('[data-item-id][disabled]').count()==32);p.keyboard.press('Escape')
  # Native interaction still applies/cancels one tie selection only.
  before=p.evaluate('HEWRSApp.ui.snapshot()');p.click('#pref-tie');p.locator('[data-item-id="T017"]').click();p.keyboard.press('Escape');ck('Picker Cancel keeps all preferences unchanged',p.evaluate('HEWRSApp.ui.snapshot()')==before)
  p.click('#pref-tie');p.locator('[data-item-id="T017"]').click();p.click('#picker-apply');after=p.evaluate('HEWRSApp.ui.snapshot()');ck('Picker Apply changes only the requested tie',after['tie']['id']=='T017'and all(after[k]==before[k]for k in before if k!='tie'))
  target=O(state='T017');run(p,target);frame=sha(im(p));ledger=p.evaluate('HEWRSApp.store.exportText()')
  msg=p.evaluate('async()=>{try{await HEWRSApp.apply({shirtOnly:true,pantId:"PG002",shirtId:"DS036",state:"NO_TIE",shoeId:"shoe-8",watchId:null},{save:false});return null;}catch(e){return e.code;}}')
  ck('Unsupported selection preserves corrected frame and raw ledger',msg=='NON_SUIT_SOURCE_COVERAGE_UNBOUND' and frame==sha(im(p)) and ledger==p.evaluate('HEWRSApp.store.exportText()'))
  # Failure and cancellation on isolated renderer, not owner history.
  ensure(p,R,[O(state='T047')])
  result=p.evaluate('''async()=>{let failed=false;const c=HEWRSApp.connection,cv=document.createElement('canvas');const r=HEWRSAtomicRenderer.create(cv,c,{resolveUrl:d=>{if(d.sha256===c.ds023Cleanup.modes.tied.base.sha256)return 'data:image/png;base64,AA==';return HEWRSApp.resolveUrl(d);}});await r.render({shirtOnly:true,pantId:'PG002',shirtId:'DS023',state:'NO_TIE',shoeId:'shoe-8',watchId:null});const before=cv.toDataURL();try{await r.render({shirtOnly:true,pantId:'PG002',shirtId:'DS023',state:'T017',shoeId:'shoe-8',watchId:null});}catch(e){failed=true;}return{failed,frame_retained:before===cv.toDataURL()};}''')
  ck('Failed corrected image load does not publish a partial frame',result['failed']and result['frame_retained'],result)
  p.evaluate('''async()=>{const s={shirtOnly:true,pantId:'PG002',shirtId:'DS023',shoeId:'shoe-8',watchId:null};await Promise.all([HEWRSApp.apply({...s,state:'NO_TIE'},{save:false}),HEWRSApp.apply({...s,state:'T017'},{save:false}),HEWRSApp.apply({...s,state:'T047'},{save:false})]);}''')
  ck('Rapid tied/open switching retains latest complete DS023 frame',p.evaluate('HEWRSApp.renderer.last().state')=='T047')
  # All writes here are explicitly isolated synthetic test data.
  p.evaluate('''()=>{const s={shirtOnly:true,pantId:'PG002',shirtId:'DS023',state:'T017',shoeId:'shoe-8',watchId:null};HEWRSApp.store.addEvent(HEWRSApp.connection.createHistoryEvent(s,{id:'DS023_SYNTHETIC_TEST',localDate:'2026-09-24',origin:'manual'}));}''')
  event=p.evaluate('HEWRSApp.store.snapshot().events.at(-1)');ck('Synthetic wear event keeps DS023/tie/trouser IDs',event['items']['shirt']['id']=='shirt-DS023'and event['items']['tie']['id']=='T017'and event['items']['pants']['id']=='pants-PG002')
  run(p,O(state='T017'));p.evaluate('HEWRSApp.showPage("outfits")');p.screenshot(path=str(E/'DS023_OUTFIT_390x844.png'));p.click('#collar-view') if p.locator('#collar-view').count() else None
  prefs(p,O());p.screenshot(path=str(E/'HOME_390x844.png'));dims=p.evaluate('({h:innerHeight,sh:document.documentElement.scrollHeight,w:innerWidth,sw:document.documentElement.scrollWidth})');ck('Home remains within one 390x844 screen',dims['sh']<=dims['h']and dims['sw']<=dims['w'],dims)
  ck('Synthetic storage sentinel unchanged',p.evaluate('__STORAGE_MAP.get("ds023-test-sentinel")')=='UNCHANGED')
  ck('No uncaught browser errors',not errors,errors)
 except Exception:
  checks.append({'name':'Browser suite completed','passed':False,'error':traceback.format_exc()});print(traceback.format_exc(),flush=True)
  try:p.screenshot(path=str(E/'FAILURE.png'))
  except Exception:pass
 finally:save();browser.close()
if any(not x['passed']for x in checks):raise SystemExit(1)
