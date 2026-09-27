# HEWRS V1.17.3 — five-pass colour, ensemble and option-list audit

## Result and scope

This is a correction to the actual V1.17.2 source, not a new wardrobe or facelift.
The user reported weather working on 27 September 2026 at 20:15:32 UTC. The weather
module, provider handling, saved-weather logic and mobile layout are unchanged.

The existing 18 connected non-suit shirts, all 50 suit-mode shirts, 18 suits,
14 blazers, physical trouser/shoe/watch IDs, and restored T001–T047 textures remain.
The other 32 non-suit shirts are deferred. No additional garment approvals are
requested. No garment image or geometry was edited during this release.

This audit found reproducible colour-interpretation and list-composition faults.
It does not establish that every subjective pairing is ideal or that every
historical source-description/image conflict has disappeared. The user did not
include a specific offending outfit ID/screenshot in the latest request.

## Corrected colour and ensemble faults

1. **A substring error turned dark into light.** The parser matched `ice` inside
   `lattice`. T012's current source says `Black tonal lattice`, but its derived
   categorical lightness was 4.5. The correction requires literal word boundaries;
   T012 is now the existing black value, 0.35. T007's lattice accent no longer
   falsely triggers `ice`. Genuinely stated ice-blue, including DS015, retains
   its existing light interpretation. T019 retains its explicitly recorded
   `Silver / very light cool grey` qualifier instead of being accidentally
   darkened by removing the substring bug.
2. **Mixed blue descriptors were flattened into neutrals.** The current records
   explicitly call S08 and S14 `Dark charcoal blue` and DS029 `Ice/silver-blue`.
   Those descriptors now use the existing blue-family calibration rather than
   charcoal/grey. This does not change source descriptions or repaint clothing.
3. **The adapter retained stale tie-family fields.** Eleven tie catalogue family
   values disagreed with the current bound source-derived primary family. They
   are now derived from that same source rather than older catalogue metadata.
   Examples: T036 purple rather than historical black, T026 ice-blue rather than
   grey, and T016 burgundy-red rather than generic red. All eleven before/after
   entries are in `SOURCE_COLOUR_AUDIT.json`.
4. **Picker and generator now use the same family categories.** Literal text
   searching previously omitted charcoal from Grey and taupe from Brown. Family
   filters now follow the current source-derived family used for generation.
5. **The numerical cache is rebuilt and version-pinned.** The 112,392-row cache
   is recomputed from the corrected engine. An incompatible colour-normalizer
   revision is rejected rather than silently mixing new parsing with old scores.
   Modified runtime URLs are explicitly versioned `?v=1173`.

### What numerical results do and do not change

The raw DNA/source records, owner corrections already contained in those records,
exact IDs and 2,350 frozen Shirt–Tie lookups are unchanged. The tied formula stays
35% Shirt–Tie + 25% Topwear–Shirt + 25% Topwear–Tie + 15% Ensemble minus conflicts.
The independent No Tie calculation, blazer–trouser foundation, hard-conflict
thresholds, style classifier and base near-equivalent rotation policy remain.

Correcting an input interpretation necessarily changes some **derived ensemble
estimates**. It would be false to describe every old score as unchanged:

| Independent comparison of all indexed rows | Result |
|---|---:|
| Rows audited | 112,392 |
| Complete calculation results unchanged | 106,007 |
| Calculation result objects with explained colour changes | 6,385 |
| Numeric ensemble scores changed | 5,800 |
| Candidate-eligibility flags changed | 174 |
| Frozen Shirt–Tie lookups changed | 0 / 2,350 |

Every changed row involves S08, S14, DS029, T007 or T012. The complete row-level
ledger is retained. The source-defined weights were not tuned to produce more
variety. Existing ensemble estimates remain labelled as estimates; this work does
not promote a proposed numerical model into owner-certified aesthetic scores.

Existing premise/data holds, including DS011/DS040/DS042/DS043, remain explicit
and excluded from automatic scoring. Nine unbound physical-trouser numerical
profiles remain unavailable rather than receiving fabricated values. These
scoring holds do not revoke garment approval or delete the associated inventory.

## New option-list policy

**One unanchored physical item can occur at most twice in the current returned
list.** This covers suits, blazers, shirts, ties, separate trousers, shoes and
watches. The constraint is on physical IDs, not colour names or image hashes.
DS001/DS014, DS024/DS025 and other shared-image physical IDs remain independent.
A shared colour layer can therefore look alike while representing different
physical garments; no IDs are merged to make a list look different.

An **exact item anchor exempts only that item**. Anchoring S05 does not exempt the
shirt, tie, shoes or watch. Anchoring a colour family does not exempt all members
of that family. Null watch/No Tie are choices, not physical garments counted as
items. Explicit locks are never silently relaxed.

The owner's phrase `no shirt options only` is ambiguous between open-collar and
no-jacket looks. The implementation keeps them separate and applies both
conservative defaults: **No Tie <= 2**, and **no-jacket shirt-only <= 2**, unless
the corresponding configuration is explicitly selected. Selecting `No Tie` lifts
only its configuration cap; the physical-item caps still apply. No-jacket
shirt-only still has no installed numerical model and remains exact manual
Anchor selection; its new policy guard does not invent automatic scored options.

The selector retains the existing confirmed-wear/0.2 near-equivalent rule for the
recommendation, then constructs a score-ordered list satisfying the owner caps.
Existing accessory suitability rules choose eligible shoes/watches within their
remaining capacities. There is **no diversity bonus in compatibility scoring**.
Complete duplicate outfits and accessory-only variants of the same physical
clothing configuration cannot pad the list to 15.

