# Current-app acceptance gate
Record PASS/FAIL/NOT TESTED and evidence per item. A previous prototype screenshot is not current-app evidence.

## Baseline and protection
- Verify current source/build identifier and hash; never choose the historical index by convenience.
- Snapshot current assets, avatar geometry/registration, catalogue IDs/data, frozen score tables, engine regions and storage schema.
- UI diff changes only explicitly approved files/regions. Protected assets/code/data unchanged.
- No old seeds, migrations, demo records, speculative identity/color corrections or catalogue remapping.
- Identical controlled inputs/history/randomness produce unchanged engine outputs, scores, eligibility and order. Report non-determinism rather than assert equality without controlling it.

## Home and selection
- At normal text size: 320×640, 360×740, 375×667, 390×844, 393×852, 402×874, 414×896, 430×932 and 440×956 closed-sheet Home fits with all controls accessible.
- The centered width, two-column/three-row garment grid, Style label, weather access and all four navigation destinations remain.
- All six category pickers open as sheets. Test every category as first opened, especially Shirt → Suit and Shoes → Suit.
- Engine / category-only / exact item / No Tie have distinct effective values and clear labels.
- Apply changes one committed choice; Cancel, close, backdrop and Escape change none. Focus returns to the originating tile.
- Filters/search operate on current data; long names and IDs remain discoverable and no current group is omitted.
- Two or more intentional preferences coexist. Reset has a safe explicit flow. Anchor-with-no-choice gives guidance without fabricating constraints.
- Suit inherits matching trousers and keeps disabled Bottoms visible; Blazer restores independent Bottoms. Existing shirt-only/no-jacket and supported casual modes remain available.
- Current weather or manual status is honestly labelled, never a hardcoded demo reading.
- Generate pending/error/empty/success work; no duplicate requests, stale results or automatic wear logging.
- Returning Home preserves producing settings. Current app reload/persistence behavior remains correct.

## Outfits
- Current approved avatar/composite/layers only; geometry, z-order and garment identity unchanged. Missing assets labelled unavailable, not substituted.
- Scores, classifications and explanations identical; /10 scale not illustrative /100. Missing score is not zero.
- Item names plus actual IDs are visible/readable; No Tie and suit-included trousers clear; watch ID/name works without photo.
- Previous/next, option key, back, item details, score details, regenerate and navigation behave correctly.
- Empty or failed generation removes misleading stale display. Current index preserved when appropriate.
- Both Log buttons share in-flight state and actual success/failure results; existing duplicate wear policy retained.

## Wardrobe, backup and rotation
- All current groups preserved, not only the nine reference categories. Unknown versus empty categories distinguished.
- Browse/search changes neither anchors nor wear log. Rename preserves IDs; failure does not say saved.
- Export/import use current formats, validation, confirmations and persistence; cancellation/error cannot wipe history/catalogue.
- Rotation uses current computed windows/limits/summary values and actual logged history; no UI recomputation or invented statistics.
- Favorites recall opens/reviews without automatically logging wear.
- Delete/Clear require confirmation; cancellation, timeout and failed write leave current data intact.

## Native and accessibility
- Physical iPhone/Safari: collapsed/expanded browser chrome, safe areas, landscape, text zoom, on-screen keyboard, background/foreground and back behavior.
- Modal focus isolation/trap/return, labels, keyboard access, screen-reader names, color contrast, disabled/error states and reduced motion.
- Static no-script Home does not go blank; a scripts-blocking attachment viewer is honestly view-only.
- Long lists scroll inside sheets. Short viewports/large text never clip actions merely to force no-scroll.

## Release and rollback
- Deliver patched CURRENT source/build, minimal diff, old UI backup, reproducible tests, screenshots and remaining limitations.
- No deployment without authorization. Rollback restores UI only and does not revert genuine user data written since the patch.
