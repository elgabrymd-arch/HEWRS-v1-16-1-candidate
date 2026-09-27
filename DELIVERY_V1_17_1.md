# HEWRS V1.17.1 — phone weather recovery and larger outfit display

## Result and evidence boundary

This continues the verified V1.17.0 automatic Engine/weather build with the same
18 connected non-suit shirts and all 50 suit-mode shirts. No wardrobe, DNA,
compatibility, rotation rule, score, physical ID, avatar or garment image changed.

The reported phone weather failure has **not been reproduced on the owner's
physical phone**, and its exact cause remains unidentified. This patch corrects
several reproducible workflow defects and makes failures distinguishable. It does
not claim that a simulated provider response proves that live weather now works
on the owner's device. Network restrictions prevented a successful live provider
probe in this environment.

## Larger avatar

On the actual 390 x 700 CSS-pixel Chromium test viewport, the prior canvas occupied
93 x 256.625 pixels. The new default full-outfit canvas occupies approximately
189.547 x 523 pixels: about twice the displayed width and height. The Outfits page
can scroll to the score, item details and logging controls underneath; Home's
layout and original palette are unchanged.

**Enlarge** opens a larger scrollable view of the exact current canvas. **Fit**
shows the entire outfit, and **Larger** restores the scrollable view. This is
presentation scaling only. The renderer still produces its original 996 x 2748
pixels; all 705 runtime images and every existing renderer remain byte-identical.
Opening and closing the viewer does not change selection, scores, wear or Favorites.
The copied enlarged canvas was checked for exact native-pixel equality.

## Weather changes

- A visible **Weather / work date** field and **Today** button expose old dates
  restored with a previous outfit. A date outside the provider forecast no longer
  presents only a generic failure. The user must choose Today/an available date
  or enter manual conditions. Today's conditions are never relabelled as a past
  date. Changing the date remains draft until Apply; confirmed wear is untouched.
- **City search works with the keyboard's Search/Enter action**, as well as the
  Search city button, and dismisses the search input focus. Weather text inputs
  use a 16px font. Search is independent of GPS permission and retains ambiguous
  choices for explicit selection.
- **Refresh selected location** reuses a selected city/approximate location
  without asking for another GPS fix. No location or network request starts on
  page load.
- Location permission, location timeout, network timeout, HTTP failures,
  unreadable responses and forecast-date problems have distinct readable codes.
  Progress distinguishes waiting for device location from fetching weather.
  The provider watchdog is 20 seconds; the overall device-location watchdog is
  45 seconds, allowing more time for the permission prompt. Missing callbacks or
  a transport that ignores abort cannot leave the operation pending indefinitely.
- **Retry lookup** and **Cancel lookup** are explicit. Closing the panel,
  changing the date or choosing manual conditions cancels pending results.
  A late GPS or provider result cannot overwrite a manual draft.
- **Apply is disabled during a lookup** or when its draft is incomplete/stale.
  Previously saved conditions are not silently replaced by errors or defaults.
  **Use without weather** remains a deliberate unassessed selection, not a fake
  weather reading. Manual temperature, precipitation and season stay available.

Example codes:

| Code | Meaning and next action |
|---|---|
| `LOCATION_DENIED` | Browser refused location. Permit this site's location or use city search. |
| `LOCATION_TIMEOUT` / `LOCATION_UNAVAILABLE` | No device position returned. Retry or use city search. |
| `HTTPS_REQUIRED` | Open the actual HTTPS site directly, not a local/offline preview. |
| `NETWORK_UNREACHABLE` / `NETWORK_TIMEOUT` | The provider request did not complete. Check connection/content blocking, retry, or use manual weather. |
| `HTTP_429` or another `HTTP_...` | Provider returned that HTTP status; it is not a GPS permission error. |
| `DATE_OUTSIDE_FORECAST` | Choose Today/an available date or enter that date's conditions manually. |

A permission failure is not solved by fabricating a location. A provider failure
is not solved by substituting clear weather, disabling CORS, using an unapproved
proxy or claiming a successful connection. This build does none of those things.

Official provider and browser contracts consulted during this implementation:
`https://open-meteo.com/en/docs`,
`https://open-meteo.com/en/docs/geocoding-api`, and
`https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition`.
They document API fields and the secure-context/user-permission requirements;
they are not evidence of a successful owner-device request.

## Fresh validation

