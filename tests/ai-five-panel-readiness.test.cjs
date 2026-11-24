'use strict';
// Actual Client and Panel, synthetic transport and minimal DOM. No provider calls.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const Client=require('../src/ai-five-client.js');
const SOURCE='a'.repeat(64),CATALOGUE='b'.repeat(64),ID='c'.repeat(32);
const TOKEN='fixture-with-punctuation!#?@%&*+~'.repeat(2);
const config={enabled:true,endpoint:'https://ai-five-fixture.invalid',source_lock:SOURCE,catalogue_fingerprint:CATALOGUE};
const health=(overrides={})=>({schema:Client.STATUS,configured:true,authenticated:true,blocked_by:[],
  source_lock:SOURCE,catalogue_fingerprint:CATALOGUE,model:'gpt-6.1-sol',capabilities:[Client.CAPABILITY],
  total_call_limit:1,remaining_calls:1,busy:false,...overrides});
const query=()=>({source_lock:SOURCE,context:{occasion:'work',requiredFormality:'any'},localDate:'2026-11-23',
  weather:{source:'not_assessed',temperatureBand:null,precipitation:null,season:null},
  excluded_outfit_keys:[JSON.stringify(['S01','SUIT_TROUSERS','DS001','NO_TIE','shoe-8'])]});
const reply=()=>({schema:Client.RESPONSE,request_id:ID,source_lock:SOURCE,catalogue_fingerprint:CATALOGUE,
  proposals:[{selection:{suitId:'S02',blazerId:null,shirtOnly:false,pantId:null,shirtId:'DS025',state:'NO_TIE',shoeId:'shoe-8',watchId:'watch-R01'},
    occasion:'work',rationale:'Transport fixture, not live AI output.'}],
  job_id:'fixture-job',provider:{name:'openai',requested_model:'gpt-6.1-sol',model:'resolved-model',response_id:'fixture-response',live_call:false},cached:false});
