# HEWRS V1.23.0 — explicit acceptability learning

Executable continuation of V1.22.1. Existing Both work / Neither works responses
now fit a separate bounded complete-outfit acceptability model. The original A/B
learner and its evidence threshold are retained. Twelve new unlabelled shirt and
whole-outfit comparisons supplement the original 24; no responses are preloaded.

Start with `QUICK_START_V1_23_0.md`, `ACCEPTABILITY_MODEL_V1_23_0.md` and
`V1230_IMPLEMENTATION_AUDIT.md`. Test evidence: `evidence/acceptability_v1_23_0/`.
Source verification: `python -B tools/verify_v1230.py`.

The same wardrobe, IDs, 848 original images, original scores, S02 correction,
20-option target, unique unanchored ties, two-use other-item limit, weather,
wear/Favorites/history safeguards and lookbook renderer remain. No API is needed.
Three startup scripts and lazy loading of the calculation index are preserved.

Owner feedback is never stored in this repository. Test labels and fixtures under
`tests/` and `evidence/` are synthetic and MUST NOT be imported as personal answers.
This source package is not a record of current live GitHub/Safari acceptance.
