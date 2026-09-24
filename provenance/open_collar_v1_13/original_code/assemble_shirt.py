"""Assemble the shirt: torso + both sleeves + cuffs, over the canonical avatar.

The whole garment's silhouette darkening is computed ONCE, on the union, so
internal boundaries (armhole, cuff seam) do not get an outer-edge shadow from
each piece and double into a hard line.
"""
from PIL import Image
import os
import numpy as np
import torso as T, sleeve as S, sleeve_render as R, shirt_cloth as SC, shirt_photo_cloth as SPC, collar3 as C

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


def _avatar(name):
    """Avatar plates were loaded from the working directory, so the build only
    ran if you happened to cd into the folder holding them. Resolve them in the
    bundle instead."""
    # NO guard here. _avatar is pure path composition and is invoked at MODULE
    # level for BODY, so guarding it makes the module unimportable when the asset
    # library is absent. The guard belongs at the first function that OPENS a
    # file, which is build().
    for cand in (os.path.join(_ASSETS, 'avatar', name), os.path.join(_HERE, name), name):
        if os.path.exists(cand):
            return cand
    return name


BODY = _avatar('base-front_CANONICAL_996x2748_FROM_PRODUCTION.png')
SEAM_ROW = S.CUFF_Y - S.CUFF_DEPTH

# The collar is part of the SHIRT, not of the tie assembly. It was only being
# composited in the tie sheet, so every shirt rendered here came out collarless.
_COLLAR = {}


def collar_masks():
    if not _COLLAR:
        _COLLAR['band'] = C.band()
        _COLLAR['L'] = C.leaf('L')
        _COLLAR['R'] = C.leaf('R')
    return [(_COLLAR['band'], 'R'), (_COLLAR['L'], 'L'), (_COLLAR['R'], 'R')]


def build(shirt_desc='White solid', body_path=BODY, ds=None):
    """ds: a catalogue id (DS001..DS049). If that shirt has a catalogue photo,
    its real cloth is used and the procedural pattern is skipped entirely."""
    _require_assets()
    photo = SPC.garment_cloth(ds) if ds else None
    if photo is None:
        shirt_rgb, pattern = SC.resolve(shirt_desc)
    else:
        shirt_rgb, pattern = (255., 255., 255.), None
    body = np.array(Image.open(body_path).convert('RGBA')).astype(float)
    armL = np.array(Image.open(_avatar('avatar-armL.webp')).convert('RGBA')).astype(float)
    armR = np.array(Image.open(_avatar('avatar-armR.webp')).convert('RGBA')).astype(float)

    TA = T.alpha()
    pieces = []
    for side, ax, arm in (('L', T.ACROMION_L, armL), ('R', T.ACROMION_R, armR)):
        A = S.alpha(side, T.SHOULDER_Y, ax, arm_alpha=arm[..., 3], body_alpha=body[..., 3])
        pieces.append((side, A, S.cuff_alpha(arm[..., 3])))

    union = (TA > 8)
    for _, A, CU in pieces:
        union |= (A > 8) | (CU > 8)
    edge = R.edge_field(union.astype(np.float32) * 255)

    out = np.zeros((2748, 996, 4), np.float32)

    def over(rgb, a):
        al = (a / 255.)[..., None]
        out[..., :3] = rgb * al + out[..., :3] * (1 - al)
        out[..., 3] = np.clip(out[..., 3] + a * (1 - out[..., 3] / 255.), 0, 255)

    over(body[..., :3], body[..., 3])
    base = photo if photo is not None else None
    cast = np.ones((2748, 996), np.float32)
    for side, A, _CU in pieces:
        cast = cast * R.arm_cast_shadow(A, side)
    rgb, a = R.paint(TA, shirt_rgb, edge=edge)
    rgb = rgb * cast[..., None]
    if base is not None:
        rgb = base * (rgb / 255.0)          # photo cloth carried through the form
    rgb = rgb * R.torso_drape(TA, T.CENTERLINE_X, T.PLACKET_HALF_W)[..., None]
    rgb = rgb * SC.weave(TA, pattern)[..., None]
    over(np.clip(rgb, 0, 255), a)

    for side, A, CU in pieces:
        Af = R.feather_inner(A, side)
        rgb, a = R.paint(A, shirt_rgb, seam_row=SEAM_ROW, edge=edge,
                         inner_side=('hi' if side == 'L' else 'lo'))
        if base is not None:
            rgb = base * (rgb / 255.0)
        rgb = rgb * R.seam_line(A, side)[..., None] * SC.weave(A, pattern)[..., None]
        over(np.clip(rgb, 0, 255), Af)
        crgb, ca = R.paint(CU, shirt_rgb, drape=False, edge=edge)
        if base is not None: crgb = base * (crgb / 255.0)
        over(np.clip(crgb, 0, 255), ca)
        cc = np.where(CU[S.CUFF_Y - 40] > 128)[0]
        bx = cc.min() + 22 if side == 'L' else cc.max() - 22
        brgb, ba = R.button(CU, bx, S.CUFF_Y - 46, shirt_rgb); over(brgb, ba)

    for M, sideL in collar_masks():
        crgb, ca = R.paint(M, shirt_rgb, drape=False, edge=edge)
        if base is not None:
            crgb = base * (crgb / 255.0)
        crgb = crgb * C.shade(M, sideL)[..., None]
        over(np.clip(crgb, 0, 255), ca)

    PA = T.placket_alpha(TA)
    prgb, pa = R.paint(PA, shirt_rgb, drape=False, edge=edge)
    if base is not None: prgb = base * (prgb / 255.0)
    over(np.clip(prgb * 1.02, 0, 255), pa)
    for bx, by in T.button_positions():
        brgb, ba = R.button(PA, bx, by, shirt_rgb); over(brgb, ba)

    return np.clip(out, 0, 255).astype(np.uint8)
