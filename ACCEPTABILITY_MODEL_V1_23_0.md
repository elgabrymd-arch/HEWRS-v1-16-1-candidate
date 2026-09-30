# V1.23.0 — separate local acceptability and relative ranking

## Scope
This feature uses the same owned wardrobe, source revision, 12 semantic features,
original scores, weather constraints, and 20/1/2 option policy. It does not install
a visual-AI provider, infer reasons, or treat a single wardrobe item as liked or
disliked. The estimate is about complete outfits in the recorded work context.

## Meaning of responses
- Prefer A / Prefer B: relative ranking evidence only. A winner is not thereby
  acceptable and the other outfit is not thereby rejected.
- Both work: positive acceptability observations for both complete outfits. This
  does not assert a tie in relative utility or a preference for one over the other.
- Neither works: negative acceptability observations for both complete outfits.
  This does not identify which garment caused the objection or ban that garment.
- Skip, viewing, Favorites and wear: no training labels.

The existing `hewrs:outfit-preferences:v1` namespace and JSON schema are unchanged.
Refitting reads old responses without rewriting, relabelling or duplicating them.
There are no owner responses or trained owner coefficients in the update package.

## Independent estimators and activation guards
The existing pairwise logistic fit is unchanged: 240 iterations, step .6, L2 .20,
12 differences in semantic feature values. Its guard stays at 8 informative A/B
training comparisons spanning at least 3 training topwear groups. Both/Neither
responses do not count toward that guard.

The new acceptability fit uses only explicit training Both/Neither responses.
Repeated observations of the SAME complete physical-ID selection and context are
counted once. Conflicting positive/negative labels for the same selection/context
are excluded from this fit, reported, and retained unaltered in the feedback store.
Distinct physical IDs are not merged because their images or features are similar.

Acceptability activation requires at least 8 distinct labelled outfits, at least
3 positive and 3 negative, at least 3 training topwear groups, and at least 2 groups
in each label class. These are experimental evidence-volume guards, not validated
sample-size requirements or a promise of personalization quality. One-class data
cannot activate it. The original enabled/paused preference governs both channels.

The new logistic fit centers the 12 existing features at .5, fits an intercept,
uses L2 .25, 240 iterations and step .6. Each label class has equal total loss
weight; the pilot's acceptance fraction is not a population prevalence estimate.
All constants were fixed as generic shrinkage/guard choices, not optimized on the
owner's reserved responses. The model is small and deliberately conservative.

## Applied adjustment and safe candidate bounds
If activated, the relative channel contributes .35*tanh(w dot x), as before.
The acceptability channel contributes .20*tanh(b + v dot (x-.5)).
The combined contribution is clipped to [-.35,.35]. Acceptance alone therefore
cannot move the local preference score by more than .20. Original historical
compatibility is unchanged and shown separately. No hard eligibility filter is
added on the basis of a predicted negative acceptance signal.

Per-clothing search bounds maximize remaining shoe features analytically: positive
parts for the relative vector in [0,1], and half the absolute acceptance coefficient
for its centered vector in [-.5,.5]. The maxima are transformed monotonically and
combined with the same final clip. This is conservative, not shortlist truncation.
When active, the existing similarity stage uses magnitudes from active channels;
it remains inside the existing quality band and does not add compatibility bonuses.

Score metadata identifies each active channel, each contribution, and the baseline.
The label does not call A/B ranking active when only acceptability is active.
Curated references and the private visual service are not replaced or activated.

## Reserved evaluation and its limits
S12, S16, B09 and B13 remain reserved from fitting, even if a direct caller incorrectly
tags them as training. Original validation and new follow-up validation responses
are never used to fit either channel. S02 stays excluded from appearance learning
because the already-disclosed source/render mismatch is not corrected by this feature.

Relative held-out sign prediction is reported as before. Explicit held-out
Both/Neither observations are deduplicated and checked separately: logit magnitude
below .10 is labelled uncertain, otherwise the sign is compared with the label.
These logits are NOT calibrated probabilities. Report matches, mismatches and
uncertainties together. The already-reviewed reserved set is a diagnostic, not a
new blind independent validation. General taste improvement is not established by
activation, by passing software tests or by using more responses.

## Targeted comparisons
`data/preference-followup.json` supplies 12 NEW unlabelled pairs: 6 change only the
shirt, and 6 compare more than one clothing component, including two cross-topwear
pairs. Eight train and four use the same reserved groups. None duplicates an original
pilot pair. These comparisons supplement, not replace, the existing 24 responses.
All 24 proposed selections have been checked against current source eligibility.
No old source hold was relaxed to create a new comparison.

## Data, UI and performance
The existing persistent-store revision tokens, import preview/merge, undo, pause,
corrupt-byte retention and generation freshness guards remain. Old exports remain
readable. New comparisons use existing supported row fields; no new storage key or
migration is introduced. Nothing uploads the owner's feedback to GitHub or a provider.
The startup still uses three deferred scripts; the large engine index remains lazy.
The added feedback bank loads as a small part of the existing ordered UI bundle.
