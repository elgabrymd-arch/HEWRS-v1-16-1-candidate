#!/usr/bin/env python3
"""One ordinary localhost/browser-profile attempt, synthetic data only.
A browser administrative block is reported without bypass. No deployment."""
from pathlib import Path
import json,threading,tempfile,http.server,functools,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];E=R/'evidence/suits_auto_weather_v1_17_4';requests=[];checks=[]
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,f,*args):requests.append(f%args)
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(R)));threading.Thread(target=s.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{s.server_port}/';r={'schema':'hewrs.suits-weather.local-origin.v1_17_4','status':'NOT_RUN','scope':__doc__,'checks':checks,'deployment':False,'owner_data_accessed':False}
try:
 with tempfile.TemporaryDirectory(prefix='hewrs_core_')as profile,sync_playwright()as pw:
  b=pw.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  try:
   p=b.pages[0]
   try:p.goto(url,wait_until='domcontentloaded',timeout=15000)
   except Exception as e:r.update(status='BLOCKED'if 'ERR_BLOCKED_BY_ADMINISTRATOR'in str(e)else'NAVIGATION_FAILED',error=str(e));raise
   p.wait_for_function('()=>globalThis.HEWRS_READY===true',timeout=30000)
   d=p.evaluate('HEWRSApp.state().context.localDate');p.evaluate('d=>HEWRSApp.weather.apply({source:"manual",date:d,temperatureBand:"mildWarm",precipitation:"dry",season:"Fall",locationLabel:"Synthetic origin test"})',d)
   before=p.evaluate('localStorage.getItem(HEWRSWeather.KEY)');p.reload(wait_until='domcontentloaded');p.wait_for_function('()=>globalThis.HEWRS_READY===true',timeout=30000);ok=p.evaluate('localStorage.getItem(HEWRSWeather.KEY)')==before;checks.append({'name':'Actual origin weather persistence on reload','passed':ok});assert ok
   b.close();b=pw.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);p=b.pages[0];p.goto(url,wait_until='domcontentloaded',timeout=15000);p.wait_for_function('()=>globalThis.HEWRS_READY===true',timeout=30000);ok=p.evaluate('localStorage.getItem(HEWRSWeather.KEY)')==before;checks.append({'name':'Actual process restart restores weather without touching wear','passed':ok});assert ok;r['status']='PASS'
  finally:b.close()
except Exception as e:
 if r['status']not in ['BLOCKED','NAVIGATION_FAILED']:r.update(status='FAIL',error=str(e),traceback=traceback.format_exc())
finally:s.shutdown();s.server_close();r['http_requests']=requests;(E/'LOCAL_ORIGIN.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
