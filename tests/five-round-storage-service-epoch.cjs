'use strict';
// Real network adapter; every transport response is deferred synthetic data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../src/visual-stylist-client.js'),'utf8');
const schema='hewrs.visual-stylist.v1',password='synthetic-private-password';
function fixture(){
 const root={};new Function('globalThis',source)(root);
 const requests=[],client=root.HEWRSVisualStylistClient.create({config:{endpoint:'https://synthetic.invalid'},fetcher:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}))});
 const response=(status,data,text=null)=>({status,ok:status>=200&&status<300,text:text||(()=>Promise.resolve(JSON.stringify({schema,...data})))});
 const session=token=>({schema,token,expires_at:Date.now()/1000+600,live_ready:true});
 const reply=(index,status,data,text)=>requests[index].resolve(response(status,data,text));
 const request={source_lock:'a'.repeat(64),prefs:{},context:{occasion:'work'},executiveStyle:'AUTO',localDate:'2026-11-19',environment:{source:'not_assessed'}};
 return{client,requests,reply,session,request,async login(token='first'){const index=requests.length,promise=client.login(password);reply(index,200,session(token));await promise;assert.equal(client.ready(),true);}};
}
test('an aborted old 401 response cannot clear a newer successful service session',async()=>{
 const h=fixture();await h.login();const old=h.client.propose(h.request).catch(error=>error),oldRequest=h.requests[1];
 await h.login('newer');assert.equal(oldRequest.options.signal.aborted,true);
 h.reply(1,401,{error:'EXPIRED',message:'Old session expired'});const error=await old;assert.equal(error.code,'CANCELLED');
 assert.equal(h.client.ready(),true,'Old 401 must not erase the newer login');
});
test('a current 401 response still clears the session and reports the service failure',async()=>{
 const h=fixture();await h.login();const pending=h.client.propose(h.request);h.reply(1,401,{error:'EXPIRED',message:'Current session expired'});
 await assert.rejects(pending,/EXPIRED/);assert.equal(h.client.ready(),false);
});
test('a current 401 clears credentials even when reading its error body fails',async()=>{
 const h=fixture();await h.login();const pending=h.client.propose(h.request);h.reply(1,401,{},()=>Promise.reject(Error('synthetic body failure')));
 await assert.rejects(pending,/body failure/);assert.equal(h.client.ready(),false);
});
test('an obsolete logout finally cannot disconnect a newer successful login',async()=>{
 const h=fixture();await h.login();const old=h.client.logout().catch(error=>error);await h.login('newer');h.reply(1,200,{});
 const error=await old;assert.equal(error.code,'CANCELLED');assert.equal(h.client.ready(),true,'Old logout must not clear newer authentication');
});
test('a current successful logout still disconnects the active service session',async()=>{
 const h=fixture();await h.login();const pending=h.client.logout();h.reply(1,200,{});await pending;assert.equal(h.client.ready(),false);
});
test('Disconnect between call completion and login publication cannot restore credentials',async()=>{
 const h=fixture(),pending=h.client.login(password),outcome=pending.then(value=>({value}),error=>({error}));
 // Queue Disconnect after call() has checked/parses its completed response,
 // but before the outer login() await publishes its token.
 h.reply(0,200,{},()=>Promise.resolve(JSON.stringify(h.session('stale'))).then(text=>{queueMicrotask(()=>queueMicrotask(()=>h.client.disconnect()));return text;}));
 const result=await outcome;assert.equal(h.client.ready(),false,'A completed old call cannot resurrect authentication after Disconnect');assert.equal(result.error?.code,'CANCELLED');
});
test('Cancel between call completion and login publication prevents stale sign-in',async()=>{
 const h=fixture(),pending=h.client.login(password),outcome=pending.then(value=>({value}),error=>({error}));
 h.reply(0,200,{},()=>Promise.resolve(JSON.stringify(h.session('stale'))).then(text=>{queueMicrotask(()=>queueMicrotask(()=>h.client.cancel()));return text;}));
 const result=await outcome;assert.equal(h.client.ready(),false);assert.equal(result.error?.code,'CANCELLED');
});
