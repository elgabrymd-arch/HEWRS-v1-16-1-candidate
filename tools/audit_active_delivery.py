#!/usr/bin/env python3
"""Verify every active HTML script/style and lazy index against actual bytes."""
import base64
import hashlib
import json
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
    for entrypoint in ('index.html', 'app.html'):
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
    assert (ROOT / 'index.html').read_bytes() == (ROOT / 'app.html').read_bytes(), 'Entrypoints differ'
    destination = ROOT / 'evidence/five_round_20261119/DELIVERY.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({'schema': 'hewrs.active-delivery-audit.v1', 'checks': checks, 'entrypoints_equal': True, 'failed': 0}, indent=2) + '\n')
    print('PASS:', len(checks), 'active resource integrity/cache bindings; both entrypoints equal')


if __name__ == '__main__':
    main()
