/* UI-only draft preferences. No scorer, persistent schema, garment renderer,
 * identity remapping, automatic selections, or wear-history writes. */
(function(root){'use strict';
const copy=x=>structuredClone(x),assert=(x,s)=>{if(!x)throw Error(s);};
const CATEGORIES=Object.freeze(['topwear','shirt','tie','shoes','bottoms','watch']);
const FAMILIES=Object.freeze({shirt:['white','cream','blue','navy','pink','lavender','brown','grey','black'],tie:['navy','burgundy','grey','blue','pink','brown','gold']});
function create(connection){
 const rows={topwear:[],shirt:[],tie:[],shoes:[],bottoms:[],watch:[]};
 for(const id of connection.suitSources.ids){const item=connection.catalogue.suits.find(x=>x.id===connection.aliases.get(id));assert(item,'Missing exact suit alias');rows.topwear.push({id:item.id,sourceId:id,kind:'suit',label:connection.features.get(id)?.description||item.name,brand:item.brand||'',color:item.color||'',available:connection.assemblies.supported(id)});}
 for(const id of connection.blazerConnection.ids){const b=connection.blazerConnection.knownBlazer(id),item=connection.catalogue.blazers.find(x=>x.id===b.historyId);rows.topwear.push({id:b.historyId,sourceId:id,kind:'blazer',label:b.label,brand:item?.brand||'',color:item?.color||'',available:b.availability==='CONNECTED'});}
 rows.topwear.push({id:'ui:shirt-only',sourceId:null,kind:'shirt-only',label:'Shirt + separate trousers',brand:'',color:'',available:connection.shirtOnlyConnection.ids.length>0});
 for(const id of connection.manifest.shirt_order){const r=connection.records[id],item=connection.catalogue.shirts.find(x=>x.id===r.history_id);rows.shirt.push({id,sourceId:id,kind:'shirt',label:r.label,brand:item?.brand||'',color:connection.features.get(id)?.primary_text||'',available:true});}
 for(const [id]of Object.entries(connection.manifest.ties)){const r=connection.features.get(id),item=connection.catalogue.ties.find(x=>x.id===id);rows.tie.push({id,sourceId:id,kind:'tie',label:r?.description||item?.name||id,brand:item?.brand||'',color:r?.primary_text||'',available:true});}
 for(const id of Object.keys(connection.shoeLayers)){const item=connection.catalogue.shoes.find(x=>x.id===id);assert(item,'Missing shoe source identity');rows.shoes.push({id,sourceId:id,kind:item.subcategory||'shoe',label:item.name,brand:item.brand||'',color:item.color||'',available:!item.disabled});}
 for(const id of connection.blazerConnection.pantIds){const r=connection.blazerConnection.knownPant(id);rows.bottoms.push({id,sourceId:id,kind:'pants',label:r.label,brand:r.record.brand||'',color:r.record.shade||'',available:true});}
 for(const item of connection.catalogue.watches)rows.watch.push({id:item.id,sourceId:item.id,kind:'watch',label:item.name,brand:item.brand||'',color:item.color||'',available:!item.disabled});
 for(const [k,v]of Object.entries(rows)){assert(new Set(v.map(x=>x.id)).size===v.length,'Duplicate view identity in '+k);v.forEach(Object.freeze);Object.freeze(v);}Object.freeze(rows);
 const maps=Object.fromEntries(CATEGORIES.map(k=>[k,new Map(rows[k].map(r=>[r.id,r]))]));
 let prefs=Object.fromEntries(CATEGORIES.map(k=>[k,{mode:'any'}])),draft=null;
 function valid(cat,choice){assert(CATEGORIES.includes(cat),'Unknown preference category');assert(choice&&typeof choice==='object','A preference is required');
  assert(['any','item','family','none'].includes(choice.mode),'Invalid preference mode');
  if(choice.mode==='item')assert(maps[cat].has(choice.id),'Unknown exact '+cat+' ID');
  if(choice.mode==='family')assert(FAMILIES[cat]?.includes(choice.id),'This category constraint is not supported by the current engine');
  if(choice.mode==='none')assert(cat==='tie'||cat==='watch','None is not a valid '+cat+' choice');
  assert(Object.keys(choice).every(k=>['mode','id'].includes(k)),'Unexpected preference fields');return copy(choice);
 }
 function set(cat,choice){prefs[cat]=valid(cat,choice);return snapshot();}
 function snapshot(){return copy(prefs);}
 function replace(p){assert(p&&CATEGORIES.every(k=>Object.hasOwn(p,k))&&Object.keys(p).length===CATEGORIES.length,'Incomplete Home preferences');const next={};for(const c of CATEGORIES)next[c]=valid(c,p[c]);prefs=next;return snapshot();}
 function fromSelection(s){connection.validateSelection(s);const top=s.shirtOnly?rows.topwear.find(x=>x.kind==='shirt-only'):s.blazerId?rows.topwear.find(x=>x.kind==='blazer'&&x.sourceId===s.blazerId):rows.topwear.find(x=>x.kind==='suit'&&x.sourceId===s.suitId);assert(top,'No view binding for selected topwear');
  const next=snapshot();next.topwear={mode:'item',id:top.id};next.shirt={mode:'item',id:s.shirtId};next.tie=s.state==='NO_TIE'?{mode:'none'}:s.state==='REFERENCE'?{mode:'any'}:{mode:'item',id:s.state};next.shoes={mode:'item',id:s.shoeId};next.watch=s.watchId?{mode:'item',id:s.watchId}:{mode:'none'};if(s.pantId)next.bottoms={mode:'item',id:s.pantId};return replace(next);
 }
 function selectedTop(p=prefs){return p.topwear.mode==='item'?maps.topwear.get(p.topwear.id):null;}
 function included(p=prefs){return selectedTop(p)?.kind==='suit';}
 function label(cat,choice=prefs[cat]){if(cat==='bottoms'&&included())return {name:'Included with suit',id:null,mode:'included'};if(choice.mode==='any')return {name:'HEWRS chooses',id:null,mode:'any'};if(choice.mode==='none')return {name:cat==='tie'?'No Tie':'No watch selected',id:null,mode:'none'};if(choice.mode==='family')return {name:choice.id.charAt(0).toUpperCase()+choice.id.slice(1)+' family',id:null,mode:'family'};const r=maps[cat].get(choice.id);return {name:r.label,id:r.sourceId||null,mode:'item'};}
 function begin(cat){assert(CATEGORIES.includes(cat),'Unknown picker');assert(!(cat==='bottoms'&&included()),'Matching trousers are included with the selected suit');draft={category:cat,choice:copy(prefs[cat])};return copy(draft);}
 function choose(value){assert(draft,'No open picker');draft.choice=value===null?null:valid(draft.category,value);return copy(draft);}
 function commit(){assert(draft&&draft.choice,'Choose an item, supported family, or Engine Choice');const d=draft;draft=null;return set(d.category,d.choice);}
 function cancel(){draft=null;}
 function reset(){draft=null;prefs=Object.fromEntries(CATEGORIES.map(k=>[k,{mode:'any'}]));return snapshot();}
 function filter(cat,{query='',type='',brand='',color=''}={}){assert(maps[cat],'Unknown category');const q=query.trim().toLocaleLowerCase();return rows[cat].filter(r=>(!q||(r.id+' '+(r.sourceId||'')+' '+r.label+' '+r.brand).toLocaleLowerCase().includes(q))&&(!type||r.kind===type)&&(!brand||r.brand===brand)&&(!color||String(r.color).toLowerCase().includes(color.toLowerCase())));}
 function operation(mode,ctx){assert(['anchor','engine'].includes(mode),'Unknown selection intent');const p=snapshot(),top=selectedTop(p);assert(top,'Choose an exact Suit, Blazer or Shirt-only mode. This build requires a topwear anchor.');assert(top.available,'This exact topwear binding is not connected in the current application.');
  assert(p.shoes.mode==='item','Choose an exact registered shoe pair. Automatic footwear selection is not installed in this build.');
  assert(p.watch.mode!=='family','Watch families are not supported');
  const shirt=p.shirt.mode==='item'?p.shirt.id:p.shirt.mode==='family'?'FAMILY:'+p.shirt.id:'ANY';
  const tie=p.tie.mode==='none'?'NO_TIE':p.tie.mode==='item'?p.tie.id:p.tie.mode==='family'?'FAMILY:'+p.tie.id:'ANY';
  const base=top.kind==='suit'?{suitId:top.sourceId}:top.kind==='blazer'?{blazerId:top.sourceId}:{shirtOnly:true};
  if(top.kind!=='suit'){assert(p.bottoms.mode==='item','Choose the exact physical trousers for this outfit');base.pantId=p.bottoms.id;}
  const c={...base,shirt,tie,shoeId:p.shoes.id,watchId:p.watch.mode==='item'?p.watch.id:null,localDate:ctx.localDate,occasion:ctx.occasion,formality:ctx.formality,style:ctx.style};
  const exact=p.shirt.mode==='item'&&['none','item'].includes(p.tie.mode);
  if(mode==='anchor'&&exact){const s={...base,shirtId:shirt,state:tie,shoeId:c.shoeId,watchId:c.watchId};connection.validateSelection(s);return {kind:'manual',selection:s,config:c,prefs:p};}
  assert(!base.shirtOnly,'Shirt-only uses exact Anchor selection in this build');
  return {kind:'engine',config:c,request:connection.makeRequest(c),prefs:p};
 }
 function lockCount(){return CATEGORIES.filter(k=>!(k==='bottoms'&&included())&&prefs[k].mode!=='any').length;}
 return Object.freeze({rows,categories:CATEGORIES,families:FAMILIES,set,snapshot,replace,fromSelection,selectedTop,included,label,begin,choose,commit,cancel,reset,filter,operation,lockCount,draft:()=>copy(draft)});
}
root.HEWRSFaceliftModel=Object.freeze({create,CATEGORIES});
})(globalThis);
