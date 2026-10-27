/* Supplied shoe-pair image registration review. Display only. No added IDs or scores. */
(function(root){'use strict';
function apply(input){
 const d=root.HEWRS_SHOE_REFERENCE_BATCH1;
 if(!d||d.schema!=='hewrs.shoe-reference-review.v1'||d.source_input_sha256!==root.HEWRS_INPUT_SHA256)throw Error('Shoe reference review source lock mismatch');
 const p=structuredClone(input),seen=new Set();
 for(const row of d.entries){
  if(seen.has(row.id)||!p.originalCatalogue.shoes.some(x=>x.id===row.id)||p.shoeLayers[row.id]?.sha256!==row.baseline_layer)throw Error('Shoe reference identity/baseline differs: '+row.id);
  if(row.layer.rect?.join(',')!=='0,0,996,2748'||!/^[a-f0-9]{64}$/.test(row.layer.sha256)||row.layer.url!=='assets/'+row.layer.sha256+'.png')throw Error('Invalid registered shoe reference');
  seen.add(row.id);p.shoeLayers[row.id]=structuredClone(row.layer);p.assets[row.layer.sha256]=row.layer.url;
 }
 return p;
}
root.HEWRSShoeReferenceBatch1=Object.freeze({apply,revision:'shoe-reference-batch1-20261014-review'});
})(globalThis);
