"""Real cloth for each shirt, sampled from the catalogue photographs.

Same principle as the tie: the photograph supplies the WEAVE, the garment
geometry supplies the FORM. The photo's own lighting is divided out first (its
low-frequency luminance), so the shirt's own shading is not applied on top of
the photographer's.

36 of 49 shirts have a photo. The other 13 are marked NO PHOTO ON FILE and fall
back to the description + the catalogue's own Pattern / Scale / Density /
Contrast fields.
"""
import json
import os
import numpy as np
from PIL import Image
from scipy import ndimage

# Self-locating, matching the pattern shirt_addendum and shirt_hires were given
# on 2026-08-27. These three were left hardcoded, so the shirt pipeline could not
# run from a clean unzip - it silently required a shadow tree at /home/claude/build.
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

CAT = os.path.join(_ASSETS, 'catalogue.json')
# Catalogue photos live in catalogue_photos/, owner macros in real_photos/. The
# 'photo' field carries a bare filename and does not say which, so resolve both.
_PHOTO_DIRS = ('catalogue_photos', 'real_photos')


def _photo(name):
    for d in _PHOTO_DIRS:
        q = os.path.join(_ASSETS, d, name)
        if os.path.exists(q):
            return q
    raise FileNotFoundError('photo %r not found under %s' % (name, ' or '.join(_PHOTO_DIRS)))
CANVAS = (2748, 996)

# The photos are NOT consistently framed - some are full-length, some are bust
# crops - so a fixed proportional box landed on the collar and skin for DS048 and
# DS049. The chest is located per photo from the face instead.
BOX_W = 0.15              # half-width of each chest patch, as a fraction of frame
CHEST_DROP = 1.25         # chest box starts this many face-heights below the chin
CHEST_TALL = 1.10
FLATTEN_SIGMA = 14        # separates the photographer's lighting from the weave

_cat = None
_cache = {}


def catalogue():
    _require_assets()
    global _cat
    if _cat is None:
        _cat = json.load(open(CAT))
    return _cat


def _flatten(patch):
    """Divide out the photo's own lighting, keep the weave."""
    lum = patch.mean(2)
    base = ndimage.gaussian_filter(lum, FLATTEN_SIGMA)
    base = np.maximum(base, 1e-3)
    flat = patch * (lum.mean() / base)[..., None]
    return np.clip(flat, 0, 255)


def _find_face(im):
    """Largest skin blob in the top half = the face. Returns (chin_y, height)."""
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    skin = (r > 95) & (r > g + 14) & (g > b - 8) & (r - b > 18)
    skin[int(im.shape[0] * 0.55):] = False
    skin = ndimage.binary_opening(skin, np.ones((5, 5)))
    lab, n = ndimage.label(skin)
    if n == 0:
        return None
    sizes = ndimage.sum(skin, lab, range(1, n + 1))
    ys = np.where(lab == (int(np.argmax(sizes)) + 1))[0]
    return int(ys.max()), int(ys.max() - ys.min() + 1)


