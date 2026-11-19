'use strict';
// Real IndexedDB API semantics under fake-indexeddb. Native Chromium/WebKit
// integration remains a separate gate; these fixtures are not owner usage.
const test=require('node:test'),assert=require('node:assert/strict');
const {indexedDB,IDBKeyRange,IDBObjectStore}=require('fake-indexeddb');
const D=require('../src/rejection-database.js'),F=require('../src/owner-feedback.js'),T=require('../src/tie-feedback.js');
let serial=0;
const A={suitId:'S18',shirtId:'DS001',state:'T019',shoeId:'shoe-3',watchId:'watch-AP09'};
const B={...A,shirtId:'DS002',state:'T020'};
const C={...A,suitId:'S10',shirtId:'DS036',state:'NO_TIE',shoeId:'shoe-11'};
function storage(){const rows=new Map();let reads=0;return{rows,get reads(){return reads},get length(){return rows.size},key:i=>[...rows.keys()][i]??null,getItem(k){reads++;return rows.get(k)??null;},setItem:(k,v)=>rows.set(String(k),String(v)),removeItem:k=>rows.delete(k),clear:()=>rows.clear()};}
function create(legacy=storage(),extra={}){const databaseName='test-rejection-database-'+(++serial);return D.create({indexedDB,keyRange:IDBKeyRange,legacyStorage:legacy,feedback:F,tieFeedback:T,databaseName,broadcastChannel:null,...extra});}
function event(id,selection=A,scope='clothing',occasion='all'){return{schema:F.SCHEMA,id,at:'2026-11-18T12:00:00Z',type:'hide',actor:'owner',selection:{...selection},scope,occasion,reason:'other',note:'Original note'};}
function tieEvent(id,selection=A,scope='tie',occasion='all'){return{...event(id,selection,scope,occasion),schema:T.SCHEMA};}
const outfit=events=>({schema:F.EXPORT,events});
const ties=events=>({schema:T.EXPORT,events});
const combined=(a,b)=>({schema:T.BUNDLE_EXPORT,outfit_feedback:outfit(a),tie_feedback:ties(b)});
function raw(dbName,mode,fn){return new Promise((resolve,reject)=>{const open=indexedDB.open(dbName);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction(['events','active','meta'],mode);let result;try{result=fn(tx);}catch(e){tx.abort();db.close();reject(e);return;}tx.oncomplete=()=>{db.close();resolve(result?.result??result)};tx.onabort=()=>{db.close();reject(tx.error)};};});}
function bytes(legacy){return [...legacy.rows].sort(([a],[b])=>a.localeCompare(b));}
function seed(legacy,events){for(const e of events)legacy.setItem((e.schema===T.SCHEMA?T.PREFIX:F.PREFIX)+e.id,JSON.stringify(e));}
function preference(comparisons){return{schema:'hewrs.outfit-preferences.v1',source_lock:'a'.repeat(64),revision:2,enabled:true,comparisons};}
function comparison(id,vote,a=A,b=B,partition='training',occasion='work'){return{id,vote,a:{...a},b:{...b},partition,reason:'Original reason',created_at:'2026-11-18T12:00:00Z',context:{occasion,requiredFormality:'any'}};}

test('boot facade blocks unchecked work, then becomes a persistent immutable cache',async()=>{
 const legacy=storage(),db=create(legacy);assert.throws(()=>db.refresh(),/loading/);assert.throws(()=>db.allowed(A),/loading/);await db.ready;
 assert.equal(db.status().ready,true);assert.equal(db.storageKind,'indexeddb');assert.equal(db.status().persistent,true);
 const h=await db.hide(A);assert.equal(db.allowed(A),false);const first=db.snapshot();assert(Object.isFrozen(first));assert(Object.isFrozen(first.active));assert(Object.isFrozen(first.active[0].selection));assert.throws(()=>{first.active[0].selection.state='NO_TIE'},TypeError);
 await db.restore(h.id);assert.equal(db.allowed(A),true);assert.equal(first.active.length,1);assert.equal(first.active[0].selection.state,'T019');db.close();
});

test('migration commits both namespaces and preserves original bytes, IDs, notes and undo',async()=>{
 const legacy=storage(),a=event('legacy-a'),b=event('legacy-b',B),t=tieEvent('tie_legacy',B),restore={schema:F.SCHEMA,id:'undo-b',at:'2026-11-18T12:00:01Z',type:'restore',target:b.id};seed(legacy,[a,b,t,restore]);
 const original=bytes(legacy),db=create(legacy);await db.ready;assert.deepEqual(bytes(legacy),original);assert.equal(db.snapshot().events.length,4);assert.equal(db.snapshot().active.length,2);assert.equal(db.status().migratedLegacyCount,4);
 assert.equal(db.allowed(A),false);assert.equal(db.allowed({...B,suitId:'S02'}),false);await db.restore(t.id);assert.equal(db.allowed(B),true);assert.deepEqual(bytes(legacy),original);
 const name=db.status().databaseName;db.close();const reopened=create(legacy,{databaseName:name});await reopened.ready;assert.equal(reopened.status().migratedLegacyCount,0);assert.equal(reopened.snapshot().active.length,1);assert.equal(reopened.allowed(A),false);assert.deepEqual(bytes(legacy),original);reopened.close();
});

