/* Opt-in wrapper around the unchanged, approved suit/blazer preview.
 * Adds existing tie thumbnails to the native buttons; never replaces handlers,
 * writes storage, renders clothing, invokes the engine, or changes catalogue data.
 */
(function () {
  'use strict';
  const frame = document.getElementById('tie-preview-app');
  const status = document.getElementById('tie-preview-status');
  const message = document.getElementById('tie-preview-message');
  const ids = Array.from({length:47}, (_, i) => 'T' + String(i + 1).padStart(3, '0'));
  const sourceLock = '3e60ce18a0295c6801983ce91dda296efec458b275f523523dee1e3915db7516';
  const approvedSuits = {
    S02:'053e639ef74d2f85e37f5ed47af04b07db77977faacf58cee6df99e4cf067d07',
    S13:'510ca7db687817fe34239f07bb18914022d81beeaffcb4c294b721409ed6836a'
  };
  const cssUrl = new URL('src/tie-picker-preview.css', document.baseURI).href;
  let activeWindow = null, observer = null, timer = null;
  function fail(text) {
    message.textContent = text;
    status.hidden = false;
    frame.removeAttribute('data-ready');
    frame.setAttribute('aria-busy', 'false');
  }
  function mount(root) {
    const doc = root.document, app = root.HEWRSApp;
    if (root.HEWRSTiePickerPreview) return;
    const manifest = root.HEWRS_OPTION_CARD_THUMBNAILS;
    const rows = app.ui.rows.tie;
    if (root.HEWRS_INPUT_SHA256 !== sourceLock || manifest?.source_lock !== sourceLock ||
        manifest?.schema !== 'hewrs.option-card-thumbnails.v1_21_1' ||
        !Array.isArray(rows) || rows.length !== 47 || new Set(rows.map(r => r.id)).size !== 47 ||
        Object.keys(manifest.ties || {}).length !== 47) {
      throw Error('The tie catalogue does not match this preview. Saved selections are unchanged.');
    }
    const exact = new Map();
    for (const id of ids) {
      const row = rows.find(r => r.id === id && r.sourceId === id && r.kind === 'tie');
      const image = manifest.ties[id];
      if (!row || !image || image.source_key !== id || !/^[a-f0-9]{64}$/.test(image.sha256) ||
          image.src !== 'ui/option-cards/' + image.sha256 + '.png' ||
          image.width !== 192 || image.height !== 224) {
        throw Error('The registered image binding for ' + id + ' is unavailable. No substitute is used.');
      }
      exact.set(id, {row, image});
    }
    const body = doc.getElementById('fx-sheet-body');
    if (!body) throw Error('The native selection panel is unavailable.');
    const link = doc.createElement('link');
    link.rel = 'stylesheet'; link.href = cssUrl; link.id = 'hewrs-tie-picker-css';
    const cssReady = new Promise((resolve, reject) => {
      link.onload = resolve;
      link.onerror = () => reject(Error('Tie preview styles could not load. Reload without clearing website data.'));
    });
    doc.head.append(link);
    const enhanced = new WeakSet();
    function suitApprovalLabels(list) {
      // Display the already recorded approvals, only for the exact approved images.
      // No source descriptor or original approved file is edited.
      for (const [id, sha] of Object.entries(approvedSuits)) {
        const button = list.querySelector('button[data-item-id="' + id + '"]');
        if (button?.querySelector('img')?.dataset.sourceSha256 !== sha) continue;
        const note = button.querySelector('.hewrs-picker-source-note');
        if (note && note.textContent !== 'Approved photo match') note.textContent = 'Approved photo match';
        const title = id + ' — ' + root.HEWRS_SUIT_PICKER_IMAGES.items[id].label + '\nOwner-approved appearance; exact approved image retained.';
        if (button.title !== title) button.title = title;
      }
    }
    function refresh() {
      const category = app.ui.draft()?.category;
      if (!['tie', 'topwear'].includes(category)) return;
      const list = body.querySelector('#picker-list');
      if (!list) return;
      observer.disconnect();
      try {
        if (category === 'topwear') { suitApprovalLabels(list); return; }
        if (!body.querySelector('#hewrs-tie-picker-note')) {
          const note = doc.createElement('p');
          note.id = 'hewrs-tie-picker-note';
          note.textContent = '47 ties · T001–T047 · Existing registered images. Select a photo, then Apply. No Tie and Engine Choice remain separate.';
          body.prepend(note);
        }
        for (const button of list.querySelectorAll('button.fx-choice[data-item-id]')) {
          const binding = exact.get(button.dataset.itemId);
          if (!binding || enhanced.has(button)) continue; // No Tie and family controls stay native.
          const id = button.querySelector('.fx-choice-id');
          const name = button.querySelector('.fx-choice-name');
          if (!id || !name) continue;
          const {row, image} = binding;
          const originalLabel = name.textContent;
          const picture = doc.createElement('span'); picture.className = 'hewrs-tie-picker-image';
          const img = doc.createElement('img');
          img.alt = ''; img.setAttribute('aria-hidden', 'true');
          img.width = image.width; img.height = image.height;
          img.loading = 'lazy'; img.decoding = 'async';
          img.dataset.sourceId = row.id; img.dataset.sourceSha256 = image.sha256;
          const unavailable = doc.createElement('span');
          unavailable.className = 'hewrs-tie-picker-unavailable';
          unavailable.textContent = 'Image unavailable · ' + row.id; unavailable.hidden = true;
          img.onerror = () => { img.hidden = true; unavailable.hidden = false; };
          picture.append(img, unavailable);
          const copy = doc.createElement('span'); copy.className = 'hewrs-tie-picker-copy';
          while (button.firstChild) copy.append(button.firstChild);
          if (typeof row.color === 'string' && row.color.trim()) name.textContent = row.color.trim();
          button.append(picture, copy); button.classList.add('hewrs-tie-picker-choice');
          button.title = (button.title ? button.title + '\n' : '') + row.id + ' — ' + originalLabel;
          if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', row.id + ' — ' + originalLabel);
          enhanced.add(button); img.src = image.src;
        }
      } finally { observer.observe(body, {childList:true, subtree:true}); }
    }
    observer?.disconnect();
    observer = new root.MutationObserver(refresh);
    observer.observe(body, {childList:true, subtree:true});
    root.HEWRSTiePickerPreview = Object.freeze({version:'1', ids:Object.freeze([...ids]), refresh});
    const tagline = doc.querySelector('.fx-tagline');
    if (tagline) tagline.textContent = 'Suit / Blazer / Tie photo selector · Test version';
    app.openPicker('tie');
    refresh();
    const item = new URLSearchParams(location.search).get('item');
    const search = doc.getElementById('picker-search');
    if (exact.has(item) && search) {
      search.value = item; search.dispatchEvent(new root.Event('input', {bubbles:true})); refresh();
    }
    // Opening the picker must not summon the phone keyboard automatically.
    if (doc.activeElement === search) search.blur();
    return cssReady;
  }
  function waitForApp() {
    clearTimeout(timer);
    const started = Date.now();
    function check() {
      try {
        const root = frame.contentWindow;
        if (root?.HEWRS_READY && root.HEWRSApp) {
          if (activeWindow === root && root.HEWRSTiePickerPreview) return;
          activeWindow = root;
          Promise.resolve(mount(root)).then(() => {
            frame.dataset.ready = 'true'; frame.setAttribute('aria-busy', 'false'); status.hidden = true;
          }).catch(error => fail(error.message));
          return;
        }
        if (root?.HEWRS_LOAD_ERROR) { fail('The wardrobe could not start. Reload without clearing website data.'); return; }
      } catch (_) { fail('The wardrobe could not be opened on this preview host. Saved data was not cleared.'); return; }
      if (Date.now() - started > 30000) { fail('The wardrobe is taking too long to load. Reload without clearing website data.'); return; }
      timer = setTimeout(check, 100);
    }
    check();
  }
  frame.addEventListener('load', waitForApp);
  waitForApp();
  window.addEventListener('pagehide', () => { clearTimeout(timer); observer?.disconnect(); });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
})();
