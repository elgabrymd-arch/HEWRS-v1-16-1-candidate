#!/usr/bin/env python3
"""Assemble the complete app with isolated continuous-shirt geometry.

The current main runtime and frozen Standard release inputs remain byte-identical.
Only this candidate branch's entrypoints reference the newly named runtime.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import json
import subprocess
import build_tie_candidate as delivery

ROOT = Path(__file__).resolve().parents[1]
BASE = 'f114d7dbedab3430761a29d77328ae80ac0882e4'
MODULES = ['data/continuous-shirts.js', 'src/continuous-shirts.js']


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--write', action='store_true')
    args = p.parse_args()
    code = delivery.assemble()
    anchor = '/* SOURCE: src/local-state.js */'
    if code.count(anchor) != 1:
        raise ValueError('Missing unambiguous post-mixed-renderer insertion point')
    inserted = '\n'.join('/* CONTINUOUS SHIRT SOURCE: '+name+' */\n'+(ROOT/name).read_text()+'\n;\n' for name in MODULES)
    code = code.replace(anchor, inserted+'\n'+anchor)
    encoded = code.encode()
    digest = sha(encoded)
    runtime = 'runtime/continuous-shirts-'+digest[:20]+'.js'
    sri = 'sha256-'+base64.b64encode(hashlib.sha256(encoded).digest()).decode()
    if args.write:
        (ROOT/runtime).write_bytes(encoded)
    elif not (ROOT/runtime).exists() or (ROOT/runtime).read_bytes() != encoded:
        raise ValueError('Candidate runtime is stale; rebuild with --write')
    current_runtime = delivery.RUNTIME
    delivery.RUNTIME = runtime
    integrated = (ROOT / 'AVATAR_V3_RELEASE.json').is_file()
    pages = ('avatar-v2-reference.html',) if integrated else ('index.html', 'app.html')
    for name in pages:
        source_name = 'index.html' if name == 'avatar-v2-reference.html' else name
        base_html = subprocess.check_output(['git', 'show', BASE+':'+source_name], cwd=ROOT).decode()
        if base_html.count(current_runtime) != 1:
            raise ValueError('Expected one current complete-app runtime')
        html = delivery.pin_resources(base_html.replace(current_runtime, runtime), sri)
        if args.write:
            (ROOT/name).write_text(html)
        elif (ROOT/name).read_text() != html:
            raise ValueError(name+': candidate entrypoint delivery differs')
    metadata = {
        'schema': 'hewrs.continuous-shirt-candidate.v1',
        'base_commit': BASE, 'runtime': runtime, 'runtime_sha256': digest,
        'source_input_sha256': sha((ROOT/'data/inputs.json').read_bytes()),
        'original_runtime_sha256': sha((ROOT/current_runtime).read_bytes()),
        'avatar_sha256': 'a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d',
        'garment_data_sha256': sha((ROOT/'data/continuous-shirts.json').read_bytes()),
        'modules': {name: sha((ROOT/name).read_bytes()) for name in MODULES},
        'entrypoints': {name: sha((ROOT/('avatar-v2-reference.html' if integrated else name)).read_bytes()) for name in ('index.html','app.html')},
        'approval': 'CANDIDATE_ONLY_OWNER_APPROVAL_NOT_GRANTED',
    }
    content = json.dumps(metadata, indent=2)+'\n'
    if args.write:
        (ROOT/'CONTINUOUS_CANDIDATE.json').write_text(content)
        for old in (ROOT/'runtime').glob('continuous-shirts-*.js'):
            if old != ROOT/runtime:
                old.unlink()
    elif (ROOT/'CONTINUOUS_CANDIDATE.json').read_text() != content:
        raise ValueError('Candidate manifest differs')
    print(json.dumps(metadata, indent=2))


if __name__ == '__main__':
    main()
