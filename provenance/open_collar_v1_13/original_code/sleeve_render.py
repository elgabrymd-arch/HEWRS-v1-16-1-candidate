"""Sleeve appearance: cloth colour, shading, cuff seam and button.

Geometry lives in sleeve.py. Nothing here touches the canonical arm assets.

The light is not invented. Measured off both arm assets: luminance across the
limb peaks at u = 0.536 (left) and u = 0.486 (right), i.e. the source is
essentially frontal with a slight left bias, and skin runs ~40 at the shaded
edge to ~155 at the highlight. Cotton is far less specular than skin, so the
same light is applied at a much gentler range.
"""
import numpy as np
from scipy import ndimage

CANVAS = (2748, 996)

HIGHLIGHT_U = 0.51        # measured mean of 0.536 / 0.486
AMBIENT = 0.80
GAIN = 0.26
EDGE_FALLOFF = 10.0       # px; how fast the cloth turns away at the silhouette
EDGE_DEPTH = 0.13

CUFF_SEAM_DEPTH = 0.16    # shadow where the sleeve gathers into the cuff
BUTTON_R = 9.0

# --- drape ---
# The gather is driven by the measured surplus: the sleeve arrives at the cuff
# seam 36-37 px wider than the band it enters (1.33x fullness). That cloth is
# pleated, so it reads as vertical folds concentrated just above the seam.
GATHER_ROWS = 150         # how far the pleating carries up from the seam
GATHER_FOLDS = 5
GATHER_DEPTH = 0.10
DRAPE_DEPTH = 0.055       # soft diagonal drape across the forearm
INNER_BREAK = 0.07        # cloth collapsing along the inner edge
ARMHOLE_FEATHER = 7       # was 16. A long ramp plus a union edge field erased the
                          # armhole completely: sleeve and torso became one
                          # continuous surface and the arm stopped reading as a
                          # tube. A short ramp still avoids the hard butt joint.
ARMHOLE_SEAM = 0.13       # was 0.055 - too faint to read once the feather and the
                          # union edge field had smoothed everything else out
ARM_CAST = 0.16           # the arm shades the ribcage beside it; without this the
                          # sleeve has no separation from the torso at all
ARM_CAST_WIDTH = 26.0

# --- torso drape ---
# Measured: the shirt runs 36-44 px wider than the torso all the way down
# (1.06-1.08x). That surplus is small and even, so the torso does NOT gather the
# way the cuff does - it falls in a few long vertical folds instead.
TORSO_FOLDS = 4
TORSO_FOLD_DEPTH = 0.045
PLACKET_SHADOW = 0.07


def _u_across(A):
    """Per-pixel position across the sleeve, 0 at one edge, 1 at the other."""
    U = np.zeros(CANVAS, np.float32)
    rows = np.where((A > 8).any(1))[0]
    for y in rows:
        c = np.where(A[y] > 8)[0]
        if len(c) < 3: continue
        L, R = c.min(), c.max()
        if R == L: continue
        U[y, L:R + 1] = np.linspace(0, 1, R - L + 1)
    return U


def edge_field(union_alpha):
    """Silhouette darkening computed ONCE on the whole garment.

    Computing it per piece put an edge shadow on the armhole from the sleeve AND
    from the torso, which doubled into a hard black line. Cloth only turns away
    at the garment's outer silhouette; an internal seam is not an edge.
    """
    d = ndimage.distance_transform_edt(union_alpha > 8)
    return 1.0 - EDGE_DEPTH * np.exp(-(d / EDGE_FALLOFF) ** 2)


def shade(A, seam_row=None, drape=True, inner_side=None, edge=None):
    U = _u_across(A)
    barrel = AMBIENT + GAIN * np.exp(-((U - HIGHLIGHT_U) ** 2) / (2 * 0.30 ** 2))
    if edge is None:
        d = ndimage.distance_transform_edt(A > 8)
        edge = 1.0 - EDGE_DEPTH * np.exp(-(d / EDGE_FALLOFF) ** 2)
    S = barrel * edge
    if drape:
        ys = np.arange(CANVAS[0])[:, None].astype(np.float32)
        body = A > 8
        if seam_row is not None:
            # vertical pleats, strongest at the seam, fading upward
            env = np.clip(1.0 - (seam_row - ys) / float(GATHER_ROWS), 0, 1)
            env = np.where(ys <= seam_row, env, 0.0) ** 1.6
            pleat = 1.0 - GATHER_DEPTH * env * (0.5 - 0.5 * np.cos(2 * np.pi * GATHER_FOLDS * U))
            S = S * np.where(body, pleat, 1.0)
        # one soft diagonal drape fold across the forearm
        band = np.exp(-((U - 0.62 - 0.00035 * (ys - 1150)) / 0.16) ** 2)
        S = S * np.where(body, 1.0 - DRAPE_DEPTH * band, 1.0)
        if inner_side is not None:
            iu = U if inner_side == 'hi' else (1.0 - U)
            S = S * np.where(body, 1.0 - INNER_BREAK * np.clip(iu - 0.80, 0, 1) / 0.20, 1.0)
    if seam_row is not None:
        ys = np.arange(CANVAS[0])[:, None].astype(np.float32)
        S = S * (1.0 - CUFF_SEAM_DEPTH * np.exp(-((ys - seam_row) / 5.0) ** 2))
    S[A <= 8] = 0
    return S


