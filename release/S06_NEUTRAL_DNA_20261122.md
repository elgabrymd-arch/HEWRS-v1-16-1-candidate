# S06 neutral-grey fabric, DNA and compatibility correction

## Reason for the correction

The owner approved S06 as neutral grey with a fine, low-contrast Glen / houndstooth check that reads nearly solid at normal viewing distance. The previous Issue 22 integration still described its colour as warm grey with a brown cast and supplied `warm-neutral` to the styling profiles.

## Applied changes

- Updated the active S06 colour description and temperature to neutral grey. The close-up check geometry remains `grid`, with the existing ordinal value 2.4, saturation 0.08, scale 1 and contrast 1.2.
- Recorded the owner's distance description once in the S06 correction and consumed it when building reviewed and discovery data.
- Retained the existing repository photograph references and recorded the explicit owner correction. Newly supplied reference photographs are not included in this public repository change.
- Applied the previously approved generated fabric preview to S06's registered jacket and trouser display layers, and regenerated its picker image through the native application renderer. The normal-distance fabric panel supplies the quiet weave; the close-up panel is not enlarged onto the garment.
- Corrected a normal-distance rendering defect found during the final review: the original broad checks survived as shading, and the new fine weave produced moire when reduced to phone size. S06 alone now uses broader source-luminance smoothing and a periodic texture prefilter. The approved neutral colour, native fine weave, natural folds, exact alpha, seams and original hardware remain protected. Independent phone-size output checks reject the earlier conspicuous cloth-block contrast while retaining the calf fold.
- Recorded the generated material separately from photographic evidence. The owner authorized the in-app image update and promotion to the primary version; this does not create a new whole-outfit preference or approval.
- Incremented the garment-fidelity revision to `hewrs.issue22.garment-fidelity.2026-11-22.v2` and rebuilt the compatibility index, reviewed overlay, picker metadata, executable runtime, review panel, entrypoints and integrity pins.
- Added focused DNA and material regressions to the integration and primary-release validation workflow.

Colour fields consumed by the parsers contain positive neutral-grey descriptions. The superseded brown-cast interpretation is recorded only in provenance, avoiding accidental recognition of a negated colour as an active accent.

## Verification results

The comparison baseline is integration commit `f3c3a10151c9fb9d7868c50b52f9cf7f33cc02f9`.

| Verification | Result |
| --- | --- |
| All active S06 shirt/tie combinations | 50 shirts × 48 states = 2,400; evaluated under both current and prior DNA |
| Stored S06 compatibility rows | All 2,212 agree with fresh evaluation |
| Uncached combinations | All 188 retain their existing `OWNER_NO_TIE_RULE` exclusion |
| Clothing score, status and eligibility changes | None; temperature alone does not alter the existing clothing formula |
| Unrelated compatibility groups | 101 groups / 110,180 rows remain exact |
| Unrelated DNA records | All five remain exact; S06 historical record also remains exact |
| Effective semantic paths | Seven paths agree on neutral grey and the quiet fine check |
| Actual generation | 36 requests across four styles, three occasions and three tie selections; 603 options verified |
| Registered footwear | 51 shoes, both tied and open, under both preference models |
| Identified watches | 49 watches, both tied and open, under both preference models |
| Original source protection | 2,180 protected files unchanged |
| Native material contracts | 189 checks passed across nine layers and ten rendered controls |
| S06 image scope | Only its two display layers and one picker image changed |
| Other material and picker images | Seven material layers and six picker images remain exact |
| S06 alpha and transparent pixels | Zero changes |
| Exposed avatar head and neck | All 104,620 checked pixels remain exact |
| Active picker and outfit render | Same native frame; actual HTML integrity and cache pins verified |
| Normal-distance fabric appearance | Four phone-size cloth regions have bounded local contrast; native fine weave and calf-fold contrast remain present |
| Existing matching and review regressions | Passed |
| Active delivery audit | 25 tests passed |
| Reproducibility and integrity checks | Passed for index, reviewed data and V3 delivery |
| Saved-data writes | Zero |

In the heuristic preference path, 16 brown/burgundy shoe cases lose the former warm-colour bonus: score change −0.105. Research footwear scores remain unchanged because that path uses colour family and value. In each preference model, 22 gold-watch cases change by −0.12 after removing the warm-colour coherence bonus. These are model scores, not measured fashion-quality differences or new owner preferences.

The generation checks retain existing policy limits: Classic with an explicit No Tie request returns no options; Modern with the exact T022 tie returns one option per occasion. Other tested requests return 20. The correction does not relax those rules.

## Delivery and scope

The runtime differs from the previous integration runtime by exactly its embedded DNA and material manifests. The reviewed panel differs by exactly its embedded reviewed overlay. The entrypoints pin the matching picker data by content digest. S06's jacket, trousers and picker image are updated together.

Original avatar and garment sources, rendering geometry, original catalogues, frozen compatibility data, scoring functions, generation logic, saved-state handlers and B01/B06/B10/B11 policies remain unchanged. The display-only material projection preserves the source alpha, silhouette and original hardware. The other seven material layers and six picker images retain their previous content hashes.

The source fabric file is a generated material representation approved by the owner. It is not a calibrated measurement of physical cloth or permission to modify the avatar. The newly attached raw reference photos are excluded from this publication.

The correction is prepared from `integration/issue22-v3`. The owner subsequently authorized promotion into the primary version after validation. Remote validation and publication status are recorded on the associated pull requests and deployment runs.

The original RGB photo suites are retained on their exact approved Issue 19 checkpoint because Issue 22 deliberately changes those material colours and linen tie eligibility. Current Issue 22 browser matrices, current partial-tie tests, all 50 current shirt-picker photographs, and a real S06 topwear-picker image fetch verify the new delivery separately. The continuous source lock now admits only exact manifest-bound current additions and immutable integration assets; arbitrary files and original-source edits remain rejected.

Machine-readable local evidence:

- `evidence/s06-neutral-20261122/verification.json`
- `evidence/s06-neutral-20261122/material-verification.json`
- `evidence/s06-neutral-20261122/delivery-review.json`
- `evidence/issue22/source.json`
