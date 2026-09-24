# HEWRS connected application V1.3

## Run

Extract this source ZIP and serve its directory with a static file server, then open
`app.html`. For example, from the extracted directory:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/app.html` locally. No installation over a production
`index.html`, account connection, repository write or deployment is included.

## Implemented scope

- S01, S04, S05 and S16 retain their original independent shirt/tie/shoe paths.
- Anchor adds DS035 with NO_TIE or T001–T047 under the fourteen registered
  S11-template suits. No other shirt is enabled under those suits.
- Engine remains on the original four suit routes. Entering Engine from a wider
  suit requests an explicit connected suit choice; it does not replace the suit.
- All 35 existing registered footwear choices remain available.
- Existing saved suit views are unchanged fixed-control reference images.
- Watches remain selection/history metadata, not rendered wrist layers.

## DS035 coverage derivative

The owner authorized a separate DS035-only fabric extension on 2026-09-22 at
04:42:10 UTC. Two mode-specific 996 x 2748 RGBA layers are added, with 5,370 and
5,833 nontransparent pixels respectively. They are new integration derivatives,
not recovered originals or an assertion of new owner appearance approval.

RGB comes exclusively from the original DS035 no-tie body. The algorithm reflects
opaque neutral cloth samples and smooths only the derived field. Old S11 control
RGB is not used. Its alpha-only copy locates the opening.

Masks are restricted to the registered shirt opening previously hidden by the
fully opaque S05 jacket and now exposed by the S11 jacket. Avatar, neck, hands,
collars, cuffs and opaque original body support are excluded. The runtime also
excludes every selected tie pixel with nonzero alpha. The operation underfills
only nonopaque pixels and leaves all previously opaque output pixels unchanged.
It fills transparency; original extracted edge outlines are not retouched.

The original `vendor/active50-renderer.js`, 496 existing asset PNGs,
`data/inputs.json`, `data/inputs.js`, original scoring modules, source register,
source crosswalks and `src/local-state.js` are unchanged. The same source-lock
value and separate candidate storage namespace are retained. No existing
production history is imported, migrated or reset.

The prior `HEWRS_CONNECTED_APP_V1_2_DS035_S11_CANDIDATE_SOURCE.zip` is superseded.
Its extensions exceeded the bounded opening and did not close the lower gap;
its changed inputs JSON was not synchronized with the executable inputs script.
None of those two extension images or its modified vendor renderer is used here.
Exact measurements are in `evidence/DS035_COVERAGE_SCOPE.json`.

## Tests and rebuilding

```sh
python tools/verify.py
python tools/verify_ds035_coverage.py
node tests/functional.cjs
node tests/suit-source-routing.cjs
node tests/suit-display.cjs
node tests/ds035-coverage-routing.cjs
python tests/ds035-coverage-browser.py
```

The Python image verification requires Pillow, NumPy and SciPy. Browser testing
requires Playwright and Chromium. The application itself has no such dependencies.

`python tools/build.py` reconstructs `app.html` from the template and source list.
`python tools/build.py --standalone ../HEWRS_CONNECTED_APP_V1_3.html` makes a
self-contained version with embedded images. That large standalone transport is
not the browser transport used for the reported V1.3 tests.

`python tools/build_ds035_coverage.py --check` reproducibly checks both new images
and their manifest without rewriting them or any source. Older browser scripts
are retained under `evidence/inherited_v1_2/test_scripts/` as historical evidence,
not described as passes for V1.3.

## Verification boundaries

The browser report records 672 actual new DS035/suit/mode renders, 11 original
S05 exact comparisons, 35 footwear selections, UI restrictions, cancellation and
three phone-sized viewports. Tests load the exact packaged template/CSS/JavaScript
and original/derivative PNG bytes in memory. Direct local-file navigation was
blocked by the execution environment. Hosted delivery, Safari, a physical iPhone
and persistent real-browser restarts are not certified by these results.

No other shirts, blazer assembly, shirt-only assembly or watch rendering are added.
No earlier garment, avatar, measurement or layer approval is reopened.
