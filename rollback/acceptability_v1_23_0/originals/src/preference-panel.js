/* Read-only rendering + explicit comparison writes only to the preference namespace.
 * Source snapshots, vote tokens and detached renderers prevent stale/race commits. */
(function(root){'use strict';
const copy=x=>structuredClone(x),node=(t,s,c)=>{const n=document.createElement(t);if(s!==undefined)n.textContent=s;if(c)n.className=c;return n;};
function create(h){const {connection,learning,openSheet,closeSheet,active,makeButton,selectField,onChanged,render,selectionItems}=h;let skipped=new Set();
 const pilot=()=>root.HEWRS_PREFERENCE_PILOT;
 function data(){return learning.model();}
 function download(body,text,name){const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a','Save preference backup','lb-download');a.href=url;a.download=name;body.append(a);return()=>URL.revokeObjectURL(url);}
 function review(){let d;try{d=data();}catch(e){const {body,actions}=openSheet('Outfit preferences');body.append(node('p',e.message,'fx-warning'));actions.append(makeButton('Close',closeSheet));return;}
  let revoke=null;const {body,actions}=openSheet('Outfit preferences',{list:true,cancel:()=>revoke?.()});
  const m=d.model,state=d.state;const title=node('h3',m.active?'Local preference learning is active':'Local preference learning');title.id='pref-learning-status';body.append(title,node('p',m.reason,'fx-caption'));
  const stats=node('p',`${m.counts.informative} informative A/B choices · ${m.counts.topwear_groups} training topwear groups · ${m.counts.validation} validation records`,'fx-caption');stats.id='pref-learning-counts';body.append(stats);
  body.append(node('p','Used only by Research-based wardrobe generator. Curated and live visual methods are not silently replaced.','fx-caption'));
  if(!learning.status().persistent)body.append(node('p','Session memory only: export these preferences before closing this page.','fx-warning'));
  body.append(node('p','Your wardrobe, original score history, Favorites and wear log are separate. Nothing learns from a viewed, skipped or unlogged outfit. No provider is contacted.','fx-caption'));
  body.append(node('p','Ranking remains the baseline until at least 8 informative A/B choices cover 3 training topwear groups. Both work / Neither works are saved for review, not converted into invented preferences. The experimental adjustment is bounded to ±0.35; this is not proof of improved taste.','fx-caption'));
  const done=new Set(state.comparisons.map(x=>x.pilot_id).filter(Boolean));
  const start=makeButton(`Compare pilot outfits (${done.size}/24 saved)`,()=>{skipped=new Set();nextPilot();},true);start.id='pref-start-pilot';body.append(start);
  const current=makeButton('Compare two current options',chooseCurrent);current.id='pref-compare-current';body.append(current);
  const pause=makeButton(state.enabled?'Pause learned ranking':'Enable learned ranking',async()=>{await learning.exclusive(()=>learning.setEnabled(!state.enabled,d.token));onChanged();review();});pause.id='pref-learning-toggle';body.append(pause);
  const details=makeButton('Model details and held-out checks',()=>{const {body,actions}=openSheet('Preference model details',{list:true});body.append(node('p','Only training A/B comparisons fit coefficients. Reserved validation topwear is never used in fitting. A small validation count is not a certification.','fx-caption'),node('pre',JSON.stringify(m,null,2)));actions.append(makeButton('Back',review));});details.id='pref-model-details';body.append(details);
  const exp=makeButton('Export outfit preferences',()=>{revoke?.();revoke=download(body,learning.exportText(),'HEWRS_OUTFIT_PREFERENCES_'+new Date().toISOString().slice(0,10)+'.json');});exp.id='pref-export';body.append(exp);
  const input=node('input');input.type='file';input.accept='.json,application/json';input.id='pref-import-file';input.setAttribute('aria-label','Import separate outfit preferences');input.onchange=async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>2500000)throw Error('Preference backup is too large');const p=learning.previewImport(await file.text());const {body,actions}=openSheet('Import outfit preferences',{list:true});body.append(node('p',`${p.added} new comparisons; ${p.already_saved} already saved. Existing learning on/off setting is retained. No wear or Favorites records are imported.`));actions.append(makeButton('Cancel',review),makeButton('Confirm preference merge',async()=>{await learning.exclusive(()=>learning.merge(p));onChanged();review();},true));}catch(e){h.error(e);}};body.append(node('label','Import a preference backup'),input);
  if(state.comparisons.length){const last=state.comparisons.at(-1),undo=makeButton('Undo last preference',()=>{const {body,actions}=openSheet('Undo last preference');body.append(node('p','Remove only the last saved comparison? No wear or Favorites will change.'));actions.append(makeButton('Cancel',review),makeButton('Confirm undo',async()=>{await learning.exclusive(()=>learning.undo(last.id,d.token));onChanged();review();}));});undo.id='pref-undo';body.append(undo);}
  body.append(node('p','S02 now uses the confirmed medium-brown source record. Its existing stronger-check artwork is unchanged, so S02 is excluded from appearance-preference learning.','fx-caption'));
  actions.append(makeButton('Close',closeSheet));
 }
 function nextPilot(){const d=data(),done=new Set(d.state.comparisons.map(x=>x.pilot_id).filter(Boolean));
  const r=pilot().records.find(x=>!done.has(x.id)&&!skipped.has(x.id));if(!r){const {body,actions}=openSheet('Comparison session finished');body.append(node('p','No unreviewed pilot pair remains in this session. Skipped pairs have no vote and remain available the next time you open the pilot.'));actions.append(makeButton('View learning status',review));return;}showPair(r,nextPilot,()=>{skipped.add(r.id);nextPilot();});
 }
 function chooseCurrent(){const options=h.options().map(copy);if(options.length<2){const {body,actions}=openSheet('Compare current options');body.append(node('p','Generate at least two outfits, or use the pilot to compare source-verified alternatives.'));actions.append(makeButton('Back',review));return;}
  const {body,actions}=openSheet('Choose two outfits',{list:true});const choices=options.map((s,i)=>({value:String(i),label:`Option ${i+1} · ${s.suitId||s.blazerId} · ${s.shirtId} · ${s.state} · ${s.shoeId}`}));
  const a=selectField('A',choices,'0','pref-option-A'),b=selectField('B',choices,'1','pref-option-B');body.append(a.wrap,b.wrap);actions.append(makeButton('Cancel',review),makeButton('View comparison',()=>{
   const aa=options[+a.input.value],bb=options[+b.input.value];if(root.HEWRSOutfitLearning.selectionKey(aa)===root.HEWRSOutfitLearning.selectionKey(bb))throw Error('Choose two different outfits');const held=new Set(pilot().validation_topwear);showPair({id:null,a:aa,b:bb,context:h.context(),partition:held.has(aa.suitId||aa.blazerId)||held.has(bb.suitId||bb.blazerId)?'validation':'training'},chooseCurrent,review);
  },true));
 }
 async function showPair(pair,next,skip){const d=data(),p=copy(pair);let cancelled=false,ready=false;
  const {body,actions,token}=openSheet('Which complete outfit do you prefer?',{list:true,cancel:()=>{cancelled=true;}});
  const ok=()=>!cancelled&&active(token);body.append(node('p',(p.partition==='validation'?'Held-out comparison: saved for checking, not fitted. ':'Training comparison: only your explicit A/B choice can affect the local model. ')+(p.id?`${pilot().records.findIndex(x=>x.id===p.id)+1} / 24.`:''),'fx-caption'));
  body.append(node('p','Weather-neutral styling comparison. Neither outfit is logged as worn. Method labels and calculated scores are hidden; image order does not imply a winner.','fx-caption'));
  const grid=node('div',undefined,'pref-compare-grid');grid.id='pref-pair-grid';body.append(grid);const cards=[];
  for(const side of ['A','B']){const s=p[side.toLowerCase()],card=node('section',undefined,'pref-compare-card'),heading=node('h3','Outfit '+side),img=node('img');img.alt='Outfit '+side+' from your registered wardrobe';img.id='pref-image-'+side;card.append(heading,img);const toggle=makeButton('Collar detail',()=>{const detail=toggle.dataset.detail!=='true';toggle.dataset.detail=String(detail);img.src=detail?cards.find(x=>x.side===side).images.detail:cards.find(x=>x.side===side).images.full;toggle.textContent=detail?'Full outfit':'Collar detail';});toggle.disabled=true;card.append(toggle);
   const list=node('div',undefined,'pref-compare-items');for(const x of selectionItems(s))list.append(node('p',`${x.role}: ${x.id?x.id+' — ':''}${x.name}`));card.append(list);grid.append(card);cards.push({side,s,img,toggle,images:null});}
  const reasons=selectField('Reason (optional)',[{value:'no_reason',label:'No reason selected'},{value:'tie_dominant',label:'Tie dominance'},{value:'palette_disconnected',label:'Colors do not work together'},{value:'patterns_compete',label:'Patterns compete'},{value:'shoe_choice',label:'Shoes'},{value:'layers_not_distinct',label:'Layers not distinct'},{value:'other',label:'Other'}],'no_reason','pref-reason');body.append(reasons.wrap);
  const info=node('p','Loading both actual outfit renders…','fx-caption');info.id='pref-pair-status';body.append(info);
  const voteBtns=[];for(const [vote,label]of [['A','Prefer A'],['B','Prefer B'],['both','Both work'],['neither','Neither works']]){const btn=makeButton(label,async()=>{
   if(!ready||!ok())throw Error('Wait for both outfit images');
   const row={id:'pref_'+Date.now()+'_'+Math.random().toString(36).slice(2,11),created_at:new Date().toISOString(),a:p.a,b:p.b,vote,reason:reasons.input.value,partition:p.partition,pilot_id:p.id||null,context:p.context,source_revision:root.HEWRSSourceCorrections.revision};
   await learning.exclusive(()=>learning.add(row,d.token));ready=false;onChanged();for(const b of voteBtns)b.disabled=true;info.textContent=(learning.status().persistent?'Preference saved.':'Saved only in this tab’s session memory; export to retain it.')+' Wear history and Favorites were not changed.';const n=makeButton('Next comparison',next,true);n.id='pref-next';actions.replaceChildren(makeButton('Learning status',review),n);
  });btn.id='pref-vote-'+vote;btn.disabled=true;voteBtns.push(btn);actions.append(btn);}
  actions.append(makeButton('Skip without saving',skip),makeButton('Close',closeSheet));
  try{
   for(const card of cards){const images=await render(card.s,()=>!ok());if(!ok())return;card.images=images;card.img.src=images.full;card.toggle.disabled=false;await card.img.decode();}
   learning.assertCurrent(d.token);if(!ok())return;
   if(p.a.suitId==='S02'||p.b.suitId==='S02'){info.textContent='S02 cannot teach preferences until its known source/render mismatch is resolved. Your approved brown DNA is active; no vote will be saved.';return;}
   for(const s of [p.a,p.b]){const e=connection.hybrid.researchPreference.describeSelection(s,p.context);if(!e.eligible)throw Error('This comparison has an unresolved source or compatibility restriction: '+e.reason);}
   const pk=root.HEWRSOutfitLearning.pairKey(p.a,p.b);if(d.state.comparisons.some(r=>root.HEWRSOutfitLearning.pairKey(r.a,r.b)===pk)){info.textContent='This exact pair already has saved feedback. No duplicate vote will be added.';return;}
   ready=true;for(const b of voteBtns)b.disabled=false;info.textContent='Both source renders loaded. Choose only when you have compared the complete looks.';
  }catch(e){if(ok())info.textContent='Comparison unavailable: '+e.message+'. No preference saved.';}
 }
 return Object.freeze({open:review,pilot:nextPilot,compare:chooseCurrent,showPair});
}
root.HEWRSPreferencePanel=Object.freeze({create});
})(globalThis);
