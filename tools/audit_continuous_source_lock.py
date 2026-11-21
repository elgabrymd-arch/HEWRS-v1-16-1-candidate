#!/usr/bin/env python3
"""Preserve original sources with exact shirt-preview and V3-preview additions."""
import argparse
import base64
import copy
import json
import re
import struct
import subprocess
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from verify_active_delivery import BASE, INPUT_SHA256, ROOT, TARGET_IDS, describe, digest, require, runtime_binding

PROTECTED = ('assets', 'assemblies', 'data', 'ui', 'ui-assets', 'STANDARD_RELEASE.json',
             'outfit-feedback.js', 'tools/build.py', 'vendor')
# This existing transport repair was already excluded by both original audits.
EXCLUDED = 'vendor/active50-renderer.js'
MAP_JSON = 'data/option-card-thumbnails.json'
MAP_JS = 'data/option-card-thumbnails.js'
DATA_ADDITIONS = {'data/continuous-shirts.json', 'data/continuous-shirts.js', 'data/continuous-shirts.schema.json'}
NEW_FIELDS = {'source_kind', 'render_state', 'garment_mode', 'source_sha256', 'source_layers',
              'render_data_sha256', 'renderer_sha256', 'garment_geometry_sha256',
              'native_rgba_sha256', 'crop_xyxy', 'omitted_layers', 'render_engine'}
V3_DATA = 'data/avatar-v3-candidate.json'
V3_MANIFEST_SHA256 = '9f0a135ab18ea14b467c44930068ff274cc70a573a83c9dac4a22b1a96b70c3e'
V3_LAYERS = {
    'avatar': ('a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d',
               '4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93'),
    'left_hand': ('8f7dcd492af271648ab6fdad83ca6cd401177aac05317d536cdb4b44149c4e34',
                  '26af452854f6f89c86617d83e9848ae71922d2ff4701877e7903f59c55ebb2b8'),
    'right_hand': ('3cd3d8ec5d3e66dcf9cd1e525e952e87a1057f968e846f453f314de65669d3d9',
                   'cfca4394b3d208184fef4f267671af834432ac2f6bd89acea83242a9e118863b'),
}


def script_json(text, name):
    pattern = r'(?:/\*[^*]*\*/\s*)?globalThis\.' + re.escape(name) + r'=(.*);\s*'
    match = re.fullmatch(pattern, text, re.S)
    require(bool(match), 'Unexpected data JavaScript wrapper: ' + name)
    return json.loads(match[1])


def validate_descriptor_changes(before, after):
    """Allow all and only the sixteen same-ID garment photograph descriptors."""
    restored = copy.deepcopy(after)
    changed = []
    for shirt in TARGET_IDS:
        require(set(before['shirts'][shirt]) == set(after['shirts'][shirt]) == {'no_tie', 'tied'}, shirt + ': collar-state identity changed')
        for mode in ('no_tie', 'tied'):
            old, new = before['shirts'][shirt][mode], after['shirts'][shirt][mode]
            require(old != new, shirt + '/' + mode + ': authorized correction is missing')
            require(set(new) == set(old) | NEW_FIELDS, shirt + '/' + mode + ': unexpected descriptor fields')
            require({key: new.get(key) for key in old if key not in ('src', 'sha256')} ==
                    {key: value for key, value in old.items() if key not in ('src', 'sha256')}, shirt + '/' + mode + ': original descriptor identity changed')
            require(new.get('source_key') == shirt + '/' + mode and (new.get('width'), new.get('height')) == (192, 224), 'Thumbnail identity or dimensions changed')
            require(new.get('source_kind') == 'continuous_garment_preview' and new.get('garment_mode') == mode and
                    new.get('render_state') == ('NO_TIE' if mode == 'no_tie' else 'T001'), shirt + '/' + mode + ': wrong continuous preview state')
            restored['shirts'][shirt][mode] = copy.deepcopy(old)
            changed.append((shirt, mode, new))
    require(restored == before, 'A non-target descriptor, roster entry, source lock, or other manifest value changed')
    return changed


def file_bytes(root, name):
    path = root / name
    require(not path.is_symlink() and path.resolve().is_relative_to(root.resolve()), 'Unsafe source path: ' + name)
    require(path.is_file(), 'Missing source: ' + name)
    return path.read_bytes()


