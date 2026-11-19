/* DS035 S11-only edge correction. All inherited garment files and the V1.4
 * coverage compositor are read-only. Opaque extraction debris is not treated
 * as real fabric. The selected tie and the actual jacket edge remain controls. */
(function(root){'use strict';
const need=(ok,msg)=>{if(!ok)throw Error(msg);};
function create(canvas,manifest,resolveUrl){
 const binding=manifest.ds035_s11_edge;
 if(!manifest.ds035_s11_coverage){need(!binding,'Edge cleanup cannot run without its restricted route');return root.HEWRSDS035CoverageRenderer.create(canvas,manifest,resolveUrl);}
 need(binding?.schema==='hewrs.ds035.s11.edge.v1_5','Missing DS035 edge-cleanup binding');
 need(binding.wider_suit_ids.includes(binding.selected_suit_id)&&binding.selected_suit_id===manifest.ds035_s11_coverage.selected_suit_id,'Wrong edge-cleanup suit');
 for(const mode of ['no_tie','tied'])need(manifest.shirts.DS035.states[mode].body.sha256===binding.original_body_hashes[mode],'DS035 edge cleanup requires the exact original body');
 const base=root.HEWRSDS035CoverageRenderer.create(canvas,manifest,resolveUrl);
 const [x0,y0,x1,y1]=binding.roi,w=x1-x0,h=y1-y0;
 need([x0,y0,x1,y1].join(',')==='340,350,660,950','Edge cleanup region changed');
 const ctx=canvas.getContext('2d',{willReadFrequently:true});let epoch=0;
 const loads=root.HEWRSRenderImageLoader.create({limit:6,resolveUrl,width:996,height:2748,missing:'Edge-cleanup dependency failed to load',dimensions:'Edge-cleanup dimensions changed',decode:im=>{
  const c=document.createElement('canvas');c.width=w;c.height=h;try{const cc=c.getContext('2d',{willReadFrequently:true});cc.drawImage(im,x0,y0,w,h,0,0,w,h);return cc.getImageData(0,0,w,h).data;}finally{c.width=c.height=1;}
 }});
 function descriptor(req){need(req?.shirtId==='DS035'&&(req.state==='NO_TIE'||Object.hasOwn(manifest.ties,req.state)),'DS035 selected states only; no reference or fallback');return binding.states[req.state==='NO_TIE'?'no_tie':'tied'];}
 function crop(d){
  need(d&&/^[a-f0-9]{64}$/.test(d.sha256)&&/^assets\/[A-Za-z0-9_./-]+\.png$/.test(d.url)&&!d.url.includes('..')&&d.rect?.join(',')==='0,0,996,2748','Invalid edge-cleanup asset');
  return loads.load(d);
 }
 function plan(req){const original=base.plan(req),patch=descriptor(req);return [{...structuredClone(patch),render_operation:'bounded-edge-RGB-cleanup',opacity_changes_limited_to_patch:true,exclude_alpha_of:manifest.ties[req.state]?.display_layer??null},...original];}
 async function render(req){
  const id=++epoch;loads.cancel();const d=descriptor(req),tie=manifest.ties[req.state]?.display_layer,j=manifest.static.jacket;
  const loaded=await Promise.all([base.render(req),crop(d),tie?crop(tie):Promise.resolve(null),crop(j),j.display_alpha_mask?crop(j.display_alpha_mask):Promise.resolve(null)]).catch(error=>{if(id!==epoch)return null;throw error;});
  if(id!==epoch||!loaded)return {cancelled:true};const [result,patch,tiePixels,jacket,jkeep]=loaded;if(result.cancelled)return {cancelled:true};
  const image=ctx.getImageData(x0,y0,w,h),a=image.data;let changed=0;
  for(let i=0;i<a.length;i+=4){
   if(!patch[i+3]||(tiePixels&&tiePixels[i+3]))continue;
   const ja=jkeep?Math.floor((jacket[i+3]*jkeep[i+3]+127)/255):jacket[i+3];
   if(ja===255)continue;const t=patch[i+3]/255,jt=ja/255,oldAlpha=a[i+3]/255,newAlpha=t+oldAlpha*(1-t);let different=false;
   for(let k=0;k<3;k++){const target=patch[i+k]*(1-jt)+jacket[i+k]*jt;const value=Math.round((a[i+k]*oldAlpha*(1-t)+target*t)/newAlpha);if(value!==a[i+k])different=true;a[i+k]=value;}
   // Fill only the residual transparent dots inside this same edge mask.
   const alpha=Math.round(newAlpha*255);if(a[i+3]!==alpha)different=true;a[i+3]=alpha;
   if(different)changed++;
  }
  if(id!==epoch)return {cancelled:true};ctx.putImageData(image,x0,y0);
  return {...result,components:result.components+1,edge_cleanup:{shirtId:'DS035',suitId:binding.selected_suit_id,changed_pixels:changed,patch_sha256:d.sha256,roi:binding.roi,opacity_changes_limited_to_patch:true},review:'LOCAL_DS035_RIGHT_EDGE_CORRECTION'};
 }
 function cancel(){epoch++;loads.cancel();base.cancel();}
 return Object.freeze({plan,render,cancel,stats:()=>({...base.stats(),edgeImageCache:loads.size})});
}
root.HEWRSDS035EdgeRenderer=Object.freeze({create});
})(globalThis);
