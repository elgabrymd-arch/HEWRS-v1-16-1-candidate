# HEWRS V1.21.0 — twenty options, one use per unanchored tie

## Owner instruction
The owner approved the proposed twenty-option / unique-tie change on 2026-09-29 at 01:24:11 UTC. This does not authorize new inventory, changing source grades, automatic paid API calls, or writing the public repository. Exact physical-item ownership remains unchanged.

## List policy
The target is 20 complete, distinct clothing configurations. Each unanchored T001–T047 can occur once across the WHOLE returned list, not once per page. Other unanchored physical items remain limited to twice. Only an exact item anchor exempts that item. A suit anchor does not exempt its shirt/tie/shoes; family locks never create an exemption. No Tie remains at most two unless explicitly chosen. Explicit No Tie does not exempt shirts or accessories. No-jacket shirt-only remains separately guarded. No duplicate clothing with only a different accessory is used to fill the list.

The policy is shared by the Research-based generator, retained heuristic and finite Curated results. No new live service was enabled. A method with fewer eligible possibilities returns its actual count, not fabricated or mislabeled filler. The new target does not override source conflicts, hard rejects, supported assets, weather, formality or manual locks.

## Corrected tie interpretation and preference
This release corrects a local preference layer, NOT original wardrobe facts or frozen compatibility.

1. Recorded numerical pattern-scale and contrast qualifiers, when present in source strings, take precedence over lossy substring matching. For example, `MEDIUM-LARGE (2.67)` is no longer interpreted merely as generic `large`. Quietness describes contrast; it does not remove a pattern family or compound layer.
2. Dominant silver/pearl wording is distinguished from generic mid-grey. This remains an ordinal interpretation, not a measured color. No ID-specific recoding, recoloring or palette quota is used.
3. Tie-family direction is based on the tie's relationship to BOTH shirt and jacket. The old table favoring navy/burgundy/brown is replaced, not supplemented with per-ID bonuses.
4. Readability recognizes several valid constructions: a deeper focal tie; a pale-tonal tie with recorded pattern/texture/hue separation; and a lighter tie supported by its shirt/jacket frame. Genuine low separation and competing patterns still reduce the local estimate. A dark tie is not obligatory.
5. The prior from the previously preferred examples no longer compares tie hue/shade. Tie structure compares pattern quietness and scale. Its total weight falls from10% to4%, because those references were concentrated in darker ties. No individual owner approval or learned personal model is invented.

### New complete-clothing weights
| Component | Weight |
|---|---:|
| Structural resemblance to prior example sets | 4.0% |
| Jacket/shirt palette direction | 15.3% |
| Shirt/tie/jacket palette direction | 18.0% |
| Value/readability structure | 18.0% |
| Whole palette and recorded accent links | 9.6% |
| Pattern scale, prominence and focal hierarchy | 19.8% |
| Formality coherence | 3.6% |
| Surface relationship | 2.7% |
| Blazer/trouser foundation | 7.2% |
| Unchanged original compatibility estimate | 1.8% |

Weights total100%. Final complete preference remains87% clothing,10% shoes and3% contextual watch. Footwear logic, original source-gate behavior and weather rules are unchanged. These coefficients are engineering/styling choices, not designer ratings, photographic measurements or an empirical taste fit. Original compatibility is separately retained and disclosed.

## Candidate access before list curation
Every source-eligible matched clothing configuration is evaluated. Before constructing the list, the research method groups those configurations by each eligible exact tie ID and No Tie. It resolves complete outfits using actual eligible shoe/watch choices and retains the strongest found complete leaders for every matched tie. Conservative score upper bounds avoid resolving every accessory product. Existing cross-shirt/topwear/trouser coverage and full-pool expansion remain.

This is CANDIDATE coverage, not a requirement to select each tie or normalize its score to its own best. No tie is forced into an unsuitable outfit or given a reserved final slot. Each generation report includes `diagnostics.tie_coverage`: matching/source-eligible counts, holds, complete assessments, a best found configuration, selected count and disposition. The audit does not claim mathematical global optimality or exhaustive enumeration of all accessory combinations. At a full list, a final constraint such as OPTION_LIST_LIMIT is not proof the tie could never appear under different conditions.

The current0.25 visual-curation band and original0.20 confirmed-wear near-equivalence policy remain. They do not write wear records or add diversity to original compatibility scores. Corrupt/stale-history cancellation and original source/identity rules remain intact.

## Research basis and limits
The previous source-to-rule record is retained in RESEARCH_RULES_V1_20_0.md and data/styling-research.json. This correction does not treat "usually a darker tie" as an absolute exclusion of pale-tonal looks. John Henric's primary product styling examples describe light-blue and silver silk ties with white shirts and navy tailoring for work as well as events:
- https://johnhenric.com/gb/light-blue-skinny-tie-plain-a01718
- https://johnhenric.com/us/silver-tie-plain-a00192

These are qualitative examples, not proof of scores or additions to the owner's inventory. A favorable example for one light tie does not establish that all pale ties work with all shirts. The numerical model remains explicitly a local heuristic, not the assistant's full visual reasoning or live AI.

## Important source-capacity example
B14 returns16 in the neutral unanchored-accessory fixture. Its original scored candidate pool has eight independently identified physical trousers; at two uses per unanchored trouser the arithmetic ceiling is16. The unchanged V1.20 model with only its target increased to20 also returns16. The new summary explains that limit instead of silently repeating trousers, substituting an unscored profile, or treating an asset approval as a new score. Twenty is the target, not a mandate to violate preserved constraints.
