#!/usr/bin/env node
'use strict';
/* Picker previews come from the actual registered V3 renderer, not a second
 * illustration. The original picker manifests and source assets are retained. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {load,selection,crop,digest,ROOT}=require('../tests/avatar-v3-fit-runtime.cjs');
const ids=['S06','S13','S14','B01','B06','B10','B08'];
async function main(){
 const h=load({entrypoint:'avatar-v3-issue22-baseline.html',extraModules:['data/issue22-materials.js','src/issue22-materials.js','src/issue22-b08.js']});
 const dna=JSON.parse(fs.readFileSync(path.join(ROOT,'data/issue22-garment-dna.json'),'utf8'));
 const records={},out=path.join(ROOT,'ui/issue22');fs.mkdirSync(out,{recursive:true});
 for(const id of ids){
  const selected=selection('DS001','NO_TIE',id),frame=await h.capture(selected),png=crop(h.canvas,[0,0,996,2748],360),sha=digest(png);
  const filename='ui/issue22/'+sha+'.png';fs.writeFileSync(path.join(ROOT,filename),png);
  const original=id[0]==='S'?JSON.parse(fs.readFileSync(path.join(ROOT,'data/suit-picker-images.json'),'utf8')).items[id]:JSON.parse(fs.readFileSync(path.join(ROOT,'data/blazer-picker-images.js'),'utf8').replace(/^.*?=/s,'').replace(/;\s*$/,'' )).items[id];
  assert.ok(original?.history_id,'Exact existing picker identity required: '+id);
  records[id]={src:filename,sha256:sha,width:360,height:993,label:dna.records[id]?.fields.description||original.label,
   history_id:original.history_id,source_kind:'native_avatar_preview',object_position:'50% 26%',
   source_note:id[0]==='S'?'Current photo-matched cloth':id==='B08'?'Continuous jacket rendering':'Natural linen · No Tie',
   issue22_revision:dna.revision,render_selection:selected,rgba_sha256:frame.rgba_sha256};
 }
 const data={schema:'hewrs.issue22.picker-previews.v1',source_lock:h.g.HEWRS_INPUT_SHA256,items:records,
  authority:'Exact native V3 renderer with Issue 22 material and seam modules; no new owner approval inferred.',
  source_modules:Object.fromEntries(['src/issue22-materials.js','data/issue22-materials.js','src/issue22-b08.js'].map(p=>[p,digest(fs.readFileSync(path.join(ROOT,p)))]))};
 fs.writeFileSync(path.join(ROOT,'data/issue22-picker-images.json'),JSON.stringify(data,null,2)+'\n');
 const js='/* Native current previews; original picker manifests remain preserved. */\n'+
  'globalThis.HEWRS_ISSUE22_PICKER_IMAGES='+JSON.stringify(data)+';\n'+
  '(function(root){for(const [name,kind] of [["HEWRS_SUIT_PICKER_IMAGES","S"],["HEWRS_BLAZER_PICKER_IMAGES","B"]]){const prior=root[name];if(!prior||prior.source_lock!==root.HEWRS_ISSUE22_PICKER_IMAGES.source_lock)throw Error("Issue 22 picker source mismatch");root[name]=Object.freeze({...prior,items:Object.freeze({...prior.items,...Object.fromEntries(Object.entries(root.HEWRS_ISSUE22_PICKER_IMAGES.items).filter(([id])=>id.startsWith(kind)))})});}})(globalThis);\n';
 fs.writeFileSync(path.join(ROOT,'data/issue22-picker-images.js'),js);
 console.log(JSON.stringify({status:'PASS',count:ids.length,ids,render:'actual V3 source geometry, exact current display registration'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
