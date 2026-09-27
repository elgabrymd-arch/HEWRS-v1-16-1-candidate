# HEWRS connected candidate — V1.16.7 (18 non-suit shirts)

Continues the verified **18-shirt V1.16.6 Favorites build**. The conflicting
19-shirt/DS041 V1.16.5 package is not an input. Keep the existing candidate
repository and website origin. No new repository or browser-data reset.

## Rotation Insights

Open **Rotation → Insights**. The view reads the existing confirmed-wear ledger
without writing to storage or changing the displayed outfit. Select the last
30 days, last 90 days, or all recorded dates through an explicit inclusive
cutoff. The initial cutoff is the existing Work & date selection; changing the
Insights cutoff does not change Work & date or current-outfit preferences.

The summary shows log-entry counts, distinct recorded days, distinct exact
physical outfits, mode/origin/tie breakdowns, and explicitly saved repeat flags.
Multiple records on the same day remain separate records. Future-dated entries
and older entries outside the range are disclosed as excluded, not removed.

Search by current item name or physical ID. Catalogue order is the default;
other orders sort by actual record count or last recorded date. Per-item counts
use the chosen date range; last-recorded dates use all confirmed dates through
the cutoff. Unrecorded items are labeled **No wear recorded**, not never worn.
Matching suit trousers are counted with their suit, not invented as separate
physical pants. Null tie/watch choices remain null. Shared images never merge IDs.

All 50 suit-shirt identities remain in these historical statistics. This does
not activate the 32 deferred shirts in non-suit modes. Existing 18-shirt pickers,
all garment renderers, DS023 corrections, mobile layout and scoring are intact.
Insights does not invent rankings, cooldown rules or weather/season readings.
The existing Engine rotation report remains available in a separate disclosure.
Statistics are a snapshot from this browser's loaded ledger, not automatic
cross-device synchronization. Favorites and outfit views never count as wear.

## Favorites, wear and backups

Favorites retain V1.16.6 behavior: **Rotation → Favorites → Save current outfit**.
Recalling a Favorite is manual; it does not add confirmed wear. Favorite export/
import stays separate from the current outfit/wear-history backup. No storage
key, validation schema, source lock or history ID changes in V1.16.7.
Log only actual wear. No synthetic demo history is loaded by this release.

## Run, update and rollback

Serve this entire folder with `index.html` at the root. Its data/assets/src/
vendor/assemblies folders are required. `index.html` alone is not self-contained.
The updated application and new Insights script use `?v=1167`; unchanged script
and stylesheet version markers are retained.

The cumulative **18-only** update supports exact 18-shirt V1.16.5 or V1.16.6.
Copy the **contents** of `FILES_TO_COPY` into the existing candidate folder.
Keep all other folders, `.git`, Favorites, wear data and the same website origin.
Do not use the conflicting DS041 V1.16.5 branch. Commit and push explicitly;
this build does not upload or deploy anything automatically.

Verify: `python -B tools/verify_v1167.py`.
Rollback check: `python -B tools/rollback_v1167.py --check`.
Restore V1.16.6 to a new folder:
`python -B tools/rollback_v1167.py --output NEW_FOLDER`.
These operations never access browser data. V1.16.6 retains Favorites, and
Insights has no separate namespace to migrate or remove.

Read `DELIVERY_V1_16_7.md` for test evidence and boundaries. New Insights UI
acceptance on the hosted site/iPhone remains unverified. Prior owner-reported
DS023, mobile-picker and persistence passes remain separately recorded.
