/* V1.3 application assembly routing. All garment approvals pre-exist this code.
 * S05-template pairs retain the original Active50 rendering.
 * S11-template pairs accept only DS035 with the authorized bounded underlayer.
 * Archived control views are read-only references, never current outfit frames. */
(function(root){'use strict';
const clone=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};
function deepFreeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(deepFreeze);Object.freeze(x);}return x;}
function create(sources,manifest,shoeLayers,input=root.HEWRS_SUIT_ASSEMBLY_DATA){
 need(input?.schema==='hewrs.suit-assembly-routing.v1_2','Missing suit assembly contract');
 const data=deepFreeze(clone(input));
 const coverage=deepFreeze(clone(root.HEWRS_DS035_COVERAGE));
 const edge=deepFreeze(clone(root.HEWRS_DS035_EDGE));
 need(edge?.schema==='hewrs.ds035.s11.edge.v1_5','Missing DS035 edge-cleanup contract');
 need(coverage?.schema==='hewrs.ds035.s11.coverage.v1_3','Missing authorized DS035 coverage binding');
 const widerIds=sources.ids.filter(id=>sources.resolveCanonical(id).template==='S11');
 need(JSON.stringify(widerIds)===JSON.stringify(coverage.wider_suit_ids),'Wider suit IDs differ from source register');
 need(JSON.stringify(widerIds)===JSON.stringify(edge.wider_suit_ids),'Edge-cleanup route IDs differ from source register');
 const ids=sources.ids.filter(id=>sources.resolveCanonical(id).template==='S05');
 need(JSON.stringify(ids)===JSON.stringify(data.dynamic_suits),'Assembly list differs from inherited template map');
 function supported(suitId,shirtId=null,state=null){return ids.includes(suitId)||(widerIds.includes(suitId)&&shirtId==='DS035'&&state!=='REFERENCE');}
 function requireDynamic(suitId,shirtId=null,state=null){
  const pair=sources.resolveCanonical(suitId);
  need(supported(suitId,shirtId,state),suitId+' currently requires DS035 for its wider-opening selection. No shirt is substituted; the current outfit is retained.');
  return pair;
 }
 function forSelection(suitId,shoeId,shirtId=null){
  const pair=requireDynamic(suitId,shirtId);need(Object.hasOwn(shoeLayers,shoeId),'Unknown exact registered footwear');
  // The default path returns identical descriptors. Historical fixed-shirt
  // restoration from CP97 is not run on independently selected shirts.
  const m=clone(sources.bindCurrentManifest(manifest,'S05'));
  if(suitId!=='S05'){
   m.static.jacket={...clone(pair.jacket),display_alpha_mask:clone(manifest.static.jacket.display_alpha_mask)};
   m.static.trousers=clone(pair.trousers);
  }
  if(pair.template==='S11'){need(shirtId==='DS035','DS035-only coverage binding');m.ds035_s11_coverage={...clone(coverage),selected_suit_id:suitId};m.ds035_s11_edge={...clone(edge),selected_suit_id:suitId};}
  if(shoeId!=='shoe-8')m.static.shoe=clone(shoeLayers[shoeId]);
  return m;
 }
 function registeredView(suitId){
  const pair=sources.resolveCanonical(suitId),view=data.registered_views[suitId];
  need(view&&view.suitId===suitId&&view.template===pair.template,'Archived view has no matching suit source');
  need(/^assemblies\/[a-f0-9]{64}\.png$/.test(view.url)&&view.url==='assemblies/'+view.sha256+'.png','Unbound archived view');
  return view;
 }
 const viewAssets=Object.fromEntries(sources.ids.map(id=>{const d=registeredView(id);return[d.sha256,d.url];}));
 return Object.freeze({dynamicSuitIds:Object.freeze(ids),widerDS035SuitIds:Object.freeze(widerIds),coverageAssets:Object.freeze({...coverage.assetPaths,...edge.assetPaths}),supported,requireDynamic,forSelection,registeredView,viewAssets:Object.freeze(viewAssets),contract:data});
}
root.HEWRSSuitAssemblies=Object.freeze({create});
})(globalThis);
