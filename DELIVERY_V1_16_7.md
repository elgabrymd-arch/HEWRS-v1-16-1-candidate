# HEWRS V1.16.7 — read-only Rotation Insights

## Implemented change

**Rotation → Insights** now shows factual usage from the existing, validated
confirmed-wear ledger. It no longer consists only of an unavailable/raw Engine
report. That existing Engine report is retained as a separate disclosure.

Select the last 30 calendar days, last 90 days, or all recorded dates through an
explicit cutoff. The initial cutoff is the current Work & date setting. Changing
it inside Insights does not modify Work & date, preferences or the current outfit.

The view reports confirmed entries, distinct recorded dates, distinct exact
physical outfits, suit/blazer/shirt-only breakdowns, manual/Engine origins,
tied/No Tie entries, and explicitly stored controlled-repetition flags. Repeated
entries on one date remain separate entries, not separate days. Repetition is
not inferred from similar outfits and no cooldown or compliance verdict is added.

Per-item search shows the current recorded item name and exact physical ID,
count in the selected range, and last-recorded date through the cutoff. The
last-recorded date deliberately includes older logged wear outside the chosen
count window. Missing recorded wear is not interpreted as never worn. Future
entries and older out-of-range entries are disclosed as excluded, not deleted.
Catalogue order remains the default; optional sorting is by factual count or
last-recorded date, not a recommendation ranking.

Physical IDs remain independent even when their image files are identical.
Matching suit trousers are part of the suit record; no separate trouser record
is invented. Null tie/watch choices are not counted as garments. The statistics
retain all 50 suit-shirt identities, including suit-only/deferred non-suit IDs.
That historical roster does not activate any additional non-suit shirt.

## Data and authority boundaries

Insights writes **no storage**, changes **no session**, and creates **no wear
records or Favorites**. It reads a validated snapshot of the current browser's
loaded wear ledger. Favorite saves, outfit views and Engine generation alone do
not count as wear. No new namespace, schema, source lock, rename or migration is
introduced. The statistics do not automatically synchronize between devices.

Blocked or incompatible wear data is shown as unavailable, not as a clean empty
ledger. Invalid cutoff dates clear the stale summary and show an error. Changing
filters cannot change the current render, preferences, date setting or scores.
No sample wear is loaded by application code. All test records in the evidence
are synthetic and confined to the test harness.

## Controlling source and preserved work

Input: `HEWRS_CONNECTED_APP_V1_16_6_18_ONLY_SOURCE.zip`.
Bytes: **259,046,155**.
SHA-256: `89b8c75463752043af0963a2e906e6da16331611a42d9f15423d1cee3d058aff`.
All **1,421 payloads** and the package's existing verification assertions passed
before the **1,422-file** tree was copied for this implementation.

The 18-shirt-only scope remains controlling. DS041 and the other 31 deferred
shirts are not activated in blazer/shirt-only modes. All 50 shirts remain in
suit mode and Wardrobe; all 18 suits, 14 blazers, 24 physical trousers and existing
footwear/watch IDs are retained. This is not a new app, wardrobe or facelift.

All **705 existing runtime image files remain unchanged**. No image is added to
assets/ or assemblies/. Existing renderers, DS023 cleanup/edge derivatives,
scoring, source data, palette/CSS, mobile-sheet logic, storage and Favorites
modules remain byte-identical. The new `src/rotation-insights.js` is read-only;
`src/application.js` connects it to the existing Insights control and modal.
HTML/build files load the new module and version changed scripts as `?v=1167`.

The user's approval of V1.16.6 is recorded separately from testing. It is not
interpreted as a physical-device or hosted acceptance test of that feature.
Prior recorded DS023/mobile-picker/persistence passes remain closed.

## Fresh validation

