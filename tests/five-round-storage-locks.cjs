'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),vm=require('node:vm');
const LOCK='a'.repeat(64),selection={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:null},other={...selection,shirtId:'DS007'};
const connection={validateSelection:s=>structuredClone(s),historyIds:s=>({topwear:s.suitId,shirt:s.shirtId,tie:s.state,shoes:s.shoeId,watch:s.watchId,pants:null}),hybrid:{researchPreference:{describeSelection:()=>({eligible:true,vector:Array(12).fill(.5)})}}};
function lockManager(){const pending=new Map(),calls=[];return{calls,request(name,options,callback){calls.push({name,options});const result=(pending.get(name)||Promise.resolve()).then(callback);pending.set(name,result.catch(()=>{}));return result;}};}
function fixture({locks=lockManager(),memoryOnly=false}={}){
  const root=vm.createContext({structuredClone,Date,navigator:locks?{locks}:{},HEWRSSourceCorrections:{revision:'audit'},HEWRSStyleOccasions:{known:()=>true,occasion:x=>x}});
  for(const file of ['src/local-state.js','src/favorites-state.js','src/outfit-learning.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),root,{filename:file});
  const records=new Map(),writes=[],backend=memoryOnly?null:{getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);writes.push(k);}};
  return{root,locks,records,writes,backend,create:kind=>kind==='wear'?root.HEWRSLocalState.create(connection,LOCK,backend):kind==='favorites'?root.HEWRSFavorites.create(connection,LOCK,backend):root.HEWRSOutfitLearning.create(connection,LOCK,backend)};
}
function add(kind,store,id,s=selection){
  if(kind==='favorites')return store.add(s,{id:'favorite_'+id,created_at:'2026-11-19T01:00:00.000Z'});
  if(kind==='learning')return store.add({id:'pref_'+id,created_at:'2026-11-19T01:00:00.000Z',a:structuredClone(s),b:{...s,state:'T009'},vote:'A',reason:'no_reason',partition:'training',pilot_id:null,context:{occasion:'work',requiredFormality:'any'},source_revision:'audit'},store.read().token);
  return store.addEvent({id,localDate:'2026-11-19',date:'2026-11-19',confirmed:true,origin:'manual',controlledRepetition:false,canonical_selection:structuredClone(s),source_lock:LOCK,
    items:Object.fromEntries(Object.entries(connection.historyIds(s)).map(([role,id])=>[role,id===null?null:{id}]))});
}
const items=(kind,store)=>kind==='wear'?store.snapshot().events:kind==='favorites'?store.snapshot().items:store.snapshot().comparisons;
const refresh=(kind,store)=>kind==='wear'?store.readForGeneration():kind==='favorites'?store.refresh():store.read();
for(const kind of ['wear','favorites','learning']){
  test(kind+' queued tabs cannot both claim a stale write; fresh retry retains both records',async()=>{
    const h=fixture(),a=h.create(kind),b=h.create(kind);
    const results=await Promise.allSettled([a.exclusive(()=>add(kind,a,'tab_a')),b.exclusive(()=>add(kind,b,'tab_b',other))]);
    assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');assert.match(results[1].reason.message,/changed|another tab/);
    assert.equal(items(kind,h.create(kind)).length,1);refresh(kind,b);await b.exclusive(()=>add(kind,b,'tab_b',other));
    assert.equal(items(kind,h.create(kind)).length,2);assert.ok(h.locks.calls.every(call=>call.name===a.key&&call.options.mode==='exclusive'));
  });
  test(kind+' refresh during lock wait cannot authorize the originally stale action',async()=>{
    const h=fixture(),a=h.create(kind),b=h.create(kind);let release;const held=h.locks.request(a.key,{mode:'exclusive'},()=>new Promise(resolve=>{release=resolve;}));
    await Promise.resolve();let called=false;const waiting=a.exclusive(()=>{called=true;return add(kind,a,'stale');});
    // An older page can still use the retained synchronous API. Its durable
    // change must be detected after the new app's lock eventually arrives.
    add(kind,b,'older_page',other);refresh(kind,a);release();await held;
    await assert.rejects(waiting,/changed|another tab/);assert.equal(called,false);assert.equal(items(kind,h.create(kind)).length,1);
  });
  test(kind+' persistent writes fail explicitly without a browser lock, but reads and export work',async()=>{
    const h=fixture({locks:null}),a=h.create(kind);let called=false;
    assert.equal(a.status().writeLockAvailable,false);await assert.rejects(a.exclusive(()=>{called=true;return add(kind,a,'blocked');}),/Web Locks/);
    assert.equal(called,false);assert.equal(h.writes.length,0);assert.ok(a.exportText().includes('source_lock'));
  });
  test(kind+' memory-only mode uses a local queue without requiring browser locks',async()=>{
    const h=fixture({locks:null,memoryOnly:true}),a=h.create(kind);assert.equal(a.status().writeLockAvailable,true);
    await a.exclusive(()=>add(kind,a,'first'));await a.exclusive(()=>add(kind,a,'second',other));
    assert.equal(items(kind,a).length,2);assert.equal(a.status().persistent,false);
  });
  test(kind+' callback failure releases the lock without installing a phantom save',async()=>{
    const h=fixture(),a=h.create(kind);await assert.rejects(a.exclusive(()=>{throw Error('cancelled action');}),/cancelled/);
    assert.equal(h.writes.length,0);await a.exclusive(()=>add(kind,a,'after_error'));assert.equal(items(kind,a).length,1);
  });
}
test('Wear, Favorites and learning acquire different lock namespaces without schema changes',async()=>{
  const h=fixture(),wear=h.create('wear'),favorites=h.create('favorites'),learning=h.create('learning');assert.equal(new Set([wear.key,favorites.key,learning.key]).size,3);
  await Promise.all([wear.exclusive(()=>add('wear',wear,'wear')),favorites.exclusive(()=>add('favorites',favorites,'favorite')),learning.exclusive(()=>add('learning',learning,'learning'))]);
  assert.deepEqual(new Set(h.locks.calls.map(call=>call.name)),new Set([wear.key,favorites.key,learning.key]));
  assert.equal(JSON.parse(h.records.get(wear.key)).schema,'hewrs.connected-app.local.v1');assert.equal(JSON.parse(h.records.get(favorites.key)).schema,'hewrs.connected-app.favorites.v1');assert.equal(JSON.parse(h.records.get(learning.key)).schema,'hewrs.outfit-preferences.v1');
});
