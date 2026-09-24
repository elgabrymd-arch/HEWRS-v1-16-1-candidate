# HEWRS connected application V1.15

## Implemented clothing increment

This continues the supplied V1.14 application, not a new app, wardrobe, facelift
or garment-approval queue. Ten additional physical shirt IDs now work under all
14 connected blazers and in shirt-only Anchor mode:

**DS004, DS005, DS007, DS015, DS018, DS019, DS023, DS024, DS025, DS047.**

Each supports all 47 tie IDs and explicit NO_TIE. Together with the unchanged
DS001/DS014 routes, **12 shirts are connected in non-suit modes; 38 stay gated**.
All 50 remain available through their existing suit routes. Shirt-only manual
visual selection is working; a shirt-only numerical ranking model is not
installed. Existing blazer scoring and score holds remain unchanged.

The existing picker displays all 50 IDs, enables exactly the applicable 12 in
non-suit modes, and retains independent shirt/tie choices and Apply/Cancel.
DS040–DS043 remain NO_TIE-only in their existing supported suit routes. Shared
DS024/DS025 pixels never merge their catalogue or wear-history identities.

## Source and derivation boundary

The ten uploaded 600-pixel-wide WEBP images are included unchanged under
`provenance/batch10_v1_15/`. They are source donors, not recovered full-resolution
registered garment originals. Their available torso and sleeve panels are
spatially fitted into the **existing DS001 full-shirt exterior**, without
recolouring or generating whole garments. Spatial interpolation and blending
are explicit in `tools/build_batch10.py`. Existing native upper-shirt inserts,
front collar leaves and tie knots retain the current Active50 appearance.

The recovered V11 ZIP has SHA-256
`db02da603f7ce80be52e5cfe038d81a5f2d6ba8454f2634bf20999a346a2bd08`.
Its 32 replacement-shirt IDs are a different cohort: **these ten IDs are not
in that manifest**. The current V1.14 Active50 definitions, not V11 replacements,
therefore control their ID mapping and collar components. Its exact manifest
is retained as provenance; no old application or source appearance is restored.

New image files are separate content-addressed derivatives: 20 body-state
bindings use 18 unique base PNGs; six cuff PNGs cover the three IDs whose current
cuff components are empty (DS004/DS005/DS015), sampled from those IDs' uploaded
lower sleeves inside existing cuff alpha; 47 full-tie derivatives reuse each
same tie's existing full blade while retaining its current knot; one separate
source-difference blade mask documents the integration. There are 72 new unique
PNG files, 71 directly used at runtime. Nonempty native cuff plates are retained.

No original runtime image, input catalogue, score table, suit mask, avatar,
trouser geometry, original application controller, stylesheet, storage schema
or physical ID is changed. The accepted Home/Outfits/Wardrobe/Rotation facelift
and original palette remain. Watch ID/name display works; watch images remain
deferred. Source donors are low-resolution and cropped; the inherited straight
waist and some sleeve transitions are deliberately unretouched. This is not
physical-device or owner acceptance of newly derived registrations.

## Actual validation in this delivery

* 24 new functional checks and 21 inherited functional checks passed.
* 16 main Chromium checks and four renderer edge checks passed.
* 87 original frames are pixel-identical to a separate, untouched V1.14 tree:
  54 suit frames across all 18 suits, 28 frames across all 14 blazers, four old
  shirt-only frames and one default control.
* 760 new render exercises cover 280 blazer combinations (all ten IDs across
  all 14 blazers, open and T017) plus 480 shirt-only states (all ten IDs with
  NO_TIE and every tie). Another 47 exercises cover all ties with DS023/B06.
  These are 807 render exercises, not 807 distinct outfits or all 7,200 routes.
* Functional validation also covers all 7,200 new shirt/state/mode selections,
  16,800 exact shirt/pant/shoe selections and 39,817 existing suit/state routes.
  These are routing checks, not additional rendered-frame counts.
* All 576 pre-existing current component references and all 611 original
  runtime image files remain hash-matching. Source reconstruction checks retain
  the exact existing lower full-shirt alpha and current tie knots.