def validate_avatar_v3_manifest(data):
    """No new asset identity, source substitution or registry edit is permitted."""
    require(data.get('schema') == 'hewrs.avatar-v3-candidate.v1' and
            data.get('stage') == 'source_candidate_only' and data.get('enabled_in_production') is False,
            'V3 additions are limited to the isolated source candidate')
    require(data.get('source_profile') == 'AVATAR_V2_MASTER' and
            data.get('variant_profile') == 'AVATAR_V3_PROPOSED' and data.get('width_height') == [996, 2748],
            'V3 source profile or native canvas changed')
    require(data.get('source_layer_hashes') == {name: hashes[0] for name, hashes in V3_LAYERS.items()},
            'V3 original layer bindings changed')
    require(set(data.get('candidate_layers', {})) == set(V3_LAYERS), 'V3 must contain exactly three named layers')
    for name, (original, candidate) in V3_LAYERS.items():
        artifact = 'avatar-v3.png' if name == 'avatar' else name + '-v3.png'
        expected = {'sha256': candidate, 'review_artifact': 'evidence/avatar_v3/' + artifact,
                    'url': 'assets/' + candidate + '.png', 'rect': [0, 0, 996, 2748],
                    'original_sha256': original}
        require(data['candidate_layers'][name] == expected, 'V3 layer descriptor changed: ' + name)


def verify_avatar_v3_sources(root, active):
    """Allow only the pinned three source additions attached to a real preview.

    Merely adding a candidate manifest never authorizes arbitrary assets or a
    change to the production avatar, original inputs, or existing registry.
    """
    if not (root / V3_DATA).exists():
        return set()
    require(active['kind'] in ('continuous', 'avatar-v3'), 'V3 preview requires the verified continuous-shirt baseline')
    integrated = active['kind'] == 'avatar-v3'
    base_runtime = active['continuous_runtime'] if integrated else active['runtime']
    base_sha256 = active['continuous_runtime_sha256'] if integrated else active['runtime_sha256']
    raw = file_bytes(root, V3_DATA)
    data = json.loads(raw)
    validate_avatar_v3_manifest(data)
    require(digest(raw) == V3_MANIFEST_SHA256, 'V3 candidate manifest is not the exact reviewed source contract')
    images = set()
    for name, (original, candidate) in V3_LAYERS.items():
        for expected in (original, candidate):
            path = 'assets/' + expected + '.png'
            image = file_bytes(root, path)
            require(digest(image) == expected and image[:8] == b'\x89PNG\r\n\x1a\n' and
                    image[12:16] == b'IHDR' and struct.unpack('>II', image[16:24]) == (996, 2748),
                    'V3 original or candidate source bytes/native dimensions changed: ' + name)
        images.add('assets/' + candidate + '.png')
    require(digest(file_bytes(root, 'data/inputs.json')) == INPUT_SHA256, 'V3 cannot remap original input registrations')
    preview = json.loads(file_bytes(root, 'AVATAR_V3_REVIEW_BUILD.json'))
    require(preview.get('schema') == 'hewrs.avatar-v3-preview.v1' and
            preview.get('preview_entrypoint') == 'avatar-v3-review.html' and
            preview.get('app_production_entrypoints_unchanged') is (not integrated) and
            preview.get('approval') == 'ISOLATED_PREVIEW_ONLY_NOT_APPROVED_FOR_MAIN',
            'V3 source exception requires its isolated preview contract')
    base_entrypoint = preview.get('base_entrypoint', 'index.html')
    require(base_entrypoint in ('index.html', 'avatar-v2-reference.html') and
            (not integrated or base_entrypoint == 'avatar-v2-reference.html'),
            'V3 preview uses an unexpected baseline entrypoint')
    require(preview.get('base_runtime') == base_runtime and preview.get('base_runtime_sha256') == base_sha256 and
            preview.get('base_index_sha256') == digest(file_bytes(root, base_entrypoint)),
            'V3 preview is not bound to the verified production baseline')
    require(preview.get('layer_hashes') == {name: hashes[1] for name, hashes in V3_LAYERS.items()} and
            preview.get('new_avatar_sha256') == V3_LAYERS['avatar'][1] and
            preview.get('v2_avatar_sha256') == V3_LAYERS['avatar'][0] and
            preview.get('pose_source_sha256') == digest(file_bytes(root, 'src/avatar-v3-pose.js')),
            'V3 preview layer or pose source bindings changed')
    runtime, expected = preview.get('runtime', ''), preview.get('runtime_sha256', '')
    require(re.fullmatch(r'[a-f0-9]{64}', expected) is not None and
            runtime == 'runtime/avatar-v3-candidate-' + expected[:20] + '.js',
            'V3 preview runtime must be content-addressed')
    require(digest(file_bytes(root, runtime)) == expected, 'V3 preview runtime bytes changed')
    if integrated:
        require(runtime == active['runtime'] and expected == active['runtime_sha256'],
                'Integrated V3 runtime differs from the verified candidate')
    file_bytes(root, preview['preview_entrypoint'])
    binding = runtime_binding(root, preview['preview_entrypoint'])
    source = urlsplit(binding['src'])
    require(not source.scheme and not source.netloc and not source.fragment and source.path == runtime and
            parse_qs(source.query).get('v') == [expected[:16]] and
            binding.get('integrity') == 'sha256-' + base64.b64encode(bytes.fromhex(expected)).decode(),
            'V3 preview is missing its exact runtime, cache pin or SRI binding')
    return {V3_DATA, *images}


