#!/usr/bin/env node
'use strict';

// Reproduces the owner's shoulder step and checks the actual rendered garment.
// The baseline is the exact previously shipped runtime, retained by its HTML
// bindings. Synthetic renderer state only; no owner browser data is loaded.
const A = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync, execFileSync} = require('node:child_process');
const {load, selection, crop, digest, ROOT, WIDTH: W, HEIGHT: H} = require('./avatar-v3-fit-runtime.cjs');

const MODULE = 'src/issue22-s06-contours.js';
const BASELINE = process.env.S06_CONTOURS_BASELINE || 'tests/fixtures/s06-contour-baseline.html';
const BASELINE_HTML_SHA256 = '4491513167b22306f75fcd873a344bf05f714a8036f97d52d6fbf0177911548d';
const BASELINE_RUNTIME_SHA256 = 'eedd8842c32e842479775df4fdabefd27d88f9ef00e9606b569cfd5f395769c0';
const PRE_S13 = 'f648cda6e577aa1b6ce7b75df1e71437eb5e6aae';
const OUTPUT = path.resolve(process.env.S06_CONTOURS_OUTPUT || path.join(ROOT, '..', 's06-contours-review'));
const WORKER = process.env.S06_CONTOURS_WORKER ? JSON.parse(process.env.S06_CONTOURS_WORKER) : null;
const workerLabel = worker => [worker.topwear, worker.shirt, worker.state].join('-');
const reportFile = worker => path.join(OUTPUT, worker ? workerLabel(worker) + '-verification.json' : 'verification.json');
// Independent maximum scope, including the measured inherited-mask defect.
// The module's own declaration cannot silently enlarge this acceptance area.
const ALLOWED = [
  [620, 410, 100, 90],
  [60, 460, 280, 720],
  [660, 460, 300, 720]
];
const PROTECTED_SOURCE_HASHES = [
  '65ba3284276b3b99c1ec53e4bcd0bec6c5abaed2ca6dd7c19cf04d52440a6935',
  'aea4f48752eb664abf5a6b7c327585e097dc539f37835f30a46890812e855861',
  'c100c1ed484446a8b41d0a677c7e695a7a30daa331bdb33483105246c4509545',
  '4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93',
  '26af452854f6f89c86617d83e9848ae71922d2ff4701877e7903f59c55ebb2b8',
  'cfca4394b3d208184fef4f267671af834432ac2f6bd89acea83242a9e118863b'
];
const report = {
  schema: 'hewrs.s06-contour-regression.v1',
  status: 'RUNNING',
  baseline_entrypoint: BASELINE,
  expected_baseline_html_sha256: BASELINE_HTML_SHA256,
  expected_baseline_runtime_sha256: BASELINE_RUNTIME_SHA256,
  allowed_change_rectangles: ALLOWED,
  cases: [],
  controls: [],
  skipped: [],
  visual_status: 'CAPTURED_NOT_VISUALLY_APPROVED',
  limitations: 'Native rendering regression and source preservation; browser execution and visual review are separate gates.'
};

function saveReport() {
  fs.mkdirSync(OUTPUT, {recursive: true});
  fs.writeFileSync(reportFile(WORKER), JSON.stringify(report, null, 2) + '\n');
}

function read(file) { return fs.readFileSync(path.join(ROOT, file)); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }
const preS13Bytes = file => execFileSync('git', ['show', PRE_S13 + ':' + file], {cwd: ROOT, maxBuffer: 64 * 1024 * 1024});

