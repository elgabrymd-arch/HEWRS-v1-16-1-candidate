'use strict';
// Controlled transport only: production native renderer chains execute, while
// a small virtual canvas records publication rather than asserting fake pixels.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load}=require('./tie-engine-loader.cjs');
const {g,connection:c}=load(),images=[],checks=[];
function check(name,fn){fn();checks.push({name,passed:true});}
class Canvas{constructor(){this.dataset={};this.writes=0;}getContext(){return {clearRect(){},drawImage(){},putImageData:()=>{this.writes++;},getImageData:()=>({data:new Uint8ClampedArray(4)})};}}
class Image{
 constructor(){images.push(this);this.naturalWidth=996;this.naturalHeight=2748;}
 set src(value){this.url=value;if(!value)this.aborted=true;}
 get src(){return this.url;}
 complete(){this.onload?.();}
 fail(){this.onerror?.();}
}
g.Image=Image;g.HTMLCanvasElement=Canvas;g.ImageData=class ImageData{constructor(data,width,height){Object.assign(this,{data,width,height});}};
g.document={createElement:type=>{assert.equal(type,'canvas');return new Canvas();}};
const bounded=p=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Render did not settle after cancellation/completion')),500);p.then(value=>{clearTimeout(t);resolve(value);},error=>{clearTimeout(t);reject(error);});});
const finish=async()=>{for(let i=0;i<6;i++){for(const im of images)if(im.url&&im.onload)im.complete();await Promise.resolve();}};
const fixtures=[
 {suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-8',watchId:null},
 {suitId:'S11',shirtId:'DS035',state:'T029',shoeId:'shoe-8',watchId:null},
 {blazerId:'B03',pantId:'PG002',shirtId:'DS023',state:'T017',shoeId:'shoe-8',watchId:null},
 {blazerId:'B03',pantId:'PG002',shirtId:'DS001',state:'T029',shoeId:'shoe-8',watchId:null},
 {blazerId:'B01',pantId:'PG002',shirtId:'DS001',state:'T029',shoeId:'shoe-8',watchId:null},
 {shirtOnly:true,pantId:'PG002',shirtId:'DS017',state:'T029',shoeId:'shoe-8',watchId:null},
 {shirtOnly:true,pantId:'PG002',shirtId:'DS001',state:'T029',shoeId:'shoe-8',watchId:null}
];
(async()=>{
 for(const s of fixtures){
  const label=(s.suitId||s.blazerId||'SHIRT_ONLY')+'/'+s.shirtId,visible=new Canvas(),r=g.HEWRSAtomicRenderer.create(visible,c,{resolveUrl:d=>d.url});
  const first=r.render(s),old=images.filter(im=>im.onload).map(im=>({im,load:im.onload,error:im.onerror})),made=images.length;
  r.cancel();const retry=r.render(s);
  check(label+': immediate retry starts fresh requests',()=>assert.ok(images.length>made));
  check(label+': cancelled attempt settles without visible pixels',()=>assert.equal(visible.writes,0));
  assert.equal((await bounded(first)).cancelled,true);checks.push({name:label+': stalled cancelled promise settles',passed:true});
  await finish();assert.equal((await bounded(retry)).status,'ready');
  check(label+': exact retry selection publishes once',()=>{assert.equal(JSON.stringify(r.last()),JSON.stringify(s));assert.equal(visible.writes,1);});
  for(const item of old){item.load();item.error();}
  await Promise.resolve();check(label+': late cancelled callbacks do not publish',()=>assert.equal(visible.writes,1));
  const cached=images.length;r.cancel();const repeat=r.render(s);await finish();await bounded(repeat);
  check(label+': completed cache survives cancellation',()=>assert.equal(images.length,cached));
  const a={...s,state:'T030'},b={...s,state:'T031'},before=visible.writes;
  const superseded=r.render(a),late=images.filter(im=>im.onload).map(im=>({load:im.onload,error:im.onerror})),latest=r.render(b);
  assert.equal((await bounded(superseded)).cancelled,true);await finish();assert.equal((await bounded(latest)).status,'ready');
  for(const item of late){item.load();item.error();}await Promise.resolve();
  check(label+': concurrent generations publish only newest exact selection',()=>{assert.equal(JSON.stringify(r.last()),JSON.stringify(b));assert.equal(visible.writes,before+1);});
  r.cancel();
 }
 const descriptor={url:'assets/exact.png',sha256:'a'.repeat(64)},other={url:'assets/exact.png',sha256:'b'.repeat(64)};
 const one=g.HEWRSRenderImageLoader.create({limit:4,width:996,height:2748}),two=g.HEWRSRenderImageLoader.create({limit:4,width:996,height:2748});
 const a=one.load(descriptor),b=two.load(descriptor);one.cancel();await assert.rejects(a,{name:'AbortError'});
 check('Cancellation is instance-local',()=>{assert.equal(one.pending,0);assert.equal(two.pending,1);});await finish();await b;
 const before=images.length;const alias=two.load(other);await finish();await alias;
 check('Same URL with distinct source hash has distinct cache entry',()=>assert.equal(images.length,before+1));
 const bad=one.load(descriptor);images.at(-1).naturalWidth=1;images.at(-1).complete();await assert.rejects(bad,/dimensions/);
 check('Dimension failure evicts the failed cache entry',()=>assert.equal(one.size,0));
 const retry=one.load(descriptor);await finish();await retry;check('Dimension failure permits exact retry',()=>assert.equal(one.size,1));
 const decoder=g.HEWRSRenderImageLoader.create({limit:2,width:996,height:2748,decode:()=>{throw Error('Controlled canvas read failure');}}),failed=decoder.load(descriptor);await finish();await assert.rejects(failed,/canvas read failure/);
 check('Canvas decode exceptions settle and evict',()=>{assert.equal(decoder.pending,0);assert.equal(decoder.size,0);});
 const out={schema:'hewrs.five-round-render-cancellation.v1',status:'passed',checks,passed:checks.length,failed:0,scope:'Native renderer control flow with controlled image events and virtual canvases; pixel correctness is a separate browser gate',no_timeout_added:true};
 fs.writeFileSync(path.join(__dirname,'../evidence/five_round_20261119/engine-render-cancel-after.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({status:out.status,passed:out.passed,failed:0}));
})().catch(error=>{console.error(error);process.exitCode=1;});