def validate_protected_changes(differences, allowed):
    require(differences == allowed, 'Protected changes differ from the exact continuous allowlist: ' + json.dumps({
        'unexpected_or_wrong_status': {name: value for name, value in differences.items() if allowed.get(name) != value},
        'missing': sorted(set(allowed) - set(differences))}))


def geometry_hashes(root):
    # Match the generator's JSON.stringify numbers and property order exactly.
    code = """const fs=require('node:fs'),c=require('node:crypto');const d=JSON.parse(fs.readFileSync('data/continuous-shirts.json','utf8'));const out={};for(const id of d.ids)for(const [mode,g]of Object.entries(d.shirts[id].modes))out[id+'/'+mode]=c.createHash('sha256').update(JSON.stringify(g)).digest('hex');process.stdout.write(JSON.stringify(out));"""
    return json.loads(subprocess.check_output(['node', '-e', code], cwd=root))


def garment_sources(garment):
    sources = {}

    def walk(value):
        if isinstance(value, dict):
            if 'sha256' in value and 'rect' in value:
                sources[value['sha256']] = value
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(garment)
    return sources


def same_source_layers(actual, expected):
    # This is a deduplicated provenance inventory, not compositing order.
    # The JS generator uses localeCompare; normalize both sides so '_'/'-'
    # collation cannot change whether the same exact source bindings pass.
    return sorted(actual, key=lambda row: row['path']) == sorted(expected, key=lambda row: row['path'])


def verify_new_sources(root, changes):
    data_raw = file_bytes(root, 'data/continuous-shirts.json')
    data = json.loads(data_raw)
    require(script_json(file_bytes(root, 'data/continuous-shirts.js').decode(), 'HEWRS_CONTINUOUS_SHIRTS') == data, 'Continuous data JSON/JavaScript differ')
    require(data.get('ids') == list(TARGET_IDS) and sorted(data.get('shirts', {})) == list(TARGET_IDS), 'Unauthorized continuous shirt identity')
    require(data.get('source_input_sha256') == INPUT_SHA256 and data.get('canvas') == [996, 2748], 'Continuous input/native canvas changed')
    assets = {}
    for expected, name in data['assetPaths'].items():
        require(re.fullmatch(r'[a-f0-9]{64}', expected) and name.startswith('provenance/continuous-shirt-sources/') and '..' not in Path(name).parts, 'Unauthorized continuous image path')
        raw = file_bytes(root, name)
        require(digest(raw) == expected, 'Continuous photograph hash mismatch: ' + name)
        assets[expected] = {'path': name, 'sha256': expected, 'size_bytes': len(raw)}
    geometry = geometry_hashes(root)
    renderer_sha = digest(file_bytes(root, 'src/continuous-shirts.js'))
    images = set()
    for shirt, mode, descriptor in changes:
        row = data['shirts'][shirt]
        require(row['id'] == shirt and row['history_id'] == 'shirt-' + shirt and set(row['modes']) == {'no_tie', 'tied'}, 'Continuous identity/history changed: ' + shirt)
        garment = row['modes'][mode]
        primary = garment['body'].get('source', garment['body'].get('layer'))
        expected_sources = [assets[value] for value in garment_sources(garment)]
        expected_sources.sort(key=lambda value: value['path'])
        require(descriptor['source_sha256'] == primary['sha256'] and same_source_layers(descriptor['source_layers'], expected_sources), shirt + '/' + mode + ': thumbnail uses wrong source photographs')
        require(descriptor['render_data_sha256'] == digest(data_raw) and descriptor['renderer_sha256'] == renderer_sha and descriptor['garment_geometry_sha256'] == geometry[shirt + '/' + mode], shirt + '/' + mode + ': thumbnail render provenance is stale')
        require(re.fullmatch(r'[a-f0-9]{64}', descriptor['native_rgba_sha256']) is not None, 'Invalid native thumbnail pixel hash')
        require(descriptor['omitted_layers'] == ['avatar', 'tie', 'pants', 'shoes', 'hands'] and descriptor['render_engine'] == '@napi-rs/canvas@0.1.100', 'Thumbnail renderer/garment-only contract changed')
        bounds = descriptor['crop_xyxy']
        require(isinstance(bounds, list) and len(bounds) == 4 and all(type(v) is int for v in bounds) and 0 <= bounds[0] < bounds[2] <= 996 and 350 <= bounds[1] < bounds[3] < 1500, 'Thumbnail crop escapes garment bounds')
        expected = descriptor['sha256']
        require(re.fullmatch(r'[a-f0-9]{64}', expected) is not None and descriptor['src'] == 'ui/option-cards/' + expected + '.png', 'Thumbnail is not content-addressed')
        raw = file_bytes(root, descriptor['src'])
        require(digest(raw) == expected and raw[:8] == b'\x89PNG\r\n\x1a\n' and raw[12:16] == b'IHDR' and struct.unpack('>II', raw[16:24]) == (192, 224), 'Thumbnail bytes/dimensions differ: ' + descriptor['src'])
        images.add(descriptor['src'])
    return images, len(assets)


