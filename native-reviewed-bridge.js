/* Additive bridge: exact reviewed selections -> existing HEWRS native renderer.
   No storage, scoring changes, remote AI, weather claims, or owner-vote writes. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./reviewed-selector.js'));else root.HEWRSNativeReviewedBridge=factory(root.HEWRSReviewedSelector);})(typeof globalThis==='object'?globalThis:this,function(Selector){
'use strict';const clone=x=>JSON.parse(JSON.stringify(x));function need(x,m){if(!x)throw Error(m);}
function create(connection,catalogue,reviews,rules){
 need(connection&&typeof connection.validateSelection==='function','The native HEWRS connection is unavailable.');
 const selector=Selector.create(catalogue,reviews,rules),entries=new Map(selector.entries().map(x=>[x.id,x]));
 const items=new Map(catalogue.records.map(x=>[x.id,x]));
 function nativeSelection(id,watchId=null){
  const e=entries.get(id);need(e,'Unknown reviewed outfit; no substitute selected.');
  const a=selector.inspect(e.outfit);need(a.hard_constraints.status==='pass','Owner/identity restriction blocks this selection.');
  const o=e.outfit,shoe=items.get(o.shoe),active=shoe.visual_dna.evidence.source_images.find(x=>x.role==='current_registered_layer');
  need(active&&connection.shoeLayers[o.shoe]?.sha256===active.sha256,'Active footwear source has changed; reassessment required.');
  if(watchId!==null)need(connection.catalogue.watches.some(x=>x.id===watchId),'Unknown exact watch ID.');
  const s={shirtId:o.shirt,state:o.tie||'NO_TIE',shoeId:o.shoe,watchId};
  if(o.topwear&&items.get(o.topwear).category==='suit')s.suitId=o.topwear;
  else {s.pantId=o.pants;if(o.topwear)s.blazerId=o.topwear;else s.shirtOnly=true;}
  const validated=connection.validateSelection(s);
  for(const k of Object.keys(s))need(validated[k]===s[k],'Native validation altered an exact selection.');
  need(Object.keys(validated).length===Object.keys(s).length,'Unexpected native selection fields.');
  return clone(validated);
 }
 return Object.freeze({select:(request={})=>selector.select(request),inspect:(o,q={})=>selector.inspect(o,q),entries:()=>selector.entries(),get:id=>entries.has(id)?clone(entries.get(id)):null,nativeSelection,catalogueFingerprint:catalogue.fingerprint,scope:'Finite offline single-assistant reviews; native visual preview only. Default automatic engine, weather, real personal history, owner-learning fit and saved data are not replaced.'});
}
return Object.freeze({create,revision:'hewrs.stage8.native-reviewed-bridge.v1'});
});
