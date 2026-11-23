#!/usr/bin/env node
'use strict';
/* Issue #22 material projection, never a new garment or avatar.
 * All cut, alpha, seams and hardware come from the selected registered layer.
 * S06 uses the owner's approved generated fabric reference; the other suit
 * colors come from the owner's supplied photographs. S13 and S14 use generated
 * texture reconstructions of their respective weaves, without changing color.
 * The linen swatch is explicitly generated material, not photographic evidence.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
let native;try{native=require('@napi-rs/canvas');}catch(_){native=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','@napi-rs/canvas'));}
const {createCanvas,loadImage}=native,ROOT=path.resolve(__dirname,'..'),W=996,H=2748;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const lum=(r,g,b)=>.2126*r+.7152*g+.0722*b;
const SOURCES={
 S06:{jacket:'65ba3284276b3b99c1ec53e4bcd0bec6c5abaed2ca6dd7c19cf04d52440a6935',trousers:'aea4f48752eb664abf5a6b7c327585e097dc539f37835f30a46890812e855861'},
 S13:{jacket:'1e458591ade65aad760155323d1bebea30ffbeccf6238a2d7508b23476135537',trousers:'3889f11eb9a64e82df3feebba32b080b6e6891402bc6784774191fe697f44ec1'},
 S14:{jacket:'527d35bdda91922b1467e7ce171dec13d100330b16c5a6ee3b048e59896c9e64',trousers:'ed8dc4d60dc595d27d6f9b1466b7a3fa3fd8e247a801362a36fd9f8879e5685e'},
 B01:{jacket:'7e772b95f1268946fc0f23ba9d12428869117d086167636d470350008edb2387'},
 B06:{jacket:'ef403e9b23af535609ecd03c6cc59915a56821c6521c7c3d940d55bd22dd709b'},
 B10:{jacket:'9d28b2d2d679cc0a8cb5bb0ce59a3f253ab70cdd973c1515901302baf772a2ea'}
};
// S06 retains the approved neutral-gray fabric reference. A 1.6x textile
// projection and a calibrated bounded gain preserve its quiet check after phone-sized
// downsampling. Keep the 24px source low-pass to avoid the OLD coarse plaid;
// do not remove the periodic texture antialias or touch the approved avatar.
const SPECS={
 S06:{approved_fabric:'s06-approved-fabric-preview.png',color_rect:[80,140,620,740],texture_rect:[80,140,620,740],neutralize_color:true,texture_scale:1.6,texture_gain:1.55,texture_filter:'periodic_binomial_3x3',blur:24,detail:0,shade_gain:.85,description:'Neutral gray subtle Glen-check weave from the owner-approved generated fabric reference'},
 S13:{revision:'S13_REFERENCE_CHECK_20261123_1',photo:'IMG_1745.jpeg',color_rect:[422,360,110,240],generated_texture:'s13-reference-check-v1.png',texture_rect:[0,0,1254,1254],texture_scale:.32,texture_gain:.6,texture_filter:'periodic_binomial_3x3',texture_mapping:'s13_lapel_seams_v1',blur:12,detail:0,shade_gain:.92,reference_photos:['IMG_1741.jpeg','IMG_1745.jpeg'],description:'Dark blue-gray fine interlocking check'},
 S14:{revision:'S14_REFERENCE_WEAVE_20261122_1',photo:'IMG_1748.jpeg',color_rect:[520,720,112,260],generated_texture:'s14-reference-weave-v1.png',texture_rect:[0,0,1254,1254],texture_scale:.55,texture_gain:.75,texture_filter:'periodic_binomial_3x3',blur:12,detail:0,shade_gain:.93,reference_photos:['IMG_1747.jpeg','IMG_1748.jpeg'],description:'Medium blue-gray fine near-solid weave'},
 B01:{linen:true,texture_scale:.42,texture_gain:.36,blur:3,detail:.12,description:'Original navy color, fine natural matte linen'},
 B06:{linen:true,texture_scale:.42,texture_gain:.61,blur:6,detail:0,description:'Original very pale desaturated sage color and crest, fine natural matte linen'},
 B10:{linen:true,texture_scale:.42,texture_gain:.52,blur:12,detail:0,description:'Original camel color, fine natural matte linen'}
};
async function image(file){const im=await loadImage(path.join(ROOT,file)),c=createCanvas(im.width,im.height),ctx=c.getContext('2d');ctx.drawImage(im,0,0);return{width:im.width,height:im.height,data:ctx.getImageData(0,0,im.width,im.height).data};}
function medianRGB(im,rect){const channels=[[],[],[]];for(let y=rect[1];y<rect[1]+rect[3];y++)for(let x=rect[0];x<rect[0]+rect[2];x++){const i=(y*im.width+x)*4;for(let k=0;k<3;k++)channels[k].push(im.data[i+k]);}return channels.map(a=>{a.sort((a,b)=>a-b);return a[Math.floor(a.length/2)];});}
// Alpha-normalized separable box smoothing. Three passes approximate a
// Gaussian without importing black transparent pixels into garment edges.
function blurScalar(values,weights,w,h,r){
 let value=Float32Array.from(values),weight=Float32Array.from(weights);
 for(let pass=0;pass<3;pass++){
  const next=new Float32Array(value.length),nw=new Float32Array(value.length),horizontal=pass!==1;
  const rows=horizontal?h:w,cols=horizontal?w:h;
  for(let line=0;line<rows;line++){
   const at=x=>horizontal?line*w+x:x*w+line;
   let sum=0,den=0;for(let k=0;k<=Math.min(r,cols-1);k++){sum+=value[at(k)]*weight[at(k)];den+=weight[at(k)];}
   for(let x=0;x<cols;x++){
    const p=at(x);next[p]=den?sum/den:value[p];nw[p]=weight[p];
    const remove=x-r,add=x+r+1;if(remove>=0){sum-=value[at(remove)]*weight[at(remove)];den-=weight[at(remove)];}if(add<cols){sum+=value[at(add)]*weight[at(add)];den+=weight[at(add)];}
   }
  }value=next;weight=nw;
 }return value;
}
function scalar(im){const v=new Float32Array(im.width*im.height),a=new Float32Array(v.length);for(let p=0;p<v.length;p++){const i=p*4;v[p]=lum(...im.data.subarray(i,i+3));a[p]=im.data[i+3]/255;}return{v,a};}
function sampleTexture(im,rect){const [x0,y0,w,h]=rect,v=new Float32Array(w*h),a=new Float32Array(w*h).fill(1);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=((y0+y)*im.width+x0+x)*4;v[y*w+x]=lum(...im.data.subarray(i,i+3));}const trend=blurScalar(v,a,w,h,Math.max(5,Math.round(Math.min(w,h)/13)));for(let p=0;p<v.length;p++)v[p]-=trend[p];
 // Overlap unreflected neighbouring swatches. Reflection reverses the weave
 // and produces false chevrons; a short crossfade retains its real direction.
 const overlap=Math.max(4,Math.round(Math.min(w,h)*.16)),tw=w-overlap,th=h-overlap,tile=new Float32Array(tw*th);let mean=0;
 for(let y=0;y<th;y++)for(let x=0;x<tw;x++){const fx=x<overlap?smooth(x/overlap):1,fy=y<overlap?smooth(y/overlap):1,xx=x<overlap?x+tw:x,yy=y<overlap?y+th:y;const value=v[y*w+x]*fx*fy+v[y*w+xx]*(1-fx)*fy+v[yy*w+x]*fx*(1-fy)+v[yy*w+xx]*(1-fx)*(1-fy);tile[y*tw+x]=value;mean+=value;}
 mean/=tile.length;for(let p=0;p<tile.length;p++)tile[p]-=mean;return{w:tw,h:th,v:tile};}
// The approved normal-view swatch contains subpixel weave at phone size.
// A small periodic low-pass removes the sampling frequencies that otherwise
// become false broad checker blocks when the avatar is reduced to 360/390px.
// This affects the material signal only; source silhouette and garment edges
// never enter this filter. Periodic addressing preserves seamless tiling.
function antialiasTexture(texture){
 const {w,h,v}=texture,result=new Float32Array(v.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let value=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const weight=(dx===0?2:1)*(dy===0?2:1);
   value+=v[((y+dy+h)%h)*w+(x+dx+w)%w]*weight;
  }
  result[y*w+x]=value/16;
 }
 return{w,h,v:result};
}
const wrap=(x,n)=>((x%n)+n)%n;
function texAt(t,x,y){x=wrap(x,t.w);y=wrap(y,t.h);const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,jx=(ix+1)%t.w,jy=(iy+1)%t.h;return t.v[iy*t.w+ix]*(1-fx)*(1-fy)+t.v[iy*t.w+jx]*fx*(1-fy)+t.v[jy*t.w+ix]*(1-fx)*fy+t.v[jy*t.w+jx]*fx*fy;}
function distance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],u=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(x-a[0]-u*dx,y-a[1]-u*dy);}
function polyDistance(x,y,points){let d=Infinity;for(let i=1;i<points.length;i++)d=Math.min(d,distance(x,y,points[i-1],points[i]));return d;}
function protectedDetails(id,kind){
 if(kind==='trousers')return{lines:[],ellipses:[]};
 if(id.startsWith('S'))return{lines:[[[285,511],[506,854],[499,934]],[[694,512],[508,956]],[[623,727],[750,702]],[[245,1098],[350,1110]],[[241,1173],[340,1184]],[[658,1112],[775,1100]],[[660,1175],[775,1167]]],ellipses:[[498,988,20,23],[475,1148,22,23]]};
 if(id==='B01')return{lines:[[[298,488],[463,780]],[[698,486],[570,785]],[[630,639],[758,620]],[[260,1036],[374,1042],[371,1260],[344,1312],[251,1304]],[[626,1044],[756,1043],[771,1280],[744,1310],[657,1310]]],ellipses:[]};
 return{lines:[[[289,511],[490,944]],[[715,530],[505,973]],[[643,693],[754,675]],[[235,1084],[350,1114],[358,1325],[250,1328]],[[651,1114],[787,1086],[801,1316],[712,1334]]],ellipses:[[511,965,21,22],...(id==='B06'?[[714,773,34,42]]:[])]};
}
function preserveWeight(x,y,shapes){let w=0;for(const [cx,cy,rx,ry]of shapes.ellipses){const d=Math.hypot((x-cx)/rx,(y-cy)/ry);w=Math.max(w,1-smooth((d-.9)/.4));}for(const line of shapes.lines)w=Math.max(w,1-smooth((polyDistance(x,y,line)-1.1)/2.6));return w;}
function coordinates(id,kind,x,y,scale,mapping){
 let u=x,v=y;
 if(kind==='jacket'){
  if(x<235)u+=.06*(y-750);else if(x>775)u-=.06*(y-750);
  if(id==='S13'&&mapping==='s13_lapel_seams_v1'){
   // Rotate S13's crossed yarn only on the actual lapel faces. The former
   // rectangular upper-chest selector ended across unseamed body cloth at
   // y=930, which a clearer check exposes as an invented horizontal join.
   // These boundaries follow the immutable seam lines in protectedDetails;
   // source alpha clips the inner shirt opening. No garment pixel is moved.
   const left=y<=511?285:y<=854?285+(y-511)*221/343:506-(y-854)*7/80;
   const right=y<=512?694:694-(y-512)*186/444;
   if(y>=400&&y<=934&&x>=left&&x<=506){u=x*.88+(y-430)*.27;v=y*.93-x*.23;}
   else if(y>=400&&y<=956&&x>=508&&x<=right){u=x*.88-(y-430)*.27;v=y*.93+x*.23;}
  }else if(y<930&&x>285&&x<480){u=x*.88+(y-430)*.27;v=y*.93-x*.23;}
  else if(y<930&&x>520&&x<708){u=x*.88-(y-430)*.27;v=y*.93+x*.23;}
 }
 return[u/scale,v/scale];
}
function project(source,id,kind,spec,texture,target){
 const {v,a}=scalar(source),low=blurScalar(v,a,W,H,spec.blur),output=new Uint8ClampedArray(source.data),details=protectedDetails(id,kind);
 let mean=0,n=0;for(let p=0;p<v.length;p++)if(a[p]>.99){mean+=low[p];n++;}mean/=n;
 const stats={source_mean_rgb:[0,0,0],display_mean_rgb:[0,0,0],alpha_changed_pixels:0,changed_rgb_pixels:0,protected_hardware_pixels:0,opaque_pixels:n};
 for(let p=0;p<v.length;p++){
  const i=p*4;if(!source.data[i+3])continue;
  const x=p%W,y=Math.floor(p/W),preserve=preserveWeight(x,y,details),[u,vv]=coordinates(id,kind,x,y,spec.texture_scale,spec.texture_mapping),thread=clamp(texAt(texture,u,vv)*spec.texture_gain,-15,15);
  const shade=low[p]-mean,detail=(v[p]-low[p])*spec.detail;
  let hardware=0;for(const [cx,cy,rx,ry]of details.ellipses){const d=Math.hypot((x-cx)/rx,(y-cy)/ry);hardware=Math.max(hardware,1-smooth((d-.9)/.4));}if(hardware===1)stats.protected_hardware_pixels++;
  for(let k=0;k<3;k++){
   // Linen keeps local chroma and cloth mean. Suits use their explicit fabric
   // reference color with native light/dark folds; hardware stays original RGB.
   let value;if(spec.linen){const chroma=source.data[i+k]-v[p];value=low[p]+chroma+detail+thread;}else value=target[k]+shade*spec.shade_gain+detail+thread;
   const preserved=spec.linen?source.data[i+k]:clamp(v[p]-mean+target[k],0,255);
   value=value*(1-preserve)+preserved*preserve;
   // Buttons and the existing crest are original RGB, without recoloring.
   value=value*(1-hardware)+source.data[i+k]*hardware;output[i+k]=clamp(Math.round(value),0,255);
  }
  if(output[i]!==source.data[i]||output[i+1]!==source.data[i+1]||output[i+2]!==source.data[i+2])stats.changed_rgb_pixels++;
  if(a[p]>.99)for(let k=0;k<3;k++){stats.source_mean_rgb[k]+=source.data[i+k];stats.display_mean_rgb[k]+=output[i+k];}
 }
 for(const key of ['source_mean_rgb','display_mean_rgb'])stats[key]=stats[key].map(v=>Math.round(v/n*1000)/1000);
 const alpha=Buffer.alloc(W*H);for(let p=0;p<W*H;p++){alpha[p]=source.data[p*4+3];if(alpha[p]!==output[p*4+3])stats.alpha_changed_pixels++;}
 return{data:output,stats,alpha_sha256:sha(alpha)};
}
async function build(){
 const linen=await image('provenance/issue22/natural-linen-material-v1.png'),linenTexture=sampleTexture(linen,[0,0,linen.width,linen.height]);
 const manifest={schema:'hewrs.issue22.materials.v1',revision:'ISSUE22_S06_PHONE_CHECK_20261122_3',canvas:[W,H],scope:Object.keys(SOURCES),alpha_policy:'exact_source_alpha',avatar_policy:'no_avatar_asset_or_geometry_access',assetPaths:{},bindings:{},garments:{},limitations:['Source photographs are phone screenshots without calibrated lighting or color.','S13 and S14 colors are photographic sample interpretations, not physical color measurements.','S06 uses the normal-view panel of the owner-approved generated fabric reference, with its median luminance neutralized to equal RGB channels; approval applies to fabric appearance, not a new garment or avatar. Its material signal is prefiltered to prevent false checker blocks on phone-size downscaling; the original coarse plaid is suppressed before retaining source shading.','Linen microtexture is a generated material swatch; garment geometry, local colors, seams and hardware retain their registered source.']};
 const provenance={schema:'hewrs.issue22.material-provenance.v1',issue:22,generated_linen:{path:'provenance/issue22/natural-linen-material-v1.png',sha256:sha(fs.readFileSync(path.join(ROOT,'provenance/issue22/natural-linen-material-v1.png'))),purpose:'Neutral fine matte natural flax linen material; no garment design or avatar generated',tool:'built-in image_gen',prompt:'Square straight-on macro fine natural matte linen cloth, neutral light gray, subtle slubs and tiny soft crinkles, low contrast uniform lighting, no garment edges, seams, labels, logos or coarse holes.'},photographs:{},source_alpha_locked:true,source_files_unchanged:true};
 for(const [id,layers]of Object.entries(SOURCES)){
  const spec=SPECS[id];let texture=linenTexture,target=null;
  if(spec.approved_fabric){
   const referencePath='provenance/issue22/'+spec.approved_fabric,reference=await image(referencePath),sampled=medianRGB(reference,spec.color_rect);
   target=spec.neutralize_color?Array(3).fill(Math.round(lum(...sampled))):sampled;texture=sampleTexture(reference,spec.texture_rect);
   if(spec.texture_filter==='periodic_binomial_3x3')texture=antialiasTexture(texture);
   provenance.generated_fabrics??={};provenance.generated_fabrics[id]={path:referencePath,sha256:sha(fs.readFileSync(path.join(ROOT,referencePath))),source_type:'owner-approved-generated-fabric-reference',approval_scope:'fabric appearance only; not a new garment geometry or avatar approval',panel:'normal view (left); close-up panel excluded from projection',sample_rect:spec.texture_rect,sampled_median_rgb:sampled,target_rgb:target,color_policy:'equal RGB channels from rounded sample median luminance',texture_filter:spec.texture_filter,source_shading_policy:'24-pixel alpha-normalized smoothing suppresses old coarse plaid; original seams and hardware retain their existing protection masks; no residual original fabric detail is reintroduced',tool:'built-in image_gen',purpose:'Project the approved subtle neutral-gray textile onto the existing registered jacket and paired trousers'};
  }else if(!spec.linen){
   const color=await image('provenance/issue22/'+spec.photo),texturePath='provenance/issue22/'+(spec.generated_texture||spec.texture_photo),sample=await image(texturePath);
   target=medianRGB(color,spec.color_rect);texture=sampleTexture(sample,spec.texture_rect);
   if(spec.texture_filter==='periodic_binomial_3x3')texture=antialiasTexture(texture);
   for(const f of spec.reference_photos)provenance.photographs[f]={path:'provenance/issue22/'+f,sha256:sha(fs.readFileSync(path.join(ROOT,'provenance/issue22/'+f))),role:'owner-supplied-garment-photo',id};
   if(spec.generated_texture){
    provenance.generated_textures??={};
    if(id==='S14')provenance.generated_textures[id]={path:texturePath,sha256:sha(fs.readFileSync(path.join(ROOT,texturePath))),source_type:'generated-texture-reconstruction-from-owner-photographs',tool:'built-in image_gen',reference_photographs:spec.reference_photos,close_up_reference_sha256:'81f8a0781d5fc7485987f40ffc61b38d3271ce840fecfbe38398240a69a3b90f',purpose:'Restore the fine irregular vertically biased weave at native picker and phone sizes on the existing registered S14 layers',color_policy:'Only texture luminance is projected; the existing photographic color sample and source shading are retained',geometry_policy:'No garment or avatar generated; original alpha, seams and buttons are preserved',approval_scope:'Owner requested the B06 correction workflow for S14; no new textile composition or whole-outfit approval inferred',prompt_summary:'Flat straight-on continuous swatch of the supplied S14 jacket fabric: matte dense muted slate blue-gray suiting, fine irregular vertical woven grain with tiny broken lighter yarns and subtle cross-yarn interlocking; quiet near-solid from a distance. No plaid, herringbone, coarse slubs, holes, gloss, folds, seams, garment, labels or UI. The app uses luminance only.'};
    else if(id==='S13')provenance.generated_textures[id]={path:texturePath,sha256:sha(fs.readFileSync(path.join(ROOT,texturePath))),...{"source_type":"generated-texture-reconstruction-from-owner-photographs","tool":"built-in image_gen","reference_photographs":["IMG_1741.jpeg","IMG_1745.jpeg"],"additional_reference":{"file_name":"IMG_1739.jpeg","sha256":"e08ee416a0acc748f8228fd2e86c1832349ce66d263da32b618653a715154a41","role":"owner-supplied studio composite used for normal-view pattern scale; not color calibration"},"purpose":"Restore S13's fine crossed and interlocking check at native, picker and phone sizes on the existing registered layers","color_policy":"Only texture luminance is projected; the exact prior photographic RGB target [44,48,58] is retained","geometry_policy":"No garment or avatar generated; original alpha, seams and buttons are preserved","approval_scope":"Owner requested the same correction workflow as the previous suits through the live app; no new textile composition or matching policy inferred","source_shading_policy":"12-pixel alpha-normalized smoothing removes muddy original texture while retaining broad folds; protected source seams and original hardware remain","prompt":"Use case: product-mockup. Asset type: one square continuous fabric texture for an existing wardrobe app suit S13. Reconstruct ONLY the actual suiting fabric visible in the three reference photographs into a flat, straight-on, uniformly lit swatch. Reference 1 (rear shoulder close-up) controls the fine crossed thread structure; reference 2 (front jacket and trousers) controls the subdued check organization; reference 3 (studio full outfit composite) controls the restrained normal-view pattern scale. Ignore all people, shirt, tie, garment edges, seams, buttons, background, and phone UI. Material appearance: dark desaturated slate-blue/blue-gray ground with closely spaced lighter muted blue-gray threads running in BOTH directions, organized into small irregular rectangular/interlocking check groups. The subtle group lines are subordinate to the dense fine woven threads. Show roughly 14–18 small check groups across the square, each containing many fine crossed yarns. The cloth must remain visibly but quietly checked at normal viewing scale, with crisp fine interwoven detail up close, not muddied dark blobs. Preserve the reference character; this is S13 crossed/interlocking check, NOT S14's predominantly vertical near-solid weave. Photorealistic matte tightly woven suiting under perfectly even soft diffuse light. Flat continuous texture filling the entire image edge to edge, no borders. No bright white grid, large bold windowpane plaid, broad dark bars, herringbone, tweedy pebbles, thick slubs, oversized yarn, coarse holes, gloss, folds, wrinkles, shadows, gradients, seams, clothing silhouette, person, labels, text or UI. This is a generated texture reconstruction from photographs, not a new garment. The app will use only its luminance detail and retain the existing S13 photographic color target."}};
    else throw Error('Missing garment-specific generated texture provenance: '+id);
   }
  }
  manifest.garments[id]={description:spec.description,material:spec.linen?'linen':spec.approved_fabric?'owner-approved-generated-fabric':'photographic-suit-fabric',target_rgb:target,parameters:spec,source_layers:[],...(spec.revision?{revision:spec.revision}:{})};
  for(const[kind,hash]of Object.entries(layers)){
   const sourcePath='assets/'+hash+'.png',bytes=fs.readFileSync(path.join(ROOT,sourcePath));if(sha(bytes)!==hash)throw Error('Source hash differs '+id+'/'+kind);
   const source=await image(sourcePath);if(source.width!==W||source.height!==H)throw Error('Native source dimensions differ');
   const rendered=project(source,id,kind,spec,texture,target),canvas=createCanvas(W,H),ctx=canvas.getContext('2d'),frame=ctx.createImageData(W,H);frame.data.set(rendered.data);ctx.putImageData(frame,0,0);const png=canvas.toBuffer('image/png'),displaySha=sha(png),url='assets/issue22-materials/'+id+'-'+kind+'-'+displaySha.slice(0,16)+'.png';fs.writeFileSync(path.join(ROOT,url),png);
   manifest.assetPaths[displaySha]=url;manifest.bindings[hash]={garment_id:id,layer:kind,source_sha256:hash,source_url:sourcePath,display_sha256:displaySha,display_url:url,rect:[0,0,W,H],alpha_sha256:rendered.alpha_sha256,measurements:rendered.stats};manifest.garments[id].source_layers.push(hash);
   console.log(id+'/'+kind+' '+JSON.stringify(rendered.stats)+' -> '+url);
  }
 }
 fs.writeFileSync(path.join(ROOT,'data/issue22-materials.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(ROOT,'data/issue22-materials.js'),'globalThis.HEWRS_ISSUE22_MATERIALS='+JSON.stringify(manifest)+';\n');fs.writeFileSync(path.join(ROOT,'provenance/issue22/material-provenance.json'),JSON.stringify(provenance,null,2)+'\n');return manifest;
}
module.exports={build,SOURCES,SPECS,project,protectedDetails,preserveWeight,sha,texAt,sampleTexture};if(require.main===module)build().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
