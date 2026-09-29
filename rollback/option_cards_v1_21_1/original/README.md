# HEWRS V1.21.0 — 20 options with unique unanchored ties

This is the complete runnable source folder. Keep all subfolders; index.html alone is not self-contained. The release continues V1.20.0, not a new wardrobe or a deployment.

## Current method
Home → Style → Stylist settings → **Research-based wardrobe generator — local (up to 20)** → Apply method. Leave all six garment preferences on Engine/any for unrestricted Engine Choice. Exact choices remain anchors only for the item chosen. No clearing browser data is required.

Target20 distinct clothing configurations. Each unanchored tie is used once; other unanchored physical items at most twice. No Tie stays at most2 unless explicitly selected. The tie palette/readability correction and complete-outfit candidate review cover every currently eligible tie. No per-tie quota, compulsory color or newly invented grade is installed.

All18 suits and13 blazers returned20 in the neutral test; B14 returned16 because8 source-eligible physical trousers at2 uses give a16-option ceiling. Restrictive locks/weather can reduce other requests. Curated remains a finite collection, not the broad generator. Private AI remains paused/unconfigured.

## Update
Use **HEWRS_V1200_TO_V1210_TWENTY_UNIQUE_TIES_UPDATE.zip** over the existing V1.20.0 source. Copy everything INSIDE FILES_TO_COPY into the existing candidate root, replacing matching paths and retaining other files and .git. Do not copy the enclosing directory or the ZIP into the public repository. Commit:

`V1.21.0 — 20 options, unique ties and full-palette tie review`

Commit to main then push in the existing repository. This package does not itself deploy to GitHub.

## Verify / rollback
`python -B tools/verify_v1210.py` verifies current source bytes, scope and protected images.
`python -B tools/rollback_v1210.py --check` validates rollback sources.
`python -B tools/rollback_v1210.py --output NEW_FOLDER` reconstructs exact V1.20.0 in a new folder, refusing an existing destination. It never reads/writes browser data. Keep the same website origin and do not import older history to roll back application code.

## Evidence
Read V1210_IMPLEMENTATION_AUDIT.md and RESEARCH_RULES_V1_21_0.md. Current results are in evidence/twenty_ties_v1_21_0. Prior version reports elsewhere in this package are HISTORICAL, not current method/limit declarations or new test runs.

Original inventory/IDs, frozen scores, all848 runtime images, weather, rendering, Favorites and wear-history code remain unchanged. The recommendation order and list rules intentionally change. No API keys, service password, paid request or new garment pixels are included.
