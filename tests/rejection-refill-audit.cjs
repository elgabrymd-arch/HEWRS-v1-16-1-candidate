'use strict';
// Diagnostic only: actual candidate engine and native feedback, synthetic usage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {load, config, root} = require('./tie-engine-loader.cjs');
const samplingOnly = process.argv.includes('--sampling-proof');
const started = Date.now();
const result = {
  schema: 'hewrs.rejection-refill-audit.v1',
  base_commit: '69545e85bf4ee0719d29dc81bade011332c4caf8',
  synthetic: true,
  actual_owner_usage: false,
  browser_test: false,
  scope: 'Actual candidate engine with synthetic in-memory persistence and the native feedback validators.',
  checks: [],
  generations: [],
};
const select = option => option._hewrsConnected.canonical_selection;
const plain = value => JSON.parse(JSON.stringify(value));
const output = path.join(root, 'evidence/tie_coverage_rejection_scale/'+(samplingOnly?'refill-audit-sampling.json':'refill-audit.json'));
function save() {
  fs.mkdirSync(path.dirname(output), {recursive:true});
  result.duration_seconds = (Date.now()-started)/1000;
  fs.writeFileSync(output, JSON.stringify(result, null, 2)+'\n');
}
function check(name, fn) {
  fn(); result.checks.push({name, passed:true}); console.log('PASS', name); save();
}
async function generate(h, label, retainedOptions, cfg=config()) {
  const q=h.connection.makeRequest(cfg), t=performance.now();
  const r=await h.connection.controller.generateAsync(q,h.connection.catalogue,[],retainedOptions ? {retainedOptions} : {});
  assert.equal(h.connection.controller.verifyOptionSet(r.options,q),true);
  const d=r.diagnostics || {};
  result.generations.push({
    label, milliseconds:performance.now()-t, count:r.options.length,
    rejection_events:h.feedback.refresh().events.length,
    active_clothing_rejections:h.feedback.snapshot().active.length,
    active_tie_rejections:h.ties.refresh().active.length,
    ids:Array.from(r.options,o=>o._hewrsConnected.id),
    tie_ids:Array.from(r.options,o=>select(o).state),
    refill:plain(r.refill||null), reason:r.reason||null,
    enumerated:d.enumerated, source_eligible:d.numeric_candidates,
    preference_evaluated:d.preference_evaluated,
    complete_outfit_shortlist:d.complete_outfit_shortlist,
    bounded_source_review:plain(d.bounded_source_review||null),
    capacity_fallback_to_full_source:!!d.capacity_fallback_to_full_source,
    source_capacity_bounds:plain(d.source_capacity_bounds||null),
    rejection_reasons:plain(d.rejection_reasons||{}),
  });
  console.log('GENERATION', label, r.options.length, 'options', Math.round(performance.now()-t)+'ms');
  save(); return {q,r};
}
async function main() {
  const h=load(), F=h.g.HEWRSOutfitFeedback, rejected=[];
  let {q,r}=await generate(h,'initial');
  check('Initial actual engine returns 20 verified options',()=>assert.equal(r.options.length,20));
  for(let batch=1;batch<=4;batch++) {
    const remove=Array.from(r.options.slice(0,10));
    assert.equal(remove.length,10);
    for(const option of remove) {
      const s=select(option), event=h.feedback.hide(s,{scope:'clothing',context:'all',reason:'other'});
      rejected.push({id:event.id,key:F.key(s,'clothing'),selection:s});
    }
    const retained=Array.from(r.options.filter(o=>h.gate.match(select(o),q.context).allowed));
    const retainedValues=retained.map(o=>JSON.stringify(o));
    ({q,r}=await generate(h,'after-'+(batch*10)+'-permanent-clothing-rejections',retained));
    check('Batch '+batch+': accepted records retained byte-for-byte and all cumulative rejects excluded',()=>{
      assert.equal(r.options.length,20);
      assert.equal(h.feedback.refresh().active.length,batch*10);
      assert.equal(new Set(rejected.map(e=>e.key)).size,batch*10);
      assert.deepEqual(Array.from(r.options.slice(0,retained.length),o=>JSON.stringify(o)),retainedValues);
      const forbidden=new Set(rejected.map(e=>e.key));
      assert.ok(r.options.every(o=>!forbidden.has(F.key(select(o),'clothing'))));
      assert.ok(r.options.every(o=>h.gate.match(select(o),q.context).allowed));
      assert.ok(rejected.every(e=>!h.gate.match(e.selection,q.context).allowed));
      assert.equal(r.refill.retained,retained.length);
      assert.equal(r.refill.added,20-retained.length);
    });
  }
  const reopened=load({storage:h.storage});
  const fresh=await generate(reopened,'new-instances-and-fresh-generation-after-40-rejections');
  check('New feedback and engine instances retain all 40 bans, including the earliest',()=>{
    assert.equal(reopened.feedback.refresh().active.length,40);
    assert.equal(fresh.r.options.length,20);
    const forbidden=new Set(rejected.map(e=>e.key));
    assert.ok(fresh.r.options.every(o=>!forbidden.has(reopened.g.HEWRSOutfitFeedback.key(select(o),'clothing'))));
    for(const entry of rejected)assert.equal(reopened.gate.match(reopened.g.structuredClone(entry.selection),fresh.q.context).allowed,false);
  });
  const tied=load(), exemplar=select(fresh.r.options.find(o=>select(o).state!=='NO_TIE'));
  const bannedTies=Array.from({length:30},(_,i)=>'T'+String(i+1).padStart(3,'0'));
  for(const tieId of bannedTies) {
    const s=tied.g.structuredClone(exemplar); s.state=tieId;
    tied.ties.hide(s,{scope:'tie',context:'all',reason:'other',note:'Synthetic capacity audit'});
  }
  const limited=await generate(tied,'30-whole-tie-bans');
  result.tie_scope_capacity={total_tie_ids:47,banned_tie_ids:bannedTies,remaining_tie_ids:17,
    max_no_tie_options:2,upper_bound_with_unanchored_work_request:19,
    note:'This is broad tie scope, unlike the 40 exact clothing-combination bans above. Work allows at most two No Tie options for this unanchored request.'};
  check('30 whole-tie bans reduce the maximum distinct Work list to at most 19 without recycling',()=>{
    assert.equal(tied.ties.refresh().active.length,30);
    assert.ok(limited.r.options.length<=19);
    assert.ok(limited.r.options.every(o=>!bannedTies.includes(select(o).state)));
    assert.ok(limited.r.options.filter(o=>select(o).state==='NO_TIE').length<=2);
    assert.equal(new Set(limited.r.options.filter(o=>select(o).state!=='NO_TIE').map(o=>select(o).state)).size,limited.r.options.filter(o=>select(o).state!=='NO_TIE').length);
  });
  result.complete=true;
}
async function samplingProof() {
  // Capture the candidate pool at an existing diagnostic assignment. This hook
  // reads references only; it does not change scoring, eligibility or curation.
  const read=fs.readFileSync, engine=path.join(root,'src/outfit-refill-engine.js');
  const marker='diagnostics.numeric_candidates=rawCandidates.length;diagnostics.preference_evaluated=candidates.length;';
  let instrumented=0,h;
  fs.readFileSync=function(filename,...args) {
    const source=read.call(fs,filename,...args);
    if(path.resolve(String(filename))!==engine)return source;
    assert.equal(typeof source,'string');
    assert.equal(source.split(marker).length,2,'Candidate capture point must be unique');
    instrumented++;
    return source.replace(marker,marker+'root.__refillAuditPools={raw:rawCandidates,scored:candidates};');
  };
  try{h=load();}finally{fs.readFileSync=read;}
  assert.ok(instrumented>0);
  const suit=h.connection.catalogue.suits[9].id;
  const cfg=config('work',{topwear:{mode:'item',id:suit}});
  const initial=await generate(h,'fixed-suit-before-rejections',null,cfg);
  const pools=h.g.__refillAuditPools,F=h.g.HEWRSOutfitFeedback;
  const toSelection=e=>h.g.structuredClone({suitId:e.group.topwearId,shirtId:e.row[0],state:e.row[1],shoeId:'shoe-11',watchId:null});
  const scoredKeys=new Set(Array.from(pools.scored,e=>F.key(toSelection(e),'clothing')));
  const unseen=Array.from(pools.raw).filter(e=>!scoredKeys.has(F.key(toSelection(e),'clothing'))).sort((a,b)=>b.row[2]-a.row[2]);
  const events=Array.from(pools.scored,(e,i)=>({schema:F.SCHEMA,id:'sampling_audit_'+String(i).padStart(6,'0'),at:'2026-11-18T12:00:00.000Z',type:'hide',actor:'owner',selection:toSelection(e),scope:'clothing',occasion:'all',reason:'other'}));
  h.feedback.importData(h.g.structuredClone({schema:F.EXPORT,events}));
  result.sampling={test_only_capture:true,rankings_unchanged:true,topwear_id:suit,
    raw_source_eligible:pools.raw.length,scored_clothing_keys:scoredKeys.size,
    source_eligible_but_unscored:unseen.length,initial_options:initial.r.options.length,
    rejected_all_scored_clothing:true};
  const exhausted=await generate(h,'all-sampled-clothing-rejected',null,cfg);
  check('Rejecting the whole sampled pool causes a no-match within the bounded search',()=>{
    assert.ok(unseen.length>0);assert.equal(exhausted.r.options.length,0);
  });
  let witness=null;
  for(let i=0;i<Math.min(unseen.length,10)&&!witness;i++) {
    const row=unseen[i],s=toSelection(row);
    if(!h.gate.match(s,{occasion:'work'}).allowed)continue;
    const anchored=config('work',{topwear:{mode:'item',id:suit},shirt:{mode:'item',id:s.shirtId},tie:{mode:'item',id:s.state}});
    const found=await generate(h,'unscored-witness-'+i,null,anchored);
    if(found.r.options.length)witness={selection:plain(select(found.r.options[0])),clothing_key:F.key(select(found.r.options[0]),'clothing'),compatibility_score:found.r.options[0]._hewrsConnected.compatibility.score,preference_score:found.r.options[0]._hewrsConnected.preference.score};
  }
  check('An unscored, unrejected source outfit passes the actual engine when its shirt and tie are anchored',()=>{
    assert.ok(witness,'No eligible witness found among first ten unscored source rows');
    assert.equal(scoredKeys.has(witness.clothing_key),false);
  });
  result.sampling.witness=witness;
  result.sampling.conclusion='The bounded search can return no match although an unrejected source-eligible complete outfit exists. Extra shirt/tie locks expose a candidate omitted by the original deterministic sample. This deliberately exhausts the sample; it is not a reproduction of failure at 20–30 ordinary rejections.';
  result.complete=true;
}
(samplingOnly?samplingProof():main()).catch(error=>{result.error=error.stack;console.error(error);process.exitCode=1;}).finally(save);
