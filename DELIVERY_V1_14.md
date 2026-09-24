# HEWRS V1.14 — implementation delivery

**Status: source-routing/picker increment; clothing completion remains open.**
This is changed runnable source, not an unchanged V1.13 archive relabelled final.
It does not visually activate the remaining 48 non-suit shirt IDs.

## Implemented

A generated source registry now records 50 physical shirt identities, 576
hash-matched current component references and 44 exact assembly groups. Each
record retains its own history ID, current source components and mode limits.
A connection wrapper pins these descriptors and the two existing full-shirt
routes. A component plan identifies exact body/collar/tie/cuff inputs without
claiming that an upper insert is a full garment.

The working picker/controller now prevents choosing unbound shirts in blazer
or shirt-only mode. All IDs remain visible and all 50 remain usable in suit
mode. DS040–DS043 retain No Tie only; incompatible tie buttons are disabled.
Apply/Cancel, independent preferences and explicit No Tie remain intact. An
unsupported programmatic route fails without replacing the displayed outfit
or adding wear. An unavailable numerical score does not revoke a suit visual.

## Fresh validation

- **20 new functional checks passed; 0 failed.** These include all 576 actual
  component-file hashes, 2,212 per-shirt/state component plans, all 39,817 valid
  preserved suit/state selections and 1,440 existing non-suit selections.
  The selection and component counts are routing checks, not rendered images.
- **21 V1.13 functional regression checks passed; 0 failed.** Current results
  are stored separately from historical packaged reports.
- **16 Chromium checks passed; 0 failed.** Among them, **87 complete outfit
  renders are pixel-identical to the separately restored V1.13 build**: 54 suit
  controls across all 18 suits (DS035 No Tie/T017 and DS051 T017), 28 controls
  across all 14 blazers, four existing shirt-only controls and the default
  suit control. These are fresh comparisons, not the old V1.13 87-comparison
  receipt reused as new evidence.
- The browser also exercised real picker buttons, Apply/Cancel, No Tie guards,
  rejection/frame preservation, isolated wear confirmation and a 390×844
  Home viewport. Storage in this run was an explicitly synthetic Map.

All **611 pre-existing runtime images** are preserved byte-for-byte. No new
garment image, avatar, geometry, mask, source score, physical ID or storage
schema was introduced. Original controller, stylesheet, scorer and storage
files remain unchanged. The final integrity report and exact before/after file
hashes accompany the source.

## Material unresolved limits

**48 additional non-suit shirts remain unavailable.** Their current packaged
body images provide upper suit-opening coverage, not the lower torso/sleeves
needed by the affected modes. For example, DS036 body bounds are
`[350,416,650,837]` on the 996×2748 canvas. A diagnostic assembly under existing
blazers showed a visible gap; it was rejected and was not installed. Filling
that gap with DS001 or arbitrary newly drawn cloth was not authorized.

The dependency ledger names each missing component by shirt and operation,
records which current files were examined, and carries the exact historical
full-shirt references present in V1.13. Those historical files are not runtime
bytes in this package and are not automatically current appearance authority.
Two existing Library source archives were located, but both raw-byte retrieval
requests returned an unavailable authorized materialization path. Their archive
contents were not examined. Garment approvals remain closed.

**Numerical policy:** shirt-only ranking is not installed. No suit/blazer score
is relabelled as shirt-only; manual visuals and numerical policy remain separate.
Existing source-score holds and intentionally unavailable functions are unchanged.

**Release/device validation:** the separate real localhost/persistent-profile
attempt returned `ERR_BLOCKED_BY_ADMINISTRATOR` before application loading,
with no HTTP requests reaching the server. Hosted loading, actual localStorage,
reload/restart persistence and physical iPhone/Safari acceptance therefore remain
unverified. The policy was not modified or bypassed. No deployment occurred.

## Delivery and rollback

Extract the complete source folder and follow `README.md`. The prebuilt
`index.html` requires its assets/data/src/vendor/assemblies directories.
`CHANGED_FILES.json` lists exact added and modified paths with hashes; no
baseline file was deleted. The package manifest covers every bundled payload.
`tools/rollback_v114.py` reconstructs an exact, independently hash-verified
V1.13 tree in a new destination without modifying the current source or browser
history. Serve that tree at the same origin; never replace a current ledger
with older wear data merely to roll back code.
