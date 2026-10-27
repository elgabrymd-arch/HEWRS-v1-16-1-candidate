/* Confirmed source assignments; additive bindings. Original inputs remain unchanged. */
(function(root){'use strict';
function apply(input){const d=root.HEWRS_FINAL_SHOE_BINDINGS;
 if(!d||d.schema!=='hewrs.confirmed-final-footwear.v1'||d.source_input_sha256!==root.HEWRS_INPUT_SHA256)throw Error('Final shoe source lock mismatch');
 const expected=new Set(['shoe-0','shoe-7','shoe-21','shoe-22','shoe-23','shoe-50']),seen=new Set(),p=structuredClone(input);
 for(const row of d.entries){
  if(!expected.has(row.id)||seen.has(row.id)||!p.originalCatalogue.shoes.some(x=>x.id===row.id))throw Error('Invalid final shoe identity: '+row.id);
  if(row.baseline_layer?p.shoeLayers[row.id]?.sha256!==row.baseline_layer:!!p.shoeLayers[row.id])throw Error('Prior shoe binding changed: '+row.id);
  if(row.layer.rect?.join(',')!=='0,0,996,2748'||!/^[a-f0-9]{64}$/.test(row.layer.sha256)||row.layer.url!=='assets/'+row.layer.sha256+'.png')throw Error('Invalid final footwear asset');
  seen.add(row.id);p.shoeLayers[row.id]=structuredClone(row.layer);p.assets[row.layer.sha256]=row.layer.url;
 }
 if(seen.size!==expected.size)throw Error('Incomplete final shoe bindings');
 const corrected={
 'shoe-7':{name:'Berluti Dress Shoes — Black Cap-Toe Double Monk Strap',color:'Black cap-toe double monk strap; silver-tone buckles'},
 'shoe-21':{name:'Dior Drivers — Black/Charcoal Patterned CD Driver',color:'Black/charcoal patterned CD driver'},
 'shoe-22':{name:'Gucci Drivers — Navy Suede Gold-Tone Horsebit',color:'Navy suede; gold-tone horsebit'},
 'shoe-23':{name:'Hermes Drivers — Plain Sand Suede',color:'Sand suede; no metal hardware'}
 };
 for(const [id,fields]of Object.entries(corrected)){const shoe=p.originalCatalogue.shoes.find(x=>x.id===id);shoe._prior_source_record=structuredClone(shoe);Object.assign(shoe,fields);shoe._source_revision=d.revision;}
 return p;
}
function thumbnails(){const t=root.HEWRS_OPTION_CARD_THUMBNAILS;if(!t||t.source_lock!==root.HEWRS_INPUT_SHA256)throw Error('Final thumbnail source mismatch');for(const row of root.HEWRS_FINAL_SHOE_BINDINGS.entries)t.shoes[row.id]=structuredClone(row.thumbnail);}
root.HEWRSFinalShoeBindings=Object.freeze({apply,thumbnails,revision:'1.25.0-r1-delivery-rebuild'});
})(globalThis);
