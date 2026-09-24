"""Knot v6 — proportions re-derived from the owner reference photograph.

WHY THE GEOMETRY MOVED
  knot4's docstring and HANDOFF sec 7 both state the rhombus is wider than tall,
  ~1.2:1, shoulders at ~45%. knot4's constants deliver 0.99:1 with shoulders at
  59%. The constants, not the intent, were wrong.

  Landmarks read off the gridded photograph:
      apex (525, 245) · left shoulder (165, 525) · right shoulder (835, 490)
      wrap roll y=795, w=260 · blade below the roll w=260
  giving W_MAX 670, height 550:
      aspect        1.22 : 1        (stated ~1.2:1)
      shoulder at   48% of height   (stated ~45%)
      knot / blade  2.58
      base / W_MAX  0.388

  Transferred to the frozen registration (APEX_Y 390, BASE_Y 540, height 150),
  W_MAX derives TWICE, independently, to the same number:
      from the aspect ratio        150 * 670/550 = 183
      from the knot/blade ratio     71 * 670/260 = 183
  Two unrelated measurements agreeing to the pixel is why this is being changed.

  W_BASE derives to 71 (roll flush with the blade). Kept at knot4's 76 so the
  wrap roll sits 2.5 px proud of the blade on each side, which is what a roll
  crossing in front of the blade does. 5 px is inside the photograph's own
  measurement noise.

CHANGED FROM knot4 -> knot5 -> knot6
  knot5  KCX 492 -> 494          registration, blade centreline
  knot5  bulge exponent 0.75 -> 1.0, gradient clamp, ambient raised
  knot5  cloth from the ratified clean ties, their shading divided back out
  knot6  W_MAX 148 -> 183, SHOULDER_Y 478 -> 462   (photograph)
  knot6  crease strength peaks in the lower middle and fades toward the apex.
         knot5 had it strongest at the apex, which is backwards: in the
         photograph the arcs fan out of the base roll and die before the top.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

CANVAS = (2748, 996)

# --- registration: frozen ---
KCX = 494.0
APEX_Y, BASE_Y = 390, 540
ROLL_Y0, ROLL_Y1 = 540, 560

# --- proportions: from the reference photograph ---
SHOULDER_Y = 462
W_APEX, W_MAX, W_BASE = 58.0, 183.0, 76.0

LIGHT = np.array([-0.40, -0.50, 0.77]); LIGHT /= np.linalg.norm(LIGHT)
GRAD_CLAMP = 1.35

CLEAN_BAND = (1200, 1340)   # widest clean blade rows: 139 -> 153 px
NATIVE_HALF = 66                    # fixed half-window, valid for every row of CLEAN_BAND
PATCH_W = 133                       # = the native window. NOT enlarged.
# Why native: the blade in v5 sits at ~0.85x native horizontally (compose scales
# the tie by 0.59 then stretches each row into the frozen mask). Scaling the knot
# cloth up to 256 put it at ~2.2x, so the pattern was ~2.6x bigger on the knot
# than on the blade - obvious on the dot ties. At native the mismatch is ~18%.
# The knot's outer flanks run past +-66 only where the collar leaves cover them,
# so the clamp in cloth() costs nothing visible.


# ----------------------------------------------------------------- geometry
def widths():
    W = np.zeros(CANVAS[0])
    for y in range(APEX_Y, SHOULDER_Y + 1):
        f = (y - APEX_Y) / float(SHOULDER_Y - APEX_Y)
        W[y] = W_APEX + (W_MAX - W_APEX) * f
    for y in range(SHOULDER_Y + 1, BASE_Y + 1):
        f = (y - SHOULDER_Y) / float(BASE_Y - SHOULDER_Y)
        W[y] = W_MAX + (W_BASE - W_MAX) * f
    for y in range(BASE_Y + 1, ROLL_Y1 + 1):
        W[y] = W_BASE * (1.0 + 0.05 * np.sin(np.pi * (y - BASE_Y) / float(ROLL_Y1 - BASE_Y)))
    return W


def alpha(W):
    A = np.zeros(CANVAS, np.float32); xs = np.arange(CANVAS[1])
    for y in range(APEX_Y, ROLL_Y1 + 1):
        if W[y] <= 0: continue
        l, r = KCX - W[y] / 2., KCX + W[y] / 2.
        A[y] = np.clip(np.minimum(xs + 1, r) - np.maximum(xs, l), 0, 1) * 255
    return A


def height_field(W, y_from=None):
    y_from = APEX_Y if y_from is None else y_from
    h = np.zeros(CANVAS, np.float32)
    xs = np.arange(CANVAS[1]).astype(np.float32)
    ccy = BASE_Y + 70.0
    for y in range(y_from, ROLL_Y1 + 1):
        w = W[y]
        if w <= 2: continue
        u = (xs - KCX) / (w / 2.0); inside = np.abs(u) <= 1.0
        t = (y - APEX_Y) / float(ROLL_Y1 - APEX_Y)
        # exponent 1.0: a parabolic section has finite slope at the silhouette.
        # Below 1.0 the normal goes horizontal at |u|=1 and Lambert clips to zero
        # on the shaded flank, which is the knot4 shoulder crush.
        bulge = np.clip(1.0 - u ** 2, 0, 1) * (0.50 + 0.50 * np.exp(-((t - 0.42) / 0.46) ** 2))
        d = np.sqrt(((xs - KCX) * 0.62) ** 2 + (ccy - y) ** 2)
        # arcs fan out of the base roll and die before the apex
        arc_env = np.exp(-((t - 0.62) / 0.30) ** 2)
        arcs = 0.26 * np.cos(d / 9.5) * arc_env
        roll = 0.0
        if ROLL_Y0 <= y <= ROLL_Y1:
            rt = (y - ROLL_Y0) / float(ROLL_Y1 - ROLL_Y0)
            roll = 0.42 * np.sqrt(np.clip(1.0 - (2 * rt - 1) ** 2, 0, 1))
            arcs *= 0.25
        gather = 0.18 * np.exp(-(u / 0.20) ** 2) * np.exp(-((t - 0.88) / 0.10) ** 2)
        h[y] = np.where(inside, bulge + arcs + roll + gather, 0.0)
    return h * 26.0


def shade(h, A):
    gy, gx = np.gradient(h)
    gx = np.clip(gx, -GRAD_CLAMP, GRAD_CLAMP)
    gy = np.clip(gy, -GRAD_CLAMP, GRAD_CLAMP)
    n = np.dstack([-gx, -gy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True) + 1e-9
    lam = np.clip((n * LIGHT).sum(axis=2), 0, 1)
    spec = np.clip((n * LIGHT).sum(axis=2), 0, 1) ** 22
    d = ndimage.distance_transform_edt(A > 0)
    ao = np.clip(d / 14.0, 0, 1) * 0.16 + 0.84
    ys = np.arange(CANVAS[0])[:, None].astype(np.float32)
    collar_sh = 1.0 - 0.20 * np.exp(-((ys - (APEX_Y + 6)) / 9.0) ** 2)
    roll_sh = 1.0 - 0.26 * np.exp(-((ys - (ROLL_Y0 - 1)) / 4.0) ** 2)
    return np.clip((0.62 + 0.46 * lam) * ao * collar_sh * roll_sh + 0.24 * spec, 0, 1.9)


# ----------------------------------------------------------------- cloth
def clean_flat_patch(clean_path, arr=None):
    """Flat cloth recovered from a ratified clean tie. build_ties_clean bakes
    shading(n) = 0.80 + 0.26*gauss across each row and a vignette below row 1000;
    both are exactly invertible and are divided back out so the knot's own
    shading is not applied on top of the blade's."""
    a = arr if arr is not None else np.array(Image.open(clean_path).convert('RGBA')).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    y0, y1 = CLEAN_BAND
    rows = []
    for y in range(y0, y1 + 1):
        seg = np.where(al[y] > 250)[0]
        if len(seg) < 40: continue
        n = len(seg)
        u = np.linspace(0, 1, n)
        sh = 0.80 + 0.26 * np.exp(-((u - 0.42) ** 2) / (2 * 0.29 ** 2))
        vg = 1.0 - 0.06 * max(0., (y - 1000) / 510.)
        flat = rgb[y, seg] / (sh[:, None] * vg)
        # FIXED column window, identical on every row. Taking each row's own full
        # width makes the window width vary row to row, which walks any seam
        # across the knot face instead of holding it still.
        c = n // 2
        if c - NATIVE_HALF < 0 or c + NATIVE_HALF + 1 > n: continue
        rows.append(flat[c - NATIVE_HALF:c + NATIVE_HALF + 1])
    band = np.clip(np.array(rows, np.float32), 0, 255)
    # No mirror, no wrap, no rescale. Mirroring a diagonal turns it into a
    # chevron at the seam (HANDOFF sec 5) and on a knot that seam lands on the
    # face; rescaling breaks pattern continuity with the blade.
    return band


