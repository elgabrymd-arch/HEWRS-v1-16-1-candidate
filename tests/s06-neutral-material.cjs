#!/usr/bin/env node
'use strict';

// Focused comparison with the previous integration. This validates registered
// display bytes and actual runtime use of the approved generated fabric. It
// does not assert a physical colour match or infer approval of a new avatar.
const A = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const harness = require('./avatar-v3-fit-runtime.cjs');
const {load, crop, digest, ROOT, WIDTH: W, HEIGHT: H} = harness;
let native;
try { native = require('@napi-rs/canvas'); }
catch (_) { native = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules', '@napi-rs/canvas')); }
const {createCanvas, loadImage} = native;
const BASE = 'f3c3a10151c9fb9d7868c50b52f9cf7f33cc02f9';
const APPROVED_FABRIC_SHA256 = '3c2730b546f08b77b2c1d0764a6b69e5c96dd0085c00023d222dac438c825d51';
const bytes = file => fs.readFileSync(path.join(ROOT, file));
const read = file => JSON.parse(bytes(file));
const priorBytes = file => execFileSync('git', ['show', BASE + ':' + file], {cwd: ROOT, maxBuffer: 64 * 1024 * 1024});
const prior = file => JSON.parse(priorBytes(file));
const plain = value => JSON.parse(JSON.stringify(value));

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
    name: match[2].split('?')[0], url: match[2],
    integrity: match[1].match(/\bintegrity="([^"]+)"/)?.[1]
  }));
}

function phoneAppearance(canvas) {
  // These ordinary cloth regions exposed the false broad checker blocks at
  // phone size. Remove only a planar lighting trend when measuring residual
  // contrast, and independently require a real source calf fold to remain.
  // This is an observable sampling regression, not physical fabric metrology.
  const phone = createCanvas(390, 1076), context = phone.getContext('2d');
  context.drawImage(canvas, 0, 0, 390, 1076);
  function patch(rect) {
    const [x, y, width, height] = rect, data = context.getImageData(x, y, width, height).data;
    const values = [], cx = (width - 1) / 2, cy = (height - 1) / 2;
    let mean = 0, numeratorX = 0, numeratorY = 0, denominatorX = 0, denominatorY = 0;
    for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
      const offset = (j * width + i) * 4;
      const value = .2126 * data[offset] + .7152 * data[offset + 1] + .0722 * data[offset + 2];
      A.equal(data[offset + 3], 255, 'Distance-appearance samples stay inside opaque cloth');
      values.push(value); mean += value;
      numeratorX += (i - cx) * value; numeratorY += (j - cy) * value;
      denominatorX += (i - cx) ** 2; denominatorY += (j - cy) ** 2;
    }
    mean /= values.length;
    const slopeX = numeratorX / denominatorX, slopeY = numeratorY / denominatorY;
    let squares = 0;
    for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
      squares += (values[j * width + i] - mean - slopeX * (i - cx) - slopeY * (j - cy)) ** 2;
    }
    return {rect, mean_luma: mean, detrended_rms_luma: Math.sqrt(squares / values.length)};
  }
  const patches = [
    {name: 'chest', rect: [108, 300, 40, 50], maximum_rms: 3.5},
    {name: 'lower_jacket', rect: [125, 472, 37, 48], maximum_rms: 3.5},
    {name: 'left_thigh', rect: [129, 647, 40, 75], maximum_rms: 3.5},
    {name: 'right_thigh', rect: [222, 647, 38, 75], maximum_rms: 5}
  ].map(row => ({...row, ...patch(row.rect)}));
  for (const row of patches) A.ok(row.detrended_rms_luma < row.maximum_rms,
    'S06 at 390px must not reintroduce broad checker blocks: ' + JSON.stringify(row));
  const foldShadow = patch([228, 908, 20, 12]), foldHighlight = patch([228, 875, 20, 12]);
  const foldContrast = foldHighlight.mean_luma - foldShadow.mean_luma;
  A.ok(foldContrast >= 18, 'Quiet cloth must retain the registered calf fold instead of becoming a flat fill');
  return {width: 390, height: 1076, patches,
    retained_calf_fold: {shadow: foldShadow, highlight: foldHighlight, contrast_luma: foldContrast, minimum_contrast_luma: 18},
    scope: 'Sampling regression in fixed normal-distance cloth regions; not a calibrated physical-cloth measurement'};
}