function preS13Runtime() {
  // Keep the original full-frame contour control at the final release before
  // S13's intentional material correction. As in s13-material.cjs, substitute
  // only the exact historical HTML; execute its retained runtime and real
  // prerequisites without modifying the shared renderer harness.
  const html = preS13Bytes('index.html').toString('utf8');
  const release = JSON.parse(preS13Bytes('AVATAR_V3_RELEASE.json'));
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(match => match[1].split('?')[0]);
  const runtimeIndex = scripts.findIndex(file => file.startsWith('runtime/'));
  A.ok(runtimeIndex > 0, 'Frozen S13 entrypoint binds its historical runtime');
  for (const file of scripts.slice(0, runtimeIndex + 1)) {
    A.ok(read(file).equals(preS13Bytes(file)), 'Pre-S13 runtime prerequisite remains exact: ' + file);
  }
  const filename = path.join(ROOT, 'tests/avatar-v3-fit-runtime.cjs'), mod = {exports: {}};
  let reads = 0;
  const isolatedFs = Object.freeze({...fs, readFileSync(file, ...options) {
    if (typeof file === 'string' && path.resolve(file) === path.join(ROOT, 'index.html')) {
      reads++;
      return options[0] === 'utf8' || options[0]?.encoding === 'utf8' ? html : Buffer.from(html);
    }
    return fs.readFileSync(file, ...options);
  }});
  const context = vm.createContext({module: mod, exports: mod.exports,
    __dirname: path.dirname(filename), __filename: filename,
    require: name => name === 'node:fs' ? isolatedFs : require(name),
    console, process, Buffer, setTimeout, clearTimeout, URL, URLSearchParams, AbortController, performance});
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, {filename});
  const result = mod.exports.load();
  A.equal(reads, 1, 'Only the frozen entrypoint is virtually substituted');
  A.equal(result.metadata.kind, 'EXACT_SHIPPED_RUNTIME_PREFIX');
  A.equal(result.metadata.entrypoint_sha256, release.entrypoints['index.html']);
  A.equal(result.metadata.runtime_sha256, release.runtime_sha256);
  A.deepEqual(plain(result.connection.issue22Materials), JSON.parse(preS13Bytes('data/issue22-materials.json')));
  return {...result, capture: selected => result.capture(vm.runInContext('(' + JSON.stringify(selected) + ')', context))};
}

