'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const Policy=require('../src/ai-five-exclusion.js');
const Flow=require('../src/ai-five-flow.js');
class El {
  constructor(tag='div') {this.tag=tag;this.children=[];this.style={};this.dataset={};this.disabled=false;this.attrs={};this.textContent='';}
  append(...args){this.children.push(...args);return this;}
  replaceChildren(...args){this.children=args.slice();}
  setAttribute(k,v){this.attrs[k]=v;}
}
const host=new El('main'),summary=new El('p'),document={
  createElement:tag=>new El(tag),
  getElementById:id=>id==='page-outfits'?host:id==='outfit-summary'?summary:null
};
function wardrobe(n,watch='watch-1'){return {suitId:'S'+String(n).padStart(2,'0'),shirtId:'DS001',state:'T001',shoeId:'shoe-8',watchId:watch};}
const original=Array.from({length:20},(_,i)=>({_hewrsConnected:{canonical_selection:wardrobe(i+1)}}));
const request={automatic:true,source_lock:'dna-hash',prefs:{},executiveStyle:'CLASSIC',context:{occasion:'work',requiredFormality:'any'},localDate:'2026-11-17',environment:{source:'not_assessed',date:'2026-11-17'}};
let calls=0, applied=0, ready=true;
const feedback={match:()=>({allowed:true}),subscribe:()=>()=>{}};
const app={
  state:()=>({report:{options:original},request,optionCount:original.length}),
  ownerFeedback:feedback,
  visualStylist:{ready:()=>ready,propose:async()=>{calls++;return {proposals:Array.from({length:5},(_,i)=>({selection:wardrobe(i+21),occasion:'work',rationale:'Fixture'}))};}},
  connection:{validateSelection:selection=>{if(!selection?.suitId)throw Error('Invalid outfit');return selection;}},
  store:{readForGeneration:()=>({events:[]})},
  renderForStylist:async()=> 'data:image/jpeg;base64,fixture',
  apply:async()=>{applied++;return {cancelled:false}},
  showPage:()=>{}
};
const root={document,HEWRSApp:app,HEWRSAIFiveExclusion:Policy,HEWRSAIFiveFlow:Flow,
  HEWRSRejectionPreviewCore:{attach:()=>feedback},structuredClone,Date,
  addEventListener:()=>{}};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/ai-five-panel.js'),'utf8'),root);
(async()=>{
 assert.equal(host.children.length,1);const panel=host.children[0];
 assert.equal(panel.id,'hewrs-ai-five');assert.equal(root.HEWRSAIFivePanel.diagnostics().count,0);
 const button=panel.children[2];assert.equal(button.id,'generate-ai-five');
 ready=false;await button.onclick();assert.equal(calls,0);assert.equal(root.HEWRSAIFivePanel.diagnostics().count,0);
 ready=true;await button.onclick();assert.equal(calls,1);
 assert.equal(root.HEWRSAIFivePanel.diagnostics().count,5);
 const cards=panel.children[5];assert.equal(cards.children.length,5);
 await cards.children[0].children[3].onclick();assert.equal(applied,1);
 assert.equal(app.state().optionCount,20);assert.equal(original.length,20);
 assert.equal(request.executiveStyle,'CLASSIC');
 console.log('PASS panel: mounted separately, no provider when disconnected, five actual-avatar cards, preview without losing twenty');
})().catch(e=>{console.error(e);process.exitCode=1});