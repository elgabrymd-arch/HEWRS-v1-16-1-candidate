/* V1.8: read-only import of the existing 24-record source profile crosswalk.
 * 15 existing local bindings, nine nulls. No RGB inference or new score records.
 * Original source state and production_approval=false are preserved. */
(function(root){'use strict';
const clone=x=>structuredClone(x),need=(ok,msg)=>{if(!ok)throw Error(msg);};
const SOURCE_SHA='538cdf147e1af4c83c88a5b7bfbc6cf9bc5128b6461200be3ea01588348cb960';
const PINNED_PROFILE_IDS=Object.freeze({"PT001":"P05","PT002":"P05","PT003":"P05","PT004":"P05","PT005":"P05","PT006":"P05","PT007":"P05","PB001":"P06","PB002":"P06","PB003":"P06","PB004":"P06","PBR001":null,"PBR002":null,"PG001":"P02","PG002":"P01","PN001":null,"PN002":"P07","PN003":null,"PN004":null,"PN005":null,"PN006":null,"PG003":"P04","PN007":null,"PW002":null});
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function create(blazers,inputs,source=root.HEWRS_TROUSER_PROFILE_SOURCE){
 need(root.HEWRS_TROUSER_PROFILE_SOURCE_SHA256===SOURCE_SHA,'Wrong source-profile identity');
 const report=clone(source),records={},bindings={};
 need(report&&report.production_approval===false&&report.records?.length===24,'Missing source profile records or altered approval scope');
 const expectedIds=Object.keys(blazers.pants),profileIds=new Set(inputs.logicData.blazerPant.map(x=>x.pant_profile_id));
 for(const row of report.records){
  const p=blazers.pants[row.physical_id];
  need(p&&!Object.hasOwn(records,row.physical_id),'Unknown or duplicate physical trouser');
  need(row.active===true&&row.app_id===p.historyId&&row.asset_sha256===p.layer.sha256&&row.source_colorway===p.colorway,'Physical trouser/source-image mismatch: '+row.physical_id);
  need(row.brand===(p.record.brand??null)&&row.source_description===p.record.shade&&(row.details??null)===(p.record.details??null),'Different physical record: '+row.physical_id);
  need(Object.hasOwn(PINNED_PROFILE_IDS,row.physical_id)&&row.profile_id===PINNED_PROFILE_IDS[row.physical_id],'Profile differs from pinned source: '+row.physical_id);
  if(row.profile_id!==null){
   need(profileIds.has(row.profile_id)&&['PRIOR_BINDING_RETAINED','LOCAL_COLOR_BINDING_NEW'].includes(row.state)&&row.candidate_profile_for_review===null,'Unsupported numeric profile or unactivated proposal');
   bindings[row.physical_id]={physicalId:row.app_id,profileId:row.profile_id,reviewedForLocalTest:true,evidence:{source_id:'HEWRS_Trouser_Profile_Bindings.json',source_sha256:SOURCE_SHA,locator:'records.'+row.physical_id,source_state:row.state,mapping_kind:row.mapping_kind,reason:row.reason,production_approval:false}};
  }else{
   need(['SHADE_DEPTH_REVIEW','NO_EXACT_PROFILE'].includes(row.state),'Unexpected null binding state');
  }
  records[row.physical_id]=row;
 }
 need(expectedIds.length===24&&expectedIds.every(id=>Object.hasOwn(records,id))&&Object.keys(bindings).length===15,'Incomplete source crosswalk');
 need(report.counts.physical_records===24&&report.counts.bound_color_profiles===15&&Object.values(records).filter(r=>r.state==='LOCAL_COLOR_BINDING_NEW').length===4,'Source count mismatch');
 freeze(report);freeze(records);freeze(bindings);
 function record(id){need(Object.hasOwn(records,id),'Unknown physical trouser ID');return records[id];}
 function binding(id){record(id);return bindings[id]?clone(bindings[id]):null;}
 function checkQuery(q,physicalId){
  const expected=binding(physicalId),supplied=q.pantBindings||[];
  if(!Array.isArray(supplied))return 'Malformed physical-trouser bindings';
  if(!expected)return supplied.length?'An unresolved physical-trouser profile cannot be activated by a request':null;
  if(supplied.length!==1||root.HEWRSConnectedContract.stable(supplied[0])!==root.HEWRSConnectedContract.stable(expected))return 'Physical-trouser binding or evidence differs from the recovered source';
  return null;
 }
 return Object.freeze({sourceSha256:SOURCE_SHA,record,binding,checkQuery,records:freeze(records),boundIds:Object.freeze(Object.keys(bindings)),unboundIds:Object.freeze(expectedIds.filter(id=>!bindings[id])),report:freeze(report)});
}
root.HEWRSTrouserProfiles=Object.freeze({create,sourceSha256:SOURCE_SHA});
})(globalThis);
