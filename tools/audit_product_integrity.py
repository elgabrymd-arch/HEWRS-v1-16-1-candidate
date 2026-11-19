#!/usr/bin/env python3
"""Read-only checks for syntax, registered image bytes and shirt source bindings."""
import argparse
import concurrent.futures
import hashlib
import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect_asset(item):
    expected, relative = item
    path = (ROOT / relative).resolve()
    row = {'sha256': expected, 'path': relative, 'issues': []}
    if not path.is_relative_to(ROOT) or not path.is_file():
        row['issues'].append('missing_or_outside_repository')
        return row
    row['actual_sha256'] = digest(path)
    if row['actual_sha256'] != expected:
        row['issues'].append('content_hash_mismatch')
    try:
        with Image.open(path) as image:
            image.load()
            row.update({'size': list(image.size), 'mode': image.mode,
                        'alpha_bounds': list(image.getchannel('A').getbbox()) if 'A' in image.getbands() and image.getchannel('A').getbbox() else None})
    except Exception as error:
        row['issues'].append('image_decode_failed: ' + str(error))
    return row


def javascript_syntax(path):
    run = subprocess.run(['node', '--check', str(ROOT / path)], capture_output=True, text=True)
    return {'path': path, 'passed': run.returncode == 0,
            'error': run.stderr.strip() if run.returncode else None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalogue', default='evidence/five_round_20261119/CATALOGUE.json')
    parser.add_argument('--inventory', default='evidence/five_round_20261119/INVENTORY.json')
    parser.add_argument('--output', default='evidence/five_round_20261119/INTEGRITY.json')
    args = parser.parse_args()
    catalogue = json.loads((ROOT / args.catalogue).read_text())
    inventory = json.loads((ROOT / args.inventory).read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        images = list(pool.map(inspect_asset, catalogue['assetPaths'].items()))
    image_by_hash = {row['sha256']: row for row in images}
    javascript_files = [row['path'] for row in inventory['files'] if Path(row['path']).suffix in {'.js', '.mjs', '.cjs'}]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        syntax = list(pool.map(javascript_syntax, javascript_files))
    bindings = []
    shared = defaultdict(list)
    for shirt in catalogue['shirts']:
        for mode, components in shirt['manifest']['states'].items():
            for role, descriptor in components.items():
                image = image_by_hash.get(descriptor.get('sha256'))
                issues = []
                if image is None:
                    issues.append('unregistered_image_hash')
                else:
                    if descriptor.get('rect', [])[2:] != image.get('size'):
                        issues.append('image_dimensions_do_not_match_descriptor')
                    if 'alpha_bounds' in descriptor and descriptor['alpha_bounds'] != image.get('alpha_bounds'):
                        issues.append('alpha_bounds_do_not_match_registered_pixels')
                bindings.append({'id': shirt['id'], 'mode': mode, 'role': role,
                                 'sha256': descriptor.get('sha256'), 'issues': issues})
                shared[(mode, role, descriptor.get('sha256'))].append(shirt['id'])
        for group in ('thumbnails', 'nonSuitThumbnails'):
            for mode, descriptor in (shirt.get(group) or {}).items():
                issues = []
                image = inspect_asset((descriptor['sha256'], descriptor['src']))
                issues.extend(image['issues'])
                if image.get('size') != [descriptor['width'], descriptor['height']]:
                    issues.append('thumbnail_dimensions_mismatch')
                expected_key = shirt['id'] + '/' + mode
                source_key = descriptor.get('source_key', '')
                registered_reconstruction = (
                    group == 'nonSuitThumbnails'
                    and descriptor.get('source_kind') == 'registered_reconstruction_detail'
                    and shirt.get('registration') is not None
                    and re.fullmatch(re.escape(expected_key) + r'/batch[1-5]-reconstructed-shirt', source_key)
                )
                if source_key != expected_key and not registered_reconstruction:
                    issues.append('thumbnail_source_identity_mismatch')
                bindings.append({'id': shirt['id'], 'mode': mode, 'role': group,
                                 'sha256': descriptor.get('sha256'), 'issues': issues})
    failures = ([{'kind': 'asset', **row} for row in images if row['issues']]
                + [{'kind': 'binding', **row} for row in bindings if row['issues']]
                + [{'kind': 'javascript_syntax', **row} for row in syntax if not row['passed']])
    result = {'schema': 'hewrs.product-integrity-audit.v1', 'asset_count': len(images),
              'javascript_file_count': len(syntax), 'shirt_binding_count': len(bindings),
              'failure_count': len(failures), 'failures': failures,
              'assets': images, 'bindings': bindings, 'syntax': syntax,
              'shared_shirt_components': [{'mode': key[0], 'role': key[1], 'sha256': key[2], 'ids': ids}
                                          for key, ids in shared.items() if len(ids) > 1],
              'limits': ['Matching hashes and dimensions prove registered bytes, not fidelity to unavailable original garments.',
                         'Shared component hashes are recorded for provenance review; they are not automatically defects.']}
    target = ROOT / args.output
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ('asset_count', 'javascript_file_count', 'shirt_binding_count', 'failure_count')}, indent=2))
    for failure in failures:
        print(json.dumps(failure))
    return bool(failures)


if __name__ == '__main__':
    raise SystemExit(main())