async function currentS13Scope(original, current, before, after, material, label) {
  A.deepEqual(plain(before.selection), plain(after.selection));
  A.equal(after.selection.suitId, 'S13');
  A.deepEqual(plain(before.dimensions), [W, H]); A.deepEqual(plain(after.dimensions), [W, H]);
  A.deepEqual(plain(current.connection.issue22Materials), material, label + ': current runtime binds the current material manifest');
  const rows = Object.values(material.bindings).filter(row => row.garment_id === 'S13');
  A.deepEqual(rows.map(row => row.layer).sort(), ['jacket', 'trousers']);
  const expected = rows.map(row => ({garment_id: row.garment_id, layer: row.layer,
    geometry_source: {sha256: row.source_sha256, url: row.source_url, rect: row.rect},
    display_source: {sha256: row.display_sha256, url: row.display_url, rect: row.rect},
    alpha_sha256: row.alpha_sha256}));
  for (const frame of [after.plan, after.result]) {
    A.equal(frame.issue22_material_revision, material.revision, label + ': current material revision');
    A.deepEqual(plain(frame.issue22_material_sources), expected, label + ': exact current jacket and trouser bindings');
    A.equal(frame.s06_contours, undefined, label + ': no S06 contour application to S13');
  }
  A.deepEqual(plain(current.g.HEWRSAvatarV3ArmPose.spec), plain(original.g.HEWRSAvatarV3ArmPose.spec));
  A.deepEqual(plain(current.g.HEWRSAvatarV3ArmPose.controls), plain(original.g.HEWRSAvatarV3ArmPose.controls));
  A.deepEqual(plain(current.g.HEWRSAvatarV3CuffFit.spec), plain(original.g.HEWRSAvatarV3CuffFit.spec));
  let native;
  try { native = require('@napi-rs/canvas'); }
  catch (_) { native = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules', '@napi-rs/canvas')); }
  const posedMask = {data: new Uint8ClampedArray(W * H * 4)};
  for (const row of rows) {
    const old = original.connection.issue22Materials.bindings[row.source_sha256];
    for (const key of ['garment_id', 'layer', 'source_sha256', 'source_url', 'rect', 'alpha_sha256']) {
      A.deepEqual(plain(row[key]), plain(old[key]), label + ': frozen registered geometry ' + row.layer + '/' + key);
    }
    A.ok(read(row.source_url).equals(preS13Bytes(row.source_url)), label + ': original S13 source bytes remain exact');
    A.equal(digest(read(row.source_url)), row.source_sha256);
    A.equal(digest(read(row.display_url)), row.display_sha256);
    A.equal(current.connection.assetPaths[row.display_sha256], row.display_url);
    const image = await native.loadImage(path.join(ROOT, row.source_url));
    A.deepEqual([image.width, image.height], [W, H]);
    const canvas = original.makeCanvas(), context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const source = context.getImageData(0, 0, W, H).data, alpha = Buffer.alloc(W * H);
    for (let pixel = 0; pixel < W * H; pixel++) {
      const offset = pixel * 4 + 3;
      alpha[pixel] = source[offset];
      posedMask.data[offset] = Math.max(posedMask.data[offset], alpha[pixel]);
    }
    A.equal(digest(alpha), row.alpha_sha256, label + ': frozen source alpha defines ' + row.layer + ' scope');
    canvas.width = canvas.height = 1;
  }
  // Use only the frozen pose and cuff bounds to define permitted cloth RGB
  // changes. Current declarations cannot enlarge this acceptance region.
  original.g.HEWRSAvatarV3ArmPose.apply(posedMask);
  const cuffBounds = plain(original.g.HEWRSAvatarV3CuffFit.spec.bounds);
  const insideCuff = (x, y) => cuffBounds.some(([left, top, width, height]) => x >= left && x < left + width && y >= top && y < top + height);
  let changed = 0, alphaChanged = 0, outside = 0, outsideChanged = 0;
  for (let pixel = 0; pixel < W * H; pixel++) {
    const offset = pixel * 4;
    const differs = !after.rgba.subarray(offset, offset + 4).equals(before.rgba.subarray(offset, offset + 4));
    if (differs) changed++;
    if (after.rgba[offset + 3] !== before.rgba[offset + 3]) alphaChanged++;
    if (posedMask.data[offset + 3] === 0 && !insideCuff(pixel % W, Math.floor(pixel / W))) {
      outside++;
      if (differs) outsideChanged++;
    }
  }
  A.ok(changed > 0, label + ': current S13 fabric changes actual rendered pixels');
  A.equal(alphaChanged, 0, label + ': every completed native-frame alpha byte remains exact');
  A.equal(outsideChanged, 0, label + ': pixels outside the frozen S13 pose and cuff bounds remain exact');
  A.ok(outside > 1000000, label + ': outside-garment comparison retains its full native scope');
  A.deepEqual(plain(original.storage.snapshot()), [], label + ': frozen S13 render never writes synthetic saved data');
  A.deepEqual(plain(current.storage.snapshot()), [], label + ': current S13 render never writes synthetic saved data');
  return {before_rgba_sha256: before.rgba_sha256, after_rgba_sha256: after.rgba_sha256,
    boundary_source_commit: PRE_S13, cuff_bounds: cuffBounds,
    changed_pixels: changed, changed_alpha_pixels: alphaChanged, unchanged_frame_alpha_pixels: W * H,
    exact_pixels_outside_s13: outside, changed_outside_scope: outsideChanged,
    current_material_revision: material.revision, current_material_sources: expected,
    s06_contours_applied: false, saved_data_writes: 0};
}

function allowedPixels() {
  const mask = new Uint8Array(W * H);
  for (const [x, y, width, height] of ALLOWED) {
    for (let row = y; row < y + height; row++) mask.fill(1, row * W + x, row * W + x + width);
  }
  return mask;
}

function topAt(rgba, x) {
  for (let y = 400; y < 540; y++) if (rgba[(y * W + x) * 4 + 3] >= 128) return y;
  throw Error('No shoulder boundary at native x=' + x);
}

function shoulder(rgba) {
  const points = [];
  for (let x = 650; x <= 710; x++) points.push([x, topAt(rgba, x)]);
  const changes = points.slice(1).map((point, index) => ({
    x: point[0], previous_y: points[index][1], y: point[1], dy: point[1] - points[index][1]
  }));
  return {
    x_range: [650, 710],
    alpha_threshold: 128,
    maximum_upward_step: Math.max(0, ...changes.map(row => -row.dy)),
    maximum_downward_step: Math.max(0, ...changes.map(row => row.dy)),
    measured_defect: {x_before: 686, x_after: 687, y_before: topAt(rgba, 686), y_after: topAt(rgba, 687)},
    largest_steps: changes.filter(row => Math.abs(row.dy) > 1)
  };
}

function gapAt(rgba, y) {
  const runs = [];
  let start = -1;
  for (let x = 735; x <= 840; x++) {
    const clear = x < 840 && rgba[(y * W + x) * 4 + 3] < 128;
    if (clear && start < 0) start = x;
    if (!clear && start >= 0) { runs.push([start, x - 1]); start = -1; }
  }
  A.ok(runs.length, 'Intentional right arm/torso gap remains at row ' + y);
  const [left, right] = runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
  const center = Math.floor((left + right) / 2);
  return {y, left, right, width: right - left + 1, center, center_alpha: rgba[(y * W + center) * 4 + 3]};
}

function gapRoughness(rgba) {
  // Trace the visible half-coverage edge with subpixel interpolation. Its
  // second differences measure abrupt direction changes in the actual gap;
  // this neither reproduces nor assumes the implementation's filter.
  const edges = [];
  for (let y = 900; y < 1160; y++) {
    const gap = gapAt(rgba, y), alpha = x => rgba[(y * W + x) * 4 + 3];
    const l = gap.left, r = gap.right;
    const left = l - 1 + (alpha(l - 1) - 128) / (alpha(l - 1) - alpha(l));
    const right = r + (128 - alpha(r)) / (alpha(r + 1) - alpha(r));
    A.ok(Number.isFinite(left) && Number.isFinite(right), 'Traceable arm-gap boundary');
    edges.push([left, right]);
  }
  const rms = [0, 0];
  for (let i = 2; i < edges.length; i++) for (let side = 0; side < 2; side++) {
    const curvature = edges[i][side] - 2 * edges[i - 1][side] + edges[i - 2][side];
    rms[side] += curvature * curvature;
  }
  return {y_range: [900, 1159], alpha_threshold: 128,
    left_rms_curvature: Math.sqrt(rms[0] / (edges.length - 2)),
    right_rms_curvature: Math.sqrt(rms[1] / (edges.length - 2))};
}

function patch(rgba, rect) {
  const [x, y, width, height] = rect;
  const data = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) {
    rgba.copy(data, row * width * 4, ((y + row) * W + x) * 4, ((y + row) * W + x + width) * 4);
  }
  return data;
}

