# HEWRS connected application V1.4

## Run the application

Extract this source ZIP. In its extracted directory, run:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/app.html` in the same computer's browser.
The entry point is `app.html`; this package does not replace production
`index.html`, publish a site, or write to GitHub.

## V1.4 change

Engine now uses the DS035 rendering connections already present in V1.3 for all
14 S11-template suits. The selected suit and **explicitly selected DS035** are
passed to the existing controller; Engine can choose a tie/no-tie mode, honor a
specific tie or tie family, and apply the existing context and rotation rules.

S01, S04, S05 and S16 retain free shirt selection across the existing Active-50
routes. The other suits (S02, S03, S06–S15, S17 and S18) require DS035 in both
Engine and Anchor. Those suits do not support ANY shirt or a shirt family.
Changing the suit never substitutes a shirt. An incompatible shirt remains
selected with Generate/Show disabled until the user explicitly selects DS035.
Opening Engine from an already displayed wider-suit/DS035 outfit retains those
explicit anchors.

The existing controller, numerical values and scoring policies are unchanged.
No new compatibility scores are supplied. No valid numerical result means no
Engine outfit is substituted; a valid exact selection remains viewable in Anchor.

All 35 registered footwear choices remain usable. Watches remain selection and
history metadata and are explicitly labelled as not rendered on the avatar.

## Preservation and storage

No PNG, source manifest, registered layer, avatar geometry, mask, original
renderer, DS035 coverage derivative, catalogue ID, score file, history crosswalk,
CSS palette, or local-state implementation was modified. V1.3's source-lock value
and `hewrs:connected-app:v1` storage namespace are retained. Compatible V1.3
candidate backups require no source revision change; production history is not
read, imported, migrated, or reset.

Only the request connection (`src/connection.js`), control interface
(`src/application.js`), HTML template, built HTML, documentation and tests change.
Request construction now also rejects unknown exact tie/watch selections and
footwear without a registered image before running the engine.

The original DS035 derivative's source, authorization and limits remain in
`evidence/DS035_COVERAGE_SCOPE.json` and the inherited V1.3 records. This release
neither redraws that derivative nor performs a new garment-approval review.

## Verification

```sh
python tools/verify.py
python tools/verify_engine.py
node tests/functional.cjs
node tests/suit-source-routing.cjs
node tests/suit-display.cjs
node tests/ds035-coverage-routing.cjs
node tests/engine-wider.cjs
python tests/engine-wider-browser.py
```

The application has no runtime package dependency. Tests require Node.js; the
browser regression requires Python, Playwright and Chromium. The inherited
DS035 derivative reconstruction additionally requires Pillow, NumPy and SciPy.

`tools/build.py` reproduces `app.html` from the packaged template and source list.
A standalone build can be made with `--standalone ../HEWRS_CONNECTED_APP_V1_4.html`.
The standalone transport is not claimed tested by the V1.4 browser report.

The new functional test compares the existing controller's complete reports
against preserved V1.3 connection code for all 672 exact wider-suit/DS035 mode
requests. This is engine execution and identity binding, not a 672-frame browser
sweep. The new browser test separately compares rendered Engine results with
V1.3 rendering and exercises UI selections, cancellation, empty results, local
wear confirmation and export/import.

Fresh results are under `evidence/engine_v1_4/`. Historical V1.3 results and
superseded test scripts are under `evidence/inherited_v1_3/`. The test backup named
`TEST_ONLY_ENGINE_BACKUP.json` is synthetic test data, not owner wear history.

## Remaining boundaries

Other shirts under the 14 wider-opening suits, wearable blazers, shirt-only
assemblies and rendered watches are not connected by this update. No garment
approval is withdrawn or requested. Existing source-edge outlines are retained.

Browser tests execute packaged code and original image bytes in an in-memory
Chromium page. A direct localhost navigation attempt was blocked by browser
policy. Hosted delivery, Safari, a physical iPhone and persistent browser
restarts are not certified by these tests. Nothing is published or deployed.
