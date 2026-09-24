"""R3 photographic knot layer, re-registered and cloth-substitutable.

The R3 asset is a photograph of a navy twill knot. Its geometry is what we want;
its cloth is not, because the knot must match whichever of the 47 ties is worn.
So the photograph's own SHADING is recovered and reused, and each tie's flat
cloth is multiplied through it. That is the same pipeline knot6 already used,
except the shading now comes from a real knot instead of a synthetic height
field - which is strictly better, because real cloth folds are not analytic.

REGISTRATION (measured, not assumed)
    R3 publishes anchor center_x 576; measured centreline 576.3, sd 0.28. Good.
    But AVATAR V2's centreline is 498, so the layer needs -78 px in x.
    R3 sits at rows 675-770. The avatar's neck base is 405 and the collar V
    closes just below it, so the knot belongs directly under the collar, not on
    the mid-chest. Vertical placement is therefore driven by the collar, not by
    the R3 rows.

GEOMETRY IS FROZEN once approved: fabric/colour/pattern change, shape does not.
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
SRC = os.path.join(_ASSETS, 'FORMAL_TIE_KNOT_R3_LAYER_996x2748.png')
CANVAS = (2748, 996)

R3_CX = 576.0
R3_TOP, R3_BOT = 675, 770
HIDDEN_OVERLAP = 12          # per the R3 metadata: the blade tucks behind the knot


def _load():
    _require_assets()
    a = np.array(Image.open(SRC).convert('RGBA')).astype(np.float32)
    return a[..., :3], a[..., 3]


FORM_SIGMA = 6.0             # separates fold FORM from weave TEXTURE
FORM_CLIP = (0.62, 1.30)     # tighter: the wider clip left the photograph's own
                             # specular as an identical bright streak on all 47 ties


_FIELD = {}


def shading_field(form_only=True):
    """Recover the knot's lighting from the photograph.

    Raw luminance runs 0.130 to 2.585 and contains three things: the fold form,
    the navy twill's own diagonal weave, and sensor noise. Reusing all of it put
    navy twill's weave on every tie and threw dark speckle into the bright ones.

    Only the FORM belongs to the knot. The weave belongs to whichever tie is
    worn. So the field is low-passed to keep the folds and drop the texture, and
    clipped to kill the specular and shadow outliers.
    """
    if form_only in _FIELD:          # deterministic; it was being recomputed per tie
        return _FIELD[form_only]
    rgb, al = _load()
    lum = rgb.mean(2)
    m = al >= 128
    if m.sum() == 0:
        return None, None
    S = np.zeros(CANVAS, np.float32)
    S[m] = lum[m] / lum[m].mean()
    if form_only:
        # blur inside the mask only, so the silhouette does not bleed inward
        w = ndimage.gaussian_filter(S * m, FORM_SIGMA)
        n = ndimage.gaussian_filter(m.astype(np.float32), FORM_SIGMA)
        S = np.where(n > 1e-3, w / np.maximum(n, 1e-3), 0).astype(np.float32)
        S = np.clip(S, *FORM_CLIP)
        S[~m] = 0
    _FIELD[form_only] = (S, al)
    return S, al


def build(tie_cloth_rgb, cx, top_y):
    """Place the knot at (cx, top_y) in this shirt's registration, wearing
    `tie_cloth_rgb` - a flat (H,W,3) cloth field from tie_source."""
    S, al = shading_field()
    dx = int(round(cx - R3_CX))
    dy = int(round(top_y - R3_TOP))
    Ss = np.zeros_like(S); As = np.zeros_like(al)
    ys = slice(max(0, dy), CANVAS[0] + min(0, dy))
    yd = slice(max(0, -dy), CANVAS[0] - max(0, dy))
    xs = slice(max(0, dx), CANVAS[1] + min(0, dx))
    xd = slice(max(0, -dx), CANVAS[1] - max(0, dx))
    Ss[ys, xs] = S[yd, xd]; As[ys, xs] = al[yd, xd]
    rgb = np.clip(tie_cloth_rgb * Ss[..., None], 0, 255)
    return rgb, As


KNOT_W = 130                 # the R3 knot is 129 px at its widest


def flat_cloth_from_tie(tie_rgba, band=(1150, 1340)):
    """The tie's OWN cloth, wide enough to cover the knot without tiling.

    A 60 px patch tiled horizontally put a hard vertical seam down the stripe
    ties, which is the same mirror/wrap failure as HANDOFF sec 5. The blade is
    135-153 px wide over rows 1150-1340, so a 130 px window covers the knot's
    129 px outright and no horizontal repeat is needed at all.
    """
    rgb, al = tie_rgba[..., :3], tie_rgba[..., 3]
    rows = []
    for y in range(*band):
        c = np.where(al[y] >= 250)[0]
        if len(c) >= KNOT_W:
            mid = (c.min() + c.max()) // 2
            rows.append(rgb[y, mid - KNOT_W // 2: mid + KNOT_W // 2])
    if not rows:
        return np.broadcast_to(np.float32([128, 128, 128]), CANVAS + (3,)).copy()
    patch = np.array(rows, np.float32)
    # 3x3 median: the repaired ties carry isolated dark pixels that the shading
    # multiplier turns into visible speckle
    patch = ndimage.median_filter(patch, size=(3, 3, 1))
    ph, pw, _ = patch.shape
    ys, xs = np.mgrid[0:CANVAS[0], 0:CANVAS[1]]
    return patch[ys % ph, xs % pw]
