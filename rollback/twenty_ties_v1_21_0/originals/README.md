# HEWRS V1.20.0 — Research-based wardrobe generator

This is the full runnable static-source folder. `index.html` requires the packaged subfolders. The private AI service remains disconnected/paused; this release makes no model request and needs no API key.

## What to select
Home → Style → Stylist settings → **Research-based wardrobe generator — local (up to 15)**. This is the default when upgrading the older local method preference. A visible explanation is shown; the old preference remains available to rollback. Explicit new selections are retained.

Curated reference library remains a clearly labelled finite collection. The previous V1.18 heuristic remains separately selectable. No fixed references or heuristics are described as live AI.

The new generator composes from the broad supported wardrobe pool and uses a disclosed research-informed local preference model. It retains source holds, current weather, exact locks, current confirmed history and maximum-two item rules. In the controlled test every suit and blazer returned 15; more restrictive requests may still return fewer.

## Install / rollback
Update only the existing candidate repository. Copy the CONTENTS of `FILES_TO_COPY` from the update, replacing matching files and retaining all others and `.git`. Do not clear website data or upload the private server bundle. Commit summary:

`V1.20.0 — restore broad 15-option generation with researched styling rules`

Read `V1200_FIVE_PASS_AUDIT.md` and `RESEARCH_RULES_V1_20_0.md`. Run `python -B tools/verify_v1200.py` for exact package verification. `python -B tools/rollback_v1200.py --output NEW_FOLDER` restores exact V1.19.0 in a separate destination without touching browser data. `python -B tools/build.py` rebuilds static HTML from the template.

## Data and claims
Inventory, original grades, all 848 runtime images, geometry, weather, Favorites and wear history are preserved. Only local ranking, method routing/default disclosure, and versioned presentation are changed. New estimates are heuristics, not designer-endorsed scores, measured colour values, or this conversation embedded in the app. Original numerical assessments stay separate.

## Historical README from V1.19.0 (not current method/default)

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
