#!/usr/bin/env python3
"""Current shipped reviewed panel, legacy packet validation and new image board.

Uses a fresh local browser profile and no remote assessment service or writes
to wearer history, Favorites, approvals or production.
"""
import argparse
import functools
import hashlib
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', choices=['chromium', 'webkit'], default='chromium')
    parser.add_argument('--executable', help='Optional local browser executable')
    parser.add_argument('--output', default='evidence/issue22/reviewed-browser')
    args = parser.parse_args()
    output = ROOT/args.output/args.browser
    output.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    origin = 'http://127.0.0.1:'+str(server.server_port)
    errors = []
    record = {'schema': 'hewrs.issue22.reviewed-browser.v1', 'browser': args.browser, 'status': 'FAIL'}
    try:
        with sync_playwright() as playwright:
            launch = {'headless': True}
            if args.executable:
                launch['executable_path'] = args.executable
            browser = getattr(playwright, args.browser).launch(**launch)
            page = browser.new_page(viewport={'width': 1280, 'height': 1000})
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(origin+'/') or route.request.url.startswith('data:') else route.abort())
            page.goto(origin+'/index.html', wait_until='load')
            page.wait_for_function('()=>globalThis.HEWRS_READY&&globalThis.HEWRSApp?.rejection&&globalThis.HEWRSIssue22Reviewed', timeout=120000)
            # Runtime readiness precedes the IndexedDB rejection store opening.
            page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
            before = page.evaluate('''() => ({wear:HEWRSApp.store.snapshot(),favorites:HEWRSApp.favorites.snapshot(),feedback:HEWRSApp.ownerFeedback.snapshot().events})''')
            state = page.evaluate('''async()=>{
              await HEWRSReviewedIntegration.load({initialUpdate:false});
              await HEWRSImageAssessmentUI.load();
              const data=HEWRSReviewedIntegration.baseData(),entries=HEWRSReviewedIntegration.bridge().entries();
              return {base_entries:data.reviews.entries.length,base_stale:data.reviews.entries.filter(HEWRSIssue22Reviewed.isHistoricalEntry).length,
                total_entries:entries.length,assessment:HEWRSImageAssessmentUI.state(),fingerprint:data.catalogue.fingerprint};
            }''')
            assert state['base_entries'] == 129 and state['base_stale'] == 21
            assert state['total_entries'] == 139 and state['assessment']['ready'] and state['assessment']['extra'] == 10, state
            record['source_transition'] = state
            diagnostic = page.evaluate('''async()=>{
              const controls={'rd-view':'all_reviews','rd-style':'AUTO','rd-occasion':'work','rd-mode':'suit','rd-topwear':'S06'};
              for(const [id,value]of Object.entries(controls))document.getElementById(id).value=value;
              const result=await HEWRSReviewedIntegration.update();
              if(!result?.visual?.length)throw Error('No retained S06 historical diagnostic.');
              const labels=[...document.querySelectorAll('#rd-results .rd-result small')].map(x=>x.textContent);
              await HEWRSReviewedIntegration.render(result.visual[0].id);
              return {labels,tier:document.getElementById('rd-tier').textContent,old_board_hidden:document.getElementById('rd-board').hidden,
                current:HEWRSReviewedIntegration.currentEntry().outfit,rendered:HEWRSReviewedIntegration.state().rendered};
            }''')
            assert all('historical review requires reassessment' in text for text in diagnostic['labels']), diagnostic
            assert 'stored review is historical' in diagnostic['tier'] and diagnostic['old_board_hidden'], diagnostic
            record['stale_review_diagnostic'] = diagnostic
            packet = page.evaluate('''async()=>{
              const controls={'rd-view':'explore','rd-style':'MODERN','rd-occasion':'dinner','rd-mode':'blazer','rd-topwear':'B06',
                'rd-pants':'PG002','rd-shirt':'DS001','rd-tie':'__NONE__','rd-shoe':'shoe-8'};
              for(const [id,value]of Object.entries(controls))document.getElementById(id).value=value;
              const result=await HEWRSReviewedIntegration.update();
              if(!result?.selected?.length)throw Error('Expected one current linen exploration possibility.');
              await HEWRSReviewedIntegration.render(result.selected[0].id);
              const packet=await HEWRSImageAssessmentUI.prepareCurrent();
              return {fingerprint:packet.request.catalogue_fingerprint,outfit:packet.request.outfit,
                jacket:packet.request.source_images.find(x=>x.id==='B06'&&x.component==='jacket'),
                board_sha256:packet.request.board.sha256,board_width:packet.request.board.width,board_height:packet.request.board.height,
                board_bytes:packet.board_data_url.length,live_service_invoked:packet.request.privacy.live_service_invoked};
            }''')
            materials = json.loads((ROOT/'data/issue22-materials.json').read_text())
            binding = next(row for row in materials['bindings'].values() if row['garment_id'] == 'B06')
            assert packet['fingerprint'] == state['fingerprint'] and packet['outfit']['tie'] is None
            assert packet['jacket']['sha256'] == binding['display_sha256'] and packet['jacket']['repository_path'] == binding['display_url'], packet
            assert packet['board_width'] == 1600 and packet['board_height'] == 940 and packet['board_bytes'] > 10000
            assert packet['live_service_invoked'] is False
            record['current_material_board'] = packet
            after = page.evaluate('''() => ({wear:HEWRSApp.store.snapshot(),favorites:HEWRSApp.favorites.snapshot(),feedback:HEWRSApp.ownerFeedback.snapshot().events})''')
            assert before == after, 'Reviewing and preparing a packet changed saved wearer data'
            assert not errors, errors
            record.update(status='PASS',saved_wearer_data_unchanged=True,uncaught_errors=errors,
                          entrypoint_sha256=hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest())
            browser.close()
    finally:
        server.shutdown()
        record['uncaught_errors'] = errors
        (output/'RESULT.json').write_text(json.dumps(record, indent=2)+'\n')
    print('ISSUE22_REVIEWED_BROWSER='+json.dumps(record))


if __name__ == '__main__':
    main()
