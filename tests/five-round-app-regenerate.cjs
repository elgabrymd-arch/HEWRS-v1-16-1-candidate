'use strict';
// Execute the real Regenerate handler and automatic-weather coordinator.
// Deferred endpoint spies isolate cancellation ownership; no provider or browser is used.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),source=fs.readFileSync(ROOT+'/src/outfit-refill-application.js','utf8');
const section=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);};
const idle=()=>new Promise(r=>setImmediate(r));
function fixture(kind='engine'){
 const nodes=new Map(),calls={generate:[],apply:[],pages:[],failures:[],nativeCancel:0,visualCancel:0},prefs={shirt:{mode:'item',id:'DS029'}};
 let releaseWeather,releaseApply,rejectApply,weatherValue=null,method='research';
 const c=vm.createContext({console,structuredClone,Date,AbortController,setTimeout,clearTimeout,generation:4,busy:false,current:null,
  ctx:{occasion:'work',formality:'any',localDate:'2026-11-18',style:'AUTO'},mode:'engine',pageName:'outfits',modal:null,backend:null,STYLIST_KEY:'unused',stylistPreferenceWarning:null,
  options:[],lastRequest:null,lastAttemptRequest:null,report:null,optionIndex:-1,currentOption:null,optionHistoryToken:null,optionPreferenceToken:null,rejectionRemoved:null,origin:'engine',
  HEWRS_READY:true,HEWRSWeather:{fresh:()=>false},navigator:{permissions:{query:async()=>({state:'granted'})}},localToday:()=> '2026-11-19',
  need:(v,m)=>{if(!v)throw Error(m);},copy:structuredClone,
  $:id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false});return nodes.get(id);},
  weather:{snapshot:()=>weatherValue,status:()=>({}),locate:()=>new Promise(resolve=>{releaseWeather=resolve;}),fetchAt:()=>{throw Error('No saved place fixture');},apply:value=>{weatherValue=structuredClone(value);},request:date=>({source:'not_assessed',date})},
  ui:{replace:value=>{calls.replaced=structuredClone(value);},operation:(m,context)=>({config:{...context,stylistMode:method},prefs})},
  connection:{hybrid:{setMode:m=>{method=m;}}},renderer:{cancel:()=>calls.nativeCancel++},visualStylist:{cancel:()=>calls.visualCancel++},
  setMode:m=>{c.mode=m;},setBusy:v=>{c.busy=v;},updateHome(){},displayCurrent(){},presentEmpty(){},status(){},weatherSummary:()=>'',
  currentContext:()=>({occasion:c.ctx.occasion,requiredFormality:c.ctx.formality}),syncLearningFor(){},
  generate:async(config,opts)=>{calls.generate.push({config:structuredClone(config),opts:structuredClone(opts)});return {status:'ready'};},
  apply:(selection,opts)=>{calls.apply.push({selection,opts});return new Promise((resolve,reject)=>{releaseApply=resolve;rejectApply=reject;});},
  showPage:page=>calls.pages.push(page),showGenerationFailure:error=>calls.failures.push(error.message)
 });
 c.producing={kind,context:structuredClone(c.ctx),prefs,mode:'engine',selection:{suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-8',watchId:null}};
 vm.runInContext('const root=globalThis;',c);
 vm.runInContext(fs.readFileSync(ROOT+'/src/automatic-weather.js','utf8'),c);
 vm.runInContext(section('const autoWeather=','\nconst learning='),c);
 vm.runInContext(section('function invalidateRecommendations(','\nfunction details('),c);
 vm.runInContext(section('function setStylistMode(','\nasync function renderForStylist('),c);
 vm.runInContext(section('function cancel(','\n/* Preview-only rejection'),c);
 vm.runInContext(section("$('regenerate').onclick=", "\n$('data-button')"),c);
 return {c,calls,run:()=>nodes.get('regenerate').onclick(),get releaseWeather(){return releaseWeather;},get releaseApply(){return releaseApply;},get rejectApply(){return rejectApply;},get weatherValue(){return weatherValue;},get method(){return method;}};
}
const checks=[];
const value={source:'forecast',date:'2026-11-19',place:{label:'Test place'}};
function passed(name){checks.push({name,passed:true});console.log('PASS:',name);}
(async()=>{
 for(const action of ['method','context','cancel','weather_cancel_only']){
  const h=fixture(),pending=h.run();await idle();assert.equal(typeof h.releaseWeather,'function');
  if(action==='method')h.c.setStylistMode('curated');
  if(action==='context'){h.c.ctx.occasion='dinner';h.c.invalidateRecommendations('Occasion changed');}
  if(action==='cancel')h.c.cancel();
  if(action==='weather_cancel_only')vm.runInContext('autoWeather.cancel()',h.c);
  h.releaseWeather(value);await pending;
  assert.equal(h.weatherValue,null);assert.equal(h.calls.generate.length,0);assert.equal(h.calls.apply.length,0);
  assert.equal(h.calls.pages.length,0);assert.equal(h.calls.failures.length,0);
  passed('Regenerate cannot resume after '+action+' during its actual automatic-weather preflight');
 }
 {
  const h=fixture(),pending=h.run();await idle();const ownedToken=h.c.generation;h.releaseWeather(value);await pending;
  assert.equal(h.calls.generate.length,1);assert.equal(h.calls.generate[0].config.localDate,'2026-11-19');
  assert.equal(h.calls.generate[0].config.stylistMode,'research');assert.equal(h.weatherValue.date,'2026-11-19');
  assert.equal(h.c.generation,ownedToken);assert.deepEqual(h.calls.generate[0].opts.prefs,h.calls.replaced);
  assert.equal(h.calls.failures.length,0);
  passed('Healthy Regenerate continues after its own weather refresh with current date and exact preferences');
 }
 {
  const h=fixture(),first=h.run();await idle();const firstToken=h.c.generation,second=h.run();await idle();
  assert.ok(h.c.generation>firstToken,'Second click must own a newer generation');h.releaseWeather(value);await Promise.all([first,second]);
  assert.equal(h.calls.generate.length,1);assert.equal(h.calls.failures.length,0);
  passed('Overlapping Regenerate clicks share weather but only the newest action may generate');
 }
 for(const result of ['cancelled','healthy','stale_error']){
  const h=fixture('manual'),pending=h.run();await idle();assert.equal(h.calls.apply.length,1);
  assert.equal(h.calls.apply[0].opts.token,h.c.generation,'Manual rendering belongs to this Regenerate action');
  if(result==='healthy')h.releaseApply({status:'ready'});
  else {h.c.cancel();if(result==='stale_error')h.rejectApply(Error('Late image failure'));else h.releaseApply({cancelled:true});}
  await pending;assert.deepEqual(h.calls.pages,result==='healthy'?['outfits']:[]);assert.equal(h.calls.failures.length,0);
  passed('Manual Regenerate '+result+' result respects the current action before navigation or error publication');
 }
 const report={source:'src/outfit-refill-application.js',actualMethods:true,
  controlledEndpoints:['weather.locate','generate','apply'],checks,passed:checks.length,failed:0,
  limitations:['This isolates handler ownership; real pixels and browser UI are verified separately.']};
 fs.writeFileSync(ROOT+'/evidence/five_round_20261119/engine-regenerate-after.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:checks.length,failed:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
