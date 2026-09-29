# HEWRS V1.21.1 — editorial option cards

## Delivered presentation
The existing Outfits page now uses the requested dark lookbook card, gold/cream
headings, full-avatar render and individual shirt/tie/shoe-detail thumbnails with
exact item IDs and current item names. Suit/blazer, trousers and watch remain
itemized. Watches remain name/ID only. No generic product photography is used.

Desktop shows the actual outfit at left and details at right. At widths up to650px,
the same card stacks a large outfit above readable item rows rather than squeezing
both into tiny columns. Scroll within Outfits to reach lower details. Home,
Wardrobe, Rotation, accepted palette outside the card and the modal picker remain.
Full Outfit, Collar Detail, Enlarge, Previous/Next, the current option-list dialog,
score details and Log This Outfit remain connected to their existing handlers.

The card number follows actual generation: Option1…20 when20 were found, fewer
when fewer were found. Exact manual selections use the current-selection path.
The old illustrative image's suit and shoe substitutes were NOT adopted.

## Actual source binding
132 thumbnail records:50 shirt,47 tie,35 registered shoe-pair IDs. Each thumbnail
records the existing source hashes and crop rectangle. No IDs are merged when
source bytes match. All previews are240×240PNG presentation derivatives.
Shirts show the untied collar/chest source; the selected tie is shown separately.
The actual large avatar continues to use its existing selected tied/No Tie
configuration. These crops do not create missing photograph detail or repaint
clothes. Existing source cutout limitations can remain visible in thumbnails.

## Preserved functionality
All848 existing garment assets/assemblies files and all61 non-presentation script
resources are byte-identical to V1.21.0. There is no change to the researched
ranking, source records, original score inputs/index, weather, rotation,
Favorites or wear-history modules. The20-option target, tie-once policy,
other-item maximum-two rule and anchor exceptions are unchanged. This is not
another styling recalibration. No provider/API account or private service is used.

## New tests actually completed
- 12 functional checks, zero failed. Exact thumbnail/source hashes and all
  39,817 supported suit/card identity models checked. Shared-image IDs, No Tie,
  reference state, manual numbering and mismatch rejection covered.
- 20 in-memory Chromium checks, zero failed. Actual unrestricted Generate
  returned20, matching the retained V1.21.0 fixture; all20 positions were navigated
  and matched to card text, thumbnails and committed selection. A separate actual
  S10 Generate also matched its existing20-option ordering.
- 25 freshly rendered baseline/current avatar comparisons were byte-identical:
  the20 free options plus five suit/blazer/shirt-only/DS051/DS023/reference controls.
- Home pixels remained identical; seven viewport sizes checked for horizontal
  overflow. Existing detail/enlarge/list controls and picker Cancel exercised.
  Rejected selections retain the prior card/frame. A missing thumbnail displays
  unavailable without changing the actual outfit. No wear/Favorites were logged.

These tests use actual local scripts/images, injected thumbnail bytes and isolated
synthetic storage. They do not independently certify GitHub loading or physical
Safari behavior. Browser initial attempts were interrupted by a tool timeout and
one screenshot equality assertion. Completed checks span two browser fixtures with decoded Home pixel
comparison. Two test-only assumptions were corrected: the picker uses suit-9
for S10, and Favorites uses an items array. Both corrected paths were re-executed.
Failed fixture invocations are retained separately, not counted as passes. The actual
final desktop and phone screenshots were visually inspected.

## Install
Supported source: V1.21.0. Extract the update, copy the CONTENTS of FILES_TO_COPY
into the existing candidate repository, replace matching files and keep every
other folder and.git. Do not copy the enclosing FILES_TO_COPY folder or the ZIP
itself into the web root. Commit and push through the existing workflow.

Commit summary:
`V1.21.1 — editorial option cards with actual wardrobe details`

Source verification: `python -B tools/verify_v1211.py`
Thumbnail replay: `python -B tools/build_option_card_thumbnails.py --check`
Rollback: `python -B tools/rollback_v1211.py --output NEW_FOLDER`

The rollback reconstructs exact V1.21.0 separately. Nothing reads or resets browser
history. No GitHub write or deployment was performed in this session.

## Source identity
Restored V1.21.0 from existing mounted source/update archives. All2213 payloads
matched the original manifest. This is source-file identity, not a new claim that
the original fullV1.21.0 ZIP-container hash was remeasured. Changed files, protected
sources, installer replay and output ZIP checks are included with this update.
