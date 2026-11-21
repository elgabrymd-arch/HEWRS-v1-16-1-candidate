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
const SEAMS=JSON.parse(fs.readFileSync(path.join(__dirname,'issue19-collar-seam-fixtures.json'),'utf8'));
const SHOULDERS=JSON.parse(fs.readFileSync(path.join(__dirname,'issue19-shoulder-contour-fixtures.json'),'utf8'));
const JACKET_GAPS=JSON.parse(fs.readFileSync(path.join(__dirname,'issue19-jacket-gap-fixtures.json'),'utf8'));
const PARTIAL_TIES=JSON.parse(fs.readFileSync(path.join(__dirname,'issue19-partial-tie-backing-fixtures.json'),'utf8'));
const SHOULDER_EDGES=JSON.parse(fs.readFileSync(path.join(__dirname,'issue19-outer-shoulder-fixtures.json'),'utf8'));
const SHOULDER_POINTS=[...SHOULDERS.fixtures,...(SHOULDERS.antialias_fixtures||[]),...(SHOULDERS.enclosed_fixtures||[])];
const STRIPS=[[330,355,92,260],[575,355,91,260]],TOP_CENTER=[422,420,153,47],LOWER_CENTER=[422,530,153,85],CORRIDOR=[422,467,153,63],FACE=[422,0,153,420];
const NECK_CORNERS=[[422,401,19,19],[560,405,15,15]];
const BODY_CONTOURS=[[330,420,92,195],[575,420,91,195]];
const JACKET_LOWER_OPENING=[422,615,153,235];
const JACKET_OUTER_SHOULDERS=[[0,350,330,250],[666,350,330,250]];
const CASES=[
 ['DS034','NO_TIE','S05'],['DS034','T019','S05'],
 ['DS038','NO_TIE','S05'],['DS038','T047','S05'],
 ['DS013','T001','B03'],['DS040','NO_TIE','shirt-only'],
 ['DS026','T047','S05'],['DS026','T047','B03'],['DS035','T001','B15'],
 ['DS002','T001','B03'],['DS002','T001','S05'],['DS004','T019','B03'],['DS005','T047','shirt-only'],
 ['DS012','T001','B03'],['DS032','NO_TIE','S05'],['DS033','T017','shirt-only'],['DS046','NO_TIE','B03'],
 ...SEAMS.fixtures.map(row=>[row.shirt,row.state,row.mode]),
 ['DS027','T001','B03'],['DS038','T001','B03']
];
for(const shirt of ['DS027','DS048'])for(const state of ['NO_TIE','T001','T017','T047'])CASES.push([shirt,state,'S02']);
for(const shirt of ['DS027','DS048'])CASES.push([shirt,'T047','S18']);
for(const mode of ['S02','S05','B02','B03','B06','B15'])for(const state of ['NO_TIE','T001'])CASES.push(['DS013',state,mode]);
for(const state of ['T001','T047'])CASES.push(['DS037',state,'S02']);
for(const state of ['NO_TIE','T001'])CASES.push(['DS019',state,'B06']);
for(const row of SHOULDER_POINTS){
 const args=[row.shirt,row.state,row.mode];
 if(!CASES.some(item=>item.every((value,index)=>value===args[index])))CASES.push(args);
}
const plain=value=>JSON.parse(JSON.stringify(value));
const inside=(x,y,r)=>x>=r[0]&&x<r[0]+r[2]&&y>=r[1]&&y<r[1]+r[3];
const allowed=(x,y,tied,jacket)=>[...STRIPS,LOWER_CENTER,...(jacket?[JACKET_LOWER_OPENING,...JACKET_OUTER_SHOULDERS]:[]),...(tied?[TOP_CENTER,...NECK_CORNERS]:[])].some(r=>inside(x,y,r));
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
 assert.equal(spec.revision,'AVATAR_V3_ALL_SHIRT_COLLAR_FIT_6');
 assert.deepEqual(spec.modified_strips,STRIPS,'independent maximum collar envelopes');
 assert.deepEqual(spec.top_center_bounds,TOP_CENTER,'neckband cleanup remains below the approved chin and above the knot');
 assert.deepEqual(spec.protected_knot_corridor,CORRIDOR,'complete full tie knot corridor');
 assert.deepEqual(spec.lower_center_backing_bounds,LOWER_CENTER,'only the independently verified lower collar join may receive backing');
 assert.deepEqual(spec.tied_neck_corner_cleanup,NECK_CORNERS,'only the independently observed cloth-fragment slots may reveal original neck pixels');
 assert.deepEqual(spec.shirt_only_body_contour_bounds,BODY_CONTOURS,'original shoulder coverage stays inside the existing lateral correction strips');
 assert.deepEqual(spec.jacket_lower_opening_backing_bounds,JACKET_LOWER_OPENING,'interior backing ends at the independently observed original shirt V tip');
 assert.deepEqual(spec.jacket_outer_shoulder_bounds,JACKET_OUTER_SHOULDERS,'outer concealment is confined above the original pose boundary');
 assert.equal(spec.jacket_inner_shoulder_neck_distance,50,'the approved near-neck collar reveal remains protected');
 assert.deepEqual(spec.active_ids,[...after.connection.limits.shirt_ids].sort(),'all 50 active shirt identities');
 assert.equal(spec.active_ids.length,50);assert.equal(spec.active_ids.includes('DS049'),false);
 const input=fs.readFileSync(path.join(ROOT,'data/inputs.json'));
 const original=await before.capture(s),fitted=await after.capture(s);
 let tiePixels=null,avatarPixels=null,jacketPixels=null,tieProtected=0,partialTieBacked=0,lowerOpaqueProtected=0,neckAvatarPixels=0,neckRestored=0,outerJacketSourcePixels=0,opaqueJacketPixels=0;
 const imageFrom=descriptor=>new Promise((resolve,reject)=>{const im=new after.g.Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=after.resolveUrl(descriptor);});
 const avatar=await imageFrom(after.connection.manifest.static.avatar),av=after.makeCanvas(),ac=av.getContext('2d');
 ac.drawImage(avatar,0,0);avatarPixels=ac.getImageData(0,0,W,H).data;av.width=av.height=1;
 if(!s.shirtOnly){
  const descriptor=Array.isArray(fitted.plan)?after.connection.assemblies.forSelection(s.suitId,s.shoeId,s.shirtId).static.jacket:fitted.plan.jacket;
  assert.ok(descriptor,'original selected jacket descriptor');
  // The approved V3 B15 registration is part of the unchanged baseline.
  // Decode through that protected loader instead of comparing its unregistered photo.
  const baselineLoader=before.g.HEWRSRenderImageLoader.create({resolveUrl:before.resolveUrl,width:W,height:H,limit:2});
  const c=after.makeCanvas(),ctx=c.getContext('2d');ctx.drawImage(await baselineLoader.load(descriptor),0,0);
  if(descriptor.display_alpha_mask){ctx.globalCompositeOperation='destination-in';ctx.drawImage(await imageFrom(descriptor.display_alpha_mask),0,0);}
  jacketPixels=ctx.getImageData(0,0,W,H).data;c.width=c.height=1;
 }
 if(s.state!=='NO_TIE'){
  let descriptor=null;
  const find=value=>{if(!value||typeof value!=='object')return;
   if(value.avatar_v3_tie_fit)descriptor=value;
   for(const key of Object.keys(value))if(value[key]&&typeof value[key]==='object')find(value[key]);};
  find(fitted.plan);assert.ok(descriptor,'actual selected tie projection descriptor');
  const image=await imageFrom(descriptor);
  const mask=after.makeCanvas(),ctx=mask.getContext('2d');
  // Independently reconstruct the documented unscaled knot/body mapping.
  ctx.drawImage(image,0,0,W,530,0,0,W,530);
  ctx.drawImage(image,0,530,W,658,0,530,W,descriptor.avatar_v3_tie_fit.target_end-530);
  tiePixels=ctx.getImageData(0,0,W,H).data;mask.width=mask.height=1;
 }
 const seamSamples=SEAMS.fixtures.filter(row=>row.shirt===args[0]&&row.state===args[1]&&row.mode===args[2]).map(row=>{
  const [x,y]=row.xy,rgba=Array.from(fitted.rgba.subarray((y*W+x)*4,(y*W+x)*4+4));
  assert.ok(rgba[3]>=SEAMS.minimum_alpha,'independently identified collar seam remains closed: '+args.join('/')+' at '+row.xy+' has '+rgba);
  return {xy:row.xy,rgba,minimum_alpha:SEAMS.minimum_alpha};
 });
 const shoulderSamples=SHOULDER_POINTS.filter(row=>row.shirt===s.shirtId&&s.shirtOnly&&
  (row.state==='NO_TIE')===(s.state==='NO_TIE')).map(row=>{
  const [x,y]=row.xy,i=(y*W+x)*4,rgba=Array.from(fitted.rgba.subarray(i,i+4));
  if(row.requires_original_opaque_body!==false)assert.equal(original.rgba[i+3],row.expected_alpha,'approved baseline owns opaque original BODY at '+row.xy);
  assert.equal(rgba[3],row.expected_alpha,'original shoulder BODY coverage is retained at '+s.shirtId+'/'+s.state+'/'+row.xy);
  if(row.expected_rendered_rgba)assert.deepEqual(rgba,row.expected_rendered_rgba,'DS003 anchors retain exact original BODY color');
  assert.ok(expectedSources(after,s,fitted.plan).includes(row.body_source_sha256),'shoulder fixture binds the selected original BODY source');
  let patchPixels=0;
  if(row.region_3x3){const [rx,ry,rw,rh]=row.region_3x3.xywh;
   for(let yy=ry;yy<ry+rh;yy++)for(let xx=rx;xx<rx+rw;xx++){
    assert.equal(fitted.rgba[(yy*W+xx)*4+3],row.region_3x3.expected_alpha,'entire independently observed shoulder patch remains opaque');patchPixels++;
   }
  }
  return {xy:row.xy,rgba,body_source_sha256:row.body_source_sha256,patch_pixels:patchPixels};
 });
 const jacketGapSamples=JACKET_GAPS.fixtures.filter(row=>row.shirt===s.shirtId&&row.suit_ids.includes(s.suitId)).map(row=>{
  const [x,y]=row.xy,i=(y*W+x)*4,rgba=Array.from(fitted.rgba.subarray(i,i+4));
  assert.equal(rgba[3],row.expected_alpha,'complete independently audited jacket aperture is opaque at '+s.suitId+'/'+s.shirtId+'/'+s.state+'/'+row.xy);
  return {xy:row.xy,rgba,component_id:row.component_id,selected_projected_tie_alpha:tiePixels?.[i+3]||0};
 });
 const partialTieSamples=PARTIAL_TIES.fixtures.filter(row=>row.shirt===s.shirtId&&row.suit_ids.includes(s.suitId)&&s.state!=='NO_TIE').map(row=>{
  const [x,y]=row.xy,i=(y*W+x)*4,rgba=Array.from(fitted.rgba.subarray(i,i+4));
  assert.equal(rgba[3],row.expected_alpha,'independently observed partial-tie aperture is fully backed');
  assert.equal(tiePixels[i+3],row.observed_projected_tie_alpha,'fixed partial-tie source projection retains its registered geometry');
  return {xy:row.xy,rgba,selected_projected_tie_alpha:tiePixels[i+3]};
 });
 const matchingEdge=row=>row.shirt===s.shirtId&&row.mode===(s.suitId||s.blazerId)&&row.state_class===(s.state==='NO_TIE'?'no_tie':'tied');
 const shoulderEdgeSamples=SHOULDER_EDGES.concealment_points.filter(matchingEdge).map(row=>{
  const [x,y]=row.xy,i=(y*W+x)*4,rgba=Array.from(fitted.rgba.subarray(i,i+4));
  assert.deepEqual(rgba,Array.from(jacketPixels.subarray(i,i+4)),'independently observed shirt protrusion is replaced by the exact approved jacket edge');
  assert.equal(rgba[3],row.expected_alpha,'independent original jacket alpha is retained');return {xy:row.xy,rgba};
 });
 const retainedRevealSamples=SHOULDER_EDGES.retained_reveal_points.filter(matchingEdge).map(row=>{
  const [x,y]=row.xy,i=(y*W+x)*4,rgba=Array.from(fitted.rgba.subarray(i,i+4));
  assert.ok(rgba[3]>=row.minimum_alpha,'the intended near-neck collar reveal remains visible');
  assert.deepEqual(rgba,row.expected_pinned_native_rgba,'the independently inspected near-neck reveal stays exactly unchanged');return {xy:row.xy,rgba};
 });
 let exteriorControls=0,opaqueJacketControls=0;
 for(const row of JACKET_GAPS.negative_exterior_fixtures){if(row.shirt!==s.shirtId||!row.suit_ids.includes(s.suitId))continue;
  const [x,y]=row.xy,i=(y*W+x)*4;assert.deepEqual(Array.from(fitted.rgba.subarray(i,i+4)),row.expected_rgba,'true exterior remains transparent at '+row.xy);exteriorControls++;
 }
 for(const row of JACKET_GAPS.opaque_jacket_control_regions){if(row.shirt!==s.shirtId||!row.suit_ids.includes(s.suitId))continue;
  const [x,y,w,h]=row.xywh;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
   const i=(yy*W+xx)*4;assert.equal(original.rgba[i+3],255,'original jacket control is opaque');
   assert.deepEqual(fitted.rgba.subarray(i,i+4),original.rgba.subarray(i,i+4),'independently fixed original jacket region remains exact');opaqueJacketControls++;
  }
 }
 assert.deepEqual(plain(fitted.source_bindings),plain(original.source_bindings),'only collar display changes; every source descriptor stays exact');
 let changed=0,outside=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*4;
  const same=original.rgba[i]===fitted.rgba[i]&&original.rgba[i+1]===fitted.rgba[i+1]&&original.rgba[i+2]===fitted.rgba[i+2]&&original.rgba[i+3]===fitted.rgba[i+3];
  if(jacketPixels&&y>=350&&y<600){
   if(jacketPixels[i+3]===255){assert.ok(same,'every original opaque jacket shoulder pixel remains exact at '+x+','+y+' before '+Array.from(original.rgba.subarray(i,i+4))+' after '+Array.from(fitted.rgba.subarray(i,i+4))+' source '+Array.from(jacketPixels.subarray(i,i+4)));opaqueJacketPixels++;}
   if(!same&&JACKET_OUTER_SHOULDERS.some(r=>inside(x,y,r))){
    assert.equal(avatarPixels[i+3],0,'concealment does not touch any original avatar contribution');
    assert.equal(tiePixels?.[i+3]||0,0,'concealment does not touch any selected tie contribution');
    assert.ok(fitted.rgba[i+3]<original.rgba[i+3],'outer repair only removes excess shirt alpha above the original jacket');
    assert.deepEqual(Array.from(fitted.rgba.subarray(i,i+4)),Array.from(jacketPixels.subarray(i,i+4)),'every changed outer pixel is exactly the selected original effective jacket');outerJacketSourcePixels++;
   }
  }
  if((inside(x,y,LOWER_CENTER)||!s.shirtOnly&&inside(x,y,JACKET_LOWER_OPENING))&&original.rgba[i+3]===255){assert.ok(same,'lower shirt backing preserves every existing opaque pixel at '+x+','+y);lowerOpaqueProtected++;}
  if(tiePixels&&tiePixels[i+3]){
   if(!same){
    const fixture=[...jacketGapSamples,...partialTieSamples].find(row=>row.xy[0]===x&&row.xy[1]===y);
    assert.ok(fixture&&tiePixels[i+3]<255&&original.rgba[i+3]<255&&fitted.rgba[i+3]===255,
     'only an independently audited enclosed gap beneath a partial tie edge may receive backing at '+x+','+y);
    const alpha=original.rgba[i+3]/255;
    for(let k=0;k<3;k++)assert.ok(fitted.rgba[i+k]>=Math.round(original.rgba[i+k]*alpha)-1&&
     fitted.rgba[i+k]<=Math.round(original.rgba[i+k]*alpha+255*(1-alpha))+1,'original foreground contribution remains in front of the new shirt backing');
    partialTieBacked++;
   }else tieProtected++;
  }
  if(s.state!=='NO_TIE'&&avatarPixels&&NECK_CORNERS.some(r=>inside(x,y,r))){
   if(avatarPixels[i+3]===255){
    for(let k=0;k<4;k++)assert.equal(fitted.rgba[i+k],avatarPixels[i+k],'tied neck corner uses exact approved avatar at '+x+','+y);
    neckAvatarPixels++;if(!same)neckRestored++;
   }else assert.ok(same,'neck cleanup cannot change a nonopaque avatar edge');
  }
  if(same)continue;
  changed++;if(!allowed(x,y,s.state!=='NO_TIE',!s.shirtOnly))outside++;
 }
 assert.ok(changed>0,'selected collar correction is active');
 assert.equal(outside,0,'every pixel outside the independent collar registration and backing rectangles remains exact');
 const cropHash=(h,r)=>digest(Buffer.from(h.canvas.getContext('2d').getImageData(...r).data));
 const faceHash=h=>{
  const face=Buffer.from(h.canvas.getContext('2d').getImageData(...FACE).data);
  if(s.state!=='NO_TIE')for(const [x,y,w,height]of NECK_CORNERS)for(let yy=y;yy<y+height;yy++)for(let xx=x;xx<x+w;xx++)face.fill(0,(yy*FACE[2]+xx-FACE[0])*4,(yy*FACE[2]+xx-FACE[0])*4+4);
  return digest(face);
 };
 assert.equal(cropHash(before,CORRIDOR),cropHash(after,CORRIDOR),'final compiled tie knot and body remain byte-exact after collar correction');
 assert.equal(faceHash(before),faceHash(after),'approved central face and chin remain byte-exact outside exact source-restoration slots');
 const stats=plain(after.renderer.stats().collarFit),expected=plain(expectedSources(after,s,fitted.plan));
 assert.equal(stats.shirt_id,s.shirtId);assert.equal(stats.topwear_id,s.suitId||s.blazerId||null);
 assert.equal(stats.mode,s.state==='NO_TIE'?'no_tie':'tied');
 assert.deepEqual(stats.source_hashes,expected,'collar cloth comes only from the selected registered shirt');
 assert.deepEqual(stats.knot_anchor,[498,467]);
 assert.equal(stats.reveal_pixels,s.shirtOnly?null:7);
 assert.equal(stats.body_contour_source_sha256,expected[0],'body contour uses only the selected registered body');
 if(!s.shirtOnly)assert.equal(stats.restored_shirt_only_body_contour_pixels,0,'body restoration never affects a jacket route');
 if(!s.shirtOnly)assert.equal(stats.closed_shirt_only_interior_pixels,0,'final shoulder backing never affects a jacket route');
 if(s.shirtOnly)assert.equal(stats.jacket_interior_backing_pixels,0,'jacket aperture backing never affects shirt-only');
 if(s.shirtOnly)assert.equal(stats.concealed_outer_shoulder_pixels+stats.concealed_inner_shoulder_pixels,0,'jacket shoulder concealment never changes shirt-only');
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
  protected_knot_sha256:cropHash(after,CORRIDOR),protected_face_sha256:faceHash(after),source_hashes:expected,source_capture:stats.source_capture,
  stand_top_rows:stats.stand_top_rows,front_source_top_rows:stats.front_source_top_rows,
  runtime_sha256:after.metadata.runtime_sha256,seam_regressions:seamSamples,
  shoulder_contour_regressions:shoulderSamples,restored_body_contour_pixels:stats.restored_shirt_only_body_contour_pixels,
  jacket_gap_regressions:jacketGapSamples,jacket_interior_backing_pixels:stats.jacket_interior_backing_pixels,
  transparent_exterior_controls:exteriorControls,opaque_jacket_control_pixels:opaqueJacketControls,
  exact_original_jacket_outer_pixels:outerJacketSourcePixels,opaque_jacket_shoulder_pixels_preserved:opaqueJacketPixels,
  partial_tie_backing_regressions:partialTieSamples,shoulder_edge_regressions:shoulderEdgeSamples,retained_neck_reveal_regressions:retainedRevealSamples,
  selected_tie_pixels_preserved:tieProtected,independently_audited_partial_tie_edges_backed:partialTieBacked,lower_center_opaque_pixels_preserved:lowerOpaqueProtected,
  exact_avatar_neck_pixels:neckAvatarPixels,restored_avatar_neck_pixels:neckRestored}));
}
async function main(){
 if(process.argv[2]==='--list'){console.log(JSON.stringify(CASES));return;}
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
  cases:records.length,seam_regressions:records.reduce((total,row)=>total+row.seam_regressions.length,0),
  shoulder_contour_regressions:records.reduce((total,row)=>total+row.shoulder_contour_regressions.length,0),
  jacket_gap_regressions:records.reduce((total,row)=>total+row.jacket_gap_regressions.length,0),
  independent_strips:STRIPS,tied_neckband_bounds:TOP_CENTER,lower_center_backing_bounds:LOWER_CENTER,
  protected_face:FACE,exact_avatar_restoration_slots:NECK_CORNERS,protected_knot_corridor:CORRIDOR,records}));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
