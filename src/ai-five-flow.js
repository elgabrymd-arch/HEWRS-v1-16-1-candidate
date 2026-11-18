/* Isolated AI Five orchestration. The actual native HEWRS 20 are immutable inputs.
 * The AI gets occasion/formality/weather and the inventory source lock, but no
 * CLASSIC/MODERN ranking, owner styling preferences, or past model scores.
 * Every AI proposal is checked against native options, actual renderable IDs,
 * owner rejections and confirmed-wear rotation before acceptance.
 * No provider calls are made without a separately connected secure session.
 */
(function (root, factory) {
  'use strict';
  const exclusion = typeof module === 'object' && module.exports
    ? require('./ai-five-exclusion.js') : root.HEWRSAIFiveExclusion;
  const api = factory(exclusion);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HEWRSAIFiveFlow = api;
})(typeof globalThis === 'object' ? globalThis : null, function (P) {
  'use strict';
  const roles = ['topwear','shirt','tie','shoes','bottoms','watch'];
  const occasions = new Set(['work','dinner','weekend']);
  function insist(condition, message) { if (!condition) throw Error(message); }
  function neutralRequest(q) {
    insist(q?.automatic === true && typeof q.source_lock === 'string' && !!q.source_lock, 'A valid HEWRS automatic request is required');
    insist(occasions.has(q.context?.occasion), 'Unknown outfit occasion');
    insist(typeof q.localDate === 'string' && q.environment, 'Missing outfit date/weather context');
    return {
      source_lock:q.source_lock,
      prefs:Object.fromEntries(roles.map(k=>[k,{mode:'any'}])),
      context:{occasion:q.context.occasion,requiredFormality:q.context.requiredFormality||'any'},
      executiveStyle:'AUTO',localDate:q.localDate,
      environment:structuredClone(q.environment)
    };
  }
  function signature(s) {
    const q = s?.request, opts=s?.options;
    insist(q?.automatic === true && Array.isArray(opts) && opts.length === P.maxBase,
      'Generate all 20 native HEWRS outfits before requesting AI Five');
    insist(occasions.has(q.context?.occasion), 'Invalid occasion in native HEWRS list');
    P.assertDisjoint(opts, []);
    return JSON.stringify({source_lock:q.source_lock, context:q.context,
      style:q.executiveStyle, prefs:q.prefs, date:q.localDate,
      options:opts.map(x=>P.garmentKey(x))});
  }
  function create({read, service, validate, ownerAllows, rotationAllows} = {}) {
    for (const [name,fn] of Object.entries({read,validate,ownerAllows,rotationAllows}))
      insist(typeof fn==='function', 'Missing AI Five safety dependency: '+name);
    insist(service && typeof service.ready==='function' && typeof service.propose==='function', 'Missing secure proposal service');
    async function generate(opts={}) {
      const initial=read(), stamp=signature(initial), q=initial.request;
      insist(service.ready() === true, 'Independent AI proposal service is not connected; no provider request was sent');
      const neutral=neutralRequest(q), answer=await service.propose(neutral, opts);
      insist(!opts.isCancelled?.(), 'AI Five generation was cancelled');
      insist(signature(read()) === stamp, 'Native 20 outfits or occasion changed during AI generation');
      insist(Array.isArray(answer?.proposals) && answer.proposals.length<=40,
        'AI provider response must contain no more than 40 proposals');
      const reasons={wrong_occasion:0, invalid_wardrobe:0, rejected:0, rotation:0};
      const chosen=P.choose(initial.options,answer.proposals,{limit:P.maxAI,eligible(candidate){
        if (candidate?.occasion !== q.context.occasion) {reasons.wrong_occasion++;return false;}
        const s=candidate.selection;
        try { if (validate(s,q.context)!==true) {reasons.invalid_wardrobe++;return false;} }
        catch { reasons.invalid_wardrobe++;return false; }
        if (!ownerAllows(s,q.context)) {reasons.rejected++;return false; }
        if (!rotationAllows(s,q)) {reasons.rotation++;return false; }
        return true;
      }});
      insist(signature(read()) === stamp && !opts.isCancelled?.(), 'Native outfits changed before AI Five was committed');
      // The gates may change while awaiting the remote service. Recheck them at
      // commit time, including owner feedback imported in another browser tab.
      for (const candidate of chosen.options) {
        insist(validate(candidate.selection,q.context)===true &&
          ownerAllows(candidate.selection,q.context) && rotationAllows(candidate.selection,q),
          'AI wardrobe/feedback/rotation changed while preparing the five options');
      }
      P.assertDisjoint(initial.options,chosen.options);
      return Object.freeze({
        status:chosen.options.length===P.maxAI?'complete':'partial',
        options:chosen.options,
        context:structuredClone(neutral.context),
        base_signature:stamp,
        diagnostics:{...chosen.diagnostics,...reasons},
        provider_job_id:typeof answer.job_id==='string'?answer.job_id:null,
        native_outfits_unchanged:true,
        live_ai_used:true
      });
    }
    return Object.freeze({generate,neutralRequest,signature});
  }
  return Object.freeze({create,neutralRequest,signature});
});