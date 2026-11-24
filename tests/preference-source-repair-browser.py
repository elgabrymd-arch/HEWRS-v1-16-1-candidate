"""Real published V3 app, synthetic preference archive only. No provider requests."""
import functools, json, threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
KEY='hewrs:outfit-preferences:v1'
ARCHIVE='hewrs:outfit-preferences:source-recovery:2026-11-24:original'
OLD='hewrs.owner-source.s02.2026-09-29.v1'
LOCK='3e60ce18a0295c6801983ce91dda296efec458b275f523523dee1e3915db7516'
rows=sum([json.loads((ROOT/p).read_text())['records'] for p in ['data/preference-pilot.json','data/preference-followup.json']],[])
raw=json.dumps({'schema':'hewrs.outfit-preferences.v1','source_lock':LOCK,'revision':36,'enabled':True,'comparisons':[dict(id='pref_SYNTHETIC_BROWSER_'+str(i),created_at='2026-11-19T10:00:00.000Z',a=r['a'],b=r['b'],vote=['A','B','both','neither'][i%4],reason='no_reason',partition=r['partition'],pilot_id=r['id'],context=r['context'],source_revision=OLD) for i,r in enumerate(rows)]},separators=(',',':'))
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin='http://127.0.0.1:'+str(server.server_address[1])
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':390,'height':844})
  errors=[];external=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if r.request.url.startswith(origin+'/'): r.continue_()
   else: external.append(r.request.url);r.abort()
  page.route('**/*',route)
  page.goto(origin+'/preference-repair.html')
  page.evaluate('([key,raw])=>localStorage.setItem(key,raw)',[KEY,raw])
  page.reload()
  assert 'all 36' in page.locator('#status').inner_text()
  assert page.evaluate('(k)=>localStorage.getItem(k)',KEY)==raw
  assert page.evaluate('(k)=>localStorage.getItem(k)',ARCHIVE) is None
  page.locator('#agree').check()
  page.locator('#apply').click()
  page.locator('#status').filter(has_text='Repair verified').wait_for()
  assert page.evaluate('(k)=>localStorage.getItem(k)',ARCHIVE)==raw
  compatible=page.evaluate('(k)=>localStorage.getItem(k)',KEY)
  assert len(json.loads(compatible)['comparisons'])==26
  page.locator('#after a').click()
  page.wait_for_function('()=>globalThis.HEWRS_READY === true && !!globalThis.HEWRSAIFivePanel && !!HEWRSApp.rejection',timeout=120000)
  state=page.evaluate('()=>HEWRSApp.learning.model({occasion:"work",requiredFormality:"any"}).state')
  assert len(state['comparisons'])==26
  page.evaluate("""()=>{HEWRSApp.ui.reset();HEWRSApp.setMode('engine');HEWRSApp.connection.hybrid.setMode('research');HEWRSApp.showPage('home');}""")
  page.locator('#generate-options').click()
  page.wait_for_function("()=>!HEWRSApp.state().busy&&HEWRSApp.state().page==='outfits'",timeout=180000)
  state=page.evaluate('()=>HEWRSApp.state()')
  assert state['optionCount']==20, (state['optionCount'],state.get('report',{}).get('reason'))
  assert page.evaluate('(k)=>localStorage.getItem(k)',KEY)==compatible
  assert page.evaluate('(k)=>localStorage.getItem(k)',ARCHIVE)==raw
  assert not errors, errors
  assert not any('/v1/ai-five/generate' in url for url in external)
  print('PASS: browser repair + actual V3 native generation, 20 options, exact 36-record archive and 26 current votes preserved, zero AI requests.')
  browser.close()
finally:
 server.shutdown();server.server_close()
