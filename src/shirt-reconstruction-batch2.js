/* Next five source-guided shirt reconstructions, REVIEW CANDIDATE; approved Batch 1 retained.
 * No original suit layer, score or physical ID is replaced. */
(function(root){'use strict';
const prior=root.HEWRSShirtSourceRecovery,d=root.HEWRS_SHIRT_RECONSTRUCTION_BATCH2,copy=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};
need(prior&&d?.schema==='hewrs.shirt-reconstruction-batch2.v1'&&d.source_lock===root.HEWRS_INPUT_SHA256,'Invalid reconstructed shirt batch');
const previousReconstructed=root.HEWRSReconstructedShirts;
const cache=new WeakMap();
function extendBatch(batch,inputs){
 const b=prior.extendBatch(batch,inputs);
 for(const id of d.ids){
  const r=copy(d.registrations[id]),s=inputs.manifest.shirts[id];
  need(!b.ids.includes(id)&&r.id===id&&r.history_id==='shirt-'+id,'Reconstructed shirt ID collision');
  need(JSON.stringify(r.states)===JSON.stringify(s.available_modes.filter(x=>x!=='REFERENCE')),'Reconstructed shirt state mismatch');
  for(const [mode,p]of Object.entries(r.modes)){
   need(p.base.rect.join(',')==='0,0,996,2748'&&d.assetPaths[p.base.sha256],'Missing reconstructed body');
   for(const role of ['left','right','left_cuff','right_cuff'])need(p[role].sha256===s.states[mode][role].sha256||isComponentOverride(id,mode,role,p[role].sha256),'Unapproved reconstructed component override');
  }
  b.ids.push(id);b.shirts[id]=r;
 }
 Object.assign(b.assetPaths,d.assetPaths);b.reconstruction_revision=d.revision;return b;
}
function isComponentOverride(id,mode,role,sha){return !!previousReconstructed?.isComponentOverride(id,mode,role,sha)||d.ids.includes(id)&&['left','right','left_cuff','right_cuff'].includes(role)&&d.registrations[id].modes[mode]?.[role]?.sha256===sha;}
function extendIndex(index,c){
 const original=prior.extendIndex(index,c);let seen=cache.get(original);if(!seen){seen=new WeakMap();cache.set(original,seen);}if(seen.has(c))return seen.get(c);
 let added=0;const groups=original.groups.map(g=>{
  if(g.topwearId[0]!=='B')return g;const rows=[...g.rows];
  for(const id of d.ids){if(rows.some(r=>r[0]===id))continue;
   for(const state of d.registrations[id].states){
    const r=c.engine.evaluate({topwearId:g.topwearId,shirtId:id,tieId:state==='NO_TIE'?null:state,...(g.pantProfileId?{pantProfileId:g.pantProfileId}:{}),context:{occasion:'work',requiredFormality:'any'},versionPolicy:'strict'});
    rows.push([id,state,r.score??null,r.display_score??null,r.candidate_eligible?1:0,r.status]);added++;
   }
  }
  return {...g,rows};
 });
 const out={...original,groups,shirt_reconstruction_revision:d.revision,shirt_reconstruction_rows_added:added};seen.set(c,out);return out;
}
root.HEWRSReconstructedShirts=Object.freeze({ids:Object.freeze([...previousReconstructed.ids,...d.ids]),revision:previousReconstructed.revision+'+'+d.revision,isComponentOverride});
root.HEWRSShirtSourceRecovery=Object.freeze({...prior,revision:prior.revision+'+'+d.revision,extendBatch,extendIndex,connectedAdditions:Object.freeze([...prior.connectedAdditions,...d.ids]),remainingSourceIds:Object.freeze(prior.remainingSourceIds.filter(x=>!d.ids.includes(x)))});
})(globalThis);
