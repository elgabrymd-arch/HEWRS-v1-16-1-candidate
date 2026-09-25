# HEWRS V1.16.3 — DS023 tied neckline and T017 edge mattes

## Delivered change

This is a targeted continuation of V1.16.2, not a replacement application.
Four separately named images trim the local opacity boundaries of the DS023
tied body, its two tied collar leaves, and T017's knot/upper transition. The
central skin-to-collar contour and the torn-looking knot notches are smoothed.
All source RGB values remain exactly unchanged; transparent pixels are not
filled with invented cloth. The originals are retained under their old hashes.
Nothing is translated, scaled, recoloured or regenerated.

The DS023 tied neckline correction applies in blazer and shirt-only modes with
all 47 ties. The T017 edge derivative is selected only for DS023 + T017 in
those two modes. T017 on other shirts, all NO_TIE routes, and every suit route
remain V1.16.2 output. The previous side-background removal and correct
shirt/trouser ordering are preserved.

This is a local edge correction, not a claim that every source cutout is now
perfect. Outer neck/shoulder cutout seams and the simplified straight waistband
remain unretouched. Source-resolution and fitted cloth limitations remain.
No belt, high-resolution texture, new skin, or new collar construction is added.

## Exact source and derivative boundaries

Baseline ZIP: `HEWRS_CONNECTED_APP_V1_16_2_SOURCE.zip`, 253,342,235 bytes,
SHA-256 `cdbbe43cd3a104639d37fae33d2a6ff86a3612f92642ff3334d16c997c272361`.
Its CRC and all source payload hashes were freshly checked before editing.

The opacity profiles are fitted inward from the existing neckline/knot masks,
with the results pinned at 1/256 native pixel. `PROFILES.json` records these
contours and their fitting settings. `tools/build_ds023_edges.py --check`
replays the quantized matte operation without fitting, editing source images,
or changing any output bytes. The native canvas stays 996 x 2748.

| Separate derivative | Alpha samples changed | Changed bounds [left, top, right, bottom) |
|---|---:|---|
| DS023 tied body | 680 | [386, 416, 619, 487] |
| DS023 left tied collar leaf | 409 | [386, 398, 490, 469] |
| DS023 right tied collar leaf | 488 | [513, 399, 617, 471] |
| T017 local knot/upper edge | 417 | [446, 471, 555, 586] |

For all four derivatives: zero RGB samples changed; zero opacity expansion;
zero changes outside the bounded local matte. Main collar tips below the neck
cut, garment placements, lower body, cuffs, trousers and avatar source are
not rebuilt. The new files do change edge coverage: they are local derivatives,
not recovered originals or a new owner-approval claim.

## Fresh validation

**43 functional checks passed, zero failed:** 33 inherited checks rerun with
an independent V1.16.1 fixture, plus 10 new edge-source and route-contract
checks. These include exact ID/history preservation, 39,817 suit/state routing
selections, 576 original component references, gating and absent numerical
policies. Routing enumeration is not a count of rendered frames.

**14 in-memory Chromium checks passed, zero failed.** There were **200 exactly
pixel-equal unaffected baseline comparisons**, including DS023 under every
suit and NO_TIE under every blazer. **130 changed-route comparisons** cover
all 47 DS023 tied states in shirt-only and B03 modes, T017 under all 14 blazers,
and T017 shirt-only controls across the 24 physical trousers. Every observed
change stays inside [386, 398, 619, 586). Upper-face pixels above row 398 and
all pixels at/below row 586 are identical to V1.16.2 in that entire matrix.

The actual `Collar Detail` UI button was clicked in both baseline and corrected
builds at 390 x 844, and returning to `Full Outfit` was checked. These are actual
browser screenshots, not only 120-pixel outfit thumbnails. The supplied larger
comparison is explicitly a crop of the same native browser-rendered frames.
The comparison and current Collar Detail screenshot were visually inspected.
The other visible source seams identified above remain, rather than being
hidden by calling the entire garment fixed.

All **701 V1.16.2 runtime images remain byte-identical**. Four alpha-only runtime
images were added. Original source registrations, score tables, IDs, source
lock, local-state implementation, suit data and accepted facelift styling are
unchanged. Failed-image, rapid-switch, picker Apply/Cancel and synthetic-ledger
checks passed. A separate local HTTP test delivered 752 files with exact bytes.
Exact V1.16.2 rollback was actually reconstructed into a separate folder.

The first inherited functional invocation lacked its baseline environment
argument; it was rerun with the correct independent fixture. The final pass
counts above refer to that corrected test invocation, not the incomplete run.

## Material release limits

The current browser suite uses actual local scripts and images loaded into
in-memory Chromium, plus an isolated synthetic storage map. It is not a
hosted GitHub Pages test, real-origin/browser-restart persistence certification,
or physical iPhone/Safari acceptance. The HTTP check verifies file bytes only.
The owner's screenshots identify the reported defects; they do not establish
physical-device acceptance of this new patch.

There are still 18 connected non-suit shirt IDs and 32 gated IDs. Shirt-only
numerical ranking remains absent; existing source-score holds remain explicit.
Watch ID/name remains sufficient. No public deployment, GitHub write, old live
site overwrite, browser-storage reset, or wear-history migration was performed.

## Update and rollback

The cumulative update can go directly from V1.16.1 to V1.16.3 and can also be
applied over V1.16.2. It includes the prior corrections; do not install the held
V1.16.2 update as a separate prerequisite. Copy the **contents** of
`FILES_TO_COPY` over the existing candidate root, preserving the subfolders and
`.git`. Do not copy the enclosing `FILES_TO_COPY` folder itself. The complete
source package remains available; `index.html` alone is not self-contained.
Keep the original source ZIP as an independent backup.

`CHANGED_FILES.json` records exact changed/new paths and before/after hashes
against V1.16.2. The update ZIP has its own cumulative file ledger. Package
self-manifests and change-ledger self-hashes are excluded from their own lists.
`python -B tools/verify_v1163.py` validates the resulting source tree.

`python -B tools/rollback_v1163.py --check` verifies the restoration bytes.
`python -B tools/rollback_v1163.py --output NEW_FOLDER` restores exact V1.16.2
in a new destination and refuses an existing destination. To restore V1.16.1,
run that restored build's `tools/rollback_v1162.py` into another new folder.
These tools never open or modify browser data. Source update/rollback at the
same origin does not require clearing localStorage or changing history IDs.
