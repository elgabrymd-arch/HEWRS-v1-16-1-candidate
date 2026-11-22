# Issue 19 — all-shirt V3 fit replacement

## Release identity and gate

Repository: `elgabrymd-arch/HEWRS-v1-16-1-candidate`.

- [Issue 19](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/issues/19)
- [Pull request 20](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/pull/20)
- [Application](https://elgabrymd-arch.github.io/HEWRS-v1-16-1-candidate/)
- Development branch: `fix/v3-all-shirt-fit-issue19`
- Approved V3 baseline: `ee6bdb7c0986597e569056499ff9eedca1ec3c98`

`AVATAR_V3_RELEASE.json` is the machine-readable identity for this checkout.
It binds the exact runtime, both primary entrypoints, source modules, original
avatar/hands and unchanged baseline page. No hard-coded runtime filename in
this handoff supersedes that manifest. `avatar-v3-issue19-baseline.html` retains
the exact approved V3 entrypoint for paired comparisons; it is not an alternative
delivery for the main page.

The branch must remain separate from production until its exact compiled bytes
pass source, application, browser and visual review. Successful automated
captures explicitly do not constitute visual acceptance. PR 20 records the
final three independent audit dispositions and links the exact accepted Actions
run and production checks. Older failed candidates and their repaired findings
remain historical evidence, not approval of another runtime.

## Changes

### All 50 collars

`src/avatar-v3-shirt-collar-fit.js` uses only the selected shirt's original
registered body and collar leaves. Continuous-shirt cloth is captured before
avatar, tie and jacket composition. Each side of the photographed collar is
registered against the actual selected jacket neckline, including asymmetry,
with a seven-native-pixel rear/side reveal. The approved avatar is not warped.

The two lateral fit strips are `[330,355,92,260]` and `[575,355,91,260]`, in native
XYWH coordinates. Tied neckline cleanup is confined to `[422,420,153,47]` above
the existing knot. A separately declared `[422,530,153,85]` lower-center backing
area closes verified interior shirt/jacket alpha seams. Backing preserves
opaque composed pixels and selected tie pixels. The complete
knot rectangle `[422,467,153,63]` remains exact. Two independently measured
tied-only neck-corner slots, `[422,401,19,19]` and `[560,405,15,15]`, restore the
approved avatar's exact original pixels where the old shirt inserts left
detached fabric fragments. All 586 slot pixels must equal the original avatar
in tied frames; no-tie frames retain their original pixels. The complete face
and chin outside those slots remain exact. All 33 original jackets and all 47
tie sources have zero alpha in the slots, so this restoration cannot remove
jacket or tie pixels or alter the avatar's geometry.

Four dark shirt sources contain leftover light photographic matte at their
outer body-collar edge. Those displayed pixels use that same shirt's clean
registered collar leaf. Original image files remain unchanged. Lateral
shirt-to-shoulder joins interpolate the selected shirt's front cloth before the
unchanged jacket is composited. Remaining interior composite seams receive
selected-shirt backing beneath the finished frame. Outer shoulder concavities
are excluded from the gap test.

Shirt-only exterior BODY coverage is restored inside `[330,420,92,195]` and
`[575,420,91,195]`, within the existing lateral fit envelope. This preserves
original shoulder cloth lost during collar relocation. The operation targets
the original BODY alpha, preserves every already-opaque output pixel and every
avatar/tie pixel, and leaves original all-transparent exterior concavities
empty. Opaque BODY beneath a front-leaf antialias fringe is retained when its
original contribution dominates the leaf (leaf alpha below 128); those edge
pixels use the original BODY RGB. Opaque or dominant collar leaves remain
excluded. This operation never runs for a jacket outfit and cannot change
shirt-only sleeves.

A final shirt-only backing pass closes tiny enclosed holes left between the
restored BODY slope and the relocated collar. It classifies eight-connected
low-alpha components in the actual final composite. Components connected to a
crop edge, extending beyond one declared shoulder strip, or touching opaque
avatar/tie pixels are excluded. Opaque selected-shirt cloth supplies backing
beneath the existing partial composite. This retains the original contribution
of partial neck-edge pixels without warping or changing the avatar source.
Original open exterior notches remain open. Independent inspection identified
62 enclosed components containing 144 pixels across 37 states, including actual
Chromium reproductions; those points are separate positive regression gates.

Jacket outfits also receive original selected-shirt backing at enclosed gaps
inside the visible shirt opening, including the lower V tip. The additional
lower bound is `[422,615,153,235]`; the existing lateral and lower-center collar
bounds cover the upper gaps. Eight-connected components must be wholly inside
that union and disconnected from the crop exterior. Every originally opaque
composite pixel remains exact. At a partially transparent tie edge, backing is
composited beneath the existing foreground contribution; the original tie image,
projection and opaque pixels remain unchanged. The independent fixed-point
fixture identifies 830 actual gap pixels on DS027 and DS048 across the 14 suits
with this opening geometry, plus transparent exterior and opaque jacket controls.
An independent all50-shirt S02 sweep additionally identified two partial tie-edge
points on DS037. A separate three-point fixture, including the known DS027 edge,
constrains these backing exceptions to the observed locations. Independent
source and finished-frame checks establish the DS027 point on all 18 suits and
the DS037 points only on the 14 wide-opening suits. S01, S04, S05 and S16 already
cover both DS037 points and remain exact-preservation controls. All 47 actual
projected tie alpha planes are checked independently; no general relaxation of
tie preservation is permitted.

Original shirt cloth protruding above a selected jacket's shoulder is concealed
inside the outer bounds `[0,350,330,250]` and `[666,350,330,250]`. Only pixels
with positive selected-shirt ownership, excess alpha above the jacket, and no
avatar or tie contribution are eligible. The selected jacket's original
effective RGBA supplies the replacement, including the unchanged approved V3
B15 registration. This preserves the jacket silhouette and photographic edge.
Inside the existing lateral collar strips, the same correction requires at
least 50 native pixels of distance from the approved avatar neck edge. The
intended near-neck collar reveal remains intact. All work ends before row600,
where the unchanged approved arm pose begins. Shirt-only outfits bypass it.
Eighteen fixed shoulder controls require exact original effective jacket pixels.
Eight retained collar controls use a separate immutable pre-shoulder runtime
in the same browser engine to verify that the near-neck reveal remains exact.
Those reference contexts are diagnostics and cannot replace the delivered
candidate or the live application.

### B02's source-bound foreign-strip correction

The full replacement matrix rejected runtime `b5f1f249…`: its collar wrapper
recomposited B02's raw photograph and restored a gray strip that the approved
continuous-shirt renderer had erased. Both browser engines reproduced the
failure. Independent source inspection identified 1,815 affected source pixels,
including 1,641 originally opaque pixels, inside x389–413 / y380–583. The
original immutable data explicitly describes this region as foreign photographic
material and traces the real navy-cloth boundary with a 17-point contour.
The source is `assets/a28e524a79fe8c0699e6cf19a819b29ce7be99d7616706669259b469db467095.png`;
the unchanged contour is `jacket_masks.B02.erase_contours` in
`data/continuous-shirts.json`. Its native bounds are `[389.5,378,421,584]`
in XYXY coordinates, with the original one-pixel tracing uncertainty.

The correction preserves every existing plan mask and applies that exact B02
erase contour consistently to all 50 active shirts. On the eight continuous
shirts this restores the approved behavior. On the 42 fallback shirts it is an
intentional display correction, rather than a claim of unchanged baseline
pixels inside the foreign-strip region. The original B02 photograph, contour,
real navy fabric, opening/button state and all other jacket sources remain
unchanged. The contour is not widened. The fit uses the effective jacket
surface for both neckline registration and shoulder ownership.
The resulting collar registration can change selected-shirt pixels beyond the
1,815 masked source pixels, but remains inside the already declared left collar
strip `[330,355,92,260]`. This does not authorize a larger jacket erase region.

The native and browser oracles independently construct that effective source
from the immutable photograph and contour, using the original keep/bitmap/erase
order. Browser caching includes the exact source and mask identity. Original
effective-opaque jacket pixels remain unconditional preservation checks. The
fixed controls distinguish removal of foreign material from accidental loss of
shirt, avatar or real navy jacket coverage:

| Control | Native coordinates | Required result |
| --- | --- | --- |
| Fully erased source interior | `(400,450)`, `(405,500)`, `(410,550)` | The original opaque gray source becomes transparent in the independently constructed jacket plane; the finished outfit retains its intended opaque shirt/avatar coverage. Relocated shirt colors are not pinned to the old baseline. |
| Upper neck cap | `(395,384)` | The cleared jacket reveals the decoded original avatar within one RGB channel value, with alpha exactly 255. Native measurements are exact in 94 of 96 selections; DS013/NO_TIE and DS027/NO_TIE retain a one-value fitted-edge contribution. This point does not relax the separate exact neck-slot checks. |
| Tied partial jacket edge | `(392,407)`, `(392,408)`, `(392,409)`, `(392,410)` | The final pixel equals the independently masked jacket composited over the original opaque avatar, with no selected-shirt or projected-tie contribution at these fixed points. Native RGB error must be zero; the browser permits at most one channel value for source-over quantization and retains actual errors. Alpha remains exactly 255, and each engine constructs its own original source plane. |
| Opaque adjacent navy | `(380,420)`, `(390,500)`, `(400,550)` | Exact original RGBA: `[30,33,44,255]`, `[30,34,44,255]`, `[36,39,51,255]`, respectively. |

The cleared top-edge pixels `(390,389)`, `(390,390)` and `(391,390)` connect to
the full-frame exterior; they must not be filled merely to make every erased
source point opaque. Partially masked pixels can legitimately retain the same
RGB after quantization, so a blanket ban on raw-color matches is not an oracle.
Their source-over contribution, coverage and source ownership remain checked.

All 96 legal B02 no-tie/T001 shirt selections require fresh native visual
inspection and actual Chromium/WebKit coverage. All 2,212 permitted B02
selections (50 no-tie plus 46 shirts with 47 ties) separately retain the same
source and contour; plan checks are not additional raster captures.
The literal source hashes, contour and controls are recorded in
[`tests/issue19-b02-mask-fixtures.json`](../../tests/issue19-b02-mask-fixtures.json).

#### Independent browser reference settings

Runtime `44233e6c…` exposed a WebKit reference-image mismatch in the five-round
photo test and the B02 tie matrix. The independent jacket oracle originally
used default canvas contexts, whereas the production collar and shoulder
surfaces use `willReadFrequently: true`. The isolated
[source-plane diagnostic](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44969802533)
captured six selections in each engine, including both failing selections,
legacy and continuous shirts, an unmasked B03 control and B02 repeated after
B03. It retained the actual baseline/candidate RGBA and full/cropped source
planes before applying comparisons. The application bytes remained unchanged.

For the failing WebKit DS026/T029/B02 selection, the default reference classified
90,721 jacket pixels as opaque; the independently constructed full reference
using the production context settings classified 90,691. All 30 disputed pixels
were at the partially erased contour. The candidate matched all 90,691 opaque
pixels of that independent source exactly. Full-image and cropped
references using those settings were byte-identical, including the mask alpha.
The default mask differed at 196 edge pixels. At the fixed `(392,407)` control,
its alpha was incorrectly compared as zero instead of the actual partial
source alpha of 5, explaining the separate partial-edge assertion failure.
Chromium's corresponding references were identical under both settings.

The browser oracle therefore constructs every intermediate jacket surface with
the same explicit readback context setting as the renderer. It still derives
the source independently from the immutable full photograph and literal mask.
Every existing exact-preservation check and bounded partial source-over check
remains enforced. An additional B02 comparison requires every independently
constructed source pixel with alpha 255 to match the candidate exactly. No
production code, source photograph, contour, opacity threshold or tolerance
changed for this reference repair.

The unchanged existing assertions passed on all 12 retained diagnostic
captures with the corrected reference. This bounded diagnosis does not replace
the complete release matrix or its three independent audits. The compact
[reference-context audit](B02_REFERENCE_CONTEXT_AUDIT.json) records source,
capture and artifact identities; the linked Actions run retains the complete
source planes and disputed RGBA rows.

### Concealed jacket cuffs

`src/avatar-v3-cuff-fit.js` executes after the unchanged approved arm/hand pose.
It extends the selected jacket's registered sleeve cloth to the approved wrist
edge. Its final-coordinate bounds are `[20,1180,240,246]` and
`[736,1180,240,246]`. All opaque pixels of the inherited finished hands are
retained exactly, including browser-specific rounding. Damaged left-sleeve
matte on the affected blazer sources uses the same jacket's intact sleeve
interior, without changing its source photograph or ID.

An independent final visual audit rejected runtime `44233e6c…` after finding
an enclosed transparent sliver beside S03's left wrist. The old cuff patch
replaced its entire rectangle using jacket and hand sources alone, erasing
legitimate selected-trouser pixels beneath the hand. The observed component
contains 194 pixels below alpha 128, including 61 fully transparent pixels,
inside `[219,1387,235,1426]` in native XYXY coordinates. It ends at the cuff
patch boundary and is not an original exterior gap or white shirt fabric.

The corrected cuff layer composes only the selected original trousers behind
the fitted sleeve and hands. The approved pose is applied once to that original
trouser source. The raw avatar forearm is excluded: restoring it outside the
fitted sleeve would introduce a bare-skin strip, a separately rejected local
candidate. Fixed exterior controls prevent that new exposure. Existing
opaque sleeve pixels and the exact inherited opaque hands remain protected.
All 27 distinct original trouser sources were independently checked against
both original lower-layer orders in the cuff bounds: their covered pixels
have no avatar/shoe overlap and reproduce the original selected-trouser
contribution exactly. The old complete outfit is never used as backing, so
shirt cuffs cannot be reintroduced. Every change remains inside the existing
two cuff rectangles. The selected trouser source identity joins the correction
cache key, preventing one trouser source from being reused for another.

The same review found a separate B15 inner-seam defect. Its upper component
contains 324 pixels inside `[770,1180,783,1291]`; all belong to the unchanged
original jacket, including 103 opaque pixels. Restoring trousers alone leaves
part of that seam transparent and paints other jacket pixels as trouser cloth.
The corrected layer retains original jacket material on the torso side of
the fitted sleeve's inner boundary as well as the original torso boundary.
The fitted antialiased edge is composed over that retained material, rather
than erasing it. The outer sleeve silhouette, source photographs, wrist cap
and approved pose remain unchanged. This rule applies to every selected
jacket; it is not a painted patch or a B15 color substitution.

The independent cuff-underlay fixture and native/browser checks positively
verify the observed missing trouser and jacket material against original
sources, preserve true exterior transparency and approved hands, and exercise
changing and restoring selected blazer trousers. Original-jacket seam
allowances must be independently bound to the immutable previous geometry
and exact selected source. They cannot exempt arbitrary cuff-region changes.
The earlier passing cuff-contact checks did not cover these failures and do
not approve the rejected runtime.

The first complete native run on `9d8c6ac` exposed an incorrect opacity
premise in the added regression: a final alpha byte of 255 does not prove that
the underlying fitted cloth and hand sources were individually opaque. A
complete 33-jacket diagnostic found 17 such case-pixels across S11, S13 and
B06–B10. Their actual combined alpha before quantization is 254.55294–254.95294;
the unchanged original hands have alpha 252 or 254. The retained original
jacket beneath them can correctly change a displayed channel by one value.

`CUFF_QUANTIZED_SOURCE_AUDIT.json` records independent exact source-over replays
for all 17 points, including two points with no trouser contribution. Every
point lies on the torso side of the original registered jacket seam and has
opaque original jacket backing. The expected value is constructed from the
hash-pinned rejected raw fitted cloth and independently decoded original
jacket, hands and trousers; candidate RGB never supplies the expectation.
All 17 original-source results match exactly, and omitting the original jacket
fails every positive control.

The native test now verifies these literal source controls before classifying
them separately from truly opaque foreground. It adds no RGB or alpha tolerance.
All other foreground, true opaque hands, exterior, trouser and source-corridor
assertions remain strict. The existing S03/B15 and frozen 33-jacket fixture is
byte-identical. This correction changes the test oracle only; delivered runtime
`ed326c1f8f1b513a3a960ebf508c27e80df688ff41c9aad756e63fa35c34d8f1`
and every production file remain unchanged. The failed run stays failed and
requires a new complete validation run.

Shirt-only and reference outfits pass through without cuff changes. The wrapper
uses a bounded cache and retains the last complete frame on cancellation or a
failed replacement.

### Tie knot, continuous body and waist position

`src/avatar-v3-tie-fit.js` uses each of the 47 physical ties' existing full
registered display source. It replaces the short suit display descriptor with
the same physical tie's full source. The photographic knot remains at native
anchor `[498,467]`; rows above 530 are unscaled. The body is a single continuous
projection, retaining the original pointed alpha contour.

The last displayed tie row is 1210 where the approved trouser waistband appears
at 1211. Legacy shirt overlays that remain above their trousers through 1250 use
last tie row 1250. No shirt or trouser image is moved to manufacture a different
waistline. The original selected jacket remains the final occluder: closed
jackets conceal the continuing tie naturally and open jackets retain their
approved opening.

### Cuff-only runtime revalidation of partial tie fixtures

`CUFF_TIE_SCOPE_REVALIDATION.json` binds the partial tie fixture to runtime
`ed326c1f8f1b513a3a960ebf508c27e80df688ff41c9aad756e63fa35c34d8f1`.
Removing the exact cuff-module block from this runtime and the previous runtime
makes their remaining bytes identical. An independent check compared 1,692
source/projection plans, rehashed all 47 original full tie photographs and
rechecked 94 historical actual-browser projection crops. The complete projected
tie support lies outside both cuff correction rectangles.

Four native before/after frames additionally preserve the entire central tie
strip and all six literal backing-point comparisons exactly. Those full frames
intentionally differ at the corrected cuffs; this is no full-frame equivalence
claim. The fixture retains the earlier runtime revalidation verbatim as history,
keeps every source, geometry, point and tolerance unchanged, and requires fresh
162-case Chromium and 162-case WebKit runs on the current runtime. The committed
scope report itself does not grant browser approval.

### Reviewed-outfit mobile controls

The exhaustive B01 test exposed hidden native-select text contributing to the
WebKit dialog's scroll width at 320, 390 and 768px. The additive
`src/avatar-v3-review-layout.css` applies paint containment to the native select
itself while preserving its menu, values, original content geometry and
keyboard focus outline. The
stylesheet has its own source hash, local URL, SRI and cache pin in the V3
entrypoints. Original stylesheets and the retained baseline page remain exact.

## Preserved sources and behavior

The strict source test preserves 1,995 original files and every one of the 89
pre-existing `src` modules. There is no original garment/image exception. The
approved avatar, both hands, original V3 pose, B15 registration, source IDs,
styling/scoring, rejection logic, rotation, Favorites and persistence sources
remain unchanged. No data migration or browser-data reset is required.

The integrated runtime accounts for three additional compatibility changes,
each guarded by an exact source anchor and recorded in the release manifest:

1. Release an owned masked temporary canvas without destroying a borrowed
   cached tie canvas in the original renderer.
2. Include the immutable displayed tie endpoint in its loader cache key.
3. Capture a continuous shirt's registered raw body before other layers.

The three fit wrappers are separate modules. The unchanged pose runs between
collar composition and final cuff fitting. Removing those exact additions,
reversing the declared replacements and restoring the original pose position
must reproduce the unchanged application body; the independent audits check
this compiled delta, not just source filenames.

The independent source audit was repeated for B02 rebuild runtime
`44233e6c33a9bb02c1e04ab47d0312115908ba19cfcb9cc08f16b8b1cc1a1f12`:
all 1,995 protected files and all 89 original modules remained exact, with zero
source exceptions. Its complete compiled delta from rejected runtime
`b5f1f249ebc40c46381f60870cc42f79b7bc7b60879db93b6b8620e94c6498b8`
is one collar-module replacement. Reversing the three declared compatibility
anchors, removing the three fit wrappers and restoring the unchanged pose
position reproduces approved baseline runtime
`491cd6018b9acaf098cd1086497e299e37ff3229e4336689f504bcf42311251c`
byte for byte. This source result does not replace the new runtime's required
browser, visual or production verification.

The roster is DS001–DS048, DS050 and DS051. DS049 stays retired. DS040–DS043
remain no-tie-only. B01 and B11 retain their owner rules; B01's supported reviewed
route uses PT006 and the summer-weekend-dinner context. No rule is relaxed to
increase matrix coverage. DS026 retains its separately approved suit and
non-suit source registrations.

## Required verification

The [Issue 19 workflow](../../.github/workflows/issue19-validation.yml) runs:

Independent native, mobile, partial-tie, behavior and storage jobs run in
parallel from their own exact checkouts. They exchange no generated inputs or
artifacts. The exhaustive image matrix still waits for both cuff-source
preflights. Every native and browser job must succeed before merge; changing
the start order does not waive a failed or missing gate.

- Deterministic integration, source/behavior preservation and negative delivery
  tests, followed by native source, tie, collar, cuff and cancellation checks.
  The collar contract includes 141 compiled cases, including the observed B02
  failure, every affected continuous-shirt state and representative fallback
  colors and no-tie-only behavior.
- Existing application, all rejection scopes, finite search, tie-only
  replacement, exports, persistence, failed-read and cross-tab recovery tests.
- Chromium and WebKit functional tests for state, tie feedback, reasons and
  lifecycle, plus Home preferences and storage recovery.
- A cuff-source preflight in both engines verifies the fixed S03 trouser
  component in two legacy collar states and B15's original inner jacket seam
  with a continuous shirt. Both preflights must pass before the exhaustive
  fit jobs begin; they supplement the complete matrix rather than replace it.
- Every supported shirt/state/topwear route: 3,172 actual paired frames per
  browser across 18 suits, 15 blazers and shirt-only.
- Another 1,610 paired frames per browser: the other 46 ties across the 32 routes
  where ties are allowed, plus all 46 additional ties on DS027, DS037 and DS048 in S02.
  The latter checks the complete projected tie against the independently found
  shirt-opening gaps. The first tie already covers every eligible shirt in the
  shirt matrix. Together the suites contain 4,782 frames per browser, 9,564 total.
- A separate 162-selection contract per browser compares DS027 and DS037 with
  all 47 ties on S02, plus T001 and T047 on every other suit, against an
  explicitly identified diagnostic that omits only the exact compiled collar
  wrapper. It independently projects the original ties, verifies their common
  alpha geometry, preserves every opaque tie and knot pixel exactly, and permits
  source-over backing only at the three fixed points in their independently
  proven suit sets. The four compact suits provide opaque DS037 negative
  controls. A one-channel-unit rounding allowance applies only to the allowed
  partial points. Neither the delivered runtime nor an owner's profile is
  modified by this test.
- All 70,884 permitted selection plans per browser, with incompatible shirt and
  owner-rule combinations checked separately.
- Native 996×2748 pixels, original source identities, exact head and opaque hands,
  shirt-only sleeves, protected records, completed renders and garment cards.
- Actual mobile presentation at 320, 390, 430 and 768px. B01 evidence keeps its
  reviewed dialog open, scrolls the real rendered canvas into view and checks
  that surface before closing it.
- Native mobile-select keyboard focus, trusted selection/restoration events,
  all 15 control values and option arrays, protected records and identical
  restored outfit pixels in both engines at all four widths. Focus, popup
  attempts and restored previews are captured separately for visual review.

Fifteen fixed-point alpha regressions come from independently inspected collar
seams, not runtime fit counters. Paired native tests also preserve selected
tie pixels through collar fitting, with a separately audited source-over backing
exception for an enclosed gap beneath a partial tie edge, and positively compare the
two neck-corner slots to the decoded approved avatar. Per-case interior-alpha
diagnostics retain wider evidence for visual review without confusing legitimate
outer-edge antialiasing with a gap.

The independent shoulder regression fixture adds 97 original BODY points and
175 weak-leaf edge points, screened across all 50 active shirts and all 96 legal
shirt-only states. The strict points have no original avatar, front-leaf, rear
or tie coverage. The edge points retain fully opaque original BODY beneath
front-leaf alpha 1–4. Their positive oracle is original coverage, not geometry
generated by the repair. Four strict DS003 anchors additionally preserve exact
original RGBA. The rejected compiled builds fail these points; native and actual
browser checks require the corrected build to pass them. Optional 3×3 patches
cover the surrounding source-owned cloth.

The final enclosure fixture adds 144 observed pinhole points. Together, the
shoulder fixtures cover 416 distinct observed points. These checks require
opaque final cloth at enclosed joins while separately preserving source-owned
shoulder coverage, original open exterior, the exact protected face and every
selected tie pixel. A passing capture is still subject to independent visual
inspection on light and dark backgrounds.

Every matrix case retains exact native RGBA hashes and paired collar, cuff,
tie and full-width shoulder details. Cuff detail images span the full native
width and y1120–1625, including the complete upper correction boundary at y1180. Numbered contact sheets and a manifest index cover those details.
Selected full native PNGs supplement the complete detail set. Reports/phone
screens, core details, shoulder details and full native PNGs are uploaded separately so archive
size cannot make the reports inaccessible. Artifact retention is 30 days; the
accepted run, audit conclusions and release identity remain linked in PR 20.

Three independent audit passes must review source integrity, application
behavior, garment rendering and mobile evidence. Any finding requires a fix and
affected-test rerun. A later runtime needs its own evidence even if an earlier
runtime passed unrelated checks.

## Reproduce and publish

```bash
git fetch --depth=1 origin ee6bdb7c0986597e569056499ff9eedca1ec3c98
git fetch --depth=1 origin f114d7dbedab3430761a29d77328ae80ac0882e4
git fetch --depth=1 origin febe4148fc0b27ee2018d84408714ee1fe712015
python3 tools/verify_active_delivery.py --check --syntax
python3 tests/issue19-source.py
python3 tests/active-delivery-audit.py
```

For an intentional source change, run
`python3 tools/integrate_avatar_v3.py --write`, then the checks above and the full
workflow. Native tests use `@napi-rs/canvas@0.1.100` and `fake-indexeddb@6.2.8`;
browser CI uses Playwright 1.56.0 and Pillow 11.3.0. Native rendering is a diagnostic
and does not replace real browser testing.

Merge only the exact reviewed head. GitHub Pages publishes main. Observe the
Pages deployment and the live-publication regression workflow, then verify that
the live entrypoint and downloaded runtime hashes match the merged release
manifest. Do not describe a merged commit or a queued deployment as verified
production. Close Issue 19 only after the production result is established.

The live workflow additionally runs all 50 shirts in their permitted no-tie/T001
states on S02, S03, B02, B06 and B15 in Chromium and WebKit: 480 paired native
frames per engine (960 total). S03 exercises the corrected trouser component. B02's 96 selections exercise the repaired source mask on the actual
publication. The workflow fetches the actual live HTTPS application into
isolated profiles and compares
the original source controls, corrected gaps and mobile presentation against
the retained approved V3 baseline. All startup files, including the additive
mobile stylesheet, must first match the exact merged checkout hashes.

## Limits

The owner deferred three suit color mismatches to the next phase. Their designs
and cuts are accepted. This fit release preserves their existing photographs,
display colors and color metadata; correcting those colors is separate work.

Chromium/WebKit mobile viewports are automated browser coverage, not physical
iPhone/Android device testing. Original photographic textures, differing source
collar styles and existing owner restrictions remain. The work changes displayed
fit; it does not replace the wardrobe photographs or create new garment IDs.
Synthetic isolated storage is used for tests; no owner's saved profile is
accessed or rewritten.

WebKit page screenshots can omit the native operating-system select popup.
Trusted keyboard selection, restoration and visible focus are tested, but such
a screenshot does not establish the popup's visible appearance.
