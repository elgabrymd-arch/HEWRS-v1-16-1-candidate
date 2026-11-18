/* Optional, additive AI Five panel. Original HEWRS 20/renderer remain unchanged.
 * No AI call is made automatically. No user storage is read or written except
 * read-only existing wear/owner-feedback checks. No provider API key is handled.
 */
(function (root) {
  'use strict';
  const app=root.HEWRSApp, Policy=root.HEWRSAIFiveExclusion, Flow=root.HEWRSAIFiveFlow;
  const host=root.document?.getElementById('page-outfits');
  if (!host || !app || !Policy || !Flow || root.HEWRSAIFivePanel) return;
  const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const section=make('section',undefined,'fx-card');section.id='hewrs-ai-five';
  section.style.cssText='margin:18px 0;padding:18px;display:grid;gap:12px;';
  const heading=make('h2','Five independent AI outfits');heading.style.margin='0';
  const intro=make('p','Generated separately from the current 20 HEWRS outfits. The AI uses your wardrobe and selected occasion, not your usual style ranking. No exact outfit is repeated with a watch change.','fx-caption');
  const button=make('button','Generate AI Five','fx-primary');button.type='button';button.id='generate-ai-five';
  const note=make('p','Requires 20 current HEWRS outfits and a connected, compatible secure AI proposal service. One provider request may incur a charge; none is made until you select Generate AI Five.','fx-caption');
  const info=make('p','AI Five has not been generated.','fx-caption');info.id='ai-five-status';info.setAttribute('role','status');info.setAttribute('aria-live','polite');
  const listing=make('div');listing.id='ai-five-results';listing.style.cssText='display:grid;gap:14px;';
  section.append(heading,intro,button,note,info,listing);
  host.append(section);
  const feedback=root.HEWRSRejectionPreviewCore?.attach?.(app)||app.ownerFeedback;
  let epoch=0, last=null;
  const read=()=>{const state=app.state();return {options:state.report?.options,request:state.request};};
  function active(result) {try{return Flow.signature(read())===result.base_signature;}catch{return false;}}
  function feedbackAllows(selection,context) {return feedback.match(selection,context).allowed===true;}
  function rotationAllows(selection,q) {
    const history=app.store.readForGeneration().events;
    const current=Date.parse(q.localDate+'T00:00:00Z');
    if (!Number.isFinite(current)) return false;
    const key=Policy.garmentKey(selection);
    for (const event of history) {
      if (!event?.confirmed || !event.canonical_selection) continue;
      const prior=Date.parse(event.localDate+'T00:00:00Z');
      const age=(current-prior)/86400000;
      if (age>=0 && age<=30 && Policy.garmentKey(event.canonical_selection)===key) return false;
    }
    return true;
  }
  const flow=Flow.create({read,service:app.visualStylist,
    validate(selection){try{app.connection.validateSelection(selection);return true;}catch{return false;}},
    ownerAllows:feedbackAllows,rotationAllows});
  function clear(text) {epoch++;last=null;listing.replaceChildren();info.textContent=text;button.disabled=false;}
  function noChanges(result,selection) {
    return active(result) && feedbackAllows(selection,result.context) &&
      rotationAllows(selection,read().request);
  }
  async function generate() {
    const ticket=++epoch;button.disabled=true;listing.replaceChildren();info.textContent='Checking the current HEWRS 20 and secure service…';
    try {
      const result=await flow.generate({isCancelled:()=>ticket!==epoch});
      if (ticket!==epoch) return;
      if (!active(result)) throw Error('The HEWRS list changed. Generate the native 20 again.');
      const views=[];
      for (let i=0;i<result.options.length;i++) {
        const item=result.options[i],s=item.selection;
        if (ticket!==epoch || !noChanges(result,s)) throw Error('The native outfits, rejections, or wear history changed before display');
        info.textContent='Rendering AI outfit '+(i+1)+' of '+result.options.length+' with the approved avatar…';
        const picture=await app.renderForStylist(s);
        if (ticket!==epoch || !noChanges(result,s)) throw Error('A candidate changed while rendering');
        views.push({item,picture});
      }
      if (ticket!==epoch) return;
      last=result;
      for (const [i,row] of views.entries()) {
        const card=make('article',undefined,'fx-card');card.style.cssText='padding:12px;display:grid;gap:8px;';
        const title=make('strong','AI '+(i+1)+' · '+[row.item.selection.suitId||row.item.selection.blazerId,row.item.selection.pantId,row.item.selection.shirtId,row.item.selection.state,row.item.selection.shoeId].filter(Boolean).join(' · '));
        const img=make('img');img.src=row.picture;img.alt='Actual HEWRS avatar wardrobe render of AI option '+(i+1);img.style.cssText='width:100%;max-width:280px;height:auto;';
        const caption=make('p',String(row.item.rationale||'AI candidate').slice(0,500),'fx-caption');
        const view=make('button','View on full avatar');view.type='button';view.dataset.aiFiveIndex=String(i);
        view.onclick=async()=>{
          try {
            if (!noChanges(result,row.item.selection)) throw Error('Outfit list or rejection history changed. Generate AI Five again.');
            view.disabled=true;
            // Preview only: original twenty choices, wear history, Favorites and
            // home preferences are not overwritten or re-generated.
            await app.apply(row.item.selection,{origin:'manual',save:false,keepPreferences:true,context:result.context});
            app.showPage('outfits');
            info.textContent='AI option '+(i+1)+' displayed. Original HEWRS 20 are retained.';
          } catch (e) {info.textContent=e.message;} finally {view.disabled=false;}
        };
        card.append(title,img,caption,view);listing.append(card);
      }
      info.textContent=result.options.length+' of five independent AI outfits returned. '+
        (result.status==='partial'?'The service did not provide five distinct, eligible looks. No HEWRS or invented fallback was used.':'All five are different from the current HEWRS twenty.');
    } catch (e) {if (ticket===epoch) {last=null;listing.replaceChildren();info.textContent='AI Five unavailable: '+String(e?.message||e);}}
    finally {if (ticket===epoch) button.disabled=false;}
  }
  button.onclick=generate;
  // A new native list or a new saved rejection invalidates the AI result.
  const nativeSummary=document.getElementById('outfit-summary');
  if (nativeSummary && root.MutationObserver) new MutationObserver(()=>{
    if (last && !active(last)) clear('The native HEWRS 20 changed; regenerate AI Five.');
  }).observe(nativeSummary,{childList:true,characterData:true,subtree:true});
  feedback.subscribe?.(()=>{if (last) clear('Owner rejection history changed; regenerate AI Five.');});
  root.addEventListener?.('storage',()=>{if (last) clear('Saved records changed in another tab; regenerate AI Five.');});
  root.HEWRSAIFivePanel=Object.freeze({generate,diagnostics:()=>({hasResult:!!last,available:!!app.visualStylist.ready(),count:last?.options?.length||0}),revision:'ai-five-isolated-v1'});
})(globalThis);