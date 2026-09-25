/* Deterministic source registrations for the exact sixteen supplied IDs only.
 * V1.16.2: DS023 alone uses separate alpha-cleaned bases and shirt-only
 * trouser foreground ownership. All original images are unchanged.
 * Existing DS001/DS014 and all suit renderers are delegated without changes.
 * Runtime uses registered source pixels at fixed coordinates. No generation,
 * recolouring, substitution, new silhouette, score or history transformation.
 */
(function(root){'use strict';
const W=996,H=2748,oldBlazer=root.HEWRSBlazerRenderer,oldShirt=root.HEWRSShirtOnlyRenderer;
function create(canvas,connection,resolveUrl,kind){
 const inherited=(kind==='blazer'?oldBlazer:oldShirt).create(canvas,connection,resolveUrl);
 const d=connection.batch10;canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{willReadFrequently:true});let epoch=0;const cache=new Map();
 const applies=s=>!!s&&d.ids.includes(s.shirtId);
 function plan(s){if(!applies(s))return inherited.plan(s);connection.validateSelection(s);
  if(kind==='blazer'&&!connection.blazerConnection.isBlazer(s)||kind==='shirt-only'&&!connection.shirtOnlyConnection.isShirtOnly(s))throw Error('Wrong batch renderer mode');
  const parts=d.shirts[s.shirtId].modes[s.state==='NO_TIE'?'no_tie':'tied'],a=connection.blazerConnection.data.assembly;
  const p={operation:'SOURCE_REGISTERED_BATCH16',kind,selection:structuredClone(s),avatar:connection.manifest.static.avatar,shoes:connection.shoeLayers[s.shoeId],pants:connection.blazerConnection.knownPant(s.pantId).layer,body:parts.base,tie:s.state==='NO_TIE'?null:d.ties[s.state],leaves:[parts.left,parts.right],hands:a.hands,cuffs:[]};
  if(s.shirtId==='DS023'&&connection.ds023Cleanup){p.body=connection.ds023Cleanup.modes[s.state==='NO_TIE'?'no_tie':'tied'].base;p.ds023Cleanup=true;p.pantsInForeground=kind==='shirt-only';}
  if(kind==='blazer'){const b=connection.blazerConnection.knownBlazer(s.blazerId),r=b.assembly||a;p.jacket=r.jacket;p.ownership=r.ownership||connection.blazerConnection.knownBlazer('B02').assembly.ownership;p.cuffOwnershipStart=r.sourceCuffOwnershipStart??1339;p.cuffs=[parts.left_cuff,parts.right_cuff];}
  return p;
 }
 function load(v){if(!v||v.rect?.join(',')!=='0,0,996,2748'||!Object.hasOwn(connection.assetPaths,v.sha256))throw Error('Unbound batch source');
  if(cache.has(v.sha256)){const x=cache.get(v.sha256);cache.delete(v.sha256);cache.set(v.sha256,x);return x;}
  const p=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>im.naturalWidth===W&&im.naturalHeight===H?resolve(im):reject(Error('Wrong batch source dimensions'));im.onerror=()=>reject(Error('Batch source failed to load; no garment substitution'));try{im.src=resolveUrl(v);}catch(e){reject(e);}});
  cache.set(v.sha256,p);p.catch(()=>{if(cache.get(v.sha256)===p)cache.delete(v.sha256);});while(cache.size>16)cache.delete(cache.keys().next().value);return p;
 }
 async function render(s){const token=++epoch;inherited.cancel();if(!applies(s))return inherited.render(s);const p=plan(s),descs=[p.avatar,p.shoes,p.pants,p.body,...(p.tie?[p.tie]:[]),...p.leaves,...p.hands,...p.cuffs,...(p.jacket?[p.jacket,p.ownership]:[])];
  const images=await Promise.all(descs.map(load));if(token!==epoch)return {cancelled:true};const at=v=>images[descs.findIndex(x=>x.sha256===v.sha256)];
  const frame=document.createElement('canvas'),shirt=document.createElement('canvas');frame.width=shirt.width=W;frame.height=shirt.height=H;const fc=frame.getContext('2d',{willReadFrequently:true}),sc=shirt.getContext('2d',{willReadFrequently:true});
  try{
   let own=null;if(p.ownership){sc.drawImage(at(p.ownership),0,0);own=sc.getImageData(0,0,W,H).data;sc.clearRect(0,0,W,H);}
   sc.drawImage(at(p.body),0,0);if(p.tie)sc.drawImage(at(p.tie),0,0);for(const v of p.leaves)sc.drawImage(at(v),0,0);
   if(own){const px=sc.getImageData(0,0,W,H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(own[i]||y>=p.cuffOwnershipStart)px.data[i]=px.data[i+1]=px.data[i+2]=px.data[i+3]=0;}sc.putImageData(px,0,0);}
   for(const v of [p.avatar,p.shoes,...(p.pantsInForeground?[]:[p.pants])])fc.drawImage(at(v),0,0);fc.drawImage(shirt,0,0);if(p.pantsInForeground)fc.drawImage(at(p.pants),0,0);if(p.jacket)fc.drawImage(at(p.jacket),0,0);for(const v of [...p.cuffs,...p.hands])fc.drawImage(at(v),0,0);
   if(token!==epoch)return {cancelled:true};ctx.putImageData(fc.getImageData(0,0,W,H),0,0);return {status:'ready',selection:structuredClone(s),source_assembly:p.ds023Cleanup?'V1162_DS023_ALPHA_COMPOSITE':'V116_BATCH16_SOURCE_REGISTRATION',source_registration:d.shirts[s.shirtId].source_sha256,derivative_not_original:true};
  }finally{frame.width=frame.height=shirt.width=shirt.height=1;}
 }
 return Object.freeze({plan,render,cancel(){epoch++;inherited.cancel();},stats:()=>({...inherited.stats(),batch10Cache:cache.size,maxBatch10Images:16})});
}
root.HEWRSBatch10Renderer=Object.freeze({implementationVersion:'1.16-batch16'});
root.HEWRSBlazerRenderer=Object.freeze({create:(c,n,u)=>create(c,n,u,'blazer')});
root.HEWRSShirtOnlyRenderer=Object.freeze({create:(c,n,u)=>create(c,n,u,'shirt-only')});
})(globalThis);
