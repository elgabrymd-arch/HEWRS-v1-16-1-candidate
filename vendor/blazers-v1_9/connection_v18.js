/* Clean application connection. No source images, stored scores, calibration,
 * legacy storage, or positional IDs are modified. */
(function(root){
'use strict';
const clone=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};
function create(inputs,{configurationFilter}={}){
 const p=clone(inputs),m=p.manifest;
 const suitSources=root.HEWRSApprovedSuitSources.create(root.HEWRS_APPROVED_SUITS_DATA,p.suitAliases);
 const assemblies=root.HEWRSSuitAssemblies.create(suitSources,m,p.shoeLayers);
 need(p.schema==='hewrs.clean.connection.inputs.v1','Unexpected input schema');
 const features=new Map(p.features.records.map(r=>[r.id,r]));
 const aliases=new Map(p.suitAliases.map(r=>[r.source_id,r.app_id]));
 const reverse=new Map(p.suitAliases.map(r=>[r.app_id,r.source_id]));
 need(aliases.get('S05')==='suit-4','Explicit S05 crosswalk changed');
 const catalogue=clone(p.originalCatalogue);
 // Preserve historical labels in the bundled original. Use one pinned view
 // record for controls, candidate identities and the canonical source bridge.
 const records={};
 for(const sid of m.shirt_order){
  const f=features.get(sid);need(f,'Missing canonical shirt feature record');
  const legacy=catalogue.shirts.find(s=>s.id==='shirt-'+sid);need(legacy,'Missing existing shirt identity');
  const text=m.shirts[sid].label;
  const generic=/identity unchanged|record unchanged|DNA unchanged|owner.designated/.test(text);
  let label=generic?f.description:text;
  // Conflicting narrative mappings are not settled by array position. Display
  // the exact ID for these source records; the approved image is still usable.
  if(['DS011','DS040','DS042','DS043'].includes(sid))label='Approved source layer';
  Object.assign(legacy,{name:label,color:f.primary_text,pattern:f.pattern_text,
   _canonical:{id:sid,label,source:'Active50 manifest + pinned feature record',source_text_disagreement:['DS011','DS040','DS042','DS043'].includes(sid)}});
  records[sid]={id:sid,label,feature:clone(f),render_label:text,history_id:legacy.id,no_tie_only:m.shirts[sid].mode_policy==='NO_TIE_ONLY'};
 }
 for(const row of p.suitAliases){const item=catalogue.suits.find(s=>s.id===row.app_id),f=features.get(row.source_id);need(item&&f,'Broken suit alias');item.name=f.description;item.color=f.primary_text;item.pattern=f.pattern_text;item._canonical={id:row.source_id,source:'FEATURE_INPUTS.json'};}
 for(const item of catalogue.ties){const f=features.get(item.id);need(f,'Missing tie feature record');item.name=f.description;item.color=f.primary_text;item.pattern=f.pattern_text;item._canonical={id:item.id,source:'FEATURE_INPUTS.json'};}
 const base=root.HEWRSLogic.createEngine(p.logicData);
 const registry=root.HEWRSStep3Scores.createRegistry(p.approved,p.approval);
 const source=root.HEWRSStep3Scores.withApprovedScores(base,root.HEWRSLogic,registry,p.logicData.ensembleComponents);
 const rawEngine=root.HEWRSEnsembleCompletion.createEngine({featureInputs:p.features,spec:p.spec,sourceEngine:source,logic:root.HEWRSLogic,rotationPolicy:p.logicData.rotationPolicy});
 const textHolds=new Set(['DS011','DS040','DS042','DS043']);
 // Source-description conflicts may not silently generate a current score.
 // No stored value is changed and no render approval is withheld.
 function evaluate(q){
  const id=String(q.shirtId||'').replace(/^shirt-/,'');
  if(textHolds.has(id))return {status:'canonical_data_hold',score:null,display_score:null,candidate_eligible:false,
   reason_codes:['CONFLICTING_NARRATIVE_RECORDS_NOT_USED_AS_CURRENT_SCORING_FACTS'],ids:{topwear:q.topwearId,shirt:id,tie:q.tieId??null},
   render_approval:'preserved',preview_available:true};
  return rawEngine.evaluate(q);
 }
 const engine=Object.freeze({...rawEngine,evaluate});
 function exactAccessories(items,q,cat){
  if(q.shoes?.mode!=='item'||!Object.hasOwn(p.shoeLayers,q.shoes.id))return {status:'unavailable',reason:'Exact registered footwear selection required; no automatic substitution'};
  const shoes=cat.shoes.find(s=>s.id===q.shoes.id&&!s.disabled);
  const watch=q.watch?.mode==='item'?cat.watches.find(w=>w.id===q.watch.id):null;
  if(!shoes||(q.watch&&!watch))return {status:'unavailable',reason:'Unknown exact accessory identity'};
  const type=watch?root.watchFormalityCategory(watch):null;
  return {status:'bound',shoes:clone(shoes),watch:watch?clone(watch):null,
   method:'Explicit accessory selection; no legacy accessory ranking or new accessory score.',
   styleEvidence:{shoeStyle:shoes.subcategory==='Sneakers'?'sneaker':'other',statementWatch:['statement','diamondStatement'].includes(type),controlled:true,
    evidence:{source_id:'EXACT_SELECTION_WITH_INHERITED_WATCH_CLASSIFICATION',shoe_id:shoes.id,watch_id:watch?.id??null,evidence_status:'inherited_rule_inference_not_owner_statement'}}};
 }
 const controller=root.HEWRSConnectedPath.create({engine,guards:root.HEWRSRelease4,suitMappings:p.suitAliases,blazerMappings:p.blazerAliases,accessoryResolver:exactAccessories,configurationFilter});
 const bridge=root.createCanonicalBindings({featureInputs:p.features,sourceBindings:p.sourceBindings,active50Manifest:m,suitAliases:p.suitAliases,validateCandidate:controller.verifyCachedOption,supportedSuitIds:suitSources.ids,canRenderSelection:assemblies.supported});
 function validateSelection(s){
  need(s&&typeof s==='object'&&!Array.isArray(s),'Selection must be an object');
  suitSources.resolveCanonical(s.suitId);
  assemblies.requireDynamic(s.suitId,s.shirtId,s.state);
  bridge.stateRequest(s.suitId,s.shirtId,s.state);
  need(Object.hasOwn(p.shoeLayers,s.shoeId),'No registered layer for this exact shoe ID');
  need(catalogue.shoes.some(x=>x.id===s.shoeId&&!x.disabled),'Disabled or unknown footwear');
  need(s.watchId===null||catalogue.watches.some(w=>w.id===s.watchId),'Unknown watch ID');
  return clone(s);
 }
 function historyIds(s){validateSelection(s);return {topwear:aliases.get(s.suitId),shirt:records[s.shirtId].history_id,tie:s.state==='NO_TIE'?null:s.state==='REFERENCE'?null:s.state,shoes:s.shoeId,watch:s.watchId,pants:null};}
 function selectionFromOption(o,q){
  const suitSource=suitSources.resolveCandidate(o);
  const b=bridge.bindCandidate(o,q,catalogue),s={...b.render_request,shoeId:o.items.shoes.id,watchId:o.items.watch?.id??null};
  validateSelection(s);return {selection:s,binding:b,suit_source:suitSource,display:{shirt:records[s.shirtId].label,suit:features.get(s.suitId).description,tie:s.state==='NO_TIE'?'No tie':features.get(s.state)?.description||s.state,
   shoes:catalogue.shoes.find(x=>x.id===s.shoeId).name,watch:s.watchId?catalogue.watches.find(x=>x.id===s.watchId).name:null},
   representation:{selected_shoe_rendered:true,selected_watch_rendered:false,watch_metadata_only:s.watchId!==null}};
 }
 function scoreSelection(s,context={occasion:'clinic',requiredFormality:'any'}){
  validateSelection(s);if(s.state==='REFERENCE')return {status:'retained_reference',score:null,candidate_eligible:false};
  const q={topwearId:s.suitId,shirtId:s.shirtId,tieId:s.state==='NO_TIE'?null:s.state,context,versionPolicy:'strict'};
  return evaluate(q);
 }
 function makeRequest(c){
  const suitId=c.suitId??'S05';
  suitSources.resolveCanonical(suitId);
  assemblies.requireDynamic(suitId);
  if(c.shirt&&c.shirt!=='ANY'){
   need(typeof c.shirt==='string','Explicit Engine shirt selector must be a string');
   if(!c.shirt.startsWith('FAMILY:')){
    const shirtId=c.shirt.replace(/^shirt-/,'');
    need(Object.hasOwn(records,shirtId),'No source for this exact Engine shirt selection');
   }
  }
  need(c.tie!=='REFERENCE','REFERENCE is a retained S05 control, not an Engine tie selection');
  need(Object.hasOwn(p.shoeLayers,c.shoeId),'No registered layer for this exact Engine footwear selection');
  if(c.tie&&c.tie!=='ANY'&&c.tie!=='NO_TIE'&&!c.tie.startsWith('FAMILY:'))
   need(Object.hasOwn(m.ties,c.tie),'No source for this exact Engine tie selection');
  if(c.watchId)need(catalogue.watches.some(w=>w.id===c.watchId),'Unknown exact Engine watch selection');
  const q={mode:'candidate',dressMode:'work',topwear:{mode:'item',id:aliases.get(suitId),formal:true},
   shoes:{mode:'item',id:c.shoeId},executiveStyle:c.style||'AUTO',context:{occasion:c.occasion||'clinic',requiredFormality:c.formality||'any'},localDate:c.localDate,limit:15};
  if(c.watchId)q.watch={mode:'item',id:c.watchId};
  if(c.shirt&&c.shirt!=='ANY'){if(c.shirt.startsWith('FAMILY:'))q.shirt={mode:'category',category:c.shirt.slice(7)};else q.shirt={mode:'item',id:records[c.shirt]?.history_id||c.shirt};}
  if(c.tie&&c.tie!=='ANY')q.tie=c.tie==='NO_TIE'?{mode:'none'}:c.tie.startsWith('FAMILY:')?{mode:'category',category:c.tie.slice(7)}:{mode:'item',id:c.tie};
  const checked=root.HEWRSConnectedContract.prepare(q,catalogue);need(checked.allowed,checked.reason);return checked.query;
 }
 function createHistoryEvent(s,{id,localDate,origin='manual',controlledRepetition=false}){
  need(s.state!=='REFERENCE','A retained reference is not an exact selected-tie wear record');
  const ids=historyIds(s),event={id,localDate,date:localDate,confirmed:true,origin,controlledRepetition,items:{},canonical_selection:validateSelection(s),source_lock:root.HEWRS_INPUT_SHA256};
  for(const [role,value]of Object.entries(ids))event.items[role]=value===null?null:{id:value};
  return event;
 }
 return Object.freeze({catalogue,records,features,aliases,source,registry,rawEngine,engine,controller,bridge,makeRequest,validateSelection,selectionFromOption,historyIds,scoreSelection,createHistoryEvent,
  manifest:m,suitSources,assemblies,shoeLayers:p.shoeLayers,assetPaths:Object.freeze({...p.assets,...suitSources.assetPaths,...assemblies.viewAssets,...assemblies.coverageAssets}),sourceBindings:p.sourceBindings,
  limits:{suits:assemblies.dynamicSuitIds,original_template_suits:assemblies.originalTemplateSuitIds,wider_template_suits:assemblies.widerTemplateSuitIds,wider_ds035_suits:assemblies.widerDS035SuitIds,engine_suit_ids:suitSources.ids,engine_wider_shirt_lock:null,shirt_ids:m.shirt_order.slice(),approved_suit_source_ids:suitSources.ids,registered_shoes:Object.keys(p.shoeLayers).length,watch_layers:0,scoring_policy:'Current approved lookup first; unchanged strict historical fallback; no conflicting value selected',text_score_holds:[...textHolds]}});
}
root.HEWRSCleanConnection=Object.freeze({create});
})(globalThis);
