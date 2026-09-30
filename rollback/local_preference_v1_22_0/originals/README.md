# HEWRS V1.21.1 — lookbook option cards

This continues exact V1.21.0. Only the presentation adapter, stylesheet, template/build list and additive UI thumbnails change. Recommendation algorithms, native garment/face pixels, weather, history, Favorites, wardrobe identity and all option constraints remain unchanged.

## Use

Open the existing source through the same website/static host. `index.html` is not self-contained without its folders. On Outfits, **Option card** is the default. **Standard view** retains the old presentation. The large native outfit, exact shirt/tie/shoe detail thumbnails, trousers, watch ID/name and option count appear together. Desktop uses two columns. Narrow phones stack the full-size outfit and the readable item rows; scroll within Outfits, not sideways.

**Export cards** creates a current-card PNG or an HTML lookbook of the actual current list. A Download link appears when ready. Open the self-contained HTML on a computer or phone. Browser Print / Save as PDF prints one card per page. A real 16-option list remains 16 cards; there is no duplicate filling. Exports include the avatar and wardrobe; store/share them deliberately. They do not contain wear history, Favorites, service credentials or live controls, and do not log wear.

## Install / verify / rollback

Use the V1.21.0 → V1.21.1 update. Copy the contents of `FILES_TO_COPY` into the existing repository root; retain other files and `.git`. Do not clear browser data. Commit summary: `V1.21.1 — lookbook option cards and export; preserve 20-option logic`.

`python -B tools/verify_v1211.py` verifies the complete delivered source and protected baseline files. `python -B tools/rollback_v1211.py --check` checks exact restoration bytes; `--output NEW_FOLDER` reconstructs V1.21.0 in a new directory. Browser data is never read by those tools.

## Evidence boundary

14 functional checks and 20 in-memory Chromium checks passed; 90 original native frames are byte-identical. Actual Generate/navigation preserves FREE20, S10's20 and B14's16 selections and order from the independently generated baseline fixtures. A 20-card HTML download and its 20-page print export were checked. 174 cropped UI thumbnails are separate from the 848 original runtime images. They are source details, not new garment photographs or fake watch images. Source cutout/resolution limits remain; no native garment was retouched.

The local HTTP byte checks passed, but a genuine origin browser request was blocked by this environment before loading. No hosted GitHub or physical Safari test, GitHub upload, paid AI connection or source deployment was performed. See `V1211_OPTION_CARDS_AUDIT.md` and `evidence/option_cards_v1_21_1/`.
