# HEWRS Standard — accepted baseline and default-launch handoff

## Scope

The owner accepted the Stage 11 application at commit `5e071d9be76cbcba0f8a1d1c60720bb9a57feab1`, including individual visual inspection of all 60 MODERN options across Work, Dinner and Weekend. This handoff promotes that exact application to `index.html` and `app.html`. `stage10-integration.html` remains unchanged for existing bookmarks. The existing page title and version label are retained to avoid changing the accepted HTML.

Accepted runtime: `runtime/hewrs-bbbcec41d08f91585f4a.js`.
SHA-256: `bbbcec41d08f91585f4ab40cd4b15b2cddfb08df35e04a6122747066ba637150`.
Accepted HTML SHA-256: `e5a4e23588ffef53c8668de5afd181e87f90cb1efcbec5442a341a1cd35cceb8`.

No new styling policy, clothing, avatar, renderer, paid API calls, storage schema or Creative mode is introduced. The historical local wear-rotation test was not confirmed by the owner's later statement that no outfit had been logged; synthetic tests are not evidence of the owner's real wear history.

## Reproducible build

Run `python tools/build.py`. The 107 embedded source modules, their order, integration panels, CSP and integrity metadata reproduce the accepted runtime and launch HTML exactly. Five previously missing/out-of-sync source modules were recovered from the accepted runtime, not rewritten. See `SOURCE_ALIGNMENT.json` and `STANDARD_RELEASE.json`.

The builder refuses a different Standard runtime/HTML hash. An intentional future Standard change requires a new reviewed release record and regression, not silently updating a hash to make a failing build pass. AI Creative belongs on a separate branch/entrypoint and must not weaken Standard's owner rules. The old standalone export is deliberately rejected because the accepted application requires separately loaded review panels; use the complete application directory.

## Backup and rollback

The read-only recovery reference is `backup/standard-before-default-handoff-20261113`, pointing to the accepted commit above. It preserves code and tracked assets; it does NOT contain private browser records.

Rollback should restore the earlier default `index.html`, `app.html`, template, build metadata/tooling and aligned source paths from that reference via a reviewed forward commit. Keep current garment assets, retain the accepted runtime file and existing Stage 10 entrypoint, and never clear browser storage. Do not force-reset unrelated later work. The old main address loaded a different application; the accepted Stage 10 bookmark remains usable throughout.

## Private browser-data boundary

No actual owner browser profile is read, exported, copied, cleared or migrated during this handoff. Using the same origin and storage namespaces preserves records in the same browser; automated tests use synthetic records only. A source-code backup is not a backup of Favorites or personal feedback.

Existing user-controlled exports:
- Wear/current outfit: **Wardrobe → Backup & Restore → Export current backup**. This export does not include Favorites.
- Favorites: **Rotation → Favorites → Export / Import favorites**.
- Learned preferences, exact rejections and image-assessment archives use their separate existing panel exports. They are not included in the wear export.
- Home category preferences are persisted independently; this handoff adds no consolidated personal-data export.

Do not upload personal backups, service tokens, provider keys or browser storage into this public repository. Do not mark an outfit as worn merely for testing. Stored data is not automatically synchronized between devices.

## Validation

The handoff checks exact source/runtime/HTML identity, unchanged tracked assets/data, reproducible rebuild, existing NO TIE persistence regression, default-address generation parity, native-avatar pixel parity, same-origin Favorites/preferences and synthetic wear-ledger retention, and absence of external/provider requests. These are isolated Chromium tests, not a claim of reading or certifying the owner's iPhone storage.

Deployment is a separate action after those checks pass. Passing preparation does not, by itself, establish publication.
