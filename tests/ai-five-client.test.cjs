'use strict';
// Transport fixtures only. No live service, credentials, provider or paid call.
const assert=require('node:assert/strict');
const {test}=require('node:test');
const Client=require('../src/ai-five-client.js');
const SOURCE='a'.repeat(64),CATALOGUE='b'.repeat(64),TOKEN='service-test-'.repeat(4),ID='c'.repeat(32);
const config={enabled:true,endpoint:'https://ai-five-fixture.invalid',source_lock:SOURCE,catalogue_fingerprint:CATALOGUE};
const status=()=>({schema:Client.STATUS,configured:true,authenticated:true,blocked_by:[],source_lock:SOURCE,
  catalogue_fingerprint:CATALOGUE,model:'configured-model',capabilities:[Client.CAPABILITY]});
const query=()=>({source_lock:SOURCE,context:{occasion:'work',requiredFormality:'any'},localDate:'2026-11-17',
  weather:{source:'manual',temperatureBand:'cool',precipitation:'dry',season:'Fall'},
  excluded_outfit_keys:Array.from({length:20},(_,i)=>JSON.stringify(['S01','SUIT_TROUSERS','DS'+String(i+1).padStart(3,'0'),'NO_TIE','shoe-8']))});
const reply=()=>({schema:Client.RESPONSE,request_id:ID,source_lock:SOURCE,catalogue_fingerprint:CATALOGUE,
  proposals:[{selection:{suitId:'S02',blazerId:null,shirtOnly:false,pantId:null,shirtId:'DS025',state:'NO_TIE',shoeId:'shoe-8',watchId:'watch-R01'},occasion:'work',rationale:'Transport fixture, not AI output.'}],
  job_id:'fixture-job',provider:{name:'openai',requested_model:'configured-model',model:'resolved-model',response_id:'fixture-response',live_call:false},cached:false});
