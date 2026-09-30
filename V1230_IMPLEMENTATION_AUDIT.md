# HEWRS V1.23.0 — separate acceptability learning and targeted comparisons

## Implemented result
The original local A/B learner now coexists with a separate Both work / Neither
works acceptability learner. Existing saved responses are reused in their original
schema; no original answers, reasons or partitions are rewritten. A/B ranking is
not falsely activated by counting Both/Neither as directional votes.

The same wardrobe, exact physical IDs, approved image layers, source corrections,
original score sources, twenty-option target, unique unanchored ties, twice-per-other-
item caps, exact-anchor exceptions, weather and current-history guards remain.
This release does not enable the paused private visual-AI service.

## Evidence semantics
Prefer A/B supplies relative evidence only: winning is not a declaration of
absolute acceptability, and losing is not a dislike. Both work supplies positive
observations for the two complete outfits; Neither supplies negative observations.
Neither assigns a reason, labels an individual garment, or creates a color/brand ban.
Skips, views, Favorites and wear supply no model labels. Reasons remain stored
without fabricated numeric weighting.

The original directional algorithm and 8-informative/3-training-group guard are
unchanged. Acceptability has its own declared experimental guard: 8 distinct
labelled complete outfits, at least 3 per class, 3 groups overall, and 2 groups per
class. It fits only training Both/Neither data. Repeated identical full selections
and context count once; contradictory absolute labels are retained as records but
excluded from that fit. One-class data does not activate it.

Both estimators use the existing twelve semantic features, not new visual embeddings.
The new logistic head uses centered features, an intercept, balanced class loss and
L2 shrinkage. It contributes at most +/-0.20 to local preference; combined with the
original relative adjustment, the total remains bounded by +/-0.35. It does not
introduce hard exclusion of negatively predicted outfits. The UI and every option's
metadata distinguish the active channels and their separate contributions.
Exact formulas/guards: ACCEPTABILITY_MODEL_V1_23_0.md. Activation is not evidence
of improved taste. The small reserved diagnostic is not a calibration certificate.

## Existing and new comparisons
The original twenty-four pilot pairs and all storage fields remain. The new bank
adds twelve unlabelled pairs: six change only shirts and six compare complete looks,
including two different-topwear pairs. Eight are training and four use the original
reserved topwear groups. None duplicates an original pilot pair. All twenty-four
new selections validate against existing source eligibility; no hold was overridden.

S12/S16/B09/B13 remain reserved even if a direct caller incorrectly labels them
training. S02 remains excluded from appearance learning because its documented
source/render mismatch was not repaired in this update. Original reserved responses
are diagnostic only, never fit. They have already been inspected previously, so they
are not advertised as a newly blinded independent experiment. New reserved responses
will remain separate too.

The new comparison button appears above the original pilot. Both buttons show
separate progress. The actual two outfit images must load before voting. Existing
Collar Detail, pause/resume, export/import preview/merge, confirmed undo, revision
checking and corrupt-data protection remain. New pairs use the same response schema.
No individual owner answers or owner-fitted coefficients are shipped in this package.

## Three current verification passes

### 1. Source identity and modeling/data contracts
Exact V1.22.1 was reconstructed from mounted verified source and successive updates;
2,557 payload hashes plus its manifest matched before editing. Its manifest is
49bfd10c548a81cc546c143e171828d1e142a336b86f1c60e5418002cc53d272.
The known truncated V1.19 archive was not used. V1.22.0 was separately restored via
the existing exact rollback to support a cumulative installer. No original full-ZIP
container hash is falsely claimed for those reconstructed complete trees.

Thirty new functional checks pass: independent label semantics, old guard and
pairwise coefficient equality, class/group guards, deduplication/conflicts, source
exclusion, held-out protection, unsupported votes, original schema, import/undo/pause,
corrupt/stale stores, safe combined pruning bound, and all new pair identities.
Six preservation checks freshly compare 2,350 frozen pair lookups and all 112,392
original derived ensemble results: zero differences from the baseline. All 848
original garment images and protected ID/source/renderer/weather/history/Favorites
files are unchanged. Twenty-two automatic-weather, twenty-one transport and eight
fast-loader checks passed against controlled fixtures. **Named total: 87 passed,
zero failed.** Public labels/fixtures in tests and evidence are synthetic.

