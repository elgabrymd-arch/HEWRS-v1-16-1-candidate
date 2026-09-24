"""Per-shirt appearance: colour and weave, resolved from the catalogue text.

The 49 dress shirts differ by colour and by pattern (solid, stripe, check,
windowpane, herringbone). One flat RGB cannot represent them, so the description
string is parsed into a colour plus a weave, and the weave is drawn as a
multiplicative pattern over the shading rather than a separate texture asset.
"""
import re
import numpy as np

CANVAS = (2748, 996)

# base cloth colours, keyed by the colour word in the catalogue description
COLOURS = {
    'white':    (247, 247, 244),
    'cream':    (240, 232, 214),
    'ecru':     (238, 230, 212),
    'lightblue':(203, 219, 235),
    'skyblue':  (196, 215, 236),
    'iceblue':  (216, 227, 237),
    'blue':     (176, 200, 226),
    'navy':     (52, 62, 92),
    'lavender': (219, 212, 232),
    'pink':     (233, 205, 210),
    'burgundy': (122, 58, 68),
    'oxblood':  (118, 54, 62),
    'grey':     (206, 208, 210),
    'silver':   (214, 217, 220),
    'stone':    (223, 216, 204),
    'taupe':    (214, 202, 188),
    'mushroom': (211, 199, 185),
    'black':    (44, 44, 46),
    # added for the DS001-DS049 photo-verified catalogue
    'chocolate':(104, 68, 50), 'espresso': (72, 52, 42), 'brown':    (128, 88, 62),
    'tan':      (206, 180, 146), 'beige':  (214, 196, 168), 'ivory':  (243, 238, 226),
    'mauve':    (196, 166, 176), 'rose':   (214, 176, 178), 'slate':  (108, 128, 152),
    'denim':    (110, 134, 164), 'olive':  (140, 138, 106), 'gold':   (198, 168, 110),
}

# pattern accents, drawn at low contrast because a dress shirt's pattern is woven
STRIPE_PITCH = 34
CHECK_PITCH = 92
PATTERN_DEPTH = {'stripe': 0.055, 'check': 0.045, 'windowpane': 0.05,
                 'herringbone': 0.022, 'gingham': 0.06, 'tattersall': 0.045,
                 'houndstooth': 0.05, 'birdseye': 0.020, 'micro': 0.018}


def resolve(desc):
    """-> (rgb, pattern) from a catalogue description string."""
    d = desc.lower()
    d = d.replace('off-white', 'cream')
    # Take whichever colour word appears EARLIEST in the description, not
    # whichever comes first in this list. A fixed priority order read
    # "Cream, brown & light blue windowpane" as a blue shirt. This is the same
    # rule shirtFamily() already uses in the app.
    key, best = None, None
    for name in ('ice blue', 'sky blue', 'light blue', 'slate', 'denim', 'lavender',
                 'burgundy', 'oxblood', 'mushroom', 'taupe', 'silver', 'stone',
                 'chocolate', 'espresso', 'brown', 'ivory', 'beige', 'tan',
                 'mauve', 'rose', 'olive', 'gold', 'cream', 'ecru', 'white',
                 'navy', 'pink', 'grey', 'gray', 'black', 'blue'):
        i = d.find(name)
        if i != -1 and (best is None or i < best):
            best, key = i, name.replace(' ', '').replace('gray', 'grey')
    rgb = COLOURS.get(key, COLOURS['white'])
    pattern = None
    for p in ('windowpane', 'tattersall', 'houndstooth', 'herringbone',
              'gingham', 'birdseye', 'micro', 'check', 'stripe'):
        if p in d:
            pattern = p
            break
    return rgb, pattern


def weave(A, pattern):
    """Multiplicative pattern field over the garment. 1.0 where there is none."""
    if pattern is None:
        return np.ones(CANVAS, np.float32)
    ys, xs = np.mgrid[0:CANVAS[0], 0:CANVAS[1]].astype(np.float32)
    dep = PATTERN_DEPTH.get(pattern, 0.04)
    if pattern in ('stripe',):
        f = 0.5 - 0.5 * np.cos(2 * np.pi * xs / STRIPE_PITCH)
    elif pattern in ('herringbone', 'birdseye', 'micro'):
        f = 0.5 - 0.5 * np.cos(2 * np.pi * (xs + ys * 0.9) / 11.0)
    elif pattern in ('gingham',):
        f = np.maximum(0.5 - 0.5 * np.cos(2 * np.pi * xs / 46.0),
                       0.5 - 0.5 * np.cos(2 * np.pi * ys / 46.0))
    else:  # check, windowpane, tattersall, houndstooth - a ruled grid
        gx = np.exp(-((np.mod(xs, CHECK_PITCH) - CHECK_PITCH / 2) / 3.0) ** 2)
        gy = np.exp(-((np.mod(ys, CHECK_PITCH) - CHECK_PITCH / 2) / 3.0) ** 2)
        f = np.clip(gx + gy, 0, 1)
    W = 1.0 - dep * f
    W[A <= 8] = 1.0
    return W.astype(np.float32)
