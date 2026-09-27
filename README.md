# HEWRS connected candidate — V1.16.6

Continues the verified **18-shirt-only V1.16.5** build. The alternative DS041
19-shirt V1.16.5 branch is not an input. Keep this candidate repository and
its existing website origin. No new repository, wardrobe or browser reset.

## Favorites

Display an outfit using the existing Engine or Anchor workflow. Open
**Rotation → Favorites → Save current outfit**. An exact outfit is saved once;
physical garment IDs remain distinct even where their images are shared.
**Open outfit** recalls it as a manual Anchor selection through the existing
renderer and remembers the current selection through the existing session
handler. It does not log wear, reuse a saved score, or make it an Engine pick.

Favorites have their own browser storage key. They do not automatically sync
between devices. **Favorites → Export / Import favorites** exports or merges
Favorites-only JSON after an explicit preview/confirmation. Existing favorites
are retained; conflicts are rejected. The existing **Backup & Restore** remains
for current outfit and wear history, with an explicit reminder that Favorites
are separate. Removing a favorite requires confirmation and never clears wear.

Favorites can contain supported suits (all 50 shirts), blazers and shirt-only
outfits (18 shirts). REFERENCE and unavailable routes are not stored. No
shirt-only ranking model was added. Other 32 non-suit shirts and watch images
remain deferred. Existing source-resolution/collar/waist limitations remain.

## Run / update

Serve this complete folder with `index.html` at the root. All existing assets,
assemblies, data, vendor and source directories are required. `index.html`
alone is not a self-contained app. The `.6` application/Favorites scripts use
versioned script URLs; unchanged resource version markers are retained.

For the small update, copy the **contents** of `FILES_TO_COPY` into the existing
18-shirt V1.16.5 candidate root. Keep `.git`, all other folders and browser data.
Commit and push only when ready. No deployment was performed by this build.

Verify: `python -B tools/verify_v1166.py`.
Rollback check: `python -B tools/rollback_v1166.py --check`.
Restore exact V1.16.5 to a new folder:
`python -B tools/rollback_v1166.py --output NEW_FOLDER`.
Neither tool accesses browser data. Old code lacks Favorites UI but does not
remove the new, separate Favorites namespace; updating back restores access.

Read `DELIVERY_V1_16_6.md` for fresh test evidence and limitations. Prior
owner-reported DS023/mobile/persistence passes remain recorded separately.
New Favorites hosting/iPhone/restart acceptance is not yet certified.
