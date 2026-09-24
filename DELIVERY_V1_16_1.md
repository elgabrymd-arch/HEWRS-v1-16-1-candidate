# HEWRS V1.16.1 — release correction and six-shirt validation

## Delivered result

This is a correction of the existing V1.16 implementation, not a new garment
batch. **18 non-suit shirts are connected; 32 remain gated. No additional IDs
were activated in V1.16.1.** All 50 existing shirt routes under the 18 suits and
all 14 connected blazers remain in place. Watch ID/name display remains sufficient.

The six recovered V1.16 additions are DS002, DS006, DS008, DS021, DS022 and
DS027. DS001/DS014 remain separate physical identities, as do all IDs with
shared image bytes. The prior ten non-suit registrations remain exact.

## Actual fixes

V1.16 shipped with its inherited V1.15 README, release status, changed-file list
and package manifest. Five listed payload hashes had changed, and 44 files were
not listed. The HTML title and exposed application version were also stale.
This correction supplies consistent V1.16.1 release identity, complete current
file hashes, exact changed-file inventory and a current read-only verifier.

The source registration list now preserves the V1.15 ten-ID order and appends
the six recovered IDs. No physical ID, current catalogue order or wear event
is renumbered. Count reporting is derived from the registered source cohort.
The reproducibility checker now ignores JSON object-key ordering while still
checking every value and ordered ID array; no pixel algorithm was changed.

All **699 runtime images from V1.16 remain byte-identical**. No garment, avatar,
face, hand, trouser geometry, suit mask, collar, tie, cuff, stylesheet, scoring
input or storage schema is replaced. In `src/application.js`, only the release
version property changes; the existing controller behavior remains intact.

## Newly executed validation

**27 functional checks and 20 Chromium checks passed, with no failed checks.**
The browser total is 16 integrated checks plus four failure/cancellation/watch
checks. V1.16's earlier five-check smoke test is historical and is not used as
this release's full runtime evidence.

There were **732 distinct six-shirt render exercises**: 288 shirt-only states
(six IDs × 48 states), 168 blazer controls (six IDs × 14 blazers × NO_TIE/T017),
and 276 further B03 tie states (six IDs × the other 46 ties). Thus every new ID
was exercised with all ties and NO_TIE in shirt-only mode and under B03; all
14 blazers were exercised with NO_TIE and T017. This is not every tie under
every blazer, nor every trouser/shoe permutation rendered.

**127 existing outfit frames matched V1.15 pixel-for-pixel.** These comprise 54
suit controls across all 18 suits, 28 original blazer controls, four original
shirt-only controls, one default control, and 40 controls covering the previous
ten recovered shirts in blazer/shirt-only modes, tied and open.

Functional checks validated 11,520 registered-cohort shirt/state/mode selections,
26,880 exact shirt/trouser/footwear selections, 39,817 suit/state selections and
all 576 existing component references. These are routing/hash checks, not
additional rendered frames. All 47 current tie derivatives and all 32 registered
body-state reconstructions matched their installed data in read-only checks.

Actual browser interaction covered picker enablement (18 of 50), Apply/Cancel,
independent ties, NO_TIE restrictions, exact DS022 wear recording, unsupported-
route frame retention, failed image decoding, latest-request cancellation,
watch ID/name text, a one-screen 390 × 844 Home and unchanged synthetic storage.
The test records are not owner wear history.

A separate Python HTTP test verified exact delivery of **742 files** from a
local server. That is a byte-delivery test, not browser-origin acceptance.

## Material limits retained

The real-origin Chromium attempt was blocked **before application loading** by
`ERR_BLOCKED_BY_ADMINISTRATOR`. No browser policy was bypassed. Real localStorage,
page-reload/process-restart persistence and actual iPhone/Safari acceptance
remain unverified; in-memory Chromium results do not certify those operations.

Shirt-only numerical ranking remains absent. Existing scoring holds and the
32 unconnected non-suit shirts remain explicit. No new source recovery or
arbitrary cloth generation was undertaken for those IDs. The supplied source
images remain low-resolution; inherited squared waist and sleeve transitions
are still visible and unretouched in shirt-only controls. The 24-frame phone
board was visually inspected, not every one of the 732 exercise frames.

No GitHub write, public deployment, live-site overwrite or owner-data migration
was performed. No garment approval was reopened.

## Files, verification and rollback

`index.html` needs the complete application folder. `RELEASE_STATUS.json` is the
current release summary. `CHANGED_FILES.json` lists every changed, added and
removed payload with before/after hashes; `PACKAGE_SHA256.json` binds the entire
current delivery. Use `python3 -B tools/verify_v1161.py` for read-only verification.
Older version-specific verifiers are retained as historical tools, not the
current command.

`tools/rollback_v1161.py` was tested by reconstructing the exact delivered
**1,218-file V1.16 source tree in a separate directory**. Every restored file was
checked against independently measured baseline hashes, because V1.16's own
manifest was stale. The current tree and browser data are not modified by this
tool. Its `--check` operation is read-only; its write mode refuses an existing
destination or a destination inside the current tree.

The storage key and source lock are unchanged. Isolated storage-interface tests
confirmed all 18 IDs round-trip and remain readable by V1.16 without rewriting
the raw ledger. This is not actual-origin browser persistence certification.

Current executable tests, raw results, runtime hashes, preservation records and
phone screenshots are under `tests/release-v1161*` and
`evidence/release_v1_16_1/`. Earlier evidence remains historical.
