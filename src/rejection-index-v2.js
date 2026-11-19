/* HEWRS indexed rejection-cache foundation (not connected to production).
 * Persistence, legacy migration, concurrency and historical preference matching
 * remain the responsibility of the subsequent storage integration phase.
 */
(function(root,make){'use strict';const api=make();if(typeof module==='object'&&module.exports)module.exports=api;else root.HEWRSRejectionIndexV2=api;})(globalThis,function factory() {
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const fail=(ok,msg)=>{if(!ok)throw Error(msg)};
const scopes={outfit:['outfit','clothing'],tie:['tie','shirt_tie']};
const schemas={outfit:'hewrs.outfit-feedback.event.v1',tie:'hewrs.tie-feedback.event.v1'};
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
function create({outfitKey,tieKey,validateEvent}={}){
fail(typeof outfitKey==='function'&&typeof tieKey==='function','Original outfit and tie key functions required.');
let entries=new Map(), buckets=new Map(), activeCount=0, revision=0;
const bkey=(ns,scope,occasion,id)=>JSON.stringify([ns,scope,occasion,id]);
const key=(ns,e)=>(ns==='tie'?tieKey:outfitKey)(e.selection,e.scope);
function check(row){
fail(row&&scopes[row.namespace]&&row.event&&typeof row.event==='object','Unknown feedback namespace.');
const {namespace:ns,event:e}=row;
fail(e.schema===schemas[ns]&&/^[A-Za-z0-9_-]{1,150}$/.test(e.id),'Invalid schema or ID.');
fail(['hide','restore',...(ns==='outfit'?['preferences','withdraw_preferences']:[])].includes(e.type),'Invalid feedback event action.');
if(e.type==='hide'){
fail(scopes[ns].includes(e.scope)&&['all','work','dinner','weekend'].includes(e.occasion),'Invalid scope or occasion.');
fail(typeof key(ns,e)==='string'&&key(ns,e).length>0,'Invalid canonical rejection identity.');
}
if(['restore','withdraw_preferences'].includes(e.type))fail(typeof e.target==='string'&&e.target.length>0,'Missing undo target.');
validateEvent?.(ns,e);
return copy(row);
}
function indexAdd(index,row){
const {namespace:ns,event:e}=row,b=bkey(ns,e.scope,e.occasion,key(ns,e));
let hits=index.get(b);if(!hits){hits=new Map();index.set(b,hits);}hits.set(e.id,row);
}
function indexDelete(index,row){
const {namespace:ns,event:e}=row,b=bkey(ns,e.scope,e.occasion,key(ns,e));
const hits=index.get(b);if(hits?.delete(e.id)&&!hits.size)index.delete(b);
}
function targetCheck(row,map){
const e=row.event;
if(!['restore','withdraw_preferences'].includes(e.type))return;
const target=map.get(e.target);
fail(target?.namespace===row.namespace&&target.event.type===(e.type==='restore'?'hide':'preferences'),
'Undo target missing or belongs to different namespace.');
}
function load(rows){
fail(Array.isArray(rows),'Expected complete validated events.');
const next=new Map();
for(const r of rows){const row=check(r);fail(!next.has(row.event.id),'Duplicate rejection event ID. No state modified.');next.set(row.event.id,row);}
const restored=new Set();
for(const row of next.values()){targetCheck(row,next);if(row.event.type==='restore')restored.add(row.event.target);}
const idx=new Map();let count=0;
for(const row of next.values())if(row.event.type==='hide'&&!restored.has(row.event.id)){indexAdd(idx,row);count++;}
entries=next;buckets=idx;activeCount=count;revision++;return stats();
}
function append(raw){
const row=check(raw),e=row.event,prior=entries.get(e.id);
if(prior){fail(stable(prior)===stable(row),'Conflicting event ID. No state modified.');return false;}
targetCheck(row,entries);
if(e.type==='hide'){indexAdd(buckets,row);activeCount++;}
else if(e.type==='restore'){
const target=entries.get(e.target),te=target.event,b=bkey(target.namespace,te.scope,te.occasion,key(target.namespace,te));
if(buckets.get(b)?.has(e.target)){indexDelete(buckets,target);activeCount--;}
}
entries.set(e.id,row);revision++;return true;
}
function match(selection,occasion='work'){
fail(['all','work','dinner','weekend'].includes(occasion),'Invalid occasion.');
const result=[];
for(const ns of ['outfit','tie'])for(const scope of scopes[ns]){
let id;try{id=(ns==='tie'?tieKey:outfitKey)(selection,scope);}
catch(e){if(ns==='tie')continue;throw e;}
for(const occ of occasion==='all'?['all']:['all',occasion]){
const hits=buckets.get(bkey(ns,scope,occ,id));
if(hits)for(const row of hits.values())result.push(copy(row));
}}
return result;
}
function page(offset=0,limit=100){
fail(Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit)&&limit>=1&&limit<=500,'Invalid page bounds.');
const rows=[];let i=0;
for(const hits of buckets.values())for(const row of hits.values()){
if(i>=offset)rows.push(copy(row));
i++;if(rows.length>=limit)return rows;
}
return rows;
}
function stats(){return{events:entries.size,active:activeCount,revision};}
return Object.freeze({load,append,match,page,stats,event:id=>entries.has(id)?copy(entries.get(id)):null});
}
return Object.freeze({create,revision:'hewrs.rejection-index.v2.prestorage'});
});
