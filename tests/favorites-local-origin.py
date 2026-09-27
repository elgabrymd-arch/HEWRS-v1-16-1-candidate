#!/usr/bin/env python3
"""One genuine local HTTP-origin / persistent-profile test of Favorites.
All records are synthetic. No external hosting, device or owner-data claim.
A blocked navigation is reported as BLOCKED, not bypassed or counted as a pass.
"""
from pathlib import Path
import tempfile,json,threading,functools,http.server,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];E=R/'evidence/favorites_v1_16_6';checks=[];requests=[]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,format,*args):requests.append(format%args)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(R)))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();url=f'http://127.0.0.1:{server.server_port}/'
result={'schema':'hewrs.favorites.local-origin.v1_16_6','scope':__doc__,'status':'NOT_RUN','checks':checks,'owner_data_accessed':False,'deployment_performed':False}
def ck(name,ok):
 checks.append({'name':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
try:
 with tempfile.TemporaryDirectory(prefix='hewrs_favorite_synthetic_') as profile,sync_playwright() as pw:
  context=pw.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  try:
   p=context.pages[0]
   try:p.goto(url,wait_until='domcontentloaded',timeout=20000)
   except Exception as e:
    result.update(status='BLOCKED' if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(e) else 'NAVIGATION_FAILED',error=str(e));raise
   p.wait_for_function('globalThis.HEWRS_READY===true',timeout=30000)
   ck('Current build loaded over actual localhost origin',p.evaluate('HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_16_6')
   # Generate only an explicitly synthetic test fixture inside this temp profile.
   p.evaluate('''()=>{HEWRSApp.store.addEvent(HEWRSApp.connection.createHistoryEvent(HEWRSApp.state().selection,{id:'SYNTHETIC_LOCAL_FAVORITES',localDate:'2026-09-27',origin:'manual'}));HEWRSApp.showPage('rotation');}''')
   old=p.evaluate('HEWRSApp.store.exportText()');p.click('#favorites-button');p.click('#save-favorite')
   saved=p.evaluate('HEWRSApp.favorites.exportText()');ck('Favorite saved to real localStorage without changing wear/session bytes',p.evaluate('localStorage.getItem(HEWRSFavorites.KEY)!==null') and p.evaluate('HEWRSApp.store.exportText()')==old)
   p.reload(wait_until='domcontentloaded');p.wait_for_function('globalThis.HEWRS_READY===true',timeout=30000)
   ck('Actual page reload retains Favorites and synthetic wear count',p.evaluate('HEWRSApp.favorites.exportText()')==saved and p.evaluate('HEWRSApp.store.exportText()')==old)
   context.close();context=None
   context=pw.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   p=context.pages[0];p.goto(url,wait_until='domcontentloaded',timeout=20000);p.wait_for_function('globalThis.HEWRS_READY===true',timeout=30000)
   ck('Actual browser-process restart retains Favorites and synthetic wear count',p.evaluate('HEWRSApp.favorites.exportText()')==saved and p.evaluate('HEWRSApp.store.exportText()')==old)
   result['status']='PASS'
  finally:
   if context:context.close()
except Exception as e:
 if result['status'] not in ['BLOCKED','NAVIGATION_FAILED']:result.update(status='FAIL',error=str(e),traceback=traceback.format_exc())
finally:
 server.shutdown();server.server_close();result['http_request_count']=len(requests);result['requests']=requests
 (E/'LOCAL_ORIGIN.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if result['status']=='FAIL':raise SystemExit(1)
