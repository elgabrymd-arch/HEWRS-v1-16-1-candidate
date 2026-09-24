/* B01/B02 owner-authorized appearance reconciliation. Their original jacket
 * alpha and the existing B02 ownership mask are retained. No borrowed full
 * avatar, no colour filter on the UI, no hidden fallback to another garment.
 * All pre-existing suit/B03-B14/shirt-only renderers remain byte-identical. */
(function(root){'use strict';
const prior=root.HEWRSBlazerRenderer,W=996,H=2748;
function create(canvas,connection,resolveUrl){
 const inherited=prior.create(canvas,connection,resolveUrl),ctx=canvas.getContext('2d',{willReadFrequently:true});
 let epoch=0;const cache=new Map();
 function native(s){return connection.blazerConnection.isBlazer(s)&&(s.state==='NO_TIE'||connection.blazerConnection.knownBlazer(s.blazerId).assembly?.mode==='NATIVE_REGISTERED_CLOTH');}
 function plan(s){
  if(!native(s))return inherited.plan(s);connection.validateSelection(s);
  const b=connection.blazerConnection.knownBlazer(s.blazerId),a=connection.blazerConnection.data.assembly;
  if(s.state!=='NO_TIE'&&!['B01','B02'].includes(b.id))throw Error('Unknown native assembly request');
  const registered=b.assembly||a,ownership=registered.ownership||connection.blazerConnection.knownBlazer('B02').assembly.ownership;
  return {operation:s.state==='NO_TIE'?'CURRENT_SOURCE_OPEN_COLLAR_ASSEMBLY':'B01_B02_EXISTING_ALPHA_APPROVED_REFERENCE_CLOTH',selection:structuredClone(s),avatar:connection.manifest.static.avatar,shoes:connection.shoeLayers[s.shoeId],pants:connection.blazerConnection.knownPant(s.pantId).layer,shirt:s.state==='NO_TIE'?a.no_tie:a.ties[s.state],ownership,cuffOwnershipStart:registered.sourceCuffOwnershipStart??1339,jacket:registered.jacket,cuffs:a.cuffs,hands:a.hands};
 }
 function load(d){
  if(!d||!/^[a-f0-9]{64}$/.test(d.sha256)||d.rect?.join(',')!=='0,0,996,2748'||!Object.hasOwn(connection.assetPaths,d.sha256))throw Error('Unbound B01/B02 source');
  if(cache.has(d.sha256)){const p=cache.get(d.sha256);cache.delete(d.sha256);cache.set(d.sha256,p);return p;}
  const p=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{if(im.naturalWidth!==W||im.naturalHeight!==H){reject(Error('Wrong native B01/B02 source dimensions'));return;}resolve(im);};im.onerror=()=>reject(Error('Missing B01/B02 source; no substitution'));try{im.src=resolveUrl(d);}catch(e){reject(e);}});
  cache.set(d.sha256,p);p.catch(()=>{if(cache.get(d.sha256)===p)cache.delete(d.sha256);});while(cache.size>12)cache.delete(cache.keys().next().value);return p;
 }
 async function render(s){
  const token=++epoch;inherited.cancel();
  if(!native(s))return inherited.render(s);
  const p=plan(s),list=[p.avatar,p.shoes,p.pants,p.shirt,p.ownership,p.jacket,...p.cuffs,...p.hands],ims=await Promise.all(list.map(load));
  if(token!==epoch)return {cancelled:true};
  const frame=document.createElement('canvas'),shirt=document.createElement('canvas');frame.width=shirt.width=W;frame.height=shirt.height=H;
  const fc=frame.getContext('2d',{willReadFrequently:true}),sc=shirt.getContext('2d',{willReadFrequently:true});
  try{
   sc.drawImage(ims[4],0,0);const own=sc.getImageData(0,0,W,H).data;
   sc.clearRect(0,0,W,H);sc.drawImage(ims[3],0,0);const clean=sc.getImageData(0,0,W,H);
   // Original binary ownership mask is a grayscale PNG: red, not alpha,
   // is its coverage. Supplied standalone cuffs own the lower cuff rows;
   // the baked-in full-shirt cuffs must not render as a second pair.
   for(let i=0;i<clean.data.length;i+=4)if(own[i]||Math.floor(i/(W*4))>=p.cuffOwnershipStart){clean.data[i]=clean.data[i+1]=clean.data[i+2]=clean.data[i+3]=0;}
   sc.putImageData(clean,0,0);
   for(const im of ims.slice(0,3))fc.drawImage(im,0,0);
   fc.drawImage(shirt,0,0);fc.drawImage(ims[5],0,0);
   for(const im of ims.slice(6))fc.drawImage(im,0,0);
   if(token!==epoch)return {cancelled:true};ctx.putImageData(fc.getImageData(0,0,W,H),0,0);
   return {status:'ready',selection:structuredClone(s),source_assembly:s.state==='NO_TIE'?'CURRENT_OPEN_COLLAR_EXISTING_FULL_BODY_AND_NATIVE_BLAZER':'B01_B02_APPROVED_REFERENCE_RGB_EXISTING_ALPHA_CP49_DS001_CP54_TROUSERS',appearance_authorization:s.state==='NO_TIE'?null:'2026-09-23T03:57:47Z',implementation_scope:s.state==='NO_TIE'?'SOURCE_DERIVED_OPEN_COLLAR_CONNECTION_NOT_A_NEW_OWNER_VISUAL_APPROVAL':'PREVIOUS_APPROVED_RECONCILIATION'};
  }finally{frame.width=frame.height=shirt.width=shirt.height=1;}
 }
 function cancel(){epoch++;inherited.cancel();}
 return Object.freeze({render,plan,cancel,stats:()=>({...inherited.stats(),nativeB01B02Cache:cache.size})});
}
root.HEWRSOriginalBlazerRendererV111=prior;root.HEWRSBlazerRenderer=Object.freeze({create});
})(globalThis);
