'use strict';
// Adversarial current-card/list-context regression using the production application
// functions, real engine, wardrobe validator and Home preference model. Only
// image encoding/DOM presentation and unrelated services are replaced here.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {load,config}=require('./tie-engine-loader.cjs');
const source=fs.readFileSync('src/outfit-refill-application.js','utf8');
function production(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,'Production function boundaries changed');return source.slice(a,b);}
const plain=value=>JSON.parse(JSON.stringify(value));
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS:',name);}
async function main(){
 const h=load(),g=h.g,c=h.connection,noop=()=>{},nodes=new Map(),calls={png:0,book:0,downloads:0};
 function element(tag,text){
  const node={tag,textContent:text||'',children:[],dataset:{},hidden:false,disabled:false,
   append(...values){this.children.push(...values);},replaceChildren(...values){this.children=values;},setAttribute:noop,getContext:()=>({drawImage:noop})};
  Object.defineProperty(node,'id',{get(){return this._id;},set(id){this._id=id;nodes.set(id,this);}});return node;
 }
 const $=id=>{if(!nodes.has(id)){const node=element('div');node.id=id;}return nodes.get(id);};
 const saved=g.structuredClone({suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:'watch-AP09'});
 const workBan=h.feedback.hide(saved,{scope:'clothing',context:'work'}),gate={...h.gate,allowed:(selection,context)=>h.gate.match(selection,context).allowed};
 const ui=g.HEWRSFaceliftModel.create(c);ui.fromSelection(saved);
 const cards=g.HEWRSOptionCards.create(c);
 Object.assign(g,{
  root:g,need:(value,message)=>{if(!value)throw Error(message);},copy:g.structuredClone,connection:c,ui,mode:'engine',
  ctx:g.structuredClone({occasion:'work',formality:'any',style:'AUTO',localDate:'2026-11-18'}),
  current:null,currentOption:null,score:null,origin:'manual',generation:0,busy:false,modalEpoch:0,pageName:'outfits',
  pendingInitialOutfit:g.structuredClone({selection:saved,context:{occasion:'dinner',requiredFormality:'any'},localDate:'2026-11-18'}),initialOutfitPromise:null,
  options:[],optionIndex:-1,lastRequest:null,lastAttemptRequest:null,report:null,producing:null,optionHistoryToken:null,optionPreferenceToken:null,modal:null,cardPresentation:null,
  cardModel:selection=>cards.model(selection,{date:'2026-11-18'}),$,el:element,document:{createElement:element},
  checkRejectionFeedbackAsync:async()=>gate.refresh(),rejectionGate:()=>gate,autoWeather:{cancel:noop},renderer:{cancel:noop,async render(){return {ready:true};}},
  syncLearningFor:()=>({token:'learning'}),store:{exclusive:async fn=>fn(),assertCurrent:noop,readForGeneration:()=>({token:'history',events:[]}),saveSession:noop},learning:{assertCurrent:noop},tieExposure:{newId:()=> 'synthetic'},
  status:noop,updateHome:noop,refreshHistory:noop,presentEmpty:noop,presentFrame:noop,showPage:noop,recordTieSuggestions:noop,showGenerationFailure:error=>{throw error;},errorText:error=>error.message,
  renderForStylist:noop,setMode:noop,resolveUrl:noop,dismissSheet:noop,sessionValue:noop,weatherSummary:()=>'',
  styleLabels:{AUTO:'Automatic',CLASSIC:'Classic',HYBRID:'Hybrid',MODERN:'Modern'},selectionKey:selection=>JSON.stringify(c.historyIds(selection))
 });
 g.HEWRSRuntimeLoader={ensureIndex:async()=>{}};
 g.URL={createObjectURL(){calls.downloads++;return 'blob:synthetic-'+calls.downloads;},revokeObjectURL:noop};
 g.optionCards={model:cards.model,async png(){calls.png++;return {};},async book(){calls.book++;return {};}};
 g.setBusy=value=>{g.busy=value;};g.displayCurrent=()=>{if(g.current)g.cardPresentation=cards.model(g.current,{date:g.ctx.localDate});};
 let sheetId=0;
 g.openSheet=(_title,settings={})=>{g.modal?.cancel?.();g.modal={token:++sheetId,cancel:settings.cancel};return {body:element('div'),actions:element('div'),token:g.modal.token};};
 g.button=(text,fn)=>{const node=element('button',text);node.onclick=fn;return node;};
 vm.runInContext(production('function currentContext()','function weatherSummary(')+
  production('async function apply(s,opts={})','function recordTieSuggestions(')+
  production('async function generate(c,extra={})','async function submit()')+
  production('async function exportOptionCards()','function presentFrame()'),g);
 g.feedbackReadError=null;g.updateLogButtons=noop;g.visualStylist={cancel:noop};
 vm.runInContext(production('function presentFrame()','function diagnosticSnapshot()')+
  production('function cancel(){','/* Preview-only rejection reconciliation.')+
  production('function rejectionSummary(','async function refillRejected(')+
  production('function cardModel(','function updateOptionCard()')+
  production('function wrappedOptionIndex(','function setCardLayout('),g);
 g.displayCurrent=()=>{if(g.current&&!$('outfit-output').hidden)g.cardPresentation=g.cardModel(g.current,g.currentOption);};
 g.requestConfig=g.structuredClone(config('work',plain(ui.snapshot())));
 await vm.runInContext('generate(requestConfig,{prefs:ui.snapshot()})',g);
 assert.equal(g.options.length,0);assert.equal(g.lastRequest.context.occasion,'work');
 await vm.runInContext('restoreInitialOutfit()',g);
 check('Saved Dinner restores after an excluded Work search while the old request remains Work',()=>{
  assert.equal(g.ctx.occasion,'dinner');assert.equal(g.lastRequest.context.occasion,'work');assert.equal($('outfit-output').hidden,false);assert.equal(g.cardPresentation.origin,'Your selection');
 });
 const other=g.structuredClone({...saved,shirtId:'DS007'}),unrelated=h.feedback.hide(other,{scope:'clothing',context:'work'});
 vm.runInContext('rejectionChanged()',g);
 check('An unrelated Work rejection cannot hide the allowed saved Dinner card',()=>{
  assert.equal($('outfit-output').hidden,false);assert.equal(gate.allowed(g.current,{occasion:'dinner'}),true);assert.equal(g.currentOption,null);
 });
 g.busy=true;vm.runInContext('cancel()',g);
 check('Cancel evaluates the retained Dinner card in Dinner despite the old Work request',()=>{assert.equal(g.busy,false);assert.equal($('outfit-output').hidden,false);assert.equal(g.ctx.occasion,'dinner');});
 const dinnerBan=h.feedback.hide(saved,{scope:'clothing',context:'dinner'});vm.runInContext('rejectionChanged()',g);
 check('A direct Dinner rejection still hides the same card without deleting its selection',()=>{assert.equal($('outfit-output').hidden,true);assert.deepEqual(plain(g.current),plain(saved));});
 h.feedback.restore(dinnerBan.id);vm.runInContext('rejectionChanged()',g);
 check('Undoing Dinner reveals the card even while its Work rejection remains active',()=>{assert.equal($('outfit-output').hidden,false);assert.equal(g.ctx.occasion,'dinner');});
 h.feedback.restore(workBan.id);h.feedback.restore(unrelated.id);
 // Reach the mixed state through the actual user cancellation flow: generation
 // installs its options, but Cancel stops the first avatar before any current
 // selection is committed. View current then restores the saved Dinner card.
 g.current=null;g.currentOption=null;g.pendingInitialOutfit=g.structuredClone({selection:saved,context:{occasion:'dinner',requiredFormality:'any'},localDate:'2026-11-18'});
 let release,entered;const rendering=new Promise(resolve=>{entered=resolve;});
 g.renderer.render=async()=>{entered();return new Promise(resolve=>{release=resolve;});};
 const generating=vm.runInContext('generate(requestConfig,{prefs:ui.snapshot()})',g);await rendering;
 assert.ok(g.options.length>0);vm.runInContext('cancel()',g);release({cancelled:true});await generating;
 g.renderer.render=async()=>({ready:true});await vm.runInContext('restoreInitialOutfit()',g);
 const retained=g.options[0],beforeList=g.options.length;
 check('Cancelling the first Work avatar then restoring Dinner retains the producing Work list separately',()=>{
  assert.equal(g.lastRequest.context.occasion,'work');assert.equal(g.ctx.occasion,'dinner');assert.equal(g.origin,'manual');assert.equal(g.currentOption,null);assert.ok(beforeList>0);
 });
 const another=h.feedback.hide(other,{scope:'clothing',context:'work'});vm.runInContext('rejectionChanged()',g);
 check('An identical physical outfit in the old Work list cannot relabel a restored Dinner card as generated',()=>{
  assert.equal(g.options.length,beforeList);assert.equal(g.currentOption,null);assert.equal(g.optionIndex,-1);assert.equal(g.cardPresentation.origin,'Your selection');assert.equal($('outfit-output').hidden,false);
 });
 await vm.runInContext('selectOption(0)',g);vm.runInContext('rejectionChanged()',g);
 check('An actual retained engine row keeps its original rank object and matching Work metadata',()=>{
  assert.equal(g.origin,'engine');assert.equal(g.ctx.occasion,'work');assert.equal(g.currentOption,retained);assert.equal(g.optionIndex,0);assert.equal(g.cardPresentation.origin,'Generated option');
 });
 g.savedSelection=saved;await vm.runInContext("apply(savedSelection,{origin:'manual',context:{occasion:'dinner',requiredFormality:'any'},save:false})",g);
 h.feedback.hide(saved,{scope:'clothing',context:'work'});vm.runInContext('rejectionChanged()',g);
 check('Nonempty Work options continue filtering in Work while the independent Dinner card remains visible',()=>{
  assert.equal(g.options.length,0);assert.equal(g.ctx.occasion,'dinner');assert.equal($('outfit-output').hidden,false);assert.equal(g.currentOption,null);assert.equal(g.optionIndex,-1);assert.equal(g.cardPresentation.origin,'Your selection');
 });
 console.log('FIVE ROUND CURRENT CONTEXT:',checks,'checks passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