class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.attributes={};this.textContent='';this.value='';this.disabled=false;this.checked=false;this.open=false;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(name,value){this.attributes[name]=value;}
  removeAttribute(name){delete this.attributes[name];delete this[name];}
  close(){this.open=false;}
  showModal(){this.open=true;}
  getContext(){return {fillRect(){},drawImage(){}};}
  toDataURL(){return 'data:image/jpeg;base64,Zml4dHVyZQ==';}
}
function harness(initial=health()) {
  const host=new Element('main');host.id='page-outfits';
  const find=(node,id)=>node.id===id?node:node.children.map(child=>find(child,id)).find(Boolean);
  const document={getElementById:id=>find(host,id),createElement:tag=>new Element(tag),addEventListener(){}};
  const requests=[];let status=initial,statusError=null,statusGate=null,generationError=false,flowCalls=0,now=1000;
  const fetcher=async(url,init)=>{
    requests.push({url,init});
    if(url.endsWith('/status')){
      if(statusGate)await statusGate;
      if(statusError)throw statusError;
      return new Response(JSON.stringify(status),{status:200});
    }
    return new Response(JSON.stringify(generationError?{error:{message:'Fixture provider failure; do not retry.'}}:reply()),{status:generationError?502:200});
  };
  const snapshot={signature:'unchanged-native-state',request:query()};
  const native={read:()=>snapshot,synchronize:async()=>snapshot,validate:()=>true,ownerAllows:()=>true,rotationAllows:()=>true,
    assertCurrentAsync:async()=>{},withCurrent:async(initial,fn)=>fn()};
  const context={document,HEWRSApp:{outfitFeedback:{subscribe(){}}},HEWRS_AI_FIVE_SERVICE_CONFIG:config,
    HEWRSAIFiveClient:{create:options=>Client.create({...options,fetcher,randomId:()=>ID,clock:()=>now})},
    HEWRSAIFiveNative:{create:()=>native},
    HEWRSAIFiveFlow:{signature:state=>state.signature,create:({service})=>({generate:async options=>{
      flowCalls++;const result=await service.propose(query(),options);
      return {base_signature:snapshot.signature,context:query().context,options:result.proposals,status:'partial',
        live_ai_used:result.provider.live_call,cached:result.cached};
    }})},
    HEWRSAtomicRenderer:{create:()=>({render:async()=>({cancelled:false}),cancel(){}})},
    setInterval,clearInterval,queueMicrotask,addEventListener(){}};
  for(const name of ['localStorage','sessionStorage','indexedDB'])
    Object.defineProperty(context,name,{get(){throw Error('Unexpected storage access: '+name);}});
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/ai-five-panel.js'),'utf8'),context);
  const node=id=>document.getElementById(id);
  return {requests,node,panel:context.HEWRSAIFivePanel,flowCalls:()=>flowCalls,
    connect:async()=>{node('ai-five-token').value=TOKEN;await node('ai-five-connect').onclick();},
    refresh:()=>node('ai-five-refresh').onclick(),
    setHealth:value=>status=value,setStatusError:value=>statusError=value,
    setGenerationError:value=>generationError=value,setNow:value=>now=value,
    deferStatus:()=>{let release;statusGate=new Promise(resolve=>{release=resolve;});return ()=>{statusGate=null;release();};}};
}
test('disabled service authenticates and displays its verified model and budget using only GET',async()=>{
  const h=harness(health({configured:false,blocked_by:['ai_five_disabled']}));
  assert.equal(h.requests.length,0);assert.equal(h.node('generate-ai-five').disabled,true);
  assert.equal(h.node('ai-five-refresh').disabled,true);
  await h.connect();
  assert.equal(h.node('ai-five-token').value,'');
  assert.match(h.node('ai-five-readiness').textContent,/Authenticated\. Model: gpt-6\.1-sol\. Attempts remaining at last check: 1 of 1\./);
  assert.match(h.node('ai-five-status').textContent,/generation is unavailable: ai_five_disabled/);
  assert.equal(h.node('generate-ai-five').disabled,true);assert.equal(h.node('ai-five-refresh').disabled,false);
  assert.equal(h.requests.length,1);assert.equal(h.requests[0].init.method,'GET');
  assert.equal(h.requests[0].init.headers.Authorization,'Bearer '+TOKEN);
  assert.equal(JSON.stringify(h.panel.diagnostics()).includes(TOKEN),false);
});
test('Refresh reuses the memory token after activation and only a positive verified idle budget enables Generate',async()=>{
  const h=harness(health({configured:false,blocked_by:['ai_five_disabled']}));await h.connect();
  h.setHealth(health());await h.refresh();
  assert.equal(h.node('generate-ai-five').disabled,false);assert.equal(h.panel.diagnostics().available,true);
  for(const overrides of [{remaining_calls:0},{remaining_calls:null},{remaining_calls:2},{total_call_limit:0},{busy:true},{busy:undefined}]){
    h.setHealth(health(overrides));await h.refresh();
    assert.equal(h.node('generate-ai-five').disabled,true);assert.equal(h.panel.diagnostics().available,false);
    await h.panel.generate();assert.equal(h.flowCalls(),0);
  }
  assert.ok(h.requests.every(request=>request.init.method==='GET' && request.url.endsWith('/v1/ai-five/status')));
  assert.ok(h.requests.every(request=>request.init.headers.Authorization==='Bearer '+TOKEN));
  assert.equal(h.node('ai-five-token').value,'');
});
test('failed refresh clears verified readiness but allows a read-only recovery without token reentry',async()=>{
  const h=harness();await h.connect();
  h.setStatusError(Error('Fixture status transport failure'));await h.refresh();
  assert.equal(h.node('generate-ai-five').disabled,true);assert.equal(h.panel.diagnostics().available,false);
  assert.match(h.node('ai-five-readiness').textContent,/not verified/);
  assert.equal(h.node('ai-five-refresh').disabled,false);
  h.setStatusError(null);await h.refresh();
  assert.equal(h.node('generate-ai-five').disabled,false);
  assert.ok(h.requests.every(request=>request.init.method==='GET' && request.init.headers.Authorization==='Bearer '+TOKEN));
});
test('authentication rejection and Disconnect clear readiness and cannot reuse a previous budget',async()=>{
  const h=harness();await h.connect();
  h.setHealth(health({authenticated:false,remaining_calls:null}));await h.refresh();
  assert.equal(h.node('ai-five-readiness').textContent,'Not connected.');
  assert.equal(h.node('generate-ai-five').disabled,true);assert.equal(h.node('ai-five-refresh').disabled,true);
  h.setHealth(health());await h.connect();h.node('ai-five-consent').checked=true;
  h.node('ai-five-disconnect').onclick();
  assert.equal(h.node('ai-five-readiness').textContent,'Not connected.');
  assert.equal(h.node('ai-five-consent').checked,false);assert.equal(h.panel.diagnostics().available,false);
  const count=h.requests.length;await h.panel.generate();await h.refresh();
  assert.equal(h.requests.length,count);assert.equal(h.flowCalls(),0);
});
test('Disconnect during a pending connection prevents a late response restoring readiness',async()=>{
  const h=harness(),release=h.deferStatus(),pending=h.connect();
  assert.equal(h.node('generate-ai-five').disabled,true);
  h.node('ai-five-disconnect').onclick();release();await pending;
  assert.equal(h.node('ai-five-readiness').textContent,'Not connected.');
  assert.equal(h.node('ai-five-status').textContent,'AI generation disconnected.');
  assert.equal(h.node('generate-ai-five').disabled,true);assert.equal(h.node('ai-five-refresh').disabled,true);
});
test('expired authenticated readiness blocks generation at action time without a provider request',async()=>{
  const h=harness();await h.connect();h.node('ai-five-consent').checked=true;h.setNow(301001);
  assert.equal(h.panel.diagnostics().available,false);await h.panel.generate();
  assert.equal(h.node('generate-ai-five').disabled,true);assert.equal(h.requests.length,1);assert.equal(h.flowCalls(),0);
  assert.match(h.node('ai-five-readiness').textContent,/at last check/);
});
test('a failed consented attempt invalidates the old budget and cannot automatically retry',async()=>{
  const h=harness();await h.connect();
  await h.panel.generate();assert.equal(h.flowCalls(),0);assert.equal(h.panel.diagnostics().available,true);
  h.node('ai-five-consent').checked=true;h.setGenerationError(true);await h.panel.generate();
  assert.equal(h.requests.filter(request=>request.init.method==='POST').length,1);
  assert.equal(h.flowCalls(),1);assert.equal(h.node('generate-ai-five').disabled,true);
  assert.match(h.node('ai-five-readiness').textContent,/not verified/);
  await h.panel.generate();assert.equal(h.flowCalls(),1);
  h.setHealth(health({remaining_calls:0}));await h.refresh();
  assert.match(h.node('ai-five-readiness').textContent,/0 of 1/);
  assert.equal(h.node('generate-ai-five').disabled,true);
  assert.equal(h.requests.filter(request=>request.init.method==='POST').length,1);
});
test('completed fixture results remain displayed if a later read-only status refresh fails',async()=>{
  const h=harness();await h.connect();h.node('ai-five-consent').checked=true;await h.panel.generate();
  assert.equal(h.panel.diagnostics().hasResult,true);assert.equal(h.node('ai-five-results').children.length,1);
  assert.equal(h.node('generate-ai-five').disabled,true);
  h.setStatusError(Error('Fixture status transport failure'));await h.refresh();
  assert.equal(h.panel.diagnostics().hasResult,true);assert.equal(h.node('ai-five-results').children.length,1);
  assert.equal(h.node('generate-ai-five').disabled,true);assert.equal(h.flowCalls(),1);
  assert.equal(h.requests.filter(request=>request.init.method==='POST').length,1);
});
