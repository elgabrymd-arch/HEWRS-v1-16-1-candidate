# HEWRS V1.18.0 — implemented wardrobe-wide preference recalibration

## Delivered result
The automatic/partial-anchor recommendation path now uses a separate, versioned
complete-outfit preference model. This is executable application code, not another
written proposal. It evaluates the matching source-eligible clothing pool before
choosing accessories and curating the result list. It does not rebuild the wardrobe
or change the original numerical compatibility model.

**Preserved:** 18 non-suit shirts, all 50 suit shirts, all 18 suits, all 14 blazers,
T001–T047, exact trouser/shoe/watch identities, all 848 runtime image files, restored
tie textures, accepted rendering/mobile fixes, weather transport/coordinator,
original score records/index/formulas, and existing wear/Favorites schemas and keys.

**Intentionally changed:** preference order, accessory order, visual list curation,
shade-family filtering semantics and generated-option score presentation. The new
score is labelled **Personal styling fit · heuristic**. Original compatibility
remains separate in Score Details. No original historical score is overwritten.

## What was implemented

### Full-palette source interpretation
`src/outfit-preference.js` creates a separate interpretation of the recorded source
wording. Beige/warm greige is not collapsed into chocolate merely because "mushroom"
appears. Taupe, chestnut, chocolate and medium-to-dark chocolate remain distinguishable.
Ivory/off-white, cream, beige/tan/stone, blue/pink/grey, lavender at different depths,
navy/black/burgundy, muted colors and source accents are normal candidates.

DS031's compound windowpane over micro-check is considered as two pattern layers
rather than erased by a generic "micro" rule. Quiet tonal checks retain their grid
identity; prominence, scale and contrast are assessed separately from hue. The
picker and generator use the same separate shade interpretation. Family choices
still do not exempt physical items from the two-use cap.

This interpretation uses disclosed ordinal defaults, not measurements from photographs.
All source wording and original canonical features remain unchanged. There are no
per-ID bonuses or mandatory lavender/brown/white slots. Fair consideration does not
mean forcing every color into every set.

### Complete-outfit preference and accessories
The structure model favors readable collar/shirt/tie hierarchy instead of continually
rewarding a larger suit–shirt value gap. Muted and tonal warm-neutral combinations
can remain strong. Pattern hierarchy, palette, formality, surface and blazer/trouser
foundation are assessed together. The original compatibility estimate contributes
10% of the separate clothing preference and remains an upstream eligibility check.

Eligible shoes are evaluated in the actual clothing context: suit/blazer, tied/open,
trouser color, pattern prominence and known surface. The new layer adds no clinic-
loafer, brand, price or cognac-distinctiveness bonus. Neither dark shoes nor light
shoes are unconditional winners. Watches finish the outfit without a prestige bonus.
The complete preference combines clothing 90%, shoes 7.5% and watch 2.5%.

The detailed parameters, limitations and precise role of the unchanged legacy score
are disclosed in `PREFERENCE_MODEL_V1_18_0.md`. They are personal heuristic parameters,
not a newly trained visual AI, recovered source facts, or objectively measured style.

### Curation and fifteen options
All matching source-eligible clothing candidates receive a preference evaluation.
The accessory working pool contains the strongest 512 plus best candidates for each
topwear/shirt/mode, topwear/tie and topwear/physical-trouser key. If caps exhaust that
working pool before 15, it expands to the full candidate set. Candidate coverage is
not an output quota. This bounded deterministic search is not a proof of a globally
optimal collection.

The maximum-two rule is unchanged for every unanchored physical item. Exact anchors
exempt only themselves. No Tie remains at most two unless explicitly selected.
Accessory-only variations do not pad the clothing count. A soft visual-similarity
term may choose a less repetitive candidate only within 0.20 of the best currently
feasible preference; it is not added to the original compatibility score. No color,
shirt-depth or No Tie quota is mandatory.

Confirmed-history rotation retains the original 0.20 near-equivalent policy, now
explicitly applied to the personal preference result rather than disguised as an
unchanged compatibility ranking. Weather, formality, true source holds, explicit
locks and physical limits remain active. Genuine restrictive requests can yield
fewer options; no score/hold/lock is fabricated or silently relaxed to force 15.

### HISTORY-001: generation now checks readable, current wear history
The prior audit's read-side defect is corrected. `readForGeneration()` validates and
synchronizes current backing data without writing it. A revision token is checked
before accepting the result and after asynchronous image loading. A concurrent
change cancels stale recommendations; a change during image loading restores the
previous complete frame before reporting the error. Cross-tab storage events also
invalidate cached recommendations.

Unreadable history is retained and displayed as unavailable, not used as an empty
ledger. New recommendations are blocked until a valid history can be read. Existing
session/backup/event/Favorite formats and source lock remain. This implementation
never accesses the owner's actual browser history; all test data was synthetic.

## Observed old/new results — not a fabricated style score claim
The comparison anchors each of the 18 suits and 14 blazers, leaves other clothing
unlocked, uses an empty synthetic history and no weather restriction, and omits a
watch in both sets. Each old/new topwear case returned 15: **480 old plus 480 new
configurations**. Independent item counters verified the physical-item rules.
The expanded exact-anchor matrix also covers every one of the 50 shirts and 47 ties:
**129 scenarios passed**, including explicit expected hold-limited outcomes.

