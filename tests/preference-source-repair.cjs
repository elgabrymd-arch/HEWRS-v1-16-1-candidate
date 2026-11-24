'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{test}=require('node:test');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'preference-repair.html'),'utf8');
const ctx=vm.createContext({module:{exports:{}},JSON,Date});
vm.runInContext(html.match(/<script id="repair-core">([\s\S]*?)<\/script>/)[1],ctx);
const R=ctx.module.exports;
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const bank=[...read('data/preference-pilot.json').records,...read('data/preference-followup.json').records];
const raw=JSON.stringify({schema:'hewrs.outfit-preferences.v1',source_lock:R.LOCK,revision:36,enabled:true,comparisons:bank.map((p,i)=>({id:'pref_SYNTHETIC_REPAIR_'+i,created_at:'2026-11-19T10:00:00.000Z',a:p.a,b:p.b,vote:['A','B','both','neither'][i%4],reason:'no_reason',partition:p.partition,pilot_id:p.id,context:p.context,source_revision:R.OLD}))});
function fixture(input=raw){const map=new Map([[R.KEY,input],['wear','unchanged'],['favorites','unchanged'],['rejections','unchanged'],['home','unchanged']]),writes=[];const storage={getItem:k=>map.get(k)??null,setItem(k,v){writes.push(k);map.set(k,v);}};return {map,storage,writes};}
test('source-bound comparison bank exactly matches the 24 pilot and 12 follow-up pairs',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(R.bank())),bank.map(({id,a,b,context,partition})=>({id,a,b,context,partition})));
 assert.equal(R.OLD,read('data/owner-source-corrections.json').revision);
 assert.equal(R.CURRENT,R.OLD+'+'+read('data/issue22-garment-dna.json').revision);
 assert.match(html,/connect-src 'none'/);
});
test('36 original votes preserved, only 26 compatible copies rebound, 10 held, no other namespace touched',()=>{
 const h=fixture(),p=R.prepare(raw);assert.equal(p.retained,26);assert.equal(p.held.length,10);assert.equal(h.writes.length,0);
 R.apply(h.storage,raw);
 assert.equal(h.map.get(R.ARCHIVE),raw);assert.deepEqual(h.writes,[R.ARCHIVE,R.KEY]);
 const next=JSON.parse(h.map.get(R.KEY)),old=JSON.parse(raw);assert.equal(next.revision,37);assert.equal(next.enabled,true);assert.equal(next.comparisons.length,26);
 assert.deepEqual(next.comparisons,old.comparisons.filter(r=>!p.held.includes(r.pilot_id)).map(r=>({...r,source_revision:R.CURRENT})));
 for(const key of ['wear','favorites','rejections','home'])assert.equal(h.map.get(key),'unchanged');
});
test('exact old data, source, vote, pair, context, partition and all 36 identities are required',()=>{
 const changes=[d=>d.comparisons.pop(),d=>d.source_lock='a'.repeat(64),d=>d.comparisons[0].source_revision='unknown',d=>d.comparisons[0].a.shirtId='DS999',d=>d.comparisons[0].partition='validation',d=>d.comparisons[0].context.occasion='dinner',d=>d.comparisons[0].vote='unknown',d=>d.comparisons[0].pilot_id=d.comparisons[1].pilot_id,d=>d.comparisons[0].id=d.comparisons[1].id,d=>d.comparisons[0].created_at='invalid'];
 for(const mutate of changes){const d=JSON.parse(raw);mutate(d);const bad=JSON.stringify(d),h=fixture(bad);assert.throws(()=>R.apply(h.storage,bad));assert.equal(h.map.get(R.KEY),bad);assert.equal(h.writes.length,0);}
});
test('changed data, archive conflict and failed archive write prevent replacement',()=>{
 const changed=fixture(raw+' ');assert.throws(()=>R.apply(changed.storage,raw));assert.equal(changed.writes.length,0);
 const conflict=fixture();conflict.map.set(R.ARCHIVE,'different original');assert.throws(()=>R.apply(conflict.storage,raw));assert.equal(conflict.writes.length,0);assert.equal(conflict.map.get(R.KEY),raw);
 const quota=fixture();quota.storage.setItem=()=>{throw Error('quota');};assert.throws(()=>R.apply(quota.storage,raw));assert.equal(quota.map.get(R.KEY),raw);
 const partial=fixture();const write=partial.storage.setItem;partial.storage.setItem=(k,v)=>{if(k===R.KEY)throw Error('quota');write(k,v);};assert.throws(()=>R.apply(partial.storage,raw));assert.equal(partial.map.get(R.KEY),raw);assert.equal(partial.map.get(R.ARCHIVE),raw);
});
test('verified rollback preserves archive and refuses to erase new votes',()=>{
 const h=fixture();R.apply(h.storage,raw);R.restore(h.storage,raw);assert.equal(h.map.get(R.KEY),raw);assert.equal(h.map.get(R.ARCHIVE),raw);
 R.apply(h.storage,raw);const newer=JSON.parse(h.map.get(R.KEY));newer.revision++;h.map.set(R.KEY,JSON.stringify(newer));const before=h.map.get(R.KEY);assert.throws(()=>R.restore(h.storage,raw),/changed/);assert.equal(h.map.get(R.KEY),before);
});
test('actual current V3 preference validator accepts the 26 compatible copies and produces a current model',()=>{
 const {load}=require('./issue22-loader.cjs'),{g,connection}=load({issue22:true,index:false});
 assert.equal(g.HEWRSSourceCorrections.revision,R.CURRENT);assert.equal(g.HEWRS_INPUT_SHA256,R.LOCK);
 const h=fixture();const store=g.HEWRSOutfitLearning.create(connection,R.LOCK,h.storage);
 assert.throws(()=>store.model({occasion:'work'}),/Different interpretation/);
 R.apply(h.storage,raw);
 const recovered=store.model({occasion:'work'});
 assert.equal(recovered.state.comparisons.length,26);assert.equal(recovered.model.source_revision,R.CURRENT);assert.equal(store.status().blocked,null);assert.equal(h.map.get(R.ARCHIVE),raw);
 assert.equal(h.writes.length,2);
});