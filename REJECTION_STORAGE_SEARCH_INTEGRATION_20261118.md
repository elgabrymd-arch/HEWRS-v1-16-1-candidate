# Rejection storage and search integration

Date: November 18, 2026.
Branch: `integration/rejection-storage-search-20261118`.
Baseline: `b9e33124d15c0f7127f2b2eb61dd710ec9edd05f`.
First implementation commit: `92f2eb5f02bc4f00b8395260a4a3983882eb667f`.

## Status

The storage, search, main application and reviewed-outfit integrations are
implemented and verified in the development candidate. **Full CI passed** in
[run 44439244877](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44439244877)
at commit `0b3a2eb092c689b086d1e5e9913c6cff4ac50046`. The application code remains
identical to the first implementation commit. Subsequent changes address runner
configuration and test readiness without changing application code.

The candidate has not been deployed. It does not inspect, copy or migrate the
owner's actual browser data during development.

## Persistent rejection storage

`src/rejection-database.js` replaces repeated full-history localStorage scans
with an IndexedDB database and a validated memory cache. The database has
`events`, `active` and `meta` stores. A mutation commits immutable events, active
exclusion indexes and its revision in one transaction. Success is reported only
when the transaction completes; an abort retains the preceding committed state.

The initial migration reads both legacy outfit and tie namespaces, validates
them together, commits their records atomically and verifies the source again
before enabling recommendations. A legacy write during migration is reconciled.
Old localStorage bytes remain available and are neither rewritten nor deleted.
Original event IDs, notes, scope, occasion, preference votes and Undo targets keep
their meaning. Duplicate imported hides remain independently undoable.

There is no application rejection-count ceiling or automatic eviction of old
bans. Undo appends history instead of deleting the original rejection. Match
checks use indexed scope/occasion keys in memory; they do not read storage or
serialize the full history. Revision tokens remain compact.

Startup exposes a blocked facade until hydration succeeds. Invalid records,
missing metadata alongside existing events, inconsistent active indexes and
storage read failures block unchecked results. Explicit Retry validates again;
it does not erase or automatically repair corrupt records.

Same-tab legacy writes, storage events and BroadcastChannel updates invalidate
the cache. Asynchronous boundaries also inspect the committed database revision.
Older, unmodified HEWRS tabs must be reopened before relying on database-only
rejections; the candidate displays that instruction after migration.

## Search and retained options

`src/outfit-refill-engine.js` now applies broad clothing, whole-tie and exact
shirt–tie exclusions before choosing sampling and coverage representatives.
Shoe-specific bans retain their narrower scope, so an alternative shoe can still
make the same clothing valid.

When the initial scored sample cannot fill the list, the engine examines
previously unreviewed eligible source rows in small, cancellable batches. It
stops when the requested list is filled, a physical-item upper bound is reached,
the remaining appendable source is exhausted, or the caller cancels.

Accepted options remain byte-for-byte stable and in their existing order. Search
adds verified replacements without reconstructing or reranking those records.
Diagnostics distinguish a filled list, a capacity bound and completed source
review. An exhaustion claim applies to adding another option under the current
locks, retained selections and item limits. It does not claim that rearranging
accepted rows was searched or that the result is globally optimal.

The local regression reproduces the old S10 failure with 167 sampled clothing
rows and 1,801 additional source rows. Rejecting the original sample now returns
20 valid replacements. Separate cases exercise exact-shoe expansion, scope
preservation, retained records, cancellation and genuinely exhausted source.

## Application integration

The main rejection controls and candidate reviewed-outfit panel await permanent
writes, Undo, import and export. Generation waits for validated feedback. Native
avatar publication, reviewed rendering and exports recheck the durable revision
at completion. `withCurrent` publishes through a synchronous callback inside a
readonly revision transaction. Changed or unreadable feedback cancels or blocks
pending work rather than treating the history as empty.

The manager renders **50 records per page**. Complete combined backups include
outfit and tie histories, while original outfit-only and tie-only backups remain
accepted. The file-import allowance is **64 MiB**, replacing the former 5 MiB
ceiling. The database API has no 20,000-event import limit. Exports larger than
64 MiB remain outside the current manager's file-import allowance.

## Verified results

The CI log summary and downloaded browser/search artifact record these passing
results. Every fixture uses synthetic data; no actual owner usage or phone
history was accessed.

| Verification | Observed result |
| --- | --- |
| Node unit tests and standalone regression fixtures | 49 unit tests and 2 fixtures passed; includes 15 database tests using fake-indexeddb 6.2.8 |
| Actual-engine search expansion | 12 assertions passed; 10 completed generations plus cancellation |
| Chromium failure and recovery integration | 32/32 checks passed |
| Chromium healthy application integration | 40/40 checks passed |
| Native Chromium 141.0.7390.37 storage and refill integration | 44/44 checks passed |
| Native WebKit 26.0 storage and refill integration | 44/44 checks passed |

