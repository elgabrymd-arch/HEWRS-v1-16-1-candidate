#!/usr/bin/env python3
"""Characterize existing feedback failure modes in isolated Chromium.

This is a diagnostic of the unmodified 69545e candidate, not a claim that its
current failure behavior is acceptable. It never opens owner browser storage.
"""
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence/tie_coverage_rejection_scale/browser-audit.json'
SELECTION = {'suitId': 'S18', 'shirtId': 'DS001', 'state': 'T019',
             'shoeId': 'shoe-3', 'watchId': 'watch-AP09'}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = 'http://127.0.0.1:' + str(server.server_address[1])
    checks, external, errors = [], [], []
    result = {'schema': 'hewrs.rejection-startup-audit.v1',
              'source_commit': '69545e85bf4ee0719d29dc81bade011332c4caf8',
              'synthetic_data_only': True, 'production_changes': False,
              'checks': checks, 'observations': {}, 'external_requests': external,
              'page_errors': errors}

    def check(name, ok):
        checks.append({'name': name, 'passed': bool(ok)})
        print(('PASS: ' if ok else 'FAIL: ') + name, flush=True)
        assert ok, name

    def ready(page):
        page.wait_for_function('()=>globalThis.HEWRS_READY===true && !!HEWRSApp.rejection', timeout=60000)

    def route(request):
        if request.request.url.startswith(origin + '/'):
            request.continue_()
        else:
            external.append(request.request.url)
            request.abort()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            result['browser_version'] = browser.version
            for scope in ('clothing', 'tie'):
                context = browser.new_context(viewport={'width': 390, 'height': 844})
                context.route('**/*', route)
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(origin + '/', wait_until='domcontentloaded')
                ready(page)
                saved = page.evaluate('''({selection,scope})=>{
                    const f=HEWRSApp.ownerFeedback;
                    const event=f.hide(selection,{scope,context:'all',reason:'other'});
                    const prefix=scope==='clothing'?HEWRSOutfitFeedback.PREFIX:HEWRSTieFeedback.PREFIX;
                    return {event,raw:localStorage.getItem(prefix+event.id),blocked:!f.allowed(selection,{occasion:'work'})};
                }''', {'selection': SELECTION, 'scope': scope})
                check(scope + ': valid saved rejection blocks before corruption', saved['blocked'])
                prefix = 'hewrs:outfit-feedback:v1:event:' if scope == 'clothing' else 'hewrs:tie-feedback:v1:event:'
                corrupt_key = prefix + 'audit_corrupt_record'
                original_key = prefix + saved['event']['id']
                page.evaluate("key=>localStorage.setItem(key,'{unreadable audit record')", corrupt_key)
                page.reload(wait_until='domcontentloaded')
                ready(page)
                observed = page.evaluate('''({selection,originalKey,corruptKey,originalRaw})=>{
                    const f=HEWRSApp.ownerFeedback;
                    let allowed=null,matchError=null,activeCount=null,readError=null;
                    try{allowed=f.allowed(selection,{occasion:'work'});}catch(e){matchError=e.message;}
                    try{activeCount=f.refresh().active.length;}catch(e){readError=e.message;}
                    return {persistentFlag:HEWRSApp.ownerFeedbackPersistent,allowed,matchError,
                        activeCount,readError,originalRecordRetained:localStorage.getItem(originalKey)===originalRaw,
                        corruptRecordRetained:localStorage.getItem(corruptKey)==='{unreadable audit record',
                        feedbackNotice:document.getElementById('rejection-status').textContent};
                }''', {'selection': SELECTION, 'originalKey': original_key, 'corruptKey': corrupt_key, 'originalRaw': saved['raw']})
                result['observations'][scope + '_corrupt_startup'] = observed
                check(scope + ': original and unreadable records retained byte-for-byte',
                      observed['originalRecordRetained'] and observed['corruptRecordRetained'])
                print('OBSERVATION:', scope, json.dumps(observed), flush=True)
                context.close()

            # Characterize browser quota with 30,000 distinct exact clothing +
            # shoe exclusions, each validated by the actual connection. These
            # are synthetic canonical combinations, not owner preferences or
            # a claim that every combination would be a generated suggestion.
            fixture_path = OUT.parent / 'rejection-scale-browser-fixture.json'
            fixture = json.loads(fixture_path.read_text())
            events = fixture['events'][:30000]
            check('Quota fixture contains 30,000 distinct exact outfit exclusions',
                  len(events) == 30000 and len({json.dumps(e['selection'], sort_keys=True) for e in events}) == 30000)
            context = browser.new_context(viewport={'width': 390, 'height': 844})
            context.route('**/*', route)
            page = context.new_page()
            page.goto(origin + '/tests/', wait_until='domcontentloaded')
            volume = page.evaluate('''events=>{
                const prefix='hewrs:outfit-feedback:v1:event:';
                let count=0,characters=0,error=null,firstKey=null,lastKey=null;
                const start=performance.now();
                for(const event of events){
                    const key=prefix+event.id;
                    const value=JSON.stringify(event);
                    try{localStorage.setItem(key,value);}catch(e){error={name:e.name,message:e.message};break;}
                    count++;characters+=key.length+value.length;firstKey ||= key;lastKey=key;
                }
                return {targetEvents:30000,writtenEvents:count,error,
                    keyAndValueCharacters:characters,estimatedUtf16Bytes:characters*2,
                    durationMs:performance.now()-start,firstKey,lastKey,
                    retainedFirst:localStorage.getItem(firstKey)!==null,
                    retainedLast:localStorage.getItem(lastKey)!==null};
            }''', events)
            result['observations']['local_storage_history_volume'] = volume
            check('Quota characterization retained earliest and latest successfully written events',
                  volume['writtenEvents'] > 30 and volume['retainedFirst'] and volume['retainedLast'])
            page.reload(wait_until='domcontentloaded')
            persistent = page.evaluate('''({firstKey,lastKey})=>({
                first:localStorage.getItem(firstKey)!==null,last:localStorage.getItem(lastKey)!==null,
                count:localStorage.length})''', volume)
            volume['afterReload'] = persistent
            check('Successfully written history survives reload without recycling',
                  persistent['first'] and persistent['last'] and persistent['count'] == volume['writtenEvents'])
            print('OBSERVATION: quota', json.dumps(volume), flush=True)
            context.close()
            check('No external or provider requests', not external)
            check('No uncaught page exceptions', not errors)
            browser.close()
            result['status'] = 'completed'
    finally:
        server.shutdown()
        OUT.write_text(json.dumps(result, indent=2) + '\n')


if __name__ == '__main__':
    main()
