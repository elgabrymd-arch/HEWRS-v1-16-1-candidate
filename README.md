# HEWRS V1.22.0 — confirmed S02 source + local outfit preferences

Continue the existing app. Read `QUICK_START_V1_22_0.md` for installation and first use.

This source requires the complete folder structure. `index.html` is not self-contained. Keep the same candidate site and browser data. No private AI/API setup is needed.

S02 uses the owner-confirmed muted-medium-brown, low-contrast source across interpreters and regenerated derived assessments. Its existing registered fabric image remains unchanged and has a disclosed stronger-check discrepancy. Its appearance is excluded from learning.

The Research-based generator supports explicit local A/B preference learning; zero user votes are seeded. A24-pair pilot includes16 training and8 held-out comparisons, rendered from actual wardrobe sources. Eight informative A/B choices over3 training topwear groups activate an experimental, bounded local model. Both/neither are retained but not treated as directional labels. It is not live AI or proof of improved personal taste.

The20-option target, tie-once and other-items-twice caps, exact-anchor exceptions and default No Tie maximum2 remain. All848 original garment images, physical IDs and historical pair scores remain preserved. Wear/Favorites/weather data stay separate from the preference namespace.

`V1220_IMPLEMENTATION_AUDIT.md` gives fresh tests and limits. `LOCAL_PREFERENCE_MODEL_V1_22_0.md` gives the equations, features and feedback contract. Earlier delivery/evidence directories are historical, not newly repeated results.

Verify: `python -B tools/verify_v1220.py`
Rollback into a NEW folder: `python -B tools/rollback_v1220.py --output NEW_FOLDER`

No GitHub deployment was performed when this source was delivered.
