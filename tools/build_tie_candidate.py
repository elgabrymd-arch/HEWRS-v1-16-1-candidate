#!/usr/bin/env python3
"""Reproduce the isolated tie-feedback/rotation candidate delivery.

The owner-accepted Standard builder, sources, release manifest and runtime are
not rewritten. --write only updates the existing preview runtime and its SRI in
the two candidate entrypoints. This tool never publishes or accesses user data.
"""
import argparse
import ast
import base64
import hashlib
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'febe4148fc0b27ee2018d84408714ee1fe712015'
BASE_SHA256 = '2762729a59ef21292bda3c33e98252c1760a1845e3ae9bb4e5b4dbbe22205c83'
RUNTIME = 'runtime/outfit-refill-preview.js'
HEADER = '/* HEWRS V1.25.0-R1 rebuilt combined delivery startup bundle; generated from tools/build.py. */\n'
SUBSTITUTIONS = {
    'src/automatic-engine.js': 'src/outfit-refill-engine.js',
    'src/application.js': 'src/outfit-refill-application.js',
}
EXCLUDED = {'src/runtime-loader.js', 'data/inputs.js', 'data/option-index.js'}
DEPENDENCIES = [
    'src/tie-exposure.js',
    'src/tie-feedback.js',
    'src/outfit-rejection-core.js',
    RUNTIME,
    'src/outfit-rejection-ui.js',
]


def read(path, ref=None):
    if ref is None:
        return (ROOT / path).read_text()
    return subprocess.check_output(['git', 'show', ref + ':' + path], cwd=ROOT).decode()


def assemble(ref=None):
    match = re.search(r'^SCRIPTS=(\[[^\n]+\])', read('tools/build.py', ref), re.M)
    if not match:
        raise ValueError('Cannot read the frozen dependency order.')
    scripts = ast.literal_eval(match[1])
    code = HEADER
    for original in scripts:
        if original in EXCLUDED:
            continue
        path = SUBSTITUTIONS.get(original, original)
        marker = 'PREVIEW SOURCE' if original in SUBSTITUTIONS else 'SOURCE'
        code += '\n/* ' + marker + ': ' + path + ' */\n' + read(path, ref) + '\n;\n'
    return code


def entrypoint(path, digest):
    html = read(path)
    scripts = re.findall(r'<script\b[^>]*\bsrc="([^"]+)"[^>]*>', html)
    scripts = [src.split('?', 1)[0] for src in scripts]
    if any(scripts.count(src) != 1 for src in DEPENDENCIES):
        raise ValueError(path + ': each tie preview dependency must load exactly once.')
    positions = [scripts.index(src) for src in DEPENDENCIES]
    # The two independent data stores may load in either order, but both must
    # exist before the rejection bridge and before candidate application boot.
    if not (max(positions[:2]) < positions[2] < positions[3] < positions[4]):
        raise ValueError(path + ': tie preview dependencies have the wrong load order.')
    pattern = r'(<script\b[^>]*\bsrc="' + re.escape(RUNTIME) + r'(?:\?[^\"]*)?"[^>]*\bintegrity=")[^"]+("[^>]*>)'
    updated, count = re.subn(pattern, lambda m: m[1] + digest + m[2], html)
    if count != 1:
        raise ValueError(path + ': expected one preview runtime script with SRI.')
    return html, updated


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true', help='Regenerate preview runtime and entrypoint SRI locally.')
    mode.add_argument('--check', action='store_true', help='Verify the committed preview delivery (default).')
    parser.add_argument('--verify-base', action='store_true', help='Also verify exact base bundle reproduction using the pinned Git object.')
    args = parser.parse_args()
    if args.verify_base:
        base = assemble(BASE).encode()
        if hashlib.sha256(base).hexdigest() != BASE_SHA256 or base != read(RUNTIME, BASE).encode():
            raise ValueError('Pinned base candidate does not reproduce exactly.')
        print('PASS: pinned rejection candidate reproduces byte-for-byte.')
    code = assemble()
    digest = 'sha256-' + base64.b64encode(hashlib.sha256(code.encode()).digest()).decode()
    pages = {path: entrypoint(path, digest) for path in ('index.html', 'app.html')}
    if pages['index.html'][0] != pages['app.html'][0]:
        raise ValueError('Candidate index.html and app.html differ.')
    if args.write:
        (ROOT / RUNTIME).write_text(code)
        for path, (_, updated) in pages.items():
            (ROOT / path).write_text(updated)
        print('WROTE: preview runtime and candidate runtime SRI only; nothing published.')
    else:
        if read(RUNTIME) != code:
            raise ValueError('Candidate runtime is stale. Run tools/build_tie_candidate.py --write.')
        for path, (current, updated) in pages.items():
            if current != updated:
                raise ValueError(path + ': candidate runtime SRI is stale.')
        print('PASS: committed preview bundle, dependency order and runtime SRI match candidate sources.')
    print('Preview SHA256: ' + hashlib.sha256(code.encode()).hexdigest())


if __name__ == '__main__':
    main()
