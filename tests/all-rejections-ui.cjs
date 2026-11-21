'use strict';
// Exercise the real dialog event handlers with a small DOM adapter. This does
// not replace the browser/renderer checks; it isolates the saved action contract
// and asynchronous settings freeze without needing a native browser process.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/outfit-rejection-ui.js'), 'utf8');
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const idle = () => new Promise(resolve => setImmediate(resolve));
const selected = {suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:'watch-AP09'};

class Element {
  constructor(tag) {this.tagName=tag.toLowerCase();this.children=[];this.listeners=new Map();this.attributes=new Map();this.dataset={};this.hidden=false;this.disabled=false;this.checked=false;this.open=false;this.textContent='';this._value=undefined;}
  get value() {
    if(this.tagName!=='select')return this._value??'';
    const values=this.children.filter(n=>n.tagName==='option').map(n=>n.value);
    return this._value===undefined?(values[0]??''):values.includes(this._value)?this._value:'';
  }
  set value(value) {this._value=String(value);}
  append(...nodes) {for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
  prepend(...nodes) {for(const node of nodes.reverse()){node.remove();node.parentNode=this;this.children.unshift(node);}}
  before(node) {this.insertSibling(node,0);}
  after(node) {this.insertSibling(node,1);}
  insertSibling(node,offset) {if(!this.parentNode)return;node.remove();const parent=this.parentNode;node.parentNode=parent;parent.children.splice(parent.children.indexOf(this)+offset,0,node);}
  remove() {if(this.parentNode){const parent=this.parentNode;parent.children.splice(parent.children.indexOf(this),1);this.parentNode=null;}}
  replaceChildren(...nodes) {for(const node of [...this.children])node.remove();this.append(...nodes);}
  setAttribute(name,value) {this.attributes.set(name,String(value));}
  getAttribute(name) {return this.attributes.get(name)??null;}
  removeAttribute(name) {this.attributes.delete(name);}
  addEventListener(type,listener) {if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(listener);}
  fire(type) {for(const listener of this.listeners.get(type)||[])listener({target:this,preventDefault(){}});}
  click() {if(!this.disabled)this.fire('click');}
  focus() {}
  showModal() {this.open=true;}
  close() {this.open=false;}
  querySelectorAll(selector) {
    const selectors=selector.split(',').map(s=>s.trim());
    const matches=node=>selectors.some(s=>s.startsWith('#')?node.id===s.slice(1):s.startsWith('.')?(node.className||'').split(' ').includes(s.slice(1)):node.tagName===s);
    const result=[];for(const child of this.children){if(matches(child))result.push(child);result.push(...child.querySelectorAll(selector));}return result;
  }
}

async function harness(selection=selected, {initiallyLoading=false}={}) {
  const body=new Element('body'),documentListeners=new Map();
  const document={body,createElement:tag=>new Element(tag),getElementById:id=>body.querySelectorAll('#'+id)[0]||null,
    addEventListener(type,listener){documentListeners.set(type,listener);}};
  for(const id of ['outfit-output','regenerate','page-home','avatar','selection-ids','page-outfits','option-count','generate-options','generate-current-selections','open-results','prev-option','next-option']){const n=new Element('div');n.id=id;body.append(n);}
  const calls=[],refills=[],events=[];let selectionNow=copy(selection),occasionNow='work',blockHide=null,nextId=0;
  const app={feedbackReadError:null,ownerFeedbackPersistent:true,
    state:()=>({selection:copy(selectionNow),context:{occasion:occasionNow,formality:'any'},busy:false,optionCount:20}),
    setFeedbackReadError(value){app.feedbackReadError=value;},
    async rejectionChanged(){return {count:19};},
    async refillRejected(options){refills.push(copy(options));return {count:20,target:20,added:1};}};
  const snapshot=()=>({active:events.filter(e=>e.type==='hide'),temporary:events.filter(e=>e.type==='temporary_skip'),events:events.filter(e=>e.type==='hide')});
  let finishInitialRead;
  const firstRead=initiallyLoading?new Promise(resolve=>{finishInitialRead=()=>{initiallyLoading=false;resolve();};}):Promise.resolve();
  const feedback={ready:firstRead,prefixes:['synthetic:'],sync:async()=>{},refresh:snapshot,snapshot,
    status:()=>({ready:!initiallyLoading,persistent:true,stale:false,loading:initiallyLoading,blocked:null}),allowed:()=>true,
    token:()=>String(events.length),subscribe:()=>()=>{},persistentForScope:()=>true,clearTemporary:()=>{},
    async hide(s,options){calls.push({action:'hide',selection:copy(s),options:copy(options)});if(blockHide)await blockHide;const event={id:'saved_'+(++nextId),type:'hide',selection:copy(s),...copy(options),occasion:options.context};events.push(event);return event;},
    async skip(s,options){calls.push({action:'skip',selection:copy(s),options:copy(options)});const event={id:'skip_'+(++nextId),type:'temporary_skip',selection:copy(s),...copy(options),occasion:options.context};events.push(event);return event;},
    async restore(id){const index=events.findIndex(e=>e.id===id);if(index<0)return false;events.splice(index,1);return true;}};
  const context=vm.createContext({document,console,Promise,URL,Blob,structuredClone,MutationObserver:class{observe(){}},
    addEventListener(){},HEWRSApp:app,HEWRS_READY:true,HEWRSRejectionPreviewCore:{attach:()=>feedback},
    HEWRSOutfitFeedback:{key:value=>JSON.stringify(value)}});
  vm.runInContext(source,context,{filename:'src/outfit-rejection-ui.js'});
  if(!initiallyLoading)await context.HEWRSApp.rejection.ready;
  const get=id=>{const node=document.getElementById(id);assert.ok(node,'Expected DOM node '+id);return node;};
  return {get,document,context,calls,refills,events,
    async completeInitialRead(){finishInitialRead?.();await context.HEWRSApp.rejection.ready;},
    open:()=>context.HEWRSApp.rejection.open(),
    reason(id,checked=true){const node=get('rejection-issue-'+id);node.checked=checked;node.fire('change');},
    scope(value){const node=get('rejection-scope');node.value=value;node.fire('change');},
    occasion(value){const node=get('rejection-occasion');node.value=value;node.fire('change');},
    async click(id){get(id).click();await idle();},
    holdHide(){let release;blockHide=new Promise(resolve=>{release=resolve;});return release;},
    setSelection(value){selectionNow=copy(value);},setOccasion(value){occasionNow=value;}};
}

const singles=[
  ['entire','clothing',null],['shirt_tie_suit','topwear_shirt_tie',['shirt','tie']],
  ['tie_shirt','shirt_tie',['tie']],['shirt_suit','topwear_shirt',['shirt']],
  ['shirt_appearance','shirt',['shirt']],['tie_suit','topwear_tie',['tie']],
  ['footwear','outfit',['shoes']],['colors','clothing',null],['patterns','clothing',null],
  ['formality','clothing',null],['other','clothing',null],
];
const specific=singles.filter(([,scope])=>scope!=='clothing');
const qualifiers=['colors','patterns','formality','other'];

test('Every reason saves its stated scope and requests only its intended replacement pieces',async()=>{
  for(const [reason,scope,parts] of singles){
    const h=await harness();await h.open();h.reason(reason);
    assert.equal(h.get('rejection-scope').value,scope,reason);
    if(reason==='shirt_appearance')assert.match(h.get('rejection-issue-shirt_appearance').parentNode.children[1].textContent,/hide it with any outfit/);
    await h.click('rejection-permanent');
    assert.equal(h.calls.length,1,reason);assert.equal(h.calls[0].options.scope,scope,reason);assert.equal(h.calls[0].options.context,'all',reason);
    assert.deepEqual(h.refills[0],parts?{replaceFor:selected,replaceParts:parts}:undefined,reason);
  }
});

test('Every generic qualifier preserves each single specific diagnosis',async()=>{
  for(const [reason,scope] of specific)for(const qualifier of qualifiers){
    const h=await harness();await h.open();h.reason(reason);h.reason(qualifier);
    assert.equal(h.get('rejection-scope').value,scope,reason+' + '+qualifier);
    assert.equal(h.get('rejection-permanent').disabled,false);
  }
});

test('Every pair of distinct specific diagnoses blocks saving until a valid explicit scope is chosen',async()=>{
  for(let a=0;a<specific.length;a++)for(let b=a+1;b<specific.length;b++){
    const h=await harness();await h.open();h.reason(specific[a][0]);h.reason(specific[b][0]);
    assert.equal(h.get('rejection-scope').value,'');assert.equal(h.get('rejection-scope-validation').hidden,false);
    assert.equal(h.get('rejection-once').disabled,true);assert.equal(h.get('rejection-permanent').disabled,true);
    await h.click('rejection-permanent');assert.equal(h.calls.length,0);
    h.scope('clothing');assert.equal(h.get('rejection-scope-validation').hidden,true);
    await h.click('rejection-permanent');assert.equal(h.calls[0].options.scope,'clothing');assert.equal(h.refills[0],undefined);
  }
});

test('Removing a conflicting reason resumes inference before any manual scope override',async()=>{
  const h=await harness();await h.open();h.reason('tie_suit');h.reason('tie_shirt');
  assert.equal(h.get('rejection-permanent').disabled,true);
  h.reason('tie_shirt',false);assert.equal(h.get('rejection-scope').value,'topwear_tie');assert.equal(h.get('rejection-permanent').disabled,false);
});

test('Manual scopes remain authoritative over later reasons and determine targeted replacements',async()=>{
  for(const [scope,parts] of [['shirt',['shirt']],['topwear_shirt',['shirt']],['topwear_shirt_tie',['shirt','tie']],['tie',['tie']],['shirt_tie',['tie']],['topwear_tie',['tie']],['clothing',null],['outfit',null]]){
    const h=await harness();await h.open();h.scope(scope);h.reason('tie_suit');h.reason('shirt_suit');h.reason('footwear');
    assert.equal(h.get('rejection-scope').value,scope);assert.equal(h.get('rejection-permanent').disabled,false);
    await h.click('rejection-permanent');assert.equal(h.calls[0].options.scope,scope);
    assert.deepEqual(h.refills[0],parts?{replaceFor:selected,replaceParts:parts}:undefined);
  }
});

test('Footwear with generic details changes shoes; mixed specific reasons with explicit outfit use a general refill',async()=>{
  const h=await harness();await h.open();h.scope('outfit');h.reason('footwear');h.reason('colors');
  await h.click('rejection-permanent');assert.deepEqual(h.refills[0],{replaceFor:selected,replaceParts:['shoes']});
  const mixed=await harness();await mixed.open();mixed.scope('outfit');mixed.reason('footwear');mixed.reason('tie_shirt');
  await mixed.click('rejection-permanent');assert.equal(mixed.calls[0].options.scope,'outfit');assert.equal(mixed.refills[0],undefined);
});

test('No Tie and shirt-only outfits expose only applicable reasons and scopes',async()=>{
  for(const [selection,missingReasons,missingScopes] of [
    [{...selected,state:'NO_TIE'},['shirt_tie_suit','tie_shirt','tie_suit'],['shirt_tie','topwear_tie','topwear_shirt_tie','tie']],
    [{shirtOnly:true,pantId:'PG001',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:null},['shirt_tie_suit','shirt_suit','tie_suit'],['topwear_shirt','topwear_shirt_tie','topwear_tie']],
    [{shirtOnly:true,pantId:'PG001',shirtId:'DS029',state:'NO_TIE',shoeId:'shoe-1',watchId:null},['shirt_tie_suit','shirt_suit','tie_suit','tie_shirt'],['topwear_shirt','topwear_shirt_tie','topwear_tie','shirt_tie','tie']],
  ]){
    const h=await harness(selection);await h.open();
    for(const reason of missingReasons)assert.equal(h.document.getElementById('rejection-issue-'+reason),null,reason);
    const scopes=h.get('rejection-scope').children.map(n=>n.value);
    for(const scope of missingScopes)assert.ok(!scopes.includes(scope),scope);
    h.reason('shirt_appearance');await h.click('rejection-permanent');assert.equal(h.calls[0].options.scope,'shirt');
  }
});

test('Blazer pair/triple scopes retain the blazer ID in their visible description and saved selection',async()=>{
  const selection={blazerId:'B03',pantId:'PG001',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:null};
  for(const reason of ['shirt_suit','tie_suit','shirt_tie_suit']){
    const h=await harness(selection);await h.open();h.reason(reason);
    assert.match(h.get('rejection-scope-description').textContent,/Blazer B03/);
    await h.click('rejection-permanent');assert.deepEqual(h.calls[0].selection,selection);
  }
});

test('Reject once uses the same scope/replacement semantics and selected occasion without permanent hide',async()=>{
  const h=await harness();await h.open();h.reason('shirt_suit');h.occasion('current');
  await h.click('rejection-once');assert.equal(h.calls[0].action,'skip');assert.equal(h.calls[0].options.scope,'topwear_shirt');
  assert.equal(h.calls[0].options.context,'work');assert.deepEqual(h.refills[0],{replaceFor:selected,replaceParts:['shirt']});
});

test('Pending save freezes all settings and uses click-time scope, occasion and reasons',async()=>{
  const h=await harness();await h.open();h.reason('shirt_suit');h.occasion('current');
  const release=h.holdHide();await h.click('rejection-permanent');
  const controls=h.get('outfit-rejection-dialog').querySelectorAll('button,input,select,textarea');
  assert.ok(controls.length>10);assert.ok(controls.every(n=>n.disabled));
  // Programmatic value mutation cannot alter the already captured action;
  // real user interaction with these controls is disabled while pending.
  h.get('rejection-scope').value='tie';h.get('rejection-occasion').value='all';h.get('rejection-note').value='late edit';
  release();await idle();assert.equal(h.calls[0].options.scope,'topwear_shirt');assert.equal(h.calls[0].options.context,'work');
  assert.ok(!h.calls[0].options.note.includes('late edit'));assert.deepEqual(h.refills[0],{replaceFor:selected,replaceParts:['shirt']});
});

test('Invalid scope or occasion and stale displayed selections never save a rejection',async()=>{
  for(const field of ['scope','occasion']){
    const h=await harness();await h.open();h[field]('unsupported');
    assert.equal(h.get('rejection-permanent').disabled,true);
    // Even an invoked handler on a disabled control revalidates the choice.
    h.get('rejection-permanent').fire('click');await idle();assert.equal(h.calls.length,0);
  }
  for(const kind of ['selection','occasion']){
    const h=await harness();await h.open();h.reason('shirt_suit');
    if(kind==='selection')h.setSelection({...selected,suitId:'S04'});else h.setOccasion('dinner');
    await h.click('rejection-permanent');assert.equal(h.calls.length,0);assert.match(h.get('rejection-error').textContent,/changed/);
  }
});

test('Cancel saves no record and no replacement request',async()=>{
  const h=await harness();await h.open();h.reason('shirt_appearance');await h.click('rejection-cancel');
  assert.equal(h.calls.length,0);assert.equal(h.refills.length,0);assert.equal(h.get('outfit-rejection-dialog').open,false);
});
