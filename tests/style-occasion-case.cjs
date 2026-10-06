'use strict';
const fs=require('fs'),path=require('path');
const [R,OUT,occasion='work',style='AUTO',lock='none']=process.argv.slice(2);
const g=require(path.join(R,'tests/core-loader.cjs'))(R),c=g.HEWRSCleanConnection.create(g.HEWRS_INPUTS);
const cfg={automatic:true,stylistMode:'research',preferences:Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(k=>[k,{mode:'any'}])),occasion,formality:'any',style,localDate:'2026-10-01',environment:{source:'not_assessed',date:'2026-10-01'}};
if(lock==='shoe1')cfg.preferences.shoes={mode:'item',id:'shoe-1'};
if(lock==='noTie')cfg.preferences.tie={mode:'none'};
if(lock==='tie17')cfg.preferences.tie={mode:'item',id:'T017'};
if(lock==='s05')cfg.preferences.topwear={mode:'item',id:c.aliases.get('S05')};
if(lock==='sneaker')cfg.preferences.shoes={mode:'item',id:'shoe-42'};
if(lock==='watch')cfg.preferences.watch={mode:'item',id:'watch-AP06'};
if(lock==='cap2'||lock==='cap5'){const orig=g.HEWRSStyleOccasions;g.HEWRSStyleOccasions=Object.freeze({...orig,noTieCap:q=>q?.executiveStyle==='MODERN'?Number(lock.slice(3)):orig.noTieCap(q)});}
let q;
try{q=c.makeRequest(cfg);}catch(e){fs.writeFileSync(OUT,JSON.stringify({config:cfg,accepted:false,error:e.message},null,2));console.log('REJECT',occasion,style,e.message);process.exit(0);}
const t=performance.now(),res=c.controller.generate(q,c.catalogue,[]),secs=(performance.now()-t)/1000;
const verified=c.controller.verifyOptionSet(res.options||[],q);if(!verified)throw Error('Option set verification failed');
const rows=(res.options||[]).map(o=>({selection:o._hewrsConnected.canonical_selection,classification:o._hewrsConnected.compatibility.style?.classification,interventions:o._hewrsConnected.compatibility.style?.modern_interventions,preference:o._hewrsConnected.preference,compatibility:o._hewrsConnected.compatibility,items:o.items}));
const result={startup_identity:JSON.parse(fs.readFileSync(R+'/STARTUP_RESOURCES.json')).resource_integrity,test_only_cap_variant:/^cap/.test(lock)?Number(lock.slice(3)):null,config:cfg,accepted:true,request:q,status:res.status,verified,seconds:secs,count:rows.length,reason:res.reason,policy:res.option_policy,rows};
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n'); console.log(occasion,style,lock,rows.length,secs.toFixed(2),JSON.stringify(rows.reduce((s,x)=>(s[x.classification]=(s[x.classification]||0)+1,s),{})));
