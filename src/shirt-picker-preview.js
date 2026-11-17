/* Review-only wrapper. Adds registered shirt and tie photos to native choices.
 * No catalogue edits, garment rendering, storage writes, or handler replacement.
 */
(function () {
  'use strict';
  const frame = document.getElementById('shirt-preview-app');
  const status = document.getElementById('shirt-preview-status');
  const message = document.getElementById('shirt-preview-message');
  const ids = {
    shirt: [...Array.from({length:48}, (_, i) => 'DS' + String(i + 1).padStart(3, '0')), 'DS050', 'DS051'],
    tie: Array.from({length:47}, (_, i) => 'T' + String(i + 1).padStart(3, '0'))
  };
  const sourceLock = '3e60ce18a0295c6801983ce91dda296efec458b275f523523dee1e3915db7516';
  const approvedSuits = {
    S02:'053e639ef74d2f85e37f5ed47af04b07db77977faacf58cee6df99e4cf067d07',
    S13:'510ca7db687817fe34239f07bb18914022d81beeaffcb4c294b721409ed6836a'
  };
  const cssUrls = ['src/tie-picker-preview.css', 'src/shirt-picker-preview.css'].map(path => new URL(path, document.baseURI).href);
  let activeWindow = null, observer = null, timer = null;
  function fail(text) {
    message.textContent = text;
    status.hidden = false;
    frame.removeAttribute('data-ready');
    frame.setAttribute('aria-busy', 'false');
  }
  function mount(root) {
    const doc = root.document, app = root.HEWRSApp;
    if (root.HEWRSShirtPickerPreview) return;
    const manifest = root.HEWRS_OPTION_CARD_THUMBNAILS;
    if (root.HEWRS_INPUT_SHA256 !== sourceLock || manifest?.source_lock !== sourceLock ||
        manifest?.schema !== 'hewrs.option-card-thumbnails.v1_21_1') {
      throw Error('The wardrobe does not match this preview. Saved selections are unchanged.');
    }
    const exact = {shirt:new Map(), tie:new Map()};
    for (const category of ['shirt', 'tie']) {
      const rows = app.ui.rows[category];
      const images = category === 'shirt' ? manifest.shirts : manifest.ties;
      if (!Array.isArray(rows) || rows.length !== ids[category].length ||
          new Set(rows.map(r => r.id)).size !== ids[category].length ||
          Object.keys(images || {}).length !== ids[category].length) {
        throw Error('The ' + category + ' catalogue does not match this preview.');
      }
      for (const id of ids[category]) {
        const row = rows.find(r => r.id === id && r.sourceId === id && r.kind === category);
        // Every active shirt has a tie-free image, including the four no-tie-only shirts.
        const image = category === 'shirt' ? images[id]?.no_tie : images[id];
        const key = category === 'shirt' ? id + '/no_tie' : id;
        if (!row || !image || image.source_key !== key || !/^[a-f0-9]{64}$/.test(image.sha256) ||
            image.src !== 'ui/option-cards/' + image.sha256 + '.png' ||
            image.width !== 192 || image.height !== 224) {
          throw Error('The registered image for ' + id + ' is unavailable. No substitute is used.');
        }
        exact[category].set(id, {row, image});
      }
    }
    const body = doc.getElementById('fx-sheet-body');
    if (!body) throw Error('The selection panel is unavailable.');
    const cssReady = Promise.all(cssUrls.map((url, index) => new Promise((resolve, reject) => {
      const link = doc.createElement('link');
      link.rel = 'stylesheet'; link.href = url; link.id = 'hewrs-shirt-preview-css-' + index;
      link.onload = resolve;
      link.onerror = () => reject(Error('Photo selector styles could not load. Reload without clearing website data.'));
      doc.head.append(link);
    })));
    const enhanced = new WeakSet();
    function suitApprovalLabels(list) {
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
      if (!['shirt', 'tie', 'topwear'].includes(category)) return;
      const list = body.querySelector('#picker-list');
      if (!list) return;
      observer.disconnect();
      try {
        if (category === 'topwear') { suitApprovalLabels(list); return; }
        const prefix = 'hewrs-' + category + '-picker';
        if (!body.querySelector('#' + prefix + '-note')) {
          const note = doc.createElement('p'); note.id = prefix + '-note';
          note.textContent = category === 'shirt'
            ? '50 shirts · Photos show each shirt without a tie. Select a shirt, then Apply. Tie selection is separate.'
            : '47 ties · T001–T047 · Select a photo, then Apply. No Tie and Engine Choice remain separate.';
          body.prepend(note);
        }
        for (const button of list.querySelectorAll('button.fx-choice[data-item-id]')) {
          const binding = exact[category].get(button.dataset.itemId);
          if (!binding || enhanced.has(button)) continue;
          const id = button.querySelector('.fx-choice-id'), name = button.querySelector('.fx-choice-name');
          if (!id || !name) continue;
          const {row, image} = binding, originalLabel = name.textContent;
          const displayLabel = category === 'shirt' && /source-repaired collar\/body pilot/.test(originalLabel)
            ? (app.connection.catalogue.shirts.find(item => item.id === 'shirt-' + row.id)?.name || row.id)
            : originalLabel;
          const picture = doc.createElement('span'); picture.className = prefix + '-image';
          const img = doc.createElement('img');
          img.alt = ''; img.setAttribute('aria-hidden', 'true');
          img.width = image.width; img.height = image.height;
          // The complete thumbnails load up front, including the final items in the scroll panel.
          img.loading = 'eager'; img.decoding = 'async';
          img.dataset.sourceId = row.id; img.dataset.sourceSha256 = image.sha256;
          if (category === 'shirt') img.dataset.previewState = 'no_tie';
          const unavailable = doc.createElement('span'); unavailable.className = prefix + '-unavailable';
          unavailable.textContent = 'Image unavailable · ' + row.id; unavailable.hidden = true;
          img.onerror = () => { img.hidden = true; unavailable.hidden = false; };
          picture.append(img, unavailable);
          const copy = doc.createElement('span'); copy.className = prefix + '-copy';
          while (button.firstChild) copy.append(button.firstChild);
          name.textContent = category === 'tie' && typeof row.color === 'string' && row.color.trim() ? row.color.trim() : displayLabel;
          button.append(picture, copy); button.classList.add(prefix + '-choice');
          button.title = (button.title ? button.title + '\n' : '') + row.id + ' — ' + displayLabel;
          if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', row.id + ' — ' + displayLabel);
          enhanced.add(button); img.src = image.src;
        }
      } finally { observer.observe(body, {childList:true, subtree:true}); }
    }
    observer?.disconnect();
    observer = new root.MutationObserver(refresh);
    observer.observe(body, {childList:true, subtree:true});
    root.HEWRSShirtPickerPreview = Object.freeze({version:'1', ids:Object.freeze([...ids.shirt]), refresh});
    const tagline = doc.querySelector('.fx-tagline');
    if (tagline) tagline.textContent = 'Suit / Blazer / Shirt / Tie photo selector · Test version';
    app.openPicker('shirt'); refresh();
    const item = new URLSearchParams(location.search).get('item');
    const search = doc.getElementById('picker-search');
    if (exact.shirt.has(item) && search) {
      search.value = item; search.dispatchEvent(new root.Event('input', {bubbles:true})); refresh();
    }
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
          if (activeWindow === root && root.HEWRSShirtPickerPreview) return;
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
