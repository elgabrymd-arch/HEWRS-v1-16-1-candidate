/* Shoe Batch 4: six independent reference-based front registrations.
 * Four new rendering connections use existing catalogue IDs. No scoring edits. */
(function(root){'use strict';
function apply(input){
 const d=root.HEWRS_SHOE_REFERENCE_BATCH4;
 if(!d||d.schema!=='hewrs.shoe-reference-review.v1'||d.source_input_sha256!==root.HEWRS_INPUT_SHA256)throw Error('Shoe Batch 4 source lock mismatch');
 const expected=new Set(['shoe-8','shoe-29','shoe-32','shoe-33','shoe-45','shoe-47']),added=new Set(['shoe-29','shoe-32','shoe-45','shoe-47']),seen=new Set(),p=structuredClone(input);
 for(const row of d.entries){
  if(!expected.has(row.id)||seen.has(row.id)||!p.originalCatalogue.shoes.some(x=>x.id===row.id))throw Error('Shoe Batch 4 identity differs: '+row.id);
  if(row.baseline_layer===null){if(!added.has(row.id)||p.shoeLayers[row.id])throw Error('Unexpected new shoe connection: '+row.id);}
  else if(added.has(row.id)||p.shoeLayers[row.id]?.sha256!==row.baseline_layer)throw Error('Shoe Batch 4 baseline differs: '+row.id);
  if(row.layer.rect?.join(',')!=='0,0,996,2748'||!/^[a-f0-9]{64}$/.test(row.layer.sha256)||row.layer.url!=='assets/'+row.layer.sha256+'.png')throw Error('Invalid Shoe Batch 4 layer');
  seen.add(row.id);p.shoeLayers[row.id]=structuredClone(row.layer);p.assets[row.layer.sha256]=row.layer.url;
 }
 if(seen.size!==expected.size)throw Error('Incomplete Shoe Batch 4 binding');
 return p;
}
root.HEWRSShoeReferenceBatch4=Object.freeze({apply,revision:'shoe-reference-batch4-forward-review-20261015'});
})(globalThis);
