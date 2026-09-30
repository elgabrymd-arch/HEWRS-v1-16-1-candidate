'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const R=path.resolve(__dirname,'..'),E=R+'/evidence/performance_v1_22_1',code=fs.readFileSync(R+'/src/runtime-loader.js','utf8'),checks=[];
function fixture(boot=false){const tags=[],timers=new Map(),notice={textContent:'',dataset:{}},events={};let id=0,writes=0;
 const g={Promise,Date,performance:{now:()=>1},HEWRS_INPUT_SHA256:'input',HEWRSSourceCorrections:{revision:'source'},HEWRSEnsembleCompletion:{normalizationRevision:'normal'},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:n=>timers.delete(n),addEventListener:(name,fn)=>events[name]=fn,localStorage:{setItem:()=>writes++}};
 g.document={currentScript:{dataset:{engineIndex:'data/option-index.js?v=PINNED',engineIntegrity:'sha256-PINNED',boot:String(boot)}},createElement:()=>({dataset:{},remove(){this.removed=true;}}),head:{appendChild:t=>tags.push(t)},getElementById:()=>notice};vm.createContext(g);vm.runInContext(code,g);
 function valid(){g.HEWRS_OPTION_INDEX={schema:'hewrs.derived-clothing-index.v1_17_0',source_input_sha256:'input',current_source_revision:'source',normalization_revision:'normal'};}
 return {g,api:g.HEWRSRuntimeLoader,tags,timers,notice,events,valid,writes:()=>writes};}
async function ck(name,f){try{const detail=await f();checks.push({name,passed:true,detail:detail??null});console.log('PASS',name);}catch(e){checks.push({name,passed:false,error:e.stack});console.log('FAIL',name,e.message);}}
(async()=>{
 await ck('Home loader performs no request or storage write at construction',()=>{const x=fixture();assert.equal(x.tags.length,0);assert.equal(x.writes(),0);});
 await ck('Concurrent index requests coalesce and retain exact content-pinned URL and SRI',async()=>{const x=fixture(),a=x.api.ensureIndex(),b=x.api.ensureIndex();assert.equal(a,b);assert.equal(x.tags.length,1);assert.equal(x.tags[0].src,'data/option-index.js?v=PINNED');assert.equal(x.tags[0].integrity,'sha256-PINNED');x.valid();x.tags[0].onload();await Promise.all([a,b]);await x.api.ensureIndex();assert.equal(x.tags.length,1);});
 await ck('Network failure cleans up and a second Generate can retry safely',async()=>{const x=fixture(),a=x.api.ensureIndex(),rejected=assert.rejects(a,/could not be downloaded/);x.tags[0].onerror();await rejected;assert.ok(x.tags[0].removed);const b=x.api.ensureIndex();assert.equal(x.tags.length,2);x.valid();x.tags[1].onload();await b;assert.equal(x.writes(),0);});
 await ck('Thirty-second timeout ends wait without deleting data',async()=>{const x=fixture(),a=x.api.ensureIndex(),rejected=assert.rejects(a,/timed out/);const timer=[...x.timers.values()].find(t=>t.ms===30000);assert.ok(timer);timer.fn();await rejected;assert.ok(x.tags[0].removed);assert.equal(x.writes(),0);});
 await ck('Mismatched owner-source revision fails instead of using old S02 data',async()=>{const x=fixture();x.valid();x.g.HEWRS_OPTION_INDEX.current_source_revision='old';await assert.rejects(x.api.ensureIndex(),/does not match/);assert.equal(x.tags.length,0);});
 await ck('Preloaded source-test/standalone index remains supported',async()=>{const x=fixture();x.valid();await x.api.ensureIndex();assert.equal(x.tags.length,0);assert.equal(x.api.stats().indexReady,true);});
 await ck('Slow boot warning is cancelled after successful Home readiness',()=>{const x=fixture(true);assert.ok([...x.timers.values()].some(t=>t.ms===20000));x.api.ready();assert.equal(x.timers.size,0);assert.equal(x.api.stats().homeReadyMs,0);});
 await ck('Boot resource failure is actionable and never clears saved data',()=>{const x=fixture(true);x.events.error({target:{tagName:'SCRIPT'}});assert.match(x.notice.textContent,/did not load/);assert.equal(x.writes(),0);});
 fs.writeFileSync(E+'/LOADER_TESTS.json',JSON.stringify({passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length,checks},null,2));if(checks.some(x=>!x.passed))process.exitCode=1;
})();
