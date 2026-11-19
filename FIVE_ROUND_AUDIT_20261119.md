# HEWRS — five-round application audit

**Complete and published.** All five audit passes are closed. The final live workflow, deployment and Home-preferences checks passed against the verified application bytes. The image and device/service limitations below remain explicit.

## Release boundary

This audit starts from `59d9097f9a74104d6b4a1e6ff964f62c56a1ca03` and repairs the current application at `index.html` / `app.html`. Work from `audit/five-round-total-20261119` was merged through [PR 14](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/pull/14). [PLAN.json](evidence/five_round_20261119/PLAN.json) records actual completion status; pending gates are not counted as passed.

The owner authorized audit, repairs and publication, with particular attention to S05, the very dark navy T029 tie, every rejection scope, shirt photographs and collars. Tests use disposable synthetic profiles. No owner browser ledger, credentials, wear history or Favorites are accessed or reset.

## Published build

Application: [HEWRS](https://elgabrymd-arch.github.io/HEWRS-v1-16-1-candidate/).

| Release identity | Value |
| --- | --- |
| Application merge | [`a6874baf58c19f8a0ece853dd0fd5237fd457d5c`](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/commit/a6874baf58c19f8a0ece853dd0fd5237fd457d5c) |
| Candidate tested before publication | `7c1fb9bdf394e23b258fcaf097e4b9695bfa32e6` |
| Final live-verifier commit | [`7621ce47446b9b62b022c01bbb35e8e962931d7c`](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/commit/7621ce47446b9b62b022c01bbb35e8e962931d7c) |
| Application bundle SHA-256 | `d4231feabdc5bcad3a9ec784f61359404586489359d03b2fd81f72135388dfb8` |
| Recovery branch | `backup/pre-five-round-audit-release-20261119` at the original baseline |

The two verifier commits (`393231d3`, then `7621ce47`) change test readiness and diagnostics only. Their application files are identical to the application merge. [RELEASE.json](evidence/five_round_20261119/RELEASE.json) identifies the final verification runs, counts and explicit boundaries.

## Acceptance evidence

These counts describe separate forms of evidence and are not added into a purported number of unique behaviors.

| Verification | Accepted result | Evidence |
| --- | --- | --- |
| Focused application, storage, cancellation and dialog tests | 183 Node tests passed; none failed or skipped | [Final local gate](evidence/five_round_20261119/root-round5-prepublication.json) |
| Complete candidate audit | All five source/photo/state jobs passed | [Candidate workflow](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44510840257) |
| All-rejection regression | All six jobs passed; 874 original Chromium/WebKit reason/lifecycle assertions passed | [Rejection workflow](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44510840209) |
| Cumulative source and baseline regression | Passed | [Cumulative workflow](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44510840210) |
| Candidate photo coverage | 2,393 checks and 396 frames per browser; zero failed checks | [Native acceptance](evidence/five_round_20261119/ui-round5-native-collar-acceptance.json) |
| Native visual preservation | 349 same-browser baseline comparisons per browser; 288 verified native collar crops per browser; twenty complete sheets actually inspected | [Complete visual review](evidence/five_round_20261119/ui-round5-complete-collar-review.json) |
| Active delivery bindings | 66 content-hash/SRI/direct/lazy/utility bindings passed | [Final delivery gate](evidence/five_round_20261119/root-round5-prepublication.json) |

The final [hosted verification workflow](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44516353326) completed with all seven jobs successful at `7621ce47446b9b62b022c01bbb35e8e962931d7c`:

| Final live verification | Observed result |
| --- | --- |
| Published resources and twenty rejection/refill cycles | 32 assertions passed; all 31 checked live resources matched their exact hashes; every cycle retained twenty valid options and every permanent rejection survived reload. |
| S05 tie-only reasons and persistence | 68 assertions passed in each browser. |
| All rejection reasons and lifecycle controls | 252 reason assertions plus 185 lifecycle assertions passed per browser: 874 original assertions total. |
| Supplemental mounted-image readiness | 122 reason-suite boundaries plus 146 lifecycle boundaries per browser: 536 passed, zero failed. These are separate from the original assertion counts. |
| Published photos and collars | 2,393 photo checks passed per browser; 396 frames, 288 native collar crops and ten complete collar-detail sheets per browser matched the accepted candidate and actual visual review. |
| Concurrent saves, cancellation and storage state | 85 checks passed per browser. |
| Home preferences | [13 current-app and fourteen retained Stage 10 checks passed](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44516353211). |
| Deployment | [Verified application deployment succeeded](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44516352705). |

The accepted live suites report zero unexpected browser, request or HTTP errors and no external/provider requests. Chromium's cancellation test deliberately aborts two held image requests; those exact URLs and phases remain recorded as expected test actions. The strict rejection-suite network gate has no cancellation exemptions. The previously cancelled T026 thumbnail decoded successfully six times in the final WebKit lifecycle run, including before scripted reload.

[Final live evidence](evidence/five_round_20261119/live-round5-final.json) records exact heads, job outcomes, artifact digests, counts and the preserved failed attempts. [Final photo/state reconciliation](evidence/five_round_20261119/live-round5-visual-final.json) binds the measured live runtime hash and all native image comparisons to the earlier actual visual inspection. The final documentation commit changes reports and evidence only.

## Five passes

| Pass | Review and verification | Evidence under `evidence/five_round_20261119` |
| --- | --- | --- |
| 1 | Inventory all tracked code; trace current and historical sources; inspect generation, rejection, UI, storage, rendering and delivery contracts. | `INVENTORY.json`, engine/UI/storage Round1 reports, `root-round1-2.json` |
| 2 | Independently challenge findings; verify asset hashes, complete shirt route plans, exact identities, source authority and recovery rules. | engine/UI/storage Round2 reports, `INTEGRITY-confirmed.json`, `engine-route-matrix.json` |
| 3 | Run the actual app in Chromium/WebKit; decode card/picker photographs; render every shirt/collar state; compare native pixels with the published baseline; inspect collar sheets. | Browser `photos/RESULT.json`, ten native collar sheets per browser, lineage and visual review reports |
| 4 | Challenge delayed actions, cancelled images, overlapping generations, cross-tab saves, stale imports, occasion changes, sign-in state and delayed rejection notifications. Independently review fixes. | Browser `state/RESULT.json`, focused `five-round-*` tests, Round4 reports and before/after probes |
| 5 | Review final diff, rebuild exact delivery, run complete current rejection/product gates, publish the validated commit, and repeat checks against the live site. | PR checks and live publication/rejection/photo/state workflow artifacts |

This is an iterative five-pass audit with independent cross-review. Every tracked code file is inventoried. Retained snapshots are classified explicitly; they are not represented as five independently executed current applications.

## Rejection and generation

All eight scopes retain distinct meanings: clothing; clothing plus shoes with any watch; tie; shirt–tie; jacket–tie; shirt; jacket–shirt; and jacket–shirt–tie. Generic color/formality reasons can accompany a specific diagnosis. Conflicting specific diagnoses require an explicit scope. The chosen scope controls matching and persistence.

The S05 / DS029 / T029 regression requires an actual different tie while retaining all accepted physical items. The verified repair can choose T009 without changing the shirt, suit, shoes or watch. Each removed row receives at most one targeted replacement, and retained rows remain unchanged. Exhaustion produces an explicit shorter list. Cancelled batches publish no partial replacement.

Confirmed defects repaired during this audit include:

- **Retained rejected pixels:** Home → View current could reveal a rejected manual selection retained for Undo. Every reveal now checks the current occasion and readable rejection state.
- **Wrong occasion during reconciliation:** an old Work request could hide an allowed restored Dinner outfit. Current frames use their actual context; generated lists keep their producing context.
- **Wrong ranking on a manual outfit:** physical identity matching could transfer an older generated row's ranking/labels onto a restored manual outfit. Reconciliation retains only the actual owned generated row in the same context.
- **Late generation:** method/context changes now invalidate pending work. Regenerate retains its action token through automatic-weather and manual-render waits; Cancel cannot restart it.
- **Curated capacity consumed by rejections:** owner vetoes apply before reference selection, history priority and item-cap accounting. Rejected rows no longer consume slots that another eligible reference can use.
- **Visual request ordering:** rejected references and proposals are excluded before private rendering and evaluation. Rejections committed across asynchronous boundaries stop later stages. Final publication retains its durable rejection gate.
- **Assessment export race:** a rejection during final packet preparation could leave a downloadable packet. The captured exact outfit/context is rechecked immediately before publication.
- **Obsolete dialogs and navigation:** delayed rejection reads could reopen an older results, larger-image or export dialog over newer work. Current-view requests now retain their original page, generation and dialog ownership; cancelled result/history renders cannot force later navigation.
- **Generation behind newer settings:** Generate now stops when automatic weather is cancelled or newer settings open during its initial rejection read.
- **Save completion over newer work:** completed wear/clear/restore writes remain durable, while their delayed UI continuations cannot close a newer panel, clear a newer transaction or restore an obsolete outfit over it.

Original owner garment restrictions, exact locks, history rules, source holds, style definitions and numerical score inputs remain in force. Shirt-only outfits keep their exact manual routes; no automatic shirt-only ranking model is invented.

## Shirt photographs and collars

The active roster contains fifty identities: DS001–DS048, DS050 and DS051. DS049 is retired. All five reconstructed-shirt batches have owner approval; old candidate wording in retained metadata does not revoke it.

Integrity checks cover 1,146 registered asset hashes/decodes and 695 shirt component/thumbnail bindings. The route matrix covers 75,208 supported suit/blazer/shirt-only plans, 6,392 rejected tied requests for No Tie-only shirts, 3,400 rejected unknown states, and 19,200 exact physical-trouser plans. These are binding/plan checks, not exhaustive visual or accessory cross-product tests.

Each complete browser photo run covers 396 frames: 288 shirt/context/collar frames, eighteen suit frames, fifteen blazer frames, twenty-eight wider DS035 frames, and forty-seven individual ties. Of these, 349 compare decoded native RGBA pixels with the same browser running the published baseline. All fifty picker images are decoded in all three contexts, and all four No Tie-only shirts are checked in every context.

Every current shirt is compared with same-ID source-document evidence and approved contextual derivatives. Native collar sheets are inspected separately. Deliberate source distinctions include:

- DS026's earlier larger-check suit insert versus approved smaller pink/light-blue gingham outside suits.
- DS040–DS043 accepting No Tie only.
- DS027's approved No Tie source appearing buttoned at the neck.
- Distinct registered shirt identities sharing an approved source photograph.
- B01 requiring explicit summer-weekend-dinner context, permitted chinos and No Tie; B11 also requiring No Tie. Tests exercise supported routes and assert prohibited combinations stay blocked.

The picker fix uses the registered non-suit thumbnail only in an exact non-suit context. It preserves the suit source and approved image pixels. DS002/DS004 no longer expose internal source-repair placeholder labels. The suit-photo utility returns to the current app and retains exact corrected/previous image sources.

Native pixel equality establishes that the transport changes preserve approved rendering. It does not mean every approved reconstruction is photographically seamless or that every physical shirt has a visually unique source. Visible pre-existing source characteristics are documented in the visual reviews.

The complete native visual review covers twenty collar-detail sheets: ten per browser, with all 288 supported identity/context/state cells per browser visible at native scale. The final corrected artifacts reproduce all inspected sheet, native-crop and full-frame hashes. The capture starts above the highest registered collar pixels; an earlier crop that clipped some collar tops is retained as an evidence limitation superseded by the complete review. See [complete collar review](evidence/five_round_20261119/ui-round5-complete-collar-review.json) and [final native acceptance](evidence/five_round_20261119/ui-round5-native-collar-acceptance.json).

The review records these preserved source-artwork limitations:

| Identities | Observed limitation |
| --- | --- |
| DS001, DS014 | Tied non-suit collars retain flat raised neck bands. |
| DS017, DS034, DS035, DS036, DS051 | Some No Tie non-suit collar/placket joins retain hard edges or thin skin-tone bars; DS035 also has a stepped grey transition. |
| DS023 | Jagged cutout pixels remain around the No Tie neckline. |
| DS040 | The wider non-suit shirt-only image retains a horizontal chest band of vertically stretched GG texture. |
| DS026, DS039, DS040, DS042, DS043 | Same-ID suit/non-suit pattern, color or cloth differences remain. Registered recipes retain the original suit inserts and source the non-suit fabric separately. |

These observations are baseline-equal source limitations. No new garment-photo approval, reconstruction replacement, physical-garment fidelity claim or image regeneration is asserted.

## Persistence and cancellation

Wear and Favorites mutations use actual browser Web Locks and recheck durable state after waiting. Stale queued actions refuse to overwrite newer records. Every claimed successful write must survive reload and appear in the latest downloaded backup. Imports use private preview tickets tied to original bytes/revision and reject stale, changed, cloned, replayed or cross-instance previews.

Exports reread current durable storage. Readable corrupt bytes remain exportable for recovery. Unreadable storage produces an error rather than a fake empty backup. Cross-tab key removal and actual `key === null` clear events refresh both stores.

Modal-lifetime checks cover Favorite save/removal/import; wear save/restore/clear; comparison votes; learning Pause/import/Undo; and delayed file reads. Closing/replacing the panel prevents uncommitted stale writes and obsolete UI continuations from reopening over newer work. An already committed authorized save remains durable. Latest-file-read guards prevent an older read from replacing a newer preview.

Native image cancellation settles pending promises, removes pending cache entries, ignores late callbacks and permits exact retry. Completed decoded images remain reusable. Private comparison, stylist and export renderers receive cancellation and release their canvases. Browser checks require settlement before a deliberately stalled transport is released and preservation of the previous committed selection/pixels.

Authentication tests use synthetic deferred responses. Old 401/logout responses cannot clear a newer login; Disconnect/Cancel cannot be followed by stale login publication. Sign-out clears local credentials immediately after its request captures Authorization, even when closing settings cancels transport. Tokens remain in page memory only.

## Delivery and preserved originals

The candidate builder deterministically builds the active app. The frozen builder and Standard artifacts remain unchanged; `--verify-base` reproduces the pinned earlier candidate byte for byte.

The builder and independent delivery audit verify sixty-six direct/lazy/utility script, stylesheet and index bindings using content-hash URLs and SRI. Main entrypoints remain identical. Asset, assembly, catalogue/data, original scoring and frozen integration bytes are protected by baseline comparisons. The only edited original vendor source is the active image renderer's transport lifetime; native baseline comparisons protect its pixels and composition.

## Evidence qualifications

Reports distinguish product defects from incorrect test assumptions. The initial thumbnail validator wrongly treated approved same-ID batch suffixes as mismatches. The first browser fixture attempted a prohibited B01 combination. WebKit can complete a retry from cache without a second network event. A photo harness supplied a UI diagnosis ID as a stored reason, which the store correctly rejected. Each failed attempt remains documented; only complete successful reruns count toward acceptance.

The final photo fixture also called a nonexistent `undo` method instead of the store's `restore` API. After that test-only correction, the complete photo suite passed 2,393 checks in each browser. The accepted artifacts reproduce the native images actually inspected during the preceding run; the earlier incomplete workflow is not counted as successful.

The first post-publication run stopped at an immediate thumbnail-readiness assertion before running its rejection cycles. Its artifact did not record individual image readiness, so the exact cause cannot be established from that attempt. The corrected verifier waits for the current mounted images within a fixed deadline and then strictly checks expected count, completed decode, positive dimensions and absence of hidden/error fallbacks. The application itself is unchanged. The subsequent live run passed that assertion and all twenty rejection cycles. Both attempts are recorded in [the verifier correction](evidence/five_round_20261119/live-thumbnail-verifier-correction.json).

A later live WebKit lifecycle run passed its preceding behavior checks but failed its final aggregate network check on one T026 card-thumbnail request with `Load request cancelled`. Its HTTP, browser-exception and external-request arrays were empty. The harness performed scripted transitions and teardown after avatar/runtime readiness without independently waiting for mounted card thumbnails; its record did not identify the cancellation phase. That makes test-triggered cancellation plausible, but does not establish the precise cause. The strict test correction and subsequent evidence are recorded in [the lifecycle thumbnail review](evidence/five_round_20261119/live-lifecycle-thumbnail-readiness.json). No application change or cancellation allowlist is implied.

Finite evidence establishes the stated contracts and observed rendering. It does not prove universal correctness, garment color under every lighting condition, every assistive-technology behavior, or physical iPhone behavior. Chromium and WebKit run directly. Optional paid-service paths use controlled responses and actual local state without provider calls or claims about model judgment quality.

Historical `RELEASE_SCOPE.json`, manifests and older documents describe their own checkpoints. Current publication is identified by the merged commit, matching live resource bytes and successful live workflow evidence.
