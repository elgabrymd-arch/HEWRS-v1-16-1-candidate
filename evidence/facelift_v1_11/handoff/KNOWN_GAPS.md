# Integration gaps — do not mistake a demo for the final app

Original source files are preserved unchanged. These issues are not silently repaired in the archive; the receiving chat must close them in its patch to the CURRENT app. A new UI controller must not become a second scoring/state engine.

| ID | Evidence | Required closure |
| --- | --- | --- |
| H01 | Browser reproduced: open Shirt before Suit in the latest Home visual; the Suit list contains DS001/DS015/DS047. The list caches the currently displayed category, not the original suit source. | Use current catalogue lookups by category and immutable IDs. Test all opening orders, not only Suit first. Do not deploy the visual controller. |
| H02 | Latest Home has static context controls, no context-change bindings, unbound search/type controls, example string arrays and a timer-only Generate. | Use V2 picker patterns as reference, but bind to the current app's real context/options/generator. No demo arrays in the production path. |
| H03 | V2 correctly supports category/ID search, Apply/Cancel, multi-preference and No Tie; browser confirms Bottoms remains enabled and opens after selecting a suit. | Use authoritative current topwear type; show Included with suit, keep the tile visible, omit independent bottoms from effective suit generation; re-enable for blazer. |
| H04 | Both Home files keep state only in JS memory; V2 resets on a fresh document. Earlier persistent-state claims were unsupported. | Reuse current app's persistence and restore semantics. Test navigation return and reload with production-safe test storage. |
| H05 | Latest Home clears all preferences immediately on Engine; V2 has a confirmed Reset but global Engine/Anchor are passive status spans, not a complete intent toggle. | Combine accepted intent flow with explicit reset and draft semantics, without changing underlying engine rules. |
| H06 | V2 Generate displays a summary, not engine results. The latest Home only changes button text temporarily. | Route a validated snapshot into the current generator; handle pending/failure/empty; return to actual Outfits. |
| O01 | Browser confirms both repeated clicks on Log call the callback. No shared pending/log acknowledgement guard in R1. | Share the current log action and pending state across both Log buttons. Preserve current duplicate-wear/idempotency policy and explicit confirmation. |
| O02 | Browser confirms `setDisplayData([])` throws; non-empty calls reset index to zero. | Add a deliberate empty/reset/error route and retain current option by stable key on update. Never represent an old option as a fresh empty-generation success. |
| O03 | Outfits is an approved-composite slot, not an avatar-layer engine. No current avatar supplied. | Retain/mount the existing current stage or supply an approved current composite; never rebuild layers during facelift. |
| W01 | Wardrobe API intentionally rejects additional categories; photos are restricted to explicit data/blob/relative URLs. | Inventory all current groups/URL types. Adapt explicitly rather than drop groups or substitute images. |
| W02 | Rename/backup depend on caller acknowledgements; actual production handlers absent. | Preserve current transactional behavior, validation, error recovery and storage keys. A callback stub returning ok is not persistence. |
| R01 | Rotation initial state carries historical repetition cap 3; snapshots can supply another limit. | Bind actual current limit and computed history summaries; never introduce a new cap or date window. |
| C01 | Standalone views share `screen`, `backBtn`, `notice`, broad styles and document/hash handlers. | Scope selectors and IDs, unify navigation/modal routing; do not concatenate complete HTML pages. |
| C02 | Original combined review uses local iframe siblings and failed in the attachment viewer. Fixed combined review only switches embedded pictures. | Keep review tools separate from integration. No missing sibling dependencies; no claim that screenshot navigation is a working app. |
| C03 | The CSS restoration overlay uses document-wide selectors. | Apply only within audited UI chrome; no parent filters/tints on avatar, layers, swatches or photos. |
| C04 | Home demos contain sample weather, season and wardrobe IDs/names; some IDs use `demo-` and many are from older reference data. | Replace with current supplied data. Never seed, remap or infer production IDs from these fixtures. |
| C05 | Native iOS/Safari, file viewer, large text, browser chrome and physical keyboard behavior not tested here. | Actual native test before final approval; do not hide inaccessible controls to satisfy no-scroll. |

The eight `KNOWN_GAP_CONFIRMED` checks in Pass 2 refer to direct browser reproductions; this table also includes separately source-inspected integration limitations. They are disclosed requirements, not eight failed assertions misreported as successful implementation.
