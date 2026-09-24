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
DIR = os.path.join(_ASSETS, 'hires_photos') + os.sep


def _find(fn):
    """Resolve a bare IMG_xxxx name against the bundle.

    The table names files IMG_0729.jpeg; the bundle stores them as
    DS040__IMG_0729.jpg in hires_photos and as originals in real_photos. Searching
    both, on stem and any extension, keeps the table readable and the bundle
    self-contained - the hard-coded scratch path that used to be here resolved
    only on the machine that wrote it.
    """
    _require_assets()
    stem = os.path.splitext(os.path.basename(fn))[0]
    for sub in ('hires_photos', 'real_photos', 'addendum_photos'):
        d = os.path.join(_ASSETS, sub)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if stem in f:
                return os.path.join(d, f)
    return fn

# Rectangles re-read 2026-08-27 from the FULL-RESOLUTION originals (5712x4284,
# against the 2000x1500 the bundle carried). The garments are photographed lying
# sideways, so the image is rotated upright BEFORE the rectangle is read - that
# alone is why the old crops were 0.47-0.61 taller than wide when the canvas
# needs 3.44, and why the pattern had to be mirrored or blown up to fill.
ROTATED = {'DS042': ('IMG_0771.jpeg', 0), 'DS043': ('IMG_0770.jpeg', 0),
           'DS040': ('IMG_0772.jpeg', 0),
           # 2026-08-28 full-catalogue audit: these five were tiling drape folds
           # and props - DS037 had the Gucci bag mirrored across the chest,
           # DS041 a paper bag. Rectangles read WITH previews, props excluded.
           'DS035': ('IMG_0726.jpeg', 0), 'DS038': ('IMG_0725.jpeg', 0),
           'DS037': ('ad-002-003.jpg', 0), 'DS039': ('ad-002-005.jpg', 0),
           'DS041': ('ad-002-007.jpg', 0)}
# DS042/DS043 re-sourced 2026-08-27 to the FLAT-LAY photographs (IMG_0771,
# IMG_0770), shot square-on from above. No drape, so the pattern is orthogonal
# and unforeshortened - which is what defeated every earlier attempt.
# PROVISIONAL 2026-08-27 - these three are PARKED pending flat-lay photographs.
# The rotation is sound and removes the kaleidoscope, but every rectangle
# available comes from a garment on a hanger: the cloth curves inside the crop,
# which skews the pattern off-axis AND foreshortens it, so the measured px/mm
# reads low and the rendered pattern comes out oversized. Both faults have one
# cause. DS042's crop also misses the red stripe, so its repeat is incomplete at
# any scale. Do not re-cut from these photos - the ceiling is too low.
# NEEDED: each shirt laid flat on a table, shot square-on from directly above,
# whole front in frame. With the owner's 53 cm chest that gives exact scale and
# an orthogonal pattern with no drape to correct.
ROT_RECT = {
    # x0, y0, x1, y1 in the ROTATED frame - clear of collar, pocket and placket
    # A crop narrower than one repeat tiles the red stripe every 229 px and chops
    # the black bands into dashes - it renders as stripes, not a check. Take the
    # whole spread right front instead: several full repeats are then guaranteed
    # and no repeat boundary has to be found by hand.
    # DS042/DS043 rectangles are in EXIF-TRANSPOSED coordinates. All three flat
    # lays carry orientation tag 6 - the earlier claim that the Burberry files
    # had no flag was inferred from behaviour and was false. The old rects were
    # read on the raw frame and, once _rot_patch transposed globally, indexed a
    # rotated image: black bars and wood floor tiled across both shirts.
    'DS042': (1050, 3000, 2784, 4600),
    # DS040 from the flat lay IMG_0772. NOTE: that file carries an EXIF rotation
    # PIL does not apply by default - _rot_patch uses ImageOps.exif_transpose, or
    # the rectangle lands on the floor instead of the shirt.
    'DS040': (900, 2800, 2900, 4400),    # below the tape, above the hem, clear of hanger and floor
    'DS035': (350, 900, 1050, 1400),
    'DS038': (800, 950, 1150, 1200),     # below the two visible buttons
    # DS037/DS039 re-read 2026-08-28 with crop previews. REFIT_STILL_DIRTY already
    # flagged these as 'hanger' and 'tag' and the flags were right. DS037's old
    # rectangle sat across a fold ridge and the shadow beneath it. DS039's old
    # rectangle overhung the garment at both left corners onto the dark table, so
    # the backdrop tiled down the sleeves as pale diagonal streaks - read at page
    # size this was never fold shading, it was the DS028 background class.
    'DS037': (235, 210, 470, 325),
    'DS039': (300, 130, 540, 240),
    'DS041': (60, 35, 465, 185),
    # DS043 from the flat lay IMG_0770. Shifted right of the tape, above the hem.
    # Its check is genuinely DIAGONAL on the garment - that is the cloth, not a
    # skew artefact, and the catalogue description said so all along.
    'DS043': (1184, 2860, 3284, 4080),
}
# Scale measured, not judged: a placket button reads 21 px and a dress shirt
# button is 11 mm -> 1.91 px/mm. The avatar's 800 px garment stands for a
# ~570 mm chest -> 1.40 px/mm. SCALE_HINT = (1.40/1.91) / (800/crop_width).
# Owner tape measurement 2026-08-27: chest 53 cm, armpit to armpit laid flat.
# Photographed chest widths: DS042 1331 px, DS040 1323 px, DS043 1089 px, giving
# 2.51 / 2.50 / 2.05 px/mm. The avatar's 800 px garment stands for the same
# 53 cm, i.e. 1.51 px/mm. SCALE_HINT = (1.51/px_per_mm) / (800/crop_width).
# This is arithmetic from a real measurement - no judgement left in it.
# DS042 from the flat lay: placket (the tape in frame) to side seam is 2700 px
# at chest height = half of the owner-measured 53 cm chest, so 265 mm -> 10.19
# px/mm. Avatar 1.51 px/mm. SCALE_HINT = (1.51/10.19) / (800/1550).
ROT_SCALE = {'DS035': 1.0, 'DS038': 1.0, 'DS037': 1.0, 'DS039': 1.0, 'DS041': 0.45,
             'DS042': 0.321, 'DS040': 0.727, 'DS043': 0.506}
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
    im = np.array(Image.open(_find(PHOTO[ds])).convert('RGB')).astype(np.float32)
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


