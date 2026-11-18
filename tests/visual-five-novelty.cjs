'use strict';
// Isolated offline regression: NO OpenAI calls and NO browser/storage writes.
// Verifies that the current local 20-outfit snapshot cannot leak into five AI slots.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../src/hybrid-stylist.js'),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
const prefs=Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(x=>[x,{mode:'any'}]));
const roles=['topwear','shirt','tie','pants'],key=o=>roles.map(k=>o.items[k]?.id||'NONE').join('|');
const fullKey=o=>[...roles,'shoes','watch'].map(k=>o.items[k]?.id||'NONE').join('|');
function fixture({allOverlap=false,invalidBaseline=false,duplicateBaseline=false,cancelled=false}={}){
 const stats={engine:0,proposals:0,reviews:0,renders:0,index:0};
 const selection=(n,shoeId='shoe-1',watchId=null)=>({suitId:'S01',shirtId:'DS'+String(n).padStart(3,'0'),state:'T001',shoeId,watchId});
 const cat={suits:[{id:'suit-1',formal:true}],blazers:[],shirts:Array.from({length:50},(_,i)=>({id:'shirt-DS'+String(i+1).padStart(3,'0')})),ties:[{id:'T001'}],shoes:[{id:'shoe-1'},{id:'shoe-2'}],watches:[{id:'watch-1'}],pants:[]};
 const items=s=>({topwear:cat.suits[0],shirt:cat.shirts.find(x=>x.id==='shirt-'+s.shirtId),tie:cat.ties[0],pants:null,shoes:cat.shoes.find(x=>x.id===s.shoeId),watch:s.watchId?cat.watches[0]:null});
 const baseline=Array.from({length:20},(_,i)=>({items:items(selection(i+1))}));if(duplicateBaseline)baseline[19]=clone(baseline[0]);
 const request=c=>({automatic:true,prefs:clone(c.preferences||prefs),context:{occasion:c.occasion||'work',requiredFormality:c.formality||'any'},localDate:c.localDate,environment:clone(c.environment||{}),executiveStyle:c.style||'AUTO',dressMode:{work:'work',dinner:'fancyDinner',weekend:'weekend'}[c.occasion||'work'],source_lock:'lock',limit:20});
 const base={catalogue:cat,suitSources:{ids:['S01']},aliases:new Map([['S01','suit-1']]),blazerConnection:{availableIds:[]},makeRequest:request,automatic:{prepare:request},controller:{},engine:{get:()=>({primary:{family:'solid'},source_wording:{texture:'wool'}}),selectForContext:()=>({selected:null,rotation:{status:'ok'}})},validateSelection:s=>{assert.ok(cat.shirts.some(x=>x.id==='shirt-'+s.shirtId));return s;},scoreSelection:()=>({score:8,status:'new_ensemble_estimate',hard_conflict:{hard_reject:false},ids:{}}),preference:{matchesFamily:()=>true},records:{}};
 const research={makeRequest:request,automatic:{prepare:request},controller:{generateAsync:async()=>{stats.engine++;return cancelled?{status:'cancelled',options:[]}:{status:'candidate_recommendation',options:baseline};},verifyOptionSet:()=>!invalidBaseline}};
 const root={HEWRSConnectedContract:{stable:JSON.stringify},HEWRSCleanConnection:{create:()=>base},HEWRSAutomaticEngine:{create:()=>research},HEWRSResearchPreference:{create:()=>({})},HEWRS_STYLIST_LIBRARY:{schema:'hewrs.curated-library.v1_19_0',source_lock:'lock',records:[]},HEWRS_INPUT_SHA256:'lock',HEWRSLocalState:{create:()=>({validate:()=>true})},HEWRSRuntimeLoader:{ensureIndex:async()=>{stats.index++}},HEWRSWeather:{assess:()=>({eligible:true})},HEWRSLegacyAccessories:{shoe:()=>({rejected:false}),watch:()=>({rejected:false})},HEWRSEnsembleCompletion:{classifyStyle:()=>({authorityGate:'pass',classification:'CLASSIC'})},HEWRSOptionSetPolicy:{clothingKey:key,fullKey,create:()=>{const seen=new Set();return {issue:o=>seen.has(key(o))?'DUPLICATE':null,add:o=>seen.add(key(o)),snapshot:()=>({count:seen.size})};},inspect:()=>({})}};
 const sandbox=vm.createContext({...root,structuredClone:clone});vm.runInContext(source,sandbox,{filename:'src/hybrid-stylist.js'});
 const app=sandbox.HEWRSCleanConnection.create({});
 const proposed=allOverlap?[selection(1,'shoe-2','watch-1'),selection(2,'shoe-2','watch-1')]:[selection(1,'shoe-2','watch-1'),selection(21),selection(22),selection(23),selection(24),selection(25),selection(21,'shoe-2'),selection(26)];
 app.hybrid.setService({ready:()=>true,propose:async()=>{stats.proposals++;return {job_id:'fixture',proposals:proposed.map((selection,i)=>({selection,rationale:'fixture '+i}))};},evaluate:async(q,images,job_id)=>{stats.reviews++;return {method:'live_visual',provider:'OFFLINE_FIXTURE',model:'NOT_LIVE',job_id,ranking:images.map(x=>({candidate_id:x.candidate_id,grade:'strong',explanation:'Fixture only'}))};}});
 const run=(occasion='work')=>{const q=app.makeRequest({stylistMode:'visual',occasion,preferences:prefs,localDate:'2026-11-17',environment:{source:'not_assessed'}});return {q,promise:app.controller.generateAsync(q,cat,[],{renderForStylist:async()=>{stats.renders++;return 'data:image/jpeg;base64,FIXTURE';}})};};
 return {app,stats,cat,baseline,run};
}
for(const occasion of ['work','dinner','weekend'])test('Five AI options do not repeat current 20: '+occasion,async()=>{
 const {app,stats,run}=fixture(),{q,promise}=run(occasion),result=await promise,original=new Set(result.engine_comparison.options.map(key));
 assert.equal(result.options.length,5);assert.equal(result.engine_comparison.options.length,20);
 assert.ok(result.options.every(o=>!original.has(key(o))));assert.equal(new Set(result.options.map(key)).size,5);
 assert.equal(result.stylist.non_overlap_validated,true);assert.equal(result.stylist.engine_option_count,20);assert.equal(result.diagnostics.engine_overlaps_removed,1);
 assert.ok(result.diagnostics.proposal_rejections.some(x=>x.code==='AI_DUPLICATE_CLOTHING'));
 assert.equal(q.context.occasion,occasion);assert.equal(stats.engine,1);assert.equal(stats.proposals,1);assert.equal(stats.reviews,1);assert.equal(stats.renders,6);assert.equal(stats.index,1);
 assert.equal(app.controller.verifyOptionSet(result.options,q),true);
});
for(const [scenario,error] of [[{invalidBaseline:true},'AI_BASELINE_UNVERIFIED'],[{duplicateBaseline:true},'AI_BASELINE_DUPLICATE'],[{allOverlap:true},'VISUAL_NO_NOVEL']])test('Fail closed: '+error,async()=>{
 const {stats,run}=fixture(scenario),{promise}=run();
 await assert.rejects(promise,e=>e.code===error);assert.equal(stats.reviews,0);assert.equal(stats.renders,0);
 if(error!=='VISUAL_NO_NOVEL')assert.equal(stats.proposals,0);
});
test('Cancelled baseline cannot charge provider',async()=>{
 const {stats,run}=fixture({cancelled:true}),{promise}=run(),r=await promise;
 assert.equal(r.status,'cancelled');assert.equal(stats.proposals,0);
});
