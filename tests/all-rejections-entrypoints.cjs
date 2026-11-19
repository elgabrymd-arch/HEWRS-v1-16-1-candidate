'use strict';
// Execute the production entry-point functions with controlled asynchronous
// boundaries. The real engine is exercised separately in all-rejections-engine.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const application=fs.readFileSync('src/outfit-refill-application.js','utf8'),reviewed=fs.readFileSync('src/reviewed-rejection-integration.js','utf8');
const selection={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:'watch-AP09'};
const extract=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const noop=()=>{},need=(value,message)=>{if(!value)throw Error(message);};
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS:',name);}
function nodes(){const all=new Map();const node=(tag,text)=>{const x={tag,textContent:text||'',children:[],dataset:{},disabled:false,append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute:noop,getContext:()=>({drawImage:noop})};Object.defineProperty(x,'id',{get(){return this._id;},set(id){this._id=id;all.set(id,this);}});return x;};return {node,all,$:id=>{if(!all.has(id)){const n=node('div');n.id=id;}return all.get(id);}};}
async function applyContext(allowDestination=false){
 const dom=nodes(),calls={render:0,session:0},gate={allowed:(_s,context)=>allowDestination?context.occasion==='dinner':context.occasion!=='dinner',assertCurrent:noop};
 const context=vm.createContext({need,copy:structuredClone,current:null,currentOption:null,score:null,generation:0,busy:false,pendingInitialOutfit:null,origin:'manual',ctx:{occasion:'work',formality:'any',localDate:'2026-11-18'},root:{HEWRSStyleOccasions:{occasion:x=>x}},$:dom.$,
  checkRejectionFeedbackAsync:async()=>({token:'same'}),rejectionGate:()=>gate,autoWeather:{cancel:noop},connection:{validateSelection:s=>s,scoreSelection:()=>({})},renderer:{cancel:noop,async render(s,options){calls.render++;need(options.context.occasion==='dinner','Destination context was not forwarded');need(gate.allowed(s,options.context),'Outfit rejected in the render context');return {ready:true};}},
  store:{exclusive:async fn=>fn(),assertCurrent:noop,saveSession(){calls.session++;},readForGeneration:()=>({token:'history'})},learning:{assertCurrent:noop},currentContext:()=>({occasion:'work',requiredFormality:'any'}),ui:{fromSelection:noop},setMode:noop,setBusy:noop,status:noop,presentFrame:noop,displayCurrent:noop,updateHome:noop,refreshHistory:noop,sessionValue:noop,selection,context:{occasion:'dinner',requiredFormality:'any'}});
 vm.runInContext(extract(application,'async function apply(s,opts={})','async function selectOption('),context);
 if(allowDestination){await vm.runInContext('apply(selection,{context})',context);check('Apply forwards an allowed destination occasion to the renderer',()=>{assert.equal(calls.render,1);assert.equal(calls.session,1);assert.deepEqual(context.current,selection);});}
 else{await assert.rejects(vm.runInContext('apply(selection,{context})',context),/rejected/);check('Apply checks the destination occasion before rendering or saving',()=>{assert.equal(calls.render,0);assert.equal(calls.session,0);assert.equal(context.current,null);});}
}
async function exportCase(when){
 const dom=nodes();let revision=0,rejected=false,pngCalls=0,links=0,release,started;
 const pngStarted=new Promise(resolve=>{started=resolve;});
 const model={selection:structuredClone(selection),date:'2026-11-18'},gate={allowed:()=>!rejected,assertCurrent(token){need(token===revision,'Feedback changed');}};
 const pngWait=when==='during'?new Promise(resolve=>{release=resolve;}):Promise.resolve();
 const context=vm.createContext({need,copy:structuredClone,current:selection,busy:false,generation:0,modalEpoch:0,pageName:'outfits',options:[],lastRequest:null,cardPresentation:model,cardModel:()=>structuredClone(model),currentContext:()=>({occasion:'work'}),$:dom.$,el:dom.node,modal:null,
  document:{createElement:dom.node},URL:{createObjectURL(){links++;return 'blob:synthetic';},revokeObjectURL:noop},resolveUrl:noop,
  checkRejectionFeedbackAsync:async()=>({token:revision}),rejectionGate:()=>gate,
  optionCards:{async png(){pngCalls++;started();await pngWait;return {};},async book(){await pngWait;return {};}},dismissSheet:noop,
  button(text,fn){const n=dom.node('button',text);n.onclick=fn;return n;}
 });
 context.openSheet=()=>{context.modal={token:'sheet'};return {body:dom.node('div'),actions:dom.node('div'),token:'sheet'};};
 vm.runInContext(extract(application,'async function exportOptionCards()','\nfunction presentFrame()'),context);
 await vm.runInContext('exportOptionCards()',context);
 if(when==='before'){rejected=true;revision++;}
 const preparing=dom.$('export-card-png').onclick();
 if(when==='during'){await pngStarted;rejected=true;revision++;release();}
 await preparing;
 check('Card export blocks a rejection '+when+' preparation',()=>{assert.equal(links,0);assert.equal(pngCalls,when==='before'?0:1);assert.match(dom.$('card-export-status').textContent,/Export not completed/);});
}
async function reviewedSave(){
 const dom=nodes();for(const [id,value]of [['rd-hide-scope','clothing'],['rd-hide-occasion','current'],['rd-hide-reason','colors']])dom.$(id).value=value;
 let release,saved;const waiting=new Promise(resolve=>{release=resolve;});
 const context=vm.createContext({actionBusy:false,currentId:'O01',lastHide:null,$:dom.$,entry:()=>({}),native:()=>selection,request:()=>({occasion:'work'}),isExplore:()=>false,isPipeline:()=>false,synchronizeFeedback:()=>waiting,
  dialog:{querySelectorAll(selector){return [...dom.all.values()].filter(n=>selector.includes('#'+n.id));}},
  fb:{async hide(s,settings){saved=structuredClone(settings);return {id:'saved'};},alternative:()=>null},app:{rejectionChanged:async()=>{}},update:async()=>({}),candidateRows:()=>[],ownerContext:q=>q,render:async()=>{}});
 vm.runInContext(extract(reviewed,'function setActionBusy(value)','function feedbackChanged()')+extract(reviewed,'async function hide()','async function undo()'),context);
 const operation=vm.runInContext('hide()',context);
 check('Reviewed save disables scope, occasion and reason during persistence',()=>{for(const id of ['rd-hide-scope','rd-hide-occasion','rd-hide-reason'])assert.equal(dom.$(id).disabled,true,id);});
 dom.$('rd-hide-scope').value='outfit';dom.$('rd-hide-occasion').value='all';dom.$('rd-hide-reason').value='footwear';release();await operation;
 check('Reviewed save persists the settings captured at the initial click',()=>assert.deepEqual(saved,{scope:'clothing',context:'work',reason:'colors'}));
}
async function largerView(){
 const dom=nodes();let opened=0,copied=0;
 const gate={allowed:()=>false,assertCurrent:noop};
 const context=vm.createContext({need,copy:structuredClone,current:selection,busy:false,generation:0,modalEpoch:0,pageName:'outfits',lastRequest:null,modal:null,$:dom.$,ids:()=>'',currentContext:()=>({occasion:'work'}),rejectionGate:()=>gate,checkRejectionFeedbackAsync:async()=>({token:'changed'}),dismissSheet:noop,
  el(tag,text){const n=dom.node(tag,text);if(tag==='canvas')n.getContext=()=>({drawImage(){copied++;}});return n;},button:dom.node});
 context.openSheet=()=>{opened++;context.modal={};return {body:dom.node('div'),actions:dom.node('div')};};
 vm.runInContext(extract(application,'async function largerOutfit()','\nfunction contextSheet('),context);
 await assert.rejects(vm.runInContext('largerOutfit()',context),/rejected/);
 check('Larger view cannot copy pixels rejected during feedback synchronization',()=>{assert.equal(opened,0);assert.equal(copied,0);});
}
async function preferenceRender(){
 const dom=nodes();let revision=0,rendered=0,changeDuringRender=false;
 const gate={allowed:(_s,c)=>c.occasion==='dinner',assertCurrent(token){need(token===revision,'Feedback changed');}};
 const context=vm.createContext({setInterval,clearInterval,need,selection,checkRejectionFeedbackAsync:async()=>({token:revision}),rejectionGate:()=>gate,currentContext:()=>({occasion:'work'}),connection:{},resolveUrl:noop,
  document:{createElement(){const n=dom.node('canvas');n.toDataURL=()=> 'data:image/jpeg,synthetic';n.getContext=()=>({drawImage:noop,fillRect:noop});return n;}},
  root:{HEWRSAtomicRenderer:{create(){return {cancel:noop,async render(){rendered++;if(changeDuringRender)revision++;return {cancelled:false};}};}}}});
 vm.runInContext(extract(application,'async function checkPreferenceFeedback(','function syncLearningFor('),context);
 await assert.rejects(vm.runInContext('renderForPreference(selection)',context),/rejected/);
 check('A new preference image is blocked before rendering in its rejected occasion',()=>assert.equal(rendered,0));
 const allowed=await vm.runInContext('renderForPreference(selection,()=>false,{occasion:"dinner"})',context);
 check('Preference rendering uses the actual pair occasion instead of Home occasion',()=>{assert.equal(rendered,1);assert.match(allowed.full,/^data:/);});
 changeDuringRender=true;await assert.rejects(vm.runInContext('renderForPreference(selection,()=>false,{occasion:"dinner"})',context),/Feedback changed/);
 check('Preference image publication rejects a changed feedback revision',()=>assert.equal(rendered,2));
}
async function comparisonPair(scenario){
 const dom=nodes();let revision=0,rejected=scenario==='initial',renders=0,votes=0,title='';const contexts=[];
 const pair={id:null,a:selection,b:{...selection,shirtId:'DS028'},context:{occasion:'dinner',requiredFormality:'any'},partition:'validation'};
 const context=vm.createContext({structuredClone,document:{createElement:dom.node},console});
 context.HEWRS_PREFERENCE_PILOT={records:[],validation_topwear:[]};context.HEWRS_PREFERENCE_FOLLOWUP={records:[]};context.HEWRSStyleOccasions={occasion:x=>x,labels:{dinner:'Dinner'}};context.HEWRSSourceCorrections={revision:'same'};
 context.HEWRSOutfitLearning={selectionKey:JSON.stringify,contextPairKey:()=> 'pair'};
 vm.runInContext(fs.readFileSync('src/preference-panel.js','utf8'),context);
 const api=context.HEWRSPreferencePanel.create({
  connection:{hybrid:{researchPreference:{describeSelection:()=>({eligible:true})}}},learning:{model:()=>({token:'learning',state:{comparisons:[]}}),assertCurrent:noop,status:()=>({persistent:true}),exclusive:async fn=>fn(),add(){votes++;}},
  openSheet(name){title=name;return {body:dom.node('div'),actions:dom.node('div'),token:1};},closeSheet:noop,active:()=>true,context:()=>({occasion:'work'}),onChanged:noop,selectionItems:()=>[],
  selectField(){return {wrap:dom.node('div'),input:{value:'no_reason'}};},makeButton(text,fn){const n=dom.node('button',text);n.onclick=fn;return n;},
  async checkFeedback(selections,c,token=null){contexts.push(c.occasion);need(!rejected,'Outfit rejected');need(token===null||token===revision,'Feedback changed');return revision;},
  async render(_s,_cancel,c){renders++;assert.equal(c.occasion,'dinner');if(scenario==='during'&&renders===2){rejected=true;revision++;}return {full:'data:full',detail:'data:detail'};}
 });
 // Browser images decode asynchronously; the synthetic image uses a completed decode.
 const make=dom.node;context.document.createElement=(tag,...args)=>{const n=make(tag,...args);if(tag==='img')n.decode=async()=>{};return n;};
 await api.showPair(pair,noop,noop);
 if(scenario==='vote'){rejected=true;revision++;await dom.$('pref-vote-A').onclick();}
 check('New comparison blocks rejected pair at '+scenario+' boundary without saving a vote',()=>{assert.equal(votes,0);assert.ok(contexts.every(c=>c==='dinner'));if(scenario==='initial'){assert.equal(renders,0);assert.equal(title,'Comparison unavailable');}else{assert.equal(dom.$('pref-pair-grid').hidden,true);assert.equal(dom.$('pref-vote-A').disabled,true);assert.match(dom.$('pref-pair-status').textContent,/Comparison unavailable/);}});
}
async function refillBatch(scenario){
 const dom=nodes(),stable=JSON.stringify,originals=[selection,{...selection,state:'T024',shoeId:'shoe-3',watchId:'watch-R13'}];
 const row=s=>({_hewrsConnected:{canonical_selection:structuredClone(s),id:stable(s),compatibility:{}}});
 const all=[...originals,...Array.from({length:18},(_,i)=>({...selection,shirtId:'DS'+String(i+1).padStart(3,'0'),state:'T'+String(i+1).padStart(3,'0')}))].map(row);
 const accepted=all.slice(2).map(stable),q={automatic:true,context:{occasion:'work',requiredFormality:'any'}},ctx={occasion:'work',formality:'any',localDate:'2026-11-18'};
 let calls=0,sessions=0,exposed=0,frames=0;const gate={refresh:()=>({token:'same'}),assertCurrent:noop,allowed:s=>s.shirtId!=='DS029'};
 const context=vm.createContext({need,copy:structuredClone,errorText:e=>e.message,$:dom.$,generation:0,busy:false,current:structuredClone(selection),currentOption:all[0],options:all,optionIndex:0,rejectionPosition:0,rejectionRemoved:null,lastRequest:q,report:{options:all},producing:{kind:'engine',mode:'engine',prefs:{},context:ctx},ctx,mode:'engine',origin:'engine',modal:null,optionHistoryToken:'history',optionPreferenceToken:'preference',selectionKey:stable,
  root:{HEWRSOutfitFeedback:{stable,key:s=>stable({...s,watchId:null})},HEWRSOptionSetPolicy:{target:20,inspect:()=>({})}},
  rejectionGate:()=>gate,checkRejectionFeedbackAsync:async()=>({token:'same'}),renderer:{cancel:noop},visualStylist:{cancel:noop},autoWeather:{cancel:noop},ui:{snapshot:()=>({})},
  connection:{validateSelection:s=>s,selectionFromOption:o=>({selection:o._hewrsConnected.canonical_selection}),controller:{verifyOptionSet:()=>true}},
  tieExposure:{newId:()=> 'synthetic-exposure'},store:{exclusive:async fn=>fn(),assertCurrent:noop,readForGeneration:()=>({token:'history',events:[]}),saveSession(){sessions++;}},learning:{assertCurrent:noop},weather:{},
  setBusy(value){context.busy=value;},status:noop,rejectionSummary:()=>({}),updateHome:noop,refreshHistory:noop,showPage:noop,currentContext:()=>q.context,sessionValue:noop,recordTieSuggestions(_q,rows){exposed+=rows.length;},
  async apply(s){frames++;context.current=structuredClone(s);return {ready:true};}
 });
 context.connection.controller.generateAsync=async(_q,_cat,_history,opts)=>{
  calls++;assert.equal(context.options.length,18,'A partial batch was published before the complete operation finished');
  assert.deepEqual(context.options.map(stable),accepted);assert.equal(stable(opts.replaceFor),stable(originals[calls-1]));
  if(scenario==='cancel'&&calls===2){context.generation++;return {status:'cancelled',options:[]};}
  if(scenario==='first_exhausted'&&calls===1)return {options:opts.retainedOptions,reason:'No compatible different shirt is available with the accepted pieces.'};
  const changed=scenario==='wrong_part'?{...opts.replaceFor,state:'T047'}:{...opts.replaceFor,shirtId:'DS028'};
  return {options:[...opts.retainedOptions,row(changed)],reason:'Changed only the shirt.'};
 };
 vm.runInContext(fs.readFileSync('src/style-occasion-policy.js','utf8'),context);
 context.root.HEWRSStyleOccasions=context.HEWRSStyleOccasions;
 vm.runInContext(extract(application,'function rejectionChanged()','async function refillRejected(')+extract(application,'async function refillRejected(','\nfunction invalidateRecommendations('),context);
 vm.runInContext('rejectionChanged()',context);
 const operation=vm.runInContext('refillRejected({replaceFor:current,replaceParts:["shirt"]})',context);
 if(scenario==='wrong_part')await assert.rejects(operation,/changed an accepted garment/);else await operation;
 check('Application multi-row replacement '+scenario+' retains atomic publication',()=>{
  assert.deepEqual(context.options.slice(0,18).map(stable),accepted);
  if(scenario==='success'){assert.equal(calls,2);assert.equal(context.options.length,20);assert.equal(context.current.shirtId,'DS028');assert.equal(context.current.state,originals[0].state);assert.equal(sessions,1);assert.equal(exposed,2);assert.equal(context.report.refill.replacements.length,2);}
  else if(scenario==='first_exhausted'){assert.equal(context.options.length,19);assert.equal(context.current.state,originals[1].state);assert.match(context.report.reason,/No compatible replacement was found for the displayed outfit/);assert.equal(exposed,1);}
  else{assert.equal(context.options.length,18);assert.equal(sessions,0);assert.equal(exposed,0);assert.equal(frames,0);}
 });
}
async function main(){const errors=[];for(const run of [applyContext,()=>applyContext(true),()=>exportCase('before'),()=>exportCase('during'),reviewedSave,largerView,preferenceRender,()=>comparisonPair('initial'),()=>comparisonPair('during'),()=>comparisonPair('vote'),()=>refillBatch('success'),()=>refillBatch('cancel'),()=>refillBatch('first_exhausted'),()=>refillBatch('wrong_part')])try{await run();}catch(error){errors.push(error);console.error(error);}if(errors.length)throw new AggregateError(errors,'Entry-point rejection checks failed');console.log('ALL REJECTIONS ENTRYPOINTS:',checks,'checks passed');}
main().catch(error=>{console.error(error);process.exitCode=1;});