test('all four rejection scopes, occasion aliases, static rules and historical votes retain their old meanings',async()=>{
 const legacy=storage(),f=F.create({storage:legacy}),t=T.create({storage:legacy,feedback:F});
 const events=[event('outfit-a',A,'outfit','work'),event('clothing-b',B,'clothing','dinner'),event('alias-legacy',C,'outfit','clinic')];
 f.importData(outfit(events));t.importData(ties([tieEvent('tie_pair',{...B,state:'T021'},'shirt_tie','weekend')]));
 f.importPreferences(preference([comparison('neither','neither',{...C,shirtId:'DS003'},{...C,shirtId:'DS004'},'validation'),comparison('rank','A',{...C,shirtId:'DS005'},{...C,shirtId:'DS006'})]));
 const db=create(legacy);await db.ready;
 const selections=[A,{...A,watchId:'watch-P02'},{...A,shoeId:'shoe-5'},B,{...B,shoeId:'shoe-5'},{...B,state:'T021'},{...B,state:'NO_TIE'},C,{...C,shirtId:'DS003'},{...C,shirtId:'DS003',watchId:'watch-P02'},{...C,shirtId:'DS004'},{...C,shirtId:'DS005'},{...C,shirtId:'DS006'},{suitId:'S01',shirtId:'DS029',state:'T024',shoeId:'shoe-3',watchId:'watch-AP09'}];
 for(const occasion of ['work','dinner','weekend','all'])for(const s of selections){const expected=f.match(s,{occasion}).allowed&&t.match(s,{occasion}).allowed;assert.equal(db.allowed(s,{occasion}),expected,JSON.stringify({s,occasion}));}
 const rows=[{s:{...C,shirtId:'DS006'}},{s:{...C,shirtId:'DS005'}},{s:C}];assert.deepEqual(db.reorder(rows,x=>x.s,{occasion:'work'}),f.reorder(rows,x=>x.s,{occasion:'work'}));db.close();
});

test('duplicate imported hides remain separately undoable; new hide deduplicates without losing earlier bans',async()=>{
 const db=create();await db.ready;await db.importData(outfit([event('copy-one'),event('copy-two')]));assert.equal(db.snapshot().active.length,2);const result=await db.hide(A,{scope:'clothing'});assert(['copy-one','copy-two'].includes(result.id));assert.equal(db.snapshot().events.length,2);
 await db.restore('copy-one');assert.equal(db.allowed(A),false);await db.restore('copy-two');assert.equal(db.allowed(A),true);
 await db.importData(outfit([event('copy-three')]));assert.equal(db.allowed(A),false);await db.restore('copy-three');assert.equal(db.allowed(A),true);db.close();
});

test('malformed legacy data fails closed and exact-byte repair can recover on the same facade',async()=>{
 const legacy=storage(),good=event('original');seed(legacy,[good]);legacy.setItem(F.PREFIX+'bad','{broken');const before=bytes(legacy),db=create(legacy);await assert.rejects(db.ready,/Unreadable legacy/);assert.throws(()=>db.allowed(A),/Unreadable legacy/);assert.deepEqual(bytes(legacy),before);
 legacy.removeItem(F.PREFIX+'bad');await db.retry();assert.equal(db.allowed(A),false);assert.equal(legacy.getItem(F.PREFIX+'original'),JSON.stringify(good));db.close();
});

test('cross-namespace IDs, missing undo targets and foreign namespaces fail before migration writes',async()=>{
 for(const entries of [[event('tie_same'),tieEvent('tie_same')],[{schema:F.SCHEMA,id:'bad-undo',at:'2026-11-18T12:00:00Z',type:'restore',target:'missing'}]]){
  const legacy=storage();seed(legacy,entries);const db=create(legacy);await assert.rejects(db.ready,/conflicting|Undo target/);assert.equal(await raw(db.status().databaseName,'readonly',tx=>tx.objectStore('events').count()),0);db.close();
 }
 const legacy=storage();legacy.setItem(F.PREFIX+'tie_foreign',JSON.stringify(tieEvent('tie_foreign')));const db=create(legacy);await assert.rejects(db.ready,/namespace mismatch/);assert.equal(await raw(db.status().databaseName,'readonly',tx=>tx.objectStore('events').count()),0);db.close();
});

