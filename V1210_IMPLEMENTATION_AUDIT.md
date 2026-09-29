# HEWRS V1.21.0 — implemented20 options, unique ties and full-palette review

## Delivered change
The owner's approved policy is implemented in the existing application. The target is20 complete clothing configurations. Every unanchored tie ID can appear once; other unanchored physical items remain at most twice. Exact anchors exempt only that exact item. No Tie is capped at2 unless explicitly selected. Family preferences grant no exemption. The summary and method selector show the new limit.

This also corrects the automatic under-selection diagnosis. It does not merely request five extra rows from the same tie-biased ranking. Recorded pattern scale/contrast and light silver/pearl wording are interpreted more faithfully; tie direction is evaluated against both surrounding garments; pale-tonal and supporting lighter-tie structures are recognized; the dark-tie-heavy reference prior is moderated. No fixed bonuses for the21 reported IDs, no compulsory pale/silver positions and no tie/color quotas are introduced. Original wardrobe facts/grades are unchanged.

Before final selection, every source-eligible tie receives a review of complete outfits. Strong found leaders for each tie remain in the candidate pool. Per-generation tie diagnostics record matching/source counts, score holds, complete assessment counts, best found configurations, final appearances and exclusion dispositions. Candidate coverage is not a requirement to choose every tie. The search is bounded/deterministic and does not claim a mathematically optimal final set.

## Isolate count, repetition and ranking changes
All four rows use the same controlled setup: each exact suit/blazer selected, other five preferences unlocked including watch, Clinic/AUTO, empty synthetic history, no weather restriction, date2026-09-29. Each variant also has a separate genuine no-anchor case. The intermediate variants are in-memory sensitivity tests, not extra application versions or new downloads.

| Variant | Options across32 suit/blazer lists | Different tie IDs in those lists |
|---|---:|---:|
| Actual V1.20.0:15 options, tie up to twice |480|25|
| Old model: only target20 |636|26|
| Old model: target20 and tie once |636|33|
| V1.21.0:target20, tie once and corrected complete-outfit review |636|44|

All18 suits and13blazers return20. B14 returns16. The fully unlocked request returns20. These figures are not claims about arbitrary weather, locks or the owner's actual browser history. Original15lists contained480 options; all20targetvariants total636 rather than640 because B14 is genuinely limited to16 by its existing scored trouser pool.

### Pale/silver ties now appear without being individually anchored
| Tie | V1.20 appearances in480 options | V1.21 appearances in636 options |
|---|---:|---:|
| T017 powder-blue/silver paisley |0|26|
| T019 silver lattice |1|4|
| T026 ice-blue/silver monogram |0|17|
| T041 silver-grey monogram |0|7|
| T044 silver-grey tonal floral/paisley |0|20|

The once-per-tie constraint applies separately to each output list, not as a once-only wardrobe or wear restriction. Appearance counts above span32 different anchored-topwear tests.

**Not every tie appears:** T042,T043 andT047 were reviewed and had eligible complete candidates for every one of the32 topwear tests, but did not reach the final lists under these conditions. They are not blocked or deleted. Each of all47 individually anchored tie tests returned20. This distinction is retained in ALL_47_TIE_COVERAGE.csv; those anchor checks are diagnostics, not an instruction that the owner must anchor ignored ties. There is no claim that the automatic ranking must contain all47 in20 positions or that coverage count itself is a taste score.

### B14: explain a real constraint instead of hiding it
Its current source-eligible scored pool contains eight physical trousers. Two uses per unanchored trouser gives an upper bound of16. The old model with target20 also returns16, showing this is not a new tie-policy failure. The application now reports the eight-trouser constraint explicitly. A separate test anchoring B14 and PG002 returned20, while every unanchored tie still appeared once. No excluded/unscored trouser profile was assigned a fabricated value to force20.

## Actual validation
**77 named functional checks passed; zero failed.** These comprise20 option/interpretation contracts,2 source-capacity checks,5 full-original-score checks,7 state/routing checks,22 automatic-weather fixture checks and21 provider/transport fixture checks. Contract cases include all47 ties individually, exact and family locks, explicit No Tie, curated/legacy method separation and unknown/stale inputs. The132 four-way matrix requests are additional cases, not inflated into named-check totals.

**20 in-memory Chromium checks passed; zero failed.** Using actual current application scripts/images,90 native baseline/current outfit frames are pixel-identical, including DS023 under all18suits and18 non-suit shirts in tied/open states under B03 and shirt-only. The real Generate button was used for FREE,S10 andB14; all56 returned positions were navigated and matched to independently generated Node selections. Twenty-option and sixteen-option displays, exact IDs, per-tie counts, the B14 reason, Collar Detail/Full Outfit, method Apply/Cancel and five viewport sizes were checked. No test generated confirmed wear or Favorites. The three photo sheets were visually inspected; they show real wardrobe assets, not generated substitute clothes. Watches are itemized, not pictured.

