/* Exact outfit bookmarks, separate from the existing wear/session ledger.
 * No recommendation, score, wardrobe migration, or inferred wear history.
 * Writes use a raw-storage comparison to reject stale-tab updates.
 */
(function(root){'use strict';
const KEY='hewrs:connected-app:favorites:v1',SCHEMA='hewrs.connected-app.favorites.v1';
const MAX=500,MAX_BYTES=1000000,clone=x=>structuredClone(x);
const need=(v,m)=>{if(!v)throw Error(m);};
const fields=(v,n)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===n.length&&n.every(k=>Object.hasOwn(v,k));
function create(connection,lock,backend){
 let state={schema:SCHEMA,source_lock:lock,revision:0,items:[]},raw=null,blocked=null,persistent=!!backend;
 function selection(value){const s=connection.validateSelection(value);need(s.state!=='REFERENCE','A retained reference is not an exact favorite outfit');return s;}
 function key(value){const s=selection(value);return JSON.stringify([s.shirtOnly===true?'shirt-only':s.blazerId?'blazer':'suit',s.suitId??null,s.blazerId??null,s.pantId??null,s.shirtId,s.state,s.shoeId,s.watchId]);}
 function validate(value){
  need(fields(value,['schema','source_lock','revision','items'])&&value.schema===SCHEMA,'This is not a Favorites backup; wear backups are separate');
  need(value.source_lock===lock,'Favorites source lock differs; no wardrobe IDs are migrated');
  need(Number.isSafeInteger(value.revision)&&value.revision>=0,'Invalid Favorites revision');
  need(Array.isArray(value.items)&&value.items.length<=MAX,'Favorites limit is '+MAX);
  const ids=new Set(),outfits=new Set();
  for(const item of value.items){
   need(fields(item,['id','created_at','selection']),'Unexpected Favorite fields');
   need(typeof item.id==='string'&&/^favorite_[A-Za-z0-9_-]{1,90}$/.test(item.id)&&!ids.has(item.id),'Invalid or duplicate Favorite ID');ids.add(item.id);
   need(typeof item.created_at==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.created_at)&&Number.isFinite(Date.parse(item.created_at))&&new Date(item.created_at).toISOString()===item.created_at,'Invalid Favorite creation time');
   const k=key(item.selection);need(!outfits.has(k),'Duplicate exact outfit in Favorites backup');outfits.add(k);
  }
  return clone(value);
 }
 try{if(backend){raw=backend.getItem(KEY);if(raw!==null){need(raw.length<=MAX_BYTES,'Stored Favorites exceed the size limit');state=validate(JSON.parse(raw));}}}
 catch(e){blocked='Saved Favorites retained, not reset: '+e.message;}
 function commit(next){
  need(!blocked,blocked);const checked=validate(next),text=JSON.stringify(checked);need(text.length<=MAX_BYTES,'Favorites backup exceeds the size limit');
  if(backend){try{need(backend.getItem(KEY)===raw,'Favorites changed in another tab; reload before saving');backend.setItem(KEY,text);need(backend.getItem(KEY)===text,'Favorites write could not be verified');raw=text;}
   catch(e){persistent=false;throw Error('No Favorite save confirmed: '+e.message);}}
  state=checked;return clone(state);
 }
 function find(value){const k=key(value);return clone(state.items.find(i=>key(i.selection)===k)||null);}
 function add(value,{id,created_at}={}){
  need(!blocked,blocked);const s=selection(value),existing=find(s);if(existing)return {added:false,item:existing,persistent:!!backend&&persistent};
  const item={id,created_at,selection:s};const next=commit({...state,revision:state.revision+1,items:[...state.items,item]});
  return {added:true,item:clone(next.items.at(-1)),persistent:!!backend&&persistent};
 }
 function remove(id,revision){
  need(revision===state.revision,'Favorites changed; review again before removing');
  need(state.items.some(i=>i.id===id),'Favorite is no longer present');
  return commit({...state,revision:state.revision+1,items:state.items.filter(i=>i.id!==id)});
 }
 function merged(data){
  const incoming=validate(data),items=clone(state.items);let alreadySaved=0,added=0;
  for(const item of incoming.items){
   const sameId=items.find(i=>i.id===item.id);
   if(sameId){need(key(sameId.selection)===key(item.selection)&&sameId.created_at===item.created_at,'Conflicting Favorite ID; existing data was not replaced');alreadySaved++;continue;}
   if(items.some(i=>key(i.selection)===key(item.selection))){alreadySaved++;continue;}
   items.push(clone(item));added++;
  }
  need(items.length<=MAX,'Import would exceed '+MAX+' Favorites');
  return {items,added,already_saved:alreadySaved};
 }
 function previewImport(text){
  need(!blocked,blocked);need(typeof text==='string'&&text.length<=MAX_BYTES,'Favorites backup is too large');
  const data=validate(JSON.parse(text)),m=merged(data);
  return {data,revision:state.revision,existing:state.items.length,incoming:data.items.length,added:m.added,already_saved:m.already_saved,total:m.items.length};
 }
 function merge(preview){
  need(preview&&preview.revision===state.revision,'Favorites changed after preview; select the file again');
  const m=merged(preview.data);need(!blocked,blocked);
  if(!m.added)return {added:0,already_saved:m.already_saved,total:state.items.length};
  commit({...state,revision:state.revision+1,items:m.items});return {added:m.added,already_saved:m.already_saved,total:state.items.length};
 }
 return Object.freeze({key:KEY,snapshot:()=>clone(state),status:()=>({persistent:!!backend&&persistent,blocked,scope:'Favorites in this browser only; wear history is separate',max:MAX}),validate,selectionKey:key,find,add,remove,previewImport,merge,
  exportText:()=>{if(blocked){need(raw!==null,'Saved Favorites could not be read; no backup claimed');return raw;}return JSON.stringify(state,null,2);}});
}
root.HEWRSFavorites=Object.freeze({create,KEY,SCHEMA,MAX});
})(globalThis);