function compare(before, after, allowed, label) {
  let changed = 0, outside = 0, alphaChanged = 0;
  for (let pixel = 0; pixel < W * H; pixel++) {
    const q = pixel * 4;
    const differs = before[q] !== after[q] || before[q + 1] !== after[q + 1] ||
      before[q + 2] !== after[q + 2] || before[q + 3] !== after[q + 3];
    if (!differs) continue;
    changed++;
    if (!allowed[pixel]) outside++;
    if (before[q + 3] !== after[q + 3]) alphaChanged++;
  }
  A.equal(outside, 0, label + ': no changed pixel outside the reviewed S06 contour regions');
  A.ok(changed > 0 && alphaChanged > 0, label + ': correct the visible contour, not only metadata');
  return {changed_pixels: changed, changed_alpha_pixels: alphaChanged, changed_outside_scope: outside};
}

function captureEvidence(harness, frame, label, suffix) {
  const file = name => path.join(OUTPUT, label + '-' + suffix + '-' + name + '.png');
  fs.writeFileSync(file('phone'), crop(harness.canvas, [0, 0, W, H], 390));
  fs.writeFileSync(file('shoulder'), crop(harness.canvas, [595, 395, 315, 180], 630));
  fs.writeFileSync(file('arm-gap'), crop(harness.canvas, [735, 850, 105, 340], 315));
  if (label === 'S06-DS039-NO_TIE') fs.writeFileSync(file('native'), frame.png);
}