function fixture(overrides={}) {
  const requests=[];let health=status(),answer=reply(),now=1000;
  const fetcher=async(url,init)=>{requests.push({url,init});return new Response(JSON.stringify(url.endsWith('/status')?health:answer),{status:200,headers:{'Content-Type':'application/json'}});};
  const client=Client.create({config,fetcher,randomId:()=>ID,clock:()=>now,...overrides});
  return {client,requests,setStatus:value=>health=value,setReply:value=>answer=value,setNow:value=>now=value};
}
test('disabled config and construction make no request; invalid credentials never leave page',async()=>{
  const f=fixture({config:{...config,enabled:false}});
  assert.equal(f.requests.length,0);assert.equal(f.client.configured(),false);assert.equal(f.client.ready(),false);
  await assert.rejects(f.client.connect(TOKEN),{code:'AI_FIVE_NOT_CONFIGURED'});assert.equal(f.requests.length,0);
  const live=fixture();
  await assert.rejects(live.client.connect('sk-'+TOKEN),{code:'AI_FIVE_TOKEN'});
  await assert.rejects(live.client.connect(TOKEN+'\nInjected: header'),{code:'AI_FIVE_TOKEN'});
  assert.equal(live.requests.length,0);assert.equal(live.client.ready(),false);
});
test('status-only connection, allowlisted request and truthful non-live provenance',async()=>{
  const f=fixture();const connected=await f.client.connect(TOKEN);
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].init.method,'GET');assert.equal(f.client.ready(),true);
  assert.equal(JSON.stringify(connected).includes(TOKEN),false);assert.equal(JSON.stringify(f.client.diagnostics()).includes(TOKEN),false);
  const q=query();q.preferences={topwear:'PRIVATE'};q.executiveStyle='PRIVATE';q.history=[{name:'PRIVATE'}];
  q.weather.latitude=123;q.weather.city='PRIVATE';q.context.owner='PRIVATE';
  await assert.rejects(f.client.propose(q),{code:'AI_FIVE_CONSENT'});assert.equal(f.requests.length,1);
  const out=await f.client.propose(q,{consent:true});
  assert.equal(f.requests.length,2);const sent=f.requests[1],packet=JSON.parse(sent.init.body);
  assert.equal(sent.url,config.endpoint+'/v1/ai-five/generate');assert.equal(sent.init.method,'POST');
  assert.equal(sent.init.headers.Authorization,'Bearer '+TOKEN);assert.equal(sent.init.credentials,'omit');
  assert.equal(sent.init.cache,'no-store');assert.equal(sent.init.redirect,'error');assert.equal(sent.init.headers.Origin,undefined);
  assert.deepEqual(Object.keys(packet).sort(),['consent','request','schema']);
  assert.equal(packet.schema,Client.REQUEST);assert.equal(packet.consent,true);assert.equal(packet.request.request_id,ID);
  assert.deepEqual(Object.keys(packet.request).sort(),['catalogue_fingerprint','context','excluded_outfit_keys','localDate','request_id','source_lock','weather']);
  assert.equal(sent.init.body.includes('PRIVATE'),false);assert.equal(sent.init.body.includes('latitude'),false);
  assert.deepEqual(packet.request.excluded_outfit_keys,q.excluded_outfit_keys);
  assert.equal(out.provider.live_call,false);assert.equal(out.provider.model,'resolved-model');
  assert.ok(Object.isFrozen(out));assert.ok(Object.isFrozen(out.proposals[0].selection));
  assert.deepEqual(out.proposals[0].selection,{suitId:'S02',shirtId:'DS025',state:'NO_TIE',shoeId:'shoe-8',watchId:'watch-R01'});
  assert.equal(q.preferences.topwear,'PRIVATE');
  f.client.disconnect();assert.equal(f.client.ready(),false);
  await assert.rejects(f.client.propose(q,{consent:true}),{code:'AI_FIVE_NOT_CONNECTED'});assert.equal(f.requests.length,2);
});
test('legacy review endpoint and mismatched source cannot become ready',async()=>{
  for (const invalid of [
    {...status(),schema:'hewrs.review-service.status.v1'},
    {...status(),capabilities:[]},
    {...status(),source_lock:'d'.repeat(64)},
    {...status(),catalogue_fingerprint:'d'.repeat(64)},
    {...status(),authenticated:false},
    {...status(),configured:true,blocked_by:['disabled']}
  ]) {
    const f=fixture();f.setStatus(invalid);await assert.rejects(f.client.connect(TOKEN));assert.equal(f.client.ready(),false);
    await assert.rejects(f.client.propose(query(),{consent:true}));assert.equal(f.requests.length,1);
  }
  const f=fixture();f.setStatus({...status(),configured:false,blocked_by:['AI_FIVE_DISABLED']});
  const unavailable=await f.client.connect(TOKEN);assert.equal(unavailable.configured,false);assert.equal(f.client.ready(),false);
});
test('fresh authenticated status expires and failed refresh cannot retain readiness',async()=>{
  const f=fixture({statusTtlMs:100});await f.client.connect(TOKEN);f.setNow(1100);
  assert.equal(f.client.ready(),false);await assert.rejects(f.client.propose(query(),{consent:true}));assert.equal(f.requests.length,1);
  await f.client.check();assert.equal(f.client.ready(),true);
  f.setStatus({...status(),source_lock:'e'.repeat(64)});await assert.rejects(f.client.check());assert.equal(f.client.ready(),false);
});
test('invalid exclusions, date, source and weather stop before provider route',async()=>{
  const f=fixture();await f.client.connect(TOKEN);
  for (const q of [
    {...query(),excluded_outfit_keys:[]},
     {...query(),excluded_outfit_keys:[...query().excluded_outfit_keys,JSON.stringify(['S02','SUIT_TROUSERS','DS001','NO_TIE','shoe-8'])]},
    {...query(),excluded_outfit_keys:Array(20).fill(query().excluded_outfit_keys[0])},
    {...query(),localDate:'2026-02-30'},
    {...query(),source_lock:'e'.repeat(64)},
    {...query(),weather:{...query().weather,temperatureBand:'precise-coordinate'}},
    {...query(),weather:{...query().weather,temperatureBand:null}},
    {...query(),weather:{source:'forecast',temperatureBand:'cool',precipitation:'dry'}},
    {...query(),context:{occasion:'holiday',requiredFormality:'any'}}
  ]) await assert.rejects(f.client.propose(q,{consent:true}));
  assert.equal(f.requests.length,1);
  const q=query();q.weather.source='not_assessed';await f.client.propose(q,{consent:true});
  assert.deepEqual(JSON.parse(f.requests[1].init.body).request.weather,{source:'not_assessed',temperatureBand:null,precipitation:null,season:null});
});
test('strict wire selections normalize only validated inactive fields into native routes',async()=>{
  const f=fixture();await f.client.connect(TOKEN);
  const shared={shirtId:'DS025',state:'NO_TIE',shoeId:'shoe-8',watchId:'watch-R01'};
  for (const [wire,canonical] of [
    [{suitId:'S02',blazerId:null,shirtOnly:false,pantId:null,...shared},{suitId:'S02',...shared}],
    [{suitId:null,blazerId:'B03',shirtOnly:false,pantId:'P01',...shared},{blazerId:'B03',pantId:'P01',...shared}],
    [{suitId:null,blazerId:null,shirtOnly:true,pantId:'P01',...shared},{shirtOnly:true,pantId:'P01',...shared}]
  ]) {
    f.setReply({...reply(),proposals:[{...reply().proposals[0],selection:wire}]});
    const out=await f.client.propose(query(),{consent:true});assert.deepEqual(out.proposals[0].selection,canonical);
    assert.equal(Object.keys(wire).length,8,'Response normalization mutated original wire fixture');
  }
});
test('ambiguous, incomplete or malformed wire selection is rejected, never repaired',async()=>{
  const base=reply().proposals[0].selection;
  const missing={...base};delete missing.blazerId;
  const missingWatch={...base};delete missingWatch.watchId;
  const f=fixture();await f.client.connect(TOKEN);
  for (const selection of [
    {...base,blazerId:'B03'}, {...base,shirtOnly:true}, {...base,pantId:'P01'},
    {...base,suitId:null}, {...base,suitId:null,blazerId:'B03'},
    {...base,suitId:null,shirtOnly:true}, {...base,suitId:null,blazerId:'B03',pantId:'P01',shirtOnly:true},
    {...base,suitId:''}, {...base,blazerId:false}, {...base,shirtOnly:'false'},
    {...base,shirtId:null}, {...base,state:42}, {...base,shoeId:[]},
    {...base,watchId:null}, {...base,watchId:''}, {...base,watchId:{}}, {...base,watchId:'unidentified'},
    {...base,watchId:'watch-R01 extra'}, {...base,extra:true}, missing, missingWatch
  ]) {
    const before=f.requests.length;
    f.setReply({...reply(),proposals:[{...reply().proposals[0],selection}]});
    await assert.rejects(f.client.propose(query(),{consent:true}),{code:'AI_FIVE_SELECTION'});
    assert.equal(f.requests.length,before+1,'Malformed provider response was retried');
  }
});
test('request, source, occasion and provider mismatches reject response without retry',async()=>{
  const variants=[
    {...reply(),request_id:'d'.repeat(32)},
    {...reply(),schema:'hewrs.visual-stylist.v1'},
    {...reply(),source_lock:'e'.repeat(64)},
    {...reply(),catalogue_fingerprint:'e'.repeat(64)},
    {...reply(),provider:{...reply().provider,requested_model:'other-model'}},
    {...reply(),provider:{...reply().provider,response_id:null}},
    {...reply(),provider:{...reply().provider,live_call:'true'}},
    {...reply(),proposals:[{...reply().proposals[0],occasion:'dinner'}]},
    {...reply(),proposals:Array(41).fill(reply().proposals[0])}
  ];
  for (const invalid of variants) {
    const f=fixture();await f.client.connect(TOKEN);f.setReply(invalid);
    await assert.rejects(f.client.propose(query(),{consent:true}));assert.equal(f.requests.length,2);
  }
});
test('concurrent generation, cancellation and disconnect never accept stale result',async()=>{
  let settle;const requests=[];
  const fetcher=async(url,init)=>{requests.push({url,init});
    if(url.endsWith('/status'))return new Response(JSON.stringify(status()));
    return new Promise(resolve=>{settle=()=>resolve(new Response(JSON.stringify(reply())));});};
  const client=Client.create({config,fetcher,randomId:()=>ID});await client.connect(TOKEN);
  const pending=client.propose(query(),{consent:true});
  await assert.rejects(client.propose(query(),{consent:true}),{code:'AI_FIVE_BUSY'});assert.equal(requests.length,2);
  client.disconnect();settle();await assert.rejects(pending,{code:'AI_FIVE_CANCELLED'});assert.equal(client.ready(),false);
  await client.connect(TOKEN);
  let cancelled=false;const pending2=client.propose(query(),{consent:true,isCancelled:()=>cancelled});
  cancelled=true;settle();await assert.rejects(pending2,{code:'AI_FIVE_CANCELLED'});
  const before=requests.length;
  await assert.rejects(client.propose(query(),{consent:true,isCancelled:()=>true}),{code:'AI_FIVE_CANCELLED'});
  assert.equal(requests.length,before);
});
test('timeout and unauthorized response do not silently retry',async()=>{
  let calls=0;
  const timeout=Client.create({config,timeouts:{status:10,generate:10},fetcher:async(url,init)=>{
    calls++;return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
  }});
  await assert.rejects(timeout.connect(TOKEN),{code:'AI_FIVE_TIMEOUT'});assert.equal(calls,1);assert.equal(timeout.ready(),false);
  const bad=fixture({fetcher:async(url)=>url.endsWith('/status')?new Response(JSON.stringify(status())):new Response(JSON.stringify({error:{message:'Unauthorized'}}),{status:401})});
  await bad.client.connect(TOKEN);await assert.rejects(bad.client.propose(query(),{consent:true}),{code:'AI_FIVE_SERVICE_ERROR'});
  assert.equal(bad.client.ready(),false);
});
test('oversized streamed response is refused',async()=>{
  let cancelled=false;
  const f=fixture({fetcher:async()=>new Response(new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(210000));},cancel(){cancelled=true;}}))});
  await assert.rejects(f.client.connect(TOKEN),{code:'AI_FIVE_RESPONSE_SIZE'});assert.equal(cancelled,true);assert.equal(f.client.ready(),false);
});

test('finite 1–20 native option lists keep their exact keys',async()=>{
 const f=fixture();await f.client.connect(TOKEN);
 for(const n of [1,5,19,20]){
  const q=query();q.excluded_outfit_keys=q.excluded_outfit_keys.slice(0,n);
  await f.client.propose(q,{consent:true});
  assert.deepEqual(JSON.parse(f.requests.at(-1).init.body).request.excluded_outfit_keys,q.excluded_outfit_keys);
 }
});
