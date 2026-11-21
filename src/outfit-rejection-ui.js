/* Main-card rejection with explicit outfit, item and garment-pairing scopes.
 * Conflicting diagnoses require an explicit scope. Existing records retain
 * their original meaning; reasons are never retroactively reinterpreted.
 */
(function (root) {
  'use strict';
  const original = root.HEWRSApp, core = root.HEWRSRejectionPreviewCore;
  if (!original || !core || !root.HEWRS_READY) throw Error('The approved app must load before outfit feedback.');
  const F = root.HEWRSOutfitFeedback, fb = core.attach(original);
  const $ = id => document.getElementById(id);
  const element = (tag, text, className) => {const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(className)n.className=className; return n;};
  const button = (text, id, action) => {const b=element('button',text); b.type='button'; b.id=id; b.addEventListener('click',event=>{Promise.resolve().then(()=>action(event)).catch(error=>say(error.message,true));}); return b;};
  const reasons = [['','No reason supplied'],['colors','Color combination'],['patterns','Pattern combination'],['formality','Too formal / too casual'],['footwear','Shoes with this outfit'],['other','Other']];
  let pending = false, lastId = null, feedbackError = null, dialog = null, urls = [], noticeKind = 'action';
  let booting=true, checking=false, validationTask=null, validationRequested=false, reconcileRequested=false, retryRequested=false,managerRefresh=null;
  let deferredFeedback=false,handledFeedbackToken=null;
  const PAGE_SIZE=50, MAX_BACKUP_BYTES=64*1024*1024;
  const bar = element('section', undefined, 'hewrs-rejection-bar'); bar.id='rejection-bar';
  const notice = element('p','', 'fx-caption'); notice.id='rejection-status'; notice.setAttribute('role','status');
  const undoButton = button('Undo last rejection','undo-outfit-rejection',undoLast);
  const manageButton = button('Rejections · outfits and items','manage-outfit-rejections',openManager);
  const retryButton = button('Retry rejection check','retry-rejection-check-outfits',()=>invalidateFeedback(true));
  retryButton.hidden=true;bar.append(notice,retryButton,undoButton,manageButton); $('outfit-output').after(bar);
  const rejectButton = button('Reject outfit + reason','reject-outfit',openReject);
  $('regenerate').before(rejectButton);
  const homeManage = button('Rejections · outfits and items · undo / backup','home-outfit-rejections',openManager);
  homeManage.className='fx-wide-card'; $('page-home').append(homeManage);
  const homeFailure=element('section',undefined,'hewrs-rejection-bar');homeFailure.id='rejection-home-error';homeFailure.hidden=true;
  const homeNotice=element('p','','fx-warning');homeNotice.id='rejection-home-status';homeNotice.setAttribute('role','alert');
  const homeRetry=button('Retry rejection check','retry-rejection-check',()=>invalidateFeedback(true));
  homeFailure.append(homeNotice,homeRetry);homeManage.before(homeFailure);
  const migrationNotice=element('p','','fx-caption');migrationNotice.id='rejection-migration-notice';migrationNotice.hidden=true;homeManage.before(migrationNotice);
  function say(text, error=false, kind='action') {notice.textContent=text; notice.dataset.error=String(error);noticeKind=kind;}
  function readFailure(error){feedbackError=error==null?null:String(error.message||error);original.setFeedbackReadError(feedbackError);}
  function failureMessage(){return 'Saved rejections could not be checked. Generation and outfit display are paused. '+feedbackError+' Existing records were retained.';}
  function currentAllowed(state) {
    if (feedbackError) return false;
    if (!state.selection || state.selection.state === 'REFERENCE') return true;
    return fb.allowed(state.selection, {...state.context, requiredFormality:state.context.formality});
  }
  function refreshControls() {
    feedbackError=original.feedbackReadError||null;
    const readiness=fb.status?.(),loading=readiness?.loading===true||(booting&&readiness?.ready===false&&!readiness?.blocked);
    const state=original.state(); let allowed=false;
    try {if(!loading)allowed=currentAllowed(state);} catch(error) {readFailure(error);}
    const output=$('outfit-output');
    if (!allowed) output.setAttribute('data-rejection-hidden','true');
    else output.removeAttribute('data-rejection-hidden');
    rejectButton.disabled=pending||checking||loading||state.busy||!state.selection||state.selection.state==='REFERENCE'||output.hidden||!allowed;
    undoButton.disabled=pending||checking||loading||!lastId||!!feedbackError;
    manageButton.disabled=homeManage.disabled=pending||checking||loading;
    bar.hidden=!(state.selection||lastId||feedbackError||loading);
    homeFailure.hidden=!(feedbackError||loading);homeNotice.textContent=loading?'Loading saved rejections…':feedbackError?failureMessage():'';
    retryButton.hidden=!feedbackError||loading;homeRetry.hidden=loading;retryButton.disabled=homeRetry.disabled=pending||checking||state.busy;
    if(feedbackError||loading||pending||checking){
      if(loading)say('Loading saved rejections…',false,'availability');else if(feedbackError)say(failureMessage(),true,'availability');
      for(const id of ['generate-options','regenerate','generate-current-selections','open-results','prev-option','next-option'])if($(id))$(id).disabled=true;
    }else if(noticeKind==='availability')say('Saved rejections checked.');
  }
  async function synchronize(options) {
    if(fb.sync)await fb.sync(options);
    const snapshot=fb.refresh();readFailure(null);return snapshot;
  }
  function feedbackChanged(){
    const readiness=fb.status?.();
    if(readiness&&(!readiness.ready||readiness.blocked||readiness.stale||readiness.loading)){
      // The database owns refresh after invalidation. A loading/error notice
      // must only guard the UI: starting another sync here retries corruption
      // forever through the loading -> error -> loading notification cycle.
      if(pending)deferredFeedback=true;
      if(!booting||!readiness.loading)readFailure(readiness.blocked||'Saved rejections changed or are still loading. Retry the rejection check.');
      refreshControls();return;
    }
    if(pending){deferredFeedback=true;return;}
    try{
      const token=fb.token();
      if(token===handledFeedbackToken&&!original.feedbackReadError)return;
      if(validationTask){reconcileRequested=reconcileRequested||!booting;return;}
      // Successful notifications already describe a validated cached revision.
      // Reconcile it synchronously so no late subscriber cancels a mutation's
      // replacement work, and never enqueue a second database refresh.
      readFailure(null);
      if(!booting)original.rejectionChanged();
      handledFeedbackToken=token;
      managerRefresh?.();
    }catch(error){readFailure(error);}
    refreshControls();
  }
  async function prepareMutation(){if(validationTask)await validationTask;await synchronize();}
  async function reconcileMutation(){
    await synchronize();
    await original.rejectionChanged();
    handledFeedbackToken=fb.token();deferredFeedback=false;
  }
  function finishMutation(){
    pending=false;if(!original.feedbackReadError)readFailure(null);refreshControls();
    if(deferredFeedback){deferredFeedback=false;feedbackChanged();}
  }
  function invalidateFeedback(retrying=false,reconcile=true) {
    if(pending){deferredFeedback=true;return Promise.resolve(false);}
    validationRequested=true;reconcileRequested=reconcileRequested||reconcile;retryRequested=retryRequested||retrying;
    if(validationTask)return validationTask;
    validationTask=Promise.resolve().then(async()=>{
      const previousError=feedbackError||original.feedbackReadError;let failure=null;
      checking=true;refreshControls();
      try {
        // Store notifications can arrive during a durable read. Coalesce them
        // into this task; successful reads do not recursively start new tasks.
        do{
          validationRequested=false;
          try{await synchronize(retryRequested?{forceLegacy:true}:undefined);}catch(error){failure=error;readFailure(error);}
          const reconcileNow=reconcileRequested;reconcileRequested=false;
          if(reconcileNow||failure){try{await original.rejectionChanged();}catch(error){failure=failure||error;readFailure(failure);}}
          if(!failure)handledFeedbackToken=fb.token();
        }while(validationRequested&&!failure);
        if(!failure&&(retryRequested||previousError))say('Saved rejections were checked. Existing rules remain active. Generate when ready.');
        return !failure;
      }finally{
        checking=false;validationRequested=false;reconcileRequested=false;retryRequested=false;validationTask=null;
        if(!failure){
          readFailure(null);
          if(fb.status?.().migratedLegacyCount>0){migrationNotice.textContent='Your saved rejections were transferred. Reopen any older HEWRS tabs before using them so they can enforce new rejections too.';migrationNotice.hidden=false;}
        }
        if(!pending)managerRefresh?.();
        refreshControls();
      }
    });
    return validationTask;
  }
  fb.subscribe(feedbackChanged);
  root.addEventListener('hewrs:feedback-read-state',refreshControls);
  root.addEventListener('storage', event=>{if(event.key===null||(fb.prefixes||[fb.prefix]).some(prefix=>event.key?.startsWith(prefix)))feedbackChanged();});
  function closeDialog() {if(dialog?.open)dialog.close();}
  function newDialog(title) {
    managerRefresh=null;
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
    if(event.scope==='shirt')return 'Shirt '+event.selection.shirtId+' with any outfit';
    if(event.scope==='topwear_shirt')return (event.selection.suitId?'Suit '+event.selection.suitId:'Blazer '+event.selection.blazerId)+' + shirt '+event.selection.shirtId+' with any tie, trousers, shoes or watch';
    if(event.scope==='topwear_shirt_tie')return (event.selection.suitId?'Suit '+event.selection.suitId:'Blazer '+event.selection.blazerId)+' + shirt '+event.selection.shirtId+' + tie '+event.selection.state+' with any trousers, shoes or watch';
    if(event.scope==='tie')return 'Tie '+event.selection.state+' with any shirt or outfit';
    if(event.scope==='shirt_tie')return 'Shirt '+event.selection.shirtId+' + tie '+event.selection.state+' with any suit/blazer, trousers, shoes or watch';
    if(event.scope==='topwear_tie')return (event.selection.suitId?'Suit '+event.selection.suitId:'Blazer '+event.selection.blazerId)+' + tie '+event.selection.state+' with any shirt, trousers, shoes or watch';
    return event.scope==='clothing'?'Clothing combination, any shoes/watch':'Clothes and shoes, any watch';
  }
  async function openReject() {
    if(pending||checking)return;
    try{await synchronize();}catch(error){readFailure(error);refreshControls();return;}
    const state=original.state(); if(pending||state.busy||!state.selection||state.selection.state==='REFERENCE')return;
    try{if(!currentAllowed(state))return;}catch(error){readFailure(error);refreshControls();return;}
    const selected=structuredClone(state.selection), key=F.key(selected,'historical_exact');
    const {body,actions,error}=newDialog('Reject this outfit'),rejectionDialog=dialog;
    const hasShirt=/^DS\d{3}$/.test(selected.shirtId||''),hasTie=/^T\d{3}$/.test(selected.state),hasTopwear=!!(selected.suitId||selected.blazerId);
    body.append(element('p',describe(selected),'fx-caption'),element('p','A specific reason selects the item or pairing to hide. Reasons that describe different targets require a scope choice. Your explicit scope always takes priority.','fx-caption'));
    const scopeRows=[['clothing','Entire clothing combination — any shoes or watch (default)'],['outfit','Only this exact clothing + shoe combination — any watch']];
    if(hasShirt){
      scopeRows.push(['shirt','This shirt itself: '+selected.shirtId+' — with any outfit']);
      if(hasTopwear)scopeRows.push(['topwear_shirt','This suit/blazer–shirt pair: '+(selected.suitId||selected.blazerId)+' + '+selected.shirtId+' — with any tie']);
    }
    if(hasTie&&hasShirt){
      scopeRows.push(['shirt_tie','This shirt–tie pair: '+selected.shirtId+' + '+selected.state+' — with any outfit']);
      if(hasTopwear){
        scopeRows.push(['topwear_tie','This suit/blazer–tie pair: '+(selected.suitId||selected.blazerId)+' + '+selected.state+' — with any shirt']);
        scopeRows.push(['topwear_shirt_tie','This suit/blazer + shirt + tie: '+(selected.suitId||selected.blazerId)+' + '+selected.shirtId+' + '+selected.state+' — with any trousers or shoes']);
      }
      scopeRows.push(['tie','This tie itself: '+selected.state+' — with any shirt or outfit']);
    }
    const scope=select('rejection-scope','What should be hidden?',scopeRows);
    const unresolvedScope=element('option','Choose what this rejection should hide');unresolvedScope.value='';unresolvedScope.disabled=true;unresolvedScope.hidden=true;scope.input.prepend(unresolvedScope);scope.input.value='clothing';
    const occasion=select('rejection-occasion','Where should it apply?',[['all','Every occasion'],['current','This occasion only ('+state.context.occasion+')']]);
    const scopeDescription=element('p','', 'fx-caption');scopeDescription.id='rejection-scope-description';
    const scopeValidation=element('p','', 'fx-warning');scopeValidation.id='rejection-scope-validation';scopeValidation.setAttribute('role','alert');scopeValidation.hidden=true;
    body.append(scope.label,occasion.label,scopeDescription,scopeValidation);
    let scopeChosen=false;
    function updateScopeDescription(){
      const valid=scopeRows.some(([value])=>value===scope.input.value);
      scopeDescription.textContent=valid?'Hide: '+describeScope({scope:scope.input.value,selection:selected})+'. Applies to '+(occasion.input.value==='all'?'every occasion':state.context.occasion)+'.':'No scope selected. No rejection will be saved until you choose what to hide.';
    }
    scope.input.addEventListener('change',()=>{scopeChosen=true;updateChoices();});
    occasion.input.addEventListener('change',()=>updateChoices());
    // A specific diagnosis chooses its stated scope. Item-wide shirt rejection
    // is stated in the checkbox itself; generic reasons never imply an item ban.
    // Keep stored v1 reason codes compatible with existing exports/validators.
    const issueChoices=[
      ['', 'Entire clothing combination is wrong', null, 'clothing'],
      ['shirt_tie_suit', 'Shirt and tie do not work with this suit/blazer', 'other', 'topwear_shirt_tie'],
      ['tie_shirt', 'Shirt is fine; tie does not work with this shirt', 'other', 'shirt_tie'],
      ['shirt_suit', 'Suit/blazer is fine; shirt does not work with it', 'other', 'topwear_shirt'],
      ['shirt_appearance', 'I do not like this shirt — hide it with any outfit', 'other', 'shirt'],
      ['tie_suit', 'Suit/blazer is fine; tie does not work with it', 'other', 'topwear_tie'],
      ['footwear', 'Shoes do not work with this outfit', 'footwear', 'outfit'],
      ['colors', 'Color combination does not work', 'colors', 'clothing'],
      ['patterns', 'Pattern combination does not work', 'patterns', 'clothing'],
      ['formality', 'Too formal or too casual', 'formality', 'clothing'],
      ['other', 'Other reason (describe below)', 'other', 'clothing']
    ].filter(([id])=>{
      if(['shirt_tie_suit','tie_shirt','tie_suit'].includes(id)&&!hasTie)return false;
      if(['shirt_tie_suit','shirt_suit','tie_suit'].includes(id)&&!hasTopwear)return false;
      if(['shirt_tie_suit','tie_shirt','shirt_suit','shirt_appearance'].includes(id)&&!hasShirt)return false;
      return id!=='footwear'||!!selected.shoeId;
    });
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
    const specificIds=new Set(['shirt_tie_suit','tie_shirt','shirt_suit','shirt_appearance','tie_suit','footwear']);
    function choiceError(){
      const chosen=chosenIssues();
      if(!chosen.length)return 'Select a reason for this rejection.';
      if(!scopeChosen&&new Set(chosen.filter(([id])=>specificIds.has(id)).map(([, , ,target])=>target)).size>1)return 'These reasons describe different items or pairings. Choose what this rejection should hide. One explicit scope will be saved; the reasons remain attached as notes.';
      if(!scopeRows.some(([value])=>value===scope.input.value))return 'Choose a scope that applies to the displayed outfit.';
      if(!['all','current'].includes(occasion.input.value))return 'Choose every occasion or this occasion only.';
      return '';
    }
    function updateChoices(infer=false){
      const chosen=chosenIssues();
      if(infer&&!scopeChosen){
        const targets=[...new Set(chosen.filter(([id])=>specificIds.has(id)).map(([, , ,target])=>target))];
        scope.input.value=targets.length>1?'':targets[0]||'clothing';
      }
      const problem=choiceError();
      unresolvedScope.hidden=scope.input.value!=='';
      scopeValidation.textContent=problem;scopeValidation.hidden=!problem;
      updateScopeDescription();
      once.disabled=pending||!!problem;
      forever.disabled=pending||!!problem||!fb.persistentForScope(scope.input.value);
    }
    const noteLabel=element('label','More detail (optional)'),note=element('textarea');note.id='rejection-note';note.rows=3;note.maxLength=500;
    note.placeholder='For example: this tie does not work with this shirt.';noteLabel.append(note);body.append(noteLabel);
    // Different diagnosed targets cannot silently collapse to a weaker scope.
    // Color/pattern/formality details can annotate one specific target.
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
        updateChoices(true);
      });
    }
    body.append(element('p','Reject once lasts until the next Generate or page reload. Never show again stays saved until Undo. A pairing rejection leaves each item available with other partners. A shirt, tie or shoes-only correction preserves the other pieces; a shirt-and-tie correction changes both. A replacement is shown only when an eligible alternative exists.','fx-caption'));
    const cancel=button('Cancel','rejection-cancel',closeDialog);
    const once=button('Reject once','rejection-once',()=>commit(false));
    const forever=button('Never show again','rejection-permanent',()=>commit(true));forever.className='hewrs-rejection-primary';
    actions.append(cancel,once,forever);updateChoices();
    function pendingControls(value){
      for(const control of rejectionDialog.querySelectorAll('button,input,select,textarea'))control.disabled=value;
      if(!value)updateChoices();
    }
    async function commit(permanent) {
      if(pending)return;
      const problem=choiceError();if(problem){scopeValidation.textContent=problem;scopeValidation.hidden=false;error.textContent=problem;return;}
      const now=original.state();
      if(now.busy||!now.selection||F.key(now.selection,'historical_exact')!==key||now.context.occasion!==state.context.occasion){error.textContent='The displayed outfit or occasion changed. Close this panel and review the current outfit.';return;}
      const chosen=chosenIssues();
      const descriptions=chosen.filter(([id])=>id).map(([,label])=>label);
      const diagnosis=descriptions.length?(descriptions.length===1?'Issue: ':'Issues: ')+descriptions.join('; ')+'.':'';
      const savedNote=[diagnosis,note.value.trim()].filter(Boolean).join(' ');
      if(savedNote.length>500){
        error.textContent='Reasons and details exceed 500 characters. Shorten the optional note.';return;
      }
      // Schema v1 stores multiple reasons as one readable note, using "other".
      const reason=chosen.length===1?(chosen[0][2]||null):'other';
      const settings={scope:scope.input.value,context:occasion.input.value==='all'?'all':state.context.occasion,reason,note:savedNote};
      const specific=chosen.filter(([id])=>specificIds.has(id));
      const replaceParts=['tie','shirt_tie','topwear_tie'].includes(settings.scope)?['tie']:['shirt','topwear_shirt'].includes(settings.scope)?['shirt']:settings.scope==='topwear_shirt_tie'?['shirt','tie']:settings.scope==='outfit'&&specific.length===1&&specific[0][0]==='footwear'?['shoes']:null;
      pending=true;pendingControls(true);error.textContent='';refreshControls();
      try {
        await prepareMutation();
        const latest=original.state();if(latest.busy||!latest.selection||F.key(latest.selection,'historical_exact')!==key||latest.context.occasion!==state.context.occasion)throw Error('The displayed outfit or occasion changed. Review the current outfit before rejecting it.');
        const event=await (permanent?fb.hide(selected,settings):fb.skip(selected,settings));lastId=event.id;
        // This action owns reconciliation and refill. Its store notification is
        // deferred so a late subscriber cannot cancel the refill it just began.
        await reconcileMutation();
        closeDialog();
        const prefix=permanent?'Rejection saved. ':'Rejected for this session. ';
        say(prefix+'Keeping the other outfits and finding replacements…');
        const result=await original.refillRejected(replaceParts?{replaceFor:selected,replaceParts}:undefined);
        if(result?.cancelled) {
          say(prefix+'Replacement stopped because the current review changed. Your remaining outfits were retained.');
        } else {
          const count=result?.count??original.state().optionCount,target=result?.target??20;
          const addition=result?.added?result.added+' new outfit'+(result.added===1?'':'s')+' added. ':'';
          say(prefix+addition+count+' of '+target+' outfits available. '+(result?.reason||'Your other outfits and exact selections were retained.'));
        }
      } catch(problem) {
        error.textContent=problem.message;say(problem.message,true);
      } finally {finishMutation();pendingControls(false);}
    }
    dialog.showModal();scope.input.focus();
  }
  async function undoLast() {
    if(pending||!lastId)return;
    pending=true;refreshControls();
    try {const id=lastId;await prepareMutation();await fb.restore(id);await reconcileMutation();lastId=null;say('Rejection undone. Your current list is retained. This outfit, item or pairing can appear on your next Generate; other rejection rules still apply.');}
    catch(error){say(error.message,true);}
    finally{finishMutation();}
  }
  async function openManager() {
    if(pending||checking)return;
    try{await synchronize();}catch(problem){readFailure(problem);refreshControls();return;}
    const {body,actions,error}=newDialog('Rejected outfits and items'),manager=dialog;
    let page=0;
    body.append(element('p','Each saved rejection shows its exact scope and occasion. Backups include permanent outfit, item and pairing feedback with reasons. Temporary skips are not backed up. Older backups keep their original meaning when imported.','fx-caption'));
    const total=element('p','','fx-caption');total.id='rejection-record-count';
    const pageStatus=element('p','','fx-caption');pageStatus.id='rejection-page-status';pageStatus.setAttribute('role','status');
    const previous=button('Previous page','rejection-prev-page',()=>{if(!pending&&page>0){page--;redraw();}});
    const next=button('Next page','rejection-next-page',()=>{if(!pending){page++;redraw();}});
    const pages=element('nav');pages.setAttribute('aria-label','Rejection pages');pages.append(previous,pageStatus,next);
    const list=element('div');list.id='rejection-records';body.append(total,pages,list);
    function redraw() {
      list.replaceChildren();
      try {
        const snap=fb.refresh(),temporary=snap.temporary||[],active=snap.active;
        const count=temporary.length+active.length,pageCount=Math.max(1,Math.ceil(count/PAGE_SIZE));
        page=Math.min(Math.max(0,page),pageCount-1);
        const start=page*PAGE_SIZE,end=Math.min(start+PAGE_SIZE,count);
        total.textContent=active.length.toLocaleString()+' active saved rejections · '+temporary.length.toLocaleString()+' temporary · '+snap.events.length.toLocaleString()+' saved history events';
        pageStatus.textContent='Page '+(page+1)+' of '+pageCount+(count?' · '+(start+1)+'–'+end+' of '+count.toLocaleString():'');
        previous.disabled=pending||page===0;next.disabled=pending||page+1>=pageCount;
        list.dataset.pageSize=String(PAGE_SIZE);list.dataset.total=String(count);
        if(!count)list.append(element('p','No active rejections.'));
        // Index directly into the immutable cache. Rendering one page must not
        // build thousands of DOM rows or clone/sort the full event history.
        for(let i=start;i<end;i++){
          const event=i<temporary.length?temporary[i]:active[active.length-1-(i-temporary.length)];
          // Imported v1 records may use legacy wire IDs and Work aliases.
          // Normalize only this display copy; keep original event bytes intact.
          const view={...event,selection:F.normal(event.selection),occasion:F.occasion(event.occasion)};
          const row=element('article',undefined,'hewrs-rejection-record');row.dataset.eventId=event.id;
          row.dataset.scope=event.scope;
          const top=view.selection.suitId?'Suit '+view.selection.suitId:'Blazer '+view.selection.blazerId;
          const title=view.scope==='shirt'?'Shirt '+view.selection.shirtId:view.scope==='topwear_shirt'?top+' + shirt '+view.selection.shirtId:view.scope==='topwear_shirt_tie'?top+' + shirt '+view.selection.shirtId+' + tie '+view.selection.state:view.scope==='tie'?'Tie '+view.selection.state:view.scope==='shirt_tie'?'Shirt '+view.selection.shirtId+' + tie '+view.selection.state:view.scope==='topwear_tie'?top+' + tie '+view.selection.state:describe(view.selection);
          row.append(element('strong',title),element('p',(view.type==='temporary_skip'?'Temporary · ':'Saved · ')+(view.occasion==='all'?'Every occasion':view.occasion)+' · '+describeScope(view),'fx-caption'));
          if(event.occasion!==view.occasion)row.append(element('p','Saved occasion: '+event.occasion,'fx-caption'));
          if(event.reason)row.append(element('p',reasons.find(r=>r[0]===event.reason)?.[1]||event.reason));
          if(event.note)row.append(element('p',String(event.note),'hewrs-rejection-note'));
          row.append(button('Undo this rejection','undo-'+event.id,()=>run(async()=>{
            await prepareMutation();await fb.restore(event.id);await reconcileMutation();
            if(lastId===event.id)lastId=null;
            say('Rejection undone. Other saved exclusions remain active.');
          })));
          list.append(row);
        }
      }catch(problem){error.textContent=problem.message;}
    }
    function controls(value){
      for(const item of manager.querySelectorAll('button,input'))item.disabled=value;
      if(!value)redraw();
    }
    async function run(action){
      if(pending)return;
      pending=true;error.textContent='';controls(true);refreshControls();
      try{await action();}
      catch(problem){error.textContent=problem.message;}
      finally{
        finishMutation();
        if(dialog===manager&&manager.open)controls(false);
        refreshControls();
      }
    }
    const exportButton=button('Export rejection backup','export-rejections',()=>run(async()=>{
      const data=await fb.exportData();
      if(dialog!==manager||!manager.open)return;
      for(const url of urls)URL.revokeObjectURL(url);urls=[];
      for(const link of body.querySelectorAll('.hewrs-rejection-download'))link.remove();
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));urls.push(url);
      const link=element('a','Save rejection backup');link.id='save-rejection-backup';link.href=url;link.download='HEWRS_OUTFIT_AND_TIE_FEEDBACK.json';link.className='hewrs-rejection-download';body.append(link);
    }));
    const uploadLabel=element('label','Restore an existing rejection backup'),file=element('input');file.type='file';file.accept='.json,application/json';file.id='rejection-import-file';uploadLabel.append(file);
    const importButton=button('Import selected backup','import-rejections',()=>run(async()=>{
      const picked=file.files[0];if(!picked)throw Error('Select a feedback JSON backup.');
      if(picked.size>MAX_BACKUP_BYTES)throw Error('This backup exceeds the 64 MiB import limit. Existing records were retained.');
      const data=JSON.parse(await picked.text());
      await prepareMutation();
      if(original.ownerFeedbackPersistent!==true)throw Error('Permanent storage is unavailable. Import was not attempted.');
      await fb.importData(data);await reconcileMutation();page=0;
      say('Feedback backup imported. Existing records were retained; conflicts are never silently overwritten.');
    }));
    body.append(exportButton,uploadLabel,importButton);actions.append(button('Close','rejections-close',()=>{if(!pending)closeDialog();}));managerRefresh=()=>{if(dialog===manager&&manager.open)redraw();};redraw();manager.showModal();
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
  const ready=Promise.resolve(fb.ready).then(()=>invalidateFeedback(false,false),error=>{readFailure(error);refreshControls();return false;}).finally(()=>{booting=false;refreshControls();});
  root.HEWRSApp=Object.freeze({...original,ownerFeedback:fb,outfitFeedback:fb,hiddenOutfitsSheet:openManager,
    get ownerFeedbackPersistent(){return original.ownerFeedbackPersistent;},
    get feedbackReadError(){return original.feedbackReadError;},
    rejection:Object.freeze({open:openReject,manage:openManager,undo:undoLast,retry:()=>invalidateFeedback(true),ready,pageSize:PAGE_SIZE,maxBackupBytes:MAX_BACKUP_BYTES,revision:'rejection-storage-integration-1'})});
  // A healthy first read must not cancel the automatic weather request that
  // application startup just began. Failed reads still cancel/reconcile.
  refreshControls();
})(globalThis);
