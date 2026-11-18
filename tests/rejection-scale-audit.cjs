'use strict';
// Diagnostic only: uses the shipped feedback modules with synthetic storage.
// Does not change production source, migrate records, or access owner data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {performance} = require('node:perf_hooks');
const {load, root:repo} = require('./tie-engine-loader.cjs');
const F = require('../src/owner-feedback.js');
const T = require('../src/tie-feedback.js');
const coreSource = fs.readFileSync(path.join(repo, 'src/outfit-rejection-core.js'), 'utf8');
const appSource = fs.readFileSync(path.join(repo, 'src/outfit-refill-application.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const stamp = '2026-11-18T12:00:00.000Z';
const out = path.join(repo, 'evidence/tie_coverage_rejection_scale/rejection-scale.json');
const evidence = {schema:'hewrs.rejection-scale-audit.v1', synthetic:true, actual_owner_usage:false,
  runtime:process.version, platform:process.platform, measured_at:new Date().toISOString(),
  fixture_storage:'In-memory Storage-compatible Map with O(1) key(index), no quota and no disk IO.',
  limitations:['Timings include possible concurrent CPU work; not phone/browser latency measurements.',
    'Direct seeding isolates read/match/write cost at a given accumulated size; it is not 30,000 sequential UI clicks.',
    'Canonical selections are validated by the actual connection; fixture combinations are not claimed to be attractive or generated recommendations.',
    'UTF-8 serialized size and UTF-16 payload size are measured; browser-specific quota accounting is not simulated.'],
  source_sha256:Object.fromEntries(['src/owner-feedback.js','src/tie-feedback.js','src/outfit-rejection-core.js','src/outfit-refill-application.js','src/outfit-rejection-ui.js'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,p))).digest('hex')])),
  outfit:[], tie_history:[], checks:[]};
