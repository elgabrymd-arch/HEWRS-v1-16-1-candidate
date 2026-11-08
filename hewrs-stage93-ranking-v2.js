/* HEWRS Stage 9.3: bounded preference-aware reviewed-outfit ordering.
 * Explicit owner evidence only: hard constraints/hides -> exact approval priority ->
 * direct pairwise preferences -> list caps. Exact memory is never generalized to garments.
 * No statistical taste training, inferred garment bans, storage writes or network.
 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./rebuild-core.js'),require('./outfit-feedback.js'));else root.HEWRSPersonalizedRanking=factory(root.HEWRSRebuildCore,root.HEWRSOutfitFeedback);})(typeof globalThis==='object'?globalThis:this,function(Core,Feedback){
'use strict';const clone=x=>JSON.parse(JSON.stringify(x)),need=(v,m)=>{if(!v)throw Error(m);};
function create({catalogue,bridge,feedback,numerical={}}){
 need(catalogue?.fingerprint===bridge?.catalogueFingerprint,'Ranking source mismatch.');
 const records=new Map(catalogue.records.map(r=>[r.id,r])),core=Core.create(catalogue),tier={strong:3,promising:2,borderline:1,unsuccessful:0};
 function selection(e,watch){return bridge.nativeSelection(e.id,watch);}
 function instructionInfo(rows,watch,context){
  const occ=Feedback.occasion(context.occasion),ks=new Map(rows.map(e=>[Feedback.key(selection(e,watch),'historical_exact'),e.id]));
  const evidence=[],pending=[],reserved=[];
  for(const r of feedback.snapshot().historical){
   if(Feedback.occasion(r.context.occasion)!==occ)continue;
   const a=ks.get(Feedback.key(r.a,'historical_exact')),b=ks.get(Feedback.key(r.b,'historical_exact'));
   if(!a&&!b)continue;
   if(r.partition==='validation'){reserved.push({record_id:r.id,used_for_ranking:false,kind:r.vote==='neither'?'exact_rejection_only':'reserved_not_ranked'});continue;}
   if(['A','B'].includes(r.vote)){
    if(a&&b)evidence.push({record_id:r.id,winner:r.vote==='A'?a:b,other:r.vote==='A'?b:a,kind:'exact_training_pair',historical_image_identity:'not_verified',scope:'same recorded garments, shoes, watch and occasion'});
    else pending.push({record_id:r.id,kind:'counterpart_not_in_eligible_pool',used_for_ranking:false});
   }else if(r.vote==='both')evidence.push({record_id:r.id,ids:[a,b].filter(Boolean),kind:'both_work_no_forced_winner',historical_image_identity:'not_verified'});
  }
  const exactApprovals=rows.filter(e=>e.owner_feedback?.kind==='approved_exact_outfit').map(e=>({id:e.id,key:Core.outfitKey(e.outfit),scope:'exact outfit and current context only',generalized:false}));
  return {applied_pairs:evidence.filter(e=>e.kind==='exact_training_pair'),exact_approvals:exactApprovals,evidence,pending,reserved_not_ranked:reserved,imported_records:feedback.snapshot().historical.length,validation_used_for_reranking:0,broader_preferences:[],broader_preferences_applied:0,generalized_taste_model:false,ordering_policy:{hard_constraints_first:true,saved_hides_veto:true,garment_rules_are_constraints_not_preferences:true,exact_approval_priority:true,exact_pairwise_preferences_last:true,exact_rejections_generalized:false,exact_approvals_generalized:false,model_judgment_is_base_quality_not_owner_taste:true}};
 }
 function diversify(rows,q){
  const selected=[],omitted=[],counts=new Map(),seen=new Set(),exempt=new Set(Object.values(q.anchors).filter(x=>typeof x==='string'));let noTie=0,shirtOnly=0;
  const noTieCap=q.style==='MODERN'||Object.hasOwn(q.anchors,'tie')&&q.anchors.tie===null?null:2;
  for(const e of rows){const o=e.outfit,clothing=Core.clothingKey(o);let reason=null;
   if(selected.length>=20)reason='OPTION_LIST_LIMIT';
   else if(seen.has(clothing))reason='DUPLICATE_CLOTHING_CONFIGURATION';
   else if(o.tie===null&&noTieCap!==null&&noTie>=noTieCap)reason='NO_TIE_OPTION_CAP';
   else if(o.topwear===null&&q.mode!=='shirt_only'&&!(Object.hasOwn(q.anchors,'topwear')&&q.anchors.topwear===null)&&shirtOnly>=2)reason='SHIRT_ONLY_OPTION_CAP';
   else for(const id of Object.values(o).filter(Boolean)){const limit=records.get(id).category==='tie'?1:2;if(!exempt.has(id)&&(counts.get(id)||0)>=limit){reason='ITEM_CAP:'+id;break;}}
   if(reason){omitted.push({id:e.id,key:Core.outfitKey(o),reason,still_qualified:true});continue;}
   selected.push(e);seen.add(clothing);if(o.tie===null)noTie++;if(o.topwear===null)shirtOnly++;for(const id of Object.values(o).filter(Boolean))counts.set(id,(counts.get(id)||0)+1);
  }
  return {selected,omitted_from_list:omitted,list_policy:{target:20,max_unanchored_tie:1,max_other_unanchored:2,no_tie_cap:noTieCap,exact_anchor_exemptions:[...exempt]}};
 }
 function order(rows,q,watch,method){
  const ranked=rows.slice().sort(method==='numeric'?(a,b)=>(numerical[b.id]?.margin??-Infinity)-(numerical[a.id]?.margin??-Infinity)||a.id.localeCompare(b.id):(a,b)=>tier[b.review.editorial_tier]-tier[a.review.editorial_tier]||Core.outfitKey(a.outfit).localeCompare(Core.outfitKey(b.outfit)));
  // Direct exact owner approval outranks assistant/numerical base quality, but only for that
  // exact outfit in the current eligible context. No component receives a learned bonus.
  const exactFirst=ranked.map((e,i)=>({e,i})).sort((a,b)=>Number(!!b.e.owner_feedback)-Number(!!a.e.owner_feedback)||a.i-b.i).map(x=>x.e);
  // Critical: direct recorded pairwise preferences are the last ordering operation.
  return feedback.reorder(exactFirst,e=>selection(e,watch),q);
 }
 function rank(raw={},watch=null,{allOutcomes=false}={}){
  const token=feedback.refresh().token,parts=Feedback.splitOwnerContext(raw),q=core.request(parts.request),ctx={...q,owner_use_case:parts.owner_use_case},excluded=[],pool=[];
  for(const e of bridge.entries()){
   const a=bridge.inspect(e.outfit,q);
   const approval=Feedback.ownerApproval(e.outfit,ctx),confirmedEligible=!!approval&&a.review?.validation_issues?.length===0&&(q.style==='AUTO'||a.style_matches===true);
   if(a.hard_constraints.status!=='pass'||!allOutcomes&&!a.recommendable&&!confirmedEligible){excluded.push({id:e.id,kind:'review_or_request',reason:a.review?.status||a.hard_constraints.reasons});continue;}
   const m=feedback.match(selection(e,watch),ctx);
   if(!m.allowed){excluded.push({id:e.id,kind:'explicit_feedback',reasons:m.reasons});continue;}
   pool.push({...e,owner_feedback:approval?{kind:'approved_exact_outfit',...approval}:null});
  }
  const visual=order(pool,ctx,watch,'visual'),numeric=order(pool,ctx,watch,'numeric'),personal=instructionInfo(pool,watch,q);
  feedback.assertCurrent(token);
  const d=allOutcomes?{selected:[],omitted_from_list:[],list_policy:null}:diversify(visual,q);
  return clone({revision:'hewrs.personalized-photo-ranking.v2-stage9.3',catalogue_fingerprint:catalogue.fingerprint,request:q,watchId:watch,feedback_token:token,all_qualified:allOutcomes?[]:visual,visual,numeric,...d,personal,excluded,same_candidate_pool:true,contains_unreviewed_inferences:false,normal_engine_replaced:false,all_outcomes_diagnostic:allOutcomes});
 }
 return Object.freeze({rank,revision:'hewrs.personalized-photo-ranking.v2-stage9.3'});
}
return Object.freeze({create,revision:'hewrs.personalized-photo-ranking.v2-stage9.3'});
});
