# Complete-outfit preference model — V1.18.0

## Authority
This is the owner-authorized personal recommendation layer requested on 28 September
2026 after the independent S10 comparison and wardrobe-wide palette review. It is
implemented code, not a new trained vision model. The source wardrobe, historical
Shirt–Tie matrix, original compatibility formulas/index and original rejection
rules remain unchanged. The new result is a heuristic preference estimate, not a
measured aesthetic fact or a recovered/approved historical score.

## Separate interpretation of recorded descriptions
`src/outfit-preference.js` reads the actual canonical feature wording. Its derived
profiles are separate from `connection.features`. Mushroom beige/warm greige, beige,
cream, ivory, taupe, chestnut, chocolate and espresso retain different semantic
coordinates. Light, darker, and dark lavender are not conflated. The phrase
"windowpane over micro-check" is processed before generic "micro" quietness. Source
pattern, scale and contrast wording are retained. All numeric coordinates are
explicit ordinal defaults modified by source adjectives; they are not calibrated
photo/color measurements. Missing material/sole facts are not invented.

160 profiles are disclosed: 136 existing topwear/shirt/tie/pant-profile records,
plus 24 separate physical-trouser colour descriptions. Original imagery/IDs remain.
A shared colour asset does not merge physical garments. No ID-specific outfit
bonus, permanent light-shirt quota, brown ban, lavender quota or No Tie quota is used.

## Complete clothing judgment
All matching, source-eligible indexed clothing candidates are evaluated, not just
the old Top 15. Existing source holds and hard compatibility gates stay upstream.
The tied structure term evaluates readable shirt–tie focal depth and sufficient
jacket/shirt separation. It does not monotonically reward maximum suit–shirt
contrast. Muted warm/cool and tonal combinations remain allowed. Pattern hierarchy
compares visible family, scale, contrast and compound layers. No Tie has its own
structure calculation on the same quality scale, without a missing-tie penalty.

| Component | Weight |
|---|---:|
| Complete value/focal structure | 32% |
| Palette coherence and recorded accent relationships | 20% |
| Pattern hierarchy | 20% |
| Formality relationships | 6% |
| Surface relationships | 4% |
| Jacket/trouser foundation (neutral constant for a matching suit) | 8% |
| Unchanged original clothing compatibility estimate | 10% |

These weights are new disclosed preference-policy parameters. They do NOT replace
or rename the original 35/25/25/15 compatibility formula. Some structure/tonal
preferences remain subjective and need real-use feedback; this release is not
proof that the parameters reproduce the independent stylist's choices exactly.

## Accessories and complete preference
Original accessory eligibility checks remain. Eligible shoes are ranked by the
finished outfit's formality, trouser/topwear grounding, pattern prominence and
surface. No fixed clinic-loafer, brand, price or cognac-distinctiveness bonus is
added by the new layer. Warm light tailoring can still favor lighter brown shoes;
black and dark brown are not unconditional winners. Watches are assessed through
existing classification/metal information without a prestige/price bonus.

Complete preference = 90% clothing + 7.5% shoes + 2.5% watch preference. No-watch is
an intentional choice, not a physical garment. The main generated-option display
says "Personal styling fit · heuristic" and rounds to one decimal. Score Details
retains the unchanged original compatibility separately. Exact manual selections
and restored Favorites do not pretend to be a current personalized recommendation.

## Curation, constraints and rotation
Maximum two uses of each unanchored physical item is unchanged. Only an exact
anchor exempts that exact item; family filters do not exempt all family members.
Default No Tie <= 2; an explicit No Tie choice overrides that configuration cap.
The no-jacket cap remains separate; it does not manufacture a numerical model.
Accessory-only variants do not pad the set as new clothing combinations.

The working pool contains the strongest 512 clothing preferences plus the strongest
candidate for every topwear/shirt/mode, topwear/tie and topwear/physical-trouser key.
This is candidate coverage, not a color or output quota. When physical caps exhaust
that pool before the requested count, selection expands to the full source-eligible
set. Upper bounds avoid accessories work on candidates that cannot outrank the
current feasible choices. The algorithm is deterministic and bounded, not a proof
of a globally optimal 15-element combinatorial set.

List curation can prefer a less-repeated visual idea only within 0.20 of the best
currently feasible complete preference. Its maximum redundancy term is 0.18; it is
not added to original compatibility or reported as a new compatibility bonus.
No color, lightness, pattern or No Tie slot is compulsory. Clear anchors and genuine
eligibility restrictions can reduce the final count without silent relaxation.

The existing 0.20 confirmed-history near-equivalent rotation policy is applied to
the new complete preference for the recommendation; that basis is explicitly
recorded. Original compatibility is still present. Readable current history must
be validated before generation and its revision must stay current through result
presentation. If history becomes unreadable or changes, the stale result is stopped;
no empty-history premise is invented and no wear/Favorites data is reset.
