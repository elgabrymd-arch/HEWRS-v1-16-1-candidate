/* Issue #22 display materials. Immutable registered sources remain the
 * origin of garment geometry and same-source fit rules. Every alternate
 * display byte stream is explicitly bound and reported; it never masquerades
 * as the original source hash. Install after the existing fit wrappers.
 */
(function(root){'use strict';
const priorConnection=root.HEWRSCleanConnection,priorRenderer=root.HEWRSAtomicRenderer;
const need=(x,message)=>{if(!x)throw Error('Issue22 material: '+message);};
const clone=x=>structuredClone(x);
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const ids=['S06','S13','S14','B01','B06','B10'];
function contract(input,base){
 const data=clone(input);need(data?.schema==='hewrs.issue22.materials.v1','material manifest missing');
 need(data.canvas?.join(',')==='996,2748'&&data.alpha_policy==='exact_source_alpha','source geometry contract differs');
 need(data.scope?.join(',')===ids.join(','),'material scope differs');
 for(const[hash,row]of Object.entries(data.bindings||{})){
  need(/^[a-f0-9]{64}$/.test(hash)&&row.source_sha256===hash,'source identity differs');
  need(ids.includes(row.garment_id)&&['jacket','trousers'].includes(row.layer),'unexpected garment or layer');
  const expected=row.garment_id.startsWith('S')?base.suitSources.resolveCanonical(row.garment_id)[row.layer]:(row.layer==='jacket'?base.blazerConnection.data.blazers[row.garment_id]?.assembly?.jacket:null);
  need(expected?.sha256===hash&&expected.url===row.source_url,'garment or layer source ownership differs');
  need(row.rect?.join(',')==='0,0,996,2748'&&row.measurements?.alpha_changed_pixels===0,'alpha or canvas changed');
  need(base.assetPaths[hash]===row.source_url,'selected source has no exact binding');
  need(/^[a-f0-9]{64}$/.test(row.display_sha256)&&row.display_sha256!==hash,'display identity missing');
  need(data.assetPaths[row.display_sha256]===row.display_url&&/^assets\/issue22-materials\/[A-Za-z0-9-]+\.png$/.test(row.display_url),'unsafe display binding');
  need(!Object.hasOwn(base.assetPaths,row.display_sha256)||base.assetPaths[row.display_sha256]===row.display_url,'display hash remapped');
 }
 need(Object.keys(data.bindings).length===9,'incomplete suit/blazer material layers');return freeze(data);
}
function connect(...args){const base=priorConnection.create(...args),materials=contract(root.HEWRS_ISSUE22_MATERIALS,base);return Object.freeze({...base,issue22Materials:materials,assetPaths:Object.freeze({...base.assetPaths,...materials.assetPaths})});}
function bindings(data,s){const id=s?.suitId||s?.blazerId;return Object.values(data.bindings).filter(row=>row.garment_id===id).map(row=>({garment_id:row.garment_id,layer:row.layer,geometry_source:{sha256:row.source_sha256,url:row.source_url,rect:row.rect},display_source:{sha256:row.display_sha256,url:row.display_url,rect:row.rect},alpha_sha256:row.alpha_sha256}));}
function create(visible,connection,options={}){
 const data=connection.issue22Materials;need(data,'connection missing material bindings');
 const resolved=options.resolveUrl||((d)=>d.url);
 function resolveUrl(d){const row=data.bindings[d?.sha256];if(!row)return resolved(d);need(d.rect?.join(',')===row.rect.join(','),'material source rectangle differs');return resolved({...d,url:row.display_url,sha256:row.display_sha256,material_origin_sha256:d.sha256});}
 const engine=priorRenderer.create(visible,connection,{...options,resolveUrl});
 async function render(s){const result=await engine.render(s);if(result?.cancelled)return result;const used=bindings(data,s);return used.length?{...result,issue22_material_revision:data.revision,issue22_material_sources:used}:result;}
 function plan(s){const p=engine.plan(s),used=bindings(data,s);return used.length?Object.assign(Array.isArray(p)?p.slice():{...p},{issue22_material_revision:data.revision,issue22_material_sources:used}):p;}
 return Object.freeze({...engine,render,plan,stats:()=>({...engine.stats(),issue22Materials:data.revision})});
}
need(priorConnection?.create&&priorRenderer?.create,'install after connection and render fit wrappers');
root.HEWRSCleanConnection=Object.freeze({...priorConnection,create:connect});
root.HEWRSAtomicRenderer=Object.freeze({...priorRenderer,create});
root.HEWRSIssue22Materials=Object.freeze({revision:'ISSUE22_SOURCE_BOUND_MATERIALS_1',scope:Object.freeze(ids),contract,bindings});
})(globalThis);
