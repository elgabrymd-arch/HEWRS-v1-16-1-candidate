# HEWRS V1.22.1 — faster startup and equivalent outfit generation

## Delivered correction
This is a performance-only update to the exact delivered V1.22.0. It preserves that release's S02 source correction and local outfit-preference learning. It does not replace the wardrobe, ranking, appearance, weather, history, Favorites or local feedback. No GitHub write or paid/private service was performed.

The user's report was slow app loading. Source inspection found two separate avoidable waits: opening Home was coupled to unneeded large engine data and an invisible native-size outfit; generating outfits repeatedly cloned fixed metadata and recalculated identical accessory assessments. These are reproducible local bottlenecks, not independent proof of the cause of every wait on the user's phone. Public website access failed and a real-origin localhost browser attempt was blocked before any server request.

## Startup, before and after
| Delivery resource | V1.22.0 | V1.22.1 |
|---|---:|---:|
| External startup JavaScript resources | 69 | 3 |
| Uncompressed startup JavaScript bytes | 11,887,003 | 5,824,781 |
| Option index required before Home | 6,072,082 bytes | Deferred until automatic Generate |
| Hidden initial outfit loaded before Home | 14 distinct layers / 3,168,146 source bytes | Deferred until the outfit is viewed |

These are exact source sizes, **not observed GitHub transfer bytes or mobile timing**. Illustrative gzip sums are recorded separately; server compression and network caching were not certified. The full source ZIP size is not the website's startup download.

The three scripts preserve the original dependency order and use `defer`. Inputs are unchanged; the other metadata/application modules are bundled from their unchanged or documented modified source files. Content-addressed filenames and SHA-256 subresource integrity cover the loader, input data, generated UI bundle and deferred index. A build verifier reconstructs the bundle and compares its bytes to its source list. No dependency was arbitrarily switched to out-of-order async loading.

Home controls become ready without a garment image or option index. The saved selection is still validated and retained; View current outfit/Outfits restores exactly that selection without re-saving it. The first automatic generation downloads and validates the same original index. Concurrent calls share the pending download. Failure and timeout produce an actionable message; Generate can retry without deleting data. Opening Home does not generate a new outfit or log wear. Existing automatic weather handling is unchanged.

A new `HEWRS_OUTFIT_READY` signal distinguishes fully rendered outfit readiness from `HEWRS_READY` Home/controller readiness. Tests and integrations must not mistake one for the other. The index remains loaded for that page; returning to the site can reuse ordinary browser HTTP caching where available. No new service worker, offline cache guarantee or background service is installed.

## Computation optimization
1. Memoize immutable canonical binding and suit resolver results after their original checks, rather than deep-copying the same descriptors for every candidate.
2. Memoize the original shoe color parsing and exact shoe-context result. The key includes every input read by that function; it does not cache preference weights or a final ranking. Caches are bounded.
3. Reuse raw watch assessments within one generation using all relevant clothing/accessory/context keys. Capacity filtering and history-sensitive ordering run **after** lookup. The cache does not cross request/history/model changes.
4. Avoid retaining 35 shoe-choice objects on every explored candidate. Only the final curation working set keeps those choices across capacity rounds.

**No candidate pool was cut to manufacture speed.** The full tie review, 20-option target, one-use unanchored ties, two-use other items, exact locks, No Tie maximum, source holds, weather restrictions and finite B14 capacity remain. No learned vote, source fact, original score or outfit pixel was changed.

## Measured generation time
| Case | Before | Optimized |
|---|---:|---:|
| Freshly profiled unanchored generation, no trained feedback | 50.18 s | 18.96 s |
| Final full-parity matrix, unanchored, no trained feedback | prior packaged 46.95 s | newly measured 18.67 s |
| Unanchored with the same synthetic learned model | prior packaged 70.89 s | newly measured 40.06 s |

The first before/after pair was measured freshly in this session and reproduced identical selection IDs **and diagnostic objects**. The matrix compares exact previous request/result fixtures with newly executed target runs. The learned-before timing is historical and is not described as a fresh remeasurement. All timings are environment-dependent local Node wall times, not a phone promise. Full learned search can still take tens of seconds. First-generation network delivery can add time; image display can also add a separate wait.

