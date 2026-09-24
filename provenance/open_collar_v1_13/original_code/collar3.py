"""Collar v3 — band and leaves as ONE assembly, built against the knot.

Why not collar2: its band was an independent ellipse and its leaves started at
row 300 with a narrow top, so the band floated detached above them; and its
leaves were built from an inner offset plus an `outer` sweep that curved all the
way to the bottom, which rounds off exactly where a collar point must run
straight, so they rendered as blobs.

Here the leaf's TOP EDGE IS the band's own lower arc, so the two cannot separate
however the parameters move, and each leaf is closed by two straight-ish edges
meeting at a single tip vertex, so the point is a point by construction.

Geometry, in the frozen v5 registration:
  band      elliptical ring, centre (494, 288), rx 138, ry 42
  V vertex  (494, 332) - the collar closure, just under the band
  tip       (+-102, 482) - row 482 is where the v5 leaves actually end
  inner edge   V vertex -> tip, straight
  outer edge   band outer -> tip, bowed outward 9 px

Aperture check against knot7 (inverted triangle, 183 top at row 390):
  row 390  leaf inner edge at 454   knot edge at 402   -> 52 px overlap per side
  row 440  leaf inner edge at 421   knot edge at 429   -> knot edge clears the leaf
  so the leaves cover the knot's upper flanks and the knot emerges cleanly below,
  which is spec sec 4.5.
"""
import numpy as np
from scipy import ndimage

CANVAS = (2748, 996)

# Registration onto AVATAR V2. collar3 was authored against the v5 plate, which
# contains no body at all (zero skin anywhere in it), so its vertical position
# was never anchored to a neck. +83 puts the band's lower arc on the avatar's
# measured neck base (row 405); +4 moves 494 onto the avatar centreline 498.
DY = 83.0
DX = 4.0
CX = 494.0 + DX

BAND_CY, BAND_RX, BAND_RY = 286.0 + DY, 138.0, 36.0
BAND_THICK = 0.87          # inner ellipse as a fraction of the outer

V_VERTEX = (CX, 321.0 + DY)   # must sit at or above the band's lower arc (322 at x=CX)
                         # or the knot shows as a nick between band and leaf vertex
TIP_DX, TIP_Y = 78.0, 417.0 + DY   # REBUILT 2026-08-27: leaf depth was 160 rows below
                                   # the band's lower arc against a 95-110 target, and the tips
                                   # sat at 132 against a band radius of 138, so the points
                                   # splayed nearly the full band width. Now 96 rows deep with
                                   # tips at 0.57 of the band radius - dress collar proportions.
                                   # 78 not 88: at depth 95 the aperture opens faster than
                                   # it did at depth 160, so 88 left the R3 knot's corners
                                   # protruding 6.5 px per side at row 478. 78 reproduces the
                                   # pre-rebuild coverage exactly (+11/+11/+1.5 at rows
                                   # 462/470/478) with the knot at its frozen seat, row 454.   # cols 356-634 cap the spread at 138; a leaf that
                               # leans INWARD of the band reads as a fang, not a point
OUTER_BOW = 6.0   # less belly to match the shorter leaf
COL_MIN, COL_MAX = 356.0 + DX, 634.0 + DX   # frozen v5 content extent; the bow pushed the
                                  # leaf 5 px past it, so it is clamped here

SS = 4                     # supersample factor for anti-aliasing


def _band_lower_arc(x):
    """y of the band's lower edge at x. The leaves are hung from this, so the
    band and the leaves share a boundary rather than merely abutting."""
    u = np.clip((x - CX) / BAND_RX, -1, 1)
    return BAND_CY + BAND_RY * np.sqrt(np.clip(1 - u ** 2, 0, 1))


