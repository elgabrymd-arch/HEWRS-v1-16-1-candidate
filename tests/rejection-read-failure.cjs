'use strict';
// Bridge regression tests with the shipped outfit/tie ledgers. The producer
// and canvas are spies: these checks assert that work/pixel publication cannot
// cross an unreadable-feedback boundary. Native engine/browser tests are separate.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../src/owner-feedback.js');
const T = require('../src/tie-feedback.js');
const source = fs.readFileSync(path.join(__dirname, '../src/outfit-rejection-core.js'), 'utf8');
const crypto = require('node:crypto').webcrypto;
const context = {occasion:'work', requiredFormality:'any'};
const request = {context};
const selection = patch => ({suitId:'S03', shirtId:'DS010', state:'T022', shoeId:'shoe-4', watchId:null, ...patch});
let serial = 0;

function storage() {
  const rows = new Map(), keys = [];
  let failRead = false;
  return {rows, get length() {return rows.size;}, key:i => keys[i] ?? null,
    getItem(key) {if (failRead) throw Error('Synthetic storage read failure'); return rows.get(key) ?? null;},
    setItem(key, value) {if (!rows.has(key)) keys.push(key); rows.set(key, String(value));},
    removeItem(key) {if (rows.delete(key)) keys.splice(keys.indexOf(key), 1);},
    failReads(value) {failRead = value;}};
}
const bytes = backend => [...backend.rows].sort(([a], [b]) => a.localeCompare(b));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}

function harness({backend=storage(), attach=true}={}) {
  const base = F.create({storage:backend, id:() => 'test_outfit_' + ++serial});
  // An existing store that cannot be read remains the same blocked instance.
  // Actual application startup and UI recovery are exercised in Chromium.
  try {base.refresh();} catch (_) {}
  const calls = {sync:0, async:0, render:0, cancel:0, visibleWrites:0};
  let produce = () => ({status:'ok', options:[{selection:selection({shirtId:'DS011'})}]}), renderTask = async () => ({cancelled:false});
  const connection = {
    validateSelection:F.normal,
    selectionFromOption:option => ({selection:option.selection}),
    ownerFeedback:{set(value) {this.gate = value;}},
    controller:{
      generate(...args) {calls.sync++; return produce(...args);},
      async generateAsync(...args) {calls.async++; return produce(...args);}
    }
  };
  const canvas = id => ({id, width:0, height:0, dataset:{}, getContext:() => ({
    getImageData:() => ({data:new Uint8ClampedArray(4)}),
    putImageData:() => {if (id) calls.visibleWrites++;}
  })});
  const document = {createElement(tag) {assert.equal(tag, 'canvas'); return canvas('');}};
  const root = {Image:class Image {}, crypto, localStorage:backend,
    HEWRSOutfitFeedback:F, HEWRSTieFeedback:T,
    HEWRSReviewedIntegration:{ownerContext:() => context},
    HEWRSCleanConnection:{create:() => connection},
    HEWRSAtomicRenderer:{create:off => ({
      async render(value) {calls.render++; const result = await renderTask(value); off.dataset.status = 'ready'; return result;},
      cancel() {calls.cancel++;}, last:() => null
    })}
  };
  new Function('globalThis', 'document', source)(root, document);
  const wrapped = root.HEWRSCleanConnection.create();
  const app = {ownerFeedback:base, connection:wrapped,
    get ownerFeedbackPersistent() {const state = base.status(); return state.persistent && state.ready && !state.blocked;},
    state:() => ({preferences:{}, context}),
  };
  root.HEWRSApp = app;
  const gate = attach ? root.HEWRSRejectionPreviewCore.attach(app) : null;
  return {backend, base, gate, root, app, calls, connection:wrapped,
    produce(fn) {produce = fn;}, renderTask(fn) {renderTask = fn;},
    renderer(id='avatar') {return root.HEWRSAtomicRenderer.create(canvas(id), wrapped, {});}
  };
}

