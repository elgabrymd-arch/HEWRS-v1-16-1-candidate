'use strict';
// Reuse the DOM adapter while exercising the shipped status/readiness handlers.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const scaffold=fs.readFileSync(path.join(__dirname,'all-rejections-ui.cjs'),'utf8').split('const singles=')[0],adapter={exports:{}};
vm.runInNewContext(scaffold+'\nmodule.exports={harness,selected};',{require,__dirname,module:adapter,structuredClone,console,setImmediate,URL,Blob});
const {harness,selected}=adapter.exports;
const idle=()=>new Promise(resolve=>setImmediate(resolve));

test('First successful durable read clears loading copy and enables rejection controls',async()=>{
  const h=await harness(selected,{initiallyLoading:true});
  assert.equal(h.get('rejection-status').textContent,'Loading saved rejections…');
  assert.equal(h.get('reject-outfit').disabled,true);
  await h.completeInitialRead();
  assert.equal(h.get('rejection-status').textContent,'Saved rejections checked.');
  assert.equal(h.get('rejection-status').dataset.error,'false');
  assert.equal(h.get('reject-outfit').disabled,false);
  assert.equal(h.get('rejection-home-error').hidden,true);
});

test('Refreshing healthy controls preserves rejection, refill and Undo outcomes',async()=>{
  const h=await harness();await h.open();h.reason('tie_shirt');await h.click('rejection-permanent');
  const saved=h.get('rejection-status').textContent;
  assert.match(saved,/Rejection saved/);assert.match(saved,/20 of 20/);
  await h.context.HEWRSApp.rejection.open();
  assert.equal(h.get('rejection-status').textContent,saved);
  await h.context.HEWRSApp.rejection.undo();
  assert.match(h.get('rejection-status').textContent,/Rejection undone/);
  assert.equal(h.get('rejection-status').dataset.error,'false');
});

test('A failed read remains visible and blocked until explicit recovery succeeds',async()=>{
  const h=await harness(),feedback=h.context.HEWRSRejectionPreviewCore.attach();
  feedback.sync=async()=>{throw Error('Synthetic saved-history read failure');};
  await h.context.HEWRSApp.rejection.retry();
  assert.match(h.get('rejection-status').textContent,/Synthetic saved-history read failure/);
  assert.equal(h.get('rejection-status').dataset.error,'true');
  assert.equal(h.get('reject-outfit').disabled,true);
  feedback.sync=async()=>{};
  await h.context.HEWRSApp.rejection.retry();
  assert.match(h.get('rejection-status').textContent,/Saved rejections were checked/);
  assert.equal(h.get('rejection-status').dataset.error,'false');
  assert.equal(h.get('reject-outfit').disabled,false);
});

test('An in-progress refresh retains loading text until its read settles',async()=>{
  const h=await harness(),feedback=h.context.HEWRSRejectionPreviewCore.attach();
  let release,loading=true;
  feedback.status=()=>({ready:!loading,persistent:true,stale:false,loading,blocked:null});
  feedback.sync=()=>new Promise(resolve=>{release=resolve;});
  const done=h.context.HEWRSApp.rejection.retry();await idle();
  assert.equal(h.get('rejection-status').textContent,'Loading saved rejections…');
  assert.equal(h.get('reject-outfit').disabled,true);
  loading=false;release();await done;
  assert.notEqual(h.get('rejection-status').textContent,'Loading saved rejections…');
  assert.equal(h.get('reject-outfit').disabled,false);
});
