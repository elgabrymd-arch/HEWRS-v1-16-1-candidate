#!/usr/bin/env python3
"""New source renderer failure/race handling and deferred watch display."""
from pathlib import Path
import json,base64,traceback
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];E=R/'evidence/release_v1_16_1/EDGE_BROWSER.json';checks=[]
IDs=['DS006','DS002','DS027']
selections=[dict(shirtOnly=True,pantId='PG002',shirtId=id,state='NO_TIE',shoeId='shoe-8',watchId=None)for id in IDs]
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'))
 for sha,path in hashes.items():
  if sha not in present:page.evaluate('x=>{HEWRS_EMBEDDED_IMAGES[x.sha]=x.b64;}',{'sha':sha,'b64':base64.b64encode((R/path).read_bytes()).decode()})
h.supply=supply;h.R=R
with sync_playwright()as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);p=browser.new_page(viewport={'width':390,'height':844})
 try:
  h.load(p,storage={'edge-sentinel':'UNCHANGED'},preload=selections)
  result=p.evaluate('''async ss=>{const c=HEWRSApp.connection,v=document.createElement('canvas'),bad=c.batch10.shirts.DS002.modes.no_tie.base.sha256;const r=HEWRSAtomicRenderer.create(v,c,{resolveUrl:d=>d.sha256===bad?'data:image/png;base64,INVALID':'data:image/png;base64,'+HEWRS_EMBEDDED_IMAGES[d.sha256]});await r.render(ss[0]);const before=v.toDataURL();let rejected=false;try{await r.render(ss[1]);}catch(e){rejected=true;}return {rejected,pixels_preserved:before===v.toDataURL(),last:r.last(),status:v.dataset.status};}''',selections)
  checks.append({'name':'Failed new image decode retains the previous whole frame and selection','passed':result['rejected']and result['pixels_preserved']and result['last']==selections[0]and result['status']=='error-retained','detail':result})
  result=p.evaluate('''async ss=>{const c=HEWRSApp.connection,v=document.createElement('canvas'),ref=document.createElement('canvas'),opt={resolveUrl:d=>'data:image/png;base64,'+HEWRS_EMBEDDED_IMAGES[d.sha256]},r=HEWRSAtomicRenderer.create(v,c,opt),control=HEWRSAtomicRenderer.create(ref,c,opt);const a=r.render(ss[1]),b=r.render(ss[2]);const results=await Promise.all([a,b]);await control.render(ss[2]);return {first:results[0],second:results[1].status,last:r.last(),pixels_equal:v.toDataURL()===ref.toDataURL()};}''',selections)
  checks.append({'name':'Superseded new batch render cancels; latest request alone commits','passed':result['first'].get('cancelled')is True and result['second']=='ready'and result['last']==selections[2]and result['pixels_equal'],'detail':result})
  s={**selections[0],'watchId':'watch-P05'};p.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);text=p.locator('#representation').text_content();name=p.evaluate('HEWRSApp.connection.catalogue.watches.find(x=>x.id==="watch-P05").name')
  checks.append({'name':'Watch ID and name display without requiring an image','passed':'watch-P05'in text and name in text,'detail':text})
  checks.append({'name':'Renderer-only edge tests create no wear events or sentinel changes','passed':p.evaluate('HEWRSApp.store.snapshot().events.length===0&&__STORAGE_MAP.get("edge-sentinel")==="UNCHANGED"')})
 except Exception:checks.append({'name':'Edge browser completion','passed':False,'error':traceback.format_exc()})
 finally:browser.close()
result={'schema':'hewrs.release.edge-browser.v1_16_1','scope':'Actual browser/image decoding with memory-loaded files and synthetic storage; not hosted/restart acceptance','passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'checks':checks};E.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if result['failed']:raise SystemExit(1)