Native browser evidence is in
`evidence/rejection_storage/{chromium,webkit}/RESULT.json`; failure, healthy and
search results are adjacent. Both native engines produced the same substantive
storage outcomes:

| Observation | Chromium | WebKit |
| --- | --- | --- |
| Active exclusions surviving actual reload | 30,000 | 30,000 |
| Complete UI backup, verified against all imported events | 13,260,382 bytes | 13,260,382 bytes |
| Actual permanent rejection/refill cycles | 20; each returned 20 valid options | 20; each returned 20 valid options |
| Final active exclusions / total history events | 30,023 / 30,025 | 30,023 / 30,025 |
| Cached matches rejecting oldest, middle and newest bans | 20,000 / 20,000 | 20,000 / 20,000 |
| Additional database or legacy-storage reads during those matches | 0 | 0 |
| Revision token length | 107 characters | 107 characters |

Both engines also passed exact legacy migration, independent duplicate Undo,
idempotent reimport, a deliberately aborted native transaction, recovery without
data replacement, concurrent-tab writes and rejection of stale publication.
Each refill preserved accepted rows and excluded all previous rejections. Wear
and Favorites remained unchanged. All four browser suites recorded zero external
requests and zero uncaught page errors.

The separate fake-indexeddb test retained 30,000 active exclusions with further
writes and Undo, and round-tripped 30,002 events in a 9,030,795-byte backup.
That Node fixture is separate from the full UI export fixture. Native browser
evidence establishes the tested desktop capacity; neither it nor the Node
fixture establishes actual iPhone latency.

### Verified CI commands

| Command | Verification purpose |
| --- | --- |
| `python tools/build_tie_candidate.py --verify-base --check` | Candidate delivery, frozen base reproduction and SRI |
| `node tests/rejection-database.cjs` | Migration, 30,000-active storage, Undo, conflicts, rollback and concurrency |
| `node tests/rejection-search-expansion.cjs` | Actual source expansion, retained records, scope and cancellation |
| `node tests/rejection-scale-audit.cjs --fixture-only` | Canonically validated 30,002-record browser fixture |
| `python tests/rejection-database-read-failure-browser.py` | Integrated failure, recovery, render and export protections |
| `python tests/rejection-database-healthy-browser.py` | Existing generation, tie rejection, refill, Undo and backups |
| `python tests/rejection-storage-browser.py --browser chromium` | Native storage, migration, complete backups, two tabs and 20 UI refills |
| `python tests/rejection-storage-browser.py --browser webkit` | The same integration through WebKit |

The workflow also checks existing rejection semantics and protected sources.
Run `44435188662` began with slow Ubuntu package downloads, then reached tests
and failed the newly added reviewed-preview cancellation fixture. That fixture
queried a card before the bundled image-assessment list update completed. The
frozen image-panel open wrapper calls `installImageAssessments()`, which starts
an asynchronous update without awaiting completion. Test-only commit
`0b3a2eb092c689b086d1e5e9913c6cff4ac50046` waits for the actual ready, idle,
error-free `all_reviews` card before exercising cancellation. The production
runtime hash remains unchanged.

The completed passing run uses the official
`mcr.microsoft.com/playwright/python:v1.56.0-noble` container and matching driver;
Git's safe-directory setting handles checkout ownership. Final run
`44439244877` completed successfully after the readiness correction. The result
files and artifact identified here come from that final passing run.

### Evidence identity

| Item | Verified identifier |
| --- | --- |
| CI artifact | `14491171483` — `HEWRS_REJECTION_STORAGE_INTEGRATION_EVIDENCE` |
| Downloaded artifact SHA-256 | `0640642c622e762243496d1d868f7745d6bf9061e1e07a42c4a533577146cc58` |
| `runtime/outfit-refill-preview.js` SHA-256 | `bc29e962604013f47c130135b6094c8eb0907b0b5d2edc9fa5b666e67bca4a25` |

The artifact digest was checked before extraction. The full provenance record,
individual evidence-file digests and selected screenshot review are saved in
`evidence/rejection_storage/CI_VALIDATION.json`. Browser backup hashes differ
across independently timestamped exports; both event-content equality checks
passed. No inconsistency was found in the recorded result counts or outcomes.

## Preservation and limits

Wardrobe IDs and records, garment images, the approved avatar, original numerical
scoring and the frozen Standard application are preserved. Occasion rules,
explicit owner restrictions and physical-item limits remain enforced. The saved
API recovery references remain separate; this integration does not activate or
merge the independent AI Five feature.

WebKit ran on Linux at a 390-by-844 viewport; it was not an actual iPhone test.
Browser storage capacity and persistence still depend on the browser and
available device storage. Deleting site data or losing all browser storage
cannot preserve exclusions without an independent backup. No permanent rejection
is recycled merely to fill a list. No deployment was performed.
