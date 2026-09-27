# HEWRS V1.17.2 — 47-tie source texture restoration

## Delivered work

All T001–T047 selectable tie appearances are rebuilt from the supplied
`HEWRS_ASSETS_2026-08-27(2).zip`. This is not a sharpening-only or AI-upscaling
pass. It introduces **142 explicitly hashed replacement bindings**: 47 suit
tie layers, 47 separated non-suit tie layers, 47 legacy DS001/DS014
shirt-and-tie composites, and the distinct accepted DS023/T017 alpha profile.
One additional tie-ownership mask supports legacy composition. Every original
runtime image remains in the package under its original name/hash.

The source ZIP is 100,623,767 bytes, SHA-256
`bc692f6143cd4d4f71f8d83212e00682714d1374d408478f441b4f03348273c5`.
Its identity and ZIP CRC were rechecked before source access. The 65 relevant
inputs are retained under `provenance/tie_fidelity_v1_17_2/` with exact hashes:
47 clean sources, 16 repaired sources, the photographic knot-form source and
the source-library catalogue sentinel. No unrelated historical wardrobe is installed.

## Visual operation and limits

The builder samples same-ID source fabric directly into the **existing opacity
and native coordinates**. The blade uses a lower-source crop instead of squeezing
the complete 1,172-row artwork into the short suit-opening tie. The knot receives
a contiguous same-ID fabric section and the existing photographic form-lighting
field. This restores available motifs/weave rather than sharpening the old
composite. Motifs can occupy different positions and appear less vertically
compressed; this is a new, explicitly recorded texture registration, not a
pixel-identical filter. No garment shape, tie silhouette, collar placement or
avatar proportions are adjusted.

The retained historical source policy uses repaired same-ID cloth for 12 ties.
The four previously rejected repairs (T003, T005, T006, T009) remain rejected;
those IDs use their clean sources. Source repairs and image limitations are
not erased from provenance.

**Source detail is finite.** The clean artwork is approximately 153 pixels wide
inside a 996 × 2748 padded canvas. The suit tie opacity still occupies the same
117 × 322 native-pixel region; non-suit masks are also unchanged. This restores
source detail but does not turn the supplied files into new high-resolution
photographs. Extreme enlargement still magnifies finite pixels. Existing edge
notches and garment/collar seams remain because opacity and geometry were
explicitly protected. No claim is made that every source is equally sharp.

## Preservation and routing

All **705 previous runtime images** remain byte-identical. The original DNA,
input catalogue, tie IDs, physical shirt/trouser/shoe/watch IDs, numerical
scoring, automatic Engine, weather, location, rotation, Favorites, local-state
and accepted mobile CSS/layout modules remain unchanged. The application
adapter changes only its version; small display hooks select the new hashes.
There is no old-hash-to-new-bytes alias, silent substitute, new garment ID,
source-lock change, storage migration or reset.

The 18 non-suit shirts and all 50 suit-mode shirts remain. DS041 is not enabled
in non-suit modes. Shirt-only numerical ranking remains absent. Archived suit
control pictures and the DS035 saved REFERENCE state remain historical, not
silently retouched. All ordinary T001–T047 selections use the replacement
source layers through their appropriate current renderer, including previously
baked-in T001 on legacy blazer routes.

## Newly executed checks

- **39 functional checks passed; zero failed**: 14 new source/routing checks
  plus 25 automatic-engine/DNA regressions against an independent V1.17.1.
  All **112,392 indexed ensemble score/hold results** and **2,350 shirt–tie
  lookups** match. Exact locked/unlocked 15-option cases, source holds, weather
  eligibility and history behavior retain their prior results. Routing tests
  include 39,817 suit-state selections; these are not rendered-frame counts.
- **19 Chromium checks passed; zero failed in the final invocation.**
  **364 native before/after comparisons** cover all 47 ties across
  four independent display classes, all 14 blazers, all 18 suits, DS035's wider
  opening and DS051's stored-RGB compositor. Every changed pixel stays inside
  prior tie ownership; **every native output alpha byte is unchanged**.
  **55 No Tie/reference controls remain exactly pixel-identical**.
- The actual Generate button and arrows displayed **15 distinct outfits**.
  Picker Apply/Cancel, explicit missing-tie failure, unchanged confirmed wear,
  Favorites/weather data and a synthetic storage sentinel were exercised.
  Actual Collar Detail controls were used; scrolling the existing Outfits pane
  to its top makes the relevant collar region visible in screenshots.
- All **142 replacement images** separately passed alpha equality and zero
  changes outside their tie masks. The complete source builder was rerun with
  `--check`, reproducing all saved outputs and bindings without rewriting them.
- Local HTTP byte delivery, exact V1.17.1 rollback, and package/installer
  validation are included separately with machine-readable results.

The first large two-frame browser invocation stopped progressing after 275
saved comparisons; its cause was not independently established. The test was
bounded to fresh contexts every 40 comparisons. The next invocation completed
all 364 image comparisons but a bare-string Playwright wait predicate was
rejected by the existing CSP. The predicate was corrected to a function. A subsequent UI test used a nonexistent
Cancel-button ID after all image and 15-option tests had completed; it was
corrected to the actual button role/name. The **whole final suite was rerun**
with both fixture corrections. No application code was changed for these
test-harness corrections, and the CSP was not weakened. These incomplete
invocations are retained as harness notes and are not counted as final passes.

## Delivery boundary

Browser tests use actual source scripts/images in isolated, in-memory Chromium
frames with synthetic test storage. They do not certify this patch on the
owner's hosted website or physical iPhone/Safari. No live weather success is
claimed by this tie-only change; previous weather limitations remain separate.
**No GitHub write or public deployment was performed.** Existing prior approvals
and device observations remain recorded separately; this report does not
reinterpret them as acceptance of the new fabric registrations.

## Installation and rollback

The cumulative update supports the exact 18-shirt V1.17.0 or V1.17.1 source.
Starting from V1.17.0 also retains the previously delivered V1.17.1 phone
weather controls and enlarged avatar; this release does not newly certify
their live-provider behavior.

Use the included update's `FILES_TO_COPY` contents, not its enclosing folder,
in the existing candidate repository. Keep `.git`, all unchanged source files,
and browser data. Each changed runtime script uses `?v=1172`; new image hashes
prevent old tie files from masquerading as replacements. The complete source
package is a runnable static folder; `index.html` alone is not self-contained.

`python -B tools/verify_v1172.py` checks the whole delivered source.
`python -B tools/build_tie_fidelity.py --check` replays the source operation.
`python -B tools/rollback_v1172.py --check` verifies restoration bytes.
`python -B tools/rollback_v1172.py --output NEW_FOLDER` reconstructs exact
V1.17.1, refusing an existing destination and never accessing browser storage.

`CHANGED_FILES.json` lists exact modified/new paths and their hashes against
V1.17.1. `PACKAGE_SHA256.json` covers every packaged payload except itself.
Keep personal wear/Favorites exports outside the public GitHub repository.
