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
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),cache=new Map();let epoch=0;
 function descriptor(req){need(req?.shirtId==='DS035'&&(req.state==='NO_TIE'||Object.hasOwn(manifest.ties,req.state)),'DS035 selected states only; no reference or fallback');return binding.states[req.state==='NO_TIE'?'no_tie':'tied'];}
 function crop(d){
  need(d&&/^[a-f0-9]{64}$/.test(d.sha256)&&/^assets\/[A-Za-z0-9_./-]+\.png$/.test(d.url)&&!d.url.includes('..')&&d.rect?.join(',')==='0,0,996,2748','Invalid edge-cleanup asset');
  if(cache.has(d.sha256))return cache.get(d.sha256);
  const p=new Promise((resolve,reject)=>{const im=new Image();im.onerror=()=>reject(Error('Edge-cleanup dependency failed to load'));
   im.onload=()=>{try{need(im.naturalWidth===996&&im.naturalHeight===2748,'Edge-cleanup dimensions changed');const c=document.createElement('canvas');c.width=w;c.height=h;const cc=c.getContext('2d',{willReadFrequently:true});cc.drawImage(im,x0,y0,w,h,0,0,w,h);const data=cc.getImageData(0,0,w,h).data;c.width=c.height=1;resolve(data);}catch(e){reject(e);}};
   try{im.src=resolveUrl?resolveUrl(d):d.url;}catch(e){reject(e);}
  });cache.set(d.sha256,p);p.catch(()=>{if(cache.get(d.sha256)===p)cache.delete(d.sha256);});while(cache.size>6)cache.delete(cache.keys().next().value);return p;
 }
 function plan(req){const original=base.plan(req),patch=descriptor(req);return [{...structuredClone(patch),render_operation:'bounded-edge-RGB-cleanup',opacity_changes_limited_to_patch:true,exclude_alpha_of:manifest.ties[req.state]?.display_layer??null},...original];}
 async function render(req){
  const id=++epoch,d=descriptor(req),tie=manifest.ties[req.state]?.display_layer,j=manifest.static.jacket;
  const [result,patch,tiePixels,jacket,jkeep]=await Promise.all([base.render(req),crop(d),tie?crop(tie):Promise.resolve(null),crop(j),j.display_alpha_mask?crop(j.display_alpha_mask):Promise.resolve(null)]);
  if(id!==epoch||result.cancelled)return {cancelled:true};
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
 function cancel(){epoch++;base.cancel();}
 return Object.freeze({plan,render,cancel,stats:()=>({...base.stats(),edgeImageCache:cache.size})});
}
root.HEWRSDS035EdgeRenderer=Object.freeze({create});
})(globalThis);
