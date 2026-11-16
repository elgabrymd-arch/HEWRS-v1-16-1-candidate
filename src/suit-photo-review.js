(function(){
 'use strict';
 const before={S02:'ui/suit-photo-review/602f0e20ad7c078df99c569c9f6dd0d5460e0ca1bf1b0fb64b0efacc88c87a11.png',S13:'ui/suit-photo-review/78665b0d498df9edb4b127661170468d482cd772b58b6be7ca6a7f33dc95c8fa.png'};
 const notes={S02:'The new reference shows a charcoal tone with a very quiet tonal check. Compare it with the previous brown, higher-contrast rendering.',S13:'The fabric has a grayer blue-charcoal tone and a finer, more regular plaid. Compare its color and check with the previous softer rendering.'};
 const manifest=globalThis.HEWRS_SUIT_PICKER_IMAGES;
 let selected=new URLSearchParams(location.search).get('item')==='S13'?'S13':'S02';let mode='corrected';
 const el=id=>document.getElementById(id);
 function render(){
  const item=manifest?.items?.[selected];
  if(!item||item.source_kind!=='corrected_avatar_preview'){el('image-error').hidden=false;el('image-error').textContent='This correction is unavailable in this version.';return;}
  const src=mode==='corrected'?item.src:before[selected];
  for(const id of ['full-image','detail-image']){const img=el(id);img.alt=selected+' — '+(mode==='corrected'?'photo-matched candidate':'previous native rendering')+(id==='detail-image'?', fabric detail':', frozen avatar');img.src=src;img.onerror=()=>{el('image-error').hidden=false;};}
  el('image-error').hidden=true;el('suit-title').textContent=selected;el('suit-description').textContent=item.label;
  el('full-caption').textContent=mode==='corrected'?'Corrected preview · full outfit':'Previous rendering · full outfit';
  el('review-status').textContent=mode==='corrected'?'Awaiting your review':'Previous rendering';
  el('comparison-note').textContent=notes[selected];el('full-size-link').href=src;el('picker-link').href='blazer-picker-preview.html?show=suits&item='+selected;
  document.querySelectorAll('[data-suit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.suit===selected)));
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 }
 document.querySelectorAll('[data-suit]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.suit;mode='corrected';history.replaceState(null,'','?item='+selected);render();}));
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;render();}));
 render();
})();
