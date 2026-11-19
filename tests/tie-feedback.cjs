'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../outfit-feedback.js');
const T = require('../src/tie-feedback.js');
const core = fs.readFileSync(path.join(__dirname, '../src/outfit-rejection-core.js'), 'utf8');
let serial = 0;
function storage() {
  const rows = new Map();
  return {rows, get length() {return rows.size;}, key:i => [...rows.keys()][i] ?? null,
    getItem:k => rows.get(k) ?? null, setItem:(k, v) => rows.set(String(k), String(v)), removeItem:k => rows.delete(k)};
}
const outfit = (extra = {}) => ({suitId:'S03', shirtId:'DS010', state:'T022', shoeId:'shoe-4', watchId:null, ...extra});
function harness(backend = storage(), suppliedBase = null) {
  const base = suppliedBase || F.create({storage:backend, id:() => 'outfit_' + ++serial});
  base.refresh();
  const connection = {validateSelection:F.normal, ownerFeedback:{set(value) {this.gate=value;}},
    controller:{generate:() => ({options:[]}), generateAsync:async() => ({options:[]})}};
  const app = {ownerFeedback:base, ownerFeedbackPersistent:true, connection,
    state:() => ({preferences:{}, context:{occasion:'work'}})};
  const root = {Image:class Image {}, localStorage:backend, crypto:require('node:crypto').webcrypto,
    HEWRSOutfitFeedback:F, HEWRSTieFeedback:T, HEWRSApp:app};
  new Function('globalThis', core)(root);
  const gate = root.HEWRSRejectionPreviewCore.attach(app);
  return {gate, base, backend, root, connection};
}
function rows(backend) {return [...backend.rows].sort(([a],[b]) => a.localeCompare(b));}

test('explicit tie rejection blocks only that tie across partners and respects occasion', () => {
  const {gate} = harness();
  const event = gate.hide(outfit(), {scope:'tie', context:'work', reason:'other', note:'Reject this tie itself.'});
  assert.equal(event.scope, 'tie');
  assert.match(event.id, /^tie_/);
  for (const variation of [{}, {suitId:'S04'}, {shirtId:'DS011'}, {shoeId:'shoe-19', watchId:'watch-changed'}]) {
    assert.equal(gate.allowed(outfit(variation), {occasion:'work'}), false);
    assert.equal(gate.allowed(outfit(variation), {occasion:'dinner'}), true);
  }
  assert.equal(gate.allowed(outfit({state:'T023'}), {occasion:'work'}), true);
  assert.equal(gate.allowed(outfit({state:'NO_TIE'}), {occasion:'work'}), true);
  assert.equal(gate.allowed(outfit({tie:null}), {occasion:'work'}), false, 'Unused extra fields cannot override canonical tie state');
  assert.equal(gate.allowed({topwear:'S03', pants:null, shirt:'DS010', tie:null, shoe:'shoe-4'}, {occasion:'work'}), true);
  assert.equal(gate.hide(outfit({suitId:'S05'}), {scope:'tie', context:'work'}).id, event.id, 'Same scope/occasion/tie is idempotent');
  assert.equal(gate.snapshot().active.length, 1);
});

test('shirt–tie pair applies across outfits without banning either garment separately', () => {
  const {gate} = harness();
  const event = gate.hide(outfit(), {scope:'shirt_tie', context:'all'});
  for (const occasion of ['work', 'dinner', 'weekend']) {
    assert.equal(gate.allowed(outfit({suitId:'S06', shoeId:'shoe-2', watchId:'watch-any'}), {occasion}), false);
    assert.equal(gate.allowed({blazerId:'B06', pantId:'PT005', shirtId:'DS010', state:'T022', shoeId:'shoe-3'}, {occasion}), false);
    assert.equal(gate.allowed(outfit({shirtId:'DS011'}), {occasion}), true);
    assert.equal(gate.allowed(outfit({state:'T023'}), {occasion}), true);
  }
  assert.deepEqual(gate.reorder([outfit(), outfit({shirtId:'DS011'})], value => value, {occasion:'work'}), [outfit({shirtId:'DS011'})]);
  assert.equal(gate.restore(event.id), true);
  assert.equal(gate.restore(event.id), false);
  assert.equal(gate.allowed(outfit(), {occasion:'work'}), true);
});

