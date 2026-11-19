/* Explicit owner tie and shirt–tie exclusions. Existing outfit feedback stays
 * in its original namespace and keeps its original meaning. Each new event is
 * immutable so simultaneous tabs cannot replace one another's rejection log. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HEWRSTieFeedback = api;
})(globalThis, function () {
  'use strict';
  const PREFIX = 'hewrs:tie-feedback:v1:event:';
  const SCHEMA = 'hewrs.tie-feedback.event.v1';
  const EXPORT = 'hewrs.tie-feedback.export.v1';
  const BUNDLE_EXPORT = 'hewrs.outfit-and-tie-feedback.export.v1';
  const clone = value => structuredClone(value);
  const need = (value, message) => { if (!value) throw Error(message); };
  const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const isScope = scope => scope === 'tie' || scope === 'shirt_tie';
  function key(selection, scope) {
    need(isScope(scope), 'Choose a tie or shirt–tie rejection scope.');
    const tie = selection?.state || selection?.tie, shirt = selection?.shirtId || selection?.shirt;
    need(/^T\d{3}$/.test(tie), 'This rejection requires an actual tie. No Tie cannot be rejected as a garment.');
    if (scope === 'tie') return tie;
    need(/^DS\d{3}$/.test(shirt), 'A shirt–tie rejection requires an exact shirt ID.');
    return shirt + '|' + tie;
  }
  function create({storage = null, feedback = globalThis.HEWRSOutfitFeedback, validateSelection = null,
    now = () => new Date().toISOString(),
    id = () => 'tie_' + (globalThis.crypto?.randomUUID?.() || Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''))} = {}) {
    need(feedback?.normal && feedback?.occasion && feedback?.stable, 'The original outfit feedback validator is required.');
    const persistent = !!(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function');
    const observers = new Set();
    let cache = null;
    function selection(value) {
      const result = feedback.normal(value);
      validateSelection?.(result);
      return result;
    }
    function validate(event) {
      need(plain(event) && event.schema === SCHEMA && /^tie_[A-Za-z0-9_-]{1,145}$/.test(event.id) &&
        typeof event.at === 'string' && Number.isFinite(Date.parse(event.at)), 'Invalid tie feedback event. Existing records were retained.');
      if (event.type === 'hide') {
        need(event.actor === 'owner' && isScope(event.scope), 'Unknown tie rejection action or scope.');
        const canonical = selection(event.selection);
        need(feedback.stable(canonical) === feedback.stable(event.selection), 'Tie feedback must retain an exact canonical outfit.');
        key(canonical, event.scope);
        need(['all', 'work', 'dinner', 'weekend'].includes(event.occasion), 'Unknown tie rejection occasion.');
        need([null, 'colors', 'patterns', 'formality', 'footwear', 'other'].includes(event.reason), 'Unknown tie rejection reason.');
        need(typeof event.note === 'string' && event.note.length <= 500, 'Tie rejection details must fit within 500 characters.');
        need(Object.keys(event).every(k => ['schema', 'id', 'at', 'type', 'actor', 'selection', 'scope', 'occasion', 'reason', 'note'].includes(k)), 'Unknown tie rejection fields.');
      } else {
        need(event.type === 'restore' && /^tie_[A-Za-z0-9_-]{1,145}$/.test(event.target), 'Unknown tie feedback action or undo target.');
        need(Object.keys(event).every(k => ['schema', 'id', 'at', 'type', 'target'].includes(k)), 'Unknown tie undo fields.');
      }
      return event;
    }
    function derive(events) {
      const byId = new Map(events.map(event => [event.id, event]));
      need(byId.size === events.length, 'Duplicate tie feedback event IDs.');
      const restored = new Set();
      for (const event of events) if (event.type === 'restore') {
        need(byId.get(event.target)?.type === 'hide', 'A tie undo target is missing. Import the complete backup.');
        restored.add(event.target);
      }
      const ordered = events.slice().sort((a, b) => a.id.localeCompare(b.id));
      return {events:ordered, active:ordered.filter(event => event.type === 'hide' && !restored.has(event.id)),
        token:SCHEMA + '\n' + ordered.map(event => event.id + ':' + feedback.stable(event)).join('\n'), persistent};
    }
    function refresh() {
      const events = [];
      // When browser storage is unavailable the temporary gate remains usable.
      // Unreadable records in available storage always throw; none are ignored.
      if (persistent) for (let i = 0; i < storage.length; i++) {
        const storageKey = storage.key(i);
        if (!storageKey?.startsWith(PREFIX)) continue;
        let event;
        try { event = JSON.parse(storage.getItem(storageKey)); }
        catch { throw Error('Unreadable tie rejection record. Existing records were retained.'); }
        validate(event);
        need(storageKey === PREFIX + event.id, 'Tie rejection storage key mismatch. Existing records were retained.');
        events.push(event);
      }
      cache = derive(events);
      return clone(cache);
    }
    function notify() { for (const fn of observers) { try { fn(); } catch (_) {} } }
    function write(events) {
      need(persistent, 'Permanent tie feedback storage is unavailable. No tie rejection was saved.');
      const before = refresh(), merged = new Map(before.events.map(event => [event.id, event]));
      for (const event of events) {
        validate(event);
        const previous = merged.get(event.id);
        need(!previous || feedback.stable(previous) === feedback.stable(event), 'Conflicting tie feedback event. Nothing was overwritten.');
        merged.set(event.id, event);
      }
      derive([...merged.values()]);
      // Hides precede restores so a quota failure remains repairable by retrying
      // the same backup. No partial import is reported as a complete success.
      const ordered = events.slice().sort((a, b) => Number(a.type === 'restore') - Number(b.type === 'restore'));
      try {
        for (const event of ordered) {
          const storageKey = PREFIX + event.id, old = storage.getItem(storageKey), serialized = JSON.stringify(event);
          if (old !== null) {
            need(feedback.stable(JSON.parse(old)) === feedback.stable(event), 'Concurrent tie feedback conflict.');
            continue;
          }
          storage.setItem(storageKey, serialized);
          need(storage.getItem(storageKey) === serialized, 'The browser did not persist the tie rejection.');
        }
        refresh(); notify(); return clone(cache);
      } catch (error) {
        try { refresh(); } catch (_) {}
        notify();
        throw Error('Tie feedback save/import did not complete: ' + error.message + ' Existing records were retained; retry the complete backup.');
      }
    }
    function hide(value, {scope, context = 'all', reason = null, note = ''} = {}) {
      const canonical = selection(value), target = key(canonical, scope);
      const occasion = feedback.occasion(typeof context === 'object' ? context.occasion : context);
      const existing = refresh().active.find(event => event.scope === scope && event.occasion === occasion && key(event.selection, scope) === target);
      if (existing) return clone(existing);
      const event = {schema:SCHEMA, id:id(), at:now(), type:'hide', actor:'owner', selection:canonical,
        scope, occasion, reason, note:String(note).trim()};
      write([event]); return clone(event);
    }
    function restore(target) {
      const snapshot = refresh(), event = snapshot.events.find(value => value.id === target);
      need(event?.type === 'hide', 'Unknown tie rejection.');
      if (!snapshot.active.some(value => value.id === target)) return false;
      write([{schema:SCHEMA, id:id(), at:now(), type:'restore', target}]); return true;
    }
    function match(value, context = {}) {
      const snapshot = refresh();
      const occasion = feedback.occasion(typeof context === 'string' ? context : context.occasion);
      if (!snapshot.active.length) return {allowed:true, reasons:[]};
      const canonical = selection(value);
      // An open collar never matches an explicit tie or shirt–tie rejection.
      if (canonical.state === 'NO_TIE') return {allowed:true, reasons:[]};
      const reasons = [];
      for (const event of snapshot.active) if ((event.occasion === 'all' || event.occasion === occasion) &&
        key(event.selection, event.scope) === key(canonical, event.scope)) {
        reasons.push({type:'hide', id:event.id, scope:event.scope, occasion:event.occasion, reason:event.reason});
      }
      return {allowed:reasons.length === 0, reasons};
    }
    function exportData() { return {schema:EXPORT, exported_at:now(), events:refresh().events}; }
    function importData(document) {
      need(plain(document) && document.schema === EXPORT && Array.isArray(document.events) && document.events.length <= 20000, 'Unsupported tie feedback backup.');
      return write(clone(document.events));
    }
    return Object.freeze({refresh, snapshot:refresh, hide, restore, match, allowed:(s, c) => match(s, c).allowed,
      exportData, importData, token:() => refresh().token, persistent, prefix:PREFIX,
      subscribe(fn) { observers.add(fn); return () => observers.delete(fn); }});
  }
  return Object.freeze({create, key, isScope, PREFIX, SCHEMA, EXPORT, BUNDLE_EXPORT});
});
