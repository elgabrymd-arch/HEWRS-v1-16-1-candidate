'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const root=require('./core-loader.cjs')(path.resolve(__dirname,'..'));
const conn=root.HEWRSCleanConnection.create(root.HEWRS_INPUTS);
const preferences=Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(k=>[k,{mode:'any'}]));
function run(changes={},label='unlocked'){
  const q=conn.makeRequest({automatic:true,stylistMode:'research',preferences:{...preferences,...changes},localDate:'2026-11-08',style:'AUTO',occasion:'work',formality:'any',environment:{source:'not_assessed',date:'2026-11-08'}});
  const start=Date.now(),r=conn.controller.generate(q,conn.catalogue,[]),elapsed=Date.now()-start;
  assert.ok(r.options.length>0&&r.options.length<=20,label+': missing or overlimit options');
  assert.equal(conn.controller.verifyOptionSet(r.options,q),true,label+': invalid option policy or source');
  const scan=r.diagnostics.bounded_source_review;
  assert.ok(scan&&scan.source_eligible>scan.scored,label+': not bounded');
  assert.ok(scan.scored<=30000,label+': scored pool over budget');
  const uniq=new Set(r.options.map(o=>o._hewrsConnected.id));
  assert.equal(uniq.size,r.options.length,label+': duplicated full outfits');
  console.log(JSON.stringify({test:label,status:'PASS',elapsed_ms:elapsed,source_eligible:scan.source_eligible,scored:scan.scored,returned:r.options.length}));
  return r;
}
const before=JSON.stringify(root.HEWRS_INPUTS);
run();
const b11=run({topwear:{mode:'item',id:conn.blazerConnection.knownBlazer('B11').historyId}},'B11 anchored');
for(const x of b11.options){
  assert.equal(x._hewrsConnected.canonical_selection.blazerId,'B11');
  assert.equal(x._hewrsConnected.canonical_selection.state,'NO_TIE','B11 tie not blocked');
  assert.ok(['Loafers','Sneakers'].includes(x.items.shoes.subcategory),'B11 formal shoe not blocked');
}
assert.equal(JSON.stringify(root.HEWRS_INPUTS),before,'Original inventory changed by generation');
console.log('STAGE10_BOUNDED_GENERATION_PASS');
