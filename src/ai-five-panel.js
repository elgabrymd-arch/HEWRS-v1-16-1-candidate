/* Additive AI Five UI. The native twenty, approved renderer and saved records
 * remain owned by the existing app. All service access requires a user action. */
(function (root) {
  'use strict';
  const app = root.HEWRSApp, Flow = root.HEWRSAIFiveFlow, Native = root.HEWRSAIFiveNative;
  const Client = root.HEWRSAIFiveClient, doc = root.document;
  const host = doc?.getElementById('page-outfits');
  if (!host || !app || !Flow || !Native || !Client || root.HEWRSAIFivePanel) return;
  const make = (tag, text, cls) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const section = make('section', undefined, 'fx-card');
  section.id = 'hewrs-ai-five';
  section.style.cssText = 'margin:18px 0;padding:18px;display:grid;gap:12px;';
  const heading = make('h2', 'Five independent AI outfits');
  heading.style.margin = '0';
  const intro = make('p', 'Five new combinations from your wardrobe for the selected occasion. AI styling is independent of the current native options. Your existing rotation policy and explicit outfit rejections still apply.', 'fx-caption');
  const settings = make('details');
  const settingsTitle = make('summary', 'AI connection');
  const credentials = make('label', 'Private service access token');
  const tokenInput = make('input');
  tokenInput.type = 'password'; tokenInput.autocomplete = 'off'; tokenInput.id = 'ai-five-token';
  tokenInput.placeholder = 'Service token';
  credentials.append(tokenInput);
  const connect = make('button', 'Connect');
  connect.type = 'button'; connect.id = 'ai-five-connect';
  const disconnect = make('button', 'Disconnect');
  disconnect.type = 'button'; disconnect.id = 'ai-five-disconnect';
  settings.append(settingsTitle, credentials, connect, disconnect);
  const consentLabel = make('label', undefined, 'fx-check-row');
  const consent = make('input');
  consent.type = 'checkbox'; consent.id = 'ai-five-consent';
  consentLabel.append(consent, make('span', 'Allow a paid AI request when I select Generate AI Five.'));
  const button = make('button', 'Generate AI Five', 'fx-primary');
  button.type = 'button'; button.id = 'generate-ai-five';
  const cancel = make('button', 'Cancel generation');
  cancel.type = 'button'; cancel.id = 'cancel-ai-five'; cancel.hidden = true;
  const info = make('p', 'AI Five has not been generated.', 'fx-caption');
  info.id = 'ai-five-status'; info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite');
  const listing = make('div'); listing.id = 'ai-five-results';
  listing.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;';
  const preview = make('dialog');
  preview.id = 'ai-five-preview';
  preview.style.cssText = 'box-sizing:border-box;max-width:min(92vw,480px);max-height:92vh;max-height:92dvh;overflow:auto;border-radius:12px;padding:18px;';
  const previewTitle = make('h3'), previewImage = make('img');
  previewTitle.id = 'ai-five-preview-title'; preview.setAttribute('aria-labelledby', previewTitle.id);
  previewTitle.style.margin = '0 0 10px';
  previewImage.style.cssText = 'display:block;max-width:100%;max-height:calc(92vh - 150px);max-height:calc(92dvh - 150px);width:auto;height:auto;margin:0 auto;object-fit:contain;';
  const close = make('button', 'Close preview'); close.type = 'button';
  close.style.marginBottom = '10px';
  close.onclick = () => preview.close();
  preview.append(previewTitle, close, previewImage);
  section.append(heading, intro, settings, consentLabel, button, cancel, info, listing, preview);
  host.append(section);

  const feedback = app.outfitFeedback || app.ownerFeedback;
  let native, service, flow;
  let epoch = 0, last = null, pendingStamp = null, running = false;
  try {
    native = Native.create({app, feedback});
    service = Client.create({config:root.HEWRS_AI_FIVE_SERVICE_CONFIG});
    flow = Flow.create({read:native.read, service, validate:native.validate,
      ownerAllows:native.ownerAllows, rotationAllows:native.rotationAllows, verifyCurrent:native.assertCurrentAsync});
  } catch (error) {
    button.disabled = connect.disabled = true;
    info.textContent = 'AI Five unavailable: ' + error.message;
    return;
  }
  function buttons() {
    button.disabled = running || !service.configured();
    connect.disabled = running || !service.configured();
    tokenInput.disabled = !service.configured();
    consent.disabled = !service.configured();
    cancel.hidden = !running;
  }
  function active(result) {
    try { return Flow.signature(native.read()) === result.base_signature; }
    catch { return false; }
  }
  function eligible(result, selection) {
    try {
      return active(result) && native.validate(selection, result.context) &&
        native.ownerAllows(selection, result.context) &&
        native.rotationAllows(selection, native.read().request);
    } catch { return false; }
  }
  function clear(message) {
    epoch++; service.cancel(); last = null; pendingStamp = null; running = false;
    listing.replaceChildren();
    if (preview.open) preview.close();
    previewImage.removeAttribute('src');
    info.textContent = message; buttons();
  }
  function checkCurrent() {
    if (!last && !pendingStamp) return;
    let now;
    try { now = Flow.signature(native.read()); } catch { now = null; }
    if (now !== (last?.base_signature || pendingStamp))
      clear('The outfits, occasion, weather or saved records changed. Generate AI Five again.');
  }
  connect.onclick = async () => {
    const value = tokenInput.value; tokenInput.value = '';
    connect.disabled = true;
    try {
      const health = await service.connect(value);
      info.textContent = health.configured ? 'AI generation connected. Generate the native outfits, then select Generate AI Five.' :
        'Connected; generation is unavailable: ' + health.blocked_by.join(', ');
    } catch (error) { info.textContent = 'AI connection unavailable: ' + error.message; }
    finally { buttons(); }
  };
  disconnect.onclick = () => {
    service.disconnect(); consent.checked = false;
    clear('AI generation disconnected.');
  };
  cancel.onclick = () => clear('AI generation cancelled. A request already sent may still incur usage.');

  async function generate() {
    if (running) return;
    const ticket = ++epoch;
    last = null; listing.replaceChildren();
    if (preview.open) preview.close();
    running = true; buttons();
    try {
      if (!consent.checked) throw Error('Allow the paid request before generating AI Five.');
      const initial=await native.synchronize();
      if(ticket!==epoch)return;
      pendingStamp = Flow.signature(initial);
      info.textContent = 'Generating five independent outfits for ' + initial.request.context.occasion + '…';
      const result = await flow.generate({consent:true, isCancelled:() => ticket !== epoch});
      if (ticket !== epoch) return;
      if (!active(result)) throw Error('The native outfit list changed.');
      const views = [];
      for (const [i, item] of result.options.entries()) {
        if (ticket !== epoch || !eligible(result, item.selection))
          throw Error('An outfit is no longer eligible.');
        info.textContent = 'Preparing outfit ' + (i + 1) + ' of ' + result.options.length + '…';
        const picture = await app.renderForPreference(item.selection, () => ticket !== epoch);
        if (ticket !== epoch || !eligible(result, item.selection))
          throw Error('The outfit context changed during preview.');
        if (typeof picture?.full !== 'string' || !picture.full.startsWith('data:image/'))
          throw Error('The approved avatar preview was unavailable.');
        views.push({item, picture});
      }
      // Recheck every earlier candidate after the last asynchronous render.
      if (ticket !== epoch) return;
      await native.withCurrent(initial,()=>{
      if (ticket !== epoch || !active(result) || views.some(row => !eligible(result, row.item.selection)))
        throw Error('The outfits or saved records changed before display.');
      for (const [i, row] of views.entries()) {
        const card = make('article', undefined, 'fx-card');
        card.style.cssText = 'padding:12px;display:grid;gap:8px;justify-items:start;';
        const title = make('strong', (result.live_ai_used ? 'AI ' : 'Test fixture ') + (i + 1));
        const s = row.item.selection;
        const items = make('p', [s.suitId || s.blazerId || 'Shirt only', s.pantId,
          s.shirtId, s.state, s.shoeId, s.watchId].filter(Boolean).join(' · '), 'fx-caption');
        const image = make('img');
        image.src = row.picture.full; image.alt = 'Approved avatar wearing option ' + (i + 1);
        image.style.cssText = 'width:100%;max-width:220px;height:auto;';
        const caption = make('p', String(row.item.rationale || '').slice(0,600), 'fx-caption');
        const view = make('button', 'View full avatar');
        view.type = 'button'; view.dataset.aiFiveIndex = String(i);
        view.onclick = async () => {
          try {
            await native.withCurrent(initial,()=>{
              if(last!==result||!eligible(result,s))throw Error('This outfit is no longer current.');
              previewTitle.textContent = title.textContent + ' · ' + result.context.occasion;
              previewImage.src = row.picture.full; previewImage.alt = image.alt;
              if(!preview.open)preview.showModal();
            });
          } catch(error) {
            if(last===result)clear('This outfit is no longer current. Generate AI Five again.');
          }
        };
        card.append(title, items, image, caption, view); listing.append(card);
      }
      last = result; pendingStamp = null;
      const prefix = result.live_ai_used ? (result.cached ? 'Saved AI response: ' : '') : 'Test fixtures; no live AI generation: ';
      info.textContent = prefix + result.options.length + ' of five distinct outfits for ' + result.context.occasion + '. ' +
        (result.status === 'partial' ? 'The service did not return five eligible new combinations.' :
          'All five differ from the current native outfits.');
      });
    } catch (error) {
      if (ticket === epoch) {
        last = null; pendingStamp = null; listing.replaceChildren();
        info.textContent = 'AI Five unavailable: ' + String(error?.message || error);
      }
    } finally { if (ticket === epoch) { running = false; buttons(); } }
  }
  button.onclick = generate;
  const nativeSummary = doc.getElementById('outfit-summary');
  if (nativeSummary && root.MutationObserver)
    new MutationObserver(checkCurrent).observe(nativeSummary, {childList:true, characterData:true, subtree:true});
  feedback.subscribe?.(() => { if (last || running) clear('Outfit rejections changed. Generate AI Five again.'); });
  root.addEventListener?.('storage', checkCurrent);
  root.addEventListener?.('focus', checkCurrent);
  const deferredCheck = () => root.queueMicrotask(checkCurrent);
  doc.addEventListener('change', deferredCheck, true);
  doc.addEventListener('click', deferredCheck, true);
  buttons();
  if (!service.configured()) info.textContent = 'AI generation is not enabled in this development build.';
  root.HEWRSAIFivePanel = Object.freeze({
    generate, cancel:cancel.onclick,
    diagnostics:() => ({hasResult:!!last, configured:service.configured(), available:service.ready(),
      running, count:last?.options.length || 0, live_ai_used:last?.live_ai_used === true}),
    revision:'ai-five-independent-v3-bound'
  });
})(globalThis);