function historicalRuntime(html) {
  // Use the actual prior HTML/runtime, without writing a replacement page or
  // globally patching fs. Every prerequisite before the old runtime is pinned
  // to the exact prior bytes; the runtime harness also validates SRI itself.
  const tags = scriptTags(html), runtimeIndex = tags.findIndex(tag => tag.name.startsWith('runtime/'));
  A.ok(runtimeIndex > 0);
  for (const tag of tags.slice(0, runtimeIndex + 1)) {
    A.ok(bytes(tag.name).equals(priorBytes(tag.name)), 'Historical runtime prerequisite preserved: ' + tag.name);
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
  A.equal(reads, 1, 'Only the historical entrypoint is virtually substituted');
  return {...result, capture: selected => result.capture(vm.runInContext('(' + JSON.stringify(selected) + ')', context))};
}

async function main() {
  const materials = read('data/issue22-materials.json'), oldMaterials = prior('data/issue22-materials.json');
  const picker = read('data/issue22-picker-images.json'), oldPicker = prior('data/issue22-picker-images.json');
  const release = read('AVATAR_V3_RELEASE.json'), oldRelease = prior('AVATAR_V3_RELEASE.json');
  const provenance = read('provenance/issue22/material-provenance.json');
  A.notEqual(materials.revision, oldMaterials.revision, 'New displayed material has a distinct revision');
  A.deepEqual(materials.scope, oldMaterials.scope, 'Material scope is unchanged');
  A.deepEqual(Object.keys(materials.bindings), Object.keys(oldMaterials.bindings));
  A.equal(Object.keys(materials.bindings).length, 9);
  A.deepEqual(materials.canvas, [W, H]);
  A.equal(materials.alpha_policy, 'exact_source_alpha');
  A.equal(materials.garments.S06.material, 'owner-approved-generated-fabric');
  A.equal(materials.garments.S06.parameters.neutralize_color, true);
  A.equal(materials.garments.S06.target_rgb.length, 3);
  A.equal(new Set(materials.garments.S06.target_rgb).size, 1, 'Declared display target is neutral, not a calibrated physical measurement');
  const approved = provenance.generated_fabrics.S06;
  A.equal(approved.source_type, 'owner-approved-generated-fabric-reference');
  A.equal(approved.sha256, APPROVED_FABRIC_SHA256, 'Exact previously approved generated reference');
  A.equal(digest(bytes(approved.path)), APPROVED_FABRIC_SHA256);
  A.match(approved.approval_scope, /fabric appearance only/i);
  A.match(approved.approval_scope, /not.*avatar approval/i);

  const changedLayers = [];
  let preservedMaterialLayers = 0;
  for (const [sourceHash, row] of Object.entries(materials.bindings)) {
    const old = oldMaterials.bindings[sourceHash];
    A.equal(row.source_sha256, sourceHash);
    for (const key of ['garment_id', 'layer', 'source_sha256', 'source_url', 'rect', 'alpha_sha256']) {
      A.deepEqual(row[key], old[key], 'Registered geometry preserved: ' + row.garment_id + '/' + row.layer + '/' + key);
    }
    A.equal(digest(bytes(row.source_url)), sourceHash, 'Native source content identity');
    A.equal(digest(bytes(row.display_url)), row.display_sha256, 'Current display checksum');
    A.equal(digest(bytes(old.display_url)), old.display_sha256, 'Historical display retained');
    A.equal(materials.assetPaths[row.display_sha256], row.display_url);
    if (row.garment_id !== 'S06') {
      A.deepEqual(row, old, 'Unrelated material binding remains exact');
      A.ok(bytes(row.display_url).equals(priorBytes(old.display_url)), 'Unrelated material PNG remains byte-exact');
      preservedMaterialLayers++;
      continue;
    }
    A.notEqual(row.display_sha256, old.display_sha256, 'S06 display must change, not only its label');
    const [source, before, after] = await Promise.all([pixels(row.source_url), pixels(old.display_url), pixels(row.display_url)]);
    for (const frame of [source, before, after]) A.deepEqual([frame.width, frame.height], [W, H]);
    const alpha = Buffer.alloc(W * H);
    let changedRgbPixels = 0, alphaChanges = 0, transparentChanges = 0;
    for (let pixel = 0; pixel < W * H; pixel++) {
      const offset = pixel * 4;
      alpha[pixel] = after.data[offset + 3];
      if (alpha[pixel] !== source.data[offset + 3] || alpha[pixel] !== before.data[offset + 3]) alphaChanges++;
      const changed = !before.data.subarray(offset, offset + 3).equals(after.data.subarray(offset, offset + 3));
      if (changed) changedRgbPixels++;
      if (source.data[offset + 3] === 0 && !source.data.subarray(offset, offset + 4).equals(after.data.subarray(offset, offset + 4))) transparentChanges++;
    }
    A.ok(changedRgbPixels > 0, 'S06 actual fabric pixels changed');
    A.equal(alphaChanges, 0, 'S06 every native/previous/current alpha byte agrees');
    A.equal(transparentChanges, 0, 'No new background or silhouette pixels');
    A.equal(digest(alpha), row.alpha_sha256);
    changedLayers.push({layer: row.layer, source_sha256: sourceHash,
      before_display_sha256: old.display_sha256, after_display_sha256: row.display_sha256,
      changed_rgb_pixels: changedRgbPixels, alpha_changed_pixels: alphaChanges, transparent_changed_pixels: transparentChanges});
  }
  A.equal(changedLayers.length, 2, 'Exactly the two S06 display layers change');
  A.equal(preservedMaterialLayers, 7);

  A.deepEqual(Object.keys(picker.items), Object.keys(oldPicker.items));
  let preservedPickers = 0;
  for (const [id, current] of Object.entries(picker.items)) {
    const old = oldPicker.items[id];
    A.equal(digest(bytes(current.src)), current.sha256);
    for (const key of ['history_id', 'render_selection', 'source_kind', 'width', 'height']) A.deepEqual(current[key], old[key], 'Picker identity/layout ' + id + '/' + key);
    if (id === 'S06') {
      A.notEqual(current.sha256, old.sha256, 'S06 picker image checksum changes');
      const [before, after] = await Promise.all([pixels(old.src), pixels(current.src)]);
      A.equal(before.data.equals(after.data), false, 'S06 picker decoded pixels change');
      A.equal(current.source_kind, 'native_avatar_preview');
      A.notEqual(current.owner_approved, true, 'Fabric approval is not an invented whole-avatar approval');
      A.match(current.source_note, /approved.*fabric/i);
      A.doesNotMatch(current.source_note, /photo[- ]matched/i);
    } else {
      for (const key of ['src', 'sha256', 'rgba_sha256']) A.equal(current[key], old[key], 'Unrelated picker image ' + id + '/' + key);
      A.ok(bytes(current.src).equals(priorBytes(old.src)), 'Unrelated picker PNG remains byte-exact: ' + id);
      preservedPickers++;
    }
  }
  A.equal(preservedPickers, 6);

  // Avatar sources and every fit module remain the prior approved contracts.
  for (const key of ['layer_hashes', 'immutable_v2_hashes', 'source_modules', 'issue19_fit_modules', 'source_specification_sha256']) {
    A.deepEqual(release[key], oldRelease[key], 'Avatar/geometry contract ' + key);
  }
  for (const hash of Object.values({...release.layer_hashes, ...Object.fromEntries(Object.entries(release.immutable_v2_hashes).map(([key, value]) => ['v2_' + key, value]))})) {
    A.equal(digest(bytes('assets/' + hash + '.png')), hash, 'Approved avatar/hand source byte identity');
  }
  for (const [file, hash] of Object.entries(release.source_modules)) A.equal(digest(bytes(file)), hash);
  A.equal(digest(bytes(release.source_specification)), release.source_specification_sha256);

  const html = bytes('index.html').toString('utf8'), oldHtml = priorBytes('index.html').toString('utf8');
  const current = load(), original = historicalRuntime(oldHtml);
  A.equal(current.metadata.kind, 'EXACT_SHIPPED_RUNTIME_PREFIX');
  A.equal(original.metadata.kind, 'EXACT_SHIPPED_RUNTIME_PREFIX');
  A.equal(current.metadata.runtime_sha256, release.runtime_sha256);
  A.equal(original.metadata.runtime_sha256, oldRelease.runtime_sha256);
  A.deepEqual(plain(current.g.HEWRS_ISSUE22_MATERIALS), materials, 'Active runtime embeds current material manifest');
  A.deepEqual(plain(current.connection.issue22Materials), materials, 'Active connection uses current material manifest');
  A.deepEqual(plain(original.connection.issue22Materials), oldMaterials, 'Control uses the exact prior material manifest');
  for (const entrypoint of ['index.html', 'app.html']) A.equal(digest(bytes(entrypoint)), release.entrypoints[entrypoint]);
  A.ok(bytes('index.html').equals(bytes('app.html')), 'Both shipped entrypoints have the same current bindings');

  // Execute the actual HTML-bound picker data scripts, checking their cache
  // pins and SRI. This proves the displayed picker resolves the new image;
  // it is intentionally not a substitute for the separate browser UI gate.
  const tags = scriptTags(html), consumerIndex = tags.findIndex(tag => tag.name === 'src/blazer-picker-preview.js');
  for (const name of ['data/blazer-picker-images.js', 'data/suit-picker-images.js', 'data/issue22-picker-images.js']) {
    const tagIndex = tags.findIndex(tag => tag.name === name), tag = tags[tagIndex];
    A.ok(tagIndex >= 0 && tagIndex < consumerIndex, 'Picker manifest loads before its consumer');
    const raw = bytes(name), hash = digest(raw);
    A.equal(tag.integrity, 'sha256-' + crypto.createHash('sha256').update(raw).digest('base64'));
    A.ok(tag.url.includes('?v=' + hash.slice(0, 16)));
    vm.runInContext(raw.toString('utf8'), current.g, {filename: name});
  }
  A.deepEqual(plain(current.g.HEWRS_ISSUE22_PICKER_IMAGES), picker);
  A.deepEqual(plain(current.g.HEWRS_SUIT_PICKER_IMAGES.items.S06), picker.items.S06);
  for (const [id, record] of Object.entries(picker.items)) {
    A.deepEqual(plain((id.startsWith('S') ? current.g.HEWRS_SUIT_PICKER_IMAGES : current.g.HEWRS_BLAZER_PICKER_IMAGES).items[id]), record);
  }

  const selected = picker.items.S06.render_selection;
  const beforeFrame = await original.capture(selected), afterFrame = await current.capture(selected);
  A.notEqual(afterFrame.rgba_sha256, beforeFrame.rgba_sha256, 'Shipped S06 native appearance changes');
  A.equal(beforeFrame.rgba_sha256, oldPicker.items.S06.rgba_sha256, 'Prior picker matches prior shipped native render');
  A.equal(afterFrame.rgba_sha256, picker.items.S06.rgba_sha256, 'New picker matches current shipped native render');
  A.equal(digest(crop(original.canvas, [0, 0, W, H], 360)), oldPicker.items.S06.sha256);
  A.equal(digest(crop(current.canvas, [0, 0, W, H], 360)), picker.items.S06.sha256);
  const distanceAppearance = phoneAppearance(current.canvas);
  A.equal(afterFrame.result.issue22_material_revision, materials.revision);
  A.equal(afterFrame.result.issue22_material_sources.length, 2);
  for (const used of afterFrame.result.issue22_material_sources) {
    const binding = Object.values(materials.bindings).find(row => row.garment_id === 'S06' && row.layer === used.layer);
    A.equal(used.geometry_source.sha256, binding.source_sha256);
    A.equal(used.display_source.sha256, binding.display_sha256);
    A.equal(used.display_source.url, binding.display_url);
  }
  A.deepEqual(plain(afterFrame.plan.issue22_material_sources), plain(afterFrame.result.issue22_material_sources));
  const avatar = await pixels(original.connection.manifest.static.avatar.url);
  let protectedHeadPixels = 0;
  for (let pixel = 0; pixel < W * 600; pixel++) {
    const offset = pixel * 4;
    if (avatar.data[offset + 3] === 255 && avatar.data.subarray(offset, offset + 4).equals(beforeFrame.rgba.subarray(offset, offset + 4))) {
      A.ok(afterFrame.rgba.subarray(offset, offset + 4).equals(beforeFrame.rgba.subarray(offset, offset + 4)), 'Exposed approved head/neck pixel preserved');
      protectedHeadPixels++;
    }
  }
  A.ok(protectedHeadPixels > 1000, 'Head preservation assertion covers an exposed region');
  A.deepEqual(plain(original.storage.snapshot()), []);
  A.deepEqual(plain(current.storage.snapshot()), []);
  const report = {
    schema: 'hewrs.s06-neutral-material-verification.v1', status: 'PASS', baseline_commit: BASE,
    material_revision: materials.revision, approved_generated_reference_sha256: APPROVED_FABRIC_SHA256,
    changed_layers: changedLayers, preserved_material_layers: preservedMaterialLayers,
    changed_picker_ids: ['S06'], preserved_picker_images: preservedPickers,
    runtime: current.metadata.runtime, runtime_sha256: current.metadata.runtime_sha256,
    before_native_rgba_sha256: beforeFrame.rgba_sha256, after_native_rgba_sha256: afterFrame.rgba_sha256,
    protected_head_pixels: protectedHeadPixels, active_material_bindings_verified: 2,
    active_picker_manifest_verified: true, picker_matches_shipped_native_pixels: true,
    original_avatar_sources_preserved: true, saved_data_writes: 0,
    normal_distance_appearance: distanceAppearance,
    authority: 'Owner-approved generated fabric representation on unchanged registered garment and avatar geometry.',
    limitations: 'Source/pixel regression verification, not a calibrated physical colour match, a new avatar approval, or a new whole-outfit visual judgment.'
  };
  const output = path.join(ROOT, 'evidence/s06-neutral-20261122/material-verification.json');
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log('S06_NEUTRAL_MATERIAL=' + JSON.stringify(report));
}

main().catch(error => {console.error(error.stack || error); process.exitCode = 1;});
