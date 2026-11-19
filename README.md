# HEWRS

[Open the current application](https://elgabrymd-arch.github.io/HEWRS-v1-16-1-candidate/).

`index.html` and `app.html` are identical current entrypoints. The active delivery is `runtime/outfit-refill-preview.js`, generated from current candidate sources with `tools/build_tie_candidate.py`.

## Current audit

The November 19, 2026 audit covers the complete current application graph: generation, all rejection scopes, shirt photographs and collars, image transport, comparison/learning, Favorites, confirmed wear, imports/exports, cross-tab state, and delivery integrity.

[PLAN.json](evidence/five_round_20261119/PLAN.json) records the actual status of the five passes. [FIVE_ROUND_AUDIT_20261119.md](FIVE_ROUND_AUDIT_20261119.md) records findings, validation and limits. The **Five-round total product audit**, **Audit every rejection path**, and **Verify live rejection integration** workflows retain browser evidence.

A tie-only replacement preserves the accepted shirt, jacket, trousers, shoes and watch. Exact scopes and occasions remain binding. An exhausted finite search returns fewer eligible options; it does not relax a rejection to fill twenty slots. Unreadable rejection storage pauses generation and display.

## Source authority

The registered catalogue, approved garment/avatar images, original numerical score data, and frozen Standard release remain authoritative. The audit repairs application behavior and image transport; it does not redraw approved images or invent replacement identities or scores.

The active shirt roster is DS001–DS048, DS050 and DS051. DS049 remains retired. DS040–DS043 are No Tie only. DS026 intentionally keeps its earlier suit insert and the separately approved small-gingham source outside suits. No Tie describes tie absence, not a promise that every source photograph has an unbuttoned collar.

Tests use disposable synthetic profiles. Updating the application does not require clearing browser data.

## Reproduce current delivery

```bash
python3 tools/build_tie_candidate.py --check --verify-base
python3 tools/audit_active_delivery.py
python3 tools/audit_product_inventory.py
node tools/audit_current_catalogue.cjs
python3 tools/audit_product_integrity.py
```

After an intentional current-source change, use `python3 tools/build_tie_candidate.py --write`. It pins direct scripts/styles, the lazy option index, reviewed-panel modules, and the suit-photo utility to actual content hashes and SRI. The pinned earlier candidate must still reproduce byte for byte.

The workflow installs isolated fake-indexeddb, Playwright and Pillow dependencies and runs behavioral checks in Chromium and WebKit. WebKit is not a physical iPhone test. Optional paid-service checks use controlled responses and make no provider call.

## Retained history

The original [V1.23.2 update instructions](docs/history/README-option-cards-v1_23_2.md), `RELEASE_SCOPE.json`, frozen manifests/runtimes, rollback trees and older audits describe their own checkpoints. They are retained historical records, not the current publication receipt.

The [code inventory](evidence/five_round_20261119/INVENTORY.json) and [lineage review](evidence/five_round_20261119/ui-round4-reachability.json) distinguish reachable code, tests/tools, historical copies and alternate entrypoints. Historical direct URLs remain separate applications; the current interface does not navigate into them.
