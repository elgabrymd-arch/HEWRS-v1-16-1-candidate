/* Main-card rejection with explicit outfit, tie or shirt–tie scope.
 * Reasons never silently broaden scope. Original feedback remains unchanged.
 */
(function (root) {
  'use strict';
  const original = root.HEWRSApp, core = root.HEWRSRejectionPreviewCore;
  if (!original || !core || !root.HEWRS_READY) throw Error('The approved app must load before outfit feedback.');
  const F = root.HEWRSOutfitFeedback, fb = core.attach(original);
  const $ = id => document.getElementById(id);
  const element = (tag, text, className) => {const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(className)n.className=className; return n;};
  const button = (text, id, action) => {const b=element('button',text); b.type='button'; b.id=id; b.addEventListener('click',action); return b;};
  const reasons = [['','No reason supplied'],['colors','Color combination'],['patterns','Pattern combination'],['formality','Too formal / too casual'],['footwear','Shoes with this outfit'],['other','Other']];
  let pending = false, lastId = null, feedbackError = null, dialog = null, urls = [];
  const bar = element('section', undefined, 'hewrs-rejection-bar'); bar.id='rejection-bar';
  const notice = element('p','', 'fx-caption'); notice.id='rejection-status'; notice.setAttribute('role','status');
  const undoButton = button('Undo last rejection','undo-outfit-rejection',undoLast);
  const manageButton = button('Rejections · outfits and ties','manage-outfit-rejections',openManager);
  const retryButton = button('Retry rejection check','retry-rejection-check-outfits',()=>invalidateFeedback(true));
  retryButton.hidden=true;bar.append(notice,retryButton,undoButton,manageButton); $('outfit-output').after(bar);
  const rejectButton = button('Reject outfit + reason','reject-outfit',openReject);
  $('regenerate').before(rejectButton);
  const homeManage = button('Rejections · outfits and ties · undo / backup','home-outfit-rejections',openManager);
  homeManage.className='fx-wide-card'; $('page-home').append(homeManage);
  const homeFailure=element('section',undefined,'hewrs-rejection-bar');homeFailure.id='rejection-home-error';homeFailure.hidden=true;
  const homeNotice=element('p','','fx-warning');homeNotice.id='rejection-home-status';homeNotice.setAttribute('role','alert');
  const homeRetry=button('Retry rejection check','retry-rejection-check',()=>invalidateFeedback(true));
  homeFailure.append(homeNotice,homeRetry);homeManage.before(homeFailure);
  function say(text, error=false) {notice.textContent=text; notice.dataset.error=String(error);}
  function readFailure(error){feedbackError=error==null?null:String(error.message||error);original.setFeedbackReadError(feedbackError);}
  function failureMessage(){return 'Saved rejections could not be checked. Generation and outfit display are paused. '+feedbackError+' Existing records were retained.';}
  function currentAllowed(state) {
    if (feedbackError) return false;
    if (!state.selection || state.selection.state === 'REFERENCE') return true;
    return fb.allowed(state.selection, {...state.context, requiredFormality:state.context.formality});
  }
  function refreshControls() {
    feedbackError=original.feedbackReadError||null;
    const state=original.state(); let allowed=false;
    try {allowed=currentAllowed(state);} catch(error) {readFailure(error);}
    const output=$('outfit-output');
    if (!allowed) output.setAttribute('data-rejection-hidden','true');
    else output.removeAttribute('data-rejection-hidden');
    rejectButton.disabled=pending||state.busy||!state.selection||state.selection.state==='REFERENCE'||output.hidden||!allowed;
    undoButton.disabled=pending||!lastId||!!feedbackError;
    bar.hidden=!(state.selection||lastId||feedbackError);
    homeFailure.hidden=!feedbackError;homeNotice.textContent=feedbackError?failureMessage():'';
    retryButton.hidden=!feedbackError;retryButton.disabled=homeRetry.disabled=pending||state.busy;
    if(feedbackError){
      say(failureMessage(),true);
      for(const id of ['generate-options','regenerate','generate-current-selections','open-results','prev-option','next-option'])if($(id))$(id).disabled=true;
    }
  }
  function invalidateFeedback(retrying=false,reconcile=true) {
    const previousError=feedbackError||original.feedbackReadError;
    let failure=null;
    try {
      fb.refresh();readFailure(null);
    } catch(error) {failure=error;readFailure(error);}
    // Reconciliation also cancels any pending result. It must run even if the
    // first read failed, so an old list/render cannot continue in the background.
    if(reconcile||failure){try{original.rejectionChanged();}catch(error){failure=failure||error;readFailure(failure);}}
    if(!failure&&(retrying||previousError))say('Saved rejections were checked. Existing rules remain active. Generate when ready.');
    refreshControls();
    return !failure;
  }
  fb.subscribe(invalidateFeedback);
  root.addEventListener('hewrs:feedback-read-state',refreshControls);
  root.addEventListener('storage', event=>{if(event.key===null||(fb.prefixes||[fb.prefix]).some(prefix=>event.key?.startsWith(prefix)))invalidateFeedback();});
  function closeDialog() {if(dialog?.open)dialog.close();}
  function newDialog(title) {
    closeDialog(); if(dialog)dialog.remove(); for(const url of urls)URL.revokeObjectURL(url); urls=[];
    dialog=element('dialog',undefined,'hewrs-ui hewrs-rejection-dialog'); dialog.id='outfit-rejection-dialog';
    const heading=element('h2',title); heading.id='rejection-heading'; dialog.setAttribute('aria-labelledby',heading.id);
    const body=element('div',undefined,'hewrs-rejection-body'),actions=element('div',undefined,'hewrs-rejection-actions');
    const error=element('p','', 'fx-warning'); error.id='rejection-error';error.setAttribute('role','alert');
    dialog.append(heading,body,error,actions);document.body.append(dialog);
    dialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();});
    return {body,actions,error};
  }
  function select(id, title, rows) {
    const label=element('label',title),input=element('select');input.id=id;
    for(const [value,text]of rows){const option=element('option',text);option.value=value;input.append(option);}
    label.append(input); return {label,input};
  }
  function describe(s) {return [s.suitId||s.blazerId||'SHIRT ONLY',s.pantId,s.shirtId,s.state==='NO_TIE'?'No Tie':s.state,s.shoeId].filter(Boolean).join(' · ');}
  function describeScope(event) {
    if(event.scope==='tie')return 'Tie '+event.selection.state+' with any shirt or outfit';
    if(event.scope==='shirt_tie')return 'Shirt '+event.selection.shirtId+' + tie '+event.selection.state+' with any suit/blazer, trousers, shoes or watch';
    return event.scope==='clothing'?'Clothing combination, any shoes/watch':'Clothes and shoes, any watch';
  }
  function openReject() {
    const state=original.state(); if(pending||state.busy||!state.selection||state.selection.state==='REFERENCE')return;
    try{fb.refresh();if(!currentAllowed(state))return;}catch(error){readFailure(error);invalidateFeedback();return;}
    const selected=structuredClone(state.selection), key=F.key(selected,'historical_exact');
    const {body,actions,error}=newDialog('Reject this outfit');
    body.append(element('p',describe(selected),'fx-caption'),element('p','Choose exactly what to hide. Reasons add detail; they do not change an explicitly selected scope.','fx-caption'));
    const scopeRows=[['clothing','Entire clothing combination — any shoes or watch (default)'],['outfit','Only this exact clothing + shoe combination — any watch']];
    if(/^T\d{3}$/.test(selected.state))scopeRows.push(['shirt_tie','This shirt–tie pair: '+selected.shirtId+' + '+selected.state+' — with any outfit'],['tie','This tie itself: '+selected.state+' — with any shirt or outfit']);
    const scope=select('rejection-scope','What should be hidden?',scopeRows);
    const occasion=select('rejection-occasion','Where should it apply?',[['all','Every occasion'],['current','This occasion only ('+state.context.occasion+')']]);
    const scopeDescription=element('p','', 'fx-caption');scopeDescription.id='rejection-scope-description';
    body.append(scope.label,occasion.label,scopeDescription);
    let scopeChosen=false;
    function updateScopeDescription(){
      const target=describeScope({scope:scope.input.value,selection:selected});
      scopeDescription.textContent='Hide: '+target+'. Applies to '+(occasion.input.value==='all'?'every occasion':state.context.occasion)+'.';
    }
    scope.input.addEventListener('change',()=>{scopeChosen=true;updateScopeDescription();forever.disabled=!fb.persistentForScope(scope.input.value);});
    occasion.input.addEventListener('change',updateScopeDescription);updateScopeDescription();
    // These are explanatory diagnoses. Only the separate scope choice can
    // create an explicit tie or shirt–tie exclusion.
    // Keep stored v1 reason codes compatible with existing exports/validators.
    const issueChoices=[
      ['', 'Entire clothing combination is wrong', null, 'clothing'],
      ['shirt_tie_suit', 'Shirt and tie do not work with this suit/blazer', 'other', 'clothing'],
      ['tie_shirt', 'Shirt is fine; tie does not work with this shirt', 'other', 'clothing'],
      ['shirt_suit', 'Suit/blazer is fine; shirt does not work with it', 'other', 'clothing'],
      ['shirt_appearance', 'I do not like the shirt', 'other', 'clothing'],
      ['tie_suit', 'Suit/blazer is fine; tie does not work with it', 'other', 'clothing'],
      ['footwear', 'Shoes do not work with this outfit', 'footwear', 'outfit'],
      ['colors', 'Color combination does not work', 'colors', 'clothing'],
      ['patterns', 'Pattern combination does not work', 'patterns', 'clothing'],
      ['formality', 'Too formal or too casual', 'formality', 'clothing'],
      ['other', 'Other reason (describe below)', 'other', 'clothing']
    ];
    const issueFieldset=element('fieldset');issueFieldset.id='rejection-issues';
    issueFieldset.append(element('legend','What does not work? Select all that apply.'));
    const issueInputs=new Map();
    for(const [value,title] of issueChoices){
      const label=element('label',undefined,'hewrs-rejection-choice');
      const input=element('input');input.type='checkbox';input.value=value;
      input.id='rejection-issue-'+(value||'entire');input.checked=value==='';
      label.append(input,element('span',title));issueFieldset.append(label);
      issueInputs.set(value,input);
    }
    body.append(issueFieldset);
    const chosenIssues=()=>issueChoices.filter(([value])=>issueInputs.get(value).checked);
    const noteLabel=element('label','More detail (optional)'),note=element('textarea');note.id='rejection-note';note.rows=3;note.maxLength=500;
    note.placeholder='For example: this tie does not work with this shirt.';noteLabel.append(note);body.append(noteLabel);
    // Footwear-only dissatisfaction must NOT silently ban the clothing with all shoes.
    // The exact outfit scope preserves the suit, shirt and tie as reusable.
    for(const [value,input] of issueInputs){
      input.addEventListener('change',()=>{
        if(input.checked){
          if(value===''){
            for(const [other,box] of issueInputs)if(other!=='')box.checked=false;
          }else{
            issueInputs.get('').checked=false;
          }
        }
        if(!chosenIssues().length)issueInputs.get('').checked=true;
        // When shoes are among the issues, default to the narrower outfit scope.
        if(!scopeChosen)scope.input.value=chosenIssues().some(([id])=>id==='footwear')?'outfit':'clothing';
        updateScopeDescription();
      });
    }
    body.append(element('p','Reject once lasts until the next Generate or page reload. Never show again stays saved until Undo. A shirt–tie rejection keeps each item available with other partners. A tie rejection hides only the selected tie, within the occasion scope above. Remaining outfits are retained and replacements refill up to 20 when eligible choices exist.','fx-caption'));
    const cancel=button('Cancel','rejection-cancel',closeDialog);
    const once=button('Reject once','rejection-once',()=>commit(false));
    const forever=button('Never show again','rejection-permanent',()=>commit(true));forever.className='hewrs-rejection-primary';
    forever.disabled=!fb.persistentForScope(scope.input.value);actions.append(cancel,once,forever);
    async function commit(permanent) {
      if(pending)return;
      const now=original.state();
      if(now.busy||!now.selection||F.key(now.selection,'historical_exact')!==key){error.textContent='The displayed outfit changed. Close this panel and review the current outfit.';return;}
      const chosen=chosenIssues();
      const descriptions=chosen.filter(([id])=>id).map(([,label])=>label);
      const diagnosis=descriptions.length?(descriptions.length===1?'Issue: ':'Issues: ')+descriptions.join('; ')+'.':'';
      const savedNote=[diagnosis,note.value.trim()].filter(Boolean).join(' ');
      if(savedNote.length>500){
        error.textContent='Reasons and details exceed 500 characters. Shorten the optional note.';return;
      }
      // Schema v1 stores multiple reasons as one readable note, using "other".
      const reason=chosen.length===1?(chosen[0][2]||null):'other';
      pending=true;cancel.disabled=once.disabled=forever.disabled=true;error.textContent='';
      try {
        const settings={scope:scope.input.value,context:occasion.input.value==='all'?'all':state.context.occasion,reason,note:savedNote};
        const event=permanent?fb.hide(selected,settings):fb.skip(selected,settings);lastId=event.id;
        closeDialog();
        const prefix=permanent?'Rejection saved. ':'Rejected for this session. ';
        say(prefix+'Keeping the other outfits and finding replacements…');
        const result=await original.refillRejected();
        if(result?.cancelled) {
          say(prefix+'Replacement stopped because the current review changed. Your remaining outfits were retained.');
        } else {
          const count=result?.count??original.state().optionCount,target=result?.target??20;
          const addition=result?.added?result.added+' new outfit'+(result.added===1?'':'s')+' added. ':'';
          say(prefix+addition+count+' of '+target+' outfits available. '+(result?.reason||'Your other outfits and exact selections were retained.'));
        }
      } catch(problem) {
        error.textContent=problem.message;say(problem.message,true);
      } finally {pending=false;cancel.disabled=once.disabled=false;forever.disabled=!fb.persistentForScope(scope.input.value);refreshControls();}
    }
    dialog.showModal();scope.input.focus();
  }
  function undoLast() {
    if(pending||!lastId)return;
    try {const id=lastId;fb.restore(id);lastId=null;say('Rejection undone. Your current list is retained. This outfit, pair or tie can appear on your next Generate; other rejection rules still apply.');refreshControls();}
    catch(error){say(error.message,true);}
  }
  function openManager() {
    if(pending)return;
    const {body,actions,error}=newDialog('Rejected outfits and ties');
    body.append(element('p','Each saved rejection shows its exact scope and occasion. Backups include permanent outfit, shirt–tie and tie feedback with reasons. Temporary skips are not backed up. Older outfit backups keep their original meaning when imported.','fx-caption'));
    const list=element('div');list.id='rejection-records';body.append(list);
    function redraw() {
      list.replaceChildren();
      try {
        const snap=fb.refresh(),events=[...(snap.temporary||[]),...snap.active.slice().reverse()];
        if(!events.length)list.append(element('p','No active rejections.'));
        for(const event of events){
          const row=element('article',undefined,'hewrs-rejection-record');row.dataset.eventId=event.id;
          row.dataset.scope=event.scope;
          row.append(element('strong',event.scope==='tie'?'Tie '+event.selection.state:event.scope==='shirt_tie'?'Shirt '+event.selection.shirtId+' + tie '+event.selection.state:describe(event.selection)),element('p',(event.type==='temporary_skip'?'Temporary · ':'Saved · ')+(event.occasion==='all'?'Every occasion':event.occasion)+' · '+describeScope(event),'fx-caption'));
          if(event.reason)row.append(element('p',reasons.find(r=>r[0]===event.reason)?.[1]||event.reason));
          if(event.note)row.append(element('p',String(event.note),'hewrs-rejection-note'));
          row.append(button('Undo this rejection','undo-'+event.id,()=>{try{fb.restore(event.id);if(lastId===event.id)lastId=null;redraw();refreshControls();}catch(e){error.textContent=e.message;}}));
          list.append(row);
        }
      }catch(e){error.textContent=e.message;}
    }
    const exportButton=button('Export rejection backup','export-rejections',()=>{
      try{const data=fb.exportData(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));urls.push(url);const a=element('a','Save rejection backup');a.href=url;a.download='HEWRS_OUTFIT_AND_TIE_FEEDBACK.json';a.className='hewrs-rejection-download';body.append(a);}
      catch(e){error.textContent=e.message;}
    });
    const uploadLabel=element('label','Restore an existing rejection backup'),file=element('input');file.type='file';file.accept='.json,application/json';file.id='rejection-import-file';uploadLabel.append(file);
    const importButton=button('Import selected backup','import-rejections',async()=>{
      try{if(original.ownerFeedbackPersistent!==true)throw Error('Permanent storage is unavailable. Import was not attempted.');const picked=file.files[0];if(!picked)throw Error('Select a feedback JSON backup.');if(picked.size>5*1024*1024)throw Error('The feedback backup is too large.');const data=JSON.parse(await picked.text());fb.importData(data);redraw();error.textContent='';say('Feedback backup imported. Existing records were retained; conflicts are never silently overwritten.');}
      catch(e){error.textContent=e.message;}
    });
    body.append(exportButton,uploadLabel,importButton);actions.append(button('Close','rejections-close',closeDialog));redraw();dialog.showModal();
  }
  // Clear only ephemeral skips on an explicit new generation. Do not notify
  // synchronously here: native Regenerate must retain its producing request.
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#generate-options,#regenerate,#generate-current-selections')){fb.clearTemporary(false);if(lastId?.startsWith('skip_'))lastId=null;refreshControls();}
  },true);
  const observer=new MutationObserver(refreshControls);
  observer.observe($('avatar'),{attributes:true});
  observer.observe($('selection-ids'),{childList:true,subtree:true});
  observer.observe($('page-outfits'),{attributes:true,attributeFilter:['hidden']});
  observer.observe($('option-count'),{childList:true,subtree:true});
  // Compatibility aliases are installed before the reviewed panel captures app.
  // Both names point to exactly the same gate across the two feedback logs.
  root.HEWRSApp=Object.freeze({...original,ownerFeedback:fb,outfitFeedback:fb,hiddenOutfitsSheet:openManager,
    get ownerFeedbackPersistent(){return original.ownerFeedbackPersistent;},
    get feedbackReadError(){return original.feedbackReadError;},
    rejection:Object.freeze({open:openReject,manage:openManager,undo:undoLast,retry:()=>invalidateFeedback(true),revision:'rejection-read-failure-1'})});
  // A healthy first read must not cancel the automatic weather request that
  // application startup just began. Failed reads still cancel/reconcile.
  invalidateFeedback(false,false);
})(globalThis);
