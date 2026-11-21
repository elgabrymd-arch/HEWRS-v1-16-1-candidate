/* Candidate-only collar composition from existing, hash-bound source layers.
 * No image bytes, garment identities, avatar, scores or browser state change.
 * Installed before the mixed renderer so its visible-frame commit stays atomic.
 */
(function(root){'use strict';
const W=996,H=2748,previousBlazer=root.HEWRSBlazerRenderer,previousShirt=root.HEWRSShirtOnlyRenderer;
const require=(ok,message)=>{if(!ok)throw Error('Collar candidate: '+message);};
const clamp=value=>Math.max(0,Math.min(1,value));
const clone=value=>structuredClone(value);
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const config=freeze(clone(root.HEWRS_COLLAR_REPAIRS));
require(config?.schema==='hewrs.collar-repairs.v1','missing source contract');
require(config.canvas?.join(',')==='996,2748','changed native geometry');
require(config.source_input_sha256===root.HEWRS_INPUT_SHA256,'source lock differs');
require(Object.keys(config.gap?.shirts||{}).sort().join(',')==='DS017,DS034,DS035,DS036,DS051','unexpected gap repair identities');
require(Object.keys(config.seams?.shirts||{}).sort().join(',')==='DS017,DS034,DS036,DS051','unexpected internal seam identities');
require(config.white?.ids?.slice().sort().join(',')==='DS001,DS014','unexpected white collar identities');
require(config.white.bounds?.join(',')==='345,330,657,555'&&config.white.legacy_clear_bounds?.join(',')==='345,330,657,426'&&config.white.native_knot_end_y===530,'changed white collar repair extent');
require(config.gap.runs?.reduce((n,row)=>n+row[2]-row[1],0)===286,'gap coverage differs');
for(const [y,left,right] of config.gap.runs)require(Number.isInteger(y)&&Number.isInteger(left)&&Number.isInteger(right)&&y>=530&&y<537&&left>=475&&right<=521&&right>left,'invalid gap run');

function interpolate(points,y){
 require(Array.isArray(points)&&points.length>=2,'missing side contour');
 if(y<=points[0][0])return points[0][1];
 for(let i=1;i<points.length;i++)if(y<=points[i][0]){
  const a=points[i-1],b=points[i];require(b[0]>a[0],'unordered side contour');
  return a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0]);
 }
 return points[points.length-1][1];
}
function validBounds(bounds){require(Array.isArray(bounds)&&bounds.length===4&&bounds.every(Number.isInteger)&&bounds[0]>=0&&bounds[1]>=0&&bounds[2]<=W&&bounds[3]<=H&&bounds[2]>bounds[0]&&bounds[3]>bounds[1],'invalid repair bounds');return bounds;}
function surface(bounds){
 const canvas=document.createElement('canvas');canvas.width=bounds[2]-bounds[0];canvas.height=bounds[3]-bounds[1];
 const ctx=canvas.getContext('2d',{willReadFrequently:true});require(ctx,'canvas unavailable');
 return {canvas,ctx,bounds,width:canvas.width,height:canvas.height,dispose(){canvas.width=canvas.height=1;}};
}
function readCrop(image,bounds){const local=surface(bounds);try{local.ctx.drawImage(image,-bounds[0],-bounds[1]);return local.ctx.getImageData(0,0,local.width,local.height);}finally{local.dispose();}}
function drawRaw(target,image){target.ctx.drawImage(image,-target.bounds[0],-target.bounds[1]);}
function clearPixel(data,i){data[i]=data[i+1]=data[i+2]=data[i+3]=0;}

