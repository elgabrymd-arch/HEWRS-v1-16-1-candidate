/* Preview-only automatic refill. Original automatic-engine.js stays frozen.
 * Retained rows are validated and count toward every original list constraint.
 * Only fresh rows are ranked; accepted option records are returned unchanged. */
/* V1.18.0 complete-outfit preference coordinator.
 * Original compatibility/index/eligibility is preserved. Preference and list
 * curation are explicitly separate and owner-authorized.
 * V1.17.0 complete-choice coordinator: Existing numerical engine, input data,
 * renderers, history identities and 0.2 near-equivalent rotation are unchanged.
 * Derived index accelerates enumeration; selected scores are always recalculated.
 * Environment is a separate eligibility domain, never an aesthetic score bonus.
 */
(function(root){'use strict';
const prior=root.HEWRSCleanConnection,copy=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};
const DEFAULT_REV='HEWRS_AUTOMATIC_WORKFLOW_1_24_0_HEURISTIC',cmp=(a,b)=>a<b?-1:a>b?1:0,stable=root.HEWRSConnectedContract.stable;
function create(inputs,options={}){
 const REV=options.revision||DEFAULT_REV;
 const base=prior.create(inputs),cat=base.catalogue,personal=(options.preferenceFactory||root.HEWRSOutfitPreference.create)(base);let ownerFeedback=null;
 // Suggestion exposure is a separate, optional ledger. It neither creates wear
 // events nor changes compatibility, personal preference, or the wear winner.
 let exposureStore=null;try{exposureStore=root.HEWRSTieExposure?.create(root.localStorage||null)||null;}catch{}
 const EXPOSURE_BAND=0.05;
 function setOwnerFeedback(value){need(value===null||value&&typeof value.refresh==='function'&&typeof value.match==='function'&&typeof value.assertCurrent==='function','Invalid owner feedback dependency.');ownerFeedback=value;return true;}
 function ownerStaticReasons(s,q){return root.HEWRSOutfitFeedback?.ownerRuleCheck?.(s,{context:q.context})?.reasons||[];}
 function compileOwnerFeedback(q){
  const occ=root.HEWRSOutfitFeedback?.occasion?.(q.context.occasion)||q.context.occasion,snap=ownerFeedback?ownerFeedback.refresh():null;
  const outfit=new Map(),clothing=new Map(),tie=new Map(),shirt_tie=new Map(),topwear_tie=new Map(),shirt=new Map(),topwear_shirt=new Map(),topwear_shirt_tie=new Map(),historical=new Map(),scopes={outfit,clothing,tie,shirt_tie,topwear_tie,shirt,topwear_shirt,topwear_shirt_tie};
  const add=(map,k,v)=>{if(!map.has(k))map.set(k,[]);map.get(k).push(v);};
  const fastKeys=s=>{const top=s.suitId||s.blazerId||s.topwearId||'SHIRT_ONLY',a=[top,s.pantId||'SUIT_TROUSERS',s.shirtId,s.state],c=a.join('|'),o=c+'|'+s.shoeId,h=o+'|'+(s.watchId||'NO_WATCH');return {clothing:c,outfit:o,historical:h,tie:s.state,shirt:s.shirtId,shirt_tie:s.shirtId+'|'+s.state,topwear_tie:top+'|'+s.state,topwear_shirt:top+'|'+s.shirtId,topwear_shirt_tie:top+'|'+s.shirtId+'|'+s.state};};
  for(const e of [...(snap?.active||[]),...(snap?.temporary||[])]){const eventOccasion=root.HEWRSOutfitFeedback.occasion(e.occasion);if(eventOccasion!=='all'&&eventOccasion!==occ)continue;const k=fastKeys(root.HEWRSOutfitFeedback.normal(e.selection));need(scopes[e.scope],'Unsupported rejection scope');add(scopes[e.scope],k[e.scope],{type:e.type==='temporary_skip'?'temporary_skip':'hide',id:e.id,reason:e.reason,scope:e.scope,occasion:eventOccasion});}
  for(const row of snap?.historical||[]){const eventOccasion=root.HEWRSOutfitFeedback.occasion(row.context.occasion);if(row.vote!=='neither'||eventOccasion!=='all'&&eventOccasion!==occ)continue;for(const x of [row.a,row.b])add(historical,fastKeys(root.HEWRSOutfitFeedback.normal(x)).historical,{type:'historical_neither',id:row.id,reason:null,scope:'historical_exact',occasion:eventOccasion,partition:row.partition});}
  function preWatch(s){
   const reasons=[...ownerStaticReasons(s,q)],k=fastKeys(s);
   if(s.suitId==='S01'&&s.shirtId==='DS029'&&s.state==='T024')reasons.push({type:'owner_core',id:'S01_DS029_T024',reason:null,scope:'clothing',occasion:'all'});
   for(const x of outfit.get(k.outfit)||[])reasons.push(x);
   for(const x of clothing.get(k.clothing)||[])reasons.push(x);
   for(const x of tie.get(k.tie)||[])reasons.push(x);
   for(const x of shirt_tie.get(k.shirt_tie)||[])reasons.push(x);
   for(const x of topwear_tie.get(k.topwear_tie)||[])reasons.push(x);
   for(const x of shirt.get(k.shirt)||[])reasons.push(x);
   for(const x of topwear_shirt.get(k.topwear_shirt)||[])reasons.push(x);
   for(const x of topwear_shirt_tie.get(k.topwear_shirt_tie)||[])reasons.push(x);
   return {allowed:reasons.length===0,reasons};
  }
  function tieAllowed(s){const k=fastKeys(s);return !tie.has(k.tie)&&!shirt_tie.has(k.shirt_tie)&&!topwear_tie.has(k.topwear_tie)&&!shirt.has(k.shirt)&&!topwear_shirt.has(k.topwear_shirt)&&!topwear_shirt_tie.has(k.topwear_shirt_tie);}
  // Broad exclusions apply before coverage representatives are chosen. Exact
  // shoe and watch exclusions remain at their original complete-outfit scope.
  const hasBroadExclusions=clothing.size||tie.size||shirt_tie.size||topwear_tie.size||shirt.size||topwear_shirt.size||topwear_shirt_tie.size;
  function clothingAllowed(e){if(!hasBroadExclusions)return true;const s={topwearId:e.group.topwearId,pantId:e.pantId,shirtId:e.row[0],state:e.row[1]};return tieAllowed(s)&&!clothing.has(fastKeys(s).clothing);}
  function watchSpecific(s){const rows=historical.get(fastKeys(s).historical)||[];return {allowed:rows.length===0,reasons:rows};}
  function match(s){const a=preWatch(s);if(!a.allowed)return a;const b=watchSpecific(s);return b.allowed?a:{allowed:false,reasons:b.reasons};}
  return {token:snap?.token||null,preWatch,watchSpecific,match,tieAllowed,clothingAllowed};
 }
 const sourceResults=new Map();function sourceResult(e,q){const k=[e.group.topwearId,e.group.pantProfileId,e.row[0],e.row[1],q.context.occasion,q.context.requiredFormality].join('|');if(!sourceResults.has(k)){if(sourceResults.size>5000)sourceResults.clear();sourceResults.set(k,base.engine.evaluate(requestFor(e,q)));}return sourceResults.get(k);}
 let index;
 function requireIndex(){index=root.HEWRS_OPTION_INDEX;
  need(index,'Outfit index is not loaded yet. Use Generate Options to load it.');
 need(index?.schema==='hewrs.derived-clothing-index.v1_17_0'&&index.source_input_sha256===root.HEWRS_INPUT_SHA256,'Clothing index is incompatible with current DNA');
 need(index.current_source_revision===root.HEWRSSourceCorrections.revision,'Current owner source and numerical cache differ; install the complete update.');
 need(index.normalization_revision===root.HEWRSEnsembleCompletion.normalizationRevision&&index.normalization_revision==='hewrs.literal-colour-qualifiers.v1_17_3','Mixed clothing index/colour engine versions. Reload the complete update; no old cached scores will be used.');
  index=root.HEWRSShirtSourceRecovery.extendIndex(root.HEWRSAdditionalBlazers.extendIndex(index,base),base);return index;
 }
 if(root.HEWRS_OPTION_INDEX)requireIndex();
 const tops=new Map(),shirts=new Map(cat.shirts.map(i=>[i.id,i])),ties=new Map(cat.ties.map(i=>[i.id,i])),shoes=new Map(cat.shoes.filter(i=>!i.disabled&&Object.hasOwn(base.shoeLayers,i.id)).map(i=>[i.id,i])),watches=new Map(cat.watches.filter(i=>!i.disabled&&!/reserved|placeholder|unresolved|current collection/i.test((i.name||'')+' '+(i.color||''))).map(i=>[i.id,i])),pants=new Map();
 for(const sid of base.suitSources.ids){const item=cat.suits.find(x=>x.id===base.aliases.get(sid));tops.set(sid,item);}
 for(const bid of base.blazerConnection.availableIds){const item=cat.blazers.find(x=>x.id===base.blazerConnection.knownBlazer(bid).historyId);tops.set(bid,item);}
 for(const id of base.blazerConnection.pantIds){const d=base.blazerConnection.knownPant(id);pants.set(id,cat.pants.find(p=>p.id===d.historyId));}
 const features=new Map([...base.features.keys()].map(id=>[id,base.engine.get(id)]));
 const enrich=(item,id)=>item?{...item,_feature:features.get(id),_family:features.get(id)?.primary.family,_weatherText:features.get(id)?.source_wording?.texture||''}:null;
 function normalizePrefs(p){need(p&&typeof p==='object','Missing category preferences');const keys=['topwear','shirt','tie','shoes','bottoms','watch'];need(Object.keys(p).length===6&&keys.every(k=>Object.hasOwn(p,k)),'Incomplete six-category preferences');
  for(const k of keys){const v=p[k];need(v&&['any','item','family','none'].includes(v.mode)&&Object.keys(v).every(x=>['mode','id'].includes(x)),'Invalid '+k+' preference');if(v.mode==='none')need(['tie','watch'].includes(k),'No '+k+' cannot be selected');if(v.mode==='family')need(['shirt','tie'].includes(k)&&typeof v.id==='string','Unsupported family constraint');if(v.mode==='item'){const known=k==='topwear'?[...tops.values()].some(t=>t.id===v.id):k==='shirt'?shirts.has('shirt-'+v.id):k==='tie'?ties.has(v.id):k==='shoes'?shoes.has(v.id):k==='bottoms'?pants.has(v.id):watches.has(v.id);need(known,'Unknown or unsupported exact '+k+' ID: '+v.id);}}
  return copy(p);
 }
 function prepare(config){const p=normalizePrefs(config.preferences),context=root.HEWRSStyleOccasions.context({occasion:config.occasion||'work',requiredFormality:config.formality||'any'});
  need(['any','tie_required','suit_required','open_collar_allowed'].includes(context.requiredFormality),'Unknown formality requirement');need(root.HEWRSWeather&&root.HEWRSWeather.validate,'Missing environment implementation');need(root.HEWRSLocalState.date(config.localDate),'Invalid outfit date');
  const fitted=personal.learningStatus?.();need(!fitted?.active||(fitted.context_scope?.occasion||'work')===context.occasion,'Learning context differs from the requested occasion; refresh this occasion’s model before generating.');
  const env=root.HEWRSWeather.validate(config.environment||{source:'not_assessed',date:config.localDate});need(root.HEWRSWeather.fresh(env,config.localDate),'Weather is stale or for another date; refresh Weather or use manual conditions');
  need(['AUTO','CLASSIC','HYBRID','MODERN'].includes(config.style||'AUTO'),'Unknown style');return {automatic:true,revision:REV,source_lock:root.HEWRS_INPUT_SHA256,current_source_revision:root.HEWRSSourceCorrections.revision,shirt_source_recovery_revision:root.HEWRSShirtSourceRecovery.revision,local_learning_id:personal.learningStatus?.().id||null,prefs:p,context,localDate:config.localDate,environment:env,executiveStyle:config.style||'AUTO',dressMode:root.HEWRSStyleOccasions.dressMode(context.occasion),style_policy_revision:root.HEWRSStyleOccasions.revision,limit:root.HEWRSOptionSetPolicy.target,sneakerStance:p.shoes.mode==='item'&&shoes.get(p.shoes.id)?.subcategory==='Sneakers'};
 }
 function valid(q){need(q?.automatic===true&&q.revision===REV&&q.source_lock===root.HEWRS_INPUT_SHA256,'Unknown automatic request');const p=prepare({preferences:q.prefs,occasion:q.context?.occasion,formality:q.context?.requiredFormality,localDate:q.localDate,environment:q.environment,style:q.executiveStyle});need(stable(p)===stable(q),'Malformed or changed automatic request');return p;}
 function matchesPref(v,id,family){return v.mode==='any'||v.mode==='item'&&v.id===id||v.mode==='family'&&v.id===family||v.mode==='none'&&id===null;}
 function clothingFits(group,row,q){const t=tops.get(group.topwearId),p=q.prefs;if(!t)return false;if(p.topwear.mode==='item'&&p.topwear.id!==t.id)return false;if(p.bottoms.mode==='item'&&p.topwear.mode!=='item'&&t.formal)return false;
  const sf=features.get(row[0])?.primary.family,tf=row[1]==='NO_TIE'?null:ties.get(row[1])?.colorFamily;
  if(!(p.shirt.mode==='family'?personal.matchesFamily(row[0],p.shirt.id):matchesPref(p.shirt,row[0],sf))||!(p.tie.mode==='family'?(row[1]!=='NO_TIE'&&personal.matchesFamily(row[1],p.tie.id)):matchesPref(p.tie,row[1]==='NO_TIE'?null:row[1],tf)))return false;
  if(q.context.requiredFormality==='tie_required'&&row[1]==='NO_TIE'||q.context.requiredFormality==='suit_required'&&!t.formal)return false;return true;
 }
 function selection(e,shoe,watch){return e.group.topwearId[0]==='S'?{suitId:e.group.topwearId,shirtId:e.row[0],state:e.row[1],shoeId:shoe.id,watchId:watch?.id??null}:{blazerId:e.group.topwearId,pantId:e.pantId,shirtId:e.row[0],state:e.row[1],shoeId:shoe.id,watchId:watch?.id??null};}
 function fullItems(e,shoe,watch){return {topwear:tops.get(e.group.topwearId),shirt:shirts.get('shirt-'+e.row[0]),tie:e.row[1]==='NO_TIE'?null:ties.get(e.row[1]),pants:e.pantId?pants.get(e.pantId):null,shoes:shoe,watch};}
 function requestFor(e,q,accessories){return {topwearId:e.group.topwearId,shirtId:e.row[0],tieId:e.row[1]==='NO_TIE'?null:e.row[1],...(e.group.pantProfileId?{pantProfileId:e.group.pantProfileId}:{}),context:q.context,versionPolicy:'strict',...(accessories?{accessories}:{})};}
 const evidence=(shoe,watch)=>({shoeStyle:shoe.subcategory==='Sneakers'?'sneaker':'other',statementWatch:false,controlled:true,evidence:{source_id:'CURRENT_CLOTHING_AND_FOOTWEAR_STYLE',shoe_id:shoe.id,evidence_status:'inherited_rule_inference_not_owner_measurement'}});
 function weatherItems(e,shoe,watch){return {topwear:enrich(tops.get(e.group.topwearId),e.group.topwearId),shirt:enrich(shirts.get('shirt-'+e.row[0]),e.row[0]),tie:e.row[1]==='NO_TIE'?null:enrich(ties.get(e.row[1]),e.row[1]),pants:e.pantId?pants.get(e.pantId):null,shoes:shoe,watch};}
 function detail(e,q,shoe,watch){const a=evidence(shoe,watch),r=base.engine.evaluate(requestFor(e,q,a));need(r.score===e.row[2]&&r.display_score===e.row[3]&&r.candidate_eligible,'Clothing cache does not match unchanged source engine');return r;}
 function outfitID(s){return [s.suitId||s.blazerId||'SHIRT_ONLY',s.pantId||'SUIT_TROUSERS',s.shirtId,s.state,s.shoeId,s.watchId||'NO_WATCH'].join('|');}
 const replacementFields=['suitId','blazerId','shirtOnly','pantId','shirtId','state','shoeId','watchId'],replacementRoles={shirt:'shirtId',tie:'state',shoes:'shoeId'};
 function replacementConstraint(value,parts){
  if(value===null){need(parts===null,'Replacement parts require an original outfit.');return null;}
  need(Array.isArray(parts)&&parts.length>0&&new Set(parts).size===parts.length&&parts.every(p=>Object.hasOwn(replacementRoles,p)),'Invalid replacement parts.');
  parts=['shirt','tie','shoes'].filter(p=>parts.includes(p));need(['shirt','tie','shirt,tie','shoes'].includes(parts.join(',')),'Unsupported replacement part combination.');
  const original=copy(base.validateSelection(value));need(original.suitId||original.blazerId,'Targeted replacement requires a supported suit or blazer outfit.');
  if(parts.includes('tie'))need(/^T\d{3}$/.test(original.state),'Tie replacement requires an actual tie.');
  const changed=parts.map(p=>replacementRoles[p]);
  return {original,parts,changed,preserved:replacementFields.filter(k=>!changed.includes(k))};
 }
 function replacementFits(s,replacement){return replacement.preserved.every(k=>(s[k]??null)===(replacement.original[k]??null))&&replacement.changed.every(k=>s[k]!==replacement.original[k])&&(!replacement.parts.includes('tie')||/^T\d{3}$/.test(s.state));}
 function clothingFitsReplacement(e,replacement){
  if(!replacement)return true;const s=replacement.original,parts=replacement.parts;
  return e.group.topwearId===(s.suitId||s.blazerId)&&(e.pantId||null)===(s.pantId||null)&&
   (parts.includes('shirt')?e.row[0]!==s.shirtId:e.row[0]===s.shirtId)&&
   (parts.includes('tie')?e.row[1]!==s.state&&/^T\d{3}$/.test(e.row[1]):e.row[1]===s.state);
 }
 function replacementReason(replacement,q,added){
  const name=replacement.parts.join(' and '),singular=replacement.parts.length===1&&name!=='shoes',verb=singular?'is':'are';
  if(added)return 'Changed only the '+name+'. All other garments and accessories were retained.';
  const exact=replacement.parts.filter(p=>q.prefs[p].mode==='item');
  if(exact.length)return 'No different '+name+' can be selected while the original '+exact.join(' and ')+' '+(exact.length===1&&exact[0]!=='shoes'?'is an exact selection':'are exact selections')+'. The remaining outfits were retained.';
  return 'No compatible different '+name+' '+verb+' available with the accepted pieces under the current selections and list limits. The remaining outfits were retained.';
 }
 function shoeCandidates(q,work){
  const replacement=work.replacement,replaceShoes=replacement?.parts.includes('shoes');
  const rows=replacement&&!replaceShoes?[shoes.get(replacement.original.shoeId)]:q.prefs.shoes.mode==='item'?[shoes.get(q.prefs.shoes.id)]:[...shoes.values()];
  return rows.filter(item=>item&&matchesPref(q.prefs.shoes,item.id)&&(!replaceShoes||item.id!==replacement.original.shoeId));
 }
 function watchCandidates(q,work){
  const original=work.replacement?.original;
  const rows=original?[original.watchId?watches.get(original.watchId):null]:q.prefs.watch.mode==='none'?[null]:q.prefs.watch.mode==='item'?[watches.get(q.prefs.watch.id)]:[...watches.values()];
  return rows.filter(item=>item!==undefined&&matchesPref(q.prefs.watch,item?.id??null));
 }
 const styleFeasibility=new Map();
 function canMatchStyle(e,q,r,work){if(q.executiveStyle==='AUTO')return true;
  const key=[e.group.topwearId,e.row[0],e.row[1]==='NO_TIE',q.executiveStyle,q.dressMode,q.context.requiredFormality,q.sneakerStance,q.prefs.shoes.mode==='item'?q.prefs.shoes.id:'ALL_REGISTERED'].join('|');
  let cached=styleFeasibility.get(key);
  if(!cached){
   const candidates=q.prefs.shoes.mode==='item'?[shoes.get(q.prefs.shoes.id)]:[...shoes.values()];
   const available=candidates.filter(sh=>!root.HEWRSLegacyAccessories.shoe(sh,weatherItems(e,sh,null),q,r).rejected);
   const shoeTypes=[...new Set(available.map(x=>x.subcategory==='Sneakers'?'sneaker':'other'))],profiles=[];
   for(const shoeStyle of shoeTypes){const st=root.HEWRSEnsembleCompletion.classifyStyle(features.get(e.group.topwearId),features.get(e.row[0]),e.row[1]==='NO_TIE'?null:features.get(e.row[1]),r,{shoeStyle,controlled:true,evidence:{source_id:'ACTUAL_ELIGIBLE_FOOTWEAR_TYPES'}});if(st.authorityGate==='pass')profiles.push({classification:st.classification,classic_foundation:st.classic_foundation,modern_intervention_count:st.modern_intervention_count});}
   cached={matches:profiles.some(st=>st.classification===q.executiveStyle),profiles};styleFeasibility.set(key,cached);
  }
  for(const p of cached.profiles)work?.styleProfiles?.set(JSON.stringify(p),p);
  return cached.matches;
 }
 function resolveCandidate(e,q,history,worn,capacity=null,reject=null,work={watches:new Map()}){if(!work.ownerFeedback.tieAllowed({topwearId:e.group.topwearId,shirtId:e.row[0],state:e.row[1]})){reject?.('OWNER_FEEDBACK');return null;}const r=sourceResult(e,q);if(!r.candidate_eligible||r.context.status!=='eligible'){reject?.('SOURCE_OR_FORMALITY_HOLD');return null;}need(r.score===e.row[2]&&r.display_score===e.row[3],'Source-index score mismatch');if(!canMatchStyle(e,q,r,work)){reject?.('STYLE_LOCK');return null;}
  const top=weatherItems(e,null,null),policy=root.HEWRSLegacyAccessories;
  const pref=e.preference||(e.preference=personal.clothing(e.group.topwearId,e.row[0],e.row[1],e.pantId,e.row[2],q));
  const tieOrder=(a,b)=>cmp(worn.get(a.item.id)||'',worn.get(b.item.id)||'')||cmp(a.item.id,b.item.id);
  // Do not retain 35 accessory records on every inspected clothing candidate.
  // Only the final curation working set needs them across capacity rounds.
  let choices=e.shoeChoices;
  if(!choices){choices=shoeCandidates(q,work).map(item=>{const sp=personal.shoe(item,pref,q);return {item,assessment:policy.shoe(item,top,q,r),personal:sp,preferenceOrder:personal.accessoryOrderScore?personal.accessoryOrderScore(pref,sp):sp.score};});if(capacity&&!e.expandedSource)e.shoeChoices=choices;}
  let pool=choices.filter(x=>!x.assessment.rejected&&(!capacity||capacity.canUse(x.item.id))).sort((a,b)=>(b.preferenceOrder-a.preferenceOrder)||tieOrder(a,b));
  if(!pool.length)reject?.('SHOE_LOCK_OR_SUITABILITY');
  const rejectedWeather=new Set();let hadWeatherPass=false,hadStylePass=false;
  for(const sh of pool){
   const sty=root.HEWRSEnsembleCompletion.classifyStyle(features.get(e.group.topwearId),features.get(e.row[0]),e.row[1]==='NO_TIE'?null:features.get(e.row[1]),r,evidence(sh.item,null));
   if(sty.authorityGate!=='pass'||q.executiveStyle!=='AUTO'&&q.executiveStyle!==sty.classification)continue;hadStylePass=true;
   const wi={...top,shoes:sh.item},env=root.HEWRSWeather.assess(wi,q.environment,q.context);if(!env.eligible){for(const msg of env.reasons||[])rejectedWeather.add(msg);if(!env.reasons?.length)rejectedWeather.add('Weather-domain score is below the existing minimum');continue;}hadWeatherPass=true;
   const beforeWatch=selection(e,sh.item,null),ownerPre=work.ownerFeedback.preWatch(beforeWatch);if(!ownerPre.allowed){reject?.('OWNER_FEEDBACK');continue;}
   // Original watch functions depend on topwear, tie and shoe metadata, plus
   // the preference model's busy-pattern and warm-palette flags. Shirt/pant
   // identities are not watch inputs. The full IDs below safely over-key the
   // legacy policy; no capacity/history decision is cached.
   const wk=[e.group.topwearId,e.row[1],sh.item.id,pref.components.pattern_hierarchy<8.5,/warm/.test(pref.profiles.topwear.primary.temperature)].join('|');
   let choices=work.watches.get(wk);
   if(!choices){choices=watchCandidates(q,work).map(item=>({item,assessment:item?policy.watch(item,wi,q):null,personal:personal.watch(item,pref,q)}));
    if(work.watches.size>=4096)work.watches.delete(work.watches.keys().next().value);work.watches.set(wk,choices);}
   const wpool=choices.filter(x=>(!x.assessment||!x.assessment.rejected)&&(!capacity||!x.item||capacity.canUse(x.item.id))).sort((a,b)=>b.personal.score-a.personal.score||tieOrder(a,b));
   for(const w of wpool){
    const s=selection(e,sh.item,w.item);base.validateSelection(s);const om=work.ownerFeedback.watchSpecific(s);if(!om.allowed){reject?.('OWNER_FEEDBACK');continue;}return {id:outfitID(s),selection:s,items:fullItems(e,sh.item,w.item),result:{candidate_eligible:true,display_score:r.display_score,score:r.score,ids:r.ids,context:r.context,style:sty},entry:e,environment:env,preference:personal.complete(pref,sh.personal,w.personal),accessory:{shoe:sh.assessment,watch:w.assessment,personal_shoe:sh.personal,personal_watch:w.personal}};
   }
  }if(!hadStylePass&&pool.length){reject?.('STYLE_LOCK');}else if(!hadWeatherPass&&pool.length){reject?.('WEATHER');for(const msg of rejectedWeather)reject?.('WEATHER: '+msg);}else if(pool.length)reject?.('WATCH_OR_STYLE_LOCK');return null;
 }
 function approvalMatchesEntry(a,e){
  const o=a?.outfit||{};return (o.topwear||null)===e.group.topwearId&&(o.pants||null)===(e.pantId||null)&&o.shirt===e.row[0]&&(o.tie||'NO_TIE')===e.row[1];
 }
 function resolveApprovedCandidate(e,q,approval,worn,work){
  const r=sourceResult(e,q);if(!r.candidate_eligible||r.context.status!=='eligible'||!canMatchStyle(e,q,r,work))return null;
  const shoe=shoes.get(approval?.outfit?.shoe);if(!shoe||!shoeCandidates(q,work).some(item=>item.id===shoe.id))return null;
  const top=weatherItems(e,null,null),pref=e.preference||(e.preference=personal.clothing(e.group.topwearId,e.row[0],e.row[1],e.pantId,e.row[2],q)),policy=root.HEWRSLegacyAccessories;
  const sh={item:shoe,assessment:policy.shoe(shoe,top,q,r),personal:personal.shoe(shoe,pref,q)};if(sh.assessment.rejected)return null;
  const sty=root.HEWRSEnsembleCompletion.classifyStyle(features.get(e.group.topwearId),features.get(e.row[0]),e.row[1]==='NO_TIE'?null:features.get(e.row[1]),r,evidence(shoe,null));
  if(sty.authorityGate!=='pass'||q.executiveStyle!=='AUTO'&&q.executiveStyle!==sty.classification)return null;
  const wi={...top,shoes:shoe},env=root.HEWRSWeather.assess(wi,q.environment,q.context);if(!env.eligible)return null;
  if(!work.ownerFeedback.preWatch(selection(e,shoe,null)).allowed)return null;
  const choices=watchCandidates(q,work).map(item=>({item,assessment:item?policy.watch(item,wi,q):null,personal:personal.watch(item,pref,q)}));
  const tieOrder=(a,b)=>cmp(worn.get(a.item?.id)||'',worn.get(b.item?.id)||'')||cmp(a.item?.id||'',b.item?.id||'');
  const w=choices.filter(x=>!x.assessment||!x.assessment.rejected).sort((a,b)=>b.personal.score-a.personal.score||tieOrder(a,b))[0];if(!w)return null;
  const sel=selection(e,shoe,w.item);base.validateSelection(sel);if(!work.ownerFeedback.watchSpecific(sel).allowed)return null;
  return {id:outfitID(sel),selection:sel,items:fullItems(e,shoe,w.item),result:{candidate_eligible:true,display_score:r.display_score,score:r.score,ids:r.ids,context:r.context,style:sty},entry:e,environment:env,preference:personal.complete(pref,sh.personal,w.personal),accessory:{shoe:sh.assessment,watch:w.assessment,personal_shoe:sh.personal,personal_watch:w.personal},owner_approval:copy(approval)};
 }
 function* steps(q,catalogue,history,retainedOptions=null,replaceFor=null,replaceParts=null){requireIndex();const work={watches:new Map(),styleProfiles:new Map(),ownerFeedback:compileOwnerFeedback(q)};valid(q);need(stable(catalogue)===stable(cat),'Catalogue does not match current source');need(Array.isArray(history),'Confirmed history must be supplied');const ownerFeedbackToken=work.ownerFeedback.token;
  const exposure=exposureStore?.refresh()||{ok:false,error:'Suggestion history is unavailable.'},exposureCounts=exposure.ok?(exposure.counts[q.context.occasion]||{}):{};
  const wearCheck=root.HEWRSLocalState.create(base,root.HEWRS_INPUT_SHA256,null);wearCheck.validate({schema:root.HEWRSLocalState.SCHEMA,source_lock:root.HEWRS_INPUT_SHA256,revision:0,session:null,events:history});
  const refilling=retainedOptions!==null;
  need(!refilling||Array.isArray(retainedOptions),'Retained options must be a list');
  const retainedRows=retainedOptions||[],retained=[],capacity=root.HEWRSOptionSetPolicy.create(q);
  work.replacement=replacementConstraint(replaceFor,replaceParts);const replacing=!!work.replacement;
  if(replacing)need(refilling,'Targeted replacement requires the existing accepted option list.');
  // This is a one-off replacement constraint, not a new persistent preference.
  // It restricts only appended rows; retained records keep their original request.
  const refillLimit=replacing?Math.min(q.limit,retainedRows.length+1):q.limit;
  const targetedReason=added=>replacementReason(work.replacement,q,added);
  need(retainedRows.length<=q.limit,'Too many retained options');
  for(const option of retainedRows){
   need(verify(option,q,catalogue),'A retained option no longer matches this request');
   const a=option._hewrsConnected,s=a.canonical_selection;
   need(work.ownerFeedback.match(s).allowed,'A retained option was rejected');
   capacity.add(option);
   const group=index.groups.find(g=>g.topwearId===(s.suitId||s.blazerId)&&g.pantProfileId===(s.pantId?base.trouserProfiles.binding(s.pantId)?.profileId:null));
   const row=group.rows.find(r=>r[0]===s.shirtId&&r[1]===s.state),pantId=s.pantId||null;
   const entry={group,row,pantId,key:[tops.get(group.topwearId).id,'shirt-'+row[0],row[1],pantId?pants.get(pantId).id:'SUIT_TROUSERS'].join('|'),preference:personal.clothing(group.topwearId,row[0],row[1],pantId,row[2],q)};
   retained.push({retainedOption:option,id:a.id,selection:s,items:option.items,entry,preference:a.preference,result:a.compatibility,owner_approval:a.owner_approval});
  }
  const tieAudit=Object.fromEntries([...ties.keys(),'NO_TIE'].map(id=>[id,{id,matching_rows:0,source_eligible_clothing:0,source_holds:{},complete_evaluated:0,eligible_complete:0,rejection_reasons:{},best_complete:null,retained_candidates:0,selected_count:0}]));
  const diagnostics={tie_coverage:tieAudit,enumerated:0,examined:0,score_statuses:{},weather_style_or_accessory_holds:0,unbound_trouser_ids:[],numeric_candidates:0,domain_evaluated:0,rejection_reasons:{},preference_revision:personal.revision,
   tie_exposure:{available:exposure.ok,occasion:q.context.occasion,prior_counts:copy(exposureCounts),event_count:exposure.eventCount||0,started_at:exposure.startedAt||null,quality_band:EXPOSURE_BAND,reranked_choices:0,error:exposure.ok?null:exposure.error,meaning:'Suggestions in successfully displayed lists for this occasion, not actual wear. Only near-equal tied alternatives can change list curation; recommendation and owner-approved priority are unchanged.'}};
  if(replacing){diagnostics.component_replacement={original:copy(work.replacement.original),parts:copy(work.replacement.parts),maximum_additions:1,preserved_roles:copy(work.replacement.preserved),outside_replacement_scope:0};if(work.replacement.parts.join(',')==='tie')diagnostics.tie_replacement=diagnostics.component_replacement;}
  // Count EVERY indexed source match and retain exact identities. Limit
  // expensive preference evaluations to a stable garment-diverse shortlist.
  // Owner approvals are recovered separately from the complete source.
  const rawCandidates=[],coverage=new Map(),sampled=[];
  diagnostics.source_eligible_before_feedback=0;diagnostics.feedback_excluded_clothing=0;
  function strongerSource(a,b){return a.row[2]>b.row[2]||a.row[2]===b.row[2]&&cmp(a.key,b.key)<0;}
  for(const group of index.groups){let ps=[null];if(group.pantProfileId)ps=base.trouserProfiles.boundIds.filter(id=>base.trouserProfiles.binding(id).profileId===group.pantProfileId&&(q.prefs.bottoms.mode!=='item'||id===q.prefs.bottoms.id));
   for(const row of group.rows){if(!clothingFits(group,row,q))continue;for(const pid of ps){diagnostics.enumerated++;diagnostics.score_statuses[row[5]]=(diagnostics.score_statuses[row[5]]||0)+1;const ta=tieAudit[row[1]];if(ta)ta.matching_rows++;if(!row[4]){if(ta)ta.source_holds[row[5]]=(ta.source_holds[row[5]]||0)+1;continue;}if(ta)ta.source_eligible_clothing++;
    const e={group,row,pantId:pid,key:[tops.get(group.topwearId).id,'shirt-'+row[0],row[1],pid?pants.get(pid).id:'SUIT_TROUSERS'].join('|')};
    if(!clothingFitsReplacement(e,work.replacement)){diagnostics.component_replacement.outside_replacement_scope++;continue;}
    diagnostics.source_eligible_before_feedback++;
    if(!work.ownerFeedback.clothingAllowed(e)){diagnostics.feedback_excluded_clothing++;if(ta)ta.feedback_excluded_clothing=(ta.feedback_excluded_clothing||0)+1;continue;}
    rawCandidates.push(e);
    const tags=[group.topwearId+'|shirt|'+row[0]+'|'+(row[1]==='NO_TIE'),group.topwearId+'|tie|'+row[1],group.topwearId+'|pants|'+(pid||'SUIT_TROUSERS'),group.topwearId+'|profile|'+(group.pantProfileId||'SUIT_TROUSERS')];
    for(const tag of tags){const previous=coverage.get(tag);if(!previous||strongerSource(e,previous))coverage.set(tag,e);}
    // FNV-1a over exact owned IDs; no brand or garment popularity weighting.
    let hash=2166136261;for(let j=0;j<e.key.length;j++)hash=Math.imul(hash^e.key.charCodeAt(j),16777619)>>>0;
    if((hash&63)===0)sampled.push(e);
   }}yield {phase:'complete-outfit-profiles',examined:diagnostics.enumerated};
  }
  if(q.prefs.bottoms.mode==='item'&&!base.trouserProfiles.binding(q.prefs.bottoms.id))diagnostics.unbound_trouser_ids.push(q.prefs.bottoms.id);
  let candidates=[...new Set([...coverage.values(),...sampled])];
  const scoredKeys=new Set();
  function scoreClothing(e){if(scoredKeys.has(e.key))return;const pref=e.preference||personal.clothing(e.group.topwearId,e.row[0],e.row[1],e.pantId,e.row[2],q);e.preference=pref;e.preferenceUpper=personal.maximumComplete(pref.score,pref);scoredKeys.add(e.key);}
  for(let i=0;i<candidates.length;i++){const e=candidates[i];scoreClothing(e);
   if(i%512===0)yield {phase:'scoring-shortlisted-clothing',examined:i+1,total:candidates.length};
  }
  diagnostics.numeric_candidates=rawCandidates.length;diagnostics.preference_evaluated=candidates.length;
  diagnostics.bounded_source_review={source_eligible:diagnostics.source_eligible_before_feedback,after_broad_feedback:rawCandidates.length,feedback_excluded_clothing:diagnostics.feedback_excluded_clothing,initial_scored:candidates.length,scored:candidates.length,method:'Broad saved clothing/tie/pair exclusions precede deterministic exact-ID sampling and garment coverage. If the shortlist cannot fill the list, previously unreviewed source rows are assessed in cancellable batches.',exact_owner_approvals_searched_against_full_source:true,global_optimum_claimed:false};
  const distinct=fn=>new Set(rawCandidates.map(fn).filter(x=>x!==null)).size;
  const sourceCapacity={topwear:q.prefs.topwear.mode==='item'?q.limit:2*distinct(e=>e.group.topwearId),shirt:q.prefs.shirt.mode==='item'?q.limit:2*distinct(e=>e.row[0]),tie:q.prefs.tie.mode==='item'||q.prefs.tie.mode==='none'?q.limit:distinct(e=>e.row[1]==='NO_TIE'?null:e.row[1])+(rawCandidates.some(e=>e.row[1]==='NO_TIE')?(root.HEWRSStyleOccasions.noTieCap(q)??q.limit):0),pants:q.prefs.bottoms.mode==='item'||rawCandidates.some(e=>!e.pantId)?q.limit:2*distinct(e=>e.pantId)};
  diagnostics.source_capacity_bounds={...sourceCapacity,upper_bound:replacing?refillLimit:Math.min(q.limit,...Object.values(sourceCapacity)),distinct_scored_trouser_ids:distinct(e=>e.pantId),explanation:replacing?'The replacement pool changes only the rejected components. Its item counts bound new rows only; the total bound includes retained rows and at most one replacement for this original outfit. All original list limits remain enforced.':'These counts bound the full source-eligible clothing pool after broad saved exclusions, before weather, accessory and combined item restrictions.'};
  candidates.sort((a,b)=>b.preferenceUpper-a.preferenceUpper||cmp(a.key,b.key));
  const allCandidates=candidates,keep=new Set(candidates.slice(0,512)),covered=new Set();
  for(const e of candidates){const tags=[e.group.topwearId+'|shirt|'+e.row[0]+'|'+(e.row[1]==='NO_TIE'),e.group.topwearId+'|tie|'+e.row[1],e.group.topwearId+'|pants|'+(e.pantId||'SUIT_TROUSERS')];for(const tag of tags)if(!covered.has(tag)){covered.add(tag);keep.add(e);}}
  candidates=allCandidates.filter(e=>keep.has(e));diagnostics.complete_outfit_shortlist=candidates.length;diagnostics.clothing_only_candidates=rawCandidates.length-candidates.length;

  const worn=new Map();for(const h of history)if(h.confirmed===true&&root.HEWRSLocalState.date(h.localDate)&&h.localDate<=q.localDate)for(const it of Object.values(h.items||{}))if(it?.id&&(!worn.has(it.id)||worn.get(it.id)<h.localDate))worn.set(it.id,h.localDate);
  const initial=new Map(),rejected=new Set(),accepted=[];let best=-Infinity;
  const reject=code=>diagnostics.rejection_reasons[code]=(diagnostics.rejection_reasons[code]||0)+1;
  const band=inputs.logicData.rotationPolicy.nearEquivalentBand;
  const remainingSource=rawCandidates.filter(e=>!scoredKeys.has(e.key));let sourceCursor=0,sourceSkippedForCapacity=0;
  diagnostics.source_expansion_batches=0;diagnostics.source_expansion_scored=0;
  const sourceUpperBound=replacing?refillLimit:Math.min(q.limit,...Object.values(sourceCapacity));
  function* expandSource(canConsider=null){
   const batch=[];let visited=0;
   // No fixed extra-review ceiling: stop at the requested list size, a proven
   // item-count bound, exhausted remaining rows, or the caller's cancellation.
   // Small yields retain cancellation and UI responsiveness on the slow path.
   while(sourceCursor<remainingSource.length&&batch.length<64){const e=remainingSource[sourceCursor++],consider=!canConsider||canConsider(e);visited++;
    if(!consider)sourceSkippedForCapacity++;
    else{e.expandedSource=true;scoreClothing(e);batch.push(e);allCandidates.push(e);diagnostics.source_expansion_scored++;}
    if(visited%128===0||consider&&batch.length%16===0)yield {phase:'expanding-unreviewed-source',examined:diagnostics.enumerated,source_rows_checked:sourceCursor,source_rows_total:remainingSource.length};
   }
   if(batch.length){allCandidates.sort((a,b)=>b.preferenceUpper-a.preferenceUpper||cmp(a.key,b.key));diagnostics.source_expansion_batches++;}
   diagnostics.preference_evaluated=scoredKeys.size;diagnostics.bounded_source_review.scored=scoredKeys.size;
   return batch;
  }
  function pruneExpandedFailures(){
   // A failed expanded row cannot become eligible as list capacity shrinks.
   // Release its heavy preference/accessory objects rather than retaining a
   // full source-sized Cartesian cache on a phone. Identities remain audited.
   let length=0;for(const e of allCandidates){if(e.expandedSource&&rejected.has(e.key)){delete e.preference;delete e.preferenceUpper;delete e.shoeChoices;}else allCandidates[length++]=e;}allCandidates.length=length;
  }
  function finishSearch(stopped,count){
   const allReviewed=sourceCursor===remainingSource.length;
   diagnostics.capacity_fallback_to_full_source=diagnostics.source_expansion_batches>0&&allReviewed;
   diagnostics.search_completion={stopped_because:stopped,returned:count,requested:q.limit,source_eligible:diagnostics.source_eligible_before_feedback,broad_feedback_excluded:diagnostics.feedback_excluded_clothing,available_clothing:rawCandidates.length,preference_scored:scoredKeys.size,unscored_clothing:rawCandidates.length-scoredKeys.size,remaining_source_unreviewed:remainingSource.length-sourceCursor,source_rows_excluded_by_current_capacity:sourceSkippedForCapacity,expansion_batches:diagnostics.source_expansion_batches,all_source_rows_considered_for_scoring:allReviewed,all_source_rows_reviewed:allReviewed&&stopped==='remaining_source_exhausted',full_list_found:count===q.limit,physical_item_upper_bound:sourceUpperBound,exhaustion_proven:stopped==='remaining_source_exhausted',exhaustion_scope:stopped==='remaining_source_exhausted'?'No additional eligible outfit can be appended to the retained/selected rows under the current locks and item limits. Rearranging those rows was not searched.':null,global_optimum_claimed:false};
   diagnostics.bounded_source_review.remaining_unreviewed=remainingSource.length-sourceCursor;
  }
  // FIRST assess complete outfits for every matching tie. This is candidate
  // coverage, NOT an output quota, ID bonus or tie-specific score normalization.
  // Upper bounds retain the strongest found complete configurations for each
  // tie without resolving every accessory Cartesian product in the browser.
  if(personal.tieCoverage){
   const buckets=new Map();for(const e of allCandidates){const id=e.row[1];if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(e);}
   for(const [id,bucket]of buckets){const audit=tieAudit[id],leaders=[];
    for(let i=0;i<bucket.length;i++){const e=bucket[i];
     if(leaders.length>=3&&e.preferenceUpper<leaders[leaders.length-1].preference.score-1e-9)break;
     diagnostics.domain_evaluated++;audit.complete_evaluated++;
     const rejection=code=>{reject(code);audit.rejection_reasons[code]=(audit.rejection_reasons[code]||0)+1;};
     const out=resolveCandidate(e,q,history,worn,null,rejection,work);
     if(out){audit.eligible_complete++;initial.set(e.key,out);accepted.push(out);best=Math.max(best,out.preference.score);
      leaders.push(out);leaders.sort((a,b)=>b.preference.score-a.preference.score||cmp(a.entry.key,b.entry.key));if(leaders.length>3)leaders.pop();
     }else{rejected.add(e.key);diagnostics.weather_style_or_accessory_holds++;}
     if(i%40===0)yield {phase:'reviewing-complete-outfits-for-each-tie',tie:id,examined:diagnostics.enumerated,domain_evaluated:diagnostics.domain_evaluated};
    }
    audit.retained_candidates=leaders.length;
    if(leaders.length){const a=leaders[0];audit.best_complete={selection:copy(a.selection),score:a.preference.score,value_route:a.entry.preference.value_route};for(const a of leaders)keep.add(a.entry);}
   }
   candidates=allCandidates.filter(e=>keep.has(e));diagnostics.complete_outfit_shortlist=candidates.length;diagnostics.coverage_method='complete-outfit review for every matched source-eligible tie before final list selection; no output quota';
  }else{
   for(let i=0;i<candidates.length;i++){const e=candidates[i];if(best!==-Infinity&&e.preferenceUpper<best-band-1e-9)break;
    diagnostics.domain_evaluated++;const r=resolveCandidate(e,q,history,worn,null,reject,work);if(r){initial.set(e.key,r);accepted.push(r);best=Math.max(best,r.preference.score);}else{rejected.add(e.key);diagnostics.weather_style_or_accessory_holds++;}
    if(i%25===0)yield {phase:'outfit-accessory-evaluation',examined:diagnostics.enumerated,domain_evaluated:diagnostics.domain_evaluated};
   }
  }
  function finishTieAudit(chosen,capacity){for(const a of Object.values(tieAudit)){
   a.selected_count=chosen.filter(o=>(o.items.tie?.id||'NO_TIE')===a.id).length;
   a.disposition=a.selected_count?'SELECTED':!a.matching_rows?'OUTSIDE_REQUEST_LOCKS_OR_MODE':!a.source_eligible_clothing?'SOURCE_SCORE_HOLD':!personal.tieCoverage?'NOT_SEPARATELY_AUDITED_IN_LEGACY_METHOD':!a.eligible_complete?'NO_COMPLETE_OUTFIT_PASSED_CONTEXT_WEATHER_ACCESSORIES':'ELIGIBLE_NOT_SELECTED_IN_BOUNDED_LIST';
   if(a.best_complete&&capacity){const e=initial.get([tops.get(a.best_complete.selection.suitId||a.best_complete.selection.blazerId).id,'shirt-'+a.best_complete.selection.shirtId,a.best_complete.selection.state,a.best_complete.selection.pantId?'pants-'+a.best_complete.selection.pantId:'SUIT_TROUSERS'].join('|'));if(e)a.best_candidate_final_constraint=capacity.issue(e);}
  }}
  diagnostics.examined=diagnostics.enumerated;
  const ownerBatch=root.HEWRSOutfitFeedback?.ownerBatch?.(),ownerOcc=root.HEWRSOutfitFeedback?.occasion?.(q.context.occasion)||q.context.occasion,approvedEligible=[];
  for(const approval of ownerBatch?.approvals||[]){
   if(root.HEWRSOutfitFeedback.occasion(approval.occasion)!==ownerOcc||!approval.outfit?.topwear)continue;
   const e=rawCandidates.find(x=>approvalMatchesEntry(approval,x));if(!e)continue;
   const out=resolveApprovedCandidate(e,q,approval,worn,work);if(!out)continue;
   let existing=accepted.find(x=>root.HEWRSOutfitFeedback.ownerApproval(x.selection,q.context)?.review_id===approval.review_id);
   if(!existing){accepted.push(out);initial.set(e.key,out);best=Math.max(best,out.preference.score);existing=out;}
   existing.owner_approval=copy(approval);approvedEligible.push(existing);
  }
  diagnostics.owner_approval_priority={revision:ownerBatch?.revision||null,eligible_exact_approvals:approvedEligible.map(x=>x.owner_approval.review_id),eligible_count:approvedEligible.length,assistant_assessments_used_as_owner_preference:false};
  // An empty shortlist is not proof that the remaining wardrobe is exhausted.
  // First inspect any already-scored coverage rows omitted from the accessory
  // shortlist, then continue through the raw source in yielded batches.
  if(!accepted.length){
   for(let i=0;i<allCandidates.length;i++){const e=allCandidates[i];if(initial.has(e.key)||rejected.has(e.key))continue;
    diagnostics.domain_evaluated++;const out=resolveCandidate(e,q,history,worn,null,reject,work);
    if(out){initial.set(e.key,out);accepted.push(out);best=Math.max(best,out.preference.score);}else rejected.add(e.key);
    if(i%16===0)yield {phase:'checking-scored-shortlist-remainder',examined:diagnostics.enumerated,domain_evaluated:diagnostics.domain_evaluated};
    if(accepted.length&&i+1<allCandidates.length&&allCandidates[i+1].preferenceUpper<best-band-1e-9)break;
   }
  }
  while(!accepted.length&&sourceCursor<remainingSource.length){
   const batch=yield* expandSource();candidates=allCandidates;
   for(let i=0;i<batch.length;i++){const e=batch[i];diagnostics.domain_evaluated++;const audit=tieAudit[e.row[1]];audit.complete_evaluated++;
    const out=resolveCandidate(e,q,history,worn,null,reject,work);
    if(out){initial.set(e.key,out);accepted.push(out);best=Math.max(best,out.preference.score);audit.eligible_complete++;}else rejected.add(e.key);
    if(i%8===0)yield {phase:'evaluating-expanded-source',examined:diagnostics.enumerated,domain_evaluated:diagnostics.domain_evaluated};
   }
   pruneExpandedFailures();
  }
  if(!accepted.length){
   finishSearch('remaining_source_exhausted',retainedRows.length);
   if(ownerFeedback)ownerFeedback.assertCurrent(ownerFeedbackToken);
   finishTieAudit(retainedRows,capacity);
   if(retainedRows.length)return {status:'compatibility_options_rotation_confirmation_required',options:retainedRows,diagnostics,requested_options:q.limit,returned_options:retainedRows.length,option_policy:capacity.snapshot(),refill:{retained:retainedRows.length,added:0},reason:replacing?targetedReason(0):'Kept '+retainedRows.length+' accepted outfits. No additional eligible option was found within the current selections and list limits.'};
   const no_match=root.HEWRSGenerationDiagnostics.describe(base,q,diagnostics,[...work.styleProfiles.values()]);
   if(!rawCandidates.length&&diagnostics.feedback_excluded_clothing){Object.assign(no_match,{code:'MATCHING_CLOTHING_REJECTED',title:'Matching combinations are rejected',message:'All source-eligible clothing combinations matching these selections are excluded by saved rejections.',detail:'The saved exclusions remain active. No rejected combination was reused.'});}
   if(replacing)Object.assign(no_match,{code:work.replacement.parts.join(',')==='tie'?'TIE_REPLACEMENT_UNAVAILABLE':'COMPONENT_REPLACEMENT_UNAVAILABLE',title:'No compatible different '+work.replacement.parts.join(' and '),message:targetedReason(0),detail:''});
   return {status:'no_qualified_candidate',options:[],diagnostics,no_match,reason:no_match.message+(no_match.detail?' '+no_match.detail:'')};
  }
  // Stage 10 precedence: an eligible exact owner-approved outfit is a higher
  // preference tier than model judgments. The unchanged wear-history rotation
  // runs inside that tier; if no exact approval qualifies, the prior 0.2 band
  // behavior is used without modification.
  const rotationSource=approvedEligible.length?approvedEligible:accepted,rotationBest=Math.max(...rotationSource.map(x=>x.preference.score));
  const slim=rotationSource.filter(x=>x.preference.score>=rotationBest-band-1e-9).map(x=>({id:x.id,items:x.items,result:{...x.result,display_score:x.preference.score}}));
  const rot=base.engine.selectForContext(slim,history,{style:q.executiveStyle,localDate:q.localDate});
  rot.ranking_basis=approvedEligible.length?'explicit_exact_owner_approval_then_'+personal.revision:personal.revision;
  rot.scope=approvedEligible.length?'Confirmed-wear rotation among eligible exact owner-approved outfits within the existing near-equivalent band; no garment-wide preference inferred.':'Confirmed-wear rotation among near-equivalent personalized preferences; original compatibility remains separately preserved.';
  rot.owner_approval_tier_active=approvedEligible.length>0;
  // A refill preserves any existing recommendation record; it does not silently
  // nominate another recommendation while accepted choices are being retained.
  const winner=!refilling&&rot.selected?rotationSource.find(e=>e.id===rot.selected.id):null;
  const selected=retained.slice(),keys=new Set(retained.map(e=>root.HEWRSOptionSetPolicy.clothingKey(e))),rechoices=new Map();
  const seed=refilling?null:winner||rotationSource.slice().sort((a,b)=>b.preference.score-a.preference.score||cmp(a.entry.key,b.entry.key))[0];
  if(seed&&!capacity.issue(seed)){seed.curation={decision:seed.owner_approval?'owner_approved_exact_outfit_with_confirmed_history_rotation':'best_preference_with_confirmed_history_rotation',redundancy:0};capacity.add(seed);selected.push(seed);keys.add(root.HEWRSOptionSetPolicy.clothingKey(seed));}
  for(const approved of approvedEligible.slice().sort((a,b)=>b.preference.score-a.preference.score||cmp(a.entry.key,b.entry.key))){
   if(selected.includes(approved)||capacity.issue(approved)||keys.has(root.HEWRSOptionSetPolicy.clothingKey(approved)))continue;
   approved.curation={decision:'owner_approved_exact_outfit_priority',redundancy:0};capacity.add(approved);selected.push(approved);keys.add(root.HEWRSOptionSetPolicy.clothingKey(approved));if(selected.length>=refillLimit)break;
  }
  diagnostics.list_evaluated=0;diagnostics.option_cap_skips=0;let searchStop='target_reached';
  function canConsider(e){const ti=tops.get(e.group.topwearId),si=shirts.get('shirt-'+e.row[0]),tt=e.row[1]==='NO_TIE'?null:ties.get(e.row[1]),pi=e.pantId?pants.get(e.pantId):null;return !keys.has(root.HEWRSOptionSetPolicy.clothingKey({items:{topwear:ti,shirt:si,tie:tt,pants:pi}}))&&[ti,si,tt,pi].every(x=>capacity.canUse(x?.id))&&(!!tt||capacity.canAddNoTie());}
  while(selected.length<refillLimit){
   if(selected.length>=sourceUpperBound){searchStop='physical_item_upper_bound';break;}
   let strongest=-Infinity,pool=[];
   for(let i=0;i<candidates.length;i++){const e=candidates[i];
    if(diagnostics.source_expansion_batches&&i%128===0)yield {phase:'curating-expanded-source',examined:diagnostics.enumerated,returned:selected.length};
    if(strongest!==-Infinity&&e.preferenceUpper<strongest-personal.curationBand-1e-9)break;
    if(rejected.has(e.key))continue;
    const ti=tops.get(e.group.topwearId),si=shirts.get('shirt-'+e.row[0]),tt=e.row[1]==='NO_TIE'?null:ties.get(e.row[1]),pi=e.pantId?pants.get(e.pantId):null;
    if(keys.has(root.HEWRSOptionSetPolicy.clothingKey({items:{topwear:ti,shirt:si,tie:tt,pants:pi}}))||![ti,si,tt,pi].every(x=>capacity.canUse(x?.id))||(!tt&&!capacity.canAddNoTie())){diagnostics.option_cap_skips++;continue;}
    let r=rechoices.get(e.key)||initial.get(e.key);
    if(!r||capacity.issue(r)){r=resolveCandidate(e,q,history,worn,capacity,null,work);diagnostics.list_evaluated++;if(r)rechoices.set(e.key,r);}
    if(!r||capacity.issue(r)){if(e.expandedSource)rejected.add(e.key);continue;}
    strongest=Math.max(strongest,r.preference.score);pool.push(r);
    if(i%80===0)yield {phase:'curating-complete-outfits',examined:diagnostics.enumerated,returned:selected.length};
   }
   pool=pool.filter(x=>x.preference.score>=strongest-personal.curationBand-1e-9);if(!pool.length){
    pruneExpandedFailures();
    if(candidates.length<allCandidates.length){candidates=allCandidates;diagnostics.capacity_fallback_to_scored_pool=true;yield {phase:'expanding-scored-pool-for-physical-item-caps',examined:diagnostics.enumerated,returned:selected.length};continue;}
    if(sourceCursor<remainingSource.length){const batch=yield* expandSource(canConsider);candidates=allCandidates;if(batch.length)continue;}
    searchStop='remaining_source_exhausted';break;
   }
   for(const e of pool)e.curation={decision:'visual_variety_within_preference_band',redundancy:personal.redundancy(e,selected,q),best_available_preference:strongest,preference_band:personal.curationBand};
   pool.sort((a,b)=>(b.preference.score-b.curation.redundancy)-(a.preference.score-a.curation.redundancy)||cmp(a.entry.key,b.entry.key));
   let chosen=pool[0];
   // Preserve the existing No Tie choice and exact tie anchor. Between tied
   // alternatives only, favour fewer prior suggestions within 0.05 points of
   // BOTH the original winner's raw preference and its variety-adjusted utility.
   // The underlying scores remain untouched; this cannot rescue an ineligible
   // or materially weaker outfit or replace the confirmed-wear recommendation.
   if(exposure.ok&&q.prefs.tie.mode!=='item'&&chosen.selection.state!=='NO_TIE'){
    const baseline=chosen,utility=x=>x.preference.score-x.curation.redundancy,count=x=>exposureCounts[x.selection.state]||0;
    const near=pool.filter(x=>x.selection.state!=='NO_TIE'&&Math.abs(x.preference.score-baseline.preference.score)<=EXPOSURE_BAND+1e-9&&utility(baseline)-utility(x)<=EXPOSURE_BAND+1e-9);
    near.sort((a,b)=>count(a)-count(b)||utility(b)-utility(a)||cmp(a.entry.key,b.entry.key));
    chosen=near[0]||baseline;
    chosen.curation.tie_exposure={prior_suggestions:count(chosen),baseline_tie:baseline.selection.state,baseline_prior_suggestions:count(baseline),quality_band:EXPOSURE_BAND,preference_gap:baseline.preference.score-chosen.preference.score,utility_gap:utility(baseline)-utility(chosen),changed:chosen!==baseline};
    if(chosen!==baseline){chosen.curation.decision='less_suggested_tie_within_quality_band';diagnostics.tie_exposure.reranked_choices++;}
   }
   capacity.add(chosen);selected.push(chosen);keys.add(root.HEWRSOptionSetPolicy.clothingKey(chosen));
   yield {phase:'curating-complete-outfits',examined:diagnostics.enumerated,returned:selected.length};
  }
  finishSearch(searchStop,selected.length);
  const options=selected.map((e,i)=>{if(e.retainedOption)return e.retainedOption;const score=detail(e.entry,q,e.items.shoes,e.items.watch);return {items:copy(e.items),formal:!!e.items.topwear.formal,dressMode:q.dressMode,context:q.context.occasion,styleEngine:q.executiveStyle,controlledRepetition:!winner&&rot.rotation?.status==='rotation_exception_requires_owner_confirmation',_hewrsConnected:{revision:REV,mode:'candidate',id:e.id,compatibility:score,preference:copy(e.preference),curation:copy(e.curation),owner_approval:e.owner_approval?copy(e.owner_approval):null,is_recommendation:!!winner&&winner.id===e.id,rank:i+1,list_position:i+1,rank_scope:e.owner_approval?'eligible exact owner-approved outfit tier, then unchanged wear-history rotation and bounded list curation':'personalized complete-outfit preference, then bounded visual curation; not a proven optimal set',production_enabled:false,source_spec_approved:false,accessory_method:'Contextual personal preference; inherited exclusions retained, no brand/price bonus',accessory_assessment:copy(e.accessory),environment:copy(e.environment),validation:{request:stable(q)},canonical_selection:copy(e.selection)}};});
  need(new Set(options.map(x=>x._hewrsConnected.id)).size===options.length,'Duplicate outfits in result');
  const option_policy=root.HEWRSOptionSetPolicy.inspect(options,q);finishTieAudit(options,capacity);if(ownerFeedback)ownerFeedback.assertCurrent(ownerFeedbackToken);
  if(replacing)need(options.length-retainedRows.length<=1&&options.slice(retainedRows.length).every(o=>replacementFits(o._hewrsConnected.canonical_selection,work.replacement)),'Targeted replacement changed an accepted garment or accessory.');
  return {status:options.some(o=>o._hewrsConnected.is_recommendation)?'candidate_recommendation':'compatibility_options_rotation_confirmation_required',options,diagnostics,rotation:rot,...(refilling?{refill:{retained:retainedRows.length,added:options.length-retainedRows.length}}:{}),requested_options:q.limit,returned_options:options.length,option_policy,reason:replacing?targetedReason(options.length-retainedRows.length):options.length<q.limit?'Found '+options.length+' distinct outfits within source eligibility, locks, weather, one-use tie and two-use other-item limits. '+(sourceCapacity.pants<q.limit?'The '+diagnostics.source_capacity_bounds.distinct_scored_trouser_ids+' source-eligible physical trousers allow at most '+sourceCapacity.pants+' options at two uses each. ':'')+(sourceCapacity.tie<q.limit?'The available tie IDs and No Tie allowance cap this request at '+sourceCapacity.tie+' options. ':'')+'No duplicated clothing or relaxed constraint was used.':null,environment:copy(q.environment),coverage:{source_index_rows:index.counts.rows,preference_revision:personal.revision,unresolved_scores_excluded:true,all_retained_physical_ids_independent:true,compatibility_unchanged:true,preference_is_personal_heuristic:true,global_optimum_claimed:false}};
 }
 function generate(q,cat,h){const it=steps(q,cat,h);for(;;){const x=it.next();if(x.done)return x.value;}}
 function generateAsync(q,cat,h,opts={}){need(!(opts.replaceTieFor&&opts.replaceFor),'Choose one replacement source.');const v=copy({q,h,retainedOptions:opts.retainedOptions??null,replaceFor:opts.replaceFor??opts.replaceTieFor??null,replaceParts:opts.replaceParts??(opts.replaceTieFor?['tie']:null)}),it=steps(v.q,cat,v.h,v.retainedOptions,v.replaceFor,v.replaceParts);return new Promise((resolve,reject)=>{function step(){try{if(opts.isCancelled?.()){it.return();return resolve({status:'cancelled',options:[]});}const v=it.next();if(v.done)return resolve(v.value);opts.onProgress?.(v.value);setTimeout(step,0);}catch(e){reject(e);}}setTimeout(step,0);});}
 function verify(o,q,catalogue){try{requireIndex();valid(q);need(stable(catalogue)===stable(cat),'Different catalogue');const a=o?._hewrsConnected;need(a?.revision===REV&&a.validation?.request===stable(q),'Changed request');const s=base.validateSelection(a.canonical_selection);need(a.id===outfitID(s),'Different option ID');const group=index.groups.find(x=>x.topwearId===(s.suitId||s.blazerId)&&x.pantProfileId===(s.pantId?base.trouserProfiles.binding(s.pantId)?.profileId:null));need(group,'No indexed source group');const row=group.rows.find(x=>x[0]===s.shirtId&&x[1]===s.state),e={group,row,pantId:s.pantId||null};need(row&&row[4]&&clothingFits(group,row,q),'Changed clothing lock');if(s.pantId&&q.prefs.bottoms.mode==='item')need(s.pantId===q.prefs.bottoms.id,'Changed trousers');need(matchesPref(q.prefs.shoes,s.shoeId)&&matchesPref(q.prefs.watch,s.watchId),'Changed accessories');const sh=shoes.get(s.shoeId),w=s.watchId?watches.get(s.watchId):null;need(stable(o.items)===stable(fullItems(e,sh,w)),'Changed item records');const r=detail(e,q,sh,w),env=root.HEWRSWeather.assess(weatherItems(e,sh,w),q.environment,q.context);need(env.eligible&&stable(env)===stable(a.environment),'Changed weather eligibility');need(r.style.authorityGate==='pass'&&(q.executiveStyle==='AUTO'||r.style.classification===q.executiveStyle),'Changed style');const pref=personal.clothing(e.group.topwearId,row[0],row[1],e.pantId,row[2],q);const expected=personal.complete(pref,personal.shoe(sh,pref,q),personal.watch(w,pref,q));need(stable(expected)===stable(a.preference),'Changed personalized preference');return stable(r)===stable(a.compatibility);}catch{return false;}}
 const controller=Object.freeze({...base.controller,generate:(q,cat,h)=>q?.automatic?generate(q,cat,h):root.HEWRSOptionSetPolicy.limitLegacy(base.controller.generate(q,cat,h),q),generateAsync:(q,cat,h,o)=>q?.automatic?generateAsync(q,cat,h,o):base.controller.generateAsync(q,cat,h,o).then(r=>root.HEWRSOptionSetPolicy.limitLegacy(r,q)),verifyCachedOption:(o,q,cat)=>q?.automatic?verify(o,q,cat):base.controller.verifyCachedOption(o,q,cat),verifyOptionSet:(options,q)=>{try{root.HEWRSOptionSetPolicy.inspect(options,q);return options.every(o=>q?.automatic?verify(o,q,cat):base.controller.verifyCachedOption(o,q,cat));}catch{return false;}}});
 function selectionFromOption(o,q){if(!q?.automatic)return base.selectionFromOption(o,q);need(verify(o,q,cat),'Stale, changed or incompatible automatic option');const s=base.validateSelection(o._hewrsConnected.canonical_selection);return {selection:s,display:{shirt:base.records[s.shirtId].label},representation:{selected_shoe_rendered:true,selected_watch_rendered:false}};}
 return Object.freeze({...base,preference:personal,controller,selectionFromOption,makeRequest:c=>c?.automatic?prepare(c):base.makeRequest(c),automatic:Object.freeze({prepare,verify,setOwnerFeedback,get indexCounts(){return copy(requireIndex().counts);},revision:REV}),implementationVersion:'1.21.0-twenty-unique-ties'});
}
root.HEWRSAutomaticEngine=Object.freeze({create});
root.HEWRSCleanConnection=Object.freeze({create});
})(globalThis);
