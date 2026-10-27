/* V1.24.5 staged source repair: no invented garments, scores, or identity remaps.
 * Reconcile already-pinned shirt DNA with recovered approval evidence; restore
 * only full sources actually present. Thirty other non-suit sources stay blocked.
 */
(function(root){'use strict';
const copy=x=>structuredClone(x),need=(ok,msg)=>{if(!ok)throw Error(msg);};
const d=root.HEWRS_SHIRT_SOURCE_RECOVERY;
need(d?.schema==='hewrs.shirt-source-recovery.v1_24_5'&&d.source_lock===root.HEWRS_INPUT_SHA256,'Wrong shirt source recovery');
const cache=new WeakMap();
function validateRecords(inputs){
 for(const [id,r] of Object.entries(d.resolved_holds)){
  const f=inputs.features.records.find(x=>x.id===id),s=inputs.manifest.shirts[id];
  need(f&&s&&f.primary_text===r.expected_primary&&f.pattern_text===r.expected_pattern&&f.description===r.expected_description&&s.label===r.expected_render_label,'Reconciled shirt source changed: '+id);
  need(JSON.stringify(f.eligibility)===JSON.stringify(r.expected_eligibility)&&JSON.stringify(s.available_modes)===JSON.stringify(r.states),'Reconciled shirt eligibility changed: '+id);
  for(const [mode,hash]of Object.entries(r.body_sha256))need(s.states[mode].body.sha256===hash,'Reconciled shirt image changed: '+id);
 }
}
function label(id){return d.resolved_holds[id]?.effective_label||null;}
function heldIds(original){return original.filter(id=>!Object.hasOwn(d.resolved_holds,id));}
function extendBatch(input,inputs){
 const batch=copy(input);
 for(const id of d.connected_additions){
  const r=copy(d.registrations[id]),s=inputs.manifest.shirts[id];
  need(!batch.ids.includes(id)&&r.id===id&&r.history_id==='shirt-'+id,'Recovered shirt identity collision');
  need(JSON.stringify(r.states)===JSON.stringify(s.available_modes.filter(x=>x!=='REFERENCE')),'Recovered shirt states changed');
  for(const [mode,parts] of Object.entries(r.modes)){
   for(const role of ['left','right','left_cuff','right_cuff'])need(parts[role].sha256===s.states[mode][role].sha256,'Recovered same-ID collar/cuff mismatch: '+id+'/'+role);
   const b=parts.base;need(b.rect.join(',')==='0,0,996,2748'&&/^[a-f0-9]{64}$/.test(b.sha256)&&(batch.assetPaths[b.sha256]||inputs.assets[b.sha256]||d.assetPaths[b.sha256]),'Recovered full-body source unavailable');
  }
  if(id==='DS009')for(const mode of ['no_tie','tied'])for(const role of ['body','rear','left','right','left_cuff','right_cuff'])need(s.states[mode][role].sha256===inputs.manifest.shirts.DS006.states[mode][role].sha256,'Shared source contract changed; no substitute used');
  batch.ids.push(id);batch.shirts[id]=r;
 }
 Object.assign(batch.assetPaths,d.assetPaths);batch.source_recovery_revision=d.revision;return batch;
}
function extendIndex(index,connection){
 let per=cache.get(index);if(!per){per=new WeakMap();cache.set(index,per);}if(per.has(connection))return per.get(connection);
 let replaced=0,added=0;const groups=index.groups.map(g=>{
  const rows=g.rows.map(row=>{if(!Object.hasOwn(d.resolved_holds,row[0])||row[5]!=='canonical_data_hold')return row;replaced++;return evaluate(row[0],row[1]);});
  if(g.topwearId[0]==='B')for(const shirt of d.connected_additions){
   if(rows.some(row=>row[0]===shirt))continue;
   for(const state of connection.manifest.shirts[shirt].available_modes.filter(x=>x!=='REFERENCE')){rows.push(evaluate(shirt,state));added++;}
  }
  function evaluate(shirt,state){const r=connection.engine.evaluate({topwearId:g.topwearId,shirtId:shirt,tieId:state==='NO_TIE'?null:state,...(g.pantProfileId?{pantProfileId:g.pantProfileId}:{}),context:{occasion:'work',requiredFormality:'any'},versionPolicy:'strict'});return [shirt,state,r.score??null,r.display_score??null,r.candidate_eligible?1:0,r.status];}
  return {...g,rows};
 });
 const result={...index,groups,shirt_source_recovery_revision:d.revision,shirt_source_recovery_counts:{resolved_hold_rows:replaced,added_connected_rows:added},authority:'DERIVED_CACHE_OF_EXISTING_ENGINE_RESULTS_NOT_NEW_OR_APPROVED_SCORES'};
 per.set(connection,result);return result;
}
root.HEWRSShirtSourceRecovery=Object.freeze({revision:d.revision,validateRecords,label,heldIds,extendBatch,extendIndex,connectedAdditions:Object.freeze([...d.connected_additions]),remainingSourceIds:Object.freeze([...d.remaining_full_source_ids])});
})(globalThis);
