"""HEWRS — shirt torso.

All geometry below is either supplied in HEWRS_AVATAR2_SHOULDER_COORDINATES.json
or measured off base-front_CANONICAL_996x2748_FROM_PRODUCTION.png. Nothing is
guessed, and the avatar is never moved or rescaled.

VERIFIED / SUPPLIED
    CENTERLINE_X   498     (my independent arm-mirror derivation gave 497.0,
                            sd 0.40 - agrees to 1 px)
    SHOULDER_Y     472     acromion 199 / 798
    CHEST_Y        742     axillary 200 / 797
                           Supplied rather than measured because above row ~920
                           the arms merge with the torso in the plate's alpha and
                           the side of the torso is not separable there.

MEASURED HERE (alpha >= 128 on the canonical body, middle run = torso)
    y  960   230-765      y 1080  212-779
    y 1000   226-771      y 1160  216-775
    y 1040   214-779      y 1240  196-795

HEM
    The underwear waistband begins at y ~1190 (torso mean luminance falls
    103 -> 38 between 1180 and 1220). A dress shirt is tucked, so the hem is set
    below that line and will sit under the trouser waist.
"""
import numpy as np
from scipy.interpolate import PchipInterpolator

CANVAS = (2748, 996)

CENTERLINE_X = 498.0
SHOULDER_Y = 472
ACROMION_L, ACROMION_R = 199.0, 798.0
CHEST_Y = 742
CHEST_L, CHEST_R = 200.0, 797.0
HEM_Y = 1250

# measured torso half-widths from the canonical body, as (row, right edge)
TORSO_MEASURED = [(960, 765.0), (1000, 771.0), (1040, 779.0),
                  (1080, 779.0), (1160, 775.0), (1240, 795.0)]

SHIRT_EASE = 16.0        # cloth clearance at the body, ramped in below the shoulder
SHOULDER_OVERLAP = 5.0   # the torso runs a few px past the acromion so the sleeve
                         # cap, which is near-zero width there, has something to
                         # sit on. Audit found 28 bare px at rows 906-923 without it.
# MEASURED: the neck column is a constant 386-615 (half-width 115) from row 360
# to 405, then the silhouette widens sharply - so the neck base is y=405 and the
# shoulder line SLOPES from there down to the acromion at 472. My first pass had
# it flat at 472, which left the trapezius bare and gave the shirt square corners.
NECK_BASE_Y = 405
NECK_HALF_W = 122.0      # measured neck half-width 115, plus collar stand-off
YOKE_Y = 560             # back-yoke seam line, for shading only

# Front neckline. The first pass left a straight-sided rectangular hole because
# the opening was bounded by two verticals at CENTERLINE +- NECK_HALF_W and by
# the torso top at 472. A neckline is a scoop: highest at the shoulder/neck
# point, lowest at centre front.
FRONT_NECK_DROP = 16     # how far below NECK_BASE_Y the centre front sits.
                         # 74 rows (5 cm) read as a shirt unbuttoned to mid-chest:
                         # a bare wedge of neck and chest between the collar
                         # leaves. A catalogue shirt is buttoned, so the front
                         # closes just under the band and the placket runs up to
                         # meet it.

PLACKET_HALF_W = 21.0
BUTTON_R = 10.0
BUTTON_TOP = 530
BUTTON_GAP = 118


