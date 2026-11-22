#!/usr/bin/env python3
"""Reject altered or unregistered Issue 22 assets without changing real files."""
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
        row = next(value for value in materials['bindings'].values() if value['garment_id'] == 'S06')
        cls.targets = {
            'approved main original': row['source_url'],
            'retained integration image': old['bindings'][row['source_sha256']]['display_url'],
            'current S06 material': row['display_url'],
            'current S06 picker': picker['items']['S06']['src'],
        }

    def test_exact_current_and_retained_additions(self):
        # Ten data files, nine retained material layers plus two current S06
        # layers, and seven retained picker images plus the current S06 image.
        self.assertEqual(len(self.allowed), 29)
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
