# HEWRS V1.17.0 — automatic Engine Choice, location/weather, 15 options

## Implemented core workflow

This is a changed continuation of the verified V1.16.7 18-shirt non-suit build.
The previous final-release designation was premature: the 18-shirt instruction
limited clothing inventory, not the required automatic Engine/weather workflow.
No new wardrobe, facelift, image batch or garment-approval queue was started.

With all six preferences unlocked, Generate Options now chooses a suit or blazer,
shirt, tie/No Tie, physical trousers when needed, registered shoes, and a watch.
No exact suit, blazer or shoe must be selected first. It returns 15 distinct
qualified clothing configurations when enough meet the active constraints.
Insufficient results are reported explicitly; there is no duplicate padding,
fabricated score, silently relaxed lock, or added compatibility diversity bonus.
Different physical items stay distinct even when their image/color layer is shared.

Partial Anchor now retains just the intentionally selected items/families and
chooses the remaining pieces. Full exact Anchor still renders the manual selection.
An exact No Tie or No Watch stays null, not an invitation for automatic substitution.
An explicit separate-trouser lock with no exact suit selects blazer combinations;
matching suit trousers remain intrinsic when a suit is locked.

## Location and weather

The header and Season control open the new Location & weather panel. Use my
location requests browser permission, then queries Open-Meteo with coordinates
rounded to 0.01 degrees. It displays the approximate device coordinate location,
not an invented city. City/postal-code search lists possible locations; the user
chooses the intended result. No location or network request occurs on initial load.
Applying the reviewed result commits it; cancelling a draft does not change it.

The request includes current air temperature, apparent/feels-like temperature,
precipitation and weather code, plus a seven-day forecast and provider timezone.
Current conditions are labelled model estimates, not physical sensor observations.
Future-date conditions are labelled daily forecasts and use the apparent-temperature
HIGH. A daily forecast is not assigned a fabricated noon observation. Unsupported
work dates, unexpected units/codes, missing data, denied location, network failure
and timeouts expose an error and retain the previously saved conditions. Manual
feel-like temperature band, precipitation and season remain available.

Live/forecast requests expire after 90 minutes or a work-date change. The user must
refresh or explicitly choose manual/not-assessed conditions. Location/season alone
is not claimed to prove temperature or garment suitability. Use without weather is
explicitly labelled not assessed, rather than silently assuming clear mild weather.

Weather affects the eligibility of complete options using recovered Phase 9 rules
and explicit recorded season facts; it never adds to the fixed clothing score.
Unknown fabric or sole/traction facts remain unassessed. A visual "boucle-like"
phrase is not promoted to known tweed cloth, and suede elbow patches do not turn the
whole blazer into an all-suede garment. The inherited snow/ice dress-shoe exclusion
is a category proxy, not measured sole grip or a safety certification.

Provider documentation reviewed: https://open-meteo.com/en/docs and
https://open-meteo.com/en/docs/geocoding-api . Browser permission model:
https://www.w3.org/TR/geolocation/ . Attribution is visible in the panel.

## DNA, compatibility and rotation integrity

Existing DNA/scoring inputs, numerical engine, approved shirt–tie overlay,
source locks, IDs/aliases, renderers, wardrobe image bytes, Favorites and existing
wear-storage modules are unchanged. The pure core checks compare every **112,392**
indexed ensemble score/hold result against the independently restored V1.16.7
engine, plus **2,350** shirt–tie lookups including held/unknown values.

The new option index is a reproducible acceleration cache of these existing core
outputs, not new judgments. Every displayed option is also freshly evaluated and
checked against that cache. Original unresolved scores and canonical-description
holds are excluded, not filled to reach fifteen. Tied weights and the independent
No Tie calculation remain untouched. Source component estimates are still estimates
and are now labelled as such beside the displayed classification/score.

Accessory formulas were recovered from the named historical shoe/watch composites.
They use an explicitly documented adapter to the current canonical color/pattern
records instead of stale name-based lookups. These are contextual rule inferences,
not newly approved DNA or physical measurements. Accessories are selected after a
clothing configuration; the watch is selected last. These accessory preference scores
are shown separately and are not blended into clothing compatibility.

The original near-equivalent band, recorded recency weights, confirmed-actual-wear
filter and rotation selector remain unchanged. Accessory preference ties use confirmed
last-wear dates then a stable physical ID. Unconfirmed/views/Favorites are not wear.
A blocked rotation recommendation is not disguised as compliance; qualified compatibility
options remain labelled separately for deliberate owner selection.