def cloth_patch(ds):
    """-> (h, w, 3) flat cloth for this shirt, or None if no photo on file."""
    if ds in _cache:
        return _cache[ds]
    e = catalogue().get(ds)
    if not e or not e.get('photo'):
        _cache[ds] = None
        return None
    im = np.array(Image.open(_photo(e['photo'])).convert('RGB')).astype(np.float32)
    h, w, _ = im.shape
    if ds in A14_RECT:
        r = A14_RECT[ds]; x0, y0, x1, y1 = r[:4]; gw = r[4] if len(r) > 4 else None
        a14 = np.array(Image.open(_a14_resolve(A14_PHOTO[ds])).convert('RGB')).astype(np.float32)
        return _place(_flatten(a14[y0:y1, x0:x1]), gw)
    if ds in RECT_OVERRIDE:
        r = RECT_OVERRIDE[ds]; x0, y0, x1, y1 = r[:4]; gw = r[4] if len(r) > 4 else None
        return _place(_flatten(im[y0:y1, x0:x1]), gw)
    # EXTRACTION_FAILED is about the AUTOMATIC whole-garment map, not about the
    # photo. It used to be checked first, which meant a hand-read rectangle on
    # DS005 or DS019 could never be reached and both silently rendered TEXT.
    if ds in EXTRACTION_FAILED:
        return None
    face = _find_face(im)
    chin = face[0] if face else int(0.20 * h)
    # Anchor on the BELT, not on face height. The skin blob swallows the neck, so
    # its height is unreliable - DS021 measured a 240 px 'face' and the box landed
    # on the trousers. The belt is a hard luminance edge and is measurable.
    band = im[chin:int(0.92 * h), int(0.42 * w):int(0.58 * w)].mean(2).mean(1)
    if len(band) > 40:
        d = np.abs(np.diff(ndimage.gaussian_filter1d(band, 6)))
        belt = chin + int(np.argmax(d[10:]) + 10)
    else:
        belt = int(0.55 * h)
    span = max(40, belt - chin)
    y0 = int(chin + 0.32 * span)
    y1 = int(chin + 0.62 * span)
    y0, y1 = max(0, y0), min(h, y1)
    if y1 - y0 < 20:
        # face found but the chest box fell outside the frame (DS036's crop),
        # so fall back to the proportional band rather than dropping the shirt
        y0, y1 = int(0.24 * h), int(0.34 * h)
    # Bound the box to the TORSO, not to fractions of the frame. The frames are
    # differently cropped, so fixed fractions sampled the arms and the backdrop.
    band = im[y0:y1]
    bg = np.median(np.concatenate([band[:, :12], band[:, -12:]], axis=1).reshape(-1, 3), axis=0)
    subj = (np.abs(band - bg).sum(2) > 42)
    cols = np.where(subj.mean(0) > 0.55)[0]
    if len(cols) < 40:
        cols = np.arange(int(0.3 * w), int(0.7 * w))
    L, Rr = int(cols.min()), int(cols.max())
    cx = (L + Rr) // 2
    half = (Rr - L) // 2
    off = int(0.16 * half)                  # clear of the placket and buttons
    bw = int(0.55 * half)
    parts = [im[y0:y1, max(L, cx - off - bw):cx - off], im[y0:y1, cx + off:min(Rr, cx + off + bw)]]
    parts = [p for p in parts if p.shape[1] > 10]
    n = min(p.shape[1] for p in parts)
    patch = np.concatenate([p[:, :n] for p in parts], axis=1)
    _cache[ds] = _flatten(patch)
    return _cache[ds]


# Hand-read, from inspecting all 36 extracted patches at 150x110. These three
# landed on the trousers or the backdrop because the belt-edge anchor misfired.
# A colour gate catches DS005 and DS019 but not DS016, whose bad patch happens to
# sit near "tan"; chroma would separate it at 46.9 vs 39.6 for the next worst,
# but that is a threshold fitted to one sample and four automatic detectors have
# already failed that way in this project (HANDOFF sec 4, sec 10). The nine
# hand-read tag rectangles are what finally worked there. Same approach here.
EXTRACTION_FAILED = {'DS005', 'DS019'}   # DS016 and DS012 now come from Archive 14
# DS012 found by auditing the MAPPED CLOTH, not the old swatch patches. Black
# shirt over black trousers, so the belt-edge detector has no luminance step and
# the sample ran the length of the body: two belts, both hands, both arms. No
# colour test can catch it - a black patch matches a black shirt.

COLOUR_GATE = 120.0       # mean |photo - text| RGB disagreement above which the
                          # extraction is rejected. Photo and description are two
                          # independent sources for the same colour, so they can
                          # check each other. Separation is clean: the three bad
                          # extractions score 154-206, the worst good one 88.


def extraction_ok(ds):
    """Reject a patch whose colour contradicts the catalogue description."""
    import shirt_cloth as SC
    p = cloth_patch(ds)
    if p is None:
        return False
    e = catalogue()[ds]
    exp = np.array(SC.resolve(e['desc'])[0], float)
    return float(np.abs(p.reshape(-1, 3).mean(0) - exp).mean()) <= COLOUR_GATE


