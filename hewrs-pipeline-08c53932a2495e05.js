/* HEWRS Stage 9.2: discovery -> source-validated review library -> ranked choices.
 * Coordination only: no model, provider calls, storage writes, new owner votes,
 * release activation or default-engine replacement. Unreviewed stays separate.
 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./rebuild-core.js'),require('./outfit-feedback.js'));else root.HEWRSRankingPipeline=factory(root.HEWRSRebuildCore,root.HEWRSOutfitFeedback);})(typeof globalThis==='object'?globalThis:this,function(Core,Feedback){
'use strict';
const REV='hewrs.discovery-review-ranking.pipeline.v1';
const clone=x=>JSON.parse(JSON.stringify(x));
const need=(v,m)=>{if(!v)throw Error(m);};
const cancelled=()=>{const e=Error('Ranking search cancelled or superseded. No selections were changed.');e.name='AbortError';return e;};
function create({catalogue,feedback,getBridge,getRanker,getDiscovery,getReviewRevision=()=>0}){
 need(Core&&Feedback&&catalogue?.fingerprint&&feedback,'Missing ranking-pipeline dependencies.');
 for(const f of [getBridge,getRanker,getDiscovery,getReviewRevision])need(typeof f==='function','Invalid ranking-pipeline dependency.');
 const core=Core.create(catalogue);let serial=0,running=null,cache=null,last=null;
 function normalize(raw={},watch=null){
  const p=Feedback.splitOwnerContext(raw),q=core.request(p.request);
  need(watch===null||typeof watch==='string'&&/^watch-[A-Za-z0-9_-]+$/.test(watch),'Invalid exact watch.');
  return {request:q,context:{...q,owner_use_case:p.owner_use_case},watchId:watch};
 }
 function cancel(){serial++;running?.abort();running=null;last=null;}
 function invalidate(){cancel();cache=null;}
 function assertReviewed(r,bridge,ctx,watch,known,request){
  need(r.catalogue_fingerprint===catalogue.fingerprint,'Ranked catalogue mismatch.');
  need(r.contains_unreviewed_inferences===false&&!r.all_outcomes_diagnostic,'Diagnostic or unreviewed rows cannot be recommendations.');
  const ids=new Set();
  for(const e of r.all_qualified){
   const original=known.get(Core.outfitKey(e.outfit));
   need(original&&original.id===e.id&&e.kind!=='unreviewed_possibility'&&!ids.has(e.id),'Ranked entry is not a unique validated review.');
   need(JSON.stringify(original.review)===JSON.stringify(e.review),'Ranking changed a stored review.');
   const a=bridge.inspect(e.outfit,request),approval=Feedback.ownerApproval(e.outfit,ctx);
   const exact=!!approval&&a.review?.validation_issues?.length===0&&(ctx.style==='AUTO'||a.style_matches===true);
   need(a.hard_constraints.status==='pass'&&(a.recommendable||exact),'A reviewed outcome does not qualify for this request.');
   need(feedback.allowed(bridge.nativeSelection(e.id,watch),ctx),'Owner exclusion must precede recommendation limits.');
   ids.add(e.id);
  }
  const selected=new Set();for(const e of r.selected){need(ids.has(e.id)&&!selected.has(e.id),'Recommendation list is not a unique subset of eligible reviews.');selected.add(e.id);}
  need(r.selected.length<=20,'Recommendation list exceeds the existing limit.');
 }
 async function search(raw={},watch=null,{batch=0,signal=null,onProgress=()=>{}}={}){
  need(Number.isInteger(batch)&&batch>=0&&batch<=999,'Invalid exploration batch.');
  cancel();const mine=serial,controller=new AbortController();running=controller;
  const externalAbort=()=>controller.abort();if(signal?.aborted)controller.abort();signal?.addEventListener('abort',externalAbort,{once:true});
  try{
  const n=normalize(raw,watch),snap=feedback.refresh(),revision=getReviewRevision(),bridge=getBridge(),ranker=getRanker();
  need(bridge?.catalogueFingerprint===catalogue.fingerprint,'Review library source mismatch.');
  const binding=JSON.stringify([n.context,watch,snap.token,revision,batch]);
  const check=()=>{if(controller.signal.aborted||mine!==serial)throw cancelled();feedback.assertCurrent(snap.token);need(revision===getReviewRevision()&&bridge===getBridge()&&ranker===getRanker(),'Review library changed during ranking. Run the current selection again.');};
   check();if(cache?.binding===binding){last=clone(cache.result);return clone(last);}
   const known=new Map();for(const e of bridge.entries()){const k=Core.outfitKey(e.outfit);need(!known.has(k),'Duplicate exact reviews are not a ranking tie-break.');known.set(k,e);}
   const ranked=ranker.rank(n.context,watch);check();need(ranked.feedback_token===snap.token,'Ranking feedback changed.');
   // The bridge receives only the normalized request; use-case rules stay in feedback.
   assertReviewed(ranked,bridge,n.context,watch,known,n.request);
   onProgress({phase:'reviewed',eligible_reviewed:ranked.all_qualified.length,ranked_choices:ranked.selected.length});check();
   const discovery=await getDiscovery();check();need(discovery.catalogueFingerprint===catalogue.fingerprint,'Discovery catalogue mismatch.');
   const explored=await discovery.search(n.context,watch,{batch,signal:controller.signal,onProgress:p=>{check();onProgress(p);}});check();
   need(explored.catalogue_fingerprint===catalogue.fingerprint&&explored.feedback_token===snap.token,'Stale discovery results.');
   need(explored.semantics?.style_and_occasion_unverified===true,'Discovery must preserve unverified context.');
   const pending=[],keys=new Set(),pendingIDs=new Set();
   for(const e of explored.all_possibilities){
    const k=Core.outfitKey(e.outfit);
    need(e.kind==='unreviewed_possibility'&&e.review===null&&e.owner_approved===false&&e.whole_outfit_review_status==='pending','Exploration cannot manufacture a review or owner approval.');
    need(e.source_fingerprint===catalogue.fingerprint&&!known.has(k),'An existing or stale review cannot be recycled as unreviewed.');
    need(!keys.has(k)&&!pendingIDs.has(e.id),'Duplicate discovery result.');
    discovery.inspect(e,n.context,watch);keys.add(k);pendingIDs.add(e.id);pending.push(clone(e));
   }
   const chosen=new Set();for(const e of explored.selected){need(pendingIDs.has(e.id)&&!chosen.has(e.id),'Review queue selection is invalid.');chosen.add(e.id);}
   check();const result={schema:REV,catalogue_fingerprint:catalogue.fingerprint,request:n.request,owner_use_case:n.context.owner_use_case,watchId:watch,feedback_token:snap.token,review_revision:revision,batch,
    ranked,pending:{selected:clone(explored.selected),all:pending,omitted_from_list:clone(explored.omitted_from_list)},exploration:explored,
    counts:{eligible_reviewed:ranked.all_qualified.length,ranked_choices:ranked.selected.length,awaiting_assessment:pending.length,queue_visible:explored.selected.length,known_reviews_not_relabelled:explored.counts.known_reviews_not_relabelled,clothing_considered:explored.counts.clothing_considered,footwear_expansions:explored.counts.footwear_expansions},
    invariants:{unreviewed_in_ranked_choices:false,automatic_provider_requests:0,storage_writes:0,new_owner_approvals:0,normal_engine_replaced:false,weather_and_rotation_integrated:false,generalized_taste_model:false,stage9_complete:false}};
   cache={binding,result:clone(result)};last=clone(result);return clone(result);
  }finally{signal?.removeEventListener('abort',externalAbort);if(mine===serial)running=null;}
 }
 return Object.freeze({search,normalize,cancel,invalidate,current:()=>last&&clone(last),revision:REV});
}
return Object.freeze({create,revision:REV});
});
