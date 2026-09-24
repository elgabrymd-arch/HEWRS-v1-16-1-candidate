# HEWRS connected application V1

## What this is

A new runnable application connection assembled from the recovered controller, canonical binding adapter, Active-50 renderer, and checkpoint-98 registered footwear. It is not the corrupt application with its renderer patched, not recovered Runtime08, not a new garment-approval gate, and not the complete all-category production release.

Start with **app.html**. The separate **HEWRS_CONNECTED_APP_V1.html** delivery is the same application with its scripts, data and images embedded. No account, backend, external image service, or external script is used. This source tree does not contain or overwrite a production index.html. It has not been committed, pushed, merged, or deployed.

The original uploaded archives remain immutable. All garment, layer, avatar, and canonical-measurement approvals remain closed. Historical status strings within vendor code or data are retained provenance; they do not create a new owner-approval queue.

## Connected behavior

- **Anchor:** exact S05, shirt, tie/no-tie, and registered shoe selection produces the approved source layers. A missing/conflicting score never blocks an otherwise supported manual visual. DS040–DS043 are no-tie-only. DS027 retains the existing fastened top button. DS049 remains excluded. The DS035 retained reference remains available through the source API, but cannot be logged as an exact selected-tie outfit.
- **Engine:** the recovered ensemble calculation and current-approved/strict-historical score lookup feed the recovered selection controller. A validated controller output binds through the canonical crosswalk to the actual renderer. Clothing scores are not overwritten or fabricated. Explicit shoes and optional watches are not automatically ranked by the legacy accessory heuristics. The inherited watch-category classifier is used only as the controller's existing style evidence, not as a new watch score.
- **Outfits:** actual generated options can be selected and rendered, instead of a text-only calculation card. A compatibility option that the local rotation policy did not select is not labeled a rotation recommendation.
- **Wardrobe:** existing source IDs are browsable. There are 50 shirt, 47 tie, 35 registered shoe, 18 suit, 14 blazer, 24 trouser binding records, and 50 historical watch source records. These source counts do not replace the owner's complete wardrobe inventory. Unsupported visual categories are not silently substituted.
- **Rotation and saved data:** only explicitly confirmed local wear events are recorded. Generate, preview, startup and opening a confirmation dialog do not log wear. Existing production history is not read, migrated, reset, or replaced.

## Exact rendering boundary

The connected upper-body/suit path is **S05**, using the existing Active-50 source geometry, collars, cuffs, masks and DS051 special compositing arithmetic. The unmodified renderer is in `vendor/active50-renderer.js`.

**35 existing registered shoe pairs are now connected by exact ID.** Their checkpoint-98 bytes are copied without scaling, cropping, recoloring, fitting or re-encoding. The selected shoe descriptor occupies the existing shoe slot behind the unchanged trouser layer. With shoe-8, the original manifest and layer plan are retained exactly. Other shoes replace only that source descriptor; all native coordinates and layer order remain fixed. This is new selection wiring of approved footwear, not new shoe generation or visual reapproval.

The detached renderer composes the next full native 996 × 2748 frame. The displayed canvas is updated with `putImageData` only after the complete latest request succeeds. Loading, cancellation and replacement failure retain the preceding complete visible frame. Its displayed IDs are retained until a new frame commits. This wrapper does not change the source compositing arithmetic.

The layout constrains the full canvas inside the available Home screen. Collar mode is a CSS view transform only. Browser-size checks are documented in the test output; physical-iPhone and Safari behavior are not asserted.

**Watches are selected and saved as metadata only.** The screen expressly says they are not rendered. Other suit, blazer and shirt-only wearable assemblies are not connected here. Their completed approval status is not questioned. The complete product release still requires those assembly paths rather than substituting S05 or creating fresh garments.

## Canonical records and numerical boundaries

The original catalogue is retained in `data/inputs.json`. A new view catalogue preserves every legacy ID and reads garment descriptions from the pinned feature records/later renderer labels rather than the obsolete S05 and DS047 legacy names. The explicit existing crosswalk maps `S05` to `suit-4`; no index arithmetic is used. History records preserve `suit-4`, `shirt-DSnnn`, `Tnnn` and actual shoe/watch IDs alongside the canonical selection.

