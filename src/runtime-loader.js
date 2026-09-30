/* V1.22.1: small on-demand index loader. Never reads/writes user storage.
 * The normal browser build pins its exact index by content hash + SRI.
 * Standalone and source-test builds may already have the original data loaded.
 */
(function(root){'use strict';
 const doc=typeof document==='undefined'?null:document;
 const owner=doc?.currentScript;
 const url=owner?.dataset?.engineIndex||'data/option-index.js?v=1221';
 const integrity=owner?.dataset?.engineIntegrity||'';
 let pending=null,tag=null,timer=null,start=typeof performance==='object'?performance.now():0;
 const counters={indexRequests:0,indexReady:!!root.HEWRS_OPTION_INDEX,homeReadyMs:null};
 function notice(text,error){if(!doc)return;const n=doc.getElementById('home-notice');if(n){n.textContent=text;n.dataset.error=String(!!error);}}
 function valid(){const x=root.HEWRS_OPTION_INDEX;
  if(!x||x.schema!=='hewrs.derived-clothing-index.v1_17_0'||x.source_input_sha256!==root.HEWRS_INPUT_SHA256||x.current_source_revision!==root.HEWRSSourceCorrections?.revision||x.normalization_revision!==root.HEWRSEnsembleCompletion?.normalizationRevision)throw Error('Outfit index does not match this app. Reload the complete update; saved data is unchanged.');
  counters.indexReady=true;return true;
 }
 function ensureIndex(){
  if(root.HEWRS_OPTION_INDEX){try{valid();return Promise.resolve(true);}catch(e){return Promise.reject(e);}}
  if(pending)return pending;
  if(!doc)return Promise.reject(Error('Outfit index is not loaded in this runtime.'));
  pending=new Promise((resolve,reject)=>{let settled=false;tag=doc.createElement('script');tag.async=true;tag.dataset.hewrsLazyIndex='true';tag.src=url;if(integrity)tag.integrity=integrity;
   const end=(err)=>{if(settled)return;settled=true;clearTimeout(timer);tag.onload=tag.onerror=null;if(err){tag.remove();pending=null;reject(err);}else resolve(true);};
   tag.onload=()=>{try{valid();end();}catch(e){end(e);}};
   tag.onerror=()=>end(Error('Outfit index could not be downloaded. Check your connection, then Generate again. Do not clear website data.'));
   timer=setTimeout(()=>end(Error('Outfit index download timed out. Check your connection, then Generate again. Saved data was not changed.')),30000);
   counters.indexRequests++;doc.head.appendChild(tag);
  });return pending;
 }
 let slow=null;
 function ready(){clearTimeout(slow);counters.homeReadyMs=(typeof performance==='object'?performance.now():start)-start;}
 if(doc&&owner?.dataset?.boot==='true'){
  slow=setTimeout(()=>{if(!root.HEWRS_READY)notice('Still loading application files. Check the connection or reload this page; do not clear website data.',true);},20000);
  root.addEventListener('error',event=>{if(root.HEWRS_READY)return;const n=event.target;
   if(n?.tagName==='SCRIPT'){clearTimeout(slow);notice('An application file did not load. Reload this page after checking your connection. Saved data has not been cleared.',true);}
   else if(event.error||event.message){clearTimeout(slow);root.HEWRS_LOAD_ERROR=String(event.message||event.error);notice('Application startup failed: '+root.HEWRS_LOAD_ERROR+'. Reload the complete update; do not clear website data.',true);}
  },true);
 }
 root.HEWRSRuntimeLoader=Object.freeze({ensureIndex,ready,stats:()=>({...counters})});
})(globalThis);
