/* Shared atomic commit for suit, blazer and shirt-only modes; detached canvases. */
(function(root){'use strict';const previous=root.HEWRSAtomicRenderer;
function create(visible,connection,options={}){
 const W=996,H=2748;visible.width=W;visible.height=H;const vc=visible.getContext('2d',{willReadFrequently:true});
 const suitCanvas=document.createElement('canvas'),blazerCanvas=document.createElement('canvas'),shirtCanvas=document.createElement('canvas');
 const suit=previous.create(suitCanvas,connection,options),blazer=root.HEWRSBlazerRenderer.create(blazerCanvas,connection,options.resolveUrl),shirt=root.HEWRSShirtOnlyRenderer.create(shirtCanvas,connection,options.resolveUrl);
 let epoch=0,last=null,current=null;
 async function render(input){const token=++epoch;if(current)current.cancel();let s;
  try{s=connection.validateSelection(input);}catch(e){visible.dataset.loading='false';visible.dataset.status=last?'error-retained':'error-empty';throw e;}
  const isShirtOnly=connection.shirtOnlyConnection.isShirtOnly(s),isBlazer=connection.blazerConnection.isBlazer(s),engine=isShirtOnly?shirt:isBlazer?blazer:suit,off=isShirtOnly?shirtCanvas:isBlazer?blazerCanvas:suitCanvas;current=engine;visible.dataset.loading='true';visible.dataset.pendingShirt=s.shirtId;
  try{const result=await engine.render(s);if(token!==epoch||result.cancelled)return {cancelled:true};vc.putImageData(off.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H),0,0);last=structuredClone(s);
   for(const k of ['suitId','blazerId','pantId','shirtOnly'])delete visible.dataset[k];Object.assign(visible.dataset,{status:'ready',loading:'false',shirtId:s.shirtId,state:s.state,shoeId:s.shoeId,kind:isShirtOnly?'shirt-only':isBlazer?'blazer':'suit'});if(isShirtOnly){visible.dataset.shirtOnly='true';visible.dataset.pantId=s.pantId;}else if(isBlazer){visible.dataset.blazerId=s.blazerId;visible.dataset.pantId=s.pantId;}else visible.dataset.suitId=s.suitId;delete visible.dataset.pendingShirt;return {status:'ready',selection:structuredClone(s),source_result:result};
  }catch(e){if(token===epoch){visible.dataset.loading='false';visible.dataset.status=last?'error-retained':'error-empty';delete visible.dataset.pendingShirt;}throw e;}
 }
 function cancel(){epoch++;suit.cancel();blazer.cancel();shirt.cancel();visible.dataset.loading='false';visible.dataset.status=last?'ready':'empty';delete visible.dataset.pendingShirt;}
 return Object.freeze({render,cancel,last:()=>last&&structuredClone(last),plan:s=>connection.shirtOnlyConnection.isShirtOnly(s)?shirt.plan(s):connection.blazerConnection.isBlazer(s)?blazer.plan(s):suit.plan(s),stats:()=>({...suit.stats(),blazer:blazer.stats(),shirtOnly:shirt.stats(),epoch})});
}
root.HEWRSSuitAtomicRendererV16=previous;root.HEWRSAtomicRenderer=Object.freeze({create});})(globalThis);
