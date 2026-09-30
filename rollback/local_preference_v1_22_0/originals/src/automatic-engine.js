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
const DEFAULT_REV='HEWRS_AUTOMATIC_WORKFLOW_1_21_0_HEURISTIC',cmp=(a,b)=>a<b?-1:a>b?1:0,stable=root.HEWRSConnectedContract.stable;
function create(inputs,options={}){
 const REV=options.revision||DEFAULT_REV;
 const base=prior.create(inputs),cat=base.catalogue,index=root.HEWRS_OPTION_INDEX,personal=(options.preferenceFactory||root.HEWRSOutfitPreference.create)(base);
 const sourceResults=new Map();function sourceResult(e,q){const k=[e.group.topwearId,e.group.pantProfileId,e.row[0],e.row[1],q.context.occasion,q.context.requiredFormality].join('|');if(!sourceResults.has(k)){if(sourceResults.size>5000)sourceResults.clear();sourceResults.set(k,base.engine.evaluate(requestFor(e,q)));}return sourceResults.get(k);}
 need(index?.schema==='hewrs.derived-clothing-index.v1_17_0'&&index.source_input_sha256===root.HEWRS_INPUT_SHA256,'Clothing index is incompatible with current DNA');
 need(index.normalization_revision===root.HEWRSEnsembleCompletion.normalizationRevision&&index.normalization_revision==='hewrs.literal-colour-qualifiers.v1_17_3','Mixed clothing index/colour engine versions. Reload the complete update; no old cached scores will be used.');
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
 function prepare(config){const p=normalizePrefs(config.preferences),context={occasion:config.occasion||'clinic',requiredFormality:config.formality||'any'};
  need(['clinic','hospital','work'].includes(context.occasion),'This release supports the existing work settings only');need(['any','tie_required','suit_required','open_collar_allowed'].includes(context.requiredFormality),'Unknown formality requirement');need(root.HEWRSWeather&&root.HEWRSWeather.validate,'Missing environment implementation');need(root.HEWRSLocalState.date(config.localDate),'Invalid work date');
  const env=root.HEWRSWeather.validate(config.environment||{source:'not_assessed',date:config.localDate});need(root.HEWRSWeather.fresh(env,config.localDate),'Weather is stale or for another date; refresh Weather or use manual conditions');
  need(['AUTO','CLASSIC','HYBRID','MODERN'].includes(config.style||'AUTO'),'Unknown style');return {automatic:true,revision:REV,source_lock:root.HEWRS_INPUT_SHA256,prefs:p,context,localDate:config.localDate,environment:env,executiveStyle:config.style||'AUTO',dressMode:'work',limit:root.HEWRSOptionSetPolicy.target,sneakerStance:p.shoes.mode==='item'&&shoes.get(p.shoes.id)?.subcategory==='Sneakers'};
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
 const evidence=(shoe,watch)=>({shoeStyle:shoe.subcategory==='Sneakers'?'sneaker':'other',statementWatch:watch?['statement','diamondStatement'].includes(root.watchFormalityCategory(watch)):false,controlled:true,evidence:{source_id:'RECOVERED_ACCESSORY_POLICY_CURRENT_CANONICAL_FEATURE_ADAPTER',shoe_id:shoe.id,watch_id:watch?.id??null,evidence_status:'inherited_rule_inference_not_owner_measurement'}});
 function weatherItems(e,shoe,watch){return {topwear:enrich(tops.get(e.group.topwearId),e.group.topwearId),shirt:enrich(shirts.get('shirt-'+e.row[0]),e.row[0]),tie:e.row[1]==='NO_TIE'?null:enrich(ties.get(e.row[1]),e.row[1]),pants:e.pantId?pants.get(e.pantId):null,shoes:shoe,watch};}
 function detail(e,q,shoe,watch){const a=evidence(shoe,watch),r=base.engine.evaluate(requestFor(e,q,a));need(r.score===e.row[2]&&r.display_score===e.row[3]&&r.candidate_eligible,'Clothing cache does not match unchanged source engine');return r;}
 function outfitID(s){return [s.suitId||s.blazerId||'SHIRT_ONLY',s.pantId||'SUIT_TROUSERS',s.shirtId,s.state,s.shoeId,s.watchId||'NO_WATCH'].join('|');}
 const styleFeasibility=new Map();
 function canMatchStyle(e,q,r){if(q.executiveStyle==='AUTO')return true;
  const sh=q.prefs.shoes.mode==='item'?[shoes.get(q.prefs.shoes.id)]:[...shoes.values()],wa=q.prefs.watch.mode==='none'?[null]:q.prefs.watch.mode==='item'?[watches.get(q.prefs.watch.id)]:[...watches.values()];
  const shoeTypes=[...new Set(sh.map(x=>x.subcategory==='Sneakers'?'sneaker':'other'))],watchTypes=[...new Set(wa.map(x=>!!x&&['statement','diamondStatement'].includes(root.watchFormalityCategory(x))))];
  const key=[e.group.topwearId,e.row[0],e.row[1]==='NO_TIE',q.executiveStyle,shoeTypes.join(','),watchTypes.join(',')].join('|');
  if(styleFeasibility.has(key))return styleFeasibility.get(key);let yes=false;
  for(const shoeStyle of shoeTypes)for(const statementWatch of watchTypes){const st=root.HEWRSEnsembleCompletion.classifyStyle(features.get(e.group.topwearId),features.get(e.row[0]),e.row[1]==='NO_TIE'?null:features.get(e.row[1]),r,{shoeStyle,statementWatch,controlled:true,evidence:{source_id:'ACTUAL_ACCESSORY_TYPES_FEASIBILITY_ONLY'}});if(st.authorityGate==='pass'&&st.classification===q.executiveStyle)yes=true;}
  styleFeasibility.set(key,yes);return yes;
 }
 function resolveCandidate(e,q,history,worn,capacity=null,reject=null){const r=sourceResult(e,q);if(!r.candidate_eligible||r.context.status!=='eligible'){reject?.('SOURCE_OR_FORMALITY_HOLD');return null;}need(r.score===e.row[2]&&r.display_score===e.row[3],'Source-index score mismatch');if(!canMatchStyle(e,q,r)){reject?.('STYLE_LOCK');return null;}
  const top=weatherItems(e,null,null),policy=root.HEWRSLegacyAccessories;
  const pref=e.preference||(e.preference=personal.clothing(e.group.topwearId,e.row[0],e.row[1],e.pantId,e.row[2]));
  const tieOrder=(a,b)=>cmp(worn.get(a.item.id)||'',worn.get(b.item.id)||'')||cmp(a.item.id,b.item.id);
  let pool=(e.shoeChoices||(e.shoeChoices=(q.prefs.shoes.mode==='item'?[shoes.get(q.prefs.shoes.id)]:[...shoes.values()]).map(item=>({item,assessment:policy.shoe(item,top,q,r),personal:personal.shoe(item,pref,q)})))).filter(x=>!x.assessment.rejected&&(!capacity||capacity.canUse(x.item.id))).sort((a,b)=>b.personal.score-a.personal.score||tieOrder(a,b));
  if(!pool.length)reject?.('SHOE_LOCK_OR_SUITABILITY');
  const rejectedWeather=new Set();let hadWeatherPass=false;
  for(const sh of pool){const wi={...top,shoes:sh.item},env=root.HEWRSWeather.assess(wi,q.environment,q.context);if(!env.eligible){for(const msg of env.reasons||[])rejectedWeather.add(msg);if(!env.reasons?.length)rejectedWeather.add('Weather-domain score is below the existing minimum');continue;}hadWeatherPass=true;
   const wpool=q.prefs.watch.mode==='none'?[{item:null,assessment:null,personal:personal.watch(null,pref,q)}]:(q.prefs.watch.mode==='item'?[watches.get(q.prefs.watch.id)]:[...watches.values()]).map(item=>({item,assessment:policy.watch(item,wi,q),personal:personal.watch(item,pref,q)})).filter(x=>!x.assessment.rejected&&(!capacity||capacity.canUse(x.item.id))).sort((a,b)=>b.personal.score-a.personal.score||tieOrder(a,b));
   for(const w of wpool){const sty=root.HEWRSEnsembleCompletion.classifyStyle(features.get(e.group.topwearId),features.get(e.row[0]),e.row[1]==='NO_TIE'?null:features.get(e.row[1]),r,evidence(sh.item,w.item));if(sty.authorityGate!=='pass'||q.executiveStyle!=='AUTO'&&q.executiveStyle!==sty.classification)continue;
    const s=selection(e,sh.item,w.item);base.validateSelection(s);return {id:outfitID(s),selection:s,items:fullItems(e,sh.item,w.item),result:{candidate_eligible:true,display_score:r.display_score,score:r.score,ids:r.ids,context:r.context,style:sty},entry:e,environment:env,preference:personal.complete(pref,sh.personal,w.personal),accessory:{shoe:sh.assessment,watch:w.assessment,personal_shoe:sh.personal,personal_watch:w.personal}};
   }
  }if(!hadWeatherPass&&pool.length){reject?.('WEATHER');for(const msg of rejectedWeather)reject?.('WEATHER: '+msg);}else if(pool.length)reject?.('WATCH_OR_STYLE_LOCK');return null;
 }
 function* steps(q,catalogue,history){valid(q);need(stable(catalogue)===stable(cat),'Catalogue does not match current source');need(Array.isArray(history),'Confirmed history must be supplied');
  const wearCheck=root.HEWRSLocalState.create(base,root.HEWRS_INPUT_SHA256,null);wearCheck.validate({schema:root.HEWRSLocalState.SCHEMA,source_lock:root.HEWRS_INPUT_SHA256,revision:0,session:null,events:history});
  const tieAudit=Object.fromEntries([...ties.keys(),'NO_TIE'].map(id=>[id,{id,matching_rows:0,source_eligible_clothing:0,source_holds:{},complete_evaluated:0,eligible_complete:0,rejection_reasons:{},best_complete:null,retained_candidates:0,selected_count:0}]));
  const diagnostics={tie_coverage:tieAudit,enumerated:0,examined:0,score_statuses:{},weather_style_or_accessory_holds:0,unbound_trouser_ids:[],numeric_candidates:0,domain_evaluated:0,rejection_reasons:{},preference_revision:personal.revision};let candidates=[];
  const prefCache=new Map();
  for(const group of index.groups){let ps=[null];if(group.pantProfileId)ps=base.trouserProfiles.boundIds.filter(id=>base.trouserProfiles.binding(id).profileId===group.pantProfileId&&(q.prefs.bottoms.mode!=='item'||id===q.prefs.bottoms.id));
   for(const row of group.rows){if(!clothingFits(group,row,q))continue;for(const pid of ps){diagnostics.enumerated++;diagnostics.score_statuses[row[5]]=(diagnostics.score_statuses[row[5]]||0)+1;const ta=tieAudit[row[1]];if(ta)ta.matching_rows++;if(!row[4]){if(ta)ta.source_holds[row[5]]=(ta.source_holds[row[5]]||0)+1;continue;}if(ta)ta.source_eligible_clothing++;
    const k=[group.topwearId,row[0],row[1],pid||'SUIT_TROUSERS'].join('|');
    const e={group,row,pantId:pid,key:[tops.get(group.topwearId).id,'shirt-'+row[0],row[1],pid?pants.get(pid).id:'SUIT_TROUSERS'].join('|')};
    // Every source-eligible clothing candidate receives the new preference,
    // not just the old Top15. All original score/hold fields stay untouched.
    if(!prefCache.has(k))prefCache.set(k,personal.clothing(group.topwearId,row[0],row[1],pid,row[2]));e.preference=prefCache.get(k);candidates.push(e);
   }}yield {phase:'complete-outfit-profiles',examined:diagnostics.enumerated};
  }
  if(q.prefs.bottoms.mode==='item'&&!base.trouserProfiles.binding(q.prefs.bottoms.id))diagnostics.unbound_trouser_ids.push(q.prefs.bottoms.id);
  diagnostics.numeric_candidates=candidates.length;diagnostics.preference_evaluated=candidates.length;
  // Conservative arithmetic upper bounds from the matched scored clothing
  // pool. These explain legitimate short lists; they do not relax source holds.
  const distinct=fn=>new Set(candidates.map(fn).filter(x=>x!==null)).size;
  const sourceCapacity={topwear:q.prefs.topwear.mode==='item'?q.limit:2*distinct(e=>e.group.topwearId),shirt:q.prefs.shirt.mode==='item'?q.limit:2*distinct(e=>e.row[0]),tie:q.prefs.tie.mode==='item'||q.prefs.tie.mode==='none'?q.limit:distinct(e=>e.row[1]==='NO_TIE'?null:e.row[1])+(candidates.some(e=>e.row[1]==='NO_TIE')?2:0),pants:q.prefs.bottoms.mode==='item'||candidates.some(e=>!e.pantId)?q.limit:2*distinct(e=>e.pantId)};
  diagnostics.source_capacity_bounds={...sourceCapacity,upper_bound:Math.min(q.limit,...Object.values(sourceCapacity)),distinct_scored_trouser_ids:distinct(e=>e.pantId),explanation:'Counts are upper bounds from source-eligible matched clothing; weather, accessories and combined caps can reduce actual results further.'};

  candidates.sort((a,b)=>b.preference.score-a.preference.score||cmp(a.key,b.key));
  // Resource-bounded coverage shortlist: all eligible clothing was scored above.
  // Keep a strong prefix PLUS each topwear/shirt/mode, topwear/tie and physical
  // trouser combination's best entry. These are candidate coverage guarantees,
  // not compulsory output slots. Exact full-set global optimality is not claimed.
  const allCandidates=candidates,keep=new Set(candidates.slice(0,512)),covered=new Set();
  for(const e of candidates){const tags=[e.group.topwearId+'|shirt|'+e.row[0]+'|'+(e.row[1]==='NO_TIE'),e.group.topwearId+'|tie|'+e.row[1],e.group.topwearId+'|pants|'+(e.pantId||'SUIT_TROUSERS')];for(const tag of tags)if(!covered.has(tag)){covered.add(tag);keep.add(e);}}
  candidates=allCandidates.filter(e=>keep.has(e));diagnostics.complete_outfit_shortlist=candidates.length;diagnostics.clothing_only_candidates=allCandidates.length-candidates.length;

  const worn=new Map();for(const h of history)if(h.confirmed===true&&root.HEWRSLocalState.date(h.localDate)&&h.localDate<=q.localDate)for(const it of Object.values(h.items||{}))if(it?.id&&(!worn.has(it.id)||worn.get(it.id)<h.localDate))worn.set(it.id,h.localDate);
  const initial=new Map(),rejected=new Set(),accepted=[];let best=-Infinity;
  const reject=code=>diagnostics.rejection_reasons[code]=(diagnostics.rejection_reasons[code]||0)+1;
  const band=inputs.logicData.rotationPolicy.nearEquivalentBand;
  // FIRST assess complete outfits for every matching tie. This is candidate
  // coverage, NOT an output quota, ID bonus or tie-specific score normalization.
  // Upper bounds retain the strongest found complete configurations for each
  // tie without resolving every accessory Cartesian product in the browser.
  if(personal.tieCoverage){
   const buckets=new Map();for(const e of allCandidates){const id=e.row[1];if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(e);}
   for(const [id,bucket]of buckets){const audit=tieAudit[id],leaders=[];
    for(let i=0;i<bucket.length;i++){const e=bucket[i];
     if(leaders.length>=3&&personal.maximumComplete(e.preference.score)<leaders[leaders.length-1].preference.score-1e-9)break;
     diagnostics.domain_evaluated++;audit.complete_evaluated++;
     const rejection=code=>{reject(code);audit.rejection_reasons[code]=(audit.rejection_reasons[code]||0)+1;};
     const out=resolveCandidate(e,q,history,worn,null,rejection);
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
   for(let i=0;i<candidates.length;i++){const e=candidates[i];if(best!==-Infinity&&personal.maximumComplete(e.preference.score)<best-band-1e-9)break;
    diagnostics.domain_evaluated++;const r=resolveCandidate(e,q,history,worn,null,reject);if(r){initial.set(e.key,r);accepted.push(r);best=Math.max(best,r.preference.score);}else{rejected.add(e.key);diagnostics.weather_style_or_accessory_holds++;}
    if(i%25===0)yield {phase:'outfit-accessory-evaluation',examined:diagnostics.enumerated,domain_evaluated:diagnostics.domain_evaluated};
   }
  }
  function finishTieAudit(chosen,capacity){for(const a of Object.values(tieAudit)){
   a.selected_count=chosen.filter(o=>(o.items.tie?.id||'NO_TIE')===a.id).length;
   a.disposition=a.selected_count?'SELECTED':!a.matching_rows?'OUTSIDE_REQUEST_LOCKS_OR_MODE':!a.source_eligible_clothing?'SOURCE_SCORE_HOLD':!personal.tieCoverage?'NOT_SEPARATELY_AUDITED_IN_LEGACY_METHOD':!a.eligible_complete?'NO_COMPLETE_OUTFIT_PASSED_CONTEXT_WEATHER_ACCESSORIES':'ELIGIBLE_NOT_SELECTED_IN_BOUNDED_LIST';
   if(a.best_complete&&capacity){const e=initial.get([tops.get(a.best_complete.selection.suitId||a.best_complete.selection.blazerId).id,'shirt-'+a.best_complete.selection.shirtId,a.best_complete.selection.state,a.best_complete.selection.pantId?'pants-'+a.best_complete.selection.pantId:'SUIT_TROUSERS'].join('|'));if(e)a.best_candidate_final_constraint=capacity.issue(e);}
  }}
  diagnostics.examined=diagnostics.enumerated;
  if(!accepted.length){finishTieAudit([],null);return {status:'no_qualified_candidate',options:[],diagnostics,reason:diagnostics.unbound_trouser_ids.length?'These trousers have no recorded numerical colour-profile binding. Exact manual Anchor selection remains available.':!diagnostics.numeric_candidates?'No source-eligible scored clothing satisfies the locks. Existing source holds remain excluded; no score or appearance was invented.':diagnostics.rejection_reasons.WEATHER?'Scored outfits exist but current weather/accessory rules exclude them. '+Object.keys(diagnostics.rejection_reasons).filter(x=>x.startsWith('WEATHER: ')).map(x=>x.slice(9)).slice(0,3).join('; '):'The selected style/accessory locks leave no eligible combination. No lock was relaxed.'};}
  // Rotation policy/history are unchanged; it now operates within 0.2 of the
  // best PERSONAL preference score, not a falsely relabelled original score.
  const slim=accepted.filter(x=>x.preference.score>=best-band-1e-9).map(x=>({id:x.id,items:x.items,result:{...x.result,display_score:x.preference.score}}));
  const rot=base.engine.selectForContext(slim,history,{style:q.executiveStyle,localDate:q.localDate});
  rot.ranking_basis=personal.revision;rot.scope='Confirmed-wear rotation among near-equivalent personalized preferences; original compatibility remains separately preserved.';
  const winner=rot.selected?accepted.find(e=>e.id===rot.selected.id):null;
  const capacity=root.HEWRSOptionSetPolicy.create(q),selected=[],keys=new Set(),rechoices=new Map();
  const seed=winner||accepted.slice().sort((a,b)=>b.preference.score-a.preference.score||cmp(a.entry.key,b.entry.key))[0];
  if(seed&&!capacity.issue(seed)){seed.curation={decision:'best_preference_with_confirmed_history_rotation',redundancy:0};capacity.add(seed);selected.push(seed);keys.add(root.HEWRSOptionSetPolicy.clothingKey(seed));}
  diagnostics.list_evaluated=0;diagnostics.option_cap_skips=0;
  while(selected.length<q.limit){let strongest=-Infinity,pool=[];
   for(let i=0;i<candidates.length;i++){const e=candidates[i];if(strongest!==-Infinity&&personal.maximumComplete(e.preference.score)<strongest-personal.curationBand-1e-9)break;
    if(rejected.has(e.key))continue;
    const ti=tops.get(e.group.topwearId),si=shirts.get('shirt-'+e.row[0]),tt=e.row[1]==='NO_TIE'?null:ties.get(e.row[1]),pi=e.pantId?pants.get(e.pantId):null;
    if(keys.has(root.HEWRSOptionSetPolicy.clothingKey({items:{topwear:ti,shirt:si,tie:tt,pants:pi}}))||![ti,si,tt,pi].every(x=>capacity.canUse(x?.id))||(!tt&&!capacity.canAddNoTie())){diagnostics.option_cap_skips++;continue;}
    let r=rechoices.get(e.key)||initial.get(e.key);
    if(!r||capacity.issue(r)){r=resolveCandidate(e,q,history,worn,capacity);diagnostics.list_evaluated++;if(r)rechoices.set(e.key,r);}
    if(!r||capacity.issue(r))continue;
    strongest=Math.max(strongest,r.preference.score);pool.push(r);
    if(i%80===0)yield {phase:'curating-complete-outfits',examined:diagnostics.enumerated,returned:selected.length};
   }
   pool=pool.filter(x=>x.preference.score>=strongest-personal.curationBand-1e-9);if(!pool.length){if(candidates.length<allCandidates.length){candidates=allCandidates;diagnostics.capacity_fallback_to_full_source=true;yield {phase:'expanding-for-physical-item-caps',examined:diagnostics.enumerated,returned:selected.length};continue;}break;}
   for(const e of pool)e.curation={decision:'visual_variety_within_preference_band',redundancy:personal.redundancy(e,selected,q),best_available_preference:strongest,preference_band:personal.curationBand};
   pool.sort((a,b)=>(b.preference.score-b.curation.redundancy)-(a.preference.score-a.curation.redundancy)||cmp(a.entry.key,b.entry.key));
   const chosen=pool[0];capacity.add(chosen);selected.push(chosen);keys.add(root.HEWRSOptionSetPolicy.clothingKey(chosen));
   yield {phase:'curating-complete-outfits',examined:diagnostics.enumerated,returned:selected.length};
  }
  const options=selected.map((e,i)=>{const score=detail(e.entry,q,e.items.shoes,e.items.watch);return {items:copy(e.items),formal:!!e.items.topwear.formal,dressMode:q.dressMode,context:q.context.occasion,styleEngine:q.executiveStyle,controlledRepetition:!winner&&rot.rotation?.status==='rotation_exception_requires_owner_confirmation',_hewrsConnected:{revision:REV,mode:'candidate',id:e.id,compatibility:score,preference:copy(e.preference),curation:copy(e.curation),is_recommendation:!!winner&&winner.id===e.id,rank:i+1,list_position:i+1,rank_scope:'personalized complete-outfit preference, then bounded visual curation; not a proven optimal set',production_enabled:false,source_spec_approved:false,accessory_method:'Contextual personal preference; inherited exclusions retained, no brand/price bonus',accessory_assessment:copy(e.accessory),environment:copy(e.environment),validation:{request:stable(q)},canonical_selection:copy(e.selection)}};});
  need(new Set(options.map(x=>x._hewrsConnected.id)).size===options.length,'Duplicate outfits in result');
  const option_policy=root.HEWRSOptionSetPolicy.inspect(options,q);finishTieAudit(options,capacity);
  return {status:winner?'candidate_recommendation':'compatibility_options_rotation_confirmation_required',options,diagnostics,rotation:rot,requested_options:q.limit,returned_options:options.length,option_policy,reason:options.length<q.limit?'Found '+options.length+' distinct outfits within source eligibility, locks, weather, one-use tie and two-use other-item limits. '+(sourceCapacity.pants<q.limit?'The '+diagnostics.source_capacity_bounds.distinct_scored_trouser_ids+' source-eligible physical trousers allow at most '+sourceCapacity.pants+' options at two uses each. ':'')+(sourceCapacity.tie<q.limit?'The available tie IDs and No Tie allowance cap this request at '+sourceCapacity.tie+' options. ':'')+'No duplicated clothing or relaxed constraint was used.':null,environment:copy(q.environment),coverage:{source_index_rows:index.counts.rows,preference_revision:personal.revision,unresolved_scores_excluded:true,all_retained_physical_ids_independent:true,compatibility_unchanged:true,preference_is_personal_heuristic:true,global_optimum_claimed:false}};
 }
 function generate(q,cat,h){const it=steps(q,cat,h);for(;;){const x=it.next();if(x.done)return x.value;}}
 function generateAsync(q,cat,h,opts={}){const v=copy({q,h}),it=steps(v.q,cat,v.h);return new Promise((resolve,reject)=>{function step(){try{if(opts.isCancelled?.()){it.return();return resolve({status:'cancelled',options:[]});}const v=it.next();if(v.done)return resolve(v.value);opts.onProgress?.(v.value);setTimeout(step,0);}catch(e){reject(e);}}setTimeout(step,0);});}
 function verify(o,q,catalogue){try{valid(q);need(stable(catalogue)===stable(cat),'Different catalogue');const a=o?._hewrsConnected;need(a?.revision===REV&&a.validation?.request===stable(q),'Changed request');const s=base.validateSelection(a.canonical_selection);need(a.id===outfitID(s),'Different option ID');const group=index.groups.find(x=>x.topwearId===(s.suitId||s.blazerId)&&x.pantProfileId===(s.pantId?base.trouserProfiles.binding(s.pantId)?.profileId:null));need(group,'No indexed source group');const row=group.rows.find(x=>x[0]===s.shirtId&&x[1]===s.state),e={group,row,pantId:s.pantId||null};need(row&&row[4]&&clothingFits(group,row,q),'Changed clothing lock');if(s.pantId&&q.prefs.bottoms.mode==='item')need(s.pantId===q.prefs.bottoms.id,'Changed trousers');need(matchesPref(q.prefs.shoes,s.shoeId)&&matchesPref(q.prefs.watch,s.watchId),'Changed accessories');const sh=shoes.get(s.shoeId),w=s.watchId?watches.get(s.watchId):null;need(stable(o.items)===stable(fullItems(e,sh,w)),'Changed item records');const r=detail(e,q,sh,w),env=root.HEWRSWeather.assess(weatherItems(e,sh,w),q.environment,q.context);need(env.eligible&&stable(env)===stable(a.environment),'Changed weather eligibility');need(r.style.authorityGate==='pass'&&(q.executiveStyle==='AUTO'||r.style.classification===q.executiveStyle),'Changed style');const pref=personal.clothing(e.group.topwearId,row[0],row[1],e.pantId,row[2]);const expected=personal.complete(pref,personal.shoe(sh,pref,q),personal.watch(w,pref,q));need(stable(expected)===stable(a.preference),'Changed personalized preference');return stable(r)===stable(a.compatibility);}catch{return false;}}
 const controller=Object.freeze({...base.controller,generate:(q,cat,h)=>q?.automatic?generate(q,cat,h):root.HEWRSOptionSetPolicy.limitLegacy(base.controller.generate(q,cat,h),q),generateAsync:(q,cat,h,o)=>q?.automatic?generateAsync(q,cat,h,o):base.controller.generateAsync(q,cat,h,o).then(r=>root.HEWRSOptionSetPolicy.limitLegacy(r,q)),verifyCachedOption:(o,q,cat)=>q?.automatic?verify(o,q,cat):base.controller.verifyCachedOption(o,q,cat),verifyOptionSet:(options,q)=>{try{root.HEWRSOptionSetPolicy.inspect(options,q);return options.every(o=>q?.automatic?verify(o,q,cat):base.controller.verifyCachedOption(o,q,cat));}catch{return false;}}});
 function selectionFromOption(o,q){if(!q?.automatic)return base.selectionFromOption(o,q);need(verify(o,q,cat),'Stale, changed or incompatible automatic option');const s=base.validateSelection(o._hewrsConnected.canonical_selection);return {selection:s,display:{shirt:base.records[s.shirtId].label},representation:{selected_shoe_rendered:true,selected_watch_rendered:false}};}
 return Object.freeze({...base,preference:personal,controller,selectionFromOption,makeRequest:c=>c?.automatic?prepare(c):base.makeRequest(c),automatic:Object.freeze({prepare,verify,indexCounts:copy(index.counts),revision:REV}),implementationVersion:'1.21.0-twenty-unique-ties'});
}
root.HEWRSAutomaticEngine=Object.freeze({create});
root.HEWRSCleanConnection=Object.freeze({create});
})(globalThis);
