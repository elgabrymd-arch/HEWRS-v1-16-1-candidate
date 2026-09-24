# HEWRS connected application V1.14

## Release boundary

This is a **source-routing and picker-guard implementation increment**, not a
completed clothing build. It continues the supplied V1.13 application. It does
not replace the controller, facelift, wardrobe, renderer, scoring or storage.

**Zero additional non-suit shirt identities are visually connected in V1.14.**
DS001/DS014 retain the existing blazer and shirt-only routes; the remaining 48
are represented by exact current source contracts, but stay unavailable in
those modes. Their existing suit routes and garment approvals are unaffected.
All 18 suits, 14 blazers, 24 physical trouser IDs and 35 registered shoe pairs
are retained. Watch ID/name remains sufficient; images remain deferred.

## Implemented changes

`data/non-suit-sources.json` and its browser wrapper bind all 50 shirt IDs to
576 actual component references in 44 exact hash-defined assembly groups.
Grouping does not merge physical IDs or history. The registry retains current
body/collar/cuff components, NO_TIE restrictions, the DS035 visibility mask and
DS051 stored-RGB profile. Component plans are explicitly not full garments.

The new connection wrapper rejects mismatched source bindings and prevents a
metadata flag from activating an unimplemented renderer. Existing DS001/DS014
full-shirt layer hashes are pinned to both working non-suit renderers.

The existing shirt picker now displays all 50 identities but disables the 48
unbound choices when blazer or shirt-only topwear is selected. Suit mode still
enables all 50. Exact tie choices are disabled for DS040–DS043, while No Tie
remains selectable. Apply/Cancel semantics and independent preferences are
preserved. A topwear change does not silently replace a previously chosen
shirt or tie; an unsupported attempted render explains the missing source and
retains the previous complete frame. Score holds do not disable suit visuals.

No original image, garment geometry, avatar, suit mask, score table, physical
ID, wear record, original application controller, stylesheet, or storage schema
was changed. No new image was generated. The original UI version string inside
`HEWRSApp.version` is preserved; use
`HEWRSApp.connection.implementationVersion` or `RELEASE_STATUS.json` for this
increment's version.

## Exact dependency limit

The supplied current bodies are upper suit-opening inserts, not complete
non-suit torsos/sleeves. For example, DS036 body alpha occupies
`[350,416,650,837]` on the 996×2748 canvas. Using these alone under a blazer
leaves a visible lower-torso gap. Canvas dimensions do not prove coverage.

`evidence/source_routes_v1_14/SOURCE_DEPENDENCIES.json` records the component
needed for each affected mode/ID, current source bounds and actual historical
full-shirt path/hash references found in V1.13. Those historical references are
not materialized runtime images and are not automatically current appearance
authority. Two existing Library source packages were located but raw-byte
retrieval was unavailable; their contents were not examined. No owner reupload
or new garment approval is requested by this build.

Shirt-only numerical ranking is still absent. Existing manual functionality,
source-score holds and intentionally unavailable UI features retain their
existing limits. Actual hosted loading, browser-restart persistence and
physical iPhone/Safari acceptance remain unverified.

## Run the complete application

Keep the entire extracted folder. `index.html` alone is not self-contained.
This source package includes the prebuilt entry files and all runtime assets;
Node, Pillow and Playwright are not runtime browser dependencies.

For a private local run from the extracted directory:

```
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/index.html` in a browser on that computer. This command
does not deploy the application publicly. Persistent browser data is scoped to
the browser profile and origin. Keep the same origin to use an existing ledger;
changing host/port or browser profile does not migrate records.

## Verify and rebuild

```
python3 tools/verify_v114.py
python3 tools/build_non_suit_sources.py --check
node tests/non-suit-sources.cjs
HEWRS_V113_FUNCTIONAL=/tmp/hewrs-v113-regression.json node tests/open-collar.cjs
python3 tools/build.py
```

The package verifier uses only the Python standard library. Source-registry
reconstruction additionally requires Pillow. Functional tests use Node. The
browser tests require Playwright, Pillow and a compatible installed Chromium.
Fresh browser comparisons require a separate unmodified V1.13 source tree:

```
HEWRS_BASELINE_V113=/path/to/HEWRS_CONNECTED_APP_V1_13 \
HEWRS_V114_BROWSER=/tmp/hewrs-v114-browser \
python3 tests/non-suit-sources-browser.py
HEWRS_V114_ORIGIN=/tmp/hewrs-v114-real-origin.json \
python3 tests/non-suit-real-origin.py
```

Set `HEWRS_V114_FUNCTIONAL` to an outside JSON path when rerunning functional
tests without modifying packaged evidence. The verifier pins all packaged
files; intentionally replacing evidence requires regenerating the manifest.
Do not run older version-specific package verifiers as V1.14 acceptance tests.
Their source assumptions and evidence remain historical.

## Fresh evidence

`evidence/source_routes_v1_14/RESULT.json` summarizes this increment. Its
functional, browser and source dependency files contain individual results.
The fresh in-memory Chromium run verifies actual code/images, not a real
origin or a physical device. Its isolated test storage does not access any
owner data. The separate actual-origin attempt was blocked by administrator
policy before the application loaded; it is recorded as blocked, not passed.

## Rollback without deleting history

```
python3 tools/rollback_v114.py --check
python3 tools/rollback_v114.py --destination ../HEWRS_V113_ROLLBACK
```

The rollback tool builds a **separate exact V1.13 source tree**, verifies every
original payload hash, and refuses an existing destination. It does not modify
this V1.14 folder or any browser storage. To serve the rollback, stop the local
server and serve that verified tree at the same browser origin. Do not clear
localStorage, change the namespace, or import an older ledger over newer wear
records. The source lock, schema and valid saved selection universe did not
change in V1.14; no data migration is needed for this rollback.

No GitHub write, legacy production overwrite or public deployment is included.
