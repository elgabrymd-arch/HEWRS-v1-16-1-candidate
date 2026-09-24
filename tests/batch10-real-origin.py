#!/usr/bin/env python3
"""Isolated localhost origin and process-restart test of actual static files.
Never injects a storage mock or relaxes browser/security policy. Never accesses
an existing browser profile. An administrator block is a blocked check, not pass.
"""
import os,json,time,tempfile,threading,traceback
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
E=Path(os.environ.get('HEWRS_V115_ORIGIN',str(R/'evidence/batch10_v1_15/REAL_ORIGIN.json')))
E.parent.mkdir(parents=True,exist_ok=True)
requests=[]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(R),**kwargs)
 def log_message(self,fmt,*args):requests.append(fmt%args)
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
result={'schema':'hewrs.real-origin-check.v1_15','status':'NOT_COMPLETED','scope':'Separate temporary Chromium profile, actual localhost HTTP, actual localStorage; no physical Safari/iPhone claim.', 'url':url,'checks':[],'requests':requests,'application_loaded':False,'storage_mocked':False,'policy_modified':False}
started=time.monotonic()
def check(name,ok):
 result['checks'].append({'name':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def ready(page):
 page.goto(url,wait_until='load',timeout=30000)
 page.wait_for_function('()=>globalThis.HEWRS_READY===true||globalThis.HEWRS_LOAD_ERROR',timeout=30000)
 if page.evaluate('globalThis.HEWRS_LOAD_ERROR||null'):raise RuntimeError(page.evaluate('HEWRS_LOAD_ERROR'))
with tempfile.TemporaryDirectory(prefix='hewrs-v115-isolated-')as profile:
 with sync_playwright()as pw:
  context=None
  try:
   context=pw.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'],viewport={'width':390,'height':844})
   page=context.pages[0];ready(page);result['application_loaded']=True
   check('Actual static package loads from localhost origin',True)
   check('Real localStorage is available without a test replacement',page.evaluate('HEWRSApp.store.status().persistent&&localStorage instanceof Storage'))
   page.evaluate('''()=>{localStorage.setItem('hewrs-v115-test-sentinel','UNCHANGED');const a=HEWRSApp;const s={shirtOnly:true,pantId:'PG002',shirtId:'DS025',state:'NO_TIE',shoeId:'shoe-8',watchId:null};a.store.addEvent(a.connection.createHistoryEvent(s,{id:'V115_ISOLATED_TEST',localDate:'2026-09-23',origin:'manual'}));}''')
   expected=page.evaluate('HEWRSApp.store.snapshot().events')
   page.reload(wait_until='load');page.wait_for_function('()=>HEWRS_READY===true',timeout=30000)
   check('Synthetic exact-ID wear survives actual page reload',page.evaluate('HEWRSApp.store.snapshot().events')==expected)
   context.close();context=None
   context=pw.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'],viewport={'width':390,'height':844})
   page=context.pages[0];ready(page)
   check('Synthetic exact-ID wear survives Chromium process restart',page.evaluate('HEWRSApp.store.snapshot().events')==expected)
   check('Sentinel survives process restart without modification',page.evaluate('localStorage.getItem("hewrs-v115-test-sentinel")')=='UNCHANGED')
   result['status']='PASSED_ISOLATED_CHROMIUM_ORIGIN_AND_RESTART'
  except Exception as error:
   result['error']=str(error)
   if 'ERR_BLOCKED_BY_ADMINISTRATOR'in str(error)and not result['application_loaded']:
    result['status']='BLOCKED_BEFORE_APPLICATION_LOAD';result['blocked_checks']=['hosted_static_loading','actual_localStorage','reload_persistence','browser_process_restart_persistence']
   else:result['status']='FAILED';result['traceback']=traceback.format_exc()
  finally:
   if context:context.close()
server.shutdown();server.server_close();result['seconds']=round(time.monotonic()-started,2)
E.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if result['status']=='FAILED':raise SystemExit(1)
