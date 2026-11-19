# Tie coverage and permanent rejection diagnosis

Date: 18 November 2026. Development branch: `audit/tie-coverage-rejection-scale-20261118`.

## Outcome and scope

The unchanged candidate at `69545e85bf4ee0719d29dc81bade011332c4caf8`
exposed all 47 ties in each tested occasion. Forty cumulative permanent clothing
rejections did not reset or recycle: every real refill returned 20 eligible
options and preserved the accepted records. Separate tests established defects
in storage scalability, backup restoration, corrupt-record startup handling and
bounded candidate search.

This is the completed diagnostic phase. It adds tests, observations and an
implementation specification. It does not implement the storage migration or
search repair, deploy the candidate, merge PR #9, or inspect the owner's phone.

All usage in these tests is synthetic. The engine and selection validators are
actual candidate code. Tests retain existing static owner policies and exact
approvals. The API feature branches, wardrobe IDs, garment images, avatar,
original numerical scores and Standard application remain unchanged.

## API work preserved

The four existing backup refs were read and matched to their expected commits.
No backup ref was rewritten. Full verification is in
[api-backup-refs.json](evidence/tie_coverage_rejection_scale/api-backup-refs.json).

| Repository | Backup branch | Commit |
| --- | --- | --- |
| Frontend candidate | `backup/ai-five-distinct-20261118` | `38d4b5574b99e811b0846c6b0fdf26c9a5a6dc82` |
| Frontend candidate | `backup/visual-stylist-api-20261118` | `87c1170eb674e5ed72bc8771b06abe78fe9eb447` |
| AI service | `backup/ai-five-generation-20261118` | `ed9386fcd468db6217f6815be940121ee03a17a8` |
| AI service | `backup/creative-outfit-api-20261118` | `7cc48d8bae62a2ffb34eae3886bdbaab881b5db4` |

## 1. All 47 ties: inventory, eligibility and repeated generation

All T001–T047 are active catalogue entries with feature records. All 142
registered tie fidelity layer bindings have existing files whose SHA256 hashes
match their registrations. All 47 had eligible complete outfits on the first
request for each occasion.

The following cumulative counts came from 13 actual native engine generations.
Each verified list contained 18 distinct ties and two No Tie options. The
harness committed suggestion exposure after accepting each list; it did not
write wear history or rejections.

| Occasion | Cumulative distinct ties after each list | Lists to observe all 47 |
| --- | --- | ---: |
| Work | 18 → 34 → 44 → 45 → 46 → 47 | 6 |
| Dinner | 18 → 35 → 45 → 47 | 4 |
| Weekend | 18 → 36 → 47 | 3 |

Configuration: Research mode, AUTO style, any formality, all garment preferences
set to any, no assessed weather, no dynamic rejections, no confirmed wear and no
learned preference history. Occasion-specific policies and static owner rules
remained active. These findings do not establish coverage under every lock,
weather setting or saved feedback history. The live build and owner-device
settings were not inspected.

The original observation of a small recurring subset is therefore not reproduced
in this candidate fixture. Initial omission is a ranking/list-selection result,
not missing assets or blanket tie ineligibility. The suggestion-exposure change
only chooses among candidates within 0.05 points in both preference score and
adjusted utility. It does not guarantee a fixed number of generations for every
configuration. T019 repeats in Work because exact outfit O18 is an owner-approved
priority seed. T024 is not such a seed in this fixture.

The diagnostic `best_candidate_final_constraint` is sampled after the list fills
and reports `OPTION_LIST_LIMIT` broadly. It cannot identify the particular earlier
constraint that kept an individual tie out of a list.

### First list in which each tie appeared

A number is the generated-list index within that occasion's isolated run. Every
row has verified assets and at least one eligible complete candidate in all three
first requests. Names below are copied from the catalogue, not new visual labels.

