/* Append-only source photo intake. No old item/score/image/history is changed. */
(function(root){'use strict';
const copy=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};
const d=root.HEWRS_ADDITIONAL_BLAZERS;
need(d?.schema==='hewrs.additional-blazers.v1_24_1'&&d.source_lock===root.HEWRS_INPUT_SHA256,'Wrong additional-blazer source');
const byId=new Map(d.records.map(r=>[r.binding.id,r]));
need(byId.size===d.records.length,'Duplicate added blazer ID');
const cache=new WeakMap();
function extendInputs(inputs){
 const p=copy(inputs);
 for(const r of d.records){const b=r.binding;need(r.feature.id===b.id&&b.historyId==='blazer-source-'+b.id,'Additional blazer identity mismatch');
  need(!p.features.records.some(x=>x.id===b.id)&&!p.originalCatalogue.blazers.some(x=>x.id===b.historyId),'Additional blazer ID already exists');
  p.features.records.push(copy(r.feature));
  // Catalogue append occurs after every inherited canonical blazer in extendContract/create.
 }
 return p;
}
function extendContract(input){const c=copy(input);
 for(const r of d.records){const b=r.binding;need(!c.blazers[b.id],'Cannot replace an existing blazer');c.blazers[b.id]=copy(b);(c.new_source_aliases??=[]).push({source_id:b.id,app_id:b.historyId,status:'SUPPORTED_LOCAL_MAPPING',mapping_kind:'APPEND_ONLY_NEW_OWNER_GARMENT',reason:'Exact new canonical ID; no legacy position reused.'});}
 Object.assign(c.assetPaths,d.assetPaths);return c;
}
function foundation(top,pants,spec){
 if(!byId.has(top.id))return null;
 const p=root.HEWRSEnsembleCompletion.pairScore(top,pants,spec);
 if(!Number.isFinite(p.score))return {status:'unknown',score:null,reason:'Insufficient source data for a new foundation estimate.'};
 return {...p,status:'new_foundation_estimate',blazer_id:top.id,pant_profile_id:pants.id,scale_max:10,frozen:false,owner_approved:false,source_revision:d.revision,method:'Existing generic pairScore; optional unknown formality/material remain unassessed',not_a_frozen_judgment:true};
}
function extendIndex(index,connection){
 if(cache.has(index))return cache.get(index);
 const added=[];const ids=connection.blazerConnection.data.available_shirts;
 const profiles=[...new Set(connection.trouserProfiles.boundIds.map(x=>connection.trouserProfiles.binding(x).profileId))].sort();
 const ties=['NO_TIE',...Object.keys(connection.manifest.ties).sort()];
 for(const r of d.records){const id=r.binding.id;need(!index.groups.some(x=>x.topwearId===id),'Index already contains added blazer; refuse duplicate');
  for(const pantProfileId of profiles){const rows=[];
   for(const shirtId of ids)for(const t of ties){const v=connection.engine.evaluate({topwearId:id,shirtId,tieId:t==='NO_TIE'?null:t,pantProfileId,context:{occasion:'work',requiredFormality:'any'},versionPolicy:'strict'});
    rows.push([shirtId,t,v.score??null,v.display_score??null,v.candidate_eligible?1:0,v.status]);}
   added.push({topwearId:id,pantProfileId,rows,source_revision:d.revision,foundation:'new_model_estimate_not_frozen'});
  }
 }
 const extended={...index,groups:[...index.groups,...added],additional_blazers_revision:d.revision,additional_counts:{groups:added.length,rows:added.reduce((n,g)=>n+g.rows.length,0)}};
 cache.set(index,extended);return extended;
}
function photo(id){const r=byId.get(id);return r?copy(r.binding.sourcePhoto.thumbnail):null;}
root.HEWRSAdditionalBlazers=Object.freeze({revision:d.revision,ids:Object.freeze([...byId.keys()]),has:id=>byId.has(id),extendInputs,extendContract,foundation,extendIndex,photo});
})(globalThis);
