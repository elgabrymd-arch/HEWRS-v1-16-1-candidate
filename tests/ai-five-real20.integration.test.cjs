'use strict';
// Full native HEWRS source fixture. No provider, no browser data or wear writes.
const path=require('node:path'),assert=require('node:assert/strict');
const R=path.resolve(__dirname,'..'),root=require('./core-loader.cjs')(R);
const P=require('../src/ai-five-exclusion.js'),Flow=require('../src/ai-five-flow.js');
const c=root.HEWRSCleanConnection.create(root.HEWRS_INPUTS);
const q=c.makeRequest({
  automatic:true,stylistMode:'research',
  preferences:Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(x=>[x,{mode:'any'}])),
  occasion:'work',formality:'any',style:'AUTO',localDate:'2026-10-01',
  environment:{source:'not_assessed',date:'2026-10-01'}
});
const native=c.controller.generate(q,c.catalogue,[]);
assert.equal(native.options.length,20,'Actual HEWRS engine did not return twenty outfits');
assert.ok(c.controller.verifyOptionSet(native.options,q));
const nativeKeys=new Set(native.options.map(P.garmentKey));
const fixtures=[],used=new Set();
for(const row of c.hybrid.library.records){
  const s=row.selection;
  try {
    if(s.state==='REFERENCE')continue;
    c.validateSelection(s);
    const key=P.garmentKey(s);
    if(nativeKeys.has(key)||used.has(key))continue;
    used.add(key);fixtures.push({selection:s,occasion:q.context.occasion,rationale:'Owned wardrobe fixture'});
    if(fixtures.length===5)break;
  } catch {}
}
assert.equal(fixtures.length,5,'Need five distinct renderable wardrobe fixtures');
let calls=0;
const flow=Flow.create({
  read:()=>({options:native.options,request:q}),
  service:{ready:()=>true,propose:async r=>{calls++;assert.equal(r.context.occasion,'work');assert.deepEqual(r.excluded_outfit_keys,Array.from(native.options,P.garmentKey));return {proposals:fixtures};}},
  validate:s=>{try{c.validateSelection(s);return true;}catch{return false;}},
  ownerAllows:()=>true,rotationAllows:()=>true
});
(async()=>{
 const out=await flow.generate();
 assert.equal(calls,1);
 assert.equal(out.options.length,5);
 assert.equal(out.live_ai_used,false);
 P.assertDisjoint(native.options,out.options);
 assert.equal(native.options.length,20);
 console.log('PASS real HEWRS twenty + five distinct renderable owned-wardrobe fixtures; no live provider');
})().catch(e=>{console.error(e);process.exitCode=1;});
