# HEWRS V3 — published release handoff

## Release identity

The V3 application was integrated through [PR 17](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/pull/17) and published on November 21, 2026. The owner approved the actual V2/V3 comparison images on November 21. This handoff records the existing release; it introduces no new application change.

[Open the published application](https://elgabrymd-arch.github.io/HEWRS-v1-16-1-candidate/).

| Binding | Value |
| --- | --- |
| Application release commit | `030f6ee7f9cb7f30b9aea420a08b034647d2feee` |
| Reviewed candidate commit | `f2e14386abdeafd8e1d66b34366c0286422cdc4c` |
| Shared candidate/merge tree | `ed30dc68a5db02059d562c935a1699fd80306d7c` |
| Primary pages | `index.html`, `app.html` |
| SHA-256 of each primary page | `4670d41cc6139d12956dfbd064692e92fe28c719160ec2e142754b2e22de718b` |
| Active runtime | `runtime/avatar-v3-candidate-491cd6018b9acaf098cd.js` |
| Runtime SHA-256 | `491cd6018b9acaf098cd1086497e299e37ff3229e4336689f504bcf42311251c` |
| Machine-readable release record | [AVATAR_V3_RELEASE.json](../../AVATAR_V3_RELEASE.json) |
| Native canvas | 996 × 2748 |
| Browser-storage migration | None |

These are application-release identifiers. A later documentation-only commit can have a different repository tree while retaining the exact verified application bytes.

## Included corrections and preserved sources

V3 uses the approved smaller head and neck, revised hands and coordinated arm/sleeve pose. It also includes the bounded B15 upper-left collar registration and the completed saved-rejection readiness message. The eight continuous-shirt corrections already merged in PR 16 remain included.

The avatar and both hand sources match those used in the before/after comparison images. The final runtime additionally contains the B15 fit and rejection-status correction documented in PR 17.

Original V2 avatar/hand assets remain exact, with a reproducible `avatar-v2-reference.html`. Original wardrobe source files, physical IDs and numerical scoring sources remain preserved. V3 deliberately resamples the lateral composed sleeve/arm regions; the B15 correction deliberately changes a bounded collar region. Neither change is described as pixel equality across those displayed regions. The source and geometry boundaries are bound by the release manifest and checked by the fit audit.

Wear history, Favorites, rejection records and Home preferences keep their existing storage contracts. Tests use isolated synthetic profiles. Source-code recovery is not a backup of the owner's browser data, and no clearing or import of personal records is required for this release.

## Verification evidence

All seven final candidate workflows below completed successfully at `f2e14386abdeafd8e1d66b34366c0286422cdc4c`:

| Candidate check | Evidence |
| --- | --- |
| Complete garment fit and source preservation | [Run 44878751088](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44878751088) |
| V3 sources and complete V2/V3 comparison outfits | [Run 44878751018](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44878751018) |
| V3 state, tie, rejection and lifecycle audit | [Run 44878751044](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44878751044) |
| All rejection paths | [Run 44878755040](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44878755040) |
| Five-round source, photographs, collars and state | [Run 44878754939](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44878754939) |
| Continuous-shirt rendering and existing state | [Run 44878754909](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44878754909) |
| Cumulative rejection regression | [Run 44878754971](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44878754971) |

The full fit workflow passed 456 selections and 4,676 checks in each of Chromium and WebKit, with zero failed checks. Its selection matrix includes every active shirt, suit and blazer, plus all 96 permitted B15 shirt/mode selections. Owner restrictions remain enforced, including B01's supported summer/weekend-dinner, chinos and No Tie route.

The automated fit result's `PASS_SOURCE_AND_RENDER_GATES_VISUAL_REVIEW_PENDING` label establishes only the machine gates. The separate completion record for all 456 distinct Chromium collar/cuff comparisons is in PR 17. Automated success is not substituted for visual approval. Original garment-edge and cuff-skin remnants documented there remain known source-artwork limitations.

The following production runs completed successfully at the application release commit `030f6ee7f9cb7f30b9aea420a08b034647d2feee`:

| Production check | Final result | Evidence |
| --- | --- | --- |
| Pages build and deployment | 3 jobs passed | [Run 44880106681](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44880106681) |
| Published application, rejection, photographs and state | 7 jobs passed, attempt 2 | [Run 44880107738, attempt 2](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44880107738/attempts/2) |
| Home preferences | Passed | [Run 44880107824](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44880107824) |

The final live run includes 20 successive UI rejection/refill cycles, stable accepted options and ordering, exclusion of previously rejected combinations, and persistence of all 20 rejection records after reload. Per browser, it passed 68 tie-scope checks, 252 rejection-reason checks, 185 lifecycle checks, 3,463 photograph/source checks and 91 concurrency/cancellation checks. The first attempt stopped at its strict request-error gate; the unchanged second attempt passed all seven jobs. The earlier failure is retained in the run history.

On November 21, the published primary page, runtime, avatar and both hand PNGs were downloaded again with HTTP 200 and compared against the release's SHA-256 bindings; all matched. This direct byte check supplements the completed browser evidence. Chromium and WebKit coverage does not claim a physical iPhone test or inspection of the owner's private browser state.

## Verify or rebuild the current release

Run commands from the repository root. Use Git, Python 3.11 and Node.js 22, matching the release verification environment. A shallow checkout needs the historical continuous-shirt base used by the deterministic builder:

```bash
git fetch --depth=1 origin f114d7dbedab3430761a29d77328ae80ac0882e4
python3 tools/verify_active_delivery.py --check --syntax
```

This command validates the current runtime, source identities, primary pages, cache versions, SRI, lazy module bindings and the reproducible V3 integrated build. It does not rewrite files. For only the integrated-build comparison, use `python3 tools/integrate_avatar_v3.py --check` with the same historical base available.

To additionally reproduce the earlier tie-candidate baseline, first fetch its pinned commit and enable the existing optional gate:

```bash
git fetch --depth=1 origin febe4148fc0b27ee2018d84408714ee1fe712015
python3 tools/verify_active_delivery.py --check --verify-base --syntax
```

For an intentional reviewed source change on a working branch, the current write path is:

```bash
python3 tools/integrate_avatar_v3.py --write
python3 tools/verify_active_delivery.py --check --syntax
```

The integrated builder reproduces the retained continuous-shirt/V2 reference, V3 review runtime, both primary pages and release manifest together. Rebuilding is not publication or approval. Review the diff and run the affected source, fit, behavior and publication gates for any application change. The legacy `tools/build_tie_candidate.py` and frozen `tools/build.py` remain dependency/history tooling; neither alone reproduces today's primary pages.

## Historical records and future work

`STANDARD_RELEASE.json`, `RELEASE_STATUS.json`, `RELEASE_SCOPE.json`, [the original Stage 11 handoff](../standard/HANDOFF.md), earlier five-round receipts and rollback trees retain their original checkpoint facts. They are not current V3 publication records. Candidate/source approval markers remain provenance in `CONTINUOUS_CANDIDATE.json`, `AVATAR_V3_REVIEW_BUILD.json` and `data/avatar-v3-candidate.json`; they do not revoke the later integrated release or owner approval.

The core Stage 10/11 release, five-round audit, shirt corrections and V3 integration are complete for their stated scopes. AI Creative remains a separate capability. The retained Standard record has `api_creative_enabled:false`; the existing OpenAI image-assessment configuration has `quality_gate_passed:false`, and the separate visual-proposal service has no configured endpoint. Neither is a released five-API Creative mode. This handoff activates no provider calls and adds no new garment intake.

Any future rollback must be an explicit reviewed forward change that preserves later legitimate browser records and unrelated work. The retained V2 page and sources support comparison/recovery; they do not authorize clearing, importing or replacing private history.
