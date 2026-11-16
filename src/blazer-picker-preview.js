/* Opt-in Suit / Blazer picker presentation. Existing choice handlers, IDs and
 * Apply/Cancel own selection; this module does not write preferences or DNA. */
(function (root) {
  'use strict';
  if (root.HEWRSBlazerPickerPreview) return;

  const enhanced = new WeakSet();
  let body = null;
  let observer = null;
  const observation = {childList: true, subtree: true};

  function descriptorFor(manifest, row) {
    const descriptor = manifest.items?.[row.sourceId];
    if (!descriptor || descriptor.history_id !== row.id) return null;
    if (!['owner_approved_reference', 'owner_reference_photo', 'native_avatar_preview', 'corrected_avatar_preview'].includes(descriptor.source_kind)) return null;
    if (descriptor.source_kind === 'corrected_avatar_preview' &&
        (row.kind !== 'suit' || !['S02', 'S13'].includes(row.sourceId) ||
         descriptor.source_note !== 'Photo match · review' ||
         descriptor.width !== 996 || descriptor.height !== 2748)) return null;
    if (typeof descriptor.label !== 'string' || !descriptor.label.trim()) return null;
    if (!/^[a-f0-9]{64}$/.test(descriptor.sha256 || '')) return null;
    // Only a local relative image from the pinned manifest is eligible.
    if (typeof descriptor.src !== 'string' || !descriptor.src ||
        /^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(descriptor.src) ||
        /(?:^|\/)\.\.(?:\/|$)|\\/.test(descriptor.src)) return null;
    return descriptor;
  }

  function enhanceButton(button, row, descriptor) {
    const id = button.querySelector('.fx-choice-id');
    const name = button.querySelector('.fx-choice-name');
    if (!id || !name) return;

    const fullLabel = name.textContent;
    const sourceNote = {
      owner_reference_photo: 'Owner-supplied garment photograph.',
      owner_approved_reference: 'Owner-approved reference image.',
      native_avatar_preview: 'Approved garment on the existing app avatar.',
      corrected_avatar_preview: 'Photo-matched garment on the existing app avatar; awaiting owner review.',
    }[descriptor.source_kind];
    const frame = document.createElement('span');
    frame.className = 'hewrs-blazer-picker-image';
    frame.dataset.sourceKind = descriptor.source_kind;
    const image = document.createElement('img');
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = 88;
    image.height = 116;
    image.style.objectPosition = descriptor.object_position ||
      (descriptor.source_kind === 'owner_reference_photo' ? '50% 50%' : '50% 26%');
    image.dataset.sourceId = row.sourceId;
    image.dataset.sourceSha256 = descriptor.sha256;
    const unavailable = document.createElement('span');
    unavailable.className = 'hewrs-blazer-picker-unavailable';
    unavailable.textContent = 'Image unavailable';
    unavailable.hidden = true;
    image.onerror = () => {
      image.hidden = true;
      unavailable.hidden = false;
      frame.classList.add('hewrs-blazer-picker-image-failed');
    };
    frame.append(image, unavailable);

    const copy = document.createElement('span');
    copy.className = 'hewrs-blazer-picker-copy';
    // Move the existing label nodes, retaining any availability explanation.
    // The original button and its click closure remain the selection authority.
    while (button.firstChild) copy.append(button.firstChild);
    name.textContent = descriptor.label;
    if (descriptor.source_note) {
      const note = document.createElement('small');
      note.className = 'hewrs-picker-source-note';
      note.textContent = descriptor.source_note;
      copy.append(note);
    }
    button.append(frame, copy);
    button.classList.add(row.kind === 'suit' ? 'hewrs-suit-picker-choice' : 'hewrs-blazer-picker-choice');
    button.title = (button.title ? button.title + '\n' : '') +
      row.sourceId + ' — ' + fullLabel + '\n' + sourceNote +
      (descriptor.source_note ? '\n' + descriptor.source_note : '');
    if (!button.hasAttribute('aria-label')) {
      button.setAttribute('aria-label', row.sourceId + ' — ' + fullLabel);
    }
    enhanced.add(button);
    image.src = descriptor.src;
  }

  function refreshReviewLink(manifest) {
    const eligible = manifest?.schema === 'hewrs.suit-picker-images.v1' &&
      manifest.source_lock === root.HEWRS_INPUT_SHA256 &&
      ['S02', 'S13'].every(id => manifest.items?.[id]?.source_kind === 'corrected_avatar_preview');
    let note = body.querySelector('#hewrs-suit-photo-review');
    if (!eligible) { note?.remove(); return; }
    if (!note) {
      note = document.createElement('p');
      note.id = 'hewrs-suit-photo-review';
      note.className = 'hewrs-suit-photo-review';
      const link = document.createElement('a');
      link.href = 'suit-photo-review.html?item=S02';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Review S02 / S13 photo matches';
      link.setAttribute('aria-label', 'Review larger S02 and S13 photo matches in a new tab');
      note.append(link);
      body.prepend(note);
    }
    note.hidden = body.querySelector('#picker-type')?.value === 'blazer';
  }

  function refresh() {
    const app = root.HEWRSApp;
    if (!body || !app || app.ui.draft()?.category !== 'topwear') return;
    const manifests = {
      blazer: [root.HEWRS_BLAZER_PICKER_IMAGES, 'hewrs.blazer-picker-images.v1'],
      suit: [root.HEWRS_SUIT_PICKER_IMAGES, 'hewrs.suit-picker-images.v1'],
    };
    const list = body.querySelector('#picker-list');
    if (!list) return;

    // Disconnect during our own child moves to avoid observing our additions.
    observer?.disconnect();
    try {
      refreshReviewLink(root.HEWRS_SUIT_PICKER_IMAGES);
      for (const button of list.querySelectorAll('button.fx-choice[data-item-id]')) {
        if (enhanced.has(button)) continue;
        const sourceId = button.dataset.itemId;
        const rows = app.ui.rows.topwear.filter(row =>
          Object.hasOwn(manifests, row.kind) && row.sourceId === sourceId);
        if (rows.length !== 1) continue;
        const [manifest, schema] = manifests[rows[0].kind];
        if (manifest?.schema !== schema || manifest.source_lock !== root.HEWRS_INPUT_SHA256) continue;
        const descriptor = descriptorFor(manifest, rows[0]);
        if (descriptor) enhanceButton(button, rows[0], descriptor);
      }
    } finally {
      observer?.observe(body, observation);
    }
  }

  function start() {
    body = document.getElementById('fx-sheet-body');
    if (!body) return;
    observer = new MutationObserver(refresh);
    observer.observe(body, observation);
    refresh();
  }

  root.HEWRSBlazerPickerPreview = Object.freeze({version: '2', refresh});
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once: true});
  } else {
    start();
  }
})(globalThis);
