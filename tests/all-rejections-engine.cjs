'use strict';
// Real source engine, real wardrobe bindings, and isolated synthetic feedback.
// No application/browser owner data or remote service is read or written.
const assert=require('node:assert/strict');
const {load,config}=require('./tie-engine-loader.cjs');
const plain=x=>JSON.parse(JSON.stringify(x));
const selection=o=>o._hewrsConnected.canonical_selection;
const bytes=storage=>Array.from({length:storage.length},(_,i)=>storage.key(i)).sort().map(k=>[k,storage.getItem(k)]);
const fields=['suitId','blazerId','shirtOnly','pantId','shirtId','state','shoeId','watchId'];
const partFields={shirt:'shirtId',tie:'state',shoes:'shoeId'};
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS:',name);}
function onlyChanged(before,after,parts){const changed=parts.map(p=>partFields[p]);for(const key of fields)if(changed.includes(key))assert.notEqual(after[key],before[key],key+' did not change');else assert.equal(after[key]??null,before[key]??null,key+' changed unexpectedly');}
function wire(s){return {topwear:s.suitId||s.blazerId||null,pants:s.pantId||null,shirt:s.shirtId,tie:s.state==='NO_TIE'?null:s.state,shoe:s.shoeId,watch:s.watchId||null};}
async function main(){
 const h=load(),c=h.connection,F=h.g.HEWRSOutfitFeedback,T=h.g.HEWRSTieFeedback,clone=h.g.structuredClone;
 let temporary=[],temporaryRevision=0;
 const gate={
  refresh(){const a=h.feedback.refresh(),b=h.ties.refresh();return {...a,active:[...a.active,...b.active],temporary:clone(temporary),token:a.token+'\n'+b.token+'\ntemporary:'+temporaryRevision};},
  snapshot(){return this.refresh();},
  match(value,context){const s=F.normal(clone(value)),a=h.feedback.match(s,context),b=h.ties.match(s,context),occ=F.occasion(typeof context==='string'?context:context.occasion),reasons=[...a.reasons,...b.reasons];
   for(const e of temporary){const api=T.isScope(e.scope)?T:F;if((F.occasion(e.occasion)==='all'||F.occasion(e.occasion)===occ)&&api.canMatch(s,e.scope)&&api.key(s,e.scope)===api.key(clone(e.selection),e.scope))reasons.push({type:'temporary_skip',id:e.id,scope:e.scope});}
   return {allowed:reasons.length===0,reasons};
  },
  assertCurrent(token){assert.equal(this.refresh().token,token,'Feedback changed');}
 };
 c.ownerFeedback.set(gate);
 const cfg=config('work',{topwear:{mode:'item',id:c.aliases.get('S05')}}),q=c.makeRequest(cfg),requestBytes=JSON.stringify(q),configBytes=JSON.stringify(cfg);
 const initial=await c.controller.generateAsync(q,c.catalogue,[]),original=plain(selection(initial.options[0]));
 check('Real S05 source fixture contains the reported navy tie',()=>{assert.equal(initial.options.length,20);assert.equal(original.suitId,'S05');assert.equal(original.shirtId,'DS029');assert.equal(original.state,'T029');assert.match(c.catalogue.ties.find(t=>t.id===original.state).primaryColor,/navy/i);});
 const hide=(s,scope,occasion='all')=>(T.isScope(scope)?h.ties:h.feedback).hide(clone(s),{scope,context:occasion,reason:'other'});
 const restore=(e)=>(T.isScope(e.scope)?h.ties:h.feedback).restore(e.id);
 async function refill(result,request,source=null,parts=null){
  const kept=result.options.filter(o=>gate.match(selection(o),request.context).allowed),before=kept.map(o=>JSON.stringify(o)),storage=bytes(h.storage);
  const next=await c.controller.generateAsync(request,c.catalogue,[],{retainedOptions:kept,replaceFor:source,replaceParts:parts});
  assert.equal(c.controller.verifyOptionSet(next.options,request),true);
  assert.deepEqual(next.options.slice(0,kept.length).map(o=>JSON.stringify(o)),before);
  assert.deepEqual(kept.map(o=>JSON.stringify(o)),before);assert.deepEqual(bytes(h.storage),storage);
  assert.ok(next.options.every(o=>gate.match(selection(o),request.context).allowed));
  assert.equal(next.owner_feedback_integration.removed,0,'The native search must exclude rejected rows before the final safety filter');
  return {kept,next};
 }
 for(const scope of ['outfit','clothing','tie','shirt_tie','topwear_tie','shirt','topwear_shirt','topwear_shirt_tie']){
  for(const persistence of ['saved','temporary']){
   let event;if(persistence==='saved')event=hide(original,scope);else{temporary=[{id:'temporary_'+scope,type:'temporary_skip',scope,occasion:'all',selection:clone(original),reason:null}];temporaryRevision++;}
   const {kept,next}=await refill(initial,q);
   check(persistence+' '+scope+' vetoes before curation and refills the same request',()=>{assert.ok(kept.length<20);assert.equal(next.options.length,20);assert.equal(JSON.stringify(q),requestBytes);if(scope!=='outfit')assert.ok(next.diagnostics.feedback_excluded_clothing>0);});
   if(event)restore(event);else{temporary=[];temporaryRevision++;}
  }
 }
 for(const [scope,parts]of [['shirt',['shirt']],['topwear_shirt',['shirt']],['topwear_shirt_tie',['shirt','tie']],['outfit',['shoes']]]){
  const event=hide(original,scope),removed=initial.options.filter(o=>!gate.match(selection(o),q.context).allowed).map(o=>plain(selection(o)));
  removed.sort((a,b)=>(F.key(clone(a),'historical_exact')===F.key(clone(original),'historical_exact')?-1:0)-(F.key(clone(b),'historical_exact')===F.key(clone(original),'historical_exact')?-1:0));
  let next={...initial,options:initial.options.filter(o=>gate.match(selection(o),q.context).allowed)};
  const prefix=next.options.map(o=>JSON.stringify(o));
  for(const source of removed){const result=await refill(next,q,source,parts);assert.equal(result.next.options.length,result.kept.length+1,'Expected a compatible '+parts.join('/')+' replacement');onlyChanged(source,selection(result.next.options.at(-1)),parts);next=result.next;}
  check(scope+' changes only '+parts.join(' and ')+' for every removed row',()=>{assert.equal(next.options.length,20);assert.deepEqual(next.options.slice(0,prefix.length).map(o=>JSON.stringify(o)),prefix);assert.equal(c.controller.verifyOptionSet(next.options,q),true);if(scope==='shirt'||scope==='topwear_shirt')assert.equal(removed.length,2,'Fixture must exercise multiple vacancies');console.log('TARGETED:',JSON.stringify({scope,removed:removed.length,replacements:next.options.slice(prefix.length).map(selection)}));});
  restore(event);
 }
 // Exact anchors continue to control replacement. A rejection cannot silently
 // swap an anchored component or a supposedly accepted component instead.
 for(const [scope,parts,lock]of [['shirt',['shirt'],{shirt:{mode:'item',id:original.shirtId}}],['outfit',['shoes'],{shoes:{mode:'item',id:original.shoeId}}],['topwear_shirt_tie',['shirt','tie'],{tie:{mode:'item',id:original.state}}]]){
  const request=c.makeRequest(config('work',{topwear:{mode:'item',id:c.aliases.get('S05')},...lock})),result=await c.controller.generateAsync(request,c.catalogue,[]),source=plain(selection(result.options[0])),event=hide(source,scope);
  const {kept,next}=await refill(result,request,source,parts);
  check('Exact '+Object.keys(lock)[0]+' anchor is never relaxed for '+parts.join(' and ')+' replacement',()=>{assert.equal(next.options.length,kept.length);assert.match(next.reason,/exact selection/);});
  restore(event);
 }
 // Legacy imports are valid immutable records. Search must normalize derived
 // comparison values, without migrating stored occasion or selection bytes.
 const exactConfig=config('work',{topwear:{mode:'item',id:c.aliases.get('S05')},shirt:{mode:'item',id:original.shirtId},tie:{mode:'item',id:original.state},shoes:{mode:'item',id:original.shoeId},watch:{mode:'item',id:original.watchId}}),exactQ=c.makeRequest(exactConfig);
 for(const [i,occasion]of ['clinic','Hospital','OFFICE','WoRK','ALL'].entries()){
  const event={schema:F.SCHEMA,id:'audit_legacy_'+i,at:'2026-11-18T00:00:00.000Z',type:'hide',actor:'owner',selection:i%2?wire(original):original,scope:'clothing',occasion,reason:'colors'};
  h.feedback.importData(clone({schema:F.EXPORT,events:[event]}));const storage=bytes(h.storage),r=await c.controller.generateAsync(exactQ,c.catalogue,[]);
  check('Imported '+occasion+' '+(i%2?'wire':'canonical')+' rejection is compiled before source sampling',()=>{assert.equal(r.options.length,0);assert.ok(r.diagnostics.feedback_excluded_clothing>0);assert.equal(r.owner_feedback_integration.removed,0);assert.deepEqual(bytes(h.storage),storage);assert.deepEqual(plain(h.feedback.snapshot().events.find(e=>e.id===event.id)),event);});
  h.feedback.restore(event.id);
 }
 const comparison={id:'audit_neither_all',a:wire(original),b:wire({...original,state:'T009'}),vote:'neither',partition:'validation',reason:'Original imported choice',created_at:'2026-11-18T00:00:00.000Z',context:{occasion:'all',requiredFormality:'any'}};
 const prefEvent={schema:F.SCHEMA,id:'audit_preferences',at:'2026-11-18T00:00:00.000Z',type:'preferences',payload:{schema:'hewrs.outfit-preferences.v1',source_lock:h.g.HEWRS_INPUT_SHA256,revision:1,enabled:true,comparisons:[comparison]}};
 h.feedback.importData(clone({schema:F.EXPORT,events:[prefEvent]}));
 for(const occasion of ['work','dinner','weekend']){
  const request=c.makeRequest({...exactConfig,occasion}),r=await c.controller.generateAsync(request,c.catalogue,[]);
  check('Imported Neither for all occasions vetoes the exact watch in '+occasion,()=>{assert.equal(r.options.length,0);assert.ok(r.diagnostics.rejection_reasons.OWNER_FEEDBACK>0);assert.equal(r.owner_feedback_integration.removed,0);});
 }
 const noWatchQ=c.makeRequest({...exactConfig,preferences:{...exactConfig.preferences,watch:{mode:'none'}}}),noWatch=await c.controller.generateAsync(noWatchQ,c.catalogue,[]);
 check('Historical Neither retains its original watch-specific scope',()=>{assert.equal(noWatch.options.length,1);assert.equal(selection(noWatch.options[0]).watchId,null);assert.deepEqual(plain(h.feedback.snapshot().historical[0]),comparison);});
 h.feedback.importData(clone({schema:F.EXPORT,events:[{schema:F.SCHEMA,id:'audit_withdraw_preferences',at:'2026-11-18T00:00:01.000Z',type:'withdraw_preferences',target:prefEvent.id}]}));
 for(const style of ['CLASSIC','HYBRID','MODERN'])for(const stylistMode of ['research','heuristic']){
  const request=c.makeRequest({...config('work'),style,stylistMode}),before=await c.controller.generateAsync(request,c.catalogue,[]);assert.ok(before.options.length>0);
  const source=plain(selection(before.options[0])),event=hide(source,'shirt');const {next}=await refill(before,request);
  check(stylistMode+' '+style+' retains explicit style and blocks rejected shirts',()=>{assert.ok(next.options.every(o=>selection(o).shirtId!==source.shirtId));assert.equal(next.owner_feedback_integration.removed,0);assert.equal(c.controller.verifyOptionSet(next.options,request),true);});restore(event);
 }
 const targetBan=hide(original,'shirt'),beforeCancel=bytes(h.storage),kept=initial.options.filter(o=>gate.match(selection(o),q.context).allowed);
 const cancelled=await c.controller.generateAsync(q,c.catalogue,[],{retainedOptions:kept,replaceFor:original,replaceParts:['shirt'],isCancelled:()=>true});
 check('Cancelled component replacement publishes nothing and writes no state',()=>{assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.options.length,0);assert.deepEqual(bytes(h.storage),beforeCancel);});restore(targetBan);
 check('All fixtures leave request, preferences, wear and Favorites unchanged',()=>{assert.equal(JSON.stringify(q),requestBytes);assert.equal(JSON.stringify(cfg),configBytes);assert.ok(bytes(h.storage).every(([key])=>key.startsWith(F.PREFIX)||key.startsWith(T.PREFIX)));});
 console.log('ALL REJECTIONS ENGINE:',checks,'checks passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
