/* Release Step 4: input/reference validation only. No aesthetic scoring,
 * garment operations, network or persistence. Historical records are never rewritten. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.HEWRSRelease4=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const REVISION='HEWRS_RELEASE_STEP4_REFERENCE_GUARDS_1';
const GROUPS=['suits','blazers','shirts','ties','shoes','pants','jeans','tshirts','watches'];
const ROLES=['topwear','shirt','tie','shoes','watch','pants'];
const NO_TIE=['shirt-DS040','shirt-DS041','shirt-DS042','shirt-DS043'];
const clone=x=>JSON.parse(JSON.stringify(x));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function need(c,m){if(!c)throw new Error(m);}
function validateCatalogue(c){
 need(object(c),'Catalogue must be an object');const all=new Set();
 for(const g of GROUPS){need(Array.isArray(c[g]),'Missing catalogue array: '+g);for(const x of c[g]){need(object(x)&&typeof x.id==='string'&&x.id.length>0,'Malformed '+g+' item');need(!all.has(x.id),'Duplicate catalogue ID: '+x.id);all.add(x.id);}}
 need(c.ties.length===47,'Expected exactly 47 canonical ties');
 for(let n=1;n<=47;n++)need(c.ties.some(t=>t.id==='T'+String(n).padStart(3,'0')&&t.status==='active'),'Missing/inactive canonical tie: '+n);
 need(c.shirts.length===50,'Expected Active-50 after migration');
 const required=Array.from({length:48},(_,i)=>'shirt-DS'+String(i+1).padStart(3,'0')).concat(['shirt-DS050','shirt-DS051']);
 need(required.every(id=>c.shirts.some(s=>s.id===id)),'Active-50 ID mismatch');return true;
}
function resolve(role,id,c){
 if(role==='topwear')return c.suits.concat(c.blazers).find(x=>x.id===id)||null;
 if(role==='shirt')return c.shirts.concat(c.tshirts).find(x=>x.id===id)||null;
 if(role==='pants')return c.pants.concat(c.jeans).find(x=>x.id===id)||null;
 const g={tie:'ties',shoes:'shoes',watch:'watches'}[role];return g?c[g].find(x=>x.id===id)||null:null;
}
function itemsIssue(items,c){
 if(!object(items))return 'Missing outfit items';
 if(!items.shirt||!items.shoes)return 'Outfit cannot be replayed without a shirt and shoes';
 for(const role of ROLES){const item=items[role];if(item===null||item===undefined)continue;
  if(!object(item)||typeof item.id!=='string')return 'Malformed '+role+' reference';
  if(role==='topwear'&&item.id==='no-blazer'&&item.noBlazer===true)continue;
  const live=resolve(role,item.id,c);if(!live)return 'Inactive or unmapped '+role+': '+item.id;
  if(role==='tie'&&live.status!=='active')return 'Inactive tie';if(role==='shoes'&&live.disabled)return 'Disabled shoes';
 }
 if(NO_TIE.includes(items.shirt.id)&&items.tie)return 'This shirt has no tie pairing';return null;
}
function requestGuard(q,c){
 if(!q||!object(c))return {allowed:false,reason:'Missing request or catalogue'};
 for(const role of ROLES){const o=q[role];if(!o||o.mode!=='item')continue;
  const item=resolve(role,o.id,c);if(!item)return {allowed:false,reason:'Exact '+role+' ID does not exist: '+o.id};
  if(role==='tie'&&item.status!=='active')return {allowed:false,reason:'Exact tie is not active'};
  if(role==='shoes'&&item.disabled)return {allowed:false,reason:'Exact shoe is disabled'};
  if(role==='topwear'&&(!!item.formal!==!!o.formal))return {allowed:false,reason:'Exact topwear ID/type disagree'};
  if(role==='topwear'&&item.formal&&q.dressMode!=='work')return {allowed:false,reason:'Existing context does not admit the exact suit; no substitution'};
  if(role==='pants'){
   const isJeans=c.jeans.some(x=>x.id===o.id);
   if(q.dressMode==='work'&&isJeans)return {allowed:false,reason:'Exact jeans are outside the existing Work pool'};
   if(q.dressMode==='weekend'&&(!isJeans||!item.weekendEligible))return {allowed:false,reason:'Exact bottom is outside the existing Weekend pool'};
   if(q.dressMode==='fancyDinner'&&isJeans&&!item.fancyDinnerEligible)return {allowed:false,reason:'Exact jeans are outside the existing Dinner pool'};
  }
 }
 if(q.tie&&q.tie.mode==='item'&&q.dressMode==='weekend')return {allowed:false,reason:'Existing Weekend path has no ties; explicit tie is not silently dropped'};
 if(q.shirt&&NO_TIE.includes(q.shirt.id)&&q.tie&&q.tie.mode!=='none')return {allowed:false,reason:'No-tie shirt conflicts with explicit tie preference'};
 if(q.pants&&q.pants.mode==='item'&&q.topwear&&(q.topwear.formal===true||q.topwear.category==='suit'))return {allowed:false,reason:'Suit trousers are intrinsic; an explicit separate bottom cannot be ignored'};
 return {allowed:true,reason:null};
}
function matchesRequest(o,q){
 for(const role of ROLES){const ov=q[role];if(ov&&ov.mode==='item'&&o.items[role]?.id!==ov.id)return false;}
 return !(q.tie&&q.tie.mode==='none'&&o.items.tie);
}
function catalogueStamp(items,c){return JSON.stringify(ROLES.map(role=>[role,items[role]?resolve(role,items[role].id,c)||(role==='topwear'&&items[role].id==='no-blazer'?items[role]:null):null]));}
function stamp(items,c){return {revision:REVISION,catalogue_snapshot:catalogueStamp(items,c)};}
function filterCache(options,c,registry,baseRestore){
 if(!Array.isArray(options))return {options:[],removed:[{reason:'Cache is not an array'}]};
 const clean=[],removed=[];
 options.forEach((o,index)=>{
  let why=object(o)?itemsIssue(o.items,c):'Malformed option';
  if(!why&&(!o._hewrsStep4||o._hewrsStep4.revision!==REVISION||o._hewrsStep4.catalogue_snapshot!==catalogueStamp(o.items,c)))why='Stale catalogue or release revision';
  if(!why&&o.items.tie&&registry.hasShirt(o.items.shirt.id)){
   const score=registry.scoreForApp(o.items.shirt.id,o.items.tie.id),e=o._hewrsStep3?.shirt_tie;
   if(o.relational?.ST!==score||o.breakdown?.shirt!==score||e?.key!==o.items.shirt.id.replace(/^shirt-/,'')+'|'+o.items.tie.id||e?.score_10!==score)why='Inconsistent approved pair-score fields';
  }
  if(!why)try{if(baseRestore([o],c).length!==1)why='Parent cache validation failed';}catch(e){why=String(e.message||e);}
  if(why)removed.push({index,reason:why});else clean.push(clone(o));
 });return {options:clean,removed};
}
function validateLedger(rows){
 need(Array.isArray(rows),'Wear ledger must be an array');
 rows.forEach((e,i)=>{need(object(e)&&typeof e.date==='string'&&Number.isFinite(Date.parse(e.date))&&object(e.items),'Malformed wear entry '+i);
  for(const [role,it]of Object.entries(e.items))need(it===null||(object(it)&&typeof it.id==='string'&&it.id.length>0),'Malformed historical item at '+i+'/'+role);
 });return true;
}
function validateBackup(input,controller){
 need(object(input)&&input.__hewrs_backup===1,'Not a HEWRS backup');
 for(const k of ['catalogue','ledger','session'])need(input[k]===undefined||input[k]===null||typeof input[k]==='string','Backup '+k+' must be serialized JSON or null');
 const out=controller.migrateBackup(input);
 if(out.catalogue)validateCatalogue(JSON.parse(out.catalogue).data);
 if(out.ledger)validateLedger(JSON.parse(out.ledger));
 // Historical retired/unmapped IDs are documentary records, not active selection.
 return out;
}
function recallEntry(entry,c){
 need(object(entry),'Malformed favorite');validateLedger([entry]);const issue=itemsIssue(entry.items,c);need(!issue,issue);
 const out=clone(entry);for(const role of ROLES)if(entry.items[role])out.items[role]=clone(resolve(role,entry.items[role].id,c)||entry.items[role]);return out;
}
return Object.freeze({version:REVISION,validateCatalogue,requestGuard,matchesRequest,itemsIssue,stamp,filterCache,validateLedger,validateBackup,recallEntry});
});
