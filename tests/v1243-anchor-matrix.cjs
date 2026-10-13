'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const [R,OUT,occasion='work']=process.argv.slice(2);
const g=require(R+'/tests/core-loader.cjs')(R),c=g.HEWRSCleanConnection.create(g.HEWRS_INPUTS);
const anchors=[...c.suitSources.ids,...c.blazerConnection.availableIds],styles=['AUTO','CLASSIC','HYBRID','MODERN'];
const completed=fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];const seen=new Set(completed.map(r=>[r.anchor,r.style,r.occasion].join('|')));if(!fs.existsSync(OUT))fs.writeFileSync(OUT,'');let n=completed.length;
for(const anchor of anchors)for(const style of styles){
 if(seen.has([anchor,style,occasion].join('|')))continue;
 const config={automatic:true,stylistMode:'research',preferences:Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(k=>[k,{mode:'any'}])),occasion,formality:'any',style,localDate:'2026-10-12',environment:{source:'not_assessed',date:'2026-10-12'}};
 config.preferences.topwear={mode:'item',id:anchor[0]==='B'?c.blazerConnection.knownBlazer(anchor).historyId:c.aliases.get(anchor)};
 const t=performance.now();let r;
 try{const q=c.makeRequest(config),out=c.controller.generate(q,c.catalogue,[]);const rows=(out.options||[]).map(o=>({selection:o._hewrsConnected.canonical_selection,style:o._hewrsConnected.compatibility.style,preference:o._hewrsConnected.preference,compatibility:o._hewrsConnected.compatibility}));
  const valid=c.controller.verifyOptionSet(out.options||[],q);
  for(const o of out.options||[]){c.validateSelection(o._hewrsConnected.canonical_selection);if((o._hewrsConnected.canonical_selection.blazerId||o._hewrsConnected.canonical_selection.suitId)!==anchor)throw Error('ANCHOR_CHANGED');if(style!=='AUTO'&&o._hewrsConnected.compatibility.style.classification!==style)throw Error('STYLE_CHANGED');}
  r={anchor,style,occasion,count:rows.length,status:out.status,reason:out.reason,verified:valid,rows_hash:crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),selections:rows.map(o=>o.selection),classes:rows.map(o=>o.style.classification),diagnostics:out.diagnostics?{numeric_candidates:out.diagnostics.numeric_candidates,rejection_reasons:out.diagnostics.rejection_reasons,source_capacity_bounds:out.diagnostics.source_capacity_bounds}:null,no_match:out.no_match||null};
  if(!valid)throw Error('SET_VERIFICATION_FAILED');
 }catch(e){r={anchor,style,occasion,error:e.message,stack:e.stack};}
 r.seconds=(performance.now()-t)/1000;fs.appendFileSync(OUT,JSON.stringify(r)+'\n');console.log(++n,occasion,anchor,style,r.count??'ERROR',r.error||'',r.seconds.toFixed(2));
}
