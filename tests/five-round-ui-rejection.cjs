'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Reuse only the DOM adapter; all dialog behavior comes from the current source.
const scaffold=fs.readFileSync(path.join(__dirname,'all-rejections-ui.cjs'),'utf8').split('const singles=')[0],adapter={exports:{}};
vm.runInNewContext(scaffold+'\nmodule.exports={harness,selected};',{require,__dirname,module:adapter,structuredClone,console,setImmediate,URL,Blob});
const {harness,selected}=adapter.exports;
const specific=[['shirt_tie_suit','topwear_shirt_tie'],['tie_shirt','shirt_tie'],['shirt_suit','topwear_shirt'],['shirt_appearance','shirt'],['tie_suit','topwear_tie'],['footwear','outfit']];
const generic=['colors','patterns','formality','other'];
const idle=()=>new Promise(resolve=>setImmediate(resolve));
const F=require('../src/owner-feedback.js'),T=require('../src/tie-feedback.js');
test('All 1024 combinations of specific reasons and generic qualifiers infer one target or require an explicit scope',async()=>{
 for(let diagnoses=0;diagnoses<64;diagnoses++)for(let qualifiers=0;qualifiers<16;qualifiers++){
  const h=await harness();await h.open();const targets=[];
  for(let i=0;i<specific.length;i++)if(diagnoses&(1<<i)){h.reason(specific[i][0]);targets.push(specific[i][1]);}
  for(let i=0;i<generic.length;i++)if(qualifiers&(1<<i))h.reason(generic[i]);
  const expected=targets.length>1?'':targets[0]||'clothing';
  assert.equal(h.get('rejection-scope').value,expected,'diagnoses='+diagnoses+', qualifiers='+qualifiers);
  assert.equal(h.get('rejection-permanent').disabled,targets.length>1);
  if(targets.length>1){h.get('rejection-permanent').fire('click');await idle();assert.equal(h.calls.length,0);}
 }
});
test('An explicit scope controls all ten combined reasons without losing any reason or exceeding storage limits',async()=>{
 for(const scope of ['outfit','clothing','shirt','topwear_shirt','topwear_shirt_tie','tie','shirt_tie','topwear_tie']){
  const h=await harness();await h.open();h.scope(scope);
  for(const [reason]of specific)h.reason(reason);for(const reason of generic)h.reason(reason);
  await h.click('rejection-permanent');assert.equal(h.calls.length,1);const saved=h.calls[0].options;
  assert.equal(saved.scope,scope);assert.equal(saved.note.length,417);assert.ok(saved.note.includes('Other reason (describe below)'));
  const parts=['tie','shirt_tie','topwear_tie'].includes(scope)?['tie']:['shirt','topwear_shirt'].includes(scope)?['shirt']:scope==='topwear_shirt_tie'?['shirt','tie']:null;
  assert.equal(JSON.stringify(h.refills[0]),JSON.stringify(parts?{replaceFor:selected,replaceParts:parts}:undefined));
 }
});
test('Whole-combination checkbox clears diagnoses without overriding an earlier explicit scope',async()=>{
 const h=await harness();await h.open();h.scope('tie');h.reason('footwear');h.reason('colors');h.reason('entire');
 assert.equal(h.get('rejection-issue-footwear').checked,false);assert.equal(h.get('rejection-issue-colors').checked,false);
 await h.click('rejection-once');assert.equal(h.calls[0].options.scope,'tie');assert.equal(h.calls[0].options.reason,null);assert.equal(h.calls[0].options.note,'');
 assert.equal(JSON.stringify(h.refills[0]),JSON.stringify({replaceFor:selected,replaceParts:['tie']}));
});
test('Click-time intent stays fixed while the first durable synchronization is pending',async()=>{
 const h=await harness();await h.open();h.reason('shirt_suit');h.occasion('current');h.get('rejection-note').value='Initial detail';
 const feedback=h.context.HEWRSRejectionPreviewCore.attach();let release;feedback.sync=()=>new Promise(resolve=>{release=resolve;});
 await h.click('rejection-permanent');assert.equal(h.calls.length,0);assert.ok(h.get('outfit-rejection-dialog').querySelectorAll('button,input,select,textarea').every(n=>n.disabled));
 h.get('rejection-scope').value='tie';h.get('rejection-occasion').value='all';h.get('rejection-note').value='Late detail';
 const resume=release;feedback.sync=async()=>{};resume();await idle();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].options.scope,'topwear_shirt');assert.equal(h.calls[0].options.context,'work');assert.match(h.calls[0].options.note,/Initial detail/);assert.ok(!h.calls[0].options.note.includes('Late detail'));
});
test('Changing the displayed outfit or occasion during pre-save synchronization prevents the write',async()=>{
 for(const change of ['outfit','occasion']){
  const h=await harness();await h.open();h.reason('tie_suit');const feedback=h.context.HEWRSRejectionPreviewCore.attach();let release;feedback.sync=()=>new Promise(resolve=>{release=resolve;});
  await h.click('rejection-permanent');if(change==='outfit')h.setSelection({...selected,shirtId:'DS027'});else h.setOccasion('dinner');
  const resume=release;feedback.sync=async()=>{};resume();await idle();assert.equal(h.calls.length,0);assert.equal(h.refills.length,0);assert.match(h.get('rejection-error').textContent,/changed/);
 }
});
test('The manager shows accepted historical wire and canonical tie records without rewriting stored records',async()=>{
 let serial=0;
 for(const topwear of ['S05','B03',null])for(const scope of ['outfit','clothing','shirt','topwear_shirt','topwear_shirt_tie','tie','shirt_tie','topwear_tie']){
  if(topwear===null&&scope.startsWith('topwear_'))continue;
  const tied=['tie','shirt_tie','topwear_tie'].includes(scope),api=tied?T:F,values=new Map();
  const storage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const raw={schema:api.SCHEMA,id:'legacy_'+(++serial),at:'2026-11-18T12:00:00.000Z',type:'hide',actor:'owner',scope,occasion:'clinic',selection:{topwear,pants:topwear==='S05'?null:'PG001',shirt:'DS029',tie:'T029',shoe:'shoe-1',watch:'watch-AP09'},reason:'colors',note:'Original note retained'};
  // The newer tie namespace accepts canonical records only; legacy wire
  // selections and occasion aliases belong to the original outfit namespace.
  if(tied){raw.id='tie_'+raw.id;raw.selection=F.normal(raw.selection);raw.occasion='work';}
  const store=tied?T.create({storage,feedback:F,validateSelection:F.normal}):F.create({storage,validateSelection:F.normal});
  store.importData({schema:api.EXPORT,events:[raw]});const stored=JSON.stringify([...values]);
  const h=await harness();h.context.HEWRSOutfitFeedback.normal=F.normal;h.context.HEWRSOutfitFeedback.occasion=F.occasion;h.events.push(...store.snapshot().active);
  const eventBefore=JSON.stringify(h.events);await h.context.HEWRSApp.rejection.manage();
  const text=h.get('rejection-records').children[0].children.map(n=>n.textContent).join('\n');
  assert.ok(!text.includes('undefined'),scope+' '+String(topwear)+': '+text);
  assert.match(text,/Saved · work ·/);if(!tied)assert.match(text,/Saved occasion: clinic/);assert.match(text,/Original note retained/);
  if(['outfit','clothing'].includes(scope)){assert.match(text,/DS029/);assert.match(text,/T029/);assert.ok(text.includes(topwear||'SHIRT ONLY'));}
  if(scope==='shirt'||scope.includes('shirt'))assert.match(text,/DS029/);
  if(scope==='tie'||scope.includes('tie'))assert.match(text,/T029/);
  if(scope.startsWith('topwear_'))assert.ok(text.includes((topwear.startsWith('S')?'Suit ':'Blazer ')+topwear));
  assert.equal(JSON.stringify(h.events),eventBefore);assert.equal(JSON.stringify([...values]),stored);
 }
});
