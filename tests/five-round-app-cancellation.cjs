'use strict';
// Execute current application methods with controlled render completion. Native
// transport and pixel publication are independently covered by the engine test.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(ROOT,'src/outfit-refill-application.js'),'utf8');
const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);};
const selection={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-8',watchId:null},checks=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const bounded=promise=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Private render did not settle after cancellation')),800);promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
function check(name,fn){fn();checks.push({name,passed:true});console.log('PASS:',name);}

function harness(){
 const intervals=new Set(),renderers=[],canvases=[];
 class Canvas{
  constructor(){this.width=0;this.height=0;this.draws=[];canvases.push(this);}
  getContext(){return {fillRect(){},drawImage:(...args)=>this.draws.push(args)};}
  toDataURL(type,quality){return 'data:'+type+';base64,'+Buffer.from(JSON.stringify({width:this.width,height:this.height,quality})).toString('base64');}
 }
 const context=vm.createContext({console,Blob,structuredClone,generation:7,connection:{validateSelection:s=>structuredClone(s)},resolveUrl:d=>d.url,
  document:{createElement:type=>{assert.equal(type,'canvas');return new Canvas();}},
  need:(value,message)=>{if(!value)throw Error(message);},
  currentContext:()=>({occasion:'work',requiredFormality:'any'}),checkPreferenceFeedback:async()=> 'feedback-token',
  rejectionGate:()=>({allowed:()=>true,assertCurrent:token=>assert.equal(token,'feedback-token'),withCurrent:async(_,fn)=>fn()}),
  setInterval(fn,ms){const id=setInterval(fn,ms);intervals.add(id);return id;},clearInterval(id){intervals.delete(id);clearInterval(id);},
  setTimeout,clearTimeout,
  HEWRS_INPUT_SHA256:'source',HEWRS_OPTION_CARD_THUMBNAILS:{schema:'hewrs.option-card-thumbnails.v1_21_1',source_lock:'source',shirts:{},ties:{},shoes:{},pants:{}},
  HEWRSAtomicRenderer:{create(canvas){
   let finish,fail;const r={canvas,cancelCalls:0,selection:null,
    render(s){r.selection=structuredClone(s);return new Promise((resolve,reject)=>{finish=resolve;fail=reject;});},
    cancel(){r.cancelCalls++;finish?.({cancelled:true});},ready(){finish({status:'ready',selection:r.selection});},fail(){fail(Error('Controlled native image failure'));}};
   renderers.push(r);return r;
  }}
 });
 vm.runInContext('const root=globalThis;',context);
 vm.runInContext(extract('async function renderForPreference(','\nfunction syncLearningFor('),context);
 vm.runInContext(extract('async function renderForStylist(','\nfunction stylistSheet('),context);
 vm.runInContext(fs.readFileSync(path.join(ROOT,'src/option-cards.js'),'utf8'),context);
 const cards=context.HEWRSOptionCards.create(context.connection);
 async function started(){for(let i=0;i<10&&!renderers.length;i++)await sleep(0);assert.equal(renderers.length,1);return renderers[0];}
 function cleanup(){for(const id of intervals)clearInterval(id);intervals.clear();}
 return {context,intervals,renderers,canvases,cards,started,cleanup};
}

async function privateRender(kind,outcome){
 const h=harness();let cancelled=false;const c=h.context;
 try{
  const promise=kind==='preference'?c.renderForPreference(selection,()=>cancelled):c.renderForStylist(selection);
  const settled=bounded(promise),r=await h.started();
  assert.equal(h.intervals.size,1,'One current cancellation watcher while a native render is pending');
  if(outcome==='cancel'){
   if(kind==='preference')cancelled=true;else c.generation++;
   await assert.rejects(settled,/cancelled/);
   check(kind+': a stalled private render settles after cancellation and releases timer/canvas',()=>{assert.ok(r.cancelCalls>=1);assert.equal(h.intervals.size,0);assert.equal(r.canvas.width,1);assert.equal(r.canvas.height,1);});
  }else if(outcome==='error'){
   r.fail();await assert.rejects(settled,/Controlled native image failure/);
   check(kind+': image failure preserves the error and releases timer/canvas',()=>{assert.equal(r.cancelCalls,1);assert.equal(h.intervals.size,0);assert.equal(r.canvas.width,1);assert.equal(r.canvas.height,1);});
  }else{
   r.ready();const result=await settled;
   check(kind+': healthy rendering retains its exact crop geometry and releases the watcher',()=>{
    assert.deepEqual(r.selection,selection);assert.equal(h.intervals.size,0);assert.equal(r.cancelCalls,1);
    const crop=h.canvases[1];assert.ok(crop);assert.equal(crop.draws[0][0],r.canvas);
    if(kind==='preference'){
     assert.deepEqual(crop.draws.map(row=>row.slice(1)),[[0,0,996,2748,0,0,420,1160],[170,390,656,766,0,0,420,490]]);
     assert.match(result.full,/^data:image\/jpeg;base64,/);assert.match(result.detail,/^data:image\/jpeg;base64,/);assert.notEqual(result.full,result.detail);
    }else{assert.deepEqual(crop.draws[0].slice(1),[0,400,996,2348,0,0,280,660]);assert.match(result,/^data:image\/jpeg;base64,/);}
   });
  }
 }finally{h.cleanup();}
}

