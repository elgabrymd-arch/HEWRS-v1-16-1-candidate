"""Actual app/renderer/images/storage; no synthetic fixtures or CSP bypass."""
import functools
import json
import threading
import time
import traceback
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'rejection-verification';OUT.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
def wait(frame,fn,seconds=90):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        try:
            if frame.evaluate(fn):return
        except Exception:pass
        time.sleep(.15)
    raise TimeoutError('Condition not reached: '+fn)
old='77a9c561f51340a40a5789d0fbf8ef92f77da2e5';results=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    for name,url in [('baseline',origin+'/blazer-picker-preview.html'),('preview-local',origin+'/outfit-feedback-preview.html'),('preview-hosted','https://rawcdn.githack.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/'+old+'/outfit-feedback-preview.html')]:
        result={'test':name,'url':url,'errors':[],'console_errors':[],'http_errors':[],'failed_requests':[]}
        context=browser.new_context(viewport={'width':1280,'height':900},timezone_id='America/New_York')
        def route(r):
            u=r.request.url
            if u.startswith(origin+'/') or u.startswith('https://rawcdn.githack.com/') or u.startswith('https://raw.githubusercontent.com/') or u.startswith('https://raw.githack.com/'):r.continue_()
            else:r.abort()
        context.route('**/*',route);page=context.new_page()
        page.on('pageerror',lambda e:result['errors'].append(str(e)))
        page.on('console',lambda m:result['console_errors'].append(m.text) if m.type=='error' else None)
        page.on('response',lambda r:result['http_errors'].append([r.status,r.url]) if r.status>=400 else None)
        page.on('requestfailed',lambda r:result['failed_requests'].append([r.url,r.failure]))
        try:
            page.goto(url,wait_until='domcontentloaded',timeout=90000)
            if page.get_by_text('Open the page',exact=True).count():page.get_by_text('Open the page',exact=True).click()
            if name=='baseline':frame=page.main_frame
            else:
                wait(page,"() => document.querySelector('#shirt-preview-app')?.dataset.ready==='true'",65)
                frame=page.query_selector('#shirt-preview-app').content_frame()
            wait(frame,'() => globalThis.HEWRS_READY===true',30)
            result['initial']=frame.evaluate('() => ({state:HEWRSApp.state(),runtime:HEWRSRuntimeLoader.stats(),core:globalThis.HEWRSRejectionPreviewCore?.diagnostics()})')
            print('START '+name,flush=True)
            frame.locator('#generate-options').click()
            wait(frame,"() => !HEWRSApp.state().busy && HEWRSApp.state().page==='outfits'",120)
            result['after_generate']=frame.evaluate("() => ({state:HEWRSApp.state(),diagnostic:HEWRSApp.diagnosticSnapshot(),status:document.getElementById('status').textContent,empty:document.getElementById('outfit-empty').textContent,canvas:{...document.getElementById('avatar').dataset}})")
            state=result['after_generate']['state']
            result['passed']=state['optionCount']>0 and state['selection'] is not None
        except Exception as e:
            result['exception']=str(e);result['traceback']=traceback.format_exc();result['passed']=False
        finally:
            try:
                result['body']=page.locator('body').inner_text(timeout=5000)[:6000]
                for f in page.frames:
                    if f!=page.main_frame:result['frame_body']=f.locator('body').inner_text(timeout=5000)[:6000]
                page.screenshot(path=str(OUT/(name+'.png')),full_page=True,timeout=10000)
            except Exception:pass
            summary={k:result.get(k) for k in ['test','passed','exception','errors','console_errors','http_errors']}
            summary['status']=result.get('after_generate',{}).get('status')
            summary['options']=result.get('after_generate',{}).get('state',{}).get('optionCount')
            print('SUMMARY '+json.dumps(summary,ensure_ascii=False),flush=True)
            results.append(result);(OUT/'RESULT.json').write_text(json.dumps(results,indent=2));context.close()
    browser.close()
server.shutdown()
assert next(x for x in results if x['test']=='baseline')['passed'],'Baseline failed too; inspect the actual diagnostic.'
