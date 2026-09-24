/* V1.14: source availability in the existing picker, without changing its layout,
 * palette, item order, names, six categories, Apply/Cancel or persistent schema.
 * A disabled route is not a revoked garment approval or a numerical score hold.
 */
(function(root){
'use strict';
const prior=root.HEWRSFaceliftModel;
function create(connection){
 const base=prior.create(connection),sources=connection.nonSuitSources;
 if(!sources)throw Error('Missing source-aware picker contract');
 function availability(category,id){
  const prefs=base.snapshot(),top=base.selectedTop(prefs);
  if(category==='shirt' && ['blazer','shirt-only'].includes(top?.kind))
   return sources.inspect(id,top.kind);
  if(category==='tie' && prefs.shirt.mode==='item'){
   const shirt=connection.manifest.shirts[prefs.shirt.id],ok=shirt.available_modes.includes(id);
   return {visual_available:ok,reason_code:ok?null:'STATE_NOT_SUPPORTED_FOR_EXACT_SHIRT',
     shirt_id:prefs.shirt.id,state:id,missing_components:[]};
  }
  return {visual_available:true,reason_code:null,missing_components:[]};
 }
 function filter(cat,query){
  return base.filter(cat,query).map(row=>{
   const cap=availability(cat,row.id);
   return {...row,available:row.available&&cap.visual_available,sourceAvailability:cap};
  });
 }
 // Programmatic draft writes must obey the same guard as the disabled controls.
 // Changing topwear does not silently replace a previously selected shirt/tie.
 function choose(value){
  const draft=base.draft();
  if(value?.mode==='item'&&draft){
   const cap=availability(draft.category,value.id);
   if(!cap.visual_available)throw Error(cap.reason_code==='STATE_NOT_SUPPORTED_FOR_EXACT_SHIRT'
     ?cap.shirt_id+': this tie state is not supported. Select No Tie explicitly.'
     :sources.explain(cap));
  }
  return base.choose(value);
 }
 function commit(){
  const d=base.draft();
  if(d?.choice?.mode==='item'){
   const cap=availability(d.category,d.choice.id);
   if(!cap.visual_available)throw Error(cap.reason_code==='STATE_NOT_SUPPORTED_FOR_EXACT_SHIRT'
     ?cap.shirt_id+': this tie state is not supported. Select No Tie explicitly.'
     :sources.explain(cap));
  }
  return base.commit();
 }
 return Object.freeze({...base,filter,choose,commit,availability});
}
root.HEWRSFaceliftModelV113=prior;
root.HEWRSFaceliftModel=Object.freeze({...prior,create});
})(globalThis);
