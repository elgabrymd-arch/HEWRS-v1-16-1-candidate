'use strict';

// Test the owner-approved S06 correction through the shipped source loaders.
// The earlier DNA exists only in an isolated VM dependency; neither a source
// file nor the process-wide fs module is replaced to construct the control.
const A = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {load, memoryStorage, config, root} = require('./issue22-loader.cjs');

const BASE = 'f3c3a10151c9fb9d7868c50b52f9cf7f33cc02f9';
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const prior = file => JSON.parse(execFileSync('git', ['show', BASE + ':' + file], {
  cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
}));
const plain = value => JSON.parse(JSON.stringify(value));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const round = value => Math.round(value * 1e6) / 1e6;
const forbiddenColour = /\b(?:warm|brown|taupe|camel|beige|greige|mushroom)\b/i;

function withBaselineDna(dna) {
  const filename = path.join(root, 'tests/issue22-loader.cjs');
  const injected = 'globalThis.HEWRS_ISSUE22_GARMENT_DNA=' + JSON.stringify(dna) + ';\n';
  let reads = 0;
  const isolatedFs = Object.freeze({...fs, readFileSync(file, ...options) {
    if (typeof file === 'string' && path.resolve(file) === path.join(root, 'data/issue22-garment-dna.js')) {
      reads++;
      return options[0] === 'utf8' || options[0]?.encoding === 'utf8' ? injected : Buffer.from(injected);
    }
    return fs.readFileSync(file, ...options);
  }});
  const mod = {exports: {}};
  const sandbox = vm.createContext({
    module: mod, exports: mod.exports, __dirname: path.dirname(filename), __filename: filename,
    require: name => name === 'node:fs' ? isolatedFs : require(name),
    console, setTimeout, clearTimeout, URL, URLSearchParams, AbortController, performance
  });
  vm.runInContext(fs.readFileSync(filename, 'utf8'), sandbox, {filename});
  const result = mod.exports.load({index: false});
  A.equal(reads, 1, 'Control injects exactly one historical DNA dependency');
  A.deepEqual(plain(result.g.HEWRS_ISSUE22_GARMENT_DNA), dna);
  return result;
}

function assertNeutralProfile(profile, label) {
  A.equal(profile.primary.family, 'grey', label + ' gray family');
  A.equal(profile.primary.hue, null, label + ' neutral hue');
  A.equal(profile.primary.temperature, 'neutral', label + ' neutral temperature');
  A.equal(profile.primary.value, 2.4, label + ' approved value calibration preserved');
  A.doesNotMatch(profile.primary.wording, forbiddenColour, label + ' active color wording');
  A.equal(profile.pattern.family, 'grid', label + ' retains actual check geometry');
  A.equal(profile.pattern.scale, 1, label + ' fine pattern scale');
  A.equal(profile.pattern.contrast, 1.2, label + ' low pattern contrast');
  A.equal(profile.pattern.quiet, true, label + ' near-solid distance salience');
  for (const accent of profile.accents) {
    A.ok(['grey', 'charcoal', 'white', 'black'].includes(accent.family), label + ' neutral accent ' + accent.family);
    A.equal(accent.temperature, 'neutral', label + ' neutral accent temperature');
    A.doesNotMatch(accent.wording, forbiddenColour, label + ' accent wording');
  }
}