test('generation before the shared feedback gate is ready cannot call a producer', async () => {
  const h = harness({attach:false});
  assert.throws(() => h.connection.controller.generate(request, {}, []), /feedback|ready|rejection/i);
  await assert.rejects(h.connection.controller.generateAsync(request, {}, []), /feedback|ready|rejection/i);
  assert.equal(h.calls.sync + h.calls.async, 0);
});

for (const [label, prefix] of [['outfit', F.PREFIX], ['tie', T.PREFIX]]) {
  test('unreadable ' + label + ' feedback stops synchronous and asynchronous producers before work', async () => {
    const h = harness();
    h.base.hide(selection(), {scope:'clothing', context:'all'});
    h.backend.setItem(prefix + 'broken_record', '{unreadable');
    const before = bytes(h.backend);
    assert.throws(() => h.connection.controller.generate(request, {}, []), /Unreadable/);
    await assert.rejects(h.connection.controller.generateAsync(request, {}, []), /Unreadable/);
    assert.equal(h.calls.sync, 0);
    assert.equal(h.calls.async, 0);
    assert.deepEqual(bytes(h.backend), before);
  });
}

test('schema-invalid and orphaned undo records cannot be treated as empty history', async () => {
  for (const bad of [
    {schema:F.SCHEMA, id:'bad_schema', at:'2026-11-18T12:00:00Z', type:'unknown'},
    {schema:F.SCHEMA, id:'bad_undo', at:'2026-11-18T12:00:00Z', type:'restore', target:'missing'}
  ]) {
    const h = harness();
    h.backend.setItem(F.PREFIX + bad.id, JSON.stringify(bad));
    const before = bytes(h.backend);
    await assert.rejects(h.connection.controller.generateAsync(request, {}, []), /Unknown feedback|Undo target/);
    assert.equal(h.calls.async, 0);
    assert.deepEqual(bytes(h.backend), before);
  }
});

test('unavailable storage blocks generation instead of assuming no saved exclusions', async () => {
  const h = harness({backend:null});
  assert.throws(() => h.gate.refresh(), /storage is unavailable/i);
  await assert.rejects(h.connection.controller.generateAsync(request, {}, []), /storage is unavailable/i);
  assert.equal(h.calls.async, 0);
  assert.equal(h.app.ownerFeedbackPersistent, false);
});

test('transient read failure recovers on the same store without losing earlier exclusions', async () => {
  const h = harness(), event = h.base.hide(selection(), {scope:'clothing', context:'all'});
  const before = bytes(h.backend), original = h.base;
  h.backend.failReads(true);
  await assert.rejects(h.connection.controller.generateAsync(request, {}, []), /Unreadable/);
  assert.equal(h.calls.async, 0);
  assert.equal(h.app.ownerFeedbackPersistent, false);
  h.backend.failReads(false);
  h.gate.refresh();
  assert.equal(h.base, original);
  assert.equal(h.app.ownerFeedbackPersistent, true);
  assert.equal(h.gate.match(selection(), context).allowed, false);
  assert.ok(h.gate.snapshot().active.some(item => item.id === event.id));
  const output = await h.connection.controller.generateAsync(request, {}, []);
  assert.equal(output.options.length, 1);
  assert.equal(h.calls.async, 1);
  assert.deepEqual(bytes(h.backend), before);
});

test('restoring an unreadable record to its original bytes re-enforces its original ban', async () => {
  const h = harness(), event = h.base.hide(selection(), {scope:'outfit', context:'all'});
  const key = F.PREFIX + event.id, valid = h.backend.getItem(key);
  h.backend.setItem(key, '{damaged');
  await assert.rejects(h.connection.controller.generateAsync(request, {}, []), /Unreadable/);
  assert.equal(h.backend.getItem(key), '{damaged');
  h.backend.setItem(key, valid);
  h.gate.refresh();
  assert.equal(h.gate.allowed(selection(), context), false);
  assert.equal(h.backend.getItem(key), valid);
  assert.equal(h.gate.snapshot().active.length, 1);
  await h.connection.controller.generateAsync(request, {}, []);
  assert.equal(h.calls.async, 1);
});