test('legacy outfit/clothing rejections, notes and event bytes retain their original meaning', () => {
  const backend = storage(), {gate, base} = harness(backend);
  const old = base.hide(outfit(), {scope:'clothing', context:'all', reason:'other'});
  const legacy = {...old, id:'legacy_note', note:'Issue: Shirt is fine; tie does not work with this shirt.'};
  base.importData({schema:F.EXPORT, events:[legacy]});
  const before = rows(backend);
  const tie = gate.hide(outfit({state:'T023'}), {scope:'tie', context:'all'});
  gate.restore(tie.id);
  assert.deepEqual(rows(backend).filter(([key]) => key.startsWith(F.PREFIX)), before);
  assert.equal(gate.allowed(outfit({suitId:'S04'}), {occasion:'work'}), true, 'Old tie/shirt diagnosis does not become pair rejection');
  assert.equal(gate.allowed(outfit({shoeId:'shoe-19'}), {occasion:'work'}), false, 'Old clothing scope still spans shoes');
  const exact = gate.hide(outfit({shirtId:'DS011'}), {scope:'outfit', context:'all'});
  assert.equal(exact.schema, F.SCHEMA);
  assert.equal(gate.allowed(outfit({shirtId:'DS011', shoeId:'shoe-19'}), {occasion:'work'}), true);
});

test('reload, two concurrent instances, undo and token invalidation preserve both ledgers', () => {
  const backend = storage(), first = harness(backend), second = harness(backend);
  const token = first.gate.token();
  let notified = 0;
  first.gate.subscribe(() => notified++);
  const tie = first.gate.hide(outfit(), {scope:'tie', context:'all'});
  second.gate.hide(outfit({state:'T023', shirtId:'DS011'}), {scope:'shirt_tie', context:'all'});
  assert.equal(notified, 1);
  assert.throws(() => first.gate.assertCurrent(token), /changed/);
  assert.equal(first.gate.refresh().active.length, 2);
  const reopened = harness(backend);
  assert.equal(reopened.gate.allowed(outfit(), {occasion:'weekend'}), false);
  assert.equal(reopened.gate.allowed(outfit({state:'T023', shirtId:'DS011'}), {occasion:'dinner'}), false);
  second.gate.restore(tie.id);
  assert.equal(first.gate.allowed(outfit(), {occasion:'work'}), true, 'Tie reader sees another instance’s undo');
  assert.equal(reopened.gate.refresh().active.length, 1);
  assert.ok(first.gate.prefixes.includes(T.PREFIX));
});

test('temporary tie/pair rejection resets independently and No Tie cannot become a garment ban', () => {
  const {gate, backend} = harness();
  const persistent = gate.hide(outfit({state:'T023'}), {scope:'tie', context:'all'});
  const skip = gate.skip(outfit(), {scope:'shirt_tie', context:'work'});
  assert.equal(gate.allowed(outfit({suitId:'S04'}), {occasion:'work'}), false);
  assert.equal(gate.allowed({topwear:'S03', pants:null, shirt:'DS010', tie:null, shoe:'shoe-4'}, {occasion:'work'}), true);
  assert.equal(gate.exportData().tie_feedback.events.length, 1, 'Temporary skips are not exported');
  assert.equal(harness(backend).gate.allowed(outfit(), {occasion:'work'}), true, 'Temporary skip does not survive reload');
  assert.equal(gate.restore(skip.id), true);
  gate.skip(outfit(), {scope:'tie', context:'all'});
  gate.clearTemporary();
  assert.equal(gate.allowed(outfit(), {occasion:'work'}), true);
  assert.equal(gate.allowed(outfit({state:'T023'}), {occasion:'work'}), false);
  for (const scope of ['tie','shirt_tie']) {
    assert.throws(() => gate.hide(outfit({state:'NO_TIE'}), {scope}), /actual tie/);
    assert.throws(() => gate.skip(outfit({state:'NO_TIE'}), {scope}), /actual tie/);
  }
  assert.equal(gate.snapshot().active[0].id, persistent.id);
});