**68 functional checks passed, zero failed:** 22 new recovery/integrity checks,
21 re-executed weather adapter checks, and 25 re-executed Engine/DNA checks against
an independent V1.17.0 tree. The latter compared all 112,392 indexed ensemble
score/hold results and 2,350 shirt-tie lookups with the baseline. These are numerical
comparisons, not 112,392 rendered frames. The weather eligibility/material policy
portion of `weather-context.js` is also exact unchanged source text.

**25 in-memory touch-Chromium checks passed, zero failed.** Tests used the actual
scripts, CSS, controls and source images. All 90 native outfit comparisons are
pixel-identical: the 18 connected non-suit shirts in tied/No Tie shirt-only/B03
modes, plus DS023 under all 18 suits. The actual Generate button and arrows still
rendered 15 distinct options. Enlarge/Fit/Collar Detail left native pixels and
wear/Favorites unchanged. A saved weather/outfit reinitialization used isolated
synthetic storage, not a claim of a physical browser-process restart.

Five viewport cases (320x568, 390x700, 390x350, 430x932 and 1024x768) retained reachable
weather controls. The 390x350 case simulates restricted keyboard space; it is not
an actual iOS keyboard. All successful GPS/provider inputs in these tests are
labelled fixtures. Failure tests covered denied GPS, failed provider, cancelled
late results, stale work dates and manual fallback. The screenshots supplied for
weather contain **synthetic test conditions, not the user's weather**.

A standard-library HTTP test delivered 57 application resources, including the
new versioned CSS and scripts, with exact bytes. A normal localhost persistent
browser-profile attempt was blocked before application loading by
`ERR_BLOCKED_BY_ADMINISTRATOR`, with no server requests; it was not bypassed.
Forecast and geocoding probes at demonstration coordinates failed DNS resolution.
Hosted/provider/iPhone success remains unverified. Exact V1.17.0 rollback and
installation of the overlay are checked separately in the packaging evidence.

An initial new test incorrectly used Python-style string method names in JavaScript;
only the test was corrected to `indexOf`/`lastIndexOf` and rerun. Final counts above
refer to completed passing runs. No earlier failed test run is counted as passing.

## Preserved scope and data

The 18 non-suit IDs, 32 deferred non-suit IDs, all 50 suit-mode shirt IDs, watch
ID/name behavior and absent shirt-only numerical ranking are unchanged. The
automatic Engine, accessory selection adapter, option index, original compatibility
and rotation modules, Favorites, Insights, stored-wear modules and mobile-sheet
adapter are unchanged. Weather's eligibility calculation is unchanged; it never
adjusts the clothing compatibility score.

Weather still uses `hewrs:weather-context:v1`; existing wear/Favorites namespaces
and schemas are untouched. Weather remains browser-local and separate from the
wear/Favorites backup formats. No real coordinate/provider response is added to
source code, public GitHub files or wear history. The prior user-reported approvals
are retained, not recast as a physical-device pass of this new patch.

## Installation

The update targets **V1.17.0**. Copy the **contents** of `FILES_TO_COPY` into the
existing `HEWRS-v1-16-1-candidate` repository, replacing matching files while
retaining every other folder and `.git`. Commit and push using:

```text
V1.17.1 — improve phone weather handling and enlarge outfit view
```

The application stylesheet and changed scripts have `?v=1171` URLs. No new
repository, account connection, API key, browser-data reset or Pages setup is
needed. This session did not upload or deploy the patch.

On the phone, open Location & weather. It should show **HEWRS 1.17.1** at the bottom.
Select **Today** when the displayed work date is old. Use my location, or search a
city and select the matching result; review and Apply. A remaining failure displays
its bracketed error code. Report that code rather than clearing browser data.

In Outfits, the default avatar is larger. Scroll for the lower details, or use
**Enlarge** for a scrollable close view. Do not log test outfits.

`python -B tools/verify_v1171.py` verifies the target tree.
`python -B tools/rollback_v1171.py --check` verifies restoration sources.
`python -B tools/rollback_v1171.py --output NEW_FOLDER` restores exact V1.17.0 to a
new destination without browser-data access. Existing output folders are refused.
The optional update installer creates a separate verified copy; it does not erase
or alter the source repository. `CHANGED_FILES.json` and the update's file ledger
record exact paths and before/after hashes. Self-manifest hashes are excluded
from their own lists.
