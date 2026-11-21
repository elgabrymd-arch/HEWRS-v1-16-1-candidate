'use strict';
/* Real registered jacket/hand pixels with a controlled atomic-frame fixture.
 * These checks establish cuff ownership, source locks and cancellation. The
 * complete application/browser matrix separately supplies visual evidence.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {load,selection,digest,ROOT,WIDTH:W,HEIGHT:H}=require('./avatar-v3-fit-runtime.cjs');
let native;try{native=require('@napi-rs/canvas');}catch(_){native=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','@napi-rs/canvas'));}
const {Image}=native;
const h=load({entrypoint:'avatar-v3-issue19-baseline.html'}),g=h.g,connection=h.connection;
let fixtureColour='#cc3377',fixtureHands=[],inheritedFrame=null,roundingProbe=null,release=null,hold=false;
// Only the inherited garment/background is synthetic. The approved source
// hands are composed over it before the original whole-frame pose, matching
// the actual renderer's ordering. A separate one-LSB probe exercises the
// browser's premultiplied-alpha rounding failure even on native rasterizers
// which happen to produce the same isolated-source and composed pixels.
// The correction still loads its real jacket/hand PNGs through production
// HEWRSRenderImageLoader with original source-registration validation.
g.HEWRSAtomicRenderer=Object.freeze({create(canvas,c){
 let epoch=0,last=null;
 return {async render(input){const token=++epoch,s=c.validateSelection(input);if(hold)await new Promise(resolve=>{release=resolve;});if(token!==epoch)return {cancelled:true};
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,W,H);ctx.fillStyle=fixtureColour;ctx.fillRect(0,0,W,H);
  for(const hand of fixtureHands)ctx.drawImage(hand,0,0);
  const frame=ctx.getImageData(0,0,W,H);g.HEWRSAvatarV3ArmPose.apply(frame);
  if(roundingProbe!==null)frame.data[roundingProbe]^=1;
  ctx.putImageData(frame,0,0);inheritedFrame=Buffer.from(ctx.getImageData(0,0,W,H).data);
  last=JSON.parse(JSON.stringify(s));Object.assign(canvas.dataset,{status:'ready',loading:'false',shirtId:s.shirtId});return {status:'ready'};},
  cancel(){epoch++;},plan:s=>({selection:c.validateSelection(s)}),last:()=>last,stats:()=>({fixture:true})};
}});
vm.runInContext(fs.readFileSync(path.join(ROOT,'src/avatar-v3-cuff-fit.js'),'utf8'),g,{filename:'src/avatar-v3-cuff-fit.js'});
const regions=JSON.parse(JSON.stringify(g.HEWRSAvatarV3CuffFit.spec.bounds)),canvas=h.makeCanvas(),renderer=g.HEWRSAtomicRenderer.create(canvas,connection,{resolveUrl:h.resolveUrl});
const pixels=()=>Buffer.from(canvas.getContext('2d').getImageData(0,0,W,H).data);
let handPixels=[];
function wristCloth(){
 return regions.map(([x,y,w,height])=>{
  const data=Buffer.from(canvas.getContext('2d').getImageData(x,y,w,height).data);
  // Approved hand preservation is checked separately, against the exact
  // inherited frame. Source hand edges may include composition-dependent
  // rounding and are not garment material, so exclude their full silhouette.
  for(let row=0;row<height;row++)for(let col=0;col<w;col++){
   const at=((y+row)*W+x+col)*4+3;
   if(handPixels.some(hand=>hand[at]>0))data.fill(0,(row*w+col)*4,(row*w+col+1)*4);
  }
  return digest(data);
 });
}
function rectangle(data,[x,y,w,height]){
 const result=Buffer.alloc(w*height*4);
 for(let row=0;row<height;row++)data.copy(result,row*w*4,((y+row)*W+x)*4,((y+row)*W+x+w)*4);
 return result;
}
let checks=0;
function ok(value,message){assert.ok(value,message);checks++;}
function equal(a,b,message){assert.deepEqual(a,b,message);checks++;}
async function sourceImage(desc){const im=new Image();await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=h.resolveUrl(desc);});return im;}
async function image(desc,posed=true){const im=await sourceImage(desc),c=h.makeCanvas();c.getContext('2d').drawImage(im,0,0);const frame=c.getContext('2d').getImageData(0,0,W,H);if(posed)g.HEWRSAvatarV3ArmPose.apply(frame);const data=Buffer.from(frame.data);c.width=c.height=1;return data;}
function exactHands(data,expected,label){
 let count=0;
 for(let side=0;side<2;side++){
  const [x,y,w,height]=regions[side],hand=handPixels[side];
  for(let row=0;row<height;row++)for(let col=0;col<w;col++){
   const at=((y+row)*W+x+col)*4;
   if(hand[at+3]!==255)continue;
   assert.equal(data.subarray(at,at+4).toString('hex'),expected.subarray(at,at+4).toString('hex'),label+' exact inherited approved opaque hand');count++;
  }
 }
 ok(count>5000,label+' checks visible opaque hand pixels');return count;
}
async function main(){
 const hands=[connection.manifest.static.left_hand,connection.manifest.static.right_hand];
 [fixtureHands,handPixels]=await Promise.all([Promise.all(hands.map(sourceImage)),Promise.all(hands.map(d=>image(d)))]);
 const baselineSourceHashes=new Map();
 for(const side of hands)baselineSourceHashes.set(h.resolveUrl(side),digest(fs.readFileSync(h.resolveUrl(side))));
 const jackets=[...connection.limits.suits,...connection.blazerConnection.availableIds];
 const results=[];
 for(const id of jackets){
  fixtureColour='#cc3377';await renderer.render(selection('DS034','NO_TIE',id));const first=wristCloth(),data=pixels();
  const details=renderer.stats().avatarV3CuffFit.jackets.find(x=>x.jacket_id===id);
  ok(details&&details.wrists.length===2,id+' has two verified source wrist registrations');
  const source=path.join(ROOT,'assets',details.source_sha256+'.png');baselineSourceHashes.set(source,digest(fs.readFileSync(source)));
  const protectedHandPixels=exactHands(data,inheritedFrame,id+' no tie');let opaqueWristContact=0;
  for(let side=0;side<2;side++){
   const [x0,y0,width,height]=regions[side],hand=handPixels[side];
   // Every interior column of the original wrist cap meets opaque garment
   // immediately above the hand; a one-pixel top edge may be antialiased.
   const [a,,b]=details.wrists[side].wrist_cap;
   for(let x=a+5;x<=b-5;x++){
    let top=1330;while(top<1410&&hand[(top*W+x)*4+3]<128)top++;
    if(top>=1400)continue;
    ok(data[((top-2)*W+x)*4+3]>=248,id+' '+side+' sleeve touches wrist at '+x);opaqueWristContact++;
   }
  }
  fixtureColour='#22bb44';await renderer.render(selection('DS003',['B01','B11'].includes(id)?'NO_TIE':'T047',id));
  equal(wristCloth(),first,id+' cuff cloth is independent of shirt colour and tie state');
  const after=pixels();
  equal(exactHands(after,inheritedFrame,id+' changed shirt/tie'),protectedHandPixels,id+' preserves the same complete opaque hand mask');
  // These disjoint rectangles exhaust every pixel outside the two declared
  // wrist bounds, including the entire jacket front and torso silhouette.
  for(const rect of [[0,0,W,1180],[0,1426,W,H-1426],[0,1180,20,246],[260,1180,476,246],[976,1180,20,246]]){
   const data=Buffer.from(canvas.getContext('2d').getImageData(...rect).data),expected=rectangle(inheritedFrame,rect);
   equal(digest(data),digest(expected),id+' protects every pixel in '+rect.join(','));
  }
  ok(renderer.stats().avatarV3CuffFit.cache_size<=2,'bounded correction cache');
  results.push({id,jacket_sha256:details.source_sha256,protected_hand_pixels:protectedHandPixels,wrist_contact_columns:opaqueWristContact,source_geometry:details.wrists});
  if(global.gc)global.gc();
 }
 // A fully opaque inherited hand pixel can differ by one LSB from the
 // independently posed hand source in Chromium. Prove this exact pixel is
 // retained, and that it never contaminates the cached correction on reuse.
 fixtureColour='#22bb44';await renderer.render(selection('DS001','NO_TIE','S05'));
 const regular=pixels(),regularCloth=wristCloth();
 const left=regions[0];
 for(let y=left[1];y<left[1]+left[3]&&roundingProbe===null;y++)for(let x=left[0];x<left[0]+left[2];x++){
  const at=(y*W+x)*4;
  if(handPixels[0][at+3]===255){roundingProbe=at;break;}
 }
 ok(roundingProbe!==null,'one-LSB probe targets an opaque approved posed hand pixel');
 const probe=roundingProbe;await renderer.render(selection('DS001','NO_TIE','S05'));const probed=pixels();
 equal(inheritedFrame[probe],regular[probe]^1,'fixture exercises a one-LSB inherited-hand difference');
 equal(probed[probe],inheritedFrame[probe],'correction retains the exact one-LSB inherited-hand difference');
 exactHands(probed,inheritedFrame,'one-LSB regression');equal(wristCloth(),regularCloth,'one-LSB inherited hand does not change cuff cloth');
 roundingProbe=null;await renderer.render(selection('DS001','NO_TIE','S05'));
 equal(digest(pixels()),digest(regular),'cached correction is not mutated by inherited-hand preservation');
 for(const state of ['NO_TIE','T001']){
  fixtureColour='#1188cc';await renderer.render(selection('DS034',state,'shirt-only'));const data=pixels();
  equal(digest(data),digest(inheritedFrame),'shirt-only whole finished frame, including hands, is exact pass-through');
  equal(canvas.dataset.avatarV3Cuffs,undefined,'shirt-only has no concealed cuff marker');
 }
 let cuffDescriptors=0;const measured=new Map();
 const originalInventory=JSON.parse(fs.readFileSync(path.join(ROOT,'data/inputs.json'),'utf8')).manifest.shirts;
 for(const record of Object.values(originalInventory))for(const mode of Object.values(record.states))for(const [role,d]of Object.entries(mode)){
  if(!role.includes('cuff')||!d?.sha256)continue;
  if(!d.alpha_bounds&&!measured.has(d.sha256)){
   const data=await image(d,false);let x0=W,y0=H,x1=-1,y1=-1;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(data[(y*W+x)*4+3]){x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);}
   measured.set(d.sha256,[x0,y0,x1,y1]);
  }
  const region=regions[role.startsWith('left')?0:1],[x0,y0,x1,y1]=d.alpha_bounds||measured.get(d.sha256);
  ok(x0>=region[0]&&x1<=region[0]+region[2]&&y0>=region[1]&&y1<=region[1]+region[3],record.shirt_id+' '+role+' source cuff is inside the replacement bounds');cuffDescriptors++;
 }
 ok(cuffDescriptors>=192,'complete original active-shirt cuff inventory inspected');
 const saved=pixels(),last=JSON.stringify(renderer.last());
 await assert.rejects(renderer.render(selection('DS049','NO_TIE','S05')),/registered|source|shirt|Unknown/i);checks++;
 equal(digest(pixels()),digest(saved),'invalid selection retains complete previous pixels');equal(JSON.stringify(renderer.last()),last,'invalid selection retains previous exact selection');
 hold=true;const pending=renderer.render(selection('DS034','NO_TIE','B15'));await new Promise(resolve=>setImmediate(resolve));renderer.cancel();release();
 equal((await pending).cancelled,true,'cancelled cuff preparation cannot commit');equal(digest(pixels()),digest(saved),'cancelled request retains complete frame');
 for(const [filename,sha]of baselineSourceHashes)equal(digest(fs.readFileSync(filename)),sha,'source PNG remains byte-exact: '+path.basename(filename));
 equal(h.storage.snapshot(),[],'no browser-storage write');
 console.log('AVATAR_V3_CUFF_FIT='+JSON.stringify({status:'PASS_SOURCE_OWNERSHIP_NOT_VISUAL_APPROVAL',checks,jackets:results.length,regions,results}));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
