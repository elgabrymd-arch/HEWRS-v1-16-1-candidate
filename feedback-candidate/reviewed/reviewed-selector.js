/* Standalone Stage 7 reviewed-outfit selector. No storage, network or deployment.
   Does not extrapolate a reviewed result to a different outfit or rewrite DNA. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./rebuild-core.js'));else root.HEWRSReviewedSelector=factory(root.HEWRSRebuildCore);})(typeof globalThis==='object'?globalThis:this,function(Core){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function requireThat(ok,msg){if(!ok)throw new Error(msg);}
function create(catalogue,reviewSet,ownerConstraints){
 requireThat(Core&&typeof Core.create==='function','Missing review core.');
 requireThat(reviewSet?.schema==='hewrs.rebuild.outfit-review-set.v1','Invalid review set.');
 requireThat(reviewSet.catalogue_fingerprint===catalogue.fingerprint,'Stale review set.');
 requireThat(ownerConstraints?.schema==='hewrs.rebuild.owner-constraints.v1','Missing or malformed owner constraints; refusing an empty fallback.');
 requireThat(ownerConstraints.catalogue_fingerprint===catalogue.fingerprint,'Stale owner-constraint binding.');
 requireThat(Array.isArray(ownerConstraints.rules)&&ownerConstraints.rules.length>0,'Missing preserved owner rules.');
 const engine=Core.create(catalogue),entries=clone(reviewSet.entries),constraints=clone(ownerConstraints);
 const owners={rejected_outfits:[],rejected_clothing:[]};
 for(const rule of constraints.rules){
  requireThat(rule.status==='active_in_candidate'&&rule.type==='rejected_clothing'&&typeof rule.clothing_key==='string','Unsupported/corrupt owner rule.');
  requireThat(rule.source?.filename&&rule.source?.excerpt,'Owner rule lacks evidence.');
  const [top,pants,shirt,tie,...extra]=rule.clothing_key.split('|');
  requireThat(extra.length===0&&engine.get(top)&&engine.get(shirt)&&engine.get(tie)&&pants==='SUIT_TROUSERS','Invalid preserved rejection identity.');
  owners.rejected_clothing.push(rule.clothing_key);
 }
 requireThat(owners.rejected_clothing.includes('S01|SUIT_TROUSERS|DS029|T024'),'Required explicit owner rejection is absent.');
 const byKey=new Map(),byId=new Map();
 for(const entry of entries){
  requireThat(entry&&typeof entry.id==='string'&&!byId.has(entry.id),'Duplicate/malformed review ID.');
  const k=Core.outfitKey(entry.outfit);requireThat(!byKey.has(k),'Duplicate exact reviewed outfit.');
  const result=engine.assess(entry.outfit,{},entry.review,owners);
  requireThat(result.hard_constraints.status==='pass','A supplied review violates an owner/identity restriction.');
  requireThat(result.review.validation_issues.length===0,'Invalid review '+entry.id+': '+result.review.validation_issues.join(', '));
  requireThat(entry.review.owner_approved===false,'This candidate cannot manufacture owner approvals.');
  byKey.set(k,entry);byId.set(entry.id,entry);
 }
 function ownerState(additional={}){
  requireThat(additional&&typeof additional==='object'&&!Array.isArray(additional),'Extra feedback must be an object.');
  for(const k of Object.keys(additional))requireThat(['rejected_outfits','rejected_clothing'].includes(k),'Only additional exact rejection arrays are supported.');
  const out={};for(const k of ['rejected_outfits','rejected_clothing']){
   requireThat(additional[k]===undefined||Array.isArray(additional[k])&&additional[k].every(x=>typeof x==='string'),'Invalid additional rejection array.');
   out[k]=[...new Set([...owners[k],...(additional[k]||[])])];
  }return out;
 }
 return Object.freeze({
  select(request={},additional={}){return engine.selectReviewed(entries,request,ownerState(additional));},
  inspect(outfit,request={},additional={}){const e=byKey.get(Core.outfitKey(outfit));return engine.assess(outfit,request,e?.review||null,ownerState(additional));},
  entries:()=>clone(entries),getReview:id=>byId.has(id)?clone(byId.get(id)):null,
  ownerConstraints:()=>clone(constraints),catalogueFingerprint:catalogue.fingerprint,
  scope:'Only the supplied exact source-board reviews. No full-wardrobe generalisation, owner preference training, native avatar compositor, live service or deployment.',
  inheritedCoreRevision:Core.revision
 });
}
return Object.freeze({create,revision:'hewrs.stage8.reviewed-selector.v1'});
});