async function main() {
  if (!WORKER) return runWorkers();
  A.ok(fs.existsSync(path.join(ROOT, BASELINE)), 'Retain the exact shipped baseline HTML before rebuilding');
  A.ok(fs.existsSync(path.join(ROOT, MODULE)), 'S06 contour source module is required');
  const baseline = load({entrypoint: BASELINE});
  A.equal(baseline.metadata.entrypoint_sha256, BASELINE_HTML_SHA256, 'Exact retained pre-correction baseline HTML');
  A.equal(baseline.metadata.runtime_sha256, BASELINE_RUNTIME_SHA256, 'Exact shipped runtime that reproduced the owner defect');
  A.equal(baseline.g.HEWRSS06Contours, undefined, 'Baseline must precede the S06 contour correction');

  let candidate = load();
  if (!candidate.g.HEWRSS06Contours) candidate = load({extraModules: [MODULE]});
  A.ok(candidate.g.HEWRSS06Contours?.spec, 'Candidate exposes its contour revision and scope');
  report.baseline = baseline.metadata;
  report.candidate = candidate.metadata;
  report.candidate_spec = plain(candidate.g.HEWRSS06Contours.spec);
  report.protected_sources = PROTECTED_SOURCE_HASHES.map(hash => {
    const file = 'assets/' + hash + '.png';
    A.equal(digest(read(file)), hash, 'Original source unchanged: ' + file);
    return {file, sha256: hash};
  });

  const material = JSON.parse(read('data/issue22-materials.json'));
  report.display_sources = Object.values(material.bindings).filter(row => row.garment_id === 'S06').map(row => {
    A.equal(digest(read(row.display_url)), row.display_sha256, 'Exact S06 displayed fabric source');
    return {file: row.display_url, sha256: row.display_sha256};
  });
  A.equal(report.display_sources.length, 2, 'Paired S06 jacket and trousers remain available');
  fs.mkdirSync(OUTPUT, {recursive: true});
  const allowed = allowedPixels();
  const interiorRects = [[680, 600, 40, 100], [810, 700, 60, 100], [400, 1050, 60, 100]];

  for (const shirt of ['DS001', 'DS039', 'DS051']) for (const state of ['NO_TIE', 'T001']) {
    if (WORKER.kind !== 'target' || shirt !== WORKER.shirt || state !== WORKER.state) continue;
    if (state !== 'NO_TIE' && candidate.connection.records[shirt].no_tie_only) {
      report.skipped.push({shirt, state, reason: 'Existing garment NO_TIE_ONLY policy'});
      continue;
    }
    const selected = selection(shirt, state, 'S06'), label = ['S06', shirt, state].join('-');
    const before = await baseline.capture(selected);
    captureEvidence(baseline, before, label, 'before');
    const after = await candidate.capture(selected);
    captureEvidence(candidate, after, label, 'after');
    A.ok(after.result.s06_contours, label + ': actual S06 render reports the applied correction');
    A.equal(Array.isArray(after.plan), Array.isArray(before.plan), label + ': preserve legacy-array or continuous-object plan shape');
    A.equal(after.plan.issue22_material_revision, material.revision, label + ': plan retains the current material revision');
    A.ok(Array.isArray(after.plan.issue22_material_sources), label + ': plan retains material source provenance');
    A.equal(after.plan.issue22_material_sources.length, 2, label + ': both jacket and trouser material sources remain in the plan');
    A.deepEqual(plain(after.plan.issue22_material_sources), plain(before.plan.issue22_material_sources),
      label + ': adding contour metadata does not drop or replace existing source provenance');
    A.deepEqual(plain(after.plan.issue22_material_sources), plain(after.result.issue22_material_sources),
      label + ': planned material sources match those reported by the actual render');

    const pixels = compare(before.rgba, after.rgba, allowed, label);
    const oldShoulder = shoulder(before.rgba), newShoulder = shoulder(after.rgba);
    A.ok(oldShoulder.maximum_upward_step >= 4, label + ': exact baseline reproduces the reported shoulder step');
    A.ok(newShoulder.maximum_upward_step <= 2, label + ': no abrupt reversed shoulder step');
    A.ok(newShoulder.maximum_downward_step <= 2, label + ': no replacement rectangular shoulder step');

    const gaps = [900, 1000, 1100].map(y => {
      const old = gapAt(before.rgba, y), current = gapAt(after.rgba, y);
      A.ok(current.width >= Math.floor(old.width * .65), label + ': arm gap is not filled at row ' + y);
      A.ok(current.width <= Math.ceil(old.width * 1.5) + 2, label + ': no enlarged arm cutout at row ' + y);
      A.ok(Math.abs(current.left - old.left) <= 3 && Math.abs(current.right - old.right) <= 3,
        label + ': retained arm pose and gap location at row ' + y);
      A.ok(current.center_alpha <= 8, label + ': gap center remains transparent at row ' + y);
      return {before: old, after: current};
    });
    const oldRoughness = gapRoughness(before.rgba), newRoughness = gapRoughness(after.rgba);
    for (const key of ['left_rms_curvature', 'right_rms_curvature']) {
      A.ok(newRoughness[key] <= oldRoughness[key] * .65,
        label + ': visible arm-gap boundary roughness improves at least 35% (' + key + ')');
    }

    const cloth = interiorRects.map(rect => {
      const old = patch(before.rgba, rect), current = patch(after.rgba, rect);
      for (let q = 3; q < old.length; q += 4) A.equal(old[q], 255, label + ': interior sample stays on opaque cloth');
      A.ok(old.equals(current), label + ': interior fabric pattern is unchanged at ' + rect.join(','));
      return {rect, rgba_sha256: digest(current)};
    });
    report.cases.push({label, selection: selected, before_rgba_sha256: before.rgba_sha256,
      after_rgba_sha256: after.rgba_sha256, ...pixels,
      plan_kind: Array.isArray(after.plan) ? 'legacy-array' : 'continuous-object',
      plan_material_revision: after.plan.issue22_material_revision,
      plan_material_sources: plain(after.plan.issue22_material_sources),
      shoulder: {before: oldShoulder, after: newShoulder}, arm_gaps: gaps,
      arm_gap_roughness: {before: oldRoughness, after: newRoughness},
      unchanged_opaque_cloth: cloth, result: plain(after.result.s06_contours)});
    saveReport();
    console.log('S06_CONTOURS_CASE=' + JSON.stringify({label, ...pixels, shoulder_upward_step: newShoulder.maximum_upward_step}));
    if (global.gc) global.gc();
  }

  for (const selected of [selection('DS039', 'NO_TIE', 'S05'), selection('DS001', 'T001', 'S13'), selection('DS051', 'NO_TIE', 'B08')]) {
    if (WORKER.kind !== 'control' || (selected.suitId || selected.blazerId) !== WORKER.topwear) continue;
    const label = [selected.suitId || selected.blazerId, selected.shirtId, selected.state].join('-');
    const historical = selected.suitId === 'S13' ? preS13Runtime() : null;
    const before = await baseline.capture(selected), after = await (historical || candidate).capture(selected);
    A.equal(after.rgba_sha256, before.rgba_sha256, label + ': complete unrelated frame stays exact');
    A.ok(before.rgba.equals(after.rgba), label + ': no hidden unrelated pixel changes');
    const control = {label, selection: selected, rgba_sha256: after.rgba_sha256, changed_pixels: 0};
    if (historical) {
      A.deepEqual(plain(historical.g.HEWRSS06Contours.spec), report.candidate_spec, label + ': historical control includes the same S06 contour correction');
      const current = await candidate.capture(selected);
      Object.assign(control, {comparison: 'frozen_pre_s13_vs_original_pre_contour',
        frozen_commit: PRE_S13, frozen_runtime: historical.metadata,
        current_s13: await currentS13Scope(historical, candidate, after, current, material, label)});
    }
    report.controls.push(control);
    saveReport();
    console.log('S06_CONTOURS_CONTROL=' + JSON.stringify({label, status: 'PASS'}));
    if (global.gc) global.gc();
  }
  A.deepEqual(plain(baseline.storage.snapshot()), [], 'Baseline never writes synthetic saved data');
  A.deepEqual(plain(candidate.storage.snapshot()), [], 'Candidate never writes synthetic saved data');
  report.saved_data_writes = 0;
  report.status = 'PASS';
  saveReport();
  console.log('S06_CONTOURS=' + JSON.stringify({status: report.status, cases: report.cases.length,
    controls: report.controls.length, skipped: report.skipped.length,
    candidate_kind: report.candidate.kind, output: OUTPUT,
    report: reportFile(WORKER), visual_status: report.visual_status}));
}

