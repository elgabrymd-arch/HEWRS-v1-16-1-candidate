/* Issue #19: the selected jacket owns both wrist openings on AVATAR_V3.
 * This layer is installed after the approved arm-pose transform. Every
 * jacket uses its own registered lower-sleeve photograph; no shirt, other
 * jacket, generated cloth or changed hand supplies the concealed cuff.
 */
(function(root){'use strict';
const prior=root.HEWRSAtomicRenderer,W=996,H=2748;
const Y0=1180,SOURCE_END=1290,Y1=1426;
const REGIONS=Object.freeze([[20,Y0,240,Y1-Y0],[736,Y0,240,Y1-Y0]].map(Object.freeze));
const HANDS=Object.freeze(['26af452854f6f89c86617d83e9848ae71922d2ff4701877e7903f59c55ebb2b8','cfca4394b3d208184fef4f267671af834432ac2f6bd89acea83242a9e118863b']);
// Native source review identifies the left-side matte damage in these exact
// B04--B14 registrations. Their own right-sleeve interiors retain intact
// cloth. The source PNGs are never changed; source identity, not an ID/color
// fallback, controls this bounded same-garment repair.
const DAMAGED_LEFT=new Set([
 '28a9d37ad224275b1f9210e003ac2377a8e607ce4a2011696373b939eedbfb92',
 '40e10f567600af72e9f4df8431e2e34dba5983faf58929036d842997a7ac34d4',
 'ef403e9b23af535609ecd03c6cc59915a56821c6521c7c3d940d55bd22dd709b',
 '173f09f986b00d56b06062ae91d6388445245980d9bde907a1655c61f7870e05',
 '583f5629a6afb4be9543a107029bdca8d38defde3a6af907ca714209d41652ad',
 '9d02e00bfb127bac799c04bbcd2d105ffc5559a1d7369af855e8d0720fe469d4',
 '9d28b2d2d679cc0a8cb5bb0ce59a3f253ab70cdd973c1515901302baf772a2ea',
 '869889a3911d9e49d9dc98a7b60c82a27249c23d57828029cb2296e4fea5e14a',
 '57e457d9c999514da50d4197633f48e57cb02d189cf8fbe66c921316e5a43766',
 'fae2f2c297c7c88c234bc3f0a1946827dd135aa7b75a21976a3b536890abd659',
 '1066bc14207a64eb007e5354356aca34c36f02332509d57bdf2cf3647bc97f58'
]);
const spec=Object.freeze({revision:'AVATAR_V3_CONCEALED_CUFFS_2',canvas:Object.freeze([W,H]),
 bounds:REGIONS,source_rows:Object.freeze([Y0,SOURCE_END]),
 hand_source_sha256:HANDS,source_preserving:true,shirt_only:'exact_pass_through',
 method:'selected-jacket-lower-sleeve-registration-to-original-wrist-cap',
 before_approved_arm_pose:false,approved_pose_applied_once_to_sources:true,
 source_matte_repair_jackets:Object.freeze([...DAMAGED_LEFT]),
 same_jacket_interior_donor:true,other_garment_donors:false});
const need=(ok,message)=>{if(!ok)throw Error('V3 cuff fit: '+message);};
const smooth=t=>t*t*(3-2*t);
function canvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
function clear(c){c.width=c.height=1;}
function rgba(im){const c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true});try{ctx.drawImage(im,0,0);const frame=ctx.getImageData(0,0,W,H);root.HEWRSAvatarV3ArmPose.apply(frame);return frame;}finally{clear(c);}}
function sourceSleeve(data,side){
 const left=side===0,L=left?20:736,R=left?260:976,outer=[],inner=[];
 // The clean separated sleeve just above the cuff supplies the inside seam.
 // Its continuation remains the sleeve/body boundary after source cutouts
 // merge the sleeve alpha with the jacket front near the hem.
 for(let y=1060;y<=SOURCE_END;y++){
  const runs=[];let start=-1;
  for(let x=L;x<=R;x++){
   const covered=x<R&&data[(y*W+x)*4+3]>=248;
   if(covered&&start<0)start=x;
   if(!covered&&start>=0){if(x-start>=12)runs.push([start,x-1]);start=-1;}
  }
  need(runs.length,'selected jacket has no source sleeve');
  const run=left?runs[0]:runs.at(-1),o=left?run[0]:run[1];
  outer[y]=o;
  if(left?run[1]<R-8:run[0]>L+8)inner[y]=left?run[1]:run[0];
 }
 const anchors=[];
 for(let y=1060;y<=Y0;y++)if(Number.isFinite(inner[y]))anchors.push([y,inner[y]]);
 need(anchors.length>=16,'selected jacket has no separated sleeve seam');
 const tail=anchors.slice(-30),meanY=tail.reduce((a,b)=>a+b[0],0)/tail.length,
  meanX=tail.reduce((a,b)=>a+b[1],0)/tail.length;
 const divisor=tail.reduce((a,b)=>a+(b[0]-meanY)**2,0);
 const slope=Math.max(-.3,Math.min(.3,tail.reduce((a,b)=>a+(b[0]-meanY)*(b[1]-meanX),0)/divisor));
 const last=anchors.at(-1);
 for(let y=1060;y<Y1;y++){
  if(!Number.isFinite(inner[y]))inner[y]=last[1]+slope*(y-last[0]);
  if(!Number.isFinite(outer[y]))outer[y]=outer[SOURCE_END]+(outer[SOURCE_END]-outer[SOURCE_END-20])*(y-SOURCE_END)/20;
  need(left?inner[y]-outer[y]>50:outer[y]-inner[y]>50,'invalid selected sleeve width');
 }
 return {outer,inner,seam_slope:slope,source_seam_anchor:last};
}
function cap(data,side){
 const candidates=[];
 for(let x=side===0?80:716;x<(side===0?280:916);x++){
  let y=1330;while(y<1400&&data[(y*W+x)*4+3]<128)y++;
  if(y<=1395)candidates.push(x);
 }
 const x0=Math.min(...candidates),x1=Math.max(...candidates),first=[];
 need(x1-x0>=85&&x1-x0<=125,'approved posed wrist width differs');
 for(let x=x0;x<=x1;x++){
  let y=1330;while(y<1410&&data[(y*W+x)*4+3]<128)y++;
  first.push(Math.min(1398,y+2));
 }
 const edge=first.map((_,i)=>{
  const a=first.slice(Math.max(0,i-2),Math.min(first.length,i+3));
  return a.reduce((sum,n)=>sum+n,0)/a.length;
 });
 need(Math.min(...edge)>1350&&Math.min(...edge)<1390,'V3 wrist cap is not registered');
 return {x0,x1,edge,top:Math.min(...edge),bottom:Math.max(...edge)};
}
function sample(data,x,y,dst,at,coverage=1){
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const p=[(iy*W+ix)*4,(iy*W+ix+1)*4,((iy+1)*W+ix)*4,((iy+1)*W+ix+1)*4];
 const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
 const alpha=p.reduce((n,q,i)=>n+data[q+3]*weights[i],0);
 dst[at+3]=Math.round(alpha*coverage);
 for(let k=0;k<3;k++)dst[at+k]=alpha?Math.round(p.reduce((n,q,i)=>n+data[q+k]*data[q+3]*weights[i],0)/alpha):0;
}
function clothTone(data,geometry,left,a,b){
 const sum=[0,0,0];let count=0;
 for(let y=Y0;y<=SOURCE_END;y+=3){
  const l=left?geometry.outer[y]:geometry.inner[y],r=left?geometry.inner[y]:geometry.outer[y];
  for(let x=Math.ceil(l+(r-l)*a);x<l+(r-l)*b;x+=2){const i=(y*W+x)*4;if(data[i+3]<248)continue;for(let k=0;k<3;k++)sum[k]+=data[i+k];count++;}
 }
 need(count>100,'no clean same-jacket cloth tone samples');return sum.map(n=>n/count);
}
function fitted(jacket,hands,sourceHash){
 const j=rgba(jacket),h=hands.map(rgba),c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true}),patch=ctx.createImageData(W,H),details=[];
 const geometries=[sourceSleeve(j.data,0),sourceSleeve(j.data,1)],repairLeft=DAMAGED_LEFT.has(sourceHash);
 const cleanTone=repairLeft?clothTone(j.data,geometries[0],true,.3,.5):null,
  donorTone=repairLeft?clothTone(j.data,geometries[1],false,.16,.84):null,
  tone=repairLeft?cleanTone.map((v,k)=>Math.max(-36,Math.min(36,v-donorTone[k]))):null;
 for(let side=0;side<2;side++){
  const left=side===0,source=geometries[side],wrist=cap(h[side].data,side),[L,,width]=REGIONS[side],R=L+width;
  const interior=new Uint8ClampedArray(4);
  const donorLeft=left?source.outer[Y0]:source.inner[Y0],donorRight=left?source.inner[Y0]:source.outer[Y0];
  for(let y=Y0;y<Y1;y++)for(let x=L;x<R;x++){
   const i=(y*W+x)*4;
   // Keep the selected jacket front on the torso side of its source seam.
   // The old sleeve, cutout remnants and every source shirt cuff are absent.
   if(left?x>source.inner[y]+1:x<source.inner[y]-1){
    patch.data.set(j.data.subarray(i,i+4),i);
   }
  }
  const bottom=wrist.bottom;
  for(let y=Y0;y<=Math.ceil(bottom);y++){
   const t=Math.max(0,Math.min(1,(y-Y0)/(bottom-Y0))),weight=smooth(t);
   const l=donorLeft+(wrist.x0-donorLeft)*weight,r=donorRight+(wrist.x1-donorRight)*weight;
   for(let x=Math.floor(l);x<=Math.ceil(r);x++){
    const u=Math.max(0,Math.min(1,(x+.5-l)/(r-l))),position=u*(wrist.edge.length-1),n=Math.floor(position),f=position-n;
    const hem=wrist.edge[n]*(1-f)+wrist.edge[Math.min(n+1,wrist.edge.length-1)]*f;
    const coverage=Math.max(0,Math.min(1,x+1-l,r-x,hem-y));if(!coverage)continue;
    const sy=Y0+(y-Y0)*(SOURCE_END-Y0)/(hem-Y0),iy=Math.floor(sy),fy=sy-iy;
    const interpolate=a=>a[iy]*(1-fy)+a[Math.min(SOURCE_END,iy+1)]*fy;
    const a=interpolate(left?source.outer:source.inner),b=interpolate(left?source.inner:source.outer);
    // Interior sampling avoids propagating translucent source matte pixels.
    const sx=a+.6+u*Math.max(1,b-a-1.2),i=(y*W+x)*4;
    sample(j.data,sx,sy,patch.data,i,coverage);
    if(left&&repairLeft){
     const donor=geometries[1],dl=interpolate(donor.inner),dr=interpolate(donor.outer),dx=dl+(dr-dl)*(.16+.68*u);
     sample(j.data,dx,sy,interior,0,coverage);
     const blend=smooth(Math.min(1,(y-Y0)/34));
     for(let k=0;k<3;k++)patch.data[i+k]=patch.data[i+k]*(1-blend)+Math.max(0,Math.min(255,interior[k]+tone[k]))*blend;
     patch.data[i+3]=patch.data[i+3]*(1-blend)+interior[3]*blend;
    }
   }
  }
  details.push({side:left?'left':'right',source_sha256:null,bounds:REGIONS[side],
   source_top:[donorLeft,Y0,donorRight,Y0],source_bottom_row:SOURCE_END,
   source_seam_anchor:source.source_seam_anchor,source_seam_slope:source.seam_slope,
   wrist_cap:[wrist.x0,wrist.top,wrist.x1,wrist.bottom],
   interior_repair:left&&repairLeft?{same_jacket_source_side:'right',horizontal_range:[.16,.84],
    source_matched_rgb_delta:tone,top_transition_rows:34}:null});
 }
 ctx.putImageData(patch,0,0);
 // Original approved hands receive the exact approved pose once. Copy the
 // resulting source pixels, never a second pose, fitted or repainted hand.
 for(const hand of h){const hc=canvas();hc.getContext('2d').putImageData(hand,0,0);ctx.drawImage(hc,0,0);clear(hc);}
 const result=REGIONS.map(([x,y,w,h])=>ctx.getImageData(x,y,w,h));clear(c);
 return {regions:result,details};
}
function create(visible,connection,options={}){
 need(connection.avatarV3?.hands?.join(',')===HANDS.join(','),'approved V3 hands are required');
 visible.width=W;visible.height=H;const vc=visible.getContext('2d',{willReadFrequently:true}),off=canvas(),engine=prior.create(off,connection,options);
 const loads=root.HEWRSRenderImageLoader.create({limit:5,resolveUrl:options.resolveUrl,width:W,height:H,missing:'Selected jacket/wrist source did not load'}),cache=new Map();
 let epoch=0,last=null;
 function garment(s){
  if(connection.shirtOnlyConnection.isShirtOnly(s)||s.state==='REFERENCE')return null;
  if(connection.blazerConnection.isBlazer(s)){
   const b=connection.blazerConnection.knownBlazer(s.blazerId),j=b.assembly?.jacket||b.checkpoint_layer;
   return {id:s.blazerId,jacket:j,hands:connection.blazerConnection.data.assembly.hands};
  }
  const m=connection.assemblies.forSelection(s.suitId,s.shoeId,s.shirtId);
  return {id:s.suitId,jacket:m.static.jacket,hands:[m.static.left_hand,m.static.right_hand]};
 }
 async function correction(p){
  const key=p.jacket.sha256+'|'+p.hands.map(h=>h.sha256).join('|');
  if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
  need(p.hands.map(h=>h.sha256).join(',')===HANDS.join(','),'unapproved hand source');
  for(const d of [p.jacket,...p.hands])need(d.rect?.join(',')==='0,0,996,2748'&&Object.hasOwn(connection.assetPaths,d.sha256),'unbound garment source');
  const images=await Promise.all([p.jacket,...p.hands].map(d=>loads.load(d))),value=fitted(images[0],images.slice(1),p.jacket.sha256);
  value.jacket_id=p.id;value.source_sha256=p.jacket.sha256;for(const d of value.details)d.source_sha256=p.jacket.sha256;
  cache.set(key,value);while(cache.size>2)cache.delete(cache.keys().next().value);return value;
 }
 async function render(input){
  const token=++epoch;loads.cancel();visible.dataset.loading='true';
  try{
   const result=await engine.render(input);if(token!==epoch||result?.cancelled)return {cancelled:true};
   const selected=connection.validateSelection(input),p=garment(selected),patch=p?await correction(p):null;
   if(token!==epoch)return {cancelled:true};
   const frame=off.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H);vc.putImageData(frame,0,0);
   if(patch)for(let n=0;n<REGIONS.length;n++)vc.putImageData(patch.regions[n],REGIONS[n][0],REGIONS[n][1]);
   for(const key of Object.keys(visible.dataset))if(!Object.hasOwn(off.dataset,key))delete visible.dataset[key];
   Object.assign(visible.dataset,off.dataset,{loading:'false'});
   if(patch)visible.dataset.avatarV3Cuffs='concealed';else delete visible.dataset.avatarV3Cuffs;
   last=structuredClone(selected);return {...result,cuff_fit_revision:patch?spec.revision:null};
  }catch(error){
   if(token!==epoch)return {cancelled:true};
   visible.dataset.loading='false';visible.dataset.status=last?'error-retained':'error-empty';throw error;
  }
 }
 function cancel(){epoch++;engine.cancel();loads.cancel();visible.dataset.loading='false';visible.dataset.status=last?'ready':'empty';}
 return Object.freeze({render,cancel,plan:s=>engine.plan(s),last:()=>last?structuredClone(last):null,
  stats:()=>({...engine.stats(),avatarV3CuffFit:{revision:spec.revision,cache_size:cache.size,
   jackets:[...cache.values()].map(x=>({jacket_id:x.jacket_id,source_sha256:x.source_sha256,wrists:x.details}))},epoch})});
}
need(prior?.create&&root.HEWRSRenderImageLoader?.create,'renderer dependencies unavailable');
need(root.HEWRSAvatarV3ArmPose?.spec?.revision==='AVATAR_V3_ARM_POSE_CANDIDATE_1','install after the approved arm pose');
root.HEWRSAtomicRenderer=Object.freeze({create});
root.HEWRSAvatarV3CuffFit=Object.freeze({spec});
})(globalThis);
