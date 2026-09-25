/* V1.16.3: exact-ID, tied non-suit edge mattes. Original components stay pinned. */
(function(root){'use strict';
const previous=root.HEWRSCleanConnection,need=(x,m)=>{if(!x)throw Error(m);};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function create(inputs){
 const base=previous.create(inputs),d=structuredClone(root.HEWRS_DS023_EDGES);
 need(d?.schema==='hewrs.ds023-local-edges.v1_16_3'&&d.id==='DS023'&&d.history_id===base.records.DS023.history_id,'Invalid edge correction identity');
 need(d.canvas.join(',')==='996,2748'&&d.source_input_sha256===root.HEWRS_INPUT_SHA256,'Changed edge source lock/coordinates');
 need(JSON.stringify(d.applies_to_modes)==='["blazer","shirt-only"]'&&d.applies_to_neck==='DS023_TIED_ONLY'&&d.applies_to_knot==='DS023_T017_ONLY','Incorrect edge correction scope');
 const originals={base:base.ds023Cleanup.modes.tied.base,left:base.batch10.shirts.DS023.modes.tied.left,right:base.batch10.shirts.DS023.modes.tied.right,T017:base.batch10.ties.T017};
 need(Object.keys(d.layers).length===4&&Object.keys(d.assetPaths).length===4,'Unexpected edge payload');
 for(const [k,orig]of Object.entries(originals)){
  const a=d.layers[k];need(a&&JSON.stringify(a.baseline)===JSON.stringify(orig),'Changed edge source: '+k);
  const v=a.layer;need(v.rect?.join(',')==='0,0,996,2748'&&/^[a-f0-9]{64}$/.test(v.sha256),'Invalid edge layer coordinates/hash');
  need(d.assetPaths[v.sha256]==='assets/'+v.sha256+'.png'&&v.url===d.assetPaths[v.sha256],'Unbound edge layer');
 }
 return Object.freeze({...base,ds023Edges:freeze(d),assetPaths:Object.freeze({...base.assetPaths,...d.assetPaths})});
}
root.HEWRSCleanConnection=Object.freeze({create});
})(globalThis);
