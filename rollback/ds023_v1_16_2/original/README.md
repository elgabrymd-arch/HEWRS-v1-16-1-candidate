# HEWRS connected application V1.16.1

## Current clothing build

This continues the delivered V1.16 application. There is no new wardrobe,
facelift, scoring model, garment generation or approval queue in this correction.

**18 shirts are connected in blazer and shirt-only modes.** They are the original
DS001/DS014 routes; the approved V1.15 cohort DS004, DS005, DS007, DS015, DS018,
DS019, DS023, DS024, DS025, DS047; and the V1.16 additions DS002, DS006, DS008,
DS021, DS022 and DS027. Each has all 47 ties and explicit NO_TIE. All 14 blazers
remain connected, including B01/B02. All 50 current shirts remain connected to
the existing 18-suit routes. The other 32 non-suit shirts remain gated.

This release does **not** claim that the remaining V11 suit-opening inserts
contain complete bodies and sleeves. Shirt-only manual Anchor selection works;
shirt-only numerical ranking is still not installed. Existing numerical holds,
NO_TIE-only restrictions, nine unbound trouser profiles, the 24 physical trouser
IDs, 35 footwear pairs, separate catalogue/history IDs and watch ID/name display
are unchanged. Watch pictures remain deferred.

## What V1.16.1 fixes

V1.16 contained working six-shirt registrations but still included V1.15 release
metadata, README, change ledger and package hashes. Five listed payload hashes
no longer matched and 44 files were not represented by that inherited manifest.
The HTML title still identified V1.12 and the app's version property identified
V1.11. These release-identity defects are corrected here.

The non-suit registration list now preserves the V1.15 ten-ID order and appends
the six recovered IDs. Physical catalogue IDs, wear-history IDs and existing
image selections are not renumbered or reassigned. The published counts are
consistent: 18 connected, 32 gated, zero additional activations in this patch.

All **699 runtime image files from V1.16 are unchanged**. This includes every
runtime image from V1.15. The existing source registrations, current collars,
knots, hands, avatar, garment geometry, suit masks, scoring inputs, stylesheet,
facelift controls and storage schema remain in place. Only the application's
version label changes in its controller file; rendering code remains unchanged.

## Sources and acceptance boundaries

The registered donors are the owner's supplied 600-pixel-wide WEBP files. They
are not recovered high-resolution full-garment originals. Available panels were
registered into the existing full-shirt exterior in V1.15/V1.16. The separate
source-derived files and same-ID current collars/cuffs are retained exactly.
DS002, DS004, DS005, DS015 and DS022 have disclosed separate cuff derivatives
because their inherited current cuff components are empty. No new image work
was performed for V1.16.1.

The owner's V1.15 approval and recovered-source approval remain in force.
This package does not invent physical-device acceptance for V1.16/V1.16.1.
Inherited low-resolution and sleeve/waist transition limits remain disclosed,
not silently retouched. Earlier evidence remains historical, including older
counts and older version-specific verifiers; it is not the current receipt.

## Current validation

See `evidence/release_v1_16_1/` and `DELIVERY_V1_16_1.md` for newly executed results.
The checks cover the six recovered IDs, all 47 ties and NO_TIE in shirt-only
mode and under B03, all 14 blazers with NO_TIE and T017, existing-frame pixel
comparisons, actual picker interaction, exact-ID wear recording, image-failure
retention, cancellation, watch text and source/hash preservation.

Browser rendering uses the actual source scripts and images loaded in memory
with Chromium. Test wear data is synthetic and isolated. A separate attempt to
load the actual localhost HTTP origin was blocked before application loading by
`ERR_BLOCKED_BY_ADMINISTRATOR`. Real-origin localStorage, reload/restart
persistence and physical iPhone/Safari acceptance remain unverified. No security
policy was weakened. No deployment, GitHub write or production overwrite occurred.

## Run the source

Keep the entire extracted `HEWRS_CONNECTED_APP_V1_16_1/` folder. `index.html` alone
is not self-contained. For a local desktop test, run from that folder:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/` on that same computer. Local serving is not a public
deployment. Use a separate candidate folder; do not overwrite the legacy site.

The existing optional offline builder remains available:

```sh
python3 tools/build.py --standalone ../HEWRS_V1_16_1_OFFLINE.html
```

The output is large. Generating an offline file does not establish that iOS Files,
Safari file previews or browser persistence will behave like a hosted origin.

## Verify and repeat tests

Read-only delivered-package verification:

```sh
python3 -B tools/verify_v1161.py
python3 -B tools/rollback_v1161.py --check
```

Fresh tests should be run in a separate working copy. Some tests write receipts
inside that copy; do not confuse those newly generated receipts with the hash-verified delivery inventory. Rendering tests require the installed Python packages
Pillow and Playwright and a Chromium executable. Source registration checks also
require NumPy and SciPy; they compare reconstructed pixels without replacing the
installed assets.

```sh
HEWRS_BASELINE_V116=/path/to/extracted/V1.16 node tests/release-v1161.cjs
HEWRS_BASELINE_V115=/path/to/HEWRS_CONNECTED_APP_V1_15 python3 -B tests/release-v1161-browser.py
python3 -B tests/release-v1161-edge-browser.py
python3 -B tests/release-v1161-real-origin.py
python3 -B tools/build_batch16.py --check
```

## Rollback and owner data

`tools/rollback_v1161.py --destination /path/to/new/V1_16` reconstructs the exact
1,218-file delivered V1.16 tree in a **new, nonexistent directory**. It never opens,
migrates, clears or rewrites browser storage. V1.16's historical stale metadata
is restored as part of byte-exact rollback; use the independent baseline file
ledger to verify it rather than that stale manifest.

The candidate source lock and storage key remain unchanged. Isolated storage-
interface tests verify that all 18 supported IDs can be read by both versions.
Real browser history is origin-specific: moving the files to another origin does
not automatically move stored history. No such transfer is claimed here. Backup
export remains the app's explicit operation; no owner data is bundled with this
source package.
