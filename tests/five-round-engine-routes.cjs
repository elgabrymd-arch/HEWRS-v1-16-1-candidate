'use strict';
// Independent route oracle: original manifest, registered full-shirt sources,
// approved suit pairs and explicit tie-fidelity bindings. No pixels are drawn.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {load}=require('./tie-engine-loader.cjs');
const R=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(R,p),'utf8'));
const original=read('data/inputs.json'),catalogue=read('evidence/five_round_20261119/CATALOGUE.json');
const suits=read('data/approved-suits.json').registry.items,blazers=read('data/blazer-connection.json');
const fidelity=read('data/tie-fidelity.json'),cleanup=read('data/ds023-cleanup.json'),edges=read('data/ds023-edges.json');
const fidelityByHash=new Map(fidelity.bindings.map(b=>[b.baseline.sha256,b.layer]));
const tied=(id,kind)=>fidelity.bindings.find(b=>b.id===id&&b.kind===kind).layer;
const sha=d=>d?.sha256,eq=(a,b,label)=>assert.equal(sha(a),sha(b),label);
const h=load(),g=h.g,c=h.connection;
class Canvas{constructor(){this.dataset={};}getContext(){return {};}}
g.HTMLCanvasElement=Canvas;g.document={createElement:type=>{assert.equal(type,'canvas');return new Canvas();}};
const result={schema:'hewrs.five-round-engine-routes.v1',scope:'Plan and binding validation; no pixel/visual quality claim',base_commit:'59d9097f9a74104d6b4a1e6ff964f62c56a1ca03',counts:{suit:0,blazer:0,shirt_only:0,no_tie_only_rejected:0,unknown_states_rejected:0,physical_pants:0},shirts:[],failures:[]};
const digest=crypto.createHash('sha256'),assets=new Set();
function registered(desc){if(!desc||!desc.sha256)return;assert.match(desc.sha256,/^[a-f0-9]{64}$/);assert.deepEqual(Array.from(desc.rect),[0,0,996,2748]);assert.ok(catalogue.assetPaths[desc.sha256],desc.sha256);assets.add(desc.sha256);if(desc.display_alpha_mask)registered(desc.display_alpha_mask);}
function visit(value){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object'){if(value.sha256){registered(value);return;}for(const [key,v]of Object.entries(value))if(key!=='selection')visit(v);}}
function check(label,fn){try{fn();}catch(e){result.failures.push({label,error:e.message});if(result.failures.length>12)throw e;}}
function canonical(s){assert.equal(JSON.stringify(c.validateSelection(s)),JSON.stringify(s),'Exact physical selection must survive validation');}
const B=g.HEWRSBlazerRenderer.create(new Canvas(),c,d=>d.url),O=g.HEWRSShirtOnlyRenderer.create(new Canvas(),c,d=>d.url);
const noTieOnly=Object.keys(original.manifest.shirts).filter(id=>original.manifest.shirts[id].mode_policy==='NO_TIE_ONLY');
assert.equal(catalogue.roster.shirts.length,50);assert.equal(noTieOnly.length,4);assert.equal(suits.length,18);assert.equal(catalogue.roster.blazers.length,15);
for(const item of catalogue.shirts){
 const id=item.id,raw=original.manifest.shirts[id],states=raw.available_modes.filter(x=>x!=='REFERENCE');
 assert.deepEqual(states,item.manifest.available_modes.filter(x=>x!=='REFERENCE'));
 assert.equal(states.length,noTieOnly.includes(id)?1:48);
 result.shirts.push({id,states:states.length,original_mode_policy:raw.mode_policy||'TIED_AND_NO_TIE',non_suit_registered:!!item.registration||!!catalogue.nonSuitFullStates[id]});
 for(const suit of suits){
  const renderer=g.HEWRSDS035EdgeRenderer.create(new Canvas(),c.assemblies.forSelection(suit.suit_id,'shoe-8',id),d=>d.url);
  for(const state of states)check(suit.suit_id+'/'+id+'/'+state,()=>{
   const s={suitId:suit.suit_id,shirtId:id,state,shoeId:'shoe-8',watchId:null};canonical(s);
   const plan=renderer.plan({suitId:'S05',shirtId:id,state}),expected=raw.states[state==='NO_TIE'?'no_tie':'tied'];visit(plan);
   const hashes=plan.map(sha);for(const role of ['body','rear','left','right','left_cuff','right_cuff'])assert.ok(hashes.includes(sha(expected[role])),id+'/'+role+' must use its original selected-state component');
   assert.ok(hashes.includes(sha(suit.jacket)),'Exact approved suit jacket');assert.ok(hashes.includes(sha(suit.trousers)),'Exact approved suit trousers');
   if(state!=='NO_TIE')assert.ok(hashes.includes(sha(tied(state,'suit'))),'Exact selected tie fidelity binding');
   digest.update(JSON.stringify([s,plan]));result.counts.suit++;
  });
  for(const state of [...(noTieOnly.includes(id)?catalogue.roster.ties:[]),'T000','T048']){
   const s={suitId:suit.suit_id,shirtId:id,state,shoeId:'shoe-8',watchId:null};assert.throws(()=>c.validateSelection(s));assert.throws(()=>renderer.plan({suitId:'S05',shirtId:id,state}));
   if(noTieOnly.includes(id)&&catalogue.roster.ties.includes(state))result.counts.no_tie_only_rejected++;else result.counts.unknown_states_rejected++;
  }
 }
 for(const top of [...catalogue.roster.blazers,'SHIRT_ONLY']){
  const engine=top==='SHIRT_ONLY'?O:B,base=top==='SHIRT_ONLY'?{shirtOnly:true}:{blazerId:top};
  for(const state of states)check(top+'/'+id+'/'+state,()=>{
   const s={...base,pantId:'PG002',shirtId:id,state,shoeId:'shoe-8',watchId:null};canonical(s);const p=engine.plan(s);visit(p);
   if(p.selection)assert.equal(JSON.stringify(p.selection),JSON.stringify(s));
   if(item.registration){
    const r=item.registration.modes[state==='NO_TIE'?'no_tie':'tied'];
    eq(p.body,id==='DS023'?(state==='NO_TIE'?cleanup.modes.no_tie.base:edges.layers.base.layer):r.base,'Exact registered body');
    const leaves=id==='DS023'&&state!=='NO_TIE'?[edges.layers.left.layer,edges.layers.right.layer]:[r.left,r.right];
    p.leaves.forEach((d,i)=>eq(d,leaves[i],'Exact registered collar leaf'));
    if(r.rear)eq(p.rear,r.rear,'Exact registered rear collar');
    if(top!=='SHIRT_ONLY')p.cuffs.forEach((d,i)=>eq(d,[r.left_cuff,r.right_cuff][i],'Exact registered cuff'));
    if(state==='NO_TIE')assert.equal(p.tie,null);else eq(p.tie,tied(state,id==='DS023'&&state==='T017'?'ds023_T017':'non_suit'),'Exact selected tie');
    if(item.registration.shirt_only_trouser_ownership==='EXACT_EXISTING_TROUSER_LAYER_FOREGROUND_AT_WAIST')assert.equal(p.pantsInForeground,top==='SHIRT_ONLY','Declared trouser ownership applies only to shirt-only rendering');
   }else{
    const expected=catalogue.nonSuitFullStates[id].layers[state],actual=fidelityByHash.get(expected.sha256)||expected;
    if(top==='SHIRT_ONLY')assert.ok(p.layers.some(d=>sha(d)===sha(actual)),'Exact full shirt state');
    else eq(p.shirt||p.tie,actual,'Exact legacy full shirt state');
   }
   if(top==='SHIRT_ONLY')assert.ok((p.layers||[p.pants]).some(d=>sha(d)===sha(blazers.pants.PG002.layer)),'Exact physical trousers');else eq(p.pants,blazers.pants.PG002.layer,'Exact physical trousers');
   digest.update(JSON.stringify([s,p]));result.counts[top==='SHIRT_ONLY'?'shirt_only':'blazer']++;
  });
  for(const state of [...(noTieOnly.includes(id)?catalogue.roster.ties:[]),'T000','T048']){
   const s={...base,pantId:'PG002',shirtId:id,state,shoeId:'shoe-8',watchId:null};assert.throws(()=>c.validateSelection(s));assert.throws(()=>engine.plan(s));
   if(noTieOnly.includes(id)&&catalogue.roster.ties.includes(state))result.counts.no_tie_only_rejected++;else result.counts.unknown_states_rejected++;
  }
  for(const pantId of catalogue.roster.pants){const s={...base,pantId,shirtId:id,state:'NO_TIE',shoeId:'shoe-8',watchId:null};canonical(s);const p=engine.plan(s);assert.ok((p.layers||[p.pants]).some(d=>sha(d)===sha(blazers.pants[pantId]?.layer||c.blazerConnection.knownPant(pantId).layer)));result.counts.physical_pants++;}
 }
}
result.distinct_descriptors=assets.size;result.plan_digest=digest.digest('hex');result.status=result.failures.length?'failed':'passed';
result.limitations=['Plan-only validation does not assess source photographs or native alpha compositing.','Full shirt/state/topwear cross-product uses PG002, shoe-8, no watch; all physical trousers are additionally checked for every shirt/topwear in No Tie.','Declared approved registration overrides and the intentional DS026 suit/non-suit distinction are preserved.'];
fs.mkdirSync(path.join(R,'evidence/five_round_20261119'),{recursive:true});fs.writeFileSync(path.join(R,'evidence/five_round_20261119/engine-route-matrix.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,counts:result.counts,descriptors:result.distinct_descriptors,failures:result.failures}));assert.equal(result.failures.length,0);
