/* V1.19.0. Curated complete looks plus a separate, authenticated visual service.
 * Inventory, renderers and historical scores stay read-only. A curated selection
 * is never labelled live AI. Original source holds and hard rejects remain holds.
 */
(function(root){'use strict';
const prior=root.HEWRSCleanConnection,copy=x=>structuredClone(x),stable=root.HEWRSConnectedContract.stable;
const REV='HEWRS_HYBRID_STYLIST_1_21_0',SCHEMA='hewrs.visual-stylist.v1',MODES=['research','curated','visual','heuristic'];
function need(x,m,code='STYLIST_INVALID'){if(!x){const e=Error(m);e.code=code;throw e;}}
function create(inputs){
 const base=prior.create(inputs),cat=base.catalogue,lib=copy(root.HEWRS_STYLIST_LIBRARY);let mode='research',remote=null;
 const research=root.HEWRSAutomaticEngine.create(inputs,{preferenceFactory:root.HEWRSResearchPreference.create,revision:'HEWRS_AUTOMATIC_WORKFLOW_1_21_0'});
 const engineFor=q=>q?.stylist?.mode==='research'?research:base;
 need(lib?.schema==='hewrs.curated-library.v1_19_0'&&lib.source_lock===root.HEWRS_INPUT_SHA256,'Wrong reference library');
 const maps=Object.fromEntries(['shirts','ties','shoes','watches','pants'].map(k=>[k,new Map(cat[k].map(x=>[x.id,x]))]));
 const tops=new Map();for(const id of base.suitSources.ids)tops.set(id,cat.suits.find(x=>x.id===base.aliases.get(id)));
 for(const id of base.blazerConnection.availableIds)tops.set(id,cat.blazers.find(x=>x.id===base.blazerConnection.knownBlazer(id).historyId));
 const identifiedWatch=w=>!w||!/reserved|placeholder|unresolved|current collection/i.test((w.name||'')+' '+(w.color||''));
 function plain(q){const p=copy(q);delete p.stylist;return p;}
 function prepare(c){const m=c.stylistMode||mode;need(MODES.includes(m),'Unknown styling method');const q=(m==='research'?research:base).makeRequest(c);if(!q.automatic)return q;return {...q,stylist:{revision:REV,mode:m}};}
 function valid(q){need(q?.automatic&&q.stylist?.revision===REV&&MODES.includes(q.stylist.mode),'Unknown stylist request');
  const p=engineFor(q).automatic.prepare({preferences:q.prefs,occasion:q.context?.occasion,formality:q.context?.requiredFormality,localDate:q.localDate,environment:q.environment,style:q.executiveStyle});need(stable(p)===stable(plain(q)),'Changed automatic request');return q;}
 function matches(p,id,itemId){return p.mode==='any'||p.mode==='none'&&id===null||p.mode==='item'&&(p.id===id||p.id===itemId)||p.mode==='family'&&id!==null&&base.preference.matchesFamily(id,p.id);}
 function fullItems(s){return {topwear:tops.get(s.suitId||s.blazerId),shirt:maps.shirts.get('shirt-'+s.shirtId),tie:s.state==='NO_TIE'?null:maps.ties.get(s.state),pants:s.pantId?maps.pants.get(base.blazerConnection.knownPant(s.pantId).historyId):null,shoes:maps.shoes.get(s.shoeId),watch:s.watchId?maps.watches.get(s.watchId):null};}
 const evaluations=new Map(),issued=new Set();
 function assess(s,q){try{
  base.validateSelection(s);need(!s.shirtOnly&&s.state!=='REFERENCE','Unsupported automatic configuration');const items=fullItems(s);need(items.topwear&&items.shirt&&items.shoes,'Missing exact wardrobe item');
  need(identifiedWatch(items.watch),'Unresolved watch placeholder excluded from recommendations','UNRESOLVED_WATCH');
  const p=q.prefs;need(matches(p.topwear,s.suitId||s.blazerId,items.topwear.id),'Topwear lock');need(matches(p.shirt,s.shirtId,items.shirt.id),'Shirt lock');need(matches(p.tie,s.state==='NO_TIE'?null:s.state),'Tie lock');
  need(matches(p.shoes,s.shoeId)&&matches(p.watch,s.watchId),'Accessory lock');if(p.bottoms.mode==='item')need(s.pantId===p.bottoms.id,'Trouser lock');
  need(q.context.requiredFormality!=='tie_required'||s.state!=='NO_TIE','Tie required');need(q.context.requiredFormality!=='suit_required'||!!s.suitId,'Suit required');
  const key=stable([s.suitId||s.blazerId,s.pantId,s.shirtId,s.state,q.context]);let raw=evaluations.get(key);if(!raw){raw=base.scoreSelection(s,q.context);evaluations.set(key,raw);if(evaluations.size>4000)evaluations.delete(evaluations.keys().next().value);}
  need(Number.isFinite(raw.score)&&['new_ensemble_estimate','requires_review'].includes(raw.status),'Source assessment unavailable: '+raw.status,'SOURCE_HOLD');
  need(raw.hard_conflict?.hard_reject!==true,'Existing hard incompatibility','HARD_CONFLICT');
  const enriched={...items};for(const role of ['topwear','shirt','tie'])if(items[role]){const id=role==='topwear'?s.suitId||s.blazerId:role==='shirt'?s.shirtId:s.state,f=base.engine.get(id);enriched[role]={...items[role],_feature:f,_family:f.primary.family,_weatherText:f.source_wording?.texture||''};}
  const env=root.HEWRSWeather.assess(enriched,q.environment,q.context);need(env.eligible,'Weather: '+(env.reasons||[]).join('; '),'WEATHER_HOLD');
  const acc=root.HEWRSLegacyAccessories,sh=acc.shoe(items.shoes,enriched,q,raw),wa=items.watch?acc.watch(items.watch,enriched,q):null;need(!sh.rejected&&!wa?.rejected,'Existing accessory/formality restriction','ACCESSORY_HOLD');
  // Classify construction/accessories independently of the old aesthetic floor.
  // raw is never modified or replaced; a low score remains visible in details.
  const effective={...raw,status:'new_ensemble_estimate',candidate_eligible:true};
  const style=root.HEWRSEnsembleCompletion.classifyStyle(enriched.topwear._feature,enriched.shirt._feature,enriched.tie?._feature||null,effective,{shoeStyle:items.shoes.subcategory==='Sneakers'?'sneaker':'other',statementWatch:items.watch?['statement','diamondStatement'].includes(root.watchFormalityCategory(items.watch)):false,controlled:true,evidence:{source_id:'HYBRID_CONSTRUCTION_CLASSIFICATION_NOT_RESCORING'}});
  need(style.authorityGate==='pass'&&(q.executiveStyle==='AUTO'||q.executiveStyle===style.classification),'Style lock','STYLE_HOLD');
  return {eligible:true,selection:copy(s),items:copy(items),compatibility:copy(raw),environment:env,style,accessory:{shoe:sh,watch:wa},legacy_aesthetic_floor_ignored:raw.status==='requires_review'};
 }catch(e){return {eligible:false,selection:copy(s),code:e.code||'LOCK_OR_ROUTE',reason:e.message};}}
 function checkHistory(h){need(Array.isArray(h),'Confirmed history required');const st=root.HEWRSLocalState.create(base,root.HEWRS_INPUT_SHA256,null);st.validate({schema:root.HEWRSLocalState.SCHEMA,source_lock:root.HEWRS_INPUT_SHA256,revision:0,session:null,events:h});}
 function option(e,q,method,id,why,grade=null){const s=e.selection;return {items:copy(e.items),formal:!!s.suitId,dressMode:'work',context:q.context.occasion,styleEngine:q.executiveStyle,controlledRepetition:false,_hewrsConnected:{revision:REV,id:root.HEWRSOptionSetPolicy.fullKey(e),compatibility:copy(e.compatibility),canonical_selection:copy(s),environment:copy(e.environment),accessory_assessment:copy(e.accessory),is_recommendation:false,validation:{request:stable(q)},stylist:{schema:SCHEMA,method,reference_id:id,explanation:why,grade,trained_on_user:false,legacy_aesthetic_floor_ignored:e.legacy_aesthetic_floor_ignored}}};}
 function curatedPool(q){const rows=[],rejected=[],seen=new Set();const anchor=q.prefs.topwear.mode==='item'?q.prefs.topwear.id:null;
  const order=[...lib.records].sort((a,b)=>{const priority=x=>anchor===base.aliases.get('S10')?(x.set==='s10-reference'?0:x.set==='free-reference'?1:2):(x.set==='free-reference'?0:x.set==='s10-reference'?2:1);return priority(a)-priority(b);});
  for(const r of order){const s=copy(r.selection);let adapted=false;for(const role of ['shoes','watch']){const p=q.prefs[role],key=role==='shoes'?'shoeId':'watchId';if(p.mode==='item'&&s[key]!==p.id){s[key]=p.id;adapted=true;}if(role==='watch'&&p.mode==='none'&&s.watchId!==null){s.watchId=null;adapted=true;}}
   const e=assess(s,q);if(!e.eligible){rejected.push({id:r.id,code:e.code,reason:e.reason});continue;}
   const k=root.HEWRSOptionSetPolicy.fullKey(e);if(seen.has(k))continue;seen.add(k);
   rows.push(option(e,q,'curated',r.id,r.rationale+(adapted?' Explicit accessory lock applied and rechecked.':'')));
  }return {rows,rejected};}
 function select(rows,q,h,method){checkHistory(h);const capacity=root.HEWRSOptionSetPolicy.create(q),chosen=[];let rotation=null;
  // Reference order is editorial, not a 9.9 aesthetic score. Use the existing
  // confirmed-history policy only among the same top assessment tier.
  const bestGrade=rows.find(x=>x._hewrsConnected.stylist.grade!=='avoid')?._hewrsConnected.stylist.grade;
  const tier=rows.filter(o=>o._hewrsConnected.stylist.grade===bestGrade&&o._hewrsConnected.stylist.grade!=='avoid').slice(0,q.limit);
  if(tier.length){const slim=tier.map(o=>({id:o._hewrsConnected.id,items:o.items,result:{candidate_eligible:true,display_score:10,score:10,ids:o._hewrsConnected.compatibility.ids,style:assess(o._hewrsConnected.canonical_selection,q).style,context:{status:'eligible'}}}));
   rotation=base.engine.selectForContext(slim,h,{style:q.executiveStyle,localDate:q.localDate});rotation.ranking_basis='Equal editorial/visual tier; temporary constant utility is NOT a compatibility or styling grade.';
   if(h.length&&rotation.selected){const idx=rows.findIndex(o=>o._hewrsConnected.id===rotation.selected.id);if(idx>=0)rows=[rows[idx],...rows.filter((_,i)=>i!==idx)];}
  }
  for(const o of rows){if(o._hewrsConnected.stylist.grade==='avoid'||capacity.issue(o))continue;capacity.add(o);o._hewrsConnected.rank=chosen.length+1;o._hewrsConnected.list_position=chosen.length+1;o._hewrsConnected.is_recommendation=!!rotation?.selected&&rotation.selected.id===o._hewrsConnected.id;o.controlledRepetition=!rotation?.selected&&rotation?.rotation?.status==='rotation_exception_requires_owner_confirmation';chosen.push(o);if(chosen.length===q.limit)break;}
  for(const o of chosen){issued.add(stable([q,o]));while(issued.size>4096)issued.delete(issued.values().next().value);}
  return {status:'stylist_options',options:chosen,rotation,requested_options:q.limit,returned_options:chosen.length,option_policy:capacity.snapshot(),stylist:{revision:REV,method,live_ai_used:method==='visual'},diagnostics:{examined:rows.length},reason:chosen.length<q.limit?'Found '+chosen.length+' matching '+(method==='curated'?'reference-library':'visually reviewed')+' outfits. Locks, weather, source holds, one-use ties and two-use other-item caps were retained; no heuristic filler was added.':null};}
 function verify(o,q){try{valid(q);const a=o?._hewrsConnected;need(a?.revision===REV&&a.validation?.request===stable(q)&&a.stylist?.schema===SCHEMA&&issued.has(stable([q,o])),'Stale or altered stylist option');need(['curated','visual'].includes(a.stylist.method),'Unknown assessment method');const e=assess(a.canonical_selection,q);need(e.eligible&&stable(o.items)===stable(e.items),'Changed IDs/eligibility');need(a.id===root.HEWRSOptionSetPolicy.fullKey(e),'Changed option identity');need(stable(a.compatibility)===stable(e.compatibility)&&stable(a.environment)===stable(e.environment),'Changed source evidence');return true;}catch{return false;}}
 function curated(q,h){valid(q);const pool=curatedPool(q);const r=select(pool.rows,q,h,'curated');r.diagnostics.library_records=lib.records.length;r.diagnostics.rejected=pool.rejected;return r;}
 async function visual(q,h,opts){valid(q);checkHistory(h);need(remote?.ready(),'Live visual service is not connected. Choose Curated reference library or configure the secure service under Style → Stylist settings.','VISUAL_NOT_CONNECTED');need(opts.renderForStylist,'Visual renderer is unavailable');
  const proposal=await remote.propose(q,opts);if(opts.isCancelled?.())return {status:'cancelled',options:[]};
  need(Array.isArray(proposal.proposals)&&proposal.proposals.length<=40,'Malformed visual proposals');
  const pool=curatedPool(q),rows=[],seen=new Set(),reject=[];
  // Independent references are included before model proposals; not just old top15.
  const add=(e,id,why,method)=>{if(!e.eligible){reject.push({id,code:e.code,reason:e.reason});return;}const k=root.HEWRSOptionSetPolicy.fullKey(e);if(seen.has(k))return;seen.add(k);rows.push(option(e,q,method,id,why));};
  for(const o of pool.rows.slice(0,20))add(assess(o._hewrsConnected.canonical_selection,q),o._hewrsConnected.stylist.reference_id,o._hewrsConnected.stylist.explanation,'visual');
  for(const [i,x]of proposal.proposals.entries())add(assess(x.selection,q),'AI_PROPOSAL_'+i,x.rationale,'visual');
  need(rows.length,'No proposed/reference outfit passes the current locks and source/condition rules.','VISUAL_NO_ELIGIBLE');
  const images=[];for(let i=0;i<rows.length;i++){if(opts.isCancelled?.())return {status:'cancelled',options:[]};opts.onProgress?.({phase:'rendering-for-visual-review',examined:i+1,total:rows.length});const o=rows[i];images.push({candidate_id:'C'+String(i+1).padStart(3,'0'),selection:copy(o._hewrsConnected.canonical_selection),image:await opts.renderForStylist(o._hewrsConnected.canonical_selection)});}
  const judged=await remote.evaluate(q,images,proposal.job_id,opts);if(opts.isCancelled?.())return {status:'cancelled',options:[]};need(judged?.method==='live_visual'&&judged.ranking?.length===rows.length,'Incomplete visual assessment');
  const ids=new Set(),ranked=[];for(const r of judged.ranking){const i=images.findIndex(x=>x.candidate_id===r.candidate_id);need(i>=0&&!ids.has(r.candidate_id)&&['recommended','strong','exploratory','avoid'].includes(r.grade)&&typeof r.explanation==='string'&&r.explanation.length<=1200,'Unknown, duplicate or invalid assessed candidate');ids.add(r.candidate_id);const o=copy(rows[i]);Object.assign(o._hewrsConnected.stylist,{grade:r.grade,explanation:r.explanation,provider:judged.provider,model:judged.model,job_id:judged.job_id,visually_reviewed:true});ranked.push(o);}
  // Coarse model grades only; no invented 9.99 score. Preserve model order within grade.
  const grades=['recommended','strong','exploratory','avoid'];ranked.sort((a,b)=>grades.indexOf(a._hewrsConnected.stylist.grade)-grades.indexOf(b._hewrsConnected.stylist.grade));
  const out=select(ranked,q,h,'visual');out.diagnostics.proposal_rejections=reject;out.stylist.provider=judged.provider;out.stylist.model=judged.model;out.stylist.candidates_visually_reviewed=rows.length;return out;
 }
 function generate(q,catArg,h){if(!q?.stylist)return base.controller.generate(q,catArg,h);valid(q);need(stable(catArg)===stable(cat),'Changed catalogue');if(['research','heuristic'].includes(q.stylist.mode))return engineFor(q).controller.generate(plain(q),catArg,h);need(q.stylist.mode==='curated','Visual mode requires asynchronous generation');return curated(q,h);}
 async function generateAsync(q,catArg,h,opts={}){if(!q?.stylist)return base.controller.generateAsync(q,catArg,h,opts);valid(q);need(stable(catArg)===stable(cat),'Changed catalogue');if(['research','heuristic'].includes(q.stylist.mode))return engineFor(q).controller.generateAsync(plain(q),catArg,h,opts);if(opts.isCancelled?.())return {status:'cancelled',options:[]};return q.stylist.mode==='visual'?visual(q,h,opts):curated(q,h);}
 const isOwn=o=>o?._hewrsConnected?.revision===REV;
 const controller=Object.freeze({...base.controller,generate,generateAsync,verifyCachedOption:(o,q,c)=>isOwn(o)?stable(c)===stable(cat)&&verify(o,q):engineFor(q).controller.verifyCachedOption(o,q?.stylist?plain(q):q,c),verifyOptionSet:(opts,q)=>{try{root.HEWRSOptionSetPolicy.inspect(opts,q);return opts.every(o=>isOwn(o)?verify(o,q):engineFor(q).controller.verifyCachedOption(o,q?.stylist?plain(q):q,cat));}catch{return false;}}});
 return Object.freeze({...base,controller,makeRequest:prepare,selectionFromOption:(o,q)=>isOwn(o)?(need(verify(o,q),'Changed stylist option'),{selection:copy(o._hewrsConnected.canonical_selection),display:{shirt:base.records[o._hewrsConnected.canonical_selection.shirtId].label},representation:{selected_shoe_rendered:true,selected_watch_rendered:false}}):engineFor(q).selectionFromOption(o,q?.stylist?plain(q):q),hybrid:Object.freeze({revision:REV,researchPreference:research.preference,preferenceForMode:()=>mode==='research'?research.preference:base.preference,library:copy(lib),assess,curatedPool,select,mode:()=>mode,setMode:m=>{need(MODES.includes(m),'Unknown stylist mode');mode=m;},setService:s=>{remote=s;},identifiedWatch,plain}),implementationVersion:'1.21.0-twenty-unique-ties'});
}
root.HEWRSCleanConnection=Object.freeze({create});root.HEWRSHybridStylist=Object.freeze({REV,SCHEMA,MODES});
})(globalThis);
