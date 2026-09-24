/* Shared atomic commit for suit and blazer modes; both use detached canvases. */
(function(root){'use strict';const previous=root.HEWRSAtomicRenderer;
function create(visible,connection,options={}){
 const W=996,H=2748;visible.width=W;visible.height=H;const vc=visible.getContext('2d',{willReadFrequently:true});
 const suitCanvas=document.createElement('canvas'),blazerCanvas=document.createElement('canvas');
 const suit=previous.create(suitCanvas,connection,options),blazer=root.HEWRSBlazerRenderer.create(blazerCanvas,connection,options.resolveUrl);
 let epoch=0,last=null,current=null;
 async function render(input){const token=++epoch;if(current)current.cancel();let s;
  try{s=connection.validateSelection(input);}catch(e){visible.dataset.loading='false';visible.dataset.status=last?'error-retained':'error-empty';throw e;}
  const isBlazer=connection.blazerConnection.isBlazer(s),engine=isBlazer?blazer:suit,off=isBlazer?blazerCanvas:suitCanvas;current=engine;visible.dataset.loading='true';visible.dataset.pendingShirt=s.shirtId;
  try{const result=await engine.render(s);if(token!==epoch||result.cancelled)return {cancelled:true};vc.putImageData(off.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H),0,0);last=structuredClone(s);
   for(const k of ['suitId','blazerId','pantId'])delete visible.dataset[k];Object.assign(visible.dataset,{status:'ready',loading:'false',shirtId:s.shirtId,state:s.state,shoeId:s.shoeId,kind:isBlazer?'blazer':'suit'});if(isBlazer){visible.dataset.blazerId=s.blazerId;visible.dataset.pantId=s.pantId;}else visible.dataset.suitId=s.suitId;delete visible.dataset.pendingShirt;return {status:'ready',selection:structuredClone(s),source_result:result};
  }catch(e){if(token===epoch){visible.dataset.loading='false';visible.dataset.status=last?'error-retained':'error-empty';delete visible.dataset.pendingShirt;}throw e;}
 }
 function cancel(){epoch++;suit.cancel();blazer.cancel();visible.dataset.loading='false';visible.dataset.status=last?'ready':'empty';delete visible.dataset.pendingShirt;}
 return Object.freeze({render,cancel,last:()=>last&&structuredClone(last),plan:s=>connection.blazerConnection.isBlazer(s)?blazer.plan(s):suit.plan(s),stats:()=>({...suit.stats(),blazer:blazer.stats(),epoch})});
}
root.HEWRSSuitAtomicRendererV16=previous;root.HEWRSAtomicRenderer=Object.freeze({create});})(globalThis);
