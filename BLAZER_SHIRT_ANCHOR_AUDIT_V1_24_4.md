# HEWRS V1.24.4 — complete blazer/shirt anchor audit

Executed 12 October 2026 against the supplied V1.24.3 source and the corrected local V1.24.4 application. No remote publication or live-site verification. This is a tested software correction; it does not certify that every style has eligible outfits under every anchor.

## Requested coverage completed

15 connected blazers (B01–B15) and all 50 active dress shirts (DS001–DS048, DS050–DS051), each anchored separately, across Automatic, Modern, Classic and Hybrid, for Work, Weekend and Dinner.

| Scope | Configurations | Returned outfits | Verified no-match results | Software exceptions in the matrix |
|---|---:|---:|---:|---:|
| Each blazer separately | 180 | 132 | 48 | 0 |
| Each active shirt separately | 600 | 456 | 144 | 0 |
| Total | 780 | 588 | 192 | 0 |

Each of these 780 configurations was freshly generated before through the actual engine and after through the actual app controls: **1,560 primary generation executions**. The after sweep uses the actual generated startup bundle, picker Apply, occasion/style Apply, Generate, image rendering and navigation. It is not a replay of saved options. All full ordered canonical selections matched the before lists. No style threshold, garment attribute, source score, numerical weighting or exact-selection policy was changed to manufacture matches.

Common controls: Research-based method; exact stated anchor(s) only; other item preferences unrestricted; formality any; fixed date 2026-10-12; weather not assessed; inactive matrix learning; empty synthetic wear history. Counts are conditional on these controls, not a reading of the owner's current phone settings.

## Extra combined-anchor coverage

All 15 blazers × 50 shirts = **750 exact blazer/shirt pairs**, each in all four styles and all three occasions: **9,000 additional actual engine generations**, performed after the correction. 2304 returned outfits and 6696 returned verified no-match results; none threw a software exception or changed either exact anchor.

These 9,000 are current-engine tests, not paired before/after tests and not 9,000 browser render tests. Each returned list was checked for exact blazer and shirt, style, valid connected selection, no duplicate clothing cores, and physical-item repetition limits.

## Reproduced defect and correction

**Stale results after changing an anchor.** Starting with B03 + Modern, then applying B04, left B03's old recovery controls on the Outfits page. Changing a valid result's anchor could likewise leave the previous recommendation list available. Picker Apply now invalidates stale results only when the committed selection actually changes. Reset invalidates an obsolete list; Cancel and applying the same choice preserve valid results.

The pending page says **Not generated**, not a misleading zero-result claim. **Generate current selections** runs the currently committed anchors and style. Previous selection pixels and the saved current session are retained; they are not presented as a fresh recommendation. Explicit View current outfit remains available. No default S05 outfit is substituted automatically after a pending or empty result.

## Shirt diagnostics repaired

The old generic source warning did not identify held shirt IDs. The corrected page and shirt picker distinguish:

- `SHIRT_SCORING_HOLD`: DS011, DS040, DS042 and DS043 have existing conflicting-description scoring holds. All four remain in the inventory and can still be rendered in an exact supported manual outfit. Changing style or occasion does not repair their scoring premise; no invented ratings or substitute shirt are inserted.
- `SHIRT_BLAZER_RENDERING_UNAVAILABLE`: an exact blazer is combined with a shirt that has only suit-mode rendering. Both IDs remain selected; the unavailable full-length shirt connection is explained.
- `SHIRT_TIE_STATE_UNAVAILABLE`: an explicit tie or tie-required setting conflicts with the shirt's supported tied/open states. The chosen tie is not removed secretly.
- Existing contradictory formality choices, strict style exclusions and actual runtime failures remain separate outcomes. Shirt-only anchors are named in recovery controls rather than described as an unspecified outfit.

## No-match findings that remain restrictions, not repaired fashion classifications

All four scoring-hold shirts return no scored automatic recommendations under every tested style and occasion: **48 of the 780 separate-anchor configurations**. Those source holds remain deliberately intact.

The same blazer/style restrictions occur in all three tested occasions: Modern excludes B02–B05, B07–B10 and B12–B15; Classic excludes B01, B06 and B11; Hybrid excludes B11. The update does not change those classification rules.

