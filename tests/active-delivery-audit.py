#!/usr/bin/env python3
"""Regression checks for the narrowly scoped continuous-delivery audit waiver."""
import base64
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import verify_active_delivery as delivery
import audit_continuous_source_lock as source_lock


class DescriptorScope(unittest.TestCase):
    def setUp(self):
        self.before = {'source_lock': delivery.INPUT_SHA256, 'shirts': {}, 'ties': {'T001': {'src': 'unchanged.png'}}}
        for shirt in (*delivery.TARGET_IDS, 'DS029'):
            self.before['shirts'][shirt] = {mode: {'src': 'old.png', 'sha256': 'old', 'width': 192,
                'height': 224, 'source_key': shirt + '/' + mode} for mode in ('no_tie', 'tied')}
        self.after = copy.deepcopy(self.before)
        for shirt in delivery.TARGET_IDS:
            for mode, state in [('no_tie', 'NO_TIE'), ('tied', 'T001')]:
                new = self.after['shirts'][shirt][mode]
                new.update({key: None for key in source_lock.NEW_FIELDS})
                new.update(src='new.png', sha256='new', source_kind='continuous_garment_preview',
                           garment_mode=mode, render_state=state)

    def test_exact_sixteen_descriptors(self):
        self.assertEqual(len(source_lock.validate_descriptor_changes(self.before, self.after)), 16)

    def test_non_target_pixel_change_is_rejected(self):
        self.after['shirts']['DS029']['tied']['sha256'] = 'changed'
        with self.assertRaisesRegex(ValueError, 'non-target descriptor'):
            source_lock.validate_descriptor_changes(self.before, self.after)

    def test_other_category_change_is_rejected(self):
        self.after['ties']['T001']['src'] = 'changed.png'
        with self.assertRaisesRegex(ValueError, 'non-target descriptor'):
            source_lock.validate_descriptor_changes(self.before, self.after)

    def test_identity_and_source_lock_cannot_be_waived(self):
        self.after['shirts']['DS001']['tied']['source_key'] = 'DS014/tied'
        with self.assertRaisesRegex(ValueError, 'identity changed'):
            source_lock.validate_descriptor_changes(self.before, self.after)
        self.setUp()
        self.after['source_lock'] = 'different'
        with self.assertRaisesRegex(ValueError, 'non-target descriptor'):
            source_lock.validate_descriptor_changes(self.before, self.after)

    def test_missing_state_or_new_metadata_is_rejected(self):
        del self.after['shirts']['DS035']['tied']
        with self.assertRaisesRegex(ValueError, 'state identity changed'):
            source_lock.validate_descriptor_changes(self.before, self.after)
        self.setUp()
        self.after['shirts']['DS035']['tied']['unapproved'] = True
        with self.assertRaisesRegex(ValueError, 'unexpected descriptor fields'):
            source_lock.validate_descriptor_changes(self.before, self.after)

    def test_script_wrapper_cannot_execute_extra_code(self):
        valid = 'globalThis.HEWRS_OPTION_CARD_THUMBNAILS=' + json.dumps(self.before) + ';\n'
        self.assertEqual(source_lock.script_json(valid, 'HEWRS_OPTION_CARD_THUMBNAILS'), self.before)
        with self.assertRaises((ValueError, json.JSONDecodeError)):
            source_lock.script_json(valid + 'globalThis.extra=true;\n', 'HEWRS_OPTION_CARD_THUMBNAILS')

    def test_source_inventory_collation_preserves_exact_bindings(self):
        expected = [{'path': 'DS034-photo.png', 'sha256': 'photo', 'size_bytes': 12},
                    {'path': 'DS034_closed.png', 'sha256': 'closed', 'size_bytes': 16}]
        actual = copy.deepcopy(list(reversed(expected)))
        self.assertTrue(source_lock.same_source_layers(actual, expected))
        actual[0]['sha256'] = 'wrong source'
        self.assertFalse(source_lock.same_source_layers(actual, expected))
        self.assertFalse(source_lock.same_source_layers(expected + [expected[0]], expected))


