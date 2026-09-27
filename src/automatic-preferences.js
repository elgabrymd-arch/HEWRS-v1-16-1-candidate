/* Only resolves unlocked categories. Existing six-category picker draft,
 * Apply/Cancel, explicit No Tie/No Watch and exact manual paths stay intact. */
(function(root){'use strict';const prior=root.HEWRSFaceliftModel;
function create(c){const base=prior.create(c);
 function operation(mode,ctx){const p=base.snapshot(),top=base.selectedTop(),isSuit=top?.kind==='suit';
  const exact=top&&p.shirt.mode==='item'&&['item','none'].includes(p.tie.mode)&&p.shoes.mode==='item'&&['item','none'].includes(p.watch.mode)&&(isSuit||p.bottoms.mode==='item');
  if(mode==='anchor'&&exact)return base.operation(mode,ctx);
  if(top?.kind==='shirt-only')throw Error('Shirt-only remains manual Anchor: select exact shirt, tie / No Tie, trousers, shoes and watch / No watch. No shirt-only numerical model is installed.');
  if(!['engine','anchor'].includes(mode))throw Error('Unknown choice mode');
  const config={automatic:true,preferences:p,occasion:ctx.occasion,formality:ctx.formality,style:ctx.style,localDate:ctx.localDate,environment:ctx.environment};return {kind:'engine',config,request:c.makeRequest(config),prefs:p};
 }
 return Object.freeze({...base,operation});
}
root.HEWRSFaceliftModel=Object.freeze({...prior,create});
})(globalThis);
