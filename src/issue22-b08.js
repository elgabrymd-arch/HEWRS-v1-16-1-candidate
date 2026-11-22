/* Issue #22: two damaged horizontal joins in B08's registered jacket.
 * Both scars are already present in the CP46 source, before the V3 pose.
 * Reconstruct only their RGB from adjacent rows of the SAME jacket, in
 * coordinates following that panel's inner edge. Preserve source alpha,
 * original closure, patch pockets, crest, buttons, avatar and all other art.
 * Immutable PNGs remain source evidence; this is a bounded display repair.
 */
(function(root){'use strict';
const prior=root.HEWRSRenderImageLoader,W=996,H=2748;
const JACKET='583f5629a6afb4be9543a107029bdca8d38defde3a6af907ca714209d41652ad';
const sources=new Set([JACKET]);
// These are the two broken inner-panel joins, not the real horizontal
// patch-pocket edges farther out on either side of the jacket.
const repairs=Object.freeze([
 Object.freeze({side:'left',bounds:Object.freeze([403,1107,44,37]),rows:Object.freeze([1105,1145]),edge_range:Object.freeze([360,470])}),
 Object.freeze({side:'right',bounds:Object.freeze([509,1117,59,35]),rows:Object.freeze([1115,1153]),edge_range:Object.freeze([505,620])})
]);
const spec=Object.freeze({revision:'AVATAR_V3_B08_SEAM_FIT_1',garment_id:'B08',
 source_sha256:JACKET,canvas:Object.freeze([W,H]),repairs,
 method:'same-jacket-adjacent-row-continuity',source_alpha:'preserved_exactly',
 source_files_changed:false,avatar_or_pose_changed:false,garment_donors:false});
const need=(ok,message)=>{if(!ok)throw Error('B08 seam fit: '+message);};
const smooth=t=>t*t*(3-2*t);
function panelEdge(data,row,patch){
 const [l,r]=patch.edge_range;
 if(patch.side==='left')for(let x=r;x>=l;x--)if(data[(row*W+x)*4+3]>=248)return x;
 if(patch.side==='right')for(let x=l;x<=r;x++)if(data[(row*W+x)*4+3]>=248)return x;
 throw Error('B08 seam fit: registered panel edge is missing');
}
function sample(data,x,y,channel){
 const i=Math.floor(x),f=x-i,a=(y*W+i)*4,b=a+4;
 need(i>=0&&i+1<W&&data[a+3]>=248&&data[b+3]>=248,'adjacent source cloth is not opaque');
 return data[a+channel]*(1-f)+data[b+channel]*f;
}
function repair(image,descriptor){
 need(sources.has(descriptor.sha256),'unregistered B08 source');
 need(descriptor.rect?.join(',')===[0,0,W,H].join(','),'source rectangle changed');
 need((image.naturalWidth||image.width)===W&&(image.naturalHeight||image.height)===H,'source dimensions changed');
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 const frame=ctx.getImageData(0,0,W,H),source=new Uint8ClampedArray(frame.data);
 // Source alpha is authoritative for the garment's cut. All 50 active
 // shirts use this separate jacket through the continuous or batch route.
 // The historic full-composite control remains unchanged source evidence.
 for(const patch of repairs){
  const [l,y0,width,height]=patch.bounds,[top,bottom]=patch.rows;
  const a=panelEdge(source,top,patch),b=panelEdge(source,bottom,patch);
  for(let y=y0;y<y0+height;y++){
   const t=(y-top)/(bottom-top),edge=a+(b-a)*t;
   for(let x=l;x<l+width;x++){
    const at=(y*W+x)*4;
    if(source[at+3]===0)continue;
    // Stay just inside clean opaque cloth at both registered source rows.
    const distance=patch.side==='left'?Math.max(1,edge-x):Math.max(1,x-edge);
    const sx0=patch.side==='left'?a-distance:a+distance;
    const sx1=patch.side==='left'?b-distance:b+distance;
    const fadeY=Math.min(1,(y-y0+1)/3,(y0+height-y)/3);
    // Only the outer side of each patch needs feathering; the inner side
    // ends at the original jacket alpha boundary and must not retain a scar.
    const fadeX=patch.side==='left'?Math.min(1,(x-l+1)/6):Math.min(1,(l+width-x)/6);
    const amount=smooth(Math.max(0,Math.min(fadeX,fadeY)));
    for(let c=0;c<3;c++){
     const cloth=sample(source,sx0,top,c)*(1-t)+sample(source,sx1,bottom,c)*t;
     frame.data[at+c]=Math.round(source[at+c]*(1-amount)+cloth*amount);
    }
   }
  }
  // Do not round-trip unrelated fractional-alpha pixels in a native canvas.
  ctx.putImageData(frame,0,0,l,y0,width,height);
 }
 return canvas;
}
need(prior?.create&&root.HEWRSAvatarV3?.candidate?.avatar==='4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93','approved V3 profile required');
root.HEWRSRenderImageLoader=Object.freeze({create(options={}){
 const decode=options.decode||((image)=>image);
 return prior.create({...options,decode:(image,descriptor)=>decode(sources.has(descriptor.sha256)?repair(image,descriptor):image,descriptor)});
}});
root.HEWRSAvatarV3B08SeamFit=Object.freeze({spec,repair});
})(globalThis);
