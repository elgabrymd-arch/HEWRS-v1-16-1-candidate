'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const Exposure=require('../src/tie-exposure.js');
function memory(){const records=new Map();return {records,get length(){return records.size;},key(i){return [...records.keys()][i]??null;},getItem(key){return records.get(String(key))??null;},setItem(key,value){records.set(String(key),String(value));}};}
const tied=(state,shirtId='DS001')=>({suitId:'S03',shirtId,state,shoeId:'shoe-1',watchId:null});
const now=()=> '2026-11-18T10:00:00.000Z';
const create=(storage,extra={})=>Exposure.create({storage,now,...extra});

test('fresh exposure starts empty and never interprets wear or rejection records',()=>{
 const storage=memory();storage.setItem('hewrs:connected-app:v1','{"events":[{"state":"T009"}]}');storage.setItem('hewrs:outfit-feedback:v1:event:x','retained rejection bytes');
 const before=[...storage.records],ledger=create(storage),snapshot=ledger.snapshot();
 assert.equal(snapshot.ok,true);assert.equal(snapshot.startedAt,null);assert.equal(snapshot.eventCount,0);assert.equal(ledger.count('T009','work',snapshot),0);
 ledger.commit('first',[tied('T001'),tied('T002')],{occasion:'Work'});
 for(const [key,value] of before)assert.equal(storage.getItem(key),value);
 assert.deepEqual(ledger.snapshot().counts.work,{T001:1,T002:1});assert.equal(ledger.snapshot().startedAt,now());
});

test('generation replay is idempotent after reload; new lists count each displayed row',()=>{
 const storage=memory(),ledger=create(storage),rows=[tied('T001'),tied('T001','DS002'),tied('T002'),tied('NO_TIE')];
 const first=ledger.commit('generation_1',rows,{occasion:'work'});assert.equal(first.recorded,true);
 assert.equal(create(storage).commit('generation_1',rows,{occasion:'WORK'}).recorded,false);
 for(let navigation=0;navigation<20;navigation++)assert.equal(ledger.snapshot().eventCount,1);
 assert.deepEqual(ledger.snapshot().counts.work,{T001:2,T002:1});
 ledger.commit('generation_2',rows,{occasion:'work'});assert.deepEqual(ledger.snapshot().counts.work,{T001:4,T002:2});
 assert.throws(()=>ledger.commit('generation_1',[tied('T003')],{occasion:'work'}),/Conflicting/);
 assert.deepEqual(ledger.snapshot().counts.work,{T001:4,T002:2});
});

test('refill records only caller-supplied new rows without re-counting retained options',()=>{
 const storage=memory(),ledger=create(storage);
 ledger.commit('initial',[tied('T001'),tied('T002'),tied('T003')],{occasion:'dinner'});
 ledger.commit('refill_1',[tied('T004')],{occasion:'dinner',kind:'refill'});
 assert.deepEqual(ledger.snapshot().counts.dinner,{T001:1,T002:1,T003:1,T004:1});
 assert.equal(ledger.snapshot().eventCount,2);
});

test('occasions remain independent and open-collar rows do not consume capacity',()=>{
 const storage=memory(),ledger=create(storage);
 ledger.commit('work',[tied('T003')],{occasion:'work'});ledger.commit('weekend',[tied('T003'),tied('T003')],{occasion:'Weekend'});
 const noTie=ledger.commit('open',[tied('NO_TIE')],{occasion:'dinner'}),empty=ledger.commit('empty',[],{occasion:'dinner',kind:'refill'});
 assert.equal(noTie.recorded,false);assert.equal(empty.recorded,false);assert.equal(ledger.snapshot().eventCount,2);
 assert.equal(ledger.count('T003','work'),1);assert.equal(ledger.count('T003',{occasion:'weekend'}),2);assert.equal(ledger.count('T003','dinner'),0);
 assert.throws(()=>ledger.commit('all',[tied('T003')],{occasion:'all'}),/occasion/);
});

