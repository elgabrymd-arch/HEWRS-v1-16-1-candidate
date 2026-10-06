/* Owner option-list limits, V1.21.0. This module changes list composition only.
 * No aesthetic scores, inventory IDs, history data or weather rules are changed.
 * Exact item locks exempt only that item; choosing a colour family is not a lock.
 * No Tie and no-jacket shirt-only are distinct modes with independent defaults.
 */
(function(root){'use strict';
const TARGET=20,MAX_TIE=1,MAX_OTHER=2;
const itemLimit=id=>/^T\d{3}$/.test(String(id))?MAX_TIE:MAX_OTHER;
const ROLES=['topwear','shirt','tie','pants','shoes','watch'];
const need=(x,m)=>{if(!x)throw Error(m);};
function prefs(q){if(q?.prefs)return q.prefs;return {topwear:q?.topwear||{mode:'any'},shirt:q?.shirt||{mode:'any'},tie:q?.tie||{mode:'any'},bottoms:q?.pants||{mode:'any'},shoes:q?.shoes||{mode:'any'},watch:q?.watch||{mode:'any'}};}
function exactLocks(q){const p=prefs(q),ids=[];for(const role of ROLES){const v=p[role==='pants'?'bottoms':role];if(v?.mode!=='item')continue;let id=v.id;if(role==='shirt'&&!id.startsWith('shirt-'))id='shirt-'+id;if(role==='pants'&&!id.startsWith('pants-'))id='pants-'+id;ids.push(id);}return ids;}
function clothingKey(c){const i=c.items;return ['topwear','shirt','tie','pants'].map(k=>i[k]?.id||'NONE').join('|');}
function fullKey(c){return ROLES.map(k=>c.items[k]?.id||'NONE').join('|');}
function create(q){const p=prefs(q),exempt=new Set(exactLocks(q)),counts=new Map(),seen=new Set(),clothing=new Set();let noTie=0,shirtOnly=0,total=0;
 const noTieExplicit=p.tie?.mode==='none',noTieLimit=root.HEWRSStyleOccasions.noTieCap(q),shirtOnlyExplicit=p.topwear?.mode==='item'&&p.topwear.id==='ui:shirt-only';
 function canUse(id){return id==null||exempt.has(id)||(counts.get(id)||0)<itemLimit(id);}
 function issue(c){need(c?.items,'Missing physical option items');if(total>=TARGET)return 'OPTION_LIST_LIMIT';const i=c.items;need(i.shirt?.id&&i.shoes?.id,'Incomplete physical option');if(seen.has(fullKey(c)))return 'DUPLICATE_COMPLETE_OUTFIT';if(clothing.has(clothingKey(c)))return 'DUPLICATE_CLOTHING_CONFIGURATION';if(!i.tie&&noTieLimit!==null&&noTie>=noTieLimit)return 'NO_TIE_OPTION_CAP';if(!i.topwear&&!shirtOnlyExplicit&&shirtOnly>=2)return 'SHIRT_ONLY_OPTION_CAP';for(const role of ROLES)if(i[role]?.id&&!canUse(i[role].id))return 'ITEM_CAP:'+i[role].id;return null;}
 function add(c){const why=issue(c);need(!why,'Option list violates '+why);seen.add(fullKey(c));clothing.add(clothingKey(c));for(const role of ROLES){const id=c.items[role]?.id;if(id)counts.set(id,(counts.get(id)||0)+1);}if(!c.items.tie)noTie++;if(!c.items.topwear)shirtOnly++;total++;}
 function snapshot(){return {schema:'hewrs.option-set-policy.v1_24_0',target_options:TARGET,max_per_unanchored_item:MAX_OTHER,max_per_unanchored_tie:MAX_TIE,no_tie_default_max:noTieLimit,no_tie_limit_basis:q?.executiveStyle==='MODERN'?'owner_approved_modern_no_category_cap':noTieExplicit?'explicit_no_tie_selection':'default_two',shirt_only_default_max:2,exact_anchor_exemptions:[...exempt],no_tie_explicitly_selected:noTieExplicit,shirt_only_explicitly_selected:shirtOnlyExplicit,no_tie_options:noTie,shirt_only_options:shirtOnly,returned_options:total,item_counts:Object.fromEntries(counts),all_unanchored_items_within_limit:[...counts].every(([id,n])=>exempt.has(id)||n<=itemLimit(id)),scoring_adjustment:0,distinct_clothing_configurations:clothing.size};}
 return Object.freeze({canUse,issue,add,snapshot,canAddNoTie:()=>noTieLimit===null||noTie<noTieLimit,canAddShirtOnly:()=>shirtOnlyExplicit||shirtOnly<2});
}
function inspect(options,q){need(Array.isArray(options)&&options.length<=TARGET,'Invalid option-list length');const s=create(q);for(const o of options)s.add(o);return s.snapshot();}
function limitLegacy(result,q){if(!Array.isArray(result?.options))return result;const s=create(q),options=[];for(const o of result.options){if(!s.issue(o)){s.add(o);options.push(o);}}return {...result,options,requested_options:TARGET,returned_options:options.length,option_policy:s.snapshot(),reason:options.length<result.options.length?'The current results are limited by the one-use tie, two-use other-item and applicable No Tie rules. Exact item anchors exempt only the locked item; no score or constraint was changed.':result.reason};}
root.HEWRSOptionSetPolicy=Object.freeze({create,inspect,exactLocks,clothingKey,fullKey,limitLegacy,target:TARGET,itemLimit});
})(globalThis);
