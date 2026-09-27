/* HEWRS Step 3 completion candidate.
 * Pure calculation: no DOM, network, files, storage, avatar or repository writes.
 * NEW numerical calibrations are enumerated in COMPONENT_SPECIFICATION.json.
 * Candidate calculations are not recovered/frozen ensemble judgments.
 */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HEWRSEnsembleCompletion=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const round=(x,n=6)=>Number(x.toFixed(n));
 const clamp=x=>Math.max(0,Math.min(10,x));
 const usable=new Set(['recorded','source_selected','owner_approved']);
 const weights=Object.freeze({shirt_tie:.35,topwear_shirt:.25,topwear_tie:.25,ensemble:.15});
 const colourSpecs={white:[null,5,'neutral'],cream:[null,4.6,'warm-neutral'],grey:[null,3,'neutral'],charcoal:[null,1.4,'neutral'],black:[null,.35,'neutral'],navy:[220,1.2,'cool'],blue:[218,3,'cool'],brown:[30,1.9,'warm'],tan:[38,3.4,'warm'],rust:[23,2.8,'warm'],gold:[43,3.4,'warm'],red:[0,2.2,'warm'],pink:[345,4.1,'warm-cool'],burgundy:[345,1.7,'warm-cool'],purple:[280,1.8,'cool'],lavender:[280,4.2,'cool'],green:[115,2.7,'cool'],sage:[100,3.8,'cool'],olive:[75,2.5,'warm-neutral']};
 // Earliest literal colour, not display-name / brand priority. These bands are proposals.
 const tokens=[['cream',/\b(?:ivory|off.white|cream|ecru|oatmeal)\b/],['lavender',/\b(?:lavender|lilac)\b/],['navy',/\b(?:navy|midnight)\b/],['charcoal',/\b(?:charcoal|graphite)\b/],['grey',/\b(?:grey|gray|silver|pearl)\b/],['blue',/\b(?:blue|cornflower|periwinkle|cobalt)\b/],['brown',/\b(?:brown|chocolate|espresso|chestnut|taupe|mushroom|tobacco)\b/],['tan',/\b(?:tan|beige|khaki|stone|camel|greige|sand)\b/],['rust',/\b(?:rust|orange|terracotta|cognac)\b/],['gold',/\b(?:gold|golden|bronze|ochre|mustard)\b/],['burgundy',/\b(?:burgundy|wine|oxblood)\b/],['red',/\bred\b/],['pink',/\b(?:pink|rose|mauve|fuchsia|magenta)\b/],['purple',/\b(?:purple|aubergine|plum)\b/],['sage',/\b(?:sage|pistachio)\b/],['green',/\b(?:green|mint|teal)\b/],['olive',/\bolive\b/],['black',/\bblack\b/],['white',/\bwhite\b/]];
 function colour(text,fallback){
  const s=String(text||'').toLowerCase();let best=null,pos=Infinity;
  for(const [f,re]of tokens){const m=s.match(re);if(m&&m.index<pos){best=f;pos=m.index;}}
  if(!best){if(fallback)return colour(fallback);return null;}
  let [h,v,t]=colourSpecs[best];
  if(/very dark|near.black/.test(s))v=Math.min(v,.7);
  else if(/medium.dark|mid.dark/.test(s))v=Math.min(v,2);
  else if(/\bdark\b|\bdeep\b/.test(s))v=Math.min(v,1.6);
  else if(/very pale|very light|ice|powder/.test(s))v=Math.max(v,4.5);
  else if(/\blight\b|\bpale\b/.test(s))v=Math.max(v,4);
  else if(/medium.light/.test(s))v=Math.max(v,3.6);
  return {family:best,hue:h,value:v,temperature:t,wording:text||fallback,measurement:false};
 }
 function secondaryColours(text){
  const s=Array.isArray(text)?text.join(';'):String(text||'');const out=[];
  for(const p of s.split(/[;,/]|\band\b/)){const c=colour(p);if(c&&!out.some(x=>x.family===c.family))out.push(c);}return out;
 }
 function pattern(r){
  const s=String(r.pattern_text||'').toLowerCase();
  if(!s)return null;
  let family=/near.solid|micro|tonal.*(?:honeycomb|paisley|geometric)|fine.*herringbone/.test(s)?'nearSolid':/stripe|regimental/.test(s)?'linear':/check|grid|plaid|lattice|houndstooth|windowpane|prince of wales|gingham|tattersall/.test(s)?'grid':/paisley|floral|scroll|vine/.test(s)?'organic':/horsebit|medallion|geometric|monogram|dot|motif|honeycomb|belt.buckle|outline print/.test(s)?'geometric':/solid/.test(s)?'solid':/herringbone|weave|textur/.test(s)?'nearSolid':null;
  if(!family)return null;
  const quiet=['solid','nearSolid'].includes(family);
  let scale=quiet?(family==='solid'?0:1):(typeof r.recorded_scale==='number'?r.recorded_scale:family==='linear'?1.5:family==='grid'?3:2.5);
  let contrast=quiet?(family==='solid'?0:1):(typeof r.recorded_contrast==='number'?r.recorded_contrast:2.5);
  const st=(s+' '+String(r.scale_text||'')).toLowerCase(),ct=(s+' '+String(r.contrast_text||'')).toLowerCase();
  if(!quiet){if(/bengal/.test(s))scale=3;else if(/fine|narrow|pencil|micro/.test(st))scale=1;else if(/oversized|large|bold/.test(st))scale=4;else if(/medium/.test(st))scale=2.5;
   if(/very low/.test(ct))contrast=.5;else if(/low.moderate|low.medium/.test(ct))contrast=1.5;else if(/moderate.high|medium.high/.test(ct))contrast=3.5;else if(/\bhigh\b|bold/.test(ct))contrast=4;else if(/\blow\b|tonal|subtle/.test(ct))contrast=1.5;else if(/moderate|medium/.test(ct))contrast=2.5;}
  const density=quiet?(family==='solid'?0:2):/dense|high.repeat|continuous/.test(st)?4:/spaced/.test(st)?1.5:2.5;
  return {family,scale,contrast,density,quiet,wording:r.pattern_text,feature_status:'proposed_normalization_not_physical_measurement'};
 }
 function normalize(r){
  const p=colour(r.primary_text,r.historical_fields_unchanged?.primary_color),a=secondaryColours(r.secondary_text);
  const pat=pattern(r),tex=String(r.texture_text||'').toLowerCase();
  const surface=!tex||/unknown|unconfirmed/.test(tex)&&!/appearance|visible|looking|like/.test(tex)?null:/pronounced.*sheen|lustrous|satin|high.sheen|shiny/.test(tex)?'lustrous':/nap|hairy|brushed|boucle|slub|dry woven|pronounced/.test(tex)?'pronounced':'restrained';
  const construction=String(r.construction_text||'').toLowerCase();
  const classicFoundation=['suit','blazer'].includes(r.category)?(!/safari|utility/.test(construction)&&!!construction):null;
  return {id:r.id,category:r.category,description:r.description,primary:p,accents:a,pattern:pat,surface,construction,classicFoundation,
   relaxedTailoring:r.category==='blazer'&&/unstructured|relaxed|linen/.test(construction+' '+tex),
   source:clone(r.source),asset_binding:r.asset_binding?clone(r.asset_binding):null,eligibility:clone(r.eligibility||{}),
   feature_evidence_status:'new_semantic_model_features_from_recorded_descriptions',fibre_composition:r.fibre_composition,
   source_wording:{primary:r.primary_text,secondary:r.secondary_text,pattern:r.pattern_text,texture:r.texture_text,construction:r.construction_text}};
 }
 function colourHarmony(a,b){
  if(!a?.primary||!b?.primary)return null;
  const x=a.primary,y=b.primary;let score,reason;
  if(x.hue===null||y.hue===null){score=8.6;reason='Neutral/chromatic relationship; no automatic perfect score.';}
  else{let d=Math.abs(x.hue-y.hue);d=Math.min(d,360-d);
   if(d<25){score=8.6;reason='Related hue; value and pattern separation assessed separately.';}
   else if(d<=65){score=8.8;reason='Adjacent hue relationship.';}
   else if(d>=125){score=9.2;reason='Controlled warm/cool or complementary opposition.';}
   else{score=8.3;reason='Separated hue families without a literal echo.';}}
  const bridge=a.accents.some(c=>c.family===y.family)||b.accents.some(c=>c.family===x.family);
  if(bridge)score+=.3;
  return {score:clamp(score),reason,bridge};
 }
 function valueSeparation(a,b){
  if(!a?.primary||!b?.primary)return null;
  const gap=Math.abs(a.primary.value-b.primary.value);
  return {score:gap<.4?4:gap<.9?6:gap<1.5?8:9.3,gap,reason:'Categorical lightness separation; not a measured luminance difference.'};
 }
 function dominance(p){if(!p?.pattern)return null;if(p.pattern.quiet)return 0;const a={suit:10,blazer:10,shirt:6,tie:3,pant_color_profile:10}[p.category]||5;
  return round(.4*p.pattern.scale*2+.25*p.pattern.contrast*2+.20*p.pattern.density*2+.15*a);}
 function patternPair(a,b){
  if(!a?.pattern||!b?.pattern)return null;
  const p=a.pattern,q=b.pattern;if(p.quiet||q.quiet)return {score:10,reason:'At least one operative surface is solid/near-solid; no two-major-pattern scale collision.',scale_gap:null,dominance_gap:null};
  const s=Math.abs(p.scale-q.scale),d=Math.abs(dominance(a)-dominance(b)),same=p.family===q.family;
  let score=same?(s<.75?4:s<1.5?6:8.5):(s<.75?7:9);
  if(d>=1.5)score=Math.min(10,score+.5);
  return {score,reason:same?'Repeated pattern family; scale and dominance separation evaluated.':'Different pattern families; no blanket prohibition by pattern count.',scale_gap:s,dominance_gap:d};
 }
 function hierarchy(profiles){
  if(profiles.some(x=>!x?.pattern))return null;
  const active=profiles.filter(x=>!x.pattern.quiet).map(p=>({id:p.id,value:dominance(p)})).sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id));
  if(!active.length)return {score:9,active,reason:'Quiet complete system; no competing major pattern.'};
  if(active.length===1)return {score:10,active,reason:'One clear major pattern.'};
  const gaps=active.slice(1).map((x,i)=>active[i].value-x.value),g=Math.min(...gaps);
  return {score:g<.75?5:g<1.5?7:9,active,gaps,reason:'Hierarchy, not number alone, determines the supporting-pattern assessment.'};
 }
 function pairScore(a,b,spec){
  const c=colourHarmony(a,b),p=patternPair(a,b),v=valueSeparation(a,b),h=hierarchy([a,b]);
  if(!c||!p||!v||!h)return {status:'unknown',score:null,reason:'Required colour/pattern semantic input is missing.'};
  const formal=a.construction&&b.category==='shirt'?9:a.construction&&b.category==='tie'?(/safari|utility/.test(a.construction)?6:9):null;
  const surface=a.surface&&b.surface?(a.surface==='pronounced'&&b.surface==='lustrous'||b.surface==='pronounced'&&a.surface==='lustrous'?7:9):null;
  const vals={color_harmony:c.score,pattern_compatibility:p.score,contrast_value:v.score,hierarchy:h.score,formality:formal,surface};
  let sum=0,coverage=0;for(const [k,w]of Object.entries(spec.new_choices.topwear_pair_weights)){if(vals[k]!==null){sum+=w*vals[k];coverage+=w;}}
  if(coverage<.85-1e-9)return {status:'unknown',score:null,coverage,subscores:vals};
  return {status:'new_component_estimate',score:round(sum/coverage),coverage:round(coverage),subscores:vals,reasons:[c.reason,p.reason,v.reason,h.reason],
   unknown_subfactors:Object.keys(vals).filter(k=>vals[k]===null),not_a_frozen_judgment:true};
 }
 function systemComponents(top,shirt,tie,pants){
  const all=[top,shirt,tie,pants].filter(Boolean),h=hierarchy(all);
  if(!h||all.some(p=>!p.primary))return {status:'unknown',reason:'Required complete-system DNA unavailable.'};
  const pairs=[];for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)pairs.push(colourHarmony(all[i],all[j]));
  const harmony=pairs.reduce((s,x)=>s+x.score,0)/pairs.length;
  const bridges=all.reduce((n,p)=>n+p.accents.filter(c=>all.some(q=>q.id!==p.id&&q.primary.family===c.family)).length,0);
  const bridge=bridges>=2?9.5:bridges===1?9:8.5;
  const gaps=tie?[valueSeparation(top,shirt),valueSeparation(shirt,tie)]:[valueSeparation(top,shirt)];
  if(pants)gaps.push(valueSeparation(top,pants));
  const val=gaps.reduce((s,x)=>s+x.score,0)/gaps.length;
  return {status:'new_component_estimate',color_bridge:bridge,palette_harmony:round(harmony),value_architecture:round(val),visual_hierarchy:h.score,
   hierarchy:h,palette:all.map(p=>({id:p.id,primary:p.primary.family,accents:p.accents.map(c=>c.family),value:p.primary.value})),
   evaluated_interactions:pairs.length,pant_included:!!pants,foundation_score_included:false,
   reason:'Active secondary colours, colour separation, value architecture and full-system hierarchy; no style/context/rotation bonus.'};
 }
 function conflicts(all,spec){
  if(all.some(p=>!p.primary||!p.pattern))return {assessed:false,status:'unknown',deduction:null,hard_reject:null,reasons:['Required semantic inputs missing.']};
  const reasons=[],d=spec.new_choices.conflict_deductions;let total=0,hard=false;
  // Assess each conflict once at system level; frozen ST numbers are never edited.
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
   const a=all[i],b=all[j],p=a.pattern,q=b.pattern;
   if(a.category==='shirt'&&b.category==='tie'||a.category==='tie'&&b.category==='shirt')continue;
   if(!p.quiet&&!q.quiet&&p.family===q.family&&p.contrast>=3&&q.contrast>=3&&Math.abs(p.scale-q.scale)<.75&&Math.abs(dominance(a)-dominance(b))<1.5){total+=d.competing_high_contrast_same_scale_geometry;reasons.push('Competing high-contrast similar-scale geometry: '+a.id+'/'+b.id);}
  }
  const a=all.filter(p=>!p.pattern.quiet).sort((a,b)=>dominance(b)-dominance(a));
  if(a.length>=3&&dominance(a[0])-dominance(a[1])<.75){total+=d.three_pattern_no_hierarchy;hard=true;reasons.push('Three or more major patterns with no dominant first/second separation.');}
  const vals=all.map(x=>x.primary.value);
  if(Math.max(...vals)<1.5&&Math.max(...vals)-Math.min(...vals)<.6){total+=d.dark_value_collapse;hard=true;reasons.push('Complete dark-value compression without a separating field.');}
  return {assessed:true,status:'new_rule_assessment',deduction:Math.min(d.total_cap,total),hard_reject:hard,reasons,not_a_recorded_historical_verdict:true};
 }
 function classifyStyle(top,shirt,tie,compatibility,accessories){
  if(!compatibility||compatibility.score===null)return {status:'unknown',classification:null,authorityGate:'unknown',outfit_style_score:null};
  if(compatibility.hard_conflict?.hard_reject||compatibility.status==='rejected'||compatibility.status==='requires_review')return {status:'fails_authority',classification:null,authorityGate:'fail',outfit_style_score:null};
  const modern=[];
  if(top.relaxedTailoring)modern.push({id:'relaxed_tailoring',source:top.source,controlled:true});
  if(shirt.surface==='lustrous')modern.push({id:'lustrous_shirt',source:shirt.source,controlled:true});
  if(!tie)modern.push({id:'open_collar',source:{source_id:'explicit_outfit_configuration'},controlled:true});
  const a=accessories||{};
  if(a.shoeStyle==='sneaker')modern.push({id:'sneakers',source:a.evidence||null,controlled:a.controlled!==false});
  if(a.statementWatch===true)modern.push({id:'statement_watch',source:a.evidence||null,controlled:a.controlled!==false});
  if((a.shoeStyle==='sneaker'||a.statementWatch)&&!a.evidence?.source_id)return {status:'unknown',classification:null,authorityGate:'unknown',outfit_style_score:null,reason:'Accessory style claims need provenance.'};
  const controlled=modern.every(x=>x.controlled),n=modern.length;
  const style=top.classicFoundation===true&&controlled&&n===0?'CLASSIC':top.classicFoundation===true&&controlled&&n>=1&&n<=2?'HYBRID':controlled&&(n>=3||top.classicFoundation===false)?'MODERN':null;
  return {status:style?'proposed_classification':'unknown',classification:style,authorityGate:style?'pass':'unknown',classic_foundation:top.classicFoundation,
   modern_interventions:modern,modern_intervention_count:n,outfit_style_score:null,compatibility_adjustment:0,
   rule:'Hybrid requires a classic foundation and one or two controlled modern elements; not a midpoint.',evidence_status:'new_outfit_classification_not_frozen_blazer_affinity'};
 }
 function contextCheck(context,top,shirt,tie,facts){
  const q=context||{},checks=[],f=facts||{};
  const occasions=['hospital','clinic','work','date','weekend','dinner'];
  if(q.occasion&&!occasions.includes(q.occasion))checks.push({axis:'occasion',status:'unknown',reason:'Unrecognized explicit occasion.'});
  if(q.occasion&&occasions.includes(q.occasion))checks.push({axis:'occasion',value:q.occasion,status:'specified',reason:'Setting retained. No workplace-specific dress code invented.'});
  if(q.requiredFormality==='tie_required')checks.push({axis:'requiredFormality',status:tie?'eligible':'ineligible',reason:'Explicit tie requirement.'});
  else if(q.requiredFormality==='suit_required')checks.push({axis:'requiredFormality',status:top.category==='suit'?'eligible':'ineligible',reason:'Explicit suit requirement.'});
  else if(q.requiredFormality&&!['open_collar_allowed','any'].includes(q.requiredFormality))checks.push({axis:'requiredFormality',status:'unknown',reason:'Unrecognized formality requirement.'});
  else if(q.requiredFormality)checks.push({axis:'requiredFormality',status:'eligible',reason:'No extra tie requirement specified.'});
  for(const [axis,key]of [['season','allowedSeasons'],['temperatureBand','allowedTemperatureBands'],['precipitation','allowedPrecipitation']]){
   if(q[axis]===undefined||q[axis]===null||q[axis]==='not_assessed')continue;
   const rec=f[key];
   if(!rec||!Array.isArray(rec.value)||!rec.evidence?.source_id)checks.push({axis,value:q[axis],status:'unknown',reason:'No evidenced suitability facts. Unknown is not rejection or approval.'});
   else checks.push({axis,value:q[axis],status:rec.value.includes(q[axis])?'eligible':'ineligible',evidence:clone(rec.evidence)});
  }
  return {status:checks.some(x=>x.status==='ineligible')?'ineligible':checks.some(x=>x.status==='unknown')?'unknown':checks.length?'eligible':'not_evaluated',
   context:clone(q),checks,compatibility_adjustment:0,scope:'Explicit requirements and supplied suitability facts only. No invented hospital/clinic dress codes.'};
 }
 function createEngine({featureInputs,spec,sourceEngine,rotationPolicy,logic}){
  if(!featureInputs?.records||!spec||!sourceEngine)throw TypeError('Features, explicit specification and source lookup engine are required.');
  const rows=clone(featureInputs.records),policy=clone(spec);const map=new Map();
  for(const k of ['topwear_pair_weights','ensemble_weights','no_tie_weights']){
   const w=policy.new_choices[k];if(!w||Object.values(w).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0)||Math.abs(Object.values(w).reduce((a,b)=>a+b,0)-1)>1e-9)throw Error('Invalid proposed weights: '+k);
  }
  if(JSON.stringify(policy.source_defined.tied_weights)!==JSON.stringify(weights))throw Error('Frozen outer ensemble weights cannot drift.');
  for(const r of rows){if(map.has(r.id))throw Error('Duplicate canonical ID '+r.id);map.set(r.id,normalize(r));}
  function get(id){return map.has(id)?clone(map.get(id)):null;}
  function evaluate(req){
   req=req||{};const top=map.get(req.topwearId),shirt=map.get(String(req.shirtId||'').replace(/^shirt-/,''));
   if(req.mode==='production'&&(policy.owner_approved!==true||policy.production_enabled!==true))return {status:'approval_required',score:null,reason_codes:['NEW_COMPONENT_SPECIFICATION_NOT_OWNER_APPROVED']};
   if(req.shirtId==='DS049'||req.shirtId==='shirt-DS049')return {status:'retired',score:null,reason_codes:['DS049_RETIRED']};
   if(!top||!shirt||!['suit','blazer'].includes(top.category)||shirt.category!=='shirt')return {status:'unknown',score:null,reason_codes:['CANONICAL_TOPWEAR_OR_SHIRT_ID_UNRESOLVED']};
   if(!Object.prototype.hasOwnProperty.call(req,'tieId'))return {status:'unknown',score:null,reason_codes:['TIE_CONFIGURATION_NOT_SPECIFIED_USE_NULL_FOR_NO_TIE']};
   const tie=req.tieId===null?null:map.get(req.tieId);
   if(req.tieId!==null&&(!tie||tie.category!=='tie'))return {status:'unknown',score:null,reason_codes:['TIE_ID_UNRESOLVED']};
   if(tie&&['DS040','DS041','DS042','DS043'].includes(shirt.id))return {status:'excluded',score:null,reason_codes:['OWNER_NO_TIE_RULE']};
   let pants=null,foundation=null;
   // Foundation is established before any blazer upper-body candidate is scored.
   if(top.category==='blazer'){
    pants=map.get(req.pantProfileId);if(!pants||pants.category!=='pant_color_profile')return {status:'unknown',score:null,reason_codes:['BLAZER_PANT_CANONICAL_PROFILE_REQUIRED_NO_PHYSICAL_ID_GUESS']};
    foundation=sourceEngine.lookupBlazerPant(top.id,pants.id);
    if(foundation.status!=='recorded')return {status:'unknown',score:null,foundation,reason_codes:['FOUNDATION_RECORD_UNAVAILABLE']};
    foundation=Object.assign({},foundation,{candidate_gate_minimum:policy.new_choices.blazer_foundation_minimum,candidate_gate_pass:foundation.score>=policy.new_choices.blazer_foundation_minimum,gate_threshold_status:'new_proposed_threshold_not_frozen_source_rule'});
    if(!foundation.candidate_gate_pass)return {status:'excluded_by_proposed_foundation',score:null,foundation,reason_codes:['PROPOSED_FOUNDATION_GATE_NOT_MET']};
   }
   const st=tie?sourceEngine.lookupShirtTie(shirt.id,tie.id,{versionPolicy:req.versionPolicy||'strict'}):{status:'not_applicable',score:null,reason_codes:['INDEPENDENT_NO_TIE_CONFIGURATION']};
   if(tie&&!usable.has(st.status))return {status:st.status,score:null,shirt_tie:st,foundation,reason_codes:['FROZEN_PAIR_UNUSABLE_NO_ESTIMATE_SUBSTITUTION']};
   if(tie&&st.score<74)return {status:st.score<60?'rejected':'requires_review',score:null,shirt_tie:st,foundation,reason_codes:['FROZEN_WEAK_OR_REJECTED_SHIRT_TIE_NOT_RESCUED']};
   const ss=pairScore(top,shirt,policy),tt=tie?pairScore(top,tie,policy):null,sys=systemComponents(top,shirt,tie,pants),hc=conflicts([top,shirt,tie,pants].filter(Boolean),policy);
   if(ss.score===null||tie&&tt.score===null||sys.status==='unknown'||!hc.assessed)return {status:'unknown',score:null,shirt_tie:st,foundation,components:{topwear_shirt:ss,topwear_tie:tt,ensemble:sys},hard_conflict:hc,reason_codes:['REQUIRED_COMPONENT_UNAVAILABLE_NO_OUTER_WEIGHT_RENORMALIZATION']};
   const ens=Object.entries(policy.new_choices.ensemble_weights).reduce((s,[k,w])=>s+w*sys[k],0);
   let raw,usedWeights,inputs;
   if(tie){usedWeights=weights;inputs={shirt_tie:st.score/10,topwear_shirt:ss.score,topwear_tie:tt.score,ensemble:ens};raw=Object.entries(usedWeights).reduce((s,[k,w])=>s+w*inputs[k],0);}
   else{usedWeights=policy.new_choices.no_tie_weights;inputs={topwear_shirt:ss.score,palette_harmony:sys.palette_harmony,value_architecture:sys.value_architecture,visual_hierarchy:sys.visual_hierarchy};raw=Object.entries(usedWeights).reduce((s,[k,w])=>s+w*inputs[k],0);}
   const score=round(clamp(raw-hc.deduction)),eligible=!hc.hard_reject&&score>=policy.new_choices.qualification_minimum;
   const result={status:hc.hard_reject?'rejected':eligible?'new_ensemble_estimate':'requires_review',score,display_score:round(score,1),scale_max:10,
    configuration:tie?'tied':'independent_no_tie',spec_id:policy.id,owner_approved_spec:false,production_enabled:false,
    ids:{topwear:top.id,shirt:shirt.id,tie:tie?tie.id:null,pant_profile:pants?pants.id:null},shirt_tie:st,foundation,
    components:{topwear_shirt:ss,topwear_tie:tt,ensemble:Object.assign({score:round(ens)},sys)},weights:clone(usedWeights),arithmetic_inputs:inputs,weighted_sum:round(raw),hard_conflict:hc,
    candidate_eligible:eligible,evidence_status:'new_component_estimates_with_read_only_recorded_ST_or_independent_no_tie',
    authoritative_ensemble_score:null,style_context_rotation_adjustment:0,final_ensemble_audit:{status:'rule_checked_not_owner_visual_certification',mandatory_human_visual_audit_not_claimed:true}};
   result.style=classifyStyle(top,shirt,tie,result,req.accessories);
   result.context=contextCheck(req.context,top,shirt,tie,req.suitabilityFacts);
   result.blazer_style_affinities=top.category==='blazer'?sourceEngine.getBlazerStyle(top.id):null;
   return result;
  }
  function rank(request){
   const q=request||{},top=map.get(q.topwearId);if(!top||!['suit','blazer'].includes(top.category))return {status:'unknown',ranked:[],reason_codes:['TOPWEAR_REQUIRED']};
   const shirts=q.shirtIds||rows.filter(r=>r.category==='shirt').map(r=>r.id);
   const ties=q.tieIds||rows.filter(r=>r.category==='tie').map(r=>r.id);
   if(!Array.isArray(shirts)||!Array.isArray(ties)||new Set(shirts).size!==shirts.length||new Set(ties).size!==ties.length)throw TypeError('Unique shirt/tie candidate lists required.');
   const ranked=[],unresolved=[],excluded=[],all=[];
   const tieChoices=q.configuration==='no_tie'?[null]:q.configuration==='both'?ties.concat([null]):ties;
   for(const s of shirts)for(const t of tieChoices){const r=evaluate({...q,shirtId:s,tieId:t});const entry={id:[q.topwearId,s,t||'NO_TIE',q.pantProfileId||'SUIT_TROUSERS'].join('|'),result:r};all.push(entry);
    if(r.candidate_eligible)ranked.push(entry);else if(['unknown','conflict','premise_mismatch','invalid','approval_required'].includes(r.status))unresolved.push({id:entry.id,status:r.status,reasons:r.reason_codes});else excluded.push({id:entry.id,status:r.status});}
   ranked.sort((a,b)=>b.result.display_score-a.result.display_score||a.id.localeCompare(b.id));
   let last=null,rnk=0;ranked.forEach((r,i)=>{if(r.result.display_score!==last)rnk=i+1;last=r.result.display_score;r.rank=rnk;});
   return {status:'candidate_ranking_not_frozen_top10',ranked:ranked.slice(0,q.limit||10),eligible_count:ranked.length,examined:all.length,unresolved,excluded,
    exhaustive_within_requested_universe:all.length===shirts.length*tieChoices.length,global_top10_certified:false,has_unresolved_candidates:unresolved.length>0,
    no_variety_bonus:true,compatibility_uses_style_context_rotation:false,all:q.includeAll===true?all:undefined};
  }
  function selectForContext(entries,history,opts){
   opts=opts||{};if(!Array.isArray(entries))throw TypeError('Candidate list required.');
   const keys=new Set();for(const e of entries){if(!e?.id||keys.has(e.id))throw Error('Duplicate or missing candidate ID');keys.add(e.id);}
   const styleMode=opts.style||'AUTO';if(!['AUTO','CLASSIC','HYBRID','MODERN'].includes(styleMode))return {status:'invalid',selected:null,reason_codes:['UNKNOWN_EXECUTIVE_STYLE_MODE']};
   const unknown=[],eligible=[];
   for(const e of entries){const r=e.result;if(!r?.candidate_eligible)continue;
    if(r.context.status==='unknown'||r.style.authorityGate==='unknown'||r.context.status==='not_evaluated'){unknown.push(e.id);continue;}
    if(r.context.status!=='eligible'||r.style.authorityGate!=='pass'||styleMode!=='AUTO'&&r.style.classification!==styleMode)continue;eligible.push(e);}
   if(!eligible.length)return {status:'no_fully_qualified_candidate',selected:null,unknown_candidates:unknown,compatibility_adjustment:0};
   if(!Array.isArray(history))return {status:'confirmed_history_not_supplied',selected:null,theoretical_best:clone(eligible.sort((a,b)=>b.result.display_score-a.result.display_score||a.id.localeCompare(b.id))[0]),unknown_candidates:unknown};
   if(eligible.some(e=>!e.items||!e.items.topwear||!e.items.shirt||e.result.ids.pant_profile&&!e.items.pants))return {status:'physical_item_bindings_required',selected:null,reason_codes:['COLOUR_PROFILES_ARE_NOT_PHYSICAL_WEAR_ITEMS']};
   const eventIds=new Set();
   for(const h of history){if(h?.confirmed===true){if(typeof h.id!=='string'||!h.id||eventIds.has(h.id))return {status:'invalid_confirmed_history',selected:null,reason_codes:['CONFIRMED_EVENT_IDS_MUST_BE_UNIQUE_NOT_SILENTLY_DEDUPLICATED']};eventIds.add(h.id);}}
   const candidates=eligible.map(e=>({id:e.id,items:e.items,compatibility:{status:'computed',score:e.result.display_score,gate:'pass'},ensembleAudit:{status:'pass'},context:{status:'eligible'},style:{authorityGate:'pass'}}));
   const res=logic.selectRotation(candidates,history,{localDate:opts.localDate,policy:rotationPolicy});
   return {status:res.selected?'candidate_selected_pending_spec_approval':res.status,selected:res.selected?clone(eligible.find(e=>e.id===res.selected.id)):null,rotation:res,unknown_candidates:unknown,
    compatibility_adjustment:0,production_enabled:false,scope:'Proposed model/rule audit; not an owner-certified aesthetic score or visual audit.'};
  }
  return Object.freeze({get,evaluate,rank,selectForContext,spec:clone(policy),ids:()=>rows.map(r=>({id:r.id,category:r.category,description:r.description}))});
 }
 return Object.freeze({version:'step3-completion-candidate.1',createEngine,normalize,colourHarmony,valueSeparation,patternPair,pairScore,systemComponents,conflicts,classifyStyle,contextCheck,weights});
});
