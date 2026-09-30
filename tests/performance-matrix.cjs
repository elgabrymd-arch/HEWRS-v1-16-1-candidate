'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const R=path.resolve(__dirname,'..'),B=process.env.HEWRS_BASELINE;assert.ok(B);
const g=require('./core-loader.cjs')(R),c=g.HEWRSCleanConnection.create(g.HEWRS_INPUTS),L=g.HEWRSOutfitLearning;
const E=R+'/evidence/performance_v1_22_1',rows=[];
const cp=x=>JSON.parse(JSON.stringify(x)),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function counts(options,q){const d={},locks=new Set(g.HEWRSOptionSetPolicy.exactLocks(q));let nt=0;for(const o of options){for(const i of Object.values(o.items))if(i?.id)d[i.id]=(d[i.id]||0)+1;nt+=!o.items.tie;}for(const [id,n]of Object.entries(d))assert.ok(locks.has(id)||n<=(/^T\d{3}$/.test(id)?1:2),id);assert.ok(nt<=2||q.prefs.tie.mode==='none');return {counts:d,no_tie:nt};}
function save(){fs.writeFileSync(E+'/MATRIX_'+process.env.MODE+'.json',JSON.stringify({scope:'Fresh optimized runs compared with exact baseline packaged requests/results; timings environment-specific',rows},null,2));}
const model=L.fit(g.HEWRS_PREFERENCE_PILOT.records.slice(0,16).map((p,i)=>({id:'pref_fixture_'+i,a:p.a,b:p.b,vote:i%2?'A':'B',reason:'no_reason',context:p.context,partition:'training'})),c.hybrid.researchPreference.describeSelection);
const mode=process.env.MODE||'cold',original=JSON.parse(fs.readFileSync(B+'/evidence/local_preference_v1_22_0/GENERATION_MATRIX_'+mode+'.json')).rows;
c.hybrid.setLearningModel(mode==='cold'?L.empty():model);
for(const row of original){
 const start=performance.now(),q=cp(row.query),out=c.controller.generate(q,c.catalogue,[]),ms=performance.now()-start;
 assert.equal(out.options.length,row.count);assert.deepEqual(cp(out.options),cp(row.options));assert.ok(c.controller.verifyOptionSet(out.options,q));
 const count=counts(out.options,q);rows.push({mode,id:row.id,count:out.options.length,seconds:ms/1000,previous_seconds:row.seconds,entire_options_exactly_equal:true,options_sha256:hash(out.options),selections:out.options.map(x=>x._hewrsConnected.canonical_selection),...count});save();console.log(mode,row.id,(ms/1000).toFixed(3),'EXACT',out.options.length);
}
assert.equal(rows.length,33);console.log('PASS',mode,rows.length);
