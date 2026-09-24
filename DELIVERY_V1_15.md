# HEWRS V1.15 — ten-shirt integration delivery

## Result

The existing application now connects **DS004, DS005, DS007, DS015, DS018,
DS019, DS023, DS024, DS025 and DS047** in blazer and shirt-only modes, each
with all 47 ties plus No Tie. There are **12 connected non-suit shirts total**,
including unchanged DS001/DS014, with **38 still gated**. All 50 existing suit
routes remain available. No new shirt-only numerical scores were introduced.

The complete source includes the existing facelift, all 18 suits, all 14
blazers, 24 physical trousers, 35 footwear pairs, independent IDs/history,
watch ID/name support and the preserved accepted palette. This is an actual
clothing implementation increment, not another picker-only release.

## How the ten were connected

The supplied 600px WEBP donors remain unmodified. Separate deterministic layers
fit their visible torso/sleeve panels into the existing full-shirt exterior.
Current Active50 front collars and tie knots are retained. DS004/DS005/DS015
have empty native cuff parts: six explicitly identified cuff derivatives sample
their uploaded lower sleeves inside existing cuff masks. Other native cuffs
are retained. No whole garment was generated; no original image was overwritten.

The recovered V11 package contains a different 32-ID cohort and does not contain
these ten protected-original IDs. Their current V1.14 Active50 definitions,
not that older replacement manifest, therefore control ID/component mapping.
This corrects the earlier proposed blanket use of V11 as their placement authority.

The new layers are **source-derived registrations**, not recovered high-resolution
original garments. Their low-resolution source limits and inherited straight
waist/sleeve transitions remain. No new owner/device acceptance is asserted.

## Fresh verification

| Check | Result |
| --- | --- |
| New functional checks | 24 passed, 0 failed |
| Inherited functional checks | 21 passed, 0 failed |
| Main and edge Chromium checks | 16 + 4 passed, 0 failed |
| Original frames versus exact V1.14 | 87 pixel-identical |
| New actual render exercises | 807: 760 batch exercises plus 47 extra blazer-tie exercises |
| New valid shirt/state/mode combinations | 7,200 routing checks, not 7,200 rendered images |
| Existing suit/state selections | 39,817 routing checks |
| Protected current components | 576 hash-matching references |
| Original runtime images | All 611 preserved byte-for-byte |
| Uploaded body donors | All 10 preserved byte-for-byte |
| New PNG files | 72: 18 body bases, 6 cuffs, 47 full ties, 1 source mask |

The 87 regressions include all 18 suits, all 14 blazers, both pre-existing
shirt-only IDs and a default control. The 807 new exercises include all ten
shirts across every blazer with open/T017 choices, all 480 shirt-only states,
and all 47 tie choices under DS023/B06. Some exercises repeat selections;
807 is not a distinct-outfit count.

Browser tests use actual source scripts/images with an in-memory loader and
synthetic test storage. They exercise the real pickers, Apply/Cancel, exact-ID
wear events, error-frame retention, cancellation/races, watch text and the
390×844 Home screen. No owner records are used as test data.

## Remaining boundaries

The other 38 non-suit shirt routes remain visibly gated. Shirt-only numerical
ranking is absent; existing score holds and unavailable functions remain explicit.
Watch images remain deferred. The real-origin test was blocked before loading
by `ERR_BLOCKED_BY_ADMINISTRATOR`; actual-origin reload/restart persistence,
hosted delivery and physical iPhone/Safari acceptance remain unverified.
No GitHub write, public deployment or production overwrite occurred.

## Reproducible source, evidence and rollback

`README.md` gives the private local-server run and test commands.
`CHANGED_FILES.json` contains the precise file-level changes and hashes.
`evidence/batch10_v1_15/` holds fresh test receipts, actual runtime screenshots,
source-registration checks and the exact baseline rollback check.
`provenance/batch10_v1_15/` holds unchanged donors and source identities.
`tools/verify_v115.py` checks package payloads, preservation and release boundaries.

`tools/rollback_v115.py` reconstructs the exact 1,053-file V1.14 source in a
new directory. It never changes browser storage. **V1.14 cannot interpret new
non-suit wear events**: it retains/export-enables their raw ledger but blocks
writes rather than deleting/remapping records. Reopening V1.15 reads them again.
This data-compatibility behavior was tested with synthetic records; do not clear
storage or replace the ledger with an old export during source rollback.
