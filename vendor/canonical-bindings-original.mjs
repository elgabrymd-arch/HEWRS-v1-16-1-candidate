/** HEWRS clean candidate-to-source binding adapter, v1.
 * NEW implementation, not recovered Runtime08 and not a production renderer.
 * Does not score, draw, save, remap source IDs, migrate history or touch assets.
 * Canonical labels and asset references never come from an old item.name.
 */
const clone = x => structuredClone(x);
function freeze(x) { if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.values(x).forEach(freeze); Object.freeze(x); } return x; }
function requireValue(ok, message) { if (!ok) throw new Error(message); }
export function createCanonicalBindings({featureInputs, sourceBindings, active50Manifest, suitAliases, validateCandidate}) {
  requireValue(typeof validateCandidate === 'function', 'Live candidate validator required');
  const features = clone(featureInputs), bindings = clone(sourceBindings), m = clone(active50Manifest);
  requireValue(bindings.schema === 'hewrs.source.bindings.v1', 'Unexpected source-binding schema');
  requireValue(m.schema === 'hewrs.active50.s05.staging.v1', 'Unexpected Active-50 schema');
  const byId = new Map(), assets = new Map(), aliases = new Map();
  for (const r of features.records || []) {
    requireValue(typeof r.id === 'string' && !byId.has(r.id), 'Missing or duplicate feature ID'); byId.set(r.id, freeze(r));
  }
  for (const b of bindings.items || []) {
    requireValue(b.item_key === `${b.category}:${b.item_id}` && !assets.has(b.item_key), 'Bad or duplicate source key'); assets.set(b.item_key, freeze(b));
  }
  for (const row of suitAliases || []) {
    requireValue(typeof row.app_id === 'string' && typeof row.source_id === 'string' && !aliases.has(row.app_id), 'Missing or duplicate explicit suit alias');
    requireValue(assets.has(`suits:${row.source_id}`), 'Suit alias has no canonical source binding'); aliases.set(row.app_id,row.source_id);
  }
  function item(category, id) {
    const binding = assets.get(`${category}:${id}`);
    requireValue(binding, `No source binding for exact ${category}:${id}; no substitution`);
    let label = id, labelSource = 'exact canonical ID (no unsupported description supplied)';
    if (category === 'shirts') {
      requireValue(Object.hasOwn(m.shirts,id), 'Missing later shirt record');
      label = m.shirts[id].label; labelSource = 'Active50 LAYER_MANIFEST.json shirts.'+id+'.label';
    } else if (category === 'blazers' && binding.historical_cp98_metadata?.owner_correction) {
      label = binding.historical_cp98_metadata.owner_correction; labelSource = 'Checkpoint98 preserved explicit blazer owner correction';
    } else if (byId.has(id)) {
      label = byId.get(id).description; labelSource = 'Step4 FEATURE_INPUTS.json '+id+' (version-pinned, not a claim of complete later DNA recovery)';
    }
    return freeze({canonical_id:id,category,display_label:label,label_source:labelSource,source:clone(binding)});
  }
  function stateRequest(suitId, shirtId, state) {
    requireValue(suitId === 'S05', 'This combined source renderer is S05-only; other suit sources are separate');
    const b = item('shirts',shirtId).source;
    requireValue(b.available_modes.includes(state), 'Unsupported collar/tie state; no fallback');
    requireValue(state === 'NO_TIE' || Object.hasOwn(m.ties,state) || (state === 'REFERENCE' && shirtId === 'DS035'), 'Unknown state');
    if (m.shirts[shirtId].mode_policy === 'NO_TIE_ONLY') requireValue(state === 'NO_TIE', 'No-tie-only shirt cannot accept a tie');
    return freeze({suitId,shirtId,state});
  }
  function bindCandidate(option, request, catalogue) {
    requireValue(validateCandidate(option,request,catalogue) === true, 'Candidate does not match the current request/catalogue');
    const ids = option?._hewrsConnected?.compatibility?.ids;
    requireValue(ids && typeof ids.topwear === 'string' && typeof ids.shirt === 'string' && Object.hasOwn(ids,'tie'), 'Canonical result identity missing');
    // Explicit checked crosswalk, never an arithmetic suit index.
    const isSuit = option.items.topwear.formal === true;
    requireValue(isSuit, 'This candidate bridge has no approved legacy blazer-alias crosswalk; use canonical blazer bindings separately');
    requireValue(aliases.get(option.items.topwear.id) === ids.topwear, 'Legacy/canonical suit binding disagreement');
    requireValue(option.items.shirt.id === 'shirt-'+ids.shirt, 'Shirt identity disagreement');
    requireValue((option.items.tie?.id ?? null) === ids.tie, 'Tie identity disagreement');
    const topwear = item('suits',ids.topwear),shirt = item('shirts',ids.shirt),tie = ids.tie===null ? null:item('ties',ids.tie);
    const accessories = {shoes:option.items.shoes?.id??null,watch:option.items.watch?.id??null};
    // Surface the honest renderer scope. A chosen watch or a different shoe is
    // preserved in selection metadata, never claimed visible in the S05 module.
    const renderRequest = ids.topwear === 'S05' ? stateRequest('S05',ids.shirt,ids.tie===null?'NO_TIE':ids.tie) : null;
    const representation = {combined_render_available:!!renderRequest,
      combined_render_scope:renderRequest?'S05 clothing with fixed shoe-8; no watch layer':'No combined cross-suit renderer bound by this adapter',
      selected_accessories:accessories,displayed_by_active50:renderRequest?{shoes:'shoe-8',watch:null}:null,
      complete_selected_outfit_render_supported:!!renderRequest&&accessories.shoes==='shoe-8'&&accessories.watch===null};
    return freeze({schema:'hewrs.canonical.candidate_binding.v1',topwear,shirt,tie,render_request:renderRequest,representation,
      compatibility:clone(option._hewrsConnected.compatibility),
      history_identity:{topwear:option.items.topwear.id,shirt:option.items.shirt.id,tie:ids.tie,...accessories},
      source_mutation:false,score_recalculation:false});
  }
  return Object.freeze({item,stateRequest,bindCandidate});
}
