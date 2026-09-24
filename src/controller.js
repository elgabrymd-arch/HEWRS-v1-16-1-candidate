/* Derived in this candidate: nullable exact watch selection and distinct revision. Numerical logic unchanged. See evidence/SOURCE_ORIGINS.json. */
/* HEWRS protected-test recommendation path.
 * Consumes the unchanged Step 3 Completion engine. No score calibration, DOM,
 * network, file or storage operations. No source/asset-ID guessing.
 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./request-contract.js'));else root.HEWRSConnectedPath=factory(root.HEWRSConnectedContract);})(typeof globalThis!=='undefined'?globalThis:this,function(Contract){
 'use strict';
 const REV='HEWRS_CLEAN_CONNECTION_V1';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const txt=x=>String(x??'');
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 function create({engine,guards,suitMappings,blazerMappings,accessoryResolver,familyFunctions,configurationFilter}){
  if(!engine||!guards||typeof accessoryResolver!=='function')throw TypeError('Engine, guards and accessory resolver required.');
  const sm=new Map(),bm=new Map(),sourceIds=new Set();
  for(const r of suitMappings||[]){if(!r.app_id||!r.source_id)continue;if(sm.has(r.app_id)||sourceIds.has(r.source_id))throw Error('Duplicate suit mapping');sm.set(r.app_id,r.source_id);sourceIds.add(r.source_id);}
  for(const r of blazerMappings||[]){if(r.status!=='SUPPORTED_LOCAL_MAPPING'||!r.app_id)continue;if(bm.has(r.app_id)||sourceIds.has(r.source_id))throw Error('Duplicate blazer mapping');bm.set(r.app_id,r.source_id);sourceIds.add(r.source_id);}
  const fam=familyFunctions||{};
  const sourceId=t=>t.formal?sm.get(t.id):bm.get(t.id);
  function filter(list,ov,classifier){
   if(!ov)return list.slice();
   if(ov.mode==='item')return list.filter(x=>x.id===ov.id);
   if(ov.mode==='category')return list.filter(x=>classifier(x)===ov.category);
   return list.slice();
  }
  function rawShirtFamily(s){const r=engine.get(s.id.replace(/^shirt-/,''));const f=r?.primary?.family||'unknown';return f==='charcoal'?'grey':f;}
  function matchesAllPreferences(items,q){
   if(!guards.matchesRequest({items},q))return false;
   const classifiers={topwear:x=>x.formal?'suit':'blazer',shirt:rawShirtFamily,tie:x=>x.colorFamily||fam.tie?.(x)||'unknown',shoes:x=>x.subcategory,watch:x=>x.brand,pants:x=>x.colorCategory||fam.pants?.(x)||'unknown'};
   for(const [role,classify]of Object.entries(classifiers))if(q[role]?.mode==='category'&&(!items[role]||classify(items[role])!==q[role].category))return false;
   return true;
  }
  function evidenceBinding(binding,pant){
   return !!(binding && binding.physicalId===pant.id && typeof binding.profileId==='string' && binding.evidence?.source_id && binding.reviewedForLocalTest===true);
  }
  function* generateSteps(q,catalogue,confirmedHistory){
   const rejectedRequest=reason=>({status:'request_blocked',options:[],reason,revision:REV,production_enabled:false});
   try{guards.validateCatalogue(catalogue);}catch(e){return rejectedRequest(e.message);}
   const prepared=Contract.prepare(q||{},catalogue);if(!prepared.allowed)return rejectedRequest(prepared.reason);q=prepared.query;
   const before=JSON.stringify(catalogue),historyBefore=JSON.stringify(confirmedHistory);
   const bad=guards.requestGuard(q,catalogue);if(!bad.allowed)return rejectedRequest(bad.reason);
   const style=q.executiveStyle||'AUTO';
   if(!['AUTO','CLASSIC','HYBRID','MODERN'].includes(style))return rejectedRequest('Unknown executive style.');
   const limit=q.limit===undefined?15:q.limit;
   if(!Number.isInteger(limit)||limit<1||limit>100)return rejectedRequest('Limit must be an integer from 1 to 100.');
   if(q.mode==='production')return rejectedRequest('Production activation is not authorized; this is a local candidate.');
   const dress=q.dressMode||'work';
   let tops=dress==='work'?catalogue.suits.concat(catalogue.blazers):catalogue.blazers.slice();
   tops=filter(tops,q.topwear,x=>x.formal?'suit':'blazer');
   // A separate bottom locks this into a blazer configuration; never ignore it.
   if(q.pants)tops=tops.filter(x=>!x.formal);
   let shirts=filter(catalogue.shirts,q.shirt,rawShirtFamily);
   const ties=filter(catalogue.ties.filter(t=>t.status==='active'),q.tie,t=>t.colorFamily||fam.tie?.(t)||'unknown');
   const noTieOnly=q.tie?.mode==='none'||dress==='weekend';
   const tieChoices=noTieOnly?[null]:q.tie?ties:ties.concat([null]);
   if(!tops.length||!shirts.length||!tieChoices.length)return rejectedRequest('No items satisfy all explicit locks; no substitution was made.');
   const bindingMap=new Map();
   for(const b of q.pantBindings||[]){if(bindingMap.has(b.physicalId))return rejectedRequest('Duplicate trouser binding; none was selected automatically.');bindingMap.set(b.physicalId,b);}
   const diagnostics={examined:0,eligible_numeric:0,states:{},unresolved:[],mapping_holds:[],accessory_holds:[],context_holds:0,style_holds:0,unmapped_topwear:[],configuration_counts:{tied:0,independent_no_tie:0}};
   const numeric=[],allScores=[];
   function noteState(r,key){diagnostics.states[r.status]=(diagnostics.states[r.status]||0)+1;
    if(['unknown','conflict','premise_mismatch','approval_required','invalid'].includes(r.status))diagnostics.unresolved.push({id:key,status:r.status,reasons:r.reason_codes||[]});}
   for(const top of tops){
    const sid=sourceId(top);
    if(!sid){diagnostics.unmapped_topwear.push(top.id);diagnostics.mapping_holds.push({role:'topwear',app_id:top.id,reason:'Target-specific canonical mapping not verified. No positional substitution.'});continue;}
    let pants=[null];
    if(!top.formal){
     const physical=filter(catalogue.pants,q.pants,p=>p.colorCategory||fam.pants?.(p)||'unknown');
     pants=physical.filter(p=>{const b=bindingMap.get(p.id);if(evidenceBinding(b,p))return true;
      diagnostics.mapping_holds.push({role:'pants',app_id:p.id,topwear_id:sid,reason:'Reviewed physical-trouser to canonical color-profile binding required.'});return false;});
     if(!pants.length)continue;
    }
    for(const p of pants)for(const s of shirts)for(const t of tieChoices){
     const key=[top.id,s.id,t?.id||'NO_TIE',p?.id||'SUIT_TROUSERS'].join('|');
     const req={topwearId:sid,shirtId:s.id,tieId:t?.id||null,pantProfileId:p?bindingMap.get(p.id).profileId:undefined,
      context:q.context||{occasion:q.contextName||'clinic',requiredFormality:'any'},suitabilityFacts:q.suitabilityFactsByTopwear?.[sid],versionPolicy:'strict'};
     if(configurationFilter&&!configurationFilter(req)){(diagnostics.unavailable_configurations??=[]).push({id:key,reason:'No registered render path for this configuration'});continue;}
     const result=engine.evaluate(req);diagnostics.examined++;
     diagnostics.configuration_counts[t?'tied':'independent_no_tie']++;
     noteState(result,key);
     if(q.includeAll)allScores.push({id:key,score:result.score??null,status:result.status});
     if(result.candidate_eligible){numeric.push({id:key,items:{topwear:top,shirt:s,tie:t,pants:p},result,req});diagnostics.eligible_numeric++;}
     if(diagnostics.examined%100===0)yield {phase:'clothing',examined:diagnostics.examined};
    }
   }
   numeric.sort((a,b)=>b.result.display_score-a.result.display_score||cmp(a.id,b.id));
   const accepted=[],contextUnknown=[];let accessoryVisited=0;
   for(const entry of numeric){
    if(++accessoryVisited%50===0)yield {phase:'accessories',examined:diagnostics.examined,accessoryCandidates:accessoryVisited};
    // Accessories follow the clothing calculation. Their legacy numerical choices
    // are explicitly separate and never enter the compatibility formula.
    const accessories=accessoryResolver(entry.items,q,catalogue);
    if(!accessories||accessories.status!=='bound'){diagnostics.accessory_holds.push({id:entry.id,reason:accessories?.reason||'No accessory binding'});continue;}
    const items={...entry.items,shoes:accessories.shoes,watch:accessories.watch};
    if(guards.itemsIssue(items,catalogue)||!matchesAllPreferences(items,q)){diagnostics.accessory_holds.push({id:entry.id,reason:'Accessory binding violates an exact lock or catalogue reference'});continue;}
    const withStyle=engine.evaluate({...entry.req,accessories:accessories.styleEvidence});
    if(withStyle.score!==entry.result.score)throw Error('Accessory/style evaluation changed compatibility.');
    if(withStyle.style?.authorityGate!=='pass'||(style!=='AUTO'&&withStyle.style.classification!==style)){diagnostics.style_holds++;continue;}
    const full={id:entry.id,items:clone(items),result:withStyle,accessory_method:accessories.method||'separate_existing_app_accessory_selection'};
    if(withStyle.context.status==='unknown'||withStyle.context.status==='not_evaluated'){diagnostics.context_holds++;contextUnknown.push(full);continue;}
    if(withStyle.context.status!=='eligible')continue;
    accepted.push(full);
   }
   // Only actual, ID-bound complete entries reach the existing pure rotation layer.
   const rotated=engine.selectForContext(accepted,confirmedHistory,{style,localDate:q.localDate});
   const selected=rotated.selected||null;
   const compatibilityOrder=accepted.slice().sort((a,b)=>b.result.display_score-a.result.display_score||cmp(a.id,b.id));
   let rank=0,last=null;
   const ranks=new Map();compatibilityOrder.forEach((e,i)=>{if(last!==e.result.display_score)rank=i+1;last=e.result.display_score;ranks.set(e.id,rank);});
   const ordered=selected?[selected,...compatibilityOrder.filter(e=>e.id!==selected.id)]:compatibilityOrder;
   const options=ordered.slice(0,limit).map(e=>({items:clone(e.items),formal:!!e.items.topwear.formal,dressMode:dress,
    context:q.context?.occasion||q.contextName||'clinic',styleEngine:style,
    _hewrsConnected:{revision:REV,mode:'candidate',compatibility:e.result,rank:ranks.get(e.id),is_recommendation:!!selected&&e.id===selected.id,
      id:e.id,accessory_method:e.accessory_method,production_enabled:false,source_spec_approved:false,
      validation:{request:Contract.requestSnapshot(q),items:Contract.itemSnapshot(e.items,catalogue,guards)}},
    controlledRepetition:rotated.rotation?.rotation_exception||false}));
   const report={status:selected?'candidate_recommendation':options.length?'compatibility_options_no_confirmed_rotation':contextUnknown.length?'context_unresolved':diagnostics.mapping_holds.length&&!diagnostics.examined?'mapping_required':'no_qualified_candidate',
    revision:REV,options,diagnostics,rotation:rotated,context_candidates:contextUnknown.slice(0,limit).map(e=>({id:e.id,score:e.result.display_score,context:e.result.context})),
    approval:{new_spec_explicitly_approved:false,test_continuation_authorized:true,production_enabled:false},
    coverage:{canonical_clothing_combinations_enumerated:true,exhaustive_for_bound_request:true,accessories_exhaustive:false,
      global_top10_certified:false,unresolved_outside_ranked_results:diagnostics.unresolved.length,unmapped_topwear:diagnostics.unmapped_topwear.length},
    no_legacy_clothing_pruning:true,no_silent_legacy_score_fallback:true,all_scores:q.includeAll?allScores:undefined};
   if(before!==JSON.stringify(catalogue)||historyBefore!==JSON.stringify(confirmedHistory))throw Error('Generator changed catalogue or confirmed-history inputs.');
   return report;
  }
  function generate(q,catalogue,confirmedHistory){
   const it=generateSteps(q,catalogue,confirmedHistory);for(;;){const step=it.next();if(step.done)return step.value;}
  }
  function generateAsync(q,catalogue,confirmedHistory,options){
   // Same generator and calculations, yielded in bounded batches. Input snapshots
   // prevent UI changes during a yield from silently changing the requested search.
   options=options||{};
   const snapshot=clone({q:q||{},catalogue,history:confirmedHistory===undefined?null:confirmedHistory});
   const it=generateSteps(snapshot.q,snapshot.catalogue,snapshot.history);
   return new Promise((resolve,reject)=>{
    function advance(){try{
     if(options.isCancelled?.()){it.return();resolve({status:'cancelled',options:[],revision:REV,production_enabled:false});return;}
     const step=it.next();if(step.done){resolve(step.value);return;}
     options.onProgress?.(step.value);setTimeout(advance,0);
    }catch(e){reject(e);}}
    setTimeout(advance,0);
   });
  }
  function verifyCachedOption(o,q,cat){
   // Read-only integrity check, NOT permission to persist, restore or log candidates.
   try{
    guards.validateCatalogue(cat);const checked=Contract.prepare(q||{},cat);if(!checked.allowed)return false;q=checked.query;
    if(!guards.requestGuard(q,cat).allowed||!o?._hewrsConnected||o._hewrsConnected.revision!==REV)return false;
    if(guards.itemsIssue(o.items,cat)||!matchesAllPreferences(o.items,q))return false;
    const m=o._hewrsConnected;if(m.production_enabled!==false||m.source_spec_approved!==false)return false;
    if(Contract.stable(m.validation?.request)!==Contract.stable(Contract.requestSnapshot(q)))return false;
    const live=Contract.itemSnapshot(o.items,cat,guards);
    if(Contract.stable(m.validation?.items)!==Contract.stable(live)||Contract.stable(o.items)!==Contract.stable(live))return false;
    const top=live.topwear,sid=sourceId(top);if(!sid)return false;
    let bind;if(!top.formal){bind=(q.pantBindings||[]).find(b=>b.physicalId===live.pants?.id);if(!bind||!evidenceBinding(bind,live.pants))return false;}
    const a=accessoryResolver(live,q,cat);if(a?.status!=='bound'||a.shoes.id!==live.shoes.id||(a.watch?.id??null)!==(live.watch?.id??null))return false;
    if(configurationFilter&&!configurationFilter({topwearId:sid,shirtId:live.shirt.id,tieId:live.tie?.id||null,pantProfileId:bind?.profileId}))return false;
    const r=engine.evaluate({topwearId:sid,shirtId:live.shirt.id,tieId:live.tie?.id||null,pantProfileId:bind?.profileId,
     context:q.context,suitabilityFacts:q.suitabilityFactsByTopwear?.[sid],accessories:a.styleEvidence,versionPolicy:'strict'});
    return !!(r.candidate_eligible&&r.context.status==='eligible'&&r.style.authorityGate==='pass'&&
     (!q.executiveStyle||q.executiveStyle==='AUTO'||r.style.classification===q.executiveStyle)&&
     Contract.stable(r)===Contract.stable(m.compatibility));
   }catch(e){return false;}
  }
  return Object.freeze({generate,generateAsync,verifyCachedOption,mappings:()=>({suits:Object.fromEntries(sm),blazers:Object.fromEntries(bm)}),revision:REV});
 }
 return Object.freeze({create,revision:REV});
});
