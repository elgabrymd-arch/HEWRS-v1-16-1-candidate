'use strict';
// Real native pixels plus controlled image completion exercise the production
// loader wrapper. This verifies registration scope and lifetime, not fit taste.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
let native;try{native=require('@napi-rs/canvas');}catch(_){native=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','@napi-rs/canvas'));}
const {Image,createCanvas}=native,ROOT=path.resolve(__dirname,'..'),W=996,H=2748;
const B15='e34e249bf344b0130e1f0b805285444758801a80a7c07b1c787687de7e36569a';
const B03='52984a67033b4c1d348eabfb71e1f5954d1a22457d8d1cc51498bb29118cfe99';
const V3='4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93';
const loaderSource=fs.readFileSync(path.join(ROOT,'src/render-image-loader.js'),'utf8');
const fitSource=fs.readFileSync(path.join(ROOT,'src/avatar-v3-collar-fit.js'),'utf8');
const descriptor=sha=>({sha256:sha,url:'assets/'+sha+'.png',rect:[0,0,W,H]});
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const profile=()=>({candidate:{avatar:V3},kind:'INTEGRATED'});

function harness({install=true,held=false,avatarProfile=profile()}={}){
 const images=[];
 class TrackedImage extends Image{constructor(){super();images.push(this);}}
 class HeldImage extends TrackedImage{
  set src(value){this.requestedUrl=value;}
  get src(){return this.requestedUrl;}
  release(){super.src=this.requestedUrl;}
 }
 const g=vm.createContext({Image:held?HeldImage:TrackedImage,console,
  HEWRSAvatarV3:avatarProfile,
  document:{createElement(tag){assert.equal(tag,'canvas');return createCanvas(W,H);}}});
 vm.runInContext(loaderSource,g,{filename:'src/render-image-loader.js'});
 const original=g.HEWRSRenderImageLoader;
 const installFit=()=>vm.runInContext(fitSource,g,{filename:'src/avatar-v3-collar-fit.js'});
 if(install)installFit();
 const create=options=>g.HEWRSRenderImageLoader.create({limit:4,width:W,height:H,
  resolveUrl:d=>path.join(ROOT,d.url),...options});
 return {g,images,original,installFit,create};
}

function pixels(image){
 const c=createCanvas(W,H),ctx=c.getContext('2d',{willReadFrequently:true});
 try{ctx.drawImage(image,0,0);return ctx.getImageData(0,0,W,H).data;}finally{c.width=c.height=1;}
}

function firstCollarPixel(data,x){
 for(let y=375;y<600;y++)if(data[(y*W+x)*4+3]>=128)return y;
 throw Error('No collar edge in the registered region');
}

test('The V2 loader stays untouched and the collar module rejects an unregistered profile',async()=>{
 const h=harness({install:false,avatarProfile:null}),before=h.original;
 assert.throws(h.installFit,/registered V3 profile is required/);
 assert.equal(h.g.HEWRSRenderImageLoader,before);
 const original=await h.create().load(descriptor(B15));
 assert.equal(original,h.images[0],'V2 keeps the native source image');
 h.g.HEWRSAvatarV3={candidate:{avatar:'0'.repeat(64)},kind:'INTEGRATED'};
 assert.throws(h.installFit,/registered V3 profile is required/);
 assert.equal(h.g.HEWRSRenderImageLoader,before);
});

test('The exact B15 donor moves to the neck anchor and every pixel outside the collar bounds stays exact',async()=>{
 const sourcePath=path.join(ROOT,'assets',B15+'.png'),sourceBefore=fs.readFileSync(sourcePath);
 assert.equal(digest(sourceBefore),B15,'approved donor identity');
 const h=harness(),d=descriptor(B15),snapshot=JSON.stringify(d),image=await h.create().load(d);
 assert.notEqual(image,h.images[0],'default decoder retains the registered canvas');
 assert.equal(typeof image.getContext,'function');
 assert.deepEqual([image.width,image.height],[W,H]);
 assert.equal(JSON.stringify(d),snapshot,'source descriptor is unchanged');
 const before=pixels(h.images[0]),after=pixels(image);
 let changedInside=0,changedOutside=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*4;
  if(before[i]===after[i]&&before[i+1]===after[i+1]&&before[i+2]===after[i+2]&&before[i+3]===after[i+3])continue;
  if(x>=280&&x<460&&y>=375&&y<600)changedInside++;else changedOutside++;
 }
 assert.ok(changedInside>1000,'the collar registration is active');
 assert.equal(changedOutside,0,'head, body, sleeves and other jacket pixels are exact');
 assert.ok(Math.abs(firstCollarPixel(after,391)-420)<=2,'visible collar edge reaches the native neck anchor');
 assert.ok(firstCollarPixel(before,391)>500,'the donor was not already fitted to that anchor');
 assert.equal(digest(fs.readFileSync(sourcePath)),B15,'source bytes remain immutable');
});

