# HEWRS connected application V1.17.2

47-tie source texture restoration on V1.17.1. Read `DELIVERY_V1_17_2.md` for
actual changes, tests and image limitations. This is not a whole-product final
certification or a public deployment.

## Run
Serve the complete folder as a static site (including assets/, data/, src/,
vendor/, assemblies/). For local testing with Python: `python -m http.server 8000`
from this folder, then open localhost:8000. A source ZIP is not itself the app.
The existing candidate GitHub Pages site can host these same files.

## Preserve
18 shirts remain connected in non-suit modes, all 50 remain in suit mode.
T001–T047, original DNA/scoring/rotation, Favorites, history and weather logic
are unchanged. Keep the same origin and browser data; do not clear storage to
install or roll back an image update. Watch images remain deferred.

## Verify / undo
`python -B tools/verify_v1172.py`
`python -B tools/rollback_v1172.py --output NEW_FOLDER`
Rollback reconstructs the complete original V1.17.1 source without opening or
changing personal browser records. Never publish personal backup JSON files.
