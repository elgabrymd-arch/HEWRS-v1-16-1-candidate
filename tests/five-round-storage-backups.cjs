'use strict';
// Real storage modules with a small, strict synthetic catalogue. No owner data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const LOCK = 'a'.repeat(64);
const WHEN = '2026-11-19T01:00:00.000Z';
const selected = {suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:null};
const other = {...selected,shirtId:'DS007',state:'T009'};
const plain = value => JSON.parse(JSON.stringify(value));
const connection = {
  validateSelection(value) {
    assert.deepEqual(Object.keys(value).sort(), Object.keys(selected).sort());
    assert.ok(['S05','S03'].includes(value.suitId));
    assert.ok(['DS029','DS007'].includes(value.shirtId));
    assert.ok(['T029','T009','NO_TIE'].includes(value.state));
    assert.ok(['shoe-1','shoe-2'].includes(value.shoeId));
    assert.ok(value.watchId === null || value.watchId === 'watch-AP09');
    return structuredClone(value);
  },
  historyIds(value) {
    this.validateSelection(value);
    return {topwear:'suit-'+value.suitId,shirt:'shirt-'+value.shirtId,tie:value.state==='NO_TIE'?null:value.state,shoes:value.shoeId,watch:value.watchId,pants:null};
  }
};
const context = vm.createContext({structuredClone,Date,HEWRSStyleOccasions:{known:v=>['work','clinic','hospital','office','dinner','weekend'].includes(v)}});
for (const file of ['src/local-state.js','src/favorites-state.js']) vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
function memory() {
  const records = new Map(), writes = [];
  return {records,writes,failRead:false,failWrite:false,dropWrite:false,
    getItem(key) {if(this.failRead)throw Error('synthetic read failure');return records.get(key)??null;},
    setItem(key,value) {if(this.failWrite)throw Error('synthetic quota failure');if(!this.dropWrite){records.set(key,String(value));writes.push([key,String(value)]);}}
  };
}
function store(kind,back) {return kind==='wear'?context.HEWRSLocalState.create(connection,LOCK,back):context.HEWRSFavorites.create(connection,LOCK,back);}
function event(id,selection=selected) {
  return {id,localDate:'2026-11-19',date:'2026-11-19',confirmed:true,origin:'manual',controlledRepetition:false,
    items:Object.fromEntries(Object.entries(connection.historyIds(selection)).map(([role,id])=>[role,id===null?null:{id}])),canonical_selection:structuredClone(selection),source_lock:LOCK};
}
function add(kind,target,id,selection=selected) {
  return kind==='wear'?target.addEvent(event(id,selection)):target.add(selection,{id:'favorite_'+id,created_at:WHEN});
}
function count(kind,value) {return kind==='wear'?value.events.length:value.items.length;}

for (const kind of ['wear','favorites']) {
  test(kind+' export reads the current durable record, including another tab additions',()=>{
    const back=memory(),first=store(kind,back),second=store(kind,back);
    add(kind,second,'other_tab');const bytes=back.records.get(first.key),writes=back.writes.length;
    assert.equal(count(kind,JSON.parse(first.exportText())),1);
    assert.equal(back.records.get(first.key),bytes);assert.equal(back.writes.length,writes);
  });
  test(kind+' export preserves newly corrupt current bytes instead of claiming a clean cached backup',()=>{
    const back=memory(),target=store(kind,back);add(kind,target,'saved');const good=back.records.get(target.key);
    const corrupt='{existing corrupt '+kind+' bytes';back.records.set(target.key,corrupt);const writes=back.writes.length;
    assert.equal(target.exportText(),corrupt);assert.ok(target.status().blocked);
    assert.throws(()=>add(kind,target,'blocked',other));assert.equal(back.records.get(target.key),corrupt);assert.equal(back.writes.length,writes);
    back.records.set(target.key,good);assert.equal(count(kind,JSON.parse(target.exportText())),1);assert.equal(target.status().blocked,null);
  });
  test(kind+' export refuses stale cached bytes when the durable read fails and recovers without writes',()=>{
    const back=memory(),target=store(kind,back);add(kind,target,'saved');const bytes=back.records.get(target.key),writes=back.writes.length;
    back.failRead=true;assert.throws(()=>target.exportText(),/could not be read|unavailable|read failure/i);assert.ok(target.status().blocked);
    back.failRead=false;assert.equal(count(kind,JSON.parse(target.exportText())),1);assert.equal(target.status().blocked,null);
    assert.equal(back.records.get(target.key),bytes);assert.equal(back.writes.length,writes);
  });
  test(kind+' session-memory export still works and caller edits cannot change stored state',()=>{
    const target=store(kind,null);add(kind,target,'memory');const output=JSON.parse(target.exportText());
    assert.equal(count(kind,output),1);assert.equal(target.status().persistent,false);
    (kind==='wear'?output.events:output.items).length=0;assert.equal(count(kind,JSON.parse(target.exportText())),1);
  });
  test(kind+' stale-tab writes and failed persistence never overwrite prior records or report success',()=>{
    const back=memory(),first=store(kind,back),second=store(kind,back);add(kind,second,'peer');const bytes=back.records.get(first.key);
    assert.throws(()=>add(kind,first,'stale',other),/another tab/);assert.equal(back.records.get(first.key),bytes);
    const fresh=store(kind,back);back.failWrite=true;assert.throws(()=>add(kind,fresh,'quota',other),/quota/);
    assert.equal(back.records.get(first.key),bytes);assert.equal(count(kind,fresh.snapshot()),1);
    back.failWrite=false;back.dropWrite=true;assert.throws(()=>add(kind,fresh,'dropped',other),/verified/);assert.equal(back.records.get(first.key),bytes);
  });
  test(kind+' verified write recovery reports persistent saving after a prior quota failure',()=>{
    const back=memory(),target=store(kind,back);back.failWrite=true;
    assert.throws(()=>add(kind,target,'quota'),/quota/);assert.equal(target.status().persistent,false);
    back.failWrite=false;add(kind,target,'recovered');
    assert.equal(count(kind,JSON.parse(back.records.get(target.key))),1);assert.equal(target.status().persistent,true);
  });
}

