# V1.22.0 — local complete-outfit preference model

## Scope and authority

The current Research-based wardrobe generator remains the underlying clothing and accessory evaluator. This increment installs the explicitly confirmed S02 source correction and adds a small, local, bounded preference overlay. It is neither a live visual AI nor a model trained on the owner's taste at delivery. **Zero owner ratings are bundled.** Test preferences are clearly synthetic and exist only in tests/evidence.

The wardrobe's actual pictures are used when the owner compares two outfits. The fitted model itself uses text/source-derived semantic coordinates. Thus a person assesses the complete image; the software learns only the distinctions that its twelve features represent. It cannot recover nuances missing from those features or repair a misleading garment image.

## Source correction is separate from taste learning

`data/owner-source-corrections.json` records the owner's S02 confirmation, its historical record, current descriptive fields, source-crop hash and limitations. `src/source-corrections.js` applies a cloned overlay without mutating the original input archive. S02 is muted medium brown, with very subtle charcoal-grey detailing and a fine tan-brown overcheck, with restrained Prince of Wales/Glen-check contrast.

All active S02 interpretations now use the same pre-existing comparison-scale coordinates: value 2.6, saturation .28, pattern contrast 1.2 and quiet=true. These are **ordinal modeling choices, not measured RGB/reflectance, cloth dimensions or fabric composition**. The original model's formula weights, pair scores and untouched items are not adjusted to disguise the source correction.

The derived option index is regenerated. Its separate current-source revision is required by the controller, so a stale numerical cache cannot silently accompany the new description. The old raw source files and historical pair tables are preserved; the former derived index and calculator are retained in `provenance/owner_source_s02_20260929` and exact rollback originals.

The registered S02 fabric has a stronger check than the newly supplied source photograph. No suit pixels are edited. The app identifies this mismatch on S02 cards, supplies the confirmed source crop, and refuses to learn from S02 appearance comparisons until that discrepancy is resolved. This does not prevent normal supported S02 selection or its newly corrected calculations.

## Feedback contract

The owner can choose Prefer A, Prefer B, Both work, Neither works, or Skip without saving. Optional reason categories are retained as explanations, not translated into arbitrary weights. Only explicit A/B choices are directional training labels. Both/neither are review data; they do not teach a fictitious ranking between the pair. A skipped, merely viewed, favorite-saved or unlogged outfit is not a dislike.

Each comparison stores exact registered selections, source interpretation version, controlled context, training/validation partition, timestamp, vote and optional reason. No face analysis, location request, external provider request or wear/Favorites access is performed by the preference store.

Identical/reversed duplicate comparisons are rejected rather than counted repeatedly. The interface provides a confirmed Undo last preference action. Changing an older rating is not implemented as a hidden overwrite. Imports preview and merge exact nonconflicting records; inconsistent IDs/pairs, wrong backups, unsupported sources and malformed values fail without replacing existing records.

`hewrs:outfit-preferences:v1` is separate from wear/Favorites/weather. Export this feedback separately. Data remains local to each browser; no cross-device sync is added. When persistent storage is unavailable the panel says session memory only. A corrupt preference store is retained and reported unavailable, never treated as empty evidence. Pausing leaves records intact and returns ranking influence to the baseline.

The UI acquires the browser Web Locks API's named exclusive lock when available. Token/revision checks reject observed stale writes and stale generation. On browsers without Web Locks the code uses the revision guard but does not claim a globally transactional cross-tab database or eliminate every simultaneous-write window.

## Pilot and held-out evaluation

The pilot contains 24 unlabelled, exact-ID pairs that passed current source eligibility: 16 training pairs across S01, S03, S05, S10, B01, B03, B06, B08; eight validation pairs across S12, S16, B09, B13. Each group includes a tie/open-collar comparison and a footwear comparison, with other pieces largely held fixed. A/B position is alternated and no method name, ranking position or numerical score identifies a winner. All clothing is rendered by the current approved compositor. These are proposed comparison stimuli, not 48 newly approved outfits or user ratings.

Validation topwear groups are reserved even for manually chosen current-option pairs. Their feedback is retained and evaluated but cannot enter fitting. Validation reports a directional match count and ties. A handful of held-out comparisons cannot certify taste generalization; whole-group exclusion also does not imply that shirt/tie types never overlap with training. The pilot is a limited starting experiment, not a statistically powered wardrobe-wide preference study.

## Features and fitting

The twelve coordinates, each bounded to [0,1], are:

1. Tie visual prominence from pattern contrast and recorded saturation.
2. Competing focal elements from the second-largest outfit prominence.
3. Mean clothing palette saturation.
4. Overall layer value distance.
5. Readability of a recognized pale-tonal/lighter-tie structure.
6. Open-collar configuration.
7. Existing whole-palette coherence.
8. Shirt depth.
9. Tie pattern contrast.
10. Contextual shoe formality.
11. Shoe/trouser grounding.
12. Shoe decoration/conspicuousness.

There are no garment-ID, brand, price or color-quota bonuses in the learner. The original source-based exclusion gates still precede it.

For each informative A/B pair, form d = features(A) - features(B). Fit pairwise logistic loss with mean sample loss plus L2 regularization lambda=.20, using 240 deterministic gradient steps at learning rate .6. An A vote sets y=1; B sets y=0. This is an implemented mathematical model fitted to explicit comparisons, not an arbitrary declaration that those comparisons improved the results.

An overlay remains inactive until at least eight informative unique A/B choices span three training topwear groups. These are conservative product thresholds selected for this experiment, **not proof that eight choices are sufficient**. Equal feature vectors cannot contribute an informative choice.

The fit is capped by a smooth adjustment:

`adjustment = 0.35 * tanh(dot(weights, outfit_features))`

The final displayed learned preference is the baseline research estimate plus that adjustment, clipped to its original scale. The original compatibility assessment, baseline research estimate, feature vector, model revision/counts and exact adjustment remain available in Score Details. No weight or vote is written into the historical pair-score files. A cold or paused model contributes exactly zero.

Accessory selection incorporates the same contextual learned feature contribution, so footwear comparisons are not ignored while a shoe is chosen before the final score. The tie-first complete-candidate coverage remains intact. An analytical upper bound uses the known clothing features and unit-bounded possible shoe features. This improves search efficiency without dropping a candidate capable of beating that bound. Unit tests check the bound against every registered shoe on each pilot clothing selection.

## Whole-list curation

The existing 20-option target, once-per-unanchored-tie, twice-per-other-item, exact-anchor exceptions and No Tie maximum two are unchanged. No compulsory hue, shirt depth or No Tie quota is introduced.

When active, learned semantic similarity contributes to the existing curation term: 75% old redundancy plus 25% of a bounded .20 feature-similarity penalty. It is applied only inside the existing .25 preference-quality band. The similarity calculation is weighted by absolute learned coefficients, not physical ID merging. Cold/paused curation returns the original result exactly. This is a disclosed implementation hypothesis; taste improvement must be checked using real held-out owner decisions.

## Generation and preservation

A request binds its current source revision and fitted-model ID. Application generation reads valid, current history and preferences before computing; both revision tokens are checked before publication and again after asynchronous garment rendering. If preferences change in another tab during generation, the stale result is refused. If they change after the new image is rendered, the preceding native frame is restored. Cached results cannot be selected against a different model/source. A saved vote invalidates previous recommendations but does not alter the current session's wear records or create a Favorite.

The local learned layer is used only by the Research-based wardrobe generator. Curated references, the old heuristic and the paused private visual service keep their separately labelled behavior. No preference votes or learned model are sent to the private provider.
