"""HEWRS — shoulder / upper-sleeve REBUILD.

Rebuilds the missing sleeve section between the (not yet verified) torso shoulder
and the canonical arm assets. Nothing here moves, rescales or regenerates either
arm asset; the arms are read, never written.

VERIFIED, measured from the assets in this session (not parameters):
    JOIN_Y      first fully-opaque arm row: 1090 left, 1086 right
    join edges  L 40-191   R 802-955   (alpha >= 128 at JOIN_Y)
    tangents    fitted over rows 1090-1160, so the rebuilt edge meets the
                canonical edge with matching slope and leaves no kink
    FEATHER     993-1045, the arm's own alpha ramp
    CUFF_Y      1388

UNFROZEN PARAMETERS — supplied by the caller, never inferred here:
    SHOULDER_Y, ACROMION_X_L, ACROMION_X_R

build() refuses to run unless the caller passes verified=True, so a provisional
shoulder cannot be written into a production asset by accident.

Architecture note: the rebuilt section spans SHOULDER_Y -> JOIN_Y, which fully
covers the 993-1045 feather. The arm's soft alpha onset therefore never shows —
it sits behind opaque sleeve cloth — which is why the feather is an overlap
region and not a construction seam.
"""
import numpy as np

CANVAS = (2748, 996)

# ---- verified from the canonical arm assets ----
JOIN = {
    'L': {'y': 1090, 'left': 40.0,  'right': 191.0, 'dleft': +0.0671, 'dright': -0.0593},
    'R': {'y': 1086, 'left': 802.0, 'right': 955.0, 'dleft': +0.0628, 'dright': -0.0911},
}
FEATHER = (993, 1045)
CUFF_Y = 1388

# ---- shape parameters (tunable here, no round trip needed) ----
SLEEVE_EASE = 9.0        # cloth clearance around the arm at the join, px per side
CUFF_EASE = 24.0         # ease GROWS toward the cuff. The arm tapers faster than
                         # a shirt sleeve does; that surplus is what gets pleated
                         # into the cuff. Measured: with ease tapering to 4 the
                         # sleeve arrived 2 px NARROWER than its own cuff, which
                         # is why it read as one smooth tube with no drape.
CUFF_DEPTH = 98          # cuff band depth; the band ENDS at the wrist row 1388
CUFF_STANDOFF = 3.0      # the cuff sits fractionally proud of the arm
CUFF_BAND_EASE = 4.0     # the CUFF's own clearance - separate from CUFF_EASE,
                         # which is the sleeve's fullness arriving at it
SHOULDER_SLOPE = 0.55    # d(edge)/dy at the sleeve head; controls how square the
                         # shoulder reads. 0 = vertical drop, higher = more slope.
ARMHOLE_SLOPE = 0.10     # tangent at the shoulder point
ARMHOLE_BOW = 30.0       # A real armhole is not a straight line. Mine ran from
                         # the acromion at 199 to the join at 200 - dead vertical -
                         # which is why the seam read as a fold rather than a
                         # scye. Bow it outward through the middle.
ARMHOLE_BOW_PEAK = 0.42  # where the bow is widest, 0 = shoulder, 1 = join
ARMHOLE_MIN_LAP = 14.0   # The sleeve overlapped the torso by 20 px at row 890 but
                         # only 3 px at 960-970, and a 7-row feather plus the seam
                         # shadow on a 3 px overlap let the body show through as a
                         # dark nick at the armpit. Keep a floor on the overlap all
                         # the way to the join.
EDGE_SMOOTH = 9          # rows; the body-silhouette edge is read per row at a hard
                         # alpha threshold, so it carries the plate's quantisation