| Tie | Catalogue description | Work | Dinner | Weekend |
| --- | --- | ---: | ---: | ---: |
| T001 | Mushroom Taupe Horsebit | 3 | 1 | 1 |
| T002 | Tobacco Grid Medallion | 1 | 2 | 1 |
| T003 | Rust-Orange Striped Scroll | 2 | 2 | 2 |
| T004 | Burnt orange Geometric | 1 | 1 | 1 |
| T005 | Deep chocolate Medallion | 2 | 1 | 3 |
| T006 | Very dark chocolate brown Floral | 1 | 2 | 1 |
| T007 | Charcoal Check/Lattice | 2 | 1 | 2 |
| T008 | Golden yellow Geometric | 3 | 3 | 2 |
| T009 | Antique Gold Medallion Mosaic | 2 | 1 | 1 |
| T010 | Near-black Polka Dot | 1 | 1 | 1 |
| T011 | Black Polka Dot | 2 | 2 | 2 |
| T012 | Black Check/Lattice | 2 | 2 | 2 |
| T013 | Vivid red Geometric | 3 | 2 | 3 |
| T014 | Black Polka Dot | 3 | 3 | 2 |
| T015 | Deep navy Diagonal Stripe | 2 | 3 | 2 |
| T016 | Red/Silver Diagonal Stripe | 1 | 1 | 1 |
| T017 | Light powder Paisley | 2 | 2 | 2 |
| T018 | Dark brown Paisley | 1 | 1 | 1 |
| T019 | Silver Check/Lattice | 1 | 2 | 2 |
| T020 | Deep navy Paisley | 1 | 2 | 1 |
| T021 | Dark navy Medallion | 2 | 2 | 3 |
| T022 | Dark Navy Honeycomb Geometric | 2 | 3 | 3 |
| T023 | Burgundy Paisley | 1 | 1 | 2 |
| T024 | Cornflower Blue Paisley | 1 | 1 | 1 |
| T025 | Grey Paisley | 2 | 2 | 2 |
| T026 | Ice Blue / Silver GG Monogram | 3 | 3 | 3 |
| T027 | Deep Purple Geometric Medallion | 3 | 3 | 3 |
| T028 | Midnight Navy Tonal Paisley | 1 | 1 | 2 |
| T029 | Navy Ornamental Medallion | 1 | 1 | 2 |
| T030 | Deep Purple Tonal Geometric | 1 | 1 | 1 |
| T031 | Midnight Navy Multicolor Regimental Stripe | 1 | 2 | 1 |
| T032 | Deep Purple Geometric Stripe | 1 | 3 | 1 |
| T033 | Dark Navy Multicolor GG Monogram | 2 | 1 | 2 |
| T034 | Bronze / Gold Woven Checkerboard | 3 | 4 | 2 |
| T035 | Midnight Navy / Blue GG Monogram | 3 | 2 | 1 |
| T036 | Purple/Pink Ornamental Medallion | 2 | 2 | 2 |
| T037 | Rose/Burgundy Geometric Medallion | 1 | 1 | 1 |
| T038 | Fuchsia Floral Geometric | 2 | 3 | 3 |
| T039 | Navy Floral Vine | 1 | 1 | 1 |
| T040 | Charcoal Tonal Geometric | 1 | 2 | 1 |
| T041 | Silver-Grey GG Monogram | 5 | 3 | 3 |
| T042 | Black Purple Polka Dot | 4 | 3 | 3 |
| T043 | Black Silver Floral Geometric | 2 | 1 | 3 |
| T044 | Silver-Grey Tonal Floral-Paisley | 3 | 1 | 1 |
| T045 | Pink Blue Micro-Dot | 2 | 2 | 2 |
| T046 | Pink Geometric Check | 3 | 2 | 2 |
| T047 | Pistachio Green Micro-Geometric | 6 | 4 | 3 |

Full selections, scores and curation diagnostics:
[tie-coverage.json](evidence/tie_coverage_rejection_scale/tie-coverage.json).
The compact per-tie data are also in
[tie-coverage.csv](evidence/tie_coverage_rejection_scale/tie-coverage.csv).

## 2. Permanent rejection correctness at 20–40 exclusions

Four batches of ten distinct clothing rejections used the actual candidate
engine and native feedback validators. Each refill preserved accepted option
records byte-for-byte and in order. All previously rejected clothing keys were
excluded from the result. After opening fresh engine/feedback instances against
the same synthetic storage, all 40 bans, including the earliest, still applied.

| Case | Active permanent exclusions | Returned options |
| --- | ---: | ---: |
| Initial Work list | 0 | 20 |
| First refill | 10 clothing combinations | 20 |
| Second refill | 20 clothing combinations | 20 |
| Third refill | 30 clothing combinations | 20 |
| Fourth refill | 40 clothing combinations | 20 |
| Reopened instances, fresh generation | 40 clothing combinations | 20 |
| Separate broad-scope test | 30 entire ties | 19 |

No 20–30 count cap or automatic rejection expiry was found. The ordinary test is
four batches, not 40 individual UI clicks or a phone reproduction. Reopening
Node instances is not a real browser reload.

The last row is a different constraint: rejecting 30 entire ties leaves 17 ties.
With one use per unanchored tie and at most two No Tie options in this Work
request, 19 is the maximum. No banned tie was reused to fill the twentieth slot.
This does not establish that the owner selected whole-tie scope.

`Reject once` deliberately expires on Generate/reload; `Never show again` is
permanent until explicit Undo. A reason checkbox does not broaden an exact
outfit rejection to a tie ban.

Evidence: [refill-audit.json](evidence/tie_coverage_rejection_scale/refill-audit.json).

## 3. Storage at 30,000 exclusions