All **705 original runtime images** remain byte-identical. No new image appears in
assets/ or assemblies/. The accepted DS023 corrections, mobile-sheet code and palette
remain intact. The 18 non-suit / all-50 suit-shirt universe is unchanged, including
all independent physical IDs and the 32 deferred non-suit IDs.

## Fresh tests in this implementation

**109 functional checks passed:** 25 core workflow/integrity checks, 21 weather
adapter checks, 31 rerun Favorites checks and 32 rerun Insights checks. These include
all-unlocked generation, partial and full locks, No Tie/No Watch, insufficient pools,
held scores, unbound trouser profiles, style/formality requirements, weather changing
eligibility without changing compatibility, state isolation and cancellation.
The row/lookup counts above are numerical checks, not rendered-frame counts.

**26 Chromium checks passed.** The actual Generate Options UI produced 15 distinct
options without preselecting topwear/shoes; all 15 arrows displayed their exact
physical selections. The provider/location fixtures were synthetic and clearly
separate from the user's current location/weather. City ambiguity, permission denial,
network failure, manual fallback, Apply/Cancel, source-estimate labelling, partial
Anchor and synthetic saved-state reload were exercised. Generating/viewing options
left wear and Favorites unchanged. Five normal/keyboard-sized viewport cases kept
weather controls reachable. These are not actual iPhone keyboard tests.

**90 unaffected complete outfit frames remained pixel-identical** to V1.16.7:
18 connected shirts tied/No Tie under B03 and shirt-only, plus DS023 under all18 suits.
A separate local HTTP check delivered 57 current resources with exact bytes.
The exact rollback was reconstructed and compared to all V1.16.7 source payloads.

During development, one test called a nonexistent shorthand lookup method; it was
corrected to the existing approved lookup API. A snow test mistakenly used a loafer
instead of the intended dress-shoe category; its fixture was corrected. Initial browser
runs exposed harness issues with string-evaluation under CSP and missing preload for
a saved synthetic outfit; arrow predicates and exact saved-image preloads resolved
those harness faults. Final pass counts refer only to completed corrected runs.
No browser-policy restriction was bypassed.

## Material unverified limits

The standard localhost persistent-profile browser attempt was blocked before loading
by ERR_BLOCKED_BY_ADMINISTRATOR. A direct live provider request at non-user demonstration
coordinates failed DNS resolution; the web retrieval tool also could not fetch that API
response. The official API documentation was accessible, but that is not a successful
live weather response. **Live provider access, hosted browser behavior, actual device
permission and physical iPhone/Safari acceptance of this increment remain pending.**
Tests of provider success/denial/failure used explicit fixtures, not invented real weather.
No GitHub write or deployment was performed.

Automatic numerical selection supports the existing clinic/hospital/work suit/blazer
contexts. Shirt-only still uses exact manual Anchor because its numerical ensemble
model is not installed. Dinner/weekend and other previously unavailable functions are
not silently declared connected. Watch images remain deferred, with ID/name shown.
Existing source-resolution and visual-seam limits are not repaired by this code update.

## State and privacy

Weather settings use `hewrs:weather-context:v1`, separate from the unchanged wear/session
and Favorites keys. Weather data is local to each browser and is not part of the older
wear/Favorites export formats. It can be reselected after a move/reinstall; no new automatic
cross-device sync or migration is introduced. No coordinate or provider response is written
to the public repository or to wear history. Requests omit credentials and referrer.
The CSP permits only the two named weather hosts in addition to the current origin.

## Install and rollback

Use the V1.16.7 → V1.17.0 update package. Copy the **contents of FILES_TO_COPY** over the
existing candidate repository root, replacing matching files while retaining every other
folder and `.git`. Do not change repository, site origin or browser storage. Then commit
and push. This task has not uploaded the update for the owner.

On the updated website: Home → Reset → Confirm reset clears old preference locks without
removing the current outfit or wear/Favorites; select Engine Choice. Weather/location →
Use my location or select a searched city → Apply. Generate Options then builds the full
unlocked choices. Keep an intentional preference locked when using an anchor.

`tools/verify_v1170.py` checks source hashes and evidence; `tools/build_option_index.cjs
--check` reconstructs the numeric cache. `tools/rollback_v1170.py --output NEW_FOLDER`
restores exact V1.16.7 in a separate destination and never opens browser data. The new
weather key is left untouched; V1.16.7 ignores it. `CHANGED_FILES.json` records exact
added/modified paths and before/after hashes. The update has its own target manifest.
