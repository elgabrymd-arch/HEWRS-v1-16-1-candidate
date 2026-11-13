#!/usr/bin/env python3
"""Stage 11 controlled MODERN policy overlay. No publication or owner-data writes.

Modifies exactly two embedded source modules of the existing Stage 10 runtime.
Preserves all owner-feedback, image assessment, and wardrobe integrations.
"""
from pathlib import Path
import base64
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
ENTRY = ROOT / 'stage10-integration.html'
DIST = ROOT / 'dist/stage11-modern-policy'
TARGET_MODULES = {
    'vendor/ensemble-completion.js': (
        'eb3a441c7f918cd663f81b44952db8c6759c5029',
        '43ed67ee116a63c76f634fd0fbec80e109d2cd98'
    ),
    'src/generation-diagnostics.js': (
        'ff483d6eb7809caada70a38916f316802fb64ef8',
        'cc6308bf518f9fe0c9665b28be262ffc63a6f18f'
    )
}
MARK = '/* SOURCE: {} */\n'
PATTERN = re.compile(
    r'<script defer src="(runtime/hewrs-([a-f0-9]{20})\.js)" integrity="sha256-([A-Za-z0-9+/=]+)"></script>'
)

def blob_sha(text: str) -> str:
    blob = text.encode('utf-8')
    return hashlib.sha1(f'blob {len(blob)}\0'.encode('ascii') + blob).hexdigest()

def sha256(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()

def modules(runtime: str) -> dict:
    out = {}
    markers = list(re.finditer(r'/\* SOURCE: ([^*]+) \*/\n', runtime))
    for m in markers:
        name = m.group(1)
        if name in out:
            raise ValueError('Duplicate runtime module: ' + name)
        end = runtime.find('\n;\n', m.end())
        if end < 0:
            raise ValueError('Module delimiter missing: ' + name)
        out[name] = runtime[m.end():end]
    return out

def main():
    html = ENTRY.read_text('utf-8')
    script_matches = list(PATTERN.finditer(html))
    if len(script_matches) != 1:
        raise ValueError('Expected exactly one embedded Stage 10 runtime script')
    tag = script_matches[0]
    old_path = tag.group(1)
    if old_path != 'runtime/hewrs-29d5d5ceb9c54cf40fbc.js':
        raise ValueError('Stage 10 runtime changed. Review before updating this package builder.')
    old_data = (ROOT / old_path).read_bytes()
    old_hash = sha256(old_data)
    if old_hash[:20] != tag.group(2):
        raise ValueError('Original content fingerprint mismatch')
    if base64.b64encode(bytes.fromhex(old_hash)).decode() != tag.group(3):
        raise ValueError('Original SRI mismatch')

    current = old_data.decode('utf-8')
    before = modules(current)
    if len(before) != 107 or 'src/owner-feedback-integration.js' not in before:
        raise ValueError('Expected owner-feedback-enhanced Stage 10 integration missing')
    if 'connection.ownerFeedback.set(ownerFeedback)' not in before['src/application.js']:
        raise ValueError('Owner feedback adapter missing')
    if 'hewrs.watch-independent-style.v1_24_0' not in before['vendor/ensemble-completion.js']:
        raise ValueError('Original classifier has changed unexpectedly')
    if 'The current Modern rule requires three' not in before['src/generation-diagnostics.js']:
        raise ValueError('Original Modern diagnostics changed unexpectedly')

    replacement_hashes = {}
    updated = current
    for name, (expected_old, expected_new) in TARGET_MODULES.items():
        old = before[name]
        if blob_sha(old) != expected_old:
            raise ValueError('Unrecognized original module: ' + name)
        new = (ROOT / name).read_text('utf-8')
        if blob_sha(new) != expected_new:
            raise ValueError('Unreviewed new source: ' + name)
        old_token = MARK.format(name) + old + '\n;\n'
        new_token = MARK.format(name) + new + '\n;\n'
        if updated.count(old_token) != 1:
            raise ValueError('Cannot uniquely patch module: ' + name)
        updated = updated.replace(old_token, new_token, 1)
        replacement_hashes[name] = {'previous_git_sha': expected_old, 'updated_git_sha': expected_new}

    after = modules(updated)
    if set(before) != set(after):
        raise ValueError('Source module inventory changed')
    if not all(before[k] == after[k] for k in before if k not in TARGET_MODULES):
        raise ValueError('Unrelated runtime source changed')
    if len(after) != len(before) or len(after) != 107:
        raise ValueError('Module count changed')
    if 'hewrs.watch-independent-style.v1_25_1' not in after['vendor/ensemble-completion.js']:
        raise ValueError('Modern classification revision not found')
    if 'revised Modern definition' not in after['src/generation-diagnostics.js']:
        raise ValueError('New no-match policy explanation missing')

    new_bytes = updated.encode('utf-8')
    new_hash = sha256(new_bytes)
    path = 'runtime/hewrs-' + new_hash[:20] + '.js'
    sri = base64.b64encode(bytes.fromhex(new_hash)).decode()
    new_tag = '<script defer src="' + path + '" integrity="sha256-' + sri + '"></script>'
    new_html = html[:tag.start()] + new_tag + html[tag.end():]
    if new_html.replace(new_tag, tag.group(0), 1) != html:
        raise ValueError('Stage 10 entrypoint changed beyond the intended runtime substitution')
    for x in [
        'hewrs-stage10-integration-panel.js',
        'feedback-candidate/reviewed/automatic-image-panel.js',
        'feedback-candidate/reviewed/image-assessment.js',
        'feedback-candidate/reviewed/rebuild-core.js'
    ]:
        if new_html.count(x) != 1:
            raise ValueError('Additional Stage 10 script missing: ' + x)

    (DIST / 'runtime').mkdir(parents=True, exist_ok=True)
    (DIST / path).write_bytes(new_bytes)
    (DIST / ENTRY.name).write_text(new_html, encoding='utf-8')
    # Local test-only preview within branch checkout, not a published entrypoint.
    (ROOT / path).write_bytes(new_bytes)
    (ROOT / 'stage11-modern-test.html').write_text(new_html, encoding='utf-8')
    manifest = {
        'schema': 'hewrs.stage11.modern-style-overlay.v1',
        'source_branch': 'feature/stage11-modern-style-policy-20261113',
        'based_on': old_path,
        'previous_runtime_sha256': old_hash,
        'replacement_runtime': path,
        'replacement_runtime_sha256': new_hash,
        'replacement_runtime_sri': 'sha256-' + sri,
        'entrypoint': ENTRY.name,
        'entrypoint_sha256': sha256(new_html.encode('utf-8')),
        'patched_modules': replacement_hashes,
        'untouched_embedded_modules': len(before) - len(TARGET_MODULES),
        'owner_feedback_preserved_exactly': True,
        'assets_and_scorer_unchanged': True,
        'published': False,
        'installation': 'Overlay exactly stage10-integration.html and the new runtime file on an existing verified HEWRS tree'
    }
    (DIST / 'MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (DIST / 'READ_FIRST.txt').write_text(
        'Stage 11 MODERN classification candidate — not published.\n'
        'Preserves 105 of 107 existing Stage 10 embedded modules exactly.\n'
        'Replaces only the style classifier and its no-match diagnostic.\n'
        'Does not change garment source data, original scoring, ownership rules,\n'
        'feedback, wear, Favorites, or existing storage namespaces.\n'
        'Apply only after numerical and browser regression results are reviewed.\n'
        'Never delete other HEWRS runtime files or clear browser storage.\n'
    )
    print(json.dumps(manifest, indent=2))

if __name__ == '__main__':
    main()
