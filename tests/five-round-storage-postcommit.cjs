'use strict';

// Exercise the real wear store and real application handlers. A controlled
// Web Locks boundary pauses only promise settlement, after the write commits.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const application = fs.readFileSync(path.join(ROOT, 'src/outfit-refill-application.js'), 'utf8');
const copy = structuredClone;
const LOCK = 'a'.repeat(64);
const SELECTED = {suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:null};
const RESTORED = {...SELECTED,suitId:'S07'};
const NEWER = {...SELECTED,suitId:'S10'};

function source(first, next) {
  const start = application.indexOf(first), end = application.indexOf(next, start);
  assert.ok(start >= 0 && end > start, 'Actual application function boundaries exist');
  return application.slice(start, end);
}
function historyIds(s) {
  return {suit:s.suitId,shirt:s.shirtId,tie:s.state,shoes:s.shoeId,watch:s.watchId};
}
function event(id, selection = SELECTED) {
  return {id,localDate:'2026-11-19',date:'2026-11-19',confirmed:true,origin:'manual',controlledRepetition:false,
    items:Object.fromEntries(Object.entries(historyIds(selection)).map(([k,v]) => [k,v === null ? null : {id:v}])),
    canonical_selection:copy(selection),source_lock:LOCK};
}
function session(selection) {
  return {selection:copy(selection),origin:'manual',localDate:'2026-11-19',mode:'anchor',context:{occasion:'work',requiredFormality:'any'}};
}
function fixture(action) {
  const nodes = new Map(), buttons = new Map(), writes = [], dismissals = [], applied = [];
  let epoch = 0, release, markCommitted, invalidations = 0, refreshes = 0;
  const committed = new Promise(resolve => { markCommitted = resolve; });
  const initial = {schema:'hewrs.connected-app.local.v1',source_lock:LOCK,revision:4,session:session(SELECTED),events:[event('prior_wear')]};
  const backup = {...copy(initial),revision:90,session:session(RESTORED),events:[event('backup_wear',RESTORED)]};
  const records = new Map([['hewrs:connected-app:v1',JSON.stringify(initial)]]);
  const backend = {getItem:key => records.get(key) ?? null,setItem:(key,value) => { writes.push({key,value});records.set(key,value); }};
  const node = (tag, text) => {
    const result = {tag,textContent:text || '',children:[],dataset:{},checked:false,append(...values){this.children.push(...values);},setAttribute(){}};
    Object.defineProperty(result,'id',{get(){return this._id;},set(value){this._id=value;nodes.set(value,this);}});
    return result;
  };
  const c = vm.createContext({structuredClone,Date,Math,JSON,console,
    HEWRSStyleOccasions:{known:value => ['work','dinner','weekend'].includes(value),occasion:value=>value},
    navigator:{locks:{request(name, options, callback) {
      assert.equal(name,'hewrs:connected-app:v1');assert.equal(options.mode,'exclusive');
      return Promise.resolve().then(() => {
        const value = callback();
        return new Promise(resolve => {release=()=>resolve(value);markCommitted();});
      });
    }}},
    el:node,$:id => {if(!nodes.has(id))nodes.set(id,node('div'));return nodes.get(id);},
    copy,need:(value,message)=>{if(!value)throw Error(message);},
    modal:null,modalEpoch:0,logTransaction:null,restorePreview:null,generation:1,
    current:copy(SELECTED),origin:'manual',ctx:{localDate:'2026-11-19'},
    canLog:()=>true,ids:()=>'',localToday:()=>'2026-11-19',updateLogButtons(){},
    refreshHistory(){refreshes++;},invalidateRecommendations(){invalidations++;},status(){},
    sheetError(error){throw error;},setMode(){},updateHome(){},download(){},
    async apply(selection){applied.push(copy(selection));c.current=copy(selection);return {};},
    button(label,callback){const result=node('button',label);result.onclick=callback;buttons.set(label,result);return result;},
    openSheet(title, options={}) {
      c.modal?.cancel?.();c.modal={title,token:++epoch,cancel:options.cancel};c.modalEpoch=epoch;
      return {token:epoch,body:node('div'),actions:node('div')};
    },
    dismissSheet(cancel=true) {
      dismissals.push(c.modal?.token ?? null);if(cancel)c.modal?.cancel?.();c.modal=null;c.modalEpoch=++epoch;
    },
    connection:{validateSelection:copy,historyIds,createHistoryEvent:(selection,metadata)=>({...event(metadata.id,selection),...metadata,date:metadata.localDate})}
  });
  c.root=c;
  vm.runInContext(fs.readFileSync(path.join(ROOT,'src/local-state.js'),'utf8'),c);
  c.store=c.HEWRSLocalState.create(c.connection,LOCK,backend);
  let label;
  if(action==='wear'){
    vm.runInContext(source('function startLog()','function wardrobeRows('),c);vm.runInContext('startLog()',c);label='Confirm actual wear';
  } else if(action==='clear') {
    vm.runInContext(source('function confirmClear()','function download('),c);vm.runInContext('confirmClear()',c);label='Confirm clear';
  } else {
    vm.runInContext(source('function backup()','\n// Factual counts only'),c);vm.runInContext('backup()',c);
    c.restorePreview=c.store.previewImport(JSON.stringify(backup));label='Confirm restore';
  }
  return {c,initial,backup,committed,writes,dismissals,applied,action,click:()=>buttons.get(label).onclick(),
    release:()=>release(),durable:()=>JSON.parse(records.get(c.store.key)),
    invalidations:()=>invalidations,refreshes:()=>refreshes};
}

