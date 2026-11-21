/* Native recommendation exposure, not confirmed wear.
 * One immutable record per successfully displayed generation/refill keeps tabs
 * from overwriting a shared counter. Callers pass only new rows for a refill.
 * Existing wear, preference and rejection storage is never modified.
 */
(function(root,factory){'use strict';const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.HEWRSTieExposure=api;})(typeof globalThis==='object'?globalThis:this,function(root){'use strict';
const PREFIX='hewrs:tie-exposure:v1:event:',SCHEMA='hewrs.tie-exposure.event.v1',MAX_EVENTS=5000,MAX_OPTIONS=20;
const OCCASIONS=['work','dinner','weekend'],ID=/^[A-Za-z0-9_-]{1,150}$/,TIE=/^T\d{3}$/;
const clone=x=>JSON.parse(JSON.stringify(x));
const counts=()=>({work:{},dinner:{},weekend:{}});
function need(value,message){if(!value)throw Error(message);}
function plain(value){return value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));}
function occasion(value){const normalized=String(value||'').toLowerCase();need(OCCASIONS.includes(normalized),'A Work, Dinner or Weekend occasion is required for tie exposure.');return normalized;}
function timestamp(value){need(typeof value==='string'&&Number.isFinite(Date.parse(value)),'Invalid tie exposure timestamp.');return value;}
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(plain(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
function tieCounts(selections){
 need(Array.isArray(selections)&&selections.length<=MAX_OPTIONS,'Tie exposure requires at most 20 newly displayed selections.');
 const result={};
 for(const selection of selections){
  need(plain(selection),'Tie exposure requires exact displayed selections.');
  const hasState=Object.hasOwn(selection,'state'),hasTie=Object.hasOwn(selection,'tie');
  need(hasState||hasTie,'Displayed selection is missing its tie state.');
  const state=hasState?selection.state:(selection.tie===null?'NO_TIE':selection.tie);
  if(hasState&&hasTie)need(state===(selection.tie===null?'NO_TIE':selection.tie),'Conflicting tie states in displayed selection.');
  need(typeof state==='string'&&(state==='NO_TIE'||TIE.test(state)),'Invalid displayed tie ID.');
  if(state!=='NO_TIE')result[state]=(result[state]||0)+1;
 }
 return Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
}
function validate(event){
 need(plain(event)&&event.schema===SCHEMA&&ID.test(event.id)&&typeof event.id==='string','Invalid tie exposure record; existing data were retained.');
 need(Object.keys(event).sort().join('|')==='at|id|kind|occasion|schema|source|ties','Unknown tie exposure fields; existing data were retained.');
 timestamp(event.at);need(event.source==='native20','Unknown tie exposure source.');
 need(event.kind==='generation'||event.kind==='refill','Unknown tie exposure action.');
 need(event.occasion===occasion(event.occasion),'Tie exposure occasion must use its canonical value.');
 need(plain(event.ties)&&Object.keys(event.ties).length>0,'Tie exposure record has no displayed ties.');
 let total=0;
 for(const [tie,n] of Object.entries(event.ties)){need(TIE.test(tie)&&Number.isInteger(n)&&n>0&&n<=MAX_OPTIONS,'Invalid tie exposure count.');total+=n;}
 need(total<=MAX_OPTIONS,'Tie exposure record exceeds the native list size.');
 return event;
}
function create(storageOrOptions={},extraOptions={}){
 const options=storageOrOptions&&typeof storageOrOptions.getItem==='function'?{...extraOptions,storage:storageOrOptions}:(storageOrOptions||{});
 const storage=options.storage,now=options.now||(()=>new Date().toISOString()),makeId=options.id||(()=>root.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+Math.random().toString(36).slice(2));
 const maxEvents=options.maxEvents===undefined?MAX_EVENTS:options.maxEvents;
 need(Number.isInteger(maxEvents)&&maxEvents>=1&&maxEvents<=MAX_EVENTS,'Invalid tie exposure capacity.');
 function available(){try{return !!storage&&typeof storage.getItem==='function'&&typeof storage.setItem==='function'&&typeof storage.key==='function'&&Number.isInteger(storage.length)&&storage.length>=0;}catch{return false;}}
 function scan(){
  need(available(),'Browser storage is unavailable. Tie exposure tracking is unavailable.');
  const keys=[];
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(typeof key==='string'&&key.startsWith(PREFIX))keys.push(key);}
  need(keys.length<=MAX_EVENTS,'Tie exposure history exceeds its supported capacity; existing data were retained.');
  const events=[];
  for(const key of keys){let event;try{event=JSON.parse(storage.getItem(key));}catch{throw Error('Unreadable tie exposure record; existing data were retained.');}validate(event);need(key===PREFIX+event.id,'Tie exposure key mismatch; existing data were retained.');events.push(event);}
  events.sort((a,b)=>a.id.localeCompare(b.id));return events;
 }
 function derive(events){
  const totals=counts();let startedAt=null;
  for(const event of events){if(startedAt===null||Date.parse(event.at)<Date.parse(startedAt))startedAt=event.at;for(const [tie,n] of Object.entries(event.ties))totals[event.occasion][tie]=(totals[event.occasion][tie]||0)+n;}
  return {ok:true,persistent:true,error:null,token:SCHEMA+'\n'+events.map(stable).join('\n'),counts:totals,eventCount:events.length,startedAt};
 }
 function refresh(){try{return derive(scan());}catch(error){return {ok:false,persistent:available(),error:error.message,token:null,counts:counts(),eventCount:null,startedAt:null};}}
 function count(tieId,context,snapshot){const occ=occasion(typeof context==='object'?context?.occasion:context),snap=snapshot||refresh();return snap.ok&&(snap.counts?.[occ]?.[tieId]||0)||0;}
 function newId(){const value=makeId();need(typeof value==='string'&&ID.test(value),'Invalid tie exposure generation ID.');return value;}
 function commit(generationId,selections,context={}){
  need(typeof generationId==='string'&&ID.test(generationId),'A unique generation ID is required for tie exposure.');
  const data={source:'native20',kind:context.kind||'generation',occasion:occasion(context.occasion),ties:tieCounts(selections)};
  need(data.kind==='generation'||data.kind==='refill','Unknown tie exposure action.');
  const before=scan(),old=before.find(event=>event.id===generationId);
  if(old){const original={source:old.source,kind:old.kind,occasion:old.occasion,ties:old.ties};need(stable(original)===stable(data),'Conflicting tie exposure generation ID; existing data were retained.');return {recorded:false,eventId:generationId,snapshot:derive(before)};}
  // No tie exposure occurred. Avoid filling the ledger with open-collar lists.
  if(Object.keys(data.ties).length===0)return {recorded:false,eventId:null,snapshot:derive(before)};
  need(before.length<maxEvents,'Tie exposure history capacity reached; existing counts were retained.');
  const event=validate({schema:SCHEMA,id:generationId,at:timestamp(now()),...data}),key=PREFIX+generationId,serialized=JSON.stringify(event);
  // Unique IDs plus independent immutable keys avoid shared-counter lost updates.
  const concurrent=storage.getItem(key);
  if(concurrent!==null){let existing;try{existing=validate(JSON.parse(concurrent));}catch{throw Error('Conflicting tie exposure record; existing data were retained.');}need(stable({source:existing.source,kind:existing.kind,occasion:existing.occasion,ties:existing.ties})===stable(data),'Conflicting tie exposure generation ID; existing data were retained.');return {recorded:false,eventId:generationId,snapshot:derive(scan())};}
  try{storage.setItem(key,serialized);need(storage.getItem(key)===serialized,'Browser did not persist the tie exposure record.');}catch(error){throw Error('Tie exposure was not saved: '+error.message+' Existing history was retained.');}
  return {recorded:true,eventId:generationId,snapshot:derive(scan())};
 }
 return Object.freeze({refresh,snapshot:refresh,count,newId,commit,prefix:PREFIX});
}
return Object.freeze({create,occasion,prefix:PREFIX,schema:SCHEMA,maxEvents:MAX_EVENTS});
});