test('Favorites refresh exposes peer additions/removals and retains corrupt bytes during failed reads',()=>{
  const back=memory(),first=store('favorites',back),second=store('favorites',back);add('favorites',second,'peer');
  first.refresh();assert.equal(first.snapshot().items.length,1);
  second.remove('favorite_peer',second.snapshot().revision);first.refresh();assert.equal(first.snapshot().items.length,0);
  back.records.set(first.key,'{bad');assert.throws(()=>first.refresh());assert.ok(first.status().blocked);assert.equal(back.records.get(first.key),'{bad');
});
test('Favorites duplicate-save path cannot claim an item another tab already removed is still saved',()=>{
  const back=memory(),first=store('favorites',back);add('favorites',first,'saved');const second=store('favorites',back);
  second.remove('favorite_saved',second.snapshot().revision);const bytes=back.records.get(first.key);
  assert.throws(()=>add('favorites',first,'again'),/another tab/);assert.equal(back.records.get(first.key),bytes);
});
test('Favorites import no-op still validates that its reviewed storage snapshot is current',()=>{
  const back=memory(),first=store('favorites',back);add('favorites',first,'saved');const preview=first.previewImport(first.exportText()),second=store('favorites',back);
  second.remove('favorite_saved',second.snapshot().revision);const bytes=back.records.get(first.key);
  assert.throws(()=>first.merge(preview),/another tab|after preview/);assert.equal(back.records.get(first.key),bytes);
});
test('Favorites import stays bound to its preview after a refresh or export updates the cache',()=>{
  const back=memory(),first=store('favorites',back),incoming=store('favorites',null);add('favorites',incoming,'incoming');
  const preview=first.previewImport(incoming.exportText()),second=store('favorites',back);add('favorites',second,'peer',other);
  first.exportText();const bytes=back.records.get(first.key);assert.throws(()=>first.merge(preview),/after preview|another tab/);assert.equal(back.records.get(first.key),bytes);
});
test('Wear restore cannot erase changes that arrived after the displayed backup preview',()=>{
  const back=memory(),first=store('wear',back),incoming=store('wear',null),preview=first.previewImport(incoming.exportText()),second=store('wear',back);
  add('wear',second,'unseen_new_wear');first.readForGeneration();const bytes=back.records.get(first.key);
  assert.throws(()=>first.restore(preview),/changed|preview/);assert.equal(back.records.get(first.key),bytes);assert.equal(first.snapshot().events.length,1);
});
test('Wear restore rejects a stale preview after a same-tab write',()=>{
  const back=memory(),target=store('wear',back),preview=target.previewImport(target.exportText());add('wear',target,'new_wear');const bytes=back.records.get(target.key);
  assert.throws(()=>target.restore(preview),/changed|preview/);assert.equal(back.records.get(target.key),bytes);
});
test('Wear restore keeps the exact validated backup identity and supports explicit clearing',()=>{
  const back=memory(),source=store('wear',null);add('wear',source,'original');const target=store('wear',back),preview=target.previewImport(source.exportText());
  assert.deepEqual(Object.keys(preview).sort(),['schema','source_lock','revision','session','events'].sort());
  target.restore(preview);assert.deepEqual(plain(target.snapshot().events),plain(source.snapshot().events));
  const empty={...target.snapshot(),events:[]};target.restore(target.previewImport(JSON.stringify(empty)));assert.equal(target.snapshot().events.length,0);
});
test('Import confirmations reject a payload modified after its preview',()=>{
  for(const kind of ['wear','favorites']) {
    const back=memory(),target=store(kind,back),incoming=store(kind,null);add(kind,incoming,'reviewed');
    const preview=target.previewImport(incoming.exportText());
    if(kind==='wear'){preview.events=[];assert.throws(()=>target.restore(preview),/preview/);}
    else{preview.data.items=[];assert.throws(()=>target.merge(preview),/preview/);}
    assert.equal(back.writes.length,0);
  }
});
