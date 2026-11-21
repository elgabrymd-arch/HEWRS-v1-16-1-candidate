#!/usr/bin/env node
'use strict';
/* Contract and compositing tests. The tiny generated color fixture verifies
 * source projection and annotation masking; it is never visual acceptance of
 * a garment. Real full-outfit review uses the separately registered photos. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
let native;
try{native=require('@napi-rs/canvas');}catch(_){native=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','@napi-rs/canvas'));}
const {createCanvas,Image,ImageData}=native;
const loaded=require('./tie-engine-loader.cjs').load(),g=loaded.g,baseline=loaded.connection;
const collect=()=>{if(global.gc)global.gc();};
const trace=stage=>{if(process.env.HEWRS_CONTINUOUS_TRACE)console.log(JSON.stringify({stage,rss_mb:Math.round(process.memoryUsage().rss/1048576)}));};
trace('source-engine-loaded');
function hash(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function makeCanvas(w=996,h=2748){const c=createCanvas(w,h);c.dataset={};c.style={};return c;}
function pixels(c){return Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);}
function pixel(c,x,y){return [...c.getContext('2d').getImageData(x,y,1,1).data];}
function fixture(color,ink){const c=makeCanvas(8,8),ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,8,8);if(ink){ctx.fillStyle='#b4b4b4';ctx.fillRect(4,0,4,4);ctx.fillStyle='#000';ctx.fillRect(3,3,1,1);ctx.fillRect(6,1,1,1);}return c.toBuffer('image/png');}
const photoBytes=fixture('#eeeeee',true),repairBytes=fixture('#e01923',false),photoHash=hash(photoBytes),repairHash=hash(repairBytes);
const photo={sha256:photoHash,url:'continuous-test/'+photoHash+'.png',rect:[0,0,8,8]},repair={sha256:repairHash,url:'continuous-test/'+repairHash+'.png',rect:[0,0,8,8]};
const gradientColor=(x,y)=>[90+2*x+3*y,120+x+2*y,140+2*x+y,255];
function gradientFixture(generated){
 const c=makeCanvas(16,16),ctx=c.getContext('2d'),im=ctx.createImageData(16,16);
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const rgba=generated?[170+3*x+y,160+2*x+y,150+x+2*y,255]:gradientColor(x,y);
  if(!generated&&x===6&&y===6)rgba.splice(0,3,0,0,0);
  if(!generated&&x===8&&y===7)rgba.splice(0,3,255,255,255);
  if(generated&&x===10&&y===8)rgba[0]+=7;
  im.data.set(rgba,(y*16+x)*4);
 }
 ctx.putImageData(im,0,0);return c.toBuffer('image/png');
}
const gradientBytes=gradientFixture(false),gradientRepairBytes=gradientFixture(true),gradientHash=hash(gradientBytes),gradientRepairHash=hash(gradientRepairBytes);
const gradientPhoto={sha256:gradientHash,url:'continuous-test/'+gradientHash+'.png',rect:[0,0,16,16]},gradientRepair={sha256:gradientRepairHash,url:'continuous-test/'+gradientRepairHash+'.png',rect:[0,0,16,16]};
const gradientBody={type:'mesh',source:gradientPhoto,vertices:[[0,0,480,670],[16,0,496,670],[16,16,496,686],[0,16,480,686]],triangles:[[0,1,2],[0,2,3]],contours:[[[480,670],[496,670],[496,686],[480,686]]],source_patches:[{source:gradientRepair,source_rect:[2,2,12,12],destination_rect:[2,2,12,12],boundary_blend:true}]};
const body={type:'mesh',source:photo,vertices:[[0,0,490,650],[8,0,498,650],[8,8,498,658],[0,8,490,658]],triangles:[[0,1,2],[0,2,3]],contours:[[[490,650],[498,650],[498,658],[490,658]]],source_patches:[{source:repair,source_rect:[0,0,2,4],destination_rect:[2,2,2,4],ink_mask:{threshold:210,softness:35,dilate:0}},{source:repair,source_rect:[0,0,2,2],destination_rect:[0,0,2,2],feather:1},{source:repair,source_rect:[4,0,4,4],destination_rect:[4,0,4,4],ink_mask:{threshold:210,softness:35,dilate:0,color_match_radius:3,local_background_radius:2}}]};
const front={...body,contours:[[[490,650],[494,650],[494,654],[490,654]]]};
const IDS=['DS001','DS014','DS017','DS023','DS034','DS035','DS036','DS051'];
const data={schema:'hewrs.continuous-shirts.v1',revision:'TEST_FIXTURE_ONLY',source_input_sha256:g.HEWRS_INPUT_SHA256,canvas:[996,2748],ids:IDS,assetPaths:{[photoHash]:photo.url,[repairHash]:repair.url},shirts:Object.fromEntries(IDS.map(id=>[id,{id,history_id:'shirt-'+id,modes:{no_tie:{body,rear:null,front_collar:null,cuffs:[]},tied:{body,rear:null,front_collar:front,cuffs:[]}}}]))};
const outsideCollar={...gradientBody,vertices:[[0,0,478,670],[16,0,494,670],[16,16,494,686],[0,16,478,686]],contours:[[[478,670],[480,670],[480,686],[478,686]]]};
Object.assign(data.assetPaths,{[gradientHash]:gradientPhoto.url,[gradientRepairHash]:gradientRepair.url});data.shirts.DS034.modes.no_tie={body:gradientBody,rear:null,front_collar:outsideCollar,cuffs:[]};
const inputBefore=hash(JSON.stringify(g.HEWRS_INPUTS));
g.Image=Image;g.ImageData=ImageData;g.document={createElement(tag){assert.equal(tag,'canvas');return makeCanvas();}};
g.HEWRS_CONTINUOUS_SHIRTS=data;const inherited=g.HEWRSAtomicRenderer;
vm.runInContext(fs.readFileSync(path.join(ROOT,'src/continuous-shirts.js'),'utf8'),g,{filename:'src/continuous-shirts.js'});
const contract=g.HEWRSContinuousShirts.contract;
let assertions=0;
function rejects(change,pattern){const d=structuredClone(data);change(d);assert.throws(()=>contract(d,baseline),pattern);assertions++;}
rejects(d=>{d.source_input_sha256='0'.repeat(64);},/source lock differs/);
rejects(d=>{d.assetPaths[g.HEWRSContinuousShirts.avatarSource]='another-image.png';},/asset remapping/);
rejects(d=>{d.shirts.DS035.history_id='shirt-DS023';},/identity differs/);
rejects(d=>{d.shirts.DS035.modes.no_tie.body.vertices[2][3]=649;},/folded|mirrored/);
rejects(d=>{d.shirts.DS035.modes.no_tie.body.vertices[2][0]=8;d.shirts.DS035.modes.no_tie.body.vertices[2][1]=0;},/degenerate source/);
rejects(d=>{d.shirts.DS035.modes.no_tie.body.source_patches[0].destination_rect=[7,7,2,2];},/outside its image/);
rejects(d=>{d.shirts.DS035.modes.no_tie.body.source_patches[0].source_rect=[7,7,2,2];},/outside its image/);
rejects(d=>{d.shirts.DS035.modes.no_tie.body.source_patches[0].ink_mask.softness=0;},/annotation mask/);
rejects(d=>{d.shirts.DS035.modes.no_tie.body.source_patches[1].feather=0;},/patch feather/);
rejects(d=>{d.shirts.DS035.modes.no_tie.body.source_patches[2].ink_mask.color_match_radius=0;},/color-match radius/);
rejects(d=>{d.shirts.DS035.modes.no_tie.body.source_patches[2].ink_mask.local_background_radius=0;},/local-background radius/);
rejects(d=>{d.shirts.DS034.modes.no_tie.body.source_patches[0].feather=1;},/conflicting boundary blend/);
rejects(d=>{d.shirts.DS034.modes.no_tie.body.source_patches[0].ink_mask={threshold:210,softness:35};},/conflicting boundary blend/);
rejects(d=>{d.shirts.DS034.modes.no_tie.body.source_patches[0].boundary_blend=false;},/boundary blend/);
rejects(d=>{d.shirts.DS035.modes.no_tie.body.clip_rect=[0,2700,996,60];},/outside its image/);
rejects(d=>{d.shirts.DS035.modes.tied.front_collar=null;},/front-collar/);
const alteredAvatar={...baseline,manifest:{...baseline.manifest,static:{...baseline.manifest.static,avatar:{...baseline.manifest.static.avatar,sha256:'0'.repeat(64)}}}};
assert.throws(()=>contract(data,alteredAvatar),/avatar source differs/);assertions++;
// Reuse the already constructed scoring engine: these tests concern the new
// contract/renderer. Full-source integration separately exercises create().
function connection(d=data){return Object.freeze({...baseline,continuousShirts:contract(d,baseline),assetPaths:Object.freeze({...baseline.assetPaths,...d.assetPaths})});}
const c=connection();
function resolveUrl(d){const fixture={[photoHash]:photoBytes,[repairHash]:repairBytes,[gradientHash]:gradientBytes,[gradientRepairHash]:gradientRepairBytes}[d.sha256];if(fixture)return 'data:image/png;base64,'+fixture.toString('base64');return path.join(ROOT,c.assetPaths[d.sha256]||d.url);}
const visible=makeCanvas(),renderer=g.HEWRSAtomicRenderer.create(visible,c,{resolveUrl});
const selection=(mode='shirt-only',state='NO_TIE',shirtId='DS035')=>({shirtId,state,shoeId:'shoe-8',watchId:null,...(mode==='shirt-only'?{shirtOnly:true,pantId:'PG002'}:mode[0]==='B'?{blazerId:mode,pantId:'PG002'}:{suitId:mode})});
async function main(){
 trace('contracts-checked');const opening=selection();await renderer.render(opening);trace('first-frame');
 assert.deepEqual(pixel(visible,493,653),[224,25,35,255],'dark ink receives generated repair');
 assert.deepEqual(pixel(visible,492,652),[238,238,238,255],'bright cloth inside patch remains original');
 assert.deepEqual(pixel(visible,497,657),[238,238,238,255],'pixels outside source patch remain original');
 const softened=pixel(visible,490,650);assert.ok(softened[0]>224&&softened[0]<238&&softened[1]>25&&softened[1]<238&&softened[2]>35&&softened[2]<238&&softened[3]===255,'source feather blends only inside the rectangle border');assertions+=4;
 assert.deepEqual(pixel(visible,496,651),[180,180,180,255],'local annotation contrast permits repair to match shadowed original cloth');
 assert.deepEqual(pixel(visible,494,650),[180,180,180,255],'shadowed cloth is a clean color sample, not treated as ink');assertions+=2;
 const outsideBefore=pixel(visible,479,674),blendStart=performance.now();await renderer.render(selection('shirt-only','NO_TIE','DS034'));const boundaryRenderMs=Math.round(performance.now()-blendStart);
 assert.deepEqual(pixel(visible,486,676),gradientColor(6,6),'harmonic repair removes dark interior lettering');
 assert.deepEqual(pixel(visible,488,677),gradientColor(8,7),'harmonic repair removes bright embossed remnants');
 const texture=gradientColor(10,8);texture[0]+=7;assert.deepEqual(pixel(visible,490,678),texture,'generated interior texture survives boundary color matching');
 for(let n=2;n<14;n++)for(const [x,y]of [[n,2],[n,13],[2,n],[13,n]])assert.deepEqual(pixel(visible,480+x,670+y),gradientColor(x,y),'repair border matches exact original linear gradient');
 assert.deepEqual(pixel(visible,480,670),gradientColor(0,0),'full-rectangle repair leaves outside source pixels unchanged');assertions+=5;
 assert.deepEqual(pixel(visible,479,674),outsideBefore,'front collar cannot resurrect discarded pixels outside the physical body contour');assertions++;
 const avatarCanvas=makeCanvas(),avatarImage=new Image();await new Promise((resolve,reject)=>{avatarImage.onload=resolve;avatarImage.onerror=reject;avatarImage.src=resolveUrl(c.manifest.static.avatar);});avatarCanvas.getContext('2d').drawImage(avatarImage,0,0);
 assert.equal(hash(Buffer.from(visible.getContext('2d').getImageData(0,0,996,350).data)),hash(Buffer.from(avatarCanvas.getContext('2d').getImageData(0,0,996,350).data)),'visible avatar head stays exact');assertions++;
 const tied=selection('shirt-only','T001');await renderer.render(tied);const cached=renderer.stats();await renderer.render(selection('shirt-only','T017'));
 assert.equal(renderer.stats().continuousWarpRenders,cached.continuousWarpRenders,'tie changes reuse mesh raster');
 assert.equal(renderer.stats().continuousSurfaceRenders,cached.continuousSurfaceRenders,'tie changes reuse clipped surfaces');assertions+=2;
 collect();trace('tie-cache-checked');
 let tiePlans=0;for(const id of IDS)for(let n=1;n<=47;n++){
  const s=selection('shirt-only','T'+String(n).padStart(3,'0'),id),p=renderer.plan(s);
  assert.equal(p.tie.sha256,c.tieFidelity.replace(c.batch10.ties[s.state]).sha256);assert.equal(p.garment,c.continuousShirts.shirts[id].modes.tied);tiePlans++;
 }
 const modes=['shirt-only','B03','B02','S05',c.assemblies.widerTemplateSuitIds[0]];let cleanFrames=0;
 for(const mode of modes)for(const state of ['NO_TIE','T047']){
  const s=selection(mode,state),plan=renderer.plan(s),result=await renderer.render(s);
  assert.equal(result.status,'ready');assert.equal(result.source_result.legacy_shirt_layers_used,false);assert.equal(plan.avatar.sha256,g.HEWRSContinuousShirts.avatarSource);assert.equal(plan.ownership,undefined);
  if(mode==='B03')assert.equal(plan.jacket.sha256,c.blazerConnection.knownBlazer('B03').checkpoint_layer.sha256);
  if(state==='NO_TIE')assert.equal(plan.tie,null);cleanFrames++;collect();trace(mode+'/'+state);
 }
 const beforeRapid=hash(pixels(visible)),first=renderer.render(selection('B03','T001')),second=renderer.render(selection('B03','T047'));
 assert.equal(hash(pixels(visible)),beforeRapid,'no incomplete pending frame is committed');
 const [old,newest]=await Promise.all([first,second]);assert.equal(old.cancelled,true);assert.equal(newest.status,'ready');assert.equal(renderer.last().state,'T047');assert.equal(visible.dataset.state,'T047');assertions+=5;
 collect();trace('rapid-selection-checked');
 const retained=hash(pixels(visible));await assert.rejects(renderer.render(selection('B03','T999')));assert.equal(hash(pixels(visible)),retained,'invalid selection retains the complete preceding frame');assertions++;
 const control=selection('shirt-only','NO_TIE','DS005'),legacyCanvas=makeCanvas(),legacy=inherited.create(legacyCanvas,c,{resolveUrl});await legacy.render(control);await renderer.render(control);assert.equal(hash(pixels(visible)),hash(pixels(legacyCanvas)),'unaffected selection remains pixel-identical');assertions++;
 legacyCanvas.width=legacyCanvas.height=1;collect();trace('delegation-checked');
 const wide=structuredClone(data),wideBody={type:'mesh',source:photo,vertices:[[0,0,0,400],[8,0,996,400],[8,8,996,1420],[0,8,0,1420]],triangles:[[0,1,2],[0,2,3]],contours:[[[0,400],[996,400],[996,1420],[0,1420]]]},cuff={...wideBody,clip_rect:[0,1320,996,85]};
 wide.shirts.DS035.modes.no_tie={body:wideBody,rear:null,front_collar:null,cuffs:[cuff]};
 wide.jacket_masks=JSON.parse(fs.readFileSync(path.join(ROOT,'provenance/continuous-shirt-sources/coordinates/jacket-masks.json'),'utf8'));
 const rear={type:'mesh',source:photo,vertices:[[0,0,480,190],[8,0,630,190],[8,8,630,445],[0,8,480,445]],triangles:[[0,1,2],[0,2,3]],contours:[[[480,190],[500,190],[500,210],[480,210]],[[615,400],[630,400],[630,445],[615,445]]]};
 wide.shirts.DS035.jacket_rear={B03:{no_tie:rear,tied:{...rear,source_patches:body.source_patches}}};
 const wc=connection(wide),wv=makeCanvas(),wr=g.HEWRSAtomicRenderer.create(wv,wc,{resolveUrl});await wr.render(selection('B03'));
 assert.equal(pixel(wv,225,1000)[3],0,'left arm/torso background gap remains transparent');
 assert.equal(pixel(wv,784,1000)[3],0,'right arm/torso background gap remains transparent');
 assert.equal(pixel(wv,625,430)[3],255,'connected inner lapel fringe has continuous shirt support');
 for(const [x,y]of [[490,907],[476,980],[480,1000],[475,1030]])assert.equal(pixel(wv,x,y)[3],255,'off-center button aperture and its translucent tip retain shirt support');assertions+=4;
 const ji=new Image();await new Promise((resolve,reject)=>{ji.onload=resolve;ji.onerror=reject;ji.src=resolveUrl(wc.blazerConnection.knownBlazer('B03').checkpoint_layer);});const jc=makeCanvas();jc.getContext('2d').drawImage(ji,0,0);
 for(const [x,y]of [[190,1350],[800,1350]])assert.deepEqual(pixel(wv,x,y),pixel(jc,x,y),'opaque selected jacket stays above the new source cuff');assertions+=5;
 for(const [x,y]of [[219,1000],[792,1000]])assert.equal(pixel(wv,x,y)[3],pixel(jc,x,y)[3],'outer jacket antialiasing admits no white shirt fringe');assertions+=2;collect();trace('jacket-ownership-checked');
 assert.equal(hash(Buffer.from(wv.getContext('2d').getImageData(0,0,996,350).data)),hash(Buffer.from(avatarCanvas.getContext('2d').getImageData(0,0,996,350).data)),'jacket-specific rear stand stays behind the immutable avatar');assertions++;
 assert.equal(wr.plan(selection('B03')).jacketRear,wc.continuousShirts.shirts.DS035.jacket_rear.B03.no_tie);
 for(const mode of ['shirt-only','B02','S05'])assert.equal(wr.plan(selection(mode)).jacketRear,null,'rear support is restricted to selected B03');assertions+=4;
 for(const mode of ['S05','S11']){
  await wr.render(selection(mode));
  for(const [x,y]of [[75,1330],[915,1330]])assert.equal(pixel(wv,x,y)[3],0,'full-width source cuff strip cannot protrude outside the selected sleeve');
  assert.deepEqual(pixel(wv,130,1368),[238,238,238,255],'diagonal cuff remains between selected sleeve hem and original hand');assertions+=3;
 }
 assert.equal(pixel(wv,616,412)[3],0,'unsupported S11 collar fragment above first jacket row is excluded');
 assert.deepEqual(pixel(wv,590,420),[180,180,180,255],'legitimate upper collar remains within the selected neck aperture');assertions+=2;
 const cuffSources=[...wc.blazerConnection.availableIds,...wc.assemblies.dynamicSuitIds];
 for(const mode of cuffSources){if(!['B03','S05','S11'].includes(mode))await wr.render(selection(mode));collect();}
 const portRecords=wr.stats().continuousCuffPorts;
 assert.equal(portRecords.length,cuffSources.length,'every supported selected topwear source has wrist ownership');
 for(const record of portRecords){assert.equal(record.ports.length,2);for(const [side,port]of record.ports.entries()){const [x0,y0,x1,y1]=port.bounds;assert.ok(x1-x0>20&&x1-x0<300&&y1-y0>10&&y1-y0<150&&y0>1250&&y0<1400&&y1>1360&&y1<1450&&(side===0?x1<400:x0>600),'sane nonempty selected sleeve/hand port: '+record.jacket_id);}}assertions+=2;
 wv.width=wv.height=jc.width=jc.height=1;collect();trace('all-topwear-wrist-ownership-checked');
 const bad=structuredClone(data);bad.shirts.DS035.modes.no_tie.body.source.rect[2]=9;const badConnection=connection(bad),badRenderer=g.HEWRSAtomicRenderer.create(makeCanvas(),badConnection,{resolveUrl});await assert.rejects(badRenderer.render(opening),/dimensions differ/);assertions++;
 assert.equal(hash(JSON.stringify(g.HEWRS_INPUTS)),inputBefore,'immutable source input remains unchanged');assertions++;
 console.log(JSON.stringify({status:'PASS',type:'CONTRACT_AND_NATIVE_COMPOSITING_NOT_VISUAL_APPROVAL',assertions,exact_tie_plans:tiePlans,clean_mode_frames:cleanFrames,cuff_topwear_sources:portRecords.length,source_bound_wrist_ports:portRecords.reduce((n,p)=>n+p.ports.length,0),rapid_selection_atomic:true,unaffected_frame_identical:true,source_patch_preservation:true,harmonic_boundary_repair:true,boundary_fixture_frame_ms:boundaryRenderMs,renderer_stats:renderer.stats()},null,2));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
