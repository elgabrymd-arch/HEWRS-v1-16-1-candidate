'use strict';
// Actual native engine. Synthetic exclusions only; does not overwrite the
// pinned diagnostic evidence or claim these timings are phone measurements.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const {load,config,root}=require('./tie-engine-loader.cjs');
const select=o=>o._hewrsConnected.canonical_selection;
const clothingKey=s=>[s.suitId||s.blazerId||'SHIRT_ONLY',s.pantId||'SUIT_TROUSERS',s.shirtId,s.state].join('|');
const plain=x=>JSON.parse(JSON.stringify(x));
const engine=path.join(root,'src/outfit-refill-engine.js');
const pinned=cp.execFileSync('git',['show','b9e33124d15c0f7127f2b2eb61dd710ec9edd05f:src/outfit-refill-engine.js'],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
const observations={schema:'hewrs.rejection-search-expansion.v1',synthetic_data_only:true,actual_owner_usage:false,browser_test:false,checks:[],generations:[]};
function check(name,fn){fn();observations.checks.push({name,passed:true});console.log('PASS:',name);}
function loadSource(source,capture=false){
 const original=fs.readFileSync;
 const marker='diagnostics.numeric_candidates=rawCandidates.length;diagnostics.preference_evaluated=candidates.length;';
 if(capture){assert.equal(source.split(marker).length,2);source=source.replace(marker,marker+'root.__searchTestPool={raw:rawCandidates,scored:candidates};');}
 fs.readFileSync=function(file,...args){return path.resolve(String(file))===engine?source:original.call(this,file,...args);};
 try{return load();}finally{fs.readFileSync=original;}
}
async function generate(h,label,cfg=config(),retainedOptions){
 const q=h.connection.makeRequest(cfg),at=performance.now(),progress=[];
 const r=await h.connection.controller.generateAsync(q,h.connection.catalogue,[],{...(retainedOptions===undefined?{}:{retainedOptions}),onProgress:p=>{if(progress.at(-1)!==p.phase)progress.push(p.phase);}});
 assert.equal(h.connection.controller.verifyOptionSet(r.options,q),true);
 assert.ok(r.options.every(o=>h.gate.match(select(o),q.context).allowed));
 const observation={label,milliseconds:performance.now()-at,returned:r.options.length,source_eligible:r.diagnostics.source_eligible_before_feedback??r.diagnostics.numeric_candidates,feedback_excluded:r.diagnostics.feedback_excluded_clothing||0,scored:r.diagnostics.preference_evaluated,source_expansion_batches:r.diagnostics.source_expansion_batches||0,search_completion:plain(r.diagnostics.search_completion||null),progress_phases:progress};
 observations.generations.push(observation);console.log('GENERATION:',label,observation.returned,'options',Math.round(observation.milliseconds)+'ms');
 return {q,r,observation};
}
function banEvents(h,rows,scope,shoe='shoe-1'){
 const F=h.g.HEWRSOutfitFeedback;
 return rows.map((e,i)=>({schema:F.SCHEMA,id:'search_'+scope+'_'+String(i).padStart(6,'0'),at:'2026-11-18T12:00:00.000Z',type:'hide',actor:'owner',selection:{suitId:e.group.topwearId,shirtId:e.row[0],state:e.row[1],shoeId:shoe,watchId:null},scope,occasion:'all',reason:'other'}));
}
async function main(){
 const legacy=loadSource(pinned,true),suit=legacy.connection.catalogue.suits[9].id,fixed=config('work',{topwear:{mode:'item',id:suit}});
 const prior=await generate(legacy,'pinned-original-S10-sample',fixed);
 const scored=Array.from(legacy.g.__searchTestPool.scored),raw=Array.from(legacy.g.__searchTestPool.raw);
 check('The pinned original defect fixture contains 167 scored rows and 1,801 additional source rows',()=>{assert.equal(scored.length,167);assert.equal(raw.length,1968);});
 const current=load();
 const healthy=await generate(current,'unchanged-healthy-S10',fixed);
 check('Healthy output records and all original scores match the pinned pre-repair candidate',()=>assert.deepEqual(plain(healthy.r.options),plain(prior.r.options)));
 const F=current.g.HEWRSOutfitFeedback;
 current.feedback.importData(current.g.structuredClone({schema:F.EXPORT,events:banEvents(current,scored,'clothing')}));
 const recovered=await generate(current,'all-original-167-sampled-clothing-rejected',fixed);
 const oldKeys=new Set(scored.map(e=>[e.group.topwearId,'SUIT_TROUSERS',e.row[0],e.row[1]].join('|')));
 check('Rejecting every original sampled clothing combination selects 20 new valid options',()=>{
  assert.equal(recovered.r.options.length,20);assert.equal(recovered.observation.feedback_excluded,167);
  assert.ok(recovered.r.options.every(o=>!oldKeys.has(clothingKey(select(o)))));
  assert.equal(current.feedback.refresh().active.length,167);
 });
 check('Broad exclusions are removed before coverage/scoring and full-list discovery is not called exhaustive',()=>{
  const d=recovered.r.diagnostics;
  assert.equal(d.bounded_source_review.after_broad_feedback,raw.length-scored.length);
  assert.ok(d.preference_evaluated<d.numeric_candidates);
  assert.equal(d.search_completion.stopped_because,'target_reached');
  assert.equal(d.search_completion.exhaustion_proven,false);
  assert.ok(d.search_completion.remaining_source_unreviewed>0);
 });
 // Shoe-specific exclusions do not remove clothing rows before sampling.
 // With one exact shoe anchor this deliberately blocks the entire original
 // sample, forcing real source expansion rather than a broadened clothing ban.
 const exact=load();
 exact.feedback.importData(exact.g.structuredClone({schema:exact.g.HEWRSOutfitFeedback.EXPORT,events:banEvents(exact,scored,'outfit','shoe-1')}));
 const shoeFixed=config('work',{topwear:{mode:'item',id:suit},shoes:{mode:'item',id:'shoe-1'}});
 const expanded=await generate(exact,'exact-shoe-bans-force-raw-source-expansion',shoeFixed);
 check('An exhausted scored sample expands to previously unreviewed raw rows without recycling',()=>{
  assert.equal(expanded.r.options.length,20);
  assert.equal(expanded.observation.feedback_excluded,0);
  assert.ok(expanded.observation.source_expansion_batches>0);
  assert.ok(expanded.observation.scored>scored.length);
  assert.ok(expanded.r.options.every(o=>select(o).shoeId==='shoe-1'&&!oldKeys.has(clothingKey(select(o)))));
  assert.ok(expanded.observation.progress_phases.includes('expanding-unreviewed-source'));
 });
 const narrow=load(),chosen=select(healthy.r.options[0]);
 narrow.feedback.hide(narrow.g.structuredClone(chosen),{scope:'outfit',context:'all',reason:'other'});
 const narrowConfig=config('work',{topwear:{mode:'item',id:suit},shirt:{mode:'item',id:chosen.shirtId},tie:chosen.state==='NO_TIE'?{mode:'none'}:{mode:'item',id:chosen.state}});
 const alternateShoe=await generate(narrow,'same-clothing-with-different-shoe',narrowConfig);
 check('One exact outfit ban still permits the same clothing with another eligible shoe',()=>{
  assert.ok(alternateShoe.r.options.length>0);
  assert.ok(alternateShoe.r.options.every(o=>clothingKey(select(o))===clothingKey(chosen)&&select(o).shoeId!==chosen.shoeId));
  assert.equal(alternateShoe.observation.feedback_excluded,0);
 });
 // Retained accepted records are not re-ranked or reconstructed by expansion.
 const removed=recovered.r.options.slice(0,2);
 for(const o of removed)current.feedback.hide(select(o),{scope:'clothing',context:'all',reason:'other'});
 const kept=recovered.r.options.slice(2),before=Array.from(kept,o=>JSON.stringify(o));
 const refill=await generate(current,'refill-after-new-broad-exclusions',fixed,kept);
 check('Refill keeps accepted options byte-for-byte and returns 20 without any prior rejection',()=>{
  assert.equal(refill.r.options.length,20);assert.equal(refill.r.refill.retained,18);assert.equal(refill.r.refill.added,2);
  assert.ok(before.every((value,i)=>value===JSON.stringify(refill.r.options[i])),'A retained option record changed');
  assert.equal(current.feedback.refresh().active.length,169);
 });
 narrow.feedback.hide(narrow.g.structuredClone(chosen),{scope:'clothing',context:'all',reason:'other'});
 const exhausted=await generate(narrow,'proven-single-clothing-exhaustion',narrowConfig);
 check('A fully rejected narrow source reports genuine exhaustion and retains the rejection',()=>{
  assert.equal(exhausted.r.options.length,0);
  assert.equal(exhausted.r.no_match.code,'MATCHING_CLOTHING_REJECTED');
  assert.equal(exhausted.r.diagnostics.search_completion.stopped_because,'remaining_source_exhausted');
  assert.equal(exhausted.r.diagnostics.search_completion.exhaustion_proven,true);
  assert.equal(exhausted.r.diagnostics.search_completion.remaining_source_unreviewed,0);
 });
 // Whole-tie bans reduce a mathematical list bound. Do not scan the full
 // source for an impossible twentieth option or broaden a shirt/tie pair.
 const tied=load();
 for(let i=1;i<=30;i++)tied.ties.hide(tied.g.structuredClone({...chosen,state:'T'+String(i).padStart(3,'0')}),{scope:'tie',context:'all',reason:'other',note:'Synthetic broad-scope capacity test'});
 const capped=await generate(tied,'thirty-whole-tie-bans',config());
 check('Thirty whole-tie bans stop at the proven19-option Work bound without reusing a tie',()=>{
  assert.equal(capped.r.options.length,19);
  assert.ok(capped.r.options.every(o=>select(o).state==='NO_TIE'||Number(select(o).state.slice(1))>30));
  assert.equal(capped.r.diagnostics.search_completion.stopped_because,'physical_item_upper_bound');
  assert.equal(capped.r.diagnostics.search_completion.physical_item_upper_bound,19);
  assert.equal(capped.r.diagnostics.search_completion.exhaustion_proven,false);
 });
 tied.ties.hide(tied.g.structuredClone({...chosen,state:'T047'}),{scope:'shirt_tie',context:'all',reason:'other',note:'Synthetic exact pair'});
 const paired=await generate(tied,'rejected-exact-shirt-tie-pair',config('work',{shirt:{mode:'item',id:chosen.shirtId},tie:{mode:'item',id:'T047'}}));
 check('An exact shirt–tie pair exclusion is applied before source sampling',()=>{
  assert.equal(paired.r.options.length,0);assert.ok(paired.observation.feedback_excluded>0);
  assert.equal(paired.r.diagnostics.bounded_source_review.after_broad_feedback,0);
  assert.equal(paired.observation.scored,0);
 });
 // A cancellation requested at the first expanded batch stops the generator.
 let expansionSeen=false;
 const cancelled=await exact.connection.controller.generateAsync(expanded.q,exact.connection.catalogue,[],{isCancelled:()=>expansionSeen,onProgress:p=>{if(p.phase==='expanding-unreviewed-source')expansionSeen=true;}});
 check('Expanded source search honors caller cancellation between yielded batches',()=>{assert.equal(expansionSeen,true);assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.options.length,0);});
 const unseen=raw.filter(e=>!oldKeys.has([e.group.topwearId,'SUIT_TROUSERS',e.row[0],e.row[1]].join('|')));
 const exhaustEvents=banEvents(exact,unseen,'outfit','shoe-1').map((event,i)=>({...event,id:'exhaustion_'+String(i).padStart(6,'0')}));
 exact.feedback.importData(exact.g.structuredClone({schema:exact.g.HEWRSOutfitFeedback.EXPORT,events:exhaustEvents}));
 const fullExhaustion=await generate(exact,'full-S10-source-exhausted-at-one-exact-shoe',shoeFixed);
 check('Full source exhaustion is reported only after all remaining rows are reviewed',()=>{
  assert.equal(fullExhaustion.r.options.length,0);
  const d=fullExhaustion.r.diagnostics;
  assert.equal(d.feedback_excluded_clothing,0);
  assert.equal(d.preference_evaluated,1968);
  assert.ok(d.source_expansion_batches>=Math.ceil(1801/64));
  assert.equal(d.search_completion.remaining_source_unreviewed,0);
  assert.equal(d.search_completion.exhaustion_proven,true);
  assert.equal(d.search_completion.all_source_rows_reviewed,true);
  assert.equal(exact.feedback.refresh().active.length,1968);
 });
 observations.complete=true;
}
main().catch(e=>{observations.error=e.stack;console.error(e);process.exitCode=1;}).finally(()=>{
 const out=path.join(root,'evidence/rejection_storage/search-expansion.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(observations,null,2)+'\n');
});
