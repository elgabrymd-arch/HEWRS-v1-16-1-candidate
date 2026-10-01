/* Narrow owner-authorized shoe-15 appearance overlay.
 * Original inputs/IDs/scores and prior image bytes are not edited. The new
 * descriptor is supplied before all suit/non-suit rendering closures are made.
 * This is a photograph-derived display correction, not a styling score change.
 */
(function(root){'use strict';
const clone=x=>structuredClone(x),need=(ok,message)=>{if(!ok)throw Error(message);};
function record(){return clone(root.HEWRS_SHOE_PHOTO_CORRECTION);}
function apply(input){
 const d=record();
 need(d?.schema==='hewrs.shoe-photo-correction.v1'&&d.id==='shoe-15','Missing shoe-15 photo correction');
 need(d.source_input_sha256===root.HEWRS_INPUT_SHA256,'Shoe correction input lock mismatch');
 need(input?.shoeLayers?.[d.id]?.sha256===d.baseline.sha256,'Shoe-15 baseline has changed; correction not applied');
 need(d.layer.rect?.join(',')==='0,0,996,2748'&&d.baseline.rect?.join(',')==='0,0,996,2748','Shoe-15 placement contract changed');
 need(/^[a-f0-9]{64}$/.test(d.layer.sha256)&&d.layer.url==='assets/'+d.layer.sha256+'.png','Invalid corrected shoe asset');
 const p=clone(input),item=p.originalCatalogue.shoes.find(x=>x.id===d.id);
 need(item&&item.color===d.legacy_scoring_color_preserved,'Shoe-15 catalogue baseline differs');
 p.shoeLayers[d.id]=clone(d.layer);p.assets[d.layer.sha256]=d.layer.url;
 // Brown is already the correct broad family. Avoid a "cognac" keyword that
 // would silently change inherited accessory scores. The picture, not a guessed
 // brightness adjustment or a styling bonus, is the correction.
 item.name=d.display_name;
 item.appearance_description=d.visual_description;
 item.appearance_source={revision:d.revision,photo_sha256:d.source.sha256,source_path:d.source.path,method:d.registration.method};
 return p;
}
root.HEWRSShoePhotoCorrections=Object.freeze({apply,record,revision:'shoe-15-photo-2026-10-01'});
})(globalThis);
