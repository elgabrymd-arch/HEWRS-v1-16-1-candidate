/* HEWRS Stage 10 owner-feedback integration.
 * First integration slice: explicit owner garment rules, exact rejections,
 * historical Neither records and saved hides are hard vetoes on normal
 * generated option sets. Existing scoring, weather, wear-history rotation,
 * recommendation choice and list curation remain otherwise unchanged.
 */
(function(root){'use strict';
const prior=root.HEWRSCleanConnection,api=root.HEWRSOutfitFeedback;
if(!prior||!api)throw Error('Stage 10 owner-feedback dependencies are missing.');
const copy=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};

function create(inputs){
 const base=prior.create(inputs);let feedback=null;
 function setFeedback(value){
  need(value&&typeof value.refresh==='function'&&typeof value.match==='function'&&typeof value.assertCurrent==='function','Invalid owner-feedback store.');
  feedback=value;return true;
 }
 function context(q){return q?.context||{occasion:'work',requiredFormality:'any'};}
 function selection(o,q){return base.selectionFromOption(o,q).selection;}
 function staticReasons(s,q){return api.ownerRuleCheck(s,{context:context(q)}).reasons||[];}
 function vetoResult(result,q){
  if(!Array.isArray(result?.options))return result;
  let token=null;if(feedback)token=feedback.refresh().token;
  const kept=[],removed=[];
  for(const o of result.options){
   const s=selection(o,q),reasons=[...staticReasons(s,q)];
   if(feedback){const m=feedback.match(s,context(q));for(const r of m.reasons||[])if(!reasons.some(x=>x.id===r.id&&x.type===r.type))reasons.push(r);}
   if(reasons.length)removed.push({id:o?._hewrsConnected?.id||null,selection:copy(s),reasons:copy(reasons),was_recommendation:o?._hewrsConnected?.is_recommendation===true});
   else kept.push(o);
  }
  if(feedback)feedback.assertCurrent(token);
  if(!removed.length)return {...result,owner_feedback_integration:{revision:'hewrs.stage10.owner-feedback.v1',applied:true,removed:0,normal_scoring_changed:false,rotation_algorithm_changed:false}};
  const removedWinner=removed.some(x=>x.was_recommendation),status=!kept.length?'no_qualified_candidate':removedWinner?'compatibility_options_rotation_confirmation_required':result.status;
  let optionPolicy=result.option_policy;try{optionPolicy=root.HEWRSOptionSetPolicy.inspect(kept,q);}catch{}
  const reason=(result.reason?result.reason+' ':'')+(removedWinner?'The rotation-selected recommendation was removed by an explicit owner rule or saved rejection; no replacement recommendation was silently assigned. ':'')+removed.length+' generated option'+(removed.length===1?' was':'s were')+' removed by explicit owner feedback.';
  return {...result,status,options:kept,returned_options:kept.length,option_policy:optionPolicy,reason,owner_feedback_integration:{revision:'hewrs.stage10.owner-feedback.v1',applied:true,removed:removed.length,removed_entries:removed,removed_recommendation:removedWinner,normal_scoring_changed:false,rotation_algorithm_changed:false,exact_approval_priority_active:false}};
 }
 const controller=Object.freeze({...base.controller,
  generate:(q,cat,h)=>vetoResult(base.controller.generate(q,cat,h),q),
  generateAsync:async(q,cat,h,opts)=>vetoResult(await base.controller.generateAsync(q,cat,h,opts),q)
 });
 return Object.freeze({...base,controller,ownerFeedback:Object.freeze({revision:'hewrs.stage10.owner-feedback.v1',set:setFeedback,active:()=>!!feedback,snapshot:()=>feedback?feedback.snapshot():null})});
}
root.HEWRSCleanConnection=Object.freeze({create});
root.HEWRSStage10OwnerFeedback=Object.freeze({revision:'hewrs.stage10.owner-feedback.v1'});
})(globalThis);
