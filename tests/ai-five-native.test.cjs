'use strict';
// Real wardrobe/ledger/rejection/rotation modules, with a controlled app-state
// fixture. This is not a browser test or an AI-provider evaluation.
const assert = require('node:assert/strict'), path = require('node:path');
const root = require('./core-loader.cjs')(path.resolve(__dirname, '..'));
const Native = require('../src/ai-five-native.js');
const Feedback = require('../src/owner-feedback.js');
const connection = root.HEWRSCleanConnection.create(root.HEWRS_INPUTS);
const policy = root.HEWRS_INPUTS.logicData.rotationPolicy;
const selection = {suitId:'S05',shirtId:'DS036',state:'T017',shoeId:'shoe-8',watchId:null};
const onceShared = {suitId:'S08',shirtId:'DS017',state:'T021',shoeId:'shoe-8',watchId:'watch-R03'};
const noShared = {suitId:'S10',shirtId:'DS022',state:'T022',shoeId:'shoe-3',watchId:'watch-P05'};
const date = '2026-10-20';
const q = connection.makeRequest({automatic:true,stylistMode:'research',
  preferences:Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(role=>[role,{mode:'any'}])),
  occasion:'work',formality:'any',style:'AUTO',localDate:date,
  environment:{source:'not_assessed',date}});
const clone = value => structuredClone(value);
function storage() {
  const map = new Map();
  return {get length(){return map.size;},key:index=>[...map.keys()][index]??null,
    getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};
}
function harness(events = []) {
  const backend = storage(), store = root.HEWRSLocalState.create(connection, root.HEWRS_INPUT_SHA256, backend);
  for (const event of events) store.addEvent(event);
  const feedback = Feedback.create({storage:backend,validateSelection:s=>connection.validateSelection(s),id:()=> 'fixture-hide'});
  feedback.refresh();
  const state = {report:{options:[{_hewrsConnected:{canonical_selection:clone(selection)}}]},optionCount:1,
    request:clone(q), context:{occasion:'work',formality:'any',style:'AUTO',localDate:date},
    preferences:clone(q.prefs), sourceLock:root.HEWRS_INPUT_SHA256,mode:'engine',busy:false};
  let environment = clone(q.environment), mutationObserver;
  class Observer {
    constructor(callback){this.callback=callback;this.records=[];mutationObserver=this;}
    observe(){} takeRecords(){const out=this.records;this.records=[];return out;} disconnect(){}
  }
  const app = {state:()=>clone(state),connection,store,ownerFeedback:feedback,
    weather:{request:()=>clone(environment)}};
  const native = Native.create({app,feedback,logic:root.HEWRSLogic,rotationPolicy:policy,
    document:{getElementById:()=>({})},MutationObserver:Observer});
  return {app, state, store, feedback, backend, native,
    weather:value=>{environment=clone(value);}, changedGeneration:()=>mutationObserver.records.push({type:'childList'})};
}
function event(s, localDate, id, controlledRepetition=false) {
  return connection.createHistoryEvent(s,{id,localDate,controlledRepetition,origin:'manual'});
}
function nativeResult(s, events, localDate=date) {
  const items = Object.fromEntries(Object.entries(connection.historyIds(s)).map(([role,id])=>[role,id===null?null:{id}]));
  return root.HEWRSLogic.selectRotation([{id:'expected',items,
    compatibility:{status:'computed',score:5,gate:'pass'},ensembleAudit:{status:'pass'},
    context:{status:'eligible'},style:{authorityGate:'pass'}}], events, {localDate,policy});
}
// The old 30-day exact-look exclusion is absent. Native recency is based on
// actual physical roles/IDs and permits an exact outfit again after day six.
for (const [days, expectedAllowed] of [[1,false],[6,false],[7,true],[29,true]]) {
  const day = new Date(Date.parse(date+'T00:00:00Z') - days*86400000).toISOString().slice(0,10);
  const events=[event(selection,day,'wear_'+days)], h=harness(events);
  const actual=h.native.rotationCheck(selection,q), expected=nativeResult(selection,events);
  assert.equal(actual.allowed,expectedAllowed,'Native rotation boundary at '+days+' days');
  assert.equal(actual.status,expected.status);
  assert.equal(actual.burden,expected.burden??null);
  assert.equal(actual.confirmed_wear_records_used,expected.confirmed_wear_records_used);
  assert.ok(!Object.hasOwn(actual,'compatibility_score'),'Adapter placeholders must not appear as grades');
}
// One recent item is ordinarily permitted. Three marked incidents in the
// current calendar month activate the existing monthly exception requirement.
for (const incidentCount of [2,3]) {
  const events = [event(onceShared,'2026-10-19','recent_one'),
    ...Array.from({length:incidentCount},(_,i)=>event(noShared,'2026-10-0'+(i+1),'incident_'+i,true))];
  const h=harness(events), actual=h.native.rotationCheck(selection,q), expected=nativeResult(selection,events);
  assert.equal(actual.allowed,incidentCount===2);
  assert.equal(actual.status,expected.status);
  assert.equal(actual.monthly_repetition_incidents,incidentCount);
}
const priorMonth=[event(onceShared,'2026-10-19','recent_one'),
  ...[1,2,3].map(i=>event(noShared,'2026-09-0'+i,'old_'+i,true))];
assert.equal(harness(priorMonth).native.rotationAllows(selection,q),true);
const future=[event(selection,'2026-10-21','future')];
assert.equal(harness(future).native.rotationAllows(selection,q),true);

