/* HEWRS reconstruction candidate, stage 2.
 * No browser storage, network, image mutation or automatic installation.
 * Candidate discovery != style approval != rendering != list inclusion.
 * Historical numeric scores never veto discovery. Real reviews are required
 * for recommendations; Stage 2 supplies explicitly attributed repository-image reviews.
 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.HEWRSRebuildCore=factory();})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const STYLES=['AUTO','CLASSIC','HYBRID','MODERN'],OCCASIONS=['work','weekend','dinner'];
const COPY=x=>JSON.parse(JSON.stringify(x)),assert=(x,m)=>{if(!x)throw new Error(m);};
const TAG='hewrs.rebuild.review-core.v2';
function clothingKey(o){return [o.topwear||'SHIRT_ONLY',o.pants||'SUIT_TROUSERS',o.shirt,o.tie||'NO_TIE'].join('|');}
function outfitKey(o){return clothingKey(o)+'|'+o.shoe;}
function validateRequest(q={}){
 assert(q&&typeof q==='object'&&!Array.isArray(q),'Request must be an object.');
 for(const k of Object.keys(q))assert(['style','occasion','formality','mode','anchors'].includes(k),'Unsupported request field: '+k);
 const anchors=q.anchors===undefined?{}:q.anchors;assert(anchors&&typeof anchors==='object'&&!Array.isArray(anchors),'Anchors must be an object.');
 const n={style:q.style===undefined?'AUTO':q.style,occasion:q.occasion===undefined?'work':q.occasion,formality:q.formality===undefined?'any':q.formality,mode:q.mode===undefined?'all':q.mode,anchors:COPY(anchors)};
 assert(STYLES.includes(n.style),'Unknown style; no AUTO fallback.');assert(OCCASIONS.includes(n.occasion),'Unknown occasion.');
 assert(['any','tie_required','suit_required','open_collar_allowed'].includes(n.formality),'Unknown formality.');
 assert(['all','suit','blazer','shirt_only'].includes(n.mode),'Unknown outfit mode.');
 for(const [k,v]of Object.entries(n.anchors)){assert(['topwear','pants','shirt','tie','shoe'].includes(k),'Unsupported anchor role: '+k);
  assert(typeof v==='string'&&v.length>0||v===null&&['topwear','tie'].includes(k),'Invalid anchor: '+k);}
 return n;
}
function create(input){
 const cat=COPY(input);assert(cat.schema==='hewrs.rebuild.catalogue.v1','Wrong catalogue schema.');
 assert(typeof cat.fingerprint==='string'&&/^[a-f0-9]{64}$/.test(cat.fingerprint),'Missing catalogue fingerprint.');
 const items=new Map(),groups={suit:[],blazer:[],shirt:[],tie:[],pants:[],shoe:[]};
 for(const r of cat.records){assert(r&&typeof r.id==='string'&&groups[r.category],'Malformed garment record.');assert(!items.has(r.id),'Duplicate canonical ID: '+r.id);items.set(r.id,r);if(r.active)groups[r.category].push(r);}
 for(const arr of Object.values(groups))arr.sort((a,b)=>a.id.localeCompare(b.id));
 assert(!items.has('DS049')||!items.get('DS049').active,'Retired DS049 must not be active.');
 const retired=new Set(cat.owner_directives?.retired_ids||['DS049']);
 const roleCategory={topwear:['suit','blazer'],shirt:['shirt'],tie:['tie'],pants:['pants'],shoe:['shoe']};
 function request(q={}){const n=validateRequest(q);
  for(const [role,id]of Object.entries(n.anchors)){if(id===null)continue;const item=items.get(id);
   assert(item&&item.active&&roleCategory[role].includes(item.category),'Unknown/inactive exact '+role+' anchor: '+id);}
  return n;
 }
 function selectionIssues(o,q,complete=true){
  const issues=[];
  if(!o||typeof o!=='object'||Array.isArray(o))return ['INVALID_SELECTION'];
  for(const k of Object.keys(o))if(!['topwear','pants','shirt','tie','shoe'].includes(k))issues.push('UNSUPPORTED_SELECTION_ROLE:'+k);
  const roles=complete?['topwear','pants','shirt','tie','shoe']:['topwear','pants','shirt','tie'];
  for(const role of roles){if(!Object.prototype.hasOwnProperty.call(o,role)){issues.push('MISSING_ROLE:'+role);continue;}
   const id=o[role];if(id===null&&['topwear','pants','tie'].includes(role))continue;
   const r=items.get(id);if(!r||!roleCategory[role].includes(r.category))issues.push('UNKNOWN_OR_WRONG_CATEGORY:'+role+':'+id);
   else if(!r.active||retired.has(id))issues.push('RETIRED_OR_INACTIVE:'+id);
  }
  if(issues.length)return issues;
  const top=o.topwear?items.get(o.topwear):null,shirt=items.get(o.shirt);
  if(top?.category==='suit'&&o.pants!==null)issues.push('SUIT_USES_ITS_OWN_TROUSERS');
  if(top?.category!=='suit'&&o.pants===null)issues.push('SEPARATE_TROUSERS_REQUIRED');
  if(o.tie!==null&&shirt.no_tie_only)issues.push('OWNER_NO_TIE_ONLY:'+o.shirt);
  if(q.mode!=='all'&&(q.mode==='shirt_only'?top!==null:top?.category!==q.mode))issues.push('REQUESTED_MODE_MISMATCH');
  for(const [role,id]of Object.entries(q.anchors))if((complete||role!=='shoe')&&o[role]!==id)issues.push('EXACT_ANCHOR_MISMATCH:'+role);
  if(q.formality==='tie_required'&&o.tie===null)issues.push('EXPLICIT_TIE_REQUIREMENT');
  if(q.formality==='suit_required'&&top?.category!=='suit')issues.push('EXPLICIT_SUIT_REQUIREMENT');
  return issues;
 }
 function* enumerateClothing(raw={}){
  const q=request(raw),a=q.anchors;
  const tops=Object.hasOwn(a,'topwear')?[a.topwear===null?null:items.get(a.topwear)]:[...groups.suit,...groups.blazer,null];
  const shirts=a.shirt?[items.get(a.shirt)]:groups.shirt;
  const ties=Object.hasOwn(a,'tie')?[a.tie===null?null:items.get(a.tie)]:[null,...groups.tie];
  const trousers=a.pants?[items.get(a.pants)]:groups.pants;
  for(const top of tops){
   if(q.mode!=='all'&&(q.mode==='shirt_only'?top!==null:top?.category!==q.mode))continue;
   if(q.formality==='suit_required'&&top?.category!=='suit')continue;
   if(top?.category==='suit'&&a.pants)continue;
   const ps=top?.category==='suit'?[null]:trousers;
   for(const p of ps)for(const sh of shirts)for(const ti of ties){
    if(ti&&sh.no_tie_only||!ti&&q.formality==='tie_required')continue;
    yield {topwear:top?.id||null,pants:p?.id||null,shirt:sh.id,tie:ti?.id||null};
   }
  }
 }
 function* enumerateFull(raw={}){const q=request(raw);const shoes=q.anchors.shoe?[items.get(q.anchors.shoe)]:groups.shoe;
  for(const o of enumerateClothing(q))for(const sh of shoes)yield {...o,shoe:sh.id};
 }
 function renderState(o){
  const mode=o.topwear?(items.get(o.topwear).category==='suit'?'suit':'blazer'):'shirt_only',issues=[];
  if(!items.get(o.shirt).rendering?.[mode])issues.push('SHIRT_'+mode.toUpperCase()+'_BINDING');
  for(const role of ['topwear','pants','tie','shoe'])if(o[role]&&!items.get(o[role]).rendering?.registered)issues.push(role.toUpperCase()+'_BINDING');
  return {status:issues.length?'binding_pending':'registered_bindings',issues,photos:'complete_by_owner_instruction',aesthetic_rejection:false,
   scope:'Connection registry only; not a new image-decode, compositor or device test.'};
 }
 function sourceEvidenceHashes(id){
  const result=new Set();
  function scan(v){if(typeof v==='string'){if(/^[a-f0-9]{64}$/.test(v))result.add(v);}else if(Array.isArray(v))v.forEach(scan);else if(v&&typeof v==='object')Object.values(v).forEach(scan);}
  const item=items.get(id);scan(item?.source);scan(item?.visual_dna?.evidence);return result;
 }
 function reviewProblems(review,o){
  if(!review)return ['WHOLE_OUTFIT_REVIEW_PENDING'];
  if(typeof review!=='object'||Array.isArray(review))return ['REVIEW_MALFORMED'];
  const issues=[];
  if(review.schema!=='hewrs.rebuild.outfit-review.v1')issues.push('REVIEW_SCHEMA_INVALID');
  if(review.catalogue_fingerprint!==cat.fingerprint)issues.push('STALE_REVIEW_CATALOGUE');
  if(review.outfit_key!==outfitKey(o))issues.push('REVIEW_OUTFIT_MISMATCH');
  if(!['approved','rejected','unresolved'].includes(review.outcome))issues.push('REVIEW_OUTCOME_INVALID');
  if(typeof review.reviewer!=='string'||!review.reviewer.trim()||typeof review.reason!=='string'||!review.reason.trim())issues.push('REVIEW_PROVENANCE_MISSING');
  if(!['photo_review','owner_outfit_approval','repository_image_review'].includes(review.evidence?.kind))issues.push('REVIEW_EVIDENCE_INVALID');
  if(review.evidence?.kind==='repository_image_review'){
   if(review.evidence?.original_photo_claim!==false||review.evidence?.review_scope!=='component_image_board_not_physical_fit')issues.push('IMAGE_REVIEW_SCOPE_MISSING');
   const imageRefs=review.evidence?.source_images;
   if(!Array.isArray(imageRefs)||!imageRefs.length)issues.push('IMAGE_REVIEW_ASSET_REFERENCES_MISSING');
   else {
    for(const x of imageRefs){
     if(!x||typeof x!=='object'||typeof x.repository_path!=='string'||!x.repository_path||!/^[a-f0-9]{64}$/.test(x.sha256||'')||!Object.values(o).includes(x.id))issues.push('IMAGE_REVIEW_ASSET_REFERENCE_MALFORMED');
     else if(!sourceEvidenceHashes(x.id).has(x.sha256))issues.push('IMAGE_REVIEW_ASSET_HASH_NOT_IN_SOURCE:'+x.id);
    }
    for(const id of Object.values(o).filter(Boolean))if(!imageRefs.some(x=>x&&x.id===id&&typeof x.repository_path==='string'&&/^[a-f0-9]{64}$/.test(x.sha256||'')))issues.push('IMAGE_REVIEW_ASSET_REFERENCE_MISSING:'+id);
    if(o.topwear&&items.get(o.topwear)?.category==='suit')for(const component of ['jacket','suit_trousers'])if(!imageRefs.some(x=>x&&x.id===o.topwear&&x.component===component))issues.push('IMAGE_REVIEW_SUIT_COMPONENT_MISSING:'+component);
   }
   if(typeof review.evidence?.board_sha256!=='string'||!/^[a-f0-9]{64}$/.test(review.evidence.board_sha256))issues.push('IMAGE_REVIEW_BOARD_HASH_MISSING');
  }
  const refs=review.evidence?.items;
  if(!Array.isArray(refs)||new Set((Array.isArray(refs)?refs:[]).map(x=>x?.id)).size!==(Array.isArray(refs)?refs:[]).length)issues.push('REVIEW_ITEM_REFERENCES_INVALID');
  for(const id of Object.values(o).filter(Boolean)){const ref=Array.isArray(refs)?refs.find(x=>x?.id===id):null;
   if(!ref||ref.source_fingerprint!==items.get(id).source_fingerprint)issues.push('REVIEW_ITEM_EVIDENCE_MISSING_OR_STALE:'+id);}
  for(const key of ['foundation','whole_outfit','footwear'])if(!['pass','fail','unresolved'].includes(review.components?.[key]))issues.push('REVIEW_COMPONENT_MISSING:'+key);
  if(review.outcome==='approved'&&['foundation','whole_outfit','footwear'].some(k=>review.components?.[k]!=='pass'))issues.push('APPROVAL_CANNOT_RESCUE_WEAK_OR_UNRESOLVED_COMPONENT');
  for(const k of STYLES.filter(x=>x!=='AUTO'))if(![true,false,null].includes(review.styles?.[k]))issues.push('REVIEW_STYLE_MISSING:'+k);
  for(const k of OCCASIONS)if(![true,false,null].includes(review.occasions?.[k]))issues.push('REVIEW_OCCASION_MISSING:'+k);
  if(typeof review.rank_score!=='number'||!Number.isFinite(review.rank_score)||review.rank_score<0||review.rank_score>100)issues.push('REVIEW_RANK_SCORE_INVALID');
  // This validates recorded evidence, not whether a reviewer was honest.
  return issues;
 }
 function assess(o,raw={},review=null,owner={}){
  const q=request(raw),hard=selectionIssues(o,q,true);
  if(hard.length)return {outfit:COPY(o),hard_constraints:{status:'excluded',reasons:hard},reviewable:false,recommendable:false,selection_score:null};
  assert(owner&&typeof owner==='object'&&!Array.isArray(owner),'Owner feedback must be an object.');
  for(const k of Object.keys(owner)){assert(['rejected_outfits','rejected_clothing'].includes(k),'Unsupported owner feedback field: '+k);assert(Array.isArray(owner[k])&&owner[k].every(x=>typeof x==='string'),'Owner rejections must be exact-key arrays.');}
  const key=outfitKey(o),clothing=clothingKey(o);
  const rejects=[...(owner.rejected_outfits||[]).includes(key)?['OWNER_REJECTED_EXACT_OUTFIT']:[],...(owner.rejected_clothing||[]).includes(clothing)?['OWNER_REJECTED_CLOTHING_CONFIGURATION']:[]];
  if(rejects.length)return {outfit:COPY(o),key,hard_constraints:{status:'excluded',reasons:rejects},reviewable:false,recommendable:false,selection_score:null};
  const render=renderState(o),pending=reviewProblems(review,o);
  const valid=pending.length===0,style=valid?(q.style==='AUTO'?true:review.styles[q.style]):null,occasion=valid?review.occasions[q.occasion]:null;
  const status=!valid?'awaiting_review':review.outcome==='rejected'?'aesthetic_rejection':review.outcome!=='approved'?'awaiting_review':occasion===false?'context_mismatch':occasion===null?'context_unassessed':style===false?'style_mismatch':style===null?'style_unassessed':'qualified';
  return {outfit:COPY(o),key,clothing_key:clothing,hard_constraints:{status:'pass',reasons:[]},reviewable:true,
   source_conflicts:Object.values(o).filter(Boolean).filter(id=>items.get(id).source_conflict),
   review:{status,validation_issues:pending,evidence:valid?review.evidence.kind:null,reason:valid?review.reason:null},
   requested_style:q.style,requested_occasion:q.occasion,style_matches:style,occasion_matches:occasion,rendering:render,
   recommendable:status==='qualified',avatar_ready:status==='qualified'&&render.status==='registered_bindings',
   selection_score:status==='qualified'?review.rank_score:null,legacy_score_used_as_veto:false};
 }
 function selectReviewed(entries,raw={},owner={}){
  assert(Array.isArray(entries),'Entries must be an array.');const q=request(raw),seen=new Set();
  const evaluated=entries.map(e=>{const k=outfitKey(e.outfit);assert(!seen.has(k),'Duplicate review candidate: '+k);seen.add(k);return assess(e.outfit,q,e.review,owner);});
  const qualified=evaluated.filter(e=>e.recommendable).sort((a,b)=>b.selection_score-a.selection_score||a.key.localeCompare(b.key));
  const selected=[],omitted=[],counts=new Map(),clothingSeen=new Set();let noTie=0,shirtOnly=0;
  const exempt=new Set(Object.values(q.anchors).filter(x=>typeof x==='string'));
  const noTieCap=q.style==='MODERN'||Object.hasOwn(q.anchors,'tie')&&q.anchors.tie===null?null:2;
  for(const e of qualified){let reason=null;const o=e.outfit;
   if(selected.length>=20)reason='OPTION_LIST_LIMIT';
   else if(clothingSeen.has(e.clothing_key))reason='DUPLICATE_CLOTHING_CONFIGURATION';
   else if(o.tie===null&&noTieCap!==null&&noTie>=noTieCap)reason='NO_TIE_OPTION_CAP';
   else if(o.topwear===null&&q.mode!=='shirt_only'&&!(Object.hasOwn(q.anchors,'topwear')&&q.anchors.topwear===null)&&shirtOnly>=2)reason='SHIRT_ONLY_OPTION_CAP';
   else for(const id of Object.values(o).filter(Boolean)){const limit=items.get(id).category==='tie'?1:2;if(!exempt.has(id)&&(counts.get(id)||0)>=limit){reason='ITEM_CAP:'+id;break;}}
   if(reason){omitted.push({key:e.key,reason,still_qualified:true});continue;}
   selected.push(e);clothingSeen.add(e.clothing_key);if(o.tie===null)noTie++;if(o.topwear===null)shirtOnly++;
   for(const id of Object.values(o).filter(Boolean))counts.set(id,(counts.get(id)||0)+1);
  }
  return {schema:TAG,catalogue_fingerprint:cat.fingerprint,request:q,selected,all_qualified:qualified,omitted_from_list:omitted,
   not_qualified:evaluated.filter(e=>!e.recommendable),no_style_fallback:true,no_score_diversity_bonus:true,
   list_policy:{target:20,max_unanchored_tie:1,max_other_unanchored:2,no_tie_cap:noTieCap,exact_anchor_exemptions:[...exempt]},
   coverage_claim:'Only supplied whole-outfit reviews, not every generated combination.'};
 }
 return Object.freeze({revision:TAG,request,enumerateClothing,enumerateFull,assess,selectReviewed,renderState,
  get:id=>items.has(id)?COPY(items.get(id)):null,groups:()=>Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.map(x=>x.id)])),catalogueFingerprint:cat.fingerprint});
}
return Object.freeze({create,clothingKey,outfitKey,revision:TAG,styles:STYLES.slice(),occasions:OCCASIONS.slice()});
});
