#!/usr/bin/env python3
"""Default handoff regression: local HTTP and isolated synthetic browser records.
Never contacts a paid provider or opens the owner's browser/profile.
"""
import base64,functools,hashlib,json,threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
E=R/'evidence/standard_handoff';E.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass

def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(R)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 origin='http://127.0.0.1:'+str(server.server_address[1]);checks=[];errors=[];external=[]
 def ck(name,value):
  checks.append({'name':name,'passed':bool(value)})
  print(('PASS ' if value else 'FAIL ')+name,flush=True)
  assert value,name
 def pixel(p):
  return hashlib.sha256(base64.b64decode(p.evaluate("document.getElementById('avatar').toDataURL('image/png')").split(',')[1])).hexdigest()
 def openpage(ctx,path):
  p=ctx.new_page();p.set_default_timeout(60000);p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(origin+path,wait_until='domcontentloaded')
  p.wait_for_function('globalThis.HEWRS_READY===true && !!globalThis.HEWRSReviewedIntegration')
  return p
 def fixture_context(browser):
  c=browser.new_context(viewport={'width':390,'height':844})
  def route(r):
   if r.request.url.startswith(origin+'/'): r.continue_()
   else: external.append(r.request.url);r.abort()
  c.route('**/*',route);return c
 def run(p,style):
  p.evaluate("HEWRSApp.showPage('home')")
  p.click('#style-button');p.select_option('#style-select',style);p.get_by_role('button',name='Apply',exact=True).click()
  p.click('#generate-options')
  p.wait_for_function("style=>{const s=HEWRSApp.state();return !s.busy&&s.page==='outfits'&&s.request?.executiveStyle===style&&Array.isArray(s.report?.options);}",arg=style,timeout=360000)
  return p.evaluate("()=>{const s=HEWRSApp.state();return {count:s.optionCount,rows:s.report.options.map(o=>({selection:o._hewrsConnected.canonical_selection,score:o._hewrsConnected.compatibility.score,style:o._hewrsConnected.compatibility.style.classification})),valid:HEWRSApp.connection.controller.verifyOptionSet(s.report.options,s.request),avatar:document.getElementById('avatar').dataset.status};}")
 try:
  with sync_playwright() as pw:
   b=pw.chromium.launch(headless=True,args=['--no-sandbox'])
   old=fixture_context(b);new=fixture_context(b)
   p=openpage(old,'/stage10-integration.html');q=openpage(new,'/')
   for style in ('AUTO','MODERN'):
    a=run(p,style);d=run(q,style)
    ck(style+' Work returns 20 valid options from default address',d['count']==20 and d['valid'])
    ck(style+' ordered outfits, scores and classifications match accepted page',a==d)
    ck(style+' first native avatar is pixel-identical',pixel(p)==pixel(q))
   q.screenshot(path=str(E/'default-modern-390x844.png'),full_page=True)
   old.close();new.close()
   ctx=fixture_context(b);p=openpage(ctx,'/stage10-integration.html')
   s={'suitId':'S05','shirtId':'DS036','state':'T017','shoeId':'shoe-8','watchId':None}
   p.evaluate("s=>HEWRSApp.apply(s,{origin:'manual'})",s)
   p.click('[data-page="rotation"]');p.click('#favorites-button');p.click('#save-favorite');p.get_by_role('button',name='Close',exact=True).click()
   p.evaluate("s=>HEWRSApp.store.addEvent(HEWRSApp.connection.createHistoryEvent(s,{id:'SYNTHETIC_HANDOFF_ONLY',localDate:HEWRSApp.state().context.localDate,origin:'manual'}))",s)
   p.click('[data-page="home"]');p.click('#pref-tie');p.locator('[data-item-id="NO_TIE"]').click();p.click('#picker-apply')
   stored=p.evaluate('()=>Object.fromEntries(Object.entries(localStorage))')
   state=p.evaluate('()=>({wear:HEWRSApp.store.snapshot(),favorites:HEWRSApp.favorites.snapshot(),preferences:HEWRSApp.ui.snapshot()})')
   p.goto(origin+'/',wait_until='domcontentloaded');p.wait_for_function('globalThis.HEWRS_READY===true')
   ck('Same-origin handoff preserves all saved storage bytes',p.evaluate('()=>Object.fromEntries(Object.entries(localStorage))')==stored)
   ck('Favorite IDs, synthetic wear ledger and NO TIE preference preserved',p.evaluate('()=>({wear:HEWRSApp.store.snapshot(),favorites:HEWRSApp.favorites.snapshot(),preferences:HEWRSApp.ui.snapshot()})')==state)
   ck('Restored NO TIE remains distinct from Engine Choice',p.evaluate("HEWRSApp.ui.snapshot().tie.mode==='none'"))
   p.click('[data-page="rotation"]');p.click('#favorites-button');p.locator('[data-favorite-open]').first.click()
   p.wait_for_function("document.getElementById('avatar').dataset.status==='ready'")
   ck('Saved favorite opens with unchanged exact selection',p.evaluate('HEWRSApp.state().selection')==s)
   p.goto(origin+'/app.html',wait_until='domcontentloaded');p.wait_for_function('globalThis.HEWRS_READY===true')
   ck('Alternate app.html also loads accepted Standard',p.evaluate("HEWRSApp.version==='HEWRS_COMBINED_V1_25_0_R1_STAGE10' && !!HEWRSApp.ownerFeedback"))
   ck('No real-provider request or external transfer',not external)
   ck('No JavaScript page errors',not errors)
   ctx.close();b.close()
 finally:
  server.shutdown();server.server_close()
  report={'scope':__doc__,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'errors':errors,'external_requests':external,'owner_browser_accessed':False}
  (E/'RESULT.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
if __name__=='__main__': main()