Original data preservation: **136 canonical features,2,350 frozen shirt–tie lookups and112,392 freshly recalculated original ensemble results have zero differences**. All848 existing runtime images remain byte-identical. The new local styling estimate/order intentionally changes and remains separate from original compatibility. Existing CSS, renderers, weather/service coordinator, history/Favorites/Insights modules, source lock, physical IDs and18-shirt non-suit scope remain unchanged.

**782 prepackaging parser checks** cover JavaScript/CJS syntax, Python AST and JSON structure; they are not execution of every historical helper. **914 local HTTP resources** matched source bytes including versioned scripts and848 runtime images. New full-package verification and exact installation/rollback are separately recorded in the final receipt. No fresh successful hosted-site or physical Safari test is asserted.

## Five audit passes
1. Verified reconstructed V1.20.0 baseline and unchanged original wardrobe, images and scores.
2. Implemented/tested source interpretation,20/1/2 rules, all-tie access and honest source-capacity limits.
3. Compared count-only, uniqueness-only and complete-correction effects across the entire suit/blazer roster and free Engine Choice, with independent counters.
4. Re-executed current data/weather regressions and exercised the actual compositor, Generate, navigation and mobile-size UI.
5. Parsed source, checked HTTP delivery, verified source manifests, replayed installation and rollback, and checked archive CRC/hash identities.

The exact generated requests, item lists, tie diagnostics, tests and output scopes are supplied. None of these checks is proof of universal aesthetic correctness. Legacy reports kept in inherited folders are historical, not fresh results.

## Performance and development boundary
The added per-tie complete-outfit evaluation performs more work. In the final Node matrix, the unrestricted request took approximately49seconds in this environment, versus roughly14seconds for the old15 baseline; suit-specific cases were much faster. The browser workflow completed, yields progress, and supports cancellation. These are environment-specific measurements, not a promised phone completion time. The new broader review trades additional work for candidate coverage; no live AI call or fee is involved.

An initial test incorrectly asserted20 for every garment, stopping at B14's legitimate16. The source-capacity cause was independently checked; the error message and test expectation were corrected, and the entire current33-case matrix rerun. A concurrent old20 sensitivity test was killed by memory pressure after B10; its remaining cases were resumed sequentially from recorded completed rows. No incomplete run is counted as an extra pass. A local aggregation-script typo was fixed before producing the final coverage tables; it did not affect runtime code or matrix results. Resource-limited attempts are documented, not hidden as successful executions.

## Install and rollback
This update supports **V1.20.0**, not arbitrary older versions. Extract HEWRS_V1200_TO_V1210_TWENTY_UNIQUE_TIES_UPDATE.zip. Copy everything inside FILES_TO_COPY into the existing candidate repository, replace matching files, retain every other directory and.git. Do not upload the review gallery as the app, create a new repository, or clear browser data.

Commit summary:
`V1.21.0 — 20 options, unique ties and full-palette tie review`

Select Home → Style → Stylist settings → **Research-based wardrobe generator — local (up to20)**. Existing explicitly selected modes are retained. Curated remains finite; private AI remains paused. No API setup is needed.

`python -B tools/verify_v1210.py` verifies the complete target.
`python -B tools/rollback_v1210.py --check` verifies restoration sources.
`python -B tools/rollback_v1210.py --output NEW_FOLDER` reconstructs exact V1.20.0 without browser-data access. Keep the same site origin. No saved wear/Favorites migration or deletion is necessary.

## Source identity and audit records
The V1.20.0 tree was reconstructed from already mounted source/update archives. All2,153 payloads and the original manifest matched; the manifest SHA-256 is76aeb040e593f869b077d8faf2b6d4fe8d295bd81dae73f6446c3aeaaac8e8c5. This is exact source-file identity, not a newly measured original fullZIP-container hash. Archive reconstruction inputs and CRC/hash checks are recorded separately.

Current evidence: evidence/twenty_ties_v1_21_0. Start with FIVE_PASS_SUMMARY.json, ABLATION_SUMMARY.json, ALL_47_TIE_COVERAGE.csv, ALL_32_COUNTS.csv and browser/RESULT.json. MATRIX_target.json contains per-request diagnostics for every tie. The final external receipt carries source/update archive hashes, CRC and installation/rollback checks, avoiding self-referential archive hashes.

**No application files were pushed to GitHub, no paid service was activated, and no owner-browser data was accessed by this session.** This is an implemented reversible source update, not a claim of independent live deployment.