## Completed validation
**88 named functional checks passed, zero failed:** 6 source/full-score preservation, 24 local-preference/state cases, 22 automatic-weather coordinator cases, 21 weather transport cases, 8 loader/retry/integrity cases and 7 additional exact-lock/No Tie/style/weather context comparisons.

Two complete new target matrices cover unrestricted Engine Choice plus all 18 suits and 14 blazers, with and without the same synthetic learned model: **66 generation cases / 1,312 returned outfit objects**. Every complete option object, including score, order, accessories, model metadata and canonical selection, matches the V1.22.0 fixture under the identical request/model. Every list is independently counted for item constraints; B14's existing sixteen-option capacity is retained. Seven additional context cases are freshly compared with executed baseline code, including exact shoe/watch anchors, silver tie, explicit No Tie, no watch, Classic style, warm/dry and cold/rainy conditions.

All **2,350 original shirt–tie lookups and 112,392 original derived result objects** match V1.22.0, including its corrected S02 results. All **848 original garment images** are byte-identical. Local learning mathematics and stored-feedback format are unchanged; no owner feedback was available or seeded.

**19 Chromium checks passed, zero failed.** These load the actual generated startup bundle and real source images in isolated memory with synthetic storage. The lazy index transport is explicitly injected; this is not a disguised hosted network test. Checks cover usable Home before image/index load, no startup store writes, saved selection restore, exact URL/SRI, failed download then retry, actual S10 Generate, all twenty actual card positions, cached index, responsive cancellation, real A/B feedback, five viewport bounds, and corrupt feedback retention. Native frame controls cover all eighteen suits and fourteen blazers. Native RGBA data are checked with FNV-1a for these 32 controls, supported by identical original renderer/image source bytes; this is stated as matching full-frame hashes, not a cryptographic proof of every pixel.

Existing wear and Favorites remain unchanged during generation, navigation, failure and cancellation. A real test preference vote writes only its own namespace. No user browser profile, actual personal history or real model service was accessed.

## Review and test boundaries
The screenshots show isolated test pages, not the owner's current weather, connection or data. Home/source screenshots were inspected. Browser-level controlled response tests are not physical Safari restart/device acceptance. A small in-memory Home time in the test output excludes real downloads and must not be represented as a mobile loading benchmark.

Two early browser fixtures compared the UI's honest empty-store model ID with a core fixture's separately named empty model. Selections and scores matched, but provenance strings differed. The test was corrected to execute the baseline with the actual UI request/model, and the complete suite then passed exact option equality. No application logic was changed to suppress that discrepancy. The incomplete runs remain under `attempts/` and are not counted as additional passes.

The first packaging verification caught release README/change-ledger metadata accidentally included in the unchanged-file protection list. That list was rebuilt against the final payloads, preserving all actual protected runtime/data files. The failed preparation is retained and is not counted as a pass. Metadata, parsers, the generated bundle, source hashes, exact install replay, rollback and final ZIP identity are checked separately during packaging. See the external delivery receipt for final file counts and archive hashes. Historical reports in the inherited tree remain historical, not fresh V1.22.1 tests.

## Install
Use the **V1.22.0 → V1.22.1** update. Extract and copy the **contents of FILES_TO_COPY** into the current candidate repository, replacing matching files and keeping other files and `.git`. Do not upload the ZIP itself. No private AI setup, new repository or browser-storage clearing is needed.

Commit summary:
`V1.22.1 — faster startup and equivalent outfit generation`

Opening Home no longer restores the hidden default automatically. Tap View current outfit to show the saved selection, or Generate to create options. First automatic Generate may show Loading outfit index; subsequent generations in the same page reuse it. If that download fails, check the connection and Generate again. Never clear preferences/history to speed loading.

`python -B tools/verify_v1221.py` checks exact source and ordered bundle integrity. `python -B tools/rollback_v1221.py --output NEW_FOLDER` restores V1.22.0 in a separate folder and never accesses browser data. The slower behavior returns on rollback; all saved feedback, outfits, history and Favorites remain compatible.