def _hermite(y, y0, v0, m0, y1, v1, m1):
    """Cubic Hermite in y. Matches value AND slope at both ends, so the rebuilt
    edge joins the canonical arm edge without a corner."""
    h = float(y1 - y0)
    t = (np.asarray(y, float) - y0) / h
    t2, t3 = t * t, t * t * t
    return ((2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * h * m0 +
            (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * h * m1)


def outer_from_body(body_alpha, side, shoulder_y, ease=SLEEVE_EASE):
    """Sleeve outer edge read straight off the body silhouette.

    Above row ~920 the arms are the outermost thing in the plate, so the arm's
    outer edge IS the silhouette edge and needs no interpolation. Interpolating
    it instead - acromion straight down to the forearm join - missed the actual
    arm by up to 108 px at row 600 and left the deltoid bare.
    """
    j = JOIN[side]['y']
    rows, e = [], []
    for y in range(int(shoulder_y), j + 1):
        c = np.where(body_alpha[y] >= 128)[0]
        if len(c) == 0: continue
        x = c.min() if side == 'L' else c.max()
        rows.append(y); e.append(x - ease if side == 'L' else x + ease)
    return np.array(rows), np.array(e, float)


def sleeve_edges(side, shoulder_y, acromion_x, ease=SLEEVE_EASE,
                 shoulder_slope=SHOULDER_SLOPE, body_alpha=None):
    """-> (rows, outer, inner) for the rebuilt section, shoulder_y .. JOIN_Y.

    Outer edge runs from the acromion down to the arm's outer edge; inner edge
    runs from the armhole down to the arm's inner edge. Both land on the
    canonical arm with matching slope.
    """
    j = JOIN[side]
    outward = -1.0 if side == 'L' else +1.0     # which way is away from the body
    y0, y1 = float(shoulder_y), float(j['y'])
    rows = np.arange(int(shoulder_y), j['y'] + 1)

    join_outer = (j['left'] - ease) if side == 'L' else (j['right'] + ease)
    join_inner = (j['right'] + ease) if side == 'L' else (j['left'] - ease)
    m_outer = j['dleft'] if side == 'L' else j['dright']
    m_inner = j['dright'] if side == 'L' else j['dleft']

    # A set-in sleeve has NO width at the shoulder point: the armhole seam and
    # the shoulder seam meet there. Starting the inner edge inboard by a full
    # head width gave a flat-topped slab with square corners sitting on the
    # shoulder. Both edges start at the acromion and the sleeve opens downward.
    head_inner = acromion_x

    outer = _hermite(rows, y0, acromion_x, outward * shoulder_slope, y1, join_outer, m_outer)
    inner = _hermite(rows, y0, head_inner, -outward * ARMHOLE_SLOPE, y1, join_inner, m_inner)
    t = (rows - y0) / max(1.0, (y1 - y0))
    bow = ARMHOLE_BOW * np.exp(-((t - ARMHOLE_BOW_PEAK) / 0.34) ** 2) * np.clip(1 - t, 0, 1) ** 0.3
    inner = inner - outward * (bow + ARMHOLE_MIN_LAP)
    if body_alpha is not None:
        br, be = outer_from_body(body_alpha, side, shoulder_y, ease)
        if len(br):
            if EDGE_SMOOTH > 1:
                k = np.ones(EDGE_SMOOTH) / EDGE_SMOOTH
                be = np.convolve(np.pad(be, EDGE_SMOOTH // 2, mode='edge'), k, mode='valid')[:len(br)]
            meas = np.interp(rows, br, be)
            # take whichever is further out - measured arm, or the sleeve head
            outer = np.minimum(outer, meas) if side == 'L' else np.maximum(outer, meas)
    return rows, outer, inner


def _span(A, xs, lo, hi):
    return np.clip(np.minimum(xs + 1, hi) - np.maximum(xs, lo), 0, 1) * 255


def lower_sleeve_edges(arm_alpha, side, ease=SLEEVE_EASE, cuff_ease=CUFF_EASE):
    """JOIN_Y -> CUFF_Y, following the canonical arm outward by a tapering ease.

    The sleeve does not stop at the join. A long-sleeve shirt covers the forearm
    to the cuff, so below the join the arm itself is the authority and the cloth
    simply sits proud of it, gathering in toward the cuff.
    """
    j = JOIN[side]['y']
    rows, los, his = [], [], []
    seam = CUFF_Y - CUFF_DEPTH
    for y in range(j, CUFF_Y + 1):
        c = np.where(arm_alpha[y] >= 128)[0]
        if len(c) == 0: continue
        if y <= seam:
            t = (y - j) / float(seam - j)
            e = ease + (cuff_ease - ease) * (t * t * (3 - 2 * t))
        else:
            # inside the cuff the surplus is pleated away, so the sleeve drops
            # quickly to the band it enters
            t = (y - seam) / float(CUFF_Y - seam)
            e = cuff_ease + (CUFF_BAND_EASE - cuff_ease) * (t * t * (3 - 2 * t))
        rows.append(y); los.append(c.min() - e); his.append(c.max() + e)
    return np.array(rows), np.array(los), np.array(his)


def cuff_edges(arm_alpha):
    """Cuff band, ending at the verified wrist row 1388."""
    rows, los, his = [], [], []
    for y in range(CUFF_Y - CUFF_DEPTH, CUFF_Y + 1):
        c = np.where(arm_alpha[y] >= 128)[0]
        if len(c) == 0: continue
        e = CUFF_BAND_EASE + CUFF_STANDOFF
        rows.append(y); los.append(c.min() - e); his.append(c.max() + e)
    return np.array(rows), np.array(los), np.array(his)


def alpha(side, shoulder_y, acromion_x, arm_alpha=None, **kw):
    """Full sleeve alpha: rebuilt head + upper sleeve, then down over the
    canonical arm to the cuff. Pass arm_alpha to include everything below the
    join; omit it to get the rebuilt section alone."""
    ease = kw.get('ease', SLEEVE_EASE)
    rows, outer, inner = sleeve_edges(side, shoulder_y, acromion_x, **kw)
    A = np.zeros(CANVAS, np.float32)
    xs = np.arange(CANVAS[1])
    for i, y in enumerate(rows):
        lo, hi = (outer[i], inner[i]) if outer[i] <= inner[i] else (inner[i], outer[i])
        A[y] = _span(A, xs, lo, hi)
    if arm_alpha is not None:
        r, lo, hi = lower_sleeve_edges(arm_alpha, side, ease=ease)
        for i, y in enumerate(r):
            A[y] = np.maximum(A[y], _span(A, xs, lo[i], hi[i]))
    return A


def cuff_alpha(arm_alpha):
    A = np.zeros(CANVAS, np.float32)
    xs = np.arange(CANVAS[1])
    r, lo, hi = cuff_edges(arm_alpha)
    for i, y in enumerate(r):
        A[y] = _span(A, xs, lo[i], hi[i])
    return A


def build(shoulder_y, acromion_x_l, acromion_x_r, verified=False, **kw):
    if not verified:
        raise RuntimeError(
            'Refusing to build: shoulder_y/acromion are not from a verified torso '
            'source. Pass verified=True only once a canonical torso layer has '
            'supplied them. Use preview() for provisional rendering.')
    return preview(shoulder_y, acromion_x_l, acromion_x_r, **kw)


def preview(shoulder_y, acromion_x_l, acromion_x_r, armL=None, armR=None, **kw):
    return (alpha('L', shoulder_y, acromion_x_l, arm_alpha=armL, **kw),
            alpha('R', shoulder_y, acromion_x_r, arm_alpha=armR, **kw))
