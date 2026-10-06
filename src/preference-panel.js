/* Read-only rendering + explicit comparison writes only to the preference namespace.
 * Source snapshots, vote tokens and detached renderers prevent stale/race commits. */
(function(root){'use strict';
const copy=x=>structuredClone(x),node=(t,s,c)=>{const n=document.createElement(t);if(s!==undefined)n.textContent=s;if(c)n.className=c;return n;};
function create(h){const {connection,learning,openSheet,closeSheet,active,makeButton,selectField,onChanged,render,selectionItems}=h;let skipped=new Set(),followSkipped=new Set();
 const pilot=()=>root.HEWRS_PREFERENCE_PILOT;
 function data(){return learning.model(h.context());}
 function download(body,text,name){const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a','Save preference backup','lb-download');a.href=url;a.download=name;body.append(a);return()=>URL.revokeObjectURL(url);}
 function review(){let d;try{d=data();}catch(e){const {body,actions}=openSheet('Outfit preferences');body.append(node('p',e.message,'fx-warning'));actions.append(makeButton('Close',closeSheet));return;}
  let revoke=null;const {body,actions}=openSheet('Outfit preferences',{list:true,cancel:()=>revoke?.()});
  const m=d.model,state=d.state;body.append(node('p','Learning context: '+root.HEWRSStyleOccasions.labels[m.context_scope.occasion]+'. Other occasions remain separate; all saved records are retained.','fx-caption'));const title=node('h3',m.active?'Local learning is active':'Local learning');title.id='pref-learning-status';body.append(title,node('p',m.reason,'fx-caption'));
  const stats=node('p',`A/B preference ranking: ${m.relative_active?'active':'inactive'} · ${m.counts.informative}/8 informative decisions · ${m.counts.topwear_groups} training groups`,'fx-caption');stats.id='pref-learning-counts';body.append(stats);
  const ac=m.acceptability,accept=node('p',`Outfit acceptability: ${ac.active?'active':'inactive'} · ${ac.counts.positive} accepted / ${ac.counts.negative} rejected distinct training outfits · ${ac.counts.groups} groups`,'fx-caption');accept.id='pref-acceptability-status';body.append(accept,node('p',ac.reason,'fx-caption'));
  body.append(node('p',`${m.counts.validation} reserved comparisons are not fitted. Repeated identical outfit labels are counted once. Conflicting labels excluded from acceptance fit: ${ac.counts.conflicting_outfits}.`,'fx-caption'));
  body.append(node('p','Used only by Research-based wardrobe generator. Curated and live visual methods are not silently replaced.','fx-caption'));
  if(!learning.status().persistent)body.append(node('p','Session memory only: export these preferences before closing this page.','fx-warning'));
  body.append(node('p','Your wardrobe, original score history, Favorites and wear log are separate. Nothing learns from a viewed, skipped or unlogged outfit. No provider is contacted.','fx-caption'));
  body.append(node('p','Both work teaches that both complete outfits work; Neither works teaches that neither does. Prefer A/B is relative only and never labels the loser unacceptable. The A/B guard is unchanged. Acceptability has a separate balanced-evidence guard. Both adjustments together remain within ±0.35; they do not ban garments or claim improved taste.','fx-caption'));
  const done=new Set(state.comparisons.map(x=>x.pilot_id).filter(x=>pilot().records.some(p=>p.id===x)));
  const further=root.HEWRS_PREFERENCE_FOLLOWUP,followDone=state.comparisons.filter(x=>further.records.some(p=>p.id===x.pilot_id)).length;
  const follow=makeButton(`New shirt & complete-outfit comparisons (${followDone}/${further.records.length} saved)`,()=>{followSkipped=new Set();nextFollowup();},true);follow.id='pref-start-followup';body.append(follow,node('p','These Work-context reference comparisons are separate from Dinner/Weekend feedback, not a repeat of the 24 pilot comparisons. Six compare shirts and six compare finished looks; 8 train and 4 stay reserved. Existing answers are reused automatically.','fx-caption'));
  const start=makeButton(`Compare pilot outfits (${done.size}/24 saved)`,()=>{skipped=new Set();nextPilot();},true);start.id='pref-start-pilot';body.append(start);
  const current=makeButton('Compare two current options',chooseCurrent);current.id='pref-compare-current';body.append(current);
  const pause=makeButton(state.enabled?'Pause learned ranking':'Enable learned ranking',async()=>{await learning.exclusive(()=>learning.setEnabled(!state.enabled,d.token));onChanged();review();});pause.id='pref-learning-toggle';body.append(pause);
  const details=makeButton('Model details and held-out checks',()=>{const {body,actions}=openSheet('Preference model details',{list:true});body.append(node('p','Training A/B responses fit relative ranking; training Both/Neither responses fit separate complete-outfit acceptability. Reserved groups are never fitted. Check both channels separately; provisional validation is not an independent certification.','fx-caption'),node('pre',JSON.stringify(m,null,2)));actions.append(makeButton('Back',review));});details.id='pref-model-details';body.append(details);
  const exp=makeButton('Export outfit preferences',()=>{revoke?.();revoke=download(body,learning.exportText(),'HEWRS_OUTFIT_PREFERENCES_'+new Date().toISOString().slice(0,10)+'.json');});exp.id='pref-export';body.append(exp);
  const input=node('input');input.type='file';input.accept='.json,application/json';input.id='pref-import-file';input.setAttribute('aria-label','Import separate outfit preferences');input.onchange=async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>2500000)throw Error('Preference backup is too large');const p=learning.previewImport(await file.text());const {body,actions}=openSheet('Import outfit preferences',{list:true});body.append(node('p',`${p.added} new comparisons; ${p.already_saved} already saved. Existing learning on/off setting is retained. No wear or Favorites records are imported.`));actions.append(makeButton('Cancel',review),makeButton('Confirm preference merge',async()=>{await learning.exclusive(()=>learning.merge(p));onChanged();review();},true));}catch(e){h.error(e);}};body.append(node('label','Import a preference backup'),input);
  if(state.comparisons.length){const last=state.comparisons.at(-1),undo=makeButton('Undo last preference',()=>{const {body,actions}=openSheet('Undo last preference');body.append(node('p','Remove only the last saved comparison? No wear or Favorites will change.'));actions.append(makeButton('Cancel',review),makeButton('Confirm undo',async()=>{await learning.exclusive(()=>learning.undo(last.id,d.token));onChanged();review();}));});undo.id='pref-undo';body.append(undo);}
  body.append(node('p','S02 now uses the confirmed medium-brown source record. Its existing stronger-check artwork is unchanged, so S02 is excluded from appearance-preference learning.','fx-caption'));
  actions.append(makeButton('Close',closeSheet));
 }
 function nextPilot(){const d=data(),done=new Set(d.state.comparisons.map(x=>x.pilot_id).filter(Boolean));
  const r=pilot().records.find(x=>!done.has(x.id)&&!skipped.has(x.id));if(!r){const {body,actions}=openSheet('Comparison session finished');body.append(node('p','No unreviewed pilot pair remains in this session. Skipped pairs have no vote and remain available the next time you open the pilot.'));actions.append(makeButton('View learning status',review));return;}showPair(r,nextPilot,()=>{skipped.add(r.id);nextPilot();});
 }
 function nextFollowup(){const d=data(),done=new Set(d.state.comparisons.map(x=>x.pilot_id).filter(Boolean)),bank=root.HEWRS_PREFERENCE_FOLLOWUP;
  const r=bank.records.find(x=>!done.has(x.id)&&!followSkipped.has(x.id));
  if(!r){const {body,actions}=openSheet('New comparison session finished');body.append(node('p','No unanswered new pair remains in this session. Skipped pairs stay unanswered. Existing comparisons were not repeated or changed.'));actions.append(makeButton('View learning status',review));return;}
  showPair(r,nextFollowup,()=>{followSkipped.add(r.id);nextFollowup();});
 }
 function chooseCurrent(){const options=h.options().map(copy);if(options.length<2){const {body,actions}=openSheet('Compare current options');body.append(node('p','Generate at least two outfits, or use the pilot to compare source-verified alternatives.'));actions.append(makeButton('Back',review));return;}
  const {body,actions}=openSheet('Choose two outfits',{list:true});const choices=options.map((s,i)=>({value:String(i),label:`Option ${i+1} · ${s.suitId||s.blazerId} · ${s.shirtId} · ${s.state} · ${s.shoeId}`}));
  const a=selectField('A',choices,'0','pref-option-A'),b=selectField('B',choices,'1','pref-option-B');body.append(a.wrap,b.wrap);actions.append(makeButton('Cancel',review),makeButton('View comparison',()=>{
   const aa=options[+a.input.value],bb=options[+b.input.value];if(root.HEWRSOutfitLearning.selectionKey(aa)===root.HEWRSOutfitLearning.selectionKey(bb))throw Error('Choose two different outfits');const held=new Set(pilot().validation_topwear);showPair({id:null,a:aa,b:bb,context:h.context(),partition:held.has(aa.suitId||aa.blazerId)||held.has(bb.suitId||bb.blazerId)?'validation':'training'},chooseCurrent,review);
  },true));
 }
 async function showPair(pair,next,skip){const d=data(),p=copy(pair);let cancelled=false,ready=false;
  const {body,actions,token}=openSheet('Which complete outfit do you prefer?',{list:true,cancel:()=>{cancelled=true;}});
  const ok=()=>!cancelled&&active(token),bank=root.HEWRS_PREFERENCE_FOLLOWUP.records.some(x=>x.id===p.id)?root.HEWRS_PREFERENCE_FOLLOWUP:pilot();body.append(node('p',(p.partition==='validation'?'Reserved check: saved for evaluation, never fitted. ':'Training: A/B teaches relative preference; Both/Neither teaches complete-outfit acceptability. ')+(p.id?`${bank.records.findIndex(x=>x.id===p.id)+1} / ${bank.records.length}. `:'')+(p.focus?`Focus: ${p.focus==='shirt'?'only the shirt changes':p.focus==='whole_outfit'?'compare the complete looks':p.focus}.`:''),'fx-caption'));
  body.append(node('p','Occasion: '+root.HEWRSStyleOccasions.labels[root.HEWRSStyleOccasions.occasion(p.context.occasion)]+'. Weather-neutral styling comparison. Neither outfit is logged as worn. Method labels and calculated scores are hidden; image order does not imply a winner.','fx-caption'));
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
   const pk=root.HEWRSOutfitLearning.contextPairKey(p.a,p.b,p.context);if(d.state.comparisons.some(r=>root.HEWRSOutfitLearning.contextPairKey(r.a,r.b,r.context)===pk)){info.textContent='This exact pair already has saved feedback. No duplicate vote will be added.';return;}
   ready=true;for(const b of voteBtns)b.disabled=false;info.textContent='Both source renders loaded. Choose only when you have compared the complete looks.';
  }catch(e){if(ok())info.textContent='Comparison unavailable: '+e.message+'. No preference saved.';}
 }
 return Object.freeze({open:review,pilot:nextPilot,followup:nextFollowup,compare:chooseCurrent,showPair});
}
root.HEWRSPreferencePanel=Object.freeze({create});
})(globalThis);
