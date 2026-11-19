/* Instance-local native image loads. Cancelled work must settle and must not
 * leave an unresolved cached promise preventing the next exact render. This
 * changes transport lifetime only; registered descriptors and pixels remain
 * the caller's responsibility. Completed cache entries survive cancellation. */
(function(root){'use strict';
function create({limit,resolveUrl,width,height,missing='Image failed to load',dimensions='Wrong source dimensions',decode=image=>image}={}){
 const cache=new Map(),pending=new Set();
 const message=(value,descriptor)=>typeof value==='function'?value(descriptor):value;
 function load(descriptor){
  let url;try{url=resolveUrl?resolveUrl(descriptor):descriptor.url;}catch(error){return Promise.reject(error);}
  // A descriptor's declared source hash and its resolved transport both bind
  // the cache. Distinct registered display sources cannot alias by old URL.
  const key=descriptor.sha256+'\n'+url;
  if(cache.has(key)){const entry=cache.get(key);cache.delete(key);cache.set(key,entry);return entry.promise;}
  const entry={key,promise:null,cancel:null};
  entry.promise=new Promise((resolve,reject)=>{
   const image=new root.Image();let settled=false;
   function finish(error,value){
    if(settled)return;settled=true;pending.delete(entry);image.onload=image.onerror=null;
    if(error){if(cache.get(key)===entry)cache.delete(key);reject(error);}else resolve(value);
   }
   entry.cancel=()=>{const error=Error('Image load cancelled');error.name='AbortError';error.code='HEWRS_RENDER_CANCELLED';finish(error);try{image.src='';}catch(_){}};
   pending.add(entry);
   image.onload=()=>{if(settled)return;try{if(image.naturalWidth!==width||image.naturalHeight!==height)throw Error(message(dimensions,descriptor));finish(null,decode(image,descriptor));}catch(error){finish(error);}};
   image.onerror=()=>finish(Error(message(missing,descriptor)));
   try{image.src=url;}catch(error){finish(error);}
  });
  cache.set(key,entry);
  // A synchronous Image mock/URL failure can settle before cache.set; retain
  // the same identity check so a late rejection cannot evict a newer retry.
  entry.promise.catch(()=>{if(cache.get(key)===entry)cache.delete(key);});
  while(cache.size>limit)cache.delete(cache.keys().next().value);
  return entry.promise;
 }
 function cancel(){for(const entry of [...pending])entry.cancel();}
 return Object.freeze({load,cancel,get size(){return cache.size;},get pending(){return pending.size;}});
}
root.HEWRSRenderImageLoader=Object.freeze({create});
})(globalThis);
