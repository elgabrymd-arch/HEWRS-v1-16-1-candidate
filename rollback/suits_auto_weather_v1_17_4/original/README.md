# HEWRS V1.17.3 — colour interpretation and option-list limits

Continuation of V1.17.2. Use the full folder, not index.html alone. This release
retains 18 connected non-suit shirts, 50 suit-mode shirts and the restored 47 ties.

See `DELIVERY_V1_17_3.md` and `evidence/options_v1_17_3/` for the five-pass audit.
The original source DNA and frozen Shirt–Tie scores are unchanged. Derived
ensemble estimates intentionally change where colour text was wrongly parsed.

Engine Choice now limits every unanchored physical item to two appearances in
one returned option list. Only exact item anchors exempt that item. No Tie is
limited to two unless selected. No-jacket shirt-only remains manual-only; its
separate list cap is two, not an installed shirt-only scoring model. No duplicate
or accessory-only padding is used to reach 15. Restrictive requests may return
fewer with an explanation; the selector does not claim a global combinatorial optimum.

Weather was reported fixed by the owner and is untouched. Local wear, Favorites,
source lock, storage keys, garment images, palette and geometry are unchanged.

## Run
Serve this complete folder with any static web server. The existing GitHub Pages
candidate can be updated using the supplied `FILES_TO_COPY` package. Keep the
same origin, folder structure and `.git`; do not clear browser data.

## Verify
`python -B tools/verify_v1173.py`

## Roll back
`python -B tools/rollback_v1173.py --check`
`python -B tools/rollback_v1173.py --output NEW_FOLDER`
This reconstructs exact V1.17.2 into a new folder. It never accesses browser data.

Historical tests under older evidence folders are retained as historical reports.
New results live only in `evidence/options_v1_17_3/`. Old version-specific verifier
scripts apply to their restored versions, not automatically to this new build.
