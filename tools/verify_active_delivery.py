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


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


class Scripts(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.scripts = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'script' and values.get('src'):
            self.scripts.append(values)


def runtime_binding(root, name):
    scripts = Scripts((root / name).read_text()).scripts
    bindings = [s for s in scripts if urlsplit(s['src']).path.startswith('runtime/')]
    require(len(bindings) == 1, name + ': expected exactly one application runtime')
    return bindings[0]


def active_runtime(root=ROOT):
    root = Path(root)
    paths = [urlsplit(runtime_binding(root, name)['src']).path for name in ('index.html', 'app.html')]
    require(paths[0] == paths[1], 'App pages bind different runtimes')
    return paths[0]


def describe(root=ROOT):
    """Validate current byte bindings; no Git access, builds, or file writes."""
    root = Path(root)
    runtime = active_runtime(root)
    match = CONTINUOUS_RUNTIME.fullmatch(runtime)
    require(bool(match) or runtime == ORIGINAL_RUNTIME, 'Unrecognized active runtime: ' + runtime)
    require((root / 'index.html').read_bytes() == (root / 'app.html').read_bytes(), 'App entrypoints differ')
    runtime_sha = digest((root / runtime).read_bytes())
    for name in ('index.html', 'app.html'):
        binding = runtime_binding(root, name)
        url = urlsplit(binding['src'])
        require(not url.scheme and not url.netloc and not url.fragment, name + ': runtime must be local')
        require(binding.get('integrity') == 'sha256-' + base64.b64encode(bytes.fromhex(runtime_sha)).decode(), name + ': runtime SRI mismatch')
        require(parse_qs(url.query).get('v') == [runtime_sha[:16]], name + ': runtime cache pin mismatch')
    result = {'kind': 'continuous' if match else 'legacy', 'runtime': runtime, 'runtime_sha256': runtime_sha}
    files = ['index.html', 'app.html', runtime]
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
        require(manifest.get('entrypoints') == {name: digest((root / name).read_bytes()) for name in ('index.html', 'app.html')}, 'Continuous entrypoint pins are stale')
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
        print('true' if CONTINUOUS_RUNTIME.fullmatch(active_runtime()) else 'false')
        return
    active = describe() if args.describe else verify(args.verify_base, args.syntax)
    print(json.dumps(active, indent=2))


if __name__ == '__main__':
    main()
