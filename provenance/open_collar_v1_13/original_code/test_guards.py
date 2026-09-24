"""Behavioural test for the asset guard. Run with HEWRS_ASSETS UNSET.

    env -u HEWRS_ASSETS python3 01_code/test_guards.py

Every module that touches the asset library must raise RuntimeError with an
actionable message at its FIRST asset access, and must still IMPORT cleanly.

This test exists because the guard was "fixed" three times and shipped broken
twice. Both times the check was textual - the function was defined, or the call
appeared in the file - and both times the behaviour was wrong. The first version
tested os.path.isdir, which passes because an 03_assets directory exists. The
second defined _require_assets in six modules and wired it into one. The third
guarded assemble_shirt._avatar, which is invoked at module level, so the module
became unimportable instead of failing at access.

Grep is not a test. Run it.
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

CASES = [
    ('shirt_photo_cloth', lambda m: m.catalogue()),
    ('assemble_shirt',    lambda m: m.build('White solid')),
    ('knot_r3',           lambda m: m._load()),
    ('shirt_addendum',    lambda m: m.patch('DS034')),
    ('shirt_hires',       lambda m: m._find('IMG_0726.jpeg')),
    ('tie_source',        lambda m: m.load('T001')),
]


def main():
    if os.environ.get('HEWRS_ASSETS'):
        print('HEWRS_ASSETS is set. Unset it - this test checks the absent case.')
        return 2
    fails = []
    print('asset-guard behavioural test (HEWRS_ASSETS unset)')
    for name, call in CASES:
        try:
            mod = __import__(name)
        except Exception as e:
            fails.append((name, 'import ' + type(e).__name__))
            print('  %-20s IMPORT FAILED %-18s FAIL' % (name, type(e).__name__))
            continue
        try:
            call(mod)
            got = 'no exception'
        except RuntimeError as e:
            got = 'RuntimeError' if 'asset library not found' in str(e) \
                  else 'RuntimeError (wrong message)'
        except Exception as e:
            got = type(e).__name__
        ok = got == 'RuntimeError'
        if not ok:
            fails.append((name, got))
        print('  %-20s %-24s %s' % (name, got, 'PASS' if ok else 'FAIL'))
    print()
    print('RESULT: %s' % ('all %d modules guarded' % len(CASES) if not fails
                          else 'FAILURES %s' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
