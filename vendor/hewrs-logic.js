/* HEWRS source-backed logic core. No DOM, storage, network, avatar, or asset writes.
   CommonJS + browser global. Frozen lookup is not a generator for missing judgments. */
(function(root,factory){
  'use strict';
  if(typeof module==='object' && module.exports) module.exports=factory();
  else root.HEWRSLogic=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='100.0.0';
  const WEIGHTS=Object.freeze({shirt_tie:0.35,topwear_shirt:0.25,topwear_tie:0.25,ensemble:0.15});
  const clone=x=>JSON.parse(JSON.stringify(x));
  function freeze(x){if(x && typeof x==='object' && !Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
  function indexUnique(rows,key){const m=new Map();for(const r of rows){const k=key(r);if(typeof k!=='string'||!k)throw new Error('Missing record ID');if(m.has(k))throw new Error('Duplicate record key: '+k);m.set(k,r);}return m;}
  function finiteRange(v,max){return typeof v==='number' && Number.isFinite(v) && v>=0 && v<=max;}
  function evidencePresent(x){return !!(x && typeof x==='object' && typeof x.source_id==='string' && x.source_id.trim());}
  function result(status,reason,extra){return Object.assign({status,score:null,reason_codes:[reason],evidence:[]},extra||{});}
  function classifyPair(score){
    if(!Number.isInteger(score)||!finiteRange(score,100))return null;
    return score>=90?'EXCELLENT':score>=82?'STRONG':score>=74?'ACCEPTABLE':score>=60?'WEAK':'REJECT';
  }
  function createEngine(input,options){
    options=options||{};const d=freeze(clone(input));
    const dna=indexUnique(d.dna.records,r=>r.category+'|'+r.id);
    const pairs=indexUnique(d.shirtTie,r=>r.key);
    const bp=indexUnique(d.blazerPant,r=>r.blazer_id+'|'+r.pant_profile_id);
    const styles=indexUnique(d.blazerStyles,r=>r.id);
    for(const r of d.shirtTie){
      if(r.key!==r.shirt_id+'|'+r.tie_id || !dna.has('shirt|'+r.shirt_id) || !dna.has('tie|'+r.tie_id))throw new Error('Pair ID mismatch');
      const selected=r.selected_record;
      if(!selected || selected.shirt_id!==r.shirt_id || selected.tie_id!==r.tie_id || classifyPair(selected.score)!==selected.class)throw new Error('Invalid selected pair score/class');
      if(!d.sources[selected.source_file])throw new Error('Unknown pair evidence source');
      const matches=(r.variants||[]).filter(v=>v.score===selected.score && v.tie_label_as_printed===selected.tie_identity && v.class_as_printed===selected.class && v.source_page===r.selected_source_page && v.source_pdf.split('/').pop().replace('(1)','')===selected.source_file);
      if(matches.length!==1)throw new Error('Selected row does not match one exact preserved variant');
      const conflict=new Set(r.variants.map(v=>v.score)).size>1;
      if(conflict!==r.numerical_conflict)throw new Error('Incorrect numerical conflict flag');
    }
    for(const r of d.blazerPant){if(!finiteRange(r.score,10)||!dna.has('blazer|'+r.blazer_id)||!dna.has('pant_color_profile|'+r.pant_profile_id)||!d.sources[r.source.source_id])throw new Error('Invalid blazer-pant record');}
    for(const r of d.blazerStyles){if(!dna.has('blazer|'+r.id)||!['CLASSIC','HYBRID','MODERN'].every(k=>finiteRange(r.scores[k],10)))throw new Error('Invalid blazer style record');}

    const canonical=new Map(), repository=new Map();
    for(const r of d.dna.records){canonical.set(r.category+'|'+r.id,r.id);if(r.repository_id)repository.set(r.category+'|'+r.repository_id,r.id);}
    // Blazer/P-profile numeric offsets are intentionally NOT inferred from file order.
    const usedTargets=new Set();
    for(const m of options.approvedMappings||[]){
      if(m.ownerApproved!==true||!evidencePresent(m.evidence))throw new Error('Crosswalk lacks explicit approval/evidence');
      if(!canonical.has(m.category+'|'+m.sourceId))throw new Error('Crosswalk source ID does not exist');
      if(typeof m.repositoryId!=='string'||!m.repositoryId)throw new Error('Crosswalk target missing');
      const k=m.category+'|'+m.repositoryId;
      if(usedTargets.has(k)||repository.has(k) && repository.get(k)!==m.sourceId)throw new Error('Crosswalk target collision');
      usedTargets.add(k);repository.set(k,m.sourceId);
    }
    function resolveId(category,id){
      if(typeof id!=='string')return null;
      return canonical.get(category+'|'+id)||repository.get(category+'|'+id)||null;
    }
    function getDNA(category,id){const n=resolveId(category,id);return n?clone(dna.get(category+'|'+n)):null;}
    function lookupShirtTie(shirtId,tieId,opts){
      opts=opts||{};
      if(shirtId==='DS049'||shirtId==='shirt-DS049')return result('retired','DS049_RETIRED',{shirt_id:'DS049'});
      const s=resolveId('shirt',shirtId);
      if(!s)return result('unknown','SHIRT_ID_NOT_IN_SOURCE_UNIVERSE');
      if(tieId===null)return result('not_applicable','INDEPENDENT_NO_TIE_PATH',{shirt_id:s});
      const t=resolveId('tie',tieId);
      if(!t)return result('unknown','TIE_ID_NOT_IN_SOURCE_UNIVERSE',{shirt_id:s});
      const shirt=dna.get('shirt|'+s);
      if(!shirt.eligibility.tie_pairing)return result('excluded','OWNER_NO_TIE_RULE',{shirt_id:s,tie_id:t,evidence:[shirt.eligibility.source]});
      const rec=pairs.get(s+'|'+t);
      if(!rec)return result('unknown','FROZEN_PAIR_RECORD_NOT_SUPPLIED',{shirt_id:s,tie_id:t});
      const policy=opts.versionPolicy||'strict';
      if(!['strict','implementation_package_2026_08_30'].includes(policy))return result('invalid','UNKNOWN_VERSION_POLICY');
      const ev={source_id:rec.selected_record.source_file,page:rec.selected_source_page};
      const common={shirt_id:s,tie_id:t,recorded_score:rec.selected_record.score,scale_max:100,recorded_class:rec.selected_record.class,
        rationale_as_recorded:rec.selected_record.rationale,evidence:[ev],alternatives:clone(rec.variants),version_policy:policy,
        package_selection_is_not_premise_validation:true,premise_concern:rec.premise_concern||null};
      if(policy==='strict' && rec.numerical_conflict)return result('conflict','DIFFERENT_RECORDED_SCORES_REQUIRE_EXPLICIT_VERSION_POLICY',common);
      if(rec.premise_concern)return result('premise_mismatch','SOURCE_SCORE_PREMISE_DIFFERS_FROM_OPERATIVE_DNA',common);
      return result(rec.numerical_conflict?'source_selected':'recorded',rec.numerical_conflict?'EXPLICIT_PACKAGE_SELECTION_WITH_ALTERNATIVES':'SOURCE_LOOKUP_NOT_RESCORED',
        Object.assign(common,{score:rec.selected_record.score,normalized_score:rec.selected_record.score/10,classification:rec.selected_record.class,
          current_styling_independently_certified:false,
          version_selection_evidence:rec.numerical_conflict?{source_id:'HEWRS_CANONICAL_AUDIT_FREEZE_2026-08-29.json',locator:'shirt_tie_phase2b.stale_checkpoints_not_to_use_as_current_state'}:null}));
    }
    function lookupBlazerPant(blazerId,pantProfileId){
      const b=resolveId('blazer',blazerId),p=resolveId('pant_color_profile',pantProfileId);
      if(!b||!p)return result('unknown','UNRESOLVED_BLAZER_OR_PANT_PROFILE_MAPPING');
      const r=bp.get(b+'|'+p);
      if(!r)return result('unknown','FROZEN_BLAZER_PANT_RECORD_NOT_SUPPLIED');
      return result('recorded','FROZEN_FOUNDATION_SCORE_NOT_AN_EXTRA_ENSEMBLE_TERM',{blazer_id:b,pant_profile_id:p,score:r.score,scale_max:10,evidence:[clone(r.source)],rationale:null,foundation_gate:'unassessed',gate_threshold:null});
    }
    function getBlazerStyle(blazerId){
      const b=resolveId('blazer',blazerId),r=b?styles.get(b):null;
      return r?Object.assign({status:'recorded'},clone(r)):result('unknown','BLAZER_STYLE_RECORD_OR_MAPPING_NOT_SUPPLIED');
    }
    function evaluateTiedEnsemble(req){
      if(!req || !['suit','blazer'].includes(req.kind))return result('invalid','KIND_MUST_BE_SUIT_OR_BLAZER');
      if(req.tieId===null)return evaluateNoTie(req);
      const top=resolveId(req.kind,req.topwearId);
      if(!top)return result('unknown','TOPWEAR_ID_OR_MAPPING_UNRESOLVED');
      const st=lookupShirtTie(req.shirtId,req.tieId,{versionPolicy:req.versionPolicy});
      if(!['recorded','source_selected'].includes(st.status))return result(st.status,'FROZEN_SHIRT_TIE_INPUT_NOT_USABLE',{shirt_tie:st,topwear_id:top});
      if(st.classification==='REJECT')return result('rejected','FROZEN_SHIRT_TIE_REJECTION_CANNOT_BE_RESCUED',{shirt_tie:st});
      if(st.classification==='WEAK')return result('requires_review','WEAK_SHIRT_TIE_CANNOT_BE_CERTIFIED_ELITE_BY_SYNERGY',{shirt_tie:st});
      let foundation=null;
      if(req.kind==='blazer'){
        foundation=lookupBlazerPant(top,req.pantProfileId);
        if(foundation.status!=='recorded')return result('unknown','BLAZER_PANT_FOUNDATION_REQUIRED_FIRST',{foundation,shirt_tie:st});
      }
      const key=[req.kind,top,st.shirt_id,st.tie_id,req.kind==='blazer'?resolveId('pant_color_profile',req.pantProfileId):'intrinsic_suit_trousers'].join('|');
      const known=(d.ensembleComponents.records||[]).find(x=>x.key===key);
      if(!known)return result('unknown','REQUIRED_ENSEMBLE_COMPONENT_JUDGMENTS_NOT_SUPPLIED',{
        key,shirt_tie:st,foundation,missing:['topwear_shirt','topwear_tie','ensemble','hard_conflict_assessment'].concat(foundation?['foundation_gate_assessment']:[]),formula:clone(WEIGHTS)});
      if(foundation && (!known.foundationGate||!evidencePresent(known.foundationGate.evidence)||typeof known.foundationGate.pass!=='boolean'))return result('unknown','FOUNDATION_GATE_UNASSESSED',{foundation});
      if(foundation && !known.foundationGate.pass)return result('excluded','RECORDED_FOUNDATION_GATE_FAILED',{foundation,evidence:[known.foundationGate.evidence]});
      const combined=combineTiedComponents({shirt_tie:{value:st.score,scale_max:100,evidence:st.evidence[0]},topwear_shirt:known.topwear_shirt,topwear_tie:known.topwear_tie,ensemble:known.ensemble,hard_conflict:known.hard_conflict});
      combined.foundation=foundation;combined.key=key;combined.evidence_status='computed_from_registered_component_records';
      combined.ensemble_audit=known.ensembleAudit||{status:'unassessed'};
      combined.recommendation_eligible=combined.status==='computed' && combined.ensemble_audit.status==='pass' && evidencePresent(combined.ensemble_audit.evidence);
      combined.gate=combined.recommendation_eligible?'pass':combined.status==='rejected'?'fail':'unassessed';
      return combined;
    }
    function evaluateNoTie(req){
      if(!req || !['suit','blazer'].includes(req.kind))return result('invalid','KIND_MUST_BE_SUIT_OR_BLAZER');
      const sh=lookupShirtTie(req.shirtId,null);
      if(sh.status!=='not_applicable')return result(sh.status,'SHIRT_INELIGIBLE_OR_UNKNOWN',{shirt:sh});
      const top=resolveId(req.kind,req.topwearId);
      if(!top)return result('unknown','TOPWEAR_ID_OR_MAPPING_UNRESOLVED');
      const foundation=req.kind==='blazer'?lookupBlazerPant(top,req.pantProfileId):null;
      if(foundation && foundation.status!=='recorded')return result('unknown','BLAZER_PANT_FOUNDATION_REQUIRED_FIRST',{foundation});
      const key=[req.kind,top,sh.shirt_id,'NO_TIE',foundation?foundation.pant_profile_id:'intrinsic_suit_trousers'].join('|');
      const rec=(d.noTie.records||[]).find(x=>x.key===key);
      if(!rec)return result('unknown','INDEPENDENT_NO_TIE_JUDGMENT_NOT_SUPPLIED',{key,shirt_tie:sh,foundation,no_tie_is_allowed_configuration:true});
      if(!finiteRange(rec.score,10)||!evidencePresent(rec.source))return result('invalid','MALFORMED_NO_TIE_RECORD');
      return result('recorded','INDEPENDENT_NO_TIE_JUDGMENT',{key,score:rec.score,scale_max:10,evidence:[clone(rec.source)],shirt_tie:sh,foundation});
    }
    return Object.freeze({version:VERSION,resolveId,getDNA,lookupShirtTie,lookupBlazerPant,getBlazerStyle,evaluateTiedEnsemble,evaluateNoTie});
  }
  /** Exact four-term arithmetic only. Supplied evidence is carried, not independently verified.
      Test fixture numbers must not be confused with sourced wardrobe judgments. */
  function combineTiedComponents(inputs){
    if(!inputs || typeof inputs!=='object')return result('invalid','COMPONENT_OBJECT_REQUIRED');
    const vals={},evidence=[],missing=[];
    for(const k of Object.keys(WEIGHTS)){
      const x=inputs[k];
      if(!x || x.value===null || x.value===undefined){missing.push(k);continue;}
      const max=k==='shirt_tie'?100:10;
      if(x.scale_max!==max || !finiteRange(x.value,max) || k==='shirt_tie' && !Number.isInteger(x.value))return result('invalid','INVALID_SCORE_OR_SCALE_'+k.toUpperCase());
      if(!evidencePresent(x.evidence)){missing.push(k+'_evidence');continue;}
      vals[k]=k==='shirt_tie'?x.value/10:x.value;evidence.push(clone(x.evidence));
    }
    const hc=inputs.hard_conflict;
    if(!hc || hc.assessed!==true || !evidencePresent(hc.evidence))missing.push('hard_conflict_assessment');
    else if(!finiteRange(hc.deduction,10) || typeof hc.hard_reject!=='boolean')return result('invalid','INVALID_HARD_CONFLICT_ASSESSMENT');
    if(missing.length)return result('unknown','REQUIRED_INPUT_MISSING_NO_RENORMALIZATION',{missing,weights:clone(WEIGHTS)});
    evidence.push(clone(hc.evidence));
    const weighted=Object.keys(WEIGHTS).reduce((sum,k)=>sum+WEIGHTS[k]*vals[k],0);
    const arithmetic=Number((weighted-hc.deduction).toFixed(6));
    const frozenClass=classifyPair(inputs.shirt_tie.value);
    const rejected=hc.hard_reject || frozenClass==='REJECT';
    const weak=frozenClass==='WEAK';
    return result(rejected?'rejected':weak?'requires_review':'computed',rejected?'HARD_CONFLICT_OR_FROZEN_PAIR_REJECTION':weak?'WEAK_CORE_NEEDS_REVIEW':'EXACT_SOURCE_WEIGHTS_APPLIED',{
      score:arithmetic,scale_max:10,weighted_sum:Number(weighted.toFixed(6)),deduction:hc.deduction,weights:clone(WEIGHTS),normalized_inputs:vals,evidence,
      evidence_status:'arithmetic_from_supplied_inputs_not_independent_source_certification',recommendation_eligible:false,
      final_ensemble_audit_required:true,style_and_context_not_used:true});
  }
  /** Qualitative source definition, not a fabricated numerical style model. */
  function classifyExecutiveStyle(facts){
    facts=facts||{};const ev=[];
    function read(key){const x=facts[key];if(!x||!evidencePresent(x.evidence))return undefined;ev.push(clone(x.evidence));return x.value;}
    const authority=read('executiveAuthority');
    if(authority===false)return {status:'fails_authority',classification:null,authorityGate:'fail',outfit_style_score:null,evidence:ev};
    if(authority!==true)return {status:'unknown',classification:null,authorityGate:'unknown',outfit_style_score:null,missing:['executiveAuthority'],evidence:ev};
    const classic=read('classicFoundation');const interventions=read('modernInterventions');
    if(classic===true && Array.isArray(interventions) && interventions.length>=1 && interventions.length<=2 && interventions.every(x=>x && x.controlled===true && evidencePresent(x.evidence))){
      return {status:'classified',classification:'HYBRID',authorityGate:'pass',modern_intervention_count:interventions.length,outfit_style_score:null,evidence:ev,rule:'Classic foundation plus 1-2 controlled modern interventions; not midpoint.'};
    }
    if(read('traditionalAuthorityAndRestraint')===true && classic===true && Array.isArray(interventions) && interventions.length===0)return {status:'classified',classification:'CLASSIC',authorityGate:'pass',outfit_style_score:null,evidence:ev};
    if(read('modernExecutiveExpression')===true)return {status:'classified',classification:'MODERN',authorityGate:'pass',outfit_style_score:null,evidence:ev};
    return {status:'unknown',classification:null,authorityGate:'pass',outfit_style_score:null,missing:['sufficient_recorded_style_evidence'],evidence:ev};
  }
  /** Context has no compatibility argument and cannot rewrite a frozen score.
      Fact lists must be evidence-backed; unknown fiber never becomes weather-safe. */
  function evaluateContext(context,facts){
    context=context||{};facts=facts||{};const checks=[];
    const axes=[['occasion','allowedOccasions'],['requiredFormality','allowedFormality'],['season','allowedSeasons'],['temperatureBand','allowedTemperatureBands'],['precipitation','allowedPrecipitation']];
    for(const [axis,factKey] of axes){
      if(context[axis]===null || context[axis]===undefined)continue;
      const f=facts[factKey];
      if(!f||!Array.isArray(f.value)||!evidencePresent(f.evidence))checks.push({axis,value:context[axis],status:'unknown',reason:'No evidenced suitability fact supplied'});
      else checks.push({axis,value:context[axis],status:f.value.includes(context[axis])?'eligible':'ineligible',evidence:clone(f.evidence)});
    }
    const status=checks.some(x=>x.status==='ineligible')?'ineligible':checks.some(x=>x.status==='unknown')?'unknown':checks.length?'eligible':'not_evaluated';
    return {status,context:clone(context),checks,compatibility_adjustment:0,unknown_not_rejection:true};
  }
  function rankSupportedEnsembles(candidates,opts){
    opts=opts||{};if(!Array.isArray(candidates))throw new TypeError('Candidates must be an array');
    indexUnique(candidates,x=>x.id);
    const supported=candidates.filter(c=>c.compatibility && ['computed','recorded'].includes(c.compatibility.status) && finiteRange(c.compatibility.score,10) && c.compatibility.gate==='pass' && c.ensembleAudit && c.ensembleAudit.status==='pass');
    const excluded=candidates.filter(c=>!supported.includes(c)).map(c=>({id:c.id,status:c.compatibility?c.compatibility.status:'unknown'}));
    supported.sort((a,b)=>b.compatibility.score-a.compatibility.score||a.id.localeCompare(b.id));
    const exhaustive=Number.isInteger(opts.expectedUniverseSize)&&opts.expectedUniverseSize===candidates.length && excluded.length===0;
    return {status:exhaustive?'complete_supplied_universe':'partial_supported_subset',ranked:clone(supported.slice(0,opts.limit||10)),unranked:excluded,
      exhaustive,global_top10_certified:false,scope:'supplied candidate universe only; no style/context/rotation rescoring'};
  }
  function dateDay(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?Math.floor(d.getTime()/86400000):null;}
  function selectRotation(candidates,history,opts){
    opts=opts||{};const day=dateDay(opts.localDate);
    if(day===null)return result('invalid','EXPLICIT_VALID_LOCAL_CALENDAR_DATE_REQUIRED');
    if(!Array.isArray(history))return result('unknown','CONFIRMED_WEAR_HISTORY_NOT_SUPPLIED');
    if(!opts.policy||!evidencePresent(opts.policy.source))return result('unknown','ROTATION_POLICY_EVIDENCE_REQUIRED');
    const pol=opts.policy,band=pol.nearEquivalentBand;
    if(!finiteRange(band,10))return result('invalid','INVALID_NEAR_EQUIVALENT_BAND');
    indexUnique(candidates,x=>x.id);
    const accepted=[],ignored=[];
    for(const h of history){
      const hd=dateDay(h.localDate);
      if(h.confirmed!==true || hd===null || hd>day){ignored.push({id:h.id||null,reason:h.confirmed!==true?'not_confirmed':hd===null?'invalid_local_date':'future_record'});continue;}
      accepted.push(h);
    }
    const pool=candidates.filter(c=>c.compatibility && ['computed','recorded'].includes(c.compatibility.status) && finiteRange(c.compatibility.score,10) && c.compatibility.gate==='pass' && c.ensembleAudit && c.ensembleAudit.status==='pass' && c.context && c.context.status==='eligible' && c.style && c.style.authorityGate==='pass');
    if(!pool.length)return result('unknown','NO_FULLY_QUALIFIED_ENSEMBLES',{ignored_history:ignored,selected:null});
    pool.sort((a,b)=>b.compatibility.score-a.compatibility.score||a.id.localeCompare(b.id));
    const best=pool[0],near=pool.filter(c=>best.compatibility.score-c.compatibility.score<=band+1e-9);
    const recentMonthly=accepted.filter(h=>h.localDate.slice(0,7)===opts.localDate.slice(0,7) && h.controlledRepetition===true).length;
    const ranked=near.map(c=>{
      let burden=0,recent=0;
      for(const [role,item] of Object.entries(c.items||{})){
        if(!item)continue;const id=typeof item==='string'?item:item.id;
        const last=accepted.filter(h=>Object.values(h.items||{}).some(x=>(typeof x==='string'?x:x&&x.id)===id)).map(h=>dateDay(h.localDate)).sort((a,b)=>b-a)[0];
        if(last===undefined)continue;
        const days=day-last;const b=pol.recencyBands.find(x=>days<=x.maxDays);burden+=(b?b.weight:0)*(pol.categorySensitivity[role]||1);
        if(days<=6)recent++;
      }
      return {candidate:c,burden:Number(burden.toFixed(6)),recent_item_count:recent,compliant:recent<2 && !(recentMonthly>=pol.maxMonthlyRepeatIncidents && recent>0)};
    }).sort((a,b)=>a.burden-b.burden||b.candidate.compatibility.score-a.candidate.compatibility.score||a.candidate.id.localeCompare(b.candidate.id));
    const pick=ranked.find(x=>x.compliant);
    return {status:pick?'selected':'rotation_exception_requires_owner_confirmation',selected:pick?clone(pick.candidate):null,theoretical_best:clone(best),
      compatibility_score:pick?pick.candidate.compatibility.score:null,near_equivalent_band:band,burden:pick?pick.burden:null,
      confirmed_wear_records_used:accepted.length,ignored_history:ignored,monthly_repetition_incidents:recentMonthly,
      policy_source:clone(pol.source),policy_scope:'Uploaded app recency policy subset; no palette/exact-outfit heuristic added; no compatibility changes.'};
  }
  return Object.freeze({VERSION,WEIGHTS,createEngine,combineTiedComponents,classifyPair,classifyExecutiveStyle,evaluateContext,rankSupportedEnsembles,selectRotation});
});
