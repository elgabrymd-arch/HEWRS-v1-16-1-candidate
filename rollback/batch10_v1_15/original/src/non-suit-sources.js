/* V1.14: exact per-shirt non-suit source contracts. No new garment pixels.
 * The current component plans are NOT full-length garment assemblies.
 * Existing V1.13 rendering/scoring/history functions remain the implementation.
 */
(function (root) {
'use strict';
const prior = root.HEWRSCleanConnection;
const clone = value => structuredClone(value);
const need = (ok, message) => { if (!ok) throw Error(message); };
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function create(inputs) {
  const base = prior.create(inputs), registry = freeze(clone(root.HEWRS_NON_SUIT_SOURCES));
  need(registry?.schema === 'hewrs.non-suit-source-registry.v1_14', 'Missing non-suit source registry');
  need(registry.canvas.join(',') === '996,2748', 'Non-suit source geometry mismatch');
  need(registry.source_input_sha256 === root.HEWRS_INPUT_SHA256, 'Changed source input lock');
  need(registry.id_order.length === 50 && new Set(registry.id_order).size === 50, 'Incomplete exact shirt identities');
  const active = new Set(base.manifest.shirt_order);
  need(registry.id_order.every(id => active.has(id)) && !registry.shirts.DS049, 'Changed active shirt identity universe');
  for (const id of registry.id_order) {
    const r = registry.shirts[id], m = base.manifest.shirts[id];
    need(r?.id === id && r.history_id === base.records[id].history_id, 'Changed shirt/history identity: ' + id);
    need(r.compositing_profile === m.compositing_profile, 'Changed source compositor: ' + id);
    need(same(r.states, m.available_modes.filter(state => state !== 'REFERENCE')), 'Changed exact shirt states: ' + id);
    need(same(r.body_keep_for_selectable_ties, m.body_keep_for_selectable_ties || null), 'Changed body visibility mask: ' + id);
    for (const [mode, parts] of Object.entries(m.states)) {
      need(same(Object.keys(parts), Object.keys(r.components[mode] || {})), 'Changed component roles: ' + id);
      for (const [role, desc] of Object.entries(parts)) {
        const bound = r.components[mode][role];
        need(bound.sha256 === desc.sha256 && same(bound.rect, desc.rect) && bound.url === desc.url &&
          bound.runtime_path === base.assetPaths[desc.sha256], 'Unbound or replaced current component: ' + id + '/' + mode + '/' + role);
      }
    }
    const linked = r.modes.blazer.visual_available;
    need(linked === r.modes['shirt-only'].visual_available, 'Unsupported partial activation: ' + id);
    if (linked) {
      need(['DS001','DS014'].includes(id), 'A new full-shirt route requires an implemented renderer, not an allowlist edit');
      need(base.blazerConnection.data.available_shirts.includes(id) && base.shirtOnlyConnection.ids.includes(id), 'Missing V1.13 full-shirt route');
      for (const state of r.states) {
        const d = r.full_states?.[state];
        need(d?.sha256 === base.shirtOnlyConnection.data.shirts[id].layers[state].sha256 &&
          d.sha256 === (state === 'NO_TIE' ? base.blazerConnection.data.assembly.no_tie : base.blazerConnection.data.assembly.ties[state]).sha256,
          'Full-shirt source identity mismatch: ' + id + '/' + state);
      }
    } else {
      need(!r.full_states && !base.blazerConnection.data.available_shirts.includes(id) && !base.shirtOnlyConnection.ids.includes(id),
        'Source-only shirt was activated without full-body assembly: ' + id);
    }
  }
  function known(id) { need(Object.hasOwn(registry.shirts,id), 'Unknown exact active shirt ID: ' + id); return registry.shirts[id]; }
  function inspect(id, mode, state = null) {
    need(['blazer','shirt-only'].includes(mode), 'Unknown non-suit mode');
    const r = known(id), cap = r.modes[mode];
    const supportedState = state === null || r.states.includes(state);
    const reason = !supportedState ? 'STATE_NOT_SUPPORTED_FOR_EXACT_SHIRT' :
      cap.visual_available ? null : 'NON_SUIT_SOURCE_COVERAGE_UNBOUND';
    return clone({ shirt_id:id, history_id:r.history_id, mode, state, group_id:r.group_id,
      garment_approval:r.garment_approval, status:cap.status,
      visual_available:cap.visual_available && supportedState, supported_states:r.states,
      compositing_profile:r.compositing_profile, reason_code:reason,
      missing_components:cap.missing_components, component_body_bounds:r.upper_body_alpha_bounds,
      suit_routes:'UNCHANGED', shirt_only_numeric_ranking_installed:false });
  }
  function explain(cap) {
    if (cap.reason_code === 'STATE_NOT_SUPPORTED_FOR_EXACT_SHIRT')
      return cap.shirt_id + ': ' + cap.state + ' is unavailable; use an explicitly supported state. No tie was substituted.';
    return cap.shirt_id + ': ' + cap.mode + ' source connection is incomplete (' +
      cap.missing_components.join(', ') + '). Current suit visuals and garment approval are unchanged.';
  }
  function requireVisual(id, mode, state = null) {
    const cap = inspect(id,mode,state);
    if (!cap.visual_available) {
      const e = Error(explain(cap)); e.code = cap.reason_code; e.details = cap; throw e;
    }
    return cap;
  }
  // Exposes the correct reusable component set. It deliberately does not claim
  // that the currently supplied upper insert contains a lower torso or sleeves.
  function componentPlan(id, state) {
    const r=known(id); need(r.states.includes(state),'Unsupported component state for ' + id);
    const mode=state === 'NO_TIE' ? 'no_tie' : 'tied', c=r.components[mode];
    const body=clone(c.body);
    if(state !== 'NO_TIE' && r.body_keep_for_selectable_ties) body.display_alpha_mask=clone(r.body_keep_for_selectable_ties);
    const layers=[{role:'rear',descriptor:clone(c.rear)},{role:'body',descriptor:body}];
    if(state !== 'NO_TIE') layers.push({role:'tie',descriptor:clone(base.manifest.ties[state].display_layer)});
    for(const role of ['left','right','left_cuff','right_cuff']) layers.push({role,descriptor:clone(c[role])});
    return {operation:'CURRENT_COMPONENT_PLAN_NOT_FULL_GARMENT',shirt_id:id,state,group_id:r.group_id,
      compositing_profile:r.compositing_profile,layers,full_garment_available:r.modes.blazer.visual_available,
      implicit_substitution:false};
  }
  function selectionMode(s) { return s?.shirtOnly === true ? 'shirt-only' : s && Object.hasOwn(s,'blazerId') ? 'blazer' : null; }
  function validateSelection(s) {
    const mode=selectionMode(s); if(mode && s?.shirtId)requireVisual(s.shirtId,mode,s.state);
    return base.validateSelection(s);
  }
  function makeRequest(c) {
    const mode=selectionMode(c);
    if(mode && c?.shirt && !c.shirt.startsWith('FAMILY:') && c.shirt !== 'ANY')
      requireVisual(String(c.shirt).replace(/^shirt-/,''),mode,
        c.tie && !c.tie.startsWith('FAMILY:') && c.tie !== 'ANY' ? c.tie : null);
    return base.makeRequest(c);
  }
  const nonSuitSources=Object.freeze({registry,ids:Object.freeze([...registry.id_order]),
    groups:registry.groups,inspect,requireVisual,componentPlan,explain,
    connectedIds:Object.freeze(registry.id_order.filter(id => registry.shirts[id].modes.blazer.visual_available))});
  return Object.freeze({...base,validateSelection,makeRequest,nonSuitSources,implementationVersion:'1.14-source-routing'});
}
root.HEWRSConnectionV113=prior;
root.HEWRSCleanConnection=Object.freeze({create});
})(globalThis);