def button(A, cx, cy, shirt_rgb):
    """Cuff button. Returns (rgb, alpha) to composite over the cuff."""
    ys, xs = np.mgrid[0:CANVAS[0], 0:CANVAS[1]].astype(np.float32)
    r = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    a = np.clip(BUTTON_R + 0.5 - r, 0, 1) * 255
    a[A <= 8] = 0                                    # never outside the cuff
    dome = np.clip(1.0 - (r / BUTTON_R) ** 2, 0, 1) ** 0.5
    lit = 0.90 + 0.22 * dome - 0.16 * np.clip((ys - cy) / BUTTON_R, -1, 1)
    rgb = np.array(shirt_rgb, np.float32)[None, None, :] * lit[..., None]
    return np.clip(rgb, 0, 255), a


def paint(A, shirt_rgb, seam_row=None, **kw):
    S = shade(A, seam_row, **kw)
    rgb = np.array(shirt_rgb, np.float32)[None, None, :] * S[..., None]
    return np.clip(rgb, 0, 255), A


def feather_inner(A, side, feather=ARMHOLE_FEATHER):
    """Ramp the sleeve's alpha down along its inner (armhole) edge.

    The sleeve sits over the torso there, so a hard alpha cut shows as a step in
    tone even once the edge shadow is gone. A short ramp lets the two barrels
    cross-fade, and the seam is then drawn deliberately.
    """
    out = A.copy()
    for y in range(A.shape[0]):
        c = np.where(A[y] > 8)[0]
        if len(c) < 4: continue
        # never feather more than a third of the local width: at the sleeve cap
        # the sleeve is only 7 px wide, and a fixed 16 px ramp erased it outright,
        # letting skin through at the shoulder point
        feather = max(2, min(ARMHOLE_FEATHER, int(len(c) / 3)))
        if side == 'L':
            x1 = c.max(); rng = np.arange(max(c.min(), x1 - feather), x1 + 1)
            t = (x1 - rng) / float(feather)
        else:
            x0 = c.min(); rng = np.arange(x0, min(c.max(), x0 + feather) + 1)
            t = (rng - x0) / float(feather)
        out[y, rng] = out[y, rng] * np.clip(t, 0, 1) ** 0.7
    return out


def seam_line(A, side, depth=ARMHOLE_SEAM):
    """Multiplicative shadow along the sleeve's inner edge - the armhole stitch."""
    S = np.ones(CANVAS, np.float32)
    for y in range(A.shape[0]):
        c = np.where(A[y] > 8)[0]
        if len(c) < 4: continue
        x = c.max() if side == 'L' else c.min()
        lo, hi = max(0, x - 3), min(CANVAS[1] - 1, x + 3)
        xs = np.arange(lo, hi + 1)
        S[y, lo:hi + 1] = 1.0 - depth * np.exp(-((xs - x) / 1.8) ** 2)
    return S


def torso_drape(A, centre_x, placket_half_w):
    """Long vertical fall folds plus the shadow the button stand casts."""
    U = _u_across(A)
    ys, xs = np.mgrid[0:CANVAS[0], 0:CANVAS[1]].astype(np.float32)
    folds = 1.0 - TORSO_FOLD_DEPTH * (0.5 - 0.5 * np.cos(2 * np.pi * TORSO_FOLDS * U))
    edge = xs - (centre_x + placket_half_w)
    shadow = 1.0 - PLACKET_SHADOW * np.exp(-(np.clip(edge, 0, None) / 13.0) ** 2) * (edge >= 0)
    out = folds * shadow
    out[A <= 8] = 1.0
    return out.astype(np.float32)


def arm_cast_shadow(sleeve_alpha, side):
    """Shadow the arm throws onto the torso beside it.

    The sleeve and torso each have their own barrel, but with no boundary and no
    contact shadow the eye reads them as one surface. This is what makes the arm
    look like a flat panel rather than a tube.
    """
    S = np.ones(CANVAS, np.float32)
    xs = np.arange(CANVAS[1])
    for y in range(CANVAS[0]):
        c = np.where(sleeve_alpha[y] > 8)[0]
        if len(c) < 4:
            continue
        x = c.max() if side == 'L' else c.min()
        d = (xs - x) if side == 'L' else (x - xs)
        m = d > 0
        S[y][m] = 1.0 - ARM_CAST * np.exp(-(d[m] / ARM_CAST_WIDTH) ** 2)
    return S