* Actual picker Apply/Cancel, exact-ID wear confirmation, frame retention on
  failures, last-request-wins rendering, watch text and phone-size Home layout
  were exercised. Test storage is explicitly synthetic, not the owner's data.

The rendering tests load actual packaged scripts and images in memory using
Chromium. A separate real-origin attempt was blocked **before app loading** by
`ERR_BLOCKED_BY_ADMINISTRATOR`. No security policy was bypassed. Hosted loading,
actual-origin localStorage/reload/process-restart persistence and physical
Safari/iPhone acceptance are **not certified**. No GitHub write, public
hosting, production overwrite or owner-history migration was performed.

Current evidence is in `evidence/batch10_v1_15/`. Earlier evidence is preserved
unchanged as historical evidence and must not be mistaken for V1.15 tests.
`RELEASE_STATUS.json` and `HEWRSApp.connection.implementationVersion` identify
this increment; the original controller's own version label is unchanged.

## Run the complete source

Keep the entire extracted directory; `index.html` alone is not self-contained.
All browser-runtime assets and built entry pages are included. Node, Pillow,
NumPy, SciPy and Playwright are development/test dependencies only.

From the extracted directory, for private local use on that computer:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/index.html` in that computer's browser. This command
is not a public deployment. Browser history is scoped to the browser profile
and origin (host plus port); another origin does not migrate existing records.
No production deployment has been authorized by this delivery.

## Verification and reconstruction

```sh
python3 tools/verify_v115.py
python3 tools/build_batch10.py --check
HEWRS_V115_FUNCTIONAL=/tmp/v115-functional.json node tests/batch10.cjs
HEWRS_V113_FUNCTIONAL=/tmp/v115-baseline-functional.json node tests/open-collar.cjs
python3 tools/build.py
```

The package verifier and HTML builder use Python's standard library. Image
reconstruction needs Pillow, NumPy and SciPy; functional tests need Node. The
self-contained Node run has 23 checks. The recorded 24th check compares rollback
storage handling with a separate exact V1.14 tree: after reconstructing it, set
`HEWRS_BASELINE_V114=/absolute/path/to/HEWRS_CONNECTED_APP_V1_14` on the same
Node command to include that check.
`build_batch10.py --check` reconstructs in memory and compares the installed
separate derivatives without rewriting approved original images.

For a fresh independent browser comparison, first reconstruct an exact V1.14
copy using the rollback command below, then run with Node, Pillow, Playwright
and Chromium installed (`/usr/bin/chromium` in the recorded environment):

```sh
HEWRS_BASELINE_V114=/absolute/path/to/HEWRS_CONNECTED_APP_V1_14 \
HEWRS_V115_BROWSER=/tmp/hewrs-v115-browser \
python3 tests/batch10-browser.py
python3 tests/batch10-edge-browser.py
HEWRS_V115_ORIGIN=/tmp/hewrs-v115-origin.json python3 tests/batch10-real-origin.py
```

The edge test writes fresh evidence within its named evidence directory;
rerunning it changes the package hash manifest until regenerated. Prior
version verifiers belong to their corresponding reconstructed versions,
not the changed V1.15 tree. They remain here for historical reproducibility.

## Reversible source and data safety

`CHANGED_FILES.json` names every added and changed file with hashes; it explains
its two self-referential exclusions. Exact replaced V1.14 bytes and the full
original payload manifest are saved in `rollback/batch10_v1_15/`.

```sh
python3 tools/rollback_v115.py --check
python3 tools/rollback_v115.py --destination /absolute/new/path/HEWRS_CONNECTED_APP_V1_14
```

The destination must not exist and must be outside this tree. The tool builds
and hashes a separate exact 1,053-file V1.14 folder; it does not overwrite this
application or read/change browser data. Preserve the V1.15 source and export
current history before a manual switch of served versions. Do not clear browser
storage or import an older ledger as a way to roll back code.

**Data compatibility limit:** V1.14 does not understand the ten newly activated
non-suit selections. When its existing storage validator encounters those new
wear events, it retains the raw ledger and blocks writes instead of deleting
or remapping the events. Raw export remains available; reopening V1.15 restores
normal interpretation. This behavior was tested with synthetic exact-ID events.
A code rollback preserves data but does not make new routes render in old code.
