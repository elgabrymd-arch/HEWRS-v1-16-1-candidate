'use strict';
/* Run: node tests/rejection-index-v2.cjs
 * Pure indexing regression. Does NOT test IndexedDB persistence or migration.
 */
const assert = require('node:assert/strict');
const {create} = require('../src/rejection-index-v2.js');
const outfitKey = (s, scope) => [s.shirtId, s.state, ...(scope === 'outfit' ? [s.shoeId] : [])].join('|');
const tieKey = (s, scope) => {
  if (!/^T\d{3}$/.test(s.state)) throw Error('No tie');
  return scope === 'tie' ? s.state : s.shirtId + '|' + s.state;
};
const idx = create({outfitKey, tieKey});
const sample = i => ({
  namespace:'outfit',
  event:{
    schema:'hewrs.outfit-feedback.event.v1', id:'outfit_'+i,
    at:'2026-11-18T00:00:00Z', type:'hide', actor:'owner',
    selection:{
      shirtId:'DS'+String(i%100+1).padStart(3,'0'),
      state:'T'+String(Math.floor(i/100)%50+1).padStart(3,'0'),
      shoeId:'shoe-'+(Math.floor(i/5000)+1)
    },
    scope:'outfit',occasion:'work',reason:null
  }
});
const records = Array.from({length:30000}, (_, i) => sample(i));
assert.deepEqual(idx.load(records), {events:30000,active:30000,revision:1});
for (const i of [0, 14567, 29999]) {
  assert.equal(idx.match(records[i].event.selection, 'work')[0].event.id, 'outfit_'+i);
}
assert.equal(idx.match(records[0].event.selection, 'dinner').length, 0);
assert.equal(idx.append(records[0]), false, 'same-ID replay must be idempotent');
assert.throws(() => idx.append({
  ...records[0], event:{...records[0].event,reason:'colors'}
}), /Conflicting event ID/);
const restore = {
  namespace:'outfit',
  event:{schema:'hewrs.outfit-feedback.event.v1',id:'restore_one',
    type:'restore',at:'2026-11-18T00:00:00Z',target:'outfit_0'}
};
assert.equal(idx.append(restore), true);
assert.equal(idx.match(records[0].event.selection, 'work').length, 0);
assert.equal(idx.stats().active, 29999);
assert.equal(idx.append(restore), false);
idx.append({namespace:'tie',event:{
  schema:'hewrs.tie-feedback.event.v1',id:'tie_one',type:'hide',
  actor:'owner',selection:{shirtId:'DS001',state:'T003'},
  scope:'tie',occasion:'all',reason:null,note:'',at:'2026-11-18T00:00:00Z'
}});
assert.equal(idx.match({shirtId:'DS999',state:'T003',shoeId:'shoe-400'},'weekend').length,1);
assert.equal(idx.page(0, 15).length, 15);
assert.equal(idx.page(29999, 15).length, 1);
const before = idx.stats();
assert.throws(() => idx.load([...records, records[0]]), /Duplicate rejection event ID/);
assert.deepEqual(idx.stats(),before,'invalid bulk load must not erase the validated index');
assert.throws(() => idx.append({namespace:'tie',event:{
  schema:'hewrs.tie-feedback.event.v1',id:'wrong_target',
  type:'restore',at:'2026-11-18T00:00:00Z',target:'outfit_1'
}}),/Undo target missing/);
console.log('rejection-index-v2: PASS 30,000 exclusions, exact lookup, scope, undo, replay, pagination and failed-load preservation');