test('combined import validates both logs atomically and preserves earlier records on conflict',async()=>{
 const db=create();await db.ready;await db.importData(outfit([event('existing')]));const before=await db.exportData();
 await assert.rejects(db.importData(combined([event('new')],[{...tieEvent('tie_bad'),scope:'unknown'}])),/scope/);assert.deepEqual((await db.exportData()).outfit_feedback.events,before.outfit_feedback.events);
 await assert.rejects(db.importData(outfit([{...event('existing'),reason:'colors'}])),/Conflicting/);assert.equal(db.snapshot().events.length,1);assert.equal(db.allowed(A),false);
 await assert.rejects(db.importData(outfit([{schema:F.SCHEMA,id:'orphan',at:'2026-11-18T12:00:00Z',type:'restore',target:'missing'}])),/Undo target/);assert.equal(db.snapshot().events.length,1);db.close();
});

test('native transaction abort rolls back events, active index, metadata and cache',async()=>{
 const db=create();await db.ready;await db.hide(A,{scope:'clothing'});const before=db.snapshot(),revision=db.status().revision;
 const original=IDBObjectStore.prototype.add;let hit=false;
 IDBObjectStore.prototype.add=function(...args){const request=Reflect.apply(original,this,args);if(this.name==='events'&&!hit){hit=true;this.transaction.abort();}return request;};
 try{await assert.rejects(db.importData(combined([event('abort-new',B)],[tieEvent('tie_abort-new',B)])),/did not complete/);}finally{IDBObjectStore.prototype.add=original;}
 assert(hit);await db.sync();assert.equal(db.status().revision,revision);assert.deepEqual(db.snapshot().events,before.events);assert.equal(db.allowed(A),false);assert.equal(db.allowed(B),true);
 assert.equal(await raw(db.status().databaseName,'readonly',tx=>tx.objectStore('events').count()),1);assert.equal(await raw(db.status().databaseName,'readonly',tx=>tx.objectStore('active').count()),1);db.close();
});

test('concurrent instances preserve both writes, deduplicate simultaneous hides and reject stale publication',async()=>{
 const legacy=storage(),one=create(legacy);await one.ready;const two=create(legacy,{databaseName:one.status().databaseName});await two.ready;
 const oldToken=one.token();await Promise.all([one.hide(A,{scope:'clothing'}),two.hide(B,{scope:'clothing'})]);await Promise.all([one.sync(),two.sync()]);assert.equal(one.snapshot().active.length,2);assert.equal(two.snapshot().active.length,2);
 let published=false;await assert.rejects(one.withCurrent(oldToken,()=>{published=true}),/changed/);assert.equal(published,false);
 const [a,b]=await Promise.all([one.hide(C,{scope:'clothing'}),two.hide(C,{scope:'clothing'})]);assert.equal(a.id,b.id);await one.sync();assert.equal(one.snapshot().active.length,3);
 await one.withCurrent(one.token(),()=>{published=true;return 12});assert.equal(published,true);await assert.rejects(one.withCurrent(one.token(),async()=>true),/synchronous/);one.close();two.close();
});

test('same-tab legacy writes invalidate synchronously and migrate without changing original bytes',async()=>{
 const legacy=storage(),db=create(legacy);await db.ready;const before=db.token(),later=event('old-client');legacy.setItem(F.PREFIX+later.id,JSON.stringify(later));assert.throws(()=>db.allowed(A),/changed|loading/);await db.sync();assert.equal(db.allowed(A),false);assert.notEqual(db.token(),before);assert.equal(legacy.getItem(F.PREFIX+later.id),JSON.stringify(later));
 legacy.setItem(F.PREFIX+'broken','{bad');await assert.rejects(db.sync(),/Unreadable legacy/);assert.throws(()=>db.allowed(B),/Unreadable legacy/);legacy.removeItem(F.PREFIX+'broken');await db.retry();assert.equal(db.allowed(A),false);db.close();
});

test('migration reconciles a legacy event written while its first transaction is committing',async()=>{
 const legacy=storage(),first=event('migration-first'),second=event('migration-second',B);seed(legacy,[first]);const original=IDBObjectStore.prototype.add;let hit=false;
 IDBObjectStore.prototype.add=function(...args){const request=Reflect.apply(original,this,args);if(this.name==='events'&&!hit){hit=true;legacy.setItem(F.PREFIX+second.id,JSON.stringify(second));}return request;};
 const db=create(legacy);try{await db.ready;}finally{IDBObjectStore.prototype.add=original;}
 assert(hit);assert.equal(db.snapshot().active.length,2);assert.equal(db.allowed(A),false);assert.equal(db.allowed(B),false);assert.equal(db.status().migratedLegacyCount,2);assert.equal(legacy.rows.size,2);db.close();
});