# Hand-read chest rectangles, in photo pixels, for the shirts where the automatic
# band + column run keeps the arm gap inside the sample. Read off gridded frames
# with the labels in PHOTO coordinates - an earlier attempt read them off a
# SCALED tile and every rectangle landed on the head. Chosen well inside the
# torso, clear of both arms and the placket edge.
# Archive 14 replica shots, mapped per the owner's ruling of 2026-08-26.
# Numbers refer to archive14_index.png. Ruled but NOT yet mapped (transcription
# ambiguous, awaiting one-word confirmations): 08 'grey', 10 'checker navy',
# 20 'light blue', 22/27 'pale lavender' (duplicates), 31 'striped lavender'.
# Deleted by owner: 11, 16, 28, 34. 21 is a replica of 15.
A14 = os.path.join(_ASSETS, 'archive14_photos') + os.sep
# Hand-read chest rectangles for A14 photos where the detectors mis-fire on the
# new 1023x1537 framing (the face blob measured 336 px and put the chin at
# mid-torso, collapsing the band to 9 rows). Photo pixels, read off grids
# labelled in photo coordinates.
A14_RECT = {
    # Re-read 2026-08-27. The previous rectangles all straddled the placket and
    # ran down to the belt, so the cloth carried buttons, the belt and the buckle
    # and tiled them across the chest - the "repeated buttons" defect. These sit
    # on the wearer's left chest only, above the belt line and clear of the
    # placket, so nothing but cloth is in the patch. 5th element is the
    # photographed garment width across the chest, which sets pattern scale.
    'DS016': (490, 420, 580, 600, 280),
    'DS012': (490, 420, 580, 600, 280),
    'DS034': (490, 420, 580, 600, 280),   # same frame as DS012, per 'both black you can use'
    'DS048': (490, 420, 580, 600, 280),
    # DS018 - owner ruling 2026-08-27: Archive-14 frame 35 and the macro
    # IMG_0127 are the Tom James, i.e. this record. Inherited from the retired
    # DS049. Same framing as the other A14 shots, so the same chest rectangle.
    'DS018': (490, 420, 580, 600, 280),
    'DS049': (440, 500, 650, 760, 580),   # RETIRED record; left as-is
}

A14_PHOTO = {
    'DS016': A14 + '5AF72959-E689-4109-8841-6C0031ED4F1C 1.PNG',   # 15: tan PoW, no pic before
    'DS048': A14 + '3D8D996E-7828-4CDE-A6DC-41112BE31838.PNG',     # 09: houndstooth
    'DS049': A14 + 'E09531D4-A9B8-46F7-827F-780627E8BF5A 1.PNG',   # 35: owner agreed
    'DS012': A14 + 'F7F7DEB1-AE99-4079-9876-FA991275624E.PNG',     # 39: black, 'both black'
    'DS034': A14 + 'F7F7DEB1-AE99-4079-9876-FA991275624E.PNG',     # 39: black, 'both black'
    'DS018': A14 + 'E09531D4-A9B8-46F7-827F-780627E8BF5A 1.PNG',
}