function runWorkers() {
  // Native image caches can be large. Every comparison receives fresh
  // renderer instances and an isolated process, releasing all native memory
  // before the next case rather than retaining another suit's decoded assets.
  fs.mkdirSync(OUTPUT, {recursive: true});
  const workers = [];
  for (const shirt of ['DS001', 'DS039', 'DS051']) for (const state of ['NO_TIE', 'T001']) {
    workers.push({kind: 'target', topwear: 'S06', shirt, state});
  }
  workers.push({kind: 'control', topwear: 'S05', shirt: 'DS039', state: 'NO_TIE'},
    {kind: 'control', topwear: 'S13', shirt: 'DS001', state: 'T001'},
    {kind: 'control', topwear: 'B08', shirt: 'DS051', state: 'NO_TIE'});
  const sourceHash = digest(read(MODULE));
  const entryHash = digest(read('index.html'));
  for (const worker of workers) {
    A.equal(digest(read(MODULE)), sourceHash, 'Contour source remains fixed throughout the comparison matrix');
    A.equal(digest(read('index.html')), entryHash, 'Current entrypoint remains fixed throughout the comparison matrix');
    const child = spawnSync(process.execPath, ['--expose-gc', __filename], {
      cwd: ROOT, env: {...process.env, S06_CONTOURS_WORKER: JSON.stringify(worker)},
      encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 180000
    });
    if (child.stdout) process.stdout.write(child.stdout);
    if (child.stderr) process.stderr.write(child.stderr);
    A.equal(child.status, 0, workerLabel(worker) + ': isolated comparison completed (' + (child.signal || child.error || 'exit') + ')');
    const result = JSON.parse(fs.readFileSync(reportFile(worker), 'utf8'));
    A.equal(result.status, 'PASS', workerLabel(worker) + ': completed comparison passed');
    if (!report.baseline) {
      for (const key of ['baseline', 'candidate', 'candidate_spec', 'protected_sources', 'display_sources']) report[key] = result[key];
    } else {
      A.deepEqual(result.candidate, report.candidate, 'Every case tests the same candidate runtime and source');
      A.deepEqual(result.baseline, report.baseline, 'Every case uses the same immutable comparison baseline');
    }
    report.cases.push(...result.cases);
    report.controls.push(...result.controls);
    report.skipped.push(...result.skipped);
    saveReport();
  }
  A.equal(report.cases.length + report.skipped.length, 6, 'Complete requested S06 shirt/state scope');
  A.equal(report.controls.length, 3, 'All unrelated full-frame controls completed');
  report.saved_data_writes = 0;
  report.status = 'PASS';
  saveReport();
  console.log('S06_CONTOURS=' + JSON.stringify({status: 'PASS', cases: report.cases.length,
    controls: report.controls.length, skipped: report.skipped.length,
    candidate_kind: report.candidate.kind, source_sha256: sourceHash,
    output: OUTPUT, report: reportFile(null), visual_status: report.visual_status}));
}

main().catch(error => {
  report.status = 'FAIL';
  report.error = error.stack || String(error);
  saveReport();
  console.error(report.error);
  process.exitCode = 1;
});
