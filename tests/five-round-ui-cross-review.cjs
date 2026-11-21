'use strict';
// Independent transport/cache and reviewed-preview boundary checks.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..');
function imageRig(){
 const images=[];class Image{constructor(){images.push(this);this.naturalWidth=10;this.naturalHeight=20;}set src(value){this.value=value;}get src(){return this.value;}}
 const root={Image};new Function('globalThis',fs.readFileSync(path.join(base,'src/render-image-loader.js'),'utf8'))(root);
 const create=options=>root.HEWRSRenderImageLoader.create({limit:1,width:10,height:20,...options});return {images,create};
}
const descriptor=(letter,url=letter+'.png')=>({sha256:letter.repeat(64),url});
test('An evicted pending load cannot evict a later same-source retry when its failure settles',async()=>{
 const {images,create}=imageRig(),loader=create(),a=descriptor('a'),b=descriptor('b');
 const old=loader.load(a),oldError=images[0].onerror,other=loader.load(b),retry=loader.load(a);assert.equal(images.length,3);
 oldError();await assert.rejects(old,/failed/);assert.equal(loader.load(a),retry);assert.equal(images.length,3);
 images[2].onload();images[1].onload();await retry;await other;assert.equal(loader.pending,0);assert.equal(loader.size,1);
});
test('Cancel settles all pending entries even after cache eviction and late callbacks cannot affect fresh work',async()=>{
 const {images,create}=imageRig(),loader=create(),a=descriptor('a'),promises=[loader.load(a),loader.load(descriptor('b')),loader.load(a)];
 const callbacks=images.map(image=>({load:image.onload,error:image.onerror}));assert.equal(loader.pending,3);loader.cancel();assert.equal(loader.pending,0);
 const retry=loader.load(a);assert.equal(images.length,4);
 for(const c of callbacks){c.load();c.error();}
 assert.equal((await Promise.allSettled(promises)).filter(r=>r.status==='rejected'&&r.reason.code==='HEWRS_RENDER_CANCELLED').length,3);
 assert.equal(loader.load(a),retry);images[3].onload();await retry;assert.equal(loader.pending,0);assert.equal(loader.size,1);
});
test('Source URL changes are independently bound and completed images survive cancel',async()=>{
 const {images,create}=imageRig(),loader=create({limit:3}),a=descriptor('a');let p=loader.load(a);images[0].onload();await p;
 loader.cancel();assert.equal(loader.load(a),p);const relocated=loader.load({...a,url:'new.png'});assert.equal(images.length,2);images[1].onload();await relocated;assert.equal(loader.size,2);
});
test('Rejected source resolution does not pollute the cache or prevent a corrected retry',async()=>{
 let fail=true;const {images,create}=imageRig(),loader=create({resolveUrl:d=>{if(fail)throw Error('Unregistered source');return d.url;}}),a=descriptor('a');
 await assert.rejects(loader.load(a),/Unregistered/);assert.equal(loader.size,0);assert.equal(loader.pending,0);assert.equal(images.length,0);
 fail=false;const next=loader.load(a);images[0].onload();await next;assert.equal(loader.size,1);
});
function stores(){
 const data=new Map(),backend={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},lock='a'.repeat(64);
 const s={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:null},connection={validateSelection:x=>structuredClone(x),historyIds:x=>({topwear:x.suitId,shirt:x.shirtId,tie:x.state,shoes:x.shoeId,watch:x.watchId,pants:null})};
 const context=vm.createContext({structuredClone,HEWRSStyleOccasions:{known:v=>v==='work'}});
 for(const file of ['src/local-state.js','src/favorites-state.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
 const create=kind=>kind==='wear'?context.HEWRSLocalState.create(connection,lock,backend):context.HEWRSFavorites.create(connection,lock,backend);
 return {data,backend,create,s,context};
}
for(const kind of ['wear','favorites'])test(kind+' preview cannot be transferred to another store instance or replayed with edited data',()=>{
 const h=stores(),first=h.create(kind),second=h.create(kind),preview=first.previewImport(first.exportText()),before=JSON.stringify([...h.data]);
 assert.throws(()=>kind==='wear'?second.restore(preview):second.merge(preview),/preview|changed/i);assert.equal(JSON.stringify([...h.data]),before);
 if(kind==='wear')preview.revision++;else preview.data.revision++;
 assert.throws(()=>kind==='wear'?first.restore(preview):first.merge(preview),/changed/i);assert.equal(JSON.stringify([...h.data]),before);
});
for(const kind of ['wear','favorites'])test(kind+' queued persistent callback rechecks the backing record before entering a write',async()=>{
 const h=stores();let release;h.context.navigator={locks:{request(_key,_options,fn){return new Promise((resolve,reject)=>{release=()=>Promise.resolve().then(fn).then(resolve,reject);});}}};
 const target=h.create(kind),peer=h.create(kind);let entered=0;const pending=target.exclusive(()=>{entered++;});
 if(kind==='wear')peer.saveSession({selection:h.s,origin:'manual',mode:'anchor',localDate:'2026-11-19',context:{occasion:'work',requiredFormality:'any'}});else peer.add(h.s,{id:'favorite_peer',created_at:'2026-11-19T00:00:00.000Z'});
 const bytes=h.data.get(target.key);release();await assert.rejects(pending,/changed/i);assert.equal(entered,0);assert.equal(h.data.get(target.key),bytes);
});

function learningStores(){
 const records=new Map(),writes=[],backend={getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);writes.push(k);}},revision='cross-review-source',lock='c'.repeat(64);
 const context=vm.createContext({structuredClone,HEWRSSourceCorrections:{revision},HEWRSStyleOccasions:{occasion:v=>v,known:v=>['work','dinner'].includes(v)},HEWRS_PREFERENCE_PILOT:{validation_topwear:[]}});
 vm.runInContext(fs.readFileSync(path.join(base,'src/outfit-learning.js'),'utf8'),context);
 const selection={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:null};
 const connection={validateSelection:s=>structuredClone(s),hybrid:{researchPreference:{describeSelection:()=>({eligible:true})}}};
 const create=()=>context.HEWRSOutfitLearning.create(connection,lock,backend);
 const row={id:'pref_cross_review',created_at:'2026-11-19T00:00:00.000Z',a:selection,b:{...selection,state:'T009'},vote:'both',reason:'other',partition:'training',pilot_id:null,context:{occasion:'dinner',requiredFormality:'any'},source_revision:revision};
 return {create,records,writes,row};
}
test('Learning preview cannot change enabled state or erase reviewed votes, even if public metadata is revised with it',()=>{
 const h=learningStores(),store=h.create();store.add(h.row,store.read().token);const preview=store.previewImport(store.exportText()),before=h.records.get(store.key),writes=h.writes.length;
 preview.data.enabled=false;preview.data.comparisons=[];preview.added=0;preview.already_saved=0;
 assert.throws(()=>store.merge(preview),/changed after preview/i);assert.equal(h.records.get(store.key),before);assert.equal(h.writes.length,writes);assert.equal(store.snapshot().comparisons.length,1);
});
test('Learning preview belongs to its exact originating store and is consumed after a successful merge',()=>{
 const h=learningStores(),store=h.create(),peer=h.create();store.add(h.row,store.read().token);const preview=store.previewImport(store.exportText()),before=h.records.get(store.key),writes=h.writes.length;
 assert.throws(()=>peer.merge(preview),/preview/i);assert.throws(()=>store.merge(structuredClone(preview)),/preview/i);assert.equal(h.records.get(store.key),before);assert.equal(h.writes.length,writes);
 store.merge(preview);const committed=h.records.get(store.key);assert.deepEqual(JSON.parse(committed).comparisons,[h.row]);assert.throws(()=>store.merge(preview),/preview/i);assert.equal(h.records.get(store.key),committed);
});
test('Learning reviewed ticket retains its original backing revision through an intervening peer update',()=>{
 const h=learningStores(),store=h.create();store.add(h.row,store.read().token);const preview=store.previewImport(store.exportText()),peer=h.create();peer.setEnabled(false,peer.read().token);const bytes=h.records.get(store.key),writes=h.writes.length;
 assert.throws(()=>store.merge(preview),/changed/i);assert.equal(h.records.get(store.key),bytes);assert.equal(h.writes.length,writes);
});
