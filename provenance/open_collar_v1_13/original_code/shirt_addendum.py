"""Cloth for DS034-DS045 from the addendum photographs.

These are NOT the same kind of photo as the DS001-DS049 replica batch. Those are
a model wearing the shirt, so garment_cloth() can find the face, the belt and the
subject columns and map the whole garment - which also gives pattern scale for
free. These are garments hanging or piled, several to a frame, so none of that
exists. garment_cloth() would fail on all twelve.

So the usable region is HAND-READ, one rectangle per shirt, off gridded crops.
Four automatic detectors failed on the equivalent problem for tie brand tags and
the nine hand-read rectangles in tags.py are what finally worked (HANDOFF sec 4).
Same approach.

WHAT THIS CANNOT GIVE
    Pattern scale. A hanging garment has no known width, so there is nothing to
    scale against. Irrelevant for the solids (DS034/35/37/38/39). It matters for
    DS040's GG monogram and DS042/43's Burberry checks, where SCALE_HINT below is
    a judgement call, not a measurement, and is flagged as such.

RECT = (x0, y0, x1, y1) in the extracted photo's own pixels.
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

_HERE = os.path.dirname(os.path.abspath(__file__))

def _resolve_assets():
    """Locate the HEWRS asset library.

    The shirt and tie source photographs (catalogue_photos, archive14/15/16,
    hires_photos, addendum_photos, ties_clean) live in the 27 August asset
    bundle. They are NOT duplicated in the 30 August handoff, so this module
    cannot run from that handoff alone. Resolution order:

        1. $HEWRS_ASSETS
        2. <bundle root>/02_assets      (the 27 August layout)
        3. <bundle root>/03_assets      (the 30 August layout - avatar and
                                         replicas only; will not satisfy the
                                         shirt or tie pipelines)

    If none exists the path is still set so that IMPORT succeeds, and the
    failure is raised with a usable message at first asset access instead of a
    bare FileNotFoundError three frames deep.
    """
    import os
    env = os.environ.get('HEWRS_ASSETS')
    if env:
        return env
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for cand in ('02_assets', '03_assets'):
        p = os.path.join(root, cand)
        if os.path.isdir(p):
            return p
    return os.path.join(root, '02_assets')


def _require_assets():
    import os
    # Checking the DIRECTORY is not enough: the 30 August bundle has an
    # 03_assets directory that holds only the avatar and replicas, so a
    # directory test passes and the failure still surfaces as a bare
    # FileNotFoundError. Test for a sentinel that only the real library has.
    if not os.path.isfile(os.path.join(_ASSETS, 'catalogue.json')):
        raise RuntimeError(
            'HEWRS asset library not found.\n'
            '  looked for: %s\n'
            '  This bundle does not carry the shirt/tie source photographs.\n'
            '  Set HEWRS_ASSETS to the 27 August bundle\'s 02_assets directory,\n'
            '  e.g.  export HEWRS_ASSETS=/path/to/HEWRS_HANDOFF_2026-08-27/handoff_v2/02_assets'
            % _ASSETS)

_ASSETS = _resolve_assets()
DIR = os.path.join(_ASSETS, 'addendum_photos') + os.sep
CANVAS = (2748, 996)

PHOTO = {
    'DS034': 'ad-001-000.jpg', 'DS035': 'ad-001-001.jpg', 'DS036': 'ad-001-002.jpg',
    'DS037': 'ad-002-003.jpg', 'DS038': 'ad-002-004.jpg', 'DS039': 'ad-002-005.jpg',
    'DS040': 'ad-002-006.jpg', 'DS041': 'ad-002-007.jpg', 'DS042': 'ad-003-008.jpg',
    'DS043': 'ad-003-009.jpg', 'DS044': 'ad-003-010.jpg', 'DS045': 'ad-003-011.jpg',
}

# hand-read from gridded crops, avoiding hangers, other garments and shadow
RECT = {
    'DS034': (40, 380, 250, 700),      # black satin, below the lapel fold
    'DS035': (280, 340, 430, 545),     # tightened: first crop caught the dark garment
    'DS037': (620, 60, 1000, 300),     # taupe brown, clear of the GG bag at left
    'DS038': (120, 120, 640, 380),     # espresso brown body
    'DS039': (60, 40, 620, 250),       # slate blue panel
    'DS040': (60, 30, 700, 300),       # GG monogram, clean run
    'DS041': (100, 55, 530, 285),      # tightened off the strap at the lower left
    'DS042': (80, 110, 520, 430),      # first crop was a plain tan panel, not the check
    'DS043': (60, 520, 540, 770),      # below the white label as well as the timestamp
    'DS045': (60, 120, 620, 700),      # bengal stripe body
}

# DS036, DS044 already have usable model photos in the main catalogue.
# DS044's addendum frame is mostly a different garment - deliberately excluded.
EXCLUDED = {'DS036', 'DS044'}

# Judgement, not measurement. 1.0 = the crop maps 1:1 into the garment width.
SCALE_HINT = {'DS040': 0.55, 'DS042': 0.75, 'DS043': 0.85, 'DS041': 0.65}

AVATAR_GARMENT_W = 800.0
FLATTEN_SIGMA = 22
_cache = {}


def _flatten(patch):
    lum = patch.mean(2)
    base = np.maximum(ndimage.gaussian_filter(lum, FLATTEN_SIGMA), 1e-3)
    return np.clip(patch * (lum.mean() / base)[..., None], 0, 255)


def patch(ds):
    _require_assets()
    if ds in _cache:
        return _cache[ds]
    if ds not in RECT or ds in EXCLUDED:
        _cache[ds] = None
        return None
    im = np.array(Image.open(DIR + PHOTO[ds]).convert('RGB')).astype(np.float32)
    x0, y0, x1, y1 = RECT[ds]
    h, w, _ = im.shape
    p = im[max(0, y0):min(h, y1), max(0, x0):min(w, x1)]
    _cache[ds] = _flatten(p) if p.size else None
    return _cache[ds]


def garment_cloth(ds):
    """Canvas-sized cloth field, wrapped horizontally and mirrored vertically."""
    p = patch(ds)
    if p is None:
        return None
    sc = SCALE_HINT.get(ds, 1.0) * AVATAR_GARMENT_W / p.shape[1]
    ph = max(2, int(p.shape[0] * sc)); pw = max(2, int(p.shape[1] * sc))
    p = np.array(Image.fromarray(p.astype(np.uint8)).resize((pw, ph), Image.LANCZOS)).astype(np.float32)
    # vertical mirror only: horizontal mirroring makes chevrons out of a diagonal
    p = np.concatenate([p, p[::-1]], axis=0)
    ph, pw, _ = p.shape
    ys, xs = np.mgrid[0:CANVAS[0], 0:CANVAS[1]]
    return p[ys % ph, xs % pw]