**63 functional checks passed, zero failed:** 32 new Insights checks and 31
inherited Favorites regressions re-executed against the independently restored,
verified 18-shirt V1.16.5 fixture. New checks cover exact record reconciliation,
range boundaries, future/older exclusions, leap dates and civil calendar math,
same-day records, complete outfit identity, shared-image physical IDs,
null roles, deferred suit-shirt history, malformed data/source locks, immutable
reports, search/sort semantics and complete separation from storage/Favorites.
A valid synthetic **10,000-event ledger** is counted without deduplicating
legitimate repeated log entries. Routing counts are not rendered-frame counts.

**26 Chromium checks passed, zero failed.** The browser suite uses actual local
application scripts and images loaded into memory, with a separately seeded
synthetic storage map. All **90 complete outfit comparisons** against V1.16.6
are pixel-identical: 18 connected non-suit shirts, tied/No Tie, shirt-only/B03,
plus DS023 under all 18 suits. No new garment approval is inferred from this.

Actual UI tests open the Insights button, change date windows, cutoff, group,
sort and text filters, exercise empty and invalid states, and inspect exact
counts and names. Complete wear/Favorites bytes and write-call counts remain
unchanged during all Insights interactions; current outfit pixels, scores and
preferences are unchanged. The 18-shirt picker, Cancel, Favorites duplicate-save
guard and one-screen Home layout remain intact. The old Engine report remains
accessible. A separate blocked-ledger page retains raw invalid data and reports
unavailable instead of inventing zero counts.

Five viewport checks include 320 x 568, 390 x 700, 390 x 350, 430 x 932 and
1024 x 768. Long lists scroll inside the existing sheet; Close stays reachable.
The two 390 x 700 screenshots were visually inspected. The summary screenshot
is explicitly labeled **synthetic test records, not owner history**.
Reinitializing another memory-loaded page from the same synthetic ledger
reproduces the same counts without logging anything; this is not actual-browser
restart certification.

A separate standard-library HTTP test checked **49 resources**, including the
new versioned script and updated application URL, for exact delivered bytes.
One genuine localhost persistent-profile attempt was **blocked before app
loading** by `ERR_BLOCKED_BY_ADMINISTRATOR`, with zero server requests. It was
not bypassed and is not counted as a passing hosted/browser test.

An initial synthetic Favorites fixture used an invalid ID prefix; the test
fixture was corrected to the existing `favorite_` contract and the suite rerun.
The inherited Favorites suite exceeded initial synchronous tool timeouts and was
then run to completion; the final 31-check result above is the completed run.
No failed/aborted invocation is included in a passing count. Exact V1.16.6 source
rollback was reconstructed and verified in a separate folder.

## Update and rollback

The cumulative update supports the exact **18-shirt V1.16.5 or V1.16.6** trees.
It includes Favorites when starting from V1.16.5; installing the previous
Favorites update separately is unnecessary. It does not support the conflicting
19-shirt DS041 V1.16.5 package.

Copy the **contents of `FILES_TO_COPY`** into the existing candidate repository,
replacing matching files and retaining all other files and `.git`. Keep the same
site origin and browser data. No new repository, Pages setup or data clearing
is required. The included installer can instead verify an exact baseline and
create a separate complete target folder. Update targets are checked against
the packaged target file hashes. `CHANGED_FILES.json` contains exact modified/new
paths and before/after hashes; self-manifests exclude their own hashes.

`python -B tools/verify_v1167.py` verifies the whole target.
`python -B tools/rollback_v1167.py --check` checks rollback source bytes.
`python -B tools/rollback_v1167.py --output NEW_FOLDER` restores exact V1.16.6
in a new destination. Existing destinations are refused. Neither update nor
rollback accesses browser storage. V1.16.6 retains Favorites; Insights introduces
no new stored state to migrate or remove on rollback.

## Remaining limits

New Insights hosting/iPhone/Safari acceptance is not yet verified. The simulated
small viewport is not a physical keyboard/device test. The 32 deferred non-suit
shirts are not blockers for the current 18-shirt scope. Shirt-only numerical
ranking, weather/season integrations and other explicitly unavailable functions
remain uninstalled. Watch images remain deferred; ID/name is sufficient.
Existing source-resolution, outer collar/shoulder and straight-waistband limits
remain unchanged. No GitHub write or public deployment was performed.