async function optionBook(outcome){
 const h=harness();let cancelled=false;const progress=[];
 const records=[{selection,title:'Selected <S05>',total:1,date:'2026-11-19',origin:'Manual',scoreLabel:'No score claim',scoreValue:'',items:[{role:'Shirt',id:'DS029',name:'Exact & retained'}]}];
 try{
  const promise=h.cards.book(records,{resolveUrl:d=>d.url,isCancelled:()=>cancelled,onProgress:p=>progress.push(p)}),settled=bounded(promise),r=await h.started();
  assert.equal(h.intervals.size,1);
  if(outcome==='cancel'){
   cancelled=true;await assert.rejects(settled,/cancelled/);
   check('Card book: cancelling a stalled native render settles without producing a file',()=>{assert.ok(r.cancelCalls>=1);assert.equal(h.intervals.size,0);assert.equal(r.canvas.width,1);assert.equal(r.canvas.height,1);assert.equal(progress.length,0);});
  }else if(outcome==='error'){
   r.fail();await assert.rejects(settled,/Controlled native image failure/);
   check('Card book: native image error clears the cancellation watcher',()=>{assert.equal(r.cancelCalls,1);assert.equal(h.intervals.size,0);assert.equal(progress.length,0);});
  }else{
   r.ready();const blob=await settled,html=await blob.text();
   check('Card book: healthy export preserves exact IDs, escaping, order and preview size',()=>{assert.deepEqual(r.selection,selection);assert.match(html,/Selected &lt;S05&gt;/);assert.match(html,/data-item-id="DS029"/);assert.match(html,/Exact &amp; retained/);assert.match(html,/data-option="1"/);assert.deepEqual(h.canvases[1].draws[0].slice(1),[0,0,498,1374]);assert.equal(progress.length,1);assert.equal(h.intervals.size,0);assert.equal(r.cancelCalls,1);});
  }
 }finally{h.cleanup();}
}

async function methodChange(){
 let release,method='research',renders=0;const deferred=new Promise(resolve=>release=resolve),nodes=new Map(),calls={native:0,visual:0,weather:0},noop=()=>{};
 const q={automatic:true,stylist:{mode:'research'},context:{occasion:'work',requiredFormality:'any'},localDate:'2026-11-19'};
 const c=vm.createContext({root:{HEWRSRuntimeLoader:{ensureIndex:async()=>{}},HEWRSStyleOccasions:{noTieCap:()=>2}},need:(v,m)=>assert.ok(v,m),copy:structuredClone,
  connection:{hybrid:{setMode:v=>method=v},makeRequest:()=>q,catalogue:{},controller:{generateAsync:()=>deferred,verifyOptionSet:()=>true},selectionFromOption:()=>({selection})},
  backend:null,STYLIST_KEY:'unused',stylistPreferenceWarning:null,renderer:{cancel:()=>calls.native++},visualStylist:{cancel:()=>calls.visual++},autoWeather:{cancel:()=>calls.weather++},generation:0,current:null,lastRequest:null,lastAttemptRequest:null,options:[],report:null,optionIndex:-1,currentOption:null,producing:null,optionHistoryToken:null,optionPreferenceToken:null,origin:'manual',rejectionRemoved:null,mode:'engine',ctx:{occasion:'work'},
  checkRejectionFeedbackAsync:async()=>({token:'feedback'}),syncLearningFor:()=>({token:'learning'}),ui:{snapshot:()=>({})},tieExposure:{newId:()=> 'id'},store:{readForGeneration:()=>({token:'wear',events:[]}),assertCurrent:noop},learning:{assertCurrent:noop},
  $:id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id);},setBusy:value=>c.busy=value,status:noop,updateHome:noop,displayCurrent:noop,presentEmpty:noop,weatherSummary:()=>'',styleLabels:{CLASSIC:'Classic'},renderForStylist:noop,
  apply:async()=>{renders++;return {status:'ready'};},presentFrame:noop,showPage:noop,recordTieSuggestions:noop,rejectionGate:()=>({assertCurrent:noop,withCurrent:async(_,fn)=>fn()}),refreshHistory:noop,showGenerationFailure:error=>{throw error;}
 });
 vm.runInContext(extract('function setStylistMode(','\nasync function renderForStylist('),c);
 vm.runInContext(extract('function invalidateRecommendations(','\nfunction details('),c);
 vm.runInContext(extract('async function generate(','\nasync function submit('),c);
 const pending=c.generate({occasion:'work'});await sleep(0);const token=c.generation,prior={...calls};c.setStylistMode('curated');
 release({status:'old_research_result',options:[{_hewrsConnected:{compatibility:{style:{classification:'CLASSIC'}}}}],diagnostics:{examined:1}});
 const result=await bounded(pending);
 check('Changing stylist method cancels pending native/provider/weather work',()=>{assert.equal(method,'curated');assert.equal(c.generation,token+1);assert.equal(calls.native,prior.native+1);assert.equal(calls.visual,prior.visual+1);assert.equal(calls.weather,prior.weather+1);assert.equal(c.busy,false);});
 check('A deferred result from the previous method cannot render or publish a list',()=>{assert.equal(result.cancelled,true);assert.equal(renders,0);assert.equal(c.options.length,0);assert.equal(c.report.status,'not_generated');});
}

(async()=>{
 for(const kind of ['preference','stylist'])for(const outcome of ['cancel','ready','error'])await privateRender(kind,outcome);
 for(const outcome of ['cancel','ready','error'])await optionBook(outcome);
 await methodChange();
 const result={schema:'hewrs.central-render-cancellation-regressions.v1',status:'passed',passed:checks.length,failed:0,checks,scope:'Actual application functions and option-card book with controlled native renderer and tracked real timers. No pixel or engine-score claim.'};
 fs.writeFileSync(path.join(ROOT,'evidence/five_round_20261119/engine-central-render-after.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:checks.length,failed:0}));
})().catch(error=>{console.error(error);process.exitCode=1;});