const save = () => {fs.mkdirSync(path.dirname(out), {recursive:true});fs.writeFileSync(out, JSON.stringify(evidence,null,2)+'\n');};
const check = (name, fn) => {const detail=fn();evidence.checks.push({name,passed:true,...(detail||{})});console.log('PASS',name);save();};
function storage(seed=[]) {
  const rows=new Map(seed), keys=[...rows.keys()];
  let calls={key:0,get:0,set:0,remove:0};
  return {rows, get length(){return rows.size;}, key(i){calls.key++;return keys[i]??null;},
    getItem(k){calls.get++;return rows.get(String(k))??null;},
    setItem(k,v){calls.set++;k=String(k);if(!rows.has(k))keys.push(k);rows.set(k,String(v));},
    removeItem(k){calls.remove++;k=String(k);if(rows.delete(k))keys.splice(keys.indexOf(k),1);},
    resetCalls(){calls={key:0,get:0,set:0,remove:0};},calls:()=>({...calls}),
    size(){let utf8=0,utf16=0;for(const[k,v]of rows){utf8+=Buffer.byteLength(k)+Buffer.byteLength(v);utf16+=2*(k.length+v.length);}return {keys:rows.size,utf8_payload_bytes:utf8,utf16_payload_bytes:utf16};}};
}
function measure(backend, operation) {
  backend.resetCalls();const start=performance.now(),value=operation();
  return {value, stats:{milliseconds:+(performance.now()-start).toFixed(3),storage_calls:backend.calls()}};
}
let serial=0, connection;
const validateSelection=s=>plain(connection.validateSelection(s));
const makeF=backend=>F.create({storage:backend,validateSelection,now:()=>stamp,id:()=>`audit_write_${++serial}`});
const makeT=backend=>T.create({storage:backend,feedback:F,validateSelection,now:()=>stamp,id:()=>`tie_audit_write_${++serial}`});
function gateHarness(backend, suppliedBase=null) {
  const base=suppliedBase||makeF(backend);base.refresh();
  const c={validateSelection,ownerFeedback:{set(value){this.gate=value;}},controller:{generate:()=>({options:[]}),generateAsync:async()=>({options:[]})}};
  const app={ownerFeedback:base,ownerFeedbackPersistent:true,connection:c,state:()=>({preferences:{},context:{occasion:'work'}})};
  const root={Image:class Image{},localStorage:backend,crypto:crypto.webcrypto,HEWRSOutfitFeedback:F,HEWRSTieFeedback:T,HEWRSApp:app};
  new Function('globalThis',coreSource)(root);
  return {base,gate:root.HEWRSRejectionPreviewCore.attach(app),app};
}
function fixtureSelections(count) {
  const selected=[], pairs=[], seenPairs=new Set();
  const suits=[...connection.limits.suits].sort((a,b)=>(a==='S03'?-1:b==='S03'?1:a.localeCompare(b)));
  const shirts=Object.keys(connection.records).sort(), ties=connection.catalogue.ties.map(x=>x.id).sort();
  const shoes=connection.catalogue.shoes.filter(x=>!x.disabled).map(x=>x.id).slice(0,5);
  outer:for(const suitId of suits)for(const shirtId of shirts)for(const state of ties){
    const basis={suitId,shirtId,state,shoeId:shoes[0],watchId:null};
    try{validateSelection(basis);}catch{continue;}
    if(!F.ownerRuleCheck(basis,{context:{occasion:'work'}}).allowed)continue;
    if(suitId==='S01'&&shirtId==='DS029'&&state==='T024')continue;
    const pair=shirtId+'|'+state;
    if(!seenPairs.has(pair)){seenPairs.add(pair);pairs.push(basis);}
    for(const shoeId of shoes){const selection={...basis,shoeId};validateSelection(selection);selected.push(selection);if(selected.length===count)break outer;}
  }
  assert.equal(selected.length,count);assert.equal(new Set(selected.map(s=>F.key(s))).size,count);
  // Gather additional unique valid pairs independently of the outfit fixture limit.
  for(const shirtId of shirts)for(const state of ties){
    const selection={suitId:'S03',shirtId,state,shoeId:shoes[0],watchId:null},pair=shirtId+'|'+state;
    if(seenPairs.has(pair))continue;
    try{validateSelection(selection);}catch{continue;}
    seenPairs.add(pair);pairs.push(selection);
  }
  return {selected,pairs};
}
function outfitEvents(selections) {
  return selections.map((selection,i)=>({schema:F.SCHEMA,id:'audit_'+String(i).padStart(6,'0'),at:stamp,type:'hide',actor:'owner',selection,scope:'outfit',occasion:'all',reason:null}));
}
function tieEvents(count,pairs) {
  const active=Math.min(count,1000), events=[];
  for(let i=0;i<active;i++)events.push({schema:T.SCHEMA,id:'tie_active_'+String(i).padStart(6,'0'),at:stamp,type:'hide',actor:'owner',selection:pairs[i],scope:'shirt_tie',occasion:'all',reason:null,note:''});
  for(let i=0;i<(count-active)/2;i++){
    const id='tie_past_'+String(i).padStart(6,'0');
    events.push({schema:T.SCHEMA,id,at:stamp,type:'hide',actor:'owner',selection:pairs[active+(i%(pairs.length-active))],scope:'shirt_tie',occasion:'all',reason:null,note:''});
    events.push({schema:T.SCHEMA,id:'tie_undo_'+String(i).padStart(6,'0'),at:stamp,type:'restore',target:id});
  }
  assert.equal(events.length,count);return {events,active};
}
function bytes(doc){return {compact_json_bytes:Buffer.byteLength(JSON.stringify(doc)),pretty_json_bytes:Buffer.byteLength(JSON.stringify(doc,null,2))};}
function benchmarkOutfit(count,all) {
  console.log('CASE outfit',count);
  const events=all.slice(0,count), backend=storage(events.map(e=>[F.PREFIX+e.id,JSON.stringify(e)])), ledger=makeF(backend);
  const row={events:count,distinct_active_rejections:count,storage:backend.size(),operations:{}};
  let m=measure(backend,()=>ledger.refresh());row.operations.refresh=m.stats;
  assert.equal(m.value.active.length,count);row.token_utf8_bytes=Buffer.byteLength(m.value.token);
  m=measure(backend,()=>ledger.snapshot());row.operations.cached_snapshot_clone=m.stats;
  m=measure(backend,()=>ledger.token());row.operations.cached_token=m.stats;
  m=measure(backend,()=>ledger.match(events[0].selection,{occasion:'work'}));row.operations.match_oldest=m.stats;assert.equal(m.value.allowed,false);
  m=measure(backend,()=>{for(let i=0;i<20;i++)assert.equal(ledger.match(events[i%count].selection,{occasion:'work'}).allowed,false);});row.operations.match_twenty=m.stats;
  m=measure(backend,()=>ledger.exportData());row.operations.export=m.stats;const doc=m.value;row.backup=bytes(doc);
  const targetBackend=storage(),target=makeF(targetBackend);m=measure(targetBackend,()=>{try{target.importData(doc);return {accepted:true};}catch(e){return {accepted:false,error:e.message};}});row.operations.import={...m.stats,...m.value};
  assert.equal(m.value.accepted,count<=20000);
  m=measure(backend,()=>ledger.hide(events[0].selection,{scope:'outfit',context:'all'}));row.operations.hide_duplicate=m.stats;assert.equal(m.value.id,events[0].id);assert.equal(backend.length,count);
  m=measure(backend,()=>ledger.hide(all[count].selection,{scope:'outfit',context:'all'}));row.operations.hide_new=m.stats;assert.equal(backend.length,count+1);
  const reopened=makeF(backend);reopened.refresh();assert.equal(reopened.match(events[0].selection,'work').allowed,false);assert.equal(reopened.match(events.at(-1).selection,'work').allowed,false);
  m=measure(backend,()=>reopened.restore(events[0].id));row.operations.restore_oldest=m.stats;assert.equal(m.value,true);assert.equal(backend.length,count+2);
  assert.equal(reopened.match(events[0].selection,'work').allowed,true);assert.equal(reopened.match(events.at(-1).selection,'work').allowed,false);
  assert.equal(backend.getItem(F.PREFIX+events[0].id),JSON.stringify(events[0]));
  row.verified={oldest_and_latest_rejected_after_reopen:true,duplicate_writes_no_event:true,append_at_capacity_preserves_oldest:true,undo_appends_without_deleting_original:true};
  evidence.outfit.push(row);save();console.log('RESULT outfit',count,JSON.stringify(row.operations));
}
function benchmarkTie(count,pairs) {
  console.log('CASE tie-history',count);
  const fixture=tieEvents(count,pairs),backend=storage(fixture.events.map(e=>[T.PREFIX+e.id,JSON.stringify(e)])),ledger=makeT(backend);
  const row={events:count,distinct_active_rejections:fixture.active,restored_hide_events:(count-fixture.active)/2,storage:backend.size(),operations:{}};
  let m=measure(backend,()=>ledger.refresh());row.operations.refresh=m.stats;assert.equal(m.value.active.length,fixture.active);row.token_utf8_bytes=Buffer.byteLength(m.value.token);
  m=measure(backend,()=>ledger.match(pairs[0],{occasion:'work'}));row.operations.match_oldest=m.stats;assert.equal(m.value.allowed,false);
  m=measure(backend,()=>{for(let i=0;i<20;i++)assert.equal(ledger.match(pairs[i%fixture.active],'work').allowed,false);});row.operations.match_twenty=m.stats;
  m=measure(backend,()=>ledger.exportData());row.operations.export=m.stats;row.backup=bytes(m.value);
  const doc=m.value,targetBackend=storage(),target=makeT(targetBackend);
  m=measure(targetBackend,()=>{try{target.importData(doc);return {accepted:true};}catch(e){return {accepted:false,error:e.message};}});row.operations.import={...m.stats,...m.value};assert.equal(m.value.accepted,count<=20000);
  m=measure(backend,()=>ledger.hide(pairs[0],{scope:'shirt_tie',context:'all'}));row.operations.hide_duplicate=m.stats;assert.equal(backend.length,count);
  m=measure(backend,()=>ledger.hide(pairs[fixture.active],{scope:'shirt_tie',context:'all'}));row.operations.hide_new=m.stats;assert.equal(backend.length,count+1);
  const reopened=makeT(backend);assert.equal(reopened.match(pairs[0],'weekend').allowed,false);
  m=measure(backend,()=>reopened.restore(fixture.events[0].id));row.operations.restore_oldest=m.stats;assert.equal(reopened.match(pairs[0],'work').allowed,true);
  row.verified={oldest_rejected_after_reopen:true,duplicate_writes_no_event:true,append_at_capacity_preserves_oldest:true,undo_appends_without_deleting_original:true};
  evidence.tie_history.push(row);save();console.log('RESULT tie-history',count,JSON.stringify(row.operations));
}
async function main(){
  console.log('Loading actual connection and validating synthetic fixture');
  connection=load().connection;
  const {selected,pairs}=fixtureSelections(30002), all=outfitEvents(selected);
  if(process.argv.includes('--write-browser-fixture')||process.argv.includes('--fixture-only')){
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(path.join(path.dirname(out),'rejection-scale-browser-fixture.json'),JSON.stringify({schema:F.EXPORT,exported_at:stamp,events:all}));
    console.log('Browser fixture saved: 30,002 canonical distinct outfit exclusions.');
  }
  if(process.argv.includes('--fixture-only'))return;
  evidence.fixture={canonical_outfit_selections:selected.length,distinct_valid_shirt_tie_pairs:pairs.length,watch_id:null,selection_validation:'Actual HEWRSCleanConnection.validateSelection; no score-generation claim.'};save();
  for(const count of [30,100,1000,30000])benchmarkOutfit(count,all);
  for(const count of [30,100,1000,30000])benchmarkTie(count,pairs);
  check('Outfit import limit is per document, not accumulated ledger size',()=>{
    const backend=storage(),ledger=makeF(backend),a=performance.now();
    ledger.importData({schema:F.EXPORT,events:all.slice(0,20000)});
    ledger.importData({schema:F.EXPORT,events:all.slice(20000,30000)});
    assert.equal(ledger.snapshot().active.length,30000);
    assert.equal(ledger.allowed(all[0].selection,'work'),false);assert.equal(ledger.allowed(all[29999].selection,'work'),false);
    return {events:30000,chunk_sizes:[20000,10000],milliseconds:+(performance.now()-a).toFixed(3)};
  });
  check('Merged gate refuses further import once its existing outfit backup exceeds 20,000 events',()=>{
    const backend=storage(all.slice(0,30000).map(e=>[F.PREFIX+e.id,JSON.stringify(e)]));
    const {gate}=gateHarness(backend),before=backend.length;let error;
    try{gate.importData({schema:F.EXPORT,events:[all[30000]]});}catch(e){error=e.message;}
    assert.match(error,/Unsupported feedback backup/);assert.equal(backend.length,before);
    return {existing_events:before,incoming_events:1,error};
  });
  check('Actual startup fallback permits a previously rejected outfit when another outfit record is corrupt',()=>{
    const backend=storage([[F.PREFIX+all[0].id,JSON.stringify(all[0])],[F.PREFIX+'corrupt','{broken']]);
    const prefix=appSource.slice(appSource.indexOf('function memoryStorage(){'),appSource.indexOf('connection.ownerFeedback.set(ownerFeedback);'));
    assert.ok(prefix.includes('catch{ownerFeedbackPersistent=false;'));
    const result=new Function('root','backend','connection',prefix+'\nreturn {ownerFeedback,ownerFeedbackPersistent};')({HEWRSOutfitFeedback:F},backend,{validateSelection});
    assert.equal(result.ownerFeedbackPersistent,false);assert.equal(result.ownerFeedback.snapshot().active.length,0);
    assert.equal(result.ownerFeedback.allowed(all[0].selection,'work'),true);
    assert.equal(backend.getItem(F.PREFIX+all[0].id),JSON.stringify(all[0]));assert.equal(backend.getItem(F.PREFIX+'corrupt'),'{broken');
    const {gate}=gateHarness(backend,result.ownerFeedback);assert.equal(gate.allowed(all[0].selection,'work'),true);
    return {executed_code:'Exact startup initialization slice, plus actual shared gate attach; no DOM/render execution.',persistent:false,active_enforced:0,original_keys_retained:2,previously_rejected_allowed:true};
  });
  check('Corrupt tie feedback fails closed and preserves every stored byte',()=>{
    const event=tieEvents(30,pairs).events[0],backend=storage([[T.PREFIX+event.id,JSON.stringify(event)],[T.PREFIX+'tie_corrupt','{broken']]);
    const ledger=makeT(backend);assert.throws(()=>ledger.match(event.selection,'work'),/Unreadable tie rejection/);
    assert.equal(backend.getItem(T.PREFIX+event.id),JSON.stringify(event));assert.equal(backend.getItem(T.PREFIX+'tie_corrupt'),'{broken');
    return {error:'Unreadable tie rejection record. Existing records were retained.',original_keys_retained:2};
  });
  check('30,000-record backup exceeds current UI file-size gate even with compact serialization',()=>{
    const doc={schema:F.EXPORT,exported_at:stamp,events:all.slice(0,30000)},sizes=bytes(doc),max=5*1024*1024;
    assert.ok(sizes.compact_json_bytes>max);assert.ok(sizes.pretty_json_bytes>max);
    const ui=fs.readFileSync(path.join(repo,'src/outfit-rejection-ui.js'),'utf8');assert.ok(ui.includes('picked.size>5*1024*1024'));
    return {...sizes,ui_max_bytes:max};
  });
}
const start=Date.now();
main().catch(error=>{evidence.error=error.stack;process.exitCode=1;console.error(error);}).finally(()=>{evidence.duration_seconds=(Date.now()-start)/1000;evidence.complete=!evidence.error;if(!process.argv.includes('--fixture-only'))save();console.log('AUDIT',process.argv.includes('--fixture-only')?'fixture-only':evidence.complete?'complete':'failed',out);});
