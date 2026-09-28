# HEWRS V1.18.0 — personal complete-outfit ranking

This is an implemented update to the existing connected application. It keeps the
18 connected non-suit shirts, all 50 suit shirts, all physical IDs, approved image
assets, weather service and existing stored-data formats. The recommendation order
is intentionally different. Original numerical compatibility remains unchanged and
is disclosed separately from the new heuristic personal styling fit.

## Use
Open the same hosted `index.html` as before. Engine Choice selects unlocked pieces;
partial Anchor selection keeps exact locks. Generated options show **Personal styling
fit · heuristic**. Score Details includes the original compatibility calculation.
No item needs to be relabelled or reapproved. Current weather/manual fallback and
previously implemented Favorites/Insights remain. Generation, viewing and Favorite
saving do not log an outfit as worn.

The 15-option selector retains the maximum-two rule for every unanchored physical
item and the separate No Tie cap. It varies visual ideas among similar-quality
choices without mandatory color slots. It expands beyond its initial working pool
when caps would otherwise prevent filling the list. Incompatible constraints may
still yield fewer; no score or duplicate is fabricated to force 15.

The history-to-Engine integration now validates/synchronizes the backing wear ledger
before generation, checks its revision before accepting a result and after image
loading, and invalidates stale recommendations. Corrupt data remains untouched and
is shown as unavailable rather than used as an empty history. The schema, namespace,
source lock and event/Favorite IDs do not change. No migration/reset is necessary.

## Install
Use the cumulative update over an exact V1.17.2, V1.17.3 or V1.17.4 candidate tree.
Copy the CONTENTS of `FILES_TO_COPY` into the existing candidate repository, replacing
matching files and keeping all others and `.git`. Do not copy the enclosing folder
or ZIP itself into the web root. Keep the same website address and browser data.

Commit summary:
`V1.18.0 — recalibrate full-outfit recommendations; preserve wardrobe and scores`

Commit and push the existing candidate repository through the owner's normal flow.
This package does not publish itself. No new repository or Pages setup is required.

The complete folder is required: `index.html` alone is not self-contained. Optional
local viewing: `python -m http.server 8000` from this folder, then open localhost:8000.
Localhost is a separate browser origin and will not contain your hosted wear history.
No browser-data export is bundled in source or evidence.

## Verification and rollback
- `python -B tools/verify_v1180.py`: read-only package/source protection checks.
- `python -B tools/rollback_v1180.py --check`: verify old restoration bytes.
- `python -B tools/rollback_v1180.py --output NEW_FOLDER`: exact V1.17.4 in a separate
  new folder; existing destination refused. It never opens browser data.

`CHANGED_FILES.json` lists exact changes against V1.17.4. The package manifest covers
every bundled payload except itself. The update has its own cumulative contract for
all supported baselines. Original historical manifests/test reports remain historical;
current results are in `evidence/recalibration_v1_18_0/`.

## Interpretation and evidence
Read `PREFERENCE_MODEL_V1_18_0.md` for disclosed weights, shade/pattern interpretation,
accessory preferences, curation and its limits. Read `DELIVERY_V1_18_0.md` for actual
before/after counts, current tests, preserved inputs and execution boundaries.

This is a transparent heuristic calibration from your accepted complete-outfit
examples and instructions, not a newly trained visual AI or a guarantee that every
future outfit matches your taste. Its score is not an objective measurement. The
original source data/grades remain available for comparison; no new objective-looking
historical score was written into your database.
