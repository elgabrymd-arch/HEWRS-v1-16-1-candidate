/* V1.17.0 complete-choice coordinator. Existing numerical engine, input data,
 * renderers, history identities and 0.2 near-equivalent rotation are unchanged.
 * Derived index accelerates enumeration; selected scores are always recalculated.
 * Environment is a separate eligibility domain, never an aesthetic score bonus.
 */
(function(root){'use strict';
const prior=root.HEWRSCleanConnection,copy=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};
const REV='HEWRS_AUTOMATIC_WORKFLOW_1_17_0',cmp=(a,b)=>a<b?-1:a>b?1:0,stable=root.HEWRSConnectedContract.stable;
function create(inputs){
 const base=prior.create(inputs),cat=base.catalogue,index=root.HEWRS_OPTION_INDEX;
 need(index?.schema==='hewrs.derived-clothing-index.v1_17_0'&&index.source_input_sha256===root.HEWRS_INPUT_SHA256,'Clothing index is incompatible with current DNA');
 const tops=new Map(),shirts=new Map(cat.shirts.map(i=>[i.id,i])),ties=new Map(cat.ties.map(i=>[i.id,i])),shoes=new Map(cat.shoes.filter(i=>!i.disabled&&Object.hasOwn(base.shoeLayers,i.id)).map(i=>[i.id,i])),watches=new Map(cat.watches.filter(i=>!i.disabled).map(i=>[i.id,i])),pants=new Map();
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
  need(['AUTO','CLASSIC','HYBRID','MODERN'].includes(config.style||'AUTO'),'Unknown style');return {automatic:true,revision:REV,source_lock:root.HEWRS_INPUT_SHA256,prefs:p,context,localDate:config.localDate,environment:env,executiveStyle:config.style||'AUTO',dressMode:'work',limit:15,sneakerStance:p.shoes.mode==='item'&&shoes.get(p.shoes.id)?.subcategory==='Sneakers'};
 }
 function valid(q){need(q?.automatic===true&&q.revision===REV&&q.source_lock===root.HEWRS_INPUT_SHA256,'Unknown automatic request');const p=prepare({preferences:q.prefs,occasion:q.context?.occasion,formality:q.context?.requiredFormality,localDate:q.localDate,environment:q.environment,style:q.executiveStyle});need(stable(p)===stable(q),'Malformed or changed automatic request');return p;}
 function matchesPref(v,id,family){return v.mode==='any'||v.mode==='item'&&v.id===id||v.mode==='family'&&v.id===family||v.mode==='none'&&id===null;}
 function clothingFits(group,row,q){const t=tops.get(group.topwearId),p=q.prefs;if(!t)return false;if(p.topwear.mode==='item'&&p.topwear.id!==t.id)return false;if(p.bottoms.mode==='item'&&p.topwear.mode!=='item'&&t.formal)return false;
  const sf=features.get(row[0])?.primary.family,tf=row[1]==='NO_TIE'?null:ties.get(row[1])?.colorFamily;
  if(!matchesPref(p.shirt,row[0],sf==='charcoal'?'grey':sf)||!matchesPref(p.tie,row[1]==='NO_TIE'?null:row[1],tf))return false;
  if(q.context.requiredFormality==='tie_required'&&row[1]==='NO_TIE'||q.context.requiredFormality==='suit_required'&&!t.formal)return false;return true;
 }
 function selection(e,shoe,watch){return e.group.topwearId[0]==='S'?{suitId:e.group.topwearId,shirtId:e.row[0],state:e.row[1],shoeId:shoe.id,watchId:watch?.id??null}:{blazerId:e.group.topwearId,pantId:e.pantId,shirtId:e.row[0],state:e.row[1],shoeId:shoe.id,watchId:watch?.id??null};}
 function fullItems(e,shoe,watch){return {topwear:tops.get(e.group.topwearId),shirt:shirts.get('shirt-'+e.row[0]),tie:e.row[1]==='NO_TIE'?null:ties.get(e.row[1]),pants:e.pantId?pants.get(e.pantId):null,shoes:shoe,watch};}
 function requestFor(e,q,accessories){return {topwearId:e.group.topwearId,shirtId:e.row[0],tieId:e.row[1]==='NO_TIE'?null:e.row[1],...(e.group.pantProfileId?{pantProfileId:e.group.pantProfileId}:{}),context:q.context,versionPolicy:'strict',...(accessories?{accessories}:{})};}
 const evidence=(shoe,watch)=>({shoeStyle:shoe.subcategory==='Sneakers'?'sneaker':'other',statementWatch:watch?['statement','diamondStatement'].includes(root.watchFormalityCategory(watch)):false,controlled:true,evidence:{source_id:'RECOVERED_ACCESSORY_POLICY_CURRENT_CANONICAL_FEATURE_ADAPTER',shoe_id:shoe.id,watch_id:watch?.id??null,evidence_status:'inherited_rule_inference_not_owner_measurement'}});
 function weatherItems(e,shoe,watch){return {topwear:enrich(tops.get(e.group.topwearId),e.group.topwearId),shirt:enrich(shirts.get('shirt-'+e.row[0]),e.row[0]),tie:e.row[1]==='NO_TIE'?null:enrich(ties.get(e.row[1]),e.row[1]),pants:e.pantId?pants.get(e.pantId):null,shoes:shoe,watch};}
 function detail(e,q,shoe,watch){const a=evidence(shoe,watch),r=base.engine.evaluate(requestFor(e,q,a));need(r.score===e.row[2]&&r.display_score===e.row[3]&&r.candidate_eligible,'Clothing cache does not match unchanged source engine');return r;}
 function outfitID(s){return [s.suitId||s.blazerId||'SHIRT_ONLY',s.pantId||'SUIT_TROUSERS',s.shirtId,s.state,s.shoeId,s.watchId||'NO_WATCH'].join('|');}
 function resolveCandidate(e,q,history,worn){const r=base.engine.evaluate(requestFor(e,q));if(!r.candidate_eligible||r.context.status!=='eligible')return null;need(r.score===e.row[2]&&r.display_score===e.row[3],'Source-index score mismatch');
  const top=weatherItems(e,null,null),policy=root.HEWRSLegacyAccessories;
  const tieOrder=(a,b)=>cmp(worn.get(a.item.id)||'',worn.get(b.item.id)||'')||cmp(a.item.id,b.item.id);
  let pool=(q.prefs.shoes.mode==='item'?[shoes.get(q.prefs.shoes.id)]:[...shoes.values()]).map(item=>({item,assessment:policy.shoe(item,top,q,r)})).filter(x=>!x.assessment.rejected).sort((a,b)=>b.assessment.score-a.assessment.score||tieOrder(a,b));
  for(const sh of pool){const wi={...top,shoes:sh.item},env=root.HEWRSWeather.assess(wi,q.environment,q.context);if(!env.eligible)continue;
   const wpool=q.prefs.watch.mode==='none'?[{item:null,assessment:null}]:(q.prefs.watch.mode==='item'?[watches.get(q.prefs.watch.id)]:[...watches.values()]).map(item=>({item,assessment:policy.watch(item,wi,q)})).filter(x=>!x.assessment.rejected).sort((a,b)=>b.assessment.score-a.assessment.score||tieOrder(a,b));
   for(const w of wpool){const sty=root.HEWRSEnsembleCompletion.classifyStyle(features.get(e.group.topwearId),features.get(e.row[0]),e.row[1]==='NO_TIE'?null:features.get(e.row[1]),r,evidence(sh.item,w.item));if(sty.authorityGate!=='pass'||q.executiveStyle!=='AUTO'&&q.executiveStyle!==sty.classification)continue;
    const s=selection(e,sh.item,w.item);base.validateSelection(s);return {id:outfitID(s),selection:s,items:fullItems(e,sh.item,w.item),result:{candidate_eligible:true,display_score:r.display_score,score:r.score,ids:r.ids,context:r.context,style:sty},entry:e,environment:env,accessory:{shoe:sh.assessment,watch:w.assessment}};
   }
  }return null;
 }
 function* steps(q,catalogue,history){valid(q);need(stable(catalogue)===stable(cat),'Catalogue does not match current source');need(Array.isArray(history),'Confirmed history must be supplied');
  const wearCheck=root.HEWRSLocalState.create(base,root.HEWRS_INPUT_SHA256,null);wearCheck.validate({schema:root.HEWRSLocalState.SCHEMA,source_lock:root.HEWRS_INPUT_SHA256,revision:0,session:null,events:history});
  const diagnostics={enumerated:0,examined:0,score_statuses:{},weather_style_or_accessory_holds:0,unbound_trouser_ids:[],numeric_candidates:0,domain_evaluated:0},candidates=[];
  for(const group of index.groups){let ps=[null];if(group.pantProfileId)ps=base.trouserProfiles.boundIds.filter(id=>base.trouserProfiles.binding(id).profileId===group.pantProfileId&&(q.prefs.bottoms.mode!=='item'||id===q.prefs.bottoms.id));
   for(const row of group.rows){if(!clothingFits(group,row,q))continue;for(const pid of ps){diagnostics.enumerated++;diagnostics.score_statuses[row[5]]=(diagnostics.score_statuses[row[5]]||0)+1;if(!row[4])continue;const e={group,row,pantId:pid,key:[tops.get(group.topwearId).id,'shirt-'+row[0],row[1],pid?pants.get(pid).id:'SUIT_TROUSERS'].join('|')};candidates.push(e);} }
   yield {phase:'source-index',examined:diagnostics.enumerated};
  }
  if(q.prefs.bottoms.mode==='item'&&!base.trouserProfiles.binding(q.prefs.bottoms.id))diagnostics.unbound_trouser_ids.push(q.prefs.bottoms.id);
  diagnostics.numeric_candidates=candidates.length;candidates.sort((a,b)=>b.row[3]-a.row[3]||cmp(a.key,b.key));
  const worn=new Map();for(const h of history||[])if(h.confirmed===true&&root.HEWRSLocalState.date(h.localDate)&&h.localDate<=q.localDate)for(const it of Object.values(h.items||{}))if(it?.id&&(!worn.has(it.id)||worn.get(it.id)<h.localDate))worn.set(it.id,h.localDate);
  const accepted=[];let best=null,cutoff=null,remainingSkipped=0;
  const band=inputs.logicData.rotationPolicy.nearEquivalentBand;
  for(let i=0;i<candidates.length;i++){const e=candidates[i];if(accepted.length>=15&&e.row[3]<cutoff-1e-9){remainingSkipped=candidates.length-i;break;}
   diagnostics.domain_evaluated++;const r=resolveCandidate(e,q,history,worn);if(r){accepted.push(r);if(best===null){best=r.result.display_score;cutoff=best-band;}}else diagnostics.weather_style_or_accessory_holds++;
   if((i+1)%40===0)yield {phase:'weather-accessories',examined:diagnostics.enumerated,domain_evaluated:diagnostics.domain_evaluated};
  }
  diagnostics.examined=diagnostics.enumerated;diagnostics.lower_scoring_candidates_safely_skipped=remainingSkipped;
  if(!accepted.length)return {status:'no_qualified_candidate',options:[],diagnostics,reason:diagnostics.unbound_trouser_ids.length?'These trousers have no recorded numerical colour-profile binding. Exact manual Anchor selection remains available.':'No scored outfit satisfies every selected lock, style and weather rule. Existing score holds remain excluded; no lock or weather condition was relaxed.'};
  const slim=accepted.map(x=>({id:x.id,items:x.items,result:x.result})),rot=base.engine.selectForContext(slim,history,{style:q.executiveStyle,localDate:q.localDate});
  const winner=rot.selected?accepted.find(e=>e.id===rot.selected.id):null;
  const order=accepted.slice().sort((a,b)=>b.result.display_score-a.result.display_score||cmp(a.entry.key,b.entry.key));const chosen=winner?[winner,...order.filter(x=>x!==winner)]:order;
  const options=chosen.slice(0,15).map(e=>{const score=detail(e.entry,q,e.items.shoes,e.items.watch);return {items:copy(e.items),formal:!!e.items.topwear.formal,dressMode:q.dressMode,context:q.context.occasion,styleEngine:q.executiveStyle,controlledRepetition:!winner&&rot.rotation?.status==='rotation_exception_requires_owner_confirmation',_hewrsConnected:{revision:REV,mode:'candidate',id:e.id,compatibility:score,is_recommendation:!!winner&&winner.id===e.id,rank:order.findIndex(x=>x.result.display_score===e.result.display_score)+1,production_enabled:false,source_spec_approved:false,accessory_method:'Recovered independent accessory ranking; shoes after clothing, watch last',accessory_assessment:copy(e.accessory),environment:copy(e.environment),validation:{request:stable(q)},canonical_selection:copy(e.selection)}};});
  need(new Set(options.map(x=>x._hewrsConnected.id)).size===options.length,'Duplicate outfits in result');return {status:winner?'candidate_recommendation':'compatibility_options_rotation_confirmation_required',options,diagnostics,rotation:rot,requested_options:15,returned_options:options.length,reason:options.length<15?'Only '+options.length+' distinct complete outfits qualify for these exact settings. No duplicates, invented scores or relaxed locks were added.':null,environment:copy(q.environment),coverage:{source_index_rows:index.counts.rows,unresolved_scores_excluded:true,complete_accessory_search:false,accessory_policy:'Best available bound accessories per clothing configuration; alternatives do not pad the 15 clothing choices',all_retained_physical_ids_independent:true,compatibility_unchanged:true}};
 }
 function generate(q,cat,h){const it=steps(q,cat,h);for(;;){const x=it.next();if(x.done)return x.value;}}
 function generateAsync(q,cat,h,opts={}){const v=copy({q,h}),it=steps(v.q,cat,v.h);return new Promise((resolve,reject)=>{function step(){try{if(opts.isCancelled?.()){it.return();return resolve({status:'cancelled',options:[]});}const v=it.next();if(v.done)return resolve(v.value);opts.onProgress?.(v.value);setTimeout(step,0);}catch(e){reject(e);}}setTimeout(step,0);});}
 function verify(o,q,catalogue){try{valid(q);need(stable(catalogue)===stable(cat),'Different catalogue');const a=o?._hewrsConnected;need(a?.revision===REV&&a.validation?.request===stable(q),'Changed request');const s=base.validateSelection(a.canonical_selection);need(a.id===outfitID(s),'Different option ID');const group=index.groups.find(x=>x.topwearId===(s.suitId||s.blazerId)&&x.pantProfileId===(s.pantId?base.trouserProfiles.binding(s.pantId)?.profileId:null));need(group,'No indexed source group');const row=group.rows.find(x=>x[0]===s.shirtId&&x[1]===s.state),e={group,row,pantId:s.pantId||null};need(row&&row[4]&&clothingFits(group,row,q),'Changed clothing lock');if(s.pantId&&q.prefs.bottoms.mode==='item')need(s.pantId===q.prefs.bottoms.id,'Changed trousers');need(matchesPref(q.prefs.shoes,s.shoeId)&&matchesPref(q.prefs.watch,s.watchId),'Changed accessories');const sh=shoes.get(s.shoeId),w=s.watchId?watches.get(s.watchId):null;need(stable(o.items)===stable(fullItems(e,sh,w)),'Changed item records');const r=detail(e,q,sh,w),env=root.HEWRSWeather.assess(weatherItems(e,sh,w),q.environment,q.context);need(env.eligible&&stable(env)===stable(a.environment),'Changed weather eligibility');need(r.style.authorityGate==='pass'&&(q.executiveStyle==='AUTO'||r.style.classification===q.executiveStyle),'Changed style');return stable(r)===stable(a.compatibility);}catch{return false;}}
 const controller=Object.freeze({...base.controller,generate:(q,cat,h)=>q?.automatic?generate(q,cat,h):base.controller.generate(q,cat,h),generateAsync:(q,cat,h,o)=>q?.automatic?generateAsync(q,cat,h,o):base.controller.generateAsync(q,cat,h,o),verifyCachedOption:(o,q,cat)=>q?.automatic?verify(o,q,cat):base.controller.verifyCachedOption(o,q,cat)});
 function selectionFromOption(o,q){if(!q?.automatic)return base.selectionFromOption(o,q);need(verify(o,q,cat),'Stale, changed or incompatible automatic option');const s=base.validateSelection(o._hewrsConnected.canonical_selection);return {selection:s,display:{shirt:base.records[s.shirtId].label},representation:{selected_shoe_rendered:true,selected_watch_rendered:false}};}
 return Object.freeze({...base,controller,selectionFromOption,makeRequest:c=>c?.automatic?prepare(c):base.makeRequest(c),automatic:Object.freeze({prepare,verify,indexCounts:copy(index.counts),revision:REV}),implementationVersion:'1.17.0-engine-weather'});
}
root.HEWRSCleanConnection=Object.freeze({create});
})(globalThis);
