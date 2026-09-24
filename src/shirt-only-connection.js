/* Additive no-jacket route. DS001 uses the same unchanged CP49 full-shirt layers
 * already bound in V1.9. A missing source or score never becomes a substitute. */
(function(root){'use strict';
const previous=root.HEWRSCleanConnection,clone=x=>structuredClone(x);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const fields=['shirtOnly','pantId','shirtId','state','shoeId','watchId'];
function frozen(x){if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;}
function create(inputs){
 const base=previous.create(inputs),data=frozen(clone(root.HEWRS_SHIRT_ONLY_DATA));
 need(data?.schema==='hewrs.shirt-only-connection.v1_10'&&data.canvas.join(',')==='996,2748','Missing exact shirt-only source contract');
 const isShirtOnly=s=>!!s&&Object.hasOwn(s,'shirtOnly');
 const ids=[...Object.keys(data.shirts),...base.batch10.ids];
 for(const id of Object.keys(data.shirts)){need(base.blazerConnection.data.available_shirts.includes(id)&&base.records[id],'Unsupported shirt-only source identity');
  need(JSON.stringify(data.states)===JSON.stringify(base.blazerConnection.data.available_states),'Changed source tie universe');
  for(const state of data.states){const layer=data.shirts[id].layers[state];need(layer.sha256===(state==='NO_TIE'?base.blazerConnection.data.assembly.no_tie:base.blazerConnection.data.assembly.ties[state]).sha256&&Object.hasOwn(base.assetPaths,layer.sha256),'Unbound original full-shirt source');}}
 function validateSelection(s){
  if(!isShirtOnly(s))return base.validateSelection(s);
  need(s&&!Array.isArray(s)&&Object.keys(s).length===fields.length&&fields.every(k=>Object.hasOwn(s,k))&&s.shirtOnly===true,'Incomplete or mixed shirt-only selection');
  need(ids.includes(s.shirtId),'No complete source assembly for this exact shirt-only selection');
  need(data.states.includes(s.state),'Unknown full-shirt tie/no-tie state');
  base.blazerConnection.knownPant(s.pantId);
  need(Object.hasOwn(base.shoeLayers,s.shoeId)&&base.catalogue.shoes.some(x=>x.id===s.shoeId&&!x.disabled),'Unknown exact footwear');
  need(s.watchId===null||base.catalogue.watches.some(x=>x.id===s.watchId),'Unknown watch ID');return clone(s);
 }
 function historyIds(s){
  if(!isShirtOnly(s))return base.historyIds(s);validateSelection(s);
  return {topwear:null,shirt:base.records[s.shirtId].history_id,tie:s.state==='NO_TIE'?null:s.state,shoes:s.shoeId,watch:s.watchId,pants:base.blazerConnection.knownPant(s.pantId).historyId};
 }
 function makeRequest(c){need(!isShirtOnly(c),'Shirt-only is an exact Anchor selection. No shirt-only ensemble-ranking model is installed.');return base.makeRequest(c);}
 function scoreSelection(s,context){if(!isShirtOnly(s))return base.scoreSelection(s,context);validateSelection(s);return {status:'shirt_only_manual_selection',score:null,display_score:null,candidate_eligible:false,reason_codes:['NO_INSTALLED_SHIRT_ONLY_ENSEMBLE_RANKING'],manual_visual_available:true};}
 function createHistoryEvent(s,opts){if(!isShirtOnly(s))return base.createHistoryEvent(s,opts);const ids=historyIds(s);
  need(!opts.origin||opts.origin==='manual','Shirt-only cannot be recorded as an Engine recommendation');
  return {id:opts.id,localDate:opts.localDate,date:opts.localDate,confirmed:true,origin:'manual',controlledRepetition:opts.controlledRepetition||false,items:Object.fromEntries(Object.entries(ids).map(([k,v])=>[k,v===null?null:{id:v}])),canonical_selection:validateSelection(s),source_lock:root.HEWRS_INPUT_SHA256};
 }
 const shirtOnlyConnection=Object.freeze({isShirtOnly,ids:Object.freeze(ids),states:Object.freeze([...data.states]),data});
 return Object.freeze({...base,validateSelection,historyIds,makeRequest,scoreSelection,createHistoryEvent,shirtOnlyConnection,limits:{...base.limits,shirt_only_ids:ids,shirt_only_states:[...data.states],shirt_only_engine:false}});
}
root.HEWRSJacketedConnectionV19=previous;root.HEWRSCleanConnection=Object.freeze({create});
})(globalThis);