test('corruption during asynchronous generation prevents accepting its returned list', async () => {
  const h = harness(), wait = deferred();
  h.produce(() => wait.promise);
  const pending = h.connection.controller.generateAsync(request, {}, []);
  assert.equal(h.calls.async, 1);
  h.backend.setItem(F.PREFIX + 'during_generation', '{bad');
  const before = bytes(h.backend);
  wait.resolve({status:'ok', options:[{selection:selection()}]});
  await assert.rejects(pending, /Unreadable/);
  assert.equal(h.root.HEWRSRejectionPreviewCore.diagnostics().hasPool, false);
  assert.deepEqual(bytes(h.backend), before);
});

test('a valid feedback revision change invalidates an in-flight generated list', async () => {
  const h = harness(), wait = deferred();
  h.produce(() => wait.promise);
  const pending = h.connection.controller.generateAsync(request, {}, []);
  h.gate.hide(selection({state:'T023'}), {scope:'tie', context:'all'});
  const before = bytes(h.backend);
  // The returned option itself is still allowed. It must nevertheless not be
  // published as if it had been generated against the current feedback state.
  assert.equal(h.gate.allowed(selection(), context), true);
  wait.resolve({status:'ok', options:[{selection:selection()}]});
  await assert.rejects(pending, /changed/);
  assert.equal(h.root.HEWRSRejectionPreviewCore.diagnostics().hasPool, false);
  assert.deepEqual(bytes(h.backend), before);
});

for (const id of ['avatar', 'rd-canvas']) {
  test(id + ' refuses unreadable feedback before rendering or copying pixels', async () => {
    const h = harness();
    h.backend.setItem(F.PREFIX + 'bad_render', '{bad');
    const renderer = h.renderer(id), before = bytes(h.backend);
    await assert.rejects(renderer.render(selection()), /Unreadable/);
    assert.equal(h.calls.render, 0);
    assert.equal(h.calls.visibleWrites, 0);
    assert.equal(renderer.last(), null);
    assert.deepEqual(bytes(h.backend), before);
  });
  test(id + ' cannot publish pixels when feedback becomes unreadable during rendering', async () => {
    const h = harness(), wait = deferred();
    h.renderTask(() => wait.promise);
    const renderer = h.renderer(id), pending = renderer.render(selection());
    assert.equal(h.calls.render, 1);
    h.backend.setItem(T.PREFIX + 'tie_bad_render', '{bad');
    const before = bytes(h.backend);
    wait.resolve({cancelled:false});
    await assert.rejects(pending, /Unreadable/);
    assert.equal(h.calls.visibleWrites, 0);
    assert.equal(renderer.last(), null);
    assert.deepEqual(bytes(h.backend), before);
  });
}

test('a newly committed rejection invalidates an in-flight avatar without changing saved bytes', async () => {
  const h = harness(), wait = deferred();
  h.renderTask(() => wait.promise);
  const renderer = h.renderer(), pending = renderer.render(selection());
  const event = h.gate.hide(selection(), {scope:'clothing', context:'all'});
  const before = bytes(h.backend);
  wait.resolve({cancelled:false});
  await assert.rejects(pending, /changed|rejected/);
  assert.equal(h.calls.visibleWrites, 0);
  assert.equal(renderer.last(), null);
  assert.ok(h.gate.snapshot().active.some(row => row.id === event.id));
  assert.deepEqual(bytes(h.backend), before);
});

test('valid feedback preserves producer output, clean rendering and original exclusions', async () => {
  const h = harness();
  h.base.hide(selection(), {scope:'clothing', context:'all'});
  const expected = {status:'ok', options:[{selection:selection({shirtId:'DS011'}), unchanged:'exact'}]};
  h.produce(() => expected);
  assert.equal(h.connection.controller.generate(request, {}, []), expected);
  assert.equal(await h.connection.controller.generateAsync(request, {}, []), expected);
  const renderer = h.renderer(), before = bytes(h.backend);
  await renderer.render(expected.options[0].selection);
  assert.equal(h.calls.visibleWrites, 1);
  assert.deepEqual(renderer.last(), expected.options[0].selection);
  assert.equal(h.gate.allowed(selection(), context), false);
  assert.deepEqual(bytes(h.backend), before);
});
