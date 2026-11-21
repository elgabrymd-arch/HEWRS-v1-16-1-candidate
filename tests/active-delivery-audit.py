#!/usr/bin/env python3
"""Regression checks for the narrowly scoped continuous-delivery audit waiver."""
import base64
import copy
import json
import struct
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

    def test_promoted_v3_requires_local_unfragmented_runtime_url(self):
        reference = (self.root / 'index.html').read_bytes()
        self.write('avatar-v2-reference.html', reference)
        candidates = {name: delivery.digest(('candidate ' + name).encode()) for name in ('avatar', 'left_hand', 'right_hand')}
        originals = {'avatar': delivery.AVATAR_SHA256,
                     **{name: delivery.digest(('original ' + name).encode()) for name in ('left_hand', 'right_hand')}}
        for name in candidates:
            self.write('assets/' + candidates[name] + '.png', ('candidate ' + name).encode())
            if name != 'avatar':
                self.write('assets/' + originals[name] + '.png', ('original ' + name).encode())
        spec = {'width_height': [996, 2748], 'source_profile': 'AVATAR_V2_MASTER', 'source_layer_hashes': originals,
                'candidate_layers': {name: {'sha256': sha, 'url': 'assets/' + sha + '.png', 'rect': [0, 0, 996, 2748]}
                                     for name, sha in candidates.items()}}
        self.write('data/avatar-v3-candidate.json', json.dumps(spec))
        modules = ('src/avatar-v3.js', 'src/avatar-v3-collar-fit.js', 'src/avatar-v3-pose.js')
        for name in modules:
            self.write(name, name)
        runtime_sha = delivery.digest(b'promoted runtime')
        runtime = 'runtime/avatar-v3-candidate-' + runtime_sha[:20] + '.js'
        self.write(runtime, b'promoted runtime')
        sri = base64.b64encode(bytes.fromhex(runtime_sha)).decode()
        html = '<html data-avatar-profile="AVATAR_V3"><script src="' + runtime + '?v=' + runtime_sha[:16] + '" integrity="sha256-' + sri + '"></script></html>'
        preview = {'runtime': runtime, 'runtime_sha256': runtime_sha, 'base_entrypoint': 'avatar-v2-reference.html',
                   'base_index_sha256': delivery.digest(reference), 'base_runtime': self.runtime,
                   'base_runtime_sha256': self.runtime_sha, 'layer_hashes': candidates,
                   'collar_fit_source_sha256': delivery.digest((self.root / 'src/avatar-v3-collar-fit.js').read_bytes()),
                   'collar_fit_revision': 'AVATAR_V3_B15_COLLAR_FIT_1'}
        self.write('AVATAR_V3_REVIEW_BUILD.json', json.dumps(preview))
        self.write('avatar-v3-review.html', html)
        release = {'schema': 'hewrs.avatar-v3-release.v1', 'profile': 'AVATAR_V3',
            'baseline_entrypoint': 'avatar-v2-reference.html', 'baseline_entrypoint_sha256': delivery.digest(reference),
            'runtime': runtime, 'runtime_sha256': runtime_sha, 'continuous_runtime': self.runtime,
            'continuous_runtime_sha256': self.runtime_sha,
            'baseline_manifest_sha256': delivery.digest((self.root / delivery.MANIFEST).read_bytes()),
            'source_specification': 'data/avatar-v3-candidate.json',
            'source_specification_sha256': delivery.digest((self.root / 'data/avatar-v3-candidate.json').read_bytes()),
            'layer_hashes': candidates, 'immutable_v2_hashes': originals,
            'collar_fit_revision': 'AVATAR_V3_B15_COLLAR_FIT_1',
            'source_modules': {name: delivery.digest((self.root / name).read_bytes()) for name in modules}}

        def primary(text):
            for name in ('index.html', 'app.html'):
                self.write(name, text)
            release['entrypoints'] = {name: delivery.digest(text.encode()) for name in ('index.html', 'app.html')}
            self.write('AVATAR_V3_RELEASE.json', json.dumps(release))

        with patch.object(delivery, 'V3_LAYERS', candidates):
            primary(html)
            self.assertEqual(delivery.describe(self.root)['kind'], 'avatar-v3')
            for changed in (html.replace('src="runtime/', 'src="https:runtime/'),
                            html.replace('?v=' + runtime_sha[:16], '?v=' + runtime_sha[:16] + '#unexpected')):
                with self.subTest(url=changed):
                    primary(changed)
                    with self.assertRaisesRegex(ValueError, 'runtime must be local'):
                        delivery.describe(self.root)