def git_changes(root, base):
    paths = [*PROTECTED, ':(exclude)' + EXCLUDED]
    raw = subprocess.check_output(['git', 'diff', '--name-status', '-z', '--no-renames', base, '--', *paths], cwd=root).split(b'\0')
    changes = {}
    for offset in range(0, len(raw) - 1, 2):
        changes[raw[offset + 1].decode()] = raw[offset].decode()
    untracked = subprocess.check_output(['git', 'ls-files', '--others', '-z', '--', *paths], cwd=root).split(b'\0')
    changes.update({name.decode(): 'A' for name in untracked if name})
    return changes


def audit(base, root=ROOT):
    root = Path(root)
    require(re.fullmatch(r'[a-f0-9]{40}', base) is not None, 'Use an exact immutable baseline commit')
    active = describe(root)
    differences = git_changes(root, base)
    report = {'schema': 'hewrs.continuous-source-lock-audit.v1', 'base_commit': base,
              'active_delivery': active['kind'], 'runtime': active['runtime'],
              'protected_roots': list(PROTECTED), 'existing_exclusion': EXCLUDED,
              'changes': differences}
    if active['kind'] not in ('continuous', 'avatar-v3'):
        require(not differences, 'Original source protection failed: ' + ', '.join(differences))
        report.update(authorized_thumbnail_descriptors=0, added_thumbnail_images=[])
        return report
    before = json.loads(subprocess.check_output(['git', 'show', base + ':' + MAP_JSON], cwd=root))
    original_js = subprocess.check_output(['git', 'show', base + ':' + MAP_JS], cwd=root).decode()
    require(script_json(original_js, 'HEWRS_OPTION_CARD_THUMBNAILS') == before, 'Baseline thumbnail JSON/JavaScript differ')
    after = json.loads(file_bytes(root, MAP_JSON))
    require(script_json(file_bytes(root, MAP_JS).decode(), 'HEWRS_OPTION_CARD_THUMBNAILS') == after, 'Thumbnail JSON/JavaScript differ')
    changes = validate_descriptor_changes(before, after)
    images, source_count = verify_new_sources(root, changes)
    avatar_additions = verify_avatar_v3_sources(root, active)
    allowed = {MAP_JSON: 'M', MAP_JS: 'M', **{name: 'A' for name in DATA_ADDITIONS | images | avatar_additions}}
    validate_protected_changes(differences, allowed)
    for name in allowed:
        file_bytes(root, name)
        require(not (root / name).stat().st_mode & 0o111, 'Unexpected executable protected data: ' + name)
    report.update(authorized_thumbnail_descriptors=len(changes), added_thumbnail_images=sorted(images),
                  isolated_avatar_v3_additions=sorted(avatar_additions),
                  continuous_photographs_verified=source_count,
                  original_assets_and_other_data='unchanged against exact baseline',
                  original_scoring_and_identity_rows='byte-identical',
                  non_target_thumbnail_descriptors='unchanged')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default=BASE)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = audit(args.base)
    text = json.dumps(report, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text)
    print(text, end='')


if __name__ == '__main__':
    main()
