'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/preference-panel.js'),'utf8');
const A={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:'watch-AP09'},B={...A,shirtId:'DS027'};
const idle=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const ids=new Map(),fields=[],writes=[],checks=[],opens=[],previews=[];let live=true,modalToken=0,revision=0,rejected=false,queued=null,cancel=null,changed=0,holdCheck=false,releaseCheck=null;
 const node=(tag,text)=>{const n={tag,textContent:text||'',children:[],dataset:{},disabled:false,append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(){},decode:async()=>{}};Object.defineProperty(n,'id',{get(){return this._id;},set(value){this._id=value;ids.set(value,n);}});return n;};
 const g=vm.createContext({structuredClone,document:{createElement:node},console});
 g.HEWRS_PREFERENCE_PILOT={records:[],validation_topwear:[]};g.HEWRS_PREFERENCE_FOLLOWUP={records:[]};g.HEWRSStyleOccasions={occasion:x=>x,labels:{work:'Work',dinner:'Dinner'}};g.HEWRSSourceCorrections={revision:'same'};g.HEWRSOutfitLearning={selectionKey:JSON.stringify,contextPairKey:()=> 'pair'};
 vm.runInContext(source,g,{filename:'src/preference-panel.js'});
 const api=g.HEWRSPreferencePanel.create({
  connection:{hybrid:{researchPreference:{describeSelection:()=>({eligible:true})}}},
  learning:{model:()=>({token:'learning',state:{comparisons:[],enabled:true},model:{context_scope:{occasion:'work'},counts:{informative:0,topwear_groups:0,validation:0},acceptability:{active:false,counts:{positive:0,negative:0,groups:0,conflicting_outfits:0}}}}),assertCurrent(){},status:()=>({persistent:true}),previewImport(text){previews.push(text);return {added:1,already_saved:0};},exclusive(fn){return new Promise((resolve,reject)=>{queued=async()=>{try{resolve(await fn());}catch(e){reject(e);}};});},add(row,token){assert.equal(token,'learning');writes.push(structuredClone(row));}},
  openSheet(title,options={}){cancel?.();cancel=options.cancel||null;opens.push(title);live=true;return {body:node('div'),actions:node('div'),token:++modalToken};},closeSheet(){live=false;cancel?.();},active:token=>live&&token===modalToken,
  selectField(label,rows,value,id){const input=node('select');input.value=value;if(id)input.id=id;fields.push({label,rows,input});return {wrap:node('label'),input};},makeButton(text,fn){const b=node('button',text);b.onclick=fn;return b;},error(e){throw e;},onChanged(){changed++;},selectionItems:()=>[],
  context:()=>({occasion:'work',requiredFormality:'any'}),options:()=>[{shirtOnly:true,pantId:'PG001',shirtId:'DS029',state:'NO_TIE',shoeId:'shoe-1',watchId:null},{shirtOnly:true,pantId:'PG002',shirtId:'DS027',state:'NO_TIE',shoeId:'shoe-1',watchId:null}],
  async checkFeedback(_s,context,token=null){checks.push(context.occasion);assert.equal(context.occasion,'dinner');if(holdCheck){holdCheck=false;await new Promise(resolve=>{releaseCheck=resolve;});}if(rejected||token!==null&&token!==revision)throw Error('Outfit rejected during queued vote');return revision;},
  async render(_s,_cancel,context){assert.equal(context.occasion,'dinner');return {full:'data:image/png,synthetic',detail:'data:image/png,synthetic-detail'};}
 });
 return {api,ids,fields,writes,checks,opens,previews,get changed(){return changed;},get queued(){return queued;},reject(){rejected=true;revision++;},close(){live=false;cancel?.();},openOther(){cancel?.();cancel=null;live=true;modalToken++;opens.push('Another active panel');},holdNextCheck(){holdCheck=true;},get releaseCheck(){return releaseCheck;}};
}
for(const scenario of ['rejection','close','unchanged'])test('Queued preference vote handles '+scenario+' before the actual write',async()=>{
 const h=harness(),pair={id:null,a:A,b:B,context:{occasion:'dinner',requiredFormality:'any'},partition:'training'};
 await h.api.showPair(pair,()=>{},()=>{});h.ids.get('pref-reason').value='shoe_choice';
 const pending=h.ids.get('pref-vote-A').onclick();await idle();assert.ok(h.queued,'The real vote callback must reach the queued lock');assert.equal(h.ids.get('pref-reason').disabled,true);assert.equal(h.ids.get('pref-vote-A').disabled,true);
 h.ids.get('pref-reason').value='other';if(scenario==='rejection')h.reject();if(scenario==='close')h.close();await h.queued();await pending;
 assert.equal(h.writes.length,scenario==='unchanged'?1:0);assert.equal(h.changed,scenario==='unchanged'?1:0);
 if(scenario==='unchanged'){assert.equal(h.writes[0].context.occasion,'dinner');assert.equal(h.writes[0].reason,'shoe_choice');}
 if(scenario==='rejection'){assert.equal(h.ids.get('pref-pair-grid').hidden,true);assert.match(h.ids.get('pref-pair-status').textContent,/Comparison unavailable/);}
 assert.ok(h.checks.every(x=>x==='dinner'));
});
test('Closing during the feedback check after acquiring the lock prevents a vote',async()=>{
 const h=harness();await h.api.showPair({id:null,a:A,b:B,context:{occasion:'dinner',requiredFormality:'any'},partition:'training'},()=>{},()=>{});
 const pending=h.ids.get('pref-vote-A').onclick();await idle();h.holdNextCheck();const acquired=h.queued();await idle();assert.ok(h.releaseCheck);
 h.close();h.releaseCheck();await acquired;await pending;assert.equal(h.writes.length,0);assert.equal(h.changed,0);
});
test('Current shirt-only comparison choices name the configuration and exact trousers',()=>{
 const h=harness();h.api.compare();const labels=h.fields.find(x=>x.label==='A').rows.map(x=>x.label);
 for(const [i,label]of labels.entries()){assert.ok(!label.includes('undefined'));assert.match(label,/Shirt only/);assert.ok(label.includes(i===0?'PG001':'PG002'));}
});
for(const scenario of ['close','other_panel'])test('Delayed comparison preflight cannot reopen after '+scenario,async()=>{
 const h=harness();h.holdNextCheck();const preparing=h.api.showPair({id:null,a:A,b:B,context:{occasion:'dinner',requiredFormality:'any'},partition:'training'},()=>{},()=>{});
 await idle();assert.ok(h.releaseCheck);if(scenario==='close')h.close();else h.openOther();const before=h.opens.length;
 h.releaseCheck();await preparing;assert.equal(h.opens.length,before,'Stale preflight must not open another modal');assert.equal(h.writes.length,0);
});
for(const scenario of ['close','other_panel'])test('Delayed preference file reading cannot reopen after '+scenario,async()=>{
 const h=harness();h.api.open();const input=h.ids.get('pref-import-file');let release;input.files=[{size:10,text:()=>new Promise(resolve=>{release=resolve;})}];
 const importing=input.onchange();await idle();assert.ok(release);if(scenario==='close')h.close();else h.openOther();const before=h.opens.length;
 release('reviewed-backup');await importing;assert.equal(h.opens.length,before,'Abandoned file reading must not replace the current modal');assert.equal(h.previews.length,0);assert.equal(h.writes.length,0);
});
test('Only the latest preference file selection can publish its reviewed preview',async()=>{
 const h=harness();h.api.open();const input=h.ids.get('pref-import-file');let first,second;
 input.files=[{size:10,text:()=>new Promise(resolve=>{first=resolve;})}];const older=input.onchange();
 input.files=[{size:10,text:()=>new Promise(resolve=>{second=resolve;})}];const newer=input.onchange();second('newer-backup');await newer;const before=h.opens.length;
 first('older-backup');await older;assert.deepEqual(h.previews,['newer-backup']);assert.equal(h.opens.length,before);assert.equal(h.writes.length,0);
});
