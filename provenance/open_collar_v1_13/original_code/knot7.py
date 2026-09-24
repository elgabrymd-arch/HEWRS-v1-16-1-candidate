"""Knot v7 — inverted triangle. Widest at the top edge, straight edges converging
to a base that is a fixed fraction of the top width.

Everything except widths() is inherited from knot6 unchanged: registration,
height field, shading, cloth mapping, clean-tie cloth source.
"""
import numpy as np
from PIL import Image
import knot6 as K6

# Registration onto AVATAR V2 - same +83/+4 as collar3. The knot and collar must
# move together: HANDOFF sec 8 is explicit that collar spread is set by the knot
# it is tied around, and building them separately is what caused the 150 px
# collision. A translation moves them together by construction.
DY, DX = 83, 4

CANVAS = K6.CANVAS
KCX = K6.KCX + DX
APEX_Y, BASE_Y = K6.APEX_Y + DY, K6.BASE_Y + DY
# The wrap roll is NOT the taper base. A 20% base is 37 px; the blade underneath
# is 72 px and starts with a square horizontal edge at row 561, so 18 px of blade
# corner stuck out on each side of the roll. On a real tie the wrapped band
# crosses IN FRONT of the blade and is wider than it, which hides that edge.
# The roll therefore flares past the taper base to just over the blade width.
ROLL_Y0, ROLL_Y1 = 540 + DY, 570 + DY
ROLL_W_MAX = 80.0      # blade is 72 at row 561, 74 at 570
ROLL_W_END = 77.0
K6.ROLL_Y0, K6.ROLL_Y1 = ROLL_Y0, ROLL_Y1
K6.KCX, K6.APEX_Y, K6.BASE_Y = KCX, APEX_Y, BASE_Y   # height_field/cloth loop to K6.ROLL_Y1

W_TOP = 183.0
BASE_FRACTION = 0.20
TOP_EXTEND_Y = 320 + DY      # the knot continues up behind the collar to the V vertex.
                        # Stopping at APEX_Y left a bare wedge under the collar V,
                        # because the tie only exists from row 375 in v5.


def widths(w_top=None, frac=None):
    w_top = W_TOP if w_top is None else w_top
    frac = BASE_FRACTION if frac is None else frac
    w_base = w_top * frac
    W = np.zeros(CANVAS[0])
    for y in range(TOP_EXTEND_Y, APEX_Y):        # hidden behind the collar
        W[y] = w_top
    for y in range(APEX_Y, BASE_Y + 1):                 # single straight taper
        f = (y - APEX_Y) / float(BASE_Y - APEX_Y)
        W[y] = w_top + (w_base - w_top) * f
    flare_end = BASE_Y + 16
    for y in range(BASE_Y + 1, flare_end + 1):          # flare out of the taper
        f = (y - BASE_Y) / float(flare_end - BASE_Y)
        e = f * f * (3 - 2 * f)                         # smoothstep, no corner at either end
        W[y] = w_base + (ROLL_W_MAX - w_base) * e
    for y in range(flare_end + 1, ROLL_Y1 + 1):         # roll face, easing to the blade
        f = (y - flare_end) / float(ROLL_Y1 - flare_end)
        W[y] = ROLL_W_MAX + (ROLL_W_END - ROLL_W_MAX) * f
    return W


def _alpha(W):
    A = np.zeros(CANVAS, np.float32); xs = np.arange(CANVAS[1])
    for y in range(TOP_EXTEND_Y, ROLL_Y1 + 1):
        if W[y] <= 0: continue
        l, r = KCX - W[y] / 2., KCX + W[y] / 2.
        A[y] = np.clip(np.minimum(xs + 1, r) - np.maximum(xs, l), 0, 1) * 255
    return A


def build(clean_path, w_top=None, frac=None, arr=None):
    W = widths(w_top, frac)
    A = _alpha(W)
    H = K6.height_field(W, TOP_EXTEND_Y)
    S = K6.shade(H, A)
    patch = K6.clean_flat_patch(clean_path, arr)
    rgb = np.clip(K6.cloth(patch, W, H, TOP_EXTEND_Y) * S[..., None], 0, 255)
    return rgb, A
