'use strict';
const fs=require('fs'),path=require('path');
const[R,OUT,occasion='work',style='AUTO',lock='B15']=process.argv.slice(2);
const g=require(path.join(R,'tests/core-loader.cjs'))(R),c=g.HEWRSCleanConnection.create(g.HEWRS_INPUTS);
const config={automatic:true,stylistMode:'research',preferences:Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(k=>[k,{mode:'any'}])),occasion,formality:'any',style,localDate:'2026-10-06',environment:{source:'not_assessed',date:'2026-10-06'}};
if(lock!=='free')config.preferences.topwear={mode:'item',id:lock==='S05'?c.aliases.get('S05'):'blazer-source-B15'};
if(lock==='noTie')config.preferences.tie={mode:'none'};
if(lock==='tie17')config.preferences.tie={mode:'item',id:'T017'};
if(lock==='shoe1')config.preferences.shoes={mode:'item',id:'shoe-1'};
const start=performance.now();const q=c.makeRequest(config),res=c.controller.generate(q,c.catalogue,[]);
if(!c.controller.verifyOptionSet(res.options||[],q))throw Error('Invalid option set');
for(const o of res.options||[]){if(!c.controller.verifyCachedOption(o,q,c.catalogue))throw Error('Invalid cached option');c.validateSelection(o._hewrsConnected.canonical_selection);}
const rows=(res.options||[]).map(o=>({selection:o._hewrsConnected.canonical_selection,style:o._hewrsConnected.compatibility?.style,score:o._hewrsConnected.compatibility?.score,foundation:o._hewrsConnected.compatibility?.foundation,preference:o._hewrsConnected.preference}));
const result={config,request:q,status:res.status,reason:res.reason,verified:true,count:rows.length,seconds:(performance.now()-start)/1000,rows};fs.writeFileSync(OUT,JSON.stringify(result,null,2));console.log(occasion,style,lock,result.count,result.seconds.toFixed(2));