def _side_curve():
    """Right-hand side seam, shoulder -> chest -> measured torso -> hem.

    Monotone (PCHIP) so it cannot overshoot between control points, which a
    plain cubic will do on a waist taper.
    """
    ys = [SHOULDER_Y, CHEST_Y] + [r for r, _ in TORSO_MEASURED] + [HEM_Y]
    xs = [ACROMION_R + SHOULDER_OVERLAP, CHEST_R + SHOULDER_OVERLAP] + [x + SHOULDER_OVERLAP for _, x in TORSO_MEASURED] + [TORSO_MEASURED[-1][1] + SHOULDER_OVERLAP]
    # ease ramps from 0 at the shoulder seam (which sits ON the acromion) to full
    # below the armpit
    ease = []
    for y in ys:
        t = np.clip((y - SHOULDER_Y) / float(CHEST_Y - SHOULDER_Y), 0, 1)
        ease.append(SHIRT_EASE * (t * t * (3 - 2 * t)))
    xs = [x + e for x, e in zip(xs, ease)]
    keep = {}
    for y, x in zip(ys, xs):
        keep[y] = x
    ys = sorted(keep); xs = [keep[y] for y in ys]
    return PchipInterpolator(np.array(ys, float), np.array(xs, float))


def _shoulder_curve():
    """Shoulder seam: neck base -> acromion. Slightly hollowed, as a shoulder is."""
    ys = np.array([NECK_BASE_Y, NECK_BASE_Y + 0.45 * (SHOULDER_Y - NECK_BASE_Y), SHOULDER_Y], float)
    xs = np.array([CENTERLINE_X + NECK_HALF_W,
                   CENTERLINE_X + NECK_HALF_W + 0.52 * (ACROMION_R - CENTERLINE_X - NECK_HALF_W),
                   ACROMION_R + SHOULDER_OVERLAP], float)
    return PchipInterpolator(ys, xs)


def _neckline():
    """Front neck scoop: neck point at the shoulder seam -> centre front."""
    ys = np.array([NECK_BASE_Y, NECK_BASE_Y + 0.55 * FRONT_NECK_DROP,
                   NECK_BASE_Y + FRONT_NECK_DROP], float)
    xs = np.array([CENTERLINE_X + NECK_HALF_W, CENTERLINE_X + NECK_HALF_W * 0.72,
                   CENTERLINE_X], float)
    return PchipInterpolator(ys, xs)


NECK_FRONT_Y = NECK_BASE_Y + FRONT_NECK_DROP


def alpha():
    """Torso alpha, anti-aliased, symmetric about CENTERLINE_X."""
    side = _side_curve(); sh = _shoulder_curve(); neck = _neckline()
    A = np.zeros(CANVAS, np.float32)
    xs = np.arange(CANVAS[1])
    def paint(y, lo, hi):
        if hi <= lo: return
        A[y] = np.maximum(A[y], np.clip(np.minimum(xs + 1, hi) - np.maximum(xs, lo), 0, 1) * 255)
    for y in range(NECK_BASE_Y, HEM_Y + 1):
        outer = float(sh(y)) if y < SHOULDER_Y else float(side(np.clip(y, SHOULDER_Y, HEM_Y)))
        if y <= NECK_FRONT_Y:
            inner = float(neck(np.clip(y, NECK_BASE_Y, NECK_FRONT_Y)))
            paint(y, inner, outer)
            paint(y, CENTERLINE_X * 2 - outer, CENTERLINE_X * 2 - inner)
        else:
            paint(y, CENTERLINE_X * 2 - outer, outer)
    return A


def placket_alpha(A):
    P = np.zeros(CANVAS, np.float32)
    xs = np.arange(CANVAS[1])
    lo, hi = CENTERLINE_X - PLACKET_HALF_W, CENTERLINE_X + PLACKET_HALF_W
    # The placket runs up to the collar band, not just to the neckline. The
    # collar V vertex is at row 404 but the neckline only closes at 421, leaving
    # a 50-row wedge of bare neck between the leaf tips (rows 405-454, 874 px).
    for y in range(int(NECK_BASE_Y), HEM_Y + 1):
        if not (A[y] > 8).any() and y > NECK_FRONT_Y: continue
        P[y] = np.clip(np.minimum(xs + 1, hi) - np.maximum(xs, lo), 0, 1) * 255
    return P


def button_positions():
    return [(CENTERLINE_X, y) for y in range(BUTTON_TOP, HEM_Y - 60, BUTTON_GAP)]