RECT_OVERRIDE = {
    # DS026 from the owner's own photograph (IMG_0400, 4032x3024). Rectangle
    # hand-read off a gridded crop: a flat run of cloth clear of the collar, the
    # HUGO tag, the placket and the cuff. Garment width is MEASURED, not judged:
    # a front button reads 21 px and a dress shirt button is 11 mm, giving
    # 1.91 px/mm; the avatar's 800 px garment stands for a ~570 mm chest, so the
    # pattern is scaled by 1.40/1.91 -> an effective garment width of 1088 px.
    'DS026': (2620, 180, 3480, 560, 1088),
    # DS005 and DS019 - the automatic map fails on both, so read the chest by
    # hand off their catalogue photos (799x1200 model shots) instead of dropping
    # them to TEXT.
    'DS005': (300, 220, 365, 430, 170),   # re-read 2026-08-28 with a preview; the blind rectangle gashed
    # DS019 re-read 2026-08-28 WITH a crop preview. The previous rectangle was
    # placed blind from an assumed framing and its lower edge caught the dark
    # trousers, which tiled as black wedges across the chest of the review PDF.
    'DS019': (408, 275, 462, 405, 140),
    # DS013 and DS015 carried the arm-gap mirror from the automatic map on both
    # the contact sheet and the review PDF; DS017's A16 frame had the same at
    # lower contrast. Hand-read rectangles, each verified by eye before shipping.
    'DS013': (332, 290, 392, 445, 150),
    'DS015': (300, 380, 378, 630, 440),
    'DS017': (545, 470, 660, 800, 370),
    # DS011/DS031/DS036/DS051 - 2026-08-27. The whole-garment map pulled the
    # background between arm and torso into the cloth on these four and mirror-
    # tiled it, giving vertical gashes down the flanks and a diagonal tear across
    # DS031's placket. All four are low-contrast garments on a dark backdrop, the
    # documented case where the torso-run detection fails. Two threshold detectors
    # were written and discarded before falling back to what works here: a
    # hand-read rectangle in PHOTO coordinates. Rectangle is on the wearer's left
    # chest, clear of placket and arm shadow; 5th element is the photographed
    # garment width across the chest, which sets pattern scale.
    'DS011': (545, 500, 660, 820, 375),
    'DS031': (545, 470, 665, 800, 380),
    'DS036': (535, 470, 640, 790, 300),
    'DS051': (535, 470, 640, 790, 305),
    # DS021/DS022/DS023/DS027/DS028 - 2026-08-28. All five carried a doubled
    # button column: the whole-garment map lands the photographed placket left of
    # the rendered one, so two plackets read at once. DS028 additionally cut the
    # studio background through both flanks as white wedges - the same low-contrast
    # torso-run failure as DS011, and it survived every prior eyeball because a pale
    # blue shirt on a pale grey backdrop hides the gash edge. Rectangles hand-read
    # off gridded crops of the 799x1200 model shots, on the wearer's left chest,
    # clear of placket, collar, cuff and arm shadow. 5th element is the photographed
    # torso width measured between the two arm creases at chest height.
    # DS032/DS033 - 2026-08-28. Same doubled-button-column fault as DS022: the
    # photographed placket lands beside the rendered one. Both shirts resolve to the
    # SAME photograph - sh-033-027.jpg and sh-034-028.jpg are byte-identical, md5
    # 633e153a848495347160c7fac95aaa27 - so one rectangle serves both. DS046 carries
    # the same note and should be checked against this when its block comes up.
    # Right edge held at 490: the studio background wedge opens at x~505 below y~400.
    # DS046/DS047/DS050 - 2026-08-28, same doubled-button-column fault.
    # DS046 resolves to the SAME photograph as DS032/DS033, so it takes the same
    # rectangle - the "shares photo" note in its record is literal, md5
    # 633e153a848495347160c7fac95aaa27 for all three.
    'DS046': (420, 290, 490, 450, 227),
    # DS047 from its own 799x1200 model shot. Torso 282-513 between arm creases.
    # Taken LOW, below y=450: this shirt is worn open and its neck opening runs to
    # y~440, so a rectangle at the same chest height that works on DS021/DS022
    # catches skin and the collar edge here. Caught on a crop preview, not in the
    # render - preview the patch, not just the page.
    'DS047': (430, 450, 510, 620, 231),
    # DS050 from replica frame A15-04 (1023x1537). Torso 329-720 between arm
    # creases; rectangle on the wearer's left chest, framing consistent with
    # DS051 on A15-06 and DS011 on A16-03.
    'DS050': (545, 480, 665, 800, 391),
    'DS032': (420, 290, 490, 450, 227),
    'DS033': (420, 290, 490, 450, 227),
    'DS021': (430, 300, 495, 470, 225),
    'DS022': (420, 300, 500, 470, 235),
    'DS023': (420, 300, 500, 470, 230),
    'DS027': (420, 300, 500, 470, 232),
    'DS028': (405, 300, 480, 470, 220),
    'DS007': (300, 300, 500, 470, 320),
    'DS008': (305, 300, 495, 470, 320),
    'DS010': (330, 480, 480, 660),   # lower: DS010's collar is open and the first
                                     # rectangle caught the chest
}

AVATAR_GARMENT_W = 800.0   # avatar shirt span including sleeves


def garment_cloth(ds):
    """Model-photo path first; addendum hand-read crops as a fallback."""
    r = _garment_from_model_photo(ds)
    if r is not None:
        return r
    # high-resolution folded-garment photos first, addendum crops as fallback
    try:
        import shirt_hires as SH
        r = SH.garment_cloth(ds)
        if r is not None:
            return r
    except Exception:
        pass
    try:
        import shirt_addendum as SA
        return SA.garment_cloth(ds)
    except Exception:
        return None


