# HEWRS Connected Application V1.16.3

Targeted DS023 tied neckline and T017 knot-edge matte cleanup, continuing the
complete V1.16.2 implementation. The earlier side-background and waist-ownership
corrections are retained. This is not a replacement app or a new wardrobe.

**18 non-suit shirts connected; 32 remain gated.** All 18 suits, 14 blazers,
physical catalogue/history IDs, accepted facelift, and watch ID/name support
remain. No new shirt IDs or numerical ranking policy were added.

## Run

Serve the complete folder as a static site. `index.html` needs its sibling
files and folders. A local command is `python -m http.server 8000` in this folder.
No public deployment is performed by this package. Keep the original legacy
live app unchanged. Do not clear browser storage or replace the app with a
historical staging preview.

## Read-only validation and reproducible derivatives

- `python -B tools/verify_v1163.py`: current package hashes, preservation, receipts.
- `python -B tools/build_ds023_edges.py --check`: replay local edge mattes and
  verify exact output bytes without editing the package; Pillow and NumPy.
- `node tests/ds023-edges.cjs`: exact source/ID/scope/renderer-plan tests.
- `tests/ds023-edges-browser.py`: actual script/image in-memory Chromium checks;
  requires `HEWRS_BASELINE_V1162` pointing to an independent V1.16.2 folder.
- `tests/ds023-cleanup.cjs`: inherited functional regressions; run with
  `HEWRS_BASELINE_V1161` pointing to an independent V1.16.1 folder and
  `HEWRS_V1162_FUNCTIONAL` set to a new output path.
- `DELIVERY_V1_16_3.md`: scope, remaining limits, actual evidence and rollback.
- `evidence/edges_v1_16_3/browser/COLLAR_DETAIL_UI_AFTER_390x844.png`: actual
  Collar Detail control exercised, not just a full-outfit thumbnail.

Historical tests/receipts are retained for their original releases, not renamed
as new passes. The current evidence lives in `evidence/edges_v1_16_3/`.

## Boundaries

Four separate images change local alpha only. No RGB values were edited or
invented. No garment/avatar/tie layers were moved or scaled. The original
outer avatar neck cutout and the simplified straight waistband remain visible;
these are not repaired or hidden by this local collar/knot change. Low-resolution
source cloth is not reconstructed. Shirt-only ranking, new hosted loading,
real-origin/browser-restart persistence and physical iPhone/Safari acceptance
remain unverified. No whole-product visual acceptance is claimed.

## Update and rollback

The cumulative V1.16.1-to-V1.16.3 update also applies to V1.16.2. Copy the contents
of its `FILES_TO_COPY` folder into the existing candidate repository root,
preserving subfolders and `.git`. Do not copy the enclosing folder itself.
Do not delete the repository or browser data. There is no need to install
V1.16.2 separately first. Commit/push to GitHub remains a separate owner action.

`python -B tools/rollback_v1163.py --check` verifies exact restoration bytes.
`python -B tools/rollback_v1163.py --output NEW_FOLDER` reconstructs V1.16.2 in a
separate new folder. It never accesses browser data. V1.16.1 can then be
reconstructed using `tools/rollback_v1162.py` in that restored V1.16.2 folder.
