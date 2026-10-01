'use strict';
const path=require('path'),fs=require('fs'),assert=require('node:assert/strict');
const R=path.resolve(__dirname,'..'),B=process.env.HEWRS_BASELINE,load=require('./core-loader.cjs'),style=process.argv[2]||'AUTO';
if(!['AUTO','CLASSIC','HYBRID','MODERN'].includes(style))throw Error('Unknown style');
const rows=[];
for(const [label,root]of [['baseline',B],['corrected',R]]){
 const g=load(root),c=g.HEWRSCleanConnection.create(g.HEWRS_INPUTS);
 const config={automatic:true,stylistMode:'research',preferences:Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(k=>[k,{mode:'any'}])),occasion:'clinic',formality:'any',style,localDate:'2026-10-01',environment:{source:'not_assessed',date:'2026-10-01'}};
 const q=c.makeRequest(config),start=performance.now(),result=c.controller.generate(q,c.catalogue,[]);
 assert.ok(c.controller.verifyOptionSet(result.options,q));
 rows.push({label,count:result.options.length,seconds:(performance.now()-start)/1000,config,selections:result.options.map(o=>o._hewrsConnected.canonical_selection),scores:result.options.map(o=>o._hewrsConnected.preference?.score??o._hewrsConnected.compatibility?.display_score)});
 console.log(label,style,rows.at(-1).count,rows.at(-1).seconds.toFixed(2));
}
assert.equal(JSON.stringify(rows[0].selections),JSON.stringify(rows[1].selections),'Shoe display change altered exact option list');assert.equal(JSON.stringify(rows[0].scores),JSON.stringify(rows[1].scores),'Shoe display change altered scores');
const E=R+'/evidence/shoe15_v1_23_1';fs.mkdirSync(E,{recursive:true});fs.writeFileSync(E+'/STYLE_'+style+'.json',JSON.stringify({style,passed:true,scope:'New baseline-versus-correction local engine regression. Empty test wear history and inactive learning. No current device state or hosted failure is reproduced.',rows},null,2)+'\n');
console.log('PASS',style,'exact lists and scores retained');
