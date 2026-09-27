# HEWRS V1.17.1 — phone weather and larger outfit view

Current version: **1.17.1**, based on 1.17.0. Read `DELIVERY_V1_17_1.md`.

The default outfit view is larger and includes Enlarge/Fit. Weather now has explicit date/Today controls, keyboard-search submission, cancellation, selected-location refresh and readable failure codes. The exact owner-phone weather failure is not yet identified; live device/provider success remains unverified. No DNA, score, image, physical ID or wear/Favorites data was changed.

Verify: `python -B tools/verify_v1171.py`. Exact V1.17.0 rollback: `python -B tools/rollback_v1171.py --output NEW_FOLDER`.

## Prior baseline documentation (historical)

# HEWRS V1.17.0 — Engine Choice, 15 options, location and weather

Continuation of the existing V1.16.7 18-shirt non-suit application. Not a new wardrobe,
facelift, approval cycle or website. This release implements the missing core workflow;
it is not a claim of completed physical-device/live-provider acceptance.

## Use
1. Serve this entire folder over HTTPS (the existing GitHub Pages candidate is suitable).
   Keep all assets, assemblies, data, src and vendor folders. index.html alone is not self-contained.
2. On Home, use Reset → Confirm reset once to clear any old manual locks. This does not
   delete current outfit, wear history or Favorites. Select Engine Choice.
3. Tap Weather / location in the header (or Season). Use my location requests permission;
   Search city lists matching places and requires a choice. Review conditions and Apply.
   Manual temperature band, precipitation and season are available when location/network
   access fails. Use without weather explicitly labels recommendations not assessed.
4. Generate Options chooses unlocked suit/blazer, shirt, tie/No Tie, physical trousers,
   shoes and watch. The arrows display up to 15 distinct qualifying clothing configurations.
   No shoe/topwear lock is required. Exact locks and category preferences remain effective.
5. For an anchor, lock just the intended pieces and leave the rest on Engine Choice.
   An all-exact Anchor displays that manual outfit. Shirt-only still requires an exact
   manual selection because its numerical ensemble model is not installed.

Weather uses Open-Meteo current model estimates (not a personal thermometer), or a
clearly labelled daily forecast for another supported work date. The feels-like HIGH
is used for future-date clothing bands. Current/forecast fetches expire after 90 minutes;
a stale or wrong-date reading prompts refresh/manual selection, never silent reuse.
Only rounded coordinates or the requested city query go to the weather provider; requests
are explicit and the app sends no wear/Favorites data. Weather settings use a separate
browser-local key and are not part of wear/Favorites exports or cross-device sync.

## Source and scoring integrity
Existing DNA, frozen values, core score/rotation code and 705 image files are unchanged.
The search index is a reproducible cache of 112,392 existing core evaluations, not new
scores. Source conflicts/holds remain excluded. Existing ensemble-component estimates
are labelled as estimates. Shoe/watch criteria and weather rules are recovered adapters,
separate from clothing compatibility; see provenance/core_v1_17_0/SOURCE_POLICY.json.
All 50 shirts remain in suit mode; 18 remain connected in blazer/shirt-only modes.
The other 32 are deferred. No garment IDs are removed, remapped, or merged.

## Build / verify / rollback
The HTML is already built. Optional rebuild: `python -B tools/build.py`.
Package verification: `python -B tools/verify_v1170.py`.
Cache replay: `node tools/build_option_index.cjs --check`.
Core tests: `node tests/core-workflow.cjs` (requires the independent V1.16.7 fixture
beside this folder or HEWRS_BASELINE_V1167 pointing to it).
Weather tests: `node tests/weather-context.cjs`.
Browser tests: `python -B tests/core-browser.py` (Python Pillow, Playwright and Chromium).
These browser tests use synthetic location/weather/storage, not physical iPhone testing.
`python -B tools/rollback_v1170.py --output NEW_FOLDER` reconstructs exact V1.16.7;
it refuses an existing output and never opens browser storage. The extra weather key is
left untouched on rollback; V1.16.7 ignores it.

## Update the current candidate
Use the included separate update ZIP from V1.16.7: copy the CONTENTS of FILES_TO_COPY
into the current repository root, replacing matching files and keeping all other files
and .git. Commit/push in the existing repository; do not create another website, change
its origin, clear website storage or log demonstration outfits.

See DELIVERY_V1_17_0.md for exact evidence, limits, changed paths and release boundary.
