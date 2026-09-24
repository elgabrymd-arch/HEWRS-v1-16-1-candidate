/* Authorized DS035-only integration derivative. Inherited Active50 renderer is
 * unchanged. The extension runs on the private frame, beneath existing pixels.
 * No extension runs for S05-template suits or for any other shirt. */
(function(root){'use strict';
const need=(ok,msg)=>{if(!ok)throw Error(msg);},clone=x=>structuredClone(x);
function create(canvas,manifest,resolveUrl){
 const original=root.HEWRSActive50.create(canvas,manifest,resolveUrl);
 const binding=manifest.ds035_s11_coverage;
 if(!binding)return original;
 need(binding.schema==='hewrs.ds035.s11.coverage.v1_3'&&binding.wider_suit_ids.includes(binding.selected_suit_id),'Unbound DS035 coverage route');
 const [x0,y0,x1,y1]=binding.roi,w=x1-x0,h=y1-y0;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});let epoch=0;const cache=new Map();
 function descriptor(req){
  need(req?.shirtId==='DS035'&&(req.state==='NO_TIE'||Object.hasOwn(manifest.ties,req.state)),'Coverage applies only to DS035 selected states; no reference substitution');
  return binding.states[req.state==='NO_TIE'?'no_tie':'tied'];
 }
 function crop(d){
  need(d&&/^[a-f0-9]{64}$/.test(d.sha256)&&d.rect?.join(',')==='0,0,996,2748','Invalid coverage image binding');
  if(cache.has(d.sha256))return cache.get(d.sha256);
  const p=new Promise((resolve,reject)=>{const im=new Image();im.onerror=()=>reject(Error('DS035 coverage dependency could not load'));
   im.onload=()=>{try{need(im.naturalWidth===996&&im.naturalHeight===2748,'Coverage dependency dimensions changed');const c=document.createElement('canvas');c.width=w;c.height=h;const cc=c.getContext('2d',{willReadFrequently:true});cc.drawImage(im,x0,y0,w,h,0,0,w,h);const a=cc.getImageData(0,0,w,h).data;c.width=c.height=1;resolve(a);}catch(e){reject(e);}};
   try{im.src=resolveUrl?resolveUrl(d):d.url;}catch(e){reject(e);}
  });cache.set(d.sha256,p);p.catch(()=>{cache.delete(d.sha256);});while(cache.size>4)cache.delete(cache.keys().next().value);return p;
 }
 function plan(req){const order=original.plan(req),ext=descriptor(req),tie=manifest.ties[req.state]?.display_layer;
  return [{...clone(ext),render_operation:'destination-underfill-only',exclude_alpha_of:tie?clone(tie):null},...order];
 }
 async function render(req){
  const token=++epoch,d=descriptor(req),tie=manifest.ties[req.state]?.display_layer;
  // The inherited renderer still assembles all original layers at native coordinates.
  const [result,patch,tiePixels]=await Promise.all([original.render(req),crop(d),tie?crop(tie):Promise.resolve(null)]);
  if(token!==epoch||result.cancelled)return {cancelled:true};
  const image=ctx.getImageData(x0,y0,w,h),a=image.data;let changed=0;
  for(let i=0;i<a.length;i+=4){
   if(!patch[i+3]||a[i+3]===255||(tiePixels&&tiePixels[i+3]>0))continue;
   const oldAlpha=a[i+3];
   for(let c=0;c<3;c++)a[i+c]=Math.round((a[i+c]*oldAlpha+patch[i+c]*(255-oldAlpha))/255);
   a[i+3]=255;changed++;
  }
  if(token!==epoch)return {cancelled:true};ctx.putImageData(image,x0,y0);
  return {...result,components:result.components+1,coverage:{shirtId:'DS035',suitId:binding.selected_suit_id,changed_pixels:changed,extension_sha256:d.sha256,roi:binding.roi},review:'AUTHORIZED_DS035_COVERAGE_DERIVATIVE'};
 }
 function cancel(){epoch++;original.cancel();}
 return Object.freeze({plan,render,cancel,stats:()=>({...original.stats(),coverageImageCache:cache.size})});
}
root.HEWRSDS035CoverageRenderer=Object.freeze({create});
})(globalThis);
