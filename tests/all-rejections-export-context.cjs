'use strict';
// Reproduce the reachable saved-outfit route with the production application
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
 g.requestConfig=g.structuredClone(config('work',plain(ui.snapshot())));
 await vm.runInContext('generate(requestConfig,{prefs:ui.snapshot()})',g);
 check('Work generation returns no options while the saved Dinner outfit remains pending',()=>{
  assert.equal(g.options.length,0);assert.equal(g.current,null);assert.equal(g.lastRequest.context.occasion,'work');assert.equal(g.pendingInitialOutfit.context.occasion,'dinner');
 });
 await vm.runInContext('restoreInitialOutfit()',g);
 check('View current restores allowed Dinner without replacing the previous Work request',()=>{
  assert.deepEqual(plain(g.current),plain(saved));assert.equal(g.ctx.occasion,'dinner');assert.equal(g.lastRequest.context.occasion,'work');assert.equal(g.options.length,0);assert.equal(gate.allowed(g.current,{occasion:'dinner'}),true);
 });
 await vm.runInContext('exportOptionCards()',g);
 await $('export-card-png').onclick();
 check('Current PNG uses the restored Dinner context despite the old Work request',()=>{assert.equal(calls.png,1);assert.equal(calls.downloads,1);assert.match($('card-export-status').textContent,/Card ready/);});
 await $('export-cards-html').onclick();
 check('Current-card-only HTML fallback also uses Dinner',()=>{assert.equal(calls.book,1);assert.equal(calls.downloads,2);assert.match($('card-export-status').textContent,/Cards ready/);});

 // The export captures the model/context, but must still reject a newly saved
 // veto when preparation starts. Neither encoding path may publish a link.
 await vm.runInContext('exportOptionCards()',g);
 const dinnerBan=h.feedback.hide(saved,{scope:'clothing',context:'dinner'}),beforeDinner={...calls};
 for(const id of ['export-card-png','export-cards-html']){
  await $(id).onclick();
  check('New Dinner rejection blocks '+id+' before encoding and publication',()=>{assert.deepEqual(calls,beforeDinner);assert.match($('card-export-status').textContent,/Export not completed:.*rejected/);});
 }
 h.feedback.restore(dinnerBan.id);

 // A nonempty generated list retains its producing occasion even if a later
 // public apply changes the current card to Dinner. Exercise both exports in
 // the same sheet so a fix cannot make them share the wrong context again.
 h.feedback.restore(workBan.id);
 await vm.runInContext('generate(requestConfig,{prefs:ui.snapshot()})',g);
 assert.ok(g.options.length>0);assert.equal(g.lastRequest.context.occasion,'work');
 g.savedSelection=saved;
 await vm.runInContext("apply(savedSelection,{origin:'manual',context:{occasion:'dinner',requiredFormality:'any'},save:false})",g);
 h.feedback.hide(saved,{scope:'clothing',context:'work'});
 const beforeList={...calls};
 await vm.runInContext('exportOptionCards()',g);await $('export-card-png').onclick();
 check('Current PNG remains allowed in Dinner beside a Work options list',()=>{assert.equal(g.ctx.occasion,'dinner');assert.equal(g.lastRequest.context.occasion,'work');assert.ok(g.options.length>0);assert.equal(calls.png,beforeList.png+1);assert.equal(calls.downloads,beforeList.downloads+1);});
 const beforeBook={...calls};await $('export-cards-html').onclick();
 check('Nonempty options HTML still enforces the producing Work rejection',()=>{assert.deepEqual(calls,beforeBook);assert.match($('card-export-status').textContent,/Export not completed:.*rejected/);});
 console.log('ALL REJECTIONS EXPORT CONTEXT:',checks,'checks passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
