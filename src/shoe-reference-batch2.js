/* Shoe Batch 2: source-specific display registrations. Existing IDs retained.
 * shoe-46 gains a rendering connection; no catalogue/scoring facts are rewritten. */
(function(root){'use strict';
function apply(input){
 const d=root.HEWRS_SHOE_REFERENCE_BATCH2;
 if(!d||d.schema!=='hewrs.shoe-reference-review.v1'||d.source_input_sha256!==root.HEWRS_INPUT_SHA256)throw Error('Shoe Batch 2 source lock mismatch');
 const p=structuredClone(input),seen=new Set();
 for(const row of d.entries){
  if(seen.has(row.id)||!p.originalCatalogue.shoes.some(x=>x.id===row.id))throw Error('Shoe Batch 2 identity differs: '+row.id);
  if(row.baseline_layer===null){if(row.id!=='shoe-46'||p.shoeLayers[row.id])throw Error('Unexpected new shoe connection: '+row.id);}
  else if(p.shoeLayers[row.id]?.sha256!==row.baseline_layer)throw Error('Shoe Batch 2 baseline differs: '+row.id);
  if(row.layer.rect?.join(',')!=='0,0,996,2748'||!/^[a-f0-9]{64}$/.test(row.layer.sha256)||row.layer.url!=='assets/'+row.layer.sha256+'.png')throw Error('Invalid shoe Batch 2 reference');
  seen.add(row.id);p.shoeLayers[row.id]=structuredClone(row.layer);p.assets[row.layer.sha256]=row.layer.url;
 }
 return p;
}
root.HEWRSShoeReferenceBatch2=Object.freeze({apply,revision:'shoe-reference-batch2-20261014-review'});
})(globalThis);