The scale harness used a Storage-compatible Map with O(1) key lookup, no quota
and no disk IO. It seeded distinct exact clothing-plus-shoe exclusions, validating
every selection with the actual connection. These canonical fixtures are not a
claim that every combination would be an attractive generated recommendation.

At 30, 100, 1,000 and 30,000 active outfit exclusions, the ledger retained oldest
and latest records, accepted an additional rejection, deduplicated repeated
rejection and appended Undo while retaining original bytes.

### Measured Node operation time

Milliseconds below include possible concurrent CPU work. They measure this
synthetic environment, not phone or real-browser latency.

| Active outfit exclusions | Refresh | Check 20 outfits | Add one rejection |
| --- | ---: | ---: | ---: |
| 30 | 2.874 | 2.013 | 4.617 |
| 100 | 4.115 | 3.59 | 14.825 |
| 1000 | 37.363 | 29.808 | 136.446 |
| 30000 | 1238.453 | 934.088 | 2418.976 |

At 30,000 active outfit exclusions, adding one rejection scanned 90,001 storage
keys across three full passes. A cached snapshot clone alone took 471 ms.
The serialized keys and values occupied 9,330,000 UTF-8 bytes; the equivalent
UTF-16 payload was 18,660,000 bytes. These are payload calculations, not browser
quota rules.

A separate tie-history test used 30,000 events: 1,000 active shirt–tie exclusions
and 14,500 completed hide/Undo pairs. Checking 20 outfits took 9,487 ms and
600,000 key reads because each match refreshed the entire tie ledger. This is
30,000 history events, not 30,000 distinct active pairs.

### Proven restoration limits

- Each ledger rejects an import document containing more than 20,000 events.
  Undo and preference events count toward that limit.
- The UI rejects files larger than 5,242,880 bytes (5 MiB).
- The 30,000-outfit compact export was 8,070,096 bytes. The pretty JSON format
  used by the UI was 12,240,112 bytes, already beyond its own import limit.
- With 30,000 existing events, the shared gate even rejects a one-event incoming
  backup: it validates the complete old export through the 20,000-event method.
- Direct base imports of 20,000 followed by 10,000 succeeded. The 20,000 limit
  is per document, not an eviction policy or accumulated-storage count cap.

Evidence: [rejection-scale.json](evidence/tie_coverage_rejection_scale/rejection-scale.json).

## 4. Corrupt feedback can disable outfit exclusions at startup

The candidate application catches an initial outfit-feedback refresh error and
substitutes an empty memory ledger. Executing that exact initialization with one
valid rejection and one unreadable record produced `ownerFeedbackPersistent:
false`, zero active exclusions and an allowed result for the previously rejected
outfit. The shared gate also allowed it. Both original stored records remained.
The new tie ledger instead throws when it cannot validate permanent feedback.

This establishes an enforcement defect; it does not establish corruption on the
owner's device. Simply retaining bytes is insufficient if the running generator
stops applying their exclusions. Startup must block unchecked results while
permanent feedback is unreadable.

The actual candidate was then loaded in fresh Chromium 141.0.7390.37 profiles
at a 390 × 844 viewport. The browser reproduced both behaviors: corrupt outfit
feedback produced zero enforced exclusions and allowed the previously rejected
selection; corrupt tie feedback threw. All original and corrupt bytes remained.
These checks inspected the real application gate after reload, not a substitute
store. They did not render a new rejected outfit or run generation in the corrupt
profile.

### Actual browser capacity observation

A separate fresh Chromium profile received the 30,000 distinct validated outfit
fixture directly through localStorage. It saved **16,858** events and then threw
`QuotaExceededError` on the next write. Every successfully written event remained
after a real reload, including the first and last; none was recycled.

The successful keys and values contained 5,242,838 characters. The fixture had
no notes and no other application data. The exact count is specific to this
browser, profile and record shape; it is not a universal browser or phone limit.
It establishes that the current storage format cannot meet the 30,000 target in
this tested environment. This capacity test bypasses UI writes and measures
storage volume, not the latency of 16,858 rejection clicks.

The browser audit completed nine diagnostic checks, with no uncaught page errors
or external/provider requests. A successful diagnostic run confirms that the
observations were obtained; it does not mean these defects are fixed.

Evidence: [browser-audit.json](evidence/tie_coverage_rejection_scale/browser-audit.json).
CI: [run 44333774181](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44333774181),
tested audit commit `3aa853d3fb911a1fc838eba048edeba08b8e7734` with production
code identical to `69545e85bf4ee0719d29dc81bade011332c4caf8`.
Downloaded artifact SHA256:
`6b508400e6e5f160757eaede99c0cb1e6994d4798c60f6fcaffc4f9bc853cecb`.

## 5. Search can stop before the wardrobe is exhausted

A deliberately constructed actual-engine test fixed suit S10 and observed 1,968
source-eligible clothing rows. Only 167 entered preference scoring. After
rejecting those 167 clothing combinations, the same request returned zero
options while 1,801 source-eligible rows had never been scored.

