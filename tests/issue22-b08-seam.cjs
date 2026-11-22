'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const harness=require('./avatar-v3-fit-runtime.cjs');
const {Image}=require('@napi-rs/canvas');
const W=996,H=2748,HASH='583f5629a6afb4be9543a107029bdca8d38defde3a6af907ca714209d41652ad';
const SOURCE=path.join(harness.ROOT,'assets',HASH+'.png');
const desc={sha256:HASH,url:'assets/'+HASH+'.png',rect:[0,0,W,H]};
function session(){
 const html=fs.readFileSync(path.join(harness.ROOT,'index.html'),'utf8');
 const runtime=html.match(/src="(runtime\/[^"?]+)/)[1];
 const integrated=fs.readFileSync(path.join(harness.ROOT,runtime),'utf8').includes("revision:'AVATAR_V3_B08_SEAM_FIT_1'");
 return harness.load({extraModules:integrated?[]:['src/issue22-b08.js']});
}
async function source(){
 const image=new Image();image.src=fs.readFileSync(SOURCE);await image.decode();return image;
}
function pixels(canvas){return canvas.getContext('2d').getImageData(0,0,W,H).data;}
function inBounds(x,y){return (x>=403&&x<447&&y>=1107&&y<1144)||(x>=509&&x<568&&y>=1117&&y<1152);}
function seamJump(data,box){
 const [l,t,r,b]=box;let max=0;
 for(let y=t+1;y<b;y++){
  let sum=0,count=0;
  for(let x=l;x<r;x++){
   const p=(y*W+x)*4,q=p-W*4;
   if(data[p+3]!==255||data[q+3]!==255)continue;
   for(let c=0;c<3;c++){sum+=Math.abs(data[p+c]-data[q+c]);count++;}
  }
  if(count)max=Math.max(max,sum/count);
 }
 return max;
}
test('B08 repair removes both independently located source scars and preserves all other source pixels',async()=>{
 const app=session(),api=app.g.HEWRSAvatarV3B08SeamFit,image=await source();
 assert.equal(harness.digest(fs.readFileSync(SOURCE)),HASH,'original registered PNG remains immutable');
 const old=app.makeCanvas();old.getContext('2d').drawImage(image,0,0);
 const corrected=api.repair(image,desc),before=pixels(old),after=pixels(corrected);
 assert.equal(corrected.width,W);assert.equal(corrected.height,H);
 let changed=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const at=(y*W+x)*4;
  assert.equal(after[at+3],before[at+3],`original jacket alpha at ${x},${y}`);
  for(let c=0;c<3;c++){
   if(!inBounds(x,y))assert.equal(after[at+c],before[at+c],`outside source repair at ${x},${y}`);
  }
  if(after[at]!==before[at]||after[at+1]!==before[at+1]||after[at+2]!==before[at+2])changed++;
 }
 assert.ok(changed>2000&&changed<3500,'repair stays limited to the confirmed scars');
 // These pixel windows are independently located on the supplied screenshot
 // and original source; they exclude real pocket edges and garment features.
 for(const box of [[415,1111,431,1134],[523,1118,548,1144]]){
  assert.ok(seamJump(before,box)>15,'fixture actually contains the reported discontinuity');
  assert.ok(seamJump(after,box)<2,'repaired panel has continuous adjacent-row colour');
 }
 old.width=old.height=corrected.width=corrected.height=1;
});
test('B08 guard rejects altered source identity, dimensions and geometry',async()=>{
 const app=session(),api=app.g.HEWRSAvatarV3B08SeamFit,image=await source();
 assert.throws(()=>api.repair(image,{...desc,sha256:'0'.repeat(64)}),/unregistered/);
 assert.throws(()=>api.repair(image,{...desc,rect:[1,0,W,H]}),/rectangle/);
 assert.throws(()=>api.repair(app.makeCanvas(10,10),desc),/dimensions/);
});
test('loader passes unrelated garments and preserved checkpoint controls through unchanged',async()=>{
 const app=session();let count=0;
 const loader=app.g.HEWRSRenderImageLoader.create({limit:2,width:W,height:H,resolveUrl:app.resolveUrl,
  decode:(image)=>{count++;return image;}});
 for(const hash of ['13293d9abbd3a8c1deca17ad46fbf79edecf962a8c0a622068a0ca7daa2c47f7','173f09f986b00d56b06062ae91d6388445245980d9bde907a1655c61f7870e05']){
  const image=await loader.load({sha256:hash,url:'assets/'+hash+'.png',rect:[0,0,W,H]});
  assert.ok(image instanceof Image,'only exact B08 jacket becomes a derived canvas');
 }
 assert.equal(count,2);loader.cancel();
});
test('all active B08 routes retain corrected jacket ownership, identity and protected state',async()=>{
 const app=session(),api=app.g.HEWRSAvatarV3B08SeamFit,image=await source(),repaired=api.repair(image,desc),expected=pixels(repaired);
 const baseline=harness.load({entrypoint:'avatar-v3-issue22-baseline.html'});
 for(const id of app.connection.limits.shirt_ids){
  const states=app.connection.records[id].no_tie_only?['NO_TIE']:['NO_TIE','T001'];
  for(const state of states){
   const plan=app.plan(harness.selection(id,state,'B08'));
   assert.ok(['CONTINUOUS_SOURCE_SHIRT','SOURCE_REGISTERED_BATCH16'].includes(plan.operation),'every active route uses the separate B08 jacket');
   assert.equal(plan.jacket.sha256,HASH);
  }
 }
 for(const [shirt,state] of [['DS001','NO_TIE'],['DS001','T001'],['DS013','T001'],['DS040','NO_TIE']]){
  const selected=harness.selection(shirt,state,'B08'),captured=await app.capture(selected);
  const old=await baseline.capture(selected);
  assert.equal(captured.result.status,'ready');
  assert.equal(captured.metadata.avatar_profile,'AVATAR_V3');
  assert.equal(app.connection.manifest.static.avatar.sha256,'4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93');
  let changed=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const at=(y*W+x)*4;
   if(captured.rgba[at]===old.rgba[at]&&captured.rgba[at+1]===old.rgba[at+1]&&captured.rgba[at+2]===old.rgba[at+2]&&captured.rgba[at+3]===old.rgba[at+3])continue;
   assert.ok(inBounds(x,y),`${shirt}/${state}: unchanged full-avatar render outside confirmed scars at ${x},${y}`);
   assert.equal(captured.rgba[at+3],old.rgba[at+3],'final composite alpha remains exact');changed++;
  }
  assert.ok(changed>2000&&changed<3500,'complete avatar receives only the bounded jacket repair');
  for(const box of [[415,1111,431,1134],[523,1118,548,1144]]){
   const [l,t,r,b]=box;
   for(let y=t;y<b;y++)for(let x=l;x<r;x++){
    const at=(y*W+x)*4;
    if(expected[at+3]!==255)continue;
    for(let c=0;c<4;c++)assert.equal(captured.rgba[at+c],expected[at+c],`${shirt}/${state}: exact registered repaired jacket at ${x},${y}`);
   }
  }
 }
 repaired.width=repaired.height=1;
});
