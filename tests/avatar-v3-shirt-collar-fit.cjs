#!/usr/bin/env node
'use strict';
/* Isolate the actual compiled collar wrapper from the actual compiled tie,
 * cuff, pose and garment renderers. Each pair runs in a fresh process to bound
 * native image caches. This is a geometry/source regression gate, not visual
 * approval; the independent browser matrix covers all 50 shirts and routes.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {load,selection,digest,ROOT,WIDTH:W,HEIGHT:H}=require('./avatar-v3-fit-runtime.cjs');
const MODULE='src/avatar-v3-shirt-collar-fit.js';
const STRIPS=[[330,355,92,260],[575,355,91,260]],TOP_CENTER=[422,420,153,47],CORRIDOR=[422,467,153,148],FACE=[422,0,153,420];
const CASES=[
 ['DS034','NO_TIE','S05'],['DS034','T019','S05'],
 ['DS038','NO_TIE','S05'],['DS038','T047','S05'],
 ['DS013','T001','B03'],['DS040','NO_TIE','shirt-only'],
 ['DS026','T047','S05'],['DS026','T047','B03'],['DS035','T001','B15'],
 ['DS002','T001','B03'],['DS002','T001','S05'],['DS004','T019','B03'],['DS005','T047','shirt-only'],
 ['DS012','T001','B03'],['DS032','NO_TIE','S05'],['DS033','T017','shirt-only'],['DS046','NO_TIE','B03']
];
const plain=value=>JSON.parse(JSON.stringify(value));
const allowed=(x,y,tied)=>[...STRIPS,...(tied?[TOP_CENTER]:[])].some(([a,b,w,h])=>x>=a&&x<a+w&&y>=b&&y<b+h);
function expectedSources(h,s,p){
 if(h.connection.continuousShirts.ids.includes(s.shirtId))return [p.garment.body.source.sha256];
 if(Array.isArray(p)){
  const row=h.connection.assemblies.forSelection(s.suitId,s.shoeId,s.shirtId).shirts[s.shirtId].states[s.state==='NO_TIE'?'no_tie':'tied'];
  return [row.body,row.left,row.right].filter(Boolean).map(d=>d.sha256);
 }
 return [p.body,...(p.leaves||[])].filter(Boolean).map(d=>d.sha256);
}
async function single(index){
 const args=CASES[index];assert.ok(args,'known fixture');const s=selection(...args);
 const before=load({omitFitModules:[MODULE]}),after=load();
 assert.equal(before.metadata.kind,'EXPLICIT_SOURCE_OVERLAY_DIAGNOSTIC');
 assert.equal(after.metadata.kind,'EXACT_SHIPPED_RUNTIME_PREFIX');
 assert.equal(before.metadata.runtime_sha256,after.metadata.runtime_sha256,'same current compiled runtime');
 const spec=plain(after.g.HEWRSAvatarV3ShirtCollarFit.spec);
 assert.equal(spec.revision,'AVATAR_V3_ALL_SHIRT_COLLAR_FIT_2');
 assert.deepEqual(spec.modified_strips,STRIPS,'independent maximum collar envelopes');
 assert.deepEqual(spec.top_center_bounds,TOP_CENTER,'neckband cleanup remains below the approved chin and above the knot');
 assert.deepEqual(spec.protected_knot_corridor,CORRIDOR,'complete full tie knot corridor');
 assert.deepEqual(spec.active_ids,[...after.connection.limits.shirt_ids].sort(),'all 50 active shirt identities');
 assert.equal(spec.active_ids.length,50);assert.equal(spec.active_ids.includes('DS049'),false);
 const input=fs.readFileSync(path.join(ROOT,'data/inputs.json'));
 const original=await before.capture(s),fitted=await after.capture(s);
 assert.deepEqual(plain(fitted.source_bindings),plain(original.source_bindings),'only collar display changes; every source descriptor stays exact');
 let changed=0,outside=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*4;
  if(original.rgba[i]===fitted.rgba[i]&&original.rgba[i+1]===fitted.rgba[i+1]&&original.rgba[i+2]===fitted.rgba[i+2]&&original.rgba[i+3]===fitted.rgba[i+3])continue;
  changed++;if(!allowed(x,y,s.state!=='NO_TIE'))outside++;
 }
 assert.ok(changed>0,'selected collar correction is active');
 assert.equal(outside,0,'every pixel outside the independent lateral strips and tied neckband remains exact');
 const cropHash=(h,r)=>digest(Buffer.from(h.canvas.getContext('2d').getImageData(...r).data));
 assert.equal(cropHash(before,CORRIDOR),cropHash(after,CORRIDOR),'final compiled tie knot and body remain byte-exact after collar correction');
 assert.equal(cropHash(before,FACE),cropHash(after,FACE),'approved central face and chin above row420 remain byte-exact');
 const stats=plain(after.renderer.stats().collarFit),expected=plain(expectedSources(after,s,fitted.plan));
 assert.equal(stats.shirt_id,s.shirtId);assert.equal(stats.topwear_id,s.suitId||s.blazerId||null);
 assert.equal(stats.mode,s.state==='NO_TIE'?'no_tie':'tied');
 assert.deepEqual(stats.source_hashes,expected,'collar cloth comes only from the selected registered shirt');
 assert.deepEqual(stats.knot_anchor,[498,467]);
 assert.equal(stats.reveal_pixels,s.shirtOnly?null:7);
 assert.equal(stats.source_capture,after.connection.continuousShirts.ids.includes(s.shirtId)?
  'raw_registered_body_before_avatar_tie_jacket':'isolated_registered_native_body_and_leaves',
  'continuous collars are captured before avatar/tie/jacket contamination');
 for(const sha of expected){
  const filename=after.connection.assetPaths[sha];assert.ok(filename,'registered source path');
  assert.equal(digest(fs.readFileSync(path.join(ROOT,filename))),sha,'selected source bytes retain their original hash');
 }
 assert.deepEqual(fs.readFileSync(path.join(ROOT,'data/inputs.json')),input,'input bindings remain byte-exact');
 assert.deepEqual(after.storage.snapshot(),[],'native rendering never changes saved records');
 if(index===0){
  const committed=fitted.rgba_sha256,last=JSON.stringify(after.renderer.last());
  await assert.rejects(after.renderer.render(selection('DS049','NO_TIE','S05')),/registered|source|shirt|Unknown/i);
  assert.equal(digest(Buffer.from(after.canvas.getContext('2d').getImageData(0,0,W,H).data)),committed,'invalid selection retains the previous complete image');
  assert.equal(JSON.stringify(after.renderer.last()),last,'invalid selection retains the previous exact selection');
  const pending=after.renderer.render(selection('DS035','T047','B15'));after.renderer.cancel();
  assert.equal((await pending).cancelled,true,'cancelled collar preparation does not commit');
  assert.equal(digest(Buffer.from(after.canvas.getContext('2d').getImageData(0,0,W,H).data)),committed,'cancelled correction retains complete previous pixels');
 }
 console.log('COLLAR_CASE='+JSON.stringify({selection:s,changed_pixels:changed,outside_strip_changes:outside,
  protected_knot_sha256:cropHash(after,CORRIDOR),protected_face_sha256:cropHash(after,FACE),source_hashes:expected,source_capture:stats.source_capture,
  stand_top_rows:stats.stand_top_rows,front_source_top_rows:stats.front_source_top_rows,
  runtime_sha256:after.metadata.runtime_sha256}));
}
async function main(){
 if(process.argv[2]==='--case'){await single(Number(process.argv[3]));return;}
 const records=[];
 for(let i=0;i<CASES.length;i++){
  const result=spawnSync(process.execPath,['--expose-gc',__filename,'--case',String(i)],
   {cwd:ROOT,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
  assert.equal(result.status,0,'compiled collar fixture '+CASES[i].join('/')+' failed: '+(result.stderr||result.stdout||result.error));
  const line=result.stdout.split('\n').find(value=>value.startsWith('COLLAR_CASE='));assert.ok(line,'fixture evidence');
  records.push(JSON.parse(line.slice('COLLAR_CASE='.length)));
 }
 console.log('AVATAR_V3_SHIRT_COLLAR_FIT='+JSON.stringify({status:'PASS_COMPILED_COLLAR_SCOPE_AND_SOURCES_NOT_VISUAL_APPROVAL',
  cases:records.length,independent_strips:STRIPS,tied_neckband_bounds:TOP_CENTER,protected_face:FACE,protected_knot_corridor:CORRIDOR,records}));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
