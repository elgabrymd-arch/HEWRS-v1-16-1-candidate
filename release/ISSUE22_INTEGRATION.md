# Issue 22 — V3 garment fidelity integration

Scope: S06, S13, S14, B01, B06, B10, and B08. The implementation branch is `fix/issue22-garment-fidelity-20261122`; the merge target is `integration/issue22-v3`. The original release is pinned at `95d14073e33f2b699bdb0cdbd42504b1a1be2274`. This workflow does not publish GitHub Pages or deploy production.

## Corrections

| Garment | Rendering and effective DNA |
| --- | --- |
| S06 | Warm medium-dark gray with fine interlocking Glen check; jacket and trousers use the actual photographic textile signal. Effective color, contrast, scale, and quietness are corrected. |
| S13 | Dark blue-gray fine interlocking check across jacket and trousers; photographic pattern and color replace the inaccurate solid interpretation. Approved cut and construction remain unchanged. |
| S14 | Medium blue-gray near-solid fine weave across jacket and trousers; the previous conspicuous plaid is removed. Matching treats the pattern as quiet near-solid texture. |
| B01 | Natural matte linen with fine slubs; original navy color, cut, pockets, and ID retained. NO TIE is mandatory. Existing Work, use-case, and trouser restrictions remain active. |
| B06 | Natural matte linen replaces the false perforation. Original very pale desaturated sage color, crest, buttons, cut, and ID remain. NO TIE is mandatory. |
| B10 | Natural matte linen replaces the strong lattice. Original camel color, buttons, cut, and ID remain. NO TIE is mandatory. |
| B08 | Two bounded source-compositing scars at the middle of the jacket are repaired from adjacent pixels on the same jacket panel. Alpha, crest, pockets, buttons, placement, and DNA are unchanged. |

## Source authority and preservation

The six unchanged owner photographs in `provenance/issue22/` are the suit reference authority: IMG_1743/1744 for S06, IMG_1741/1745 for S13, and IMG_1747/1748 for S14. They are screenshots of real garments under differing lighting. Color interpretation is documented; it is not a calibrated physical color measurement.

The neutral linen swatch is generated material, not a reference photograph. It supplies matte irregular weave while the existing approved source layers supply garment geometry, local color, folds, seams, hardware, and the B06 crest. No avatar or garment design is generated.

All pre-existing files under assets, assemblies, data, UI assets, vendor, source, provenance, runtime, and reviewed-candidate directories are protected by Git blob identity. The approved V3 avatar and hand hashes, pose, and source specification remain exact. The old V3 release remains reproducible through `avatar-v3-issue22-baseline.html`; retained V2 and Standard deliveries are unchanged.

New material layers have exact original alpha, dimensions, and registration. The runtime preserves original descriptors as geometry authority and records separate display paths and hashes. The material wrapper preserves the public legacy array-shaped plan API. B08 changes only the two measured source regions.

## Matching and historical data

V3 receives a versioned six-record Garment DNA overlay and a separately generated compatibility index. The original catalogue and index remain exact. All 22,188 affected index rows are recalculated; unrelated groups retain their original values.

The NO TIE rule applies at owner-policy, direct evaluation, ranking, selection, reviewed discovery, and final renderer boundaries. Conflicting garment identifiers reject instead of allowing one field to hide a prohibited linen blazer. Exact tied-linen requests return no eligible result; no garment or tie is silently substituted.

All four styles and all three occasions are exercised. Existing strict classifiers can return zero eligible linen outfits for CLASSIC or HYBRID. B01 remains unavailable in Home contexts lacking its explicit summer-weekend-dinner confirmation. Its valid open-collar/chino rendering is exercised through the existing reviewed exploration controls.

No browser storage migration occurs. Historical Favorites, wear records, rejections, preferences, approvals, scores, and review objects remain readable and unchanged. The 21 bundled reviews involving changed materials are retained as historical judgments and cannot qualify current recommendations. The 108 unaffected base reviews remain eligible under source-exact rebinding. Ten unchanged bundled image-assessment packets retain eligibility; two S06 packets are withheld as historical. New assessment boards use the corrected component paths and hashes. No paid assessment or external service is invoked by validation.

## Verification and CI

Three separate review records cover visual accuracy, matching, and regression safety:

- `evidence/issue22/verification-visual.json`
- `evidence/issue22/verification-matching.json`
- `evidence/issue22/verification-regression.json`

Material contracts and isolated reproducibility are recorded in `material-tests.json` and `material-replay.json`. `source.json` records the immutable-source audit. These records state their actual scope; CI results and final merge identity are reported on the pull request.

The Issue 22 workflow requires all job groups to succeed:

1. Deterministic material, index, reviewed-overlay, preview, and compiled-delivery rebuilds; immutable-source checks; matching and reviewed-lifecycle tests.
2. All 534 target shirt/state full-avatar cases and 212 unrelated full-frame controls, distributed across four native shards. Every case renders both the original and current application. Eight-case process batches bound native canvas memory without replacing sources or expected pixels.
3. Material and B08 contracts; retained collar, tie, cuff, and V2 contracts. Historical source-RGB and tied-B06 fixtures explicitly run against the frozen release because those old expectations are intentionally superseded in current V3. Current target behavior is checked by the complete new matrix.
4. The existing application, rejection, replacement, persistence, and cancellation regressions.
5. Chromium and WebKit: all 84 garment/style/occasion contexts, 41 exact UI fixtures, all eligible context renders, 141 tied-linen render rejections per shard, immutable head/alpha checks, unrelated full-frame comparisons, and source-bound reviewed assessment boards.
6. Chromium and WebKit UI state, tie feedback, rejection reasons, lifecycle, Home, Favorites, and failed-read recovery.

The aggregate `Issue 22 required validation` job fails if any dependency fails, is cancelled, or is skipped. It has no deployment step. Local browser execution is unavailable in the workspace because Chromium cannot create its required Unix socket; browser results must therefore come from the CI Playwright containers.

## Reproduction

Use Node 22, `@napi-rs/canvas@0.1.100`, `fake-indexeddb@6.2.8`, Python 3.11, and the pinned browser/image dependencies in `.github/workflows/issue22-validation.yml`.

```sh
node tools/build_issue22_materials.cjs
node tools/build_issue22_index.cjs
node tools/build_issue22_reviewed.cjs
node tools/build_issue22_previews.cjs
python tools/integrate_avatar_v3.py --write
python tools/verify_active_delivery.py --check --syntax
python tests/issue22-source.py
node tests/issue22-matching.cjs
node tests/issue22-reviewed.cjs
node --expose-gc tests/issue22-render-matrix.cjs --shard 1 --shards 4
python tests/issue22-browser.py --browser chromium --shard 1 --shards 2
python tests/issue22-reviewed-browser.py --browser chromium
```

Run every shard and both browser engines as defined in CI. A single shard is not complete validation. Fine textile appearance can vary with display scale and browser sampling; no claim is made about exact fiber percentages or calibrated physical color.
