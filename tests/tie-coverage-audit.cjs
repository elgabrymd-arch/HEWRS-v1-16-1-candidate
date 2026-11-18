'use strict';
// Diagnostic only: actual candidate engine, synthetic empty owner storage.
// No production logic is replaced, no provider is called, and no wear is logged.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {load,config,root}=require('./tie-engine-loader.cjs');
const Exposure=require('../src/tie-exposure.js');
const plain=x=>JSON.parse(JSON.stringify(x));
const ids=Array.from({length:47},(_,i)=>'T'+String(i+1).padStart(3,'0'));
const output=path.join(root,'evidence/tie_coverage_rejection_scale');
const file=path.join(output,'tie-coverage.json');
const started=Date.now();
const evidence={schema:'hewrs.tie-coverage-audit.v1',source_commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),synthetic:true,actual_owner_usage:false,production_code_modified:false,provider_calls:0,configuration:{stylist_mode:'research',style:'AUTO',formality:'any',all_preferences:'any',weather:'not_assessed',local_date:'2026-11-18',confirmed_wear:[],dynamic_rejections:[],maximum_rounds:8,stop_after_consecutive_rounds_without_new_tie:3},limitations:['Finite repeated generation is not a proof of eventual coverage.','Current exact owner approvals and frozen native policies remain enabled.','Exposure is committed by the harness only after each verified generated list; there is no UI in this diagnostic.','Elapsed times are observational and may include contention from other audits.','Per-tie eligibility is based on the existing bounded source/candidate review; no exhaustive global-optimum claim.','Weather, style, garment locks, learned preferences and the owner device history are not reproduced.'],inventory:[],occasions:{},complete:false};
function save(){fs.mkdirSync(output,{recursive:true});evidence.duration_seconds=(Date.now()-started)/1000;fs.writeFileSync(file,JSON.stringify(evidence,null,2)+'\n');}
function selection(option){return option._hewrsConnected.canonical_selection;}
function run(h,occasion,tie=null){const q=h.connection.makeRequest(config(occasion,tie?{tie:{mode:'item',id:tie}}:{})),start=performance.now(),r=h.connection.controller.generate(q,h.connection.catalogue,[]);assert.equal(h.connection.controller.verifyOptionSet(r.options,q),true);return {q,r,milliseconds:Math.round(performance.now()-start)};}
function csv(value){return '"'+String(value??'').replaceAll('"','""')+'"';}
function writeCsv(){const columns=['tie_id','description','catalogue_active','fidelity_assets_valid',...['work','dinner','weekend'].flatMap(o=>[o+'_eligible_complete_first',o+'_rounds_observed',o+'_times_suggested',o+'_first_seen_round',o+'_unseen_anchor_options',o+'_last_disposition'])];const rows=evidence.inventory.map(t=>[t.id,t.description,t.active,t.fidelity_assets_valid,...['work','dinner','weekend'].flatMap(o=>{const a=evidence.occasions[o],first=a?.first_tie_diagnostics?.[t.id],last=a?.last_tie_diagnostics?.[t.id];return [first?.eligible_complete,a?.rounds?.length,a?.counts?.[t.id]||0,a?.first_seen_round?.[t.id]||'',a?.unseen_anchor_checks?.[t.id]?.option_count??'',last?.disposition];})]);fs.writeFileSync(path.join(output,'tie-coverage.csv'),[columns,...rows].map(row=>row.map(csv).join(',')).join('\n')+'\n');}
try{
 const h=load(),c=h.connection,ledger=Exposure.create(h.storage),catalogue=Array.from(c.catalogue.ties).sort((a,b)=>a.id.localeCompare(b.id));
 assert.deepEqual(catalogue.map(x=>x.id),ids);
 assert.ok(catalogue.every(t=>t.status==='active'&&c.features.has(t.id)));
 for(const t of catalogue){const bindings=Array.from(c.tieFidelity.data.bindings).filter(x=>x.id===t.id),assets=bindings.map(b=>{const local=path.join(root,b.layer.url),exists=fs.existsSync(local),actual=exists?crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex'):null;return {kind:b.kind,path:b.layer.url,exists,sha256_matches:actual===b.layer.sha256};});assert.ok(assets.length>=3&&assets.every(x=>x.exists&&x.sha256_matches));evidence.inventory.push({id:t.id,description:t.displayDesc||t.name,active:t.status==='active',feature_exists:c.features.has(t.id),fidelity_assets_valid:true,assets});}
 save();console.log('INVENTORY:',evidence.inventory.length,'active exact tie IDs; all registered fidelity asset hashes valid');
 for(const occasion of ['work','dinner','weekend']){
  const data={rounds:[],counts:{},first_seen_round:{},unseen_anchor_checks:{}};evidence.occasions[occasion]=data;
  let noNew=0;const seen=new Set();
  for(let round=1;round<=8;round++){
   const {r,milliseconds}=run(h,occasion),ties=Array.from(r.options,selection).map(s=>s.state).filter(id=>id!=='NO_TIE'),newTies=ties.filter(id=>!seen.has(id));
   assert.equal(r.options.length,20);assert.equal(new Set(ties).size,ties.length);
   for(const id of ties){assert.ok(ids.includes(id));seen.add(id);data.counts[id]=(data.counts[id]||0)+1;data.first_seen_round[id]??=round;}
   if(round===1)data.first_tie_diagnostics=plain(r.diagnostics.tie_coverage);
   data.last_tie_diagnostics=plain(r.diagnostics.tie_coverage);
   data.rounds.push({round,milliseconds,option_count:r.options.length,ties,new_ties:newTies,cumulative_count:seen.size,no_tie_count:r.options.length-ties.length,reranked_choices:r.diagnostics.tie_exposure.reranked_choices,owner_approval_priority:plain(r.diagnostics.owner_approval_priority),bounded_source_review:plain(r.diagnostics.bounded_source_review),options:Array.from(r.options,o=>({id:o._hewrsConnected.id,selection:plain(selection(o)),preference_score:o._hewrsConnected.preference.score,owner_approval:o._hewrsConnected.owner_approval?.review_id||null,is_recommendation:!!o._hewrsConnected.is_recommendation,curation:plain(o._hewrsConnected.curation||{})}))});
   ledger.commit('coverage_'+occasion+'_'+round,plain(r.options.map(selection)),{occasion});
   data.seen=Array.from(seen).sort();data.unseen=ids.filter(id=>!seen.has(id));data.exposure_event_count=ledger.snapshot().eventCount;
   console.log('ROUND:',occasion,round,'cumulative',seen.size,'new',newTies.join(',')||'none',milliseconds+'ms');save();
   noNew=newTies.length?0:noNew+1;
   if(seen.size===47){data.stop_reason='all_47_observed';break;}
   if(noNew>=3){data.stop_reason='three_consecutive_rounds_without_new_tie';break;}
  }
  data.stop_reason??='eight_round_limit';
  for(const id of data.unseen){const {r,milliseconds}=run(h,occasion,id);assert.ok(r.options.every(o=>selection(o).state===id));data.unseen_anchor_checks[id]={option_count:r.options.length,milliseconds,status:r.status,diagnostics:plain(r.diagnostics.tie_coverage[id]),first_selection:r.options[0]?plain(selection(r.options[0])):null};console.log('ANCHOR:',occasion,id,r.options.length,'options',milliseconds+'ms');save();}
  console.log('OCCASION:',occasion,'observed',data.seen.length,'of47; unseen',data.unseen.join(',')||'none');save();writeCsv();
 }
 assert.ok(Array.from({length:h.storage.length},(_,i)=>h.storage.key(i)).every(k=>k.startsWith(Exposure.prefix)));
 evidence.complete=true;save();writeCsv();console.log('COMPLETE:',evidence.duration_seconds+'s');
}catch(error){evidence.error=error.stack;save();writeCsv();console.error(error);process.exitCode=1;}
