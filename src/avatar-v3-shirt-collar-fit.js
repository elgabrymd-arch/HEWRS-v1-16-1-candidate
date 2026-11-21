/* AVATAR_V3 neckline fitting. Original garment files and identifiers remain
 * immutable. Only the selected shirt's own registered cloth supplies its
 * neckline; the selected jacket remains the final occluder. The rear stand is
 * behind the approved avatar, so this never reshapes the head or neck.
 */
(function(root){'use strict';
const prior=root.HEWRSAtomicRenderer,W=996,H=2748;
const X=330,Y=355,CW=336,CH=260,BOTTOM=Y+CH;
const IDS=Object.freeze(Array.from({length:51},(_,n)=>'DS'+String(n+1).padStart(3,'0')).filter(id=>id!=='DS049'));
const SPEC=Object.freeze({revision:'AVATAR_V3_ALL_SHIRT_COLLAR_FIT_1',active_ids:IDS,
 bounds:Object.freeze([X,Y,CW,CH]),native_canvas:Object.freeze([W,H]),
 neckband_reveal:7,knot_anchor:Object.freeze([498,467]),
 method:'continuous selected-shirt-source collar registration to selected jacket neck',
 modified_strips:Object.freeze([[330,355,92,260],[575,355,91,260]]),protected_knot_corridor:Object.freeze([422,355,153,260]),original_sources_modified:false,avatar_geometry_modified:false});
const need=(v,m)=>{if(!v)throw Error('V3 shirt collar: '+m);};
function canvas(w=W,h=H){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function release(c){c.width=c.height=1;}
function polygon(ctx,lines){ctx.beginPath();for(const line of lines){ctx.moveTo(...line[0]);for(const p of line.slice(1))ctx.lineTo(...p);ctx.closePath();}}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function create(visible,connection,options={}){
 need(connection.avatarV3?.sha256==='4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93','approved V3 avatar required');
 const collars=new Map();let epoch=0,last=null,lastFit=null;
 function captureShirtCloth(ctx,p){
  need(p?.garment?.body?.type==='mesh'&&p.garment.body.source?.sha256,'unregistered continuous cloth callback');
  const key=[p.selection.shirtId,p.selection.state==='NO_TIE'?'no_tie':'tied','continuous'].join('/');
  collars.delete(key);collars.set(key,{pixels:ctx.getImageData(X,Y,CW,CH),hashes:[p.garment.body.source.sha256],capture:'raw_registered_body_before_avatar_tie_jacket'});
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
  let jacket=p.jacket||null,parts=[];
  if(Array.isArray(p)){const m=connection.assemblies.forSelection(s.suitId,s.shoeId,s.shirtId),r=m.shirts[s.shirtId].states[mode];jacket=m.static.jacket;parts=[r.body,r.left,r.right].filter(Boolean);}
  else if(!continuous){parts=[p.body,...(p.leaves||[])].filter(Boolean);need(parts.length>0,'unrecognized selected shirt source route');}
  return {continuous,mode,topwear,avatar,jacket,parts,source_profile:s.suitId?'suit':'non-suit'};
 }
 async function loadAll(descriptors){const unique=[...new Map(descriptors.map(d=>[d.sha256,d])).values()],images=await Promise.all(unique.map(d=>loads.load(d)));return new Map(unique.map((d,i)=>[d.sha256,images[i]]));}
 function draw(ctx,d,images){if(!d)return;const image=images.get(d.sha256);need(image,'missing registered source '+d.sha256);if(!d.display_alpha_mask){ctx.drawImage(image,-X,-Y);return;}
  const c=canvas(CW,CH),cc=c.getContext('2d');cc.drawImage(image,-X,-Y);cc.globalCompositeOperation='destination-in';cc.drawImage(images.get(d.display_alpha_mask.sha256),-X,-Y);ctx.drawImage(c,0,0);release(c);
 }
 async function selectedCloth(s,p,fit,token){
  const key=[s.shirtId,fit.mode,fit.continuous?'continuous':fit.source_profile].join('/');
  if(collars.has(key)){const entry=collars.get(key);collars.delete(key);collars.set(key,entry);return entry;}
  const c=canvas(CW,CH),ctx=c.getContext('2d',{willReadFrequently:true});let hashes=[];
  if(fit.continuous){release(c);throw Error('V3 shirt collar: raw registered cloth capture is unavailable');
  }else{const images=await loadAll(fit.parts.flatMap(list));if(token!==epoch){release(c);return null;}for(const d of fit.parts)draw(ctx,d,images);hashes=fit.parts.map(d=>d.sha256);}
  const pixels=ctx.getImageData(0,0,CW,CH);release(c);const entry={pixels,hashes};collars.set(key,entry);while(collars.size>12)collars.delete(collars.keys().next().value);return entry;
 }
 function fitPatch(frame,cloth,fit,images){
  const avatar=canvas(CW,CH),ac=avatar.getContext('2d',{willReadFrequently:true});draw(ac,fit.avatar,images);const av=ac.getImageData(0,0,CW,CH).data;
  const jacket=canvas(CW,CH),jc=jacket.getContext('2d',{willReadFrequently:true});draw(jc,fit.jacket,images);const ja=jc.getImageData(0,0,CW,CH).data;
  const raw=cloth.pixels.data,clean=new Uint8ClampedArray(raw),stand=ac.createImageData(CW,CH),boundaries=[[],[]],tops=[];
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
  const rearPixels=0,frontTops=peaks.map(p=>p.y);
  const out=canvas(CW,CH),oc=out.getContext('2d',{willReadFrequently:true});oc.putImageData(stand,0,0);oc.drawImage(avatar,0,0);
  const shirt=canvas(CW,CH),sc=shirt.getContext('2d');sc.putImageData(new ImageData(registered,CW,CH),0,0);oc.drawImage(shirt,0,0);oc.drawImage(jacket,0,0);
  // Preserve the exact central knot/body corridor while replacing only the
  // fitted lateral collar. Source jacket pixels remain its final occlusion.
  const replacement=oc.getImageData(0,0,CW,CH),fc=frame.getContext('2d');fc.putImageData(replacement,X,Y,0,0,92,CH);fc.putImageData(replacement,X,Y,245,0,91,CH);
  release(avatar);release(jacket);release(out);release(shirt);
  return {shirt_id:fit.shirtId,topwear_id:fit.topwear,mode:fit.mode,source_profile:fit.source_profile,
   bounds:[X,Y,CW,CH],source_hashes:cloth.hashes,source_capture:cloth.capture||'isolated_registered_native_body_and_leaves',jacket_source_sha256:fit.jacket?.sha256||null,
   stand_top_rows:tops,front_source_top_rows:frontTops,collar_source_peaks:peaks,collar_target_peaks:targets,front_target_top:405,reveal_pixels:fit.jacket?7:null,cleaned_edge_pixels:cleaned,rear_stand_pixels:rearPixels,knot_anchor:[498,467]};
 }
 async function render(input){
  const token=++epoch;loads.cancel();visible.dataset.loading='true';
  try{
   const s=connection.validateSelection(input),result=await engine.render(s);if(token!==epoch||result?.cancelled)return {cancelled:true};
   if(s.state!=='REFERENCE'){
    need(IDS.includes(s.shirtId),'unknown active shirt');const p=engine.plan(s),fit={...garmentPlan(s,p),shirtId:s.shirtId};
    const cloth=await selectedCloth(s,p,fit,token);if(token!==epoch||!cloth)return {cancelled:true};
    const images=await loadAll([...list(fit.avatar),...list(fit.jacket)]);if(token!==epoch)return {cancelled:true};
    lastFit=fitPatch(off,cloth,fit,images);
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
