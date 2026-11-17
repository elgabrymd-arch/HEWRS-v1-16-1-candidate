'use strict';
// Regression: Never show again must remain cumulative within one generation
// and across a fresh browser-store instance. No approved app files are changed.
const assert = require('node:assert/strict');
const F = require('../outfit-feedback.js');
function memoryStorage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(i) { return [...data.keys()][i] ?? null; },
    getItem(k) { return data.has(k) ? data.get(k) : null; },
    setItem(k,v) { data.set(String(k),String(v)); },
    removeItem(k) { data.delete(k); }
  };
}
const storage = memoryStorage();
let serial = 0;
function store() {
  return F.create({
    storage,
    now: () => '2026-11-17T22:00:00.000Z',
    id: () => 'cumulative_' + (++serial)
  });
}
const feedback = store();
const selections = Array.from({length:20}, (_, i) => ({
  suitId: 'S01',
  shirtId: 'DS' + String(i+1).padStart(3,'0'),
  state: 'NO_TIE',
  shoeId: 'shoe-1',
  watchId: null
}));
feedback.refresh();
for (let i=0; i<selections.length; i++) {
  feedback.hide(selections[i], {context:'all',scope:'outfit'});
  assert.equal(feedback.refresh().active.length, i+1,
    'A later rejection must not erase an earlier one');
  for (let j=0; j<=i; j++)
    assert.equal(feedback.allowed(selections[j], {occasion:'work'}), false,
      'Previously rejected outfit returned at rejection ' + (i+1));
}
const reopened = store();
assert.equal(reopened.refresh().active.length,20);
for(const s of selections) assert.equal(reopened.allowed(s,{occasion:'dinner'}),false);
// A permanent "all" rejection is global across new generations and occasions.
for (let generation=1; generation<=100; generation++) {
  const gate=store(); gate.refresh();
  const occasion=['work','dinner','weekend'][generation%3];
  for (const selection of selections) {
    assert.equal(gate.allowed(selection,{occasion}),false,
      'Permanent rejection leaked into generation '+generation+' for '+occasion);
    const changedWatch={...selection,watchId:'watch-check'};
    assert.equal(gate.allowed(changedWatch,{occasion}),false,
      'Watch change bypassed saved rejection in generation '+generation);
  }
}
const stillAllowed = {...selections[0],shoeId:'shoe-2'};
assert.equal(reopened.allowed(stillAllowed,{occasion:'work'}),true,
  'Exact outfit scope must not ban different footwear');
const first = reopened.snapshot().active.find(x => F.key(x.selection) === F.key(selections[0]));
assert.equal(reopened.restore(first.id),true);
assert.equal(reopened.allowed(selections[0],{occasion:'work'}),true);
for(const s of selections.slice(1))
  assert.equal(reopened.allowed(s,{occasion:'work'}),false);
console.log('Cumulative rejection ledger: 20 hides, 100 generations across occasions, watch variation, reload, scope and undo passed');
