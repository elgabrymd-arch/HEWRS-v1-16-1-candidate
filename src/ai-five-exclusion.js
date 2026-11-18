/* HEWRS AI Five: deterministic wardrobe-only overlap guard.
 * Compares the actual existing option list with proposed AI looks.
 * A different watch is NOT a different outfit. No state or provider calls.
 */
(function (root, factory) {
  'use strict';
  const policy = factory();
  if (typeof module === 'object' && module.exports) module.exports = policy;
  if (root) root.HEWRSAIFiveExclusion = policy;
})(typeof globalThis === 'object' ? globalThis : null, function () {
  'use strict';
  const MAX_BASE = 20;
  const MAX_AI = 5;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function selection(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('Invalid outfit record');
    const s = item._hewrsConnected ? item._hewrsConnected.canonical_selection : (own(item, 'selection') ? item.selection : item);
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw Error('Missing canonical wardrobe selection');
    return s;
  }
  function garmentKey(item) {
    const s = selection(item);
    const top = s.suitId || s.blazerId || (s.shirtOnly ? 'SHIRT_ONLY' : null);
    const pants = s.suitId ? 'SUIT_TROUSERS' : s.pantId;
    const tie = s.state;
    const ids = [top, pants, s.shirtId, tie, s.shoeId];
    if (ids.some(x => typeof x !== 'string' || !x.length)) throw Error('Incomplete wardrobe ID; outfit excluded');
    if (!!s.suitId && !!s.blazerId) throw Error('Suit and blazer cannot both be selected');
    return JSON.stringify(ids);
  }
  function baseKeys(actualBaseOptions) {
    if (!Array.isArray(actualBaseOptions) || actualBaseOptions.length < 1 || actualBaseOptions.length > MAX_BASE) {
      throw Error('Actual current HEWRS options required; no inferred or stale baseline');
    }
    const seen = new Set();
    for (const entry of actualBaseOptions) {
      const key = garmentKey(entry);
      if (seen.has(key)) throw Error('Existing HEWRS baseline contains duplicate clothing');
      seen.add(key);
    }
    return seen;
  }
  function choose(actualBaseOptions, aiProposals, options = {}) {
    const existing = baseKeys(actualBaseOptions);
    if (!Array.isArray(aiProposals)) throw Error('AI proposals must be an array');
    const limit = options.limit === undefined ? MAX_AI : options.limit;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_AI) throw Error('AI list is capped at five');
    const eligible = options.eligible || (() => true);
    if (typeof eligible !== 'function') throw Error('Invalid outfit eligibility gate');
    const selected = [], seen = new Set(), reasonCounts = {overlap_with_hewrs:0, duplicate_ai_look:0, ineligible:0, invalid_identity:0};
    for (const candidate of aiProposals) {
      if (selected.length === limit) break;
      let key;
      try { key = garmentKey(candidate); } catch (_) { reasonCounts.invalid_identity++; continue; }
      if (existing.has(key)) { reasonCounts.overlap_with_hewrs++; continue; }
      if (seen.has(key)) { reasonCounts.duplicate_ai_look++; continue; }
      if (!eligible(candidate)) { reasonCounts.ineligible++; continue; }
      seen.add(key);
      selected.push(candidate);
    }
    return {options:selected, diagnostics:{base_count:existing.size, ai_count:selected.length, ai_target:limit, ...reasonCounts}};
  }
  function assertDisjoint(actualBaseOptions, aiOptions) {
    const existing = baseKeys(actualBaseOptions), keys = new Set();
    if (!Array.isArray(aiOptions) || aiOptions.length > MAX_AI) throw Error('Invalid AI Five size');
    for (const entry of aiOptions) {
      const key = garmentKey(entry);
      if (existing.has(key)) throw Error('AI option duplicates an existing HEWRS outfit, including watch-only variants');
      if (keys.has(key)) throw Error('AI Five contains repeated clothing');
      keys.add(key);
    }
    return true;
  }
  return Object.freeze({garmentKey, choose, assertDisjoint, maxAI:MAX_AI, maxBase:MAX_BASE});
});
