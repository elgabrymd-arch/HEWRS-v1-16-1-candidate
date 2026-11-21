/* Native source-over assembly, at the original coordinates. No warp, extension,
 * colour change, invented waistband, hidden underlayer, or fallback clothing. */
(function(root){'use strict';const W=996,H=2748;
function create(canvas,connection,resolveUrl){
 canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas unavailable');
 let epoch=0;const loads=root.HEWRSRenderImageLoader.create({limit:10,resolveUrl,width:W,height:H,missing:'Shirt-only source failed to load',dimensions:'Wrong native source dimensions'});
 function plan(s){connection.validateSelection(s);if(!connection.shirtOnlyConnection.isShirtOnly(s))throw Error('Shirt-only selection required');
  const d=connection.shirtOnlyConnection.data,body=d.shirts[s.shirtId];
  return {operation:'NATIVE_FULL_SHIRT_WITHOUT_JACKET',selection:structuredClone(s),layers:[d.avatar,connection.shoeLayers[s.shoeId],connection.blazerConnection.knownPant(s.pantId).layer,(connection.tieFidelity?connection.tieFidelity.replace(body.layers[s.state]):body.layers[s.state]),...body.hands]};
 }
 function load(d){
  if(!d||!/^[a-f0-9]{64}$/.test(d.sha256)||d.rect?.join(',')!=='0,0,996,2748'||!Object.hasOwn(connection.assetPaths,d.sha256))throw Error('Unbound shirt-only source');
  return loads.load(d);
 }
 async function render(s){const token=++epoch;loads.cancel();const p=plan(s),images=await Promise.all(p.layers.map(load)).catch(error=>{if(token!==epoch)return null;throw error;});if(token!==epoch||!images)return {cancelled:true};
  const frame=document.createElement('canvas');frame.width=W;frame.height=H;const cc=frame.getContext('2d',{willReadFrequently:true});
  try{for(const im of images)cc.drawImage(im,0,0);if(token!==epoch)return {cancelled:true};ctx.putImageData(cc.getImageData(0,0,W,H),0,0);return {status:'ready',selection:structuredClone(s),source_assembly:'EXISTING_CP49_DS001_PLUS_CP54_PANTS_AND_REGISTERED_HANDS'};}
  finally{frame.width=frame.height=1;}
 }
 return Object.freeze({plan,render,cancel(){epoch++;loads.cancel();},stats:()=>({imageCache:loads.size,maxImages:10})});
}
root.HEWRSShirtOnlyRenderer=Object.freeze({create});
})(globalThis);