In the shirt sweep, Classic also has no matches for DS015, DS016, DS041, DS047 and DS050, in addition to the four held shirts. Modern returns matches for 19 shirts, and none for the other 31 under these controls. See the complete CSV or searchable dashboard for every ID rather than inferring eligibility from a sample.

DS015, DS016, DS041 and DS047 return only two Automatic/Hybrid options in the unqualified-formality separate-anchor tests. Their viable open-collar path remains subject to the existing two-No-Tie limit in those modes, and their tied candidates face existing source/owner constraints. This is not a newly imposed two-option ceiling and is not an image-loading exception. Modern's separate No Tie cap remains removed.

Only 18 shirts have connected full-length non-suit rendering. The pair audit verifies **270 currently connected blazer/shirt pairs and 480 unavailable pairs** before other scoring/style exclusions. The 480 are rendering-coverage gaps, not missing shirt IDs; the 32 suit-only shirts continue working where their actual suit-mode source/state permits. This software correction does not create those absent layers.

## Browser and preservation checks

- All **780 after cases** completed through actual app controls. No page JavaScript errors or generation exceptions were recorded. All ordered selections and counts matched the before engine results.
- For each of the 588 nonempty cases, the first and last cards were actually rendered and checked, including selected IDs, active card position, ready native canvas and decoded thumbnails. Multi-option lists were exercised across both arrow-wrap boundaries. This is boundary-card coverage, **not a claim that every intermediate card in every list was rendered**.
- Synthetic touch wrap-around was exercised for 61 anchors with a multi-option result. The four held-shirt anchors have no generated list to swipe. Physical Safari gestures were not tested.
- All distinct returned selections in each anchor suite had their renderer plans checked against real bound image paths. All **1,032 runtime rasters** were decoded successfully, not merely checked for filenames.
- **13 source-test groups** passed. All **1,075 baseline runtime image/data files** and all decision/ranking/rendering/storage modules remained byte-identical. Only the application lifecycle and diagnostic-description modules changed.
- The extended suite passed **40 assertions** covering Apply/Cancel/same-choice/Reset, stale-list recovery, saved-current retention, explicit current-outfit display, shirt warning/hold/conflict paths, manual rendering of all four held shirts, actual picture enlargement and PNG export, active synthetic Work-learning occasion transitions, and corrupt-feedback preservation.
- Pending-generation controls were checked at 320×568, 390×350, 390×844, 430×932 and 1280×1000. Small screens can scroll; controls remain reachable.

Browser tests used offline memory-loaded Chromium with actual generated application bytes, real image bytes, isolated synthetic storage and synthetic touch events. They do not establish HTTP asset availability, production cache state, physical iPhone Safari behavior or the owner's current model/history/weather. Synthetic current-session writes are expected when navigating; no owner browser profile was accessed, and no real wear, Favorites or feedback were seeded or changed. The active-learning fixture is explicitly synthetic and is not a user preference export.

## Preserved and unresolved boundaries

The approved B15 fit, shoe-15 correction, avatar and garment images, exact item IDs, independent shirt/tie selection, complete active card thumbnails, swipe/circular navigation, Work/Dinner/Weekend selection, watch-free style classification, Modern sneaker/No Tie rules, item caps, source holds, Favorites and feedback schemas remain intact. The separate explicit-rejection recurrence problem and other shoe/garment-source deficiencies remain outside this update.

The comprehensive matrices found no thrown generation exception under their stated controls; **that is not a guarantee against every possible combination of weather, formality, additional locks, browser state or live-site versions**. Reduced counts are reported as reduced counts, not padded to twenty or labelled complete recommendations.

## Files and installation

The cumulative `COPY_TO_APP` folder includes the current source changes, rebuilt hashed bundle/HTML/integrity records, all active thumbnail images and preceding runtime corrections. Merge its **contents** into the existing app root containing `index.html`, replacing matching files and retaining unrelated files. Do not nest COPY_TO_APP, copy only index.html, or erase existing asset folders. A local copy does not publish the website.

The optional `apply_update.py` defaults to a read-only dry run, verifies package and required base dependencies, refuses unknown local edits, and requires a new backup directory outside the app for an actual apply. Rollback is code-only and refuses later conflicting edits. Do not clear Safari data or import test results as wardrobe/feedback records.

Fresh installation and ZIP verification are recorded in `INSTALLATION_VERIFICATION.json` and the delivery receipt. Historical tests and interrupted attempts remain labelled separately from these completed tests.