The default source policy is deliberately unchanged: the 188 owner-approved rows override the strict historical lookup. DS023's competing numerical versions and DS047's alternate historical premises are not selected merely to match a reported count. No existing numerical score or component value is rewritten. New displayed ensemble values are calculations from the recovered model; they are not presented as recovered frozen ensemble judgments.

The narrative records for **DS011, DS040, DS042 and DS043** disagree with later project-context descriptions. This candidate does not choose a new brand/color/pattern mapping from those discrepancies. It displays the exact ID and “Approved source layer”; the original descriptions remain in the bundled provenance. These four shirts have a `canonical_data_hold` for numerical ranking until their text inputs are reconciled to the existing decisions. Their approved visuals remain fully usable. This is a conservative new application safeguard, not an assertion that those shirts are incomplete or require approval. It adds no fabricated DNA, score, or replacement image.

Environment/season suitability is not silently inferred. The S05 controller exposes the supported work settings; unsupported contexts or explicit conflicting item requests fail without fallback.

## Local storage and backups

The sole application storage key is **hewrs:connected-app:v1**. The schema is `hewrs.connected-app.local.v1` and is pinned to the input SHA-256. Existing `hewrs:catalogue:clean`, `hewrs:ledger:clean`, `hewrs:session:clean` and all other keys are untouched.

Saved sessions contain selection IDs, workflow, date and context, **not trusted cached scores**. Restoring a selection reevaluates it from the pinned input sources. Local wear events contain both canonical selections and matching historical IDs. The owner chooses whether an actual wear counts as a controlled-repeat incident; the inherited rotation calculation consumes that explicit record.

Imports have a read-only validation preview and a separate explicit replace action. Different-source backups, legacy backup schemas, duplicate event IDs, invalid dates, incomplete or tampered ID bindings, and injected score fields are rejected. Concurrent-tab changes are not overwritten. Malformed existing data is retained and blocks new writes rather than being silently reset. Failed persistent writes are not reported as saves. When persistence is unavailable, the application expressly reports memory-only storage and still permits export.

This is not automatic production-history migration. The local ledger cannot establish the owner's complete rotation history. Any browser-test wear records are synthetic test fixtures, not the owner's actual wear.

## Source layout

`vendor/` preserves the imported pure calculation, validation and renderer modules. `vendor/recommendation-path-original.js` and `vendor/canonical-bindings-original.mjs` preserve the original versions. `evidence/SOURCE_ORIGINS.json` identifies their source paths/hashes and every copied image.

`src/controller.js` derives from the recovered controller with only a distinct revision string and a null-safe optional-watch identity check. Numerical algorithms are unchanged. `src/canonical-bindings-browser.js` packages the preceding binding module for plain browser scripts without changing its function body.

New implementation files are `src/connection.js`, `src/atomic-renderer.js`, `src/local-state.js`, `src/application.js`, `src/application.css` and `app.template.html`. There is no legacy application DOM/visual renderer or automatic accessory-ranking code loaded into the new interface.

## Reproduction

The runnable static application has no package-install step. Serve this source directory locally with the Python standard-library server, then open `/app.html`:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Build a standalone offline copy:

```sh
python tools/build.py --standalone ../HEWRS_CONNECTED_APP_V1.html
```

Validate the packaged file hashes, embedded sources and new application modules:

```sh
python tools/verify.py
node tests/functional.cjs
python tests/browser.py ../HEWRS_CONNECTED_APP_V1.html
```

Browser tests require Python Playwright and a locally installed Chromium; `CHROMIUM_PATH` can specify its executable. They load the exact standalone HTML in memory because local URL navigation was blocked in the execution environment. This is **not** hosted-delivery validation. The storage-interface unit tests exercise persistence/reopening semantics with a deterministic backend; they are **not** physical-browser restart tests. Browser tests exercise actual UI selection, export, file import and confirmation handlers in a memory-only origin. Tests do not access any production app or external service.

The delivered historical Active-50 2,213-render validation remains credited separately. This operation's browser sample, plan sweep, shoe checks and limitations are reported in `evidence/BROWSER_TESTS.json`; they are not mislabeled a new exhaustive all-category visual review.

## Release boundary

This source tree is ready for repository review as a separate application candidate. It has not been installed into an existing repository or certified as the complete product. No existing source archive, approved garment asset, production application or deployment was modified. The remaining implementation work is the other approved assembly paths, source-text/score-version reconciliation, and actual hosted/device validation—not new garment approvals.
