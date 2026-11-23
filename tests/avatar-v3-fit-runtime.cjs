#!/usr/bin/env node
'use strict';
/* Local native renderer harness for exact shipped HEWRS runtimes.
 * Executes the real entrypoint dependencies and compiled prefix, stopping at
 * the application startup boundary. This is a renderer diagnostic, never a
 * browser/UI substitute or visual approval. No owner browser state is loaded.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
let native;
try { native = require('@napi-rs/canvas'); }
catch (_) { native = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules', '@napi-rs/canvas')); }
const {createCanvas, Image, ImageData} = native;
const ROOT = path.resolve(__dirname, '..');
const WIDTH = 996, HEIGHT = 2748;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function makeCanvas(width = WIDTH, height = HEIGHT) {
  const canvas = createCanvas(width, height);
  canvas.dataset = {}; canvas.style = {};
  return canvas;
}
function memoryStorage() {
  const values = new Map();
  return {get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)),
    snapshot: () => [...values.entries()].sort((a, b) => a[0].localeCompare(b[0]))};
}
function selection(shirtId = 'DS034', state = 'NO_TIE', mode = 'S05') {
  return {shirtId, state, shoeId: 'shoe-8', watchId: null,
    ...(mode === 'shirt-only' ? {shirtOnly: true, pantId: 'PG002'} :
       mode.startsWith('B') ? {blazerId: mode, pantId: mode === 'B01' ? 'PT006' : 'PG002'} : {suitId: mode})};
}
function sourceBindings(plan) {
  const rows = [];
  function visit(value, location) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.sha256 === 'string') rows.push({path: location, sha256: value.sha256, rect: value.rect || null});
    for (const key of Object.keys(value).sort()) if (value[key] && typeof value[key] === 'object') visit(value[key], location + '/' + key);
  }
  visit(plan, 'plan');
  return rows;
}
function load({root = ROOT, entrypoint = 'index.html', extraModules = [], modulesBeforePose = [], omitFitModules = [], omitContourModules = []} = {}) {
  root = path.resolve(root);
  const html = fs.readFileSync(path.join(root, entrypoint), 'utf8');
  const tags = [...html.matchAll(/<script\b([^>]*\bsrc="([^"]+)"[^>]*)>/g)];
  const scripts = tags.map(match => ({url: match[2], name: match[2].split('?')[0],
    integrity: match[1].match(/\bintegrity="([^"]+)"/)?.[1]}));
  const runtimes = scripts.filter(row => row.name.startsWith('runtime/'));
  assert.equal(runtimes.length, 1, 'entrypoint must bind one application runtime');
  const runtime = runtimes[0], bytes = fs.readFileSync(path.join(root, runtime.name));
  const runtimeSha256 = digest(bytes);
  assert.equal(runtime.integrity, 'sha256-' + crypto.createHash('sha256').update(bytes).digest('base64'), 'exact entrypoint runtime SRI');
  assert.ok(runtime.url.includes('?v=' + runtimeSha256.slice(0, 16)), 'exact runtime cache pin');
  const code = bytes.toString('utf8'), boundary = '/* PREVIEW SOURCE: src/outfit-refill-application.js */';
  const end = code.indexOf(boundary);
  assert.ok(end > 0 && code.indexOf(boundary, end + 1) < 0, 'unique compiled application boundary');
  const storage = memoryStorage();
  const canvasPrototype = makeCanvas(1, 1).constructor;
  const g = vm.createContext({console, setTimeout, clearTimeout, URL, URLSearchParams, AbortController,
    performance, localStorage: storage, crypto: crypto.webcrypto, Image, ImageData, HTMLCanvasElement: canvasPrototype});
  vm.runInContext('globalThis.structuredClone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));', g);
  g.document = {createElement(tag) { assert.equal(tag, 'canvas'); return makeCanvas(); },
    documentElement: {dataset: {avatarProfile: html.match(/\bdata-avatar-profile="([^"]+)"/)?.[1]}}};
  const runtimeIndex = scripts.indexOf(runtime);
  for (const row of scripts.slice(0, runtimeIndex)) {
    assert.ok(!row.name.startsWith('/') && !row.name.includes('..') && !row.name.includes(':'), 'local script path');
    vm.runInContext(fs.readFileSync(path.join(root, row.name), 'utf8'), g, {filename: row.name});
  }
  const overlay = [];
  let prefix = code.slice(0, end);
  for (const filename of omitFitModules) {
    assert.ok(['src/avatar-v3-shirt-collar-fit.js', 'src/avatar-v3-cuff-fit.js'].includes(filename), 'only named fit wrappers may be omitted in a diagnostic');
    const data = fs.readFileSync(path.resolve(root, filename));
    const block = '/* V3 ISSUE 19 SOURCE: ' + filename + ' */\n' + data.toString('utf8') + '\n;\n';
    assert.equal(prefix.split(block).length, 2, 'exact current compiled source wrapper diagnostic omission');
    prefix = prefix.replace(block, '');
    overlay.push({path: filename, sha256: digest(data), diagnostic_action: 'omit_only_this_fit_wrapper'});
  }
  for (const filename of omitContourModules) {
    assert.equal(filename, 'src/issue22-s06-contours.js', 'only the named S06 contour wrapper may be omitted in a diagnostic');
    const data = fs.readFileSync(path.resolve(root, filename));
    const block = '/* V3 ISSUE 22 SOURCE: ' + filename + ' */\n' + data.toString('utf8') + '\n;\n';
    assert.equal(prefix.split(block).length, 2, 'exact current compiled contour wrapper diagnostic omission');
    prefix = prefix.replace(block, '');
    overlay.push({path: filename, sha256: digest(data), diagnostic_action: 'omit_only_this_contour_wrapper'});
  }
  if (modulesBeforePose.length) {
    if (modulesBeforePose.includes('src/avatar-v3-shirt-collar-fit.js')) {
      const original = 'paint(sc,p.garment.body,at);native(sc,p.tie,at);';
      const captured = 'paint(sc,p.garment.body,at);if(options.captureShirtCloth)options.captureShirtCloth(sc,p);native(sc,p.tie,at);';
      if (!prefix.includes(captured)) {
        assert.equal(prefix.split(original).length, 2, 'unique registered cloth diagnostic capture point');
        prefix = prefix.replace(original, captured);
        overlay.push({path: 'src/continuous-shirts.js', diagnostic_patch: 'capture_exact_registered_body_before_tie_and_avatar_composition'});
      } else assert.equal(prefix.split(captured).length, 2, 'unique shipped registered cloth capture point');
    }
    const marker = '/* ISOLATED V3 POSE: src/avatar-v3-pose.js */';
    assert.equal(prefix.split(marker).length, 2, 'unique V3 pose insertion point');
    const addition = modulesBeforePose.map(filename => {
      const data = fs.readFileSync(path.resolve(root, filename));
      overlay.push({path: filename, sha256: digest(data), before: marker});
      return '\n/* EXPLICIT DIAGNOSTIC OVERLAY: ' + filename + ' */\n' + data.toString('utf8') + '\n;\n';
    }).join('\n');
    prefix = prefix.replace(marker, addition + marker);
  }
  vm.runInContext(prefix, g, {filename: runtime.name + (overlay.length ? '#diagnostic-engine-prefix' : '#exact-engine-prefix')});
  for (const filename of extraModules) {
    const data = fs.readFileSync(path.resolve(root, filename));
    vm.runInContext(data.toString('utf8'), g, {filename});
    overlay.push({path: filename, sha256: digest(data)});
  }
  const connection = g.HEWRSCleanConnection.create(g.HEWRS_INPUTS);
  const feedback = g.HEWRSOutfitFeedback.create({storage, validateSelection: s => connection.validateSelection(s)});
  const ties = g.HEWRSTieFeedback.create({storage, feedback: g.HEWRSOutfitFeedback, validateSelection: s => connection.validateSelection(s)});
  const gate = {refresh() { const a = feedback.refresh(), b = ties.refresh(); return {...a, active: [...a.active, ...b.active], token: a.token + '\n' + b.token}; },
    snapshot() { return this.refresh(); },
    match(s, context) { const a = feedback.match(s, context), b = ties.match(s, context); return {allowed: a.allowed && b.allowed, reasons: [...a.reasons, ...b.reasons]}; },
    assertCurrent(token) { if (this.refresh().token !== token) throw Error('Synthetic feedback changed'); }};
  connection.ownerFeedback.set(gate);
  function resolveUrl(descriptor) {
    const name = connection.assetPaths[descriptor.sha256] || descriptor.url;
    assert.ok(typeof name === 'string' && !name.startsWith('/') && !name.includes('..') && !name.includes(':'), 'registered local image path');
    return path.join(root, name);
  }
  const canvas = makeCanvas();
  const renderer = g.HEWRSAtomicRenderer.create(canvas, connection, {resolveUrl});
  const metadata = {kind: overlay.length ? 'EXPLICIT_SOURCE_OVERLAY_DIAGNOSTIC' : 'EXACT_SHIPPED_RUNTIME_PREFIX',
    entrypoint, entrypoint_sha256: digest(html), runtime: runtime.name, runtime_sha256: runtimeSha256,
    avatar_profile: connection.avatarV3?.source_profile || 'AVATAR_V2_MASTER',
    overlays: overlay, browser_storage: 'isolated_in_memory', browser_ui_test: false};
  async function capture(selected) {
    const saved = JSON.stringify(storage.snapshot());
    const started = performance.now(), result = await renderer.render(selected);
    assert.equal(result.status, 'ready', 'complete native render');
    assert.equal(canvas.dataset.status, 'ready', 'committed native frame');
    assert.deepEqual(JSON.parse(JSON.stringify(renderer.last())), selected, 'exact selection committed');
    assert.equal(JSON.stringify(storage.snapshot()), saved, 'render does not write protected synthetic state');
    const plan = renderer.plan(selected), rgba = Buffer.from(canvas.getContext('2d').getImageData(0, 0, WIDTH, HEIGHT).data);
    return {selection: selected, metadata, result, plan, source_bindings: sourceBindings(plan),
      rgba_sha256: digest(rgba), rgba, png: canvas.toBuffer('image/png'),
      elapsed_ms: Math.round(performance.now() - started), dimensions: [canvas.width, canvas.height]};
  }
  return {root, g, connection, renderer, canvas, storage, feedback, ties, metadata, resolveUrl,
    plan: selected => renderer.plan(selected), capture, makeCanvas};
}
function crop(canvas, rect, targetWidth) {
  const [x, y, width, height] = rect, ratio = targetWidth ? targetWidth / width : 1;
  const output = createCanvas(Math.round(width * ratio), Math.round(height * ratio));
  output.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, output.width, output.height);
  const png = output.toBuffer('image/png'); output.width = output.height = 1; return png;
}
async function main() {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (name === '--native') options.native = true;
    else if (['--output', '--modes', '--shirts', '--states', '--entrypoint', '--overlay', '--before-pose'].includes(name)) {
      assert.ok(args[i + 1], name + ' needs a value'); options[name.slice(2)] = args[++i];
    } else throw Error('Unknown argument: ' + name);
  }
  assert.ok(options.output, 'Usage: node --expose-gc tests/avatar-v3-fit-runtime.cjs --output DIRECTORY [--modes S05,B02,B03,B15,shirt-only] [--shirts DS034,DS013] [--native]');
  const harness = load({entrypoint: options.entrypoint || 'index.html', extraModules: options.overlay ? options.overlay.split(',') : [],
    modulesBeforePose: options['before-pose'] ? options['before-pose'].split(',') : []});
  const output = path.resolve(options.output);
  fs.mkdirSync(output, {recursive: true});
  const modes = (options.modes || 'S05,B02,B03,B15,shirt-only').split(',');
  const shirts = options.shirts ? options.shirts.split(',') : [...harness.connection.limits.shirt_ids].sort();
  const states = (options.states || 'NO_TIE,T001').split(',');
  const records = [];
  const manifest = {schema: 'hewrs.issue19.native-review.v1', ...harness.metadata, captures: records,
    review_status: 'CAPTURED_NOT_VISUALLY_APPROVED', native_dimensions: [WIDTH, HEIGHT]};
  for (const shirt of shirts) for (const mode of modes) for (const state of states) {
    if (state !== 'NO_TIE' && (harness.connection.records[shirt].no_tie_only || ['B01', 'B11'].includes(mode))) continue;
    const selected = selection(shirt, state, mode), name = [mode, shirt, state].join('-');
    const frame = await harness.capture(selected);
    for (const [label, rect] of Object.entries({collar: [248, 300, 500, 500], cuffs: [75, 1250, 846, 375], tie: [325, 430, 350, 1000]})) {
      fs.mkdirSync(path.join(output, label), {recursive: true});
      fs.writeFileSync(path.join(output, label, name + '.png'), crop(harness.canvas, rect));
    }
    fs.mkdirSync(path.join(output, 'phone'), {recursive: true});
    fs.writeFileSync(path.join(output, 'phone', name + '.png'), crop(harness.canvas, [0, 0, WIDTH, HEIGHT], 390));
    if (options.native) { fs.mkdirSync(path.join(output, 'native'), {recursive: true}); fs.writeFileSync(path.join(output, 'native', name + '.png'), frame.png); }
    records.push({name, selection: selected, operation: frame.plan.operation || frame.plan.kind,
      rgba_sha256: frame.rgba_sha256, source_bindings: frame.source_bindings, elapsed_ms: frame.elapsed_ms});
    if (records.length % 12 === 0) { fs.writeFileSync(path.join(output, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n'); console.log('CAPTURED ' + records.length + ' ' + name); }
    if (global.gc) global.gc();
  }
  fs.writeFileSync(path.join(output, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({status: 'CAPTURED_NOT_VISUALLY_APPROVED', output, count: records.length, metadata: harness.metadata}));
}
module.exports = {load, selection, makeCanvas, crop, sourceBindings, digest, ROOT, WIDTH, HEIGHT};
if (require.main === module) main().catch(error => {console.error(error.stack || error); process.exitCode = 1;});