def _place(seg, garment_w=None):
    """Scale a flat cloth patch onto the canvas.

    If garment_w (the photographed garment's width at the chest, in photo px) is
    given, the PATTERN is scaled by AVATAR_GARMENT_W / garment_w - the same rule
    the whole-garment map uses - and the patch is wrap-tiled to cover. Scaling
    the rectangle itself to 800 px made the pattern 1.7-2x too big, because the
    rectangle is only a portion of the garment: DS048's houndstooth came out as
    giant diamonds.
    """
    sc = AVATAR_GARMENT_W / (garment_w if garment_w else seg.shape[1])
    out = np.array(Image.fromarray(np.clip(seg, 0, 255).astype(np.uint8)).resize(
        (int(seg.shape[1] * sc), max(2, int(seg.shape[0] * sc))), Image.LANCZOS)).astype(np.float32)
    canv = np.zeros(CANVAS + (3,), np.float32)
    x0 = int(498 - out.shape[1] / 2); y0c = 330
    oh = min(out.shape[0], CANVAS[0] - y0c); ow = min(out.shape[1], CANVAS[1] - max(0, x0))
    if out.shape[1] < CANVAS[1]:
        reps = int(np.ceil(CANVAS[1] / out.shape[1])) + 1
        out = np.concatenate([out] * reps, axis=1)[:, :CANVAS[1]]
    x0 = int(498 - out.shape[1] / 2)
    ow = min(out.shape[1], CANVAS[1] - max(0, x0))
    canv[y0c:y0c + oh, max(0, x0):max(0, x0) + ow] = out[:oh, :ow]
    if y0c + oh < CANVAS[0]:
        tailn = CANVAS[0] - (y0c + oh)
        body = out[:oh]
        ext = np.concatenate([body[::-1], body], axis=0)
        reps = int(np.ceil(tailn / max(1, len(ext)))) + 1
        canv[y0c + oh:, max(0, x0):max(0, x0) + ow] = np.concatenate([ext] * reps, axis=0)[:tailn, :ow]
    m = canv.sum(2) == 0
    if m.any():
        canv[m] = out.reshape(-1, 3).mean(0)
    return canv


def _a14_resolve(path):
    """The A14 table names frames .PNG; the bundle ships them as .jpg. Nothing is
    missing - resolve either spelling rather than fail the shirt to TEXT."""
    import os
    if os.path.exists(path):
        return path
    for ext in ('.jpg', '.jpeg', '.PNG', '.png'):
        alt = os.path.splitext(path)[0] + ext
        if os.path.exists(alt):
            return alt
    return path


ARCHIVE_DIRS = {'a16': 'archive16_photos', 'a15': 'archive15_photos'}


def _replica_frame(ds):
    """Resolve a shirt's Archive-15/16 replica frame to a path.

    These frames were registered in catalogue.json as 'a15'/'a16' tags on
    2026-08-27, but the loader was never written - the renders that session
    produced came from a scratch catalogue whose 'photo' field had been rewritten
    by hand, which was never shipped. Seven shirts therefore fell silently back to
    TEXT for anyone building from the bundle, and TEXT renders look plausible
    enough that the gap is easy to miss. This closes it in code.
    """
    e = catalogue().get(ds) or {}
    for key, sub in ARCHIVE_DIRS.items():
        tag = e.get(key)
        if not tag:
            continue
        for ext in ('.png', '.PNG', '.jpg', '.jpeg'):
            p = os.path.join(_ASSETS, sub, tag + ext)
            if os.path.exists(p):
                return p
    return None


