#!/usr/bin/env python3
"""One genuine localhost/persistent-profile attempt using synthetic records.
A blocked navigation is reported, not bypassed. No public site or owner data."""
from pathlib import Path
import tempfile,json,threading,functools,http.server,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];E=R/'evidence/insights_v1_16_7';checks=[];requests=[]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,format,*args):requests.append(format%args)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(R)))
threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
result={'schema':'hewrs.insights.local-origin.v1_16_7','scope':__doc__,'status':'NOT_RUN','checks':checks,'owner_data_accessed':False,'deployment_performed':False}
def ck(name,ok):
 checks.append({'name':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
try:
 with tempfile.TemporaryDirectory(prefix='hewrs_insights_synthetic_')as profile,sync_playwright()as pw:
  context=pw.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  try:
   p=context.pages[0]
   try:p.goto(url,wait_until='domcontentloaded',timeout=15000)
   except Exception as e:
    result.update(status='BLOCKED'if'ERR_BLOCKED_BY_ADMINISTRATOR'in str(e)else'NAVIGATION_FAILED',error=str(e));raise
   p.wait_for_function('()=>globalThis.HEWRS_READY===true',timeout=30000)
   ck('Version loaded over actual localhost',p.evaluate('HEWRSApp.version')=='HEWRS_CONNECTED_APP_V1_16_7')
   p.evaluate('''()=>{HEWRSApp.store.addEvent(HEWRSApp.connection.createHistoryEvent(HEWRSApp.state().selection,{id:'SYNTHETIC_INSIGHTS_LOCAL',localDate:'2026-09-27',origin:'manual'}));}''')
   before=p.evaluate('localStorage.getItem(HEWRSLocalState.KEY)')
   def inspect(page):
    page.evaluate('HEWRSApp.showPage("rotation")');page.click('#insights-button');page.locator('#insights-through').fill('2026-09-27');page.locator('#insights-through').press('Tab');page.locator('#insights-range').select_option('all');return page.locator('#insights-summary .fx-stat-number').all_text_contents()==['1','1']and page.evaluate('localStorage.getItem(HEWRSLocalState.KEY)')==before
   ck('Insights reads genuine localStorage without writing it',inspect(p))
   p.reload(wait_until='domcontentloaded');p.wait_for_function('()=>globalThis.HEWRS_READY===true',timeout=30000);ck('Page reload reproduces statistics from unchanged stored records',inspect(p))
   context.close();context=None;context=pw.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);p=context.pages[0];p.goto(url,wait_until='domcontentloaded',timeout=15000);p.wait_for_function('()=>globalThis.HEWRS_READY===true',timeout=30000);ck('Browser-process restart reproduces unchanged synthetic ledger counts',inspect(p));result['status']='PASS'
  finally:
   if context:context.close()
except Exception as e:
 if result['status']not in['BLOCKED','NAVIGATION_FAILED']:result.update(status='FAIL',error=str(e),traceback=traceback.format_exc())
finally:
 server.shutdown();server.server_close();result['http_request_count']=len(requests);result['requests']=requests;(E/'LOCAL_ORIGIN.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if result['status']=='FAIL':raise SystemExit(1)
