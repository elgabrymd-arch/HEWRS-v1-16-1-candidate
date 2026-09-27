# HEWRS V1.16.6 — Favorites within the accepted 18-shirt scope

## Delivered implementation

The previously unavailable **Rotation → Favorites** function now saves exact
supported outfits, lists/searches saved outfits, opens them through the current
renderer, and removes an individual favorite only after confirmation. A second
save of the exact same physical selection is a no-op. Shared image bytes do not
merge physical IDs, including DS001/DS014, DS024/DS025 and DS021/DS047.

Saving, removing, exporting or importing favorites never writes the existing
wear/session ledger. Opening a favorite is different: it renders atomically,
then saves the **current session** through the existing handler. Confirmed wear
entries stay identical, the origin is manual, and no score or Engine option is
restored from the bookmark. A shirt-only selection continues to have no
numerical ranking. A failed favorite render keeps the preceding complete outfit
and writes neither a session nor a wear event.

Favorites have a separate versioned namespace:
`hewrs:connected-app:favorites:v1`. The existing wear key, schema and source lock
are unchanged. The maximum is 500 favorites. Corrupt/incompatible data is
retained and its writes blocked; there is no silent reset or migration. Failed
writes and stale-tab conflicts do not produce a successful-save message.
Unavailable persistent storage is explicitly described as session memory.

**Export / Import favorites** is a separate Favorites-only workflow. Import
previews additions and already-saved exact outfits. Confirmation merges new
favorites while preserving existing IDs. Conflicting IDs, incompatible source
locks, malformed files, wear backups and unsupported selections are rejected.
The existing wear/current-outfit backup is unchanged and now explains that
Favorites have their own export/import. There is no automatic cloud/device sync.

## Controlling baseline and preserved scope

The exact 18-shirt V1.16.5 source ZIP was inspected, its release increment checked,
and all 1,392 payload hashes verified before copying the 1,393-file tree.

- Baseline ZIP bytes: 258,783,152.
- Baseline ZIP SHA-256:
  `a95ba0c4e2e43043ff6e69179e50a0ed9353c8cab10a63b6a729ff99b47fbb2c`.
- Baseline increment: `OWNER_SCOPED_18_SHIRT_NON_SUIT_PICKERS`.

The conflicting 19-shirt/DS041 V1.16.5 package was not used. There are still 18
non-suit shirts, 32 deferred non-suit shirts, all 50 shirts in suit mode and
Wardrobe, all 18 suits, 14 blazers, 24 physical trousers and the existing footwear
bindings. No new garment images, IDs, registration or source score were added.
All **705 existing runtime image files** remain byte-identical. Existing garment
renderers, accepted DS023 mattes, palette/CSS and mobile-sheet layout are intact.

The only changed existing runtime adapter is `src/application.js`: it connects
Favorites, labels its state, integrates the Favorites dialogs with the existing
modal/layout owner, and labels the separate backups. `src/favorites-state.js` is
new. HTML/build updates load it before application initialization and version the
two changed script URLs. No application source was deployed to GitHub.

## Fresh validation

**31 functional checks passed; zero failed.** These cover save/read/deduplication,
physical identities, all 50 suit shirts, 18-shirt non-suit scope, unavailable and
REFERENCE guards, malformed and incompatible data, no-write initialization,
quota/read-back failures, cross-tab conflicts, confirmation/revision checks,
non-destructive imports, the 500-item bound, separate storage, source-lock and
rollback readability. Routing checks also validate 39,817 suit selections and
12,960 non-suit selections; these are not rendered-frame counts.

**25 in-memory Chromium checks passed; zero failed:** 21 in the main browser
suite and four supplementary failure/backup checks. The main suite compares
**90 actual complete outfit frames** with the independent V1.16.5 baseline, all
pixel-identical. These include all 18 connected non-suit shirts tied/No Tie in
shirt-only/B03, and DS023 under all 18 suits.

Actual UI checks exercise save, search, duplicate prevention, removal Cancel and
confirmation, manual recall, Favorites download, invalid wear-backup rejection,
import preview and merge, unchanged confirmed wear, and existing picker Cancel.
Long Favorites lists and footer controls were checked at five viewports,
including a 390 x 350 keyboard-sized viewport. The 390 x 700 Favorites screenshot
was visually inspected. It contains synthetic test favorites, not owner records.
The accepted one-screen Home layout and 18-shirt picker remain intact.

A new memory-loaded page was initialized from the same synthetic storage and
restored the Favorites plus current outfit without additional wear. This is
**synthetic reinitialization**, not physical-browser restart certification.
The supplemental tests confirm missing-image failure does not substitute
clothing or write wear, duplicate-only import does not write, REFERENCE cannot
be saved, and the old backup dialog labels its separate Favorites boundary.

Two initial long browser invocations were interrupted by tool timeouts before
completion; the complete suite was rerun successfully. Supplemental harness
issues (a string predicate incompatible with CSP and a hidden-page selector)
were corrected and all four checks rerun. No CSP or browser security policy was
weakened. Pass counts refer only to completed final runs.

One genuine localhost persistent-profile test was attempted. Navigation was
blocked **before application load** by `ERR_BLOCKED_BY_ADMINISTRATOR`; the local
server received no requests from that attempt. It is recorded as BLOCKED, not a
pass. Hosted Favorites loading, actual iPhone/Safari operation, and physical
restart persistence of the new Favorites feature remain owner-device checks.
A separate Python HTTP-byte check passed for all 47 script/stylesheet resources,
including the two new versioned script URLs; it is not a browser acceptance test.
Previously reported DS023/mobile/persistence acceptance is not reopened and is
not relabelled as new Favorites acceptance.

## Update and rollback

Use **only** the update named `HEWRS_18_ONLY_V1165_TO_V1166_FAVORITES_UPDATE.zip`
over the owner's verified 18-shirt V1.16.5. The update's `FILES_TO_COPY` contents
merge into the existing candidate folder. Do not delete other folders, remove
`.git`, clear browser data or upload a different V1.16.5 package.

The complete source is `HEWRS_CONNECTED_APP_V1_16_6_18_ONLY_SOURCE.zip`.
`CHANGED_FILES.json` gives exact paths and before/after hashes.
`PACKAGE_SHA256.json` covers every payload except itself. The cumulative update
has a separate payload/target manifest and installer. Installation and exact
V1.16.5 source rollback are verified in fresh output folders; neither operation
opens browser storage. Favorites data is not deleted when rolling back, although
V1.16.5 itself has no Favorites interface.

## Material limits

Favorites are local to each browser/device. Favorites backup and wear backup are
separate; neither automatically syncs through the GitHub repository. Shirt-only
ranking, weather/season sources and other previously unavailable policies remain
uninstalled. The 32 deferred non-suit shirts do not block the accepted scope.
Existing source-resolution, outer collar/shoulder and straight-waistband visual
limitations remain. No physical-device acceptance or complete-product claim is
made for this increment.
