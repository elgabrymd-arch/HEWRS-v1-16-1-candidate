#!/usr/bin/env node
/* Derive the six V3 review/discovery records without rewriting historical
 * catalogues, reviews, image packets or the immutable source wardrobe. */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {load,root}=require('../tests/issue22-loader.cjs'),{g,connection:c}=load({index:false});
const read=file=>JSON.parse(fs.readFileSync(root+'/'+file,'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const canonical=value=>JSON.stringify(value);
const baseline=read('feedback-candidate/reviewed/review-data.json'),semantic=read('feedback-candidate/reviewed/discovery-features.json');
const dna=read('data/issue22-garment-dna.json'),materials=read('data/issue22-materials.json');
const records={},features={},scope=new Set(dna.scope),noTie=new Set(dna.linen_no_tie_ids);
const interpretation={S06:{families:['grey'],value:'medium-dark',saturation:'low',distance:dna.records.S06.owner_correction.distance_reading},S13:{families:['blue','grey'],value:'dark',saturation:'low',distance:'fine, restrained interlocking check'},S14:{families:['blue','grey'],value:'medium',saturation:'low',distance:'near-solid fine weave'}};
for(const id of scope){
 const historical=baseline.catalogue.records.find(r=>r.id===id),feature=c.features.get(id),correction=dna.records[id];
 assert(historical&&feature,'Missing reviewed garment '+id);
 assert.equal(canonical(historical.source.feature),canonical(correction.historical_feature),'Historical reviewed DNA differs '+id);
 const row=structuredClone(historical),n=correction.interpretation,obs=row.visual_dna.observed;
 row.label=correction.fields.description;row.visual_label=row.label;
 row.source={...row.source,feature:structuredClone(feature),issue22:{revision:dna.revision,issue_url:dna.issue_url,historical_source_fingerprint:historical.source_fingerprint}};
 row.source.historical_binding=structuredClone(row.source.binding);
 for(const layer of row.category==='suit'?['jacket','trousers']:['jacket']){
  const material=Object.values(materials.bindings).find(b=>b.garment_id===id&&b.layer===layer);
  assert(material,'Missing corrected review image '+id+'/'+layer);
  assert.equal(hash(fs.readFileSync(root+'/'+material.display_url)),material.display_sha256);
  const descriptor={sha256:material.display_sha256,url:material.display_url,rect:material.rect,source_sha256:material.source_sha256,issue22_revision:materials.revision};
  if(row.category==='suit')row.source.binding[layer]=descriptor;
  else row.source.binding.checkpoint_layer=descriptor;
 }
 row.visual_dna={...row.visual_dna,revision:dna.revision,label:row.label,status:'issue22_effective_garment_facts',
  evidence:{...row.visual_dna.evidence,issue22:{issue_url:dna.issue_url,authority:correction.authority,photographs:correction.photographs.map(path=>({repository_path:path,sha256:hash(fs.readFileSync(root+'/'+path))})),material_revision:materials.revision,...(correction.owner_correction?.approved_material_reference?{approved_material_reference:structuredClone(correction.owner_correction.approved_material_reference)}:{}),whole_outfit_review_added:false}},
  observed:obs,reconciliation_note:'Issue #22 supersedes only the scoped colour, pattern and fabric facts. Original construction and historical evidence remain preserved. No whole-outfit approval is added.',
  issue22_revision:dna.revision};
 if(interpretation[id]){
  const v=interpretation[id];
  Object.assign(obs.colour,{dominant:feature.primary_text,temperature:n.temperature,relative_value:v.value,relative_saturation:v.saturation});
  Object.assign(obs.pattern,{close_reading:feature.pattern_text,distance_reading:v.distance,relative_contrast:id==='S14'?'very low':'low',measured_repeat_mm:null});
 }
 obs.surface.visible_texture=feature.texture_text;
 if(noTie.has(id)){
  obs.surface.fibre_composition=feature.fibre_composition;row.no_tie_only=true;row.fabric_family='linen';
  row.visual_dna.restrictions_added=[...row.visual_dna.restrictions_added,'NO TIE in every style and occasion (explicit Issue #22 owner instruction)'];
 }
 row.source_fingerprint=hash(canonical({historical_source_fingerprint:historical.source_fingerprint,revision:dna.revision,source:row.source,visual_dna:row.visual_dna}));
 records[id]=row;
 const old=semantic.records.find(r=>r.id===id),sf={...old,source_fingerprint:row.source_fingerprint,label:row.label,encoding_revision:dna.revision,encoding_basis:n.basis,provenance_paths:[...old.provenance_paths,'source.issue22'],issue22_revision:dna.revision};
 if(interpretation[id])Object.assign(sf,{dominant_text:feature.primary_text,dominant_families:interpretation[id].families,value_ordinal:n.value,pattern_family:n.pattern.family==='grid'?'check':'weave',pattern_contrast:n.pattern.contrast/5,pattern_scale:n.pattern.scale/5,surface_sheen:0,surface_texture:0.6,pattern_quiet:true});
 if(noTie.has(id))Object.assign(sf,{no_tie_only:true,fabric_family:'linen',surface_sheen:0,surface_texture:0.6});
 features[id]=sf;
}
const currentCatalogue={...baseline.catalogue,revision:dna.revision,parent_fingerprint:baseline.catalogue.fingerprint,records:baseline.catalogue.records.map(row=>records[row.id]||row)};
delete currentCatalogue.fingerprint;const fingerprint=hash(canonical(currentCatalogue));
const overlay={schema:'hewrs.issue22.reviewed-overlay.v1',revision:dna.revision,scope:[...scope],
 baseline_catalogue_fingerprint:baseline.catalogue.fingerprint,catalogue_fingerprint:fingerprint,
 review_data_sha256:hash(canonical(baseline)),discovery_features_sha256:hash(canonical(semantic)),
 records,features,assetPaths:materials.assetPaths,materials_revision:materials.revision,
 historical_review_ids:baseline.reviews.entries.filter(e=>scope.has(e.outfit.topwear)).map(e=>e.id),
 preservation:{historical_files:'unchanged',browser_storage_writes:0,unrelated_catalogue_records:baseline.catalogue.records.length-scope.size,unrelated_reviews:baseline.reviews.entries.filter(e=>!scope.has(e.outfit.topwear)).length}};
for(const [name,text]of [['data/issue22-reviewed-overlay.json',JSON.stringify(overlay,null,2)+'\n'],['data/issue22-reviewed-overlay.js','globalThis.HEWRS_ISSUE22_REVIEWED_OVERLAY='+JSON.stringify(overlay)+';\n']]){
 if(process.argv.includes('--check'))assert.equal(fs.readFileSync(root+'/'+name,'utf8'),text,name+' is stale');else fs.writeFileSync(root+'/'+name,text);
}
console.log('ISSUE22_REVIEWED_DATA='+JSON.stringify({catalogue_fingerprint:fingerprint,changed_records:scope.size,historical_reviews:overlay.historical_review_ids.length,...overlay.preservation}));
