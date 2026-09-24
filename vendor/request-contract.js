/* Interface/data-contract validation only. No new aesthetic scores or ID remapping. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.HEWRSConnectedContract=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const stable=x=>JSON.stringify(canonical(x));
 function canonical(x){if(Array.isArray(x))return x.map(canonical);if(object(x)){const o={};for(const k of Object.keys(x).sort())if(x[k]!==undefined)o[k]=canonical(x[k]);return o;}return x;}
 const groups={work:['clinic','hospital','work'],fancyDinner:['dinner'],weekend:['weekend','date']};
 const categories={topwear:['suit','blazer'],shirt:['white','cream','lavender','navy','blue','pink','burgundy','grey','black','tan','brown','olive'],tie:['navy','purple','burgundy','grey','rust','gold','brown','green','black','red','charcoal','blue','white','pink','fuchsia'],shoes:['Dress Shoes','Loafers','Drivers','Sneakers'],pants:['black','navy','blue','brown','tan','olive','grey','mustard','offwhite','multi','other']};
 function prepare(q,cat){
  const fail=reason=>({allowed:false,reason});
  if(!object(q))return fail('Request must be an object.');
  if(q.mode==='production')return fail('Production activation is not authorized; this is a local candidate.');
  if(q.mode!=null&&!['candidate','test'].includes(q.mode))return fail('Unrecognized execution mode.');
  const dress=q.dressMode??'work';if(!groups[dress])return fail('Unrecognized dress mode; no fallback context selected.');
  if(q.executiveStyle!=null&&!['AUTO','CLASSIC','HYBRID','MODERN'].includes(q.executiveStyle))return fail('Unknown executive style.');
  if(q.legacyAccessoryStyle!=null&&!['classicalExecutive','modernDistinctive'].includes(q.legacyAccessoryStyle))return fail('Unknown accessory preference engine.');
  if(q.limit!==undefined&&(!Number.isInteger(q.limit)||q.limit<1||q.limit>100))return fail('Limit must be an integer from 1 to 100.');
  if(q.includeAll!==undefined&&typeof q.includeAll!=='boolean')return fail('includeAll must be boolean.');
  if(q.context!==undefined&&!object(q.context))return fail('Context must be an object.');
  const context={occasion:q.contextName||groups[dress][0],requiredFormality:'any',...(q.context||{})};
  if(!groups[dress].includes(context.occasion))return fail('Dress mode and setting disagree; select one consistent context.');
  if(!['any','tie_required','suit_required','open_collar_allowed'].includes(context.requiredFormality))return fail('Unknown formality requirement.');
  const env={season:['Summer','Spring','Fall','Winter','not_assessed'],temperatureBand:['veryHot','hot','mildWarm','cool','cold','veryCold','not_assessed'],precipitation:['dry','lightRain','heavyRain','snowIce','not_assessed']};
  for(const [k,v]of Object.entries(env))if(context[k]!=null&&!v.includes(context[k]))return fail('Unrecognized '+k+' selection.');
  for(const role of ['topwear','shirt','tie','shoes','watch','pants']){
   const ov=q[role];if(ov==null)continue;
   if(!object(ov)||!['item','category',...(role==='tie'?['none']:[])].includes(ov.mode))return fail('Invalid '+role+' selection mode; it was not treated as any.');
   if(ov.mode==='item'){
    if(typeof ov.id!=='string'||!ov.id.trim())return fail('Exact '+role+' requires a valid ID.');
    if(role==='topwear'&&typeof ov.formal!=='boolean')return fail('Exact topwear requires its boolean formal type.');
   }
   if(ov.mode==='category'){
    const valid=role==='watch'?new Set((cat.watches||[]).map(x=>x.brand)):new Set(categories[role]||[]);
    if(typeof ov.category!=='string'||!valid.has(ov.category))return fail('Unknown '+role+' category; no substitute pool selected.');
   }
  }
  if(dress==='weekend'&&q.tie&&q.tie.mode!=='none')return fail('Weekend has no tie path; an explicit tie preference cannot be discarded.');
  if(q.localDate!==undefined){if(typeof q.localDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(q.localDate))return fail('localDate must be a calendar date.');const d=new Date(q.localDate+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==q.localDate)return fail('Invalid calendar date.');}
  if(q.pantBindings!==undefined&&!Array.isArray(q.pantBindings))return fail('Trouser bindings must be an array.');
  for(const b of q.pantBindings||[])if(!object(b)||typeof b.physicalId!=='string'||typeof b.profileId!=='string')return fail('Malformed trouser binding.');
  if(q.suitabilityFactsByTopwear!==undefined&&!object(q.suitabilityFactsByTopwear))return fail('Suitability facts must be an object.');
  return {allowed:true,query:{...q,dressMode:dress,context},reason:null};
 }
 function requestSnapshot(q){const keys=['dressMode','executiveStyle','context','localDate','legacyAccessoryStyle','topwear','shirt','tie','shoes','watch','pants','pantBindings','suitabilityFactsByTopwear'];const o={};for(const k of keys)if(q[k]!==undefined)o[k]=q[k];return canonical(o);}
 function itemSnapshot(items,cat,guards){const o={};for(const role of ['topwear','shirt','tie','shoes','watch','pants']){
  const it=items?.[role];if(it==null){o[role]=null;continue;}
  const list=role==='topwear'?cat.suits.concat(cat.blazers):role==='shirt'?cat.shirts.concat(cat.tshirts):role==='pants'?cat.pants.concat(cat.jeans):cat[{tie:'ties',shoes:'shoes',watch:'watches'}[role]];
  o[role]=list.find(x=>x.id===it.id)||null;
 }return canonical(o);}
 return Object.freeze({prepare,stable,requestSnapshot,itemSnapshot});
});