const h=harness(), savedBefore=h.store.exportText(), feedbackBefore=h.feedback.exportData().events;
assert.equal(h.native.validate(selection),true);
assert.equal(h.native.validate({...selection,suitId:'S99'}),false);
assert.equal(h.native.validate({...selection,state:'REFERENCE'}),false);
assert.equal(h.native.validate({...selection,state:'NO_TIE'},{requiredFormality:'tie_required'}),false);
assert.equal(h.native.validate(selection,{requiredFormality:'tie_required'}),true);
assert.equal(h.native.validate(selection,{requiredFormality:'open_collar_allowed'}),true);
assert.equal(h.native.ownerAllows(selection,q.context),true);
const before=h.native.read();
assert.equal(h.native.assertCurrent(before),true);
assert.ok(Object.isFrozen(before) && Object.isFrozen(before.options) && Object.isFrozen(before.guards));
assert.equal(h.store.exportText(),savedBefore,'Read-only adapter changed the ledger');
assert.deepEqual(h.feedback.exportData().events,feedbackBefore,'Read-only adapter changed owner feedback');

// Active controls, actual weather, identical-list regeneration, native list
// identity, source revision, pending generation and data integrity invalidate.
for (const change of [
  x=>{x.state.context.occasion='dinner';},
  x=>{x.state.context.localDate='2026-10-21';},
  x=>{x.state.context.style='MODERN';},
  x=>{x.state.preferences.tie={mode:'none'};},
  x=>{x.weather({source:'not_assessed',date:'2026-10-21'});},
  x=>{x.changedGeneration();},
  x=>{x.state.report.options[0]._hewrsConnected.canonical_selection.watchId='watch-R03';},
  x=>{x.state.sourceLock='changed';},
  x=>{x.state.busy=true;},
  x=>{x.state.optionCount=0;},
  x=>{x.store.addEvent(event(selection,date,'new_wear'));},
  x=>{x.feedback.hide(selection,{context:'work'});},
  x=>{x.backend.setItem(x.store.key,'invalid-json');}
]) {
  const current=harness(), snapshot=current.native.read();change(current);
  assert.throws(()=>current.native.assertCurrent(snapshot),'An actual native-state change was missed');
}
const rejected=harness();rejected.feedback.hide(selection,{context:'work'});
assert.equal(rejected.native.ownerAllows(selection,{occasion:'work',requiredFormality:'any'}),false);
assert.equal(rejected.native.ownerAllows(selection,{occasion:'dinner',requiredFormality:'any'}),true);
// The free-thinking AI brief removes the old B01/B11 garment styling rules
// from this adapter only. Test actual owned/renderable tied blazer outfits
// with formal shoes; the untouched native gate must continue to reject them.
for (const blazerId of ['B11','B01']) {
  const h=harness(), tied={blazerId,pantId:'PG003',shirtId:'DS001',state:'T017',shoeId:'shoe-3',watchId:null};
  assert.equal(h.native.validate(tied,q.context),true);
  const before=h.feedback.match(tied,q.context);
  assert.equal(before.allowed,false);
  assert.ok(before.reasons.length>=2);
  assert.equal(h.native.ownerAllows(tied,q.context),true,'Legacy garment styling rule restricted AI Five');
  assert.deepEqual(h.feedback.match(tied,q.context),before,'AI exemption changed the original gate');
  h.feedback.hide(tied,{context:'work'});
  assert.equal(h.native.ownerAllows(tied,q.context),false,'Explicit saved hide was lost behind the garment exemption');
}
const exactRejected={suitId:'S07',shirtId:'DS017',state:'T030',shoeId:'shoe-15',watchId:null};
assert.equal(harness().native.ownerAllows(exactRejected,q.context),false,'Exact owner batch rejection was exempted');
const coreRejected={suitId:'S01',shirtId:'DS029',state:'T024',shoeId:'shoe-8',watchId:null};
assert.equal(harness().native.ownerAllows(coreRejected,q.context),false,'Core outfit rejection was exempted');
const neither=harness();
neither.feedback.importPreferences({schema:'hewrs.outfit-preferences.v1',source_lock:root.HEWRS_INPUT_SHA256,
  revision:1,enabled:true,comparisons:[{id:'neither_pair',vote:'neither',partition:'training',reason:'other',
    created_at:'2026-10-20T00:00:00.000Z',a:clone(selection),b:clone(noShared),context:clone(q.context)}]});
assert.equal(neither.native.ownerAllows(selection,q.context),false,'Historical Neither rejection was exempted');
for (const reason of [
  {type:'temporary_skip',scope:'outfit',id:'skip_fixture'},
  {type:'owner_batch_rule',scope:'garment',id:'OWNER-B11-FUTURE-UNKNOWN-RULE'},
  {type:'owner_batch_rule',scope:'outfit',id:'OWNER-B11-NO-TIE'},
  {type:'hide',scope:'garment',id:'OWNER-B11-NO-TIE'},
  {type:'unknown_reason',scope:'garment',id:'OWNER-B01-NO-TIE'}
]) {
  const h=harness(), feedback={...h.feedback,match:()=>({allowed:false,reasons:[reason]})};
  const native=Native.create({app:h.app,feedback,logic:root.HEWRSLogic,rotationPolicy:policy});
  assert.equal(native.ownerAllows(selection,q.context),false,'Unknown/non-garment rejection was exempted');
}
assert.equal(Native.stable({b:2,a:1}),Native.stable({a:1,b:2}));
console.log('PASS AI Five native wardrobe, original rotation, scoped garment-rule exemption, exact vetoes and snapshot invalidation; no provider or user-data writes');
