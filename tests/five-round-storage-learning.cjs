'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/outfit-learning.js'),'utf8'),LOCK='a'.repeat(64),REV='synthetic-audit-source';
const canonicalOccasion=v=>['work','clinic','hospital','office'].includes(v)?'work':v;
const context=vm.createContext({structuredClone,Date,HEWRSSourceCorrections:{revision:REV},HEWRSStyleOccasions:{occasion:canonicalOccasion,known:v=>['work','clinic','hospital','office','dinner','weekend'].includes(v)},HEWRS_PREFERENCE_PILOT:{validation_topwear:['S09']}});
vm.runInContext(source,context,{filename:'src/outfit-learning.js'});
const selection={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:null};
const connection={validateSelection(value){assert.ok(value.suitId&&/^DS\d{3}$/.test(value.shirtId));assert.ok(/^T\d{3}$/.test(value.state)||value.state==='NO_TIE');return structuredClone(value);},hybrid:{researchPreference:{describeSelection:value=>({eligible:true,vector:[value.state==='T029'?.9:.1,...Array(11).fill(.5)]})}}};
function fixture(){const records=new Map([['wear-sentinel','UNTOUCHED'],['favorites-sentinel','UNTOUCHED']]),writes=[],back={failRead:false,failWrite:false,getItem(key){if(this.failRead)throw Error('synthetic read failure');return records.get(key)??null;},setItem(key,value){if(this.failWrite)throw Error('synthetic quota failure');records.set(key,value);writes.push(key);}};return{records,writes,back,store:context.HEWRSOutfitLearning.create(connection,LOCK,back)};}
function row(id='first',extra={}){return{id:'pref_'+id,created_at:'2026-11-19T01:00:00.000Z',a:structuredClone(selection),b:{...selection,state:'T009'},vote:'A',reason:'no_reason',partition:'training',pilot_id:null,context:{occasion:'work',requiredFormality:'any'},source_revision:REV,...extra};}
function reverseKeys(value){return Array.isArray(value)?value.map(reverseKeys):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,part])=>[key,reverseKeys(part)])):value;}
test('Preference backup duplicate identity is independent of JSON property order and preserves original records',()=>{
  const h=fixture(),original=row();h.store.add(original,h.store.read().token);const before=h.records.get(h.store.key),writes=h.writes.length,exported=JSON.parse(h.store.exportText());
  const preview=h.store.previewImport(JSON.stringify(reverseKeys(exported)));
  assert.equal(preview.added,0);assert.equal(preview.already_saved,1);assert.equal(h.records.get(h.store.key),before);assert.equal(h.writes.length,writes);
  h.store.merge(preview);assert.equal(JSON.stringify(h.store.snapshot().comparisons[0]),JSON.stringify(original));
  assert.equal(h.records.get('wear-sentinel'),'UNTOUCHED');assert.equal(h.records.get('favorites-sentinel'),'UNTOUCHED');
});
test('True preference ID/pair conflicts remain rejected without overwriting original votes',()=>{
  for(const change of [r=>r.vote='B',r=>r.reason='other',r=>r.created_at='2026-11-19T02:00:00.000Z',r=>r.a.shirtId='DS007',r=>r.id='pref_different_id']){
    const h=fixture();h.store.add(row(),h.store.read().token);const before=h.records.get(h.store.key),exported=JSON.parse(h.store.exportText());change(exported.comparisons[0]);
    assert.throws(()=>h.store.previewImport(JSON.stringify(exported)),/Conflicting/);assert.equal(h.records.get(h.store.key),before);
  }
});
test('Preference import retains existing learning switch and rejects stale confirmation tokens',()=>{
  const h=fixture(),incoming=fixture();h.store.setEnabled(false,h.store.read().token);incoming.store.add(row(),incoming.store.read().token);
  const preview=h.store.previewImport(incoming.store.exportText());assert.equal(preview.data.enabled,false);
  const peer=context.HEWRSOutfitLearning.create(connection,LOCK,h.back);peer.setEnabled(true,peer.read().token);const bytes=h.records.get(h.store.key);
  assert.throws(()=>h.store.merge(preview),/changed/);assert.equal(h.records.get(h.store.key),bytes);
});
test('Preference read/export failures retain bytes and recover only after a valid read',()=>{
  const h=fixture();h.store.add(row(),h.store.read().token);const good=h.records.get(h.store.key),writes=h.writes.length;
  h.records.set(h.store.key,'{unreadable preference bytes');assert.throws(()=>h.store.model(),/unavailable/);assert.throws(()=>h.store.exportText(),/unavailable/);assert.equal(h.records.get(h.store.key),'{unreadable preference bytes');
  h.records.set(h.store.key,good);h.back.failRead=true;assert.throws(()=>h.store.exportText(),/unavailable/);h.back.failRead=false;
  assert.equal(JSON.parse(h.store.exportText()).comparisons.length,1);assert.equal(h.store.status().blocked,null);assert.equal(h.writes.length,writes);
});
test('Source locks, reserved validation groups and vote metadata remain guarded',()=>{
  const h=fixture();h.store.add(row(),h.store.read().token);const original=h.records.get(h.store.key),document=JSON.parse(h.store.exportText());
  assert.throws(()=>h.store.previewImport(JSON.stringify({...document,source_lock:'b'.repeat(64)})));
  assert.throws(()=>h.store.add(row('held',{a:{...selection,suitId:'S09'}}),h.store.read().token),/Reserved/);
  assert.throws(()=>h.store.add(row('source',{a:{...selection,suitId:'S03'},source_revision:'unknown'}),h.store.read().token),/interpretation/);
  assert.equal(h.records.get(h.store.key),original);
});
test('Preference confirmation rejects mutated or forged previews without changing existing enable state or votes',()=>{
  for(const change of [p=>p.data.enabled=true,p=>p.data.comparisons=[],p=>p.data.comparisons[0].vote='B',p=>p.token.raw='forged']){
    const h=fixture(),incoming=fixture();h.store.setEnabled(false,h.store.read().token);incoming.store.add(row(),incoming.store.read().token);
    const preview=h.store.previewImport(incoming.store.exportText()),bytes=h.records.get(h.store.key);change(preview);
    assert.throws(()=>h.store.merge(preview),/after preview/);assert.equal(h.records.get(h.store.key),bytes);assert.equal(h.store.snapshot().enabled,false);
  }
  const h=fixture(),incoming=fixture();incoming.store.add(row(),incoming.store.read().token);const preview=h.store.previewImport(incoming.store.exportText());
  assert.throws(()=>h.store.merge(structuredClone(preview)),/preview/);assert.equal(h.writes.length,0);
});
test('Preference merge accepts the original reviewed backup once and consumes its approval ticket',()=>{
  const h=fixture(),incoming=fixture();h.store.setEnabled(false,h.store.read().token);incoming.store.add(row(),incoming.store.read().token);
  const preview=h.store.previewImport(incoming.store.exportText());h.store.merge(preview);const bytes=h.records.get(h.store.key);
  assert.equal(h.store.snapshot().comparisons.length,1);assert.equal(h.store.snapshot().enabled,false);
  assert.throws(()=>h.store.merge(preview),/preview/);assert.equal(h.records.get(h.store.key),bytes);
});
