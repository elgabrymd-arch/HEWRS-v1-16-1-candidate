"""Render all 47 ties, knotted, on a white shirt on AVATAR V2."""
from PIL import Image
import numpy as np
import assemble_shirt, shirt_cloth as SC, collar3 as C, knot_r3 as KR, tie_source as TS
import blade_fix

CX = 498.0
# Seat the knot where the collar can actually receive it. The knot is widest
# (129 px) 16 rows below its own top; the collar aperture reaches 129 px at row
# 482. Seating it at the V vertex put its widest part where the aperture is
# 11-29 px, so the corners flared out above the collar as wings.
# 470 leaves the leaves lying ~9 px over each top corner, which is what a real
# collar does.
KNOT_WIDEST_OFFSET = 16
TOP = 470 - KNOT_WIDEST_OFFSET
KNOT_BOT = TOP + (KR.R3_BOT - KR.R3_TOP)


def base(shirt_desc='White solid'):
    """Shirt + collar, built once and reused for every tie."""
    out = assemble_shirt.build(shirt_desc).astype(np.float32)
    return out, SC.resolve(shirt_desc)[0]


def _over(out, rgb, a):
    al = (a / 255.)[..., None]
    out[..., :3] = rgb * al + out[..., :3] * (1 - al)
    out[..., 3] = np.clip(out[..., 3] + a * (1 - out[..., 3] / 255.), 0, 255)


def collar_layers(shirt_rgb):
    cloth = np.dstack([np.full((2748, 996), float(shirt_rgb[0])),
                       np.full((2748, 996), float(shirt_rgb[1])),
                       np.full((2748, 996), float(shirt_rgb[2]))])
    return [(cloth * C.shade(M, s)[..., None], M)
            for M, s in ((C.band(), 'R'), (C.leaf('L'), 'L'), (C.leaf('R'), 'R'))]


NECK_BAND_TOP = 406          # just below the collar band's lower arc (405)
NECK_BAND_W = 76

# The tie passes around the neck under the collar. A fixed-width strip pinched
# where the collar aperture is 11 px and left skin either side of it, so the
# band is drawn to the aperture itself, plus a margin that the leaves cover.
_LEAF = {}


def _aperture(y):
    # C.leaf() rasterises the entire 996x2748 canvas at 4x supersample on every
    # call. Called once per row this was ~0.9 s a row, 43.5 s per tie - the whole
    # reason the 47-sheet never finished. It is deterministic, so cache it.
    if not _LEAF:
        _LEAF['L'] = C.leaf('L')
        _LEAF['R'] = C.leaf('R')
    a = np.where(_LEAF['L'][y] > 128)[0]
    b = np.where(_LEAF['R'][y] > 128)[0]
    if len(a) == 0 or len(b) == 0:
        return None
    return int(a.max()) - 10, int(b.min()) + 10


TIP_Y = 1188                 # the waistband: torso luminance falls 103 -> 38 across
                             # rows 1180-1215, so 1188 is the top of the trouser
                             # line. A tie is tied so its point lands at the belt.


def blade_layer(tie, mode='scale'):
    """The visible blade, from under the knot to the belt.

    The tie asset is 1172 rows long but only KNOT_BOT..TIP_Y is ever seen - a
    real tie's surplus goes into the neck loop and the back blade, it does not
    hang past the belt.

    'crop'  take the tie's bottom rows at native scale. Pattern scale is exactly
            preserved; the blade emerges from the knot already near full width,
            which is what a real tie does.
    'scale' compress the whole blade to fit. Keeps the taper starting narrow but
            squashes the pattern vertically by ~34%.
    """
    need = TIP_Y - (KNOT_BOT - KR.HIDDEN_OVERLAP)
    ta = tie[..., 3]
    ys = np.where((ta >= 128).any(1))[0]
    top, bot = int(ys.min()), int(ys.max())
    out = np.zeros_like(tie)
    y0 = KNOT_BOT - KR.HIDDEN_OVERLAP
    if mode == 'crop':
        src0 = max(top, bot - need + 1)
        seg = tie[src0:bot + 1]
    else:
        seg = np.array(Image.fromarray(tie[top:bot + 1].astype(np.uint8), 'RGBA')
                       .resize((996, need), Image.LANCZOS)).astype(np.float32)
    n = min(seg.shape[0], 2748 - y0)
    out[y0:y0 + n] = seg[:n]
    return out[..., :3], out[..., 3]


def render(tid, shirt_base, shirt_rgb, collar):
    out = shirt_base.copy()
    tie, src = TS.load(tid)
    # The tie passes around the neck under the collar. Without it, bare skin
    # shows in the collar V above the knot's flat top edge.
    band = np.zeros_like(tie)
    for i in range(TOP - NECK_BAND_TOP):
        y = NECK_BAND_TOP + i
        ap = _aperture(y)
        if ap is None: continue
        x0, x1 = ap
        # never wider than a tie, and never outside the aperture: the first
        # version filled the collar band's hollow ring with tie cloth
        w = min(x1 - x0, NECK_BAND_W)
        if w < 4: continue
        mid = (x0 + x1) // 2
        x0 = mid - w // 2; x1 = x0 + w
        sy = 600 + i
        c = np.where(tie[sy, :, 3] >= 250)[0]
        if len(c) < 8: continue
        f = np.linspace(0, 1, w)
        src = (c.min() + f * (c.max() - c.min())).astype(int)
        band[y, x0:x1, :3] = tie[sy, src, :3]
        band[y, x0:x1, 3] = 255
    _over(out, band[..., :3], band[..., 3] * 0.90)
    brgb, ba = blade_layer(tie)
    krgb, ka = KR.build(KR.flat_cloth_from_tie(tie), CX, TOP)
    # The R3 asset is a knot FACE cropped without its wrap band, so it tapers to
    # 56 px where the blade arrives 73 px wide - the blade's shoulders stood
    # 8.5 px proud per side and read as a step. Hold the blade inside the knot
    # through the overlap and ease it out below. Owner-approved 2026-08-27.
    brgb, ba = blade_fix.taper(brgb, ba, ka, KNOT_BOT - KR.HIDDEN_OVERLAP, cx=CX)
    _over(out, brgb, ba)
    _over(out, krgb, ka)
    for rgb, M in collar:
        _over(out, rgb, M)
    return np.clip(out, 0, 255).astype(np.uint8), src
