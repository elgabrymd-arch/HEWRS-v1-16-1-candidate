"""End-to-end checks with native runtime, real garment PNGs and isolated storage.
No user browser, application mocks, substituted images or paid provider calls.
"""
import functools, hashlib, json, os, threading, time, traceback
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'rejection-verification';OUT.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
def wait(frame,fn,seconds=90):
    until=time.monotonic()+seconds
    while time.monotonic()<until:
        try:
            if frame.evaluate(fn):return
        except Exception:pass
        time.sleep(.15)
    raise TimeoutError(fn)
sha=os.environ.get('GITHUB_SHA','');host='https://rawcdn.githack.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/'+sha+'/'
results=[]
release=json.loads((ROOT/'STANDARD_RELEASE.json').read_text())
for name in release['standard_entrypoints']:
    assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==release['entrypoint_sha256']
assert hashlib.sha256((ROOT/release['runtime']).read_bytes()).hexdigest()==release['runtime_sha256']
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    for name,url,width in [('local-desktop',origin+'/outfit-feedback-preview.html',1280),('hosted-desktop',host+'outfit-feedback-preview.html',1280),('hosted-phone',host+'outfit-feedback-preview.html',390)]:
        result={'test':name,'url':url,'checks':[],'errors':[],'http_errors':[],'provider_requests':[]}
        context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<500,has_touch=width<500,timezone_id='America/New_York')
        def route(r):
            u=r.request.url
            if 'hewrs-ai-service' in u:result['provider_requests'].append(u)
            if u.startswith(origin+'/') or u.startswith('https://rawcdn.githack.com/') or u.startswith('https://raw.githubusercontent.com/') or u.startswith('https://raw.githack.com/'):r.continue_()
            else:r.abort()
        context.route('**/*',route);page=context.new_page()
        page.on('pageerror',lambda e:result['errors'].append(str(e)))
        page.on('response',lambda r:result['http_errors'].append([r.status,r.url]) if r.status>=400 else None)
        def check(label,condition):
            result['checks'].append({'name':label,'passed':bool(condition)})
            print(('PASS ' if condition else 'FAIL ')+name+': '+label,flush=True)
            assert condition,label
        def ready():
            wait(page,"() => document.querySelector('#shirt-preview-app')?.dataset.ready==='true'",90)
            f=page.query_selector('#shirt-preview-app').content_frame()
            wait(f,'() => globalThis.HEWRS_READY===true && !!HEWRSApp.rejection',30)
            return f
        def generate(f):
            f.locator('[data-page="home"]').click();f.locator('#generate-options').click()
            wait(f,"() => !HEWRSApp.state().busy && HEWRSApp.state().page==='outfits'",120)
            s=f.evaluate('() => HEWRSApp.state()')
            if not s['optionCount']:raise AssertionError(f.locator('#status').inner_text())
            return s
        def stable_records(f):
            return f.evaluate('() => ({prefs:HEWRSApp.ui.snapshot(),wear:HEWRSApp.store.readForGeneration().events,favorites:HEWRSApp.favorites.snapshot()})')
        try:
            page.goto(url,wait_until='domcontentloaded',timeout=90000)
            if page.get_by_text('Open the page',exact=True).count():page.get_by_text('Open the page',exact=True).click()
            f=ready();state=generate(f)
            result['initial_options']=state['optionCount']
            check('Generate displays 20 actual outfit choices',state['optionCount']==20 and state['selection'] is not None)
            check('Visible avatar is complete',f.locator('#avatar').get_attribute('data-status')=='ready')
            check('Rejection control is available',f.locator('#reject-outfit').is_enabled())
            f.locator('#next-option').click();wait(f,'() => !HEWRSApp.state().busy && HEWRSApp.state().optionIndex===1')
            check('Next displays actual option 2',f.evaluate('() => HEWRSApp.state().optionIndex')==1)
            identical=f.evaluate('''async () => {
              const a=HEWRSApp,s=a.state().selection,c=document.createElement('canvas');
              const r=HEWRSAtomicRenderer.create(c,a.connection,{resolveUrl:a.resolveUrl});
              try {await r.render(s);const read=x=>x.getContext('2d').getImageData(0,0,996,2748).data;
                const x=read(document.getElementById('avatar')),y=read(c);
                return x.length===y.length&&x.every((v,i)=>v===y[i]);
              }finally{r.cancel();c.width=c.height=1;}
            }''')
            check('Displayed pixels equal the unchanged native renderer',identical)
            stable=stable_records(f);before=f.evaluate('() => HEWRSApp.ownerFeedback.exportData().events')
            f.locator('#reject-outfit').click();f.locator('#rejection-reason').select_option('patterns');f.locator('#rejection-note').fill('Automated isolated browser check');f.locator('#rejection-cancel').click()
            check('Cancel writes no feedback',f.evaluate('() => HEWRSApp.ownerFeedback.exportData().events')==before)
            old=f.evaluate('() => HEWRSApp.state().selection')
            f.locator('#reject-outfit').click();f.locator('#rejection-once').click()
            wait(f,"() => !HEWRSApp.state().busy && !document.getElementById('reject-outfit').disabled")
            check('Temporary reject shows a different outfit',f.evaluate('() => HEWRSApp.state().selection')!=old)
            check('Temporary reject is not permanently saved',f.evaluate('() => HEWRSApp.ownerFeedback.exportData().events')==before)
            check('Locks, wear and Favorites survive rejection',stable_records(f)==stable)
            state=generate(f)
            check('New Generate returns 20 and clears temporary skips',state['optionCount']==20 and f.evaluate('() => HEWRSApp.ownerFeedback.snapshot().temporary.length')==0)
            rejected=f.evaluate('() => HEWRSApp.state().selection')
            f.locator('#reject-outfit').click();f.locator('#rejection-reason').select_option('colors');f.locator('#rejection-note').fill('Browser-test reason; isolated test storage only');f.locator('#rejection-permanent').click()
            wait(f,"() => !HEWRSApp.state().busy && !document.getElementById('reject-outfit').disabled")
            events=f.evaluate('() => HEWRSApp.ownerFeedback.snapshot().active')
            check('Permanent rejection retains reason and note',len(events)==1 and events[0]['reason']=='colors' and events[0].get('note')=='Browser-test reason; isolated test storage only')
            check('Permanent rejection displays another outfit',f.evaluate('() => HEWRSApp.state().selection')!=rejected)
            page.reload(wait_until='domcontentloaded');f=ready()
            check('Permanent rejection persists after reload',len(f.evaluate('() => HEWRSApp.ownerFeedback.snapshot().active'))==1)
            state=generate(f)
            check('Regeneration excludes the rejected combination',f.evaluate('''() => {const a=HEWRSApp,s=a.state();return s.report.options.every(o=>a.ownerFeedback.allowed(a.connection.selectionFromOption(o,s.request).selection,s.request.context));}'''))
            f.locator('#manage-outfit-rejections').click();f.locator('#rejection-records button').first.click();f.locator('#rejections-close').click()
            check('Undo removes the active veto',f.evaluate('() => HEWRSApp.ownerFeedback.snapshot().active.length')==0)
            f.locator('[data-page="home"]').click()
            for category,count in [('shirt',50),('tie',47)]:
                f.locator('#pref-'+category).click()
                wait(f,'() => {const a=[...document.querySelectorAll(".hewrs-'+category+'-picker-image img")];return a.length==='+str(count)+'&&a.every(i=>i.complete&&i.naturalWidth===192&&i.naturalHeight===224&&!i.hidden)}',90)
                check(str(count)+' '+category+' images load',True);f.locator('#fx-sheet-close').click()
            check('No paid provider request',not result['provider_requests'])
            check('No application page errors',not result['errors'])
            check('No failed HTTP resources',not result['http_errors'])
            state=generate(f);page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
            result['passed']=True
        except Exception as e:
            result['passed']=False;result['exception']=str(e);result['traceback']=traceback.format_exc()
            try:
                result['body']=page.locator('body').inner_text()[:6000]
                for frame in page.frames:
                    if frame!=page.main_frame:result['frame_body']=frame.locator('body').inner_text()[:9000]
                page.screenshot(path=str(OUT/(name+'-error.png')),full_page=True)
            except Exception:pass
        finally:
            print('SUMMARY '+json.dumps({k:result.get(k) for k in ['test','passed','initial_options','exception','errors','http_errors']},ensure_ascii=False),flush=True)
            results.append(result);(OUT/'ACCEPTANCE.json').write_text(json.dumps(results,indent=2));context.close()
    browser.close()
server.shutdown()
assert all(x['passed'] for x in results),'Actual application validation failed; do not call this release verified.'
