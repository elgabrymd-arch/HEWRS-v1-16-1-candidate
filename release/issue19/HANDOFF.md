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
opaque composed pixels and every nonzero-alpha selected tie pixel. The complete
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

### Concealed jacket cuffs

`src/avatar-v3-cuff-fit.js` executes after the unchanged approved arm/hand pose.
It extends the selected jacket's registered sleeve cloth to the approved wrist
edge. Its final-coordinate bounds are `[20,1180,240,246]` and
`[736,1180,240,246]`. All opaque pixels of the inherited finished hands are
retained exactly, including browser-specific rounding. Damaged left-sleeve
matte on the affected blazer sources uses the same jacket's intact sleeve
interior, without changing its source photograph or ID.

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

The roster is DS001–DS048, DS050 and DS051. DS049 stays retired. DS040–DS043
remain no-tie-only. B01 and B11 retain their owner rules; B01's supported reviewed
route uses PT006 and the summer-weekend-dinner context. No rule is relaxed to
increase matrix coverage. DS026 retains its separately approved suit and
non-suit source registrations.

## Required verification

The [Issue 19 workflow](../../.github/workflows/issue19-validation.yml) runs:

- Deterministic integration, source/behavior preservation and negative delivery
  tests, followed by native source, tie, collar, cuff and cancellation checks.
- Existing application, all rejection scopes, finite search, tie-only
  replacement, exports, persistence, failed-read and cross-tab recovery tests.
- Chromium and WebKit functional tests for state, tie feedback, reasons and
  lifecycle, plus Home preferences and storage recovery.
- Every supported shirt/state/topwear route: 3,172 actual paired frames per
  browser across 18 suits, 15 blazers and shirt-only.
- Another 1,472 paired frames per browser, covering the other 46 ties across the 32
  routes where ties are allowed. The first tie already covers every eligible
  shirt in the shirt matrix.
- All 70,884 permitted selection plans per browser, with incompatible shirt and
  owner-rule combinations checked separately.
- Native 996×2748 pixels, original source identities, exact head and opaque hands,
  shirt-only sleeves, protected records, completed renders and garment cards.
- Actual mobile presentation at 320, 390, 430 and 768px. B01 evidence keeps its
  reviewed dialog open, scrolls the real rendered canvas into view and checks
  that surface before closing it.

Fifteen fixed-point alpha regressions come from independently inspected collar
seams, not runtime fit counters. Paired native tests also preserve every selected
tie pixel through the new collar backing operation and positively compare the
two neck-corner slots to the decoded approved avatar. Per-case interior-alpha
diagnostics retain wider evidence for visual review without confusing legitimate
outer-edge antialiasing with a gap.

Every matrix case retains exact native RGBA hashes and paired collar, cuff and
tie details. Numbered contact sheets and a manifest index cover those details.
Selected full native PNGs supplement the complete detail set. Reports/phone
screens, detail images and full native PNGs are uploaded separately so archive
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

## Limits

Chromium/WebKit mobile viewports are automated browser coverage, not physical
iPhone/Android device testing. Original photographic textures, differing source
collar styles and existing owner restrictions remain. The work changes displayed
fit; it does not replace the wardrobe photographs or create new garment IDs.
Synthetic isolated storage is used for tests; no owner's saved profile is
accessed or rewritten.
