#!/usr/bin/env python3
"""Build the isolated collar-review entrypoint without changing Standard.

The current accepted delivery must reproduce through build_tie_candidate.py.
Its original entrypoints, rejection interfaces, data stores and lazy delivery
remain intact. Only the two collar modules are inserted between the batch
renderer and the mixed renderer in a separate startup bundle.

--check compares candidate files without writing to the repository. The older
STANDARD_RELEASE manifest and archived runtime remain unchanged; its historical
build lock does not describe the current accepted rejection/rotation release.
This tool never publishes, changes garment images, or accesses browser storage.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import importlib.util
import json
import os
import re
import sys
import tempfile
from html.parser import HTMLParser
from urllib.parse import urlsplit

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
EXTRA_SOURCES = ('data/collar-repairs.js', 'src/collar-repairs.js')
ENTRYPOINT = 'collar-candidate.html'
RELEASE_RECORD = 'COLLAR_CANDIDATE_RELEASE.json'
ANCHOR = 'src/batch10-renderer.js'
NEXT_SOURCE = 'src/mixed-renderer.js'
BADGE_STYLE = (
    '<style id="hewrs-collar-candidate-label">'
    '#hewrs-collar-candidate-label-text{margin:0;padding:7px 14px;'
    'background:#f2ead7;color:#51401d;border-bottom:1px solid #d8c8a5;'
    'font:600 12px/1.4 system-ui,sans-serif;text-align:center}'
    '</style>'
)
BADGE = (
    '<p id="hewrs-collar-candidate-label-text" '
    'aria-label="Collar correction candidate">Collar correction candidate</p>'
)


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def integrity(raw):
    return 'sha256-' + base64.b64encode(hashlib.sha256(raw).digest()).decode('ascii')


def resource(raw):
    return {'bytes': len(raw), 'sha256': sha256(raw)}


def read(root, name):
    return (root / name).read_bytes()


def active_module(root):
    spec = importlib.util.spec_from_file_location('hewrs_active_build', root / 'tools/build_tie_candidate.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.ROOT = root
    return module


class Resources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == 'script' and attributes.get('src'):
            self.rows.append((tag, attributes['src'], attributes))
        elif tag == 'link' and attributes.get('rel') == 'stylesheet':
            self.rows.append((tag, attributes['href'], attributes))


def validate_baseline(root, module):
    """Reproduce the active bundle and preserve its actual delivery contract."""
    frozen_raw = read(root, 'STANDARD_RELEASE.json')
    frozen = json.loads(frozen_raw)
    # The historical frozen artifact is retained as an archive, not substituted
    # for the newer accepted delivery that includes cumulative rejection fixes.
    if sha256(read(root, frozen['runtime'])) != frozen['runtime_sha256']:
        raise ValueError('Archived Standard runtime differs from its frozen hash')
    code = module.assemble().encode('utf-8')
    if code != read(root, module.RUNTIME):
        raise ValueError('Current active runtime does not reproduce from its source generator')
    current_delivery, expected_delivery = module.reviewed_delivery()
    if current_delivery != expected_delivery:
        raise ValueError('Current reviewed-module delivery is stale')
    active_html = None
    for name in ('index.html', 'app.html'):
        current, expected = module.entrypoint(name, integrity(code))
        if current != expected:
            raise ValueError('Current active resource integrity/cache bindings differ: ' + name)
        if active_html is not None and active_html != current:
            raise ValueError('Current active index.html and app.html differ')
        active_html = current
    parser = Resources()
    parser.feed(active_html)
    current_resources = {}
    for _, url, attributes in parser.rows:
        parsed = urlsplit(url)
        if parsed.scheme or parsed.netloc:
            raise ValueError('Unexpected remote active application resource: ' + url)
        current_resources[parsed.path] = resource(read(root, parsed.path))
        if attributes.get('data-engine-index'):
            index = urlsplit(attributes['data-engine-index']).path
            current_resources[index] = resource(read(root, index))
    installed = {
        name: read(root, name)
        for name in ['index.html', 'app.html', 'STARTUP_RESOURCES.json',
                     'STANDARD_RELEASE.json', frozen['runtime'], module.RUNTIME]
    }
    return code, active_html, installed, current_resources, {
        'validator': 'tools/build_tie_candidate.py:assemble,entrypoint,reviewed_delivery',
        'exact_rebuild': True,
        'preserved_delivery': {name: resource(raw) for name, raw in installed.items()},
        'preserved_resource_count': len(current_resources),
        'historical_standard': {
            'manifest_sha256': sha256(frozen_raw),
            'accepted_commit': frozen['accepted_commit'],
            'runtime': frozen['runtime'],
            'runtime_sha256': frozen['runtime_sha256'],
            'archived_runtime_hash_matches': True,
            'current_source_build_gate': 'NOT_APPLICABLE_TO_LATER_ACCEPTED_ACTIVE_RELEASE',
        },
    }


def generate(root=ROOT):
    module = active_module(root)
    active_code, active_html, protected, active_resources, baseline = validate_baseline(root, module)
    code = active_code.decode('utf-8')
    sources = re.findall(r'\n/\* (?:PREVIEW )?SOURCE: ([^*]+) \*/\n', code)
    if sources.count(ANCHOR) != 1 or sources.count(NEXT_SOURCE) != 1:
        raise ValueError('Expected collar renderer boundary is absent or ambiguous')
    anchor = sources.index(ANCHOR) + 1
    if sources[anchor] != NEXT_SOURCE:
        raise ValueError('Expected batch/mixed renderer adjacency has changed')
    if any(name in sources for name in EXTRA_SOURCES):
        raise ValueError('Candidate sources must not already be part of the active runtime')
    sources[anchor:anchor] = list(EXTRA_SOURCES)
    loader, inputs, index = 'src/runtime-loader.js', 'data/inputs.js', 'data/option-index.js'
    source_bytes = {name: read(root, name) for name in EXTRA_SOURCES}
    repair_data = json.loads(read(root, 'data/collar-repairs.json'))
    expected_data_script = (
        'globalThis.HEWRS_COLLAR_REPAIRS='
        + json.dumps(repair_data, separators=(',', ':')) + ';\n'
    ).encode('utf-8')
    if source_bytes['data/collar-repairs.js'] != expected_data_script:
        raise ValueError('Collar JSON contract differs from the installed data script')
    if repair_data['source_input_sha256'] != sha256(read(root, 'data/inputs.json')):
        raise ValueError('Collar repair contract was prepared for different garment sources')
    insertion = ''
    for name in EXTRA_SOURCES:
        insertion += '\n/* SOURCE: ' + name + ' */\n' + source_bytes[name].decode('utf-8') + '\n;\n'
    marker = '\n/* SOURCE: ' + NEXT_SOURCE + ' */\n'
    if code.count(marker) != 1:
        raise ValueError('Mixed renderer marker is not unique')
    code = code.replace(marker, insertion + marker, 1)
    if code.replace(insertion, '', 1).encode('utf-8') != active_code:
        raise ValueError('Candidate changed bytes outside the two inserted modules')
    bundle = code.encode('utf-8')
    runtime_name = 'runtime/collar-candidate-' + sha256(bundle)[:20] + '.js'
    replacement = (f'<script defer src="{runtime_name}?v={sha256(bundle)[:16]}" '
                   f'integrity="{integrity(bundle)}"></script>')
    pattern = r'<script\b[^>]*\bsrc="' + re.escape(module.RUNTIME) + r'(?:\?[^\"]*)?"[^>]*></script>'
    html, runtime_count = re.subn(pattern, replacement, active_html)
    if runtime_count != 1:
        raise ValueError('Expected exactly one active runtime tag')
    html, title_count = re.subn(r'<title>[^<]*</title>', '<title>HEWRS · Collar correction candidate</title>', html)
    if title_count != 1 or '</head>' not in html or '</header>' not in html:
        raise ValueError('Expected candidate title/header anchors have changed')
    html = html.replace('</head>', BADGE_STYLE + '</head>', 1)
    html = html.replace('</header>', '</header>' + BADGE, 1)
    entrypoint = html.encode('utf-8')
    resources = dict(active_resources)
    del resources[module.RUNTIME]
    resources[runtime_name] = resource(bundle)
    parser = Resources()
    parser.feed(html)
    startup_scripts = [urlsplit(url).path for tag, url, _ in parser.rows if tag == 'script']
    record = {
        'schema': 'hewrs.collar-candidate-release.v1',
        'status': 'CANDIDATE_REQUIRES_RENDER_VERIFICATION',
        'entrypoint': ENTRYPOINT,
        'entrypoint_sha256': sha256(entrypoint),
        'runtime': runtime_name,
        'runtime_sha256': sha256(bundle),
        'source_input_sha256': sha256(read(root, 'data/inputs.json')),
        'baseline_runtime': module.RUNTIME,
        'baseline_runtime_sha256': sha256(active_code),
        'baseline_entrypoint_sha256': sha256(active_html.encode('utf-8')),
        'baseline_preservation': baseline,
        'candidate_sources': {name: resource(source_bytes[name]) for name in EXTRA_SOURCES},
        'bundle_sources': sources,
        'startup_scripts': startup_scripts,
        'deferred_index': index,
        'resource_integrity': resources,
        'browser_storage_migration': False,
        'source_asset_writes': False,
        'network_publication': False,
    }
    for name, raw in protected.items():
        if read(root, name) != raw:
            raise ValueError('Accepted delivery changed during candidate construction: ' + name)
    return {
        runtime_name: bundle,
        ENTRYPOINT: entrypoint,
        RELEASE_RECORD: (json.dumps(record, indent=2) + '\n').encode('utf-8'),
    }, record


def write_atomic(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix='.collar-candidate-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(raw)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Compare candidate outputs without writing to the repository')
    args = parser.parse_args()
    outputs, record = generate()
    for name, raw in outputs.items():
        path = ROOT / name
        if args.check:
            if not path.exists() or path.read_bytes() != raw:
                raise ValueError('Candidate output is missing or stale: ' + name)
        elif path.exists() and path.read_bytes() == raw:
            continue
        else:
            if name.startswith('runtime/') and path.exists():
                raise ValueError('Fingerprint collision or corrupt immutable candidate bundle: ' + name)
            write_atomic(path, raw)
    print(json.dumps({
        'status': 'PASS',
        'check_only': args.check,
        'entrypoint': record['entrypoint'],
        'entrypoint_sha256': record['entrypoint_sha256'],
        'runtime': record['runtime'],
        'runtime_sha256': record['runtime_sha256'],
        'source_input_sha256': record['source_input_sha256'],
        'standard_preserved': True,
        'outputs': {name: resource(raw) for name, raw in outputs.items()},
    }, indent=2))


if __name__ == '__main__':
    main()
