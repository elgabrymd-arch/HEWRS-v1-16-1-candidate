#!/usr/bin/env python3
"""Read-only verification of V1.7 package and preservation of V1.6 sources.

Checks artifact identity and explicit source bindings. It does not certify visual
approval, missing historical scoring bindings, browser behavior, or deployment.
"""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_OLD_CHANGES = {
    'app.template.html', 'app.html', 'README.md', 'src/application.js',
    'src/local-state.js', 'tools/build.py', 'PACKAGE_SHA256.json',
}

def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)

def path_for(name: str) -> Path:
    p = PurePosixPath(name)
    require(not p.is_absolute() and '..' not in p.parts and '\\' not in name,
            'Unsafe path: ' + name)
    out = ROOT.joinpath(*p.parts)
    require(out.is_file() and not out.is_symlink(), 'Missing or symbolic file: ' + name)
    require(out.resolve().is_relative_to(ROOT.resolve()), 'Path escapes package: ' + name)
    return out

def sha(p: Path) -> str:
    with p.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def main() -> None:
    package = json.loads((ROOT / 'PACKAGE_SHA256.json').read_text())
    require(package['schema'] == 'hewrs.package.sha256.v1', 'Wrong package manifest')
    seen: set[str] = set()
    for row in package['files']:
        name = row['path']
        require(name not in seen and name != 'PACKAGE_SHA256.json', 'Duplicate/self hash')
        seen.add(name)
        p = path_for(name)
        require(p.stat().st_size == row['bytes'] and sha(p) == row['sha256'],
                'Package file differs: ' + name)
    actual = {str(p.relative_to(ROOT).as_posix()) for p in ROOT.rglob('*')
              if p.is_file() and '__pycache__' not in p.parts and p != ROOT / 'PACKAGE_SHA256.json'}
    require(actual == seen, 'Manifest omissions/extras: ' + str(sorted(actual ^ seen)))
    baseline = json.loads((ROOT / 'evidence/blazer_v1_7/BASELINE_V1_6.json').read_text())
    changed, unchanged, images = [], [], []
    for name, expected in baseline.items():
        p = path_for(name)
        if sha(p) == expected:
            unchanged.append(name)
        else:
            require(name in ALLOWED_OLD_CHANGES, 'Unexpected original-file change: ' + name)
            changed.append(name)
        if name.startswith(('assets/', 'assemblies/')) and name.endswith('.png'):
            require(sha(p) == expected, 'Original image changed: ' + name)
            images.append(name)
    for name in ('data/inputs.json', 'data/inputs.js'):
        require(sha(path_for(name)) == baseline[name], 'Original input/source-lock changed')
    origins = json.loads((ROOT / 'evidence/blazer_v1_7/SOURCE_ORIGINS.json').read_text())
    source_hashes = set()
    for row in origins:
        require(sha(path_for(row['target'])) == row['sha256'], 'Copied source differs: '+row['source'])
        source_hashes.add(row['sha256'])
    data = json.loads((ROOT / 'data/blazer-connection.json').read_text())
    js = (ROOT / 'data/blazer-connection.js').read_text().strip()
    prefix = 'globalThis.HEWRS_BLAZER_CONNECTION_DATA='
    require(js.startswith(prefix) and js.endswith(';'), 'Unexpected data bundle form')
    require(json.loads(js[len(prefix):-1]) == data, 'JSON/JS bundle mismatch')
    for hash_, rel in data['assetPaths'].items():
        require(sha(path_for(rel)) == hash_, 'Unbound image identity: ' + rel)
    require(not (ROOT/'index.html').exists(), 'Unexpected production entry point')
    print(json.dumps({
        'status':'PASS', 'payload_files':len(seen),
        'baseline_files':len(baseline), 'unchanged_baseline_files':len(unchanged),
        'changed_baseline_files':sorted(changed), 'original_image_files_preserved':len(images),
        'copied_source_hashes_verified':len(source_hashes),
        'source_lock_and_input_data_unchanged':True,
        'scope':'Package-byte and source-binding verification, not visual or release approval',
    }, indent=2))

if __name__ == '__main__':
    try:
        main()
    except (KeyError, ValueError, OSError, TypeError) as exc:
        print(json.dumps({'status':'FAIL','error':str(exc)}), file=sys.stderr)
        raise SystemExit(1)
