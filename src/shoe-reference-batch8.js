/* Shoe Patch 8: four supplied-reference REVIEW candidates; not a final release. */
(function(root){'use strict';
function apply(input){
 const d=root.HEWRS_SHOE_REFERENCE_BATCH8;
 if(!d||d.schema!=='hewrs.shoe-reference-review.v1'||d.source_input_sha256!==root.HEWRS_INPUT_SHA256)throw Error('Shoe Patch 8 source lock mismatch');
 const expected=new Set(['shoe-28','shoe-38','shoe-40','shoe-43']),seen=new Set(),p=structuredClone(input);
 for(const row of d.entries){
  if(!expected.has(row.id)||seen.has(row.id)||!p.originalCatalogue.shoes.some(x=>x.id===row.id))throw Error('Shoe Patch 8 identity differs: '+row.id);
  if(row.baseline_layer ? p.shoeLayers[row.id]?.sha256!==row.baseline_layer : !!p.shoeLayers[row.id])throw Error('Unexpected prior connection: '+row.id);
  if(row.layer.rect?.join(',')!=='0,0,996,2748'||!/^[a-f0-9]{64}$/.test(row.layer.sha256)||row.layer.url!=='assets/'+row.layer.sha256+'.png')throw Error('Invalid Shoe Patch 8 layer');
  seen.add(row.id);p.shoeLayers[row.id]=structuredClone(row.layer);p.assets[row.layer.sha256]=row.layer.url;
 }
 if(seen.size!==expected.size)throw Error('Incomplete Shoe Patch 8 binding');
 return p;
}
root.HEWRSShoeReferenceBatch8=Object.freeze({apply,revision:'shoe-reference-batch8-forward-review-20261026'});
})(globalThis);
