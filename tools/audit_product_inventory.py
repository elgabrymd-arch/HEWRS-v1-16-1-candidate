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

ROOT = Path(__file__).resolve().parents[1]
CODE_SUFFIXES = {'.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.html', '.css', '.yml', '.yaml', '.sh'}
HISTORICAL = ('rollback/', 'UPDATE/', 'provenance/', 'evidence/')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='evidence/five_round_20261119/INVENTORY.json')
    args = parser.parse_args()
    tracked = subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines()
    entrypoints = {}
    directly_loaded = set()
    for name in ('index.html', 'app.html'):
        html = (ROOT / name).read_text()
        scripts = re.findall(r'<script\b[^>]*\bsrc="([^"]+)"', html)
        styles = re.findall(r'<link\b[^>]*\bhref="([^"]+)"', html)
        files = [value.split('?', 1)[0] for value in scripts + styles]
        directly_loaded.update(files)
        entrypoints[name] = {'sha256': hashlib.sha256(html.encode()).hexdigest(), 'scripts': scripts, 'styles': styles}
    bundle = ROOT / 'runtime/outfit-refill-preview.js'
    bundle_sources = re.findall(r'/\* (?:PREVIEW )?SOURCE: ([^*]+) \*/', bundle.read_text())
    bundle_sources = [name.strip() for name in bundle_sources]
    active_sources = set(bundle_sources) | directly_loaded
    active_sources.add('data/option-index.js')
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
        elif name in active_sources:
            role = 'active_runtime_bundle' if name.startswith('runtime/') else 'active_application_source_or_data'
        elif name.startswith('tests/'):
            role = 'test_or_test_helper'
        elif name.startswith('tools/') or name == 'apply_update.py':
            role = 'build_or_release_tool'
        elif name.startswith('.github/'):
            role = 'automation_workflow'
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
              'entrypoints': entrypoints, 'bundle_sources': bundle_sources,
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
