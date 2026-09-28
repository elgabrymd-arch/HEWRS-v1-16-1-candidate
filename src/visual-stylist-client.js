/* Network adapter. The provider key is never accepted by this module.
 * Only an expiring service session token is retained, in page memory only.
 * No wear history, precise coordinates, face pixels or browser backups are sent.
 */
(function(root){'use strict';
const SCHEMA='hewrs.visual-stylist.v1';
function error(code,msg){const e=Error('['+code+'] '+msg);e.code=code;return e;}
function publicRequest(q){return {source_lock:q.source_lock,prefs:structuredClone(q.prefs),context:structuredClone(q.context),executiveStyle:q.executiveStyle,date:q.localDate,weather:{source:q.environment.source,temperatureBand:q.environment.temperatureBand||null,precipitation:q.environment.precipitation||null,season:q.environment.season||null}};}
function create({config=root.HEWRS_VISUAL_SERVICE_CONFIG,fetcher=root.fetch?.bind(root),clock=()=>Date.now()}={}){
 let token=null,expires=0,controller=null,providerReady=false;
 const endpoint=config?.endpoint?.replace(/\/$/,'')||null;
 if(endpoint){const u=new URL(endpoint);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw error('SERVICE_CONFIGURATION','The configured endpoint must be HTTPS without credentials/query/fragment.');}
 function disconnect(){controller?.abort();token=null;expires=0;providerReady=false;}
 const signedIn=()=>!!endpoint&&!!token&&clock()<expires;const ready=()=>signedIn()&&providerReady;
 async function call(path,body,{auth=true,opts={}}={}){if(!endpoint||!fetcher)throw error('VISUAL_NOT_CONFIGURED','No secure visual backend is configured; use the local reference library.');if(auth&&!signedIn())throw error('VISUAL_SIGN_IN_REQUIRED','Sign in to your private stylist service in Style → Stylist settings.');
  controller?.abort();const c=new AbortController();controller=c;let timed=false;const timer=setTimeout(()=>{timed=true;c.abort();},180000),poll=setInterval(()=>{if(opts.isCancelled?.())c.abort();},120);
  try{const r=await fetcher(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:c.signal,credentials:'omit',cache:'no-store',redirect:'error'});if(r.status===401){token=null;expires=0;providerReady=false;}
   const text=await r.text();if(text.length>1000000)throw error('SERVICE_RESPONSE_SIZE','Oversized service reply.');let data;try{data=JSON.parse(text);}catch{throw error('SERVICE_BAD_JSON','The service did not return valid JSON.');}if(!r.ok)throw error(data.error||'SERVICE_ERROR',data.message||'The visual service rejected this request. No substitute AI result was used.');if(data.schema!==SCHEMA)throw error('SERVICE_VERSION','Incompatible service reply.');return data;
  }catch(e){if(e.name==='AbortError')throw error(opts.isCancelled?.()?'CANCELLED':timed?'VISUAL_TIMEOUT':'CANCELLED','Visual request ended. Previous outfit and wear records are unchanged.');throw e;}
  finally{clearTimeout(timer);clearInterval(poll);if(controller===c)controller=null;}
 }
 return Object.freeze({configured:()=>!!endpoint,ready,endpoint:()=>endpoint,disconnect,cancel:()=>controller?.abort(),publicRequest,
  async login(password){if(typeof password!=='string'||password.length<16)throw error('SERVICE_PASSWORD','Use the private service password (at least 16 characters), not an OpenAI API key.');if(/^sk-/.test(password))throw error('PROVIDER_KEY_REJECTED','Do not enter a provider API key in this browser. Configure it only on the server.');const d=await call('/v1/session',{password},{auth:false});if(typeof d.token!=='string'||!Number.isFinite(d.expires_at))throw error('SERVICE_SESSION','Invalid login reply');token=d.token;expires=d.expires_at*1000;providerReady=d.live_ready===true;return {live_ready:d.live_ready,expires_at:d.expires_at};},
  async logout(){try{if(signedIn())await call('/v1/logout',{});}finally{disconnect();}},
  propose:(q,opts={})=>call('/v1/propose',{request:publicRequest(q)},{opts}),
  evaluate:(q,candidates,jobId,opts={})=>call('/v1/evaluate',{request:publicRequest(q),candidates,job_id:jobId},{opts})});
}
root.HEWRSVisualStylistClient=Object.freeze({create,publicRequest,SCHEMA});
})(globalThis);
