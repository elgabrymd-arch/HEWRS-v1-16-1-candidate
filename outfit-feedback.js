/* HEWRS owner feedback, v1. Separate append-only browser namespace.
 * No wardrobe pixels, global garment bans, model fitting or legacy-data writes.
 * One immutable key per event prevents two tabs overwriting a shared document.
 * Restore targets a specific hide; it does not depend on device clock ordering.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HEWRSOutfitFeedback=api;})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
const PREFIX='hewrs:outfit-feedback:v1:event:',SCHEMA='hewrs.outfit-feedback.event.v1',EXPORT='hewrs.outfit-feedback.export.v1';
const clone=x=>JSON.parse(JSON.stringify(x));
function need(x,m){if(!x)throw Error(m);}
function plain(x){return x&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));}
function stable(x){if(Array.isArray(x))return '['+x.map(stable).join(',')+']';if(plain(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';return JSON.stringify(x);}
function occasion(v){const s=String(v||'work').toLowerCase();if(['work','clinic','hospital','office'].includes(s))return 'work';need(['dinner','weekend','all'].includes(s),'Unsupported feedback occasion.');return s;}
function normal(s){need(plain(s),'An exact selection is required.');
 if(Object.hasOwn(s,'topwear')){s={...(s.topwear?.startsWith('S')?{suitId:s.topwear}:s.topwear?{blazerId:s.topwear,pantId:s.pants}:{shirtOnly:true,pantId:s.pants}),shirtId:s.shirt,state:s.tie||'NO_TIE',shoeId:s.shoe,watchId:s.watch||null};}
 const o={};let modes=Number(!!s.suitId)+Number(!!s.blazerId)+Number(s.shirtOnly===true);need(modes===1,'Choose exactly one outfit configuration.');
 if(s.suitId){need(/^S\d{2}$/.test(s.suitId)&&!s.pantId,'A full suit cannot substitute separate trousers.');o.suitId=s.suitId;}
 else{if(s.blazerId){need(/^B\d{2}$/.test(s.blazerId),'Invalid blazer ID.');o.blazerId=s.blazerId;}else o.shirtOnly=true;need(/^P[A-Z]*\d{3}$/.test(s.pantId),'Exact separate-trouser ID required.');o.pantId=s.pantId;}
 need(/^DS\d{3}$/.test(s.shirtId),'Exact shirt ID required.');o.shirtId=s.shirtId;
 need(s.state==='NO_TIE'||/^T\d{3}$/.test(s.state),'Exact tie or NO_TIE required.');o.state=s.state;
 need(/^shoe-\d+$/.test(s.shoeId),'Exact shoe ID required.');o.shoeId=s.shoeId;
 need(s.watchId==null||typeof s.watchId==='string'&&/^watch-[A-Za-z0-9_-]+$/.test(s.watchId),'Invalid watch ID.');o.watchId=s.watchId||null;return o;
}
function key(s,scope='outfit'){s=normal(s);const a=[s.suitId||s.blazerId||'SHIRT_ONLY',s.pantId||'SUIT_TROUSERS',s.shirtId,s.state];if(scope!=='clothing')a.push(s.shoeId);if(scope==='historical_exact')a.push(s.watchId||'NO_WATCH');return a.join('|');}
function validatePreference(p,validateSelection){need(plain(p)&&p.schema==='hewrs.outfit-preferences.v1'&&typeof p.source_lock==='string'&&/^[a-f0-9]{64}$/.test(p.source_lock),'Unsupported preference export.');need(Number.isInteger(p.revision)&&p.revision>=0&&typeof p.enabled==='boolean'&&Array.isArray(p.comparisons)&&p.comparisons.length<=5000,'Invalid preference export.');const ids=new Set();for(const r of p.comparisons){need(plain(r)&&typeof r.id==='string'&&!ids.has(r.id),'Duplicate or invalid preference record.');ids.add(r.id);need(['A','B','both','neither'].includes(r.vote),'Unknown preference vote; not inferred.');need(['training','validation'].includes(r.partition),'Unknown preference partition.');need(typeof r.reason==='string'&&typeof r.created_at==='string'&&Number.isFinite(Date.parse(r.created_at)),'Missing original preference metadata.');for(const s of [r.a,r.b]){normal(s);validateSelection?.(s);}occasion(r.context?.occasion);need(['any','tie_required','suit_required','open_collar_allowed'].includes(r.context?.requiredFormality),'Unknown original formality.');}return clone(p);}
function create({storage,validateSelection=null,now=()=>new Date().toISOString(),id=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)}={}){
 let cache=null,blocked=null;const observers=new Set();
 function validate(e){need(plain(e)&&e.schema===SCHEMA&&/^[A-Za-z0-9_-]{1,150}$/.test(e.id)&&typeof e.at==='string'&&Number.isFinite(Date.parse(e.at)),'Invalid rejection event; original data retained.');need(['hide','restore','preferences','withdraw_preferences'].includes(e.type),'Unknown feedback action; original data retained.');
  if(e.type==='hide'){need(e.actor==='owner','A rejection must be an explicit owner action.');normal(e.selection);validateSelection?.(e.selection);need(['outfit','clothing'].includes(e.scope),'Unknown rejection scope.');occasion(e.occasion);need([null,'colors','patterns','formality','footwear','other'].includes(e.reason),'Unknown reason; not inferred.');}
  else if(e.type==='restore'||e.type==='withdraw_preferences'){need(typeof e.target==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(e.target),'Invalid undo target.');}
  else validatePreference(e.payload,validateSelection);
  return e;
 }
 function derive(events){const by=new Map(events.map(e=>[e.id,e]));const restored=new Set(),withdrawn=new Set();for(const e of events)if(e.type==='restore'||e.type==='withdraw_preferences'){need(by.get(e.target)?.type===(e.type==='restore'?'hide':'preferences'),'Undo target is missing; repair/import the complete export.');(e.type==='restore'?restored:withdrawn).add(e.target);}
  const historical=new Map();for(const e of events)if(e.type==='preferences'&&!withdrawn.has(e.id))for(const r of e.payload.comparisons){const old=historical.get(r.id);need(!old||stable(old)===stable(r),'Conflicting original vote; neither version overwritten.');historical.set(r.id,r);}
  const active=events.filter(e=>e.type==='hide'&&!restored.has(e.id));return {events,active,active_imports:events.filter(e=>e.type==='preferences'&&!withdrawn.has(e.id)),historical:[...historical.values()],token:events.map(e=>e.id+':'+stable(e)).join('\n')};
 }
 function scan(){need(storage&&typeof storage.getItem==='function'&&typeof storage.setItem==='function','Browser storage is unavailable. No permanent rejection was saved.');const events=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith(PREFIX)){let e;try{e=JSON.parse(storage.getItem(k));}catch{throw Error('Unreadable rejection record. Existing data were not cleared.');}validate(e);need(k===PREFIX+e.id,'Rejection key mismatch; existing data retained.');events.push(e);}}events.sort((a,b)=>a.id.localeCompare(b.id));return derive(events);}
 function refresh(){try{cache=scan();blocked=null;return clone(cache);}catch(e){cache=null;blocked=e.message;throw e;}}
 function read(){if(blocked)throw Error(blocked);return cache||refresh();}
 function status(){return {blocked,ready:!!cache,persistent:!!storage,active:cache?.active.length||0,historical:cache?.historical.length||0};}
 function notify(){for(const fn of observers)try{fn();}catch{} }
 function write(events){const before=refresh();const map=new Map(before.events.map(x=>[x.id,x]));for(const e of events){validate(e);const old=map.get(e.id);need(!old||stable(old)===stable(e),'Conflicting event ID; nothing overwritten.');map.set(e.id,e);}derive([...map.values()]);
  // Import is resumable/idempotent: hides precede their restores. A partial import
  // retains every written event; it is never presented as a complete success.
  const ordered=events.slice().sort((a,b)=>(['restore','withdraw_preferences'].includes(a.type))-(['restore','withdraw_preferences'].includes(b.type)));
  try{for(const e of ordered){const k=PREFIX+e.id,old=storage.getItem(k),s=JSON.stringify(e);if(old!==null){need(stable(JSON.parse(old))===stable(e),'Concurrent event conflict.');continue;}storage.setItem(k,s);need(storage.getItem(k)===s,'Browser did not persist the rejection.');}refresh();notify();return clone(cache);}catch(e){try{refresh();}catch{}throw Error('Feedback save/import did not complete: '+e.message+' Existing records were retained.');}}
 function hide(s,{context='work',scope='outfit',reason=null}={}){const selection=normal(s);validateSelection?.(selection);const occ=occasion(typeof context==='object'?context.occasion:context),snap=refresh();const same=snap.active.find(e=>e.scope===scope&&e.occasion===occ&&key(e.selection,scope)===key(selection,scope));if(same)return clone(same);const e={schema:SCHEMA,id:id(),at:now(),type:'hide',actor:'owner',selection,scope,occasion:occ,reason};write([e]);return clone(e);}
 function restore(target){const snap=refresh(),e=snap.events.find(x=>x.id===target);need(e?.type==='hide','Unknown hidden outfit.');if(!snap.active.some(x=>x.id===target))return false;write([{schema:SCHEMA,id:id(),at:now(),type:'restore',target}]);return true;}
 function match(s,context={}){s=normal(s);const snap=read(),occ=occasion(typeof context==='string'?context:context.occasion);const why=[];
  if(s.suitId==='S01'&&s.shirtId==='DS029'&&s.state==='T024')why.push({type:'owner_core',id:'S01_DS029_T024',reason:null,scope:'clothing',occasion:'all'});
  for(const e of snap.active)if((e.occasion==='all'||e.occasion===occ)&&key(e.selection,e.scope)===key(s,e.scope))why.push({type:'hide',id:e.id,reason:e.reason,scope:e.scope,occasion:e.occasion});
  // Explicit Neither records are exact outfit/context prohibitions, not A/B losers,
  // and do not infer a clothing-wide or garment-wide rejection.
  for(const r of snap.historical)if(r.vote==='neither'&&occasion(r.context.occasion)===occ&&[r.a,r.b].some(x=>key(x,'historical_exact')===key(s,'historical_exact')))why.push({type:'historical_neither',id:r.id,reason:null,scope:'historical_exact',occasion:occ,partition:r.partition});
  return {allowed:why.length===0,reasons:why};
 }
 function allowed(s,c){return match(s,c).allowed;}
 function assertCurrent(token){const s=refresh();need(s.token===token,'Feedback changed during generation/rendering. Refresh alternatives; no hidden outfit was applied.');return true;}
 function exportData(){const s=refresh();return {schema:EXPORT,exported_at:now(),events:s.events};}
 function importData(doc){need(plain(doc)&&doc.schema===EXPORT&&Array.isArray(doc.events)&&doc.events.length<=20000,'Unsupported feedback backup.');write(clone(doc.events));return refresh();}
 function importPreferences(doc){validatePreference(doc,validateSelection);const prior=refresh();if(prior.active_imports.some(e=>stable(e.payload)===stable(doc)))return false;write([{schema:SCHEMA,id:id(),at:now(),type:'preferences',payload:clone(doc)}]);return true;}
 function withdrawPreferences(target){const snap=refresh();need(snap.events.find(e=>e.id===target)?.type==='preferences','Unknown preference import.');if(!snap.active_imports.some(e=>e.id===target))return false;write([{schema:SCHEMA,id:id(),at:now(),type:'withdraw_preferences',target}]);return true;}
 function reorder(rows,getSelection,context){const snap=read(),occ=occasion(typeof context==='string'?context:context?.occasion),arr=rows.filter(r=>allowed(getSelection(r),context));const ks=arr.map(r=>key(getSelection(r),'historical_exact'));const index=new Map(ks.map((k,i)=>[k,i])),edges=new Set();
  for(const r of snap.historical){if(r.partition!=='training'||!['A','B'].includes(r.vote)||occasion(r.context.occasion)!==occ)continue;const w=index.get(key(r.vote==='A'?r.a:r.b,'historical_exact')),l=index.get(key(r.vote==='A'?r.b:r.a,'historical_exact'));if(w!==undefined&&l!==undefined&&w!==l)edges.add(w+'>'+l);}
  // Stable topological ranking of directly expressed pair preferences only.
  // Conflicting/cyclic preferences leave the remaining original ordering intact.
  const result=[],pending=new Set(arr.map((_,i)=>i));while(pending.size){let first=[...pending].find(i=>![...edges].some(e=>{const[a,b]=e.split('>').map(Number);return b===i&&pending.has(a);}));if(first===undefined){result.push(...[...pending].map(i=>arr[i]));break;}result.push(arr[first]);pending.delete(first);}return result;
 }
 function alternative(current,rows,getSelection,context){const eligible=reorder(rows,getSelection,context).filter(x=>key(getSelection(x))!==key(current));return eligible.find(x=>key(getSelection(x),'clothing')!==key(current,'clothing'))||eligible[0]||null;}
 return Object.freeze({refresh,status,hide,restore,match,allowed,assertCurrent,exportData,importData,importPreferences,withdrawPreferences,reorder,alternative,token:()=>read().token,snapshot:()=>clone(read()),subscribe:fn=>{observers.add(fn);return()=>observers.delete(fn);},prefix:PREFIX});
}
return Object.freeze({create,key,normal,occasion,validatePreference,stable,PREFIX,SCHEMA,EXPORT,revision:'hewrs.owner-feedback.v1'});
});
