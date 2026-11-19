'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test');
const {IDBFactory,IDBObjectStore}=require('fake-indexeddb');
const Exposure=require('../src/tie-exposure.js');
const imageSource=fs.readFileSync(path.join(__dirname,'../feedback-candidate/reviewed/image-assessment-store.js'),'utf8');
function memory(){const rows=new Map();return{rows,interleave:null,get length(){return rows.size;},key:i=>[...rows.keys()][i]??null,getItem(key){const value=rows.get(key)??null;if(this.interleave&&key===Exposure.prefix+'tab_a'){const fn=this.interleave;this.interleave=null;fn();}return value;},setItem:(key,value)=>rows.set(key,String(value))};}
function imageStores(){const indexedDB=new IDBFactory(),make=()=>{const root={indexedDB};new Function('globalThis',imageSource)(root);return root.HEWRSImageAssessmentStore;};return[make(),make()];}
function batch(id,outfit='outfit_'+id){return{value:{schema:'synthetic_image_audit',cases:[{id,outfit}]},verified:{bundle_sha256:id,accepted:[{outfit_key:outfit,review_id:id}]}};}
test('overlapping tie exposure appends preserve both successful immutable events',()=>{
 const backend=memory(),one=Exposure.create({storage:backend}),two=Exposure.create({storage:backend});let peerResult;
 backend.interleave=()=>{peerResult=two.commit('tab_b',[{state:'T029'},{state:'T009'}],{occasion:'work'});};
 const result=one.commit('tab_a',[{state:'T029'}],{occasion:'work'});
 assert.equal(result.recorded,true);assert.equal(peerResult.recorded,true);assert.equal(backend.rows.size,2);
 assert.deepEqual(one.snapshot().counts.work,{T029:2,T009:1});assert.equal(two.snapshot().eventCount,2);
 const bytes=[...backend.rows];assert.equal(one.commit('tab_a',[{state:'T029'}],{occasion:'work'}).recorded,false);assert.deepEqual([...backend.rows],bytes);
});
test('concurrent image assessment transactions retain both distinct successful batches',async()=>{
 const [one,two]=imageStores(),a=batch('a'.repeat(64)),b=batch('b'.repeat(64));
 const result=await Promise.all([one.insert(a.value,a.verified),two.insert(b.value,b.verified)]);assert.ok(result.every(x=>x.status==='saved'));
 const rows=await one.list();assert.equal(rows.length,2);for(const original of [a,b])assert.deepEqual(rows.find(x=>x.id===original.verified.bundle_sha256).bundle,original.value);
});
test('concurrent conflicting image assessments refuse the second transaction without replacing the first',async()=>{
 const [one,two]=imageStores(),a=batch('c'.repeat(64),'same_exact_outfit'),b=batch('d'.repeat(64),'same_exact_outfit');
 const result=await Promise.allSettled([one.insert(a.value,a.verified),two.insert(b.value,b.verified)]);
 assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(result.filter(x=>x.status==='rejected').length,1);
 assert.match(result.find(x=>x.status==='rejected').reason.message,/already exists/);
 const rows=await one.list();assert.equal(rows.length,1);const saved=result[0].status==='fulfilled'?a:b;assert.deepEqual(rows[0].bundle,saved.value);
});
test('concurrent identical image batches are idempotent and withdrawal is limited to the named batch',async()=>{
 const [one,two]=imageStores(),a=batch('e'.repeat(64)),b=batch('f'.repeat(64));
 const result=await Promise.all([one.insert(a.value,a.verified),two.insert(a.value,a.verified)]);
 assert.deepEqual(result.map(x=>x.status).sort(),['already_saved','saved']);await one.insert(b.value,b.verified);await two.withdraw(a.verified.bundle_sha256);
 const rows=await one.list();assert.equal(rows.length,1);assert.deepEqual(rows[0].bundle,b.value);
});
test('aborted image assessment append reports failure and retains all previously committed records',async()=>{
 const [one,two]=imageStores(),a=batch('1'.repeat(64)),b=batch('2'.repeat(64));await one.insert(a.value,a.verified);const before=await one.list(),original=IDBObjectStore.prototype.add;
 IDBObjectStore.prototype.add=function(...args){const request=original.apply(this,args);if(this.name==='batches')this.transaction.abort();return request;};
 try{await assert.rejects(two.insert(b.value,b.verified),/save failed/);}finally{IDBObjectStore.prototype.add=original;}
 assert.deepEqual(await one.list(),before);await two.insert(b.value,b.verified);assert.equal((await one.list()).length,2);
});
