#!/usr/bin/env node
'use strict';

// Current S14 display pixels versus the exact final S06 release. This is a
// source/pixel scope gate, not an assertion of calibrated physical colour or
// approval of a newly generated garment/avatar.
const A = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {load, crop, digest, ROOT, WIDTH: W, HEIGHT: H} = require('./avatar-v3-fit-runtime.cjs');
const {project, protectedDetails} = require('../tools/build_issue22_materials.cjs');
let native;
try { native = require('@napi-rs/canvas'); }
catch (_) { native = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules', '@napi-rs/canvas')); }
const {createCanvas, loadImage} = native;
const BASE = '457774146fa7d4a5494ceec553f187e27b126983';
const PRE_S13 = 'f648cda6e577aa1b6ce7b75df1e71437eb5e6aae';
const bytes = file => fs.readFileSync(path.join(ROOT, file));
const read = file => JSON.parse(bytes(file));
const priorBytes = file => execFileSync('git', ['show', BASE + ':' + file], {cwd: ROOT, maxBuffer: 64 * 1024 * 1024});
const prior = file => JSON.parse(priorBytes(file));
const preS13Bytes = file => execFileSync('git', ['show', PRE_S13 + ':' + file], {cwd: ROOT, maxBuffer: 64 * 1024 * 1024});
const preS13 = file => JSON.parse(preS13Bytes(file));
const plain = value => JSON.parse(JSON.stringify(value));
const luma = (data, offset) => .2126 * data[offset] + .7152 * data[offset + 1] + .0722 * data[offset + 2];

async function pixels(file) {
  const image = await loadImage(path.join(ROOT, file));
  const canvas = createCanvas(image.width, image.height), context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const result = {width: image.width, height: image.height,
    data: Buffer.from(context.getImageData(0, 0, image.width, image.height).data)};
  canvas.width = canvas.height = 1;
  return result;
}

function scriptTags(html) {
  return [...html.matchAll(/<script\b([^>]*\bsrc="([^"]+)"[^>]*)>/g)].map(match => ({
    name: match[2].split('?')[0], url: match[2], integrity: match[1].match(/\bintegrity="([^"]+)"/)?.[1]
  }));
}