def _rot_patch(ds):
    from PIL import ImageOps
    fn, deg = ROTATED[ds]
    im = ImageOps.exif_transpose(Image.open(_find(fn))).convert('RGB')
    if deg:
        im = im.rotate(deg, expand=True)
    x0, y0, x1, y1 = ROT_RECT[ds]
    return np.array(im.crop((x0, y0, x1, y1))).astype(np.float32)


def garment_cloth(ds):
    # ROT_RECT before the ACCEPTED gate: the gate predates the flat-lay work and
    # silently refused DS037/DS039/DS041, dropping them to the addendum crops
    # with the Gucci bag and the paper bag in them.
    if ds not in ACCEPTED and ds not in ROT_RECT:
        return None
    if ds in ROT_RECT:
        p = _flatten(_rot_patch(ds)) if '_flatten' in globals() else _rot_patch(ds)
        sc = ROT_SCALE.get(ds, 1.0) * AVATAR_GARMENT_W / p.shape[1]
        ph, pw = max(2, int(p.shape[0]*sc)), max(2, int(p.shape[1]*sc))
        p = np.array(Image.fromarray(np.clip(p,0,255).astype(np.uint8)).resize((pw, ph), Image.LANCZOS)).astype(np.float32)
        # DO NOT enlarge to cover. The crop is scaled to a MEASURED size; blowing
        # it up to fill 2748 rows multiplied the pattern by 12.8 and discarded the
        # measurement - which is exactly the fault the owner saw as "big". The
        # rectangle holds whole repeats, so it tiles.
        ys, xs = np.mgrid[0:CANVAS[0], 0:CANVAS[1]]
        return p[ys % ph, xs % pw]
    p = patch(ds)
    if p is None:
        return None
    sc = SCALE_HINT.get(ds, 1.0) * AVATAR_GARMENT_W / p.shape[1]
    ph, pw = max(2, int(p.shape[0] * sc)), max(2, int(p.shape[1] * sc))
    p = np.array(Image.fromarray(p.astype(np.uint8)).resize((pw, ph), Image.LANCZOS)).astype(np.float32)

    # COVER, do not mirror. The vertical mirror was there to fill the canvas
    # height from a short crop, and on a directional print it folds the pattern
    # back on itself - the kaleidoscope bow-ties on DS040/DS042/DS043, and on
    # DS042 the garment's own label mirrored onto the chest. The tie pipeline hit
    # this and solved it by covering the height outright rather than repeating.
    # Same here: take the crop at its own scale and, if it is too short, enlarge
    # it isotropically until it covers. Pattern scale is preserved horizontally
    # by SCALE_HINT; the enlargement only ever costs resolution, never geometry.
    need_h = CANVAS[0]
    if ph < need_h:
        k = need_h / float(ph)
        pw2, ph2 = max(2, int(round(pw * k))), need_h
        p = np.array(Image.fromarray(p.astype(np.uint8)).resize((pw2, ph2), Image.LANCZOS)).astype(np.float32)
        ph, pw = ph2, pw2
    ys, xs = np.mgrid[0:CANVAS[0], 0:CANVAS[1]]
    return p[ys % ph, xs % pw]
