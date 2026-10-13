# HEWRS V1.24.3 — anchor/style recovery and occasion validation

## What was actually reproduced

B03 + Modern, with B03 as the only exact selection, returns zero source-qualified Modern outfits under the existing classifier. The actual UI completed with a generic dead-end message; no JavaScript exception occurred in that reproduction. The request examined 12,960 clothing candidates, of which 11,115 were source-eligible; all of those failed the style filter. This is not a missing B03 image or a damaged B03 registration.

Changing occasions exposed a separate real exception when a Work learning model was active: `Learning context differs from the requested occasion; refresh this occasion’s model before generating.` Request construction ran before refreshing the occasion-specific model. This has been corrected in Generate and Regenerate; feedback refresh also uses the active occasion. Tests use explicitly synthetic responses, not the owner's current feedback.

A second existing UI fault was reproduced: after a cold no-match search, returning Home and then Outfits could automatically render the unrelated default S05 outfit. An outstanding result/error now blocks that implicit restore. Explicit View current outfit still works.

## Implemented changes

- Verified empty searches have a distinct no-match outcome, their specific cause, preserved zero count, and accessible recovery controls outside the hidden outfit card.
- For B03/Modern, the page explains the existing two-versus-three clothing/footwear-element restriction. The owner can explicitly select `Keep B03 · try Hybrid`; the same other selections are retained and a real new Hybrid search runs. There is no automatic mode switch or relabelling.
- Contradictory selections, including No Tie plus Tie required or a blazer plus Suit required, have specific explanations. Neither choice is secretly changed.
- Runtime/validation failures have a retry path and a downloadable redacted diagnostic containing the app version, attempted selections, context, status and coarse weather. No saved votes, model weights, wear records, Favorites, credentials, coordinates or place names are exported.
- Request validation uses the correct occasion-scoped learning model before it creates the request. Raw feedback remains byte-identical.

## What this does not change

**B03 + Modern still has zero matches under the strict existing definition.** B03 + Automatic gives 20; B03 + Classic gives 20; B03 + Hybrid gives 18 in the controlled scenario. This patch repairs the dead-end/error handling, not the style definition. Changing that definition to classify a classic blazer plus open collar and sneakers as Modern would be a separate style-policy change.

No classifier thresholds, garment attributes, ranking weights, frozen scores, exact locks, per-item caps, Modern No Tie/sneaker policy, image files, B15 fit or storage schema were changed. Watches still contribute zero to style. A reduced list is not padded to twenty.

## Complete anchor/style/occasion matrix

Newly executed before and after: **18 suits + 15 blazers × 4 styles × 3 occasions = 396 paired configurations, 792 completed engine runs.** All other items were unlocked; Research method; formality any; fixed date 2026-10-12; weather not assessed; inactive matrix learning; empty synthetic wear.

All 396 ordered output lists retained their exact selections, checked scores and classifications. There were no thrown engine exceptions in this matrix. 339 configurations returned outfits; 57 were verified no-match results (the same 19 anchor/style pairs in each occasion).

| Strict style producing no matches | Affected anchors in Work, Dinner and Weekend |
|---|---|
| Modern | S12, S15, S17; B02–B05, B07–B10, B12–B15 |
| Classic | B01, B06, B11 |
| Hybrid | B11 |

These are restrictions of the present classifier/source coverage, not a claim that those real garments cannot be styled that way. No fixed three-/four-/eight-option ceiling was added.

## Other fresh tests

Fourteen source test groups passed, covering source/module preservation, typed no-match outcomes, conflicts, exact tie/dress-shoe/sneaker/No Tie/No Watch locks and diagnostic redaction. All 1,075 baseline runtime image/data files are unchanged, including the original protected 1,068-file set.

Forty-five browser assertions passed with the actual rebuilt startup bundle and real image bytes. They include before/after B03 error-state reproduction, explicit Hybrid recovery, all 18 recovered cards and thumbnails, circular arrows and synthetic touch, four pixel-identical original native renders including approved B15, picture enlargement, PNG export, active-learning occasion transitions, corruption retention/retry, conflict handling, default-restore suppression, and explicit current-outfit restoration. Recovery controls were checked at 320×568, 390×350, 390×844, 430×932 and 1280×1000. Short screens scroll; controls remain reachable and are not hidden behind navigation.

Counts describe different kinds of checks, not independent aesthetic approvals. Engine matrix learning was inactive; active learning was separately exercised in the contextual browser tests. This is not a test of every combination of locks, weather, history and stored records.

## Evidence and unsuccessful attempts

Original archives/source were hash-verified before editing. Initial parallel baseline runs exhausted test resources; their completed cases were retained and missing cases resumed in fresh processes. An interrupted browser attempt is not counted as a completed suite. A later fault-injection test exposed unintended default restoration in an error path; the code was corrected and the complete final suite passed. Failed/interrupted attempts remain labelled in the evidence package.

## Deployment and unresolved scope

The GitHub Pages URL could not be retrieved with web access and container DNS could not resolve it. The GitHub integration was available but not connected. No remote files were read successfully or published. The owner's exact phone error text was not supplied, so a different live-site failure is not claimed to be reproduced or eliminated.

Testing used offline Chromium with synthetic storage/touch, not physical iPhone Safari or production browser data. Source bundle/SRI consistency is checked independently from file bytes. Existing missing shoe connections, other shoe/S02 appearance issues, explicit-rejection recurrence and unconnected casual garments remain outside this patch.

## Installation

Merge the **contents** of `COPY_TO_APP` into the existing app root that contains `index.html`, replacing matching files and retaining unrelated files. Publish through the existing deployment. This cumulative update includes the earlier cards, thumbnails, swipe/loop navigation, shoe-15 correction, style/occasion changes and approved B15 fit. It is not a standalone replacement site or a wardrobe/feedback import.

The optional installer performs a dry run unless `--apply` is given, checks every supplied file and required base dependency, refuses unknown local edits, and creates a code-only rollback backup outside the app. Do not clear Safari data, reset learning, or replace a saved-data file with test evidence.
