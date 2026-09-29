# V1.20.0 — research-informed local wardrobe generator

## Why this is a new method
V1.19.0's curated mode searches a small finite library. It cannot meet the owner's broad 15-options-per-suit request by itself. This release adds a distinct broad-pool local generator. Curated references, the old heuristic and the disconnected private visual service remain explicitly selectable. No reference filler is labelled AI or silently inserted into Curated mode.

This is not the same reasoning process as the assistant selecting outfits interactively. It is not a newly trained preference model and does not call a visual provider. Web research supports qualitative relationships; the ordinal values, family-direction tables and weights below are engineering/styling judgments for this implementation. Neither a passing test nor a computed decimal proves personal taste satisfaction.

## Source-to-rule record

### CT — Charles Tyrwhitt
The Art of the Shirt and Tie Combo

Source: https://www.charlestyrwhitt.com/ca/en_CA/editorial-style-tips/how-to-match-a-tie.html

Supported: Choose a focal garment; consider tonal, adjacent and complementary palettes; usually deeper ties with lighter shirts; vary pattern scale and assess visible weave texture. It explicitly pairs lilac with purple/deep-pink paisley.

Boundary: Its lighter-tie advice is written as an absolute. This implementation treats it as a workwear preference, not a universal prohibition. No numerical coefficients are supplied by the source.

### BOSS — HUGO BOSS
How to combine your suit and shoe colors

Source: https://www.hugoboss.com/us/boss-men-matching-suits-with-shoes/

Supported: Choose footwear according to dress level, suit/trouser colour and depth. Navy can use black, navy or cognac. Grey can use black or brown of appropriate depth. Very dark brown/deep red can be used with black; light blue can use black or navy.

Boundary: Supports contextual choice, not a cognac ban or black-only rule. Does not rank the owner's specific shoes or supply price/brand bonuses.

### KAM — Kamiceria
Suit, shirt and tie combinations

Source: https://www.kamiceria.com/us/tips/suit-shirt-and-tie-combinations

Supported: Examples include navy with white/sky-blue and burgundy/blue/brown ties, and brown with beige/white and a different-depth brown tie; pattern sizes should differ.

Boundary: Other portions are restrictive about mixed geometric patterns and give skin-tone generalizations. Those are not adopted as hard bans or demographic rules. No source-provided numerical scales.

### BOGGI — Boggi Milano Egypt / regional retail site
Ties and Bow Ties — styling FAQ

Source: https://eg.boggi.com/en/men-accessories/ties-and-bow-ties

Supported: Tie should be readable against the shirt; a deeper tie is its general formal guideline. Gives navy/charcoal/mid-grey/brown tie directions and distinguishes plain, stripe, micro-pattern and knit styles.

Boundary: Its warning against navy disappearing into navy is not an unconditional navy-on-navy ban; compare CT's tonal approach. The module uses bounded readability guidance, not this source as a universal authority.

### CJ — Crockett & Jones
Richmond 2 Black & Ocean Suede

Source: https://www.crockettandjones.com/products/richmond-2-black-ocean-suede

Supported: Maker describes this specific suede loafer with black, grey or navy tailoring and even dinner wear. This disproves a blanket statement that suede can never accompany tailoring.

Boundary: Product-specific example, not a rule that every suede shoe is formal or that the user owns this shoe. No product was added to the wardrobe.

### JEREM — Jerem
Men's mix and match suits

Source: https://jerem.com/en/collections/mix-and-match-suits

Supported: Odd jacket/trousers should look deliberately coordinated rather than almost matching accidentally; examples include navy with grey/beige. Keep fabric-weight compatibility in view.

Boundary: Calendar tags alone do not establish fibre weight; the earlier seasonal-veto defect is not restored. Its strict colour-count language is not adopted literally for small pattern accents.

## Research disagreements deliberately preserved
Charles Tyrwhitt allows tonal approaches while Boggi warns against a navy tie disappearing into navy. Both can be reconciled by checking shirt/tie readability, not banning a colour pair. BOSS allows cognac with navy and very dark brown or deep red with black; a universal black-only/cognac-prohibition rule would misstate that guide. Crockett & Jones gives a specific suede/tailoring example, not permission to call every suede or driving shoe formal. Kamiceria's more restrictive pattern and skin-tone guidance is not adopted as a demographic or categorical exclusion. No fibre or seasonal weight is invented from a catalogue colour.