For **S10**, the previous 15 all used black/navy/brown-family shirts and only **8
physical shirt IDs**. The new 15 use **13 shirt IDs**, with taupe, chestnut, ivory,
cream, lavender, blue, grey, burgundy, navy and white-ground patterns represented.
It includes **one No Tie** in this run, not a compulsory two. On the separate
heuristic depth scale, shirts below 2.3 fall from **11 to 2**. That is a change in
computed selection behavior, not a photographic lightness measurement.

S03's shirt-ID count changes **10 to 12**; B06's **8 to 10**; B13's **8 to 9**.
Not every topwear needs the same changes or every hue in its first 15. Brown and
lavender were not banned or forced. All 32 row-level comparisons and exact itemized
options are in `WARDROBE_BEFORE_AFTER_METRICS.json`, `PASS2_WARDROBE_MATRIX.json` and
`ALL_32_TOPWEAR_BEFORE_AFTER_OPTIONS.csv` under the current evidence directory.

The four before/after wardrobe sheets contain the first two returned choices for
every suit/blazer, rendered with actual application assets. The three S10 sheets
show all 15 actual navigated choices. No substitute clothing or generative portrait
was introduced. The new selection is visibly less dominated by the old maximum-
contrast formula in S10; these observations do not establish universal superiority
or owner acceptance of every choice across the wardrobe.

## Three current audit passes

| Pass | Executed checks | Result |
|---|---|---|
| 1 — Baseline and wardrobe/source boundaries | Exact reconstructed V1.17.4: 1,924 payloads plus manifest; 160 separate preference profiles; exact scope/ID and protected-file checks | PASS |
| 2 — Preference, original scores, caps and data | 81 named functional checks; 129 exact-anchor scenarios; 2,350 original Shirt–Tie lookups and 112,392 original ensemble results re-evaluated; every suit/blazer returned 15 in the stated controlled comparison | PASS |
| 3 — Actual UI/render/history races and delivery | 17 Chromium checks; 166 native pixel-equal outfit controls; 128 actual before/after frames across all 32 tops; all 15 S10 options opened; five viewports; 908 local HTTP resources; installer/rollback and ZIP checks recorded externally | PASS within stated scope |

The **81 named functional checks** are 23 new preference/routing/history checks,
5 original score/data preservation checks, 10 wear/Favorites/Insights regressions,
22 re-executed automatic-weather tests and 21 re-executed provider/transport tests.
The 129 anchor scenarios are stated separately, not inflated into that 81 count.

All original score results remain equal to V1.17.4: **0/112,392 ensemble calculation
changes and 0/2,350 frozen pair-lookup changes**. New preference values are a separate
output. All 848 asset/assembly image files remain byte-identical. The existing
CSS, rendering chain, weather service/coordinator, source index and Favorites/Insights
modules are unchanged. The modified/new-file inventory is in `CHANGED_FILES.json`.

Browser checks used current local scripts and real image files loaded into isolated
in-memory Chromium. Native pixel equality was compared directly between baseline
and target canvases, not inferred from file names. Actual UI Generate, navigation,
score detail disclosure, picker/Cancel and history-race paths were exercised. Weather
success/error/permission inputs were controlled fixtures; no fresh live-provider or
physical iPhone certification is claimed. Original clothing approvals remain closed.

Development identified and corrected a too-small accessory shortlist that returned
8/14 options on some blazers; the final full-candidate fallback passes all 32. A
preliminary repeated-PNG-export harness stalled, so equality uses direct native
pixel comparison. Another fixture tried to click Generate while still on Outfits;
it was corrected to return Home. Final pass counts refer to completed reruns only.
No incomplete or failed exploratory run is counted as a passing test.

## Input identity
V1.17.4 was reconstructed from the mounted V1.17.1 source, V1.17.2 tie update and
V1.17.4 cumulative update. ZIP CRCs and the resulting complete payload tree were
verified before editing. Its package manifest SHA-256 is:

`84871e36aebbf2d9ad98e4b115b60374e2725d737cd451904ad080410bd0c342`

This verifies source-file identity; it is not a new measurement of the original
unmounted V1.17.4 full ZIP's container hash. Independent baseline folders were kept
unchanged. The new source package/ZIP checks and sizes are in the external delivery
receipt, avoiding self-referential archive hashes.

## Install and rollback
The cumulative update supports exact **V1.17.2, V1.17.3 or V1.17.4** source trees.
Earlier color/season/automatic-weather corrections are included when starting from
the earlier supported builds. Copy the contents of `FILES_TO_COPY` into the existing
candidate repository, replacing matching files and preserving other files and `.git`.
Do not copy the ZIP or the enclosing folder into the web root. Keep the same origin
and browser data. No new repository, wardrobe export or storage reset is necessary.

Commit summary:
`V1.18.0 — recalibrate full-outfit recommendations; preserve wardrobe and scores`

`python -B tools/verify_v1180.py` validates the new folder.
`python -B tools/rollback_v1180.py --check` checks restoration bytes.
`python -B tools/rollback_v1180.py --output NEW_FOLDER` creates exact V1.17.4, refuses
existing destinations, and never accesses browser data. The exact earlier code's
history-read limitation returns with that rollback. No saved-data migration is needed.

The optional update installer verifies the exact source and writes to a separate
new directory. The delivered update targets were tested from every supported source.
No GitHub commit, push, publication, owner-history access or source image modification
was performed in this session. The new preference order has not been independently
accepted on the hosted phone. Existing test/approval records elsewhere in the package
remain historical rather than being relabelled as this release's new tests.