def _garment_from_model_photo(ds):
    """Map the WHOLE photographed garment onto the avatar, instead of tiling a
    swatch.

    Sampling a ~240 px chest swatch and wrapping it across a 600 px torso put a
    visible repeat down every patterned shirt. The tie had the same problem and
    the fix was not a better tiling algorithm - it was taking a window wide
    enough that no repeat is needed. A catalogue photo IS a shirt on a body, so
    the garment maps one-to-one and the pattern scale comes out right for free:
    the photo garment is scaled by (avatar width / photo width), which preserves
    the pattern-to-body ratio.
    """
    # source: Archive 14 replica shot if the owner mapped one, else the catalogue
    # photo. My first patch loaded the A14 image and then this block immediately
    # re-loaded the catalogue photo over it - so DS016 (no catalogue photo)
    # returned None and DS012/DS034 silently used their OLD broken photos.
    if ds in A14_PHOTO:
        src = _a14_resolve(A14_PHOTO[ds])
    else:
        e = catalogue().get(ds)
        if e and e.get('photo'):
            src = _photo(e['photo'])
        else:
            # Real photograph outranks replica - ruling A. The first version of
            # this guard imported shirt_hires inside try/except:pass, and the
            # import failed silently in the bundle, so DS042 fell into the
            # replica map anyway - a swallowed exception hiding a broken
            # priority. A static set cannot fail silently.
            REAL_SOURCED = {'DS035', 'DS037', 'DS038', 'DS039', 'DS040',
                            'DS041', 'DS042', 'DS043'}
            if ds in REAL_SOURCED:
                return None
            src = _replica_frame(ds)
            if src is None:
                return None
    im = np.array(Image.open(src).convert('RGB')).astype(np.float32)
    h, w, _ = im.shape
    if ds in A14_RECT:
        r = A14_RECT[ds]; x0, y0, x1, y1 = r[:4]; gw = r[4] if len(r) > 4 else None
        a14 = np.array(Image.open(_a14_resolve(A14_PHOTO[ds])).convert('RGB')).astype(np.float32)
        return _place(_flatten(a14[y0:y1, x0:x1]), gw)
    if ds in RECT_OVERRIDE:
        r = RECT_OVERRIDE[ds]; x0, y0, x1, y1 = r[:4]; gw = r[4] if len(r) > 4 else None
        return _place(_flatten(im[y0:y1, x0:x1]), gw)
    # EXTRACTION_FAILED is about the AUTOMATIC whole-garment map, not about the
    # photo. It used to be checked first, which meant a hand-read rectangle on
    # DS005 or DS019 could never be reached and both silently rendered TEXT.
    if ds in EXTRACTION_FAILED:
        return None
    face = _find_face(im)
    chin = face[0] if face else int(0.20 * h)
    band = im[chin:int(0.92 * h), int(0.42 * w):int(0.58 * w)].mean(2).mean(1)
    if len(band) < 40:
        return None
    d = np.abs(np.diff(ndimage.gaussian_filter1d(band, 6)))
    belt = chin + int(np.argmax(d[10:]) + 10)
    # stop CLEAR of the belt: the last rows before it are the belt's own dark
    # edge, and mirroring them against themselves made a doubled dark band at
    # the waist of every patterned shirt
    # Start well below the model's own collar opening. At 0.10 the sample's top
    # rows contained the photographed neck, and that skin got mapped onto the
    # avatar's placket - which is why the "hole" in the collar V was skin-coloured
    # placket rather than an actual gap.
    y0 = int(chin + 0.30 * (belt - chin))
    y1 = int(belt - 0.10 * (belt - chin))
    if y1 - y0 < 40:
        return None
    seg = im[y0:y1]
    bg = np.median(np.concatenate([seg[:, :12], seg[:, -12:]], axis=1).reshape(-1, 3), axis=0)
    subj = np.abs(seg - bg).sum(2) > 42
    cols = np.where(subj.mean(0) > 0.5)[0]
    if len(cols) < 60:
        return None
    # Take the TORSO run, not the whole subject span. The span reaches the outer
    # edge of each arm, so the background between arm and torso came with it and
    # showed as pale vertical gashes down the flanks of all 31 shirts.
    solid = subj.mean(0) > 0.92
    runs, start = [], None
    for i in range(len(solid)):
        if solid[i] and start is None:
            start = i
        elif not solid[i] and start is not None:
            runs.append((start, i - 1)); start = None
    if start is not None:
        runs.append((start, len(solid) - 1))
    runs = [r for r in runs if r[1] - r[0] > 40]
    if runs:
        lo, hi = max(runs, key=lambda r: r[1] - r[0])
    else:
        lo, hi = int(cols.min()), int(cols.max())
    # inset off the arm shadow: the run boundary sits in the soft edge between
    # torso and arm
    inset = int(0.055 * (hi - lo))
    lo, hi = lo + inset, hi - inset
    seg = seg[:, lo:hi + 1]

    # NOT APPLIED - filling background-coloured pixels from the nearest cloth.
    # It is the right idea and the background colour is known exactly, but the
    # detection has to run on the cloth, and several shirts ARE the backdrop
    # colour: DS010 is light grey houndstooth, DS030 light silver-grey. At a
    # threshold of 46 the mask caught real cloth and smeared over it, and DS010
    # went from clean to gashed. This is the sixth colour threshold in this
    # project to fail on low-contrast material (HANDOFF sec 10 lists nine ties
    # with the same problem). It needs a real matte for the photos, or a
    # hand-read rectangle per shirt - not another threshold.


    # NOT APPLIED - merging runs separated by <=45 px.
    # It is a real finding: on DS007 the run fragments into four pieces at the
    # buttons and placket, and the largest is a 64 px strip that then gets scaled
    # 14x to fill the garment. That upscaled button stand is the pale wedge; the
    # patch measured 0.6% background, so the gash was never backdrop at all.
    # Merging fixed DS013 and DS049 in isolation, but combined with everything
    # else it took the count from 6 gashes to about 15, because a 45 px tolerance
    # also bridges the gap beside an arm that hangs close to the body. If it is
    # retried, the tolerance needs to be ~22 px - wide enough for a placket,
    # too narrow for an armhole - and it needs verifying on its own.
    seg = _flatten(seg)
    sc = AVATAR_GARMENT_W / seg.shape[1]
    out = np.array(Image.fromarray(np.clip(seg, 0, 255).astype(np.uint8)).resize(
        (int(seg.shape[1] * sc), max(2, int(seg.shape[0] * sc))), Image.LANCZOS)).astype(np.float32)
    # place it over the garment: centred on the shirt centreline, top at the yoke
    canv = np.zeros(CANVAS + (3,), np.float32)
    x0 = int(498 - out.shape[1] / 2)
    y0c = 330      # must start ABOVE the collar band (rows 352-390) or the band
                   # falls outside the mapped cloth and gets the flat mean colour
    oh = min(out.shape[0], CANVAS[0] - y0c)
    ow = min(out.shape[1], CANVAS[1] - max(0, x0))
    if out.shape[1] < CANVAS[1]:
        reps = int(np.ceil(CANVAS[1] / out.shape[1])) + 1
        out = np.concatenate([out] * reps, axis=1)[:, :CANVAS[1]]
    x0 = int(498 - out.shape[1] / 2)
    ow = min(out.shape[1], CANVAS[1] - max(0, x0))
    canv[y0c:y0c + oh, max(0, x0):max(0, x0) + ow] = out[:oh, :ow]
    # The photo garment runs chin -> belt, which at this scale is ~730 rows, and
    # the avatar shirt needs ~850. Repeating the last 60 rows to fill put the
    # belt's dark edge into a hard horizontal band every 60 rows. Mirror the
    # whole garment vertically instead: a check, a stripe and a herringbone are
    # all near-symmetric top-to-bottom, so a vertical reflection does not produce
    # the chevron that a HORIZONTAL mirror does.
    if y0c + oh < CANVAS[0]:
        tailn = CANVAS[0] - (y0c + oh)
        body = out[:oh]
        ext = np.concatenate([body[::-1], body], axis=0)
        reps = int(np.ceil(tailn / max(1, len(ext)))) + 1
        stack = np.concatenate([ext] * reps, axis=0)[:tailn]
        canv[y0c + oh:, max(0, x0):max(0, x0) + ow] = stack[:, :ow]
    canv[canv.sum(2) == 0] = np.array(mean_rgb(ds) if mean_rgb(ds) is not None else [200, 200, 200])
    return canv


def tiled(ds, scale=1.0):
    """Cloth tiled across the canvas, wrapped not mirrored."""
    if ds in EXTRACTION_FAILED or not extraction_ok(ds):
        return None
    p = cloth_patch(ds)
    if scale != 1.0:
        ph, pw, _ = p.shape
        p = np.array(Image.fromarray(p.astype(np.uint8)).resize(
            (max(2, int(pw * scale)), max(2, int(ph * scale))), Image.LANCZOS)).astype(np.float32)
    # Plain wrap, NOT mirrored. Mirroring produced large kaleidoscope rosettes
    # across the whole garment - the same reflection artefact that ruled mirror
    # tiling out for the tie blades in HANDOFF sec 5. I claimed shirt weave was
    # isotropic enough to get away with it; the render said otherwise.
    p2 = p
    ph, pw, _ = p2.shape
    ys, xs = np.mgrid[0:CANVAS[0], 0:CANVAS[1]]
    return p2[ys % ph, xs % pw]


def mean_rgb(ds):
    p = cloth_patch(ds)
    return None if p is None else p.reshape(-1, 3).mean(0)
