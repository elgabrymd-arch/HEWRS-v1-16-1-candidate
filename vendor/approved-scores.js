/* HEWRS Release Step 3: immutable, explicitly owner-approved score overlay.
 * No DOM, storage, asset edits, network or historical-score mutation.
 * Overall ensemble data remains independent of a shirt-tie score.
 */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.HEWRSStep3Scores=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SHIRTS=Object.freeze(['DS045','DS046','DS050','DS051']);
 const EVENT='HEWRS_OWNER_APPROVAL_20260908T154136Z';
 const clone=x=>JSON.parse(JSON.stringify(x));
 function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
 function shirtId(id){return typeof id==='string'?id.replace(/^shirt-/, ''):null;}
 const tieId=id=>typeof id==='string'&&/^T0(?:0[1-9]|[1-3][0-9]|4[0-7])$/.test(id)?id:null;
 const classify=v=>v>=90?'EXCELLENT':v>=82?'STRONG':v>=74?'ACCEPTABLE':v>=60?'WEAK':'REJECT';
 function createRegistry(input,receipt){
  if(!input||!receipt||receipt.event_id!==EVENT||receipt.approved_pair_count!==188||receipt.test_recommendation_activation_authorized!==true)throw Error('Explicit 188-score owner approval required');
  if(input.approval_event_id!==EVENT||input.original_proposal_sha256!==receipt.approved_proposal_sha256)throw Error('Approval / payload source mismatch');
  if(JSON.stringify(input.scope_shirts)!==JSON.stringify(SHIRTS)||!Array.isArray(input.records)||input.records.length!==188)throw Error('Four-shirt scope or pair count mismatch');
  const m=new Map(),weights={color_harmony:30,pattern_compatibility:25,contrast_value:15,scale_density_hierarchy:15,formality_coherence:10,surface_interaction:5};
  for(const original of input.records){
   const r=freeze(clone(original));
   if(!SHIRTS.includes(r.shirt_id)||!tieId(r.tie_id)||r.key!==r.shirt_id+'|'+r.tie_id||m.has(r.key))throw Error('Duplicate or out-of-scope pair');
   if(r.owner_approved_scores!==true||r.approval_event_id!==EVENT)throw Error('Unapproved row');
   if(!Number.isInteger(r.score_100)||r.score_100<0||r.score_100>100||classify(r.score_100)!==r.classification)throw Error('Invalid score / class');
   let total=0;
   for(const [k,w]of Object.entries(weights)){const v=r.components[k];if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)throw Error('Invalid approved component');total+=v*w/100;}
   if(Math.abs(total-r.weighted_score_before_rounding)>1e-8||Math.floor(total+0.5+1e-9)!==r.score_100)throw Error('Approved arithmetic mismatch');
   if(r.hard_override!==null)throw Error('This approved batch has no hard overrides');
   m.set(r.key,r);
  }
  for(const s of SHIRTS)for(let n=1;n<=47;n++)if(!m.has(s+'|T'+String(n).padStart(3,'0')))throw Error('Missing approved pair');
  const stamp='HEWRS_STEP3:'+input.original_proposal_sha256;
  function hasShirt(id){return SHIRTS.includes(shirtId(id));}
  function lookup(s,t){const sid=shirtId(s),tid=tieId(t);if(!hasShirt(sid)||!tid)return null;return clone(m.get(sid+'|'+tid));}
  function scoreForApp(s,t){
   if(!hasShirt(s)||t===null||t===undefined)return null;
   const r=lookup(s,t);if(!r)throw Error('Unresolved tie ID for approved shirt; no guessed score');
   return r.score_100/10;
  }
  function evidence(s,t){
   const r=lookup(s,t);if(!r)return null;
   return {status:'owner_approved',shirt_id:r.shirt_id,tie_id:r.tie_id,key:r.key,score:r.score_100,scale_max:100,
    normalized_score:r.score_100/10,classification:r.classification,rationale:r.rationale,
    reason_codes:['EXPLICIT_OWNER_APPROVAL_OF_NEW_ASSESSMENT'],evidence:[{source_id:'APPROVED_188.json',key:r.key,approval_event_id:EVENT}],
    historical_recovery:false,approval_utc:receipt.owner_message_utc,asset_authority:98,components:clone(r.components)};
  }
  function rankTies(id){
   if(!hasShirt(id))return {status:'unknown',ranked:[]};
   const rows=Array.from(m.values()).filter(r=>r.shirt_id===shirtId(id)).sort((a,b)=>b.score_100-a.score_100||a.tie_id.localeCompare(b.tie_id));
   let rank=0,last=null;
   return {status:'complete_approved_shirt_tie_set',scope:'47 ties for this shirt only; not whole-outfit ranking',ranked:rows.map((r,i)=>{if(r.score_100!==last)rank=i+1;last=r.score_100;return {rank,tie_id:r.tie_id,score:r.score_100,classification:r.classification,rationale:r.rationale};})};
  }
  return Object.freeze({stamp,lookup,evidence,scoreForApp,hasShirt,rankTies,count:188});
 }
 /* The base engine keeps strict historical policy. Only this approval's keys override it.
    No DS023 version choice or general legacy production fallback is inferred. */
 function withApprovedScores(base,logic,registry,componentData){
  if(!base||!logic||!registry)throw TypeError('Core, arithmetic functions and approved registry required');
  const components=freeze(clone(componentData||{records:[]}));
  function lookupShirtTie(s,t,options){return registry.evidence(s,t)||base.lookupShirtTie(s,t,options);}
  function evaluateTiedEnsemble(req){
   const st=req?registry.evidence(req.shirtId,req.tieId):null;
   if(!st)return base.evaluateTiedEnsemble(req);
   if(!['suit','blazer'].includes(req.kind))return {status:'invalid',score:null,reason_codes:['INVALID_TOPWEAR_KIND']};
   const top=base.resolveId(req.kind,req.topwearId);
   if(!top)return {status:'unknown',score:null,shirt_tie:st,reason_codes:['TOPWEAR_MAPPING_REQUIRED']};
   if(st.classification==='REJECT'||st.classification==='WEAK')return {status:st.classification==='REJECT'?'rejected':'requires_review',score:null,shirt_tie:st,reason_codes:['WEAK_OR_REJECTED_PAIR_NOT_RESCUED_BY_OTHER_COMPONENTS']};
   const foundation=req.kind==='blazer'?base.lookupBlazerPant(top,req.pantProfileId):null;
   if(foundation&&foundation.status!=='recorded')return {status:'unknown',score:null,shirt_tie:st,foundation,reason_codes:['BLAZER_PANT_FOUNDATION_MAPPING_REQUIRED']};
   const key=[req.kind,top,st.shirt_id,st.tie_id,foundation?foundation.pant_profile_id:'intrinsic_suit_trousers'].join('|');
   const known=(components.records||[]).find(x=>x.key===key);
   if(!known)return {status:'unknown',score:null,key,shirt_tie:st,foundation,
    missing:['topwear_shirt','topwear_tie','ensemble','hard_conflict_assessment'].concat(foundation?['foundation_gate_assessment']:[]),
    reason_codes:['REQUIRED_ENSEMBLE_COMPONENT_JUDGMENTS_NOT_SUPPLIED'],weights:{shirt_tie:0.35,topwear_shirt:0.25,topwear_tie:0.25,ensemble:0.15}};
   if(foundation&&(!known.foundationGate||typeof known.foundationGate.pass!=='boolean'||!known.foundationGate.evidence?.source_id))return {status:'unknown',score:null,foundation,reason_codes:['FOUNDATION_GATE_UNASSESSED']};
   if(foundation&&!known.foundationGate.pass)return {status:'excluded',score:null,foundation,reason_codes:['RECORDED_FOUNDATION_GATE_FAILED']};
   return Object.assign(logic.combineTiedComponents({shirt_tie:{value:st.score,scale_max:100,evidence:st.evidence[0]},topwear_shirt:known.topwear_shirt,topwear_tie:known.topwear_tie,ensemble:known.ensemble,hard_conflict:known.hard_conflict}),{key,shirt_tie:st,foundation});
  }
  return Object.freeze(Object.assign({},base,{lookupShirtTie,evaluateTiedEnsemble}));
 }
 return Object.freeze({version:'release-step3.1',createRegistry,withApprovedScores});
});
