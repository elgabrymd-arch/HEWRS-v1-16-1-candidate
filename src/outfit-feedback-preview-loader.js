/* Derive an opt-in page from the exact reviewed entrypoint. No accepted file
 * is rewritten. Git-blob identity verifies both content and byte length. */
(async function () {
  'use strict';
  const frame = document.getElementById('shirt-preview-app');
  const expected = '99b26b32a2bfda45d7204c5489b1563dd54088fe';
  try {
    const response = await fetch('blazer-picker-preview.html');
    if (!response.ok) throw Error('The reviewed application could not load.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const header = new TextEncoder().encode('blob ' + bytes.length + '\0');
    const data = new Uint8Array(header.length + bytes.length);
    data.set(header); data.set(bytes, header.length);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', data)), b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== expected) throw Error('The reviewed application has changed; this feedback preview stopped safely.');
    let html = new TextDecoder().decode(bytes);
    const pattern = /<script\b[^>]*\bsrc="runtime\/hewrs-bbbcec41d08f91585f4a\.js"[^>]*><\/script>/g;
    const matches = html.match(pattern);
    if (matches?.length !== 1) throw Error('The approved runtime binding is unavailable.');
    html = html.replace(pattern, '<script defer src="src/outfit-rejection-core.js"></script>\n' + matches[0] + '\n<script defer src="src/outfit-rejection-ui.js"></script>');
    html = html.replace('</head>', '<link rel="stylesheet" href="src/outfit-rejection.css">\n</head>');
    frame.srcdoc = html;
    // The retained shirt decorator opens its picker without saving a choice.
    // Close that initial draft and leave Home ready for generating outfits.
    let finished = false;
    function finish() {
      if (finished || frame.dataset.ready !== 'true') return;
      const doc = frame.contentDocument, app = frame.contentWindow?.HEWRSApp;
      if (!doc || !app?.rejection) return;
      finished = true; observer.disconnect();
      if (app.ui.draft()?.category === 'shirt') doc.getElementById('fx-sheet-close')?.click();
      app.showPage('home');
      const tagline = doc.querySelector('.fx-tagline');
      if (tagline) tagline.textContent = 'Wardrobe photos + outfit feedback · Review version';
    }
    const observer = new MutationObserver(finish);
    frame.addEventListener('load', finish);
    setTimeout(() => {
      if (finished) return;
      frame.removeAttribute('data-ready');
      const status = document.getElementById('shirt-preview-status');
      status.hidden = false;
      document.getElementById('shirt-preview-message').textContent = 'Feedback controls did not finish loading. Reload without clearing website data.';
    }, 30000);
    observer.observe(frame, {attributes:true, attributeFilter:['data-ready']});
  } catch (error) {
    document.getElementById('shirt-preview-message').textContent = error.message;
    frame.setAttribute('aria-busy', 'false');
  }
})();
