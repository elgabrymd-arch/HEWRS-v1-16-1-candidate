"""Choose and combine the best tie source per tie.

Measured on T004, blade region, sub-pixel edge roughness and backdrop pixels:

    v5_rebuilt        0.1053   395 backdrop px   (frozen v5 mask + clean cloth)
    ties_clean        0.0026   169              (parametric silhouette)
    padded_repaired   0.2635     0              (repaired photographic cloth)

No single source wins. ties_clean has the good silhouette because it is generated;
padded_repaired has the good cloth because its backdrop bands were repaired from
the tie's own weave. So the repaired cloth is transferred INTO the clean
silhouette, row by row, which is the same operation build_v5_recovered.compose()
performs and keeps both strengths.

padded_repaired covers 16 ties. HANDOFF sec 2 flags four of them where the
band-copy breaks a large motif and looks worse than the defect it replaced -
those fall back to ties_clean.
"""
import os
import numpy as np
from PIL import Image

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
D = _ASSETS + os.sep
REPAIRED = {'T001', 'T003', 'T004', 'T005', 'T006', 'T007', 'T008', 'T009',
            'T010', 'T014', 'T017', 'T019', 'T033', 'T041', 'T043', 'T044'}
REPAIR_REJECTED = {'T003', 'T005', 'T006', 'T009'}   # motif breaks at the join


def load(tid):
    """-> RGBA float array, clean silhouette, best available cloth."""
    _require_assets()
    clean = np.array(Image.open(D + 'ties_clean/%s-generated.webp' % tid)
                     .convert('RGBA')).astype(np.float32)
    if tid not in REPAIRED or tid in REPAIR_REJECTED:
        return clean, 'ties_clean'

    rep = np.array(Image.open(D + 'padded_repaired/%s-generated.webp' % tid)
                   .convert('RGBA')).astype(np.float32)
    ca, ra = clean[..., 3], rep[..., 3]
    cy = np.where((ca >= 128).any(1))[0]
    ry = np.where((ra >= 128).any(1))[0]
    out = clean.copy()
    for y in range(cy.min(), cy.max() + 1):
        cx = np.where(ca[y] >= 128)[0]
        if len(cx) == 0:
            continue
        # matching row in the repaired tie, by normalised position down the blade
        t = (y - cy.min()) / max(1, (cy.max() - cy.min()))
        sy = int(round(ry.min() + t * (ry.max() - ry.min())))
        sx = np.where(ra[sy] >= 128)[0]
        if len(sx) < 4:
            continue
        f = (cx - cx.min()) / max(1, (cx.max() - cx.min()))
        src = (sx.min() + f * (sx.max() - sx.min())).astype(int)
        out[y, cx, :3] = rep[sy, src, :3]
    return out, 'padded_repaired cloth in ties_clean silhouette'
