# HEWRS V1.23.2 — in-app side-by-side option cards

## Implemented

The actual app now uses the requested picture-card arrangement on phone and desktop:
full outfit on the left; the current suit/blazer, shirt, tie/No Tie, shoes, trousers,
and watch IDs/names on the right. This is a modification to the existing Outfits
screen, not a static mockup, separate app or exported-picture-only change.

The card now precedes the presentation/export/preferences toolbar, instead of being
pushed below it. Previous/next and Full outfit / Collar detail / Enlarge controls
sit below the card body, no longer consuming the avatar column's width. Current
option title/count remains visible. Successful navigation to a different selection
returns the card to the top. Failed/cancelled navigation retains the prior card.

Actual shirt/tie/shoe pictures are visible beside the outfit on the tested portrait
phones. Each picture is a button opening its existing source thumbnail at a larger
size with its exact ID and full name. Item pictures opens all six role rows. A
350-pixel-high viewport still needs vertical scrolling for the full card; its Item
pictures button is immediately visible. Very small/short screens may also scroll
to reach lower metadata and navigation. This does not claim the entire application
or every possible long card fits every screen without scrolling.

The original dark/gold palette, Standard view, full-body enlargement, Home,
Wardrobe, Rotation, existing export functions and data controls remain. Watches
remain ID/name only. No watch image or substitute footwear was invented.

## Shoe-15 and all source imagery retained

This increment is based on exact V1.23.1-shoe15, not a rollback to the original shoe.
The source-photo thumbnail, new shoe-15 layer, source photo and original image
preservation from that update are unchanged. All image/data bytes match V1.23.1.
No avatar, garment, source-photo, native geometry, scoring, weather, preference,
Favorites or wear-history correction is performed by this UI increment.

The cumulative download accepts either exact V1.23.0 from the original seven-part
handoff or exact V1.23.1-shoe15. It includes the prior shoe correction; no separate
shoe patch is required first. It is an incremental update, not a standalone app.

## Newly executed verification

* Original V1.23.0 reconstructed from the supplied seven ZIP parts and verified:
  2,607 payloads plus the original manifest; original verifier passed.
* Previous shoe-15 archive SHA-256 matched the delivered identity. Its actual
  installer was run on a clean copy, and its 2,639-payload verifier passed.
* Six source-check groups passed: 238 exact model comparisons across connected
  garment/watch cases; original image/data hashes; all non-presentation executable
  hashes; exact preservation of core controller functions; control IDs; and a
  check that the card module cannot write private state or generate recommendations.
* Fifty-six final browser assertions passed using the actual rebuilt bundle and
  real image bytes in isolated offline Chromium. Nine same-selection native
  before/after frames were pixel-identical, spanning suits, S02's retained warning,
  B01/B02/B03, No Tie, DS035, shirt-only, shoe-15 and shoe-8.
* Tested initial layout at 320x568, 390x350, 390x780, 390x844, 430x932 and 1280x1000.
  Shirt/tie/shoe images in the tied control decoded and were initially visible in
  the five taller sizes. At 390x350 the picture control was initially visible and
  opened the complete scrolling item panel. No horizontal overflow was detected;
  bottom navigation stayed inside the viewport. Tested card buttons were >=44px.
* The actual Generate button produced 20 options in a research-mode test anchored
  to S05, DS001 and shoe-15, with tie/watch unrestricted, Clinic, no required
  formality, weather unassessed, and no trained feedback/wear history. All 20 were
  navigated with matching titles, counts, exact IDs and decoded visible pictures.
  This was NOT an unrestricted all-wardrobe or four-style failure reproduction.
* Source-photo enlargement, all-item panel, Standard/Card toggle, collar/full view,
  original Enlarge/Fit, invalid-selection preservation, render cancellation, and
  explicit simulated thumbnail-error fallback passed. The image-error probe is a
  synthetic event, not a production-network outage test.
* PNG export was byte-identical to V1.23.1 for the reference selection. Two actual
  generated cards exported as self-contained HTML with decodable images and exact
  role IDs. Exports left stored test data unchanged.
* Home screenshot matched V1.23.1 exactly before interaction; Home remained one
  screen at 390x844 afterward. Picker Cancel retained preferences.
* No real browser data was read or written. Generation/navigation wrote only the
  expected session selections in disposable memory; no wear events, preference
  votes or Favorites were created, and the synthetic sentinel remained unchanged.

These counts describe different checks, not independent aesthetics judgments.

## Limits and recorded incomplete attempt

The initial browser run stopped during a test-harness polling call blocked by CSP
(Playwright expression evaluation). That incomplete result is retained separately
as ATTEMPT_1_HARNESS_CSP_WAIT.json. The test helper was changed to poll a callable
through DevTools without eval. The final full suite passed; app CSP was not weakened.
The old FAILURE.png is that first attempt, not a later app regression.

Browser tests loaded actual local bundle and image bytes into Chromium in memory.
They are not physical iPhone/Safari tests, live-site/cache tests, provider tests, or
network execution of SRI. Generated bundle, CSS fingerprints and HTML SRI are
verified separately from the exact files. No claimed current-device style result,
full wardrobe combination audit or new appearance approval is implied.

The reported Classic/Hybrid zero-result condition, missing shoe connections,
other shoe mismatches and explicit rejected-outfit recurrence remain unresolved.

## Deployment and rollback

No GitHub, Pages, Netlify or other site was changed. The downloaded archive does
not install itself on the hosted app. The package README contains exact dry-run,
install, verification and rollback commands. Full manifests are checked before
writes; later/unknown edits are refused. No browser clearing or feedback re-import
is needed for this UI change.

The packaged apply/rollback tests are recorded in PACKAGING_TESTS.json. Baselines,
rollback payloads and the cumulative change list are included. Historical evidence
files remain untouched and are not reclassified as fresh tests.
