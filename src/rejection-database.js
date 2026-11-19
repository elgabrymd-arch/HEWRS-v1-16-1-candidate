/* Persistent outfit/tie rejection database. Legacy event meanings and bytes are
 * retained. IndexedDB commits events, active indexes and revision atomically;
 * synchronous engine reads use only the validated, immutable memory view. */
(function(root,factory){'use strict';const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.HEWRSRejectionDatabase=api;})(globalThis,function(root){
'use strict';
const SCHEMA='hewrs.rejection-database.v1',DEFAULT_NAME='hewrs-rejections-v2',VERSION=1;
const need=(value,message)=>{if(!value)throw Error(message);};
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const clone=value=>structuredClone(value);
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const part of Object.values(value))freeze(part);Object.freeze(value);}return value;}
function randomId(){return root.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);}
// One observer per Storage prototype also detects same-tab legacy writes. It
// watches only the two feedback prefixes; wear/Favorites and all bytes are left
// untouched. A WeakMap avoids retaining closed page storage objects.
const watched=new WeakMap(),patched=new WeakSet();
function watchLegacy(storage,prefixes,callback){
 if(!storage||typeof storage!=='object')return()=>{};
 let listeners=watched.get(storage);if(!listeners){listeners=new Set();watched.set(storage,listeners);}const entry={prefixes,callback};listeners.add(entry);
 const candidate=root.Storage&&storage instanceof root.Storage?root.Storage.prototype:storage;
 if(!patched.has(candidate)){
  const native={};for(const name of ['setItem','removeItem','clear'])native[name]=candidate[name];
  try{
   for(const name of ['setItem','removeItem','clear'])if(typeof native[name]==='function'){
    Object.defineProperty(candidate,name,{configurable:true,writable:true,value:function(...args){
     const result=Reflect.apply(native[name],this,args),rows=watched.get(this);
     if(rows)for(const row of [...rows])if(name==='clear'||row.prefixes.some(p=>String(args[0]).startsWith(p)))row.callback();
     return result;
    }});
   }
   patched.add(candidate);
  }catch(_){/* A frozen test adapter uses explicit forceLegacy reads instead. */}
 }
 return()=>listeners.delete(entry);
}
function create({indexedDB=root.indexedDB,keyRange=root.IDBKeyRange,legacyStorage=null,
 feedback=root.HEWRSOutfitFeedback,tieFeedback=root.HEWRSTieFeedback,
 validateSelection=null,now=()=>new Date().toISOString(),id=randomId,
 databaseName=DEFAULT_NAME,onBlocked=null,broadcastChannel=root.BroadcastChannel}={}){
 const F=feedback,T=tieFeedback;
 need(F?.normal&&F?.occasion&&F?.stable&&F?.ownerRuleCheck&&T?.key,'Original rejection validators are required.');
 const prefixes=Object.freeze([F.PREFIX,T.PREFIX]);
 const policy=F.ownerBatch?.().revision||F.revision||'original';
 const listeners=new Set(),rawLegacy=new Map();
 let database=null,opening=null,model=null,view=null,blocked='Saved rejections are loading.',stale=true,loading=true,disposed=false;
 let legacyDirty=true,legacyEpoch=0,queue=Promise.resolve(),channel=null,everReady=false,migratedLegacyCount=0,lastWriteError=null;
 const stats={metaReads:0,eventRowsRead:0,legacyScans:0,legacyKeyReads:0,matchCalls:0,committedTransactions:0,abortedTransactions:0};
 function stateKey(){return [blocked,stale,loading,model?.meta?.epoch,model?.meta?.revision,everReady].join('|');}
 let announced=stateKey();
 function notify(){const next=stateKey();if(next===announced)return;announced=next;for(const fn of [...listeners])try{fn();}catch(_){}}
 function fail(error){const e=error instanceof Error?error:Error(String(error));blocked=e.message;stale=true;loading=false;try{onBlocked?.(e);}catch(_){}notify();return e;}
 function invalidate(message='Saved rejections changed. Check them before continuing.'){
  if(disposed)return;const changed=!stale;stale=true;
  if(changed){try{onBlocked?.(Error(message));}catch(_){}notify();}
 }
 function scheduleSync(){Promise.resolve().then(()=>sync()).catch(()=>{});}
 function legacyChanged(){legacyDirty=true;legacyEpoch++;invalidate();scheduleSync();}
 const stopWatching=watchLegacy(legacyStorage,prefixes,legacyChanged);
 function storageEvent(event){if(event.storageArea&&event.storageArea!==legacyStorage)return;if(event.key===null||prefixes.some(p=>event.key?.startsWith(p)))legacyChanged();}
 root.addEventListener?.('storage',storageEvent);
 if(typeof broadcastChannel==='function')try{
  channel=new broadcastChannel(SCHEMA+':'+databaseName);
  channel.onmessage=event=>{if(!plain(event.data)||event.data.schema!==SCHEMA)return;if(!model||event.data.epoch!==model.meta.epoch||event.data.revision>model.meta.revision){invalidate();scheduleSync();}};
  channel.unref?.();
 }catch(_){}
 function enqueue(fn){const work=queue.then(()=>{need(!disposed,'The rejection database was closed.');return fn();});queue=work.catch(()=>{});return work;}
 function open(){
  if(database)return Promise.resolve(database);if(opening)return opening;
  opening=new Promise((resolve,reject)=>{
   if(!indexedDB||typeof indexedDB.open!=='function'){reject(Error('IndexedDB is unavailable. Saved rejections cannot be checked.'));return;}
   let request,settled=false;
   try{request=indexedDB.open(databaseName,VERSION);}catch(error){reject(error);return;}
   request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains('events')){const events=db.createObjectStore('events',{keyPath:'id'});events.createIndex('revision','revision',{unique:false});}
    if(!db.objectStoreNames.contains('active')){const active=db.createObjectStore('active',{keyPath:'id'});active.createIndex('scope_occasion_key',['scope','occasion','key'],{unique:false});}
    if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
   };
   request.onerror=()=>{if(!settled){settled=true;reject(request.error||Error('Could not open saved rejections.'));}};
   request.onblocked=()=>{if(!settled){settled=true;reject(Error('The rejection database is open in an older tab. Close that tab and retry.'));}};
   request.onsuccess=()=>{
    const db=request.result;if(settled||disposed){db.close();if(!settled)reject(Error('The rejection database was closed.'));return;}settled=true;database=db;
    db.onversionchange=()=>{db.close();if(database===db)database=null;fail(Error('The rejection database changed version. Reopen this tab before continuing.'));};
    db.onclose=()=>{if(database===db){database=null;fail(Error('The rejection database connection closed. Retry the rejection check.'));}};
    resolve(db);
   };
  }).finally(()=>{opening=null;});return opening;
 }
 function canonical(value){const result=F.normal(value);validateSelection?.(result);return result;}
 function scopeKey(selection,scope){return T.isScope(scope)?T.key(selection,scope):F.key(selection,scope);}
 const lookup=(scope,occasion,key)=>scope+'\n'+occasion+'\n'+key;
 function validateEvent(event){
  need(plain(event)&&typeof event.at==='string'&&Number.isFinite(Date.parse(event.at)),'Invalid rejection event. Existing records were retained.');
  if(event.schema===F.SCHEMA){
   need(typeof event.id==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(event.id),'Invalid rejection event ID.');
   need(['hide','restore','preferences','withdraw_preferences'].includes(event.type),'Unknown feedback action. Existing records were retained.');
   if(event.type==='hide'){
    need(event.actor==='owner','A rejection must be an explicit owner action.');F.normal(event.selection);validateSelection?.(event.selection);
    need(['outfit','clothing'].includes(event.scope),'Unknown rejection scope.');F.occasion(event.occasion);
    need([null,'colors','patterns','formality','footwear','other'].includes(event.reason),'Unknown reason; not inferred.');
   }else if(event.type==='restore'||event.type==='withdraw_preferences')need(typeof event.target==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(event.target),'Invalid undo target.');
   else F.validatePreference(event.payload,validateSelection);
  }else{
   need(event.schema===T.SCHEMA&&typeof event.id==='string'&&/^tie_[A-Za-z0-9_-]{1,145}$/.test(event.id),'Invalid tie feedback event. Existing records were retained.');
   if(event.type==='hide'){
    need(event.actor==='owner'&&T.isScope(event.scope),'Unknown tie rejection action or scope.');const selected=canonical(event.selection);
    need(F.stable(selected)===F.stable(event.selection),'Tie feedback must retain an exact canonical outfit.');T.key(selected,event.scope);
    need(['all','work','dinner','weekend'].includes(event.occasion),'Unknown tie rejection occasion.');
    need([null,'colors','patterns','formality','footwear','other'].includes(event.reason),'Unknown tie rejection reason.');
    need(typeof event.note==='string'&&event.note.length<=500,'Tie rejection details must fit within 500 characters.');
    need(Object.keys(event).every(k=>['schema','id','at','type','actor','selection','scope','occasion','reason','note'].includes(k)),'Unknown tie rejection fields.');
   }else{
    need(event.type==='restore'&&typeof event.target==='string'&&/^tie_[A-Za-z0-9_-]{1,145}$/.test(event.target),'Unknown tie feedback action or undo target.');
    need(Object.keys(event).every(k=>['schema','id','at','type','target'].includes(k)),'Unknown tie undo fields.');
   }
  }
  return event;
 }
 function newMeta(){return {key:'state',schema:SCHEMA,epoch:randomId(),revision:0,eventCount:0,activeCount:0,migration:null};}
 function validateMeta(meta){need(plain(meta)&&meta.key==='state'&&meta.schema===SCHEMA&&typeof meta.epoch==='string'&&meta.epoch.length>0&&Number.isSafeInteger(meta.revision)&&meta.revision>=0&&Number.isSafeInteger(meta.eventCount)&&meta.eventCount>=0&&Number.isSafeInteger(meta.activeCount)&&meta.activeCount>=0,'Unreadable rejection database metadata. Existing records were retained.');return meta;}
 function empty(meta){return {meta,byId:new Map(),stable:new Map(),active:new Map(),restored:new Set(),withdrawn:new Set(),index:new Map(),imports:new Map(),historical:new Map(),neither:new Map(),preferences:[]};}
 function activeRecord(event){return {id:event.id,scope:event.scope,occasion:event.occasion,key:scopeKey(event.selection,event.scope)};}
 function combine(base,input){
  const additions=[],seen=new Map();
  for(const value of input){validateEvent(value);const serialized=F.stable(value),old=base.byId.get(value.id),inBatch=seen.get(value.id);
   need(!old||base.stable.get(value.id)===serialized,'Conflicting rejection event ID. Nothing was overwritten.');
   need(!inBatch||inBatch.serialized===serialized,'Conflicting duplicate rejection event ID. Nothing was overwritten.');
   if(!old&&!inBatch){const event=freeze(clone(value));seen.set(event.id,{event,serialized});additions.push(event);}
  }
  if(!additions.length)return {next:base,additions,affected:new Set()};
  const next={...base,byId:new Map(base.byId),stable:new Map(base.stable),active:new Map(base.active),restored:new Set(base.restored),withdrawn:new Set(base.withdrawn),index:new Map(base.index),imports:new Map(base.imports)};
  for(const event of additions){next.byId.set(event.id,event);next.stable.set(event.id,seen.get(event.id).serialized);}
  const affected=new Set();let historyChanged=false;
  for(const event of additions){
   if(event.type==='restore'||event.type==='withdraw_preferences'){
    const target=next.byId.get(event.target),expected=event.type==='restore'?'hide':'preferences';
    need(target?.type===expected&&target.schema===event.schema,'Undo target is missing or belongs to another feedback log. Import the complete backup.');
    if(event.type==='restore'){next.restored.add(event.target);affected.add(event.target);}else{next.withdrawn.add(event.target);historyChanged=true;}
   }
   if(event.type==='hide')affected.add(event.id);
   if(event.type==='preferences')historyChanged=true;
  }
  const changedBuckets=new Set();
  function bucket(k){if(!changedBuckets.has(k)||!next.index.has(k)){next.index.set(k,new Set(next.index.get(k)||[]));changedBuckets.add(k);}return next.index.get(k);}
  for(const target of affected){
   const prior=base.active.get(target);if(prior){const k=lookup(prior.scope,prior.occasion,scopeKey(prior.selection,prior.scope));bucket(k).delete(target);if(!next.index.get(k).size)next.index.delete(k);}
   next.active.delete(target);const event=next.byId.get(target);
   if(event?.type==='hide'&&!next.restored.has(target)){next.active.set(target,event);bucket(lookup(event.scope,event.occasion,scopeKey(event.selection,event.scope))).add(target);}
  }
  if(historyChanged){
   next.imports=new Map([...next.byId.values()].filter(e=>e.type==='preferences'&&!next.withdrawn.has(e.id)).sort((a,b)=>a.id.localeCompare(b.id)).map(e=>[e.id,e]));
   next.historical=new Map();next.neither=new Map();next.preferences=[];
   for(const event of next.imports.values())for(const record of event.payload.comparisons){const old=next.historical.get(record.id);need(!old||F.stable(old)===F.stable(record),'Conflicting original vote. Neither version was overwritten.');next.historical.set(record.id,record);}
   for(const record of next.historical.values()){
    const occasion=F.occasion(record.context.occasion);
    if(record.vote==='neither')for(const selection of [record.a,record.b]){const k=lookup('historical_exact',occasion,F.key(selection,'historical_exact'));if(!next.neither.has(k))next.neither.set(k,new Map());next.neither.get(k).set(record.id,record);}
    if(record.partition==='training'&&['A','B'].includes(record.vote))next.preferences.push({occasion,winner:F.key(record.vote==='A'?record.a:record.b,'historical_exact'),loser:F.key(record.vote==='A'?record.b:record.a,'historical_exact')});
   }
  }
  return {next,additions,affected};
 }
 function tokenOf(meta){return SCHEMA+':'+meta.epoch+':'+meta.revision+':'+policy;}
 function snapshotOf(value){return Object.freeze({events:Object.freeze([...value.byId.values()]),active:Object.freeze([...value.active.values()]),active_imports:Object.freeze([...value.imports.values()]),historical:Object.freeze([...value.historical.values()]),token:tokenOf(value.meta),persistent:true,revision:value.meta.revision,migratedLegacyCount,legacyEventCount:value.meta.migration?.legacyEventCount||0});}
 function accept(next){const changed=!view||view.token!==tokenOf(next.meta)||view.migratedLegacyCount!==migratedLegacyCount;model=next;if(changed)view=snapshotOf(next);blocked=null;stale=false;loading=false;everReady=true;lastWriteError=null;notify();return view;}
 function read(){need(!disposed,'The rejection database was closed.');need(!blocked&&!stale&&!loading&&view,blocked||'Saved rejections changed or are still loading. Retry the rejection check.');return view;}
 function transaction(mode,body){
  return new Promise((resolve,reject)=>{
   let tx,result,failure=null;
   try{tx=database.transaction(['events','active','meta'],mode);}catch(error){reject(error);return;}
   const failTx=error=>{if(!failure)failure=error instanceof Error?error:Error(String(error));try{tx.abort();}catch(_){reject(failure);}};
   const guarded=fn=>event=>{try{fn(event);}catch(error){failTx(error);}};
   tx.onerror=()=>{};
   tx.onabort=()=>{stats.abortedTransactions++;reject(failure||tx.error||Error('The rejection transaction aborted. Nothing was saved.'));};
   tx.oncomplete=()=>resolve(result);
   try{body(tx,value=>{result=value;},failTx,guarded);}catch(error){failTx(error);}
  });
 }
 function loadWithin(tx,base,done,failTx,guarded){
  stats.metaReads++;const request=tx.objectStore('meta').get('state');
  request.onsuccess=guarded(()=>{
   const state=request.result;
   if(!state){
    need(!everReady&&!base?.meta?.revision,'The saved rejection database was reset. Restore a complete backup before continuing.');
    const eventsCount=tx.objectStore('events').count(),activeCount=tx.objectStore('active').count();let completed=0;
    const confirmEmpty=guarded(()=>{if(++completed<2)return;need(eventsCount.result===0&&activeCount.result===0,'Rejection metadata is missing while saved records remain. Existing records were retained.');done(empty(newMeta()),true);});
    eventsCount.onsuccess=confirmEmpty;activeCount.onsuccess=confirmEmpty;return;
   }
   validateMeta(state);
   // A second tab can finish the first migration after this tab observed a
   // completely empty database. Its provisional epoch was never committed.
   if(base&&base.meta.revision===0&&!base.meta.migration&&!everReady)base=null;
   if(base){need(state.epoch===base.meta.epoch,'The saved rejection database was replaced. Reopen and verify its backup before continuing.');need(state.revision>=base.meta.revision,'The rejection database revision moved backwards.');}
   if(base&&state.revision===base.meta.revision){need(state.eventCount===base.byId.size&&state.activeCount===base.active.size,'Rejection database counts do not match its validated revision.');done({...base,meta:state},false);return;}
   const replace=!base,events=tx.objectStore('events'),lower=!replace&&keyRange?.lowerBound?keyRange.lowerBound(base.meta.revision,true):null;
   const rowsRequest=replace?events.getAll():events.index('revision').getAll(lower);
   rowsRequest.onsuccess=guarded(()=>{
    const rows=rowsRequest.result.filter(row=>replace||row.revision>base.meta.revision);stats.eventRowsRead+=rows.length;
    for(const row of rows)need(plain(row)&&row.id===row.event?.id&&Number.isSafeInteger(row.revision)&&row.revision>0&&row.revision<=state.revision,'Unreadable rejection database event. Existing records were retained.');
    const next=combine(replace?empty(state):base,rows.map(row=>row.event)).next;next.meta=state;
    need(next.byId.size===state.eventCount&&next.active.size===state.activeCount,'Rejection database records do not match the saved revision. Existing records were retained.');
    if(!replace){done(next,false);return;}
    const activeRequest=tx.objectStore('active').getAll();
    activeRequest.onsuccess=guarded(()=>{
     need(activeRequest.result.length===next.active.size,'The rejection database active index is incomplete.');
     for(const row of activeRequest.result){const event=next.active.get(row.id);need(event&&F.stable(row)===F.stable(activeRecord(event)),'The rejection database active index is inconsistent.');}
     done(next,false);
    });
   });
  });
 }
 async function readDurable(){return transaction('readonly',(tx,finish,abort,guard)=>loadWithin(tx,model,next=>finish(next),abort,guard));}
 async function commit(input,{migration=null}={}){
  return transaction('readwrite',(tx,finish,abort,guard)=>loadWithin(tx,model,(base,isNew)=>{
   const proposed=typeof input==='function'?input(base):{events:input};
   const merged=combine(base,proposed.events||[]),next=merged.next;
   const needsMigration=!!migration&&(isNew||!base.meta.migration||merged.additions.length>0);
   if(!merged.additions.length&&!needsMigration){finish({model:base,result:proposed.result,added:0,changed:false});return;}
   const revision=base.meta.revision+1;need(Number.isSafeInteger(revision),'The rejection revision cannot be incremented safely.');
   next.meta={...base.meta,revision,eventCount:next.byId.size,activeCount:next.active.size};
   if(needsMigration)next.meta.migration={version:1,at:now(),revision,legacyEventCount:migration.count};
   const events=tx.objectStore('events'),active=tx.objectStore('active');
   for(const event of merged.additions)events.add({id:event.id,revision,event});
   for(const target of merged.affected){const event=next.active.get(target);if(event)active.put(activeRecord(event));else active.delete(target);}
   tx.objectStore('meta').put(next.meta);
   finish({model:next,result:proposed.result,added:merged.additions.length,changed:true});
  },abort,guard));
 }
 function scanLegacy(){
  stats.legacyScans++;need(legacyStorage&&typeof legacyStorage.getItem==='function'&&typeof legacyStorage.key==='function','Legacy rejection storage is unavailable. Existing rejections cannot be verified.');
  const found=new Map(),ids=new Map();
  for(let i=0;i<legacyStorage.length;i++){
   const key=legacyStorage.key(i);if(!prefixes.some(prefix=>key?.startsWith(prefix)))continue;
   let raw,event;stats.legacyKeyReads++;
   try{raw=legacyStorage.getItem(key);need(typeof raw==='string','Missing rejection bytes.');const prior=rawLegacy.get(key);event=prior?.raw===raw?prior.event:JSON.parse(raw);}catch(_){throw Error('Unreadable legacy rejection record. Existing data were not cleared.');}
   validateEvent(event);const prefix=event.schema===F.SCHEMA?F.PREFIX:T.PREFIX;
   need(key===prefix+event.id,'Rejection storage key or namespace mismatch. Existing records were retained.');
   need(!ids.has(event.id),'Outfit and tie feedback have conflicting event IDs. Existing records were retained.');ids.set(event.id,event);
   found.set(key,{raw,event});
  }
  return found;
 }
 function sameLegacy(a,b){if(a.size!==b.size)return false;for(const [key,row]of a)if(b.get(key)?.raw!==row.raw)return false;return true;}
 async function syncInternal({forceLegacy=false}={}){
  if(!model||stale||blocked){loading=true;notify();}
  try{
   await open();let next=await readDurable();
   if(model&&next.meta.revision!==model.meta.revision){invalidate();loading=true;notify();}
   model=next;
   if(legacyDirty||forceLegacy||!next.meta.migration){
    let stable=false;
    for(let attempt=0;attempt<5;attempt++){
     const epoch=legacyEpoch,first=scanLegacy(),result=await commit([...first.values()].map(row=>row.event),{migration:{count:first.size}});
     model=result.model;if(result.changed){stats.committedTransactions++;migratedLegacyCount+=result.added;}
     const second=scanLegacy();
     if(epoch===legacyEpoch&&sameLegacy(first,second)){
      rawLegacy.clear();for(const [key,row]of second)rawLegacy.set(key,{raw:row.raw,event:freeze(clone(row.event))});legacyDirty=false;stable=true;break;
     }
    }
    need(stable,'An older tab kept changing rejection history during migration. Close that tab and retry.');
   }
   // Read once more after migration to include a transaction from another tab
   // that committed while the legacy snapshot was being verified.
   next=await readDurable();return accept(next);
  }catch(error){throw fail(error);}
 }
 function sync(options={}){return enqueue(()=>syncInternal(options));}
 function retry(){return sync({forceLegacy:true});}
 function publishRevision(){try{channel?.postMessage({schema:SCHEMA,epoch:model.meta.epoch,revision:model.meta.revision});}catch(_){} }
 async function mutate(propose){
  return enqueue(async()=>{
   await syncInternal();
   let result;
   try{result=await commit(propose);}catch(error){lastWriteError=error.message;throw Error('Rejection save/import did not complete: '+error.message+' Existing records were retained.');}
   if(result.changed)stats.committedTransactions++;
   accept(result.model);if(result.changed)publishRevision();return result;
  });
 }
 function choices(options={}){
  const scope=options.scope||'outfit';need(['outfit','clothing'].includes(scope)||T.isScope(scope),'Choose a listed rejection scope.');
  const occasion=F.occasion(typeof options.context==='object'?options.context.occasion:options.context||'all'),reason=options.reason||null,note=String(options.note||'').trim();
  need([null,'colors','patterns','formality','footwear','other'].includes(reason),'Choose a listed reason.');need(note.length<=500,'Keep the reason within 500 characters.');return{scope,occasion,reason,note};
 }
 function makeId(tie=false){const value=String(id());return tie?(value.startsWith('tie_')?value:'tie_'+value):value;}
 async function hide(selection,options={}){
  const selected=canonical(selection),value=choices(options),key=scopeKey(selected,value.scope),tie=T.isScope(value.scope);
  const event={schema:tie?T.SCHEMA:F.SCHEMA,id:makeId(tie),at:now(),type:'hide',actor:'owner',selection:selected,...value};validateEvent(event);
  const result=await mutate(base=>{
   const existing=base.index.get(lookup(value.scope,value.occasion,key));if(existing?.size)return {events:[],result:clone(base.active.get(existing.values().next().value))};
   return{events:[event],result:clone(event)};
  });return result.result;
 }
 async function restore(target){
  need(typeof target==='string','Unknown hidden outfit.');
  const result=await mutate(base=>{const event=base.byId.get(target);need(event?.type==='hide','Unknown hidden outfit.');if(!base.active.has(target))return{events:[],result:false};
   return{events:[{schema:event.schema,id:makeId(event.schema===T.SCHEMA),at:now(),type:'restore',target}],result:true};
  });return result.result;
 }
 function unpack(document){
  need(plain(document),'Unsupported feedback backup.');const documents=document.schema===T.BUNDLE_EXPORT?[document.outfit_feedback,document.tie_feedback]:[document];
  if(document.schema===T.BUNDLE_EXPORT)need(documents[0]?.schema===F.EXPORT&&documents[1]?.schema===T.EXPORT,'Unsupported combined feedback backup.');
  const events=[];
  for(const part of documents){need(plain(part)&&[F.EXPORT,T.EXPORT].includes(part.schema)&&Array.isArray(part.events),'Unsupported feedback backup.');const schema=part.schema===F.EXPORT?F.SCHEMA:T.SCHEMA;
   for(const event of part.events){need(event?.schema===schema,'A backup contains an event from another feedback namespace.');validateEvent(event);events.push(event);}}
  return events;
 }
 async function importData(document){const events=unpack(clone(document));await mutate(()=>({events}));return read();}
 async function exportData(){await sync();const rows=read().events;return{schema:T.BUNDLE_EXPORT,exported_at:now(),outfit_feedback:{schema:F.EXPORT,exported_at:now(),events:clone(rows.filter(e=>e.schema===F.SCHEMA))},tie_feedback:{schema:T.EXPORT,exported_at:now(),events:clone(rows.filter(e=>e.schema===T.SCHEMA))}};}
 async function importPreferences(document){const payload=F.validatePreference(clone(document),validateSelection),serialized=F.stable(payload);const result=await mutate(base=>{
  if([...base.imports.values()].some(event=>F.stable(event.payload)===serialized))return{events:[],result:false};
  return{events:[{schema:F.SCHEMA,id:makeId(),at:now(),type:'preferences',payload}],result:true};
 });return result.result;}
 async function withdrawPreferences(target){const result=await mutate(base=>{need(base.byId.get(target)?.type==='preferences','Unknown preference import.');if(!base.imports.has(target))return{events:[],result:false};return{events:[{schema:F.SCHEMA,id:makeId(),at:now(),type:'withdraw_preferences',target}],result:true};});return result.result;}
 function match(selection,context={}){
  read();stats.matchCalls++;const selected=F.normal(selection),occasion=F.occasion(typeof context==='string'?context:context.occasion),why=F.ownerRuleCheck(selected,{context}).reasons;
  if(selected.suitId==='S01'&&selected.shirtId==='DS029'&&selected.state==='T024')why.push({type:'owner_core',id:'S01_DS029_T024',reason:null,scope:'clothing',occasion:'all'});
  for(const scope of ['outfit','clothing','tie','shirt_tie','topwear_tie']){
   if(T.isScope(scope)&&!T.canMatch(selected,scope))continue;const key=scopeKey(selected,scope);
   for(const occ of occasion==='all'?['all']:['all',occasion])for(const target of model.index.get(lookup(scope,occ,key))||[]){const event=model.active.get(target);why.push({type:'hide',id:event.id,reason:event.reason,scope:event.scope,occasion:event.occasion});}
  }
  for(const record of model.neither.get(lookup('historical_exact',occasion,F.key(selected,'historical_exact')))?.values()||[])why.push({type:'historical_neither',id:record.id,reason:null,scope:'historical_exact',occasion,partition:record.partition});
  return{allowed:why.length===0,reasons:why};
 }
 function reorder(rows,getSelection,context){
  read();const occasion=F.occasion(typeof context==='string'?context:context?.occasion),arr=rows.filter(row=>match(getSelection(row),context).allowed),keys=arr.map(row=>F.key(getSelection(row),'historical_exact')),index=new Map(keys.map((key,i)=>[key,i])),edges=new Set();
  for(const edge of model.preferences){if(edge.occasion!==occasion)continue;const winner=index.get(edge.winner),loser=index.get(edge.loser);if(winner!==undefined&&loser!==undefined&&winner!==loser)edges.add(winner+'>'+loser);}
  const result=[],pending=new Set(arr.map((_,i)=>i));while(pending.size){const first=[...pending].find(i=>![...edges].some(edge=>{const[a,b]=edge.split('>').map(Number);return b===i&&pending.has(a);}));if(first===undefined){result.push(...[...pending].map(i=>arr[i]));break;}result.push(arr[first]);pending.delete(first);}return result;
 }
 function assertCurrent(token){need(read().token===token,'Saved rejections changed during generation or rendering. No unchecked result was accepted.');return true;}
 function withCurrent(token,callback){return enqueue(async()=>{
  need(typeof callback==='function'&&!['AsyncFunction','AsyncGeneratorFunction'].includes(callback.constructor?.name),'The rejection publication callback must be synchronous.');
  await syncInternal();assertCurrent(token);
  return transaction('readonly',(tx,finish,abort,guard)=>{stats.metaReads++;const request=tx.objectStore('meta').get('state');request.onsuccess=guard(()=>{
   const meta=validateMeta(request.result);
   if(tokenOf(meta)!==token){invalidate();scheduleSync();throw Error('Saved rejections changed before this result could be published.');}
   need(!legacyDirty&&!stale&&!blocked,'Saved rejections changed before this result could be published.');
   const result=callback();need(!result||typeof result.then!=='function','The rejection publication callback must be synchronous.');finish(result);
  });});
 });}
 async function assertCurrentAsync(token){return withCurrent(token,()=>true);}
 function status(){return{ready:!!view&&!blocked&&!stale&&!loading&&!disposed,blocked,stale,loading,persistent:!!database&&!blocked&&!disposed,active:model?.active.size||0,historical:model?.historical.size||0,events:model?.byId.size||0,backend:'indexeddb',databaseName,revision:model?.meta.revision||0,migratedLegacyCount,legacyEventCount:model?.meta.migration?.legacyEventCount||0,migrationRevision:model?.meta.migration?.revision||0,lastWriteError};}
 function close(){if(disposed)return;disposed=true;stopWatching();root.removeEventListener?.('storage',storageEvent);channel?.close();if(database){const old=database;database=null;old.close();}blocked='The rejection database was closed.';stale=true;loading=false;notify();}
 const ready=sync();ready.catch(()=>{});
 return Object.freeze({storageKind:'indexeddb',requiresAsync:true,ready,sync,retry,refresh:read,snapshot:read,status,hide,restore,match,allowed:(s,c)=>match(s,c).allowed,reorder,
  alternative(current,rows,getSelection,context){const eligible=reorder(rows,getSelection,context).filter(row=>F.key(getSelection(row))!==F.key(current));return eligible.find(row=>F.key(getSelection(row),'clothing')!==F.key(current,'clothing'))||eligible[0]||null;},
  token:()=>read().token,assertCurrent,assertCurrentAsync,withCurrent,exportData,importData,importPreferences,withdrawPreferences,
  prefixes,prefix:F.PREFIX,get persistent(){return status().persistent;},persistentForScope:()=>status().ready&&status().persistent,
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},close,diagnostics:()=>({...stats,databaseName,...status()})});
}
return Object.freeze({create,SCHEMA,DEFAULT_NAME,VERSION,revision:'indexed-rejections-1'});
});
