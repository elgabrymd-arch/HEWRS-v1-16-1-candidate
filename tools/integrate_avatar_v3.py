#!/usr/bin/env python3
"""Reproduce the primary V3 app while retaining a complete V2 comparison page.

The original source specification and its V2 layers stay immutable. This release
record binds the promoted source profile, exact runtime, and both app pages.
No browser records or garment/scoring sources are changed by this builder.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / 'AVATAR_V3_RELEASE.json'
REFERENCE = ROOT / 'avatar-v2-reference.html'
BASE_COMMIT = '1d5529c4a1a2f87b1212ac68392af1b4dc87d7bb'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def promoted_html():
    html = (ROOT / 'avatar-v3-review.html').read_text()
    html, count = re.subn(r'<html\b(?![^>]*\bdata-avatar-profile=)([^>]*)>',
                         r'<html\1 data-avatar-profile="AVATAR_V3">', html, count=1)
    if count != 1:
        raise ValueError('Expected one unpromoted review document')
    html = re.sub(r'<title>[^<]*</title>', '<title>HEWRS</title>', html, count=1)
    html = html.replace('Loading AVATAR_V3 isolated preview source layers…', 'Loading outfit…')
    return html


def record(html):
    preview = json.loads((ROOT / 'AVATAR_V3_REVIEW_BUILD.json').read_text())
    spec = json.loads((ROOT / 'data/avatar-v3-candidate.json').read_text())
    return {
        'schema': 'hewrs.avatar-v3-release.v1',
        'profile': 'AVATAR_V3',
        'baseline_commit': BASE_COMMIT,
        'baseline_entrypoint': 'avatar-v2-reference.html',
        'baseline_entrypoint_sha256': digest(REFERENCE),
        'baseline_manifest_sha256': digest(ROOT / 'CONTINUOUS_CANDIDATE.json'),
        'continuous_runtime': preview['base_runtime'],
        'continuous_runtime_sha256': preview['base_runtime_sha256'],
        'runtime': preview['runtime'],
        'runtime_sha256': preview['runtime_sha256'],
        'source_specification': 'data/avatar-v3-candidate.json',
        'source_specification_sha256': digest(ROOT / 'data/avatar-v3-candidate.json'),
        'source_modules': {p: digest(ROOT / p) for p in ('src/avatar-v3.js', 'src/avatar-v3-collar-fit.js', 'src/avatar-v3-tie-fit.js', 'src/avatar-v3-shirt-collar-fit.js', 'src/avatar-v3-cuff-fit.js', 'src/avatar-v3-pose.js')},
        'collar_fit_revision': preview['collar_fit_revision'],
        'issue19_fit_modules': preview['issue19_fit_modules'],
        'issue19_runtime_compatibility': preview['issue19_runtime_compatibility'],
        'issue19_baseline': {'commit':'ee6bdb7c0986597e569056499ff9eedca1ec3c98',
                             'entrypoint':'avatar-v3-issue19-baseline.html',
                             'entrypoint_sha256':digest(ROOT / 'avatar-v3-issue19-baseline.html')},
        'layer_hashes': {name: row['sha256'] for name, row in spec['candidate_layers'].items()},
        'immutable_v2_hashes': spec['source_layer_hashes'],
        'entrypoints': {p: hashlib.sha256(html.encode()).hexdigest() for p in ('index.html', 'app.html')},
        'rollback_entrypoint': 'avatar-v2-reference.html',
        'garments_and_scoring': 'original_sources_preserved_v3_all_shirt_collar_cuff_and_tie_display_registration',
        'browser_storage_migration': 'none',
        'authority': 'owner_requested_source_avatar_update_and_continuation_through_integration',
        'visual_acceptance': 'not_inferred_from_automated_tests',
    }


def main(write=False):
    if write and not REFERENCE.exists():
        old = (ROOT / 'index.html').read_bytes()
        if b'runtime/continuous-shirts-' not in old or b'data-avatar-profile=' in old:
            raise ValueError('Missing original V2 comparison entrypoint')
        REFERENCE.write_bytes(old)
    if not REFERENCE.is_file():
        raise ValueError('V2 comparison entrypoint missing')
    if write and not RELEASE.exists():
        # Builders select their destination from release presence. The final
        # fully bound record is written only after both reproducible builds.
        RELEASE.write_text('{}\n')
    command = [sys.executable, str(ROOT / 'tools/build_continuous_candidate.py')]
    if write:
        command.append('--write')
    subprocess.run(command, check=True, cwd=ROOT, stdout=subprocess.DEVNULL)
    import build_avatar_v3_candidate
    build_avatar_v3_candidate.main(write=write)
    html = promoted_html()
    encoded = json.dumps(record(html), indent=2) + '\n'
    if write:
        for name in ('index.html', 'app.html'):
            (ROOT / name).write_text(html)
        RELEASE.write_text(encoded)
    else:
        for name in ('index.html', 'app.html'):
            if (ROOT / name).read_text() != html:
                raise ValueError(name + ': promoted V3 delivery differs')
        if RELEASE.read_text() != encoded:
            raise ValueError('V3 release manifest differs')
    print('AVATAR_V3_PRIMARY_APP=' + json.dumps(record(html)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.write and args.check:
        parser.error('Choose --write or --check')
    main(write=args.write)
