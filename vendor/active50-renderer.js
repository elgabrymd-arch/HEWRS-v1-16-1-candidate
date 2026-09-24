/* HEWRS local S05 renderer: 50 source-layer shirts / 46 tied-capable, 4 no-tie-only.
   Does not select outfits, alter scores, mutate geometry or write storage. */
(function(root){
'use strict';
const W=996,H=2748;
function freeze(o){if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
function create(canvas,manifest,resolveUrl){
 if(!(canvas instanceof HTMLCanvasElement))throw Error('Canvas required');
 const m=freeze(JSON.parse(JSON.stringify(manifest)));
 if(m.schema!=='hewrs.active50.s05.staging.v1'||m.canvas.join(',')!=='996,2748')throw Error('Wrong manifest');
 canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw Error('2D canvas unavailable');
 const cache=new Map();let generation=0;const legacyCache=new Map();
 function asset(d){
  if(!d||typeof d.url!=='string'||!/^assets\/[A-Za-z0-9_./-]+\.png$/.test(d.url)||d.url.includes('..')||!/^[a-f0-9]{64}$/.test(d.sha256)||d.rect?.join(',')!=='0,0,996,2748')throw Error('Invalid layer descriptor');
  return d;
 }
 function plan(req){
  if(req?.suitId!=='S05'||!Object.hasOwn(m.shirts,req?.shirtId))throw Error('Unsupported shirt/suit; no substitution');
  const s=m.shirts[req.shirtId],state=req.state;
  if(req.tieId!=null)throw Error('Use the explicit state selector; extraneous tieId rejected');
  if(s.mode_policy==='NO_TIE_ONLY'&&(state!=='NO_TIE'||req.tieId!=null))throw Error('NO_TIE_ONLY: '+req.shirtId+' accepts open collar only; no tie or fallback');
  if(state!=='NO_TIE'&&!Object.hasOwn(m.ties,state)&&!(state==='REFERENCE'&&req.shirtId==='DS035'))throw Error('Explicit supported tie state required; no fallback');
  const c=s.states[state==='NO_TIE'?'no_tie':'tied'],b=m.static;
  if(!c)throw Error('No component set for requested presentation; no substitution');
  let body=c.body;
  if(Object.hasOwn(m.ties,state)&&s.body_keep_for_selectable_ties)body={...body,display_alpha_mask:s.body_keep_for_selectable_ties};
  let out=[b.shoe,b.trousers,c.rear,b.avatar,body];
  if(Object.hasOwn(m.ties,state))out.push(m.ties[state].display_layer);
  else if(state==='REFERENCE')out.push(s.reference_tie);
  return out.concat([c.left,c.right,b.jacket,c.left_cuff,c.right_cuff,b.left_hand,b.right_hand]).map(asset);
 }
 function load(d){
  asset(d);if(cache.has(d.url)){const p=cache.get(d.url);cache.delete(d.url);cache.set(d.url,p);return p;}
  const p=new Promise((resolve,reject)=>{const im=new Image();
   im.onload=()=>im.naturalWidth===W&&im.naturalHeight===H?resolve(im):reject(Error('Wrong component dimensions; no fallback'));
   im.onerror=()=>reject(Error('Missing component '+d.url+'; no fallback'));
   try{im.src=resolveUrl?resolveUrl(d):d.url;}catch(e){reject(e);}
  });
  cache.set(d.url,p);p.catch(()=>{if(cache.get(d.url)===p)cache.delete(d.url);});
  while(cache.size>24)cache.delete(cache.keys().next().value);
  return p;
 }
 function clear(status){ctx.clearRect(0,0,W,H);canvas.dataset.status=status;delete canvas.dataset.shirtId;delete canvas.dataset.state;}
 function cancel(){generation++;clear('cancelled');}
 function makeCanvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
 function bitmap(d,images){
  const im=images.get(d.url);
  if(!d.display_alpha_mask)return im;
  const c=makeCanvas(),cctx=c.getContext('2d');cctx.drawImage(im,0,0);cctx.globalCompositeOperation='destination-in';cctx.drawImage(images.get(d.display_alpha_mask.url),0,0);return c;
 }
 function roundEven(n){const f=Math.floor(n),r=n-f;return r<.5?f:r>.5?f+1:f+(f%2);}
 const f=Math.fround;
 function storedOver(dst,src){
  // Explicit DS051 compatibility arithmetic. No scaling or coordinate change.
  for(let i=0;i<src.length;i+=4){
   const ab=src[i+3];if(!ab)continue;
   if(ab===255){dst[i]=src[i];dst[i+1]=src[i+1];dst[i+2]=src[i+2];dst[i+3]=255;continue;}
   const a=f(ab/255),b=f(1-a);
   for(let k=0;k<3;k++)dst[i+k]=roundEven(f(f(f(f(src[i+k]/255)*a)+f(f(dst[i+k]/255)*b))*255));
   dst[i+3]=roundEven(f(f(a+f(f(dst[i+3]/255)*b))*255));
  }
 }
 function imageData(d,images,box){
  const c=makeCanvas(),cc=c.getContext('2d',{willReadFrequently:true});cc.drawImage(images.get(d.url),0,0);
  const q=box||[0,0,W,H];let data=cc.getImageData(q[0],q[1],q[2],q[3]);
  if(d.display_alpha_mask){
   cc.clearRect(0,0,W,H);cc.drawImage(images.get(d.display_alpha_mask.url),0,0);let keep=cc.getImageData(q[0],q[1],q[2],q[3]).data;
   for(let i=3;i<data.data.length;i+=4)data.data[i]=Math.floor((data.data[i]*keep[i]+127)/255);
  }
  c.width=c.height=1;return data.data;
 }
 function rectCopy(src,box){
  const [x,y,w,h]=box,out=new Uint8ClampedArray(w*h*4);
  for(let j=0;j<h;j++)out.set(src.subarray(((y+j)*W+x)*4,((y+j)*W+x+w)*4),j*w*4);
  return out;
 }
 function writeRect(dst,patch,box){const[x,y,w,h]=box;for(let j=0;j<h;j++)dst.set(patch.subarray(j*w*4,(j+1)*w*4),((y+j)*W+x)*4);}
 function legacyFrame(req,order,images){
  const mode=req.state==='NO_TIE'?'no_tie':'tied',key=req.shirtId+'/'+mode,old=legacyCache.get(key);
  const frame=makeCanvas(),fc=frame.getContext('2d');
  if(old&&mode==='no_tie'){fc.putImageData(new ImageData(old.full,W,H),0,0);return frame;}
  if(old&&mode==='tied'){
   const box=[438,467,117,322],patch=rectCopy(old.prefix,box);
   for(const d of order.slice(5))storedOver(patch,imageData(d,images,box));
   const out=old.full.slice();writeRect(out,patch,box);fc.putImageData(new ImageData(out,W,H),0,0);return frame;
  }
  let out=new Uint8ClampedArray(W*H*4),prefix=null;
  for(let k=0;k<order.length;k++){
   storedOver(out,imageData(order[k],images));if(k===4)prefix=out.slice();
  }
  legacyCache.set(key,{prefix,full:out});while(legacyCache.size>2)legacyCache.delete(legacyCache.keys().next().value);
  fc.putImageData(new ImageData(out,W,H),0,0);return frame;
 }
 async function render(req){
  const token=++generation;clear('loading');
  try{
   const order=plan(req),list=[...order,...order.filter(d=>d.display_alpha_mask).map(d=>asset(d.display_alpha_mask))];
   const loaded=await Promise.all(list.map(load));if(token!==generation)return {cancelled:true};
   const ims=new Map(list.map((d,i)=>[d.url,loaded[i]]));let frame;
   if(m.shirts[req.shirtId].compositing_profile==='PARENT_DS051_STORED_RGB')frame=legacyFrame(req,order,ims);
   else{
    frame=makeCanvas();const fc=frame.getContext('2d');
    for(const d of order){const im=bitmap(d,ims);fc.drawImage(im,0,0);if(im instanceof HTMLCanvasElement)im.width=im.height=1;}
   }
   if(token!==generation){frame.width=frame.height=1;return {cancelled:true};}
   ctx.drawImage(frame,0,0);frame.width=frame.height=1;
   canvas.dataset.status='ready';canvas.dataset.shirtId=req.shirtId;canvas.dataset.state=req.state;
   return {status:'ready',shirtId:req.shirtId,suitId:'S05',state:req.state,components:order.length,review:'ACTIVE50_STAGING_EXISTING_COMPONENTS'};
  }catch(e){if(token===generation)clear('error');throw e;}
 }
 return Object.freeze({plan,render,cancel,stats:()=>({imageCacheSize:cache.size,cacheLimit:24,legacyProfilesCached:legacyCache.size})});
}
root.HEWRSActive50=Object.freeze({create});
})(globalThis);
