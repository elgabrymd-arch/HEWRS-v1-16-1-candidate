'use strict';
// Read-only Stage 11 regression: uses synthetic empty wear history and no weather.
const A = require('node:assert/strict');
const path = require('node:path');
const R = path.resolve(__dirname, '..');
const g = require('./core-loader.cjs')(R);
const engine = g.HEWRSCleanConnection.create(g.HEWRS_INPUTS);
const classify = g.HEWRSEnsembleCompletion.classifyStyle;
const compatible = {score:8.4,status:'new_ensemble_estimate',hard_conflict:{hard_reject:false}};
const top=(relaxed=false,foundation=true)=>({relaxedTailoring:relaxed,classicFoundation:foundation,source:{source_id:'TEST_TOP'}});
const shirt=(surface='restrained')=>({surface,source:{source_id:'TEST_SHIRT'}});
const footwear=(shoeStyle='other',withEvidence=true)=>({shoeStyle,controlled:true,evidence:withEvidence?{source_id:'TEST_REGISTERED_SHOE'}:{}});
const check=(label,actual,expected)=>{A.equal(actual,expected,label);console.log('PASS',label,actual)};
check('Traditional suit/tie/loafers remains CLASSIC',classify(top(),shirt(),{},compatible,footwear()).classification,'CLASSIC');
check('Open collar with formal shoes remains HYBRID',classify(top(),shirt(),null,compatible,footwear()).classification,'HYBRID');
check('Sneaker alone with tie remains HYBRID',classify(top(),shirt(),{},compatible,footwear('sneaker')).classification,'HYBRID');
check('Open collar plus registered sneakers qualifies MODERN',classify(top(),shirt(),null,compatible,footwear('sneaker')).classification,'MODERN');
check('Relaxed jacket plus open collar qualifies MODERN',classify(top(true),shirt(),null,compatible,footwear()).classification,'MODERN');
check('Relaxed jacket plus lustrous shirt qualifies MODERN',classify(top(true),shirt('lustrous'),{},compatible,footwear()).classification,'MODERN');
check('Lustrous shirt and open collar without substantive feature remain HYBRID',classify(top(),shirt('lustrous'),null,compatible,footwear()).classification,'HYBRID');
check('A nonclassic foundation remains MODERN',classify(top(false,false),shirt(),{},compatible,footwear()).classification,'MODERN');
check('Unproven sneaker identity cannot qualify',classify(top(),shirt(),null,compatible,footwear('sneaker',false)).authorityGate,'unknown');
check('Known source rejection remains blocked',classify(top(),shirt(),null,{...compatible,status:'requires_review'},footwear('sneaker')).authorityGate,'fail');
check('Classifier has no watch score contribution',classify(top(),shirt(),null,compatible,footwear('sneaker')).watch_contribution,0);
check('Classifier does not adjust compatibility score',classify(top(),shirt(),null,compatible,footwear('sneaker')).compatibility_adjustment,0);
check('Classifier revision updated',classify(top(),shirt(),null,compatible,footwear('sneaker')).classification_revision,'hewrs.watch-independent-style.v1_25_1');

function make(occasion,style='MODERN'){
 const cfg={automatic:true,stylistMode:'research',
   preferences:Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(k=>[k,{mode:'any'}])),
   occasion,formality:'any',style,localDate:'2026-11-13',
   environment:{source:'not_assessed',date:'2026-11-13'}};
 return engine.makeRequest(cfg);
}
const results=[];
for(const occasion of ['work','dinner','weekend']){
 const q=make(occasion),start=performance.now();
 const r=engine.controller.generate(q,engine.catalogue,[]);
 A.equal(engine.controller.verifyOptionSet(r.options,q),true,'Invalid sourced option set for '+occasion);
 const selected=r.options.map(x=>x._hewrsConnected.canonical_selection);
 const cl=r.options.map(x=>x._hewrsConnected.compatibility.style);
 A.ok(cl.every(x=>x.classification==='MODERN'&&x.authorityGate==='pass'),'Not all results truly MODERN');
 A.ok(cl.every(x=>x.compatibility_adjustment===0&&x.watch_contribution===0),'Classifier mutated an outfit score');
 A.equal(new Set(selected.map(x=>[x.suitId||x.blazerId,x.pantId||'SUIT',x.shirtId,x.state].join('/'))).size,r.options.length,'Duplicate clothing');
 const p=r.option_policy;
 A.ok(p.all_unanchored_items_within_limit,'Garment repetition violation');
 A.equal(p.max_per_unanchored_item,2,'Physical-item repetition cap changed');
 A.equal(p.max_per_unanchored_tie,1,'Tie repetition cap changed');
 A.equal(p.no_tie_default_max,null,'MODERN open collar freedom changed');
 const row={occasion,returned:r.options.length,requested:q.limit,verified:true,noTie:p.no_tie_options,sneakers:r.options.filter(x=>x.items.shoes?.subcategory==='Sneakers').length,seconds:Number(((performance.now()-start)/1000).toFixed(2)),caps:p.all_unanchored_items_within_limit,rejectionReasons:r.diagnostics?.rejection_reasons||{},distinctBlazersSuits:new Set(selected.map(x=>x.suitId||x.blazerId)).size};
 results.push(row);
 console.log('MODERN_GENERATION',JSON.stringify(row));
 A.equal(r.options.length,20,'MODERN '+occasion+' must generate 20 genuine, valid, distinct looks');
}
for(const style of ['AUTO','CLASSIC','HYBRID']){
 const q=make('work',style),r=engine.controller.generate(q,engine.catalogue,[]);
 A.equal(engine.controller.verifyOptionSet(r.options,q),true,'Invalid '+style+' options');
 A.equal(r.options.length,20,style+' Work should still produce 20 options');
 A.ok(style==='AUTO'||r.options.every(x=>x._hewrsConnected.compatibility.style.classification===style));
 console.log('CONTROL_GENERATION',JSON.stringify({style,occasion:'work',returned:r.options.length}));
}
console.log('PASS Stage 11 policy matrix',JSON.stringify(results));
