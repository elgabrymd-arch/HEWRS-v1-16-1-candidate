'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),copy=structuredClone;
function fixture(){
 const ids=new Map(),panels=[],records=new Map(),lockQueue=new Map();let panel=null,epoch=0,changed=0;
 const locks={request(name,options,fn){const result=(lockQueue.get(name)||Promise.resolve()).then(fn);lockQueue.set(name,result.catch(()=>{}));return result;}};
 const element=tag=>{const node={tag,children:[],textContent:'',append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},setAttribute(){}};Object.defineProperty(node,'id',{get(){return this._id;},set(id){this._id=id;ids.set(id,node);}});return node;};
 function closeSheet(){panel?.cancel?.();panel=null;epoch++;}
 function openSheet(title,options={}){closeSheet();panel={title,token:++epoch,body:element('div'),actions:element('div'),cancel:options.cancel};panels.push(panel);return panel;}
 const root=vm.createContext({structuredClone,Date,document:{createElement:element},navigator:{locks},HEWRSSourceCorrections:{revision:'audit'},HEWRSStyleOccasions:{known:()=>true,occasion:x=>x,labels:{work:'Work',dinner:'Dinner',weekend:'Weekend'}},HEWRS_PREFERENCE_PILOT:{records:[],validation_topwear:[]},HEWRS_PREFERENCE_FOLLOWUP:{records:[]}});
 for(const file of ['src/outfit-learning.js','src/preference-panel.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),root);
 const connection={validateSelection:copy,hybrid:{researchPreference:{describeSelection:()=>({eligible:true,vector:Array(12).fill(.5)})}}};
 const backend={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
 const learning=root.HEWRSOutfitLearning.create(connection,'a'.repeat(64),backend);
 const api=root.HEWRSPreferencePanel.create({connection,learning,openSheet,closeSheet,active:token=>panel?.token===token,makeButton:(text,onclick)=>{const node=element('button');node.textContent=text;node.onclick=onclick;return node;},selectField:()=>({}),onChanged:()=>changed++,render:()=>{},selectionItems:()=>[],options:()=>[],context:()=>({occasion:'work',requiredFormality:'any'}),error:error=>{throw error;}});
 const selection={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:null};
 const row={id:'pref_original',created_at:'2026-11-19T01:00:00.000Z',a:selection,b:{...selection,state:'T009'},vote:'A',reason:'no_reason',partition:'training',pilot_id:null,context:{occasion:'work',requiredFormality:'any'},source_revision:'audit'};
 const buttons=()=>[...panel.body.children,...panel.actions.children].filter(x=>x.tag==='button');
 return {learning,api,ids,records,panels,row,closeSheet,openSheet,buttons,current:()=>panel,changed:()=>changed,async hold(){let release;const wait=locks.request(learning.key,{mode:'exclusive'},()=>new Promise(resolve=>{release=resolve;}));await Promise.resolve();return async()=>{release();await wait;};}};
}
async function probe(action,cancel){
 const h=fixture();if(action==='undo')h.learning.add(h.row,h.learning.read().token);h.api.open();
 let click;
 if(action==='pause')click=h.ids.get('pref-learning-toggle').onclick;
 else if(action==='undo'){h.ids.get('pref-undo').onclick();click=h.buttons().find(x=>x.textContent==='Confirm undo').onclick;}
 else{const doc={schema:'hewrs.outfit-preferences.v1',source_lock:'a'.repeat(64),revision:1,enabled:true,comparisons:[h.row]},input=h.ids.get('pref-import-file');input.files=[{size:100,text:async()=>JSON.stringify(doc)}];await input.onchange();click=h.buttons().find(x=>x.textContent==='Confirm preference merge').onclick;}
 const initial=h.learning.exportText(),release=await h.hold(),pending=click();
 if(cancel==='close')h.closeSheet();else if(cancel==='another_panel')h.openSheet('Unrelated active panel');
 const opens=h.panels.length;await release();await pending;
 return{action,cancel,changed_saved_data:h.learning.exportText()!==initial,on_changed:h.changed(),opened_new_panel:h.panels.length>opens,final_panel:h.current()?.title||null,remaining_records:h.learning.snapshot().comparisons.length,enabled:h.learning.snapshot().enabled};
}
for(const action of ['pause','import','undo']){
 for(const cancellation of ['close','another_panel'])test('Actual queued preference '+action+' cannot commit or reopen after '+cancellation,async()=>{
  const result=await probe(action,cancellation);
  assert.equal(result.changed_saved_data,false,'Closing/replacing the action modal before lock acquisition cancels the save');
  assert.equal(result.on_changed,0);assert.equal(result.opened_new_panel,false);
  assert.equal(result.final_panel,cancellation==='close'?null:'Unrelated active panel');
 });
 test('Actual queued preference '+action+' succeeds once while its reviewed modal remains active',async()=>{
  const result=await probe(action,'unchanged');assert.equal(result.changed_saved_data,true);assert.equal(result.on_changed,1);assert.equal(result.opened_new_panel,true);assert.equal(result.final_panel,'Outfit preferences');
  if(action==='pause')assert.equal(result.enabled,false);else assert.equal(result.remaining_records,action==='import'?1:0);
 });
}
