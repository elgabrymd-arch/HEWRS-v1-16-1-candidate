/* Independent AI Five orchestration. Native results and local records are
 * immutable inputs. Only wardrobe identity, occasion, coarse weather and the
 * actual twenty exclusion keys cross the service boundary. */
(function (root, factory) {
  'use strict';
  const policy = typeof module === 'object' && module.exports
    ? require('./ai-five-exclusion.js') : root.HEWRSAIFiveExclusion;
  const api = factory(policy);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HEWRSAIFiveFlow = api;
})(typeof globalThis === 'object' ? globalThis : null, function (P) {
  'use strict';
  const occasions = new Set(['work', 'dinner', 'weekend']);
  const insist = (ok, message) => { if (!ok) throw Error(message); };
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
      .map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze); Object.freeze(value);
    }
    return value;
  }
  function neutralRequest(q, baseOptions) {
    insist(q?.automatic === true && typeof q.source_lock === 'string' && q.source_lock,
      'A valid HEWRS automatic request is required');
    insist(occasions.has(q.context?.occasion), 'Unknown outfit occasion');
    insist(typeof q.localDate === 'string' && q.environment, 'Missing outfit date/weather context');
    P.assertDisjoint(baseOptions, []);
    const env = q.environment;
    return freeze({
      source_lock:q.source_lock,
      context:{occasion:q.context.occasion, requiredFormality:q.context.requiredFormality || 'any'},
      localDate:q.localDate,
      weather:{source:env.source, temperatureBand:env.temperatureBand || null,
        precipitation:env.precipitation || null, season:env.season || null},
      excluded_outfit_keys:baseOptions.map(P.garmentKey)
    });
  }
  function signature(snapshot) {
    const q = snapshot?.request, options = snapshot?.options;
    insist(q?.automatic === true && Array.isArray(options) && options.length === P.maxBase,
      'Generate all 20 native HEWRS outfits before requesting AI Five');
    insist(occasions.has(q.context?.occasion), 'Invalid occasion in native HEWRS list');
    P.assertDisjoint(options, []);
    // Watch changes do not create a different outfit, but still invalidate the
    // native snapshot. Record/control/generation tokens never leave this page.
    return stable({request:q, options, guards:snapshot.guards || null});
  }
  function create({read, service, validate, ownerAllows, rotationAllows} = {}) {
    for (const [name, fn] of Object.entries({read, validate, ownerAllows, rotationAllows}))
      insist(typeof fn === 'function', 'Missing AI Five dependency: ' + name);
    insist(service && typeof service.ready === 'function' && typeof service.propose === 'function',
      'Missing compatible AI Five generation service');
    async function generate(opts = {}) {
      insist(!opts.isCancelled?.(), 'AI Five generation was cancelled');
      const initial = freeze(structuredClone(read())), stamp = signature(initial), q = initial.request;
      const assertCurrent = () => {
        insist(!opts.isCancelled?.(), 'AI Five generation was cancelled');
        insist(signature(read()) === stamp,
          'Native outfits, controls, weather, wear or rejections changed during AI generation');
      };
      insist(service.ready() === true,
        'Independent AI generation service is not connected; no provider request was sent');
      const neutral = neutralRequest(q, initial.options);
      assertCurrent();
      const answer = await service.propose(neutral, opts);
      assertCurrent();
      insist(Array.isArray(answer?.proposals) && answer.proposals.length <= 40,
        'AI provider response must contain no more than 40 proposals');
      if (answer.source_lock !== undefined)
        insist(answer.source_lock === q.source_lock, 'The AI response uses a different wardrobe');
      const proposals = structuredClone(answer.proposals);
      const reasons = {wrong_occasion:0, invalid_wardrobe:0, rejected:0, rotation:0};
      const chosen = P.choose(initial.options, proposals, {limit:P.maxAI, eligible(candidate) {
        if (candidate?.occasion !== q.context.occasion) { reasons.wrong_occasion++; return false; }
        const selection = candidate.selection;
        try {
          if (validate(selection, q.context) !== true) { reasons.invalid_wardrobe++; return false; }
        } catch { reasons.invalid_wardrobe++; return false; }
        if (!ownerAllows(selection, q.context)) { reasons.rejected++; return false; }
        if (!rotationAllows(selection, q, initial)) { reasons.rotation++; return false; }
        return true;
      }});
      assertCurrent();
      for (const candidate of chosen.options) {
        insist(validate(candidate.selection, q.context) === true &&
          ownerAllows(candidate.selection, q.context) && rotationAllows(candidate.selection, q, initial),
        'AI wardrobe, rejection or rotation eligibility changed while preparing the five options');
      }
      assertCurrent();
      P.assertDisjoint(initial.options, chosen.options);
      const live = answer.provider?.live_call === true &&
        typeof answer.provider.response_id === 'string' && !!answer.provider.response_id;
      return freeze({
        status:chosen.options.length === P.maxAI ? 'complete' : 'partial',
        options:chosen.options, context:structuredClone(neutral.context),
        base_signature:stamp, diagnostics:{...chosen.diagnostics, ...reasons},
        provider_job_id:typeof answer.job_id === 'string' ? answer.job_id : null,
        provider:answer.provider ? structuredClone(answer.provider) : null,
        native_outfits_unchanged:true, live_ai_used:live, cached:answer.cached === true
      });
    }
    return Object.freeze({generate, neutralRequest, signature});
  }
  return Object.freeze({create, neutralRequest, signature});
});