### 2. Generator, actual UI and image execution
The complete generator matrix covers FREE plus all 18 suits and 14 blazers, cold and
with a synthetic acceptance-active model: 66 cases, 1,312 returned outfit objects.
The 33 cold lists match V1.22.1 exactly. The 33 acceptance-active lists change from
cold, demonstrating execution—not proof of better taste. All cases return twenty
except the existing B14 sixteen-trouser-cap case. Five further exact/family/No Tie
requests, full source/cap validation and changed-model cache rejection pass.
The seven named matrix checks are reported separately, not added again to the 87.

**Twenty-six actual Chromium checks passed, zero failed.** They load the shipped
three-script startup bundle with injected deferred-index delivery, synthetic private
storage and real image bytes. Home is usable before images/index without a store
write. Tests cover new shirt and whole-look renders, original/new progress separation,
Both and Neither writes, no auto-vote/auto-advance, held-out separation, pause/resume,
actual export, undo, Skip, reload/refit from the same saved schema, corrupt feedback,
real Generate and twenty navigated S10 option cards. Generation/viewing/export do
not create preferences, wear or Favorites. A concurrent feedback change cancels the
obsolete result and preserves the previous outfit.

Thirty-two same-selection rendering controls (all suits/blazers) have identical
FNV-1a hashes of native RGBA, supported by byte-identical renderer and SHA-256-matched
original images. This is accurately described as a native-frame hash comparison,
not a cryptographic proof covering every possible outfit. Twenty new generated
positions were navigated; all match their independently generated Node selections.
Five viewports passed bounds checks: 320x568, 390x350, 390x780, 430x932, 1280x1000.
Desktop/phone screenshots were visually inspected. They show synthetic fixtures,
not the user's installed device or actual personal feedback.

### 3. Delivery, runtime and privacy
The ordered fast-start bundle is reproduced from its exact source list; three startup
script resources and the lazy index remain. Content hashes/SRI are rebuilt rather
than bypassed. Syntax/JSON checks, a protected-file diff, source SHA-256 inventory,
installation replay from both V1.22.0 and V1.22.1, and exact rollback are recorded
in delivery verification. ZIP CRC/size/container hashes are recorded externally to
avoid circular hashes. Actual user feedback replay was performed separately and
kept outside this public source/update tree. No response IDs or owner-fitted model
are seeded into the application.

## Actual-feedback versus synthetic evidence
The owner's uploaded file is read privately for compatibility/activation checking.
The separate private replay report records exact original hash, zero modifications,
head status, counts and mixed reserved diagnostic outcomes. It is not bundled into
this package or used as the public test fixture. No owner's responses are fabricated,
repartitioned, duplicated or imported automatically by the update. The actual browser
refits the feedback already in that browser. A server is not needed.

## Performance and evidence limits
Fast-start and current memoization changes are retained. The newly measured controlled
cold FREE run took about 18.2 seconds locally; learned runtime depends on the model
and candidate pruning. This release adds a second small fit/head and does not promise
instantaneous generation or improved latency. The large index is still first-Generate
work. Local Node timing excludes real phone/network behavior. No physical Safari,
GitHub-hosted bytes, permission longevity, real provider request or deployment was
certified. Unit/browser passes prove the tested behavior, not that the system now
understands all personal aesthetic judgments.

## Install and revert
Use the cumulative V1.22.0 OR V1.22.1 -> V1.23.0 package. Copy the CONTENTS of
FILES_TO_COPY into the same repository; keep unrelated files, .git and browser data.
Do not put preference exports or the private replay report into public GitHub.
The optional installer verifies exact supported source hashes into a NEW destination.
The copied update does not itself push, publish or access the owner's browser.

Commit: V1.23.0 — learn Both/Neither separately and add targeted comparisons

python -B tools/verify_v1230.py verifies the exact target and ordered bundle.
python -B tools/rollback_v1230.py --output NEW_FOLDER restores exact V1.22.1 into a
new folder and never touches browser data. Its original A/B-only behavior returns;
all saved response rows remain schema-compatible. Older UI does not display the new
follow-up bank. Pausing learning remains an immediate non-destructive alternative.

## Development attempts
A proposed new shirt contrast used a source-held DS016/T033 selection; that fixture
was rejected and replaced with an eligible DS017 selection before the final bank and
tests. No source score was invented to make the fixture work. Execution wrappers were
adapted to the available non-interactive runner; only completed final suites are
counted. A final metadata audit corrected inherited performance-only/unchanged-learning
status labels before packaging; it did not alter the tested executable bundle.
