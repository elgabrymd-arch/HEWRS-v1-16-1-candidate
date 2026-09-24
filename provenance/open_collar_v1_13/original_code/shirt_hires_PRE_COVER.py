"""Cloth for DS034-DS045 from the high-resolution folded-garment photographs.

These supersede the addendum crops in shirt_addendum.py. Those came from small
images embedded in a PDF (some as narrow as 202 px tall) and produced the worst
output in the build: DS040's monogram and DS041's buckle print went
kaleidoscopic. These are 4032x3024 to 5712x4284 with the cloth filling the frame.

Two IDs were owner-confirmed rather than guessed:
    IMG_0726 -> DS035  (Ermenegildo Zegna embroidery legible on the placket)
    IMG_0730 -> DS044  (Emanuel Berg micro-diamond)

RECT is hand-read off gridded crops, choosing a flat run of cloth clear of
hangers, tags, collars and neighbouring garments. Four automatic detectors failed
on the equivalent problem for tie brand tags; the hand-read table in tags.py is
what worked (HANDOFF sec 4).

STILL NOT SOLVED: pattern scale. A folded garment has no known width, so
SCALE_HINT is a judgement. It matters for DS040, DS042 and DS043 and is
meaningless for the solids.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

# SUPERSEDED COPY - kept for the audit trail, not live. Path neutralised
# 2026-08-30 so no module in this bundle carries a machine-specific path.
import os as _os
DIR = _os.path.join(_os.environ.get('HEWRS_ASSETS',
      _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), '02_assets')),
      'hires_photos') + _os.sep
CANVAS = (2748, 996)

PHOTO = {
    'DS041': 'IMG_0721.jpeg', 'DS045': 'IMG_0722.jpeg', 'DS039': 'IMG_0723.jpeg',
    'DS037': 'IMG_0724.jpeg', 'DS038': 'IMG_0725.jpeg', 'DS035': 'IMG_0726.jpeg',
    'DS036': 'IMG_0727.jpeg', 'DS034': 'IMG_0728.jpeg', 'DS040': 'IMG_0729.jpeg',
    'DS044': 'IMG_0730.jpeg', 'DS043': 'IMG_0731.jpeg', 'DS042': 'IMG_0732.jpeg',
}

RECT = {
    'DS041': (200, 1800, 1900, 3100),    # refit: dropped the dark band along the bottom
    'DS045': (300, 1400, 2400, 3000),    # refit: below the collar edge
    'DS039': (300, 1100, 2400, 2000),    # refit: below the cuff and button
    'DS037': (700, 300, 2700, 1400),     # refit: above the LOEWE tag and the buttons
    'DS038': (2200, 600, 4400, 1900),    # refit: right of the hanger rod and the tag
    'DS035': (2200, 1900, 4600, 3600),   # ivory, below and right of the embroidery
    'DS036': (300, 600, 3200, 2400),     # refit: clear of the collar and cuff edges
    'DS034': (150, 600, 1900, 2000),     # refit: away from the bright patch top right
    'DS040': (1200, 2600, 4400, 4100),   # GG monogram, below the GUCCI tag
    'DS044': (200, 200, 3000, 1900),     # micro-diamond, upper left
    'DS043': (900, 300, 4200, 2200),     # cream/black/navy check
    'DS042': (300, 300, 3600, 2300),     # tan/black/red check
}

# Judgement, not measurement. 1.0 maps the crop 1:1 into the garment width.
SCALE_HINT = {'DS040': 0.42, 'DS042': 0.60, 'DS043': 0.60, 'DS041': 0.50,
              'DS044': 0.45, 'DS045': 0.55}

# Only these are used. The rest still show a hanger, a tag or a garment edge
# after one refit pass, and a small artefact in the crop becomes a repeating one
# once the cloth is tiled. They stay on their existing source rather than get a
# third round of rectangle-nudging.
ACCEPTED = {'DS034', 'DS035', 'DS038', 'DS040', 'DS042', 'DS043', 'DS044'}
REFIT_STILL_DIRTY = {'DS036': 'collar/cuff edge', 'DS037': 'hanger',
                     'DS039': 'tag', 'DS041': 'edge band', 'DS045': 'dark bar'}

AVATAR_GARMENT_W = 800.0
FLATTEN_SIGMA = 90          # these frames have deep fold shadows
_cache = {}


def _flatten(patch):
    lum = patch.mean(2)
    base = np.maximum(ndimage.gaussian_filter(lum, FLATTEN_SIGMA), 1e-3)
    return np.clip(patch * (lum.mean() / base)[..., None], 0, 255)


def patch(ds):
    if ds in _cache:
        return _cache[ds]
    if ds not in RECT:
        _cache[ds] = None
        return None
    im = np.array(Image.open(DIR + PHOTO[ds]).convert('RGB')).astype(np.float32)
    h, w, _ = im.shape
    x0, y0, x1, y1 = RECT[ds]
    p = im[max(0, y0):min(h, y1), max(0, x0):min(w, x1)]
    if p.size == 0:
        _cache[ds] = None
        return None
    # downsample first: these are up to 5712 px wide and the garment needs 800
    sc = 900.0 / p.shape[1]
    if sc < 1:
        p = np.array(Image.fromarray(p.astype(np.uint8)).resize(
            (900, max(2, int(p.shape[0] * sc))), Image.LANCZOS)).astype(np.float32)
    _cache[ds] = _flatten(p)
    return _cache[ds]


def garment_cloth(ds):
    if ds not in ACCEPTED:
        return None
    p = patch(ds)
    if p is None:
        return None
    sc = SCALE_HINT.get(ds, 1.0) * AVATAR_GARMENT_W / p.shape[1]
    ph, pw = max(2, int(p.shape[0] * sc)), max(2, int(p.shape[1] * sc))
    p = np.array(Image.fromarray(p.astype(np.uint8)).resize((pw, ph), Image.LANCZOS)).astype(np.float32)
    # vertical mirror only; a horizontal mirror turns a diagonal into a chevron
    p = np.concatenate([p, p[::-1]], axis=0)
    ph, pw, _ = p.shape
    ys, xs = np.mgrid[0:CANVAS[0], 0:CANVAS[1]]
    return p[ys % ph, xs % pw]
