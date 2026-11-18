'use strict';
const assert=require('node:assert/strict');
const Flow=require('../src/ai-five-flow.js');
const P=require('../src/ai-five-exclusion.js');
const wardrobe=n=>({suitId:'S'+String(n).padStart(2,'0'),shirtId:'DS001',state:'T001',shoeId:'shoe-8',watchId:null});
const native=Array.from({length:20},(_,i)=>({_hewrsConnected:{canonical_selection:wardrobe(i+1)}}));
const request={automatic:true,source_lock:'sha-test',prefs:{topwear:{mode:'item',id:'suit-1'}},executiveStyle:'MODERN',context:{occasion:'work',requiredFormality:'any'},localDate:'2026-11-17',environment:{source:'not_assessed',date:'2026-11-17'}};
const snapshot=()=>({request,options:native});
let calls=0,received=null,reply=null,ready=true;
const service={ready:()=>ready,propose:async q=>{calls++;received=q;return reply;}};
const rejected=new Set(),recent=new Set();
const flow=Flow.create({read:snapshot,service,validate:s=>!!s?.shirtId,
  ownerAllows:s=>!rejected.has(P.garmentKey(s)),rotationAllows:s=>!recent.has(P.garmentKey(s))});
function offer(n,occasion='work',watchId=null){return {selection:{...wardrobe(n),watchId},occasion,rationale:'AI independent proposal'};}
(async()=>{
 reply={job_id:'fixture',proposals:[offer(1,'work','watch-99'),offer(21),offer(21,'work','watch-42'),offer(22,'dinner'),offer(23),offer(24),offer(25),offer(26)]};
 const out=await flow.generate();
 assert.equal(out.status,'complete');assert.equal(out.options.length,5);
 assert.equal(out.diagnostics.overlap_with_hewrs,1);
 assert.equal(out.diagnostics.duplicate_ai_look,1);
 assert.equal(out.diagnostics.wrong_occasion,1);
 assert.equal(out.options.every(x=>x.occasion==='work'),true);
 assert.equal(received.context.occasion,'work');
 assert.equal('executiveStyle' in received,false);
 assert.equal('prefs' in received,false);
 assert.equal('guards' in received,false);
 assert.equal('environment' in received,false);
 assert.deepEqual(received.excluded_outfit_keys,native.map(P.garmentKey));
 assert.deepEqual(Object.keys(received.weather),['source','temperatureBand','precipitation','season']);
 assert.equal(out.live_ai_used,false,'Injected fixtures must never claim live AI');
 assert.ok(Object.isFrozen(out.options));
 assert.equal(received.source_lock,'sha-test');
 assert.equal(request.executiveStyle,'MODERN');
 assert.equal(native.length,20);
 P.assertDisjoint(native,out.options);
 // Rejected and recently worn exact outfits are disqualified, without editing
 // the user's actual rejection or wear records.
 rejected.add(P.garmentKey(offer(21)));recent.add(P.garmentKey(offer(23)));
 const limited=await flow.generate();assert.equal(limited.status,'partial');
 assert.equal(limited.options.some(x=>P.garmentKey(x)===P.garmentKey(offer(21))),false);
 assert.equal(limited.options.some(x=>P.garmentKey(x)===P.garmentKey(offer(23))),false);
 assert.equal(limited.diagnostics.rejected,2);assert.equal(limited.diagnostics.rotation,1);
 // Work/Dinner/Weekend are passed through as explicit occasion requirements.
 rejected.clear();recent.clear();
 for (const occasion of ['dinner','weekend']) {
   request.context.occasion=occasion;reply={proposals:[offer(21,occasion),offer(22,'work'),offer(23,occasion)]};
   const r=await flow.generate();assert.equal(r.context.occasion,occasion);
   assert.deepEqual(r.options.map(x=>x.occasion),[occasion,occasion]);
 }
 request.context.occasion='work';
 // No service connection: no paid request and no fallback falsely called AI.
 ready=false;const before=calls;
 await assert.rejects(flow.generate(),/not connected/);assert.equal(calls,before);ready=true;
 // Native set changes in flight: no stale AI proposals are presented.
 const moving=Flow.create({read:snapshot,service:{ready:()=>true,propose:async()=>{
   native[0]={_hewrsConnected:{canonical_selection:wardrobe(31)}};
   return {proposals:[offer(21)]};}},validate:()=>true,ownerAllows:()=>true,rotationAllows:()=>true});
 await assert.rejects(moving.generate(),/changed/);native[0]={_hewrsConnected:{canonical_selection:wardrobe(1)}};
 // Context and wear/feedback guards invalidate even an unchanged native list.
 for (const mutate of [
   s=>{s.request.environment.temperatureBand='hot';},
   s=>{s.options[0]._hewrsConnected.canonical_selection.watchId='watch-new';},
   s=>{s.guards.history_token='wear2';},
   s=>{s.guards.feedback_token='feedback2';},
   s=>{s.guards.native_generation++;}
 ]) {
   const state=structuredClone({...snapshot(),guards:{history_token:'wear1',feedback_token:'feedback1',native_generation:1}});
   const movingGuard=Flow.create({read:()=>state,service:{ready:()=>true,propose:async()=>{mutate(state);return {proposals:[offer(21)]};}},validate:()=>true,ownerAllows:()=>true,rotationAllows:()=>true});
   await assert.rejects(movingGuard.generate(),/changed/);
 }
 const beforeCancelled=calls;
 await assert.rejects(flow.generate({isCancelled:()=>true}),/cancelled/);
 assert.equal(calls,beforeCancelled,'Cancellation before dispatch must send no request');
 const privacy=Flow.neutralRequest({...request,environment:{source:'manual',temperatureBand:'cool',precipitation:'dry',season:'Fall',latitude:12,longitude:34,place:{label:'private'},date:'2026-11-17'}},native);
 assert.deepEqual(Object.keys(privacy).sort(),['context','excluded_outfit_keys','localDate','source_lock','weather']);
 assert.equal(JSON.stringify(privacy).includes('private'),false);
 // Rejection arrives after proposal, before final commit: fail closed.
 const changing=Flow.create({read:snapshot,service:{ready:()=>true,propose:async()=>({proposals:[offer(21)]})},validate:()=>true,
   ownerAllows:(()=>{let n=0;return ()=>++n===1;})(),rotationAllows:()=>true});
 await assert.rejects(changing.generate(),/changed while preparing/);
 console.log('PASS AI Five flow with synthetic fixtures: native20 identity, Work/Dinner/Weekend, neutral style, watch-only duplicates, owner veto, rotation, provider disconnected, stale generation');
})().catch(e=>{console.error(e);process.exitCode=1;});
