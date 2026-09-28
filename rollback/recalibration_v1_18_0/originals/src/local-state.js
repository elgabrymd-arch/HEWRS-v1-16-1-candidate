/* Isolated candidate storage. No production keys, silent imports, ID migration,
 * generated wear entries, or persistent aesthetic scores. */
(function(root){'use strict';
const KEY='hewrs:connected-app:v1',SCHEMA='hewrs.connected-app.local.v1';
const clone=x=>structuredClone(x),need=(x,s)=>{if(!x)throw Error(s);};
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;}
function create(connection,lock,backend){
 let state={schema:SCHEMA,source_lock:lock,revision:0,session:null,events:[]},raw=null,blocked=null,persistent=!!backend;
 const suitSelection=['suitId','shirtId','state','shoeId','watchId'],blazerSelection=['blazerId','pantId','shirtId','state','shoeId','watchId'],shirtOnlySelection=['shirtOnly','pantId','shirtId','state','shoeId','watchId'];
 function selection(s){need(s&&typeof s==='object'&&!Array.isArray(s),'Malformed saved selection');const fields=Object.hasOwn(s,'shirtOnly')?shirtOnlySelection:Object.hasOwn(s,'blazerId')?blazerSelection:suitSelection;need(Object.keys(s).length===fields.length&&fields.every(k=>Object.hasOwn(s,k)),'Unexpected selection fields');return connection.validateSelection(s);}
 function session(s){
  if(s===null)return null;need(s&&typeof s==='object'&&!Array.isArray(s),'Malformed session');
  need(Object.keys(s).every(k=>['selection','origin','localDate','context','mode'].includes(k)),'Unexpected session fields');
  selection(s.selection);if(Object.hasOwn(s.selection,'shirtOnly'))need(s.mode==='anchor'&&s.origin==='manual','Shirt-only is an explicit manual Anchor session');need(['manual','engine','reference'].includes(s.origin),'Unknown session origin');need(['anchor','engine'].includes(s.mode),'Unknown workflow');need(date(s.localDate),'Invalid local calendar date');
  need(s.context&&Object.keys(s.context).every(k=>['occasion','requiredFormality'].includes(k)),'Unexpected context fields');
  need(['clinic','hospital','work'].includes(s.context.occasion),'Invalid S05 setting');need(['any','tie_required','suit_required','open_collar_allowed'].includes(s.context.requiredFormality),'Invalid formality');return s;
 }
 function validate(v){
  need(v&&typeof v==='object'&&!Array.isArray(v)&&v.schema===SCHEMA,'Different backup schema; not imported or migrated');
  need(Object.keys(v).every(k=>['schema','source_lock','revision','session','events'].includes(k)),'Unexpected storage fields');
  need(v.source_lock===lock,'Different source revision; saved IDs require explicit version reconciliation');
  need(Number.isSafeInteger(v.revision)&&v.revision>=0,'Invalid storage revision');session(v.session);
  need(Array.isArray(v.events)&&v.events.length<=10000,'Invalid event ledger');
  const seen=new Set();
  for(const e of v.events){
   need(e&&typeof e==='object'&&!Array.isArray(e),'Malformed event');
   need(Object.keys(e).every(k=>['id','localDate','date','confirmed','origin','controlledRepetition','items','canonical_selection','source_lock'].includes(k)),'Unexpected event fields');
   need(typeof e.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(e.id)&&!seen.has(e.id),'Missing or duplicate wear event ID');seen.add(e.id);
   need(e.confirmed===true&&date(e.localDate)&&e.date===e.localDate,'Unconfirmed or invalid wear date');
   need(['manual','engine'].includes(e.origin)&&typeof e.controlledRepetition==='boolean','Invalid wear origin');
   need(e.source_lock===lock,'Different event source revision');selection(e.canonical_selection);if(Object.hasOwn(e.canonical_selection,'shirtOnly'))need(e.origin==='manual','No Engine recommendation is recorded for shirt-only');
   need(e.canonical_selection.state!=='REFERENCE','Reference is not an exact tie wear record');
   const ids=connection.historyIds(e.canonical_selection);
   need(e.items&&Object.keys(e.items).length===Object.keys(ids).length,'Incomplete wear identity');
   for(const [role,id] of Object.entries(ids))need(id===null?e.items[role]===null:e.items[role]&&Object.keys(e.items[role]).length===1&&e.items[role].id===id,'Historical/canonical ID disagreement at '+role);
  }
  return clone(v);
 }
 try{if(backend){raw=backend.getItem(KEY);if(raw!==null)state=validate(JSON.parse(raw));}}catch(e){blocked='Stored data retained, not reset: '+e.message;}
 function commit(next){
  need(!blocked,blocked);const v=validate(next),text=JSON.stringify(v);
  if(backend){try{need(backend.getItem(KEY)===raw,'Storage changed in another tab; reload before writing');backend.setItem(KEY,text);need(backend.getItem(KEY)===text,'Persistent write could not be verified');raw=text;}catch(e){persistent=false;throw Error('No save confirmed: '+e.message);}}
  state=v;return clone(state);
 }
 function saveSession(value){session(value);return commit({...clone(state),revision:state.revision+1,session:clone(value)});}
 function addEvent(e){need(!state.events.some(x=>x.id===e.id),'Duplicate event; nothing added');return commit({...clone(state),revision:state.revision+1,events:[...clone(state.events),clone(e)]});}
 function previewImport(text){need(typeof text==='string'&&text.length<=25_000_000,'Backup too large');return validate(JSON.parse(text));}
 function restore(preview){need(!blocked,'Existing invalid data remains preserved; restore into a fresh namespace only');return commit({...validate(preview),revision:state.revision+1});}
 return Object.freeze({key:KEY,snapshot:()=>clone(state),status:()=>({persistent:!!backend&&persistent,blocked,scope:'Only this candidate namespace; production history is not read'}),validate,saveSession,addEvent,previewImport,restore,exportText:()=>{if(blocked){need(raw!==null,'Existing saved data could not be read; no backup claimed');return raw;}return JSON.stringify(state,null,2);}});
}
root.HEWRSLocalState=Object.freeze({create,KEY,SCHEMA,date});
})(globalThis);