The tested unlocked request produces 15 complete options. Restrictive locks or
families can return fewer with an explicit reason. The bounded deterministic
selection is not a proof of a globally optimal combinatorial set; the message
says `Found N`, not `Only N can possibly exist`. There is no hidden cap relaxation.

## Five distinct audit passes performed for this release

### Pass 1 — delivered source identity and scope

Reconstructed exact V1.17.2 from the mounted V1.17.1 source and delivered tie update.
All 1,832 payload hashes plus the original package manifest were checked. The
original manifest SHA-256 is
`02ce479182f585136bdddf421d96601ec23d50de6dce40f319f1b02480a5c3b6`.
The baseline was kept separate and unchanged. The new owner rules and weather
confirmation are recorded in `PASS1_INPUT_INTEGRITY.json` / `OWNER_REQUIREMENTS.json`.

Public Pages/raw-file reads failed, and an authenticated GitHub connector was not
connected. This pass verifies delivered local source, **not current hosted bytes**.
It does not claim that this session uploaded anything to GitHub.

### Pass 2 — source colour, score and cache audit

**12 functional checks passed; zero failed.** All 136 current source-derived
feature records were compared. All 2,350 frozen pair lookups and 112,392 ensemble
rows were independently re-evaluated against the baseline. The five corrected
profiles and eleven stale-family fixes are enumerated. Formula weights, holds,
physical IDs, raw input lock and rendering bindings remain protected. Family
picker parity and mixed-index rejection are explicitly tested.

Evidence: `PASS2_COLOUR_AND_ENSEMBLE.json`, `SOURCE_COLOUR_AUDIT.json`,
`ENSEMBLE_CHANGED_ROWS.json`.

### Pass 3 — independent option constraints and behaviour

**26 checks passed; zero failed.** Twenty-seven recorded real engine scenarios
cover unlocked selection, each exact anchor type, multiple accessory locks,
explicit No Tie, tie-required/open-collar formality, seven tie families,
CLASSIC/HYBRID/MODERN, manual weather fixtures, confirmed history, source holds,
legacy requests, duplicate/tamper rejection and cancellation. A separate counter
checks every actual physical ID; it does not trust the policy's own counters.
A separate policy test distinguishes no-jacket from No Tie.

The baseline reproduction had a watch in all 15 options, shoes/trousers up to six
times, a tie five times and three No Tie options. The corrected unlocked result
has no unanchored physical item over two and exactly two No Tie options.
Source DNA, catalogue, wear and Favorites are not mutated by generation.

Evidence: `PASS3_OPTIONS_POLICY.json`, `BEFORE_OPTIONS.json`, `AFTER_OPTIONS.json`.

### Pass 4 — actual renderer and UI comparisons

**17 Chromium checks passed; zero failed.** These use actual application scripts
and images with isolated synthetic storage. They are **in-memory Chromium**, not
an independent hosted test or physical iPhone certification.

All **166 full-resolution before/after frames are pixel-identical**, covering all
50 shirt IDs under S05, all 47 ties, all 18 suits, all 14 blazers, all 18 connected
non-suit shirts in tied/open-collar shirt-only controls, and the saved reference.
Every one of the 15 new Engine options was selected using actual navigation and
matched to its displayed canonical IDs. Exact partial anchors, explicit No Tie,
Apply/Cancel, Collar Detail, existing weather-panel cancellation and five viewport
sizes were exercised. Viewing/generating does not add wear or Favorites.

Current 47-tie, 50-shirt, 18-suit and 14-blazer render boards and the new 15-option
board were visually inspected at board scale. This verifies routing and visible
composition continuity, not photographic colour calibration of every garment.
All **848 current runtime image files** remain byte-identical: the older 705 and
143 tie-restoration images. No new garment pixels were installed.

Evidence: `browser/PASS4_BROWSER.json`, boards and actual UI screenshots.

### Pass 5 — deliverable integrity, replay and rollback

Checked executable syntax, versioned HTTP resource bytes, current runtime hashes,
all unchanged asset hashes and the exact file-change ledger. Reconstructed and
verified V1.17.2 into a separate folder with the new rollback tool. The cumulative
update was applied to an independent baseline and the resulting whole V1.17.3
source verified. ZIP CRC, package payload hashes and final byte sizes/SHA-256s
were checked after packaging. Final container hashes are in the external receipt
to avoid self-referential hashes.

Evidence: `PASS5_DELIVERY_CHECKS.json`, `HTTP.json`, `ROLLBACK.json`,
`TESTED_RUNTIME_SHA256.json`, `CHANGED_FILES.json`, update `INSTALLATION_CHECKS.json`
and the external delivery receipt.

Initial synchronous test invocations exceeded tool time limits. They were rerun
to completion; only completed final runs are counted above. Incomplete/aborted
runs are not treated as additional passing checks. Historical evidence elsewhere
in the archive remains historical, not fresh evidence from this audit.

## Install and roll back

This is a **new update from V1.17.2**, not a repeat of the tie-texture download.
Copy the contents of `FILES_TO_COPY` into the existing candidate repository,
replace matching files, and retain every other folder and `.git`. Keep the same
website origin. Do not clear browser data, import an older ledger or create a new
repository. Commit summary:

`V1.17.3 — correct colour mapping and enforce two-use option limits`

The optional `install_update.py --source CURRENT_FOLDER --output NEW_FOLDER`
verifies the exact supported baseline and builds a separate complete target.
`python -B tools/verify_v1173.py` checks the complete result.
`python -B tools/rollback_v1173.py --output NEW_FOLDER` reconstructs V1.17.2 without
accessing browser storage. Wear/Favorites data is neither reset nor migrated.

No GitHub commit, push, publication, provider request on the user's behalf or
browser-history alteration was performed in this session. The user's working
weather remains recorded as a user-observed pass, not a test we re-certified.
