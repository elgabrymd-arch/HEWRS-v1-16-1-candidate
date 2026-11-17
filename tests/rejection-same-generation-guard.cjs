'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('src/outfit-rejection-core.js', 'utf8');
const active = [];
const approved = [];
const connection = {
  ownerFeedback: {set(gate) { this.gate=gate; }},
  controller: {
    generateAsync: async (_q,_c,_h) => ({status:'ok',options:approved.map(id=>({id}))}),
    generate: () => ({status:'ok',options:approved.map(id=>({id}))})
  },
  selectionFromOption: option => ({selection:{id:option.id}})
};
const base = {
  hide(){}, importData(){}, restore(){}, reorder(rows){return rows;}, subscribe(){return ()=>{};},
  refresh() {return {events:[], active:active.map(id=>({id:'hide_'+id,scope:'outfit',occasion:'all',selection:{id},reason:null})), historical:[], token:active.join('|')};},
  match(s) {return {allowed:!active.includes(s.id), reasons:active.includes(s.id)?[{type:'hide',id:s.id}]:[]};}
};
const root = {
  Image:class Image{},
  structuredClone,
  crypto: {randomUUID:()=> 'stable-test-uuid'},
  HEWRSOutfitFeedback: {key: s => s.id, occasion: x=>x||'work',stable:JSON.stringify},
  HEWRSApp: {
    ownerFeedback:base,
    connection,
    state:()=>({preferences:{},context:{occasion:'work'}}),
    learning:{model:()=>({token:null})}
  }
};
root.globalThis=root;
vm.runInNewContext(source,root,{filename:'src/outfit-rejection-core.js'});
root.HEWRSRejectionPreviewCore.attach(root.HEWRSApp);
root.HEWRSCleanConnection={create:()=>connection};
const wrapped=root.HEWRSCleanConnection.create();
const q={context:{occasion:'work'}};
async function main(){
 for(let i=0;i<20;i++){
   const id='outfit-'+i;
   active.push(id);
   approved.splice(0,approved.length,'outfit-'+(i+1));
   const r=await wrapped.controller.generateAsync(q,{},[]);
   assert.equal(r.options[0].id,'outfit-'+(i+1));
 }
 approved.splice(0,approved.length, 'outfit-0');
 await assert.rejects(wrapped.controller.generateAsync(q,{},[]), /matches a saved rejection/);
 approved.splice(0,approved.length, 'outfit-21');
 const final=await wrapped.controller.generateAsync(q,{},[]);
 assert.equal(final.options[0].id,'outfit-21');
 console.log('Same-generation guard passed: 20 successive rejects; old rejection blocked; recovery allowed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
