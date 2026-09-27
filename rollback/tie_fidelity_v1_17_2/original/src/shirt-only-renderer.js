/* Native source-over assembly, at the original coordinates. No warp, extension,
 * colour change, invented waistband, hidden underlayer, or fallback clothing. */
(function(root){'use strict';const W=996,H=2748;
function create(canvas,connection,resolveUrl){
 canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas unavailable');
 let epoch=0;const cache=new Map();
 function plan(s){connection.validateSelection(s);if(!connection.shirtOnlyConnection.isShirtOnly(s))throw Error('Shirt-only selection required');
  const d=connection.shirtOnlyConnection.data,body=d.shirts[s.shirtId];
  return {operation:'NATIVE_FULL_SHIRT_WITHOUT_JACKET',selection:structuredClone(s),layers:[d.avatar,connection.shoeLayers[s.shoeId],connection.blazerConnection.knownPant(s.pantId).layer,body.layers[s.state],...body.hands]};
 }
 function load(d){
  if(!d||!/^[a-f0-9]{64}$/.test(d.sha256)||d.rect?.join(',')!=='0,0,996,2748'||!Object.hasOwn(connection.assetPaths,d.sha256))throw Error('Unbound shirt-only source');
  if(cache.has(d.sha256)){const value=cache.get(d.sha256);cache.delete(d.sha256);cache.set(d.sha256,value);return value;}
  const promise=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>im.naturalWidth===W&&im.naturalHeight===H?resolve(im):reject(Error('Wrong native source dimensions'));im.onerror=()=>reject(Error('Shirt-only source failed to load'));im.src=resolveUrl(d);});
  cache.set(d.sha256,promise);promise.catch(()=>{if(cache.get(d.sha256)===promise)cache.delete(d.sha256);});while(cache.size>10)cache.delete(cache.keys().next().value);return promise;
 }
 async function render(s){const token=++epoch,p=plan(s),images=await Promise.all(p.layers.map(load));if(token!==epoch)return {cancelled:true};
  const frame=document.createElement('canvas');frame.width=W;frame.height=H;const cc=frame.getContext('2d',{willReadFrequently:true});
  try{for(const im of images)cc.drawImage(im,0,0);if(token!==epoch)return {cancelled:true};ctx.putImageData(cc.getImageData(0,0,W,H),0,0);return {status:'ready',selection:structuredClone(s),source_assembly:'EXISTING_CP49_DS001_PLUS_CP54_PANTS_AND_REGISTERED_HANDS'};}
  finally{frame.width=frame.height=1;}
 }
 return Object.freeze({plan,render,cancel(){epoch++;},stats:()=>({imageCache:cache.size,maxImages:10})});
}
root.HEWRSShirtOnlyRenderer=Object.freeze({create});
})(globalThis);
