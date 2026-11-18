/* Main-card rejection, optional reason, undo and existing-ledger management.
 * No provider calls, new feedback namespace, item bans or automatic learning.
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
  const manageButton = button('Rejected outfits','manage-outfit-rejections',openManager);
  bar.append(notice,undoButton,manageButton); $('outfit-output').after(bar);
  const rejectButton = button('Reject outfit + reason','reject-outfit',openReject);
  $('regenerate').before(rejectButton);
  const homeManage = button('Rejected outfits · undo / backup','home-outfit-rejections',openManager);
  homeManage.className='fx-wide-card'; $('page-home').append(homeManage);
  function say(text, error=false) {notice.textContent=text; notice.dataset.error=String(error);}
  function currentAllowed(state) {
    if (feedbackError) return false;
    if (!state.selection || state.selection.state === 'REFERENCE') return true;
    return fb.allowed(state.selection, {...state.context, requiredFormality:state.context.formality});
  }
  function refreshControls() {
    const state=original.state(); let allowed=false;
    try {allowed=currentAllowed(state);} catch(error) {feedbackError=error.message;say(error.message,true);}
    const output=$('outfit-output');
    if (!allowed) output.setAttribute('data-rejection-hidden','true');
    else output.removeAttribute('data-rejection-hidden');
    rejectButton.disabled=pending||state.busy||!state.selection||state.selection.state==='REFERENCE'||output.hidden||!allowed;
    undoButton.disabled=pending||!lastId;
    bar.hidden=!(state.selection||lastId||feedbackError);
    if (original.ownerFeedbackPersistent !== true && !notice.textContent) say('Permanent feedback storage is unavailable. Temporary rejection still works; no existing records were cleared.',true);
  }
  function invalidateFeedback() {
    try {
      fb.refresh();feedbackError=null;
      refreshControls();
      original.rejectionChanged();
    } catch(error) {
      feedbackError=error.message;
      say('Feedback could not be checked: '+feedbackError+' Existing choices and records were retained.',true);
    }
    refreshControls();
  }
  fb.subscribe(invalidateFeedback);
  root.addEventListener('storage', event=>{if(event.key===null||event.key?.startsWith(fb.prefix))invalidateFeedback();});
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
  function openReject() {
    const state=original.state(); if(pending||state.busy||!state.selection||state.selection.state==='REFERENCE'||!currentAllowed(state))return;
    const selected=structuredClone(state.selection), key=F.key(selected,'historical_exact');
    const {body,actions,error}=newDialog('Reject this outfit');
    body.append(element('p',describe(selected),'fx-caption'),element('p','By default, reject this clothing combination permanently with ANY shoes or watch. Individual garments remain available for other combinations.','fx-caption'));
    // These are explanatory diagnoses, never global item bans.
    // Keep stored v1 reason codes compatible with existing exports/validators.
    const issueChoices=[
      ['', 'Entire clothing combination is wrong', null, 'clothing'],
      ['shirt_tie_suit', 'Shirt and tie do not work with this suit/blazer', 'other', 'clothing'],
      ['tie_shirt', 'Shirt is fine; tie does not work with this shirt', 'other', 'clothing'],
      ['shirt_suit', 'Suit/blazer is fine; shirt does not work with it', 'other', 'clothing'],
      ['tie_suit', 'Suit/blazer is fine; tie does not work with it', 'other', 'clothing'],
      ['footwear', 'Shoes do not work with this outfit; clothes are fine', 'footwear', 'outfit'],
      ['colors', 'Color combination does not work', 'colors', 'clothing'],
      ['patterns', 'Pattern combination does not work', 'patterns', 'clothing'],
      ['formality', 'Too formal or too casual', 'formality', 'clothing'],
      ['other', 'Other reason (describe below)', 'other', 'clothing']
    ];
    const issue=select('rejection-issue','What does not work?',issueChoices.map(x=>[x[0],x[1]]));body.append(issue.label);
    const noteLabel=element('label','More detail (optional)'),note=element('textarea');note.id='rejection-note';note.rows=3;note.maxLength=500;
    note.placeholder='For example: this tie does not work with this shirt.';noteLabel.append(note);body.append(noteLabel);
    const advanced=element('details');advanced.append(element('summary','Rejection scope'));
    const scope=select('rejection-scope','What should be hidden?',[['clothing','Entire clothing combination — any shoes or watch (default)'],['outfit','Only this exact clothing + shoe combination — any watch']]);
    const occasion=select('rejection-occasion','Where should it apply?',[['all','Every occasion'],['current','This occasion only ('+state.context.occasion+')']]);
    advanced.append(scope.label,occasion.label);body.append(advanced);
    // Footwear-only dissatisfaction must NOT silently ban the clothing with all shoes.
    // The exact outfit scope preserves the suit, shirt and tie as reusable.
    issue.input.addEventListener('change',()=>{
      const choice=issueChoices.find(x=>x[0]===issue.input.value);
      if(choice)scope.input.value=choice[3];
    });
    body.append(element('p','The other outfits stay in your list. Available replacements are added automatically, up to 20, using your current selections and outfit rules. Reject once stays active during replacement and clears on your next Generate or page reload. Never show again applies to all future generations and occasions until Undo. Default scope bans this clothing combination with any shoes or watch. If the shoes alone are wrong, select the footwear issue: only the current clothing-and-shoe pairing is banned; other shoes remain eligible. Each garment is still reusable in other combinations. The restriction is saved in this browser.','fx-caption'));
    const cancel=button('Cancel','rejection-cancel',closeDialog);
    const once=button('Reject once','rejection-once',()=>commit(false));
    const forever=button('Never show again','rejection-permanent',()=>commit(true));forever.className='hewrs-rejection-primary';
    forever.disabled=original.ownerFeedbackPersistent!==true;actions.append(cancel,once,forever);
    async function commit(permanent) {
      if(pending)return;
      const now=original.state();
      if(now.busy||!now.selection||F.key(now.selection,'historical_exact')!==key){error.textContent='The displayed outfit changed. Close this panel and review the current outfit.';return;}
      pending=true;cancel.disabled=once.disabled=forever.disabled=true;error.textContent='';
      try {
        const chosen=issueChoices.find(x=>x[0]===issue.input.value);
        const detail=note.value.trim(),diagnosis=chosen?.[0] ? 'Issue: '+chosen[1]+'.' : '';
        const savedNote=[diagnosis,detail].filter(Boolean).join(' ').slice(0,500);
        const settings={scope:scope.input.value,context:occasion.input.value==='all'?'all':state.context.occasion,reason:chosen?.[2]||null,note:savedNote};
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
      } finally {pending=false;cancel.disabled=once.disabled=false;forever.disabled=original.ownerFeedbackPersistent!==true;refreshControls();}
    }
    dialog.showModal();issue.input.focus();
  }
  function undoLast() {
    if(pending||!lastId)return;
    try {const id=lastId;fb.restore(id);lastId=null;say('Rejection undone. Your current list is retained. The combination is eligible again on your next Generate; other rejection rules still apply.');refreshControls();}
    catch(error){say(error.message,true);}
  }
  function openManager() {
    if(pending)return;
    const {body,actions,error}=newDialog('Rejected outfits');
    body.append(element('p','The same rejection record is used by this preview’s normal generator and reviewed/API-candidate panel. No individual garment is banned. Backups include permanent feedback and reasons, not temporary skips.','fx-caption'));
    const list=element('div');list.id='rejection-records';body.append(list);
    function redraw() {
      list.replaceChildren();
      try {
        const snap=fb.refresh(),events=[...(snap.temporary||[]),...snap.active.slice().reverse()];
        if(!events.length)list.append(element('p','No active outfit rejections.'));
        for(const event of events){
          const row=element('article',undefined,'hewrs-rejection-record');row.dataset.eventId=event.id;
          row.append(element('strong',describe(event.selection)),element('p',(event.type==='temporary_skip'?'Temporary · ':'Saved · ')+(event.occasion==='all'?'Every occasion':event.occasion)+' · '+(event.scope==='clothing'?'Clothing combination, any shoes/watch':'Clothes and shoes, any watch'),'fx-caption'));
          if(event.reason)row.append(element('p',reasons.find(r=>r[0]===event.reason)?.[1]||event.reason));
          if(event.note)row.append(element('p',String(event.note),'hewrs-rejection-note'));
          row.append(button('Undo this rejection','undo-'+event.id,()=>{try{fb.restore(event.id);if(lastId===event.id)lastId=null;redraw();refreshControls();}catch(e){error.textContent=e.message;}}));
          list.append(row);
        }
      }catch(e){error.textContent=e.message;}
    }
    const exportButton=button('Export rejection backup','export-rejections',()=>{
      try{const data=fb.exportData(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));urls.push(url);const a=element('a','Save rejection backup');a.href=url;a.download='HEWRS_OUTFIT_FEEDBACK.json';a.className='hewrs-rejection-download';body.append(a);}
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
  // Both names point to exactly the same gate and persistent owner-feedback log.
  root.HEWRSApp=Object.freeze({...original,ownerFeedback:fb,outfitFeedback:fb,hiddenOutfitsSheet:openManager,
    rejection:Object.freeze({open:openReject,manage:openManager,undo:undoLast,revision:'rejection-autofill-1'})});
  refreshControls();
})(globalThis);
