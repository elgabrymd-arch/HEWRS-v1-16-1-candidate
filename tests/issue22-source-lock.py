#!/usr/bin/env python3
"""Reject altered or unregistered Issue 22 assets without changing real files."""
import copy
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import audit_continuous_source_lock as source_lock
from verify_active_delivery import describe


class Issue22AdditionScope(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.active = describe(ROOT)
        cls.allowed = source_lock.verify_issue22_sources(ROOT, cls.active)
        materials = json.loads((ROOT / 'data/issue22-materials.json').read_bytes())
        old = json.loads(source_lock.subprocess.check_output(
            ['git', 'show', source_lock.ISSUE22_INTEGRATION + ':data/issue22-materials.json'], cwd=ROOT))
        picker = json.loads((ROOT / 'data/issue22-picker-images.json').read_bytes())
        cls.materials, cls.picker = materials, picker
        cls.pre_s14_materials = json.loads(source_lock.subprocess.check_output(
            ['git', 'show', source_lock.ISSUE22_PRE_S14 + ':data/issue22-materials.json'], cwd=ROOT))
        cls.pre_s14_picker = json.loads(source_lock.subprocess.check_output(
            ['git', 'show', source_lock.ISSUE22_PRE_S14 + ':data/issue22-picker-images.json'], cwd=ROOT))
        cls.pre_s13_materials = json.loads(source_lock.subprocess.check_output(
            ['git', 'show', source_lock.ISSUE22_PRE_S13 + ':data/issue22-materials.json'], cwd=ROOT))
        cls.pre_s13_picker = json.loads(source_lock.subprocess.check_output(
            ['git', 'show', source_lock.ISSUE22_PRE_S13 + ':data/issue22-picker-images.json'], cwd=ROOT))
        s13 = next(value for value in materials['bindings'].values() if value['garment_id'] == 'S13')
        s14 = next(value for value in materials['bindings'].values() if value['garment_id'] == 'S14')
        row = next(value for value in materials['bindings'].values() if value['garment_id'] == 'S06')
        cls.targets = {
            'approved main original': row['source_url'],
            'retained integration image': old['bindings'][row['source_sha256']]['display_url'],
            'current S06 material': row['display_url'],
            'current S06 picker': picker['items']['S06']['src'],
            'retained pre-S14 material': cls.pre_s14_materials['bindings'][s14['source_sha256']]['display_url'],
            'retained pre-S14 picker': cls.pre_s14_picker['items']['S14']['src'],
            'current S14 material': s14['display_url'],
            'current S14 picker': picker['items']['S14']['src'],
            'retained pre-S13 material': cls.pre_s13_materials['bindings'][s13['source_sha256']]['display_url'],
            'retained pre-S13 picker': cls.pre_s13_picker['items']['S13']['src'],
            'current S13 material': s13['display_url'],
            'current S13 picker': picker['items']['S13']['src'],
        }
        cls.targets.update({'retained rejected S13 v1 ' + name: name
                            for name in source_lock.ISSUE22_RETAINED_S13_V1})

    def test_exact_current_and_retained_additions(self):
        # Ten data files; nine original material layers plus two each for
        # S06, S14 and S13; seven original pickers plus S06, S14 and S13;
        # exactly three immutable rejected-v1 S13 artifacts retained as evidence.
        self.assertEqual(len(self.allowed), 38)
        self.assertEqual(len(source_lock.ISSUE22_RETAINED_S13_V1), 3)
        self.assertNotIn(self.targets['approved main original'], self.allowed)
        self.assertTrue(all(self.targets[name] in self.allowed for name in self.targets
                            if name != 'approved main original'))

    def test_original_retained_and_current_pixel_corruption_is_rejected(self):
        original = source_lock.file_bytes
        for label, target in self.targets.items():
            with self.subTest(source=label):
                def corrupted(root, name):
                    raw = original(root, name)
                    return raw + b'corrupt-test' if name == target else raw
                with patch.object(source_lock, 'file_bytes', side_effect=corrupted):
                    with self.assertRaisesRegex(ValueError, 'changed'):
                        source_lock.verify_issue22_sources(ROOT, self.active)

    def test_s14_permission_cannot_replace_approved_s06_or_b06(self):
        for garment_id in ('S06', 'S13', 'B01', 'B06', 'B10'):
            with self.subTest(garment=garment_id):
                changed = copy.deepcopy(self.pre_s13_materials)
                row = next(row for row in changed['bindings'].values() if row['garment_id'] == garment_id)
                # A registered, checksum-valid historical path is still outside
                # the frozen S14-only scope at the pre-S13 checkpoint.
                row['display_url'] = row['source_url']
                row['display_sha256'] = row['source_sha256']
                with self.assertRaisesRegex(ValueError, 'non-S14 material binding'):
                    source_lock.validate_s14_material_scope(changed, self.pre_s14_materials)
                changed = copy.deepcopy(self.pre_s13_materials)
                changed['garments'][garment_id]['parameters']['texture_gain'] += .01
                with self.assertRaisesRegex(ValueError, 'non-S14 material specification'):
                    source_lock.validate_s14_material_scope(changed, self.pre_s14_materials)

    def test_s14_permission_cannot_change_source_registration_or_alpha(self):
        for field, value in [('alpha_sha256', '0' * 64), ('source_url', 'assets/unregistered.png'),
                             ('rect', [1, 0, 996, 2748]), ('garment_id', 'B06'),
                             ('new_unregistered_field', True)]:
            with self.subTest(field=field):
                changed = copy.deepcopy(self.pre_s13_materials)
                row = next(row for row in changed['bindings'].values() if row['garment_id'] == 'S14')
                row[field] = value
                with self.assertRaisesRegex(ValueError, 'native source registration or alpha'):
                    source_lock.validate_s14_material_scope(changed, self.pre_s14_materials)

    def test_every_other_picker_is_exact_and_s14_identity_stays_fixed(self):
        for garment_id in self.pre_s13_picker['items']:
            if garment_id == 'S14':
                continue
            with self.subTest(garment=garment_id):
                changed = copy.deepcopy(self.pre_s13_picker)
                changed['items'][garment_id]['src'] = self.pre_s13_picker['items']['S14']['src']
                with self.assertRaisesRegex(ValueError, 'non-S14 picker'):
                    source_lock.validate_s14_picker_scope(changed, self.pre_s14_picker)
        for field, value in [('history_id', 'suit-99'), ('width', 391),
                             ('owner_approved', True), ('issue22_revision', 'unregistered')]:
            with self.subTest(field=field):
                changed = copy.deepcopy(self.pre_s13_picker)
                changed['items']['S14'][field] = value
                with self.assertRaisesRegex(ValueError, 'picker identity or native layout'):
                    source_lock.validate_s14_picker_scope(changed, self.pre_s14_picker)

    def test_s13_permission_cannot_replace_any_other_material(self):
        for garment_id in ('S06', 'S14', 'B01', 'B06', 'B10'):
            with self.subTest(garment=garment_id):
                changed = copy.deepcopy(self.materials)
                row = next(row for row in changed['bindings'].values() if row['garment_id'] == garment_id)
                row['display_url'] = row['source_url']
                row['display_sha256'] = row['source_sha256']
                with self.assertRaisesRegex(ValueError, 'non-S13 material binding'):
                    source_lock.validate_s13_material_scope(changed, self.pre_s13_materials)
                changed = copy.deepcopy(self.materials)
                changed['garments'][garment_id]['parameters']['texture_gain'] += .01
                with self.assertRaisesRegex(ValueError, 'non-S13 material specification'):
                    source_lock.validate_s13_material_scope(changed, self.pre_s13_materials)

    def test_s13_permission_cannot_change_source_registration_or_alpha(self):
        for field, value in [('alpha_sha256', '0' * 64), ('source_url', 'assets/unregistered.png'),
                             ('rect', [1, 0, 996, 2748]), ('garment_id', 'B06'),
                             ('new_unregistered_field', True)]:
            with self.subTest(field=field):
                changed = copy.deepcopy(self.materials)
                row = next(row for row in changed['bindings'].values() if row['garment_id'] == 'S13')
                row[field] = value
                with self.assertRaisesRegex(ValueError, 'native source registration or alpha'):
                    source_lock.validate_s13_material_scope(changed, self.pre_s13_materials)

    def test_s13_permission_preserves_source_identities_colour_and_shared_revision(self):
        changed = copy.deepcopy(self.materials)
        changed['bindings']['unregistered'] = copy.deepcopy(next(iter(changed['bindings'].values())))
        with self.assertRaisesRegex(ValueError, 'material source identities'):
            source_lock.validate_s13_material_scope(changed, self.pre_s13_materials)
        changed = copy.deepcopy(self.materials)
        changed['garments']['S99'] = copy.deepcopy(changed['garments']['S13'])
        with self.assertRaisesRegex(ValueError, 'garment identities'):
            source_lock.validate_s13_material_scope(changed, self.pre_s13_materials)
        changed = copy.deepcopy(self.materials)
        changed['garments']['S13']['target_rgb'][0] += 1
        with self.assertRaisesRegex(ValueError, 'photographic colour target'):
            source_lock.validate_s13_material_scope(changed, self.pre_s13_materials)
        changed = copy.deepcopy(self.materials)
        changed['revision'] = 'unregistered-shared-revision'
        with self.assertRaisesRegex(ValueError, 'shared material revision'):
            source_lock.validate_s13_material_scope(changed, self.pre_s13_materials)

    def test_every_other_picker_is_exact_and_s13_identity_stays_fixed(self):
        for garment_id in self.picker['items']:
            if garment_id == 'S13':
                continue
            with self.subTest(garment=garment_id):
                changed = copy.deepcopy(self.picker)
                changed['items'][garment_id]['src'] = self.picker['items']['S13']['src']
                with self.assertRaisesRegex(ValueError, 'non-S13 picker'):
                    source_lock.validate_s13_picker_scope(changed, self.pre_s13_picker)
        for field, value in [('history_id', 'suit-99'), ('width', 391),
                             ('owner_approved', True), ('issue22_revision', 'unregistered')]:
            with self.subTest(field=field):
                changed = copy.deepcopy(self.picker)
                changed['items']['S13'][field] = value
                with self.assertRaisesRegex(ValueError, 'picker identity or native layout'):
                    source_lock.validate_s13_picker_scope(changed, self.pre_s13_picker)
        changed = copy.deepcopy(self.picker)
        changed['items']['S99'] = copy.deepcopy(changed['items']['S13'])
        with self.assertRaisesRegex(ValueError, 'picker identities'):
            source_lock.validate_s13_picker_scope(changed, self.pre_s13_picker)

    def test_directory_name_never_authorizes_extra_files(self):
        exact = {name: 'A' for name in self.allowed}
        changes = [('assets/issue22-materials/unregistered.png', 'A'),
                   ('ui/issue22/unregistered.png', 'A'),
                   ('data/issue22-unregistered.json', 'A'),
                   (self.targets['approved main original'], 'M')]
        for name, status in changes:
            with self.subTest(path=name):
                with self.assertRaisesRegex(ValueError, 'exact continuous allowlist'):
                    source_lock.validate_protected_changes({**exact, name: status}, exact)

    def test_retained_rejected_v1_assets_cannot_be_reactivated(self):
        for name, (expected, _) in source_lock.ISSUE22_RETAINED_S13_V1.items():
            with self.subTest(retained=name):
                materials, picker = copy.deepcopy(self.materials), copy.deepcopy(self.picker)
                if name.startswith('assets/'):
                    layer = 'jacket' if 'S13-jacket-' in name else 'trousers'
                    row = next(row for row in materials['bindings'].values()
                               if row['garment_id'] == 'S13' and row['layer'] == layer)
                    del materials['assetPaths'][row['display_sha256']]
                    row['display_url'], row['display_sha256'] = name, expected
                    materials['assetPaths'][expected] = name
                else:
                    picker['items']['S13']['src'] = name
                    picker['items']['S13']['sha256'] = expected
                with self.assertRaisesRegex(ValueError, 'cannot become active'):
                    source_lock.validate_retained_s13_v1_inactive(materials, picker)

    def test_executable_picker_installer_cannot_expand_the_exception(self):
        original = source_lock.file_bytes
        def extra_script(root, name):
            raw = original(root, name)
            return raw + b'globalThis.unregistered=true;\n' if name == 'data/issue22-picker-images.js' else raw
        with patch.object(source_lock, 'file_bytes', side_effect=extra_script):
            with self.assertRaisesRegex(ValueError, 'picker installer changed'):
                source_lock.verify_issue22_sources(ROOT, self.active)

    def test_unbound_json_cannot_change_the_shipped_manifest(self):
        original = source_lock.file_bytes
        def changed_json(root, name):
            raw = original(root, name)
            if name == 'data/issue22-materials.json':
                data = json.loads(raw)
                data['scope'].append('S01')
                return json.dumps(data).encode()
            return raw
        with patch.object(source_lock, 'file_bytes', side_effect=changed_json):
            with self.assertRaisesRegex(ValueError, 'JSON and executable data must agree'):
                source_lock.verify_issue22_sources(ROOT, self.active)


if __name__ == '__main__':
    unittest.main(verbosity=2)
