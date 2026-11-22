'use strict';
/* Independent regression for the enclosed cuff/trouser hole.
 * The repaired renderer is compared with the immutable rejected cuff module,
 * while expected underlay pixels come only from original registered PNGs and
 * the unchanged, approved pose. The rejected output supplies foreground and
 * preservation controls, never the missing trouser colour or coverage.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {load, selection, digest, ROOT, WIDTH: W, HEIGHT: H} = require('./avatar-v3-fit-runtime.cjs');
let native;
try { native = require('@napi-rs/canvas'); }
catch (_) { native = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules', '@napi-rs/canvas')); }
const {Image} = native;
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'issue19-cuff-underlay-fixtures.json'), 'utf8'));
const regions = fixture.cuff_bounds_xywh;
const approved = load({entrypoint: 'avatar-v3-issue19-baseline.html'});
const current = load();
const diagnostic = load({omitFitModules: ['src/avatar-v3-cuff-fit.js']});
assert.equal(approved.metadata.runtime_sha256, fixture.baseline_runtime_sha256, 'literal approved source/pose runtime');
assert.equal(digest(fs.readFileSync(path.join(ROOT, 'src/avatar-v3-pose.js'))), fixture.approved_pose_source_sha256, 'unchanged approved pose source');
const rejectedPath = path.join(ROOT, 'runtime', 'avatar-v3-candidate-' + fixture.rejected_runtime_sha256.slice(0, 20) + '.js');
const rejectedBytes = fs.readFileSync(rejectedPath);
assert.equal(digest(rejectedBytes), fixture.rejected_runtime_sha256, 'immutable rejected runtime supplies only the prior fitted foreground');
const rejectedCode = rejectedBytes.toString('utf8');
const startMarker = '/* V3 ISSUE 19 SOURCE: src/avatar-v3-cuff-fit.js */\n';
const stopMarker = '\n;\n/* SOURCE: data/option-card-thumbnails.js */';
const start = rejectedCode.indexOf(startMarker);
const stop = rejectedCode.indexOf(stopMarker, start);
assert.ok(start > 0 && stop > start && rejectedCode.indexOf(startMarker, start + 1) < 0, 'unique immutable cuff source boundaries');
const rejectedCuff = rejectedCode.slice(start + startMarker.length, stop);
assert.equal(digest(rejectedCuff), fixture.rejected_cuff_source_sha256, 'literal rejected cuff source');
vm.runInContext(rejectedCuff, diagnostic.g, {filename: rejectedPath + '#explicit-rejected-cuff-diagnostic'});
const rejectedCanvas = diagnostic.makeCanvas();
const rejectedRenderer = diagnostic.g.HEWRSAtomicRenderer.create(rejectedCanvas, diagnostic.connection, {resolveUrl: diagnostic.resolveUrl});
const c = approved.connection;
let checks = 0;
const sourceHashes = new Map();
const decoded = new Map();
const records = [];
const plain = value => JSON.parse(JSON.stringify(value));
const pixel = (data, x, y) => [...data.subarray((y * W + x) * 4, (y * W + x) * 4 + 4)];
const samePixel = (a, b, i) => a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3];
function equal(a, b, label) { assert.deepEqual(a, b, label); checks++; }
function ok(value, label) { assert.ok(value, label); checks++; }
function forWrist(fn) {
  for (const [x0, y0, width, height] of regions)
    for (let y = y0; y < y0 + height; y++)
      for (let x = x0; x < x0 + width; x++) fn((y * W + x) * 4, x, y);
}
async function originalImage(d) {
  equal(plain(d.rect), [0, 0, W, H], 'original native source registration');
  const filename = approved.resolveUrl(d);
  if (!sourceHashes.has(filename)) {
    equal(digest(fs.readFileSync(filename)), d.sha256, 'original source file is its registered SHA-256');
    sourceHashes.set(filename, d.sha256);
  }
  if (decoded.has(d.sha256)) return decoded.get(d.sha256);
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = filename; });
  equal([image.width, image.height], [W, H], 'original source native dimensions');
  decoded.set(d.sha256, image);
  while (decoded.size > 8) decoded.delete(decoded.keys().next().value);
  return image;
}
async function plane(descriptors, pose = true, canonical = true) {
  const canvas = approved.makeCanvas(), ctx = canvas.getContext('2d', {willReadFrequently: true});
  for (const d of descriptors) {
    const image = await originalImage(d);
    if (!d.display_alpha_mask) ctx.drawImage(image, 0, 0);
    else {
      const layer = approved.makeCanvas(), lc = layer.getContext('2d', {willReadFrequently: true});
      lc.drawImage(image, 0, 0); lc.globalCompositeOperation = 'destination-in';
      lc.drawImage(await originalImage(d.display_alpha_mask), 0, 0); ctx.drawImage(layer, 0, 0);
      layer.width = layer.height = 1;
    }
  }
  const frame = ctx.getImageData(0, 0, W, H);
  if (pose) approved.g.HEWRSAvatarV3ArmPose.apply(frame);
  if (canonical) ctx.putImageData(frame, 0, 0);
  const data = Buffer.from(canonical ? ctx.getImageData(0, 0, W, H).data : frame.data);
  canvas.width = canvas.height = 1;
  return data;
}
function compositeOriginalPlanes(background, foreground) {
  const canvas = approved.makeCanvas(), ctx = canvas.getContext('2d', {willReadFrequently: true});
  for (const bytes of [background, foreground]) {
    const layer = approved.makeCanvas(), lc = layer.getContext('2d', {willReadFrequently: true});
    const frame = lc.createImageData(W, H); frame.data.set(bytes); lc.putImageData(frame, 0, 0);
    ctx.drawImage(layer, 0, 0); layer.width = layer.height = 1;
  }
  const data = Buffer.from(ctx.getImageData(0, 0, W, H).data); canvas.width = canvas.height = 1; return data;
}
function frozenCorridor(mode, jacketSha) {
  const record = fixture.frozen_seam_corridors.records.find(r => r.mode === mode);
  ok(record, mode + ' has an independently frozen source-owned seam domain');
  equal(record.jacket_sha256, jacketSha, mode + ' frozen domain belongs to this original jacket');
  const mask = new Uint8Array(W * H); let count = 0;
  for (const [y, x0, x1] of record.source_owned_interior_runs_y_x0_x1) {
    ok(regions.some(([x, top, width, height]) => y >= top && y < top + height && x0 >= x && x1 <= x + width), 'source corridor remains inside one declared wrist');
    ok(x0 < x1, 'nonempty half-open frozen source corridor run');
    for (let x = x0; x < x1; x++) { equal(mask[y * W + x], 0, 'source corridor runs do not overlap'); mask[y * W + x] = 1; count++; }
  }
  equal(count, record.source_owned_interior_pixels, mode + ' complete frozen original-source domain');
  return {record, mask};
}
function originalSelection(s) {
  const p = approved.plan(s);
  let avatar, shoes, pants, jacket, hands;
  if (s.blazerId) {
    const b = c.blazerConnection.knownBlazer(s.blazerId);
    avatar = c.manifest.static.avatar; shoes = c.shoeLayers[s.shoeId];
    pants = c.blazerConnection.knownPant(s.pantId).layer;
    jacket = b.assembly?.jacket || b.checkpoint_layer;
    hands = c.blazerConnection.data.assembly.hands;
  } else {
    const m = c.assemblies.forSelection(s.suitId, s.shoeId, s.shirtId).static;
    avatar = m.avatar; shoes = m.shoe; pants = m.trousers; jacket = m.jacket;
    hands = [m.left_hand, m.right_hand];
  }
  const hashes = new Set([avatar, shoes, pants].map(d => d.sha256));
  const order = Array.isArray(p) ? p.filter(d => hashes.has(d.sha256)) : [p.avatar, p.shoes, p.pants];
  equal(order.length, 3, 'approved plan retains all three lower sources');
  equal(new Set(order.map(d => d.sha256)).size, 3, 'approved lower sources are distinct');
  ok(order.every(d => hashes.has(d.sha256)), 'approved lower-source order uses the selected original garments');
  return {avatar, shoes, pants, jacket, hands, order, legacy: Array.isArray(p)};
}
async function capture(renderer, canvas, storage, s) {
  const before = JSON.stringify(storage.snapshot());
  const result = await renderer.render(s);
  equal(result.status, 'ready', 'complete actual native composition');
  equal(canvas.dataset.status, 'ready', 'actual native frame committed');
  equal(plain(renderer.last()), s, 'exact selection committed');
  equal(JSON.stringify(storage.snapshot()), before, 'render preserves isolated storage');
  return Buffer.from(canvas.getContext('2d').getImageData(0, 0, W, H).data);
}
function cuffDigest(data) {
  const parts = [];
  for (const [x, y, width, height] of regions)
    for (let row = 0; row < height; row++) parts.push(data.subarray(((y + row) * W + x) * 4, ((y + row) * W + x + width) * 4));
  return digest(Buffer.concat(parts));
}
async function proveOriginalScope(limited) {
  const avatarDesc = c.manifest.static.avatar, shoeDesc = c.shoeLayers['shoe-8'];
  const avatarRaw = await plane([avatarDesc], false), avatar = await plane([avatarDesc]);
  const shoes = await plane([shoeDesc]);
  const trousers = new Map();
  for (const id of c.limits.suits) {
    const d = c.assemblies.forSelection(id, 'shoe-8', 'DS035').static.trousers;
    trousers.set(d.sha256, d);
  }
  for (const id of Object.keys(c.blazerConnection.data.pants)) {
    const d = c.blazerConnection.knownPant(id).layer; trousers.set(d.sha256, d);
  }
  equal(trousers.size, 27, 'all 18 suits and 24 physical blazer pants resolve to 27 original sources');
  const selectedSources = limited ? new Set(limited.map(mode => originalSelection(selection('DS035', 'NO_TIE', mode)).pants.sha256)) : null;
  const proof = [];
  for (const d of [...trousers.values()].filter(d => !selectedSources || selectedSources.has(d.sha256))) {
    ok(!d.display_alpha_mask, 'selected original trousers have no unaccounted display mask');
    const raw = await plane([d], false), posed = await plane([d]);
    const legacy = await plane([shoeDesc, d, avatarDesc]);
    const continuous = await plane([avatarDesc, shoeDesc, d]);
    const counts = {raw_avatar_overlap: 0, posed_avatar_overlap: 0, posed_shoe_overlap: 0, legacy_difference: 0, continuous_difference: 0, covered_pixels: 0, opaque_pixels: 0};
    forWrist(i => {
      if (raw[i + 3] && avatarRaw[i + 3]) counts.raw_avatar_overlap++;
      if (!posed[i + 3]) return;
      counts.covered_pixels++; if (posed[i + 3] === 255) counts.opaque_pixels++;
      if (avatar[i + 3]) counts.posed_avatar_overlap++;
      if (shoes[i + 3]) counts.posed_shoe_overlap++;
      if (!samePixel(posed, legacy, i)) counts.legacy_difference++;
      if (!samePixel(posed, continuous, i)) counts.continuous_difference++;
    });
    for (const key of ['raw_avatar_overlap', 'posed_avatar_overlap', 'posed_shoe_overlap', 'legacy_difference', 'continuous_difference']) equal(counts[key], 0, d.sha256 + ' source scope ' + key);
    ok(counts.covered_pixels > 26000 && counts.opaque_pixels > 24000, 'non-vacuous original trouser coverage');
    proof.push({source_sha256: d.sha256, ...counts});
    if (global.gc) global.gc();
  }
  console.log('CUFF_UNDERLAY_SOURCE_SCOPE=' + JSON.stringify({sources: proof.length, records: proof}));
  return {avatar, proof};
}
async function main() {
  const allModes = [...c.limits.suits, ...c.blazerConnection.availableIds];
  equal(allModes.length, 33, 'complete original jacket inventory');
  const modesArg = process.argv.indexOf('--diagnostic-mode');
  const limited = modesArg >= 0 ? process.argv[modesArg + 1].split(',') : null;
  if (limited) ok(limited.every(mode => allModes.includes(mode)), 'explicit limited diagnostic modes');
  const {avatar, proof} = await proveOriginalScope(limited);
  const hands = await Promise.all([c.manifest.static.left_hand, c.manifest.static.right_hand].map(d => plane([d])));
  async function verify(s, label) {
    const binding = originalSelection(s), pantsRaw = await plane([binding.pants], true, false), pants = await plane([binding.pants]);
    const jacketRaw = await plane([binding.jacket], true, false), jacket = await plane([binding.jacket]);
    const originalJacketOverPants = compositeOriginalPlanes(pantsRaw, jacketRaw);
    const corridor = frozenCorridor(s.suitId || s.blazerId, binding.jacket.sha256);
    if (binding.jacket.display_alpha_mask) {
      const withoutMask = {...binding.jacket}; delete withoutMask.display_alpha_mask;
      const rawJacket = await plane([withoutMask]); let affected = 0;
      forWrist(i => { if (!samePixel(rawJacket, jacket, i)) affected++; });
      equal(affected, 0, 'registered display mask does not change any cuff source pixel');
    }
    const before = await capture(rejectedRenderer, rejectedCanvas, diagnostic.storage, s);
    const after = await capture(current.renderer, current.canvas, current.storage, s);
    const count = {changed_pixels: 0, outside_bounds_changed: 0, old_opaque_foreground_pixels: 0, old_opaque_foreground_changed: 0, original_pants_opaque_pixels: 0, original_pants_coverage_lost: 0, pure_underlay_pixels: 0, pure_underlay_wrong: 0, no_pants_pixels: 0, no_pants_foreground_changed: 0, opaque_hand_pixels: 0, opaque_hand_pixels_changed: 0, transparent_exterior_pixels: 0, seam_source_pixels: 0, seam_source_zero_foreground_pixels: 0, seam_source_wrong: 0, frozen_domain_bad_source: 0};
    const inBounds = (x, y) => regions.some(([left, top, width, height]) => x >= left && x < left + width && y >= top && y < top + height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, changed = !samePixel(before, after, i);
      if (changed) { count.changed_pixels++; if (!inBounds(x, y)) count.outside_bounds_changed++; }
    }
    forWrist(i => {
      const changed = !samePixel(before, after, i), seam = corridor.mask[i / 4] === 1;
      if (seam) {
        count.seam_source_pixels++;
        if (!jacket[i + 3] || before[i + 3] === 255) count.frozen_domain_bad_source++;
        if (before[i + 3] === 0) { count.seam_source_zero_foreground_pixels++; if (!samePixel(after, originalJacketOverPants, i)) count.seam_source_wrong++; }
      }
      if (before[i + 3] === 255) { count.old_opaque_foreground_pixels++; if (changed) count.old_opaque_foreground_changed++; }
      if (pants[i + 3] === 255) { count.original_pants_opaque_pixels++; if (after[i + 3] !== 255) count.original_pants_coverage_lost++; }
      if (before[i + 3] === 0 && pants[i + 3] > 0 && !seam) { count.pure_underlay_pixels++; if (!samePixel(after, pants, i)) count.pure_underlay_wrong++; }
      if (!pants[i + 3] && !seam) { count.no_pants_pixels++; if (changed) count.no_pants_foreground_changed++; if (!before[i + 3]) count.transparent_exterior_pixels++; }
      if (hands.some(hand => hand[i + 3] === 255)) { count.opaque_hand_pixels++; if (changed) count.opaque_hand_pixels_changed++; }
    });
    for (const key of ['outside_bounds_changed', 'old_opaque_foreground_changed', 'original_pants_coverage_lost', 'pure_underlay_wrong', 'no_pants_foreground_changed', 'opaque_hand_pixels_changed', 'seam_source_wrong', 'frozen_domain_bad_source']) equal(count[key], 0, label + ' ' + key);
    ok(count.old_opaque_foreground_pixels > 40000 && count.opaque_hand_pixels > 5000, label + ' non-vacuous original foreground and hand masks');
    ok(count.original_pants_opaque_pixels > 24000 && count.transparent_exterior_pixels > 10000, label + ' original underlay and exterior controls');
    for (const f of fixture.cases.filter(f => f.mode === (s.suitId || s.blazerId))) {
      const actual = {avatar: binding.avatar.sha256, shoes: binding.shoes.sha256, pants: binding.pants.sha256, jacket: binding.jacket.sha256, hands: Array.from(binding.hands, d => d.sha256)};
      for (const key of Object.keys(actual)) equal(actual[key], f.source_hashes[key], label + ' fixture original source ' + key);
      if (f.mode === 'S03') equal(f.positive_coverage_points_xy.length, 194, 'literal enclosed S03 component size');
      let rejectedLowAlpha = 0;
      for (const [x, y] of f.positive_coverage_points_xy) {
        equal(pixel(pants, x, y)[3], 255, label + ' original trouser coverage at fixed component point');
        equal(pixel(after, x, y)[3], 255, label + ' restored fixed component coverage');
        if (pixel(before, x, y)[3] < 128) rejectedLowAlpha++;
      }
      equal(rejectedLowAlpha, f.positive_coverage_points_xy.length, label + ' original rejected foreground demonstrably fails all fixed component controls');
      for (const [x, y] of f.exact_underlay_points_xy) {
        equal(pixel(jacket, x, y)[3], 0, 'literal pure-underlay control has no original jacket');
        for (const hand of hands) equal(pixel(hand, x, y)[3], 0, 'literal pure-underlay control has no approved hand');
        equal(pixel(after, x, y), pixel(pants, x, y), label + ' exact independently decoded original trouser colour');
      }
      for (const [x, y] of f.positive_jacket_coverage_points_xy || []) {
        ok(pixel(jacket, x, y)[3] > 0, 'frozen lost-seam point belongs to the original jacket');
        ok(pixel(after, x, y)[3] >= pixel(jacket, x, y)[3], label + ' original jacket seam coverage is retained');
        for (const hand of hands) equal(pixel(hand, x, y)[3], 0, 'upper seam positive is not an approved hand');
      }
      for (const [x, y] of f.exact_original_jacket_points_xy || []) {
        equal(pixel(jacket, x, y)[3], 255, 'literal seam colour control is originally opaque jacket');
        equal(pixel(before, x, y)[3], 0, 'literal seam colour control has no rejected fitted foreground');
        equal(pixel(after, x, y), pixel(jacket, x, y), label + ' exact original jacket seam colour');
      }
      for (const [x, y] of f.exact_original_jacket_over_trousers_points_xy || []) {
        equal(pixel(before, x, y)[3], 0, 'source-over seam control has no rejected foreground');
        equal(pixel(after, x, y), pixel(originalJacketOverPants, x, y), label + ' original posed jacket over selected original trousers');
      }
      for (const [x, y] of f.exact_original_jacket_aa_points_xy || []) {
        equal(pixel(pants, x, y)[3], 0, 'top seam antialiasing control has no trouser contribution');
        equal(pixel(after, x, y), pixel(jacket, x, y), label + ' exact original jacket antialiasing');
      }
      for (const [x, y] of f.transparent_exterior_points_xy) {
        equal(pixel(pants, x, y)[3], 0, 'original trousers do not occupy true exterior control');
        equal(pixel(before, x, y)[3], 0, 'rejected silhouette exterior control');
        equal(pixel(after, x, y)[3], 0, label + ' preserves true exterior transparency');
      }
      for (const [x, y] of f.avatar_only_exposure_controls_xy) {
        equal(pixel(pants, x, y)[3], 0, 'skin-exposure control has no original trousers');
        equal(pixel(avatar, x, y)[3], 255, 'skin-exposure control identifies opaque original avatar');
        equal(pixel(before, x, y)[3], 0, 'previous fitted sleeve exterior at skin-exposure control');
        equal(pixel(after, x, y), pixel(before, x, y), label + ' excludes newly exposed avatar skin');
      }
    }
    const item = {label, selection: s, original_pants_sha256: binding.pants.sha256, original_order: binding.order.map(d => d.sha256), original_plan: binding.legacy ? 'legacy-array' : 'continuous-object', before_rgba_sha256: digest(before), after_rgba_sha256: digest(after), cuff_rgba_sha256: cuffDigest(after), ...count};
    records.push(item); console.log('CUFF_UNDERLAY_CASE=' + JSON.stringify(item));
    if (global.gc) global.gc();
    return item;
  }
  for (const mode of limited || allModes) await verify(selection('DS035', 'NO_TIE', mode), mode + '-continuous');
  if (!limited || limited.includes('S03')) {
    await verify(selection('DS035', 'T029', 'S03'), 'S03-literal194');
    const legacy = await verify(selection('DS003', 'NO_TIE', 'S03'), 'S03-legacy-source-order');
    equal(legacy.original_plan, 'legacy-array', 'legacy source-order regression uses the actual original legacy route');
    const continuous = records.find(r => r.label === 'S03-continuous');
    equal(continuous.original_plan, 'continuous-object', 'continuous source-order regression uses the actual original continuous route');
    ok(legacy.original_order.join('|') !== continuous.original_order.join('|'), 'legacy and continuous original lower orders really differ');
  }
  if (!limited) {
    const s = selection('DS035', 'NO_TIE', 'B03');
    const first = await verify(s, 'B03-pants-cache-original');
    const changed = await verify({...s, pantId: 'PBR001'}, 'B03-pants-cache-brown');
    const third = await verify({...s, pantId: 'PN001'}, 'B03-pants-cache-navy-eviction');
    const restored = await verify(s, 'B03-pants-cache-restored');
    equal(new Set([first.original_pants_sha256, changed.original_pants_sha256, third.original_pants_sha256]).size, 3, 'cache controls use three distinct original trouser sources across the two-patch cache');
    ok(first.pure_underlay_pixels > 0 && changed.pure_underlay_pixels > 0, 'cache colour assertion checks visible pure trouser underlay');
    equal(new Set([first.cuff_rgba_sha256, changed.cuff_rgba_sha256, third.cuff_rgba_sha256]).size, 3, 'same jacket follows all three original pants colours across cache eviction');
    equal(restored.after_rgba_sha256, first.after_rgba_sha256, 'restoring original pants restores the exact complete frame');
    for (const [shirt, state] of [['DS035', 'T001'], ['DS003', 'NO_TIE']]) {
      const only = selection(shirt, state, 'shirt-only');
      const before = await capture(rejectedRenderer, rejectedCanvas, diagnostic.storage, only);
      const after = await capture(current.renderer, current.canvas, current.storage, only);
      equal(digest(after), digest(before), 'shirt-only sleeves and complete frame are exact pass-through: ' + shirt + '/' + state);
      equal(current.canvas.dataset.avatarV3Cuffs, undefined, 'shirt-only bypasses cuff fitting');
    }
  }
  for (const [filename, hash] of sourceHashes) equal(digest(fs.readFileSync(filename)), hash, 'original PNG bytes remain unchanged');
  equal(current.storage.snapshot(), [], 'no owner/browser data loaded or written');
  console.log('ISSUE19_CUFF_UNDERLAY=' + JSON.stringify({status: limited ? 'PASS_LIMITED_DIAGNOSTIC_NOT_RELEASE_GATE' : 'PASS_INDEPENDENT_SOURCE_REGRESSION_NOT_VISUAL_APPROVAL', checks, runtime_sha256: current.metadata.runtime_sha256, baseline_runtime_sha256: approved.metadata.runtime_sha256, rejected_runtime_sha256: fixture.rejected_runtime_sha256, original_source_files: sourceHashes.size, source_scope_records: proof.length, jackets: limited ? limited.length : allModes.length, cases: records.length, regions, records}));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
