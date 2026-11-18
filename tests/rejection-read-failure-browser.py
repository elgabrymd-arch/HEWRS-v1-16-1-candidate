#!/usr/bin/env python3
"""Exercise rejection read failures against the actual candidate in Chromium.

Fresh synthetic profiles only. No owner browser data, provider access, migration
or release. Fault injection changes only test records and native read outcomes.
"""
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'evidence/rejection_read_failure'
F_PREFIX = 'hewrs:outfit-feedback:v1:event:'
T_PREFIX = 'hewrs:tie-feedback:v1:event:'
BROKEN = '{unreadable synthetic rejection record'
FIRST = {'suitId': 'S18', 'shirtId': 'DS001', 'state': 'T019',
         'shoeId': 'shoe-3', 'watchId': 'watch-AP09'}
SECOND = {**FIRST, 'state': 'T020'}
CLEAN = {'suitId': 'S10', 'shirtId': 'DS036', 'state': 'NO_TIE',
         'shoeId': 'shoe-11', 'watchId': 'watch-AP09'}
RENDER_TARGET = {'suitId': 'S03', 'shirtId': 'DS001', 'state': 'T022',
                 'shoeId': 'shoe-1', 'watchId': 'watch-AP09'}
INIT = '''() => {
    globalThis.__auditVisibleWrites=[];
    const put=CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData=function(...args){
        if(['avatar','rd-canvas'].includes(this.canvas.id))
            globalThis.__auditVisibleWrites.push(this.canvas.id);
        return Reflect.apply(put,this,args);
    };
    globalThis.__auditNativeGetItem=Storage.prototype.getItem;
}'''


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = 'http://127.0.0.1:' + str(server.server_address[1])
    checks, observations, external, errors = [], {}, [], []
    result = {'schema': 'hewrs.rejection-read-failure-browser.v1',
              'synthetic_data_only': True, 'actual_owner_usage': False,
              'checks': checks, 'observations': observations,
              'external_requests': external, 'page_errors': errors}
    contexts = []

    def check(name, condition):
        checks.append({'name': name, 'passed': bool(condition)})
        print(('PASS: ' if condition else 'FAIL: ') + name, flush=True)
        assert condition, name

    def ready(page):
        page.wait_for_function('()=>globalThis.HEWRS_READY===true && !!HEWRSApp.rejection', timeout=60000)

    def new_context(browser, extra_init=None, custom_route=None):
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        contexts.append(context)
        # One script guarantees that raw-read capture precedes fault injection;
        # separate add_init_script registrations do not promise execution order.
        context.add_init_script('(' + INIT + ')();\n' + (extra_init or ''))

        def route(request):
            if not request.request.url.startswith(origin + '/'):
                external.append(request.request.url)
                request.abort()
            elif custom_route and custom_route(request):
                return
            else:
                request.continue_()

        context.route('**/*', route)
        page = context.new_page()
        page.set_default_timeout(60000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        return context, page

    def stored(page):
        return page.evaluate('''()=>Object.keys(localStorage)
            .filter(k=>k.startsWith('hewrs:outfit-feedback:v1:event:') || k.startsWith('hewrs:tie-feedback:v1:event:'))
            .sort().map(k=>[k,Reflect.apply(__auditNativeGetItem,localStorage,[k])])''')

    def save_rejections(page, scope):
        return page.evaluate('''({scope,selections})=>{
            const f=HEWRSApp.ownerFeedback;
            const prefix=scope==='tie'?HEWRSTieFeedback.PREFIX:HEWRSOutfitFeedback.PREFIX;
            return selections.map(selection=>{
                const event=f.hide(selection,{scope,context:'all',reason:'other'});
                return {event,key:prefix+event.id,raw:localStorage.getItem(prefix+event.id)};
            });
        }''', {'scope': scope, 'selections': [FIRST, SECOND]})

    def snapshot(page):
        return page.evaluate('''()=>{
            // Capture presentation passively first. A failed refresh itself
            // reports an application error, so probing first could conceal a
            // missing startup/retry notification and create a false pass.
            const home=document.getElementById('rejection-home-status');
            const passive={feedbackReadError:HEWRSApp.feedbackReadError,
                persistent:HEWRSApp.ownerFeedbackPersistent,homeError:home?.textContent,
                homeVisible:!!home && home.getClientRects().length>0 && getComputedStyle(home).visibility==='visible',
                generateDisabled:document.getElementById('generate-options').disabled,
                optionCount:HEWRSApp.state().optionCount,
                visibleWrites:__auditVisibleWrites.slice(),
                indexRequests:HEWRSRuntimeLoader.stats().indexRequests};
            let readError=null,active=null;
            try{active=HEWRSApp.ownerFeedback.refresh().active.length;}catch(e){readError=e.message;}
            return {passive,probe:{readError,active},exposureEvents:HEWRSApp.tieExposure.snapshot().eventCount};
        }''')

    def retry(page):
        page.evaluate("()=>HEWRSApp.showPage('home')")
        page.click('#retry-rejection-check')

    def assert_blocked_calls(page, label):
        # Public APIs remain guarded even if a caller bypasses a disabled button.
        data = page.evaluate('''async selection=>{
            const a=HEWRSApp,s=a.state(),config={automatic:true,stylistMode:'research',
                preferences:Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(k=>[k,{mode:'any'}])),
                occasion:'work',style:'AUTO',formality:'any',localDate:s.context.localDate,
                environment:{source:'not_assessed',date:s.context.localDate}};
            const q=a.connection.makeRequest(config),before={
                writes:__auditVisibleWrites.length,index:HEWRSRuntimeLoader.stats().indexRequests,
                exposure:a.tieExposure.snapshot().eventCount};
            const outcome={};
            for(const [name,fn] of [
                ['controller',()=>a.connection.controller.generateAsync(q,a.connection.catalogue,[])],
                ['application',()=>a.generate(config)],
                ['render',()=>a.apply(selection,{origin:'manual',save:false})]
            ]){
                try{await fn();outcome[name]={blocked:false};}
                catch(e){outcome[name]={blocked:true,error:e.message};}
            }
            return {before,outcome,after:{writes:__auditVisibleWrites.length,
                index:HEWRSRuntimeLoader.stats().indexRequests,
                exposure:a.tieExposure.snapshot().eventCount},optionCount:a.state().optionCount};
        }''', CLEAN)
        observations[label + '_blocked_apis'] = data
        check(label + ': controller, Generate and manual render all reject unreadable feedback',
              all(v['blocked'] and ('rejection' in v.get('error', '').lower() or 'feedback' in v.get('error', '').lower())
                  for v in data['outcome'].values()))
        check(label + ': blocked calls publish no options, pixels, exposure or lazy index request',
              data['before'] == data['after'] and data['optionCount'] == 0)

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            result['browser_version'] = browser.version
            original_fixture = None
            recovered_page = None

            for scope in ('clothing', 'tie'):
                context, page = new_context(browser)
                page.goto(origin + '/', wait_until='domcontentloaded')
                ready(page)
                saved = save_rejections(page, scope)
                if scope == 'clothing':
                    original_fixture = saved[0]
                good_bytes = stored(page)
                page.reload(wait_until='domcontentloaded')
                ready(page)
                check(scope + ': both valid saved rejections remain enforced after reload',
                      page.evaluate('''selections=>selections.every(s=>!HEWRSApp.ownerFeedback.allowed(s,{occasion:'work'}))''', [FIRST, SECOND]))

                page.evaluate('''({key,value})=>localStorage.setItem(key,value)''', {'key': saved[1]['key'], 'value': BROKEN})
                bad_bytes = stored(page)
                page.reload(wait_until='domcontentloaded')
                ready(page)
                state = snapshot(page)
                observations[scope + '_startup'] = state
                check(scope + ': unreadable feedback is blocked at startup with a visible Home error',
                      bool(state['passive']['feedbackReadError']) and bool(state['passive']['homeError'])
                      and state['passive']['generateDisabled'] and state['passive']['homeVisible']
                      and bool(state['probe']['readError']))
                check(scope + ': startup retains all saved and unreadable bytes', stored(page) == bad_bytes)
                if scope == 'clothing':
                    page.screenshot(path=str(EVIDENCE / 'blocked-home-390x844.png'), full_page=True)
                assert_blocked_calls(page, scope)

                if scope == 'clothing':
                    reviewed = page.evaluate('''async()=>{
                        const before=__auditVisibleWrites.length;
                        try{await HEWRSReviewedIntegration.render('O18');return {blocked:false};}
                        catch(e){return {blocked:true,error:e.message,before,after:__auditVisibleWrites.length,
                            currentId:HEWRSReviewedIntegration.state().currentId};}
                    }''')
                    observations['reviewed_panel_block'] = reviewed
                    check('Reviewed outfit rendering also rejects unreadable feedback without publishing pixels',
                          reviewed['blocked'] and ('rejection' in reviewed.get('error', '').lower() or 'feedback' in reviewed.get('error', '').lower())
                          and reviewed['before'] == reviewed['after'] and not reviewed.get('currentId'))

                retry(page)
                still_blocked = snapshot(page)
                check(scope + ': retry cannot bypass an unchanged corrupt record',
                      bool(still_blocked['passive']['feedbackReadError']) and still_blocked['passive']['generateDisabled']
                      and bool(still_blocked['probe']['readError']) and stored(page) == bad_bytes)

                # Test-only repair restores the exact original bytes of the
                # corrupted record; the product does not clear/delete data.
                page.evaluate('''({key,value})=>localStorage.setItem(key,value)''', {'key': saved[1]['key'], 'value': saved[1]['raw']})
                retry(page)
                page.wait_for_function('()=>HEWRSApp.feedbackReadError===null && !document.getElementById("generate-options").disabled')
                restored = snapshot(page)
                observations[scope + '_recovery'] = restored
                check(scope + ': same-page retry recovers only after a successful read and preserves both bans',
                      restored['probe']['readError'] is None and restored['passive']['persistent'] and restored['probe']['active'] == 2
                      and stored(page) == good_bytes
                      and page.evaluate('''selections=>selections.every(s=>!HEWRSApp.ownerFeedback.allowed(s,{occasion:'work'}))''', [FIRST, SECOND]))
                if scope == 'clothing':
                    recovered_page = page
                else:
                    context.close()

            # A repaired original ledger is used by a real native generation.
            page = recovered_page
            wear = page.evaluate('()=>HEWRSApp.store.snapshot().events')
            favorites = page.evaluate('()=>HEWRSApp.favorites.snapshot()')
            page.click('#generate-options')
            page.wait_for_function('''()=>{const s=HEWRSApp.state();return !s.busy && s.page==='outfits' && Array.isArray(s.report?.options);}''', timeout=360000)
            generated = page.evaluate('''()=>{
                const a=HEWRSApp,s=a.state();
                return {count:s.optionCount,valid:a.connection.controller.verifyOptionSet(s.report.options,s.request),
                    allowed:s.report.options.every(o=>a.ownerFeedback.allowed(o._hewrsConnected.canonical_selection,s.request.context)),
                    ids:s.report.options.map(o=>o._hewrsConnected.id),avatar:document.getElementById('avatar').dataset.status,
                    active:a.ownerFeedback.snapshot().active.length};
            }''')
            observations['real_generation_after_recovery'] = generated
            check('A real generation after recovery returns 20 valid options and still applies both saved bans',
                  generated['count'] == 20 and generated['valid'] and generated['allowed'] and generated['active'] == 2
                  and generated['avatar'] == 'ready')
            check('Failure, retry and recovery generation leave wear events and Favorites unchanged',
                  page.evaluate('()=>HEWRSApp.store.snapshot().events') == wear
                  and page.evaluate('()=>HEWRSApp.favorites.snapshot()') == favorites)
            page.screenshot(path=str(EVIDENCE / 'recovered-outfit-390x844.png'), full_page=True)

            # Simulate a read failure thrown by storage itself at application boot.
            fault_init = '''(()=>{
                const native=Storage.prototype.getItem;
                globalThis.__auditFailReads=true;
                Storage.prototype.getItem=function(key){
                    if(globalThis.__auditFailReads && String(key).startsWith('hewrs:outfit-feedback:v1:event:'))
                        throw new DOMException('Synthetic rejection storage read failure','SecurityError');
                    return Reflect.apply(native,this,[key]);
                };
            })()'''
            transient_context, transient = new_context(browser, extra_init=fault_init)
            transient.goto(origin + '/tests/', wait_until='domcontentloaded')
            transient.evaluate('''({key,raw})=>localStorage.setItem(key,raw)''', original_fixture)
            transient.goto(origin + '/', wait_until='domcontentloaded')
            ready(transient)
            transient_state = snapshot(transient)
            observations['storage_read_failure_startup'] = transient_state
            check('An actual storage read exception blocks startup without discarding saved exclusions',
                  bool(transient_state['passive']['feedbackReadError']) and transient_state['passive']['generateDisabled']
                  and bool(transient_state['passive']['homeError']) and transient_state['passive']['homeVisible']
                  and bool(transient_state['probe']['readError'])
                  and transient.evaluate('''({key,raw})=>Reflect.apply(__auditNativeGetItem,localStorage,[key])===raw''', original_fixture))
            transient.evaluate('()=>{globalThis.__auditFailReads=false;}')
            retry(transient)
            transient.wait_for_function('()=>HEWRSApp.feedbackReadError===null && !document.getElementById("generate-options").disabled')
            check('Retry recovers from a transient storage exception on the same page and still enforces the original ban',
                  transient.evaluate('''selection=>HEWRSApp.ownerFeedbackPersistent && !HEWRSApp.ownerFeedback.allowed(selection,{occasion:'work'})''', FIRST))
            transient_context.close()

            # Corruption happens after native generation has actually started.
            # Same-tab setItem emits no storage event, so the final gate must
            # independently detect the bad data before returning a new list.
            mid = page.evaluate('''async()=>{
                await HEWRSRuntimeLoader.ensureIndex();
                const a=HEWRSApp,s=a.state(),config={automatic:true,stylistMode:'research',
                    preferences:{...Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(k=>[k,{mode:'any'}])),
                        topwear:{mode:'item',id:a.connection.catalogue.suits[9].id}},
                    occasion:'work',style:'AUTO',formality:'any',localDate:s.context.localDate,
                    environment:{source:'not_assessed',date:s.context.localDate}};
                const q=a.connection.makeRequest(config),before={writes:__auditVisibleWrites.length,
                    exposure:a.tieExposure.snapshot().eventCount};
                let progress=0,injected=false,error=null,returned=false;
                const key='hewrs:outfit-feedback:v1:event:corrupt_during_generation';
                try{await a.connection.controller.generateAsync(q,a.connection.catalogue,[],{onProgress:()=>{
                    progress++;
                    if(!injected){injected=true;localStorage.setItem(key,'{broken during generation');}
                }});returned=true;}catch(e){error=e.message;}
                return {progress,injected,error,returned,before,after:{writes:__auditVisibleWrites.length,
                    exposure:a.tieExposure.snapshot().eventCount},badBytes:localStorage.getItem(key)};
            }''')
            observations['corrupt_during_generation'] = mid
            check('Native generation detects corruption introduced after its first real progress phase',
                  mid['progress'] > 0 and mid['injected'] and bool(mid['error']) and not mid['returned'])
            check('Failed native generation publishes no new pixels or exposure and retains the corrupt record',
                  mid['before'] == mid['after'] and mid['badBytes'] == '{broken during generation')

            # Inject corruption while an actual native image is loading. A prior
            # complete frame exists, allowing exact verification that the final
            # visible canvas did not accept any part of the pending outfit.
            fault = {'armed': False, 'triggered': False, 'asset': None}
            render_page = None

            def render_route(request):
                if fault['armed'] and not fault['triggered'] and any(request.request.url.startswith(origin + '/' + folder + '/') for folder in ('assets', 'assemblies')):
                    fault['triggered'] = True
                    fault['asset'] = request.request.url.removeprefix(origin + '/')
                    render_page.evaluate("()=>localStorage.setItem('hewrs:outfit-feedback:v1:event:corrupt_during_render','{broken during render')")
                return False

            render_context, render_page = new_context(browser, custom_route=render_route)
            render_page.goto(origin + '/', wait_until='domcontentloaded')
            ready(render_page)
            render_page.evaluate("selection=>HEWRSApp.apply(selection,{origin:'manual',save:false})", CLEAN)
            before_render = render_page.evaluate('''()=>({selection:HEWRSApp.state().selection,
                writes:__auditVisibleWrites.length,exposure:HEWRSApp.tieExposure.snapshot().eventCount})''')
            fault['armed'] = True
            failed_render = render_page.evaluate('''async selection=>{
                let error=null;try{await HEWRSApp.apply(selection,{origin:'manual',save:false});}catch(e){error=e.message;}
                return {error,selection:HEWRSApp.state().selection,writes:__auditVisibleWrites.length,
                    exposure:HEWRSApp.tieExposure.snapshot().eventCount,
                    badBytes:localStorage.getItem('hewrs:outfit-feedback:v1:event:corrupt_during_render')};
            }''', RENDER_TARGET)
            observations['corrupt_during_render'] = {'before': before_render, 'after': failed_render, 'injection': fault}
            check('Corruption during a real image request prevents the pending avatar from committing',
                  fault['triggered'] and bool(failed_render['error'])
                  and before_render['selection'] == failed_render['selection']
                  and before_render['writes'] == failed_render['writes']
                  and before_render['exposure'] == failed_render['exposure']
                  and failed_render['badBytes'] == '{broken during render')
            render_context.close()

            # Exercise an already-open real card export sheet. Each fixture
            # renders a valid manual outfit; no synthetic image replaces the
            # actual PNG work. Delaying only the native toBlob callback creates
            # a deterministic await boundary for the final feedback check.
            for export_phase in ('before_create', 'during_png', 'prepared_link'):
                export_context, export_page = new_context(browser)
                downloads = []
                export_page.on('download', lambda download: downloads.append(download.suggested_filename))
                export_page.goto(origin + '/', wait_until='domcontentloaded')
                ready(export_page)
                save_rejections(export_page, 'clothing')
                valid_export_bytes = stored(export_page)
                export_page.evaluate("selection=>HEWRSApp.apply(selection,{origin:'manual',save:false})", CLEAN)
                export_page.evaluate("()=>HEWRSApp.showPage('outfits')")
                before_export = export_page.evaluate('''()=>({
                    wear:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.snapshot(),
                    selection:HEWRSApp.state().selection,writes:__auditVisibleWrites.length,
                    exposure:HEWRSApp.tieExposure.snapshot().eventCount})''')
                export_page.evaluate('''()=>{
                    globalThis.__auditExportUrls=[];globalThis.__auditRevokedExportUrls=[];
                    const create=URL.createObjectURL,revoke=URL.revokeObjectURL;
                    URL.createObjectURL=function(...args){
                        const value=Reflect.apply(create,this,args);__auditExportUrls.push(value);return value;
                    };
                    URL.revokeObjectURL=function(value){
                        __auditRevokedExportUrls.push(value);return Reflect.apply(revoke,this,[value]);
                    };
                }''')
                export_page.click('#export-option-cards')
                export_page.wait_for_function('()=>document.getElementById("fx-sheet").open && !!document.getElementById("export-card-png")')
                export_bad_key = F_PREFIX + 'corrupt_export_' + export_phase
                prepared_url = None
                if export_phase == 'before_create':
                    export_page.evaluate('''({key,value})=>localStorage.setItem(key,value)''', {'key': export_bad_key, 'value': BROKEN})
                    export_page.click('#export-card-png')
                elif export_phase == 'during_png':
                    export_page.evaluate('''()=>{
                        globalThis.__auditBlobReady=false;
                        const original=HTMLCanvasElement.prototype.toBlob;
                        HTMLCanvasElement.prototype.toBlob=function(callback,...args){
                            return Reflect.apply(original,this,[blob=>{
                                globalThis.__auditBlobReady=!!blob;
                                globalThis.__auditReleaseBlob=()=>{
                                    HTMLCanvasElement.prototype.toBlob=original;
                                    globalThis.__auditReleaseBlob=null;
                                    callback(blob);
                                };
                            },...args]);
                        };
                    }''')
                    export_page.click('#export-card-png')
                    export_page.wait_for_function('()=>globalThis.__auditBlobReady===true')
                    export_page.evaluate('''({key,value})=>{
                        localStorage.setItem(key,value);
                        __auditReleaseBlob();
                    }''', {'key': export_bad_key, 'value': BROKEN})
                else:
                    export_page.click('#export-card-png')
                    export_page.wait_for_selector('#card-export-save', state='visible')
                    prepared_url = export_page.locator('#card-export-save').get_attribute('href')
                    # A real second tab supplies the storage event. The export
                    # was valid when prepared; later read failure must revoke
                    # its still-open download rather than leave it actionable.
                    writer = export_context.new_page()
                    writer.goto(origin + '/tests/', wait_until='domcontentloaded')
                    writer.evaluate('''({key,value})=>localStorage.setItem(key,value)''', {'key': export_bad_key, 'value': BROKEN})
                    writer.close()
                export_page.wait_for_function('()=>!!HEWRSApp.feedbackReadError && !document.getElementById("fx-sheet").open')
                export_after = export_page.evaluate('''()=>({
                    error:HEWRSApp.feedbackReadError,sheetOpen:document.getElementById('fx-sheet').open,
                    urls:__auditExportUrls,revoked:__auditRevokedExportUrls,
                    wear:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.snapshot(),
                    selection:HEWRSApp.state().selection,writes:__auditVisibleWrites.length,
                    exposure:HEWRSApp.tieExposure.snapshot().eventCount})''')
                export_bytes = stored(export_page)
                observations['export_' + export_phase] = {
                    'after': export_after, 'preparedUrl': prepared_url, 'downloads': downloads,
                    'originalRecordsRetained': all(entry in export_bytes for entry in valid_export_bytes),
                    'corruptRecordRetained': [export_bad_key, BROKEN] in export_bytes,
                }
                if prepared_url:
                    check('A prepared PNG download is revoked when another tab makes rejection data unreadable',
                          bool(export_after['error']) and not export_after['sheetOpen']
                          and prepared_url in export_after['revoked'] and len(export_after['urls']) == 1
                          and not export_page.locator('#card-export-save').is_visible() and not downloads)
                else:
                    check('Export ' + export_phase + ': unreadable feedback prevents a PNG URL or download link from publishing',
                          bool(export_after['error']) and not export_after['sheetOpen']
                          and not export_after['urls'] and not export_page.locator('#card-export-save').is_visible()
                          and not downloads)
                check('Export ' + export_phase + ': failure preserves rejection bytes, current outfit, wear, Favorites and exposure',
                      all(entry in export_bytes for entry in valid_export_bytes)
                      and [export_bad_key, BROKEN] in export_bytes
                      and all(export_after[key] == before_export[key] for key in ('wear', 'favorites', 'selection', 'writes', 'exposure')))
                export_context.close()

            # An enlarged copy is an already-open presentation surface too.
            # A real storage event must hide it along with the main avatar.
            large_context, large = new_context(browser)
            large.goto(origin + '/', wait_until='domcontentloaded')
            ready(large)
            save_rejections(large, 'clothing')
            large_bytes = stored(large)
            large.evaluate("selection=>HEWRSApp.apply(selection,{origin:'manual',save:false})", CLEAN)
            large.evaluate("()=>HEWRSApp.showPage('outfits')")
            large.click('#large-view')
            large.wait_for_selector('#large-avatar', state='visible')
            writer = large_context.new_page()
            writer.goto(origin + '/tests/', wait_until='domcontentloaded')
            large_bad_key = F_PREFIX + 'corrupt_while_enlarged'
            writer.evaluate('''({key,value})=>localStorage.setItem(key,value)''', {'key': large_bad_key, 'value': BROKEN})
            writer.close()
            large.wait_for_function('()=>!!HEWRSApp.feedbackReadError && !document.getElementById("fx-sheet").open')
            large_after = large.evaluate('''()=>({
                error:HEWRSApp.feedbackReadError,sheetOpen:document.getElementById('fx-sheet').open,
                mainHidden:document.getElementById('outfit-output').hidden || document.getElementById('outfit-output').hasAttribute('data-rejection-hidden'),
                selection:HEWRSApp.state().selection})''')
            observations['enlarged_view_failure'] = large_after
            check('A real cross-tab read failure closes the enlarged avatar and hides the main outfit without deleting feedback',
                  bool(large_after['error']) and not large_after['sheetOpen'] and large_after['mainHidden']
                  and not large.locator('#large-avatar').is_visible()
                  and large_after['selection'] == CLEAN
                  and all(entry in stored(large) for entry in large_bytes)
                  and [large_bad_key, BROKEN] in stored(large))
            large_context.close()

            check('No external or provider requests were made', not external)
            check('No uncaught browser page exceptions occurred', not errors)
            result['status'] = 'passed'
            browser.close()
    except Exception as error:
        result['status'] = 'failed'
        result['error'] = str(error)
        raise
    finally:
        server.shutdown()
        (EVIDENCE / 'RESULT.json').write_text(json.dumps(result, indent=2) + '\n')


if __name__ == '__main__':
    main()
