/* S06 display contours. Keep the immutable garment, fabric and avatar sources.
 * The inherited S05 neck mask ends at x687 inside S06's shoulder. Give this
 * selected suit a continuous mask transition, then antialias only its outer
 * shoulder/sleeve and arm-gap boundaries after the approved pose. Fabric
 * interiors are never blurred. The gap remains background, not new cloth.
 */
(function(root){'use strict';
const W=996,H=2748,JACKET='65ba3284276b3b99c1ec53e4bcd0bec6c5abaed2ca6dd7c19cf04d52440a6935';
const MASK='c100c1ed484446a8b41d0a677c7e695a7a30daa331bdb33483105246c4509545';
const priorConnection=root.HEWRSCleanConnection,priorLoader=root.HEWRSRenderImageLoader,priorRenderer=root.HEWRSAtomicRenderer;
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const spec=freeze({revision:'S06_CONTINUOUS_SHOULDER_AND_ARM_EDGES_1',garment_id:'S06',
 source_sha256:JACKET,inherited_mask_sha256:MASK,canvas:[W,H],
 mask_bounds:[620,410,100,90],edge_bounds:[[60,460,280,720],[660,460,300,720]],
 bounds:[[620,410,100,90],[60,460,280,720],[660,460,300,720]],
 shoulder_transition:{from:[620,429.5],to:[720,468.5],start_slope:.53,end_slope:.4},
 edge_radius:{horizontal:4,vertical:4,arm_gap_vertical:12},maximum_donor_distance:6,source_files_changed:false,
 original_material_alpha:'unchanged',avatar_and_pose:'unchanged',
 display_alpha:'bounded_contour_correction',fabric_interior:'exact_no_rgb_filter',
 wrist_boundary:'fade_to_unchanged_before_native_row_1180'});
const need=(ok,message)=>{if(!ok)throw Error('S06 contours: '+message);};
need(priorConnection?.create&&priorLoader?.create&&priorRenderer?.create&&!root.HEWRSS06Contours,'install once after Issue22 materials');
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
function canvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
function correctedMask(image,descriptor){
 need(descriptor.sha256===MASK&&descriptor.s06_contour_mask===JACKET,'unexpected source mask');
 need(descriptor.rect?.join(',')==='0,0,996,2748','mask rectangle changed');
 const c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 const [left,top,width,height]=spec.mask_bounds,pixels=ctx.getImageData(left,top,width,height);
 const a=spec.shoulder_transition,span=a.to[0]-a.from[0];
 for(let x=0;x<width;x++){
  const t=x/span,t2=t*t,t3=t2*t;
  const edge=(2*t3-3*t2+1)*a.from[1]+(t3-2*t2+t)*span*a.start_slope+
   (-2*t3+3*t2)*a.to[1]+(t3-t2)*span*a.end_slope;
  for(let y=0;y<height;y++){const q=(y*width+x)*4;pixels.data[q+3]=Math.round(255*clamp(top+y+.5-edge));}
 }
 ctx.putImageData(pixels,left,top);return c;
}
function connect(...args){
 const base=priorConnection.create(...args),assemblies=base.assemblies;
 need(base.avatarV3?.sha256==='4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93','approved V3 avatar required');
 function forSelection(suitId,...rest){
  const result=assemblies.forSelection(suitId,...rest);if(suitId!=='S06')return result;
  need(result.static.jacket.sha256===JACKET&&result.static.jacket.display_alpha_mask?.sha256===MASK,'S06 source or inherited mask changed');
  const copy=structuredClone(result);copy.static.jacket.display_alpha_mask.s06_contour_mask=JACKET;return copy;
 }
 return Object.freeze({...base,assemblies:Object.freeze({...assemblies,forSelection}),s06Contours:spec});
}
root.HEWRSCleanConnection=Object.freeze({...priorConnection,create:connect});
root.HEWRSRenderImageLoader=Object.freeze({create(options={}){
 const loader=priorLoader.create(options),masks=new WeakMap();
 async function load(descriptor){
  if(descriptor.s06_contour_mask)need(descriptor.sha256===MASK&&descriptor.s06_contour_mask===JACKET&&descriptor.rect?.join(',')==='0,0,996,2748','unexpected selected mask binding');
  const image=await loader.load(descriptor);if(!descriptor.s06_contour_mask)return image;
  // The raw shared mask stays in the existing cache. The selected S06
  // variant is separately cached by decoded-image identity, so alternating
  // S05/S06 cannot reuse the wrong cutout or poison another suit's loader.
  if(!masks.has(image))masks.set(image,correctedMask(image,descriptor));return masks.get(image);
 }
 return Object.freeze({load,cancel:()=>loader.cancel(),get size(){return loader.size;},get pending(){return loader.pending;}});
}});
const K=[1,8,28,56,70,56,28,8,1];
function antialias(frame){
 const original=new Uint8ClampedArray(frame.data),data=frame.data;
 const y0=448,y1=1192,horizontal=new Float32Array((y1-y0)*W);
 for(let y=y0;y<y1;y++)for(let x=56;x<964;x++){
  let sum=0;for(let k=-4;k<=4;k++)sum+=original[(y*W+x+k)*4+3]*K[k+4];horizontal[(y-y0)*W+x]=sum/256;
 }
 let alphaChanges=0,newCoverage=0,edgeColorRepairs=0,maximumAlphaChange=0;
 for(const [left,top,width,height]of spec.edge_bounds)for(let y=top;y<top+height;y++)for(let x=left;x<left+width;x++){
  const q=(y*W+x)*4,old=original[q+3];let blurred=0;
  const armGap=y>=865&&((x>=205&&x<275)||(x>=745&&x<830));
  if(armGap){for(let k=-12;k<=12;k++)blurred+=horizontal[(y+k-y0)*W+x]*(13-Math.abs(k));blurred/=169;}
  else{for(let k=-4;k<=4;k++)blurred+=horizontal[(y+k-y0)*W+x]*K[k+4];blurred/=256;}
  // Sharpen the smoothed coverage back to a narrow antialiased edge. A
  // broad photographic blur would erase the approved check and is excluded.
  const wanted=255*clamp((blurred-64)/127);
  const weight=smooth(Math.min(1,(x-left+.5)/8,(left+width-x-.5)/8,(y-top+.5)/12,(top+height-y-.5)/16));
  const alpha=Math.round(old+(wanted-old)*weight);if(alpha===old)continue;
  if(alpha>0&&(old<248||alpha<255)){
   let donor=-1,best=Infinity;
   for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){
    const distance=dx*dx+dy*dy;if(distance>36||distance>=best)continue;
    const p=((y+dy)*W+x+dx)*4;
    if(original[p+3]>=248&&original[p-4+3]>=248&&original[p+4+3]>=248&&original[p-W*4+3]>=248&&original[p+W*4+3]>=248){donor=p;best=distance;}
   }
   // A tiny isolated translucent speck is not evidence of a cloth donor.
   if(donor<0){if(old===0)continue;}
   else{for(let k=0;k<3;k++)data[q+k]=original[donor+k];edgeColorRepairs++;if(old===0)newCoverage++;}
  }
  data[q+3]=alpha;if(!alpha)data[q]=data[q+1]=data[q+2]=0;
  alphaChanges++;maximumAlphaChange=Math.max(maximumAlphaChange,Math.abs(alpha-old));
 }
 return {edge_filter_alpha_changed_pixels:alphaChanges,new_boundary_coverage_pixels:newCoverage,boundary_color_repaired_pixels:edgeColorRepairs,maximum_edge_filter_alpha_change:maximumAlphaChange};
}
function create(visible,connection,options={}){
 const off=canvas(),engine=priorRenderer.create(off,connection,options),ctx=visible.getContext('2d',{willReadFrequently:true});
 visible.width=W;visible.height=H;let epoch=0,last=null;
 async function render(selection){
  const token=++epoch;visible.dataset.loading='true';
  try{
   const result=await engine.render(selection);if(token!==epoch||result?.cancelled)return {cancelled:true};
   const frame=off.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H);
   const details=selection.suitId==='S06'?antialias(frame):null;
   if(token!==epoch)return {cancelled:true};ctx.putImageData(frame,0,0);
   for(const key of Object.keys(visible.dataset))if(!Object.hasOwn(off.dataset,key))delete visible.dataset[key];
   Object.assign(visible.dataset,off.dataset,{loading:'false'});last=structuredClone(selection);
   return details?{...result,s06_contours:{revision:spec.revision,bounds:spec.bounds,...details}}:result;
  }catch(error){if(token!==epoch)return {cancelled:true};visible.dataset.loading='false';visible.dataset.status=last?'error-retained':'error-empty';throw error;}
 }
 function cancel(){epoch++;engine.cancel();visible.dataset.loading='false';visible.dataset.status=last?'ready':'empty';}
 function plan(selection){const p=engine.plan(selection);if(selection.suitId!=='S06')return p;return Object.assign(Array.isArray(p)?Object.assign(p.slice(),p):{...p},{s06_contours:spec});}
 return Object.freeze({render,cancel,plan,last:()=>last?structuredClone(last):null,stats:()=>({...engine.stats(),s06Contours:spec.revision,epoch})});
}
root.HEWRSAtomicRenderer=Object.freeze({...priorRenderer,create});
root.HEWRSS06Contours=Object.freeze({spec,antialias,correctedMask});
})(globalThis);
