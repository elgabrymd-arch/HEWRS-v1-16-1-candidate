#!/usr/bin/env python3
"""Verify every active HTML script/style and lazy index against actual bytes."""
import base64
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Resources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []

    def handle_starttag(self, tag, attrs):
        row = dict(attrs)
        if tag == 'script' and row.get('src'):
            self.items.append((tag, row['src'], row))
        elif tag == 'link' and row.get('rel') == 'stylesheet':
            self.items.append((tag, row['href'], row))


def main():
    checks = []
    for entrypoint in ('index.html', 'app.html', 'suit-photo-review.html'):
        parser = Resources()
        parser.feed((ROOT / entrypoint).read_text())
        seen = set()
        for kind, url, attrs in parser.items:
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc:
                raise AssertionError('Unexpected remote application resource: ' + url)
            resource = parsed.path
            data = (ROOT / resource).read_bytes()
            digest = hashlib.sha256(data).digest()
            expected = 'sha256-' + base64.b64encode(digest).decode()
            assert attrs.get('integrity') == expected, (entrypoint, resource, 'integrity')
            assert parse_qs(parsed.query).get('v') == [digest.hex()[:16]], (entrypoint, resource, 'cache key')
            assert resource not in seen, (entrypoint, resource, 'duplicate script/style')
            seen.add(resource)
            checks.append({'entrypoint': entrypoint, 'resource': resource, 'sha256': digest.hex(), 'passed': True})
            if attrs.get('data-engine-index'):
                index = urlsplit(attrs['data-engine-index'])
                raw = (ROOT / index.path).read_bytes()
                expected_digest = hashlib.sha256(raw).digest()
                assert attrs.get('data-engine-integrity') == 'sha256-' + base64.b64encode(expected_digest).decode()
                assert parse_qs(index.query).get('v') == [expected_digest.hex()[:16]]
                checks.append({'entrypoint': entrypoint, 'resource': index.path, 'sha256': expected_digest.hex(), 'passed': True})
    loader = 'src/reviewed-rejection-integration.js'
    source = (ROOT / loader).read_text()
    bindings = json.loads(re.search(r'const MODULE_DELIVERY=Object.freeze\((\{.*?\})\);', source, re.S)[1])
    assert set(bindings) == {'feedback-candidate/reviewed/rebuild-core.js', 'feedback-candidate/reviewed/reviewed-selector.js', 'feedback-candidate/reviewed/native-reviewed-bridge.js', 'hewrs-stage93-ranking-v2.js', 'hewrs-batch10-discovery-16eeb4d0b24f21a9.js'}, 'Unexpected lazy module set'
    for resource, binding in bindings.items():
        digest = hashlib.sha256((ROOT / resource).read_bytes()).digest()
        assert binding['src'] == resource + '?v=' + digest.hex()[:16], (loader, resource, 'cache key')
        assert binding['integrity'] == 'sha256-' + base64.b64encode(digest).decode(), (loader, resource, 'integrity')
        checks.append({'entrypoint': loader, 'resource': resource, 'sha256': digest.hex(), 'passed': True})
    assert (ROOT / 'index.html').read_bytes() == (ROOT / 'app.html').read_bytes(), 'Entrypoints differ'
    destination = ROOT / 'evidence/five_round_20261119/DELIVERY.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({'schema': 'hewrs.active-delivery-audit.v1', 'checks': checks, 'entrypoints_equal': True, 'failed': 0}, indent=2) + '\n')
    print('PASS:', len(checks), 'active resource integrity/cache bindings; both entrypoints equal')


if __name__ == '__main__':
    main()
