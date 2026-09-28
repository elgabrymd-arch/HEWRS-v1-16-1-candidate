# HEWRS V1.19.0 — curated references and private visual stylist

This is the existing connected application, not a new wardrobe. Keep the entire folder. `index.html` alone is not self-contained. Existing automatic weather, wardrobe, Favorites/history, corrected images and exact physical IDs are retained.

## Use now
Home → Style → Stylist settings → Curated reference library (default). Engine Choice with all six preferences unlocked produces up to fifteen exact locally curated outfits; the controlled no-weather/empty-history test returned fifteen. These are references, **not live AI**. Limited anchors/weather can produce fewer; no unreviewed filler is added. The prior V1.18.0 heuristic is separately selectable.

## Live visual AI is not connected by this delivery
A private authenticated backend, explicit provider key/model and approved usage costs are required. The separate server bundle includes runnable code, actual garment boards, strict request/output validation and setup instructions. No key belongs in this public repository. A frontend-only upload will not activate paid visual AI.

## Run/check
Serve this folder through the existing HTTPS candidate site or a local static HTTP server for desktop development. `python -B tools/verify_v1190.py` verifies source integrity. The accepted source remains unchanged by verification.

## Install/rollback
The update supports V1.17.4 or V1.18.0. Copy the CONTENTS of FILES_TO_COPY into the existing repository, replace matching files, preserve .git and browser storage. No new repository or wardrobe import.
`python -B tools/rollback_v1190.py --output NEW_FOLDER` reconstructs exact V1.18.0 in a new folder without reading browser data.

See DELIVERY_V1_19_0.md for precise tests, source/visual boundaries, limited reference counts and live-service status. Historical reports remain historical.
