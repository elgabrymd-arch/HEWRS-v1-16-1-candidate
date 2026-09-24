/* Existing B03 checkpoint assembly with original CP49 tie-replacement mask.
 * Lower-body substitution uses supplied role coverage only; no resizing/warping.
 * Original upper-body RGBA is copied, not re-composited from an unregistered avatar. */
(function(root){'use strict';const W=996,H=2748;
function create(canvas,connection,resolveUrl){
 canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{willReadFrequently:true});let epoch=0;const cache=new Map();
 const d=connection.blazerConnection.data,a=d.assembly;
 function load(desc){if(cache.has(desc.sha256))return cache.get(desc.sha256);const p=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{if(im.naturalWidth!==W||im.naturalHeight!==H){reject(Error('Wrong source dimensions'));return;}const c=document.createElement('canvas');c.width=W;c.height=H;const cc=c.getContext('2d',{willReadFrequently:true});cc.drawImage(im,0,0);const data=cc.getImageData(0,0,W,H).data;c.width=c.height=1;resolve({im,data});};im.onerror=()=>reject(Error('Blazer source failed to load'));im.src=resolveUrl(desc);});cache.set(desc.sha256,p);p.catch(()=>cache.delete(desc.sha256));while(cache.size>18)cache.delete(cache.keys().next().value);return p;}
 function plan(s){connection.validateSelection(s);if(!connection.blazerConnection.isBlazer(s))throw Error('Blazer selection required');const registered=connection.blazerConnection.knownBlazer(s.blazerId).assembly||a;return {operation:'EXISTING_APPROVED_CONTROL_WITH_REGISTERED_REPLACEMENTS',blazerId:s.blazerId,pantId:s.pantId,shirtId:s.shirtId,state:s.state,base:registered.base,avatar:connection.manifest.static.avatar,jacket:registered.jacket,tie:a.ties[s.state],tieMask:a.tie_mask,shirtProtection:a.ties.T001,hands:a.hands,cuffs:a.cuffs,oldTrousers:a.old_trousers,oldShoes:a.old_shoes,pants:connection.blazerConnection.knownPant(s.pantId).layer,shoes:connection.shoeLayers[s.shoeId]};}
 async function render(s){const token=++epoch,p=plan(s),list=[p.base,p.avatar,p.jacket,p.tie,p.tieMask,p.shirtProtection,...p.hands,...p.cuffs,p.oldTrousers,p.oldShoes,p.pants,p.shoes];const ims=await Promise.all(list.map(load));if(token!==epoch)return {cancelled:true};const image=desc=>ims[list.findIndex(x=>x.sha256===desc.sha256)],data=desc=>image(desc).data;
  const fixed=data(p.base),j=data(p.jacket),shirt=data(p.shirtProtection),hands=p.hands.map(data),cuffs=p.cuffs.map(data);
  // The checkpoint's old avatar and temporary shoes are never copied into the
  // current outfit. Start with the unchanged current visible-body source and
  // selected lower-body layers; copy only existing garment/hand-owned pixels.
  const lower=document.createElement('canvas');lower.width=W;lower.height=H;const lc=lower.getContext('2d',{willReadFrequently:true});
  lc.drawImage(image(p.avatar).im,0,0);lc.drawImage(image(p.shoes).im,0,0);lc.drawImage(image(p.pants).im,0,0);
  const out=lc.getImageData(0,0,W,H).data;
  for(let i=0;i<out.length;i+=4){const alpha=i+3;
   if(j[alpha]||shirt[alpha]||hands.some(x=>x[alpha])||cuffs.some(x=>x[alpha])){
    // Ignore hidden parts of the full-length shirt that were not visible in
    // the original approved composite. Source alpha selects the visible stack.
    if(fixed[alpha]){out[i]=fixed[i];out[i+1]=fixed[i+1];out[i+2]=fixed[i+2];out[alpha]=fixed[alpha];}
   }
  }
  lower.width=lower.height=1;
  // Historical CP49 code copies RGB only at the stored binary visibility mask.
  const tie=data(p.tie),mask=data(p.tieMask);if(s.state!=='T001')for(let i=0;i<out.length;i+=4)if(mask[i]>0){out[i]=tie[i];out[i+1]=tie[i+1];out[i+2]=tie[i+2];}
  if(token!==epoch)return {cancelled:true};ctx.putImageData(new ImageData(out,W,H),0,0);return {status:'ready',selection:structuredClone(s),source_assembly:s.blazerId==='B03'?'B03_CHECKPOINT44_CP49_CP54':'CP46_CP47_CP49_CP54'};
 }
 return Object.freeze({render,plan,cancel(){epoch++;},stats:()=>({imageCache:cache.size})});
}
root.HEWRSBlazerRenderer=Object.freeze({create});})(globalThis);
