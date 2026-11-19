'use strict';
// Execute the actual candidate prepare function and export-button handler with
// production rejection stores. Only image/network/DOM work is substituted.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),crypto=require('node:crypto');
const {indexedDB,IDBKeyRange}=require('fake-indexeddb');
const F=require('../src/owner-feedback.js'),T=require('../src/tie-feedback.js'),D=require('../src/rejection-database.js');
const ROOT=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(ROOT,'src/image-assessment-panel.js'),'utf8');
const core=fs.readFileSync(path.join(ROOT,'src/outfit-rejection-core.js'),'utf8');
const start=source.indexOf('async function prepareCurrent('),end=source.indexOf('async function load()',start);
const handlerStart=source.indexOf('exportBtn.onclick=')+'exportBtn.onclick='.length,handlerEnd=source.indexOf(';const importBtn=',handlerStart);
assert.ok(start>=0&&end>start&&handlerStart>0&&handlerEnd>handlerStart);
const prepareSource=source.slice(start,end),handlerSource=source.slice(handlerStart,handlerEnd);
const selected={topwear:'S05',pants:null,shirt:'DS029',tie:'T029',shoe:'shoe-1'};
const clone=structuredClone;let serial=0;
function storage(){const rows=new Map();return{rows,broken:false,get length(){if(this.broken)throw Error('synthetic durable read failure');return rows.size;},key(i){if(this.broken)throw Error('synthetic durable read failure');return [...rows.keys()][i]??null;},getItem(k){if(this.broken)throw Error('synthetic durable read failure');return rows.get(k)??null;},setItem:(k,v)=>rows.set(k,String(v))};}
async function fixture(kind='legacy',hooks={}){
 const backend=storage(),databaseName='five-round-image-'+(++serial),base=kind==='indexed'?D.create({indexedDB,keyRange:IDBKeyRange,legacyStorage:backend,feedback:F,tieFeedback:T,validateSelection:F.normal,databaseName,broadcastChannel:null,id:()=> 'image_audit_'+(++serial)}):F.create({storage:backend,validateSelection:F.normal,id:()=> 'image_audit_'+(++serial)});
 if(base.ready)await base.ready;else base.refresh();
 const root={Image:class{},crypto:crypto.webcrypto,localStorage:backend,HEWRSOutfitFeedback:F,HEWRSTieFeedback:T};
 new Function('globalThis',core)(root);
 const gate=root.HEWRSRejectionPreviewCore.attach({ownerFeedback:base,ownerFeedbackPersistent:true,connection:{validateSelection:F.normal,ownerFeedback:{set(){}}}});
 const state={entry:{id:'explore_S05',kind:'unreviewed_possibility',outfit:clone(selected)},request:{style:'CLASSIC',occasion:'work',mode:'suit',formality:'any',anchors:{}},watch:null,ownerUseCase:null};
 const integration={currentEntry:()=>state.entry,request:()=>state.request,watch:()=>state.watch,ownerContext:q=>({...q,owner_use_case:state.ownerUseCase})};
 const calls={boards:0,requests:[],downloads:[],messages:[],publications:0},packet={request_sha256:'a'.repeat(64),request:{outfit:clone(selected)},board_data_url:'synthetic_garment_board'};
 let insidePublication=false;
 const feedback=kind==='indexed'?Object.freeze({...gate,async withCurrent(token,publish){if(hooks.beforePublish)await hooks.beforePublish(h);return gate.withCurrent(token,()=>{insidePublication=true;calls.publications++;try{return publish();}finally{insidePublication=false;}});}}):gate;
 root.HEWRSApp={outfitFeedback:feedback};root.HEWRSReviewedIntegration=integration;
 const exchange={sourceImages:outfit=>[{id:outfit.shirt,component:'full_shirt_evidence'}],async request(value){calls.requests.push(clone(value));if(hooks.request)await hooks.request(h);return packet;}};
 const board=async(outfit,refs)=>{calls.boards++;if(hooks.board)await hooks.board(h);return{width:1600,height:940,data_url:'synthetic_board'};};
 const message=(text,error)=>calls.messages.push({text,error:!!error}),download=(name,value)=>calls.downloads.push({name,value,insidePublication});
 const panel=new Function('root','load','board','exchange','message','download',`let busy=false,lastPacket=null;${prepareSource}\nreturn {prepareCurrent,click:${handlerSource},busy:()=>busy,lastPacket:()=>lastPacket};`)(root,async()=>true,board,exchange,message,download);
 const h={backend,base,gate,state,calls,packet,panel,close:()=>base.close?.(),async peerHide(){const peer=D.create({indexedDB,keyRange:IDBKeyRange,legacyStorage:backend,feedback:F,tieFeedback:T,validateSelection:F.normal,databaseName,broadcastChannel:null,id:()=> 'image_peer_'+(++serial)});try{await peer.ready;await peer.hide({...selected,watch:state.watch},{scope:'clothing',context:'work'});}finally{peer.close();}}};
 return h;
}
for(const kind of ['legacy','indexed']){
 test(kind+' image preparation retains its existing packet API for an allowed outfit',async()=>{
  const h=await fixture(kind);try{assert.equal(await h.panel.prepareCurrent(),h.packet);assert.equal(h.panel.lastPacket(),h.packet);assert.equal(h.calls.requests.length,1);assert.deepEqual(h.calls.requests[0].outfit,selected);assert.equal(h.calls.downloads.length,0);assert.equal(h.panel.busy(),false);}finally{h.close();}
 });
 test(kind+' real export handler downloads exactly once after its final rejection check',async()=>{
  const h=await fixture(kind);try{await h.panel.click();assert.equal(h.calls.downloads.length,1);assert.equal(h.calls.downloads[0].value,h.packet);assert.match(h.calls.downloads[0].name,/^HEWRS_IMAGE_REVIEW_REQUEST_[a-f0-9]{12}\.json$/);if(kind==='indexed')assert.equal(h.calls.downloads[0].insidePublication,true);assert.equal(h.panel.busy(),false);}finally{h.close();}
 });
 test(kind+' rejection during final packet hashing refuses both publication and actual export',async()=>{
  const h=await fixture(kind,{request:async h=>{await h.gate.hide({...selected,watch:null},{scope:'clothing',context:'work'});}});try{await h.panel.click();assert.equal(h.calls.requests.length,1);assert.equal(h.calls.downloads.length,0);assert.equal(h.panel.lastPacket(),null);assert.equal(h.panel.busy(),false);assert.ok(h.calls.messages.some(x=>x.error&&/changed|reject|excluded/i.test(x.text)));}finally{h.close();}
 });
}
test('temporary skip while the final packet is being prepared blocks export without persisting it',async()=>{
 const h=await fixture('indexed',{request:h=>h.gate.skip({...selected,watch:null},{scope:'topwear_tie',context:'work'})});try{await assert.rejects(h.panel.prepareCurrent(),/changed/);assert.equal(h.panel.lastPacket(),null);assert.equal(h.calls.downloads.length,0);assert.equal(h.gate.snapshot().events.length,0);}finally{h.close();}
});
for(const [name,change] of [
 ['same-ID outfit',s=>s.entry.outfit.shirt='DS007'],
 ['occasion',s=>s.request.occasion='dinner'],
 ['anchor',s=>s.request.anchors.tie='T009'],
 ['watch',s=>s.watch='watch-AP09'],
 ['owner-use context',s=>s.ownerUseCase='summer_weekend_dinner'],
 ['entry status',s=>s.entry.kind='reviewed']
])test('image export captures '+name+' and refuses changes during final packet preparation',async()=>{
 const h=await fixture('indexed',{request:h=>change(h.state)});try{await assert.rejects(h.panel.prepareCurrent(),/Selection or context changed/);assert.equal(h.panel.lastPacket(),null);assert.equal(h.calls.downloads.length,0);assert.equal(h.panel.busy(),false);}finally{h.close();}
});
test('a changed rejection during board loading prevents the final exchange request entirely',async()=>{
 const h=await fixture('legacy',{board:h=>h.gate.skip({...selected,watch:null},{scope:'shirt_tie',context:'work'})});try{await assert.rejects(h.panel.prepareCurrent(),/changed/);assert.equal(h.calls.requests.length,0);assert.equal(h.panel.lastPacket(),null);}finally{h.close();}
});
test('a peer rejection at the queued publication boundary prevents the actual download',async()=>{
 const h=await fixture('indexed',{beforePublish:h=>h.peerHide()});try{await h.panel.click();assert.equal(h.calls.requests.length,1);assert.equal(h.calls.publications,0);assert.equal(h.calls.downloads.length,0);assert.equal(h.panel.lastPacket(),null);}finally{h.close();}
});
test('failed initial durable feedback read releases busy and permits a repaired-storage retry',async()=>{
 const h=await fixture();try{h.backend.broken=true;await assert.rejects(h.panel.prepareCurrent(),/durable read failure/);assert.equal(h.panel.busy(),false);assert.equal(h.calls.requests.length,0);h.backend.broken=false;assert.equal(await h.panel.prepareCurrent(),h.packet);assert.equal(h.panel.busy(),false);}finally{h.close();}
});
test('a previously saved Work-only rejection blocks Work but permits the same allowed Dinner request',async()=>{
 const h=await fixture('indexed');try{await h.gate.hide({...selected,watch:null},{scope:'topwear_tie',context:'work'});await assert.rejects(h.panel.prepareCurrent(),/excluded/);assert.equal(h.calls.requests.length,0);h.state.request.occasion='dinner';assert.equal(await h.panel.prepareCurrent(),h.packet);}finally{h.close();}
});
test('candidate panel preserves the frozen Standard resource and every image/source/import operation',()=>{
 const original=fs.readFileSync(path.join(ROOT,'hewrs-batch10-image-panel-f200023e7632fa28.js'),'utf8');
 assert.equal(crypto.createHash('sha256').update(original).digest('hex'),'f200023e7632fa28ea1ef3cacc4b4974d751ae8efecf9146eeabb9ec14c7885c');
 const unchanged=s=>s.slice(s.indexOf('function bytesData('),s.indexOf('async function prepareCurrent('));
 assert.equal(unchanged(source),unchanged(original));
 const load=s=>s.slice(s.indexOf('async function load()'),s.indexOf('function build()'));
 assert.equal(load(source),load(original));
 assert.match(fs.readFileSync(path.join(ROOT,'stage10-integration.html'),'utf8'),/hewrs-batch10-image-panel-f200023e7632fa28\.js/);
});
