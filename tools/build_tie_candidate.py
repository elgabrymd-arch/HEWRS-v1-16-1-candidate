#!/usr/bin/env python3
"""Reproduce the isolated tie-feedback/rotation candidate delivery.

The owner-accepted Standard builder, sources, release manifest and runtime are
not rewritten. --write updates the current runtime and pins each loaded script
and stylesheet in both candidate entrypoints. This tool never publishes or accesses user data.
"""
import argparse
import ast
import base64
import hashlib
import json
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
# Current transport lifetime repair. The frozen Standard dependency list and
# historical base reproduction remain unchanged.
BEFORE = {'vendor/active50-renderer.js': ['src/render-image-loader.js']}
DEPENDENCIES = [
    'src/tie-exposure.js',
    'src/tie-feedback.js',
    'src/rejection-database.js',
    'src/outfit-rejection-core.js',
    RUNTIME,
    'src/outfit-rejection-ui.js',
    'src/reviewed-rejection-integration.js',
    'src/image-assessment-panel.js',
]
REVIEWED_LOADER = 'src/reviewed-rejection-integration.js'
REVIEWED_MODULES = [
    'feedback-candidate/reviewed/rebuild-core.js',
    'feedback-candidate/reviewed/reviewed-selector.js',
    'feedback-candidate/reviewed/native-reviewed-bridge.js',
    'hewrs-stage93-ranking-v2.js',
    'hewrs-batch10-discovery-16eeb4d0b24f21a9.js',
]
UTILITIES = ['suit-photo-review.html']


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
        for dependency in BEFORE.get(original, []):
            exists = ref is None or subprocess.run(
                ['git', 'cat-file', '-e', ref + ':' + dependency], cwd=ROOT,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
            if exists:
                code += '\n/* SOURCE: ' + dependency + ' */\n' + read(dependency, ref) + '\n;\n'
        path = SUBSTITUTIONS.get(original, original)
        marker = 'PREVIEW SOURCE' if original in SUBSTITUTIONS else 'SOURCE'
        code += '\n/* ' + marker + ': ' + path + ' */\n' + read(path, ref) + '\n;\n'
    return code


def reviewed_delivery():
    bindings = {}
    for path in REVIEWED_MODULES:
        digest = hashlib.sha256((ROOT / path).read_bytes()).digest()
        bindings[path] = {'src': path + '?v=' + digest.hex()[:16],
                          'integrity': 'sha256-' + base64.b64encode(digest).decode()}
    current = read(REVIEWED_LOADER)
    replacement = '/* BEGIN GENERATED REVIEWED MODULE DELIVERY */\nconst MODULE_DELIVERY=Object.freeze(' + json.dumps(bindings, indent=2) + ');\n/* END GENERATED REVIEWED MODULE DELIVERY */'
    updated, count = re.subn(r'/\* BEGIN GENERATED REVIEWED MODULE DELIVERY \*/.*?/\* END GENERATED REVIEWED MODULE DELIVERY \*/', replacement, current, flags=re.S)
    if count != 1:
        raise ValueError('Expected one reviewed module delivery manifest.')
    return current, updated


def entrypoint(path, digest):
    html = read(path)
    scripts = re.findall(r'<script\b[^>]*\bsrc="([^"]+)"[^>]*>', html)
    scripts = [src.split('?', 1)[0] for src in scripts]
    if any(scripts.count(src) != 1 for src in DEPENDENCIES):
        raise ValueError(path + ': each tie preview dependency must load exactly once.')
    positions = [scripts.index(src) for src in DEPENDENCIES]
    # The two independent data stores may load in either order, but both must
    # exist before the rejection bridge and before candidate application boot.
    if not (max(positions[:2]) < positions[2] < positions[3] < positions[4] < positions[5] < positions[6] < positions[7]):
        raise ValueError(path + ': tie preview dependencies have the wrong load order.')
    pattern = r'(<script\b[^>]*\bsrc="' + re.escape(RUNTIME) + r'(?:\?[^\"]*)?"[^>]*\bintegrity=")[^"]+("[^>]*>)'
    updated, count = re.subn(pattern, lambda m: m[1] + digest + m[2], html)
    if count != 1:
        raise ValueError(path + ': expected one preview runtime script with SRI.')
    return html, pin_resources(updated, digest)


def pin_resources(html, digest):
    # Every separately loaded script/style is part of the same delivery. Pin
    # both integrity and URL so an updated picker or store cannot be paired with
    # a browser-cached older version after an otherwise valid runtime update.
    def pin(match):
        tag = match[0]
        attribute = 'src' if tag.startswith('<script') else 'href'
        resource = re.search(r'\b' + attribute + r'="([^"]+)"', tag)
        if not resource:
            return tag
        local = resource[1].split('?', 1)[0]
        if re.match(r'^(?:[a-z]+:|//|#)', local):
            return tag
        content_digest = base64.b64decode(digest.removeprefix('sha256-')) if local == RUNTIME else hashlib.sha256((ROOT / local).read_bytes()).digest()
        sri = 'sha256-' + base64.b64encode(content_digest).decode()
        tag = tag[:resource.start(1)] + local + '?v=' + content_digest.hex()[:16] + tag[resource.end(1):]
        if re.search(r'(?<=\s)integrity="[^"]*"', tag):
            tag = re.sub(r'(?<=\s)integrity="[^"]*"', 'integrity="' + sri + '"', tag)
        else:
            tag = tag[:-1] + ' integrity="' + sri + '">'
        lazy = re.search(r'\bdata-engine-index="([^"]+)"', tag)
        if lazy:
            index = lazy[1].split('?', 1)[0]
            index_digest = hashlib.sha256((ROOT / index).read_bytes()).digest()
            tag = tag[:lazy.start(1)] + index + '?v=' + index_digest.hex()[:16] + tag[lazy.end(1):]
            tag = re.sub(r'\bdata-engine-integrity="[^"]*"', 'data-engine-integrity="sha256-' + base64.b64encode(index_digest).decode() + '"', tag)
        return tag
    return re.sub(r'<script\b[^>]*\bsrc="[^"]+"[^>]*>|<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="[^"]+"[^>]*>', pin, html)


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
    delivery, pinned_delivery = reviewed_delivery()
    if args.write:
        (ROOT / REVIEWED_LOADER).write_text(pinned_delivery)
    elif delivery != pinned_delivery:
        raise ValueError('Reviewed lazy module delivery is stale. Run tools/build_tie_candidate.py --write.')
    code = assemble()
    digest = 'sha256-' + base64.b64encode(hashlib.sha256(code.encode()).digest()).decode()
    pages = {path: entrypoint(path, digest) for path in ('index.html', 'app.html')}
    if pages['index.html'][0] != pages['app.html'][0]:
        raise ValueError('Candidate index.html and app.html differ.')
    pages.update({path: (read(path), pin_resources(read(path), digest)) for path in UTILITIES})
    if args.write:
        (ROOT / RUNTIME).write_text(code)
        for path, (_, updated) in pages.items():
            (ROOT / path).write_text(updated)
        print('WROTE: current runtime, candidate and utility resource/SRI bindings, and lazy reviewed delivery; nothing published.')
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
