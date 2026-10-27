/* Shoe Patch 5: three source-guided frontal review candidates.
 * Only new render connections for existing IDs; no catalogue or score edits. */
(function(root){'use strict';
function apply(input){
 const d=root.HEWRS_SHOE_REFERENCE_BATCH5;
 if(!d||d.schema!=='hewrs.shoe-reference-review.v1'||d.source_input_sha256!==root.HEWRS_INPUT_SHA256)throw Error('Shoe Patch 5 source lock mismatch');
 const expected=new Set(['shoe-30','shoe-31','shoe-48']),seen=new Set(),p=structuredClone(input);
 for(const row of d.entries){
  if(!expected.has(row.id)||seen.has(row.id)||!p.originalCatalogue.shoes.some(x=>x.id===row.id))throw Error('Shoe Patch 5 identity differs: '+row.id);
  if(row.baseline_layer!==null||p.shoeLayers[row.id])throw Error('Unexpected prior connection: '+row.id);
  if(row.layer.rect?.join(',')!=='0,0,996,2748'||!/^[a-f0-9]{64}$/.test(row.layer.sha256)||row.layer.url!=='assets/'+row.layer.sha256+'.png')throw Error('Invalid Shoe Patch 5 layer');
  seen.add(row.id);p.shoeLayers[row.id]=structuredClone(row.layer);p.assets[row.layer.sha256]=row.layer.url;
 }
 if(seen.size!==expected.size)throw Error('Incomplete Shoe Patch 5 binding');
 return p;
}
root.HEWRSShoeReferenceBatch5=Object.freeze({apply,revision:'shoe-reference-batch5-forward-review-20261015'});
})(globalThis);