class AvatarV3SourceScope(unittest.TestCase):
    """Synthetic byte pins exercise the gate without editing real source assets."""
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.layers = {}
        header = b'\x89PNG\r\n\x1a\n\0\0\0\rIHDR' + struct.pack('>II', 996, 2748)
        for name in ('avatar', 'left_hand', 'right_hand'):
            values = []
            for version in ('original', 'candidate'):
                raw = header + (name + version).encode()
                sha = delivery.digest(raw)
                self.write('assets/' + sha + '.png', raw)
                values.append(sha)
            self.layers[name] = tuple(values)
        self.data = {'schema': 'hewrs.avatar-v3-candidate.v1', 'stage': 'source_candidate_only',
            'enabled_in_production': False, 'source_profile': 'AVATAR_V2_MASTER',
            'variant_profile': 'AVATAR_V3_PROPOSED', 'width_height': [996, 2748],
            'source_layer_hashes': {name: hashes[0] for name, hashes in self.layers.items()},
            'candidate_layers': {name: {'sha256': hashes[1], 'original_sha256': hashes[0],
                'url': 'assets/' + hashes[1] + '.png', 'rect': [0, 0, 996, 2748],
                'review_artifact': 'evidence/avatar_v3/' + ('avatar-v3.png' if name == 'avatar' else name + '-v3.png')}
                for name, hashes in self.layers.items()}}
        raw_data = json.dumps(self.data).encode()
        self.write(source_lock.V3_DATA, raw_data)
        pins = patch.multiple(source_lock, V3_LAYERS=self.layers, V3_MANIFEST_SHA256=delivery.digest(raw_data),
                              INPUT_SHA256=delivery.digest(b'input'))
        pins.start()
        self.addCleanup(pins.stop)
        self.write('data/inputs.json', b'input')
        self.write('src/avatar-v3-pose.js', b'pose')
        self.write('src/avatar-v3-collar-fit.js', b'collar')
        self.write('index.html', b'production baseline')
        runtime_sha = delivery.digest(b'preview runtime')
        self.runtime = 'runtime/avatar-v3-candidate-' + runtime_sha[:20] + '.js'
        self.write(self.runtime, b'preview runtime')
        self.preview = {'schema': 'hewrs.avatar-v3-preview.v1', 'preview_entrypoint': 'avatar-v3-review.html',
            'app_production_entrypoints_unchanged': True, 'approval': 'ISOLATED_PREVIEW_ONLY_NOT_APPROVED_FOR_MAIN',
            'base_runtime': 'runtime/continuous-shirts-base.js', 'base_runtime_sha256': delivery.digest(b'base runtime'),
            'base_index_sha256': delivery.digest(b'production baseline'),
            'layer_hashes': {name: hashes[1] for name, hashes in self.layers.items()},
            'new_avatar_sha256': self.layers['avatar'][1], 'v2_avatar_sha256': self.layers['avatar'][0],
            'pose_source_sha256': delivery.digest(b'pose'),
            'collar_fit_source_sha256': delivery.digest(b'collar'),
            'collar_fit_revision': 'AVATAR_V3_B15_COLLAR_FIT_1',
            'runtime': self.runtime, 'runtime_sha256': runtime_sha}
        self.write('AVATAR_V3_REVIEW_BUILD.json', json.dumps(self.preview))
        self.write('avatar-v3-review.html', '<script src="' + self.runtime + '?v=' + runtime_sha[:16] +
                   '" integrity="sha256-' + base64.b64encode(bytes.fromhex(runtime_sha)).decode() + '"></script>')
        self.active = {'kind': 'continuous', 'runtime': self.preview['base_runtime'],
                       'runtime_sha256': self.preview['base_runtime_sha256']}

    def write(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value.encode() if isinstance(value, str) else value)

    def verify(self):
        return source_lock.verify_avatar_v3_sources(self.root, self.active)

    def test_only_three_pinned_assets_and_one_manifest_are_allowed(self):
        expected = {source_lock.V3_DATA} | {'assets/' + hashes[1] + '.png' for hashes in self.layers.values()}
        self.assertEqual(self.verify(), expected)

    def test_integrated_v3_retains_exact_continuous_reference(self):
        self.write('avatar-v2-reference.html', b'production baseline')
        self.preview.update(base_entrypoint='avatar-v2-reference.html', app_production_entrypoints_unchanged=False)
        self.write('AVATAR_V3_REVIEW_BUILD.json', json.dumps(self.preview))
        self.active = {'kind': 'avatar-v3', 'runtime': self.runtime, 'runtime_sha256': self.preview['runtime_sha256'],
                       'continuous_runtime': self.preview['base_runtime'],
                       'continuous_runtime_sha256': self.preview['base_runtime_sha256']}
        self.assertEqual(len(self.verify()), 4)
        self.active['runtime_sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'Integrated V3 runtime differs'):
            self.verify()

    def test_original_or_new_source_pixel_changes_are_rejected(self):
        for kind in (0, 1):
            with self.subTest(kind=kind):
                path = self.root / ('assets/' + self.layers['left_hand'][kind] + '.png')
                before = path.read_bytes()
                path.write_bytes(before + b'changed')
                with self.assertRaisesRegex(ValueError, 'source bytes/native dimensions changed'):
                    self.verify()
                path.write_bytes(before)

    def test_layer_swaps_or_new_asset_identity_are_rejected(self):
        for mutation in ('swap', 'replace', 'extra'):
            with self.subTest(mutation=mutation):
                data = copy.deepcopy(self.data)
                if mutation == 'swap':
                    data['candidate_layers']['left_hand'], data['candidate_layers']['right_hand'] = data['candidate_layers']['right_hand'], data['candidate_layers']['left_hand']
                elif mutation == 'replace':
                    data['candidate_layers']['avatar'].update(sha256='0' * 64, url='assets/' + '0' * 64 + '.png')
                else:
                    data['candidate_layers']['shirt'] = copy.deepcopy(data['candidate_layers']['avatar'])
                self.write(source_lock.V3_DATA, json.dumps(data))
                with self.assertRaisesRegex(ValueError, 'layer descriptor changed|exactly three named layers'):
                    self.verify()

    def test_canvas_original_hash_and_rect_are_not_relaxed(self):
        for mutation in ('canvas', 'original', 'rect'):
            with self.subTest(mutation=mutation):
                data = copy.deepcopy(self.data)
                if mutation == 'canvas':
                    data['width_height'] = [995, 2748]
                elif mutation == 'original':
                    data['source_layer_hashes']['avatar'] = '0' * 64
                else:
                    data['candidate_layers']['avatar']['rect'] = [0, 0, 995, 2748]
                self.write(source_lock.V3_DATA, json.dumps(data))
                with self.assertRaisesRegex(ValueError, 'native canvas|original layer bindings|layer descriptor'):
                    self.verify()

    def test_manifest_alone_does_not_activate_asset_exception(self):
        (self.root / 'avatar-v3-review.html').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing source'):
            self.verify()

    def test_preview_must_pin_its_actual_runtime(self):
        original = (self.root / 'avatar-v3-review.html').read_text()
        self.write('avatar-v3-review.html', original.replace('?v=', '?wrong='))
        with self.assertRaisesRegex(ValueError, 'cache pin or SRI'):
            self.verify()
        self.write('avatar-v3-review.html', original)
        self.write(self.runtime, b'other runtime')
        with self.assertRaisesRegex(ValueError, 'runtime bytes changed'):
            self.verify()

    def test_collar_geometry_module_must_match_preview_source_pin(self):
        self.write('src/avatar-v3-collar-fit.js', b'unregistered collar geometry')
        with self.assertRaisesRegex(ValueError, 'source bindings changed'):
            self.verify()

    def test_unknown_collar_registration_revision_is_rejected(self):
        self.preview['collar_fit_revision'] = 'UNREVIEWED_GEOMETRY'
        self.write('AVATAR_V3_REVIEW_BUILD.json', json.dumps(self.preview))
        with self.assertRaisesRegex(ValueError, 'source bindings changed'):
            self.verify()

    def test_input_remapping_and_extra_manifest_policy_are_rejected(self):
        self.write('data/inputs.json', b'other input')
        with self.assertRaisesRegex(ValueError, 'remap original input registrations'):
            self.verify()
        self.write('data/inputs.json', b'input')
        self.data['extra_remapping'] = {'DS029': 'DS001'}
        self.write(source_lock.V3_DATA, json.dumps(self.data))
        with self.assertRaisesRegex(ValueError, 'exact reviewed source contract'):
            self.verify()

    def test_extra_assets_data_and_existing_asset_edits_are_rejected(self):
        allowed = {name: 'A' for name in self.verify()}
        for name, status in [('assets/arbitrary.png', 'A'), ('data/new-registry.json', 'A'),
                             ('assets/' + self.layers['avatar'][0] + '.png', 'M')]:
            with self.subTest(path=name):
                with self.assertRaisesRegex(ValueError, 'exact continuous allowlist'):
                    source_lock.validate_protected_changes({**allowed, name: status}, allowed)
        with self.assertRaisesRegex(ValueError, 'exact continuous allowlist'):
            source_lock.validate_protected_changes({**allowed, source_lock.V3_DATA: 'M'}, allowed)


if __name__ == '__main__':
    unittest.main(verbosity=2)
