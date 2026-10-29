/* HEWRS wardrobe-wide EXPLORATION, not a replacement aesthetic classifier.
 * Candidate diversity is retained BEFORE display caps. No legacy score or failed
 * R3 classifier veto; no general taste prediction, implicit approval or storage write.
 * Cooperative yielding/cancellation keeps the existing app interactive.
 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./rebuild-core.js'),require('./outfit-feedback.js'));else root.HEWRSWardrobeDiscovery=factory(root.HEWRSRebuildCore,root.HEWRSOutfitFeedback);})(typeof globalThis==='object'?globalThis:this,function(Core,Feedback){
'use strict';
const REV='hewrs.discovery.exploration.v1',clone=x=>JSON.parse(JSON.stringify(x)),need=(v,m)=>{if(!v)throw Error(m);};
const STRATEGIES=['quiet','tonal','contrast','patterns','texture','variety'];
const LABELS={quiet:'Quieter foundation',tonal:'Tonal relationships',contrast:'Light–dark contrast',patterns:'Pattern-scale exploration',texture:'Texture relationships',variety:'Broader wardrobe variety'};
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;};
const pause=()=>new Promise(r=>setTimeout(r,0)),overlap=(a=[],b=[])=>a.some(x=>b.includes(x))?1:0;
function native(o,watchId=null){const s={shirtId:o.shirt,state:o.tie||'NO_TIE',shoeId:o.shoe,watchId};if(o.topwear?.startsWith('S'))s.suitId=o.topwear;else{s.pantId=o.pants;if(o.topwear)s.blazerId=o.topwear;else s.shirtOnly=true;}return Feedback.normal(s);}
function create({catalogue,semanticIndex,bridge,feedback,ownerConstraints}){
 need(ownerConstraints?.schema==='hewrs.rebuild.owner-constraints.v1'&&ownerConstraints.catalogue_fingerprint===catalogue?.fingerprint&&Array.isArray(ownerConstraints.rules),'Missing or stale owner rules; discovery refused.');
 for(const r of ownerConstraints.rules)need(r.type==='rejected_clothing'&&typeof r.clothing_key==='string','Unsupported owner rule; not silently ignored.');
 need(catalogue?.fingerprint===bridge?.catalogueFingerprint,'Discovery/review source mismatch.');
 need(semanticIndex?.catalogue_fingerprint===catalogue.fingerprint,'Discovery feature source mismatch.');
 const core=Core.create(catalogue),records=new Map(catalogue.records.map(r=>[r.id,r])),features=new Map(semanticIndex.records.map(r=>[r.id,r]));
 need(features.size===records.size&&semanticIndex.records.length===features.size,'Missing/duplicate discovery features.');
 for(const r of records.values())need(features.get(r.id)?.source_fingerprint===r.source_fingerprint,'Stale discovery feature: '+r.id);
 const known=new Map(bridge.entries().map(e=>[Core.outfitKey(e.outfit),e]));
 function normalize(raw={}){const q=core.request(raw),a=q.anchors;
  need(!(q.formality==='tie_required'&&a.tie===null),'Tie required conflicts with exact NO TIE; nothing changed.');
  need(!(a.shirt&&records.get(a.shirt).no_tie_only&&(a.tie||q.formality==='tie_required')),'This shirt is no-tie-only by owner instruction.');
  need(!(a.topwear?.startsWith('S')&&a.pants),'A complete suit cannot use separate trousers.');
  need(!(q.mode==='shirt_only'&&a.topwear),'Shirt-only mode conflicts with the exact jacket.');
  need(!(q.mode==='suit'&&(a.topwear===null||a.topwear?.startsWith('B')||a.pants)),'Suit mode conflicts with the exact selections.');
  need(!(q.mode==='blazer'&&(a.topwear===null||a.topwear?.startsWith('S'))),'Blazer mode conflicts with the exact jacket.');
  need(!(q.formality==='suit_required'&&(q.mode==='blazer'||q.mode==='shirt_only'||a.topwear===null||a.topwear?.startsWith('B')||a.pants)),'Suit required conflicts with the exact selections.');return q;
 }
 function rules(snap,q,watch){const clothing=new Set(ownerConstraints.rules.map(r=>r.clothing_key)),outfit=new Set(),historical=new Set();
  for(const e of snap.active)if(e.occasion==='all'||Feedback.occasion(e.occasion)===q.occasion)(e.scope==='clothing'?clothing:outfit).add(Feedback.key(e.selection,e.scope));
  for(const r of snap.historical)if(r.vote==='neither'&&Feedback.occasion(r.context.occasion)===q.occasion)for(const s of [r.a,r.b])if((s.watchId||null)===watch)historical.add(Feedback.key(s,'historical_exact'));
  const shoeSet=new Set(q.anchors.shoe?[q.anchors.shoe]:core.groups().shoe),byClothing=new Map();for(const k of new Set([...outfit,...[...historical].map(x=>x.slice(0,x.lastIndexOf('|')))])){const ix=k.lastIndexOf('|'),ck=k.slice(0,ix),shoe=k.slice(ix+1);if(!shoeSet.has(shoe))continue;if(!byClothing.has(ck))byClothing.set(ck,new Set());byClothing.get(ck).add(shoe);}const exhausted=new Set([...byClothing].filter(([,v])=>v.size===shoeSet.size).map(([k])=>k));
  return {clothing,outfit,historical,exhausted,allows(o){const ck=Core.clothingKey(o),ok=Core.outfitKey(o);return !clothing.has(ck)&&!outfit.has(ok)&&!historical.has(ok+'|'+(watch||'NO_WATCH'));}};
 }
 const pc=x=>x?.pattern_contrast??0,vl=x=>(x?.value_ordinal??2)/4;
 function descriptors(o){const t=features.get(o.topwear),p=features.get(o.pants)||t,s=features.get(o.shirt),tie=features.get(o.tie);return {t,p,s,tie};}
 function clothingScores(o,key){const {t,p,s,tie}=descriptors(o),arr=[t,s,tie].filter(Boolean),load=arr.reduce((n,x)=>n+pc(x),0),tonal=overlap(s.dominant_families,p?.dominant_families)+(tie?overlap(s.dominant_families,tie.dominant_families):0),contrast=Math.abs(vl(s)-vl(p))+(tie?Math.abs(vl(s)-vl(tie)):0),patterns=arr.filter(x=>pc(x)>.15),scales=patterns.map(x=>x.pattern_scale??.5),separation=scales.length>1?Math.max(...scales)-Math.min(...scales):0,texture=arr.reduce((n,x)=>n+(x.surface_texture??.2),0);
  return {quiet:3-load+.2*contrast,tonal:tonal+.1*contrast,contrast,patterns:patterns.length*.25+separation,texture,variety:hash(key)/4294967295};
 }
 function shoeScore(o,strategy,base,q){const f=features.get(o.shoe),{t,p,s}=descriptors(o),bulk=f.sole_bulk??.4,shoeContrast=f.sole_contrast??.2;let n=base;
  if(strategy==='quiet')n+=.25*(1-pc(f))+.15*(1-bulk);
  else if(strategy==='tonal')n+=.35*overlap(f.dominant_families,p?.dominant_families)+.15*overlap(f.dominant_families,s.dominant_families);
  else if(strategy==='contrast')n+=.3*Math.abs(vl(f)-vl(p));
  else if(strategy==='patterns')n+=.2*(1-pc(f));
  else if(strategy==='texture')n+=.25*(f.surface_texture??.2);
  else n=hash(Core.outfitKey(o))/4294967295;
  // Requested style only guides search order. It is never represented as verified.
  if(q.style==='CLASSIC')n+=.08*(1-bulk)+.05*(1-shoeContrast);
  if(q.style==='MODERN')n+=.06*shoeContrast+.04*(o.tie===null?1:0);
  if(q.style==='HYBRID')n+=.05*(t&&f.footwear_type==='sneaker'?1:0);
  return n;
 }
 function keep(list,x,limit){if(list.length>=limit&&x.order<=list[list.length-1].order)return;let i=0;while(i<list.length&&(list[i].order>x.order||list[i].order===x.order&&list[i].key<x.key))i++;list.splice(i,0,x);if(list.length>limit)list.pop();}
 function diversify(rows,q){const out=[],omitted=[],counts=new Map(),clothes=new Set(),exempt=new Set(Object.values(q.anchors).filter(x=>typeof x==='string'));let nt=0,so=0;const noTieCap=q.style==='MODERN'||Object.hasOwn(q.anchors,'tie')&&q.anchors.tie===null?null:2;
  for(const r of rows){const o=r.outfit;let why=null;if(out.length===20)why='OPTION_LIST_LIMIT';else if(clothes.has(r.clothing_key))why='DUPLICATE_CLOTHING_CONFIGURATION';else if(o.tie===null&&noTieCap!==null&&nt>=noTieCap)why='NO_TIE_OPTION_CAP';else if(o.topwear===null&&q.mode!=='shirt_only'&&q.anchors.topwear!==null&&so>=2)why='SHIRT_ONLY_OPTION_CAP';else for(const id of Object.values(o).filter(Boolean))if(!exempt.has(id)&&(counts.get(id)||0)>=(records.get(id).category==='tie'?1:2)){why='ITEM_CAP:'+id;break;}
   if(why){omitted.push({key:r.key,reason:why,still_available:true});continue;}out.push(r);clothes.add(r.clothing_key);nt+=o.tie===null;so+=o.topwear===null;for(const id of Object.values(o).filter(Boolean))counts.set(id,(counts.get(id)||0)+1);
  }return {selected:out,omitted_from_list:omitted};
 }
 async function search(raw={},watch=null,{signal=null,onProgress=null,batch=0,poolLimit=180}={}){
  need(Number.isInteger(batch)&&batch>=0&&batch<=999,'Invalid exploration batch.');need(Number.isInteger(poolLimit)&&poolLimit>=60&&poolLimit<=600,'Exploration pool limit must be 60–600.');
  need(watch===null||typeof watch==='string'&&/^watch-[A-Za-z0-9_-]+$/.test(watch),'Invalid exact watch.');
  const q=normalize(raw),snap=feedback.refresh(),g=rules(snap,q,watch),started=Date.now();let considered=0,clothingBlocked=0,exhaustedClothing=0,expanded=0,feedbackBlocked=0,knownOmitted=0;
  const foundations=new Map(),perId=new Map(),consideredIDs=new Set(),shoeIDs=q.anchors.shoe?[q.anchors.shoe]:core.groups().shoe;
  function check(){if(signal?.aborted){const e=Error('Exploration cancelled; no outfit or feedback was changed.');e.name='AbortError';throw e;}feedback.assertCurrent(snap.token);}
  async function yieldProgress(phase){check();onProgress?.({phase,clothing_considered:considered,footwear_expansions:expanded,foundations:foundations.size});await pause();check();}
  const best=(old,row,score)=>!old||score>old.score||score===old.score&&row.key<old.key?{...row,score}:old;
  for(const o of core.enumerateClothing(q)){
   considered++;if(considered%4096===0)await yieldProgress('clothing');const ck=Core.clothingKey(o);if(g.clothing.has(ck)){clothingBlocked++;continue;}if(g.exhausted.has(ck)){exhaustedClothing++;continue;}
   const fk=(o.topwear||'SHIRT_ONLY')+'|'+(o.pants||'SUIT_TROUSERS');let f=foundations.get(fk);if(!f){f={};foundations.set(fk,f);}const scores=clothingScores(o,ck),row={outfit:o,key:ck,scores};
   for(const st of STRATEGIES){let score=scores[st];if(batch)score=.5*score+.8*hash(ck+'|'+st+'|'+batch)/4294967295;f[st]=best(f[st],row,score);}
   for(const id of Object.values(o).filter(Boolean)){consideredIDs.add(id);const score=hash(id+'|'+ck+'|'+batch)/4294967295;perId.set(id,best(perId.get(id),row,score));}
  }
  await yieldProgress('footwear');const seeds=new Map();
  for(const f of foundations.values())for(const st of STRATEGIES){const x=f[st];if(!x)continue;if(!seeds.has(x.key))seeds.set(x.key,{...x,strategies:[]});seeds.get(x.key).strategies.push(st);}
  for(const row of perId.values())if(!seeds.has(row.key))seeds.set(row.key,{...row,strategies:['variety']});
  const pools=Object.fromEntries(STRATEGIES.map(x=>[x,[]])),representatives=new Map(),limit=Math.ceil(poolLimit/STRATEGIES.length),knownFound=new Set();
  for(const seed of seeds.values())for(const shoe of shoeIDs){
   expanded++;if(expanded%2048===0)await yieldProgress('footwear');consideredIDs.add(shoe);const o={...seed.outfit,shoe},k=Core.outfitKey(o);if(!g.allows(o)){feedbackBlocked++;continue;}
   // An existing whole-outfit judgment cannot be bypassed by calling it a new hypothesis.
   if(known.has(k)){knownFound.add(known.get(k).id);knownOmitted++;continue;}
   const row={outfit:o,key:k,clothing_key:seed.key,strategies:seed.strategies,order:0};
   for(const st of seed.strategies){const scored={...row,order:shoeScore(o,st,seed.scores[st],q)};keep(pools[st],scored,limit);}
   const cov=hash(k+'|coverage|'+batch)/4294967295;for(const id of Object.values(o).filter(Boolean)){const old=representatives.get(id);if(!old||cov>old.order)representatives.set(id,{...row,order:cov});}
  }
  check();const rows=[],seen=new Set();for(let i=0;i<limit;i++)for(const st of STRATEGIES){const r=pools[st][i];if(r&&!seen.has(r.key)){rows.push({...r,strategies:[...new Set([...r.strategies,st])]});seen.add(r.key);}}
  for(const row of representatives.values())if(!seen.has(row.key)){rows.push(row);seen.add(row.key);}
  const inferred=rows.map((r,i)=>({id:'explore:'+r.key,outfit:clone(r.outfit),key:r.key,clothing_key:r.clothing_key,strategies:r.strategies,strategy_labels:r.strategies.map(x=>LABELS[x]),order_index:i,kind:'unreviewed_possibility',whole_outfit_review_status:'pending',owner_approved:false,review:null,requested_style:q.style,style_verified:false,requested_occasion:q.occasion,occasion_verified:false,rendering:core.renderState(r.outfit),source_fingerprint:catalogue.fingerprint,warning:r.outfit.shoe==='shoe-23'?'Historical damaged-footwear identity remains unresolved; this is not reactivation or ownership confirmation.':null}));
  // Direct preferences and hides have priority; no sort after replay.
  const ordered=feedback.reorder(inferred,e=>native(e.outfit,watch),q);check();const d=diversify(ordered,q);
  return {schema:REV,catalogue_fingerprint:catalogue.fingerprint,request:q,watchId:watch,feedback_token:snap.token,batch,all_possibilities:ordered,...d,known_reviews_encountered:[...knownFound],counts:{clothing_considered:considered,clothing_owner_excluded:clothingBlocked,clothing_exhausted_by_exact_hides:exhaustedClothing,foundations:foundations.size,clothing_seeds:seeds.size,footwear_expansions:expanded,feedback_excluded_before_retention:feedbackBlocked,known_reviews_not_relabelled:knownOmitted,considered_ids:[...consideredIDs].sort(),retained:ordered.length,elapsed_ms:Date.now()-started},semantics:{search_order_only:true,reviewed_library_unchanged:true,failed_classifier_invoked:false,style_and_occasion_unverified:true,bounded_not_exhaustive_complete_outfits:true,all_retained_are_accessible:true,no_automatic_switch_from_reviewed:true,no_legacy_score_veto:true,no_storage_writes:true,no_weather_or_wear_rotation:true}};
 }
 function inspect(row,raw,watch){const q=normalize(raw),a=bridge.inspect(row.outfit,q);need(a.hard_constraints.status==='pass','Owner rule or exact selection blocks this possibility.');need(row.source_fingerprint===catalogue.fingerprint,'Stale exploration source.');need(!known.has(Core.outfitKey(row.outfit)),'An existing review must use the reviewed route.');need(feedback.allowed(native(row.outfit,watch),q),'This outfit is hidden for this request.');return {selection:native(row.outfit,watch),assessment:a};}
 return Object.freeze({search,normalize,inspect,nativeSelection:native,catalogueFingerprint:catalogue.fingerprint,revision:REV});
}
return Object.freeze({create,nativeSelection:native,strategies:STRATEGIES.slice(),revision:REV});
});
