'use strict';
// Independent rejection oracle: expected relationships below do not use the
// production key/match functions. All records/storage are synthetic.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto').webcrypto;
const {indexedDB,IDBKeyRange,IDBObjectStore}=require('fake-indexeddb');
const F=require('../src/owner-feedback.js'),T=require('../src/tie-feedback.js'),D=require('../src/rejection-database.js');
const core=fs.readFileSync(path.join(__dirname,'../src/outfit-rejection-core.js'),'utf8');
const TIE_SCOPES=['tie','shirt_tie','topwear_tie'];
const SHIRT_SCOPES=['shirt','topwear_shirt','topwear_shirt_tie'];
const SCOPES=['outfit','clothing',...SHIRT_SCOPES,...TIE_SCOPES];
const OCCASIONS=['all','work','dinner','weekend'];
const A={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:'watch-AP09'};
const B={blazerId:'B06',pantId:'PT005',shirtId:'DS010',state:'T022',shoeId:'shoe-8',watchId:null};
const OTHER={suitId:'S13',shirtId:'DS025',state:'T034',shoeId:'shoe-3',watchId:null};
let serial=0;
function storage(){const rows=new Map();let broken=false;return{rows,get length(){return rows.size;},key:i=>[...rows.keys()][i]??null,getItem(k){if(broken)throw Error('synthetic read failure');return rows.get(k)??null;},setItem:(k,v)=>rows.set(String(k),String(v)),removeItem:k=>rows.delete(k),clear:()=>rows.clear(),breakReads:v=>{broken=v;}};}
const bytes=s=>[...s.rows].sort(([a],[b])=>a.localeCompare(b));
const copy=x=>JSON.parse(JSON.stringify(x));
const stamp='2026-11-18T12:00:00.000Z';
function db(backend=storage(),options={}){return D.create({indexedDB,keyRange:IDBKeyRange,legacyStorage:backend,feedback:F,tieFeedback:T,validateSelection:F.normal,databaseName:'all-rejections-'+(++serial),broadcastChannel:null,id:()=> 'audit_'+(++serial),...options});}
function attach(base,backend,validateSelection=F.normal){const app={ownerFeedback:base,ownerFeedbackPersistent:true,connection:{validateSelection,ownerFeedback:{set(){}}}};const root={Image:class Image{},crypto,localStorage:backend,HEWRSOutfitFeedback:F,HEWRSTieFeedback:T};new Function('globalThis',core)(root);return root.HEWRSRejectionPreviewCore.attach(app);}
async function facade(kind,backend=storage(),options={}){const validateSelection=options.validateSelection||F.normal,base=kind==='indexed'?db(backend,options):F.create({storage:backend,validateSelection,id:()=> 'legacy_'+(++serial)});if(base.ready)await base.ready;else base.refresh();return{base,gate:attach(base,backend,validateSelection),backend,close:()=>base.close?.()};}
function occ(value){const lower=String(value||'work').toLowerCase();return ['clinic','hospital','office'].includes(lower)?'work':lower;}
function sameScope(a,b,scope){
 const top=s=>s.suitId||s.blazerId||null;
 if(scope==='shirt')return a.shirtId===b.shirtId;
 if(scope==='topwear_shirt')return !!top(a)&&top(b)===top(a)&&b.shirtId===a.shirtId;
 if(scope==='topwear_shirt_tie')return !!top(a)&&a.state!=='NO_TIE'&&top(b)===top(a)&&b.shirtId===a.shirtId&&b.state===a.state;
 if(scope==='tie')return a.state!=='NO_TIE'&&b.state===a.state;
 if(scope==='shirt_tie')return a.state!=='NO_TIE'&&b.state===a.state&&b.shirtId===a.shirtId;
 if(scope==='topwear_tie')return !!top(a)&&a.state!=='NO_TIE'&&top(b)===top(a)&&b.state===a.state;
 return top(a)===top(b)&&(a.pantId||null)===(b.pantId||null)&&a.shirtId===b.shirtId&&a.state===b.state&&(scope==='clothing'||a.shoeId===b.shoeId);
}
function excluded(a,b,scope,savedOcc,queryOcc){return (occ(savedOcc)==='all'||occ(savedOcc)===occ(queryOcc))&&sameScope(a,b,scope);}
function variations(s){const common={shirtId:s.shirtId,state:s.state,shoeId:s.shoeId,watchId:s.watchId};return[
 copy(s),{...s,watchId:s.watchId?null:'watch-AP09'},{...s,shoeId:s.shoeId==='shoe-1'?'shoe-8':'shoe-1'},
 {...s,shirtId:s.shirtId==='DS029'?'DS010':'DS029'},{...s,state:s.state==='T029'?'T022':'T029'},{...s,state:'NO_TIE'},
 {suitId:'S06',...common},{blazerId:'B07',pantId:'PB001',...common},
 {shirtOnly:true,pantId:'PT005',...common},...(s.blazerId?[{...s,pantId:'PB001'}]:[])
];}
function event(id,selection=A,scope='clothing',occasion='all',extra={}){return{schema:TIE_SCOPES.includes(scope)?T.SCHEMA:F.SCHEMA,id,at:stamp,type:'hide',actor:'owner',selection:copy(selection),scope,occasion,reason:'other',note:'Synthetic audit',...extra};}
const byId=events=>events.slice().sort((a,b)=>a.id.localeCompare(b.id));
const outfit=events=>({schema:F.EXPORT,events});
const tied=events=>({schema:T.EXPORT,events});
const bundle=(a,b)=>({schema:T.BUNDLE_EXPORT,outfit_feedback:outfit(a),tie_feedback:tied(b)});
function put(backend,e){backend.setItem((e.schema===F.SCHEMA?F.PREFIX:T.PREFIX)+e.id,JSON.stringify(e,null,2));}
function comparison(id,vote,a=A,b=OTHER,partition='training',occasion='work'){return{id,vote,a:copy(a),b:copy(b),partition,reason:'Exact original vote',created_at:stamp,context:{occasion,requiredFormality:'any'}};}
function preferences(comparisons){return{schema:'hewrs.outfit-preferences.v1',source_lock:'a'.repeat(64),revision:1,enabled:true,comparisons};}
const wire=s=>({topwear:s.suitId||s.blazerId||null,pants:s.pantId||null,shirt:s.shirtId,tie:s.state==='NO_TIE'?null:s.state,shoe:s.shoeId,watch:s.watchId||null});
function strictCatalogueSelection(selected){
 assert.equal(Object.hasOwn(selected,'topwear'),false,'Catalogue validation receives canonical IDs');
 assert.ok(selected.suitId||selected.blazerId||selected.shirtOnly,'An exact canonical outfit mode is required');
 assert.equal(selected.shirtId==='DS999'||selected.state==='T999',false,'Unknown or disabled catalogue garment');
 return copy(selected);
}
async function databaseRows(name){const opened=await new Promise((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{return await Promise.all(['events','active','meta'].map(store=>new Promise((resolve,reject)=>{const request=opened.transaction(store).objectStore(store).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);})));}finally{opened.close();}}
async function rendererHarness(kind,nativeRender=async()=>({ready:true})){
 const backend=storage(),base=kind==='indexed'?db(backend):F.create({storage:backend});if(base.ready)await base.ready;else base.refresh();
 const noop=()=>{},calls={render:0,pixels:0,session:0},context={occasion:'work',formality:'any',localDate:'2026-11-18'};
 const canvas=()=>({width:996,height:2748,dataset:{},getContext:()=>({getImageData:()=>({}),putImageData(){calls.pixels++;}})}),document={createElement:canvas};
 const connection={validateSelection:F.normal,scoreSelection:()=>({}),ownerFeedback:{set(){}}},application={ownerFeedback:base,ownerFeedbackPersistent:true,connection,state:()=>({context})};
 const root={Image:class{},crypto,localStorage:backend,HEWRSOutfitFeedback:F,HEWRSTieFeedback:T,HEWRSStyleOccasions:{occasion:F.occasion},HEWRSAtomicRenderer:{create:()=>({async render(value){calls.render++;return nativeRender(value);},cancel:noop})}};
 new Function('globalThis','document',core)(root,document);const gate=root.HEWRSRejectionPreviewCore.attach(application),visible=canvas();visible.id='avatar';
 const renderer=root.HEWRSAtomicRenderer.create(visible,connection,{}),environment=vm.createContext({need:(value,message)=>{if(!value)throw Error(message);},copy:structuredClone,current:null,currentOption:null,score:null,generation:0,busy:false,pendingInitialOutfit:null,origin:'manual',ctx:context,root,$:()=>({hidden:false}),
  async checkRejectionFeedbackAsync(){if(gate.sync)await gate.sync();return gate.refresh();},rejectionGate:()=>gate,autoWeather:{cancel:noop},connection,renderer,store:{assertCurrent:noop,saveSession(){calls.session++;},readForGeneration:()=>({token:'history'})},learning:{assertCurrent:noop},currentContext:()=>({occasion:context.occasion,requiredFormality:context.formality}),ui:{fromSelection:noop},setMode:noop,setBusy:noop,status:noop,presentFrame:noop,displayCurrent:noop,updateHome:noop,refreshHistory:noop,sessionValue:noop,selection:copy(A)});
 const source=fs.readFileSync(path.join(__dirname,'../src/outfit-refill-application.js'),'utf8'),start=source.indexOf('async function apply(s,opts={})'),end=source.indexOf('async function selectOption(',start);assert.ok(start>=0&&end>start);vm.runInContext(source.slice(start,end),environment);
 return {gate,renderer,calls,environment,context,apply(options){environment.applyOptions=options;return vm.runInContext('apply(selection,applyOptions)',environment);},close:()=>base.close?.()};
}

test('independent all-scope oracle covers each garment role, outfit mode and occasion',async()=>{
 let comparisons=0;
 for(const kind of ['legacy','indexed'])for(const selected of [A,B])for(const scope of SCOPES)for(const savedOccasion of OCCASIONS){
  const h=await facade(kind);try{
   const hidden=await h.gate.hide(selected,{scope,context:savedOccasion,reason:'patterns',note:'Reason must not alter the selected relationship.'});
   for(const candidate of variations(selected))for(const queryOccasion of ['work','clinic','HOSPITAL','dinner','weekend','all']){
    assert.equal(h.gate.allowed(candidate,{occasion:queryOccasion}),!excluded(selected,candidate,scope,savedOccasion,queryOccasion),JSON.stringify({kind,scope,savedOccasion,queryOccasion,selected,candidate}));comparisons++;
   }
   assert.equal((await h.gate.hide({...selected,watchId:'watch-another'},{scope,context:savedOccasion})).id,hidden.id,'Watch-only changes cannot create a new rejection identity');
   assert.equal(h.gate.snapshot().active.length,1);
  }finally{h.close();}
 }
 console.log(JSON.stringify({audit:'independent scope/occasion oracle',comparisons}));
});

test('legacy occasion labels and wire selections are matched without rewriting migrated bytes',async()=>{
 for(const kind of ['legacy','indexed'])for(const label of ['clinic','hospital','office','WORK','Dinner','WEEKEND','ALL']){
  const backend=storage(),wire={topwear:A.suitId,pants:null,shirt:A.shirtId,tie:A.state,shoe:A.shoeId,watch:A.watchId};
  const saved=event('alias_'+(++serial),wire,'clothing',label);put(backend,saved);const original=bytes(backend);
  const h=await facade(kind,backend);try{
   for(const occasion of ['work','dinner','weekend'])assert.equal(h.gate.allowed({...A,shoeId:'shoe-8',watchId:null},{occasion}),!excluded(A,A,'clothing',label,occasion),kind+' '+label+' must match its canonical occasion');
   const repeated=await h.gate.hide(A,{scope:'clothing',context:occ(label),note:'Do not rewrite original data'});assert.equal(repeated.id,saved.id);assert.deepEqual(bytes(backend),original);
   const backup=await h.gate.exportData();assert.deepEqual(backup.outfit_feedback.events.find(e=>e.id===saved.id),saved);
   const name=h.base.status?.().databaseName;h.close();
   const reopened=await facade(kind,backend,name?{databaseName:name}:{});try{
    for(const occasion of ['work','dinner','weekend'])assert.equal(reopened.gate.allowed(A,{occasion}),!excluded(A,A,'clothing',label,occasion));
    await reopened.gate.restore(saved.id);assert.equal(reopened.gate.allowed(A,{occasion:occ(label)==='all'?'work':occ(label)}),true);assert.equal(backend.getItem(F.PREFIX+saved.id),original[0][1]);
   }finally{reopened.close();}
  }finally{h.close();}
 }
});

test('accepted wire selections are normalized only for strict catalogue checks, never in the immutable record',async()=>{
 for(const kind of ['legacy','indexed'])for(const selected of [A,B,{shirtOnly:true,pantId:'PT005',shirtId:'DS010',state:'NO_TIE',shoeId:'shoe-8',watchId:null}]){
  const backend=storage(),saved=event('wire_'+(++serial),wire(selected),'shirt','clinic');put(backend,saved);const before=bytes(backend);
  const h=await facade(kind,backend,{validateSelection:strictCatalogueSelection});try{
   assert.equal(h.gate.allowed(selected,{occasion:'work'}),false);assert.deepEqual(bytes(backend),before);
   assert.deepEqual((await h.gate.exportData()).outfit_feedback.events.find(e=>e.id===saved.id),saved);
   await h.gate.restore(saved.id);assert.equal(h.gate.allowed(selected,{occasion:'work'}),true);
   const next=await h.gate.hide(wire(selected),{scope:'shirt',context:'weekend'});assert.equal(next.selection.shirtId,selected.shirtId);await h.gate.restore(next.id);
   const temporary=h.gate.skip(wire(selected),{scope:'shirt',context:'all'});assert.equal(h.gate.allowed(selected,{occasion:'dinner'}),false);await h.gate.restore(temporary.id);
   const prior=copy(h.gate.snapshot().events);
   await assert.rejects(async()=>h.gate.importData(outfit([event('unknown_'+(++serial),{...wire(selected),shirt:'DS999'},'shirt')])),/Unknown or disabled/);
   assert.deepEqual(h.gate.snapshot().events,prior);
   const document=preferences([comparison('wire_vote_'+(++serial),'neither',wire(selected),wire(OTHER),'validation','all')]);
   await h.base.importPreferences(document);h.gate.refresh();assert.equal(h.gate.allowed(selected,{occasion:'dinner'}),false);
   assert.deepEqual((await h.gate.exportData()).outfit_feedback.events.find(e=>e.type==='preferences').payload,document);
   await assert.rejects(async()=>h.base.importPreferences(preferences([comparison('bad_vote_'+(++serial),'neither',{...wire(selected),tie:'T999'},wire(OTHER))])),/Unknown or disabled/);
  }finally{h.close();}
 }
});

test('shirt, jacket–shirt and exact triple scopes require only their named garment relationship',async()=>{
 const shirtOnly={shirtOnly:true,pantId:'PT005',shirtId:A.shirtId,state:A.state,shoeId:A.shoeId,watchId:null};
 for(const kind of ['legacy','indexed']){const h=await facade(kind);try{
  for(const [selected,scope,message]of [[shirtOnly,'topwear_shirt',/exact suit or blazer/],[shirtOnly,'topwear_shirt_tie',/exact suit or blazer/],[{...A,state:'NO_TIE'},'topwear_shirt_tie',/actual tie/]]){
   const prior=copy(h.gate.snapshot().events);await assert.rejects(async()=>h.gate.hide(selected,{scope,context:'all'}),message);assert.throws(()=>h.gate.skip(selected,{scope,context:'all'}),message);assert.deepEqual(h.gate.snapshot().events,prior);assert.equal(h.gate.snapshot().temporary.length,0);
  }
  const pair=await h.gate.hide({...A,state:'NO_TIE'},{scope:'topwear_shirt',context:'all'});
  assert.equal(h.gate.allowed(A),false);assert.equal(h.gate.allowed({...A,state:'T040',shoeId:'shoe-8'}),false);assert.equal(h.gate.allowed(shirtOnly),true);assert.equal(h.gate.allowed({...A,suitId:'S06'}),true);await h.gate.restore(pair.id);
  const triple=await h.gate.hide(A,{scope:'topwear_shirt_tie',context:'all'});
  assert.equal(h.gate.allowed(A),false);for(const change of [{suitId:'S06'},{shirtId:'DS010'},{state:'T040'},{state:'NO_TIE'}])assert.equal(h.gate.allowed({...A,...change}),true,'Triple is not any pair or union of pairs');await h.gate.restore(triple.id);
  const shirt=await h.gate.hide({...shirtOnly,state:'NO_TIE'},{scope:'shirt',context:'all'});
  assert.equal(h.gate.allowed(A),false);assert.equal(h.gate.allowed({...B,shirtId:A.shirtId}),false);assert.equal(h.gate.allowed({...A,shirtId:'DS048'}),true);await h.gate.restore(shirt.id);
 }finally{h.close();}}
});

test('readers without new scope support fail closed and leave both storage ledgers untouched',async()=>{
 const originalReader=require('../outfit-feedback.js');
 for(const scope of SHIRT_SCOPES){
  const backend=storage();put(backend,event('future_'+(++serial),A,scope));const before=bytes(backend),old=originalReader.create({storage:backend});
  assert.throws(()=>old.refresh(),/scope/);assert.throws(()=>old.allowed(A),/scope/);assert.deepEqual(bytes(backend),before);
  const current=await facade('indexed',backend);const name=current.base.status().databaseName;current.close();const originalRows=await databaseRows(name);
  const older=db(backend,{databaseName:name,feedback:{...F,isScope:scope=>scope==='outfit'||scope==='clothing'}});
  try{await assert.rejects(older.ready,/scope/);assert.throws(()=>older.allowed(A),/scope/);assert.deepEqual(await databaseRows(name),originalRows);assert.deepEqual(bytes(backend),before);}finally{older.close();}
 }
});

test('production apply and visible renderer use the destination occasion in both directions',async()=>{
 for(const kind of ['legacy','indexed'])for(const banned of ['work','dinner']){const h=await rendererHarness(kind);try{
  await h.gate.hide(A,{scope:'clothing',context:banned});
  const operation=h.apply({context:{occasion:'Dinner',requiredFormality:'any'}});
  if(banned==='dinner'){await assert.rejects(operation,/rejected/);assert.equal(h.calls.render,0);assert.equal(h.calls.pixels,0);assert.equal(h.calls.session,0);assert.equal(h.environment.current,null);assert.equal(h.context.occasion,'work');}
  else{await operation;assert.equal(h.calls.render,1);assert.equal(h.calls.pixels,1);assert.equal(h.calls.session,1);assert.deepEqual(h.environment.current,A);assert.equal(h.context.occasion,'dinner');}
 }finally{h.close();}}
});

test('visible renderer captures supplied context before awaiting and rejects feedback changes before pixels commit',async()=>{
 for(const kind of ['legacy','indexed']){
  let begin,release;const started=new Promise(resolve=>{begin=resolve;}),waiting=new Promise(resolve=>{release=resolve;});
  const h=await rendererHarness(kind,async()=>{begin();await waiting;return {ready:true};});try{
   await h.gate.hide(A,{scope:'clothing',context:'work'});const context={occasion:'Dinner',requiredFormality:'any'},render=h.renderer.render(copy(A),{context});
   context.occasion='work';await started;release();await render;assert.equal(h.calls.pixels,1,'Caller mutation must not turn the captured Dinner render into a Work check');
  }finally{release();h.close();}
  let beginChanged,releaseChanged;const changingStarted=new Promise(resolve=>{beginChanged=resolve;}),changingWait=new Promise(resolve=>{releaseChanged=resolve;});
  const changed=await rendererHarness(kind,async()=>{beginChanged();await changingWait;return {ready:true};});try{
   const applying=changed.apply({context:{occasion:'dinner',requiredFormality:'any'}});await changingStarted;
   await changed.gate.hide(A,{scope:'shirt',context:'dinner'});releaseChanged();await assert.rejects(applying,/changed|rejected/);
   assert.equal(changed.calls.render,1);assert.equal(changed.calls.pixels,0);assert.equal(changed.calls.session,0);assert.equal(changed.environment.current,null);assert.equal(changed.context.occasion,'work');
  }finally{releaseChanged();changed.close();}
 }
});

test('all-occasion and single-occasion records remain independent under Undo and duplicate import',async()=>{
 for(const kind of ['legacy','indexed'])for(const scope of SCOPES){
  const h=await facade(kind);try{
   const universal=await h.gate.hide(A,{scope,context:'all'}),work=await h.gate.hide(A,{scope,context:'clinic'});
   assert.notEqual(universal.id,work.id);assert.equal(h.gate.snapshot().active.length,2);
   await h.gate.restore(work.id);assert.equal(h.gate.allowed(A,{occasion:'work'}),false);assert.equal(h.gate.allowed(A,{occasion:'dinner'}),false);
   const again=await h.gate.hide(A,{scope,context:'office'});assert.notEqual(again.id,work.id);assert.equal(again.occasion,'work');
   await h.gate.restore(universal.id);assert.equal(h.gate.allowed(A,{occasion:'work'}),false);assert.equal(h.gate.allowed(A,{occasion:'dinner'}),true);
   const document=await h.gate.exportData(),before=h.gate.snapshot().events.length;await h.gate.importData(document);await h.gate.importData(document);assert.equal(h.gate.snapshot().events.length,before);
   await h.gate.restore(again.id);assert.equal(h.gate.allowed(A,{occasion:'work'}),true);
  }finally{h.close();}
 }
});

test('Undo of one overlapping scope cannot undo any other active scope',async()=>{
 for(const kind of ['legacy','indexed']){
  const h=await facade(kind);try{
   const records=[];for(const scope of SCOPES)records.push(await h.gate.hide(A,{scope,context:'all'}));
   for(const [i,record]of records.entries()){
    assert.equal(h.gate.allowed(A,{occasion:'weekend'}),false);await h.gate.restore(record.id);
    assert.equal(h.gate.allowed(A,{occasion:'weekend'}),i===records.length-1);
   }
   const copies=[event('copy_'+(++serial)),event('copy_'+(++serial))];await h.gate.importData(outfit(copies));
   assert.equal(h.gate.snapshot().active.length,2);await h.gate.restore(copies[0].id);assert.equal(h.gate.allowed(A),false);await h.gate.restore(copies[1].id);assert.equal(h.gate.allowed(A),true);
  }finally{h.close();}
 }
});

test('temporary exclusions use identical scopes but do not survive export, reload or clear',async()=>{
 for(const kind of ['legacy','indexed'])for(const scope of SCOPES){
  const h=await facade(kind);try{
   const permanent=await h.gate.hide(OTHER,{scope:'outfit',context:'all'}),before=bytes(h.backend);
   const temporary=h.gate.skip(A,{scope,context:'HOSPITAL',reason:'colors',note:'Temporary only'});
   for(const candidate of variations(A))assert.equal(h.gate.allowed(candidate,{occasion:'work'}),!excluded(A,candidate,scope,'work','work'));
   assert.equal(h.gate.allowed(A,{occasion:'dinner'}),true);assert.deepEqual(bytes(h.backend),before);
   const backup=await h.gate.exportData();assert.equal(backup.outfit_feedback.events.length,1);assert.equal(backup.tie_feedback.events.length,0);
   const reloaded=await facade(kind,h.backend,h.base.status?.().databaseName?{databaseName:h.base.status().databaseName}:{});try{assert.equal(reloaded.gate.allowed(A),true);assert.equal(reloaded.gate.allowed(OTHER),false);}finally{reloaded.close();}
   await h.gate.restore(temporary.id);assert.equal(h.gate.allowed(A),true);h.gate.skip(A,{scope,context:'all'});h.gate.clearTemporary();assert.equal(h.gate.allowed(A),true);
   assert.equal(h.gate.snapshot().active[0].id,permanent.id);
  }finally{h.close();}
 }
});

test('mixed-scope backup round-trips preserve rejection IDs, exact notes, original schemas and Undo',async()=>{
 const source=await facade('indexed');try{
  const records=[];for(const [i,scope]of SCOPES.entries())records.push(await source.gate.hide({...A,shirtId:'DS'+String(10+i).padStart(3,'0'),state:'T'+String(20+i).padStart(3,'0')},{scope,context:i%2?'work':'all',reason:i%2?'footwear':'other',note:'Literal note '+i+'; no semantic inference.'}));
  await source.gate.restore(records[1].id);const document=await source.gate.exportData();
  for(const kind of ['legacy','indexed']){const target=await facade(kind);try{
   await target.gate.importData(document);const exported=await target.gate.exportData();assert.deepEqual(byId(exported.outfit_feedback.events),byId(document.outfit_feedback.events));assert.deepEqual(byId(exported.tie_feedback.events),byId(document.tie_feedback.events));
   for(const [i,record]of records.entries())assert.equal(target.gate.match(record.selection,{occasion:'work'}).reasons.some(r=>r.id===record.id),i!==1);
   for(const record of records)if(record!==records[1])await target.gate.restore(record.id);assert.equal(target.gate.snapshot().active.length,0);
  }finally{target.close();}}
 }finally{source.close();}
});

test('concurrent IndexedDB writers preserve every scope, deduplicate aliases and reject stale publication',async()=>{
 const backend=storage(),one=await facade('indexed',backend),two=await facade('indexed',backend,{databaseName:one.base.status().databaseName});
 try{
  const stale=one.gate.token();await Promise.all(SCOPES.map((scope,i)=>(i%2?one:two).gate.hide({...A,state:'T'+String(20+i).padStart(3,'0')},{scope,context:'all'})));
  await one.gate.sync();await two.gate.sync();assert.equal(one.gate.snapshot().active.length,SCOPES.length);assert.equal(two.gate.snapshot().active.length,SCOPES.length);
  let published=false;await assert.rejects(one.gate.withCurrent(stale,()=>{published=true;}),/changed/);assert.equal(published,false);
  const [a,b]=await Promise.all([one.gate.hide(OTHER,{scope:'clothing',context:'clinic'}),two.gate.hide(OTHER,{scope:'clothing',context:'work'})]);assert.equal(a.id,b.id);
  const temporarySelection={...OTHER,shirtId:'DS048',state:'T040'};
  await one.gate.sync();one.gate.skip(temporarySelection,{scope:'tie',context:'all'});assert.equal(one.gate.allowed(temporarySelection),false);assert.equal(two.gate.allowed(temporarySelection),true);
  await two.gate.restore(a.id);await one.gate.sync();assert.equal(one.gate.allowed(OTHER),true);assert.equal(one.gate.snapshot().active.length,SCOPES.length);
 }finally{one.close();two.close();}
});

test('legacy readers observe other writers and Undo immediately for every scope and temporary checks fail closed',async()=>{
 for(const scope of SCOPES){const backend=storage(),first=await facade('legacy',backend),second=await facade('legacy',backend);try{
  assert.equal(first.gate.allowed(A),true);const record=second.gate.hide(A,{scope,context:'all'});
  assert.equal(first.gate.allowed(A),false,'A second writer cannot leave a stale allowed result for '+scope);
  second.gate.restore(record.id);assert.equal(first.gate.allowed(A),true,'A second writer’s Undo is visible for '+scope);
 }finally{first.close();second.close();}}
 for(const prefix of [F.PREFIX,T.PREFIX]){const h=await facade('legacy');try{
  h.backend.setItem(prefix+'broken','{unreadable');const before=bytes(h.backend);
  assert.throws(()=>h.gate.allowed({...A,state:'NO_TIE'}),/Unreadable/);
  assert.throws(()=>h.gate.skip(A,{scope:'shirt',context:'all'}),/Unreadable/);
  assert.deepEqual(bytes(h.backend),before);
 }finally{h.close();}}
});

test('invalid combined imports and every scoped transaction abort leave prior durable state intact',async()=>{
 const h=await facade('indexed');try{
  await h.gate.hide(OTHER,{scope:'outfit',context:'all'});const baseline=copy(h.gate.snapshot().events);
  await assert.rejects(h.gate.importData(bundle([event('valid_new')],[event('tie_bad',A,'tie','all',{scope:'unrecognized'})])),/scope/);assert.deepEqual(h.gate.snapshot().events,baseline);
  for(const scope of SCOPES){
   const original=IDBObjectStore.prototype.add;let hit=false;IDBObjectStore.prototype.add=function(...args){const request=Reflect.apply(original,this,args);if(this.name==='events'&&!hit){hit=true;this.transaction.abort();}return request;};
   try{await assert.rejects(h.gate.hide(A,{scope,context:'all'}),/did not complete/);}finally{IDBObjectStore.prototype.add=original;}
   assert.equal(hit,true);await h.gate.sync();assert.deepEqual(h.gate.snapshot().events,baseline);assert.equal(h.gate.allowed(A),true);assert.equal(h.gate.allowed(OTHER),false);
  }
 }finally{h.close();}
});

test('unreadable legacy namespaces and failed IndexedDB reads block checks without clearing records',async()=>{
 for(const prefix of [F.PREFIX,T.PREFIX]){const backend=storage();put(backend,event('saved'));backend.setItem(prefix+'broken','{broken');const before=bytes(backend),broken=db(backend);try{await assert.rejects(broken.ready,/Unreadable/);assert.throws(()=>broken.allowed(A),/Unreadable/);assert.deepEqual(bytes(backend),before);backend.removeItem(prefix+'broken');await broken.retry();assert.equal(broken.allowed(A),false);}finally{broken.close();}}
 const h=await facade('indexed');try{
  await h.gate.hide(A,{scope:'outfit',context:'all'});const before=copy(h.gate.snapshot().events),original=IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get=function(...args){if(this.name==='meta')throw Error('Synthetic IndexedDB read unavailable');return Reflect.apply(original,this,args);};
  try{await assert.rejects(h.gate.sync(),/read unavailable/);assert.throws(()=>h.gate.allowed(A),/read unavailable/);}finally{IDBObjectStore.prototype.get=original;}
  await h.gate.retry();assert.deepEqual(h.gate.snapshot().events,before);assert.equal(h.gate.allowed(A),false);
 }finally{h.close();}
});

test('historical Neither is an exact outfit/context veto; other votes and training rank cannot undo it',async()=>{
 for(const kind of ['legacy','indexed']){const h=await facade(kind);try{
  const a={...A,state:'T031'},b={...A,shirtId:'DS010',state:'T032'},loser={...OTHER,state:'T033'},both={...OTHER,state:'T035'};
  await h.base.importPreferences(preferences([comparison('neither','neither',a,b,'validation','clinic'),comparison('preferred','A',a,loser),comparison('both','both',both,OTHER)]));h.gate.refresh();
  for(const selected of [a,b]){assert.equal(h.gate.allowed(selected,{occasion:'work'}),false);assert.equal(h.gate.allowed(selected,{occasion:'dinner'}),true);assert.equal(h.gate.allowed({...selected,watchId:'watch-different'},{occasion:'work'}),true);assert.equal(h.gate.allowed({...selected,shoeId:'shoe-8'},{occasion:'work'}),true);}
  assert.equal(h.gate.allowed(loser),true);assert.equal(h.gate.allowed(both),true);assert.equal(h.gate.allowed(OTHER),true);
  assert.deepEqual(h.gate.reorder([loser,a,both],x=>x,{occasion:'work'}),[loser,both]);
  const imported=h.base.snapshot().active_imports[0];await h.base.withdrawPreferences(imported.id);h.gate.refresh();assert.equal(h.gate.allowed(a,{occasion:'work'}),true);assert.equal(h.gate.allowed(b,{occasion:'work'}),true);
 }finally{h.close();}}
});

test('historical Neither recorded for all occasions remains exact, including watch, through migration and backup',async()=>{
 for(const kind of ['legacy','indexed'])for(const savedOccasion of ['all','ALL']){
  const backend=storage(),original={schema:F.SCHEMA,id:'historical_all_'+(++serial),at:stamp,type:'preferences',payload:preferences([comparison('global_neither_'+serial,'neither',A,B,'validation',savedOccasion)])};
  put(backend,original);const before=bytes(backend),h=await facade(kind,backend);try{
   for(const selected of [A,B])for(const occasion of ['work','clinic','dinner','weekend','all']){
    assert.equal(h.gate.allowed(selected,{occasion}),false,savedOccasion+' Neither veto applies to '+occasion);
    assert.equal(h.gate.allowed({...selected,watchId:'watch-different'},{occasion}),true,'Historical Neither retains watch identity');
    assert.equal(h.gate.allowed({...selected,shoeId:'shoe-3'},{occasion}),true,'Historical Neither retains shoe identity');
   }
   assert.deepEqual(bytes(backend),before);const document=await h.gate.exportData();assert.deepEqual(document.outfit_feedback.events,[original]);
   const imported=await facade(kind);try{await imported.gate.importData(document);for(const occasion of ['work','dinner','weekend'])assert.equal(imported.gate.allowed(A,{occasion}),false);assert.deepEqual((await imported.gate.exportData()).outfit_feedback.events,[original]);}finally{imported.close();}
   await h.base.withdrawPreferences(original.id);h.gate.refresh();assert.equal(h.gate.allowed(A,{occasion:'work'}),true);assert.equal(backend.getItem(F.PREFIX+original.id),before[0][1]);
  }finally{h.close();}
 }
});

test('static owner prohibitions and explicit approved outfits cannot bypass saved rejections',async()=>{
 for(const kind of ['legacy','indexed']){const h=await facade(kind);try{
  const b11={...B,blazerId:'B11',state:'NO_TIE',shoeId:'shoe-8'};
  for(const occasion of ['work','dinner','weekend']){assert.equal(h.gate.allowed(b11,{occasion}),true);assert.equal(h.gate.allowed({...b11,state:'T022'},{occasion}),false);assert.equal(h.gate.allowed({...b11,shoeId:'shoe-1'},{occasion}),false);assert.equal(h.gate.allowed(b11,{occasion,requiredFormality:'tie_required'}),false);}
  const b01={...B,blazerId:'B01',pantId:'PB001',state:'NO_TIE',shoeId:'shoe-8'},summer={occasion:'dinner',owner_use_case:'summer_weekend_dinner'};
  assert.equal(h.gate.allowed(b01,summer),true);assert.equal(h.gate.allowed(b01,{occasion:'dinner'}),false);assert.equal(h.gate.allowed(b01,{...summer,occasion:'work'}),false);assert.equal(h.gate.allowed({...b01,pantId:'PG001'},summer),false);assert.equal(h.gate.allowed({...b01,shoeId:'shoe-1'},summer),false);
  const oldCore={...A,suitId:'S01',shirtId:'DS029',state:'T024'};for(const occasion of ['work','dinner','weekend'])assert.equal(h.gate.allowed({...oldCore,shoeId:'shoe-8',watchId:null},{occasion}),false);
  const s07={...A,suitId:'S07',shirtId:'DS017',state:'T030',shoeId:'shoe-15'};assert.equal(h.gate.allowed(s07,{occasion:'work'}),false);assert.equal(h.gate.allowed(s07,{occasion:'dinner'}),true);assert.equal(h.gate.allowed({...s07,shoeId:'shoe-8'},{occasion:'work'}),true);
  for(const approval of F.ownerBatch().approvals){const selected=F.normal(approval.outfit);assert.equal(h.gate.allowed(selected,{occasion:approval.occasion}),true);const rejection=await h.gate.hide(selected,{scope:'outfit',context:approval.occasion});assert.equal(h.gate.allowed(selected,{occasion:approval.occasion}),false);await h.gate.restore(rejection.id);assert.equal(h.gate.allowed(selected,{occasion:approval.occasion}),true);}
 }finally{h.close();}}
});
