# HEWRS V1.22.0 — S02 source correction and local preference learning

## Delivered result

This is an executable update to the existing V1.21.1 LOOKBOOK application. It installs the approved S02 description throughout the active interpreters and their dependent calculation cache. It also adds explicit complete-outfit A/B feedback, a small regularized local preference model, bounded personalized ranking, and learned-feature list similarity. It is not another written-only plan and does not enable a paid private AI service.

**No owner preferences have been invented or preloaded.** At delivery the learned overlay is inactive. Other than the S02 source correction, the baseline rules remain in effect until enough actual informative choices exist. Synthetic test results establish operation and constraints, not that the updated recommendations match the owner's taste.

## 1. S02: production source correction, not a recolor

The confirmed record is muted medium brown with very subtle charcoal-grey details and a fine tan-brown overcheck, restrained Prince of Wales/Glen check. The input overlay preserves the old source separately and changes only S02. All active source/legacy/personal/research interpreters agree on its brown family, ordinal value2.6 and low pattern contrast1.2. These coordinates are inherited modeling assumptions, not measurements from the screenshot.

All112,392 current derived index rows were independently recalculated. **110,180 non-S02 results are unchanged.** Among2,212 S02 rows,1,921 numerical values and360 eligibility flags intentionally change. The corrected S02/navy-open-collar example is no longer stopped by the former dark-value interpretation. This is dependent-source correction, not a blanket switch-off of compatibility checks. All2,350 frozen shirt–tie lookups and original raw input/score files remain unchanged. Previous derived sources are preserved in provenance and rollback.

S02's rendered fabric still has a stronger check than the supplied photograph. No avatar, jacket, trouser, shirt or tie pixels are changed. Its card displays the discrepancy and links to the exact supplied fabric crop. S02 is excluded from training, rather than teaching the model to compensate for a known inaccurate depiction. The source correction does not pretend the appearance repair has happened.

## 2. Explicit local feedback

New entry points: **Home → Style → Stylist settings → Outfit preferences · compare and learn**, and **Outfits → Outfit preferences**.

The owner compares actual detached compositor renders and can choose Prefer A, Prefer B, Both work, Neither works or Skip. Scores/method names are hidden, exact owned item IDs remain visible, and Collar detail switches to an actual crop. Both images must load and validate before voting. The existing main outfit is not selected/replaced to render the comparison. On the phone, the cards stack in the internal scroll area while vote controls remain reachable.

The24-pair pilot has16 training and8 reserved validation pairs. It contains no votes. Current generated options can also be compared. Reversed duplicate pairs are not counted twice. Optional reason categories are stored without fabricated weighting. Both/neither are retained but do not create directional labels; skips create no record. Pause/resume, confirmed Undo last, separate export and validated preview/merge import are implemented.

Feedback lives only under `hewrs:outfit-preferences:v1`. Wear, Favorites, weather and backups keep their existing stores. New preference exports must be kept separately; no cross-device sync is introduced. The UI explains session-only storage when necessary. Corrupt/stale data is not silently reset. UI writes use Web Locks when available plus existing revision checks; the no-Web-Locks fallback is not claimed to be a perfectly transactional cross-tab database.

## 3. Genuine fitted model, with stated limits

Directional votes fit a twelve-feature pairwise logistic model with L2 shrinkage. The features concern tie dominance, competing patterns, saturation/value structure, pale-tie readability, open collar, palette coherence, shirt depth and contextual footwear. They are semantic heuristics, not learned vision embeddings. No exact-ID, brand, price or favorite-tie bonuses are added.

The overlay activates only after8 informative A/B choices across3 training topwear groups. This is an experimental starting threshold, not proof of adequate training. Validation topwear groups never enter fitting. A small held-out agreement count cannot certify whole-wardrobe taste performance.

The bounded learned adjustment is at most±0.35 on the existing preference scale. The baseline research estimate, current source-derived compatibility, learned features and fitted adjustment are all separately disclosed. Contextual shoe ordering uses the same learned contribution. Only when active, a weighted learned-similarity term joins existing whole-list curation inside the unchanged.25 quality band. No preference creates a new color quota or relaxes source constraints.

Full specification and numerical choices: `LOCAL_PREFERENCE_MODEL_V1_22_0.md`.

## 4. Fresh verification