function create(canvas,connection,resolveUrl,kind){
 const inherited=(kind==='blazer'?previousBlazer:previousShirt).create(canvas,connection,resolveUrl);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});let epoch=0;
 const loads=root.HEWRSRenderImageLoader.create({limit:16,resolveUrl,width:W,height:H,missing:'Collar source failed to load; original identity retained',dimensions:'Wrong native collar source dimensions'});
 function bound(desc){
  require(desc&&/^[a-f0-9]{64}$/.test(desc.sha256)&&desc.rect?.join(',')==='0,0,996,2748'&&Object.hasOwn(connection.assetPaths,desc.sha256),'unbound native source');
  return desc;
 }
 function repairs(s,p){
  const items=[];
  if(s.state==='NO_TIE'){
   const gap=config.gap.shirts[s.shirtId];
   if(gap){
    require(p.body?.sha256===gap.base_sha256,'gap baseline source differs for '+s.shirtId);
    const donor=s.shirtId==='DS035'?connection.manifest.shirts[s.shirtId].states.no_tie.body:connection.batch10.shirts[s.shirtId].modes.tied.base;
    require(gap.donor?.sha256===donor.sha256,'gap donor is not the same registered shirt');bound(gap.donor);
    items.push({type:'same-shirt-gap',bounds:[475,530,521,537],donor:gap.donor});
   }
   const seam=config.seams.shirts[s.shirtId];
   if(seam){
    const donor=connection.batch10.shirts[s.shirtId].modes.tied.base;
    require(p.body?.sha256===seam.base_sha256&&seam.donor?.sha256===donor.sha256,'internal seam source differs');
    items.push({type:'same-shirt-seam-underlay',bounds:seam.bounds,donor:bound(seam.donor),runs:seam.runs});
   }
   if(s.shirtId==='DS035'){
    const d=config.ds035;require(d&&d.y_start===436&&d.y_end===504,'missing DS035 edge contour');
    require(p.leaves?.[0]?.sha256===d.left_sha256&&p.leaves?.[1]?.sha256===d.right_sha256,'DS035 collar source pins differ');
    items.push({type:'ds035-leaf-trim',bounds:[350,d.y_start,650,d.y_end]});
   }
   if(s.shirtId==='DS023'){
    const d=config.ds023,b=d?.boundary;require(b,'missing DS023 open-neck contour');
    const values=b.boundary_y_256||b.boundary_y;
    require(Array.isArray(values)&&values.length===b.x_end_exclusive-b.x_start&&values.every(Number.isFinite),'invalid DS023 contour');
    for(const [key,desc] of [['base_sha256',p.body],['left_sha256',p.leaves?.[0]],['right_sha256',p.leaves?.[1]]])if(d[key])require(desc?.sha256===d[key],'DS023 source pin differs: '+key);
    items.push({type:'ds023-neck-trim',bounds:[b.x_start,b.y_start,b.x_end_exclusive,b.y_end_exclusive]});
   }
  }else if(config.white.ids.includes(s.shirtId)){
   const parts=connection.manifest.shirts[s.shirtId].states.tied,pins=config.white.source_parts?.[s.shirtId];
   for(const role of ['rear','body','left','right'])require(parts[role]?.sha256===pins?.[role],'white collar source pin differs: '+role);
   const old=p.shirt||p.tie||p.layers?.[3];
   const expected=connection.tieFidelity?connection.tieFidelity.replace(connection.blazerConnection.data.assembly.ties[s.state]):connection.blazerConnection.data.assembly.ties[s.state];
   require(old?.sha256===expected?.sha256,'white collar/tie baseline differs');
   items.push({type:'white-native-tied-collar',bounds:config.white.bounds});
  }
  for(const item of items)validBounds(item.bounds);
  return items;
 }
 function metadata(s,items){return {schema:config.schema,source_input_sha256:config.source_input_sha256,shirt_id:s.shirtId,state:s.state,mode:kind,operations:items.map(item=>({type:item.type,bounds:clone(item.bounds)})),original_sources_modified:false};}
 function plan(s){const p=inherited.plan(s),items=repairs(s,p);return items.length?{...p,collar_repair:metadata(s,items)}:p;}
 function descriptors(p,items,s){
  const list=[];const add=value=>{if(value&&!list.some(d=>d.sha256===value.sha256))list.push(bound(value));};
  for(const value of [p.rear,p.avatar,p.shoes,p.pants,p.body,p.tie,p.shirt,p.jacket,p.ownership,...(p.leaves||[]),...(p.hands||[]),...(p.cuffs||[]),...(p.layers||[])])add(value);
  for(const item of items){
   if(item.donor)add(item.donor);
   if(item.type==='white-native-tied-collar'){
    const parts=connection.manifest.shirts[s.shirtId].states.tied;
    for(const role of ['rear','body','left','right'])add(parts[role]);
    add(connection.tieFidelity?connection.tieFidelity.replace(connection.batch10.ties[s.state]):connection.batch10.ties[s.state]);
    add(connection.tieFidelity?.legacyOwnership);
    if(kind==='blazer'){
     const a=connection.blazerConnection.knownBlazer(s.blazerId).assembly||connection.blazerConnection.data.assembly;
     add(a.jacket);add(p.ownership);
    }
   }
  }
  return list;
 }
 function applyOwnership(shirt,p,at){
  if(!p.ownership)return;
  const own=readCrop(at(p.ownership),shirt.bounds).data,pixels=shirt.ctx.getImageData(0,0,shirt.width,shirt.height);
  for(let y=0;y<shirt.height;y++)for(let x=0;x<shirt.width;x++){
   const i=(y*shirt.width+x)*4;if(own[i]||y+shirt.bounds[1]>=(p.cuffOwnershipStart??1339))clearPixel(pixels.data,i);
  }
  shirt.ctx.putImageData(pixels,0,0);
 }
 function composeScene(bounds,p,shirt,at){
  const frame=surface(bounds);
  for(const desc of [p.rear,p.avatar,p.shoes,...(p.pantsInForeground?[]:[p.pants])])if(desc)drawRaw(frame,at(desc));
  frame.ctx.drawImage(shirt.canvas,0,0);
  if(p.pantsInForeground&&p.pants)drawRaw(frame,at(p.pants));
  if(p.jacket)drawRaw(frame,at(p.jacket));
  for(const desc of [...(p.cuffs||[]),...(p.hands||[])])drawRaw(frame,at(desc));
  return frame;
 }
 function patchBatch(item,p,at){
  const bounds=item.bounds,shirt=surface(bounds),affected=new Uint8Array(shirt.width*shirt.height);
  const donor=item.donor?readCrop(at(item.donor),bounds).data:null;
  function alter(desc,role){
   const local=surface(bounds);
   try{
    drawRaw(local,at(desc));const pixels=local.ctx.getImageData(0,0,local.width,local.height);let modified=false;
    for(let y=0;y<local.height;y++)for(let x=0;x<local.width;x++){
     const pixel=y*local.width+x,i=pixel*4,gx=x+bounds[0],gy=y+bounds[1],old=pixels.data[i+3];let alpha=old;
     if(item.type==='same-shirt-gap'&&role==='body'){
      const run=config.gap.runs.find(row=>row[0]===gy);
      if(run&&gx>=run[1]&&gx<run[2]){
       require(old===0&&pixels.data[i]===0&&pixels.data[i+1]===0&&pixels.data[i+2]===0,'gap source is no longer empty');
       require(donor[i+3]===255,'gap donor is not opaque');
       for(let c=0;c<4;c++)pixels.data[i+c]=donor[i+c];affected[pixel]=1;modified=true;
      }
     }else if(item.type==='ds035-leaf-trim'&&(role==='left'||role==='right')){
      const edge=interpolate(config.ds035[role],gy);
      alpha=Math.min(old,Math.round(255*clamp(role==='left'?gx-edge+.5:edge-gx+.5)));
     }else if(item.type==='ds023-neck-trim'&&['body','left','right'].includes(role)){
      const b=config.ds023.boundary,values=b.boundary_y_256||b.boundary_y,edge=values[gx-b.x_start]/(b.boundary_y_256?256:1);
      alpha=Math.min(old,Math.round(255*clamp(gy-edge+.5)));
     }
     if(alpha!==old){pixels.data[i+3]=alpha;affected[pixel]=1;modified=true;}
    }
    if(modified){local.ctx.putImageData(pixels,0,0);shirt.ctx.drawImage(local.canvas,0,0);}else drawRaw(shirt,at(desc));
   }finally{local.dispose();}
  }
  try{
   if(item.type==='same-shirt-seam-underlay'){
    const under=shirt.ctx.createImageData(shirt.width,shirt.height),body=readCrop(at(p.body),bounds).data;
    const avatar=readCrop(at(p.avatar),bounds).data,rear=readCrop(at(p.rear),bounds).data;
    for(const [gy,x0,x1] of item.runs){
     require(gy>=bounds[1]&&gy<bounds[3]&&x0>=bounds[0]+3&&x1<=bounds[2]-3&&x1>x0,'seam run outside supported crop');
     for(let gx=x0;gx<x1;gx++){
      const n=(gy-bounds[1])*shirt.width+gx-bounds[0],i=n*4;
      require(donor[i+3]===255&&body[i+3]<250&&avatar[i+3]===0&&rear[i+3]===0,'internal seam no longer has exact cloth support');
      require([1,2,3].some(dx=>body[i-dx*4+3]>=250)&&[1,2,3].some(dx=>body[i+dx*4+3]>=250),'seam is no longer enclosed by existing cloth');
      for(let c=0;c<4;c++)under.data[i+c]=donor[i+c];affected[n]=1;
     }
    }
    shirt.ctx.putImageData(under,0,0);
   }
   alter(p.body,'body');if(p.tie)drawRaw(shirt,at(p.tie));
   alter(p.leaves[0],'left');alter(p.leaves[1],'right');
   applyOwnership(shirt,p,at);const frame=composeScene(bounds,p,shirt,at);
   try{return {pixels:frame.ctx.getImageData(0,0,frame.width,frame.height),affected};}finally{frame.dispose();}
  }finally{shirt.dispose();}
 }
 function patchWhite(item,p,s,at){
  const bounds=item.bounds,shirt=surface(bounds),upper=surface(bounds),parts=connection.manifest.shirts[s.shirtId].states.tied;
  const cleanup=config.white.cleanup,cleanParts={};
  require(cleanup?.schema==='hewrs.white-native-collar-alpha.v1','missing white alpha cleanup');
  require(cleanup.opening?.bounds?.join(',')==='375,330,620,535'&&cleanup.opening.seed?.join(',')==='498,335'&&cleanup.opening.additional_avatar_alpha===255,'white opening contract differs');
  const original=p.shirt||p.tie||p.layers[3],legacy=readCrop(at(original),bounds),pixels=readCrop(at(original),bounds);
  const nativeTie=connection.tieFidelity?connection.tieFidelity.replace(connection.batch10.ties[s.state]):connection.batch10.ties[s.state];
  require(connection.tieFidelity?.legacyOwnership,'missing exact legacy tie ownership');
  try{
   for(const role of ['rear','body','left','right'])drawRaw(upper,at(parts[role]));
   const combined=upper.ctx.getImageData(0,0,upper.width,upper.height).data;
   for(const role of ['rear','body','left','right']){
    require(parts[role].sha256===cleanup.source_parts?.[role],'white cleanup source differs: '+role);
    const part=cleanParts[role]=surface(bounds),data=readCrop(at(parts[role]),bounds),b=cleanup.boundary;
    for(const [gy,x0,x1] of cleanup.detached_alpha_runs[role]||[]){
     require(gy>=bounds[1]&&gy<bounds[3]&&x0>=bounds[0]&&x1<=bounds[2]&&x1>x0,'white speckle run outside collar');
     for(let gx=x0;gx<x1;gx++){
      const i=((gy-bounds[1])*part.width+gx-bounds[0])*4;
      require(data.data[i+3]<=3,'detached white source is no longer a faint component');data.data[i+3]=0;
     }
    }
    if(role!=='rear'){
     require(b.boundary_y_256?.length===b.x_end_exclusive-b.x_start,'invalid white neck contour');
     for(let gy=b.y_start;gy<b.y_end_exclusive;gy++)for(let gx=b.x_start;gx<b.x_end_exclusive;gx++){
      const i=((gy-bounds[1])*part.width+gx-bounds[0])*4,edge=b.boundary_y_256[gx-b.x_start]/256;
      data.data[i+3]=Math.min(data.data[i+3],Math.round(255*clamp(gy-edge+.5)));
     }
    }
    part.ctx.putImageData(data,0,0);
   }
   upper.ctx.clearRect(0,0,upper.width,upper.height);
   for(const role of ['rear','body','left','right'])upper.ctx.drawImage(cleanParts[role].canvas,0,0);
   const trimmed=upper.ctx.getImageData(0,0,upper.width,upper.height).data,avatar=readCrop(at(p.avatar||p.layers[0]),bounds).data;
   const seed=(335-bounds[1])*upper.width+(498-bounds[0]);
   function opening(additional){
    const open=new Uint8Array(upper.width*upper.height),queue=[];
    const eligible=n=>additional?trimmed[n*4+3]<255&&avatar[n*4+3]===255:combined[n*4+3]===0;
    require(seed>=0&&seed<open.length&&eligible(seed),'white neck opening seed differs');
    open[seed]=1;queue.push(seed);
    for(let head=0;head<queue.length;head++){
     const n=queue[head],x=n%upper.width,y=Math.floor(n/upper.width);
     for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const nx=x+dx,ny=y+dy,gx=nx+bounds[0],gy=ny+bounds[1],next=ny*upper.width+nx;
      if(nx<0||ny<0||nx>=upper.width||ny>=upper.height||gx<375||gx>=620||gy<330||gy>=535||open[next]||!eligible(next))continue;
      open[next]=1;queue.push(next);
     }
    }
    return open;
   }
   const originalOpening=opening(false),skinOpening=opening(true);
   for(let y=0;y<shirt.height;y++)for(let x=0;x<shirt.width;x++){
    const n=y*shirt.width+x,i=n*4,gy=y+bounds[1];if(gy<426||originalOpening[n]||skinOpening[n])clearPixel(pixels.data,i);
   }
   shirt.ctx.putImageData(pixels,0,0);
   const body=cleanParts.body.ctx.getImageData(0,0,shirt.width,shirt.height),bodyLayer=surface(bounds);
   try{
    for(let y=0;y<shirt.height;y++)for(let x=0;x<shirt.width;x++){
     const i=(y*shirt.width+x)*4,gx=x+bounds[0],gy=y+bounds[1];
     const lateral=clamp(Math.min(gx-350,649-gx)/55),lower=clamp((555-gy)/25);
     body.data[i+3]=Math.round(body.data[i+3]*lateral*lower);
    }
    bodyLayer.ctx.putImageData(body,0,0);shirt.ctx.drawImage(bodyLayer.canvas,0,0);
   }finally{bodyLayer.dispose();}
   drawRaw(shirt,at(parts.rear));
   const tie=readCrop(at(nativeTie),bounds),tieLayer=surface(bounds);
   try{
    for(let y=0;y<shirt.height;y++)if(y+bounds[1]>=530)for(let x=0;x<shirt.width;x++)clearPixel(tie.data,(y*shirt.width+x)*4);
    tieLayer.ctx.putImageData(tie,0,0);shirt.ctx.drawImage(tieLayer.canvas,0,0);
   }finally{tieLayer.dispose();}
   const withTie=shirt.ctx.getImageData(0,0,shirt.width,shirt.height),ownership=readCrop(at(connection.tieFidelity.legacyOwnership),bounds).data;
   for(let y=0;y<shirt.height;y++)if(y+bounds[1]>=530)for(let x=0;x<shirt.width;x++){
    const i=(y*shirt.width+x)*4;if(ownership[i])for(let c=0;c<4;c++)withTie.data[i+c]=legacy.data[i+c];
   }
   shirt.ctx.putImageData(withTie,0,0);shirt.ctx.drawImage(cleanParts.left.canvas,0,0);shirt.ctx.drawImage(cleanParts.right.canvas,0,0);
   const finished=shirt.ctx.getImageData(0,0,shirt.width,shirt.height).data,affected=new Uint8Array(shirt.width*shirt.height);
   for(let n=0;n<affected.length;n++){const i=n*4;if(finished[i]!==legacy.data[i]||finished[i+1]!==legacy.data[i+1]||finished[i+2]!==legacy.data[i+2]||finished[i+3]!==legacy.data[i+3])affected[n]=1;}
   if(kind==='blazer'&&!p.ownership){
    require(p.operation==='EXISTING_APPROVED_CONTROL_WITH_REGISTERED_REPLACEMENTS','unrecognized checkpoint ownership');
    // The historical B03 checkpoint already contains its approved jacket RGB.
    // Preserve those exact pixels instead of applying another jacket's mask or
    // rebuilding semitransparent checkpoint edges from separate sources.
    for(const desc of [p.jacket,...(p.hands||[]),...(p.cuffs||[])]){
     const owned=readCrop(at(desc),bounds).data;
     for(let n=0;n<affected.length;n++)if(owned[n*4+3])affected[n]=0;
    }
   }
   const scene={avatar:p.avatar||p.layers[0],shoes:p.shoes||p.layers?.[1],pants:p.pants||p.layers?.[2],hands:p.hands||p.layers?.slice(4)||[],cuffs:p.cuffs||[]};
   if(kind==='blazer'){
    const a=connection.blazerConnection.knownBlazer(s.blazerId).assembly||connection.blazerConnection.data.assembly;
    scene.jacket=p.jacket||a.jacket;scene.ownership=p.ownership;
    scene.cuffOwnershipStart=p.cuffOwnershipStart??a.sourceCuffOwnershipStart??1339;
   }
   applyOwnership(shirt,scene,at);const frame=composeScene(bounds,scene,shirt,at);
   try{return {pixels:frame.ctx.getImageData(0,0,frame.width,frame.height),affected};}finally{frame.dispose();}
  }finally{shirt.dispose();upper.dispose();for(const part of Object.values(cleanParts))part.dispose();}
 }
 async function render(s){
  const token=++epoch;loads.cancel();inherited.cancel();
  const p=inherited.plan(s),items=repairs(s,p),result=await inherited.render(s);
  if(token!==epoch||result.cancelled)return {cancelled:true};
  if(!items.length)return result;
  const descs=descriptors(p,items,s),images=await Promise.all(descs.map(desc=>loads.load(desc))).catch(error=>{if(token!==epoch)return null;throw error;});
  if(token!==epoch||!images)return {cancelled:true};
  const byHash=new Map(descs.map((desc,i)=>[desc.sha256,images[i]]));
  const at=desc=>{const image=byHash.get(bound(desc).sha256);require(image,'source was not loaded');return image;};
  const pending=[];
  for(const item of items){
   const patch=item.type==='white-native-tied-collar'?patchWhite(item,p,s,at):patchBatch(item,p,at);
   pending.push({patch,bounds:item.bounds});
  }
  if(token!==epoch)return {cancelled:true};
  // Read the current crop during this synchronous commit so overlapping
  // rectangles retain the previously repaired pixels outside their own masks.
  for(const {patch,bounds:[x0,y0,x1,y1]} of pending){
   const current=ctx.getImageData(x0,y0,x1-x0,y1-y0);
   for(let n=0;n<patch.affected.length;n++)if(patch.affected[n])for(let c=0;c<4;c++)current.data[n*4+c]=patch.pixels.data[n*4+c];
   ctx.putImageData(current,x0,y0);
  }
  return {...result,collar_repair:metadata(s,items)};
 }
 function cancel(){epoch++;loads.cancel();inherited.cancel();}
 return Object.freeze({plan,render,cancel,stats:()=>({...inherited.stats(),collarCache:loads.size,maxCollarImages:16})});
}
root.HEWRSCollarRepairs=Object.freeze({schema:config.schema,implementationVersion:'collar-candidate-20261120',ids:Object.freeze([...config.white.ids,...Object.keys(config.gap.shirts),'DS023'])});
root.HEWRSBlazerRenderer=Object.freeze({create:(canvas,connection,url)=>create(canvas,connection,url,'blazer')});
root.HEWRSShirtOnlyRenderer=Object.freeze({create:(canvas,connection,url)=>create(canvas,connection,url,'shirt-only')});
})(globalThis);
