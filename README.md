# HEWRS V1.21.1 — editorial outfit cards

Continues the verified V1.21.0 build. Only outfit presentation, thumbnail crops
and release metadata change. All original ranking, 20-option policy, exact IDs,
weather, renderer and saved-data modules remain unchanged.

Open index.html through your existing static site after copying the COMPLETE
FILES_TO_COPY contents from the update into the candidate repository. This update
supports V1.21.0. It does not create a new site or change GitHub Pages settings.
Retain .git and other folders; do not clear browser storage. The private AI setup
remains paused and no credentials are needed or included.

Desktop: actual avatar on the left; registered shirt, tie and shoe-detail previews
and exact item names/IDs on the right. Phone: large avatar above legible item rows,
within one card; scroll to the item rows. Existing Previous/Next, option list,
Full Outfit, Collar Detail, Enlarge, score details and Log This Outfit remain.

Watches stay name/ID only. Previews do not invent separate product photography.
Shirt thumbnails show the untied collar source detail; they are not tied-collar
simulations and do not change the selected outfit. Original resolution/cutout
limitations remain visible.

Verify: python -B tools/verify_v1211.py
Rebuild preview bytes read-only: python -B tools/build_option_card_thumbnails.py --check
Rollback: python -B tools/rollback_v1211.py --output NEW_FOLDER

DELIVERY_V1_21_1.md describes tests, scope and installation.
