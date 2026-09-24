/* V1.6 application assembly routing. Existing garment approvals are retained.
 * All 18 registered pairs use the original selected shirt/tie components.
 * Only DS035 on S11-template pairs uses its separately approved corrections.
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
 const originalIds=sources.ids.filter(id=>sources.resolveCanonical(id).template==='S05');
 need(JSON.stringify(originalIds)===JSON.stringify(data.dynamic_suits),'Assembly list differs from inherited template map');
 const ids=sources.ids.slice();
 need(ids.length===18&&new Set([...originalIds,...widerIds]).size===18,'Unbound suit template');
 function supported(suitId,shirtId=null,state=null){
  if(!ids.includes(suitId))return false;
  // Suit-level availability is not approval of an arbitrary shirt/state.
  if(shirtId===null)return state===null;
  if(!Object.hasOwn(manifest.shirts,shirtId))return false;
  if(state===null)return true;
  if(state==='REFERENCE')return suitId==='S05'&&shirtId==='DS035';
  if(state==='NO_TIE')return !!manifest.shirts[shirtId].states.no_tie;
  return manifest.shirts[shirtId].mode_policy!=='NO_TIE_ONLY'&&!!manifest.shirts[shirtId].states.tied&&Object.hasOwn(manifest.ties,state);
 }
 function requireDynamic(suitId,shirtId=null,state=null){
  const pair=sources.resolveCanonical(suitId);
  need(supported(suitId,shirtId,state),'No registered assembly for the exact suit/shirt/state; no substitution.');
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
  if(pair.template==='S11'&&shirtId==='DS035'){m.ds035_s11_coverage={...clone(coverage),selected_suit_id:suitId};m.ds035_s11_edge={...clone(edge),selected_suit_id:suitId};}
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
 return Object.freeze({dynamicSuitIds:Object.freeze(ids),originalTemplateSuitIds:Object.freeze(originalIds),widerTemplateSuitIds:Object.freeze(widerIds),widerDS035SuitIds:Object.freeze(widerIds),coverageAssets:Object.freeze({...coverage.assetPaths,...edge.assetPaths}),supported,requireDynamic,forSelection,registeredView,viewAssets:Object.freeze(viewAssets),contract:data});
}
root.HEWRSSuitAssemblies=Object.freeze({create});
})(globalThis);
