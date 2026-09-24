/* New application wrapper. Original renderer runs only on a detached canvas.
 * Visible pixels change only after a complete current-request frame succeeds. */
(function(root){'use strict';
function create(visible,connection,{resolveUrl,rendererFactory=root.HEWRSDS035EdgeRenderer.create}={}){
 const W=996,H=2748;visible.width=W;visible.height=H;
 const ctx=visible.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas unavailable');
 let epoch=0,last=null,current=null;const engines=new Map();
 function instance(suitId,shoeId,shirtId){
  const key=suitId+'/'+shoeId+'/'+(connection.assemblies.widerDS035SuitIds.includes(suitId)?shirtId:'unchanged-original');
  if(engines.has(key)){const e=engines.get(key);engines.delete(key);engines.set(key,e);return e;}
  const manifest=connection.assemblies.forSelection(suitId,shoeId,shirtId);
  const off=document.createElement('canvas'),renderer=rendererFactory(off,manifest,resolveUrl);
  const e={off,renderer};engines.set(key,e);
  while(engines.size>2){const key=engines.keys().next().value,old=engines.get(key);old.renderer.cancel();old.off.width=old.off.height=1;engines.delete(key);}
  return e;
 }
 async function render(selection){
  const id=++epoch;
  if(current)current.renderer.cancel();
  let s;try{s=connection.validateSelection(selection);}catch(error){visible.dataset.loading='false';visible.dataset.status=last?'error-retained':'error-empty';delete visible.dataset.pendingShirt;throw error;}
  visible.dataset.loading='true';visible.dataset.pendingShirt=s.shirtId;
  const e=instance(s.suitId,s.shoeId,s.shirtId);current=e;
  try{
   const result=await e.renderer.render({suitId:'S05',shirtId:s.shirtId,state:s.state});
   if(id!==epoch||result.cancelled)return {cancelled:true};
   const pixels=e.off.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H);
   // putImageData is a replacement, not an extra source-over blend.
   ctx.putImageData(pixels,0,0);last=structuredClone(s);
   Object.assign(visible.dataset,{status:'ready',suitId:s.suitId,shirtId:s.shirtId,state:s.state,shoeId:s.shoeId});
   delete visible.dataset.pendingShirt;visible.dataset.loading='false';
   return {status:'ready',selection:structuredClone(s),original_result:{...result,suitId:s.suitId},source_compositor_template:'S05'};
  }catch(error){if(id===epoch){visible.dataset.status=last?'error-retained':'error-empty';visible.dataset.loading='false';delete visible.dataset.pendingShirt;}throw error;}
 }
 function cancel(){epoch++;if(current)current.renderer.cancel();visible.dataset.loading='false';delete visible.dataset.pendingShirt;visible.dataset.status=last?'ready':'empty';}
 return Object.freeze({render,cancel,last:()=>last?structuredClone(last):null,plan:s=>{connection.validateSelection(s);const c=document.createElement('canvas'),r=rendererFactory(c,connection.assemblies.forSelection(s.suitId,s.shoeId,s.shirtId),resolveUrl);try{return r.plan({suitId:'S05',shirtId:s.shirtId,state:s.state});}finally{c.width=c.height=1;}},stats:()=>({detachedRenderers:engines.size,maxRenderers:2,epoch})});
}
root.HEWRSAtomicRenderer=Object.freeze({create});
})(globalThis);
