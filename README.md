# HEWRS

[Open the current application](https://elgabrymd-arch.github.io/HEWRS-v1-16-1-candidate/).

`index.html` and `app.html` are identical current entrypoints. The published V3 delivery is `runtime/avatar-v3-candidate-491cd6018b9acaf098cd.js`. [AVATAR_V3_RELEASE.json](AVATAR_V3_RELEASE.json) binds the exact runtime, primary pages, source modules, avatar and hands, and the preserved V2 reference.

[The V3 release handoff](release/avatar-v3/HANDOFF.md) records the November 21, 2026 publication, completed verification and current build procedure. [PR 17](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/pull/17) integrated the approved V3 head, neck and arm/hand pose, the B15 collar fit and the saved-rejection readiness message. The eight-shirt corrections from PR 16 remain included.

## Current audit

The completed November 19, 2026 five-round audit established the application baseline: generation, all rejection scopes, shirt photographs and collars, image transport, comparison/learning, Favorites, confirmed wear, imports/exports, cross-tab state, and delivery integrity. The later V3 release extends that evidence with source-preservation checks, 456 supported outfit selections in each browser, and verification of the published V3 application.

[PLAN.json](evidence/five_round_20261119/PLAN.json) and [FIVE_ROUND_AUDIT_20261119.md](FIVE_ROUND_AUDIT_20261119.md) retain the original five-pass status, findings and limits. The [V3 handoff](release/avatar-v3/HANDOFF.md#verification-evidence) links the final candidate and production workflows for the current release. Historical audit counts and source-image limitations describe their own checkpoints; later approved corrections are recorded by their release.

A tie-only replacement preserves the accepted shirt, jacket, trousers, shoes and watch. Exact scopes and occasions remain binding. An exhausted finite search returns fewer eligible options; it does not relax a rejection to fill twenty slots. Unreadable rejection storage pauses generation and display.

## Source authority

The registered catalogue, approved garment/avatar images and original numerical score data remain authoritative. The current V3 release explicitly records its approved avatar geometry and bounded B15 collar registration. Original garment files, physical IDs, scoring sources, the immutable V2 master and the frozen Standard baseline remain preserved. The V3 pose resamples the composed sleeve/arm regions; preserving original source files does not mean those displayed pixel positions are unchanged.

The active shirt roster is DS001–DS048, DS050 and DS051. DS049 remains retired. DS040–DS043 are No Tie only. DS026 intentionally keeps its earlier suit insert and the separately approved small-gingham source outside suits. No Tie describes tie absence, not a promise that every source photograph has an unbuttoned collar.

Tests use disposable synthetic profiles. Updating the application does not require clearing browser data.

## Reproduce current delivery

```bash
python3 tools/verify_active_delivery.py --check --syntax
```

This verifies the active V3 profile, the preserved continuous-shirt/V2 baseline, primary entrypoints, content hashes, SRI and reproducible integrated build without rewriting artifacts. A shallow checkout also needs the pinned base commit; see the [complete procedure](release/avatar-v3/HANDOFF.md#verify-or-rebuild-the-current-release).

After an intentional reviewed source change, the integrated builder is `python3 tools/integrate_avatar_v3.py --write`; follow it with the verification command above and the relevant regression gates. `tools/build_tie_candidate.py` and `tools/build.py` reproduce earlier layers of the release history and are not standalone builders for the current primary pages.

The workflow installs isolated fake-indexeddb, Playwright and Pillow dependencies and runs behavioral checks in Chromium and WebKit. WebKit is not a physical iPhone test. Optional paid-service checks use controlled responses and make no provider call.

## Retained history

The original [V1.23.2 update instructions](docs/history/README-option-cards-v1_23_2.md), `RELEASE_STATUS.json`, `RELEASE_SCOPE.json`, `STANDARD_RELEASE.json`, the [accepted Stage 11 handoff](release/standard/HANDOFF.md), frozen runtimes, rollback trees and older audits describe their own checkpoints. Their historical deployment flags refer to those checkpoints. Source/preview approval markers in `CONTINUOUS_CANDIDATE.json`, `AVATAR_V3_REVIEW_BUILD.json` and `data/avatar-v3-candidate.json` remain immutable provenance; the integrated release is identified by `AVATAR_V3_RELEASE.json` and its merged production evidence.

The [code inventory](evidence/five_round_20261119/INVENTORY.json) and [lineage review](evidence/five_round_20261119/ui-round4-reachability.json) distinguish reachable code, tests/tools, historical copies and alternate entrypoints. Historical direct URLs remain separate applications; the current interface does not navigate into them.
