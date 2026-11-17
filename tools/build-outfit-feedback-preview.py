#!/usr/bin/env python3
"""Build only the optional rejection preview from the frozen Standard runtime.

The two preview modules are reviewed copies. No Standard source, entrypoint,
garment image, avatar image, score data or release manifest is rewritten.
"""
from pathlib import Path
import base64
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def build():
    release = json.loads((ROOT / 'STANDARD_RELEASE.json').read_text())
    original = (ROOT / release['runtime']).read_bytes()
    if digest(original) != release['runtime_sha256']:
        raise ValueError('The accepted runtime does not match its release manifest.')
    code = original.decode('utf-8')
    replacements = {
        'src/automatic-engine.js': 'src/outfit-refill-engine.js',
        'src/application.js': 'src/outfit-refill-application.js',
    }
    sources = {}
    for baseline, preview in replacements.items():
        approved = (ROOT / baseline).read_text()
        candidate = (ROOT / preview).read_text()
        marker = '\n/* SOURCE: ' + baseline + ' */\n' + approved + '\n;\n'
        if code.count(marker) != 1:
            raise ValueError('Exactly one frozen source section was expected: ' + baseline)
        code = code.replace(marker, '\n/* PREVIEW SOURCE: ' + preview + ' */\n' + candidate + '\n;\n', 1)
        sources[preview] = digest(candidate.encode())
    output = code.encode('utf-8')
    runtime = 'runtime/outfit-refill-preview.js'
    (ROOT / runtime).write_bytes(output)
    metadata = {
        'schema': 'hewrs.outfit-refill-preview.v1',
        'runtime': runtime,
        'sha256': digest(output),
        'integrity': 'sha256-' + base64.b64encode(hashlib.sha256(output).digest()).decode(),
        'baseline_runtime': release['runtime'],
        'baseline_sha256': release['runtime_sha256'],
        'preview_sources': sources,
    }
    (ROOT / 'data/outfit-refill-runtime.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps({'runtime': runtime, 'bytes': len(output), 'sha256': metadata['sha256']}))


if __name__ == '__main__':
    build()
