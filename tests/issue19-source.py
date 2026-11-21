#!/usr/bin/env python3
"""Independently preserve the actual published V3 sources while checking Issue 19.

The baseline is the documentation-only main commit after the approved V3
release. Unlike historical eight-shirt allowances, no data or image exception
is granted to this display-only change.
"""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = 'ee6bdb7c0986597e569056499ff9eedca1ec3c98'
PROTECTED = ['assets', 'assemblies', 'data', 'ui', 'ui-assets', 'vendor',
             'provenance', 'avatar-v2-reference.html', 'CONTINUOUS_CANDIDATE.json',
             'STANDARD_RELEASE.json', 'outfit-feedback.js', 'tools/build.py',
             'src/avatar-v3.js', 'src/avatar-v3-pose.js', 'src/avatar-v3-collar-fit.js']
BEHAVIOR = ['src/application.js', 'src/outfit-refill-application.js',
            'src/automatic-engine.js', 'src/outfit-refill-engine.js',
            'src/owner-feedback-integration.js', 'src/reviewed-rejection-integration.js',
            'src/outfit-rejection-core.js', 'src/outfit-rejection-ui.js',
            'src/rejection-database.js', 'src/local-state.js', 'src/favorites-state.js',
            'src/rotation-insights.js', 'src/option-set-policy.js',
            'src/style-occasion-policy.js', 'src/outfit-learning.js',
            'src/hybrid-stylist.js', 'src/tie-feedback.js', 'src/tie-exposure.js',
            'src/tie-fidelity.js', 'src/continuous-shirts.js']


def git(*arguments):
    return subprocess.check_output(['git', *arguments], cwd=ROOT)


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', default=BASELINE)
    parser.add_argument('--output', type=Path, default=ROOT / 'evidence/issue19/source.json')
    args = parser.parse_args()
    if args.baseline != BASELINE:
        raise ValueError('Issue 19 source audit requires the exact approved V3 baseline')
    # Preserve every pre-existing source module, including integrations not
    # named individually below. The three fit wrappers are separate additions.
    original_modules = git('ls-tree', '-r', '--name-only', args.baseline, '--', 'src').decode().splitlines()
    names = list(dict.fromkeys([*PROTECTED, *BEHAVIOR, *original_modules]))
    differences = git('diff', '--name-status', args.baseline, '--', *names).decode()
    if differences:
        raise AssertionError('Protected original source or behavior changed:\n' + differences)
    untracked = git('ls-files', '--others', '--exclude-standard', '--', *names).decode()
    if untracked:
        raise AssertionError('Unreviewed protected source additions:\n' + untracked)
    sources = [line.split('\t', 1)[1] for line in git('ls-tree', '-r', args.baseline, '--', *names).decode().splitlines()]
    for name in sources:
        if not (ROOT / name).is_file() or (ROOT / name).is_symlink():
            raise AssertionError('Missing or substituted protected file: ' + name)
    sys.path.insert(0, str(ROOT / 'tools'))
    from verify_active_delivery import describe
    active = describe()
    if active['kind'] != 'avatar-v3':
        raise AssertionError('Issue 19 must retain the approved V3 profile')
    sha = lambda p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest()
    for name, expected in active['avatar_layers'].items():
        if sha('assets/' + expected + '.png') != expected:
            raise AssertionError('Approved V3 source changed: ' + name)
    report = {'schema': 'hewrs.issue19.source-audit.v1', 'status': 'PASS',
              'baseline_commit': args.baseline, 'checked_source_files': len(sources),
              'original_source_modules_preserved': len(original_modules),
              'protected_roots_and_paths': names, 'source_exception_count': 0,
              'active_runtime': active['runtime'], 'runtime_sha256': active['runtime_sha256'],
              'avatar_layers': active['avatar_layers'],
              'input_sha256': sha('data/inputs.json'),
              'browser_storage_migration': 'none; all behavior sources unchanged',
              'visual_acceptance': 'not_established_by_source_audit'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    run()
