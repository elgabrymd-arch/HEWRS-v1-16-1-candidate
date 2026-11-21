/* Isolated candidate: one continuous photographic garment, all selected modes.
 * Install after mixed-renderer.js and before application.js. No source image,
 * identity, score, history, storage record or production entrypoint is changed.
 * Corrected IDs never render a legacy shirt body, rear, collar or cuff layer.
 */
(function(root){'use strict';
const W=996,H=2748,IDS=['DS001','DS014','DS017','DS023','DS034','DS035','DS036','DS051'];
const AVATAR='a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d';
const previousConnection=root.HEWRSCleanConnection,previousRenderer=root.HEWRSAtomicRenderer;
const need=(ok,message)=>{if(!ok)throw Error('Continuous shirts: '+message);},clone=x=>structuredClone(x);
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function numeric(x){return typeof x==='number'&&Number.isFinite(x);}
function contours(value,label){need(Array.isArray(value)&&value.length>0,label+' has no clipping contour');for(const line of value)need(Array.isArray(line)&&line.length>=3&&line.every(p=>Array.isArray(p)&&p.length===2&&p.every(numeric)),label+' has an invalid contour');}
function descriptor(d,paths,native=false){
 need(d&&/^[a-f0-9]{64}$/.test(d.sha256)&&typeof d.url==='string'&&!d.url.includes('..'),'invalid source descriptor');
 need(Array.isArray(d.rect)&&d.rect.length===4&&d.rect[0]===0&&d.rect[1]===0&&Number.isInteger(d.rect[2])&&Number.isInteger(d.rect[3])&&d.rect[2]>0&&d.rect[3]>0,'invalid source dimensions');
 need(Object.hasOwn(paths,d.sha256),'unbound source hash '+d.sha256);
 if(native)need(d.rect.join(',')==='0,0,996,2748','non-native garment layer');
 if(d.display_alpha_mask)descriptor(d.display_alpha_mask,paths,true);
 return d;
}
function rectangle(r,width,height,label){need(Array.isArray(r)&&r.length===4&&r.every(numeric)&&r[0]>=0&&r[1]>=0&&r[2]>0&&r[3]>0&&r[0]+r[2]<=width&&r[1]+r[3]<=height,label+' is outside its image');}
function surface(s,paths,label){
 need(s&&['native','mesh'].includes(s.type),label+' has no continuous surface');
 if(s.contours)contours(s.contours,label);
 if(s.clip_rect)rectangle(s.clip_rect,W,H,label+' native clipping rectangle');
 need(!s.fill_rule||['evenodd','nonzero'].includes(s.fill_rule),'invalid contour fill rule');
 if(s.type==='native'){descriptor(s.layer,paths,true);return;}
 descriptor(s.source,paths);contours(s.contours,label);
 need(Array.isArray(s.vertices)&&s.vertices.length>=3&&s.vertices.every(v=>Array.isArray(v)&&v.length===4&&v.every(numeric)&&v[0]>=0&&v[0]<=s.source.rect[2]&&v[1]>=0&&v[1]<=s.source.rect[3]),label+' has invalid mesh vertices');
 need(Array.isArray(s.triangles)&&s.triangles.length>0,label+' has no mesh triangles');
 for(const tri of s.triangles){
  need(Array.isArray(tri)&&tri.length===3&&new Set(tri).size===3&&tri.every(i=>Number.isInteger(i)&&i>=0&&i<s.vertices.length),label+' has an invalid triangle');
  const [a,b,c]=tri.map(i=>s.vertices[i]);
  const sourceArea=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
  const destinationArea=(b[2]-a[2])*(c[3]-a[3])-(c[2]-a[2])*(b[3]-a[3]);
  need(Math.abs(sourceArea)>1e-6,label+' has a degenerate source triangle');
  need(Math.abs(destinationArea)>1e-6,label+' has a degenerate destination triangle');
  need(sourceArea*destinationArea>0,label+' has a folded or mirrored triangle');
 }
 for(const p of s.source_patches||[]){
  descriptor(p.source,paths);rectangle(p.source_rect,p.source.rect[2],p.source.rect[3],label+' source patch');rectangle(p.destination_rect,s.source.rect[2],s.source.rect[3],label+' destination patch');
  if(p.ink_mask){const m=p.ink_mask;need(numeric(m.threshold)&&m.threshold>0&&m.threshold<=255&&numeric(m.softness)&&m.softness>0&&m.softness<=255&&Number.isInteger(m.dilate??0)&&(m.dilate??0)>=0&&(m.dilate??0)<=8&&p.destination_rect.every(Number.isInteger),'invalid photo annotation mask');if(m.color_match_radius!==undefined)need(Number.isInteger(m.color_match_radius)&&m.color_match_radius>0&&m.color_match_radius<=32,'invalid annotation color-match radius');if(m.local_background_radius!==undefined)need(Number.isInteger(m.local_background_radius)&&m.local_background_radius>0&&m.local_background_radius<=32,'invalid annotation local-background radius');}
  if(p.feather!==undefined)need(numeric(p.feather)&&p.feather>0&&p.destination_rect.every(Number.isInteger),'invalid source patch feather');
  if(p.boundary_blend!==undefined)need(p.boundary_blend===true&&!p.ink_mask&&p.feather===undefined&&p.destination_rect.every(Number.isInteger)&&p.destination_rect[2]>=3&&p.destination_rect[3]>=3,'invalid or conflicting boundary blend');
 }
}
function contract(input,connection){
 const d=clone(input);need(d?.schema==='hewrs.continuous-shirts.v1'&&d.canvas?.join(',')==='996,2748','missing native garment contract');
 need(d.source_input_sha256===root.HEWRS_INPUT_SHA256,'source lock differs');
 need(d.ids?.length>0&&new Set(d.ids).size===d.ids.length&&d.ids.every(id=>IDS.includes(id)),'unexpected shirt identities');
 const paths={...connection.assetPaths,...d.assetPaths};
 for(const [hash,path]of Object.entries(d.assetPaths||{}))need(/^[a-f0-9]{64}$/.test(hash)&&typeof path==='string'&&!path.includes('..')&&!/^(?:[a-z]+:|\/)/i.test(path)&&(!Object.hasOwn(connection.assetPaths,hash)||connection.assetPaths[hash]===path),'asset remapping or unsafe source path');
 need(connection.manifest.static.avatar.sha256===AVATAR,'frozen avatar source differs');
 for(const id of d.ids){
  const row=d.shirts?.[id];need(row?.id===id&&row.history_id==='shirt-'+id&&connection.records[id].history_id===row.history_id,'shirt identity differs');
  for(const mode of ['no_tie','tied']){
   const m=row.modes?.[mode];need(m,'missing '+id+'/'+mode);surface(m.body,paths,id+'/'+mode+'/body');
   if(m.rear)surface(m.rear,paths,id+'/'+mode+'/rear');
   if(m.front_collar)surface(m.front_collar,paths,id+'/'+mode+'/front_collar');
   need(mode!=='tied'||m.front_collar,'tied garment needs its own front-collar occlusion');
   need(Array.isArray(m.cuffs||[]),'invalid cuff surfaces');for(const cuff of m.cuffs||[])surface(cuff,paths,id+'/'+mode+'/cuff');
  }
  for(const [jacket,modes]of Object.entries(row.jacket_rear||{})){
   need(jacket==='B03','unsupported jacket-specific rear stand');
   for(const mode of ['no_tie','tied']){const rear=modes[mode],body=row.modes[mode].body;surface(rear,paths,id+'/'+jacket+'/'+mode+'/rear');need(rear.type==='mesh'&&body.type==='mesh'&&rear.source.sha256===body.source.sha256&&JSON.stringify(rear.source_patches||[])===JSON.stringify(body.source_patches||[]),'rear stand differs from its own photographic garment');}
  }
 }
 for(const [id,mask]of Object.entries(d.jacket_masks||{})){
  need(/^[BS]\d+$/.test(id)&&/^[a-f0-9]{64}$/.test(mask.source_sha256),'unbound jacket geometry mask');
  for(const key of ['keep_contours','erase_contours','shirt_keep_contours','cuff_keep_contours'])if(mask[key])contours(mask[key],id+'/'+key);
  if(mask.hand_source_sha256)need(Array.isArray(mask.hand_source_sha256)&&mask.hand_source_sha256.length===2&&mask.hand_source_sha256.every(x=>/^[a-f0-9]{64}$/.test(x)),'unbound cuff hand geometry');
 }
 return freeze(d);
}
function connect(...args){const base=previousConnection.create(...args),d=contract(root.HEWRS_CONTINUOUS_SHIRTS,base);return Object.freeze({...base,continuousShirts:d,assetPaths:Object.freeze({...base.assetPaths,...d.assetPaths})});}
function canvas(width=W,height=H){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
function path(ctx,lines){ctx.beginPath();for(const line of lines){ctx.moveTo(...line[0]);for(const point of line.slice(1))ctx.lineTo(...point);ctx.closePath();}}
function clip(ctx,lines,rule='evenodd'){path(ctx,lines);ctx.clip(rule);}
function clear(c){c.width=c.height=1;}
function create(visible,connection,options={}){
 need(previousRenderer?.create&&root.HEWRSSuitAtomicRendererV16,'install after mixed-renderer.js');
 const data=connection.continuousShirts;need(data,'connection missing continuous garment contract');
 visible.width=W;visible.height=H;const vc=visible.getContext('2d',{willReadFrequently:true});need(vc,'canvas unavailable');
 const fallbackCanvas=canvas(),fallback=previousRenderer.create(fallbackCanvas,connection,options);
 const loaders=new Map(),photos=new Map(),surfaces=new Map(),warps=new Map(),meshKeys=new WeakMap(),cuffPorts=new Map();let epoch=0,last=null,surfaceRenders=0,warpRenders=0;
 function loader(d){const key=d.rect[2]+'x'+d.rect[3];if(!loaders.has(key))loaders.set(key,root.HEWRSRenderImageLoader.create({limit:key==='996x2748'?20:6,resolveUrl:options.resolveUrl,width:d.rect[2],height:d.rect[3],missing:'Continuous garment source did not load; no substitute',dimensions:'Continuous garment source dimensions differ'}));return loaders.get(key);}
 function cancelLoads(){for(const l of loaders.values())l.cancel();}
 const applies=s=>s&&data.ids.includes(s.shirtId)&&s.state!=='REFERENCE';
 function plan(input){
  const s=connection.validateSelection(input);if(!applies(s))return fallback.plan(s);
  const kind=connection.shirtOnlyConnection.isShirtOnly(s)?'shirt-only':connection.blazerConnection.isBlazer(s)?'blazer':'suit';
  const row=data.shirts[s.shirtId],mode=s.state==='NO_TIE'?'no_tie':'tied',garment=row.modes[mode];
  const p={operation:'CONTINUOUS_SOURCE_SHIRT',kind,selection:clone(s),garment,jacketRear:kind==='blazer'?row.jacket_rear?.[s.blazerId]?.[mode]||null:null,avatar:connection.manifest.static.avatar,shoes:connection.shoeLayers[s.shoeId],tie:s.state==='NO_TIE'?null:connection.batch10.ties[s.state],pantsInForeground:true,source_registration:data.revision||data.schema};
  if(p.tie&&connection.tieFidelity)p.tie=connection.tieFidelity.replace(p.tie);
  if(kind==='suit'){
   const m=connection.assemblies.forSelection(s.suitId,s.shoeId,s.shirtId);p.avatar=m.static.avatar;p.shoes=m.static.shoe;p.pants=m.static.trousers;p.jacket=m.static.jacket;p.hands=[m.static.left_hand,m.static.right_hand];p.topwearId=s.suitId;
  }else{
   const a=connection.blazerConnection.data.assembly;p.pants=connection.blazerConnection.knownPant(s.pantId).layer;p.hands=a.hands;
   if(kind==='blazer'){const b=connection.blazerConnection.knownBlazer(s.blazerId);p.jacket=b.assembly?.jacket||b.checkpoint_layer;p.topwearId=s.blazerId;need(p.jacket,'selected blazer has no separate jacket layer');}
  }
  if(p.jacket){p.jacketMask=data.jacket_masks?.[p.topwearId]||null;if(p.jacketMask){need(p.jacketMask.source_sha256===p.jacket.sha256,'jacket mask differs from selected jacket');if(p.jacketMask.hand_source_sha256)need(p.jacketMask.hand_source_sha256.join(',')===p.hands.map(x=>x.sha256).join(','),'cuff mask differs from selected hands');}}
  if(p.jacketRear)need(p.topwearId==='B03'&&p.jacketMask?.source_sha256===p.jacket.sha256,'rear stand lacks selected B03 source binding');
  need(p.avatar.sha256===AVATAR,'changed avatar registration');return p;
 }
 function list(p){
  const out=new Map(),add=d=>{if(!d)return;descriptor(d,connection.assetPaths);out.set(d.sha256,d);if(d.display_alpha_mask)add(d.display_alpha_mask);};
  for(const d of [p.avatar,p.shoes,p.pants,p.tie,p.jacket,...p.hands])add(d);
  for(const s of [p.garment.rear,p.jacketRear,p.garment.body,p.garment.front_collar,...(p.garment.cuffs||[])])if(s){add(s.type==='native'?s.layer:s.source);for(const patch of s.source_patches||[])add(patch.source);}
  return [...out.values()];
 }
 function bitmap(d,at){
  if(!d.display_alpha_mask)return at(d);
  const c=canvas(),ctx=c.getContext('2d');ctx.drawImage(at(d),0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(at(d.display_alpha_mask),0,0);return c;
 }
 function native(ctx,d,at){if(!d)return;const im=bitmap(d,at);ctx.drawImage(im,0,0);if(im!==at(d))clear(im);}
 function photograph(s,at){
  const key=JSON.stringify([s.source.sha256,(s.source_patches||[]).map(p=>[p.source.sha256,p.source_rect,p.destination_rect,p.ink_mask||null,p.feather||null,p.boundary_blend||false])]);
  if(photos.has(key)){const saved=photos.get(key);photos.delete(key);photos.set(key,saved);return saved;}
  const c=canvas(s.source.rect[2],s.source.rect[3]),ctx=c.getContext('2d');ctx.drawImage(at(s.source),0,0);
  for(const p of s.source_patches||[]){
   if(!p.ink_mask&&!p.feather&&!p.boundary_blend){ctx.clearRect(...p.destination_rect);ctx.drawImage(at(p.source),...p.source_rect,...p.destination_rect);continue;}
   const [x,y,width,height]=p.destination_rect,original=ctx.getImageData(x,y,width,height),replacement=canvas(width,height),rc=replacement.getContext('2d');
   rc.drawImage(at(p.source),...p.source_rect,0,0,width,height);const repair=rc.getImageData(0,0,width,height).data;clear(replacement);
   if(p.boundary_blend){
    // Match the repaired photograph to the exact original border without
    // retaining any original interior lettering, embossing or bright rim.
    // A harmonic RGB correction preserves the generated interior gradients.
    for(let channel=0;channel<3;channel++){
     const correction=new Float32Array(width*height);
     for(let py=0;py<height;py++)for(let px=0;px<width;px++){
      const n=py*width+px,i=n*4+channel;
      if(px===0||py===0||px===width-1||py===height-1)correction[n]=original.data[i]-repair[i];
      else{
       const left=(py*width)*4+channel,right=(py*width+width-1)*4+channel,t=px/(width-1);
       correction[n]=(original.data[left]-repair[left])*(1-t)+(original.data[right]-repair[right])*t;
      }
     }
     for(let sweep=0;sweep<1200;sweep++){
      let change=0;
      for(let py=1;py<height-1;py++)for(let px=1;px<width-1;px++){
       const n=py*width+px,value=(correction[n-1]+correction[n+1]+correction[n-width]+correction[n+width])*.25;
       let difference=value-correction[n];if(difference<0)difference=-difference;if(difference>change)change=difference;correction[n]=value;
      }
      if(change<.0001)break;
     }
     for(let n=0;n<correction.length;n++)original.data[n*4+channel]=repair[n*4+channel]+correction[n];
    }
    ctx.putImageData(original,x,y);continue;
   }
   const alpha=new Float32Array(width*height),m=p.ink_mask,radius=m?.dilate||0,colorRadius=m?.color_match_radius||0;
   const untouched=colorRadius?new Uint8ClampedArray(original.data):null;
   if(m){
    const luminance=new Float32Array(alpha.length);for(let n=0;n<alpha.length;n++){const i=n*4;luminance[n]=.2126*original.data[i]+.7152*original.data[i+1]+.0722*original.data[i+2];}
    for(let py=0;py<height;py++)for(let px=0;px<width;px++){
     const n=py*width+px;
     if(m.local_background_radius){
      const samples=[],r=m.local_background_radius;
      for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(dx*dx+dy*dy<=r*r&&px+dx>=0&&px+dx<width&&py+dy>=0&&py+dy<height)samples.push(luminance[(py+dy)*width+px+dx]);
      samples.sort((a,b)=>a-b);const background=samples[Math.floor((samples.length-1)*.75)];alpha[n]=Math.max(0,Math.min(1,(background-luminance[n]-8)/20));
     }else alpha[n]=Math.max(0,Math.min(1,(m.threshold-luminance[n])/m.softness));
    }
   }else alpha.fill(1);
   for(let py=0;py<height;py++)for(let px=0;px<width;px++){
    const n=py*width+px,i=n*4;let coverage=alpha[n];
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(px+dx>=0&&px+dx<width&&py+dy>=0&&py+dy<height)coverage=Math.max(coverage,alpha[(py+dy)*width+px+dx]);
    if(p.feather){const f=Math.max(0,Math.min(1,Math.min(px+.5,py+.5,width-px-.5,height-py-.5)/p.feather));coverage*=f*f*(3-2*f);}
    if(!coverage)continue;const a=coverage*repair[i+3]/255,b=original.data[i+3]/255,total=a+b*(1-a),delta=[0,0,0];
    if(colorRadius){
     let weight=0;
     for(let dy=-colorRadius;dy<=colorRadius;dy++)for(let dx=-colorRadius;dx<=colorRadius;dx++){
      const nx=px+dx,ny=py+dy,distance=dx*dx+dy*dy;if(nx<0||nx>=width||ny<0||ny>=height||distance>colorRadius*colorRadius)continue;
      const neighbor=ny*width+nx,j=neighbor*4;if(alpha[neighbor]>=.1||untouched[j+3]===0||repair[j+3]===0)continue;
      const w=1/(1+distance);weight+=w;for(let k=0;k<3;k++)delta[k]+=(untouched[j+k]-repair[j+k])*w;
     }
     if(weight)for(let k=0;k<3;k++)delta[k]/=weight;
    }
    for(let k=0;k<3;k++){const matched=Math.max(0,Math.min(255,repair[i+k]+delta[k]));original.data[i+k]=total?(matched*a+original.data[i+k]*b*(1-a))/total:0;}original.data[i+3]=255*total;
   }
   ctx.putImageData(original,x,y);
  }
  const pixels=ctx.getImageData(0,0,c.width,c.height);clear(c);photos.set(key,pixels);while(photos.size>4)photos.delete(photos.keys().next().value);return pixels;
 }
 function warped(s,at){
  let key=meshKeys.get(s);if(!key){key=JSON.stringify([s.source.sha256,s.source_patches||[],s.vertices,s.triangles]);meshKeys.set(s,key);}
  if(warps.has(key)){const saved=warps.get(key);warps.delete(key);warps.set(key,saved);return saved;}
  const photo=photograph(s,at),src=photo.data,sw=photo.width,sh=photo.height,c=canvas(),ctx=c.getContext('2d'),image=ctx.createImageData(W,H),dst=image.data;
  // Inverse texture projection keeps memory bounded even for dense meshes.
  // A photo is decoded once; each destination pixel samples the original
  // photograph bilinearly. Final exterior antialiasing is applied once below.
  for(const indices of s.triangles){
   const [a,b,z]=indices.map(i=>s.vertices[i]);
   const determinant=(b[3]-z[3])*(a[2]-z[2])+(z[2]-b[2])*(a[3]-z[3]);
   const ux=(b[3]-z[3])/determinant,uy=(z[2]-b[2])/determinant,vx=(z[3]-a[3])/determinant,vy=(a[2]-z[2])/determinant;
   const x0=Math.max(0,Math.floor(Math.min(a[2],b[2],z[2]))),x1=Math.min(W-1,Math.ceil(Math.max(a[2],b[2],z[2])));
   const y0=Math.max(0,Math.floor(Math.min(a[3],b[3],z[3]))),y1=Math.min(H-1,Math.ceil(Math.max(a[3],b[3],z[3])));
   for(let y=y0;y<=y1;y++){
    const cy=y+.5-z[3];let u=ux*(x0+.5-z[2])+uy*cy,v=vx*(x0+.5-z[2])+vy*cy;
    for(let x=x0;x<=x1;x++,u+=ux,v+=vx){
     const w=1-u-v;if(u<-.000001||v<-.000001||w<-.000001)continue;
     const sx=Math.max(0,Math.min(sw-1,u*a[0]+v*b[0]+w*z[0]-.5)),sy=Math.max(0,Math.min(sh-1,u*a[1]+v*b[1]+w*z[1]-.5));
     const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,p00=(iy*sw+ix)*4,p10=(iy*sw+Math.min(ix+1,sw-1))*4,p01=(Math.min(iy+1,sh-1)*sw+ix)*4,p11=(Math.min(iy+1,sh-1)*sw+Math.min(ix+1,sw-1))*4;
     const q00=(1-fx)*(1-fy),q10=fx*(1-fy),q01=(1-fx)*fy,q11=fx*fy,index=(y*W+x)*4;
     if(src[p00+3]===255&&src[p10+3]===255&&src[p01+3]===255&&src[p11+3]===255){
      for(let k=0;k<3;k++)dst[index+k]=src[p00+k]*q00+src[p10+k]*q10+src[p01+k]*q01+src[p11+k]*q11;dst[index+3]=255;
     }else{
      const alpha=src[p00+3]*q00+src[p10+3]*q10+src[p01+3]*q01+src[p11+3]*q11;dst[index+3]=alpha;
      for(let k=0;k<3;k++)dst[index+k]=alpha?(src[p00+k]*src[p00+3]*q00+src[p10+k]*src[p10+3]*q10+src[p01+k]*src[p01+3]*q01+src[p11+k]*src[p11+3]*q11)/alpha:0;
     }
    }
   }
  }
  ctx.putImageData(image,0,0);warpRenders++;warps.set(key,c);while(warps.size>2){const oldest=warps.keys().next().value;clear(warps.get(oldest));warps.delete(oldest);}return c;
 }
 function paintUncached(ctx,s,at){
  if(!s)return;ctx.save();try{
   if(s.clip_rect){ctx.beginPath();ctx.rect(...s.clip_rect);ctx.clip();}
   if(s.contours)clip(ctx,s.contours,s.fill_rule||'evenodd');
   if(s.type==='native'){native(ctx,s.layer,at);return;}
   ctx.drawImage(warped(s,at),0,0);
  }finally{ctx.restore();}
 }
 function paint(ctx,s,at){
  if(!s)return;
  if(surfaces.has(s)){const saved=surfaces.get(s);surfaces.delete(s);surfaces.set(s,saved);ctx.drawImage(saved,0,0);return;}
  const result=canvas();paintUncached(result.getContext('2d'),s,at);surfaceRenders++;surfaces.set(s,result);
  while(surfaces.size>6){const oldest=surfaces.keys().next().value;clear(surfaces.get(oldest));surfaces.delete(oldest);}
  ctx.drawImage(result,0,0);
 }
 function frontCollar(ctx,garment,at){
  if(!garment.front_collar)return;ctx.save();
  try{
   const body=garment.body;
   if(body.clip_rect){ctx.beginPath();ctx.rect(...body.clip_rect);ctx.clip();}
   if(body.contours)clip(ctx,body.contours,body.fill_rule||'evenodd');
   paint(ctx,garment.front_collar,at);
  }finally{ctx.restore();}
 }
 function jacketSurface(p,at){
  if(!p.jacket)return null;const c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true});
  if(p.jacketMask?.keep_contours){ctx.save();clip(ctx,p.jacketMask.keep_contours);native(ctx,p.jacket,at);ctx.restore();}else native(ctx,p.jacket,at);
  if(p.jacketMask?.erase_contours){ctx.save();ctx.globalCompositeOperation='destination-out';path(ctx,p.jacketMask.erase_contours);ctx.fill('evenodd');ctx.restore();}return c;
 }
 function cuffPort(p,jacket,at){
  const key=JSON.stringify([p.jacket.sha256,p.hands.map(x=>x.sha256),p.jacketMask?.cuff_keep_contours||null]);
  if(cuffPorts.has(key))return cuffPorts.get(key).contours;
  let lines=p.jacketMask?.cuff_keep_contours;
  if(!lines){
   const j=jacket.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;
   const hull=points=>{
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const sorted=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),lower=[],upper=[];
    for(const point of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),point)<=0)lower.pop();lower.push(point);}
    for(const point of sorted.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),point)<=0)upper.pop();upper.push(point);}
    lower.pop();upper.pop();return [...lower,...upper];
   };
   lines=p.hands.map(hand=>{
    const c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true});native(ctx,hand,at);const h=ctx.getImageData(0,0,W,H).data;clear(c);
    let top=H;for(let i=3;i<h.length;i+=4)if(h[i]>=248){top=Math.floor(i/(W*4));break;}
    need(top<H,'selected hand has no wrist cap');let min=W,max=-1;const cap=[];
    for(let y=top;y<=Math.min(top+45,H-1);y++){
     let left=-1,right=-1;for(let x=0;x<W;x++)if(h[(y*W+x)*4+3]>=248){if(left<0)left=x;right=x;}
     if(left>=0){min=Math.min(min,left);max=Math.max(max,right);cap.push([left,y],[right,y]);}
    }
    const start=Math.max(0,min-80),end=Math.min(W-1,max+80),raw=new Float32Array(W).fill(-1),smooth=new Float32Array(W).fill(-1);
    for(let x=start;x<=end;x++)for(let y=Math.max(0,top-100);y<Math.min(H,top+30);y++)if(j[(y*W+x)*4+3]>=248)raw[x]=y;
    for(let x=start+2;x<=end-2;x++)if(raw[x]>=0){const values=[];for(let n=x-2;n<=x+2;n++)if(raw[n]>=0)values.push(raw[n]);values.sort((a,b)=>a-b);smooth[x]=values[Math.floor(values.length/2)];}
    const slope=x=>x>=start+4&&x<=end-4&&smooth[x-4]>=0&&smooth[x+4]>=0?(smooth[x+4]-smooth[x-4])/8:Infinity;
    let seed=-1;for(let x=min;x<=max;x++)if(smooth[x]>=top-100&&smooth[x]<top+5&&Math.abs(slope(x))<=1&&(seed<0||smooth[x]<smooth[seed]))seed=x;
    need(seed>=0,'selected jacket has no defensible sleeve hem: '+p.topwearId);
    let left=seed,right=seed;
    while(left>start+4&&smooth[left-1]>=0&&smooth[left-1]<top+25&&Math.abs(slope(left-1))<=2)left--;
    while(right<end-4&&smooth[right+1]>=0&&smooth[right+1]<top+25&&Math.abs(slope(right+1))<=2)right++;
    need(right-left>=20,'selected sleeve hem is too narrow: '+p.topwearId);
    const hem=[];for(let x=left;x<=right;x+=2)hem.push([x,raw[x]-2]);hem.push([right,raw[right]-2]);return hull([...hem,...cap]);
   });
  }
  const summary=lines.map(line=>({points:line.length,bounds:[Math.min(...line.map(p=>p[0])),Math.min(...line.map(p=>p[1])),Math.max(...line.map(p=>p[0])),Math.max(...line.map(p=>p[1]))]}));
  cuffPorts.set(key,{jacket_id:p.topwearId,source_sha256:p.jacket.sha256,hand_source_sha256:p.hands.map(x=>x.sha256),method:p.jacketMask?.cuff_keep_contours?'reviewed_selected_source_contours':'selected_sleeve_hem_and_hand_alpha',ports:summary,contours:lines});return lines;
 }
 function confineToJacket(shirt,jacket,p){
  const ctx=shirt.getContext('2d',{willReadFrequently:true});
  // Keep only the selected jacket's bounded central openings. Buttons can
  // split the aperture into off-center runs; neither side may lose the tie.
  // Filling the whole outer envelope would leak shirt cloth through natural
  // transparent arm/torso gaps. No other jacket supplies this ownership.
  const j=jacket.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data,q=ctx.getImageData(0,0,W,H);
  // Extend the first complete neck aperture upward. Keeping every source
  // pixel above the first jacket row leaves disconnected collar fragments
  // when an asymmetric lapel begins below the opposite side.
  let neckRow=H,neckLeft=-1,neckRight=-1;
  for(let y=0;y<H;y++){
   const at=x=>j[(y*W+x)*4+3];if(at(498)>=248)continue;
   let left=-1,right=-1;for(let x=497;x>=0;x--)if(at(x)>=248){left=x;break;}for(let x=499;x<W;x++)if(at(x)>=248){right=x;break;}
   if(left>=0&&right>=0){neckRow=y;neckLeft=left;neckRight=right;break;}
  }
  const opening=new Uint8Array(W);
  for(let y=0;y<H;y++){
   opening.fill(0);if(y<neckRow&&neckLeft>=0)opening.fill(1,neckLeft,neckRight+1);
   const at=x=>j[(y*W+x)*4+3];
   for(let x=0;x<W;){
    if(at(x)>=248){x++;continue;}
    const start=x;while(x<W&&at(x)<248)x++;const end=x-1,midpoint=(start+end)/2;
    if(start===0||x===W||midpoint<338||midpoint>658)continue;
    let left=start-1,right=x;
    // Only inner lapel antialiasing receives a shirt underlay. Outer sleeve
    // antialiasing must retain the jacket's original fractional edge alpha.
    while(left>0&&at(left)<248&&at(left-1)>8)left--;
    while(right<W-1&&at(right)<248&&at(right+1)>8)right++;
    opening.fill(1,left,right+1);
   }
   for(let x=0;x<W;x++){
    const i=(y*W+x)*4,keep=j[i+3]===255||opening[x];if(!keep)q.data[i+3]=0;
    if(!q.data[i+3])q.data[i]=q.data[i+1]=q.data[i+2]=0;
   }
  }
  ctx.putImageData(q,0,0);
  // An optional source-bound contour can tighten this mask, never broaden it.
  if(p.jacketMask?.shirt_keep_contours){const mask=canvas(),mc=mask.getContext('2d');path(mc,p.jacketMask.shirt_keep_contours);mc.fill('evenodd');ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';clear(mask);}
 }
 function status(s){
  const kind=connection.shirtOnlyConnection.isShirtOnly(s)?'shirt-only':connection.blazerConnection.isBlazer(s)?'blazer':'suit';
  for(const key of ['suitId','blazerId','pantId','shirtOnly'])delete visible.dataset[key];
  Object.assign(visible.dataset,{status:'ready',loading:'false',shirtId:s.shirtId,state:s.state,shoeId:s.shoeId,kind});
  if(kind==='shirt-only'){visible.dataset.shirtOnly='true';visible.dataset.pantId=s.pantId;}else if(kind==='blazer'){visible.dataset.blazerId=s.blazerId;visible.dataset.pantId=s.pantId;}else visible.dataset.suitId=s.suitId;
  delete visible.dataset.pendingShirt;
 }
 async function render(input){
  const token=++epoch;cancelLoads();fallback.cancel();let s;
  try{s=connection.validateSelection(input);}catch(error){visible.dataset.loading='false';visible.dataset.status=last?'error-retained':'error-empty';throw error;}
  visible.dataset.loading='true';visible.dataset.pendingShirt=s.shirtId;
  try{
   if(!applies(s)){const result=await fallback.render(s);if(token!==epoch||result.cancelled)return {cancelled:true};vc.putImageData(fallbackCanvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H),0,0);last=clone(s);status(s);return result;}
   const p=plan(s),descs=list(p),images=await Promise.all(descs.map(d=>loader(d).load(d)));
   if(token!==epoch)return {cancelled:true};const map=new Map(descs.map((d,i)=>[d.sha256,images[i]])),at=d=>{const image=map.get(d.sha256);need(image,'source image absent');return image;};
   const frame=canvas(),shirt=canvas(),jacket=jacketSurface(p,at),fc=frame.getContext('2d',{willReadFrequently:true}),sc=shirt.getContext('2d',{willReadFrequently:true});
   try{
    paint(sc,p.garment.body,at);native(sc,p.tie,at);frontCollar(sc,p.garment,at);if(jacket)confineToJacket(shirt,jacket,p);
    paint(fc,p.garment.rear,at);paint(fc,p.jacketRear,at);native(fc,p.avatar,at);native(fc,p.shoes,at);fc.drawImage(shirt,0,0);native(fc,p.pants,at);
    if(jacket){fc.save();clip(fc,cuffPort(p,jacket,at));for(const cuff of p.garment.cuffs||[])paint(fc,cuff,at);fc.restore();fc.drawImage(jacket,0,0);}for(const hand of p.hands)native(fc,hand,at);
    if(token!==epoch)return {cancelled:true};vc.putImageData(fc.getImageData(0,0,W,H),0,0);last=clone(s);status(s);
    return {status:'ready',selection:clone(s),source_result:{operation:p.operation,source_assembly:'CONTINUOUS_PHOTOGRAPHIC_SHIRT_CANDIDATE',source_registration:p.source_registration,kind:p.kind,shirt_id:s.shirtId,legacy_shirt_layers_used:false,avatar_source_sha256:AVATAR,tie_source_sha256:p.tie?.sha256||null,jacket_source_sha256:p.jacket?.sha256||null}};
   }finally{clear(frame);clear(shirt);if(jacket)clear(jacket);}
  }catch(error){if(token!==epoch)return {cancelled:true};visible.dataset.loading='false';visible.dataset.status=last?'error-retained':'error-empty';delete visible.dataset.pendingShirt;throw error;}
 }
 function cancel(){epoch++;cancelLoads();fallback.cancel();visible.dataset.loading='false';visible.dataset.status=last?'ready':'empty';delete visible.dataset.pendingShirt;}
 return Object.freeze({render,cancel,last:()=>last&&clone(last),plan,stats:()=>({...fallback.stats(),continuousImageCache:[...loaders.values()].reduce((n,l)=>n+l.size,0),continuousPhotoCache:photos.size,continuousSurfaceCache:surfaces.size,continuousSurfaceRenders:surfaceRenders,continuousWarpCache:warps.size,continuousWarpRenders:warpRenders,continuousCuffPorts:[...cuffPorts.values()].map(({contours,...value})=>value),maxContinuousSurfaces:6,continuousIds:[...data.ids],epoch})});
}
need(previousConnection?.create&&previousRenderer?.create,'missing inherited renderer or connection');
root.HEWRSContinuousShirts=Object.freeze({schema:'hewrs.continuous-shirts.v1',allowedIds:Object.freeze(IDS),avatarSource:AVATAR,contract});
root.HEWRSCleanConnection=Object.freeze({create:connect});
root.HEWRSAtomicRenderer=Object.freeze({create});
})(globalThis);
