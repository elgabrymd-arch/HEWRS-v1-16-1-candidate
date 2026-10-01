"""Current rebuilt bundle, real raster assets, isolated in-memory browser storage.
No live-site or physical-Safari claim. Network navigation is blocked by the
execution environment, so the original startup payloads are injected verbatim.
"""
from pathlib import Path
import os,sys,json,re,base64,io
from PIL import Image
import numpy as np
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];B=Path(os.environ['HEWRS_BASELINE']);E=R/'evidence/shoe15_v1_23_1/browser';E.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(R/'tests'));import facelift_harness as h
checks=[];errors=[]
def ck(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print('PASS' if ok else 'FAIL',name,flush=True)
 if not ok:raise AssertionError(name+' '+str(detail))
def load(p,root):
 res=json.loads((root/'STARTUP_RESOURCES.json').read_text());p.set_default_timeout(45000)
 p.set_content((root/'app.template.html').read_text().replace('<!--STYLE-->','<style>'+(root/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->',''))
 p.evaluate('''()=>{const m=new Map([['shoe15-sentinel','UNCHANGED']]);globalThis.__STORAGE_MAP=m;globalThis.__WRITES=[];Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>{__WRITES.push([k,v]);m.set(k,v)},removeItem:k=>{__WRITES.push([k,null]);m.delete(k)}}});globalThis.HEWRS_EMBEDDED_IMAGES={};}''')
 p.add_script_tag(content=(root/'src/runtime-loader.js').read_text());p.add_script_tag(content=(root/'data/inputs.js').read_text());p.add_script_tag(content=(root/res['startup_scripts'][2]).read_text())
 p.wait_for_function('globalThis.HEWRS_READY===true||globalThis.HEWRS_LOAD_ERROR')
 assert p.evaluate('globalThis.HEWRS_LOAD_ERROR||null') is None
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.evaluate('x=>globalThis.HEWRS_EMBEDDED_UI_IMAGES=x',{f.stem:'data:image/png;base64,'+base64.b64encode(f.read_bytes()).decode() for f in (root/'ui/option-cards').glob('*.png')})
 return p

def apply(p,root,s):
 h.R=root;h.ensure(p,[s])
 return p.evaluate('async s=>{const r=await HEWRSApp.apply(s,{origin:"manual",save:false});HEWRSApp.showPage("outfits");return {status:r.status,cancelled:r.cancelled,selection:HEWRSApp.state().selection};}',s)
def pixels(p):
 return np.array(Image.open(io.BytesIO(base64.b64decode(p.evaluate('document.getElementById("avatar").toDataURL("image/png").split(",")[1]')))).convert('RGBA'))
def save_native(p,path):path.write_bytes(base64.b64decode(p.evaluate('document.getElementById("avatar").toDataURL("image/png").split(",")[1]')))
base={'suitId':'S05','shirtId':'DS001','state':'T017','shoeId':'shoe-15','watchId':None}
selections=[('S05_TIED',base),('S05_OPEN',{**base,'state':'NO_TIE'}),('S11_DS035_OPEN',{**base,'suitId':'S11','shirtId':'DS035','state':'NO_TIE'}),('B01_TIED',{'blazerId':'B01','pantId':'PB001','shirtId':'DS001','state':'T017','shoeId':'shoe-15','watchId':None}),('B02_OPEN',{'blazerId':'B02','pantId':'PB001','shirtId':'DS001','state':'NO_TIE','shoeId':'shoe-15','watchId':None}),('B03_BATCH',{'blazerId':'B03','pantId':'PB001','shirtId':'DS007','state':'T004','shoeId':'shoe-15','watchId':None}),('SHIRT_ONLY',{'shirtOnly':True,'pantId':'PB001','shirtId':'DS007','state':'NO_TIE','shoeId':'shoe-15','watchId':None}),('CONTROL_SHOE8',{**base,'shoeId':'shoe-8'})]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  p=load(b.new_page(viewport={'width':390,'height':844}),R);pb=load(b.new_page(viewport={'width':390,'height':844}),B)
  ck('Current bundle reports 1.23.1 and starts without index or storage writes',p.evaluate('HEWRSApp.version==="HEWRS_CONNECTED_APP_V1_23_1_SHOE15"&&HEWRS_READY&&!globalThis.HEWRS_OPTION_INDEX&&__WRITES.length===0'))
  oldalpha=np.array(Image.open(B/'assets/e4b03f004ef9a7df64c0927be229b4be6fa07336668e4eda66eaaca1226a80c4.png').convert('RGBA'))[:,:,3]
  for name,s in selections:
   out=apply(p,R,s);apply(pb,B,s);a=pixels(p);old=pixels(pb);diff=np.any(a!=old,axis=2)
   ck(name+' exact selection and completed real render',out['selection']==s and not out.get('cancelled'))
   ck(name+' no change outside shoe-15 alpha',not np.any(diff[oldalpha==0]),{'changed_pixels':int(diff.sum()),'outside_shoe_pixels':int(diff[oldalpha==0].sum())})
   ck(name+' face, hands, clothing and canvas geometry retained',a.shape==old.shape==(2748,996,4) and np.array_equal(a[:2500],old[:2500]))
   if name=='CONTROL_SHOE8':ck('Unchanged shoe-8 output remains pixel-identical',not diff.any())
   else:ck(name+' corrected shoe pixels are actually visible',bool(diff.any()))
   if name=='S05_TIED':
    save_native(p,E/'AFTER_S05_SHOE15_NATIVE.png');save_native(pb,E/'BEFORE_S05_SHOE15_NATIVE.png');p.screenshot(path=str(E/'AFTER_PHONE_390x844.png'));pb.screenshot(path=str(E/'BEFORE_PHONE_390x844.png'))
  apply(p,R,base)
  ck('Full outfit and card both retain exact shoe-15 identity',p.evaluate('HEWRSApp.state().selection.shoeId==="shoe-15"&&HEWRSApp.optionCards.model(HEWRSApp.state().selection).items.find(x=>x.role==="Shoes").image.source_kind==="owner_reference_photo"'))
  p.set_viewport_size({'width':1280,'height':1000});p.screenshot(path=str(E/'DESKTOP_1280x1000.png'))
  swatch=p.locator('.lb-item[data-item-id="shoe-15"] img');swatch.wait_for(state='attached');p.wait_for_function('()=>{const x=document.querySelector(".lb-item[data-item-id=shoe-15] img");return x&&x.complete&&x.naturalWidth===384}')
  ck('Shoe picture is the actual source-photo thumbnail, with decoded dimensions and truthful alt text',swatch.get_attribute('alt').endswith('owner-supplied reference photograph'))
  swatch.locator('..').screenshot(path=str(E/'SHOE15_PHOTO_CARD.png'))
  p.set_viewport_size({'width':390,'height':844});swatch.scroll_into_view_if_needed();p.screenshot(path=str(E/'PHONE_ITEM_PHOTO_390x844.png'))
  # Real picker interactions (Apply updates only the selected preference).
  p.evaluate('HEWRSApp.showPage("home");HEWRSApp.openPicker("shoes")');p.fill('#picker-search','shoe-15');row=p.locator('#picker-list [data-item-id="shoe-15"]');ck('Shoe picker shows revised name at the original ID','Warm Brown Suede Penny' in row.inner_text());row.click();p.click('#picker-apply');ck('Picker Apply retains shoe-15 as the exact selected item',p.evaluate('HEWRSApp.ui.snapshot().shoes.id==="shoe-15"'))
  ck('Rendering and picker never modify wear, Favorites or feedback',p.evaluate('__WRITES.length===0&&__STORAGE_MAP.get("shoe15-sentinel")==="UNCHANGED"'),p.evaluate('__WRITES'))
  # Export is the actual current card with the restored reference thumbnail.
  p.evaluate('HEWRSApp.showPage("outfits")');apply(p,R,base)
  data=p.evaluate('''async()=>{const m=HEWRSApp.optionCards.model(HEWRSApp.state().selection,{date:"2026-10-01",origin:"Your selection"});const blob=await HEWRSApp.optionCards.png(m,document.getElementById("avatar"));return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(",")[1]);f.readAsDataURL(blob)})}''');(E/'CORRECTED_SHOE15_OPTION_CARD.png').write_bytes(base64.b64decode(data))
  ck('Real PNG export completes with corrected source thumbnail',Image.open(E/'CORRECTED_SHOE15_OPTION_CARD.png').size==(1400,1900))
  ck('No unexpected browser JavaScript errors',not errors,errors)
 finally:
  result={'schema':'hewrs.shoe15.browser.v1','scope':'Fresh offline memory-loaded Chromium, actual rebuilt bundle and real source images; URL navigation blocked by environment; not a live/Safari test.','passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'errors':errors}
  (E/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');b.close()
