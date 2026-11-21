/* Source-preserving B15 collar registration for the AVATAR_V3 profile.
 * Only the approved jacket's upper-left collar is registered to the narrower
 * neck. Donor pixels, source descriptor and every other garment stay intact.
 */
(function(root){'use strict';
const prior=root.HEWRSRenderImageLoader;
const hash='e34e249bf344b0130e1f0b805285444758801a80a7c07b1c787687de7e36569a';
const W=996,H=2748,DX=46,L=280,P=345,R=460,Y0=375,Y1=600;
const need=(value,message)=>{if(!value)throw Error('AVATAR_V3 B15 collar: '+message);};
const spec=Object.freeze({
 revision:'AVATAR_V3_B15_COLLAR_FIT_1',source_profile:'AVATAR_V3',jacket_id:'B15',
 source_sha256:hash,width_height:Object.freeze([W,H]),bounds:Object.freeze([L,Y0,R,Y1]),
 horizontal_shift:DX,horizontal_peak:P,vertical_fade:Object.freeze([410,Y1]),
 target_tip:Object.freeze([P+DX,420]),alpha_threshold:128,
 method:'original jacket alpha contour registered to a smooth shoulder-to-neck edge',
 source_pixels_replaced:false
});
need(prior?.create,'image loader is unavailable');
need(root.HEWRSAvatarV3?.candidate?.avatar==='4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93'
 && ['INTEGRATED','REVIEW'].includes(root.HEWRSAvatarV3.kind),'registered V3 profile is required');
const smooth=t=>t*t*(3-2*t),slope=t=>6*t*(1-t);
function horizontal(x){
 if(x<=L||x>=R)return [0,0];
 if(x<P){const t=(x-L)/(P-L);return [smooth(t),slope(t)/(P-L)];}
 const t=(x-P)/(R-P);return [1-smooth(t),-slope(t)/(R-P)];
}
function vertical(y){
 if(y<=410)return [1,0];if(y>=Y1)return [0,0];
 const t=(y-410)/(Y1-410);return [1-smooth(t),-slope(t)/(Y1-410)];
}
function refit(image,descriptor){
 need(descriptor.sha256===hash,'unexpected jacket source');
 need(JSON.stringify(descriptor.rect)===JSON.stringify([0,0,W,H]),'unexpected registered jacket rectangle');
 need(image.naturalWidth===W&&image.naturalHeight===H,'unexpected jacket dimensions');
 const c=document.createElement('canvas');c.width=W;c.height=H;
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 const frame=ctx.getImageData(0,0,W,H),src=new Uint8ClampedArray(frame.data),dst=frame.data;
 const top=x=>{for(let y=Y0;y<Y1;y++)if(src[(y*W+x)*4+3]>=128)return y;throw Error('Missing source collar edge');};
 const originalLeft=top(L),targetTipX=P+DX,targetTipY=420,controls=[];
 for(let x=L;x<=P;x++){
  const y=top(x),w=vertical(y)[0],mapped=x+DX*horizontal(x)[0]*w,u=(mapped-L)/(targetTipX-L);
  const wanted=originalLeft+(targetTipY-originalLeft)*smooth(u);
  controls.push([mapped,(wanted-y)/w]);
 }
 const peak=controls.at(-1)[1];
 function dyAt(x){
  if(x<=L||x>=R)return 0;
  if(x>=targetTipX)return peak*(1-smooth((x-targetTipX)/(R-targetTipX)));
  for(let n=1;n<controls.length;n++)if(x<=controls[n][0]){
   const a=controls[n-1],b=controls[n],t=(x-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t;
  }
  return peak;
 }
 let minimumJacobian=Infinity,minimumHorizontalJacobian=Infinity,minimumVerticalJacobian=Infinity;
 for(let y=Y0;y<Y1;y++)for(let x=L;x<R;x++){
  const dy=dyAt(x);
  let low=y-45,high=y+45;
  for(let n=0;n<32;n++){const middle=(low+high)/2;if(middle+dy*vertical(middle)[0]<y)low=middle;else high=middle;}
  const sy=(low+high)/2,wy=vertical(sy),jv=1+dy*wy[1];
  low=L;high=R;
  for(let n=0;n<32;n++){const middle=(low+high)/2;if(middle+DX*horizontal(middle)[0]*wy[0]<x)low=middle;else high=middle;}
  const sx=(low+high)/2,jh=1+DX*horizontal(sx)[1]*wy[0];
  minimumJacobian=Math.min(minimumJacobian,jh*jv);minimumHorizontalJacobian=Math.min(minimumHorizontalJacobian,jh);minimumVerticalJacobian=Math.min(minimumVerticalJacobian,jv);
  const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
  const points=[(iy*W+ix)*4,(iy*W+ix+1)*4,((iy+1)*W+ix)*4,((iy+1)*W+ix+1)*4];
  const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
  const dest=(y*W+x)*4,a=points.reduce((v,q,i)=>v+src[q+3]*weights[i],0);dst[dest+3]=Math.round(a);
  for(let k=0;k<3;k++)dst[dest+k]=a?Math.round(points.reduce((v,q,i)=>v+src[q+k]*src[q+3]*weights[i],0)/a):0;
 }
 need(minimumJacobian>0,'registration folds source pixels');
 // Keep the original draw outside this rectangle; a full canvas round trip
 // could alter unrelated fractional-alpha edges on a different browser.
 ctx.putImageData(frame,0,0,L,Y0,R-L,Y1-Y0);return c;
}
root.HEWRSRenderImageLoader=Object.freeze({create(options={}){
 const decode=options.decode||((image)=>image);
 return prior.create({...options,decode:(image,descriptor)=>decode(descriptor.sha256===hash?refit(image,descriptor):image,descriptor)});
}});
root.HEWRSAvatarV3CollarFit=Object.freeze({spec});
})(globalThis);
