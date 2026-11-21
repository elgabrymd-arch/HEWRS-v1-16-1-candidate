#!/usr/bin/env python3
"""Inventory code lineage and the actual committed app without executing it."""
import argparse
import ast
import hashlib
import json
import re
import subprocess
from collections import Counter
from pathlib import Path
from verify_active_delivery import describe

ROOT = Path(__file__).resolve().parents[1]
CODE_SUFFIXES = {'.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.html', '.css', '.yml', '.yaml', '.sh'}
HISTORICAL = ('rollback/', 'UPDATE/', 'provenance/', 'evidence/')
REVIEWED_LOADER = 'src/reviewed-rejection-integration.js'
# These are current lazy loads, not alternative application entrypoints. Keep
# their exact source edges explicit so retained files cannot be mistaken for
# the inactive copies with the same module names at the repository root.
REVIEWED_DYNAMIC_SCRIPTS = (
    'feedback-candidate/reviewed/rebuild-core.js',
    'feedback-candidate/reviewed/reviewed-selector.js',
    'feedback-candidate/reviewed/native-reviewed-bridge.js',
    'hewrs-stage93-ranking-v2.js',
    'hewrs-batch10-discovery-16eeb4d0b24f21a9.js',
)
CURRENT_UTILITIES = {'suit-photo-review.html': 'src/blazer-picker-preview.js'}
LINEAGE_REVIEW = 'evidence/five_round_20261119/ui-round4-reachability.json'


def page_resources(name):
    html = (ROOT / name).read_text()
    scripts = re.findall(r'<script\b[^>]*\bsrc="([^"]+)"', html)
    styles = re.findall(r'<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"', html)
    return html, scripts, styles


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='evidence/five_round_20261119/INVENTORY.json')
    args = parser.parse_args()
    tracked = subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines()
    review = json.loads((ROOT / LINEAGE_REVIEW).read_text())
    resolved = {row['path']: row for row in review['resolved_files'] + review['retained_entrypoints']}
    entrypoints = {}
    directly_loaded = set()
    edges = []
    for name in ('index.html', 'app.html'):
        html, scripts, styles = page_resources(name)
        files = [value.split('?', 1)[0] for value in scripts + styles]
        directly_loaded.update(files)
        entrypoints[name] = {'sha256': hashlib.sha256(html.encode()).hexdigest(), 'scripts': scripts, 'styles': styles}
        edges.extend({'from': name, 'to': value.split('?', 1)[0], 'kind': kind, 'url': value}
                     for kind, values in [('script', scripts), ('stylesheet', styles)] for value in values)
    active_delivery = describe()
    bundle = ROOT / active_delivery['runtime']
    bundle_sources = re.findall(r'/\* (?:(?:PREVIEW|CONTINUOUS SHIRT) )?SOURCE: ([^*]+) \*/', bundle.read_text())
    bundle_sources = [name.strip() for name in bundle_sources]
    edges.extend({'from': active_delivery['runtime'], 'to': name, 'kind': 'bundled_source'}
                 for name in bundle_sources)
    active_sources = set(bundle_sources) | directly_loaded
    active_sources.add('data/option-index.js')
    edges.append({'from': 'src/runtime-loader.js', 'to': 'data/option-index.js', 'kind': 'lazy_script',
                  'binding': 'index.html/app.html data-engine-index and data-engine-integrity'})
    loader = (ROOT / REVIEWED_LOADER).read_text()
    for name in REVIEWED_DYNAMIC_SCRIPTS:
        if Path(name).name not in loader:
            raise ValueError('Current reviewed loader no longer references ' + name)
        edges.append({'from': REVIEWED_LOADER, 'to': name, 'kind': 'lazy_script',
                      'function': 'ensureDiscovery' if 'discovery' in name else 'load'})
        active_sources.add(name)
    utilities = {}
    for name, caller in CURRENT_UTILITIES.items():
        if name not in (ROOT / caller).read_text():
            raise ValueError('Current UI no longer links to utility ' + name)
        html, scripts, styles = page_resources(name)
        utilities[name] = {'sha256': hashlib.sha256(html.encode()).hexdigest(), 'scripts': scripts,
                           'styles': styles, 'linked_from': caller}
        edges.append({'from': caller, 'to': name, 'kind': 'utility_navigation',
                      'condition': 'Suit picker with registered S02/S13 corrected-avatar previews'})
        for kind, values in [('script', scripts), ('stylesheet', styles)]:
            for value in values:
                target = value.split('?', 1)[0]
                active_sources.add(target)
                edges.append({'from': name, 'to': target, 'kind': kind, 'url': value})
        active_sources.add(name)
        if 'href="index.html"' in html:
            edges.append({'from': name, 'to': 'index.html', 'kind': 'return_navigation'})
    for name, row in resolved.items():
        if name in active_sources or name in entrypoints:
            raise ValueError('A reviewed retained file is now reachable; reassess lineage: ' + name)
        if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Retained file changed after lineage review: ' + name)
    files = []
    for name in tracked:
        path = ROOT / name
        if path.suffix.lower() not in CODE_SUFFIXES:
            continue
        raw = path.read_bytes()
        if name.startswith(HISTORICAL):
            role = 'historical_snapshot_or_evidence'
        elif name in ('index.html', 'app.html'):
            role = 'active_entrypoint'
        elif name in utilities:
            role = 'active_utility_entrypoint'
        elif name in active_sources:
            role = 'active_runtime_bundle' if name.startswith('runtime/') else 'active_application_source_or_data'
        elif name.startswith('tests/'):
            role = 'test_or_test_helper'
        elif name.startswith('tools/') or name == 'apply_update.py':
            role = 'build_or_release_tool'
        elif name.startswith('.github/'):
            role = 'automation_workflow'
        elif name in resolved:
            role = resolved[name]['classification']
        elif path.suffix == '.html':
            role = 'alternate_or_historical_entrypoint_to_review'
        else:
            role = 'indirect_dependency_or_inactive_source_to_review'
        syntax_error = None
        if path.suffix == '.py':
            try:
                ast.parse(raw.decode('utf-8-sig'), filename=name)
            except (SyntaxError, UnicodeError) as error:
                syntax_error = str(error)
        files.append({'path': name, 'role': role, 'bytes': len(raw), 'lines': len(raw.splitlines()),
                      'sha256': hashlib.sha256(raw).hexdigest(), 'python_syntax_error': syntax_error})
    result = {'schema': 'hewrs.product-code-inventory.v1',
              'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
              'tracked_file_count': len(tracked), 'code_file_count': len(files),
              'role_counts': dict(Counter(row['role'] for row in files)),
              'entrypoints': entrypoints, 'active_delivery': active_delivery, 'bundle_sources': bundle_sources,
              'reachable_utilities': utilities, 'reachability_edges': edges,
              'lineage_review': {'path': LINEAGE_REVIEW,
                                 'sha256': hashlib.sha256((ROOT / LINEAGE_REVIEW).read_bytes()).hexdigest(),
                                 'resolved_retained_files': len(resolved),
                                 'scope': 'Current browser reachability; retained direct URLs and CommonJS tools remain possible.'},
              'missing_active_files': sorted(name for name in active_sources if not (ROOT / name).is_file()),
              'files': files,
              'limits': ['Static lineage is an inventory, not a claim that each module has passed behavioral review.',
                         'Dynamic dependencies and alternate entrypoint reachability require source review.']}
    target = ROOT / args.output
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ('tracked_file_count', 'code_file_count', 'role_counts', 'missing_active_files')}, indent=2))


if __name__ == '__main__':
    main()
