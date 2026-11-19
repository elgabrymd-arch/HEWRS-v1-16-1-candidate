/* Additive review bridge installed BEFORE the candidate runtime.
 * Original outfit feedback retains its v1 meaning. Explicit tie feedback has
 * a separate immutable log. Temporary skips remain session memory.
 * Visible renders commit only after the same veto is rechecked atomically.
 * A failed read blocks work; unreadable permanent data is never an empty log.
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
  let revision = 0, importing = false;
  const api = () => root.HEWRSOutfitFeedback;
  const uid = () => root.crypto?.randomUUID?.() || Array.from(root.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  function notify() { if (importing) return; for (const fn of listeners) { try { fn(); } catch (_) {} } }
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
          const turn = ++epoch;
          if (gate?.sync) await gate.sync();
          if (turn !== epoch) return {cancelled:true};
          const token = assertVisible(selection, visible);
          visible.dataset.loading = 'true';
          try {
            const result = await original.render(selection);
            if (turn !== epoch || result?.cancelled) return {cancelled:true};
            const publish = () => {
              if (turn !== epoch) return {cancelled:true};
              gate.assertCurrent(token);
              assertVisible(selection, visible);
              const pixels = off.getContext('2d', {willReadFrequently:true}).getImageData(0, 0, off.width, off.height);
              visible.getContext('2d', {willReadFrequently:true}).putImageData(pixels, 0, 0);
              for (const key of Object.keys(visible.dataset)) delete visible.dataset[key];
              Object.assign(visible.dataset, off.dataset, {loading:'false'});
              last = clone(selection); return result;
            };
            return gate.withCurrent ? await gate.withCurrent(token, publish) : publish();
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
      function beforeGeneration() {
        need(gate, 'The shared outfit feedback record is not ready.');
        // Validate both permanent ledgers before invoking any local or remote
        // producer. The existing post-check remains necessary for changes made
        // while asynchronous generation is running.
        return gate.refresh().token;
      }
      function afterGeneration(result, request, history, token) {
        if (result?.status !== 'cancelled') gate.assertCurrent(token);
        return remember(result, request, history);
      }
      function remember(result, request, history) {
        // Check the entire active rejection ledger on every generation/refill.
        // An out-of-date producer must fail closed rather than repopulate a
        // previously rejected outfit after several sequential replacements.
        if (result?.status !== 'cancelled' && Array.isArray(result?.options) && gate) {
          const live = gate.refresh();
          const context = request?.context || {occasion:'work'};
          for (const option of result.options) {
            const selection = connection.selectionFromOption(option, request).selection;
            need(gate.match(selection, context).allowed,
              'A generated replacement matches a saved rejection. The current list was not replaced.');
          }
          gate.assertCurrent(live.token);
        }
        if (result?.status !== 'cancelled' && Array.isArray(result?.options)) {
          const state = root.HEWRSApp?.state();
          pool = {result, request:clone(request), history:clone(history),
            preferences:state && clone(state.preferences), context:state && clone(state.context), learningToken:root.HEWRSApp?.learning?.model(request.context)?.token ?? null};
        }
        return result;
      }
      return Object.freeze({...connection, controller:Object.freeze({...controller,
        generate(q, c, h) {
          need(!gate?.requiresAsync, 'Saved rejections require asynchronous generation. Use generateAsync.');
          const token = beforeGeneration();
          return afterGeneration(controller.generate(q, c, h), q, h, token);
        },
        async generateAsync(q, c, h, o) {
          if (gate?.sync) await gate.sync();
          const token = beforeGeneration();
          const result = await controller.generateAsync(q, c, h, o);
          if (result?.status !== 'cancelled' && gate.withCurrent) {
            return gate.withCurrent(token, () => afterGeneration(result, q, h, token));
          }
          return afterGeneration(result, q, h, token);
        }
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
  // The database owns permanent records and indexed matching. This wrapper
  // adds only session skips and the candidate's publication/replacement gate.
  function attachDatabase(application) {
    app = application;
    const base = app.ownerFeedback, F = api(), T = root.HEWRSTieFeedback;
    let cached = null, cachedBase = null, cachedRevision = -1;
    const fail = error => { app.setFeedbackReadError?.(error); throw error; };
    function snapshot() {
      try {
        const value = base.refresh();
        if (cachedBase !== value || cachedRevision !== revision) {
          cached = Object.freeze({...value, token:value.token+'\nreview-skips:'+revision,
            temporary:Object.freeze([...temporary.values()].map(event => Object.freeze(clone(event))))});
          cachedBase = value; cachedRevision = revision;
        }
        return cached;
      } catch (error) { return fail(error); }
    }
    function match(value, context) {
      snapshot();
      const selection = F.normal(value), result = base.match(selection, context);
      const occasion = F.occasion(typeof context === 'string' ? context : context?.occasion);
      const reasons = [...result.reasons];
      for (const event of temporary.values()) {
        if (event.occasion !== 'all' && event.occasion !== occasion) continue;
        const tied = T.isScope(event.scope);
        if (tied && selection.state === 'NO_TIE') continue;
        const getKey = tied ? T.key : F.key;
        if (getKey(event.selection,event.scope) === getKey(selection,event.scope))
          reasons.push({id:event.id,type:'temporary_skip',scope:event.scope,occasion:event.occasion,reason:event.reason});
      }
      return {...result,allowed:reasons.length===0,reasons};
    }
    function skip(value, options={}) {
      snapshot();
      const selection = F.normal(app.connection.validateSelection(value));
      const scope = options.scope || 'outfit';
      need(['outfit','clothing','tie','shirt_tie'].includes(scope),'Choose a listed rejection scope.');
      if (T.isScope(scope)) T.key(selection,scope);
      const occasion = F.occasion(typeof options.context === 'object' ? options.context.occasion : options.context || 'all');
      const reason = options.reason || null, note = String(options.note || '').trim();
      need([null,'colors','patterns','formality','footwear','other'].includes(reason) && note.length<=500,'Invalid rejection details.');
      const event = {id:'skip_'+uid(),type:'temporary_skip',selection,scope,occasion,reason,note};
      temporary.set(event.id,event);revision++;notify();return clone(event);
    }
    function clearTemporary(emit=true) { if (temporary.size) {temporary.clear();revision++;if(emit)notify();} }
    function assertCurrent(token) { need(snapshot().token===token,'Outfit feedback changed while this result was loading. Nothing rejected was displayed.');return true; }
    async function sync(options) { try {await base.sync(options);return snapshot();} catch(error) {return fail(error);} }
    async function withCurrent(token, callback) {
      assertCurrent(token);
      const permanentToken = base.token();
      try {return await base.withCurrent(permanentToken,()=>{assertCurrent(token);return callback();});}
      catch(error) {if(base.status().blocked||base.status().stale)app.setFeedbackReadError?.(error);throw error;}
    }
    function reorder(rows, getSelection, context) {
      return base.reorder(rows,getSelection,context).filter(row=>match(getSelection(row),context).allowed);
    }
    gate = Object.freeze({...base, ready:base.ready, refresh:snapshot, snapshot, sync,
      get persistent(){return base.status().persistent;},
      retry:()=>sync({forceLegacy:true}), match, allowed:(s,c)=>match(s,c).allowed,
      skip, clearTemporary, token:()=>snapshot().token, assertCurrent,
      assertCurrentAsync:token=>withCurrent(token,()=>true), withCurrent, reorder,
      async restore(id) {if(temporary.delete(id)){revision++;notify();return true;}return base.restore(id);},
      persistentForScope:()=>base.status().persistent===true && base.status().ready===true && !base.status().blocked && !base.status().stale,
      alternative(current,rows,getSelection,context) {
        const eligible=reorder(rows,getSelection,context).filter(row=>F.key(getSelection(row))!==F.key(current));
        return eligible.find(row=>F.key(getSelection(row),'clothing')!==F.key(current,'clothing'))||eligible[0]||null;
      },
      subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
    });
    base.subscribe(notify);
    app.connection.ownerFeedback.set(gate);
    return gate;
  }
  function attach(application) {
    if (gate) return gate;
    if (application.ownerFeedback?.storageKind === 'indexeddb') return attachDatabase(application);
    app = application;
    const base = app.ownerFeedback;
    need(base?.hide && base?.match && base?.importData, 'The existing owner feedback store is unavailable.');
    const F = api(), T = root.HEWRSTieFeedback;
    need(T?.create, 'The explicit tie feedback module is unavailable.');
    let storage = null;
    try { storage = root.localStorage; } catch (_) {}
    const ties = T.create({storage, feedback:F, validateSelection:s => app.connection.validateSelection(s)});
    function assertDistinctIds(outfitEvents, tieEvents) {
      const ids = new Set(outfitEvents.map(event => event.id));
      need(!tieEvents.some(event => ids.has(event.id)), 'Outfit and tie feedback have conflicting event IDs. Existing records were retained.');
    }
    const scopeKey = (selection, scope) => T.isScope(scope) ? T.key(selection, scope) : F.key(selection, scope);
    const matches = (event, selection, occasion) => (event.occasion === 'all' || event.occasion === occasion) &&
      (!T.isScope(event.scope) || /^T\d{3}$/.test(selection.state || selection.tie)) && scopeKey(event.selection, event.scope) === scopeKey(selection, event.scope);
    function snapshot() {
      try {
        const s = base.refresh(), t = ties.refresh();
        assertDistinctIds(s.events, t.events);
        return {...s, events:[...s.events, ...t.events], active:[...s.active, ...t.active],
          token:s.token + '\n' + t.token + '\nreview-skips:' + revision,
          temporary:[...temporary.values()].map(clone)};
      } catch (error) {
        // Keep the original ledgers and their bytes. All views use the same
        // explicit blocked state, including callers outside the main card.
        app.setFeedbackReadError?.(error);
        throw error;
      }
    }
    function match(s, context) {
      s = F.normal(s);
      const result = base.match(s, context), occasion = F.occasion(typeof context === 'string' ? context : context?.occasion);
      const reasons = [...result.reasons, ...ties.match(s, context).reasons];
      for (const event of temporary.values()) {
        if (matches(event, s, occasion)) reasons.push({id:event.id, type:'temporary_skip', scope:event.scope, occasion:event.occasion, reason:event.reason});
      }
      return {...result, allowed:reasons.length === 0, reasons};
    }
    function choices(options = {}) {
      const scope = options.scope || 'outfit';
      need(['outfit', 'clothing', 'tie', 'shirt_tie'].includes(scope), 'Choose a listed rejection scope.');
      const occasion = F.occasion(typeof options.context === 'object' ? options.context.occasion : options.context || 'all');
      const reason = options.reason || null;
      need([null, 'colors', 'patterns', 'formality', 'footwear', 'other'].includes(reason), 'Choose a listed reason.');
      const note = String(options.note || '').trim();
      need(note.length <= 500, 'Keep the reason within 500 characters.');
      return {scope, occasion, reason, note};
    }
    function hide(s, options = {}) {
      snapshot();
      need(app.ownerFeedbackPersistent === true, 'Permanent saving is unavailable. No permanent rejection was recorded.');
      const value = choices(options), selection = F.normal(app.connection.validateSelection(s));
      if (T.isScope(value.scope)) return ties.hide(selection, {...value, context:value.occasion});
      const old = base.refresh().active.find(e => e.scope === value.scope && e.occasion === value.occasion && F.key(e.selection, e.scope) === F.key(selection, value.scope));
      if (old) return clone(old);
      if (!value.note) return base.hide(selection, {scope:value.scope, context:value.occasion, reason:value.reason});
      const event = {schema:F.SCHEMA, id:uid(), at:new Date().toISOString(), type:'hide', actor:'owner', selection,
        scope:value.scope, occasion:value.occasion, reason:value.reason, note:value.note};
      base.importData({schema:F.EXPORT, events:[event]}); return clone(event);
    }
    function skip(s, options = {}) {
      const value = choices(options), selection = F.normal(app.connection.validateSelection(s));
      if (T.isScope(value.scope)) T.key(selection, value.scope);
      const event = {id:'skip_' + uid(), type:'temporary_skip', selection, ...value};
      temporary.set(event.id, event); revision++; notify(); return clone(event);
    }
    function restore(id) {
      if (temporary.delete(id)) { revision++; notify(); return true; }
      const t = ties.refresh(), s = base.refresh();
      assertDistinctIds(s.events, t.events);
      if (t.events.some(event => event.id === id)) return ties.restore(id);
      return base.restore(id);
    }
    function clearTemporary(emit = true) { if (temporary.size) { temporary.clear(); revision++; if (emit) notify(); } }
    function reorder(rows, selection, context) { return base.reorder(rows, selection, context).filter(row => match(row && selection(row), context).allowed); }
    function exportData() {
      snapshot();
      return {schema:T.BUNDLE_EXPORT, exported_at:new Date().toISOString(),
        outfit_feedback:base.exportData(), tie_feedback:ties.exportData()};
    }
    function memoryStorage() {
      const rows = new Map();
      return {get length() {return rows.size;}, key:i => [...rows.keys()][i] ?? null,
        getItem:k => rows.get(k) ?? null, setItem:(k, v) => rows.set(k, String(v))};
    }
    function importData(document) {
      need(app.ownerFeedbackPersistent === true, 'Permanent storage is unavailable. Import was not attempted.');
      let outfitDocument = null, tieDocument = null;
      if (document?.schema === F.EXPORT) outfitDocument = document;
      else if (document?.schema === T.EXPORT) tieDocument = document;
      else {
        need(document?.schema === T.BUNDLE_EXPORT && document.outfit_feedback?.schema === F.EXPORT && document.tie_feedback?.schema === T.EXPORT,
          'Unsupported outfit and tie feedback backup.');
        outfitDocument = document.outfit_feedback; tieDocument = document.tie_feedback;
      }
      // Validate both complete merges before changing either real ledger. This
      // catches unknown scopes, orphaned restores and ID conflicts up front.
      // Browser storage has no multi-key transaction: a quota/security failure
      // is reported as incomplete and the same backup can safely be retried.
      const oldOutfits = base.exportData(), oldTies = ties.exportData();
      let mergedOutfits = oldOutfits.events, mergedTies = oldTies.events;
      if (outfitDocument) {
        const preview = F.create({storage:memoryStorage(), validateSelection:s => app.connection.validateSelection(s)});
        preview.importData(oldOutfits); preview.importData(outfitDocument); mergedOutfits = preview.snapshot().events;
      }
      if (tieDocument) {
        need(ties.persistent, 'Permanent tie feedback storage is unavailable. Import was not attempted.');
        const preview = T.create({storage:memoryStorage(), feedback:F, validateSelection:s => app.connection.validateSelection(s)});
        preview.importData(oldTies); preview.importData(tieDocument); mergedTies = preview.snapshot().events;
      }
      assertDistinctIds(mergedOutfits, mergedTies);
      importing = true;
      try {
        if (outfitDocument) base.importData(outfitDocument);
        if (tieDocument) ties.importData(tieDocument);
        return snapshot();
      } catch (error) {
        throw Error('Feedback import did not complete: ' + error.message + ' Existing records were retained. Retry the complete backup.');
      } finally { importing = false; notify(); }
    }
    base.subscribe(notify); ties.subscribe(notify);
    gate = Object.freeze({...base, hide, skip, restore, clearTemporary,
      refresh:snapshot, snapshot, match, allowed:(s, c) => match(s, c).allowed,
      exportData, importData, prefixes:Object.freeze([base.prefix, T.PREFIX].filter(Boolean)),
      persistentForScope:scope => app.ownerFeedbackPersistent === true && (!T.isScope(scope) || ties.persistent),
      token:() => snapshot().token,
      assertCurrent(token) { need(snapshot().token === token, 'Outfit feedback changed while this result was loading. Nothing rejected was displayed.'); return true; },
      reorder,
      alternative(current, rows, getSelection, context) {
        const eligible = reorder(rows, getSelection, context).filter(row => F.key(getSelection(row)) !== F.key(current));
        return eligible.find(row => F.key(getSelection(row), 'clothing') !== F.key(current, 'clothing')) || eligible[0] || null;
      },
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
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
  root.HEWRSRejectionPreviewCore = Object.freeze({attach, replacement, revision:'rejection-database-integration-1',
    diagnostics:() => ({attached:!!gate, hasPool:!!pool, temporaryCount:temporary.size, imageTransport:'anonymous-cors'})});
})(globalThis);