test('combined backups round-trip, accept legacy backups, preserve undo and remain idempotent', () => {
  const source = harness();
  source.gate.hide(outfit(), {scope:'clothing', context:'dinner', note:'Original clothing rejection.'});
  const undone = source.gate.hide(outfit({state:'T023'}), {scope:'tie', context:'all', note:'Tie itself.'});
  source.gate.hide(outfit({state:'T024'}), {scope:'shirt_tie', context:'work', note:'Pair only.'});
  source.gate.restore(undone.id);
  const bundle = source.gate.exportData(), target = harness();
  assert.equal(bundle.schema, T.BUNDLE_EXPORT);
  target.gate.importData(bundle);
  const before = rows(target.backend);
  target.gate.importData(bundle);
  assert.deepEqual(rows(target.backend), before);
  assert.equal(target.gate.snapshot().active.length, 2);
  assert.equal(target.gate.allowed(outfit({state:'T023'}), {occasion:'work'}), true);
  assert.equal(target.gate.allowed(outfit({state:'T024', suitId:'S04'}), {occasion:'work'}), false);
  const legacyTarget = harness();
  legacyTarget.gate.importData(bundle.outfit_feedback);
  assert.equal(legacyTarget.gate.snapshot().active.length, 1);
  assert.equal(legacyTarget.gate.allowed(outfit({suitId:'S04'}), {occasion:'dinner'}), true);
  legacyTarget.gate.importData(bundle.tie_feedback);
  assert.equal(legacyTarget.gate.snapshot().active.length, 2);
});

test('invalid combined backups are fully preflighted before either persistent ledger changes', () => {
  const source = harness();
  source.gate.hide(outfit(), {scope:'clothing', context:'all'});
  source.gate.hide(outfit({state:'T023'}), {scope:'tie', context:'all'});
  const target = harness(), before = rows(target.backend);
  const corruptTie = source.gate.exportData();
  corruptTie.tie_feedback.events[0].scope = 'shirt';
  assert.throws(() => target.gate.importData(corruptTie), /scope/);
  assert.deepEqual(rows(target.backend), before, 'Valid outfit half is not written when tie half is invalid');
  const corruptOutfit = source.gate.exportData();
  corruptOutfit.outfit_feedback.events[0].scope = 'tie';
  assert.throws(() => target.gate.importData(corruptOutfit), /scope/);
  assert.deepEqual(rows(target.backend), before);
  const orphan = source.gate.exportData();
  orphan.tie_feedback.events.push({schema:T.SCHEMA, id:'tie_orphan', at:new Date().toISOString(), type:'restore', target:'tie_missing'});
  assert.throws(() => target.gate.importData(orphan), /target is missing/);
  assert.deepEqual(rows(target.backend), before);
  const colliding = source.gate.exportData();
  colliding.outfit_feedback.events[0].id = colliding.tie_feedback.events[0].id;
  assert.throws(() => target.gate.importData(colliding), /conflicting event IDs/);
  assert.deepEqual(rows(target.backend), before, 'Cross-ledger ID collisions cannot make undo ambiguous');
  target.gate.importData(source.gate.exportData());
  const conflict = source.gate.exportData();
  conflict.tie_feedback.events[0].selection.state = 'T024';
  const withRecords = rows(target.backend);
  assert.throws(() => target.gate.importData(conflict), /Conflicting/);
  assert.deepEqual(rows(target.backend), withRecords);
});

test('corrupt persistent tie records fail closed even for No Tie and remain untouched', () => {
  const {gate, backend} = harness();
  backend.setItem(T.PREFIX + 'tie_broken', '{');
  const before = rows(backend);
  assert.throws(() => gate.refresh(), /Unreadable tie rejection/);
  assert.throws(() => gate.allowed(outfit({state:'NO_TIE'}), {occasion:'work'}), /Unreadable tie rejection/);
  assert.throws(() => gate.allowed(outfit(), {occasion:'work'}), /Unreadable tie rejection/);
  assert.deepEqual(rows(backend), before);
});

test('partial storage failure is reported and importing the same bundle resumes safely', () => {
  const source = harness();
  source.gate.hide(outfit(), {scope:'clothing', context:'all'});
  source.gate.hide(outfit({state:'T023'}), {scope:'tie', context:'all'});
  const backend = storage(), rawSet = backend.setItem;
  let denyTie = true;
  backend.setItem = (key, value) => {
    if (denyTie && key.startsWith(T.PREFIX)) throw Error('Quota exceeded');
    rawSet(key, value);
  };
  const target = harness(backend), bundle = source.gate.exportData();
  assert.throws(() => target.gate.importData(bundle), /did not complete.*Quota exceeded/);
  assert.equal(target.base.refresh().active.length, 1, 'Already written immutable records are retained');
  denyTie = false;
  target.gate.importData(bundle);
  assert.equal(target.gate.snapshot().active.length, 2);
  assert.equal(rows(backend).length, 2);
});
