/* Read-only bridge from AI Five to existing wardrobe, wear and rejection APIs.
 * No local aesthetic evaluator, preference ranker, storage write or new
 * rotation policy is introduced here. History/feedback tokens stay in-page.
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HEWRSAIFiveNative = api;
})(typeof globalThis === 'object' ? globalThis : null, function (root) {
  'use strict';
  const copy = value => structuredClone(value);
  const need = (ok, message) => { if (!ok) throw Error(message); };
  // The AI Five brief supersedes these six remaining old B01/B11 styling instructions
  // only for independent AI choices. This does not alter the native gate or its
  // data. Explicit outfit rejections (including OWNER-REVIEW-10), saved hides,
  // historical Neither records, owner_core and temporary skips remain vetoes.
  // No wildcard exemption: an unknown future reason is still rejected.
  const supersededGarmentRules = new Set([
    'OWNER-B11-NO-TIE', 'OWNER-B11-FOOTWEAR',
    'OWNER-B01-NOT-WORK', 'OWNER-B01-SUMMER-CONTEXT',
    'OWNER-B01-TROUSERS', 'OWNER-B01-FOOTWEAR'
  ]);
  // The later owner-approved linen rule is a hard rendering restriction.
  // B01's old no-tie exemption is superseded, never extended to B06/B10.
  const noTieTopwear=new Set(['B01','B06','B10']);
  const noTieShirts=new Set(['DS040','DS041','DS042','DS043']);
  function hardAllows(selection,context) {
    if (!selection || selection.state==='REFERENCE') return false;
    if (selection.state!=='NO_TIE' &&
        (noTieTopwear.has(selection.blazerId)||noTieShirts.has(selection.shirtId))) return false;
    const current=root?.HEWRSIssue22Matching;
    return !current || current.tieRuleCheck(selection,{context}).allowed===true;
  }
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
  function fingerprint(snapshot) {
    return stable({request:snapshot?.request, options:snapshot?.options,
      guards:snapshot?.guards});
  }
  function create({app, feedback = app?.ownerFeedback, logic = root?.HEWRSLogic,
    rotationPolicy = root?.HEWRS_INPUTS?.logicData?.rotationPolicy,
    document:doc = root?.document, MutationObserver:Observer = root?.MutationObserver} = {}) {
    need(app?.state && app?.connection?.validateSelection && app?.connection?.historyIds,
      'The native wardrobe connection is unavailable');
    need(app?.store?.readForGeneration && app?.store?.assertCurrent,
      'The native wear-history store is unavailable');
    need(feedback?.refresh && feedback?.match && feedback?.assertCurrent,
      'The native rejection store is unavailable');
    need(logic?.selectRotation && rotationPolicy,
      'The existing HEWRS rotation policy is unavailable');
    // A list regenerated with identical items is still a different generation.
    // The native application writes this summary on generation/refill; observe
    // it without changing application state or its frozen runtime bundle.
    let generation = 0, observer = null;
    const summary = doc?.getElementById?.('outfit-summary');
    if (summary && typeof Observer === 'function') {
      observer = new Observer(records => { if (records.length) generation++; });
      observer.observe(summary, {childList:true, characterData:true, subtree:true});
    }
    function generationToken() {
      if (observer?.takeRecords().length) generation++;
      return generation;
    }
    function read() {
      const state = app.state();
      need(state?.busy !== true, 'The native outfit list is still changing');
      need(!app.feedbackReadError,'Saved rejections are unavailable; AI generation is paused');
      need(Array.isArray(state?.report?.options) && state.optionCount === state.report.options.length,
        'The displayed native outfit list is unavailable or inconsistent');
      need(state.request && state.context && typeof state.sourceLock === 'string',
        'The native request, active context or source lock is unavailable');
      need(state.sourceLock === state.request.source_lock, 'The wardrobe source changed; regenerate native outfits');
      if (typeof app.connection.controller?.verifyOptionSet === 'function')
        need(app.connection.controller.verifyOptionSet(state.report.options,state.request), 'Native option identities or constraints could not be verified');
      const context = state.context;
      need(context.occasion === state.request.context?.occasion &&
        context.formality === state.request.context?.requiredFormality &&
        context.localDate === state.request.localDate,
      'The native outfit list does not match the selected occasion, formality or date');
      need(context.style === state.request.executiveStyle &&
        stable(state.preferences) === stable(state.request.prefs),
      'The native outfit list does not match the current controls');
      const environment = app.weather?.request
        ? app.weather.request(context.localDate) : state.request.environment;
      need(stable(environment) === stable(state.request.environment),
        'The weather changed; regenerate native outfits');
      const history = app.store.readForGeneration(), rejection = feedback.refresh();
      need(history.token && typeof rejection.token === 'string',
        'The native wear or rejection snapshot is unavailable');
      return freeze(copy({
        options:state.report.options, request:state.request,
        guards:{context, preferences:state.preferences, environment,
          source_lock:state.sourceLock, mode:state.mode,
          stylist_mode:app.connection.hybrid?.mode?.() || state.request.stylist?.mode || null,
          native_generation:generationToken(),
          history_token:history.token, feedback_token:rejection.token}
      }));
    }
    function validate(selection, context) {
      try {
        if (!hardAllows(selection,context)) return false;
        app.connection.validateSelection(selection);
        const formality = context?.requiredFormality || 'any';
        if (!['any','tie_required','suit_required','open_collar_allowed'].includes(formality)) return false;
        if (formality === 'tie_required' && selection.state === 'NO_TIE') return false;
        if (formality === 'suit_required' && !selection.suitId) return false;
        return true;
      } catch { return false; }
    }
    function ownerAllows(selection, context) {
      if (!hardAllows(selection,context)) return false;
      feedback.refresh();
      const result = feedback.match(selection, context);
      if (!result || !Array.isArray(result.reasons)) return false;
      if (result.allowed === true) return result.reasons.length === 0;
      if (result.allowed !== false || result.reasons.length === 0) return false;
      return result.reasons.every(reason => reason?.type === 'owner_batch_rule' &&
        reason.scope === 'garment' && supersededGarmentRules.has(reason.id));
    }
    function rotationCheck(selection, request, snapshot) {
      need(validate(selection), 'Invalid owned-wardrobe selection for rotation');
      if (snapshot) app.store.assertCurrent(snapshot.guards.history_token);
      const history = app.store.readForGeneration();
      const ids = app.connection.historyIds(selection);
      const items = Object.fromEntries(Object.entries(ids).map(([role, id]) =>
        [role, id === null ? null : {id}]));
      // selectRotation accepts pre-qualified ensembles. This single-candidate
      // adapter supplies neutral internal gate placeholders, never a HEWRS
      // aesthetic judgement, grade or ordering. Its returned fake score is not
      // exposed. All wear eligibility and burden calculation remain native.
      const candidate = {id:'AI_FIVE_WEAR_CHECK', items,
        compatibility:{status:'computed', score:0, gate:'pass'},
        ensembleAudit:{status:'pass'}, context:{status:'eligible'},
        style:{authorityGate:'pass'}};
      const result = logic.selectRotation([candidate], history.events,
        {localDate:request?.localDate, policy:rotationPolicy});
      app.store.assertCurrent(history.token);
      return freeze(copy({allowed:result.status === 'selected' && !!result.selected,
        status:result.status, burden:result.burden ?? null,
        monthly_repetition_incidents:result.monthly_repetition_incidents ?? null,
        confirmed_wear_records_used:result.confirmed_wear_records_used ?? null,
        policy_source:result.policy_source || rotationPolicy.source,
        reason_codes:result.reason_codes || []}));
    }
    function rotationAllows(selection, request, snapshot) {
      return rotationCheck(selection, request, snapshot).allowed;
    }
    function assertCurrent(snapshot) {
      need(snapshot?.guards, 'An AI Five native snapshot is required');
      app.store.assertCurrent(snapshot.guards.history_token);
      feedback.assertCurrent(snapshot.guards.feedback_token);
      need(fingerprint(read()) === fingerprint(snapshot),
        'Native outfits, controls, weather, wear or rejections changed during AI Five');
      return true;
    }
    async function synchronize() {
      if (typeof feedback.sync==='function') await feedback.sync();
      return read();
    }
    async function withCurrent(snapshot,callback) {
      assertCurrent(snapshot);
      const publish=()=>{assertCurrent(snapshot);return callback();};
      return typeof feedback.withCurrent==='function'
        ? await feedback.withCurrent(snapshot.guards.feedback_token,publish) : publish();
    }
    const assertCurrentAsync=snapshot=>withCurrent(snapshot,()=>true);
    return Object.freeze({read, validate, ownerAllows, rotationAllows, rotationCheck,
      synchronize,withCurrent,assertCurrentAsync,assertCurrent, fingerprint, disconnect:() => observer?.disconnect()});
  }
  return Object.freeze({create, stable, fingerprint, revision:'ai-five-native-v2-v3-bound'});
});