function historicalRuntime(html, checkpointBytes = priorBytes) {
  // Retain the exact old runtime and its real prerequisites; only the old
  // entrypoint is substituted in this isolated harness instance.
  const tags = scriptTags(html), runtimeIndex = tags.findIndex(tag => tag.name.startsWith('runtime/'));
  A.ok(runtimeIndex > 0);
  for (const tag of tags.slice(0, runtimeIndex + 1)) {
    A.ok(bytes(tag.name).equals(checkpointBytes(tag.name)), 'Frozen runtime prerequisite remains exact: ' + tag.name);
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
  return {...result, capture: selected => result.capture(vm.runInContext('(' + JSON.stringify(selected) + ')', context))};
}

function reducedPixels(frame, width) {
  const full = createCanvas(W, H), fullContext = full.getContext('2d');
  const image = fullContext.createImageData(W, H); image.data.set(frame.data); fullContext.putImageData(image, 0, 0);
  const height = Math.round(H * width / W), reduced = createCanvas(width, height), context = reduced.getContext('2d');
  context.drawImage(full, 0, 0, width, height);
  const result = context.getImageData(0, 0, width, height).data;
  full.width = full.height = reduced.width = reduced.height = 1;
  return result;
}

async function measurePhoneTexture(materials) {
  // Difference from an otherwise identical zero-thread projection isolates the
  // newly added textile. Existing folds, seams and the original old pattern
  // cannot make a flat replacement satisfy this measurement.
  const spec = materials.garments.S14.parameters, target = materials.garments.S14.target_rgb;
  const patches = [
    {name: 'chest', layer: 'jacket', rect_at_390: [108, 300, 40, 50]},
    {name: 'lower_jacket', layer: 'jacket', rect_at_390: [125, 472, 37, 48]},
    {name: 'left_thigh', layer: 'trousers', rect_at_390: [129, 647, 40, 75]},
    {name: 'right_thigh', layer: 'trousers', rect_at_390: [222, 647, 38, 75]}
  ];
  const results = [];
  for (const layer of ['jacket', 'trousers']) {
    const row = Object.values(materials.bindings).find(row => row.garment_id === 'S14' && row.layer === layer);
    const [source, displayed] = await Promise.all([pixels(row.source_url), pixels(row.display_url)]);
    const zeroThread = project(source, 'S14', layer, {...spec, texture_gain: 0}, {w: 1, h: 1, v: Float32Array.of(0)}, target);
    for (const width of [360, 390]) {
      const actual = reducedPixels(displayed, width), control = reducedPixels(zeroThread, width);
      for (const patch of patches.filter(patch => patch.layer === layer)) {
        const rect = patch.rect_at_390.map(value => Math.round(value * width / 390));
        const [x0, y0, patchWidth, patchHeight] = rect, values = [];
        let sum = 0, squares = 0, maximum = 0;
        for (let y = y0; y < y0 + patchHeight; y++) for (let x = x0; x < x0 + patchWidth; x++) {
          const offset = (y * width + x) * 4;
          A.equal(actual[offset + 3], 255, patch.name + ' sample stays inside opaque cloth');
          A.equal(control[offset + 3], 255);
          const value = luma(actual, offset) - luma(control, offset);
          values.push(value); sum += value; squares += value * value; maximum = Math.max(maximum, Math.abs(value));
        }
        const mean = sum / values.length, rms = Math.sqrt(Math.max(0, squares / values.length - mean * mean));
        // Coarse 8px cell means reveal emergent broad blocks independently of
        // the total textile contrast. The visual acceptance fixture bounds it.
        const cellMeans = [];
        for (let y = 0; y + 8 <= patchHeight; y += 8) for (let x = 0; x + 8 <= patchWidth; x += 8) {
          let total = 0;
          for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) total += values[(y + j) * patchWidth + x + i];
          cellMeans.push(total / 64);
        }
        const coarseMean = cellMeans.reduce((a, b) => a + b, 0) / cellMeans.length;
        const coarseRms = Math.sqrt(cellMeans.reduce((a, value) => a + (value - coarseMean) ** 2, 0) / cellMeans.length);
        results.push({name: patch.name, layer, width, rect, mean_residual_luma: mean,
          residual_rms_luma: rms, coarse_8px_rms_luma: coarseRms, maximum_absolute_residual_luma: maximum});
      }
    }
  }
  return results;
}

function assertPhoneTexture(measurements, acceptance) {
  A.equal(acceptance.status, 'assistant_visual_review', 'S14 appearance bounds require a recorded visual review');
  A.equal(acceptance.baseline_commit, BASE);
  A.equal(acceptance.measurement, 'display_minus_zero_thread_projection');
  for (const row of measurements) {
    const bounds = acceptance.bounds.find(bounds => bounds.width === row.width && bounds.name === row.name);
    A.ok(bounds, 'Every measured jacket/trouser region has a recorded bound: ' + row.width + '/' + row.name);
    for (const key of ['minimum_rms_luma', 'maximum_rms_luma', 'maximum_coarse_8px_rms_luma']) A.ok(Number.isFinite(bounds[key]), 'Finite ' + key);
    A.ok(bounds.minimum_rms_luma > 0 && bounds.minimum_rms_luma < bounds.maximum_rms_luma);
    A.ok(row.residual_rms_luma > bounds.minimum_rms_luma, 'S14 texture remains visible at phone size: ' + JSON.stringify(row));
    A.ok(row.residual_rms_luma < bounds.maximum_rms_luma, 'S14 texture remains quiet: ' + JSON.stringify(row));
    A.ok(row.coarse_8px_rms_luma < bounds.maximum_coarse_8px_rms_luma, 'S14 cannot introduce broad checker blocks: ' + JSON.stringify(row));
  }
}

