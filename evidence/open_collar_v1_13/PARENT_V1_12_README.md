# HEWRS connected application V1.12

## Completed in this update

B01 and B02 are connected through the existing facelift pickers, exact Anchor
selection, Engine results, native rendering, confirmed-wear history and backups.
Together with B03–B14, this makes all 14 canonical blazer IDs available with the
existing DS001 tied assembly and its 47 tie selections. All 24 physical trouser
IDs and 35 registered shoe pairs remain exact. Engine uses the existing 15
numerical trouser-profile mappings; the nine null profiles remain manually usable.

This operation follows the owner's `I approve b01/b02` ruling at
2026-09-23T03:57:47Z. It does not reopen the earlier garment or avatar approvals.
Watch ID and name remain sufficient for this release; images are deferred.

## B01/B02 source bindings

The original checkpoint layers and controls remain unchanged. Two separate
appearance derivatives bind the later approved B01 medium-navy reference and
B02 midnight micro-check / no-pocket-square reference to each original 996 × 2748
wearable alpha. The fixed affine registration acts on reference cloth RGB only:
not on the avatar, canvas, jacket silhouette or catalogue IDs. Invalid source
edge samples are replaced only with nearby cloth from the same reference.

These are **source-derived integration assets**, not byte-identical recovered
originals. The source references, exact transforms, excluded sample classes,
boundary resampling counts and alpha hashes are in
`evidence/b01_b02_v1_12/DERIVATION.json`.

The original B02 jacket-ownership mask suppresses the full-shirt sleeve pixels
that are owned by the jacket. Its grayscale red channel is used as specified,
not its all-opaque alpha channel. The existing standalone DS001 cuffs own their
recorded rows from 1339 downward; the full-shirt's baked-in cuffs do not render
as a second pair. This retains the existing cuff and hand sources.

The two new routes compose the current avatar, selected shoes/trousers, original
CP49 DS001/tie layer, existing ownership mask, source-bound blazer, and original
cuffs/hands at their native coordinates. No old full-person reference is shown
instead of the selected outfit.

All existing suit, B03–B14 and shirt-only renderer files remain byte-identical.
The facelift CSS, UI controller, catalogue/scoring inputs, current score records,
controller equations, trouser profiles and saved-data implementation are unchanged.
The source lock and `hewrs:connected-app:v1` storage key are preserved. Merely
opening a picker, generating, or displaying an outfit never records actual wear.

## Run

Keep `index.html` beside `assets`, `assemblies`, `data`, `src` and `vendor`.
It is a folder-based application, not a standalone single HTML file.

```sh
python tools/verify_v112.py
node tests/final-blazers.cjs
python tools/build.py
python -m http.server 8080
```

For exact appearance-derivative reconstruction:

```sh
python tools/bind_final_blazers.py --check
```

The reconstruction uses the recorded OpenCV, NumPy, SciPy and Pillow operations.
It reads the preserved reference pixels and original alpha; it does not invoke an
image generator or need any new garment photograph.

Browser test:

```sh
HEWRS_BASELINE_V111=/path/to/HEWRS_CONNECTED_APP_V1_11 \
python tests/final-blazers-browser.py
```

The reference path is the unchanged prior V1.11 source, not an older production
app. `HEWRS_V112_BROWSER` and `HEWRS_V112_FUNCTIONAL` redirect test outputs.

## Remaining release boundaries

Blazer rendering still uses DS001 and tied states. Independent other-shirt and
no-tie blazer assemblies, plus remaining shirt-only clothing modes, are separate
unfinished connections. Shirt-only remains DS001 tied / exact Anchor. Their
clothing approvals are not withdrawn. All 18 existing suit routes remain present.

The earlier V1.11 frontend limitations (exact topwear/footwear required by the
current generator, unavailable weather/season handlers, rename/Favorites, and
full-generating-preference persistence) are not changed by this operation.
Watch ID/name display remains connected; no watch-image dependency is introduced.

Current verification measures this scoped change, not a complete-product release.
Chromium source/asset tests are distinguished from any ordinary loopback HTTP
probe in `evidence/b01_b02_v1_12/browser/BROWSER.json`. No physical iPhone/Safari or
public-site certification is implied. Nothing is pushed to GitHub or deployed.

## Evidence and rollback

`BASELINE_V1_11.json` pins the exact starting files. `CHANGESET.patch` lists the
runtime changes. `FUNCTIONAL.json`, `browser/BROWSER.json` and `RESULT.json`
record new checks separately from historical reports.

Rollback to the supplied V1.11 source archive restores the previous application
code; do not import an old user-data backup as part of code rollback. Do not roll
back while new B01/B02 events need to be displayed by older code that has no such
route. Retain/export the current ledger instead of silently deleting those events.
The older facelift-only rollback script remains historical and is not the
rollback procedure for this subsequent clothing change.
