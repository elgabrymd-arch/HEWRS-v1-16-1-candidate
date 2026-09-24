"""Blade taper across the knot junction.

The R3 asset is a knot FACE, cropped without the wrap band, so it tapers to
56 px (3.8 cm) at row 549. The blade arrives there 73 px wide, so its shoulders
stand 8.5 px proud of the knot on each side and read as a step.

On a real tie the blade is hidden behind the knot and only reaches its own width
once it is clear of it. So the blade is narrowed to the knot's base width where
the two meet and eased out to its natural width over the rows below - a
horizontal rescale about the tie centreline, nothing resampled vertically, so
the blade's pattern scale down the length is untouched.

EASE_ROWS is the only judgement here: too short and the blade flares like a
funnel, too long and it looks pinched all the way down the chest.
"""
import numpy as np

EASE_ROWS = 62
MARGIN = 2.0          # blade sits just inside the knot edge, never flush


def _row_width(a, y):
    i = np.where(a[y] > 128)[0]
    return (int(i.min()), int(i.max())) if len(i) else None


def taper(brgb, ba, knot_alpha, y_start, cx=498.0, ease=EASE_ROWS):
    """Two phases.

    While the blade runs behind the knot it is held to the KNOT'S OWN width row
    by row, so no corner can stand proud anywhere in the overlap - the first cut
    of this only pinned the last row and left the step at 541-545.

    Once the knot ends, the blade eases from that width out to its natural one.
    """
    ky = np.where((knot_alpha > 128).any(1))[0]
    if len(ky) == 0:
        return brgb, ba
    k_end = int(ky.max())

    scale = {}
    for y in range(y_start, k_end + 1):
        k = _row_width(knot_alpha, y); b = _row_width(ba, y)
        if k is None or b is None: continue
        kw = (k[1] - k[0] + 1) - 2 * MARGIN
        bw = b[1] - b[0] + 1
        if kw < bw:
            scale[y] = kw / float(bw)
    s_exit = scale.get(k_end, 1.0)
    for i in range(1, ease + 1):
        y = k_end + i
        if y >= ba.shape[0]: break
        f = i / float(ease)
        e = f * f * (3 - 2 * f)              # smoothstep: no corner at either end
        scale[y] = s_exit + (1.0 - s_exit) * e

    out_rgb = brgb.copy(); out_a = ba.copy()
    for y, s in sorted(scale.items()):
        if s >= 0.999: continue
        # resample this row about the centreline
        xs = np.arange(ba.shape[1], dtype=np.float32)
        src = cx + (xs - cx) / s
        i0 = np.clip(np.floor(src), 0, ba.shape[1] - 1).astype(int)
        i1 = np.clip(i0 + 1, 0, ba.shape[1] - 1)
        w = (src - i0).astype(np.float32)
        inb = (src >= 0) & (src <= ba.shape[1] - 1)
        for ch in range(3):
            v = brgb[y, i0, ch] * (1 - w) + brgb[y, i1, ch] * w
            out_rgb[y, :, ch] = np.where(inb, v, 0)
        va = ba[y, i0] * (1 - w) + ba[y, i1] * w
        out_a[y] = np.where(inb, va, 0)
    return out_rgb, out_a