test('A different real jacket preserves the original default decoder and exact image identity',async()=>{
 const h=harness(),d=descriptor(B03),image=await h.create().load(d);
 assert.equal(digest(fs.readFileSync(path.join(ROOT,d.url))),B03);
 assert.equal(image,h.images[0],'non-B15 image is passed through unchanged');
});

test('Custom decoding receives the fitted canvas and original descriptor; failure evicts and permits retry',async()=>{
 const h=harness(),d=descriptor(B15),seen=[];let rejectDecode=true;
 const loads=h.create({decode(image,actual){
  seen.push({image,actual});
  if(rejectDecode)throw Error('Controlled downstream decoder failure');
  return {image,actual};
 }});
 await assert.rejects(loads.load(d),/Controlled downstream decoder failure/);
 assert.equal(loads.pending,0);assert.equal(loads.size,0);
 rejectDecode=false;
 const result=await loads.load(d);
 assert.equal(h.images.length,2,'retry uses a new image after decoder failure');
 assert.equal(result.actual,d);
 assert.equal(seen.length,2);
 assert.equal(result.image,seen[1].image);
 assert.equal(typeof result.image.getContext,'function');
 loads.cancel();
 assert.equal(await loads.load(d),result,'completed custom result survives cancellation');
 assert.deepEqual([result.image.width,result.image.height],[W,H],'retained decoder canvas was not disposed');
 assert.equal(seen.length,2,'a cache hit does not decode or warp twice');
 const other=descriptor(B03),otherResult=await loads.load(other);
 assert.equal(otherResult.image,h.images[2],'non-target custom decoder gets its original Image');
 assert.equal(otherResult.actual,other);
});

test('A mismatched B15 source rectangle fails without poisoning the next exact load',async()=>{
 const h=harness(),loads=h.create(),d=descriptor(B15);
 await assert.rejects(loads.load({...d,rect:[0,0,W-1,H]}),/unexpected registered jacket rectangle/);
 assert.equal(loads.pending,0);assert.equal(loads.size,0);
 const image=await loads.load(d);
 assert.equal(h.images.length,2);
 assert.deepEqual([image.width,image.height],[W,H]);
});

test('Cancelling an incomplete B15 load settles it, ignores late callbacks, and retains the completed retry',async()=>{
 const h=harness({held:true}),loads=h.create(),d=descriptor(B15);
 const first=loads.load(d),old=h.images[0],late=old.onload;
 loads.cancel();
 await assert.rejects(first,{name:'AbortError',code:'HEWRS_RENDER_CANCELLED'});
 assert.equal(loads.pending,0);assert.equal(loads.size,0);
 assert.equal(old.requestedUrl,'','cancelled transport was released');
 const retry=loads.load(d);
 assert.equal(h.images.length,2);
 late();
 assert.equal(loads.pending,1,'late cancelled completion cannot settle the retry');
 h.images[1].release();
 const image=await retry;
 assert.equal(loads.pending,0);assert.equal(loads.size,1);
 loads.cancel();late();
 assert.equal(await loads.load(d),image,'completed registered image survives cancellation');
 assert.equal(h.images.length,2,'cached retry creates no new transport');
 assert.deepEqual([image.width,image.height],[W,H]);
});
