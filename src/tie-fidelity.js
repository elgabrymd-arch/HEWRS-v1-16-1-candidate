/* V1.17.2: display-only tie texture bindings. Authoritative DNA, immutable
 * inputs, physical IDs, ranking and storage remain the original objects.
 * Every new image has its own hash/path; no old hash is redirected to new bytes.
 */
(function(root){
'use strict';
const prior=root.HEWRSCleanConnection;
const need=(ok,message)=>{if(!ok)throw Error(message);};
const clone=x=>structuredClone(x);
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function create(inputs){
 const base=prior.create(inputs),d=clone(root.HEWRS_TIE_FIDELITY);
 const ids=Array.from({length:47},(_,i)=>'T'+String(i+1).padStart(3,'0'));
 need(d?.schema==='hewrs.tie-fidelity.v1_17_2'&&d.canvas.join(',')==='996,2748','Missing tie fidelity contract');
 need(d.source_input_sha256===root.HEWRS_INPUT_SHA256,'Tie fidelity source lock mismatch');
 need(JSON.stringify(d.ids)===JSON.stringify(ids)&&d.bindings.length===142,'Incomplete exact tie universe');
 const byHash=new Map(),kinds=new Set();
 for(const b of d.bindings){
  need(ids.includes(b.id),'Unknown tie ID');
  const expected=b.kind==='suit'?base.manifest.ties[b.id].display_layer:
    b.kind==='non_suit'?base.batch10.ties[b.id]:
    b.kind==='legacy'?base.blazerConnection.data.assembly.ties[b.id]:
    b.kind==='ds023_T017'&&b.id==='T017'?base.ds023Edges.layers.T017.layer:null;
  need(expected&&expected.sha256===b.baseline.sha256&&expected.rect.join(',')===b.baseline.rect.join(','),'Changed tie baseline: '+b.id+'/'+b.kind);
  const n=b.layer;need(n?.rect?.join(',')==='0,0,996,2748'&&/^[a-f0-9]{64}$/.test(n.sha256),'Invalid fidelity coordinates');
  need(n.url==='assets/'+n.sha256+'.png'&&d.assetPaths[n.sha256]===n.url,'Unbound fidelity image');
  need(!byHash.has(b.baseline.sha256),'Ambiguous old tie hash');
  byHash.set(b.baseline.sha256,freeze(n));kinds.add(b.id+'/'+b.kind);
 }
 for(const id of ids)for(const kind of ['suit','non_suit','legacy'])need(kinds.has(id+'/'+kind),'Missing rendered tie class');
 need(kinds.has('T017/ds023_T017'),'Missing accepted DS023 edge profile');
 const mask=d.legacy_ownership_mask;need(mask.rect.join(',')==='0,0,996,2748'&&d.assetPaths[mask.sha256]===mask.url,'Unbound legacy ownership');
 function replace(desc){
  if(!desc)return desc;
  const next=byHash.get(desc.sha256);return next||desc;
 }
 const assemblies=Object.freeze({...base.assemblies,forSelection(...args){
  const m=base.assemblies.forSelection(...args);
  // The returned object is a display manifest, not the immutable source model.
  for(const id of ids)m.ties[id].display_layer=replace(m.ties[id].display_layer);
  return m;
 }});
 const tieFidelity=Object.freeze({version:'1.17.2',ids:Object.freeze(ids),data:freeze(d),replace,legacyOwnership:freeze(mask)});
 return Object.freeze({...base,assemblies,tieFidelity,assetPaths:Object.freeze({...base.assetPaths,...d.assetPaths})});
}
root.HEWRSCleanConnection=Object.freeze({create});
})(globalThis);
