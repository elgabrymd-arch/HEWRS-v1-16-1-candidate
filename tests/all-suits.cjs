/* V1.6 connects unchanged source assets. This is a routing/controller regression test,
   not new clothing approval. The preserved V1.5 implementation is the old-route baseline. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const R=path.resolve(__dirname,'..'),E=R+'/evidence/all_suits_v1_6',p=JSON.parse(fs.readFileSync(R+'/data/inputs.json'));
const scripts=['vendor/hewrs-logic.js','vendor/approved-scores.js','vendor/ensemble-completion.js','vendor/release-guards.js','vendor/request-contract.js','src/controller.js','vendor/watch-classification.js','src/canonical-bindings-browser.js','data/approved-suits.js','src/suit-resolver97-browser.js','src/approved-suit-sources.js','data/suit-assembly.js','data/ds035-coverage.js','data/ds035-edge.js','src/suit-assemblies.js','src/connection.js','src/local-state.js','vendor/active50-renderer.js','src/ds035-coverage-renderer.js','src/ds035-edge-renderer.js'];
class Canvas{constructor(){this.dataset={};}getContext(){return{};}}
function environment(old=false){const c=vm.createContext({console,structuredClone,Date,Math,JSON,setTimeout,clearTimeout,Uint8ClampedArray,HTMLCanvasElement:Canvas,document:{createElement:()=>new Canvas()}});
 for(const file of scripts){const source=old&&['src/suit-assemblies.js','src/connection.js'].includes(file)?E+'/baseline/'+file:R+'/'+file;vm.runInContext(fs.readFileSync(source,'utf8'),c,{filename:file});}
 c.HEWRS_INPUT_SHA256=crypto.createHash('sha256').update(fs.readFileSync(R+'/data/inputs.json')).digest('hex');return{c,app:c.HEWRSCleanConnection.create(p)};}
const {c,app}=environment(),old=environment(true).app,checks=[],planRows=[],engineRows=[];let plans=0,oldPlans=0,newPlans=0,invalid=0,engineRequests=0,engineOptions=0;
const eq=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
function check(name,fn){try{fn();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,error:e.stack});}console.log((checks.at(-1).pass?'PASS ':'FAIL ')+name);}
async function ac(name,fn){try{await fn();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,error:e.stack});}console.log((checks.at(-1).pass?'PASS ':'FAIL ')+name);}
const before=JSON.stringify(p),cfg={tie:'ANY',shoeId:'shoe-8',watchId:null,localDate:'2026-09-22',occasion:'clinic',formality:'any',style:'AUTO'};
const modes=id=>['NO_TIE',...(p.manifest.shirts[id].mode_policy==='NO_TIE_ONLY'?[]:Object.keys(p.manifest.ties))];
check('All 18 suits and 50 exact shirts enabled; original source-order preserved',()=>{eq(app.limits.suits,app.suitSources.ids);assert.equal(app.limits.suits.length,18);eq(app.limits.shirt_ids,p.manifest.shirt_order);eq(app.assemblies.originalTemplateSuitIds,['S01','S04','S05','S16']);assert.equal(app.limits.engine_wider_shirt_lock,null);});
for(const suitId of app.suitSources.ids)check(suitId+' all valid source-layer plans match the declared unmodified components',()=>{
 let count=0;const pair=app.suitSources.resolveCanonical(suitId);
 for(const shirtId of p.manifest.shirt_order){
  const m=app.assemblies.forSelection(suitId,'shoe-8',shirtId);
  eq(m.shirts,p.manifest.shirts);eq(m.ties,p.manifest.ties);
  assert.equal(m.static.jacket.sha256,pair.jacket.sha256);assert.equal(m.static.trousers.sha256,pair.trousers.sha256);eq(m.static.jacket.display_alpha_mask,p.manifest.static.jacket.display_alpha_mask);
  const corrected=pair.template==='S11'&&shirtId==='DS035';assert.equal(!!m.ds035_s11_edge,corrected);assert.equal(!!m.ds035_s11_coverage,corrected);
  const expected=structuredClone(p.manifest);if(suitId!=='S05'){expected.static.jacket={...structuredClone(pair.jacket),display_alpha_mask:structuredClone(p.manifest.static.jacket.display_alpha_mask)};expected.static.trousers=structuredClone(pair.trousers);}
  const current=c.HEWRSDS035EdgeRenderer.create(new Canvas(),m),reference=c.HEWRSActive50.create(new Canvas(),expected);
  const prior=old.assemblies.supported(suitId,shirtId)?c.HEWRSDS035EdgeRenderer.create(new Canvas(),old.assemblies.forSelection(suitId,'shoe-8',shirtId)):null;
  for(const state of [...modes(shirtId),...(suitId==='S05'&&shirtId==='DS035'?['REFERENCE']:[])]){
   const selection={suitId,shirtId,state,shoeId:'shoe-8',watchId:null};eq(app.validateSelection(selection),selection);eq(app.bridge.stateRequest(suitId,shirtId,state),{suitId,shirtId,state});
   const request={suitId:'S05',shirtId,state};const a=current.plan(request),b=reference.plan(request);
   eq(corrected?a.slice(2):a,b);if(prior){eq(a,prior.plan(request));oldPlans++;}else{newPlans++;}
   if(state.startsWith('T'))assert.equal(a.filter(d=>d.sha256===p.manifest.ties[state].display_layer.sha256).length,1);
   for(const d of a){assert.ok(app.assetPaths[d.sha256]);if(d.display_alpha_mask)assert.ok(app.assetPaths[d.display_alpha_mask.sha256]);}
   count++;plans++;
  }
 }
 assert.equal(count,suitId==='S05'?2213:2212);planRows.push({suitId,template:pair.template,count});
});
check('Complete supported universe: 39,817 plans; 9,521 old unchanged + 30,296 newly connected',()=>{assert.equal(plans,39817);assert.equal(oldPlans,9521);assert.equal(newPlans,30296);});
check('All 3,384 no-tie-only tied requests remain rejected across all 18 suits',()=>{for(const suitId of app.suitSources.ids)for(const shirtId of ['DS040','DS041','DS042','DS043'])for(const state of Object.keys(p.manifest.ties)){assert.throws(()=>app.validateSelection({suitId,shirtId,state,shoeId:'shoe-8',watchId:null}));invalid++;}assert.equal(invalid,3384);});
check('Retired/unknown IDs, selected reference misuse and shoe/watch mismatches reject',()=>{const s={suitId:'S11',shirtId:'DS036',state:'T017',shoeId:'shoe-8',watchId:null};for(const extra of [{suitId:'S19'},{suitId:'suit-10'},{shirtId:'DS049'},{shirtId:'__proto__'},{state:'T048'},{state:'REFERENCE'},{shoeId:'shoe-50'},{watchId:'watch-missing'}])assert.throws(()=>app.validateSelection({...s,...extra}));for(const suitId of app.suitSources.ids.filter(x=>x!=='S05'))assert.throws(()=>app.validateSelection({...s,suitId,shirtId:'DS035',state:'REFERENCE'}));});
check('DS035-only corrections never leak to another shirt or the original suit-template group',()=>{for(const suitId of app.suitSources.ids)for(const shirtId of p.manifest.shirt_order){const m=app.assemblies.forSelection(suitId,'shoe-8',shirtId),enabled=app.assemblies.widerTemplateSuitIds.includes(suitId)&&shirtId==='DS035';assert.equal(!!m.ds035_s11_edge,enabled);assert.equal(!!m.ds035_s11_coverage,enabled);}});
function compareEngine(config,history=[]){const q=app.makeRequest(config),r=app.controller.generate(q,app.catalogue,history),parent=old.controller.generate(q,old.catalogue,history);eq(r,parent);engineRequests++;
 for(const option of r.options){const b=app.selectionFromOption(option,q);eq(b.binding.compatibility,option._hewrsConnected.compatibility);assert.equal(b.selection.suitId,config.suitId);if(config.shirt&&!['ANY'].includes(config.shirt)&&!config.shirt.startsWith('FAMILY:'))assert.equal(b.selection.shirtId,config.shirt.replace(/^shirt-/,''));assert.equal(b.selection.shoeId,config.shoeId);engineOptions++;}
 return {q,r};}
for(const suitId of app.suitSources.ids)check(suitId+' Engine accepts exact shirts, free selection and families without changing numerical results',()=>{
 const rows=[];for(const shirtId of p.manifest.shirt_order)for(const tie of ['NO_TIE',...(p.manifest.shirts[shirtId].mode_policy==='NO_TIE_ONLY'?[]:['T017'])]){const {r}=compareEngine({...cfg,suitId,shirt:shirtId,tie});assert.equal(r.diagnostics.examined,1);}
 for(const [shirt,tie] of [['ANY','ANY'],['FAMILY:cream','ANY'],['FAMILY:blue','T017'],['DS036','FAMILY:navy']]){const {r}=compareEngine({...cfg,suitId,shirt,tie});rows.push({shirt,tie,options:r.options.length,examined:r.diagnostics?.examined??0,status:r.status});}
 engineRows.push({suitId,rows});
});
check('All historical DS035 Engine modes preserve original results across wider suits',()=>{for(const suitId of app.assemblies.widerTemplateSuitIds)for(const tie of modes('DS035'))compareEngine({...cfg,suitId,shirt:'DS035',tie});});
check('Malformed exact Engine selections do not silently become category or free selection',()=>{for(const x of [{shirt:'DS049'},{shirt:'DS051 '},{shirt:'__proto__'},{tie:'T048'},{tie:'REFERENCE'},{shoeId:'shoe-50'},{watchId:'watch-missing'},{suitId:'S19'}])assert.throws(()=>app.makeRequest({...cfg,suitId:'S11',shirt:'DS036',...x}));const q=app.makeRequest({...cfg,suitId:'S11',shirt:'shirt-DS036'});assert.equal(q.shirt.id,'shirt-DS036');});
check('Score holds do not block exact Anchor visuals or invent scoring evidence',()=>{for(const suitId of app.suitSources.ids)for(const shirtId of ['DS011','DS040','DS042','DS043']){const s={suitId,shirtId,state:'NO_TIE',shoeId:'shoe-8',watchId:null};app.validateSelection(s);assert.equal(app.scoreSelection(s).status,'canonical_data_hold');}});
check('All 188 approved scores and component evidence remain unchanged',()=>{for(const row of p.approved.records){const r=app.source.lookupShirtTie(row.shirt_id,row.tie_id,{versionPolicy:'strict'});assert.equal(r.score,row.score_100);eq(r.components,row.components);}});
check('Modified/forged candidates and stale requests reject',()=>{const{q,r}=compareEngine({...cfg,suitId:'S11',shirt:'ANY'});assert.ok(r.options.length);const o=r.options[0];for(const extra of [{suitId:'S02'},{shirt:'DS017'},{shoeId:'shoe-6'}]){const changed=app.makeRequest({...cfg,suitId:'S11',shirt:'ANY',...extra});if(o.items.shirt.id===changed.shirt?.id)continue;assert.throws(()=>app.selectionFromOption(o,changed));}const bad=structuredClone(o);bad._hewrsConnected.compatibility.score=-1;assert.throws(()=>app.selectionFromOption(bad,q));});
function backend(){const map=new Map([['production-sentinel','untouched']]);return{map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}};
check('New exact wear sessions preserve source-lock, old IDs and isolated storage',()=>{const db=backend(),store=c.HEWRSLocalState.create(app,c.HEWRS_INPUT_SHA256,db);for(const suitId of app.suitSources.ids){const s={suitId,shirtId:'DS036',state:'T017',shoeId:'shoe-8',watchId:null};store.saveSession({selection:s,origin:'manual',mode:'anchor',localDate:cfg.localDate,context:{occasion:'clinic',requiredFormality:'any'}});assert.equal(store.snapshot().events.length,app.suitSources.ids.indexOf(suitId));store.addEvent(app.createHistoryEvent(s,{id:'integration_'+suitId,localDate:cfg.localDate}));}const b=store.exportText();eq(store.previewImport(b).events,store.snapshot().events);eq(c.HEWRSLocalState.create(app,c.HEWRS_INPUT_SHA256,db).snapshot(),store.snapshot());assert.equal(db.map.get('production-sentinel'),'untouched');});
check('V1.5 sessions import without migration or resetting any existing IDs',()=>{const prior=c.HEWRSLocalState.create(old,c.HEWRS_INPUT_SHA256,null),now=c.HEWRSLocalState.create(app,c.HEWRS_INPUT_SHA256,null),s={suitId:'S11',shirtId:'DS035',state:'T017',shoeId:'shoe-8',watchId:null};prior.saveSession({selection:s,origin:'manual',mode:'anchor',localDate:cfg.localDate,context:{occasion:'clinic',requiredFormality:'any'}});prior.addEvent(old.createHistoryEvent(s,{id:'prior_approved',localDate:cfg.localDate}));now.restore(now.previewImport(prior.exportText()));eq(now.snapshot().session,prior.snapshot().session);eq(now.snapshot().events,prior.snapshot().events);assert.equal(now.snapshot().source_lock,prior.snapshot().source_lock);assert.equal(now.snapshot().revision,1);});
(async()=>{
 await ac('Async free-shirt Engine agrees with synchronous result and cancellation',async()=>{for(const suitId of ['S02','S11','S18']){const q=app.makeRequest({...cfg,suitId,shirt:'ANY'});eq(await app.controller.generateAsync(q,app.catalogue,[]),app.controller.generate(q,app.catalogue,[]));assert.equal((await app.controller.generateAsync(q,app.catalogue,[],{isCancelled:()=>true})).status,'cancelled');}});
 check('Input objects unchanged after every routing and calculation operation',()=>eq(p,JSON.parse(before)));
 const out={version:'V1.6',passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,checks,plans,previous_plan_matches:oldPlans,newly_connected_plans:newPlans,prohibited_requests:invalid,engine_requests_compared:engineRequests,engine_options_bound:engineOptions,planRows,engineRows,browser_render_claim:false};
 fs.writeFileSync(E+'/ROUTING_AND_ENGINE.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({passed:out.passed,failed:out.failed,plans,oldPlans,newPlans,engineRequests,engineOptions,failures:checks.filter(x=>!x.pass)}));if(out.failed)process.exitCode=1;
})();
