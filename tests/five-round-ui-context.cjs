'use strict';
// Independent current-application context transitions. Deferred source/weather
// callbacks exercise the real cancellation/publication code without providers.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(ROOT,'src/outfit-refill-application.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const idle=()=>new Promise(resolve=>setImmediate(resolve)),selection={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-8',watchId:null};
function fixture(method='research'){
 const nodes=new Map(),calls={native:0,visual:0,weather:0,applied:[],pages:[],source:[]};let resolveSource,resolveWeather,weatherValue=null,sourceMethod=method;
 const pendingSource=new Promise(resolve=>{resolveSource=resolve;});
 const weather={snapshot:()=>structuredClone(weatherValue),status:()=>({}),fetchAt:()=>{throw Error('Unexpected saved-place lookup');},locate:()=>new Promise(resolve=>{resolveWeather=resolve;}),apply:value=>{weatherValue=structuredClone(value);},request:date=>({source:'not_assessed',date})};
 const ctx={occasion:'work',formality:'any',localDate:'2026-11-18',style:'AUTO'},prefs={shirt:{mode:'item',id:'DS029'}};
 const c=vm.createContext({structuredClone,Date,AbortController,setTimeout,clearTimeout,console,
  generation:0,busy:false,current:null,lastRequest:null,lastAttemptRequest:null,options:[],report:null,optionIndex:-1,currentOption:null,producing:null,optionHistoryToken:null,optionPreferenceToken:null,origin:'manual',rejectionRemoved:null,mode:'engine',ctx,backend:null,modal:null,pageName:'home',stylistPreferenceWarning:null,STYLIST_KEY:'unused',weather,
  HEWRS_READY:true,HEWRSWeather:{fresh:()=>false},navigator:{permissions:{query:async()=>({state:'granted'})}},localToday:()=> '2026-11-19',HEWRSRuntimeLoader:{ensureIndex:async()=>{}},HEWRSStyleOccasions:{noTieCap:()=>2},HEWRSLocalState:{date:value=>/^\d{4}-\d{2}-\d{2}$/.test(value)},
  need:(v,m)=>{if(!v)throw Error(m);},copy:structuredClone,
  $:id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id);},
  renderer:{cancel:()=>calls.native++},visualStylist:{cancel:()=>calls.visual++},
  setBusy:value=>{c.busy=value;},updateHome(){},displayCurrent(){},presentEmpty(){},presentFrame(){},status(){},weatherSummary:()=>'',styleLabels:{CLASSIC:'Classic'},renderForStylist(){},recordTieSuggestions(){},refreshHistory(){},
  showPage:page=>calls.pages.push(page),showGenerationFailure:error=>{throw error;},
  checkRejectionFeedbackAsync:async()=>({token:'feedback'}),syncLearningFor:()=>({token:'learning'}),currentContext:()=>({occasion:c.ctx.occasion,requiredFormality:c.ctx.formality}),
  learning:{assertCurrent(){}},store:{readForGeneration:()=>({token:'wear',events:[]}),assertCurrent(){}},tieExposure:{newId:()=> 'exposure'},
  rejectionGate:()=>({assertCurrent(){},withCurrent:async(_,fn)=>fn()}),
  connection:{catalogue:{},hybrid:{setMode:mode=>{sourceMethod=mode;}},makeRequest:config=>({automatic:true,stylist:{mode:sourceMethod},context:{occasion:config.occasion,requiredFormality:'any'},localDate:config.localDate}),controller:{generateAsync:q=>{calls.source.push(structuredClone(q));return pendingSource;},verifyOptionSet:()=>true},selectionFromOption:()=>({selection})},
  ui:{snapshot:()=>structuredClone(prefs),operation:(_mode,context)=>({kind:'manual',selection,prefs:structuredClone(prefs),config:context})},
  apply:async(s,options)=>{calls.applied.push({selection:structuredClone(s),options:structuredClone(options)});return {status:'ready'};}
 });
 vm.runInContext('const root=globalThis;',c);vm.runInContext(fs.readFileSync(path.join(ROOT,'src/automatic-weather.js'),'utf8'),c);
 const actualCreate=c.HEWRSAutoWeather.create;let hooks,auto;
 c.HEWRSAutoWeather={create(options){hooks=options;auto=actualCreate(options);return Object.freeze({...auto,cancel(){calls.weather++;auto.cancel();}});}};
 vm.runInContext(section('const autoWeather=','\nconst learning='),c);
 vm.runInContext(section('function invalidateRecommendations(','\nfunction details('),c);
 vm.runInContext(section('function setStylistMode(','\nasync function renderForStylist('),c);
 vm.runInContext(section('async function generate(','\nfunction cancel('),c);
 const result={status:'ready',options:[{_hewrsConnected:{compatibility:{style:{classification:'CLASSIC'}}}}],diagnostics:{examined:1}};
 return {c,calls,prefs,hooks,get method(){return sourceMethod;},releaseSource:()=>resolveSource(result),get releaseWeather(){return resolveWeather;},get weatherValue(){return weatherValue;}};
}
for(const method of ['research','heuristic','curated','visual'])test(method+' source cannot publish its deferred results after ordinary context invalidation',async()=>{
 const h=fixture(method),pending=h.c.generate({occasion:'work',localDate:'2026-11-19'});await idle();assert.equal(h.calls.source.length,1);assert.equal(h.c.busy,true);
 const before=structuredClone(h.calls),generation=h.c.generation;h.c.invalidateRecommendations('Occasion changed');h.releaseSource();const result=await pending;
 assert.equal(result.cancelled,true);assert.equal(h.c.generation,generation+1);assert.equal(h.c.busy,false);assert.equal(h.calls.applied.length,0);assert.equal(h.calls.pages.length,0);assert.equal(h.c.options.length,0);assert.equal(h.c.report.status,'not_generated');
 for(const key of ['native','visual','weather'])assert.equal(h.calls[key],before[key]+1);assert.deepEqual(h.c.ui.snapshot(),h.prefs);
});
test('Automatic weather applied during active generation cancels the old source request',async()=>{
 const h=fixture(),pending=h.c.generate({occasion:'work',localDate:'2026-11-18'});await idle();const before=h.c.generation;
 h.hooks.onApplied({date:'2026-11-19'});h.releaseSource();assert.equal((await pending).cancelled,true);assert.equal(h.c.generation,before+1);assert.equal(h.c.ctx.localDate,'2026-11-19');assert.equal(h.calls.applied.length,0);
});
test('Real automatic-weather refresh before submit retains the submitting action and its exact pieces',async()=>{
 const h=fixture(),pending=h.c.submit();await idle();assert.equal(typeof h.releaseWeather,'function');const generation=h.c.generation;
 h.releaseWeather({source:'forecast',date:'2026-11-19',place:{label:'Test place'}});await pending;
 assert.equal(h.c.generation,generation);assert.equal(h.calls.applied.length,1);assert.deepEqual(h.calls.applied[0].selection,selection);assert.equal(h.calls.applied[0].options.localDate,'2026-11-19');assert.deepEqual(h.calls.pages,['outfits']);
});
test('Changing styling method during the actual automatic-weather wait cannot resume the old submit',async()=>{
 const h=fixture(),pending=h.c.submit();await idle();assert.equal(typeof h.releaseWeather,'function');h.c.setStylistMode('curated');
 h.releaseWeather({source:'forecast',date:'2026-11-19',place:{label:'Test place'}});const result=await pending;
 assert.equal(result.cancelled,true);assert.equal(h.method,'curated');assert.equal(h.weatherValue,null);assert.equal(h.calls.applied.length,0);assert.equal(h.calls.source.length,0);assert.equal(h.calls.pages.length,0);
});
