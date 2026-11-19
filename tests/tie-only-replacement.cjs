'use strict';
// Real wardrobe engine with synthetic feedback only. Tie complaints must not
// repair a rejected outfit by changing the shirt the owner just accepted.
const assert=require('node:assert/strict');
const {load,config}=require('./tie-engine-loader.cjs');
const selected=o=>o._hewrsConnected.canonical_selection;
const plain=x=>JSON.parse(JSON.stringify(x));
const otherPieces=s=>Object.fromEntries(['suitId','blazerId','pantId','shirtId','shoeId','watchId'].map(k=>[k,s[k]??null]));
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS:',name);}
function storageBytes(storage){return Array.from({length:storage.length},(_,i)=>storage.key(i)).sort().map(k=>[k,storage.getItem(k)]);}
async function main(){
 const h=load(),c=h.connection;
 const cfg=config('work',{topwear:{mode:'item',id:c.catalogue.suits[4].id}}),cfgBefore=JSON.stringify(cfg);
 const q=c.makeRequest(cfg),qBefore=JSON.stringify(q);
 const initial=await c.controller.generateAsync(q,c.catalogue,[]);
 const original=plain(selected(initial.options[0]));
 check('Real S05 fixture starts with DS029 and the dark navy T029',()=>{
  assert.equal(initial.options.length,20);assert.equal(c.controller.verifyOptionSet(initial.options,q),true);
  assert.equal(original.suitId,'S05');assert.equal(original.shirtId,'DS029');assert.equal(original.state,'T029');
  assert.match(c.catalogue.ties.find(t=>t.id===original.state).primaryColor,/navy/i);
 });
 async function replaceFrom(result,request,source){
  const kept=result.options.filter(o=>h.gate.match(selected(o),request.context).allowed),before=kept.map(o=>JSON.stringify(o)),bytes=storageBytes(h.storage);
  const replacement=await c.controller.generateAsync(request,c.catalogue,[],{retainedOptions:kept,replaceTieFor:source});
  assert.deepEqual(kept.map(o=>JSON.stringify(o)),before,'Input accepted options were mutated');
  assert.deepEqual(replacement.options.slice(0,kept.length).map(o=>JSON.stringify(o)),before,'Accepted option records or order changed');
  assert.deepEqual(storageBytes(h.storage),bytes,'Generating a replacement wrote persistent state');
  assert.equal(c.controller.verifyOptionSet(replacement.options,request),true);
  return {replacement,kept,before};
 }
 for(const scope of ['shirt_tie','topwear_tie','tie']){
  const event=h.ties.hide(h.g.structuredClone(original),{scope,context:'all',reason:'other',note:'Synthetic tie-only replacement check'});
  const {replacement,kept}=await replaceFrom(initial,q,original);
  check(scope+' replaces only the tie and retains the other 19 outfits',()=>{
   assert.equal(kept.length,19);assert.equal(replacement.options.length,20);
   assert.equal(replacement.refill.retained,19);assert.equal(replacement.refill.added,1);
   const changed=plain(selected(replacement.options[19]));
   assert.deepEqual(otherPieces(changed),otherPieces(original));assert.notEqual(changed.state,original.state);assert.match(changed.state,/^T\d{3}$/);
   assert.ok(replacement.options.every(o=>h.gate.match(selected(o),q.context).allowed));
   assert.match(replacement.reason,/Changed only the tie/);
   console.log('REPLACEMENT:',JSON.stringify({scope,original,replacement:changed}));
  });
  h.ties.restore(event.id);
 }
 check('Replacement does not persist implicit preferences or alter the original request',()=>{
  assert.equal(JSON.stringify(q),qBefore);assert.equal(JSON.stringify(cfg),cfgBefore);
  assert.ok(storageBytes(h.storage).every(([key])=>key.startsWith(h.g.HEWRSTieFeedback.PREFIX)),'Wear, favorites or preferences were written');
 });
 const noWatchQ=c.makeRequest(config('work',{topwear:{mode:'item',id:c.catalogue.suits[4].id},watch:{mode:'none'}}));
 const noWatch=await c.controller.generateAsync(noWatchQ,c.catalogue,[]),noWatchOriginal=plain(selected(noWatch.options.find(o=>selected(o).state==='T029')));
 const noWatchBan=h.ties.hide(h.g.structuredClone(noWatchOriginal),{scope:'shirt_tie',context:'all'});
 const noWatchReplacement=await replaceFrom(noWatch,noWatchQ,noWatchOriginal);
 check('An explicit no-watch choice remains null during tie replacement',()=>{
  assert.equal(noWatchReplacement.replacement.refill.added,1);
  const next=plain(selected(noWatchReplacement.replacement.options.at(-1)));
  assert.equal(next.watchId,null);assert.deepEqual(otherPieces(next),otherPieces(noWatchOriginal));assert.notEqual(next.state,noWatchOriginal.state);
 });
 h.ties.restore(noWatchBan.id);
 const anchoredQ=c.makeRequest(config('work',{topwear:{mode:'item',id:c.catalogue.suits[4].id},tie:{mode:'item',id:original.state}}));
 const anchored=await c.controller.generateAsync(anchoredQ,c.catalogue,[]),anchoredOriginal=plain(selected(anchored.options[0]));
 const anchoredBan=h.ties.hide(h.g.structuredClone(anchoredOriginal),{scope:'shirt_tie',context:'all'});
 const anchoredReplacement=await replaceFrom(anchored,anchoredQ,anchoredOriginal);
 check('An exact tie anchor is not relaxed to force a replacement',()=>{
  assert.equal(anchoredReplacement.replacement.options.length,anchoredReplacement.kept.length);
  assert.equal(anchoredReplacement.replacement.refill.added,0);
  assert.match(anchoredReplacement.replacement.reason,/original tie is an exact selection/);
 });
 h.ties.restore(anchoredBan.id);
 // Block every different tie with the original accepted pieces. These exact
 // clothing+shoe records preserve other shirts, shoes and original list rows.
 const currentBan=h.ties.hide(h.g.structuredClone(original),{scope:'shirt_tie',context:'all'});
 for(const tie of c.catalogue.ties)if(tie.id!==original.state)h.feedback.hide(h.g.structuredClone({...original,state:tie.id}),{scope:'outfit',context:'all',reason:'other'});
 const exhausted=await replaceFrom(initial,q,original);
 check('Exhaustion retains 19 and explains it without changing accepted pieces',()=>{
  assert.equal(exhausted.kept.length,19);assert.equal(exhausted.replacement.options.length,19);assert.equal(exhausted.replacement.refill.added,0);
  assert.match(exhausted.replacement.reason,/No compatible different tie/);
 });
 const beforeCancel=storageBytes(h.storage),keptBefore=exhausted.kept.map(o=>JSON.stringify(o));
 const cancelled=await c.controller.generateAsync(q,c.catalogue,[],{retainedOptions:exhausted.kept,replaceTieFor:original,isCancelled:()=>true});
 check('Cancelled tie replacement publishes nothing and changes no retained state',()=>{
  assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.options.length,0);
  assert.deepEqual(exhausted.kept.map(o=>JSON.stringify(o)),keptBefore);assert.deepEqual(storageBytes(h.storage),beforeCancel);
 });
 await assert.rejects(c.controller.generateAsync(q,c.catalogue,[],{retainedOptions:[],replaceTieFor:{...original,state:'NO_TIE'}}),/actual tie/);
 check('Open collars cannot be supplied as a rejected tie',()=>{});
 assert.equal(h.ties.snapshot().active.some(e=>e.id===currentBan.id),true);
 console.log('TIE-ONLY REPLACEMENT:',passed,'checks passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