test('database tampering is rejected on reload and leaves unreadable records intact',async()=>{
 const legacy=storage(),db=create(legacy);await db.ready;const hidden=await db.hide(A);const name=db.status().databaseName;db.close();
 await raw(name,'readwrite',tx=>tx.objectStore('events').put({id:hidden.id,revision:2,event:{...hidden,scope:'unknown'}}));
 const reopened=create(legacy,{databaseName:name});await assert.rejects(reopened.ready,/scope/);assert.throws(()=>reopened.allowed(A),/scope/);assert.equal(await raw(name,'readonly',tx=>tx.objectStore('events').count()),1);reopened.close();
});

test('simultaneous first opens converge on one committed migration epoch',async()=>{
 const legacy=storage();seed(legacy,[event('parallel-legacy')]);const name='parallel-first-'+(++serial),one=create(legacy,{databaseName:name}),two=create(legacy,{databaseName:name});
 await Promise.all([one.ready,two.ready]);assert.equal(one.token(),two.token());assert.equal(one.allowed(A),false);assert.equal(two.allowed(A),false);assert.equal(one.snapshot().active.length,1);one.close();two.close();
});

test('missing metadata or a damaged active index cannot replace existing records with an empty cache',async()=>{
 for(const damage of ['metadata','index']){
  const legacy=storage(),db=create(legacy);await db.ready;const saved=await db.hide(A);const name=db.status().databaseName;db.close();
  await raw(name,'readwrite',tx=>damage==='metadata'?tx.objectStore('meta').delete('state'):tx.objectStore('active').delete(saved.id));
  const again=create(legacy,{databaseName:name});await assert.rejects(again.ready,/metadata is missing|active index/);assert.throws(()=>again.allowed(A),/metadata is missing|active index/);assert.equal(await raw(name,'readonly',tx=>tx.objectStore('events').count()),1);again.close();
 }
});

test('30,000 active exclusions plus undo/history round-trip, retain earliest bans and require no scans per match',async()=>{
 const legacy=storage(),db=create(legacy);await db.ready;const events=[];
 for(let i=0;i<30000;i++){const suit=2+Math.floor(i/(50*47)),shirt=1+Math.floor(i/47)%50,tie=1+i%47;events.push(event('scale_'+String(i).padStart(6,'0'),{suitId:'S'+String(suit).padStart(2,'0'),shirtId:'DS'+String(shirt).padStart(3,'0'),state:'T'+String(tie).padStart(3,'0'),shoeId:'shoe-3',watchId:'watch-AP09'}));}
 const start=performance.now();await db.importData(outfit(events));const imported=performance.now()-start;
 assert.equal(db.snapshot().active.length,30000);const counts=db.diagnostics(),reads=legacy.reads;
 const matching=performance.now();for(let i=0;i<1000;i++)assert.equal(db.allowed(events[i%events.length].selection),false);const elapsed=performance.now()-matching;
 assert.equal(db.diagnostics().eventRowsRead,counts.eventRowsRead);assert.equal(db.diagnostics().legacyKeyReads,counts.legacyKeyReads);assert.equal(legacy.reads,reads);assert(db.token().length<200);
 const oldSnapshot=db.snapshot();await db.restore(events[100].id);assert.equal(db.snapshot().active.length,29999);assert.equal(oldSnapshot.active.length,30000);assert.equal(db.allowed(events[0].selection),false);assert.equal(db.allowed(events[29999].selection),false);
 await db.hide(C,{scope:'clothing'});assert.equal(db.snapshot().active.length,30000);const backup=await db.exportData();assert.equal(backup.outfit_feedback.events.length,30002);assert(JSON.stringify(backup).length>5*1024*1024);
 const restored=create();await restored.ready;await restored.importData(backup);assert.equal(restored.snapshot().active.length,30000);assert.equal(restored.snapshot().events.length,30002);assert.equal(restored.allowed(events[0].selection),false);assert.equal(restored.allowed(events[29999].selection),false);assert.equal(restored.allowed(events[100].selection),true);
 await restored.importData(backup);assert.equal(restored.snapshot().events.length,30002);const extra=event('after-large-import',{...C,shirtId:'DS007'});await restored.importData(outfit([extra]));assert.equal(restored.snapshot().active.length,30001);
 console.log(JSON.stringify({fixture:'30,000 active exclusions',import_ms:Math.round(imported),cached_1000_matches_ms:Math.round(elapsed),serialized_bytes:Buffer.byteLength(JSON.stringify(backup)),token_characters:db.token().length,disk_reads_during_matches:0}));db.close();restored.close();
});