test('independent tabs add immutable events without overwriting each other',()=>{
 const storage=memory(),tabA=create(storage),tabB=create(storage);tabA.snapshot();tabB.snapshot();
 tabA.commit('tab_a',[tied('T007')],{occasion:'work'});const firstBytes=storage.getItem(Exposure.prefix+'tab_a');
 tabB.commit('tab_b',[tied('T007'),tied('T008')],{occasion:'work'});
 assert.equal(storage.getItem(Exposure.prefix+'tab_a'),firstBytes);
 assert.deepEqual(tabA.snapshot().counts.work,{T007:2,T008:1});assert.deepEqual(create(storage).snapshot(),tabB.snapshot());
});

test('corrupt or unknown records fail closed for tracking and remain untouched',()=>{
 for(const bad of ['not JSON','null',JSON.stringify({schema:'future',id:'bad'})]){
  const storage=memory();storage.setItem(Exposure.prefix+'bad',bad);storage.setItem('hewrs:connected-app:v1','wear bytes');const ledger=create(storage);
  const snapshot=ledger.snapshot();assert.equal(snapshot.ok,false);assert.equal(snapshot.persistent,true);assert.ok(snapshot.error);assert.equal(snapshot.eventCount,null);
  assert.equal(ledger.count('T001','work',snapshot),0);assert.throws(()=>ledger.commit('new',[tied('T001')],{occasion:'work'}));
  assert.equal(storage.getItem(Exposure.prefix+'bad'),bad);assert.equal(storage.getItem('hewrs:connected-app:v1'),'wear bytes');assert.equal(storage.length,2);
 }
});

test('unavailable storage is reported without a fabricated ephemeral history',()=>{
 const ledger=Exposure.create();assert.equal(ledger.snapshot().ok,false);assert.equal(ledger.snapshot().persistent,false);
 assert.throws(()=>ledger.commit('new',[tied('T001')],{occasion:'work'}),/unavailable/);
 assert.equal(ledger.snapshot().eventCount,null);
});

test('quota failure and capacity limit preserve earlier exposure',()=>{
 const storage=memory(),ledger=create(storage,{maxEvents:1});ledger.commit('first',[tied('T001')],{occasion:'work'});
 const before=[...storage.records];assert.throws(()=>ledger.commit('second',[tied('T002')],{occasion:'work'}),/capacity/);assert.deepEqual([...storage.records],before);
 assert.equal(ledger.commit('first',[tied('T001')],{occasion:'work'}).recorded,false);
 const other=memory(),otherLedger=create(other);otherLedger.commit('saved',[tied('T003')],{occasion:'work'});const saved=[...other.records];
 other.setItem=()=>{throw Error('QuotaExceededError');};assert.throws(()=>otherLedger.commit('unsaved',[tied('T004')],{occasion:'work'}),/not saved.*Quota/);
 assert.deepEqual([...other.records],saved);assert.deepEqual(otherLedger.snapshot().counts.work,{T003:1});
});

test('invalid selections, conflicting fields, oversize batches and mutated records are rejected',()=>{
 const storage=memory(),ledger=create(storage);
 for(const rows of [[{}],[tied(null)],[tied('Tinvalid')],[{state:'T001',tie:'T002'}],Array.from({length:21},()=>tied('T001'))])assert.throws(()=>ledger.commit('bad',rows,{occasion:'work'}));
 assert.equal(storage.length,0);
 ledger.commit('good',[tied('T001')],{occasion:'work'});
 const key=Exposure.prefix+'good',event=JSON.parse(storage.getItem(key));event.ties.T001=-1;storage.setItem(key,JSON.stringify(event));
 assert.equal(ledger.snapshot().ok,false);assert.throws(()=>ledger.commit('other',[tied('T002')],{occasion:'work'}));
});

test('constructor accepts browser Storage directly and exposes unique injectable IDs',()=>{
 const storage=memory(),ledger=Exposure.create(storage,{now,id:()=> 'browser_generation'});
 assert.equal(ledger.newId(),'browser_generation');ledger.commit(ledger.newId(),[tied('T005')],{occasion:'dinner'});
 assert.equal(ledger.count('T005','dinner'),1);assert.equal(ledger.prefix,Exposure.prefix);
 const ids=Array.from({length:50},()=>Exposure.create(storage).newId());assert.equal(new Set(ids).size,50);
});
