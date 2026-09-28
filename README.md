# HEWRS V1.17.4 — suit eligibility and automatic local weather

Continuation of the 18-shirt V1.17.3 build; not a new wardrobe or final certification.
S10/S11 no longer fail solely because old catalogue tags omit the calendar season.
Season tags remain unchanged metadata/advice. Actual material, heat, precipitation,
footwear, source-score, formality and explicit-lock guards still apply.

Location & weather → Enable automatic local weather authorizes the first request.
Successful activation saves and applies automatically; no additional Apply is needed.
The app refreshes on opening, returning and before generation, with a 15-minute
request throttle. A silent device-location lookup occurs only when the browser reports
granted permission. Otherwise existing saved coordinates are refreshed and labelled
as a saved location; unknown current location is not invented. Manual Apply or
Use without weather pauses automatic refresh. The browser controls permission expiry.

Preserved: 18 connected non-suit shirts, all 50 suit shirts, all suits/blazers and
physical IDs, 47 restored tie displays, 848 existing images, DNA, numerical scores,
Favorites, wear history, accepted phone layout and the two-use option-list caps.
Only the exact anchored item is exempt from its cap. No Tie defaults to at most two.
Shirt-only remains exact manual Anchor because numerical ranking is not installed.

## Run / install
Serve this complete folder. index.html alone is not self-contained.
The cumulative update supports exact V1.17.2 or V1.17.3. Copy the CONTENTS of
FILES_TO_COPY into the existing candidate root, replacing matching files and keeping
all other folders and .git. Do not upload the enclosing FILES_TO_COPY folder or ZIP.
Keep the same site address and browser data. No new repository is required.

## Verify
python -B tools/verify_v1174.py

## Rollback
python -B tools/rollback_v1174.py --check
python -B tools/rollback_v1174.py --output NEW_FOLDER
Restores exact V1.17.3 in a separate folder; never reads or changes browser data.
The inert automatic-weather preference key is ignored by the older version.

## Evidence and limits
See DELIVERY_V1_17_4.md and evidence/suits_auto_weather_v1_17_4/.
Fresh results: 85 functional checks, 19 in-memory Chromium checks, 166 pixel-equal
existing frames, 30 S10/S11 option navigation frames. Provider/permission successes
were simulated. Ordinary real-origin Chromium navigation was blocked before load.
No GitHub write, public deployment or physical Safari permission test was performed.
Old version-specific tests/verifiers apply to their restored source versions. Their
packaged historical pass records are not relabelled as fresh V1.17.4 results.
