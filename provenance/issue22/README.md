# Issue 22 material sources

The registered garment PNGs remain unchanged. The material builder writes separate display layers for S06, S13, S14, B01, B06, and B10. Every derived layer retains the exact source canvas and alpha bytes; the suit jackets and trousers remain paired under their original IDs. Buttons, seam geometry, pocket geometry, and the B06 crest remain source bound. The renderer reports both geometry-source and display-source digests.

## Owner photographs

| Garment | Authoritative uploaded photographs | Interpretation |
| --- | --- | --- |
| S06 | IMG_1743.jpeg; IMG_1744.jpeg | Warm gray fine interlocking Glen check. |
| S13 | IMG_1741.jpeg; IMG_1745.jpeg | Dark blue-gray fine interlocking check. |
| S14 | IMG_1747.jpeg; IMG_1748.jpeg | Medium blue-gray fine near-solid weave. |

These are the exact owner-uploaded image bytes recovered from the latest November 22 references. The garment associations were checked against the latest conversation context. They are screenshots of real garment photographs with different lighting and exposure; they are not calibrated raw photographs. The image viewer chrome is excluded from sampling. Generated comparison collages IMG_1740 and IMG_1742 are not used as photographic authority.

The JSON manifest records the exact color and texture crop coordinates, image digests, projection parameters, source alpha digests, and measured changes. Color medians are an interpretation of these photographs, not a measurement of the garments' physical color. Fine textile detail comes directly from the actual suit photograph. Low-frequency source lighting retains the original folds, cut, and fit. A short overlap at sample borders avoids false mirrored chevrons while retaining the photographed weave direction.

## Linen material

`natural-linen-material-v1.png` is a generated neutral material swatch, not a photograph of any of the owner's garments. Its sole use is fine, matte natural flax weave and modest irregular slubs. No generated garment, avatar, hardware, logo, or design is used. Source luminance smoothing removes the previous false perforation or lattice material; local color is retained. For B01, B06, and B10 the decoded opaque-pixel color means remain within half an RGB level of their original sources. The B06 crest and original button cores are pixel exact.

## Reproduction and boundaries

Run `node tools/build_issue22_materials.cjs`. The tool uses native canvas decoding and deterministic material projection. It does not modify any registered source, avatar, wardrobe ID, source geometry, or saved user state.

Run `node --expose-gc tests/issue22-materials.cjs` for original/display digest checks, every alpha byte, transparent-pixel preservation, hardware preservation, unchanged linen color means, fractional sample edge regressions, fail-closed ownership checks, full-avatar display lineage, visible original face and neck preservation, and exact unrelated full-avatar comparisons. These automated checks do not constitute visual approval; the integrated full-avatar boards require a separate recorded review.