## Wardrobe facts versus interpretation
The original 136 features, all source descriptions and original scoring/index remain unchanged. The new module uses a separate 160-profile interpretation (including trousers), inherited from the prior full-palette interpreter plus narrowly stated phrase/pattern handling. Lavender depths, cream/ivory, beige/greige, taupe/chestnut/chocolate, compound checks and subtle weaves remain distinguishable. These are ordinal text interpretations, not photographic colour measurements. No garment source pixels are edited.

## Complete-clothing estimate
All source-eligible combinations matching the request are evaluated. Original source holds and hard rejects are not erased; no finite score is guessed for an unresolved source. The same applicable style/weather/geometry support and exact request locks apply. Clothing components and weights are:

| Component | Weight |
|---|---:|
| Similarity to the property relationships in preferred example sets | 10.0% |
| Jacket/shirt palette direction | 15.3% |
| Shirt/tie palette direction | 16.2% |
| Shirt/tie/value hierarchy | 16.2% |
| Whole palette/recorded accent links | 7.2% |
| Pattern scale, prominence and focal hierarchy | 19.8% |
| Formality coherence | 3.6% |
| Surface relationship | 2.7% |
| Odd jacket/trouser foundation (neutral baseline for matching suit) | 7.2% |
| Unchanged original compatibility estimate | 1.8% |

The property prior uses only the earlier free-reference and S10-reference sets and excludes source-held records. It compares colour family/shade, ordinal depth, quiet/visible pattern and pattern scale. It never compares exact garment IDs to grant a bonus. The fact that the owner preferred a set is not converted into individual approval labels. It is a modest explicit preference prior, not learned or empirically fitted taste.

A darker tie is rewarded directionally, not unlimited contrast. Reverse-value ties and busy combinations remain possible where explicitly locked and source-eligible; they are not silently replaced. Palette tables do not establish every named colour pairing is equally appropriate. They leave brown, lavender, beige and other requested families active without compulsory list slots.

## Footwear and final estimate
Footwear is assessed for dress subtype, trouser shade/depth, known surface and conspicuous decoration. Tied suits prefer dress footwear; open collars/odd jackets can make loafers/suede stronger. Very light footwear with very dark trousers is treated more cautiously; dark brown with black is not prohibited. A lug sole or multiple conspicuous motifs can reduce workwear fit, without deleting the item. The data's subtype and colour description—not a price or brand field—drive this term. Original weather suitability still precedes this preference.

Final estimate: 87% clothing + 10% shoe + 3% contextual watch. The watch remains name/record based, not an imagined visual assessment. Source scores remain separate in Score Details. The displayed local-rule estimate uses one decimal to avoid implying fine measured precision; internal arithmetic remains deterministic.

## Whole-list selection and rotation
All exact owner caps remain hard constraints: maximum two uses per unanchored physical item, exact-item exemptions only, No Tie at most two unless explicitly selected, no clothing duplicate/accessory-only padding. Visual-similarity curation chooses within a 0.25 local-fit band, not a bonus to original compatibility. There is no forced lavender, white, brown, dark-shirt, topwear-single-use or No Tie quota. The broad candidate pool expands when shortlist caps prevent filling 15; genuine restrictions can still return fewer with reasons.

Current confirmed history remains separate from numerical styling. The existing read-validity/revision guard stays in place. No user wear/Favorites records are created, migrated or cleared by this update. A stale or corrupt history must not be treated as an empty history.

## Default and compatibility
New method: Research-based wardrobe generator — local (up to 15). Mode preference uses `hewrs:stylist-mode:v2`; v1 remains untouched for rollback. An old Curated/heuristic setting is visibly explained as upgraded to this broad generator; existing v2 choices are respected. An explicitly saved old Visual mode is retained without connecting or paying for service. Curated mode still means finite references, never automatic heuristic filler. The V1.18 heuristic code path and its result objects remain available for comparison.

## What this does not establish
Research is not exhaustive across every designer and does not establish a universal matching law. No automatic aesthetic score can certify that every user will like every rendered result. The renderer faithfully uses the existing files and can expose inherited source-resolution/appearance limitations. This release's five audit passes distinguish executable correctness, output coverage, source preservation, research reasoning and subjective visual inspection. Live website bytes, actual phone acceptance and private provider use are not claimed unless specifically tested.
