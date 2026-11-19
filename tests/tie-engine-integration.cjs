'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,config,root}=require('./tie-engine-loader.cjs');
const Exposure=require('../src/tie-exposure.js');
const plain=x=>JSON.parse(JSON.stringify(x)),evidence={synthetic:true,actual_owner_usage:false,checks:[],cases:[]};
const started=Date.now();
const selection=o=>o._hewrsConnected.canonical_selection;
const ids=r=>Array.from(r.options,o=>o._hewrsConnected.id);
const tieIds=r=>[...new Set(r.options.map(o=>selection(o).state).filter(x=>x!=='NO_TIE'))];
const check=(name,fn)=>{fn();evidence.checks.push({name,passed:true});console.log('PASS:',name);};
const record=(name,result,request,ms)=>{evidence.cases.push({name,occasion:request.context.occasion,milliseconds:ms,count:result.options.length,ties:tieIds(result),exposure:plain(result.diagnostics?.tie_exposure||null)});};
function run(harness,name,cfg,history=[]){const c=harness.connection,q=c.makeRequest(cfg),time=performance.now(),r=c.controller.generate(q,c.catalogue,history);assert.equal(c.controller.verifyOptionSet(r.options,q),true);record(name,r,q,performance.now()-time);console.log('CASE:',name,r.options.length,'options',Math.round(performance.now()-time)+'ms');return {q,r};}
async function main(){
 const native=load(),baseline=load({baseline:true}),c=native.connection,ledger=Exposure.create(native.storage);
 const first=run(native,'new-empty-history',config());
 const original=run(baseline,'pinned-base-empty-history',config());
 check('Empty exposure preserves all 20 original selections and both score records',()=>{
  assert.equal(first.r.options.length,20);assert.deepEqual(ids(first.r),ids(original.r));
  for(let i=0;i<20;i++)for(const field of ['compatibility','preference','owner_approval','is_recommendation'])assert.deepEqual(plain(first.r.options[i]._hewrsConnected[field]),plain(original.r.options[i]._hewrsConnected[field]));
  assert.equal(first.r.diagnostics.tie_exposure.reranked_choices,0);assert.equal(ledger.snapshot().eventCount,0);
 });
 ledger.commit('synthetic_generation_1',plain(first.r.options.map(selection)),{occasion:'work'});
 const second=run(native,'after-one-published-list',config());
 check('Prior suggestions change curation and introduce a previously unsuggested tie',()=>{
  assert.equal(second.r.options.length,20);assert.ok(second.r.diagnostics.tie_exposure.reranked_choices>0);
  assert.ok(tieIds(second.r).some(id=>!tieIds(first.r).includes(id)));
  const recommendation=r=>r.options.filter(o=>o._hewrsConnected.is_recommendation).map(o=>o._hewrsConnected.id);
  assert.deepEqual(recommendation(second.r),recommendation(first.r));
  for(const o of second.r.options){const x=o._hewrsConnected.curation?.tie_exposure;if(!x)continue;assert.ok(Math.abs(x.preference_gap)<=.050000001);assert.ok(x.utility_gap>=-1e-9&&x.utility_gap<=.050000001);if(x.changed)assert.ok(x.prior_suggestions<x.baseline_prior_suggestions);}
  assert.equal(ledger.snapshot().eventCount,1,'Engine generation alone cannot record published exposure');
 });
 const picked=second.r.options.find(o=>selection(o).state!=='NO_TIE'),banned=selection(picked);
 const veto=native.ties.hide(banned,{scope:'tie',context:'work',reason:'other',note:'Synthetic tie-scope test'});
 const retained=second.r.options.filter(o=>native.gate.match(selection(o),second.q.context).allowed),stable=retained.map(o=>JSON.stringify(o));
 const startRefill=performance.now(),refill=await c.controller.generateAsync(second.q,c.catalogue,[],{retainedOptions:retained});
 record('tie-veto-real-refill',refill,second.q,performance.now()-startRefill);
 check('Tie rejection refills the real native list without changing retained records',()=>{
  assert.equal(refill.options.length,20);assert.equal(c.controller.verifyOptionSet(refill.options,second.q),true);
  assert.deepEqual(refill.options.slice(0,retained.length).map(o=>JSON.stringify(o)),stable);
  assert.ok(refill.options.every(o=>selection(o).state!==banned.state));
  assert.equal(refill.refill.added,20-retained.length);assert.equal(refill.refill.retained,retained.length);
  assert.equal(ledger.snapshot().eventCount,1,'Refill engine must not record an unpublished list');
 });
 const anchorConfig=config('work',{tie:{mode:'item',id:banned.state}});
 const held=run(native,'exact-tie-anchor-respects-ban',anchorConfig);
 check('A selected exact tie never overrides its explicit rejection',()=>assert.equal(held.r.options.length,0));
 native.ties.restore(veto.id);
 const anchored=run(native,'exact-tie-anchor-after-undo',anchorConfig);
 check('Undo restores the tie and exact tie anchors bypass exposure reranking',()=>{
  assert.equal(anchored.r.options.length,20);assert.ok(anchored.r.options.every(o=>selection(o).state===banned.state));assert.equal(anchored.r.diagnostics.tie_exposure.reranked_choices,0);
 });
 const pair=selection(anchored.r.options[0]),pairVeto=native.ties.hide(pair,{scope:'shirt_tie',context:'work',reason:'other',note:'Synthetic pair-scope test'});
 const paired=run(native,'shirt-tie-pair-veto-with-tie-anchor',anchorConfig);
 check('Pair rejection preserves the tie with other shirts in real generation',()=>{
  assert.equal(paired.r.options.length,20);assert.ok(paired.r.options.every(o=>selection(o).state===pair.state&&selection(o).shirtId!==pair.shirtId));
  assert.equal(native.gate.match(pair,{occasion:'dinner'}).allowed,true);
 });
 native.ties.restore(pairVeto.id);
 const contextual=load(),s05Config=config('work',{topwear:{mode:'item',id:contextual.connection.aliases.get('S05')}});
 const s05=run(contextual,'S05-before-contextual-tie-rejection',s05Config);
 const rejected=selection(s05.r.options.find(o=>selection(o).state!=='NO_TIE'));
 const contextualEvent=contextual.ties.hide(rejected,{scope:'topwear_tie',context:'work',reason:'other',note:'Synthetic suit is fine; tie does not work with it'});
 const keptS05=s05.r.options.filter(o=>contextual.gate.match(selection(o),s05.q.context).allowed),originalS05=Array.from(keptS05,o=>JSON.stringify(o)),refillStart=performance.now();
 const s05Refill=await contextual.connection.controller.generateAsync(s05.q,contextual.connection.catalogue,[],{retainedOptions:keptS05});
 record('S05-contextual-tie-refill',s05Refill,s05.q,performance.now()-refillStart);
 check('S05 contextual rejection replaces its tie without changing the suit anchor or accepted rows',()=>{
  assert.equal(s05Refill.options.length,20);assert.equal(contextual.connection.controller.verifyOptionSet(s05Refill.options,s05.q),true);
  assert.deepEqual(Array.from(s05Refill.options.slice(0,keptS05.length),o=>JSON.stringify(o)),originalS05);
  assert.ok(s05Refill.options.every(o=>selection(o).suitId==='S05'&&selection(o).state!==rejected.state));
  assert.equal(contextual.gate.match(contextual.g.structuredClone({...rejected,shirtId:rejected.shirtId==='DS001'?'DS002':'DS001'}),{occasion:'work'}).allowed,false);
  assert.equal(contextual.gate.match(contextual.g.structuredClone({...rejected,suitId:'S06'}),{occasion:'work'}).allowed,true);
  assert.equal(contextual.gate.match(rejected,{occasion:'dinner'}).allowed,true);
 });
 const elsewhere=run(contextual,'same-tie-remains-eligible-with-other-topwear',config('work',{tie:{mode:'item',id:rejected.state}}));
 check('Suit–tie rejection keeps that tie available with other suits and blazers',()=>{
  assert.ok(elsewhere.r.options.length>0);assert.ok(elsewhere.r.options.every(o=>selection(o).state===rejected.state&&selection(o).suitId!=='S05'));
 });
 contextual.ties.restore(contextualEvent.id);
 check('Undo restores the contextual suit–tie pairing',()=>assert.equal(contextual.gate.match(rejected,{occasion:'work'}).allowed,true));
 for(const occasion of ['dinner','weekend']){
  const result=run(native,'independent-'+occasion,config(occasion));
  check(occasion+' keeps its occasion and has no fabricated Work exposure',()=>{
   assert.equal(result.r.options.length,20);assert.ok(result.r.options.every(o=>o.context===occasion));
   assert.deepEqual(plain(result.r.diagnostics.tie_exposure.prior_counts),{});assert.equal(result.r.diagnostics.tie_exposure.reranked_choices,0);
  });
 }
 const open=run(native,'explicit-no-tie',config('work',{tie:{mode:'none'}}));
 check('Explicit No Tie stays open collar without exposure substitutions',()=>{
  assert.equal(open.r.options.length,20);assert.ok(open.r.options.every(o=>selection(o).state==='NO_TIE'));assert.equal(open.r.diagnostics.tie_exposure.reranked_choices,0);
 });
 const corruptKey=Exposure.prefix+'synthetic_corrupt';native.storage.setItem(corruptKey,'{broken');
 const fallback=run(native,'unreadable-exposure-history',config());
 check('Corrupt exposure disables only its optional curation and preserves original ordering',()=>{
  assert.equal(fallback.r.options.length,20);assert.equal(fallback.r.diagnostics.tie_exposure.available,false);
  assert.deepEqual(ids(fallback.r),ids(first.r));assert.equal(native.storage.getItem(corruptKey),'{broken');
 });
 native.storage.removeItem(corruptKey);
 const before=ledger.snapshot().token,cancelled=await c.controller.generateAsync(first.q,c.catalogue,[],{isCancelled:()=>true});
 check('Cancelled engine work neither publishes choices nor changes exposure',()=>{assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.options.length,0);assert.equal(ledger.snapshot().token,before);});
 const generatedKeys=Array.from({length:native.storage.length},(_,i)=>native.storage.key(i));
 check('All integration tests leave wear and Favorites storage untouched',()=>assert.ok(generatedKeys.every(k=>k.startsWith(Exposure.prefix)||k.startsWith(native.g.HEWRSTieFeedback.PREFIX))));
}
main().catch(error=>{evidence.error=error.stack;console.error(error);process.exitCode=1;}).finally(()=>{
 evidence.duration_seconds=(Date.now()-started)/1000;evidence.passed=evidence.checks.length;
 const out=path.join(root,'evidence/tie_feedback_rotation');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'ENGINE_CHECKS.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log('ENGINE CHECKS:',evidence.passed,'passed;',evidence.error?'FAILED':'complete');
});
