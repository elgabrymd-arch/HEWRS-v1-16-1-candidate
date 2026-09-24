#!/usr/bin/env python3
"""Bind current shirt components and report non-suit coverage, without drawing cloth.

No image output, geometry change, score change or owner-approval inference.
The two V1.13 full-shirt routes are pinned; all other IDs remain source-limited.
"""
from pathlib import Path
import argparse, hashlib, json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'))

def build(check=False):
    inputs = json.loads((ROOT / 'data/inputs.json').read_text())
    blazer = json.loads((ROOT / 'data/blazer-connection.json').read_text())
    bare = json.loads((ROOT / 'data/shirt-only.json').read_text())
    manifest = inputs['manifest']
    paths = {**inputs['assets'], **blazer['assetPaths']}
    records = {x['item_id']: x for x in inputs['sourceBindings']['items'] if x['category'] == 'shirts'}
    # Preserve the existing non-suit order; append newly described IDs, never renumber.
    ids = list(blazer['available_shirts'])
    assert ids == ['DS001', 'DS014']
    ids += [sid for sid in manifest['shirt_order'] if sid not in ids]
    image_cache = {}
    def source(desc):
        sha = desc['sha256']
        assert sha in paths and desc['rect'] == [0, 0, 996, 2748]
        if sha not in image_cache:
            path = ROOT / paths[sha]
            raw = path.read_bytes()
            assert hashlib.sha256(raw).hexdigest() == sha
            with Image.open(path) as im:
                assert im.size == (996, 2748) and im.mode == 'RGBA'
                image_cache[sha] = {'path': paths[sha], 'sha256': sha,
                                    'alpha_bounds': im.getchannel('A').getbbox()}
        return {**desc, 'runtime_path': paths[sha],
                'measured_alpha_bounds': image_cache[sha]['alpha_bounds']}

    rows, groups, by_key = {}, {}, {}
    for sid in ids:
        s = manifest['shirts'][sid]
        states = [state for state in s['available_modes'] if state != 'REFERENCE']
        components = {mode: {role: source(desc) for role, desc in parts.items()}
                      for mode, parts in s['states'].items()}
        # Only exact descriptor hashes can share an assembly group; not colour or name.
        key = canonical({'components': {mode: {role: v['sha256'] for role, v in c.items()}
                                       for mode, c in components.items()},
                         'profile': s['compositing_profile'],
                         'body_keep': s.get('body_keep_for_selectable_ties', {}).get('sha256'),
                         'states': states})
        if key not in by_key:
            gid = f"G{len(groups) + 1:03d}"
            by_key[key] = gid
            groups[gid] = {'member_ids': [], 'component_contract_sha256': hashlib.sha256(key.encode()).hexdigest(),
                           'shared_pixels_do_not_merge_physical_ids': True}
        gid = by_key[key]
        groups[gid]['member_ids'].append(sid)
        linked = sid in blazer['available_shirts']
        historical = []
        for h in records[sid]['historical_cp98_assets']:
            historical.append({**h, 'materialized_in_v113': h['sha256'] in paths,
                               'automatically_authorized_as_current_body': False})
        upper = {mode: parts['body']['measured_alpha_bounds'] for mode, parts in components.items()}
        cuff_missing = {mode: [role for role in ['left_cuff', 'right_cuff']
                              if parts[role]['measured_alpha_bounds'] is None]
                        for mode, parts in components.items()}
        missing_blazer = [] if linked else ['current_lower_torso_coverage_for_blazer_opening']
        missing_bare = [] if linked else ['current_full_length_torso', 'current_left_sleeve', 'current_right_sleeve']
        if not linked and any(cuff_missing.values()):
            missing_blazer += ['current_left_cuff', 'current_right_cuff']
            missing_bare += ['current_left_cuff', 'current_right_cuff']
        limits = {}
        for mode, missing in [('blazer', missing_blazer), ('shirt-only', missing_bare)]:
            limits[mode] = {'status': 'CONNECTED_V113_FULL_SHIRT' if linked else 'SOURCE_COMPONENTS_ONLY',
                            'visual_available': linked, 'missing_components': missing}
        rows[sid] = {'id': sid, 'history_id': f'shirt-{sid}', 'group_id': gid,
                     'garment_approval': 'PRESERVED_NOT_REOPENED',
                     'compositing_profile': s['compositing_profile'], 'states': states,
                     'components': components, 'body_keep_for_selectable_ties': s.get('body_keep_for_selectable_ties'),
                     'upper_body_alpha_bounds': upper, 'empty_cuff_components': cuff_missing,
                     'modes': limits, 'historical_full_shirt_references': historical,
                     'suit_routes': 'UNCHANGED', 'automatic_cloth_substitution': False}
        if linked:
            rows[sid]['full_states'] = bare['shirts'][sid]['layers']
    data = {'schema': 'hewrs.non-suit-source-registry.v1_14', 'canvas': [996, 2748],
            'source_input_sha256': hashlib.sha256((ROOT/'data/inputs.json').read_bytes()).hexdigest(),
            'source_boundary': 'Current Active50 components are registered. Full non-suit coverage is not inferred from garment approval, canvas size, an old source path or a matching colour.',
            'id_order': ids, 'groups': groups, 'shirts': rows,
            'counts': {'identities': len(ids), 'assembly_groups': len(groups),
                       'existing_full_shirt_ids': sum(v['modes']['blazer']['visual_available'] for v in rows.values()),
                       'source_component_only_ids': sum(not v['modes']['blazer']['visual_available'] for v in rows.values()),
                       'current_component_references': sum(len(c) for v in rows.values() for c in v['components'].values()),
                       'newly_connected_visual_ids': 0},
            'shirt_only_ranking': {'installed': False, 'score': None},
            'image_changes': 0, 'source_grouping_is_not_an_approval_queue': True}
    outputs = {'data/non-suit-sources.json': json.dumps(data, indent=2)+'\n',
               'data/non-suit-sources.js': 'globalThis.HEWRS_NON_SUIT_SOURCES='+json.dumps(data,separators=(',', ':'))+';\n'}
    for name, text in outputs.items():
        path=ROOT/name
        if check:
            assert path.read_text()==text, f'Out-of-date generated source registry: {name}'
        else:
            path.write_text(text)
    print(json.dumps(data['counts']))
    return data

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    build(parser.parse_args().check)
