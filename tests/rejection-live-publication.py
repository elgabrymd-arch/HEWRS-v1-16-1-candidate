#!/usr/bin/env python3
"""Verify the published application using an empty, isolated browser profile.

All application responses come from the live HTTPS site. The checkout is used
only for expected file hashes. No owner browser data or AI service is accessed.
"""
import argparse
import concurrent.futures
import hashlib
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

from playwright.sync_api import sync_playwright


class StartupFiles(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'script' and values.get('src'):
            self.paths.append(values['src'])
        if tag == 'link' and values.get('rel') == 'stylesheet' and values.get('href'):
            self.paths.append(values['href'])
        if values.get('data-engine-index'):
            self.paths.append(values['data-engine-index'])


def digest(value):
    return hashlib.sha256(value).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='https://elgabrymd-arch.github.io/HEWRS-v1-16-1-candidate/')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path)
    parser.add_argument('--publication-wait', type=int, default=600)
    parser.add_argument('--executable')
    args = parser.parse_args()
    root = args.root.resolve()
    evidence = (args.output or root / 'evidence/rejection_publication').resolve()
    evidence.mkdir(parents=True, exist_ok=True)
    base = args.url.rstrip('/') + '/'
    parts = urllib.parse.urlsplit(base)
    if parts.scheme != 'https' or parts.netloc != 'elgabrymd-arch.github.io' or parts.path != '/HEWRS-v1-16-1-candidate/':
        raise ValueError('The publication check is restricted to the established HEWRS Pages URL.')
    checks, errors, external, failed_requests, bad_responses = [], [], [], [], []
    result = {
        'schema': 'hewrs.live-publication.v1',
        'url': base,
        'expected_commit': os.environ.get('GITHUB_SHA'),
        'started_at': datetime.now(timezone.utc).isoformat(),
        'fresh_isolated_profile': True,
        'owner_data_accessed': False,
        'application_response_source': 'live_https_only',
        'checks': checks,
        'page_errors': errors,
        'external_requests': external,
        'failed_requests': failed_requests,
        'http_errors': bad_responses,
        'observations': {},
    }

    def check(name, condition):
        checks.append({'name': name, 'passed': bool(condition)})
        print(('PASS: ' if condition else 'FAIL: ') + name, flush=True)
        if not condition:
            raise AssertionError(name)

    startup = StartupFiles()
    startup.feed((root / 'index.html').read_text())
    resources = {'': 'index.html', 'app.html': 'app.html'}
    for relative in startup.paths:
        split = urllib.parse.urlsplit(relative)
        if split.scheme or split.netloc or split.path.startswith('/') or '..' in Path(split.path).parts:
            raise ValueError('Unexpected nonlocal startup dependency: ' + relative)
        resources[relative] = split.path
    expected = {url: digest((root / path).read_bytes()) for url, path in resources.items()}
    publication_tag = os.environ.get('GITHUB_SHA') or expected['']
    page_url = base + '?hewrs-publication=' + publication_tag[:12]
    result['verification_url'] = page_url

    def inspect(relative):
        url = page_url if not relative else urllib.parse.urljoin(base, relative)
        if relative == 'app.html':
            url += '?hewrs-publication=' + publication_tag[:12]
        request = urllib.request.Request(url, headers={'User-Agent': 'HEWRS-publication-verification/1.0'})
        with urllib.request.urlopen(request, timeout=40) as response:
            body = response.read()
            return {
                'path': relative or '/',
                'status': response.status,
                'sha256': digest(body),
                'expected_sha256': expected[relative],
                'bytes': len(body),
                'matches': response.status == 200 and digest(body) == expected[relative],
            }

    def wait_for_publication():
        deadline = time.monotonic() + args.publication_wait
        attempts = 0
        latest = []
        while True:
            attempts += 1
            try:
                main_page = inspect('')
                latest = [main_page]
                if main_page['matches']:
                    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
                        latest.extend(pool.map(inspect, [path for path in resources if path]))
                    if all(item['matches'] for item in latest):
                        result['live_file_identity'] = latest
                        result['observations']['publication_poll_attempts'] = attempts
                        return
                detail = ', '.join(item['path'] for item in latest if not item['matches'])
                print('Waiting for published file identity: ' + detail, flush=True)
            except Exception as error:
                result['last_publication_probe_error'] = str(error)
                print('Waiting for live site: ' + str(error), flush=True)
            if time.monotonic() >= deadline:
                result['live_file_identity'] = latest
                result['observations']['publication_poll_attempts'] = attempts
                raise AssertionError('The live site did not serve the expected checkout bytes before the publication deadline.')
            time.sleep(min(10, max(0, deadline - time.monotonic())))

    def ready(page):
        page.wait_for_function('()=>globalThis.HEWRS_READY===true && !!HEWRSApp.rejection && !!HEWRSApp.tieExposure', timeout=120000)
        page.evaluate('async()=>{await HEWRSApp.rejection.ready; await HEWRSApp.ownerFeedback.sync();}')
        page.wait_for_function('()=>HEWRSApp.ownerFeedback.status().ready && !HEWRSApp.feedbackReadError && !document.getElementById("generate-options").disabled')

    def rows(page):
        return page.evaluate('''()=>HEWRSApp.state().report.options.map(o=>({
            selection:o._hewrsConnected.canonical_selection,value:HEWRSOutfitFeedback.stable(o),
            clothingKey:HEWRSOutfitFeedback.key(o._hewrsConnected.canonical_selection,'clothing')}))''')

    page = None
    browser = None
    try:
        wait_for_publication()
        check('Live root, app entrypoint, startup scripts/styles and lazy outfit index match the checkout', True)
        with sync_playwright() as playwright:
            launch = {'headless': True}
            if args.executable:
                launch['executable_path'] = args.executable
            browser = playwright.chromium.launch(**launch)
            result['browser'] = 'chromium'
            result['browser_version'] = browser.version
            context = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=False)

            def route(request):
                if request.request.url.startswith(base):
                    request.continue_()
                else:
                    external.append(request.request.url)
                    request.abort()

            context.route('**/*', route)
            page = context.new_page()
            page.set_default_timeout(90000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('requestfailed', lambda request: failed_requests.append({'url': request.url, 'failure': request.failure}))
            page.on('response', lambda response: bad_responses.append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
            response = page.goto(page_url, wait_until='domcontentloaded', timeout=120000)
            check('The browser receives the exact published HTML', response is not None and response.status == 200 and digest(response.body()) == expected[''])
            ready(page)
            page.wait_for_load_state('networkidle', timeout=90000)
            check('Published app starts with empty, validated IndexedDB feedback', page.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().events.length===0 && HEWRSApp.ownerFeedback.snapshot().active.length===0'))
            untouched = page.evaluate('()=>({wear:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.snapshot()})')
            page.screenshot(path=str(evidence / 'live-home-390x844.png'), full_page=True)
            page.click('#generate-options')
            page.wait_for_function('''()=>{const a=HEWRSApp,s=a.state();return !s.busy && s.page==='outfits'
                && s.optionCount>0 && Array.isArray(s.report?.options) && document.getElementById('avatar').dataset.status==='ready';}''', timeout=360000)
            current = rows(page)
            original_request = page.evaluate('()=>HEWRSOutfitFeedback.stable(HEWRSApp.state().request)')
            check('Live generation returns 20 valid outfits with a ready avatar', len(current) == 20 and page.evaluate('()=>{const a=HEWRSApp,s=a.state();return a.connection.controller.verifyOptionSet(s.report.options,s.request) && s.report.options.every(o=>a.ownerFeedback.allowed(o._hewrsConnected.canonical_selection,s.request.context));}'))
            page.wait_for_load_state('networkidle', timeout=90000)
            check('Displayed garment thumbnails load with real image dimensions', page.evaluate('()=>{const images=[...document.querySelectorAll("#option-card-items img")];return images.length>0 && images.every(i=>i.complete && i.naturalWidth>0);}'))
            page.screenshot(path=str(evidence / 'live-first-outfit-390x844.png'), full_page=True)
            removed = []
            refill_started = time.perf_counter()
            for number in range(20):
                selected = page.evaluate('()=>HEWRSApp.state().selection')
                removed.append(selected)
                key = page.evaluate('s=>HEWRSOutfitFeedback.key(s,"clothing")', selected)
                kept = [row for row in current if row['clothingKey'] != key]
                before_count = page.evaluate('()=>HEWRSApp.ownerFeedback.snapshot().active.length')
                page.click('#reject-outfit')
                page.select_option('#rejection-scope', 'clothing')
                page.click('#rejection-permanent')
                page.wait_for_function('''count=>{const a=HEWRSApp,s=a.state(),d=document.getElementById('outfit-rejection-dialog');
                    return a.ownerFeedback.status().ready && a.ownerFeedback.snapshot().active.length>count && !s.busy
                    && !d.open && !document.getElementById('reject-outfit').disabled && s.optionCount===20;}''', arg=before_count, timeout=180000)
                current = rows(page)
                page.wait_for_load_state('networkidle', timeout=90000)
                check('Live refill ' + str(number + 1) + ': 20 valid choices, accepted rows unchanged, all prior rejections excluded',
                      len(current) == 20 and [row['value'] for row in current[:len(kept)]] == [row['value'] for row in kept]
                      and page.evaluate('''removed=>{const a=HEWRSApp,s=a.state(),k=x=>HEWRSOutfitFeedback.key(x,'clothing');
                        return a.connection.controller.verifyOptionSet(s.report.options,s.request)
                          && s.report.options.every(o=>a.ownerFeedback.allowed(o._hewrsConnected.canonical_selection,s.request.context)
                            && removed.every(x=>k(x)!==k(o._hewrsConnected.canonical_selection)));}''', removed)
                      and page.evaluate('()=>HEWRSOutfitFeedback.stable(HEWRSApp.state().request)') == original_request)
            result['observations']['twenty_ui_refills_seconds'] = round(time.perf_counter() - refill_started, 4)
            result['observations']['generation_button_clicks'] = 1
            result['observations']['rejected_selections'] = removed
            check('Twenty permanent rejections are retained as twenty active records', page.evaluate('()=>{const s=HEWRSApp.ownerFeedback.snapshot();return s.events.length===20 && s.active.length===20;}'))
            check('Live rejection testing leaves wear and Favorites unchanged', page.evaluate('()=>({wear:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.snapshot()})') == untouched)
            page.screenshot(path=str(evidence / 'live-after-20-rejections-390x844.png'), full_page=True)
            page.reload(wait_until='domcontentloaded')
            ready(page)
            check('All twenty permanent exclusions survive an actual live-page reload', page.evaluate('removed=>{const f=HEWRSApp.ownerFeedback;return f.snapshot().active.length===20 && f.snapshot().events.length===20 && removed.every(s=>!f.allowed(s,"work"));}', removed))
            result['observations']['final_feedback_status'] = page.evaluate('()=>HEWRSApp.ownerFeedback.status()')
            page.evaluate("()=>HEWRSApp.showPage('home')")
            page.click('#home-outfit-rejections')
            page.wait_for_selector('#rejection-records')
            check('Live rejection manager displays all twenty stored records', page.locator('#rejection-records article').count() == 20)
            page.locator('#outfit-rejection-dialog').screenshot(path=str(evidence / 'live-rejection-manager-390x844.png'))
            page.wait_for_load_state('networkidle', timeout=90000)
            check('No external or paid-provider request was made', not external)
            check('No application request failed or returned an HTTP error', not failed_requests and not bad_responses)
            check('No uncaught browser exception occurred', not errors)
            result['status'] = 'passed'
            context.close()
            browser.close()
    except Exception as error:
        result['status'] = 'failed'
        result['error'] = str(error)
        if page is not None:
            try:
                page.screenshot(path=str(evidence / 'failure.png'), full_page=True)
            except Exception:
                pass
        raise
    finally:
        result['finished_at'] = datetime.now(timezone.utc).isoformat()
        result['passed'] = sum(check['passed'] for check in checks)
        result['failed'] = sum(not check['passed'] for check in checks)
        (evidence / 'RESULT.json').write_text(json.dumps(result, indent=2) + '\n')


if __name__ == '__main__':
    main()
