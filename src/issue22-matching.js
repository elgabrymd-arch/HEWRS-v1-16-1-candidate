/* Issue 22 effective garment facts and hard no-tie policy.
 * Installed only in V3. Original inputs, V2/Standard sources, garment IDs,
 * saved selections and historical scores remain untouched. The separate
 * V3 clothing index is derived from these effective facts.
 */
(function(root){'use strict';
const data=root.HEWRS_ISSUE22_GARMENT_DNA,prior=root.HEWRSSourceCorrections,owner=root.HEWRSOutfitFeedback;
const clone=x=>structuredClone(x),need=(ok,message)=>{if(!ok)throw Error(message);};
need(data?.schema==='hewrs.issue22.garment-dna.v1'&&prior&&owner,'Issue 22 source dependencies are missing.');
const ids=new Set(data.scope),noTie=new Set(data.linen_no_tie_ids),revision=prior.revision+'+'+data.revision;
need(ids.size===6&&['S06','S13','S14','B01','B06','B10'].every(id=>ids.has(id)),'Unexpected Issue 22 DNA scope.');
need(noTie.size===3&&['B01','B06','B10'].every(id=>noTie.has(id)),'Unexpected Issue 22 no-tie scope.');
function apply(inputs){
 const out=prior.apply(inputs);
 for(const id of ids){
  const row=out.features.records.find(r=>r.id===id),correction=data.records[id];
  need(row&&correction,'Missing Issue 22 feature '+id);
  need(JSON.stringify(row)===JSON.stringify(correction.historical_feature),'Issue 22 historical feature changed: '+id);
  Object.assign(row,clone(correction.fields),{
   source:{source_id:data.issue_url,authority:correction.authority,photographs:clone(correction.photographs),historical_source:clone(row.source)},
   issue22_revision:data.revision,issue22_interpretation:clone(correction.interpretation)
  });
 }
 return out;
}
function profile(row,p){
 const out=prior.profile(row,p),correction=data.records[row.id];
 if(!correction||row.issue22_revision!==data.revision)return out;
 const result=clone(out),n=correction.interpretation;
 for(const key of ['value','temperature','saturation'])if(Object.hasOwn(n,key))result.primary[key]=n[key];
 if(n.pattern)Object.assign(result.pattern,clone(n.pattern));
 if(n.surface)result.surface=n.surface;
 if(n.fabric_family)result.fabric_family=n.fabric_family;
 result.issue22_revision=data.revision;result.interpretation_basis=n.basis;
 return result;
}
function normalizeProfile(row,p){
 const correction=data.records[row.id];
 if(!correction||row.issue22_revision!==data.revision)return p;
 const result=clone(p),n=correction.interpretation;
 for(const key of ['value','temperature','saturation'])if(Object.hasOwn(n,key))result.primary[key]=n[key];
 if(n.pattern){
  Object.assign(result.pattern,clone(n.pattern));
  // The compatibility model calls a fine woven texture nearSolid; the
  // preference model calls it texture. Both retain the same quietness,
  // scale and contrast. Fine checks remain grid geometry with low salience.
  if(result.pattern.family==='texture')result.pattern.family='nearSolid';
 }
 if(n.fabric_family)result.fabric_family=n.fabric_family;
 if(Object.hasOwn(n,'relaxed_tailoring'))result.relaxedTailoring=n.relaxed_tailoring;
 result.issue22_revision=data.revision;result.interpretation_basis=n.basis;
 return result;
}
function declaredTopwear(s){return [...new Set([s.suitId,s.blazerId,s.topwearId,typeof s.topwear==='string'?s.topwear:s.topwear?._canonical?.id].filter(id=>typeof id==='string'&&id))];}
function tieRuleCheck(s,{partial=false,context={}}={}){
 need(s&&typeof s==='object','An outfit is required for Issue 22.');
 const declared=declaredTopwear(s),ctx=typeof context==='object'&&context?context:{},reasons=[];
 // Each downstream path accepts a different canonical field. Do not let an
 // ignored suitId hide the topwearId consumed by the ensemble engine (or the
 // inverse). Repeated identical identifiers are harmless; conflicts fail.
 if(declared.length>1)reasons.push({id:'ISSUE22-CONFLICTING-TOPWEAR-IDS',message:'Conflicting suit or blazer identifiers. No garment was substituted.',type:'source_identity',scope:'outfit',source:'source_validation',rule_revision:data.revision});
 for(const id of declared.filter(id=>noTie.has(id))){
  const fields=['state','tie','tieId'].filter(key=>Object.hasOwn(s,key));
  const invalid=fields.some(key=>key==='state'?s[key]!=='NO_TIE':s[key]!==null&&s[key]!=='NO_TIE');
  if(invalid||!fields.length&&!partial||ctx.formality==='tie_required'||ctx.requiredFormality==='tie_required')
   reasons.push({id:'OWNER-'+id+'-NO-TIE',message:id+' is linen and must be worn without a tie. Your selected garments were not substituted.',type:'owner_batch_rule',scope:'garment',source:'explicit_owner_instruction',rule_revision:data.revision});
 }
 return {allowed:reasons.length===0,reasons};
}
function combine(a,b){const reasons=[...a.reasons];for(const reason of b.reasons)if(!reasons.some(r=>r.id===reason.id))reasons.push(reason);return {allowed:reasons.length===0,reasons};}
function ownerRuleCheck(s,options={}){return combine(owner.ownerRuleCheck(s,options),tieRuleCheck(s,options));}
function createFeedback(options){
 const base=owner.create(options);
 const match=(s,context={})=>combine(base.match(s,context),tieRuleCheck(s,{context}));
 const reorder=(rows,getSelection,context)=>base.reorder(rows,getSelection,context).filter(row=>match(getSelection(row),context).allowed);
 const alternative=(current,rows,getSelection,context)=>{
  const eligible=reorder(rows,getSelection,context).filter(row=>owner.key(getSelection(row))!==owner.key(current));
  return eligible.find(row=>owner.key(getSelection(row),'clothing')!==owner.key(current,'clothing'))||eligible[0]||null;
 };
 return Object.freeze({...base,match,allowed:(s,c)=>match(s,c).allowed,reorder,alternative});
}
root.HEWRSSourceCorrections=Object.freeze({...prior,revision,apply,profile,issue22Record:()=>clone(data)});
root.HEWRSOutfitFeedback=Object.freeze({...owner,ownerRuleCheck,create:createFeedback,
 ownerRuleSummary:()=>{const old=owner.ownerRuleSummary();return {...old,revision:old.revision+'+'+data.revision,message:old.message+' B01, B06 and B10 are natural linen and never allow a tie in any mode or occasion. Existing other garment rules remain active.'};},
 revision:owner.revision+'+'+data.revision
});
let engineInstalled=false;
function installEngine(){
 need(!engineInstalled,'Issue 22 matching installed twice.');
 const ensemble=root.HEWRSEnsembleCompletion;need(ensemble?.createEngine,'Issue 22 needs the source ensemble engine.');
 function createEngine(options){
  const base=ensemble.createEngine(options);
  function rejected(q,rule){return {status:'owner_rule_rejected',score:null,display_score:null,candidate_eligible:false,
   ids:{topwear:q.topwearId,shirt:q.shirtId,tie:q.tieId??null,pant_profile:q.pantProfileId??null},reason_codes:rule.reasons.map(r=>r.id),owner_rule:clone(rule),
   context:{status:'ineligible',context:clone(q.context||{})},issue22_revision:data.revision};}
  function evaluate(q={}){const rule=tieRuleCheck(q,{partial:true,context:q.context});return rule.allowed?base.evaluate(q):rejected(q,rule);}
  function rank(q={}){
   if(declaredTopwear(q).length<2&&!declaredTopwear(q).some(id=>noTie.has(id)))return base.rank(q);
   // rank() closes over the original evaluator. Recheck its complete examined
   // universe before sorting/limiting so prohibited ties cannot survive it.
   const result=base.rank({...q,includeAll:true});if(!Array.isArray(result.all))return result;
   const all=result.all.map(entry=>{
    const parts=entry.id.split('|'),request={...q,shirtId:parts[1],tieId:parts[2]==='NO_TIE'?null:parts[2]},rule=tieRuleCheck(request,{partial:true,context:q.context});
    return rule.allowed?entry:{...entry,result:rejected(request,rule)};
   }),ranked=all.filter(x=>x.result.candidate_eligible),unresolved=[],excluded=[];
   ranked.sort((a,b)=>b.result.display_score-a.result.display_score||a.id.localeCompare(b.id));
   let last=null,n=0;ranked.forEach((entry,i)=>{if(entry.result.display_score!==last)n=i+1;last=entry.result.display_score;entry.rank=n;});
   for(const entry of all)if(!entry.result.candidate_eligible){const r=entry.result;if(['unknown','conflict','premise_mismatch','invalid','approval_required'].includes(r.status))unresolved.push({id:entry.id,status:r.status,reasons:r.reason_codes});else excluded.push({id:entry.id,status:r.status});}
   return {...result,ranked:ranked.slice(0,q.limit||10),eligible_count:ranked.length,unresolved,excluded,has_unresolved_candidates:unresolved.length>0,all:q.includeAll===true?all:undefined};
  }
  function selectForContext(entries,history,options){
   need(Array.isArray(entries),'Candidate list required.');
   // Keep duplicate/identity validation in the original selector, then mask
   // prohibited externally supplied candidates instead of dropping identities.
   return base.selectForContext(entries.map(entry=>{
    const values=entry?.result?.ids;if(!values)return entry;
    const q={topwearId:values.topwear,tieId:values.tie,context:entry.result.context?.context},rule=tieRuleCheck(q,{partial:true,context:q.context});
    return rule.allowed?entry:{...entry,result:rejected(q,rule)};
   }),history,options);
  }
  return Object.freeze({...base,evaluate,rank,selectForContext});
 }
 root.HEWRSEnsembleCompletion=Object.freeze({...ensemble,createEngine,issue22_revision:data.revision});engineInstalled=true;
}
root.HEWRSIssue22Matching=Object.freeze({revision:data.revision,sourceRevision:revision,ids:Object.freeze([...ids]),noTieIds:Object.freeze([...noTie]),apply,profile,normalizeProfile,tieRuleCheck,installEngine});
})(globalThis);
