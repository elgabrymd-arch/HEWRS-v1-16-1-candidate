/* Application-only routing for already approved S01-S18 sources.
 * Reuses the unchanged checkpoint-98 resolver. Never fits, redraws, measures,
 * edits, scores, approves or composites a garment. */
(function(root){
'use strict';
const clone=x=>structuredClone(x);
function need(ok,message){if(!ok)throw Error(message);}
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function create(input,suitAliases,adapter=root.HEWRSSuitResolver97){
 need(input?.schema==='hewrs.approved-suit-sources.v1','Missing approved suit source input');
 need(adapter&&typeof adapter.resolveSuit==='function'&&typeof adapter.createAtomicSuitSelector==='function','Inherited checkpoint-98 resolver unavailable');
 const data=freeze(clone(input)),registry=data.registry;
 const byCanonical=new Map(),byLegacy=new Map();
 need(Array.isArray(suitAliases)&&suitAliases.length===registry.ids.length,'Incomplete explicit suit crosswalk');
 for(const row of suitAliases){
  need(registry.ids.includes(row.source_id),'Suit alias has no registered source');
  need(typeof row.app_id==='string'&&!byCanonical.has(row.source_id)&&!byLegacy.has(row.app_id),'Ambiguous suit alias');
  byCanonical.set(row.source_id,row.app_id);byLegacy.set(row.app_id,row.source_id);
 }
 function descriptor(asset){
  const url=data.assetPaths[asset.sha256];
  need(url==='assets/'+asset.sha256+'.png','Approved garment has no exact packaged source');
  return freeze({url,sha256:asset.sha256,rect:[0,0,...data.canvas],role:asset.role,source_path:asset.path});
 }
 function resolveCanonical(suitId){
  const inherited=adapter.resolveSuit(registry,suitId);
  need(byCanonical.has(suitId),'Suit identity missing from explicit crosswalk');
  return freeze({suitId,historyId:byCanonical.get(suitId),jacket:descriptor(inherited.jacket),trousers:descriptor(inherited.trousers),
   template:inherited.template,approval:'EXISTING_OWNER_APPROVAL_PRESERVED',
   scope:'APPROVED_PAIRED_GARMENT_SOURCES',inherited_scope:inherited.scope,
   // Source availability is not a claim that arbitrary selected shirts have
   // been composited under every different jacket template.
   dynamic_compositor_registered:root.HEWRS_SUIT_ASSEMBLY_DATA?.dynamic_suits.includes(suitId)??(suitId==='S05')});
 }
 function resolveLegacy(historyId){
  need(byLegacy.has(historyId),'Unknown historical suit ID; no numeric-index fallback');
  return resolveCanonical(byLegacy.get(historyId));
 }
 function resolveCandidate(option){
  need(option?.items?.topwear?.formal===true,'Candidate is not a suit');
  const pair=resolveLegacy(option.items.topwear.id);
  need(pair.suitId===option?._hewrsConnected?.compatibility?.ids?.topwear,'Candidate canonical/historical suit disagreement');
  return pair;
 }
 function bindCurrentManifest(manifest,suitId){
  const pair=resolveCanonical(suitId);
  need(suitId==='S05'&&manifest?.schema==='hewrs.active50.s05.staging.v1','No registered dynamic composition contract for this request');
  need(manifest.static?.jacket?.sha256===pair.jacket.sha256&&manifest.static?.trousers?.sha256===pair.trousers.sha256,'Manifest would substitute a different suit pair');
  // Keep later Active-50 masks, body/neck source and descriptor order verbatim.
  return manifest;
 }
 function createSelector(loadCheckedAsset,commitPair){
  need(typeof loadCheckedAsset==='function'&&typeof commitPair==='function','Source loader and atomic pair consumer required');
  const select=adapter.createAtomicSuitSelector(registry,
   asset=>loadCheckedAsset(descriptor(asset)),
   pair=>commitPair(Object.freeze({...pair,historyId:byCanonical.get(pair.suitId)})));
  // Invalid requests reach the inherited selector too, so they cancel older
  // in-flight requests rather than allowing a stale pair to commit.
  return Object.freeze({selectCanonical:suitId=>select(suitId),
   selectLegacy:historyId=>select(byLegacy.get(historyId)??null)});
 }
 return Object.freeze({ids:freeze([...registry.ids]),assetPaths:data.assetPaths,resolveCanonical,resolveLegacy,resolveCandidate,bindCurrentManifest,createSelector});
}
root.HEWRSApprovedSuitSources=Object.freeze({create});
})(globalThis);