Anchoring shirt DS036 and tie T041 exposed an unrejected witness:
`S10 + DS036 + T041 + shoe-1 + watch-AP09`. The actual engine returned it with
compatibility 9.419178 and preference 9.142759. Instrumentation only captured
references to existing pools; it did not change eligibility or ranking.

The generator selects sample/coverage representatives before testing saved
clothing/tie/pair exclusions. Its `allCandidates` pool contains the scored
sample, and `capacity_fallback_to_full_source` expands to that sample, not the
entire raw source pool. This is proven premature search exhaustion at 167
constructed exclusions. It is not a reproduction at 20–30 ordinary rejections.

Evidence: [refill-audit-sampling.json](evidence/tie_coverage_rejection_scale/refill-audit-sampling.json).

## Implementation specification following this diagnosis

1. Replace empty-store startup fallback with a blocking, recoverable feedback
   state. Preserve unreadable records and show a precise error; never treat a
   failed read as proof that no exclusions exist.
2. Use an IndexedDB-backed module for at least 30,000 active exclusions,
   with capacity for Undo/history beyond that count. Keep exact scope/occasion
   keys indexed in a validated memory cache, with a compact revision token.
   A match must not reread or serialize the full history.
3. Migrate both existing ledgers without changing event IDs, scope, occasion,
   notes or Undo relationships. Verify the committed migration before switching
   enforcement. Keep old data available for recovery; avoid partial-success
   messages. Concurrent-tab updates must invalidate stale results.
4. Support exports/imports of the complete supported dataset, including old
   outfit-only backups and combined tie/outfit backups. Remove the mismatch
   between export size and import capacity. Paginate the rejection manager.
5. Apply clothing/tie/pair exclusions before candidate sampling. Preserve
   shoe-specific bans at shoe scope. Expand the search beyond the scored sample
   when it runs out, and report whether search was bounded or exhaustion proven.
   Keep accepted options, occasion rules, locks and numerical scoring intact.
6. Validate real browser/mobile-layout behavior with 30,000 active exclusions,
   migration, reload, import/export, Undo, concurrent updates and storage failure.
   No rejected combination may be recycled to fill a list. Browser storage
   deletion cannot preserve a rejection by itself; recovery requires retained
   exclusion data or a backup.

Deleting all information about a rejection would allow the same combination to
be generated again. The lightweight persistent object is its exact exclusion
identity and necessary scope/Undo metadata, not a stored outfit image.

### Concrete integration boundary

Use `events`, `active` and `meta` database stores for immutable feedback events,
indexed active exclusions and revision/migration state. Preserve duplicate
imported hides as separately undoable records. The current four scopes and
historical Neither semantics must remain exact.

Keep the engine-facing `refresh`, `snapshot`, `match`, `allowed`, `token`,
`assertCurrent` and `reorder` API synchronous over a validated cache. Hydration,
mutation, migration and final cross-tab revision validation are asynchronous.
Create a blocked facade during synchronous application boot so subsequent
deferred scripts can attach; enable generation only after hydration succeeds.

Both the main rejection UI and `hewrs-stage10-integration-panel.js` currently
assume hide/Undo complete synchronously. Both need explicit awaits and dynamic
persistence status. The reviewed ranker, discovery and pipeline consumers need
the existing synchronous read contract. Limiting changes to the main card would
leave another application path stale.

Commit both legacy namespaces, derived indexes and a migration marker in one
database transaction. Preserve old localStorage bytes and reconcile legacy
writes made during migration. IndexedDB cannot make a localStorage write part
of its transaction; old open clients will require coordinated reload before
they can enforce new database-only rejections.

The IndexedDB specification describes indexed records and transactional updates.
The implementation must resolve a successful write when its transaction completes,
not merely when an individual request succeeds, and handle aborts without a false
success message. See the [W3C IndexedDB transaction lifecycle draft](https://www.w3.org/TR/IndexedDB-3/#transaction-lifecycle).
This supports the storage choice; actual capacity, migration and concurrency
behavior still require the browser tests specified above.

## Reproduction and evidence boundaries

```sh
node tests/tie-coverage-audit.cjs
node tests/rejection-scale-audit.cjs
node tests/rejection-refill-audit.cjs
node tests/rejection-refill-audit.cjs --sampling-proof
node tests/rejection-scale-audit.cjs --fixture-only
python tests/rejection-startup-audit-browser.py
```

The browser audit needs Playwright Chromium and a loopback HTTP server. Its
fresh test profile blocks all non-local requests. The generated 8 MB fixture is
reproducible and intentionally excluded from the committed evidence; the
observations and test code are retained. The browser workflow checks protected
production sources against the pinned candidate and has read-only repository
permissions. It does not deploy.
