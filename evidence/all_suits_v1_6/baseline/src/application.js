(function(root){
'use strict';
const $=id=>document.getElementById(id),clone=x=>structuredClone(x),node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const connection=root.HEWRSCleanConnection.create(root.HEWRS_INPUTS);
let backend;try{backend=root.localStorage;}catch{backend=null;}
const store=root.HEWRSLocalState.create(connection,root.HEWRS_INPUT_SHA256,backend);
const urlCache=new Map();
function resolveUrl(d){
 if(!Object.hasOwn(connection.assetPaths,d.sha256))throw Error('Unbound image hash; no fallback');
 if(root.HEWRS_EMBEDDED_IMAGES){if(!urlCache.has(d.sha256)){const b64=root.HEWRS_EMBEDDED_IMAGES[d.sha256];if(!b64)throw Error('Embedded image missing');urlCache.set(d.sha256,'data:image/png;base64,'+b64);}return urlCache.get(d.sha256);}
 return connection.assetPaths[d.sha256];
}
const renderer=root.HEWRSAtomicRenderer.create($('avatar'),connection,{resolveUrl});
const defaultSelection={suitId:'S05',shirtId:'DS036',state:'T017',shoeId:'shoe-8',watchId:null};
let current=null,score=null,origin='manual',mode='anchor',generation=0,lastRequest=null,options=[],report=null,pendingImport=null,detail=false,formLocalDate=localToday(),context={occasion:'clinic',requiredFormality:'any'};
let currentOption=null;
function localToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function ids(s){return s.suitId+' · '+s.shirtId+' · '+s.state;}
function status(text){$('status').textContent=text;}
function updateStoreViews(){const s=store.snapshot(),st=store.status();$('wear-count').textContent=String(s.events.length);$('storage-banner').textContent=st.blocked||(st.persistent?'Saved in this browser’s separate candidate namespace.':'Session memory only. Persistent storage is unavailable; export to retain data.');$('backup-status').textContent=$('storage-banner').textContent+' No production data is accessed.';
 const list=$('history-list');list.replaceChildren();if(!s.events.length)list.append(node('div','No wear recorded here. Generating or viewing an outfit never adds a wear event.','empty'));
 for(const e of [...s.events].reverse()){const card=node('article',undefined,'card');card.append(node('div',e.localDate+' · '+e.origin,'card-id'),node('p',ids(e.canonical_selection)),node('p',e.items.shoes.id+(e.items.watch?' · '+e.items.watch.id:''),'caption'));const b=node('button','View recorded selection');b.onclick=()=>{showPage('home');apply(e.canonical_selection,{origin:'manual',localDate:e.localDate});};card.append(b);list.append(card);}}
function showPage(name){for(const id of ['home','outfits','wardrobe','rotation'])$('page-'+id).hidden=name!==id;for(const b of document.querySelectorAll('[data-page]')){if(b.dataset.page===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}if(name==='wardrobe')renderWardrobe();if(name==='rotation')updateStoreViews();}
function setMode(value){mode=value;for(const k of ['engine','anchor'])$('mode-'+k).setAttribute('aria-pressed',String(value===k));}
function selectOption(select,value){if([...select.options].some(x=>x.value===value))select.value=value;}
function fill(select,rows,value){select.replaceChildren();for(const r of rows){const o=new Option(r.label,r.value);if(r.disabled)o.disabled=true;select.add(o);}if(value!==undefined)selectOption(select,value);}
function shirtChoices(){const a=connection.manifest.shirt_order.map(id=>({value:id,label:id+' — '+connection.records[id].label}));return mode==='engine'?[{value:'ANY',label:'Engine chooses shirt'},...['white','cream','blue','navy','pink','lavender','brown','grey','black'].map(f=>({value:'FAMILY:'+f,label:f+' family'})),...a]:a;}
function tieChoices(){const noTie=connection.records[$('shirt-select').value]?.no_tie_only;let a=[{value:'NO_TIE',label:'No tie'}];if(!noTie){a.push(...Object.keys(connection.manifest.ties).map(id=>({value:id,label:id+' — '+connection.features.get(id).description})));if(mode==='engine')a=[{value:'ANY',label:'Engine chooses tie / no tie'},...['navy','burgundy','grey','blue','pink','brown','gold'].map(f=>({value:'FAMILY:'+f,label:f+' family'})),...a];}const old=$('tie-select').value;fill($('tie-select'),a,old||'T017');if(noTie)$('tie-select').value='NO_TIE';}
function openControls(){
 $('selection-heading').textContent=mode==='engine'?'Engine selection':'Anchor selection';$('selection-help').textContent=mode==='engine'?'Rank supported clothing combinations around your selected anchors. Accessories remain exact selections.':'Choose exact pieces. A score-source hold never blocks the approved visual.';
 const currentSuit=current?.suitId||'S05';
 const suitRows=connection.suitSources.ids.map(id=>({value:id,label:id+' — '+(connection.features.get(id)?.description||id)+(connection.assemblies.widerDS035SuitIds.includes(id)?' [DS035 only]':'')}));
 fill($('suit-select'),suitRows,currentSuit);
 // Preserve a prior explicit DS035 anchor when opening Engine from a wider suit.
 // Changing suits in an open dialog never changes the selected shirt.
 const keepWiderAnchor=connection.assemblies.widerDS035SuitIds.includes(currentSuit)&&current?.shirtId==='DS035';
 fill($('shirt-select'),shirtChoices(),mode==='engine'&&!keepWiderAnchor?'ANY':current?.shirtId||'DS036');tieChoices();selectOption($('tie-select'),mode==='engine'?'ANY':current?.state||'T017');
 fill($('shoe-select'),Object.keys(connection.shoeLayers).map(id=>({value:id,label:id+' — '+connection.catalogue.shoes.find(s=>s.id===id).name})),current?.shoeId||'shoe-8');
 fill($('watch-select'),[{value:'',label:'No watch selected'},...connection.catalogue.watches.map(w=>({value:w.id,label:w.id+' — '+w.name}))],current?.watchId||'');
 $('occasion-select').value=context.occasion;$('formality-select').value=context.requiredFormality;$('local-date').value=formLocalDate;
 $('style-select').disabled=mode!=='engine';$('apply-selection').textContent=mode==='engine'?'Generate outfits':'Show selection';$('selection-error').textContent='';syncCoverageControls();$('selection-dialog').showModal();
}
function syncCoverageControls(){
 const sid=$('suit-select').value,wider=connection.assemblies.widerDS035SuitIds.includes(sid);
 for(const option of $('shirt-select').options)option.disabled=wider&&option.value!=='DS035';
 const invalid=!sid||(wider&&$('shirt-select').value!=='DS035');
 $('apply-selection').disabled=invalid;
 $('selection-error').textContent=invalid?(wider?'Select DS035 for this wider-opening suit. Your displayed outfit has not changed.':'Select a connected suit.'):'';
}
function sessionValue(s,o,localDate,c){return {selection:clone(s),origin:o,mode,localDate,context:clone(c)};}
async function apply(s,opts={}){
 const token=opts.token??++generation;if(opts.token===undefined)renderer.cancel();
 try{connection.validateSelection(s);}catch(e){status(e.message);throw e;}
 $('stage').classList.add('busy');$('record-wear').disabled=true;status(current?'Loading selection; previous complete outfit remains visible.':'Loading approved source layers…');
 try{const result=await renderer.render(s);if(token!==generation||result.cancelled)return {cancelled:true};
  current=clone(s);origin=opts.origin||'manual';context=clone(opts.context||context);formLocalDate=opts.localDate||formLocalDate;
  currentOption=opts.option||null;score=opts.score||connection.scoreSelection(s,context);
  $('selection-ids').textContent=ids(s);$('selection-origin').textContent=origin==='engine'?(currentOption?._hewrsConnected.is_recommendation?'Local rotation choice':'Compatibility option'):'Your selection';
  const n=Number.isFinite(score?.display_score)?' · computed '+score.display_score.toFixed(2)+'/10':'';
  status(connection.records[s.shirtId].label+(score?.candidate_eligible?n:' · '+(score?.status||'unscored')));
  const shoe=connection.catalogue.shoes.find(x=>x.id===s.shoeId);
  $('representation').textContent='Rendered: '+s.shoeId+' · '+shoe.name+(s.watchId?' | '+s.watchId+' selected, not rendered.':' | No watch selected.');
  $('record-wear').disabled=s.state==='REFERENCE';
  if(opts.save!==false){try{store.saveSession(sessionValue(s,origin,formLocalDate,context));}catch(e){status('Visual ready. '+e.message);}}
  updateStoreViews();return result;
 }catch(e){if(token===generation){status('Selection not applied: '+e.message+'. Previous outfit retained.');$('record-wear').disabled=true;}throw e;}
 finally{if(token===generation)$('stage').classList.remove('busy');}
}
function renderResults(){
 const list=$('results');list.replaceChildren();
 if(!options.length){list.append(node('div',report?.reason||'No scored candidate for these locks. Manual preview remains available; nothing is substituted.','empty'));return;}
 for(const [i,o]of options.entries()){
  const b=connection.selectionFromOption(o,lastRequest),r=o._hewrsConnected.compatibility,card=node('article',undefined,'card');
  card.append(node('span',r.display_score.toFixed(2),'score'),node('div',b.selection.suitId+' · '+b.selection.shirtId+' · '+b.selection.state,'card-id'),node('p',connection.records[b.selection.shirtId].label),node('p',b.display.tie),node('p',(o._hewrsConnected.is_recommendation?'Local rotation choice':'Compatibility option')+' · '+r.style.classification,'caption'));
  const btn=node('button','View this outfit');btn.onclick=async()=>{try{showPage('home');await apply(b.selection,{origin:'engine',option:o,score:r,context:lastRequest.context,localDate:lastRequest.localDate});}catch(e){status(e.message);}};card.append(btn);list.append(card);
 }
}
async function generate(c){
 const q=connection.makeRequest(c),token=++generation;renderer.cancel();lastRequest=clone(q);options=[];report=null;currentOption=null;
 $('stage').classList.add('busy');$('record-wear').disabled=true;status('Evaluating supported clothing combinations…');
 try{
  const r=await connection.controller.generateAsync(q,connection.catalogue,store.snapshot().events,{isCancelled:()=>token!==generation,onProgress:x=>{if(token===generation)status('Evaluating '+x.examined+' clothing combinations; current frame retained.');}});
  if(token!==generation||r.status==='cancelled')return {cancelled:true};report=r;options=r.options||[];renderResults();
  const d=r.diagnostics||{};const holds=Object.entries(d.states||{}).filter(([s])=>['conflict','premise_mismatch','unknown','canonical_data_hold'].includes(s)).reduce((n,[,v])=>n+v,0);
  $('outfit-summary').textContent=options.length+' options from '+(d.examined||0)+' evaluated combinations. '+holds+' source-held combinations were not assigned a score. Only this candidate’s local history is used.';
  if(options.length){const o=options[0],b=connection.selectionFromOption(o,q);await apply(b.selection,{token,origin:'engine',option:o,score:o._hewrsConnected.compatibility,context:q.context,localDate:q.localDate});}
  else{status('No scored result for these locks. Use Anchor to view the exact approved selection.');showPage('outfits');}
  return r;
 }finally{if(token===generation)$('stage').classList.remove('busy');}
}
function invalidateRecommendations(){options=[];report=null;lastRequest=null;currentOption=null;origin='manual';$('selection-origin').textContent='Your selection';$('outfit-summary').textContent='Local wear history changed. Generate again before using a rotation recommendation.';renderResults();}
function cancel(){generation++;renderer.cancel();$('stage').classList.remove('busy');$('record-wear').disabled=!current||current.state==='REFERENCE';status('Pending work cancelled; last complete outfit retained.');}
function renderWardrobe(){
 const group=$('wardrobe-category').value,term=$('wardrobe-search').value.trim().toLowerCase();let rows=[];
 if(group==='shirts')rows=connection.manifest.shirt_order.map(id=>({id,label:connection.records[id].label,select:()=>({...current,shirtId:id,state:connection.records[id].no_tie_only?'NO_TIE':current.state==='REFERENCE'?'NO_TIE':current.state})}));
 else if(group==='ties')rows=Object.keys(connection.manifest.ties).map(id=>({id,label:connection.features.get(id).description,select:()=>({...current,state:id})}));
 else if(group==='shoes')rows=Object.keys(connection.shoeLayers).map(id=>({id,label:connection.catalogue.shoes.find(x=>x.id===id).name,select:()=>({...current,shoeId:id})}));
 else if(group==='watches')rows=connection.catalogue.watches.map(w=>({id:w.id,label:w.name+' · source metadata; no rendered watch layer',select:()=>({...current,watchId:w.id})}));
 else if(group==='suits')rows=connection.suitSources.ids.map(id=>({id,label:connection.features.get(id)?.description||id,record:connection.suitSources.resolveCanonical(id),registeredView:()=>openRegisteredView(id),select:connection.assemblies.supported(id,current?.shirtId,current?.state)?()=>({...current,suitId:id,state:current.state}):null}));
 else{const category=group;rows=connection.sourceBindings.items.filter(x=>x.category===category).map(r=>({id:r.item_id,label:connection.features.get(r.item_id)?.description||r.historical_cp98_metadata?.owner_correction||r.scope,record:r}));}
 const list=$('wardrobe-list');list.replaceChildren();for(const r of rows.filter(r=>(r.id+' '+r.label).toLowerCase().includes(term))){const card=node('article',undefined,'card');card.append(node('div',r.id,'card-id'),node('p',r.label));
  if(r.registeredView){const view=node('button','View saved suit assembly');view.onclick=r.registeredView;card.append(view);}
  const btn=node('button',r.select?'Use this selection':'Source binding');btn.onclick=async()=>{if(!r.select){$('details-text').textContent=JSON.stringify(r.record,null,2);$('details-dialog').showModal();return;}try{setMode('anchor');const s=r.select();connection.validateSelection(s);showPage('home');await apply(s,{origin:'manual'});}catch(e){status(e.message);$('details-text').textContent=e.message+'\nThe current outfit and all approved source assets are unchanged.';$('details-dialog').showModal();}};card.append(btn);list.append(card);
 }if(!list.children.length)list.append(node('div','No exact match in this source group.','empty'));
}
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
for(const b of document.querySelectorAll('[data-page]'))b.onclick=()=>showPage(b.dataset.page);
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
let registeredEpoch=0;
async function openRegisteredView(suitId){
 const token=++registeredEpoch,d=connection.assemblies.registeredView(suitId),dialog=$('registered-dialog'),im=$('registered-image');
 im.hidden=true;im.removeAttribute('src');$('registered-heading').textContent=suitId+' · saved suit assembly';
 $('registered-caption').textContent='Previously registered checkpoint-97 control: DS001 / T001 / shoe-8. This saved assembly uses its original control avatar. It is not the current selected outfit and cannot record wear.';
 $('registered-error').textContent='Loading saved assembly…';if(!dialog.open)dialog.showModal();
 try{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Saved assembly image could not load'));img.src=resolveUrl(d);});
  if(token!==registeredEpoch||!dialog.open)return;
  if(img.naturalWidth!==996||img.naturalHeight!==2748)throw Error('Wrong registered assembly dimensions');
  im.src=img.src;im.alt=suitId+' preserved DS001 / T001 registered control';im.hidden=false;$('registered-error').textContent='';
 }catch(e){if(token===registeredEpoch)$('registered-error').textContent=e.message;}
}
$('registered-dialog').addEventListener('close',()=>{registeredEpoch++;$('registered-image').removeAttribute('src');});
$('mode-engine').onclick=()=>{setMode('engine');openControls();};$('mode-anchor').onclick=()=>{setMode('anchor');openControls();};$('open-controls').onclick=openControls;$('shirt-select').onchange=()=>{tieChoices();syncCoverageControls();};$('suit-select').onchange=syncCoverageControls;
$('full-view').onclick=()=>{detail=false;$('stage').classList.remove('detail');$('full-view').setAttribute('aria-pressed','true');$('detail-view').setAttribute('aria-pressed','false');};
$('detail-view').onclick=()=>{detail=true;$('stage').classList.add('detail');$('detail-view').setAttribute('aria-pressed','true');$('full-view').setAttribute('aria-pressed','false');};
$('apply-selection').onclick=async()=>{
 const config={suitId:$('suit-select').value,shirt:$('shirt-select').value,tie:$('tie-select').value,shoeId:$('shoe-select').value,watchId:$('watch-select').value||null,localDate:$('local-date').value,occasion:$('occasion-select').value,formality:$('formality-select').value,style:$('style-select').value};
 try{if(!root.HEWRSLocalState.date(config.localDate))throw Error('A valid local calendar date is required');if(mode==='anchor'){const s={suitId:config.suitId,shirtId:config.shirt,state:config.tie,shoeId:config.shoeId,watchId:config.watchId};connection.validateSelection(s);$('selection-dialog').close();showPage('home');await apply(s,{origin:'manual',localDate:config.localDate,context:{occasion:config.occasion,requiredFormality:config.formality}});}else{connection.makeRequest(config);$('selection-dialog').close();showPage('home');await generate(config);}}catch(e){$('selection-error').textContent=e.message;status(e.message);}
};
$('cancel-work').onclick=()=>{cancel();$('selection-dialog').close();};
$('wardrobe-category').onchange=renderWardrobe;$('wardrobe-search').oninput=renderWardrobe;
$('details-button').onclick=()=>{$('details-text').textContent=JSON.stringify({selection:current,history_ids:current?connection.historyIds(current):null,compatibility:score,limits:connection.limits,source_lock:root.HEWRS_INPUT_SHA256,history_scope:store.status(),source_metadata_notice:'Historical source-approval labels are preserved provenance, not a new approval queue.'},null,2);$('details-dialog').showModal();};
$('record-wear').onclick=()=>{if(!current)return;$('wear-description').textContent=ids(current)+' · '+current.shoeId+(current.watchId?' · '+current.watchId+' (selection record only)':'')+(origin==='engine'&&!currentOption?._hewrsConnected?.is_recommendation?' · This option was not selected by local rotation. Confirmation records your manual choice.':'');$('wear-date').value=formLocalDate;$('repeat-incident').checked=false;$('wear-error').textContent='';$('wear-dialog').showModal();};
$('confirm-wear').onclick=()=>{try{const d=$('wear-date').value;if(!root.HEWRSLocalState.date(d))throw Error('Invalid wear date');const id='wear_'+(root.crypto?.randomUUID?.()||Date.now()+'_'+Math.random().toString(16).slice(2));store.addEvent(connection.createHistoryEvent(current,{id,localDate:d,origin:origin==='engine'?'engine':'manual',controlledRepetition:$('repeat-incident').checked}));invalidateRecommendations();$('wear-dialog').close();updateStoreViews();status(store.status().persistent?'Wear recorded in this browser’s separate local ledger.':'Wear recorded in memory only; export is required to retain it.');}catch(e){$('wear-error').textContent=e.message;}};
$('data-button').onclick=()=>{updateStoreViews();$('backup-dialog').showModal();};$('export-backup').onclick=()=>download('HEWRS_LOCAL_BACKUP_'+localToday()+'.json',store.exportText());
$('backup-file').onchange=async()=>{pendingImport=null;$('confirm-restore').disabled=true;$('backup-error').textContent='';$('import-preview').hidden=true;try{const f=$('backup-file').files[0];if(!f)return;pendingImport=store.previewImport(await f.text());$('import-preview').textContent=JSON.stringify({source_lock_matches:true,current_records:store.snapshot().events.length,backup_records:pendingImport.events.length,selection:pendingImport.session?.selection||null,action:'Replace only this candidate namespace after confirmation. No legacy history migration.'},null,2);$('import-preview').hidden=false;$('confirm-restore').disabled=false;}catch(e){$('backup-error').textContent=e.message;}};
$('confirm-restore').onclick=async()=>{try{if(!pendingImport)throw Error('No validated backup');store.restore(pendingImport);invalidateRecommendations();pendingImport=null;$('confirm-restore').disabled=true;$('backup-dialog').close();updateStoreViews();const s=store.snapshot().session;if(s){setMode(s.mode);await apply(s.selection,{origin:'manual',localDate:s.localDate,context:s.context,save:false});}status('Validated local backup restored. Existing production data was not accessed.');}catch(e){$('backup-error').textContent=e.message;}};
// Expose the exact application paths for reproducible tests; not an alternate
// test-only renderer or scorer. These methods perform the same UI operations.
root.HEWRSApp=Object.freeze({version:'HEWRS_CONNECTED_APP_V1_5',connection,store,renderer,apply,generate,cancel,showPage,setMode,
 state:()=>({selection:clone(current),origin,mode,report:clone(report),request:clone(lastRequest),optionCount:options.length,sourceLock:root.HEWRS_INPUT_SHA256}),resolveUrl});
updateStoreViews();const saved=store.snapshot().session;if(saved)setMode(saved.mode);
apply(saved?.selection||defaultSelection,{origin:'manual',localDate:saved?.localDate||formLocalDate,context:saved?.context||context,save:false}).then(()=>{root.HEWRS_READY=true;if(saved)status('Saved selection restored from this candidate namespace; scores recomputed from current pinned inputs.');}).catch(e=>{status('Initial view failed: '+e.message);root.HEWRS_LOAD_ERROR=e.message;});
})(globalThis);
