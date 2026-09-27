/* V1.16.7: read-only recorded-wear summaries. No scores or recommendations.
 * Accepts only the existing validated local ledger. Never reads/writes storage,
 * changes IDs, deduplicates physical garments, or counts Favorites as wear.
 */
(function(root){'use strict';
const clone=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};
const groups=['suits','blazers','shirts','ties','shoes','pants','watches'];
const labels={suits:'Suits',blazers:'Blazers',shirts:'Shirts',ties:'Ties',shoes:'Shoes',pants:'Separate trousers',watches:'Watches'};
const DAY=86400000;
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function day(s){need(root.HEWRSLocalState.date(s),'Enter a valid inclusive cutoff date');return Date.parse(s+'T00:00:00Z')/DAY;}
function create(connection,lock){
 const validate=root.HEWRSLocalState.create(connection,lock,null).validate;
 const roster=[],byKey=new Map(),reports=new WeakSet();
 function add(category,id,historyId,label,scope){
  const key=category+'\0'+historyId;
  need(!byKey.has(key)&&typeof id==='string'&&typeof historyId==='string','Duplicate or invalid physical identity');
  const row=freeze({category,id,history_id:historyId,label:String(label||id),scope,order:roster.length});
  byKey.set(key,row);roster.push(row);
 }
 const view=root.HEWRSFaceliftModel.create(connection);
 for(const r of view.rows.topwear){
  if(r.kind==='suit')add('suits',r.sourceId,connection.suitSources.resolveCanonical(r.sourceId).historyId,r.label,'Suit');
  else if(r.kind==='blazer')add('blazers',r.sourceId,connection.blazerConnection.knownBlazer(r.sourceId).historyId,r.label,'Blazer');
 }
 for(const r of view.rows.shirt)add('shirts',r.id,connection.records[r.id].history_id,r.label,
   connection.nonSuitSources.connectedIds.includes(r.id)?'Suit, blazer and shirt-only':'Suit mode; non-suit deferred');
 for(const r of view.rows.tie)add('ties',r.id,r.id,r.label,'Tie');
 for(const r of view.rows.shoes)add('shoes',r.id,r.id,r.label,'Registered footwear');
 for(const id of connection.blazerConnection.pantIds){const r=connection.blazerConnection.knownPant(id);add('pants',id,r.historyId,r.label,'Separate trousers only; matching suit trousers are part of the suit');}
 for(const r of view.rows.watch)add('watches',r.id,r.id,r.label,'Watch ID/name; images deferred');
 need(roster.filter(x=>x.category==='shirts').length===50,'Active-50 shirt roster changed');
 function keys(event){
  const s=event.canonical_selection,i=event.items;
  const list=[['shirts',i.shirt.id],['shoes',i.shoes.id]];
  if(i.topwear)list.push([s.suitId?'suits':'blazers',i.topwear.id]);
  if(i.tie)list.push(['ties',i.tie.id]);if(i.pants)list.push(['pants',i.pants.id]);if(i.watch)list.push(['watches',i.watch.id]);
  for(const [g,id]of list)need(byKey.has(g+'\0'+id),'Recorded identity is outside the connected roster: '+id);
  return list;
 }
 function build(ledger,{asOf,window='30'}={}){
  need(['30','90','all'].includes(window),'Unknown record window');
  const end=day(asOf),start=window==='all'?null:Math.max(day('0000-01-01'),end-Number(window)+1);
  const v=validate(ledger),counts=new Map(roster.map(r=>[r.category+'\0'+r.history_id,{count:0,days:new Set(),last:null,through:null}]));
  const summary={ledger_records:v.events.length,records:0,recorded_days:0,exact_outfits:0,suit_records:0,blazer_records:0,shirt_only_records:0,
   tied_records:0,no_tie_records:0,manual_records:0,engine_records:0,recorded_repeat_flags:0,future_excluded:0,older_excluded:0};
  const days=new Set(),outfits=new Set();let earliest=null;
  for(const e of v.events){
   const k=keys(e),d=day(e.localDate);
   if(d>end){summary.future_excluded++;continue;}
   if(earliest===null||e.localDate<earliest)earliest=e.localDate;
   for(const [g,id]of k){const c=counts.get(g+'\0'+id);if(c.through===null||e.localDate>c.through)c.through=e.localDate;}
   if(start!==null&&d<start){summary.older_excluded++;continue;}
   summary.records++;days.add(e.localDate);
   // Fixed role order is the complete physical outfit identity; null roles stay null.
   outfits.add(JSON.stringify(['topwear','shirt','tie','shoes','watch','pants'].map(role=>e.items[role]?.id??null)));
   const s=e.canonical_selection;
   summary[s.suitId?'suit_records':s.blazerId?'blazer_records':'shirt_only_records']++;
   summary[s.state==='NO_TIE'?'no_tie_records':'tied_records']++;
   summary[e.origin==='engine'?'engine_records':'manual_records']++;
   if(e.controlledRepetition)summary.recorded_repeat_flags++;
   for(const [g,id]of k){const c=counts.get(g+'\0'+id);c.count++;c.days.add(e.localDate);if(c.last===null||e.localDate>c.last)c.last=e.localDate;}
  }
  summary.recorded_days=days.size;summary.exact_outfits=outfits.size;
  const rows=roster.map(r=>{const c=counts.get(r.category+'\0'+r.history_id);return {...r,record_count:c.count,recorded_days:c.days.size,
   last_recorded_in_window:c.last,last_recorded_through_cutoff:c.through,calendar_days_since_record:c.through===null?null:end-day(c.through)};});
  const result=freeze({schema:'hewrs.recorded-wear-insights.v1',as_of:asOf,window,from:start===null?earliest:new Date(start*DAY).toISOString().slice(0,10),ledger_revision:v.revision,
    basis:'Confirmed records in this browser ledger only; not complete real-world wear history',summary,rows,score:null,
    policy_changes:false,favorites_counted_as_wear:false,source_lock:lock});
  reports.add(result);return result;
 }
 function rows(report,category,{query='',sort='catalogue',recordedOnly=false}={}){
  need(reports.has(report),'Use a report produced by this read-only model');
  need(groups.includes(category),'Unknown recorded-wear category');
  need(['catalogue','count','last'].includes(sort),'Unknown factual sort');
  need(typeof query==='string'&&typeof recordedOnly==='boolean','Malformed usage filter');
  const q=query.trim().toLowerCase();
  const out=report.rows.filter(r=>r.category===category&&(!recordedOnly||r.record_count>0)&&
    (r.id+' '+r.history_id+' '+r.label).toLowerCase().includes(q));
  if(sort==='count')out.sort((a,b)=>b.record_count-a.record_count||a.order-b.order);
  if(sort==='last')out.sort((a,b)=>{const x=a.last_recorded_through_cutoff,y=b.last_recorded_through_cutoff;return x===null&&y!==null?1:x!==null&&y===null?-1:x!==y?(x<y?-1:1):a.order-b.order;});
  return clone(out);
 }
 return Object.freeze({build,rows,categories:freeze(groups.map(id=>({id,label:labels[id],count:roster.filter(r=>r.category===id).length}))),roster:freeze(roster)});
}
root.HEWRSRotationInsights=Object.freeze({create});
})(globalThis);
