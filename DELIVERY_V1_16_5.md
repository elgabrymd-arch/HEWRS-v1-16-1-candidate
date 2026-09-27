# HEWRS V1.16.5 — continue with the 18 connected non-suit shirts

## Implemented scope

The owner's instruction was “Continue with 18 only for now” (message timestamp
2026-09-25T02:44:23Z). This increment changes the non-suit picker, not garment
artwork or the wardrobe's membership. In blazer and shirt-only mode, the Shirt
picker shows only the **18 existing connected IDs**, in their inherited relative
order, instead of 18 usable choices mixed with 32 disabled entries. Search and
brand filters work within that usable set. A count explains that the other 32
remain in Wardrobe and suit mode. No extra category or replacement UI is added.

Enabled IDs: DS001, DS002, DS004, DS005, DS006, DS007, DS008, DS014, DS015, DS018, DS019, DS021, DS022, DS023, DS024, DS025, DS027, DS047.

All 50 shirt records, all suit routes, all physical trouser/shoe/watch identities,
No Tie rules and source-score holds remain intact. The 32 other non-suit shirts
are **deferred, not blockers to this scope**. The source search is paused; no
additional uploads or approvals are required to use the current 18.

Switching from a suit does not replace its selected shirt. When that shirt is
outside the non-suit scope, the picker explains the retained preference and
keeps Apply disabled until an eligible choice is made. Cancel leaves the
original preference unchanged. Programmatic unsupported routes remain guarded.
No wear history or saved outfit is filtered, deleted, migrated or renumbered.

## Preserved accepted work

All 705 original runtime image files are unchanged. There are no new garment
images. The avatar, geometry, all rendering modules, DS023 cleanup/edge layers,
DS035 mask, DS051 compositor, source-score tables, storage module, accepted
stylesheet and V1.16.4 sheet-layout implementation remain byte-identical.
The default and saved suit selections still support all 50 shirts.

The owner's reported V1.16.4 picker pass (2026-09-25T02:16:11Z) and iPhone Safari
visual/reload/reopen/unchanged-wear-count pass (2026-09-25T02:20:59Z) are recorded
in RELEASE_SCOPE.json. The latter was for Shirt-only + DS023 + T017 + PG002 +
shoe-8. Those are **owner-reported baseline acceptances**, not new physical-device
tests performed by this increment and not certification of every combination.

## Fresh validation

**24 functional checks passed, zero failed.** These include 39,817 unchanged
suit/shirt/state routing selections; 12,960 unchanged non-suit routing selections
covering 18 IDs, 48 states and the 14 blazers plus shirt-only; exact inventory and
relative-order preservation; source hashes; same-ID guards; Apply/Cancel;
manual shirt-only independence from ranking; source-score equivalence and
synthetic-ledger backup/restore/old-version reads. Routing enumeration is not a
render count. All synthetic records remain in isolated test storage.

**20 in-memory Chromium checks passed, zero failed.** These used the actual
current scripts, current images, existing controller and picker UI. There are
**90 exactly pixel-equal baseline comparisons**: 72 for all 18 non-suit shirts
in No Tie/T017 under B03 and shirt-only, and 18 DS023/T017 suit comparisons.
The actual DS023 Collar Detail view and Home screenshot also match V1.16.4.
The suite exercises visible 18-only choices, 50 suit choices, all 50 Wardrobe
records, search, deferred-draft messaging, real Apply/Cancel buttons, backup
controls, and unchanged synthetic ledger bytes. All six pickers passed **30
layout cases** across phone, landscape and keyboard-sized viewports. These
geometries are not an actual software-keyboard or physical Safari test.

The first harness invocation was interrupted by an execution timeout. A later
initial attempt was restarted to avoid serializing the growing embedded-image
store on every injection. Neither incomplete attempt is counted as a passing
suite. The counts above are from the final complete run, with zero app errors.

## Scope boundaries

This is an 18-shirt-scoped clothing interface, not a claim that every feature
of the wider project is implemented. Shirt-only numerical ranking remains
uninstalled; exact manual selection works independently. Existing unavailable
weather, season, Favorites and other handlers remain explicit. No invented
scores, watch images, new fabric or new garment pixels were added.
Inherited source-resolution/shoulder/waist limitations remain unretouched.
No deployment, public repository write, browser-data reset, or newly observed
physical-device/restart test occurred in this session. The accepted V1.16.4
user-reported checks are retained rather than reopened as missing evidence.

## Installation and rollback

The small update is only for an existing complete V1.16.4 candidate. Copy the
CONTENTS of FILES_TO_COPY into that candidate root, merging subfolders and
replacing matching files. Keep .git and all browser storage. Do not copy the
enclosing FILES_TO_COPY directory, delete original assets, or create a new repo.
Suggested commit summary: `V1.16.5 — use 18 connected non-suit shirts; defer 32`.
The package does not upload or deploy itself.

`python -B tools/verify_v1165.py` checks the complete resulting source.
`python -B tools/rollback_v1165.py --check` verifies all restoration bytes.
`python -B tools/rollback_v1165.py --output NEW_FOLDER` restores exact V1.16.4
into a new destination without opening browser storage. Restoration is tested
against all 1,369 baseline files. The optional update installer also creates a
separate new folder and refuses a nonmatching baseline or existing output.

CHANGED_FILES.json lists every added or modified path with before/after hashes;
PACKAGE_SHA256.json covers all payload files. Their own self-hashes are excluded
from their respective lists. Prior evidence and rollback chains are preserved
as historical records, not counted as new tests.