async function main() {
  const dna = read('data/issue22-garment-dna.json');
  const oldDna = prior('data/issue22-garment-dna.json');
  const index = read('data/issue22-option-index.json');
  const oldIndex = prior('data/issue22-option-index.json');
  const storage = memoryStorage();
  const current = load({storage});
  const {g, connection: c, run} = current;
  const baseline = withBaselineDna(oldDna);
  const realm = value => vm.runInContext('(' + JSON.stringify(value) + ')', g);
  const inputBytes = JSON.stringify(g.HEWRS_INPUTS);
  const s06 = dna.records.S06;

  A.notEqual(dna.revision, oldDna.revision, 'Correction must invalidate the prior source revision');
  A.deepEqual(plain(g.HEWRS_ISSUE22_GARMENT_DNA), dna, 'Browser DNA wrapper agrees with JSON');
  A.deepEqual(plain(g.HEWRS_OPTION_INDEX), index, 'Browser index wrapper agrees with JSON');
  A.equal(index.current_source_revision, g.HEWRSSourceCorrections.revision);
  A.equal(index.issue22.revision, dna.revision);
  A.equal(index.engine_files['data/issue22-garment-dna.json'], digest(fs.readFileSync(path.join(root, 'data/issue22-garment-dna.json'))));
  A.deepEqual(dna.scope, oldDna.scope);
  A.deepEqual(dna.linen_no_tie_ids, oldDna.linen_no_tie_ids);
  A.deepEqual(Object.keys(dna.records), Object.keys(oldDna.records));
  let preservedDnaRecords = 0;
  for (const id of Object.keys(oldDna.records)) {
    if (id === 'S06') continue;
    A.deepEqual(dna.records[id], oldDna.records[id], 'Unrelated DNA record ' + id);
    preservedDnaRecords++;
  }
  A.deepEqual(s06.historical_feature, oldDna.records.S06.historical_feature, 'S06 historical evidence stays exact');
  for (const field of ['description', 'primary_text', 'secondary_text']) {
    A.doesNotMatch(s06.fields[field], forbiddenColour, 'S06 effective ' + field);
  }
  A.match(s06.fields.pattern_text, /Glen|houndstooth/i);
  A.match(s06.fields.pattern_text, /near[- ]solid/i);
  A.equal(s06.interpretation.temperature, 'neutral');
  for (const key of ['value', 'saturation', 'pattern']) {
    A.deepEqual(s06.interpretation[key], oldDna.records.S06.interpretation[key], 'Unchanged S06 calibration ' + key);
  }
  A.equal(c.features.get('S06').issue22_revision, dna.revision);
  A.equal(c.features.get('S06').primary_text, s06.fields.primary_text);
  assertNeutralProfile(c.rawEngine.get('S06'), 'Raw compatibility engine');
  assertNeutralProfile(c.engine.get('S06'), 'Public compatibility engine');
  const heuristic = g.HEWRSOutfitPreference.create(c);
  const research = g.HEWRSResearchPreference.create(c);
  assertNeutralProfile(heuristic.profile('S06'), 'Heuristic preference');
  assertNeutralProfile(research.profile('S06'), 'Research preference');
  A.equal(baseline.connection.engine.get('S06').primary.temperature, 'warm-neutral', 'Pinned control retains the actual old interpretation');

  // Recompute every stored S06 tuple, including held/ineligible combinations.
  // Compare every unrelated group with the previous integration, not merely
  // with the older frozen index, so unrelated Issue 22 results cannot drift.
  A.equal(index.groups.length, oldIndex.groups.length);
  let s06Rows = 0, changedS06Rows = 0, preservedGroups = 0, preservedRows = 0;
  const cacheStatuses = {};
  for (let n = 0; n < index.groups.length; n++) {
    const group = index.groups[n], oldGroup = oldIndex.groups[n];
    A.equal(group.topwearId, oldGroup.topwearId);
    A.equal(group.pantProfileId, oldGroup.pantProfileId);
    if (group.topwearId !== 'S06') {
      A.equal(JSON.stringify(group), JSON.stringify(oldGroup), 'Exact unrelated index group ' + n);
      preservedGroups++;
      preservedRows += group.rows.length;
      continue;
    }
    A.equal(group.rows.length, oldGroup.rows.length);
    for (let j = 0; j < group.rows.length; j++) {
      const row = group.rows[j];
      const evaluated = c.engine.evaluate({
        topwearId: 'S06', shirtId: row[0], tieId: row[1] === 'NO_TIE' ? null : row[1],
        ...(group.pantProfileId ? {pantProfileId: group.pantProfileId} : {}),
        context: {occasion: 'clinic', requiredFormality: 'any'}, versionPolicy: 'strict'
      });
      A.deepEqual(row, [row[0], row[1], evaluated.score ?? null, evaluated.display_score ?? null,
        evaluated.candidate_eligible ? 1 : 0, evaluated.status], 'Fresh S06 cache row ' + j);
      A.deepEqual(row.slice(0, 2), oldGroup.rows[j].slice(0, 2), 'S06 combination identity preserved');
      if (JSON.stringify(row) !== JSON.stringify(oldGroup.rows[j])) changedS06Rows++;
      cacheStatuses[row[5]] = (cacheStatuses[row[5]] || 0) + 1;
      s06Rows++;
    }
  }
  A.ok(s06Rows > 0, 'Full S06 cache coverage is nonempty');
  A.ok(preservedGroups > 0);

  // The cache deliberately omits some prohibited shirt/tie combinations.
  // Exercise the full supported 50 x (47 ties + No Tie) source universe so
  // unchanged hard holds and exclusions are verified outside cached paths.
  const activeShirts = [...c.manifest.shirt_order].sort();
  const activeTies = Object.keys(c.manifest.ties).sort();
  const states = ['NO_TIE', ...activeTies];
  A.equal(activeShirts.length, 50, 'Active50 manifest remains authoritative');
  A.equal(new Set(activeShirts).size, 50);
  A.equal(activeTies.length, 47);
  A.deepEqual(activeShirts, plain(c.limits.shirt_ids).sort(), 'Supported connection agrees with Active50');
  A.deepEqual(activeShirts, plain(baseline.connection.manifest.shirt_order).sort(), 'No shirt identity added or retired');
  A.deepEqual(activeTies, Object.keys(baseline.connection.manifest.ties).sort(), 'No tie identity added or removed');
  const s06Cache = new Map();
  for (const group of index.groups.filter(group => group.topwearId === 'S06')) {
    for (const row of group.rows) {
      const key = row[0] + '|' + row[1];
      A.equal(s06Cache.has(key), false, 'S06 cache identity must be unique');
      s06Cache.set(key, row);
    }
  }
  A.deepEqual([...new Set([...s06Cache.keys()].map(key => key.split('|')[0]))].sort(), activeShirts);
  const fullUniverse = {
    activeShirts: activeShirts.length, tiedStates: activeTies.length, noTieStates: 1,
    evaluationsPerVersion: 0, cachedPaths: 0, uncachedPaths: 0,
    changedNumericResults: 0, changedStatuses: 0, changedEligibility: 0,
    currentStatuses: {}, uncachedStatuses: {}, uncachedReasonCodes: {}
  };
  for (const shirtId of activeShirts) {
    for (const state of states) {
      const request = {topwearId: 'S06', shirtId, tieId: state === 'NO_TIE' ? null : state,
        context: {occasion: 'clinic', requiredFormality: 'any'}, versionPolicy: 'strict'};
      const now = c.engine.evaluate(request), old = baseline.connection.engine.evaluate(request);
      A.deepEqual(plain(now.ids ?? null), plain(old.ids ?? null), 'Source outcome identity ' + shirtId + '/' + state);
      for (const result of [now, old]) {
        if (result.ids) {
          A.equal(result.ids.topwear, 'S06');
          A.equal(result.ids.shirt, shirtId);
          if (Object.hasOwn(result.ids, 'tie')) A.equal(result.ids.tie, request.tieId);
        }
      }
      if (JSON.stringify([now.score ?? null, now.display_score ?? null]) !== JSON.stringify([old.score ?? null, old.display_score ?? null])) fullUniverse.changedNumericResults++;
      if (now.status !== old.status) fullUniverse.changedStatuses++;
      if (!!now.candidate_eligible !== !!old.candidate_eligible) fullUniverse.changedEligibility++;
      fullUniverse.currentStatuses[now.status] = (fullUniverse.currentStatuses[now.status] || 0) + 1;
      const cached = s06Cache.get(shirtId + '|' + state);
      if (cached) {
        A.deepEqual(cached, [shirtId, state, now.score ?? null, now.display_score ?? null,
          now.candidate_eligible ? 1 : 0, now.status], 'Full-universe cache agreement ' + shirtId + '/' + state);
        fullUniverse.cachedPaths++;
      } else {
        fullUniverse.uncachedPaths++;
        fullUniverse.uncachedStatuses[now.status] = (fullUniverse.uncachedStatuses[now.status] || 0) + 1;
        for (const reason of now.reason_codes || []) fullUniverse.uncachedReasonCodes[reason] = (fullUniverse.uncachedReasonCodes[reason] || 0) + 1;
      }
      fullUniverse.evaluationsPerVersion++;
    }
  }
  A.equal(fullUniverse.evaluationsPerVersion, 2400);
  A.equal(fullUniverse.cachedPaths, s06Rows);
  A.equal(fullUniverse.uncachedPaths, fullUniverse.evaluationsPerVersion - s06Rows);

  // Exercise the actual source-bound review and discovery transitions.
  Object.assign(g, {TextEncoder, atob, btoa});
  run('feedback-candidate/reviewed/rebuild-core.js');
  run('data/issue22-reviewed-overlay.js');
  run('src/issue22-reviewed-data.js');
  const overlay = read('data/issue22-reviewed-overlay.json');
  A.deepEqual(plain(g.HEWRS_ISSUE22_REVIEWED_OVERLAY), overlay, 'Reviewed JS and JSON agree');
  A.equal(overlay.revision, dna.revision);
  const reviewed = await g.HEWRSIssue22Reviewed.reviewData(realm(read('feedback-candidate/reviewed/review-data.json')));
  const discovery = await g.HEWRSIssue22Reviewed.discoveryFeatures(realm(read('feedback-candidate/reviewed/discovery-features.json')));
  const reviewedS06 = reviewed.catalogue.records.find(record => record.id === 'S06');
  const discoveredS06 = discovery.records.find(record => record.id === 'S06');
  A.equal(reviewedS06.visual_dna.observed.colour.temperature, 'neutral');
  A.equal(reviewedS06.source.feature.issue22_interpretation.temperature, 'neutral');
  A.doesNotMatch(reviewedS06.visual_dna.observed.colour.dominant, forbiddenColour);
  A.match(reviewedS06.visual_dna.observed.pattern.distance_reading, /near[- ]solid/i);
  A.equal(reviewedS06.visual_dna.observed.pattern.relative_contrast, 'low');
  A.equal(discoveredS06.source_fingerprint, reviewedS06.source_fingerprint);
  A.equal(discoveredS06.issue22_revision, dna.revision);
  A.deepEqual(plain(discoveredS06.dominant_families), ['grey']);
  A.doesNotMatch(discoveredS06.dominant_text, forbiddenColour);
  A.equal(discoveredS06.pattern_family, 'check');
  A.equal(discoveredS06.pattern_quiet, true);
  A.equal(discoveredS06.pattern_scale, 0.2);
  A.equal(discoveredS06.pattern_contrast, 0.24);

  // Real registered accessories, identical clothing, and the previous DNA.
  // Research footwear uses family/value rather than temperature; therefore
  // unchanged research shoe scores are correct, not failed propagation.
  const models = [
    {name: 'heuristic', now: heuristic, old: baseline.g.HEWRSOutfitPreference.create(baseline.connection)},
    {name: 'research', now: research, old: baseline.g.HEWRSResearchPreference.create(baseline.connection)}
  ];
  const shoes = c.catalogue.shoes.filter(item => !item.disabled && Object.hasOwn(c.shoeLayers, item.id)).sort((a, b) => a.id.localeCompare(b.id));
  const watches = c.catalogue.watches.filter(item => !item.disabled && !/reserved|placeholder|unresolved|current collection/i.test((item.name || '') + ' ' + (item.color || ''))).sort((a, b) => a.id.localeCompare(b.id));
  A.ok(shoes.length > 0 && watches.length > 0);
  const accessoryResults = [];
  const q = {executiveStyle: 'AUTO', context: {occasion: 'work', requiredFormality: 'any'}};
  for (const model of models) {
    let checkedShoes = 0, changedShoes = 0, checkedWatches = 0, changedWatches = 0;
    const shoeDeltas = new Set(), watchDeltas = new Set();
    let shoeExample = null, watchExample = null, unchangedShoeExample = null;
    for (const state of ['NO_TIE', 'T022']) {
      const request = {topwearId: 'S06', shirtId: 'DS001', tieId: state === 'NO_TIE' ? null : state, context: q.context, versionPolicy: 'strict'};
      const nowScore = c.engine.evaluate(request), oldScore = baseline.connection.engine.evaluate(request);
      A.ok(Number.isFinite(nowScore.score) && Number.isFinite(oldScore.score), 'Accessory comparison has real clothing scores');
      const nowClothes = model.now.clothing('S06', 'DS001', state, null, nowScore.score, q);
      const oldClothes = model.old.clothing('S06', 'DS001', state, null, oldScore.score, q);
      assertNeutralProfile(nowClothes.profiles.topwear, model.name + ' complete-clothing profile');
      for (const item of shoes) {
        const now = plain(model.now.shoe(item, nowClothes, q)), old = plain(model.old.shoe(item, oldClothes, q));
        checkedShoes++;
        const delta = round(now.score - old.score);
        if (delta !== 0) {
          changedShoes++; shoeDeltas.add(delta);
          A.equal(model.name, 'heuristic', 'Research footwear should not change from temperature alone');
          A.ok(['brown', 'burgundy'].includes(now.colour.family));
          A.equal(old.grounding, 9.35); A.equal(now.grounding, 9.05);
          A.equal(delta, -0.105);
          shoeExample ??= {id: item.id, state, before: old.score, after: now.score, delta};
        } else {
          A.deepEqual(now, old, 'Unchanged shoe assessment ' + model.name + '/' + state + '/' + item.id);
          unchangedShoeExample ??= {id: item.id, state, score: now.score};
        }
      }
      for (const item of watches) {
        const now = plain(model.now.watch(item, nowClothes, q)), old = plain(model.old.watch(item, oldClothes, q));
        checkedWatches++;
        const delta = round(now.score - old.score);
        if (g.HEWRSLegacyAccessories.metal(item) === 'gold') {
          A.equal(old.coherence, 9); A.equal(now.coherence, 8.4); A.equal(delta, -0.12);
          changedWatches++; watchDeltas.add(delta);
          watchExample ??= {id: item.id, state, before: old.score, after: now.score, delta};
        } else A.deepEqual(now, old, 'Unchanged watch assessment ' + model.name + '/' + state + '/' + item.id);
      }
      A.deepEqual(plain(model.now.watch(null, nowClothes, q)), plain(model.old.watch(null, oldClothes, q)), 'Intentional no-watch score unchanged');
    }
    if (model.name === 'heuristic') A.ok(changedShoes > 0, 'Real wardrobe verifies warm-shoe bonus removal');
    else A.equal(changedShoes, 0);
    A.ok(changedWatches > 0, 'Real wardrobe verifies gold-watch warmth correction');
    accessoryResults.push({model: model.name,clothingCases: 2, registeredShoes: shoes.length,
      checkedShoes, changedShoes, shoeScoreDeltas: [...shoeDeltas].sort(), shoeExample, unchangedShoeExample,
      identifiedWatches: watches.length, checkedWatches, changedWatches, watchScoreDeltas: [...watchDeltas].sort(), watchExample});
  }

  // Actual generator coverage; exact selections must not be silently relaxed.
  // Classic + explicit No Tie is intentionally incompatible under the retained
  // classifier. Other combinations may legitimately return fewer than 20.
  const generation = [];
  let verifiedOptions = 0;
  for (const style of ['AUTO', 'CLASSIC', 'HYBRID', 'MODERN']) {
    for (const occasion of ['work', 'dinner', 'weekend']) {
      for (const tie of [{mode: 'any'}, {mode: 'none'}, {mode: 'item', id: 'T022'}]) {
        const request = c.makeRequest(realm(config(occasion, style, {
          topwear: {mode: 'item', id: c.aliases.get('S06')}, tie, watch: {mode: 'none'}
        })));
        const result = c.controller.generate(request, c.catalogue, []);
        A.equal(c.controller.verifyOptionSet(result.options, request), true, style + '/' + occasion + '/' + tie.mode);
        if (style === 'CLASSIC' && tie.mode === 'none') {
          A.equal(result.options.length, 0, 'Classic does not substitute a tie for explicit No Tie');
          A.match(result.reason || '', /Classic|classification/i);
        } else A.ok(result.options.length > 0, 'Supported S06 request returns outfits: ' + style + '/' + occasion + '/' + tie.mode);
        let tied = 0, noTie = 0;
        for (const option of result.options) {
          const selection = c.selectionFromOption(option, request).selection;
          A.equal(selection.suitId, 'S06');
          A.equal(selection.watchId, null);
          if (tie.mode === 'none') A.equal(selection.state, 'NO_TIE');
          if (tie.mode === 'item') A.equal(selection.state, tie.id);
          A.equal(g.HEWRSOutfitFeedback.ownerRuleCheck(selection, {context: request.context}).allowed, true);
          if (selection.state === 'NO_TIE') noTie++; else tied++;
          verifiedOptions++;
        }
        generation.push({style, occasion, tie: tie.mode === 'item' ? tie.id : tie.mode, returned: result.options.length, tied, noTie});
      }
    }
  }
  A.equal(JSON.stringify(g.HEWRS_INPUTS), inputBytes, 'All checks leave source inputs unchanged');
  A.equal(storage.length, 0, 'Validation writes no saved preferences, history or approvals');
  A.equal(baseline.storage.length, 0, 'Isolated control writes no saved data');
  console.log('S06_NEUTRAL_DNA=' + JSON.stringify({
    schema: 'hewrs.s06-neutral-dna-verification.v1', status: 'PASS', baselineCommit: BASE,
    revision: dna.revision, preservedDnaRecords, preservedIndexGroups: preservedGroups,
    preservedIndexRows: preservedRows, allS06CacheRowsReevaluated: s06Rows, changedS06CacheRows: changedS06Rows,
    cacheStatuses, fullUniverse, neutralSemanticPaths: ['effective-feature', 'raw-engine', 'public-engine', 'heuristic-preference', 'research-preference', 'reviewed-catalogue', 'discovery-features'],
    accessoryResults, generationCases: generation.length, verifiedOptions, generation,
    historicalS06Preserved: true, savedDataWrites: 0,
    limitation: 'Numerical and source-contract validation; no new visual approval or physical colour measurement is claimed.'
  }));
}

main().catch(error => {console.error(error); process.exitCode = 1;});
