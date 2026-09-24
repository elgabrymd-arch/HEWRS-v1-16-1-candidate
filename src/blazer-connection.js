/* V1.7: additive exact-ID connection. Original suit factory remains unchanged.
 * No positional ID remapping, image generation, guessed numeric bindings, or production access. */
(function(root){'use strict';
const original=root.HEWRSCleanConnection,clone=x=>structuredClone(x),need=(ok,msg)=>{if(!ok)throw Error(msg);};
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function create(inputs){
 const batch=root.HEWRSBatch10.contract(inputs),raw=clone(root.HEWRS_BLAZER_CONNECTION_DATA);
 for(const id of batch.ids){need(!raw.available_shirts.includes(id),'Duplicate batch source identity');raw.available_shirts.push(id);}
 const d=freeze(raw);
 // Filter unavailable blazer collar configurations before ranking. The inherited
 // equations and tie scores are not changed; suit requests use their original path.
 const base=original.create(inputs,{blazerMappings:[...inputs.blazerAliases,...(d.new_source_aliases||[])],configurationFilter:req=>!/^B\d+$/.test(req.topwearId)||(d.blazers[req.topwearId]?.availability==='CONNECTED'&&d.available_shirts.includes(String(req.shirtId).replace(/^shirt-/,''))&&(req.tieId===null||Object.hasOwn(d.assembly.ties,req.tieId)))});
 need(d?.schema==='hewrs.blazer-connection.v1_7','Missing blazer source contract');
 const profiles=root.HEWRSTrouserProfiles.create(d,inputs);
 const catalogue=clone(base.catalogue);
 // Add known appended physical IDs only. Preserve all historical entries and order.
 for(const p of Object.values(d.pants))if(!catalogue.pants.some(x=>x.id===p.historyId))catalogue.pants.push({id:p.historyId,name:p.label,brand:p.record.brand||'',color:p.record.shade,colorCategory:p.record.color_code,details:p.record.details||'',_canonical:{id:p.id,source:'CP98/PANTS54'}});
 for(const b of Object.values(d.blazers)){
  let item=catalogue.blazers.find(x=>x.id===b.historyId);const f=base.features.get(b.id);need(f,'Missing canonical blazer feature');
  if(!item&&b.identityPolicy==='NEW_CANONICAL_SOURCE_KEY_NO_LEGACY_REMAP'){
   need(b.historyId==='blazer-source-'+b.id,'Invalid new canonical identity key');
   item={id:b.historyId,name:b.label,formal:false,color:f.primary_text,pattern:f.pattern_text};catalogue.blazers.push(item);
  }
  if(item)Object.assign(item,{name:b.label,color:f.primary_text,pattern:f.pattern_text,_canonical:{id:b.id,source:'CP98 pinned feature record'}});
 }
 const suitFields=['suitId','shirtId','state','shoeId','watchId'],blazerFields=['blazerId','pantId','shirtId','state','shoeId','watchId'];
 const isBlazer=s=>s&&Object.hasOwn(s,'blazerId');
 function knownBlazer(id){const b=d.blazers[id];need(b,'Unknown exact blazer ID');return b;}
 function knownPant(id){const p=d.pants[id];need(p,'No approved active trouser color binding for this exact physical ID');return p;}
 function requireAssembly(s){const b=knownBlazer(s.blazerId);need(b.availability==='CONNECTED',b.id+': '+b.availability+'; no older garment or reference photograph is substituted.');need(d.available_shirts.includes(s.shirtId),'No connected full-length source for this exact blazer/shirt selection');need(s.state==='NO_TIE'||Object.hasOwn(d.assembly.ties,s.state),'Unknown connected tie/no-tie presentation');return b;}
 function validateSelection(s){
  need(s&&typeof s==='object'&&!Array.isArray(s),'Selection must be an object');
  const fields=isBlazer(s)?blazerFields:suitFields;
  need(Object.keys(s).length===fields.length&&fields.every(k=>Object.hasOwn(s,k)),'Incomplete or mixed suit/blazer selection');
  if(!isBlazer(s))return base.validateSelection(s);
  requireAssembly(s);knownPant(s.pantId);
  need(Object.hasOwn(base.shoeLayers,s.shoeId)&&catalogue.shoes.some(x=>x.id===s.shoeId&&!x.disabled),'Unknown exact registered footwear');
  need(s.watchId===null||catalogue.watches.some(x=>x.id===s.watchId),'Unknown watch ID');return clone(s);
 }
 function identity(s){validateSelection(s);return isBlazer(s)?{topwear:knownBlazer(s.blazerId).historyId,shirt:base.records[s.shirtId].history_id,tie:s.state==='NO_TIE'?null:s.state,shoes:s.shoeId,watch:s.watchId,pants:knownPant(s.pantId).historyId}:base.historyIds(s);}
 function makeRequest(c){
  if(!Object.hasOwn(c,'blazerId'))return base.makeRequest(c);
  need(!Object.hasOwn(c,'suitId'),'A separate trouser cannot be attached to a suit request');
  const b=knownBlazer(c.blazerId),p=knownPant(c.pantId);
  need(b.historyId&&b.availability==='CONNECTED','No current executable binding for this blazer');
  const shirtId=String(c.shirt||'').replace(/^shirt-/,'');
  need(d.available_shirts.includes(shirtId),'Select an explicitly connected full-shirt ID; no automatic substitution');
  need(c.tie!=='REFERENCE','A saved reference is not an exact tie/no-tie selection');
  need(Object.hasOwn(base.shoeLayers,c.shoeId),'Unknown exact footwear');
  if(c.watchId)need(catalogue.watches.some(w=>w.id===c.watchId),'Unknown exact watch');
  const q={mode:'candidate',dressMode:'work',topwear:{mode:'item',id:b.historyId,formal:false},pants:{mode:'item',id:p.historyId},shirt:{mode:'item',id:base.records[shirtId].history_id},shoes:{mode:'item',id:c.shoeId},executiveStyle:c.style||'AUTO',context:{occasion:c.occasion||'clinic',requiredFormality:c.formality||'any'},localDate:c.localDate,limit:15,pantBindings:[]};
  if(c.tie&&c.tie!=='ANY'){if(c.tie==='NO_TIE')q.tie={mode:'none'};else if(c.tie.startsWith('FAMILY:'))q.tie={mode:'category',category:c.tie.slice(7)};else{need(Object.hasOwn(d.assembly.ties,c.tie),'Unknown exact tie');q.tie={mode:'item',id:c.tie};}}
  if(c.watchId)q.watch={mode:'item',id:c.watchId};
  // Exact recovered source crosswalk; do not activate its nine null profiles.
  const profile=profiles.binding(p.id);if(profile)q.pantBindings.push(profile);
  const prepared=root.HEWRSConnectedContract.prepare(q,catalogue);need(prepared.allowed,prepared.reason);return prepared.query;
 }
 function selectionFromOption(o,q){
  if(o?.items?.topwear?.formal)return base.selectionFromOption(o,q);
  need(!queryIssue(q)&&base.controller.verifyCachedOption(o,q,catalogue),'Stale or invalid blazer candidate');
  const b=Object.values(d.blazers).find(b=>b.historyId===o.items.topwear.id),p=Object.values(d.pants).find(p=>p.historyId===o.items.pants?.id);
  need(b&&p,'Candidate has no exact blazer or physical-trouser binding');
  const active=profiles.binding(p.id);need(active?.profileId&&active.reviewedForLocalTest===true,'No activated numeric profile for this physical trouser');
  need(q.pantBindings?.some(x=>x.physicalId===p.historyId&&x.profileId===active.profileId),'Candidate profile differs from pinned binding');
  const s={blazerId:b.id,pantId:p.id,shirtId:o.items.shirt.id.replace(/^shirt-/,''),state:o.items.tie?.id||'NO_TIE',shoeId:o.items.shoes.id,watchId:o.items.watch?.id||null};validateSelection(s);
  return {selection:s,binding:{render_request:s,compatibility:clone(o._hewrsConnected.compatibility)},display:{blazer:b.label,pants:p.label,shirt:base.records[s.shirtId].label,tie:base.features.get(s.state)?.description||s.state},representation:{selected_shoe_rendered:true,selected_watch_rendered:false,trouser_representation:'approved shared color layer; physical ID preserved'}};
 }
 function scoreSelection(s,context){validateSelection(s);if(!isBlazer(s))return base.scoreSelection(s,context);
  const profile=profiles.binding(s.pantId);if(!profile?.profileId||profile.reviewedForLocalTest!==true)return {status:'mapping_required',score:null,display_score:null,candidate_eligible:false,ids:{blazer:s.blazerId,physicalPant:s.pantId,shirt:s.shirtId,tie:s.state},reason_codes:['NO_EXISTING_PROFILE_FOR_THIS_PHYSICAL_TROUSER'],manual_visual_available:true};
  return base.engine.evaluate({topwearId:s.blazerId,shirtId:s.shirtId,tieId:s.state==='NO_TIE'?null:s.state,pantProfileId:profile.profileId,context,versionPolicy:'strict'});
 }
 function createHistoryEvent(s,opts){if(!isBlazer(s))return base.createHistoryEvent(s,opts);const i=identity(s);return {id:opts.id,localDate:opts.localDate,date:opts.localDate,confirmed:true,origin:opts.origin||'manual',controlledRepetition:opts.controlledRepetition||false,items:Object.fromEntries(Object.entries(i).map(([k,v])=>[k,v===null?null:{id:v}])),canonical_selection:validateSelection(s),source_lock:root.HEWRS_INPUT_SHA256};}
 function queryIssue(q){
  if(q?.topwear?.formal!==false)return null;
  const b=Object.values(d.blazers).find(b=>b.historyId===q.topwear.id),p=Object.values(d.pants).find(p=>p.historyId===q.pants?.id);
  if(!b||b.availability!=='CONNECTED'||!p||q.shirt?.mode!=='item'||!d.available_shirts.includes(String(q.shirt.id).replace(/^shirt-/,'')))return 'No complete existing blazer assembly for this exact request';
  if(q.tie?.id==='REFERENCE')return 'A retained reference is not a selectable tie';
  return profiles.checkQuery(q,p.id);
 }
 const blocked=reason=>({status:'request_blocked',options:[],reason,production_enabled:false});
 const controller=Object.freeze({...base.controller,
  generate(q,cat,h){const error=queryIssue(q);return error?blocked(error):base.controller.generate(q,cat,h);},
  generateAsync(q,cat,h,opts){const error=queryIssue(q);return error?Promise.resolve(blocked(error)):base.controller.generateAsync(q,cat,h,opts);},
  verifyCachedOption(o,q,cat){return !queryIssue(q)&&base.controller.verifyCachedOption(o,q,cat);}
 });
 const blazerConnection=Object.freeze({data:d,ids:Object.keys(d.blazers),pantIds:Object.keys(d.pants),knownBlazer,knownPant,requireAssembly,isBlazer,availableIds:Object.keys(d.blazers).filter(k=>d.blazers[k].availability==='CONNECTED')});
 return Object.freeze({...base,batch10:batch,catalogue,trouserProfiles:profiles,controller,validateSelection,historyIds:identity,makeRequest,selectionFromOption,scoreSelection,createHistoryEvent,blazerConnection,assetPaths:Object.freeze({...base.assetPaths,...d.assetPaths,...batch.assetPaths}),limits:{...base.limits,blazer_ids:Object.keys(d.blazers),connected_blazer_ids:blazerConnection.availableIds,physical_trouser_ids:Object.keys(d.pants),connected_blazer_shirts:d.available_shirts,blazer_numerical_profile_status:'15_EXISTING_LOCAL_BINDINGS_RESTORED_9_NULLS_PRESERVED'}});
}
root.HEWRSSuitConnectionV16=original;root.HEWRSCleanConnection=Object.freeze({create});
})(globalThis);
