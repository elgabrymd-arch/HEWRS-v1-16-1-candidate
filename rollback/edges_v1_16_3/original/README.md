# HEWRS Connected Application V1.16.2

DS023-only side-background and tied-neck alpha cleanup, plus correct shirt-only
trouser-over-shirt ordering. Based on the complete V1.16.1 application.

**Status:** 18 connected non-suit shirt IDs; 32 remain gated. All 18 suit routes,
all 14 blazers, accepted facelift, watch ID/name, physical IDs and history
schema remain. This is not a complete-product or device certification.

## Run

Serve the complete folder as a static website. `index.html` is the entry point
and needs its sibling files and directories. A local development command is
`python -m http.server 8000` from this folder. Do not replace the application
with an isolated HTML file or the historical staging app.

The source package does not enable or push GitHub Pages. Updating the existing
candidate is a separate owner operation. Do not overwrite the original legacy
live app or clear browser storage.

## Verify and review

- `python -B tools/verify_v1162.py`: exact read-only package validation.
- `python -B tools/build_ds023_cleanup.py --check`: reproduce the two alpha-only
  derivatives without changing the packaged files; Pillow/NumPy/SciPy required.
- `tests/ds023-cleanup.cjs`: functional, identity, source and storage checks.
- `tests/ds023-cleanup-browser.py`: actual-script in-memory Chromium checks.
- `DELIVERY_V1_16_2.md`: change rationale, exact limitations and rollback.
- `RELEASE_STATUS.json`: current evidence counts and boundaries.
- `evidence/ds023_v1_16_2/browser/DS023_BEFORE_AFTER_PHONE.png`: actual before/after.

The paired regression tests use `HEWRS_BASELINE_V1161` pointing to a separate
unmodified V1.16.1 source folder. They never edit that baseline. Existing older
receipts remain historical, not newly rerun or reapproved by their presence.

## Remaining limits

The selected trouser's original straight upper edge remains; no missing belt
or waistband detail was invented. Other shirts' inherited transitions were not
retouched. Shirt-only ranking, real-origin/restart persistence and physical
Safari/iPhone acceptance are not certified by this patch.

## Rollback

Run `python -B tools/rollback_v1162.py --output NEW_FOLDER` to reconstruct exact
V1.16.1 separately. Neither that tool nor the update modifies browser wear data.
