# Install and start — V1.22.0

## Correct starting version

This update is for the **V1.21.1 LOOKBOOK cards/export build**, delivered as `HEWRS_V1210_TO_V1211_LOOKBOOK_CARDS_UPDATE.zip`. It is not for the earlier conflicting EDITORIAL-only V1.21.1 variant. The included installer checks the exact baseline manifest. Do not replace the app with this README, the preview or a photo-gallery archive.

## Install

1. In your existing GitHub Desktop candidate repository, fetch/pull the latest committed source. Back up that folder outside the repository.
2. Extract this update ZIP. Open `FILES_TO_COPY`, copy **its contents** into the existing repository root (where index.html, src, assets and data already exist), and replace matching files. Do not delete the existing source or `.git`.
3. Confirm `RELEASE_STATUS.json` says `1.22.0` and `S02_SOURCE_CORRECTION_AND_LOCAL_PREFERENCE_LEARNING`.
4. Commit to the same branch and push with:

   `V1.22.0 — correct S02 source and add local outfit preference learning`

No API, private site or paid service setup is required. Do not clear browser data or re-import an old wear backup.

For strict offline installation, `python -B install_update.py --source EXISTING_SOURCE --output NEW_FOLDER` validates the exact source and makes a separate complete target. It refuses an existing output folder. `python -B tools/verify_v1220.py` verifies the completed target.

## Start preference comparisons

Open **Home → Style → Stylist settings → Outfit preferences · compare and learn**. The same panel is accessible from **Outfits → Outfit preferences**.

Choose **Compare pilot outfits**. Compare the two actual wardrobe renders, use Collar detail when necessary, and select **Prefer A**, **Prefer B**, **Both work**, or **Neither works**. On the phone, scroll through both cards and their item lists; the voting controls stay at the bottom. Skip saves nothing. A saved response is followed by an explicit Next comparison button, so no next vote is inferred.

The pilot has 24 pairs: 16 for fitting and eight held-out checks. It contains no pre-filled owner ratings. The first ranking adjustment becomes available after eight informative A/B decisions across three training topwear groups. Both/neither remain useful review records but do not count as a directional preference.

The learning status panel shows how many informative choices exist and whether adjustment is active. Its Model details view identifies features, coefficients, model/source version and the separate held-out check. This threshold and a high small-sample match count are not proof that the model now understands all your taste.

## Generate and inspect

Return to **Research-based wardrobe generator — local (up to 20)** and Generate. With insufficient feedback or learning paused, it uses the baseline rules with the corrected S02 source. With enough eligible feedback, the card labels its result **Local preference fit · learned from comparisons**. Score Details retains the baseline research estimate and current source-based compatibility separately.

The 20/1/2 limits and exact-anchor rules still apply. Learning never logs an outfit as worn. Use Log This Outfit only for real wear, as before.

Pause learned ranking at any time without deleting feedback. Undo last preference requires confirmation. Export outfit preferences separately; the existing wear/Favorites exports do not contain them. Feedback remains local to this browser unless explicitly exported/imported. In session-memory mode, export before closing.

## S02

S02's confirmed muted-medium-brown/low-contrast source now reaches the active interpreters and regenerated derived assessments. Its artwork has not been recolored. The S02 card carries the existing source/render discrepancy and a button to view the confirmed fabric photograph. S02 appearance comparisons do not train the model while that discrepancy remains.

## Rollback

`python -B tools/rollback_v1220.py --output NEW_FOLDER` reconstructs the exact previous LOOKBOOK V1.21.1 in a separate new folder. It does not access browser data. Earlier code ignores the separate preference key; keep its export rather than clearing it. Rollback also restores the former S02 description/calculation behavior.

The delivery is a local tested implementation. No GitHub deployment or independent physical iPhone/Safari acceptance is asserted by the package.
