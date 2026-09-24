"""HEWRS preflight - run this first, from anywhere.

    python3 01_code/preflight.py

Reports exactly what this bundle can and cannot do from where it sits, so the
answer is never discovered three frames deep in a FileNotFoundError.
"""
import os, sys, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PLATE_SHA = "3342a604ab2128bce3bcb4993da8258d2823da17f0bd144d5e0b3ead160736f4"
# Corrected 2026-08-30. The first list named nine items and was WRONG: an
# assets cut built from it reported READY and then failed on repaired ties
# (padded_repaired), on DS018 and DS026 (real_photos) and on assemble_shirt.build
# (avatar). Found by building the cut and running the pipeline against it, not by
# re-reading the list.
NEEDED = ['catalogue.json', 'catalogue_photos', 'archive14_photos', 'archive15_photos',
          'archive16_photos', 'hires_photos', 'addendum_photos', 'ties_clean',
          'padded_repaired', 'real_photos', 'avatar',
          'FORMAL_TIE_KNOT_R3_LAYER_996x2748.png']


def main():
    ok = True
    print('HEWRS preflight')
    print('  bundle root : %s' % ROOT)

    plate = os.path.join(ROOT, '03_assets', 'avatar',
                         'base-front_CANONICAL_996x2748_FROM_PRODUCTION.png')
    if os.path.isfile(plate):
        h = hashlib.sha256(open(plate, 'rb').read()).hexdigest()
        good = h == PLATE_SHA
        print('  avatar plate: %s (%s)' % ('PRESENT', 'hash OK' if good else 'HASH MISMATCH'))
        ok &= good
    else:
        print('  avatar plate: MISSING'); ok = False

    env = os.environ.get('HEWRS_ASSETS')
    cands = [env] if env else []
    cands += [os.path.join(ROOT, d) for d in ('02_assets', '03_assets')]
    found = next((c for c in cands if c and os.path.isdir(c)), None)
    print('  HEWRS_ASSETS: %s' % (env or '(unset)'))
    print('  asset root  : %s' % (found or 'NOT FOUND'))

    if found:
        missing = [n for n in NEEDED if not os.path.exists(os.path.join(found, n))]
        if missing:
            print('  shirt/tie   : NOT RUNNABLE - missing %s' % ', '.join(missing))
            print('                These live in the 27 August bundle. Set HEWRS_ASSETS to')
            print('                the root of an unzipped HEWRS_ASSETS_2026-08-27.zip')
            ok = False
        else:
            print('  shirt/tie   : runnable')
    else:
        print('  shirt/tie   : NOT RUNNABLE - no asset directory'); ok = False

    sys.path.insert(0, os.path.join(ROOT, '06_geometry'))
    try:
        import trouser_geom_v36_CURRENT as G
        G.assert_plate()
        print('  geometry    : runnable, mask %d px, CROTCH %d' % (G.mask().sum(), G.CROTCH))
    except Exception as e:
        print('  geometry    : FAIL %s %s' % (type(e).__name__, e)); ok = False

    print('  RESULT      : %s' % ('READY' if ok else 'INCOMPLETE - see above'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