def _rasterise(poly):
    """Polygon fill by even-odd scanline at SS x resolution, then box-downsample.
    Gives a genuinely anti-aliased edge instead of a thresholded one."""
    H, W = CANVAS
    acc = np.zeros((H * SS, W * SS), np.uint8)
    P = np.array(poly, np.float64) * SS
    n = len(P)
    ymin = max(0, int(np.floor(P[:, 1].min())))
    ymax = min(H * SS - 1, int(np.ceil(P[:, 1].max())))
    for yy in range(ymin, ymax + 1):
        yc = yy + 0.5
        xs = []
        for i in range(n):
            x0, y0 = P[i]; x1, y1 = P[(i + 1) % n]
            if (y0 <= yc < y1) or (y1 <= yc < y0):
                xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
        if len(xs) < 2: continue
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            a = max(0, int(np.ceil(xs[i] - 0.5)))
            b = min(W * SS - 1, int(np.floor(xs[i + 1] - 0.5)))
            if b >= a: acc[yy, a:b + 1] = 1
    return acc.reshape(H, SS, W, SS).mean(axis=(1, 3)).astype(np.float32)


def band():
    xs_out = np.linspace(CX - BAND_RX, CX + BAND_RX, 240)
    top = [(x, BAND_CY - BAND_RY * np.sqrt(max(0, 1 - ((x - CX) / BAND_RX) ** 2))) for x in xs_out]
    bot = [(x, _band_lower_arc(x)) for x in xs_out[::-1]]
    outer = _rasterise(top + bot)
    rxi, ryi = BAND_RX * BAND_THICK, BAND_RY * BAND_THICK
    cyi = BAND_CY + 8.0
    xs_in = np.linspace(CX - rxi, CX + rxi, 240)
    itop = [(x, cyi - ryi * np.sqrt(max(0, 1 - ((x - CX) / rxi) ** 2))) for x in xs_in]
    ibot = [(x, cyi + ryi * np.sqrt(max(0, 1 - ((x - CX) / rxi) ** 2))) for x in xs_in[::-1]]
    inner = _rasterise(itop + ibot)
    ring = np.clip(outer - inner, 0, 1)

    # A collar band is a ring around the neck, but only its FRONT is visible -
    # the back arc passes behind the neck. Drawn whole it reads as an open hoop
    # crossing the jaw, which is also what put the band 27 rows above the top of
    # the avatar's visible neck. Remove the part of the annulus lying above the
    # inner ellipse, i.e. the far side.
    ys, xs = np.mgrid[0:CANVAS[0], 0:CANVAS[1]].astype(np.float32)
    u = np.clip((xs - CX) / rxi, -1, 1)
    inner_top = cyi - ryi * np.sqrt(np.clip(1 - u ** 2, 0, 1))
    behind_neck = (np.abs(xs - CX) <= rxi) & (ys < inner_top)
    ring[behind_neck] = 0.0
    return ring * 255.0


def leaf(side):
    s = 1.0 if side == 'R' else -1.0
    tip = (CX + s * TIP_DX, TIP_Y)
    xo = CX + s * BAND_RX
    band_out = (xo, _band_lower_arc(xo))
    # outer edge, bowed outward so the leaf has a little belly but still runs
    # STRAIGHT into the tip - the last stretch is deliberately not curved
    pts = []
    for t in np.linspace(0, 1, 60):
        x = band_out[0] + (tip[0] - band_out[0]) * t
        y = band_out[1] + (tip[1] - band_out[1]) * t
        bow = OUTER_BOW * np.sin(np.pi * t) * (1 - t) ** 0.35
        pts.append((float(np.clip(x + s * bow, COL_MIN, COL_MAX)), y))
    # top edge back along the band's own lower arc to the V vertex
    xs_top = np.linspace(xo, CX, 90)
    top = [(x, _band_lower_arc(x)) for x in xs_top]
    poly = [band_out] + pts + [V_VERTEX] + top[::-1][1:]
    return _rasterise(poly) * 255.0


def shade(M, side):
    ys, xs = np.mgrid[0:CANVAS[0], 0:CANVAS[1]].astype(np.float32)
    u = (xs - CX) / 165.0
    v = np.clip((ys - float(V_VERTEX[1])) / (TIP_Y - float(V_VERTEX[1])), 0, 1)
    g = 0.93 + 0.09 * np.exp(-((u - (0.30 if side == 'R' else -0.30)) ** 2) / 0.6) - 0.10 * v ** 1.4
    d = ndimage.distance_transform_edt(M > 0)
    return np.clip(g * (np.clip(d / 6.0, 0, 1) * 0.09 + 0.91), 0, 1.2)
