# HEWRS 1.24.0 — approved style and occasion changes

This is a source update for the existing app, not a replacement wardrobe or live deployment.

Watches no longer contribute to style classification. Their complementary matching, exact locks and IDs remain. Classic/Hybrid/Modern thresholds and source garment flags are unchanged. A classic base with one/two qualifying clothing or footwear interventions remains Hybrid; three or more or the existing nonclassic-foundation route remains Modern.

Explicit Modern has no separate No Tie count cap and no sneaker-category quota. No Tie is not required. Ties locked by the owner stay locked. Each unanchored physical sneaker pair is limited to two like any other shoe. Auto/Classic/Hybrid retain No Tie cap two unless No Tie is explicitly selected. No wardrobe identity or frozen score is changed. Full clothing uniqueness is required; watches/shoes cannot pad a list with the same clothing.

Modern sneaker scoring uses context instead of the old blanket 6.2 formality starting value. Documented shoe construction and bulk can affect suitability; unknown geometry is not invented. No white-sneaker-only, price or brand bonus is installed. Exact selections, source restrictions and weather still apply.

Occasions are Work / Dinner / Weekend. Work normalizes clinic/hospital/office aliases. Dinner and Weekend use explicit declared Research preference profiles, not copied Work scores under a different label. Independent tie/formality controls remain. Other explicitly selected automatic stylist methods do not silently switch to Research: they disclose that new occasions require Research. Existing exact tied-suit selection supports Dinner/Weekend. Connected wardrobe scope remains 18 suits,14 blazers,50 suit shirts,18 non-suit shirts,35 shoes. Automatic shirt-only ranking, catalogue-only jeans/T-shirts and other shoes are not newly connected.

Raw saved feedback/wear/Favorites are not rewritten or seeded. Learning is fitted only from the same normalized occasion. Old Work labels still read. Existing S02 exclusion and held-out boundaries remain. Local state can retain Dinner/Weekend sessions. Code rollback does not reverse browser data; older app versions cannot interpret new Dinner/Weekend records. Keep backups and do not clear browser data.

New classification reasons and the Automatic — all styles label are visible. Side-by-side cards, all174 active thumbnails, shoe15 correction, exact-source image pixels, native996x2748 geometry, swipe/arrow wrapping, exports and weather are retained. Build is now source-generated coherently, replacing the previous swipe copy package's source/bundle and inherited manifest inconsistencies.

## Newly completed verification

19 source-level test groups (15 unit plus4 extra),67 offline Chromium assertions including9 identical native before/after frames. Twelve new occasion/style engine cases,6 Modern lock cases,2 labelled cap variants,4 before Work cases and8 expected before Dinner/Weekend request rejections completed. Independent list checks passed for all24 positive engine-list cases. All2350 original shirt/tie lookup responses and181 unique new whole-clothing score/components matched the prior engine. 19,200 classifier-unit permutations and408 actual catalogue watch permutations were watch-invariant. 1,068 existing asset/assembly/data/UI payloads remain byte-identical.

Current unrestricted Work outputs: Auto20,Classic20,Hybrid20,Modern8. All15 old watch-only Hybrid examples now classify Classic. Hybrid's old15 watch-only qualifiers become0; its new20 include13 sneaker-led,4 relaxed-tailoring,2 open-collar and1 lustrous-shirt example. Modern remains8 but has6 open-collar and6 sneaker options versus2 and4 before. A dress-shoe lock yields2; an exact tie yields2; an S05-only lock yields1. No padding or relaxed physical-item limits are used.

No physical Safari, real phone feedback/weather/history, live deployed assets, exhaustive every-lock/temperature matrix or direct rejection fix is claimed. Test results are engineering checks, not a new visual approval of each garment.

## Verification

`python -B tools/verify_v1240.py` verifies the complete source tree against the new manifest and regenerated bundle/SRI relationships. `--runtime-only` checks deployment-required dependency/image/source hashes without requiring historical evidence folders. `--strict-extras` is for an exact source tree; normal updates preserve unrelated user files.