class ActiveRuntime(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.pins = {'INPUT_SHA256': delivery.digest(b'input'), 'AVATAR_SHA256': delivery.digest(b'avatar'),
                     'ORIGINAL_RUNTIME_SHA256': delivery.digest(b'original')}
        self.patch = patch.multiple(delivery, **self.pins)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.write('data/inputs.json', b'input')
        self.write('assets/' + delivery.AVATAR_SHA256 + '.png', b'avatar')
        self.write(delivery.ORIGINAL_RUNTIME, b'original')
        self.write('runtime/frozen.js', b'frozen')
        self.write('frozen-integration.js', b'integration')
        self.write('STANDARD_RELEASE.json', json.dumps({'runtime': 'runtime/frozen.js',
            'runtime_sha256': delivery.digest(b'frozen'), 'integration_resources': {
                'frozen-integration.js': delivery.digest(b'integration')}}))
        self.data = {'schema': 'hewrs.continuous-shirts.v1', 'source_input_sha256': delivery.INPUT_SHA256,
                     'ids': list(delivery.TARGET_IDS), 'shirts': {key: {} for key in delivery.TARGET_IDS}}
        self.write('data/continuous-shirts.json', json.dumps(self.data))
        for name in delivery.MODULES:
            self.write(name, 'fixture source ' + name)
        self.runtime_sha = delivery.digest(b'continuous')
        self.runtime = 'runtime/continuous-shirts-' + self.runtime_sha[:20] + '.js'
        self.write(self.runtime, b'continuous')
        self.pages(self.runtime, self.runtime_sha)
        self.manifest = {'schema': 'hewrs.continuous-shirt-candidate.v1', 'base_commit': delivery.BASE,
            'runtime': self.runtime, 'runtime_sha256': self.runtime_sha,
            'source_input_sha256': delivery.INPUT_SHA256, 'avatar_sha256': delivery.AVATAR_SHA256,
            'original_runtime_sha256': delivery.ORIGINAL_RUNTIME_SHA256,
            'garment_data_sha256': delivery.digest((self.root / 'data/continuous-shirts.json').read_bytes()),
            'modules': {name: delivery.digest((self.root / name).read_bytes()) for name in delivery.MODULES},
            'entrypoints': {name: delivery.digest((self.root / name).read_bytes()) for name in ('index.html', 'app.html')},
            'approval': 'CANDIDATE_ONLY_OWNER_APPROVAL_NOT_GRANTED'}
        self.write(delivery.MANIFEST, json.dumps(self.manifest))

    def write(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value.encode() if isinstance(value, str) else value)

    def pages(self, runtime, sha):
        sri = base64.b64encode(bytes.fromhex(sha)).decode()
        text = '<script defer src="' + runtime + '?v=' + sha[:16] + '" integrity="sha256-' + sri + '"></script>'
        for name in ('index.html', 'app.html'):
            self.write(name, text)

    def test_exact_bound_candidate_activates_exception(self):
        active = delivery.describe(self.root)
        self.assertEqual(active['kind'], 'continuous')
        self.assertEqual(active['target_ids'], list(delivery.TARGET_IDS))

    def test_manifest_alone_never_activates_exception(self):
        self.pages(delivery.ORIGINAL_RUNTIME, delivery.ORIGINAL_RUNTIME_SHA256)
        self.assertEqual(delivery.describe(self.root)['kind'], 'legacy')

    def test_modified_source_and_original_runtime_are_rejected(self):
        self.write('src/continuous-shirts.js', 'changed source')
        with self.assertRaisesRegex(ValueError, 'source module pins are stale'):
            delivery.describe(self.root)
        self.write('src/continuous-shirts.js', 'fixture source src/continuous-shirts.js')
        self.write(delivery.ORIGINAL_RUNTIME, b'changed original')
        with self.assertRaisesRegex(ValueError, 'Original complete-app runtime changed'):
            delivery.describe(self.root)

    def test_extra_runtime_and_missing_manifest_are_rejected(self):
        self.write('app.html', (self.root / 'app.html').read_text() + '<script src="runtime/extra.js"></script>')
        with self.assertRaisesRegex(ValueError, 'exactly one application runtime'):
            delivery.describe(self.root)
        self.pages(self.runtime, self.runtime_sha)
        (self.root / delivery.MANIFEST).unlink()
        with self.assertRaises(FileNotFoundError):
            delivery.describe(self.root)

    def test_unapproved_id_cannot_expand_exception(self):
        self.data['ids'].append('DS029')
        self.data['shirts']['DS029'] = {}
        self.write('data/continuous-shirts.json', json.dumps(self.data))
        self.manifest['garment_data_sha256'] = delivery.digest((self.root / 'data/continuous-shirts.json').read_bytes())
        self.write(delivery.MANIFEST, json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, 'unauthorized shirt'):
            delivery.describe(self.root)

    def test_bad_cache_pin_and_sri_are_rejected(self):
        for name in ('index.html', 'app.html'):
            self.write(name, (self.root / name).read_text().replace('?v=' + self.runtime_sha[:16], '?v=stale'))
        with self.assertRaisesRegex(ValueError, 'cache pin mismatch'):
            delivery.describe(self.root)
        self.pages(self.runtime, self.runtime_sha)
        for name in ('index.html', 'app.html'):
            self.write(name, (self.root / name).read_text().replace('integrity="sha256-', 'integrity="wrong-'))
        with self.assertRaisesRegex(ValueError, 'SRI mismatch'):
            delivery.describe(self.root)


if __name__ == '__main__':
    unittest.main(verbosity=2)
