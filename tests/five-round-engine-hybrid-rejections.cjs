'use strict';
// Actual current connection/reference library, real immutable rejection stores,
// and a deterministic in-process visual service. No external provider is used.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{load,config,memoryStorage}=require('./tie-engine-loader.cjs');
const {indexedDB,IDBKeyRange}=require('fake-indexeddb'),Database=require('../src/rejection-database.js'),HostFeedback=require('../src/owner-feedback.js'),HostTies=require('../src/tie-feedback.js');
const ROOT=path.resolve(__dirname,'..'),h=load(),c=h.connection,F=h.g.HEWRSOutfitFeedback,T=h.g.HEWRSTieFeedback;
// Preserve the application's realm for its existing plain-record validation.
const checks=[],details={},copy=value=>h.g.structuredClone(value),stable=F.stable;
const selection=option=>option._hewrsConnected.canonical_selection;
function request(method='curated'){const value=config('work');value.stylistMode=method;return c.makeRequest(h.g.structuredClone(value));}
const q=request(),visualQ=request('visual'),initial=c.controller.generate(q,c.catalogue,[]),chosen=copy(selection(initial.options[0]));
const sourceBefore=stable([c.catalogue,h.g.HEWRS_INPUTS,c.hybrid.library]);
const originalPool=copy(c.hybrid.curatedPool(q).rows);
function passed(name,detail){checks.push({name,passed:true,...(detail?{detail}:{} )});console.log('PASS:',name);}
function hide(scope,context='work',selected=chosen){const store=T.isScope(scope)?h.ties:h.feedback,event=store.hide(selected,{scope,context});return ()=>store.restore(event.id);}
function verify(rows,req){assert.equal(c.controller.verifyOptionSet(rows,req),true);for(const row of rows){const selected=selection(row);assert.equal(h.gate.match(selected,req.context).allowed,true);assert.equal(stable(row._hewrsConnected.compatibility),stable(c.scoreSelection(selected,req.context)));}}
function independentCaps(rows){
 const counts=new Map(),clothes=new Set();let noTie=0;
 for(const row of rows){const s=selection(row),key=[s.suitId||s.blazerId,s.pantId||null,s.shirtId,s.state].join('|');assert.ok(!clothes.has(key),'No clothing duplicates');clothes.add(key);
  for(const id of [s.suitId||s.blazerId,s.pantId,s.shirtId,s.state==='NO_TIE'?null:s.state,s.shoeId,s.watchId].filter(Boolean))counts.set(id,(counts.get(id)||0)+1);
  noTie+=s.state==='NO_TIE';
 }
 for(const [id,n]of counts)assert.ok(n<=(/^T\d{3}$/.test(id)?1:2),id+' exceeds its unanchored physical-item cap');
 assert.ok(noTie<=2);assert.ok(rows.length<=20);
}
function judged(images){return {method:'live_visual',provider:'LOCAL_TEST_FIXTURE',model:'NOT_A_REAL_MODEL',job_id:'local-fixture',ranking:images.map(image=>({candidate_id:image.candidate_id,grade:'strong',explanation:'Fixture classification exercises routing, not aesthetics.'}))};}
function service(overrides={}){return {ready:()=>true,propose:async()=>({job_id:'local-fixture',proposals:[]}),evaluate:async(_q,images)=>judged(images),...overrides};}
function write(){const report={schema:'hewrs.five-round-hybrid-rejection.v1',checks,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length,details,external_provider_calls:0,limitations:['Visual responses and images are controlled fixtures; this does not assess model quality or real provider transport.']};fs.writeFileSync(path.join(ROOT,'evidence/five_round_20261119/engine-hybrid-rejections-after.json'),JSON.stringify(report,null,2)+'\n');}
(async()=>{
 assert.equal(initial.options.length,15);assert.equal(chosen.suitId,'S10');assert.equal(chosen.shirtId,'DS022');assert.equal(chosen.state,'T022');
 verify(initial.options,q);independentCaps(initial.options);passed('The unchanged Work reference library starts with 15 eligible exact outfits');
 {
  const restore=hide('clothing');try{
   const after=c.controller.generate(q,c.catalogue,[]),replacement=after.options.find(o=>selection(o).suitId==='S11'&&selection(o).shirtId==='DS022'&&selection(o).state==='T022');
   assert.equal(after.options.length,15);assert.ok(replacement,'Known permitted S11/DS022/T022 reference must fill the vacancy');
   assert.ok(after.options.every(o=>F.key(selection(o),'clothing')!==F.key(chosen,'clothing')));
   assert.equal(after.owner_feedback_integration.removed,0);verify(after.options,q);independentCaps(after.options);
   details.curated={initial_count:initial.options.length,rejected:chosen,after_count:after.options.length,replacement:selection(replacement)};
   passed('A clothing rejection does not consume reference capacity or globally exclude the same permitted tie');
   const direct=c.hybrid.select(copy(originalPool),q,[],'curated');assert.equal(direct.options.length,15);assert.ok(direct.diagnostics.owner_excluded_before_selection.length>0);verify(direct.options,q);independentCaps(direct.options);
   passed('Direct reference selection filters stale pool rows before history priority and physical-item capacity');
  }finally{restore();}
 }
 for(const scope of ['outfit','clothing','shirt','topwear_shirt','topwear_shirt_tie','tie','shirt_tie','topwear_tie']){
  const restore=hide(scope);try{
   const pool=c.hybrid.curatedPool(q),after=c.controller.generate(q,c.catalogue,[]);
   assert.ok(pool.rejected.some(row=>row.code==='OWNER_FEEDBACK'));assert.ok(pool.rows.every(row=>h.gate.match(selection(row),q.context).allowed));
   verify(after.options,q);independentCaps(after.options);assert.equal(after.owner_feedback_integration.removed,0);
   passed(scope+': rejection is applied to the reference pool before list selection', {returned:after.options.length});
  }finally{restore();}
 }
 {
  const restore=hide('clothing','dinner');try{const after=c.controller.generate(q,c.catalogue,[]);assert.equal(stable(after.options),stable(initial.options));passed('Dinner-only rejection does not change the Work reference list or source scores');}finally{restore();}
 }
 {
  const pool=c.hybrid.curatedPool(q);assert.ok(pool.rejected.some(row=>row.code==='OWNER_FEEDBACK'&&row.reasons.some(reason=>reason.id.startsWith('OWNER-B01-'))));
  assert.ok(pool.rows.every(row=>F.ownerRuleCheck(selection(row),{context:q.context}).allowed));
  passed('Static B01 and B11 owner garment rules are applied before reference selection');
 }
 {
  const restore=hide('clothing'),rendered=[];let posted=null;
  try{
   c.hybrid.setService(service({propose:async()=>({job_id:'local-fixture',proposals:[{selection:chosen,rationale:'Deliberately rejected provider proposal'}]}),evaluate:async(_q,images)=>{posted=copy(images);return judged(images);}}));
   const result=await c.controller.generateAsync(visualQ,c.catalogue,[],{renderForStylist:async s=>{rendered.push(copy(s));return 'data:image/jpeg;base64,FIXTURE';}});
   assert.ok(rendered.length>15);assert.equal(rendered.length,Math.min(20,c.hybrid.curatedPool(visualQ).rows.length));
   assert.equal(stable(posted.map(x=>x.selection)),stable(rendered));assert.ok(rendered.every(s=>F.key(s,'clothing')!==F.key(chosen,'clothing')));
   assert.ok(result.diagnostics.proposal_rejections.some(row=>row.id==='AI_PROPOSAL_0'&&row.code==='OWNER_FEEDBACK'));
   verify(result.options,visualQ);independentCaps(result.options);assert.equal(result.owner_feedback_integration.removed,0);
   details.visual={rendered:rendered.length,evaluated:posted.length,returned:result.options.length,rejected_proposal_diagnostic:copy(result.diagnostics.proposal_rejections)};
   passed('A banned reference or provider proposal is never rendered, assessed remotely, or admitted to visual selection');
  }finally{restore();c.hybrid.setService(null);}
 }
 for(const stage of ['propose','render','evaluate']){
  let restore=null,renders=0,evaluations=0;
  c.hybrid.setService(service({
   propose:async()=>{if(stage==='propose')restore=hide('clothing');return {job_id:'local-fixture',proposals:[]};},
   evaluate:async(_q,images)=>{evaluations++;if(stage==='evaluate')restore=hide('clothing','work',images[0].selection);return judged(images);}
  }));
  try{
   await assert.rejects(c.controller.generateAsync(visualQ,c.catalogue,[],{renderForStylist:async s=>{renders++;if(stage==='render'&&!restore)restore=hide('clothing','work',s);return 'data:image/jpeg;base64,FIXTURE';}}),/Feedback changed/);
   if(stage==='propose'){assert.equal(renders,0);assert.equal(evaluations,0);}
   if(stage==='render'){assert.equal(renders,1);assert.equal(evaluations,0);}
   if(stage==='evaluate')assert.equal(evaluations,1);
   passed('Feedback changed during '+stage+' prevents the next visual stage or result publication', {renders,evaluations});
  }finally{restore?.();c.hybrid.setService(null);}
 }
 details.durable_peer_boundaries=[];
 for(const stage of ['propose','render','evaluate','healthy']){
  const host=value=>JSON.parse(JSON.stringify(value)),name='hybrid-durable-'+stage+'-'+Date.now(),make=()=>Database.create({indexedDB,keyRange:IDBKeyRange,legacyStorage:memoryStorage(),feedback:HostFeedback,tieFeedback:HostTies,databaseName:name,broadcastChannel:null,validateSelection:s=>c.validateSelection(copy(s))});
  const first=make(),peer=make();let renders=0,evaluations=0,committed=false,staleCacheObserved=false;
  try{
   await Promise.all([first.ready,peer.ready]);await first.sync();await peer.sync();
   // BroadcastChannel is deliberately absent. This is the real durable store,
   // not a mock returning a convenient changed token.
   c.ownerFeedback.set({...first,match:(s,context)=>first.match(host(s),host(context))});
   const commit=async s=>{await peer.hide(host(s),{scope:'clothing',context:'work'});committed=true;assert.equal(peer.match(host(s),host(q.context)).allowed,false);staleCacheObserved=first.match(host(s),host(q.context)).allowed;assert.equal(staleCacheObserved,true,'Peer commit must remain unknown to the first synchronous cache for this regression');};
   c.hybrid.setService(service({
    propose:async()=>{if(stage==='propose')await commit(chosen);return {job_id:'local-fixture',proposals:[]};},
    evaluate:async(_q,images)=>{evaluations++;if(stage==='evaluate')await commit(images[0].selection);return judged(images);}
   }));
   const pending=c.controller.generateAsync(visualQ,c.catalogue,[],{renderForStylist:async s=>{renders++;if(stage==='render'&&!committed)await commit(s);return 'data:image/jpeg;base64,FIXTURE';}});
   if(stage==='healthy'){const result=await pending;assert.ok(result.options.length>0);assert.ok(renders>15);assert.equal(evaluations,1);assert.ok(result.options.every(row=>first.match(host(selection(row)),host(q.context)).allowed));}
   else{
    await assert.rejects(pending,/Saved rejections changed|Feedback changed/);assert.equal(staleCacheObserved,true);
    if(stage==='propose'){assert.equal(renders,0);assert.equal(evaluations,0);}
    if(stage==='render'){assert.equal(renders,1);assert.equal(evaluations,0);}
    if(stage==='evaluate')assert.equal(evaluations,1);
   }
   const detail={stage,peer_committed:committed,stale_cache_observed:staleCacheObserved,renders,evaluations};details.durable_peer_boundaries.push(detail);
   passed(stage==='healthy'?'Healthy Visual generation still passes real durable feedback boundaries':'A peer IndexedDB commit during '+stage+' is caught without BroadcastChannel before the next visual stage or publication',detail);
  }finally{c.ownerFeedback.set(h.gate);c.hybrid.setService(null);first.close();peer.close();}
 }
 {
  let proposals=0;c.hybrid.setService(service({propose:async()=>{proposals++;return {proposals:[]};}}));
  const failed={refresh(){throw Error('Controlled unreadable feedback');},match:h.gate.match.bind(h.gate),assertCurrent:h.gate.assertCurrent.bind(h.gate)};
  c.ownerFeedback.set(failed);try{
   assert.throws(()=>c.controller.generate(q,c.catalogue,[]),/Controlled unreadable feedback/);
   await assert.rejects(c.controller.generateAsync(visualQ,c.catalogue,[],{renderForStylist:async()=>{throw Error('Unexpected render');}}),/Controlled unreadable feedback/);
   assert.equal(proposals,0);passed('Unreadable feedback blocks Curated and Visual before provider proposal or rendering');
  }finally{c.ownerFeedback.set(h.gate);c.hybrid.setService(null);}
 }
 assert.equal(stable([c.catalogue,h.g.HEWRS_INPUTS,c.hybrid.library]),sourceBefore);passed('Reference data, wardrobe source inputs, and numerical source scores remain unchanged');
 write();console.log(JSON.stringify({passed:checks.length,failed:0}));
})().catch(error=>{checks.push({name:'Hybrid rejection audit completion',passed:false,error:error.stack});write();console.error(error);process.exitCode=1;});