| Audit | Executed work | Result |
|---|---|---|
| Source and dependency correction | 6 preservation/source checks; all112,392 rows;2,350 original shirt–tie lookups;135 other canonical profiles;848 original garment images | Only documented S02 derived changes; source/cache revision lock enforced |
| Feedback and fitted model | 24 checks covering cold start, explicit/neutral labels, actual feature-direction learning, activation, held-outs, duplicates, import/export, stale/corrupt/failed writes, pause/undo, S02 exclusion, bounded pruning and source holds | All passed; synthetic labels never represented as owner feedback |
| Generation |33 cold plus33 synthetic-learned cases: FREE,18 suits and14 blazers; five extra exact/family/No Tie cases per completed driver; cached-model invalidation |20 per neutral case except B14's existing16-trouser-cap limit;20/1/2 limits independently counted |
| Interface, rendering and race handling |19 comparison/UI checks plus7 actual learned-Generate checks;32 exact native before/after controls; all20 learned S10 positions; five viewport sizes |All passed; after-render preference change restores prior native frame; during-generation change is refused |
| Weather, parsing, delivery |22 automatic-weather and21 transport checks;854 source parser checks;1094 actual loopback resource-byte checks |All passed; provider inputs simulated and no live phone/host certification claimed |

**Named functional total: 73 passed,0 failed. Chromium total: 26 passed,0 failed.** The broad66-case matrix is additional, not inflated into those named totals. It contains1,312 complete option configurations across cold/synthetic-learned runs. Thirty-one non-S02 anchored cold lists match the previous delivered options exactly. FREE and S02 may change because the approved source interpretation is now active. All33 synthetic-learned sequences differed from cold sequences, demonstrating that saved decisions reach real ranking; this is not a claim that those fictional labels improved taste.

The actual Generate button produced the same20 learned S10 selections as independent Node execution, and each card's selected IDs were checked through navigation. Generating/viewing did not add votes, confirmed wear or Favorites. Preference changes during async generation and after the native image completed were both reproduced and correctly rejected; the latter restored the preceding exact pixel frame.

The model was recreated from synthetic stored votes in a new memory-loaded page. This is a persistence logic test, not actual physical browser-restart certification. Mobile-sized viewports are not a physical Safari test. Original approved geometry/images are unchanged; new source-photo display is a copy, not an edited garment.

## 5. Performance and data boundary

The final cold unrestricted local run took about46.9seconds; the synthetic learned unrestricted run took about70.9seconds in this environment. Individual suit tests were generally much faster. These are observed local timings, not promised phone speeds or a claim that preference learning improves latency. The bounded full-tie candidate search yields progress and remains cancellable. Known clipping and render-source issues are not hidden by a ranking feature.

No API credentials, paid provider calls, private-site activation, GitHub push, live website inspection or owner-browser data access occurred. The new local preference namespace contains no owner records in this package.

## 6. Package identity and rollback

The baseline is the exact LOOKBOOK V1.21.1 variant (2,428 payloads plus manifest). Its manifest SHA-256 is `51a11a55f035d46f97774b1a94316e857deea05751957d1023e18affb1af0978`. Reconstruction used existing mounted source/update files rather than the known truncated V1.19 full ZIP. Input archive CRC/hash identities are recorded in `INPUT_RECONSTRUCTION.json`.

The new update supports that exact LOOKBOOK variant. `CHANGED_FILES.json` lists actual old/new file hashes. `PACKAGE_SHA256.json` covers every final payload except itself. The update installer verifies source and update hashes and creates a new target; the rollback restores exact V1.21.1 in a separate folder. Both are read-only with respect to browser data. Actual replay/container checks and archive hashes are recorded in the external delivery receipt, avoiding circular archive hashes.

## 7. Development attempts, not passing evidence

An early synthetic direction test selected a shoe-decoration feature that did not vary in those particular stimulus pairs; the fixture was corrected to compare formality where it actually varied and to mark equal cases Both. No user ratings were fabricated. An early browser locator selected the hidden underlying Full/Collar control instead of the comparison modal; the test was scoped to the modal. A transient syntax typo in a search-cache optimization was caught and corrected before final execution.

The first matrix completed cold cases, then was terminated by resource pressure when a learned free search ran concurrently with a browser. A loose conservative pruning bound was tightened using a tested analytical feature bound and per-candidate cache, without eliminating eligible candidates. The final cold and synthetic-learned matrices ran to completion sequentially on the final code. Their data, runtime hashes and independent counters are separate from `attempts/`; the aborted/older-bound results are not counted as fresh successful runs.

An initial packaging rollback check caught a missing saved copy of the baseline change ledger, before any ZIP was delivered. The packaging step now preserves that ledger explicitly; final installation and rollback must pass before release. This failed preparation is not counted as a successful check.

## Final assessment

The approved S02 source information is now installed in executable source and dependent calculations, not just in a comparison wrapper. Explicit local votes now genuinely influence outfit and footwear ranking and whole-list curation. At delivery there are no owner votes, so personal taste improvement remains to be established with actual comparisons and held-out checks. The source/render mismatch for S02 is visible and protected from learning; it has not been cosmetically concealed.
