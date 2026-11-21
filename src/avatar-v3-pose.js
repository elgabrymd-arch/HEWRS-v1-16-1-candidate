/* AVATAR_V3 coordinated, garment-preserving arm posture experiment.
 * Only in the V3 review runtime. All native clothing/face/hand sources are
 * unchanged; the pose envelope is applied uniformly across composite sleeves
 * and their attached wrists. No model-generated or borrowed garment pixels.
 *
 * This is NOT a final fit approval: collars, jacket edges and cuff seams need
 * visual review against original photographs before promotion.
 */
(function(root){'use strict';
const prior=root.HEWRSAtomicRenderer, WIDTH=996,HEIGHT=2748;
const CONTROL=Object.freeze([
 [0,0],[600,0],[720,-5],[950,-24],[1100,-17],
 [1260,3],[1420,15],[1550,12],[1660,0],[HEIGHT,0]
]);
const P=Object.freeze({revision:'AVATAR_V3_ARM_POSE_CANDIDATE_1',
  left_elbow_shift:-24,right_elbow_shift:24,
  left_wrist_shift:15,right_wrist_shift:-15,
  head_unchanged_to_row:600,legs_unchanged_from_row:1660,
  sleeve_transform:'source-preserving-premultiplied-linear-cubic-fade'});
function cubic(t){return t*t*(3-2*t);}
function deltaAt(y){
 for(let i=1;i<CONTROL.length;i++){
  const [y1,v1]=CONTROL[i];if(y<=y1){
   const [y0,v0]=CONTROL[i-1],t=cubic((y-y0)/(y1-y0));
   return v0*(1-t)+v1*t;
  }
 }return 0;
}
const leftWeight=x=>x<=135?1:x>=250?0:1-cubic((x-135)/115);
const rightWeight=x=>x>=861?1:x<=746?0:cubic((x-746)/115);
const Y_PROFILE=Float32Array.from({length:HEIGHT},(_,y)=>deltaAt(y));
const X_LEFT=Float32Array.from({length:WIDTH},(_,x)=>leftWeight(x));
const X_RIGHT=Float32Array.from({length:WIDTH},(_,x)=>rightWeight(x));
function pose(frame){
 const data=frame.data,src=new Uint8ClampedArray(data),stride=WIDTH*4;
 for(let y=600;y<1660;y++){
  const shift=Y_PROFILE[y];
  if(!shift)continue;
  const off=y*stride;
  for(let x=80;x<916;x++){
   let w=0;
   if(x<250)w=X_LEFT[x];
   else if(x>746)w=X_RIGHT[x];
   if(!w)continue;
   const offset=(x<250?shift:-shift)*w;
   const sx=x-offset,ix=Math.floor(sx),t=sx-ix;
   if(ix<0||ix+1>=WIDTH)continue;
   const a=off+ix*4,b=a+4,d=off+x*4;
   const a0=src[a+3],a1=src[b+3],alpha=a0*(1-t)+a1*t;
   data[d+3]=Math.round(alpha);
   if(alpha<=.001){data[d]=data[d+1]=data[d+2]=0;continue;}
   for(let c=0;c<3;c++){
    const premul=src[a+c]*a0*(1-t)+src[b+c]*a1*t;
    data[d+c]=Math.round(premul/alpha);
   }
  }
 }
 return frame;
}
function create(visible,connection,options={}){
 if(!connection.avatarV3)throw Error('V3 arm pose requires V3 head/hand sources');
 visible.width=WIDTH;visible.height=HEIGHT;
 const ctx=visible.getContext('2d',{willReadFrequently:true});
 const off=document.createElement('canvas'),engine=prior.create(off,connection,options);
 let epoch=0,last=null;
 async function render(s){
  const token=++epoch;visible.dataset.loading='true';
  try{
   const result=await engine.render(s);
   if(token!==epoch||result?.cancelled)return {cancelled:true};
   const copy=off.getContext('2d',{willReadFrequently:true}).getImageData(0,0,WIDTH,HEIGHT);
   pose(copy);
   if(token!==epoch)return {cancelled:true};
   ctx.putImageData(copy,0,0);
   for(const k of Object.keys(visible.dataset))if(!Object.hasOwn(off.dataset,k))delete visible.dataset[k];
   Object.assign(visible.dataset,off.dataset);
   visible.dataset.loading='false';
   visible.dataset.avatarV3Pose='active';
   last=structuredClone(s);
   return {...result,avatar_pose_revision:P.revision};
  }catch(error){
   if(token===epoch){visible.dataset.loading='false';visible.dataset.status=last?'error-retained':'error-empty';}
   throw error;
  }
 }
 function cancel(){
  epoch++;engine.cancel();visible.dataset.loading='false';
  visible.dataset.status=last?'ready':'empty';
 }
 return Object.freeze({render,cancel,plan:s=>engine.plan(s),
   last:()=>last?structuredClone(last):null,
   stats:()=>({...engine.stats(),avatarV3Pose:P.revision,epoch})});
}
root.HEWRSAtomicRenderer=Object.freeze({create});
root.HEWRSAvatarV3ArmPose=Object.freeze({spec:P,controls:CONTROL,apply:pose});
})(globalThis);
