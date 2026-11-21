#!/usr/bin/env python3
"""Check the runtime actually bound by both app pages without rewriting artifacts.

Only the exact, hash-bound continuous-shirt candidate activates its eight-shirt
exception. Other deliveries retain the existing tie-candidate reproduction gate.
"""
import argparse
import base64
import hashlib
import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
BASE = 'f114d7dbedab3430761a29d77328ae80ac0882e4'
INPUT_SHA256 = '3e60ce18a0295c6801983ce91dda296efec458b275f523523dee1e3915db7516'
AVATAR_SHA256 = 'a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d'
ORIGINAL_RUNTIME = 'runtime/outfit-refill-preview.js'
ORIGINAL_RUNTIME_SHA256 = 'd4231feabdc5bcad3a9ec784f61359404586489359d03b2fd81f72135388dfb8'
TARGET_IDS = ('DS001', 'DS014', 'DS017', 'DS023', 'DS034', 'DS035', 'DS036', 'DS051')
MANIFEST = 'CONTINUOUS_CANDIDATE.json'
MODULES = ('data/continuous-shirts.js', 'src/continuous-shirts.js')
CONTINUOUS_RUNTIME = re.compile(r'runtime/continuous-shirts-([a-f0-9]{20})\.js\Z')
AVATAR_V3_RUNTIME = re.compile(r'runtime/avatar-v3-candidate-([a-f0-9]{20})\.js\Z')
V3_LAYERS = {
    'avatar': '4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93',
    'left_hand': '26af452854f6f89c86617d83e9848ae71922d2ff4701877e7903f59c55ebb2b8',
    'right_hand': 'cfca4394b3d208184fef4f267671af834432ac2f6bd89acea83242a9e118863b',
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


class Scripts(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.scripts = []
        self.styles = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'script' and values.get('src'):
            self.scripts.append(values)
        if tag == 'link' and values.get('rel') == 'stylesheet' and values.get('href'):
            self.styles.append(values)


def runtime_binding(root, name):
    scripts = Scripts((root / name).read_text()).scripts
    bindings = [s for s in scripts if urlsplit(s['src']).path.startswith('runtime/')]
    require(len(bindings) == 1, name + ': expected exactly one application runtime')
    return bindings[0]


def active_runtime(root=ROOT, entrypoints=('index.html', 'app.html')):
    root = Path(root)
    paths = [urlsplit(runtime_binding(root, name)['src']).path for name in entrypoints]
    require(paths[0] == paths[1], 'App pages bind different runtimes')
    return paths[0]


def describe_avatar_v3(root):
    """Validate a promoted V3 profile against its retained exact V2 delivery."""
    release_name = 'AVATAR_V3_RELEASE.json'
    release = json.loads((root / release_name).read_text())
    require(release.get('schema') == 'hewrs.avatar-v3-release.v1' and release.get('profile') == 'AVATAR_V3', 'Unrecognized V3 release contract')
    require(release.get('baseline_entrypoint') == 'avatar-v2-reference.html', 'V3 baseline page differs')
    base = describe(root, ('avatar-v2-reference.html', 'avatar-v2-reference.html'))
    require(base['kind'] == 'continuous', 'V3 lacks the exact continuous-shirt baseline')
    preview = json.loads((root / 'AVATAR_V3_REVIEW_BUILD.json').read_text())
    runtime = active_runtime(root)
    runtime_sha = digest((root / runtime).read_bytes())
    require(preview['runtime'] == release['runtime'] == runtime and preview['runtime_sha256'] == release['runtime_sha256'] == runtime_sha, 'V3 runtime pins differ')
    require(AVATAR_V3_RUNTIME.fullmatch(runtime)[1] == runtime_sha[:20], 'V3 content-addressed runtime differs')
    require(preview['base_entrypoint'] == release['baseline_entrypoint'] and preview['base_index_sha256'] == release['baseline_entrypoint_sha256'] == digest((root / release['baseline_entrypoint']).read_bytes()), 'V3 baseline page hash differs')
    require(preview['base_runtime'] == release['continuous_runtime'] == base['runtime'] and preview['base_runtime_sha256'] == release['continuous_runtime_sha256'] == base['runtime_sha256'], 'V3 continuous runtime differs')
    require(release['baseline_manifest_sha256'] == digest((root / MANIFEST).read_bytes()), 'V3 baseline manifest differs')
    spec_name = 'data/avatar-v3-candidate.json'
    spec = json.loads((root / spec_name).read_text())
    require(release['source_specification'] == spec_name and release['source_specification_sha256'] == digest((root / spec_name).read_bytes()), 'V3 source specification differs')
    require(spec['width_height'] == [996, 2748] and spec['source_profile'] == 'AVATAR_V2_MASTER', 'V3 native source registration differs')
    require(release['layer_hashes'] == preview['layer_hashes'] == V3_LAYERS, 'V3 source identities differ')
    require(release['immutable_v2_hashes'] == spec['source_layer_hashes'] and spec['source_layer_hashes']['avatar'] == AVATAR_SHA256, 'V3 original identity differs')
    for name, sha in V3_LAYERS.items():
        row = spec['candidate_layers'][name]
        require(row['sha256'] == sha and row['url'] == 'assets/' + sha + '.png' and row['rect'] == [0, 0, 996, 2748], 'V3 layer registration differs: ' + name)
        require(digest((root / row['url']).read_bytes()) == sha, 'V3 source bytes differ: ' + name)
        original = spec['source_layer_hashes'][name]
        require(digest((root / ('assets/' + original + '.png')).read_bytes()) == original, 'Immutable V2 layer changed: ' + name)
    modules = ('src/avatar-v3.js', 'src/avatar-v3-collar-fit.js', 'src/avatar-v3-tie-fit.js',
               'src/avatar-v3-shirt-collar-fit.js', 'src/avatar-v3-cuff-fit.js', 'src/avatar-v3-pose.js')
    require(release['source_modules'] == {name: digest((root / name).read_bytes()) for name in modules}, 'V3 source module pins are stale')
    fit_modules = modules[2:5]
    require(release.get('issue19_fit_modules') == preview.get('issue19_fit_modules') ==
            {name:digest((root / name).read_bytes()) for name in fit_modules}, 'Issue 19 fit source bindings differ')
    mobile_style = 'src/avatar-v3-review-layout.css'
    mobile_style_sha = digest((root / mobile_style).read_bytes())
    require(release.get('issue19_mobile_stylesheet') == preview.get('issue19_mobile_stylesheet') ==
            {'path':mobile_style,'sha256':mobile_style_sha}, 'Issue 19 mobile stylesheet source pin differs')
    require(release.get('issue19_runtime_compatibility') == preview.get('issue19_runtime_compatibility') ==
            {'vendor/active50-renderer.js':'release_only_masked_temporary_canvas_never_borrowed_loader_canvas',
             'src/render-image-loader.js':'cache_includes_source_bound_tie_display_registration',
             'src/continuous-shirts.js':'capture_exact_registered_body_before_tie_and_avatar_composition'},
            'V3 borrowed canvas ownership contract differs')
    require(release.get('issue19_baseline') == {
        'commit':'ee6bdb7c0986597e569056499ff9eedca1ec3c98',
        'entrypoint':'avatar-v3-issue19-baseline.html',
        'entrypoint_sha256':'4670d41cc6139d12956dfbd064692e92fe28c719160ec2e142754b2e22de718b'},
        'Issue 19 original published V3 reference differs')
    require(digest((root / 'avatar-v3-issue19-baseline.html').read_bytes()) == release['issue19_baseline']['entrypoint_sha256'],
            'Issue 19 published V3 comparison page changed')
    require(preview.get('collar_fit_source_sha256') == release['source_modules']['src/avatar-v3-collar-fit.js'] and
            preview.get('collar_fit_revision') == release.get('collar_fit_revision') == 'AVATAR_V3_B15_COLLAR_FIT_1',
            'V3 collar registration source or revision differs')
    require((root / 'index.html').read_bytes() == (root / 'app.html').read_bytes(), 'V3 app pages differ')
    for name in ('index.html', 'app.html'):
        text = (root / name).read_text()
        require('data-avatar-profile="AVATAR_V3"' in text, name + ': V3 profile is not promoted')
        require(release['entrypoints'][name] == digest(text.encode()), name + ': V3 entrypoint hash differs')
        binding = runtime_binding(root, name)
        url = urlsplit(binding['src'])
        require(not url.scheme and not url.netloc and not url.fragment, name + ': V3 runtime must be local')
        require(binding.get('integrity') == 'sha256-' + base64.b64encode(bytes.fromhex(runtime_sha)).decode(), name + ': V3 SRI mismatch')
        require(parse_qs(url.query).get('v') == [runtime_sha[:16]], name + ': V3 cache pin mismatch')
        styles = [row for row in Scripts(text).styles if urlsplit(row['href']).path == mobile_style]
        require(len(styles) == 1, name + ': one V3 reviewed mobile stylesheet required')
        style_url = urlsplit(styles[0]['href'])
        require(not style_url.scheme and not style_url.netloc and not style_url.fragment,
                name + ': V3 mobile stylesheet must be local')
        require(styles[0].get('integrity') == 'sha256-' + base64.b64encode(bytes.fromhex(mobile_style_sha)).decode(),
                name + ': V3 mobile stylesheet SRI mismatch')
        require(parse_qs(style_url.query).get('v') == [mobile_style_sha[:16]], name + ': V3 mobile stylesheet cache pin mismatch')
    files = ['index.html', 'app.html', runtime, release_name, 'AVATAR_V3_REVIEW_BUILD.json', 'avatar-v3-review.html', spec_name, mobile_style, *modules]
    return {**base, 'kind': 'avatar-v3', 'manifest': release_name,
            'runtime': runtime, 'runtime_sha256': runtime_sha,
            'continuous_runtime': base['runtime'], 'continuous_runtime_sha256': base['runtime_sha256'],
            'avatar_sha256': V3_LAYERS['avatar'], 'avatar_profile': 'AVATAR_V3',
            'avatar_layers': dict(V3_LAYERS), 'baseline_entrypoint': release['baseline_entrypoint'],
            'source_sha256': {**base['source_sha256'], **{name: digest((root / name).read_bytes()) for name in files}}}


def describe(root=ROOT, entrypoints=('index.html', 'app.html')):
    """Validate current byte bindings; no Git access, builds, or file writes."""
    root = Path(root)
    runtime = active_runtime(root, entrypoints)
    if AVATAR_V3_RUNTIME.fullmatch(runtime):
        require(entrypoints == ('index.html', 'app.html'), 'V3 baseline cannot recursively select V3')
        return describe_avatar_v3(root)
    match = CONTINUOUS_RUNTIME.fullmatch(runtime)
    require(bool(match) or runtime == ORIGINAL_RUNTIME, 'Unrecognized active runtime: ' + runtime)
    require((root / entrypoints[0]).read_bytes() == (root / entrypoints[1]).read_bytes(), 'App entrypoints differ')
    runtime_sha = digest((root / runtime).read_bytes())
    for name in entrypoints:
        binding = runtime_binding(root, name)
        url = urlsplit(binding['src'])
        require(not url.scheme and not url.netloc and not url.fragment, name + ': runtime must be local')
        require(binding.get('integrity') == 'sha256-' + base64.b64encode(bytes.fromhex(runtime_sha)).decode(), name + ': runtime SRI mismatch')
        require(parse_qs(url.query).get('v') == [runtime_sha[:16]], name + ': runtime cache pin mismatch')
    result = {'kind': 'continuous' if match else 'legacy', 'runtime': runtime, 'runtime_sha256': runtime_sha}
    files = [*entrypoints, runtime]
    if match:
        manifest = json.loads((root / MANIFEST).read_text())
        require(manifest.get('schema') == 'hewrs.continuous-shirt-candidate.v1', 'Unexpected continuous manifest schema')
        require(manifest.get('base_commit') == BASE, 'Continuous candidate baseline changed')
        require(manifest.get('runtime') == runtime and manifest.get('runtime_sha256') == runtime_sha and match[1] == runtime_sha[:20], 'Continuous manifest/runtime binding mismatch')
        require(manifest.get('source_input_sha256') == INPUT_SHA256 == digest((root / 'data/inputs.json').read_bytes()), 'Authoritative input source changed')
        require(manifest.get('avatar_sha256') == AVATAR_SHA256 == digest((root / ('assets/' + AVATAR_SHA256 + '.png')).read_bytes()), 'Frozen avatar changed')
        require(manifest.get('original_runtime_sha256') == ORIGINAL_RUNTIME_SHA256 == digest((root / ORIGINAL_RUNTIME).read_bytes()), 'Original complete-app runtime changed')
        require(manifest.get('modules') == {name: digest((root / name).read_bytes()) for name in MODULES}, 'Continuous source module pins are stale')
        require(manifest.get('garment_data_sha256') == digest((root / 'data/continuous-shirts.json').read_bytes()), 'Continuous garment data pin is stale')
        require(manifest.get('entrypoints') == {name: digest((root / actual).read_bytes()) for name, actual in zip(('index.html', 'app.html'), entrypoints)}, 'Continuous entrypoint pins are stale')
        require(manifest.get('approval') == 'CANDIDATE_ONLY_OWNER_APPROVAL_NOT_GRANTED', 'Candidate approval marker changed')
        data = json.loads((root / 'data/continuous-shirts.json').read_text())
        require(data.get('schema') == 'hewrs.continuous-shirts.v1' and data.get('source_input_sha256') == INPUT_SHA256, 'Continuous garment contract source mismatch')
        require(data.get('ids') == list(TARGET_IDS) and sorted(data.get('shirts', {})) == list(TARGET_IDS), 'Continuous exception contains an unauthorized shirt')
        accepted = json.loads((root / 'STANDARD_RELEASE.json').read_text())
        require(digest((root / accepted['runtime']).read_bytes()) == accepted['runtime_sha256'], 'Frozen Standard runtime changed')
        for name, expected in accepted['integration_resources'].items():
            require(digest((root / name).read_bytes()) == expected, 'Frozen integration resource changed: ' + name)
        result.update(manifest=MANIFEST, base_commit=BASE, target_ids=list(TARGET_IDS),
                      avatar_sha256=AVATAR_SHA256, source_input_sha256=INPUT_SHA256)
        files += [MANIFEST, 'data/continuous-shirts.json', *MODULES]
    result['source_sha256'] = {name: digest((root / name).read_bytes()) for name in files}
    return result


def verify(verify_base=False, syntax=False):
    active = describe()
    if active['kind'] == 'legacy':
        command = [sys.executable, str(ROOT / 'tools/build_tie_candidate.py'), '--check']
        if verify_base:
            command.append('--verify-base')
        subprocess.run(command, cwd=ROOT, check=True)
    else:
        import build_tie_candidate as delivery
        if verify_base:
            old = delivery.assemble(delivery.BASE).encode()
            require(digest(old) == delivery.BASE_SHA256 and old == delivery.read(ORIGINAL_RUNTIME, delivery.BASE).encode(), 'Pinned historical candidate does not reproduce exactly')
        current, pinned = delivery.reviewed_delivery()
        require(current == pinned, 'Reviewed lazy module delivery is stale')
        previous_runtime, previous_dependencies = delivery.RUNTIME, delivery.DEPENDENCIES
        delivery.RUNTIME = active['runtime']
        delivery.DEPENDENCIES = [active['runtime'] if name == previous_runtime else name for name in previous_dependencies]
        try:
            sri = 'sha256-' + base64.b64encode(bytes.fromhex(active['runtime_sha256'])).decode()
            for name in ('index.html', 'app.html'):
                before, after = delivery.entrypoint(name, sri)
                require(before == after, name + ': stale candidate resource binding')
            for name in delivery.UTILITIES:
                text = delivery.read(name)
                require(text == delivery.pin_resources(text, sri), name + ': stale utility resource binding')
        finally:
            delivery.RUNTIME, delivery.DEPENDENCIES = previous_runtime, previous_dependencies
        subprocess.run([sys.executable, str(ROOT / 'tools/build_continuous_candidate.py')], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        if active['kind'] == 'avatar-v3':
            subprocess.run([sys.executable, str(ROOT / 'tools/integrate_avatar_v3.py'), '--check'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    if syntax:
        subprocess.run(['node', '--check', str(ROOT / active['runtime'])], cwd=ROOT, check=True)
    return active


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Reproduce and verify the active delivery (default).')
    parser.add_argument('--describe', action='store_true', help='Print validated byte bindings without a Git-based rebuild check.')
    parser.add_argument('--is-continuous', action='store_true', help='Classify the bound runtime for legacy workflow routing only.')
    parser.add_argument('--verify-base', action='store_true')
    parser.add_argument('--syntax', action='store_true')
    args = parser.parse_args()
    if args.is_continuous:
        print('true' if CONTINUOUS_RUNTIME.fullmatch(active_runtime()) or AVATAR_V3_RUNTIME.fullmatch(active_runtime()) else 'false')
        return
    active = describe() if args.describe else verify(args.verify_base, args.syntax)
    print(json.dumps(active, indent=2))


if __name__ == '__main__':
    main()