EDGE_COMPRESS = 0.15   # extra cloth per pixel where the surface turns away.
                       # 0.35 pushed the required patch past what the blade can
                       # supply at native scale without tiling.


def cloth(patch, W, h, y_from=None):
    """Cloth mapped in ABSOLUTE x with a smooth edge foreshortening.

    knot4 used a per-row cumsum of sqrt(1+gx^2). That is arc length, which is
    correct physics, but it is normalised to each row's own width: between rows
    390 and 462 the width grows 1.74 px/row, so the same thread lands at a
    different column on every row and the pattern shears into vertical streaks
    down both flanks. Attribution: rendering cloth with shading disabled shows
    the streaks; rendering shading with flat cloth does not.

    Absolute-x mapping keeps a thread on the same column regardless of how the
    silhouette changes, and the u^2 term still compresses the cloth where the
    surface turns away, which is the part of arc length that was actually wanted.
    """
    y_from = APEX_Y if y_from is None else y_from
    p = patch.astype(np.float32); ph, pw, _ = p.shape
    out = np.zeros(CANVAS + (3,), np.float32)
    for y in range(y_from, ROLL_Y1 + 1):
        w = W[y]
        if w <= 2: continue
        x0 = int(np.floor(KCX - w / 2.)); x1 = int(np.ceil(KCX + w / 2.))
        xs = np.arange(x0, x1 + 1)
        u = np.clip((xs - KCX) / (w / 2.0), -1, 1)
        col = (xs - KCX) * (1.0 + EDGE_COMPRESS * u ** 2)
        ci = np.clip((col + pw * 0.5).astype(int), 0, pw - 1)
        out[y, xs] = p[int((y - APEX_Y) * 0.9) % ph, ci]
    return out


def build(clean_path):
    W = widths(); A = alpha(W); H = height_field(W); S = shade(H, A)
    patch = clean_flat_patch(clean_path)
    rgb = np.clip(cloth(patch, W, H) * S[..., None], 0, 255)
    return rgb, A