for (const action of ['wear','clear','restore']) {
  for (const continuation of ['same_panel','newer_panel','closed']) {
    test(`Committed ${action} preserves ${continuation} across Web Locks promise settlement`,async()=>{
      const h=fixture(action),originalToken=h.c.modal.token,pending=h.click();
      await h.committed;
      assert.equal(h.writes.length,1,'The real durable mutation has committed before changing the UI');
      if(continuation==='newer_panel'){
        h.c.openSheet('Newer user dialog');h.c.current=copy(NEWER);h.c.generation++;
      }else if(continuation==='closed'){
        h.c.dismissSheet();h.c.current=copy(NEWER);h.c.generation++;
      }
      const postCommitToken=h.c.modal?.token,priorDismissals=h.dismissals.length;
      h.release();await pending;
      assert.equal(h.writes.length,1,'Continuation cannot duplicate or roll back a committed mutation');
      const state=h.durable();assert.equal(state.revision,h.initial.revision+1);
      if(action==='wear'){
        assert.equal(state.events.length,2);assert.equal(state.events[0].id,'prior_wear');
        assert.deepEqual(state.events[1].canonical_selection,SELECTED);
      }else if(action==='clear'){
        assert.deepEqual(state.events,[]);assert.deepEqual(state.session,h.initial.session);
      }else{
        assert.deepEqual(state.events,h.backup.events);assert.deepEqual(state.session,h.backup.session);
      }
      assert.equal(h.invalidations(),1,'Committed wear changes invalidate stale recommendation state');
      assert.equal(h.refreshes(),1,'Committed ledger is reflected in history UI');
      if(continuation==='same_panel'){
        assert.equal(h.c.modal,null);assert.ok(h.dismissals.includes(originalToken));
        if(action==='restore')assert.deepEqual(h.applied,[RESTORED]);
      }else{
        assert.equal(h.dismissals.length,priorDismissals,'Old continuation cannot dismiss a newer or already closed panel');
        assert.equal(h.c.modal?.token,postCommitToken);
        assert.deepEqual(h.c.current,NEWER,'Old restore cannot replace a newer current outfit');
        assert.deepEqual(h.applied,[]);
      }
    });
  }
}