async function main() {
  const materials = read('data/issue22-materials.json'), oldMaterials = prior('data/issue22-materials.json');
  const picker = read('data/issue22-picker-images.json'), oldPicker = prior('data/issue22-picker-images.json');
  const release = read('AVATAR_V3_RELEASE.json'), oldRelease = prior('AVATAR_V3_RELEASE.json');
  const overlay = read('data/issue22-reviewed-overlay.json'), oldOverlay = prior('data/issue22-reviewed-overlay.json');
  const preS13Materials = preS13('data/issue22-materials.json');
  const preS13Picker = preS13('data/issue22-picker-images.json');
  const preS13Overlay = preS13('data/issue22-reviewed-overlay.json');
  A.deepEqual(materials.garments.S14, preS13Materials.garments.S14, 'The completed S14 material specification remains exact');
  A.deepEqual(overlay.records.S14, preS13Overlay.records.S14, 'The completed S14 reviewed record remains exact');
  A.deepEqual(overlay.features.S14, preS13Overlay.features.S14, 'The completed S14 reviewed feature remains exact');
  A.equal(materials.revision, oldMaterials.revision, 'S14 has a scoped revision; other garment evidence stays current');
  A.deepEqual(materials.scope, oldMaterials.scope);
  A.deepEqual(materials.canvas, [W, H]);
  A.equal(materials.alpha_policy, 'exact_source_alpha');
  A.deepEqual(Object.keys(materials.bindings), Object.keys(oldMaterials.bindings));
  A.deepEqual(Object.keys(materials.garments), Object.keys(oldMaterials.garments));
  A.deepEqual(materials.garments.S14.target_rgb, oldMaterials.garments.S14.target_rgb, 'S14 retains the registered photographic colour target');
  A.ok(materials.garments.S14.revision && materials.garments.S14.revision !== oldMaterials.garments.S14.revision, 'S14 replacement has a distinct scoped material revision');
  A.notEqual(materials.garments.S14.parameters.linen, true, 'B06 workflow does not transfer B06 fibre identity');
  const preservedFiles = ['data/issue22-garment-dna.json', 'data/issue22-garment-dna.js',
    'data/issue22-option-index.json', 'data/issue22-option-index.js', 'data/inputs.json',
    'src/issue22-matching.js', 'src/issue22-materials.js', 'src/issue22-s06-contours.js'];
  for (const file of preservedFiles) A.ok(bytes(file).equals(priorBytes(file)), 'S14 display-only scope preserves ' + file);

  const changedLayers = [], sourceAlphas = [];
  let preservedLayers = 0, protectedHardware = 0, retainedHistoricalS13Layers = 0;
  for (const [sourceHash, row] of Object.entries(materials.bindings)) {
    const old = oldMaterials.bindings[sourceHash];
    for (const key of ['garment_id', 'layer', 'source_sha256', 'source_url', 'rect', 'alpha_sha256']) A.deepEqual(row[key], old[key], 'Exact registered geometry: ' + row.garment_id + '/' + row.layer + '/' + key);
    A.equal(digest(bytes(row.source_url)), sourceHash);
    A.equal(digest(bytes(row.display_url)), row.display_sha256);
    A.ok(bytes(old.display_url).equals(priorBytes(old.display_url)), 'Prior displayed bytes remain available');
    A.equal(materials.assetPaths[row.display_sha256], row.display_url);
    if (row.garment_id === 'S13') {
      // Preserve the original S14 isolation proof on its completed release.
      // The new S13 gate checks the current S13 change and current S14 pixels.
      const frozen = preS13Materials.bindings[sourceHash];
      A.deepEqual(frozen, old, 'The completed S14 release preserved the S13 binding');
      A.ok(preS13Bytes(frozen.display_url).equals(priorBytes(old.display_url)), 'The completed S14 release preserved exact S13 material bytes');
      retainedHistoricalS13Layers++; continue;
    }
    if (row.garment_id !== 'S14') {
      A.deepEqual(row, old, 'Every non-S14 material binding remains exact');
      A.ok(bytes(row.display_url).equals(priorBytes(old.display_url)), 'Every non-S14 material PNG remains exact');
      preservedLayers++; continue;
    }
    A.deepEqual(row, preS13Materials.bindings[sourceHash], 'The completed S14 display binding remains exact');
    A.notEqual(row.display_sha256, old.display_sha256, 'Both S14 layers must change actual pixels');
    const [source, before, after] = await Promise.all([pixels(row.source_url), pixels(old.display_url), pixels(row.display_url)]);
    for (const frame of [source, before, after]) A.deepEqual([frame.width, frame.height], [W, H]);
    const alpha = Buffer.alloc(W * H), details = protectedDetails('S14', row.layer);
    const beforeMean = [0, 0, 0], afterMean = [0, 0, 0];
    let changed = 0, opaque = 0, hardware = 0;
    for (let pixel = 0; pixel < W * H; pixel++) {
      const offset = pixel * 4, x = pixel % W, y = Math.floor(pixel / W);
      alpha[pixel] = source.data[offset + 3];
      A.equal(after.data[offset + 3], alpha[pixel], 'Every S14 native source alpha byte stays exact');
      A.equal(before.data[offset + 3], alpha[pixel]);
      if (alpha[pixel] === 0) A.ok(after.data.subarray(offset, offset + 4).equals(source.data.subarray(offset, offset + 4)), 'Transparent native source pixels stay exact');
      if (!before.data.subarray(offset, offset + 3).equals(after.data.subarray(offset, offset + 3))) changed++;
      if (alpha[pixel] === 255) {
        opaque++;
        for (let k = 0; k < 3; k++) {beforeMean[k] += before.data[offset + k]; afterMean[k] += after.data[offset + k];}
        if (details.ellipses.some(([cx, cy, rx, ry]) => Math.hypot((x - cx) / rx, (y - cy) / ry) <= .9)) {
          A.ok(after.data.subarray(offset, offset + 4).equals(source.data.subarray(offset, offset + 4)), 'Original button hardware stays exact'); hardware++;
        }
      }
    }
    const meanDelta = afterMean.map((value, channel) => (value - beforeMean[channel]) / opaque);
    for (const delta of meanDelta) A.ok(Math.abs(delta) < 1, 'Textile projection preserves S14 mean colour within one RGB level');
    A.equal(digest(alpha), row.alpha_sha256);
    A.ok(changed > 100000, 'Substantial S14 cloth pixels change in each layer');
    if (row.layer === 'jacket') A.ok(hardware > 1000, 'Button protection covers the original opaque hardware');
    protectedHardware += hardware; sourceAlphas.push(alpha);
    changedLayers.push({layer: row.layer, source_sha256: sourceHash, before_display_sha256: old.display_sha256,
      after_display_sha256: row.display_sha256, changed_rgb_pixels: changed, alpha_changed_pixels: 0,
      protected_hardware_pixels: hardware, mean_rgb_delta: meanDelta});
  }
  A.equal(changedLayers.length, 2); A.equal(preservedLayers, 5); A.equal(retainedHistoricalS13Layers, 2);
  for (const id of Object.keys(materials.garments).filter(id => id !== 'S14')) {
    const materialControl = id === 'S13' ? preS13Materials : materials;
    const overlayControl = id === 'S13' ? preS13Overlay : overlay;
    const scope = id === 'S13' ? 'Frozen completed S14 release' : 'Current';
    A.deepEqual(materialControl.garments[id], oldMaterials.garments[id], scope + ' non-S14 material specification remains exact: ' + id);
    A.deepEqual(overlayControl.records[id], oldOverlay.records[id], scope + ' non-S14 reviewed record and fingerprint remain exact: ' + id);
    A.deepEqual(overlayControl.features[id], oldOverlay.features[id], scope + ' non-S14 reviewed feature remains exact: ' + id);
  }

  A.deepEqual(Object.keys(picker.items), Object.keys(oldPicker.items));
  for (const [id, row] of Object.entries(picker.items)) {
    const old = oldPicker.items[id];
    A.equal(digest(bytes(row.src)), row.sha256);
    A.ok(bytes(old.src).equals(priorBytes(old.src)), 'Historical picker bytes are retained');
    if (id === 'S13') {
      const frozen = preS13Picker.items.S13;
      A.deepEqual(frozen, old, 'The completed S14 release preserved the S13 picker record');
      A.ok(preS13Bytes(frozen.src).equals(priorBytes(old.src)), 'The completed S14 release preserved exact S13 picker bytes');
      for (const key of ['history_id', 'label', 'render_selection', 'source_kind', 'width', 'height', 'object_position', 'issue22_revision']) A.deepEqual(row[key], old[key], 'Current S13 picker identity preserved: ' + key);
      continue;
    }
    if (id !== 'S14') {A.deepEqual(row, old, 'Every non-S14 picker record remains exact'); continue;}
    A.deepEqual(row, preS13Picker.items.S14, 'The completed S14 picker record remains exact');
    for (const key of ['history_id', 'label', 'render_selection', 'source_kind', 'width', 'height', 'object_position', 'issue22_revision']) A.deepEqual(row[key], old[key], 'S14 picker identity preserved: ' + key);
    A.notEqual(row.sha256, old.sha256); A.notEqual(row.rgba_sha256, old.rgba_sha256);
    A.notEqual(row.owner_approved, true, 'Reference workflow does not invent approval of a generated avatar');
  }
  for (const key of ['layer_hashes', 'immutable_v2_hashes', 'source_modules', 'issue19_fit_modules', 'source_specification_sha256']) A.deepEqual(release[key], oldRelease[key], 'Approved avatar and fit contract remains exact: ' + key);
  for (const [file, hash] of Object.entries(release.source_modules)) A.equal(digest(bytes(file)), hash);
  A.equal(digest(bytes(release.source_specification)), release.source_specification_sha256);
  for (const hash of [...Object.values(release.layer_hashes), ...Object.values(release.immutable_v2_hashes)]) A.equal(digest(bytes('assets/' + hash + '.png')), hash);

  const current = load(), original = historicalRuntime(priorBytes('index.html').toString('utf8'));
  A.equal(current.metadata.kind, 'EXACT_SHIPPED_RUNTIME_PREFIX'); A.equal(original.metadata.kind, 'EXACT_SHIPPED_RUNTIME_PREFIX');
  A.equal(current.metadata.runtime_sha256, release.runtime_sha256); A.equal(original.metadata.runtime_sha256, oldRelease.runtime_sha256);
  A.deepEqual(plain(current.connection.issue22Materials), materials);
  A.deepEqual(plain(original.connection.issue22Materials), oldMaterials);
  A.ok(bytes('index.html').equals(bytes('app.html')));
  for (const entrypoint of ['index.html', 'app.html']) A.equal(digest(bytes(entrypoint)), release.entrypoints[entrypoint]);
  const tags = scriptTags(bytes('index.html').toString('utf8')), consumerIndex = tags.findIndex(tag => tag.name === 'src/blazer-picker-preview.js');
  for (const name of ['data/blazer-picker-images.js', 'data/suit-picker-images.js', 'data/issue22-picker-images.js']) {
    const tagIndex = tags.findIndex(tag => tag.name === name), tag = tags[tagIndex], raw = bytes(name);
    A.ok(tagIndex >= 0 && tagIndex < consumerIndex);
    A.equal(tag.integrity, 'sha256-' + crypto.createHash('sha256').update(raw).digest('base64'));
    A.ok(tag.url.includes('?v=' + digest(raw).slice(0, 16)));
    vm.runInContext(raw.toString('utf8'), current.g, {filename: name});
  }
  A.deepEqual(plain(current.g.HEWRS_SUIT_PICKER_IMAGES.items.S14), picker.items.S14);
  const selected = picker.items.S14.render_selection;
  const before = await original.capture(selected), after = await current.capture(selected);
  A.equal(before.rgba_sha256, oldPicker.items.S14.rgba_sha256, 'Frozen picker agrees with its exact shipped native render');
  A.equal(after.rgba_sha256, picker.items.S14.rgba_sha256, 'Current picker agrees with its exact shipped native render');
  A.equal(after.rgba_sha256, preS13Picker.items.S14.rgba_sha256, 'Current S14 native pixels remain the completed S14 release');
  A.notEqual(after.rgba_sha256, before.rgba_sha256);
  A.equal(digest(crop(current.canvas, [0, 0, W, H], 360)), picker.items.S14.sha256);
  A.equal(digest(crop(original.canvas, [0, 0, W, H], 360)), oldPicker.items.S14.sha256);
  A.equal(after.result.issue22_material_sources.length, 2);
  for (const used of after.result.issue22_material_sources) {
    const row = Object.values(materials.bindings).find(row => row.garment_id === 'S14' && row.layer === used.layer);
    A.equal(used.geometry_source.sha256, row.source_sha256);
    A.equal(used.display_source.sha256, row.display_sha256); A.equal(used.display_source.url, row.display_url);
  }
  A.deepEqual(plain(after.plan.issue22_material_sources), plain(after.result.issue22_material_sources));
  const avatar = await pixels(original.connection.manifest.static.avatar.url);
  // The approved arm pose relocates sleeve pixels, and the original cuff fit
  // draws registered sleeve cloth inside its two bounded wrist regions. Use
  // those unchanged delivered transforms, rather than the raw asset mask.
  const posedMask = {data: new Uint8ClampedArray(W * H * 4)};
  for (let pixel = 0; pixel < W * H; pixel++) {
    posedMask.data[pixel * 4 + 3] = Math.max(...sourceAlphas.map(alpha => alpha[pixel]));
  }
  original.g.HEWRSAvatarV3ArmPose.apply(posedMask);
  const cuffBounds = plain(original.g.HEWRSAvatarV3CuffFit.spec.bounds);
  A.deepEqual(plain(current.g.HEWRSAvatarV3CuffFit.spec.bounds), cuffBounds);
  const insideCuff = (x, y) => cuffBounds.some(([left, top, width, height]) => x >= left && x < left + width && y >= top && y < top + height);
  let headPixels = 0, outsideGarmentPixels = 0;
  for (let pixel = 0; pixel < W * H; pixel++) {
    const offset = pixel * 4;
    A.equal(after.rgba[offset + 3], before.rgba[offset + 3], 'Every completed native-frame alpha byte remains exact');
    if (posedMask.data[offset + 3] === 0 && !insideCuff(pixel % W, Math.floor(pixel / W))) {
      A.ok(after.rgba.subarray(offset, offset + 4).equals(before.rgba.subarray(offset, offset + 4)), 'Pixels outside the registered S14 pose and cuff bounds remain exact'); outsideGarmentPixels++;
    }
    if (pixel < W * 600 && avatar.data[offset + 3] === 255 && avatar.data.subarray(offset, offset + 4).equals(before.rgba.subarray(offset, offset + 4))) {
      A.ok(after.rgba.subarray(offset, offset + 4).equals(before.rgba.subarray(offset, offset + 4)), 'Exposed approved head and neck remain exact'); headPixels++;
    }
  }
  A.ok(headPixels > 1000); A.ok(outsideGarmentPixels > 1000000);
  const controls = [];
  const beforeS13 = historicalRuntime(preS13Bytes('index.html').toString('utf8'), preS13Bytes);
  A.equal(beforeS13.metadata.kind, 'EXACT_SHIPPED_RUNTIME_PREFIX');
  A.equal(beforeS13.metadata.runtime_sha256, preS13('AVATAR_V3_RELEASE.json').runtime_sha256);
  A.deepEqual(plain(beforeS13.connection.issue22Materials), preS13Materials);
  for (const [id, row] of Object.entries(picker.items).filter(([id]) => id !== 'S14')) {
    const harness = id === 'S13' ? beforeS13 : current;
    const scope = id === 'S13' ? 'historical-before-S13-correction' : 'current';
    const frame = await harness.capture(row.render_selection);
    A.equal(frame.rgba_sha256, oldPicker.items[id].rgba_sha256, 'Non-S14 shipped avatar pixels remain exact (' + scope + '): ' + id);
    A.equal(digest(crop(harness.canvas, [0, 0, W, H], 360)), oldPicker.items[id].sha256);
    controls.push({id, scope, ...(id === 'S13' ? {checkpoint: PRE_S13} : {}), rgba_sha256: frame.rgba_sha256});
    if (global.gc) global.gc();
  }
  A.deepEqual(plain(original.storage.snapshot()), []); A.deepEqual(plain(current.storage.snapshot()), []);
  A.deepEqual(plain(beforeS13.storage.snapshot()), []);

  const phoneTexture = await measurePhoneTexture(materials);
  console.log('S14_PHONE_TEXTURE=' + JSON.stringify(phoneTexture));
  const acceptance = read('tests/s14-material-appearance.json');
  A.equal(acceptance.material_revision, materials.garments.S14.revision);
  const generatedTexture = read('provenance/issue22/material-provenance.json').generated_textures.S14;
  A.equal(generatedTexture.sha256, acceptance.generated_texture_sha256);
  A.equal(digest(bytes(generatedTexture.path)), generatedTexture.sha256);
  assertPhoneTexture(phoneTexture, acceptance);
  // Re-run the real previous material through the same measurement. A bound
  // that merely accepts both old flat cloth and the current texture is invalid.
  const priorPhoneTexture = await measurePhoneTexture(oldMaterials);
  A.throws(() => assertPhoneTexture(priorPhoneTexture, acceptance), /texture remains visible/);
  const report = {schema: 'hewrs.s14-material-verification.v1', status: 'PASS', baseline_commit: BASE,
    verification_scope: 'Current released S14 appearance and original S14 isolation, with S13 isolation frozen at the completed S14 release',
    material_revision: materials.garments.S14.revision, changed_layers: changedLayers,
    preserved_material_layers: preservedLayers, changed_picker_ids: ['S14'], preserved_picker_images: controls.filter(row => row.scope === 'current').length,
    retained_historical_s13: {checkpoint: PRE_S13, material_layers: retainedHistoricalS13Layers, picker_images: 1, native_frames: 1, current_gate: 'tests/s13-material.cjs'},
    native_controls: controls, protected_hardware_pixels: protectedHardware, protected_head_pixels: headPixels,
    exact_pixels_outside_s14: outsideGarmentPixels, before_native_rgba_sha256: before.rgba_sha256,
    after_native_rgba_sha256: after.rgba_sha256, runtime: current.metadata.runtime,
    runtime_sha256: current.metadata.runtime_sha256, active_material_bindings_verified: 2,
    dna_and_numeric_matching: 'byte-identical', saved_data_writes: 0, phone_texture: phoneTexture,
    limitations: 'Pixel and source regression, not calibrated physical colour matching or a new garment/avatar approval.'};
  const output = path.join(ROOT, 'evidence/s14-material-20261122/material-verification.json');
  fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log('S14_MATERIAL=' + JSON.stringify(report));
}

module.exports = {measurePhoneTexture, assertPhoneTexture};
if (require.main === module) main().catch(error => {console.error(error.stack || error); process.exitCode = 1;});
