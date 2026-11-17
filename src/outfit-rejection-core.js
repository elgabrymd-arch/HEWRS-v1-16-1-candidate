/* Additive review bridge installed BEFORE the unchanged runtime.
 * The existing owner-feedback store remains the only persistent rejection log.
 * Temporary skips are session memory, never silently promoted to permanent bans.
 * Visible renders commit only after the same veto is rechecked atomically.
 */
(function (root) {
  'use strict';
  if (root.HEWRSRejectionPreviewCore) return;
  const clone = x => structuredClone(x);
  const need = (v, m) => { if (!v) throw Error(m); };
  // The preview CDN redirects binary assets to raw.githubusercontent.com.
  // Native renderer images must request anonymous CORS BEFORE their src is set;
  // otherwise the successfully loaded image taints every downstream canvas.
  // This changes transport only. Native prototypes, dimensions, URLs, original
  // image bytes, renderer arithmetic and all accepted source files are retained.
  const NativeImage = root.Image;
  root.Image = new Proxy(NativeImage, {
    construct(target, args, newTarget) {
      const image = Reflect.construct(target, args, newTarget);
      image.crossOrigin = 'anonymous';
      return image;
    }
  });
  let gate = null, app = null, pool = null;
  const temporary = new Map(), listeners = new Set();
  let revision = 0;
  const api = () => root.HEWRSOutfitFeedback;
  const uid = () => root.crypto?.randomUUID?.() || Array.from(root.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  function notify() { for (const fn of listeners) { try { fn(); } catch (_) {} } }
  function viewContext(canvas) {
    if (canvas.id === 'rd-canvas' && root.HEWRSReviewedIntegration) return root.HEWRSReviewedIntegration.ownerContext();
    const state = app?.state();
    return state ? {...state.context, requiredFormality:state.context.formality} : {occasion:'work'};
  }
  function assertVisible(selection, canvas) {
    need(gate, 'The shared outfit feedback record is not ready.');
    const snapshot = gate.refresh();
    need(selection.state === 'REFERENCE' || gate.match(selection, viewContext(canvas)).allowed, 'This outfit was rejected. Undo its rejection or choose another combination.');
    return snapshot.token;
  }
  function wrapRenderer(namespace) {
    if (!namespace?.create) return namespace;
    return Object.freeze({...namespace, create(visible, connection, options) {
      if (!['avatar', 'rd-canvas'].includes(visible?.id)) return namespace.create(visible, connection, options);
      const off = document.createElement('canvas'); off.width = 996; off.height = 2748;
      const original = namespace.create(off, connection, options);
      visible.width = off.width; visible.height = off.height;
      let epoch = 0, last = null;
      return Object.freeze({...original,
        async render(selection) {
          const turn = ++epoch, token = assertVisible(selection, visible);
          visible.dataset.loading = 'true';
          try {
            const result = await original.render(selection);
            if (turn !== epoch || result?.cancelled) return {cancelled:true};
            gate.assertCurrent(token);
            assertVisible(selection, visible);
            const pixels = off.getContext('2d', {willReadFrequently:true}).getImageData(0, 0, off.width, off.height);
            visible.getContext('2d', {willReadFrequently:true}).putImageData(pixels, 0, 0);
            for (const key of Object.keys(visible.dataset)) delete visible.dataset[key];
            Object.assign(visible.dataset, off.dataset, {loading:'false'});
            last = clone(selection); return result;
          } finally { if (turn === epoch) visible.dataset.loading = 'false'; }
        },
        cancel() { epoch++; original.cancel(); visible.dataset.loading = 'false'; },
        last:() => last && clone(last)
      });
    }});
  }
  function wrapConnection(namespace) {
    if (!namespace?.create) return namespace;
    return Object.freeze({...namespace, create(...args) {
      const connection = namespace.create(...args);
      if (!connection.ownerFeedback || !connection.controller) return connection;
      const controller = connection.controller;
      function remember(result, request, history) {
        if (result?.status !== 'cancelled' && Array.isArray(result?.options)) {
          const state = root.HEWRSApp?.state();
          pool = {result, request:clone(request), history:clone(history),
            preferences:state && clone(state.preferences), context:state && clone(state.context), learningToken:root.HEWRSApp?.learning?.model(request.context)?.token ?? null};
        }
        return result;
      }
      return Object.freeze({...connection, controller:Object.freeze({...controller,
        generate:(q, c, h) => remember(controller.generate(q, c, h), q, h),
        generateAsync:async(q, c, h, o) => remember(await controller.generateAsync(q, c, h, o), q, h)
      })});
    }});
  }
  function intercept(name, wrapper) {
    let value = root[name];
    if (value) value = wrapper(value);
    Object.defineProperty(root, name, {configurable:true, enumerable:true,
      get:() => value, set:next => { value = wrapper(next); }});
  }
  intercept('HEWRSAtomicRenderer', wrapRenderer);
  intercept('HEWRSCleanConnection', wrapConnection);
  function attach(application) {
    if (gate) return gate;
    app = application;
    const base = app.ownerFeedback;
    need(base?.hide && base?.match && base?.importData, 'The existing owner feedback store is unavailable.');
    const F = api();
    function snapshot() {
      const s = base.refresh();
      return {...s, token:s.token + '\nreview-skips:' + revision,
        temporary:[...temporary.values()].map(clone)};
    }
    function match(s, context) {
      const result = base.match(s, context), occasion = F.occasion(typeof context === 'string' ? context : context?.occasion);
      const reasons = [...result.reasons];
      for (const event of temporary.values()) {
        if ((event.occasion === 'all' || event.occasion === occasion) && F.key(event.selection, event.scope) === F.key(s, event.scope)) reasons.push({id:event.id, type:'temporary_skip', scope:event.scope, occasion:event.occasion, reason:event.reason});
      }
      return {...result, allowed:reasons.length === 0, reasons};
    }
    function choices(options = {}) {
      const scope = options.scope || 'outfit';
      need(['outfit', 'clothing'].includes(scope), 'Choose an outfit or clothing combination, never a garment ban.');
      const occasion = F.occasion(typeof options.context === 'object' ? options.context.occasion : options.context || 'all');
      const reason = options.reason || null;
      need([null, 'colors', 'patterns', 'formality', 'footwear', 'other'].includes(reason), 'Choose a listed reason.');
      const note = String(options.note || '').trim();
      need(note.length <= 500, 'Keep the reason within 500 characters.');
      return {scope, occasion, reason, note};
    }
    function hide(s, options = {}) {
      need(app.ownerFeedbackPersistent === true, 'Permanent saving is unavailable. No permanent rejection was recorded.');
      const value = choices(options), selection = F.normal(app.connection.validateSelection(s));
      const old = base.refresh().active.find(e => e.scope === value.scope && e.occasion === value.occasion && F.key(e.selection, e.scope) === F.key(selection, value.scope));
      if (old) return clone(old);
      if (!value.note) return base.hide(selection, {scope:value.scope, context:value.occasion, reason:value.reason});
      const event = {schema:F.SCHEMA, id:uid(), at:new Date().toISOString(), type:'hide', actor:'owner', selection,
        scope:value.scope, occasion:value.occasion, reason:value.reason, note:value.note};
      base.importData({schema:F.EXPORT, events:[event]}); return clone(event);
    }
    function skip(s, options = {}) {
      const value = choices(options), selection = F.normal(app.connection.validateSelection(s));
      const event = {id:'skip_' + uid(), type:'temporary_skip', selection, ...value};
      temporary.set(event.id, event); revision++; notify(); return clone(event);
    }
    function restore(id) {
      if (temporary.delete(id)) { revision++; notify(); return true; }
      return base.restore(id);
    }
    function clearTemporary(emit = true) { if (temporary.size) { temporary.clear(); revision++; if (emit) notify(); } }
    function reorder(rows, selection, context) { return base.reorder(rows, selection, context).filter(row => match(row && selection(row), context).allowed); }
    gate = Object.freeze({...base, hide, skip, restore, clearTemporary,
      refresh:snapshot, snapshot, match, allowed:(s, c) => match(s, c).allowed,
      token:() => snapshot().token,
      assertCurrent(token) { need(snapshot().token === token, 'Outfit feedback changed while this result was loading. Nothing rejected was displayed.'); return true; },
      reorder,
      alternative(current, rows, getSelection, context) {
        const eligible = reorder(rows, getSelection, context).filter(row => F.key(getSelection(row)) !== F.key(current));
        return eligible.find(row => F.key(getSelection(row), 'clothing') !== F.key(current, 'clothing')) || eligible[0] || null;
      },
      subscribe(fn) { listeners.add(fn); const unsubscribe = base.subscribe(fn); return () => {listeners.delete(fn); unsubscribe();}; }
    });
    app.connection.ownerFeedback.set(gate);
    return gate;
  }
  function replacement(current) {
    if (!app || !gate || !pool) return null;
    const state = app.state(), stable = api().stable;
    if (stable(state.preferences) !== stable(pool.preferences) || stable(state.context) !== stable(pool.context)) return null;
    if (pool.learningToken !== null) { try { app.learning.assertCurrent(pool.learningToken); } catch (_) { return null; } }
    if (pool.request.environment && app.weather?.request) {
      try { if (stable(pool.request.environment) !== stable(app.weather.request(state.context.localDate))) return null; } catch (_) { return null; }
    }
    const history = app.store.readForGeneration();
    if (stable(history.events) !== stable(pool.history)) return null;
    const getSelection = row => app.connection.selectionFromOption(row, pool.request).selection;
    const row = gate.alternative(current, pool.result.options, getSelection, pool.request.context);
    if (!row || !app.connection.controller.verifyCachedOption(row, pool.request, app.connection.catalogue)) return null;
    return {selection:getSelection(row), option:row, context:clone(pool.request.context), localDate:pool.request.localDate};
  }
  root.HEWRSRejectionPreviewCore = Object.freeze({attach, replacement, revision:'rejection-review-2',
    diagnostics:() => ({attached:!!gate, hasPool:!!pool, temporaryCount:temporary.size, imageTransport:'anonymous-cors'})});
})(globalThis);
