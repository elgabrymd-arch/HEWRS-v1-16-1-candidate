/* AVATAR_V3 neckline fitting. Original garment files and identifiers remain
 * immutable. Only the selected shirt's own registered cloth supplies its
 * neckline; the selected jacket remains the final occluder. The original
 * approved avatar is composited without resampling or geometry changes.
 */
(function(root){'use strict';
const prior=root.HEWRSAtomicRenderer,W=996,H=2748;
const X=330,Y=355,CW=336,CH=260,BOTTOM=Y+CH;
const BACKING_BOTTOM=850,BACKING_HEIGHT=BACKING_BOTTOM-Y;
const SHOULDER_Y=350,SHOULDER_HEIGHT=250;
const B02_SOURCE='a28e524a79fe8c0699e6cf19a819b29ce7be99d7616706669259b469db467095';
const IDS=Object.freeze(Array.from({length:51},(_,n)=>'DS'+String(n+1).padStart(3,'0')).filter(id=>id!=='DS049'));
const SPEC=Object.freeze({revision:'AVATAR_V3_ALL_SHIRT_COLLAR_FIT_6',active_ids:IDS,
 bounds:Object.freeze([X,Y,CW,CH]),native_canvas:Object.freeze([W,H]),jacket_lower_opening_backing_bounds:Object.freeze([422,615,153,235]),
 jacket_outer_shoulder_bounds:Object.freeze([[0,350,330,250],[666,350,330,250]]),jacket_inner_shoulder_neck_distance:50,
 jacket_neckline_display_masks:Object.freeze({B02:Object.freeze({source_sha256:B02_SOURCE,contour_source:'continuousShirts.jacket_masks.B02.erase_contours',active_shirt_scope:'all50',geometry:'unchanged_existing_source_bound_foreign_strip_contour'})}),
 neckband_reveal:7,knot_anchor:Object.freeze([498,467]),
 method:'continuous selected-shirt-source collar registration to selected jacket neck',
 modified_strips:Object.freeze([[330,355,92,260],[575,355,91,260]]),top_center_bounds:Object.freeze([422,420,153,47]),tied_neck_corner_cleanup:Object.freeze([[422,401,19,19],[560,405,15,15]]),shirt_only_body_contour_bounds:Object.freeze([[330,420,92,195],[575,420,91,195]]),shirt_only_body_contour_leaf_guard:Object.freeze({opaque_body_alpha:255,front_leaf_alpha_below:128}),shirt_only_body_contour_method:'original_body_coverage_outside_avatar_preserving_leaf_core_opaque_composite_and_tie',shirt_only_enclosed_join_method:'eight_connected_interior_backing_with_same_shirt_cloth_after_body_restoration',lower_center_backing_bounds:Object.freeze([422,530,153,85]),protected_knot_corridor:Object.freeze([422,467,153,63]),tie_pixel_preservation:'exact_opaque_and_knot_pixels_partial_foreground_contribution_preserved_under_enclosed_backing',original_sources_modified:false,avatar_geometry_modified:false});
const need=(v,m)=>{if(!v)throw Error('V3 shirt collar: '+m);};
function canvas(w=W,h=H){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function release(c){c.width=c.height=1;}
function alphaPlane(pixels){const alpha=new Uint8ClampedArray(CW*CH);for(let i=0;i<alpha.length;i++)alpha[i]=pixels.data[i*4+3];return alpha;}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function create(visible,connection,options={}){
 need(connection.avatarV3?.sha256==='4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93','approved V3 avatar required');
 const collars=new Map();let epoch=0,last=null,lastFit=null;
 function captureShirtCloth(ctx,p){
  need(p?.garment?.body?.type==='mesh'&&p.garment.body.source?.sha256,'unregistered continuous cloth callback');
  const key=[p.selection.shirtId,p.selection.state==='NO_TIE'?'no_tie':'tied','continuous'].join('/');
  const pixels=ctx.getImageData(X,Y,CW,CH);
  collars.delete(key);collars.set(key,{pixels,backingPixels:ctx.getImageData(X,Y,CW,BACKING_HEIGHT),outerShoulderPixels:ctx.getImageData(0,SHOULDER_Y,W,SHOULDER_HEIGHT),bodyPixels:pixels,bodyAlpha:alphaPlane(pixels),leafAlpha:null,bodyHash:p.garment.body.source.sha256,leafHashes:[],hashes:[p.garment.body.source.sha256],capture:'raw_registered_body_before_avatar_tie_jacket'});
  while(collars.size>12)collars.delete(collars.keys().next().value);
 }
 const off=canvas(),engine=prior.create(off,connection,{...options,captureShirtCloth});
 visible.width=W;visible.height=H;const vc=visible.getContext('2d',{willReadFrequently:true});
 const loads=root.HEWRSRenderImageLoader.create({limit:12,resolveUrl:options.resolveUrl,width:W,height:H,missing:'Selected collar source failed to load',dimensions:'Selected collar source dimensions differ'});
 const list=d=>d?[d,...(d.display_alpha_mask?[d.display_alpha_mask]:[])]:[];
 function garmentPlan(s,p){
  const continuous=connection.continuousShirts.ids.includes(s.shirtId),mode=s.state==='NO_TIE'?'no_tie':'tied';
  const topwear=s.suitId||s.blazerId||null;
  const avatar=connection.manifest.static.avatar;
  let jacket=p.jacket||null,tie=p.tie||null,parts=[];
  if(Array.isArray(p)){const m=connection.assemblies.forSelection(s.suitId,s.shoeId,s.shirtId),r=m.shirts[s.shirtId].states[mode];jacket=m.static.jacket;tie=s.state==='NO_TIE'?null:m.ties[s.state].display_layer;parts=[r.body,r.left,r.right].filter(Boolean);}
  else if(!continuous){parts=[p.body,...(p.leaves||[])].filter(Boolean);need(parts.length>0,'unrecognized selected shirt source route');}
  let jacketMask=continuous?p.jacketMask||null:null;
  if(topwear==='B02'){
   const approved=connection.continuousShirts.jacket_masks?.B02;
   need(jacket?.sha256===B02_SOURCE&&approved?.source_sha256===B02_SOURCE&&approved.erase_contours,'B02 neckline mask is not bound to its original photograph');
   // This exact contour already identifies the foreign ribbed strip in B02.
   // Reuse only its erase geometry for legacy shirts; their original photo
   // files and the selected jacket's remaining navy cloth are unchanged.
   if(!jacketMask)jacketMask={source_sha256:B02_SOURCE,erase_contours:approved.erase_contours};
   else need(JSON.stringify(jacketMask.erase_contours)===JSON.stringify(approved.erase_contours),'B02 plan differs from its approved neckline contour');
  }
  return {continuous,mode,topwear,avatar,jacket,tie,parts,jacketMask,source_profile:s.suitId?'suit':'non-suit'};
 }
 async function loadAll(descriptors){const unique=[...new Map(descriptors.map(d=>[d.sha256,d])).values()],images=await Promise.all(unique.map(d=>loads.load(d)));return new Map(unique.map((d,i)=>[d.sha256,images[i]]));}
 function draw(ctx,d,images,height=CH){if(!d)return;const image=images.get(d.sha256);need(image,'missing registered source '+d.sha256);if(!d.display_alpha_mask){ctx.drawImage(image,-X,-Y);return;}
  const c=canvas(CW,height),cc=c.getContext('2d');cc.drawImage(image,-X,-Y);cc.globalCompositeOperation='destination-in';cc.drawImage(images.get(d.display_alpha_mask.sha256),-X,-Y);ctx.drawImage(c,0,0);release(c);
 }
 function drawShoulder(ctx,d,images){if(!d)return;const image=images.get(d.sha256);need(image,'missing original shoulder source '+d.sha256);
  if(!d.display_alpha_mask){ctx.drawImage(image,0,-SHOULDER_Y);return;}
  const c=canvas(W,SHOULDER_HEIGHT),cc=c.getContext('2d');cc.drawImage(image,0,-SHOULDER_Y);
  cc.globalCompositeOperation='destination-in';cc.drawImage(images.get(d.display_alpha_mask.sha256),0,-SHOULDER_Y);ctx.drawImage(c,0,0);release(c);
 }
 function drawJacket(ctx,fit,images,shoulder=false){
  if(!fit.jacket)return;
  const mask=fit.jacketMask,paint=()=>shoulder?drawShoulder(ctx,fit.jacket,images):draw(ctx,fit.jacket,images);
  if(!mask?.keep_contours&&!mask?.erase_contours){paint();return;}
  need(mask.source_sha256===fit.jacket.sha256,'selected jacket geometry belongs to another source');
  const ox=shoulder?0:X,oy=shoulder?SHOULDER_Y:Y;
  const path=contours=>{ctx.beginPath();for(const points of contours){ctx.moveTo(points[0][0]-ox,points[0][1]-oy);for(const point of points.slice(1))ctx.lineTo(point[0]-ox,point[1]-oy);ctx.closePath();}};
  // Preserve the original continuous renderer's registered jacket surface:
  // keep clip, original bitmap/display mask, then the approved erase clip.
  // Build each fresh crop from this plan; masked and unmasked routes never
  // share a cached effective jacket, even when their photograph is the same.
  ctx.save();
  if(mask.keep_contours){path(mask.keep_contours);ctx.clip('evenodd');}
  paint();ctx.restore();
  if(mask.erase_contours){ctx.save();ctx.globalCompositeOperation='destination-out';path(mask.erase_contours);ctx.fill('evenodd');ctx.restore();}
 }
 function cleanNativeMatte(ctx,fit,images,shirtId){
  // These four solid dark shirts share a registered-photo matte defect:
  // opaque white background survives at the outer body collar edge. Their
  // clean, original collar leaves supply the replacement pixels. Patterned
  // garments and all original image files are deliberately unaffected.
  if(!['DS012','DS032','DS033','DS046'].includes(shirtId))return 0;
  const c=canvas(CW,CH),cc=c.getContext('2d',{willReadFrequently:true});for(const d of fit.parts.slice(1))draw(cc,d,images);
  const leaf=cc.getImageData(0,0,CW,CH).data,body=ctx.getImageData(0,0,CW,CH),data=body.data;
  const at=(x,y)=>((y-Y)*CW+x-X)*4,rows=[[],[]];
  for(let side=0;side<2;side++)for(let y=Y;y<490;y++){
   const xs=[];for(let x=side?575:350;x<(side?650:422);x++){const q=at(x,y);if(leaf[q+3]>=248&&Math.max(leaf[q],leaf[q+1],leaf[q+2])<100)xs.push(x);}
   if(xs.length)rows[side].push({y,xs});
  }
  let repaired=0;
  for(let side=0;side<2;side++)for(let y=Y;y<490;y++)for(let x=side?575:350;x<(side?650:422);x++){
   const q=at(x,y),low=Math.min(data[q],data[q+1],data[q+2]),high=Math.max(data[q],data[q+1],data[q+2]);
   if(!data[q+3]||low<100||high-low>65||!rows[side].length)continue;
   const row=rows[side].reduce((a,b)=>Math.abs(b.y-y)<Math.abs(a.y-y)?b:a,rows[side][0]),sx=row.xs.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a,row.xs[0]),source=at(sx,row.y),mix=clamp((low-85)/45,0,1);
   for(let k=0;k<3;k++)data[q+k]=Math.round(data[q+k]*(1-mix)+leaf[source+k]*mix);repaired++;
  }
  ctx.putImageData(body,0,0);release(c);return repaired;
 }
 async function selectedCloth(s,p,fit,token){
  const key=[s.shirtId,fit.mode,fit.continuous?'continuous':fit.source_profile].join('/');
  if(collars.has(key)){const entry=collars.get(key);collars.delete(key);collars.set(key,entry);return entry;}
  const c=canvas(CW,BACKING_HEIGHT),ctx=c.getContext('2d',{willReadFrequently:true});let hashes=[],matteRepairs=0,bodyPixels=null,bodyAlpha=null,leafAlpha=null,outerShoulderPixels=null;
  if(fit.continuous){release(c);throw Error('V3 shirt collar: raw registered cloth capture is unavailable');
  }else{const images=await loadAll(fit.parts.flatMap(list));if(token!==epoch){release(c);return null;}
   const outer=canvas(W,SHOULDER_HEIGHT),outerContext=outer.getContext('2d',{willReadFrequently:true});
   for(const d of fit.parts)drawShoulder(outerContext,d,images);outerShoulderPixels=outerContext.getImageData(0,0,W,SHOULDER_HEIGHT);release(outer);
   draw(ctx,fit.parts[0],images,BACKING_HEIGHT);bodyPixels=ctx.getImageData(0,0,CW,CH);bodyAlpha=alphaPlane(bodyPixels);
   const leaves=canvas(CW,CH),lc=leaves.getContext('2d',{willReadFrequently:true});
   for(const d of fit.parts.slice(1)){draw(ctx,d,images,BACKING_HEIGHT);draw(lc,d,images);}leafAlpha=alphaPlane(lc.getImageData(0,0,CW,CH));release(leaves);
   matteRepairs=cleanNativeMatte(ctx,fit,images,s.shirtId);hashes=fit.parts.map(d=>d.sha256);
  }
  const pixels=ctx.getImageData(0,0,CW,CH),backingPixels=ctx.getImageData(0,0,CW,BACKING_HEIGHT);release(c);const entry={pixels,backingPixels,outerShoulderPixels,hashes,matteRepairs,bodyPixels,bodyAlpha,leafAlpha,bodyHash:fit.parts[0].sha256,leafHashes:fit.parts.slice(1).map(d=>d.sha256)};collars.set(key,entry);while(collars.size>12)collars.delete(collars.keys().next().value);return entry;
 }
 function fitPatch(frame,cloth,fit,images){
  const avatar=canvas(CW,CH),ac=avatar.getContext('2d',{willReadFrequently:true});draw(ac,fit.avatar,images);const av=ac.getImageData(0,0,CW,CH).data;
  const jacket=canvas(CW,CH),jc=jacket.getContext('2d',{willReadFrequently:true});drawJacket(jc,fit,images);const ja=jc.getImageData(0,0,CW,CH).data;
  const tieMask=canvas(CW,CH),tc=tieMask.getContext('2d',{willReadFrequently:true});draw(tc,fit.tie,images);const ta=tc.getImageData(0,0,CW,CH).data;
  const raw=cloth.pixels.data,clean=new Uint8ClampedArray(raw),boundaries=[[],[]],tops=[];
  const index=(x,y)=>((y-Y)*CW+x-X)*4;
  const alpha=(data,x,y)=>x>=X&&x<X+CW&&y>=Y&&y<BOTTOM?data[index(x,y)+3]:0;
  for(let y=Y;y<BOTTOM;y++){
   let l=-1,r=-1;for(let x=X;x<X+CW;x++)if(alpha(av,x,y)>=128){if(l<0)l=x;r=x;}
   need(l>=0&&r>l,'missing approved neck contour');boundaries[0].push(l);boundaries[1].push(r);
  }
  // Derive each rear stand from the actual selected jacket, including its
  // asymmetric collar. A seven-pixel reveal is approximately 2.7 px at 390px.
  for(let side=0;side<2;side++){
   let top=405;
   if(fit.jacket){let found=false;for(let y=Y+7;y<452&&!found;y++){
    const edge=boundaries[side][y-Y];for(let x=edge-28;x<=edge+28;x++)if(alpha(ja,x,y)>=200){top=y-7;found=true;break;}
   }need(found,'selected jacket has no neck registration');}
   tops.push(top);
  }
  // Suppress narrow alpha spikes on the exterior contour. Inside shirt cloth
  // and its photographic checks/stripes are retained; no color is invented.
  let cleaned=0;
  for(let y=Y+2;y<BOTTOM-2;y++)for(let x=X+2;x<X+CW-2;x++){
   const q=index(x,y);if(!raw[q+3])continue;
   let occupied=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(alpha(raw,x+dx,y+dy)>=192)occupied++;
   if(y<475&&occupied<13){const keep=clamp((occupied-5)/8,0,1);clean[q+3]=Math.round(raw[q+3]*keep);if(clean[q+3]!==raw[q+3])cleaned++;}
   if(clean[q+3]===0)clean[q]=clean[q+1]=clean[q+2]=0;
  }
  // Register each photographed collar peak to the actual jacket neck. One
  // continuous cloth warp supplies both the front and the rear reveal, so
  // there is no independently pasted strip or color discontinuity.
  const peaks=[0,1].map(side=>{
   const lo=side?575:350,hi=side?650:422;
   for(let y=Y+2;y<475;y++){
    const xs=[];for(let x=lo+1;x<hi-1;x++)if(alpha(clean,x,y)>=192&&alpha(clean,x-1,y)>=128&&alpha(clean,x+1,y)>=128)xs.push(x);
    if(xs.length>=3)return {x:xs.reduce((a,b)=>a+b,0)/xs.length,y};
   }
   throw Error('Missing selected front collar');
  });
  const targets=peaks.map((peak,side)=>({x:fit.jacket?boundaries[side][tops[side]-Y]+(side?4:-4):peak.x,y:fit.jacket?tops[side]:405}));
  const registered=new Uint8ClampedArray(clean.length);
  const weight=(x,peak,lo,hi)=>x<peak?smooth((x-lo)/(peak-lo)):smooth((hi-x)/(hi-peak));
  for(let y=Y;y<BOTTOM;y++)for(let x=X;x<X+CW;x++){
   const side=x<498?0:1,lo=side?575:330,hi=side?666:422,peak=peaks[side],target=targets[side],q=index(x,y);
   if(x<lo||x>=hi){registered.set(clean.subarray(q,q+4),q);continue;}
   const fade=1-smooth((y-target.y)/(BOTTOM-target.y));
   const tx=peak.x+(target.x-peak.x)*fade;
   const sx=x<tx?lo+(x-lo)*(peak.x-lo)/(tx-lo):peak.x+(x-tx)*(hi-peak.x)/(hi-tx);
   const dy=(target.y-peak.y)*weight(sx,peak.x,lo,hi);
   let low=Y-80,high=BOTTOM+80;
   for(let n=0;n<16;n++){const v=(low+high)/2;if(v+dy*(1-smooth((v-peak.y)/(BOTTOM-peak.y)))<y)low=v;else high=v;}
   const sy=(low+high)/2,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
   let opacity=0,r=0,g=0,b=0;
   for(let vy=0;vy<2;vy++)for(let vx=0;vx<2;vx++){
    if(ix+vx<X||ix+vx>=X+CW||iy+vy<Y||iy+vy>=BOTTOM)continue;
    const a=index(ix+vx,iy+vy),w=(vx?fx:1-fx)*(vy?fy:1-fy),aw=clean[a+3]*w;
    opacity+=aw;r+=clean[a]*aw;g+=clean[a+1]*aw;b+=clean[a+2]*aw;
   }
   registered[q+3]=Math.round(opacity);if(opacity){registered[q]=Math.round(r/opacity);registered[q+1]=Math.round(g/opacity);registered[q+2]=Math.round(b/opacity);}
  }
  if(fit.jacket){
   // Continue the same row of photographic cloth to the jacket's inside
   // edge. The collar and its checks/stripes stay continuous at wide neck
   // apertures; the unmodified jacket is the final occluder.
   const old=new Uint8ClampedArray(registered);
   for(let y=Y;y<505;y++)for(let side=0;side<2;side++){
    const edge=boundaries[side][y-Y];let outer=-1,hem=-1;
    for(let x=side?575:330;x<(side?666:422);x++)if(alpha(old,x,y)>=192){if(side||outer<0)outer=x;}
    for(let d=0;d<=38;d++){const x=edge+(side?d:-d);if(alpha(ja,x,y)>=200){hem=x;break;}}
    if(outer<0||hem<0||(side?outer>=hem+2:outer<=hem-2))continue;
    const anchor=side?575:422,target=clamp(hem+(side?2:-2),outer-28,outer+28),span=target-anchor,sourceSpan=outer-anchor;
    if(!span||!sourceSpan)continue;
    for(let x=side?575:Math.floor(target);x<=(side?Math.ceil(target):421);x++){
     if(x<X||x>=X+CW)continue;
     const sx=anchor+(x-anchor)*sourceSpan/span,ix=Math.floor(sx),f=sx-ix,a=index(ix,y),b=index(ix+1,y),q=index(x,y),opacity=old[a+3]*(1-f)+old[b+3]*f;
     registered[q+3]=Math.round(opacity);for(let k=0;k<3;k++)registered[q+k]=opacity?Math.round((old[a+k]*old[a+3]*(1-f)+old[b+k]*old[b+3]*f)/opacity):0;
    }
   }
  }
  // Outside the approved neck, the shirt may rise only slightly above
  // the selected jacket collar. This removes isolated source-photo flaps
  // while keeping the jacket silhouette and neck pixels unmodified.
  let exteriorClipped=0;
  if(fit.jacket)for(let x=X;x<X+CW;x++){
   let jacketTop=-1;for(let y=Y;y<452;y++)if(alpha(ja,x,y)>=200){jacketTop=y;break;}
   if(jacketTop<0)continue;
   const side=x<498?0:1,distance=Math.abs(x-boundaries[side][jacketTop-Y]),reveal=7*clamp(1-(distance-20)/30,0,1),top=jacketTop-reveal;
   for(let y=Y;y<Math.min(452,Math.ceil(top)+1);y++){
    const q=index(x,y),coverage=clamp(y+.5-top,0,1),opacity=Math.round(registered[q+3]*(av[q+3]/255+(1-av[q+3]/255)*coverage));
    if(opacity!==registered[q+3])exteriorClipped++;registered[q+3]=opacity;if(!opacity)registered[q]=registered[q+1]=registered[q+2]=0;
   }
  }
  // A tied collar wraps below the throat and meets the unchanged knot at
  // row 467. Some original registered inserts include a tall flat fill above
  // this seam. Remove only its cloth alpha over the original approved neck;
  // the avatar is never transformed, sampled as fabric, or painted over.
  let necklineCleared=0;
  if(fit.mode==='tied')for(let y=Y;y<467;y++)for(let x=X;x<X+CW;x++){
   if(x>=422&&x<575&&y<420)continue;
   const q=index(x,y),neckline=467-.005*(x-498)*(x-498),coverage=clamp(y+.5-neckline,0,1);
   const opacity=Math.round(registered[q+3]*(1-av[q+3]/255*(1-coverage)));
   if(opacity!==registered[q+3])necklineCleared++;
   registered[q+3]=opacity;if(!opacity)registered[q]=registered[q+1]=registered[q+2]=0;
  }
  // Close only real alpha holes inside the neck aperture. A light page
  // otherwise leaks through the old registered-photo seams. This backing
  // takes the nearest opaque pixel in the same row of the fitted shirt,
  // stays behind the unmodified avatar, and is occluded by the jacket.
  const backing=ac.createImageData(CW,CH);let apertureFilled=0,enclosedJoined=0,foregroundJoined=0;
  // A displaced original collar can also leave a narrow enclosed join to
  // its own shoulder in a shirt-only outfit. Close row-wise interior holes
  // only when real selected-shirt cloth bounds both ends; never extend the
  // row silhouette or bridge the central neck opening.
  for(let side=0;side<2;side++)for(let y=Y;y<BOTTOM;y++){
   const lo=side?575:330,hi=side?666:422;let left=-1;
   for(let x=lo;x<hi;x++)if(alpha(registered,x,y)>=248){
    if(left>=0&&x-left>1&&x-left<=49)for(let xx=left+1;xx<x;xx++){
     const q=index(xx,y),visibleAlpha=255*(1-(1-av[q+3]/255)*(1-registered[q+3]/255)*(1-ja[q+3]/255));
     if(y<420&&visibleAlpha>=254.5)continue;
     const a=index(left,y),b=index(x,y),t=(xx-left)/(x-left);
     if(y>=420){
      // This is enclosed garment material in the normal front shirt plane,
      // below the protected chin. Retain existing source pixels over its
      // own row-continuous cloth instead of exposing a narrow neck stripe.
      const coverage=registered[q+3]/255;
      for(let k=0;k<3;k++)registered[q+k]=Math.round(registered[q+k]*coverage+(registered[a+k]*(1-t)+registered[b+k]*t)*(1-coverage));
      registered[q+3]=255;foregroundJoined++;
     }else{
      for(let k=0;k<3;k++)backing.data[q+k]=Math.round(registered[a+k]*(1-t)+registered[b+k]*t);
      backing.data[q+3]=255;
     }
     enclosedJoined++;
    }
    left=x;
   }
  }
  if(fit.jacket)for(let side=0;side<2;side++)for(let y=Math.max(Y,Math.ceil(targets[side].y)+7);y<505;y++){
   const edge=boundaries[side][y-Y];let hem=-1;
   for(let d=0;d<=38;d++){const x=edge+(side?d:-d);if(alpha(ja,x,y)>=200){hem=x;break;}}
   if(hem<0)continue;
   const donors=[];for(let x=side?575:330;x<(side?666:422);x++)if(alpha(registered,x,y)>=248&&(side?x<=edge:x>=edge))donors.push(x);
   if(!donors.length)for(let x=side?575:330;x<(side?666:422);x++)if(alpha(registered,x,y)>=248)donors.push(x);
   if(!donors.length)continue;
   for(let x=Math.min(edge,hem);x<=Math.max(edge,hem);x++){
    if(x<X||x>=X+CW)continue;const q=index(x,y),visibleAlpha=255*(1-(1-av[q+3]/255)*(1-registered[q+3]/255)*(1-ja[q+3]/255));
    if(visibleAlpha>=254.5||backing.data[q+3])continue;
    const sx=donors.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a,donors[0]),source=index(sx,y);
    backing.data[q]=registered[source];backing.data[q+1]=registered[source+1];backing.data[q+2]=registered[source+2];backing.data[q+3]=255;apertureFilled++;
   }
  }
  const rearPixels=0,frontTops=peaks.map(p=>p.y);
  const out=canvas(CW,CH),oc=out.getContext('2d',{willReadFrequently:true});oc.putImageData(backing,0,0);oc.drawImage(avatar,0,0);
  const shirt=canvas(CW,CH),sc=shirt.getContext('2d');sc.putImageData(new ImageData(registered,CW,CH),0,0);oc.drawImage(shirt,0,0);oc.drawImage(jacket,0,0);
  // Preserve the exact central knot/body corridor while replacing only the
  // fitted lateral collar. Source jacket pixels remain its final occlusion.
  const replacement=oc.getImageData(0,0,CW,CH),fc=frame.getContext('2d'),surrounding=fc.getImageData(0,Y,W,CH+5).data;let compositeSeams=0,centralBacking=0,tiePreserved=0;
  // The lower center starts from the exact completed original composite,
  // including its selected tie. It is eligible only for opaque backing in
  // independently enclosed alpha holes, never for front-cloth resampling.
  for(let y=530;y<BOTTOM;y++)for(let x=422;x<575;x++){const q=index(x,y),o=((y-Y)*W+x)*4;replacement.data.set(surrounding.subarray(o,o+4),q);}
  const beforeSeams=new Uint8ClampedArray(replacement.data);
  const compositeAlpha=(x,y)=>x>=X&&x<X+CW&&y>=Y&&y<BOTTOM?beforeSeams[index(x,y)+3]:surrounding[((y-Y)*W+x)*4+3];
  // Independently warped source layers can still leave a seam even when
  // neither the shirt nor jacket alone has an enclosed gap. Close only
  // final-composite interior alpha holes, with five native pixels of
  // clearance from the actual full-row silhouette. Supplying the shirt
  // beneath the existing composite preserves every opaque avatar/jacket
  // pixel and never expands an exterior edge.
  for(let y=420;y<BOTTOM;y++){
   let first=-1,last=-1;for(let x=0;x<W;x++){
    const opacity=compositeAlpha(x,y);
    if(opacity>=248){if(first<0)first=x;last=x;}
   }
   if(first<0)continue;
   for(let side=0;side<(y>=530?3:2);side++){
    const lo=side===2?422:side?575:330,hi=side===2?575:side?666:422,donors=[];
    for(let x=lo;x<hi;x++)if(alpha(registered,x,y)>=248)donors.push({x,y});
    // A source cutout can omit a complete single row. Keep the independent
    // enclosure test, but allow its own nearest opaque cloth within five
    // rows to back that seam; no avatar or jacket color is sampled.
    if(!donors.length)for(let distance=1;distance<=5&&!donors.length;distance++)for(const yy of [y-distance,y+distance])for(let x=lo;x<hi;x++)if(alpha(registered,x,yy)>=248)donors.push({x,y:yy});
    if(!donors.length)continue;
    for(let x=Math.max(lo,first+5);x<Math.min(hi,last-4);x++){
     const q=index(x,y),opacity=beforeSeams[q+3];if(opacity>=255||ta[q+3])continue;
     let above=false,below=false;for(let d=1;d<=5;d++){above||=compositeAlpha(x,y-d)>=248;below||=compositeAlpha(x,y+d)>=248;}if(!above||!below)continue;
     const distance=p=>(p.x-x)*(p.x-x)+(p.y-y)*(p.y-y),sample=donors.reduce((a,b)=>distance(b)<distance(a)?b:a,donors[0]),source=index(sample.x,sample.y),coverage=opacity/255;
     for(let k=0;k<3;k++)replacement.data[q+k]=Math.round(replacement.data[q+k]*coverage+registered[source+k]*(1-coverage));
     replacement.data[q+3]=255;compositeSeams++;if(side===2)centralBacking++;
    }
   }
  }
  // A collar warp must not lower the original shirt-only shoulder edge.
  // Supply only original BODY coverage lost outside the avatar and the core
  // of the original front leaves. An opaque BODY remains the dominant
  // original contributor beneath a leaf with alpha below 128; use the exact
  // BODY color there, so a faint leaf fringe cannot discard its shoulder.
  // At transparent output pixels this restores the body's
  // own source color; at partial pixels it backs the fitted cloth only up
  // to the body's original alpha. Existing opaque output, the selected tie,
  // jacket routes and the existing narrow matte policy remain unchanged.
  let bodyContourRestored=0,bodyDominantEdgeRestored=0;
  if(!fit.topwear)for(const [cx,cy,cw,ch] of SPEC.shirt_only_body_contour_bounds)for(let y=cy;y<cy+ch;y++)for(let x=cx;x<cx+cw;x++){
   const q=index(x,y),pixel=q/4,opacity=replacement.data[q+3],bodyOpacity=cloth.bodyAlpha[pixel],leafOpacity=cloth.leafAlpha?.[pixel]||0;
   if(av[q+3]||ta[q+3]||bodyOpacity<=opacity||(leafOpacity&&(bodyOpacity!==255||leafOpacity>=128)))continue;
   const missing=bodyOpacity-opacity,material=leafOpacity?cloth.bodyPixels.data:raw;
   for(let k=0;k<3;k++)replacement.data[q+k]=Math.round((replacement.data[q+k]*opacity+material[q+k]*missing)/bodyOpacity);
   replacement.data[q+3]=bodyOpacity;bodyContourRestored++;if(leafOpacity)bodyDominantEdgeRestored++;
  }
  for(let y=Y;y<BOTTOM;y++)for(let x=X;x<X+CW;x++){const q=index(x,y);if(!ta[q+3])continue;const o=((y-Y)*W+x)*4;replacement.data.set(surrounding.subarray(o,o+4),q);tiePreserved++;}
  // The bounded center cutoff can leave detached source-collar corner
  // fragments above row 420. Exhaustive native-source comparison confines
  // these to two small side slots. Restore only the exact approved opaque
  // avatar pixels obscured by raw selected-shirt cloth, with no jacket or
  // tie present. Every other slot pixel keeps the original completed frame.
  let neckCornerRestored=0;
  if(fit.mode==='tied')for(const [cx,cy,cw,ch] of SPEC.tied_neck_corner_cleanup)for(let y=cy;y<cy+ch;y++)for(let x=cx;x<cx+cw;x++){
   const q=index(x,y),o=((y-Y)*W+x)*4,original=surrounding.subarray(o,o+4);replacement.data.set(original,q);
   if(av[q+3]!==255||!raw[q+3]||ja[q+3]||ta[q+3])continue;
   if(original.some((value,k)=>value!==av[q+k]))neckCornerRestored++;
   replacement.data.set(av.subarray(q,q+4),q);
  }
  // Restoring the original BODY edge can enclose a tiny hole that was open
  // during the earlier seam pass. Classify the actual final alpha topology
  // after restoration. An eight-connected path to any crop edge always
  // remains exterior; this preserves the original open shoulder notches.
  // Back only completely enclosed components inside one lateral shoulder
  // strip, beneath existing partial cloth, using nearby opaque cloth from
  // this same selected shirt. Opaque avatar/output and every selected tie
  // pixel stay exact. At a partial neck edge, backing remains beneath the
  // existing composite, preserving its original avatar contribution.
  let enclosedShoulderPixels=0,enclosedShoulderComponents=0;
  if(!fit.topwear){
   const count=CW*CH,opacity=new Uint8ClampedArray(count),seen=new Uint8Array(count),queue=new Int32Array(count);
   for(let y=Y;y<BOTTOM;y++)for(let x=X;x<X+CW;x++){
    const q=index(x,y),lateral=x<422||x>=575,center=y>=530||(fit.mode==='tied'&&y>=420&&y<467);
    const corner=fit.mode==='tied'&&SPEC.tied_neck_corner_cleanup.some(r=>x>=r[0]&&x<r[0]+r[2]&&y>=r[1]&&y<r[1]+r[3]);
    opacity[q/4]=(lateral||center||corner)?replacement.data[q+3]:surrounding[((y-Y)*W+x)*4+3];
   }
   const shoulderSide=(x,y)=>y>=420&&y<BOTTOM?(x>=330&&x<422?0:x>=575&&x<666?1:-1):-1;
   const donors=[null,null];
   for(let seed=0;seed<count;seed++){
    if(seen[seed]||opacity[seed]>=248)continue;
    let read=0,write=1,exterior=false,eligible=true,side=-1;queue[0]=seed;seen[seed]=1;
    while(read<write){
     const pixel=queue[read++],cx=pixel%CW,cy=Math.floor(pixel/CW),x=cx+X,y=cy+Y,q=pixel*4;
     if(cx===0||cx===CW-1||cy===0||cy===CH-1)exterior=true;
     const currentSide=shoulderSide(x,y);
     if(currentSide<0||av[q+3]===255||ta[q+3]||(side>=0&&currentSide!==side))eligible=false;
     if(side<0&&currentSide>=0)side=currentSide;
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if((!dx&&!dy)||cx+dx<0||cx+dx>=CW||cy+dy<0||cy+dy>=CH)continue;
      const next=pixel+dy*CW+dx;if(!seen[next]&&opacity[next]<248){seen[next]=1;queue[write++]=next;}
     }
    }
    if(exterior||!eligible||side<0)continue;
    if(!donors[side]){
     donors[side]=[];const [sx,sy,sw,sh]=SPEC.shirt_only_body_contour_bounds[side];
     for(let y=sy;y<sy+sh;y++)for(let x=sx;x<sx+sw;x++){
      const q=index(x,y);
      if(opacity[q/4]===255&&!av[q+3]&&!ta[q+3]&&(registered[q+3]>=248||cloth.bodyAlpha[q/4]>=248))donors[side].push({x,y,q});
     }
    }
    if(!donors[side].length)continue;
    for(let n=0;n<write;n++){
     const pixel=queue[n],q=pixel*4,x=pixel%CW+X,y=Math.floor(pixel/CW)+Y;
     let nearest=null,distance=Infinity;
     for(const donor of donors[side]){const d=(donor.x-x)*(donor.x-x)+(donor.y-y)*(donor.y-y);if(d<distance){distance=d;nearest=donor;}}
     const coverage=replacement.data[q+3]/255;
     for(let k=0;k<3;k++)replacement.data[q+k]=Math.round(replacement.data[q+k]*coverage+replacement.data[nearest.q+k]*(1-coverage));
     replacement.data[q+3]=255;enclosedShoulderPixels++;
    }
    enclosedShoulderComponents++;
   }
  }
  fc.putImageData(replacement,X,Y,0,0,92,CH);fc.putImageData(replacement,X,Y,245,0,91,CH);if(fit.mode==='tied')fc.putImageData(replacement,X,Y,92,65,153,47);fc.putImageData(replacement,X,Y,92,175,153,85);
  if(fit.mode==='tied')for(const [cx,cy,cw,ch] of SPEC.tied_neck_corner_cleanup)fc.putImageData(replacement,X,Y,cx-X,cy-Y,cw,ch);
  release(avatar);release(jacket);release(tieMask);release(out);release(shirt);
  let fittedShirtAlpha=null;
  if(fit.jacket){fittedShirtAlpha=alphaPlane({data:registered});for(let p=0;p<fittedShirtAlpha.length;p++)fittedShirtAlpha[p]=Math.max(fittedShirtAlpha[p],backing.data[p*4+3]);}
  return {fittedShirtAlpha,stats:{shirt_id:fit.shirtId,topwear_id:fit.topwear,mode:fit.mode,source_profile:fit.source_profile,
   bounds:[X,Y,CW,CH],source_hashes:cloth.hashes,native_matte_repair_pixels:cloth.matteRepairs||0,source_capture:cloth.capture||'isolated_registered_native_body_and_leaves',jacket_source_sha256:fit.jacket?.sha256||null,
   stand_top_rows:tops,front_source_top_rows:frontTops,collar_source_peaks:peaks,collar_target_peaks:targets,front_target_top:405,reveal_pixels:fit.jacket?7:null,cleaned_edge_pixels:cleaned,cleared_neckline_pixels:necklineCleared,restored_neck_corner_pixels:neckCornerRestored,clipped_exterior_pixels:exteriorClipped,filled_neck_aperture_pixels:apertureFilled,enclosed_collar_join_pixels:enclosedJoined,foreground_join_pixels:foregroundJoined,composite_seam_fill_pixels:compositeSeams,lower_center_backing_pixels:centralBacking,restored_shirt_only_body_contour_pixels:bodyContourRestored,restored_body_dominant_leaf_edge_pixels:bodyDominantEdgeRestored,closed_shirt_only_interior_pixels:enclosedShoulderPixels,closed_shirt_only_interior_components:enclosedShoulderComponents,body_contour_source_sha256:cloth.bodyHash,body_contour_leaf_source_sha256:cloth.leafHashes,tie_preserved_pixels:tiePreserved,tie_mask_source_sha256:fit.tie?.sha256||null,rear_stand_pixels:rearPixels,knot_anchor:[498,467]}};
 }
 function backJacketInterior(frame,cloth,fit,images){
  if(!fit.topwear)return {jacket_interior_backing_pixels:0,jacket_interior_backing_components:0};
  // The photographed shirt opening can contain enclosed source seams below
  // the collar, including its lower V tip. Supply only missing shirt backing;
  // the already-composited original jacket, avatar and tie stay in front.
  const fc=frame.getContext('2d'),pixels=fc.getImageData(X,Y,CW,BACKING_HEIGHT),data=pixels.data;
  const avatar=canvas(CW,BACKING_HEIGHT),ac=avatar.getContext('2d',{willReadFrequently:true});draw(ac,fit.avatar,images,BACKING_HEIGHT);
  const tie=canvas(CW,BACKING_HEIGHT),tc=tie.getContext('2d',{willReadFrequently:true});draw(tc,fit.tie,images,BACKING_HEIGHT);
  const av=ac.getImageData(0,0,CW,BACKING_HEIGHT).data,ta=tc.getImageData(0,0,CW,BACKING_HEIGHT).data,material=cloth.backingPixels.data;
  release(avatar);release(tie);
  const count=CW*BACKING_HEIGHT,seen=new Uint8Array(count),queue=new Int32Array(count);
  let donorCount=0;for(let p=0;p<count;p++)if(material[p*4+3]>=248)donorCount++;
  function nearestCloth(x,y){
   let nearest=-1,distance=Infinity;
   const consider=(xx,yy)=>{if(xx<0||xx>=CW||yy<0||yy>=BACKING_HEIGHT)return;
    const p=yy*CW+xx;if(material[p*4+3]<248)return;
    const dx=xx-x,dy=yy-y,d=dx*dx+dy*dy;
    if(d<distance||(d===distance&&p<nearest)){distance=d;nearest=p;}
   };
   // Search complete square rings until every unseen donor is farther away.
   // This is the same Euclidean nearest original pixel as a full scan, with
   // the same row-order tie break, without repeatedly scanning all the cloth.
   for(let radius=0;radius<Math.max(CW,BACKING_HEIGHT);radius++){
    if(radius===0)consider(x,y);
    else{for(let dx=-radius;dx<=radius;dx++){consider(x+dx,y-radius);consider(x+dx,y+radius);}
     for(let dy=-radius+1;dy<radius;dy++){consider(x-radius,y+dy);consider(x+radius,y+dy);}}
    if(nearest>=0&&(radius+1)*(radius+1)>distance)return nearest;
   }
   return nearest;
  }
  let backed=0,components=0,partialTieBacked=0;
  for(let seed=0;seed<count;seed++){
   if(seen[seed]||data[seed*4+3]===255)continue;
   let read=0,write=1,exterior=false,eligible=true;queue[0]=seed;seen[seed]=1;
   while(read<write){
    const p=queue[read++],cx=p%CW,cy=Math.floor(p/CW),x=cx+X,y=cy+Y,q=p*4;
    if(cx===0||cx===CW-1||cy===0||cy===BACKING_HEIGHT-1)exterior=true;
    const lateral=y>=420&&y<BOTTOM&&(x<422||x>=575),opening=x>=422&&x<575&&y>=530&&y<BACKING_BOTTOM;
    if((!lateral&&!opening)||av[q+3]===255||ta[q+3]===255)eligible=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     if((!dx&&!dy)||cx+dx<0||cx+dx>=CW||cy+dy<0||cy+dy>=BACKING_HEIGHT)continue;
     const next=p+dy*CW+dx;if(!seen[next]&&data[next*4+3]<255){seen[next]=1;queue[write++]=next;}
    }
   }
   if(exterior||!eligible||!donorCount)continue;
   const changed=[];
   for(let n=0;n<write;n++){
    const p=queue[n],q=p*4,x=p%CW,y=Math.floor(p/CW),nearest=nearestCloth(x,y);
    // Back the existing composite, including a partial original tie edge;
    // its foreground contribution is retained instead of being repainted.
    if(ta[q+3])partialTieBacked++;
    const coverage=data[q+3]/255,source=nearest*4;
    for(let k=0;k<3;k++)data[q+k]=Math.round(data[q+k]*coverage+material[source+k]*(1-coverage));
    data[q+3]=255;changed.push(p);backed++;
   }
   // Write only changed row runs, so untouched source-edge pixels do not
   // undergo an unnecessary canvas premultiplication round trip.
   changed.sort((a,b)=>a-b);
   for(let n=0;n<changed.length;){const first=changed[n],row=Math.floor(first/CW);let end=n+1;
    while(end<changed.length&&changed[end]===changed[end-1]+1&&Math.floor(changed[end]/CW)===row)end++;
    fc.putImageData(pixels,X,Y,first%CW,row,end-n,1);n=end;
   }
   components++;
  }
  return {jacket_interior_backing_pixels:backed,jacket_interior_backing_components:components,jacket_partial_tie_edge_backing_pixels:partialTieBacked};
 }
 function concealJacketShoulders(frame,cloth,fit,images,fittedShirtAlpha){
  if(!fit.topwear)return {concealed_outer_shoulder_pixels:0,concealed_inner_shoulder_pixels:0};
  // Original shoulder cloth can protrude above a different jacket outline.
  // Restore the selected jacket's own effective pixels above its first
  // opaque shoulder row, with positive selected-shirt ownership. Inside the
  // collar strips, preserve the existing seven-pixel near-neck reveal by
  // requiring at least 50px separation from the original avatar neck edge.
  const fc=frame.getContext('2d'),pixels=fc.getImageData(0,SHOULDER_Y,W,SHOULDER_HEIGHT),data=pixels.data;
  const planes={};
  for(const [name,descriptor]of [['avatar',fit.avatar],['jacket',fit.jacket],['tie',fit.tie]]){
   const c=canvas(W,SHOULDER_HEIGHT),ctx=c.getContext('2d',{willReadFrequently:true});if(name==='jacket')drawJacket(ctx,fit,images,true);else drawShoulder(ctx,descriptor,images);
   planes[name]=ctx.getImageData(0,0,W,SHOULDER_HEIGHT).data;release(c);
  }
  const av=planes.avatar,ja=planes.jacket,ta=planes.tie,raw=cloth.outerShoulderPixels.data,changed=[];
  let outer=0,inner=0,partialJacket=0,fittedOnly=0;
  for(const [lo,hi]of [[0,422],[575,W]])for(let x=lo;x<hi;x++){
   let top=-1;for(let y=0;y<SHOULDER_HEIGHT;y++)if(ja[(y*W+x)*4+3]===255){top=y;break;}
   if(top<0)continue;const lateral=x>=X&&x<X+CW;
   if(lateral){let edge=-1;for(let xx=0;xx<W;xx++)if(av[(top*W+xx)*4+3]>=128){edge=xx;if(x<498)break;}
    if(edge<0||(x<498?edge-x:x-edge)<50)continue;
   }
   for(let y=0;y<top;y++){
    const p=y*W+x,q=p*4,nativeY=y+SHOULDER_Y;if(lateral&&nativeY<Y)continue;
    const rawOwned=raw[q+3]>0,fittedOwned=lateral&&fittedShirtAlpha?.[(nativeY-Y)*CW+x-X]>0;
    if((!rawOwned&&!fittedOwned)||data[q+3]<=ja[q+3]||av[q+3]||ta[q+3])continue;
    data.set(ja.subarray(q,q+4),q);changed.push(p);if(lateral)inner++;else outer++;
    if(ja[q+3])partialJacket++;if(!rawOwned)fittedOnly++;
   }
  }
  changed.sort((a,b)=>a-b);
  for(let n=0;n<changed.length;){const first=changed[n],row=Math.floor(first/W);let end=n+1;
   while(end<changed.length&&changed[end]===changed[end-1]+1&&Math.floor(changed[end]/W)===row)end++;
   fc.putImageData(pixels,0,SHOULDER_Y,first%W,row,end-n,1);n=end;
  }
  return {concealed_outer_shoulder_pixels:outer,concealed_inner_shoulder_pixels:inner,
   restored_original_jacket_edge_pixels:partialJacket,concealed_fitted_only_shoulder_pixels:fittedOnly};
 }
 async function render(input){
  const token=++epoch;loads.cancel();visible.dataset.loading='true';
  try{
   const s=connection.validateSelection(input),result=await engine.render(s);if(token!==epoch||result?.cancelled)return {cancelled:true};
   if(s.state!=='REFERENCE'){
    need(IDS.includes(s.shirtId),'unknown active shirt');const p=engine.plan(s),fit={...garmentPlan(s,p),shirtId:s.shirtId};
    const cloth=await selectedCloth(s,p,fit,token);if(token!==epoch||!cloth)return {cancelled:true};
    const images=await loadAll([...list(fit.avatar),...list(fit.jacket),...list(fit.tie)]);if(token!==epoch)return {cancelled:true};
    const fitted=fitPatch(off,cloth,fit,images);
    lastFit={...fitted.stats,...backJacketInterior(off,cloth,fit,images),...concealJacketShoulders(off,cloth,fit,images,fitted.fittedShirtAlpha)};
   }else lastFit=null;
   if(token!==epoch)return {cancelled:true};vc.putImageData(off.getContext('2d').getImageData(0,0,W,H),0,0);
   for(const key of Object.keys(visible.dataset))if(!Object.hasOwn(off.dataset,key))delete visible.dataset[key];Object.assign(visible.dataset,off.dataset,{loading:'false',avatarV3CollarFit:SPEC.revision});last=structuredClone(s);
   return {...result,shirt_collar_fit:lastFit};
  }catch(error){if(token!==epoch)return {cancelled:true};visible.dataset.loading='false';visible.dataset.status=last?'error-retained':'error-empty';throw error;}
 }
 function cancel(){epoch++;engine.cancel();loads.cancel();visible.dataset.loading='false';visible.dataset.status=last?'ready':'empty';}
 return Object.freeze({render,cancel,plan:s=>engine.plan(s),last:()=>last?structuredClone(last):null,
  stats:()=>({...engine.stats(),shirtCollarFit:SPEC.revision,collarFit:lastFit,collarSourceCache:collars.size,epoch})});
}
need(prior?.create,'atomic renderer required');root.HEWRSAtomicRenderer=Object.freeze({create});
root.HEWRSAvatarV3ShirtCollarFit=Object.freeze({spec:SPEC});
})(globalThis);
