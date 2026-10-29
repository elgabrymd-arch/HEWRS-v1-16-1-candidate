/* Client transport/controller. Provider keys never belong in this module.
 * Nothing runs on page load or in the background. Configuration is read-only;
 * authorization stays in memory and must be distinct from an OpenAI API key.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HEWRSAutomaticImageClient=factory();})(globalThis,function(){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function create({config,fetchImpl=globalThis.fetch,prepare,verify,save,capture,isCurrent,onState=()=>{}}){
 let state={status:'idle',configured:config?.enabled===true&&!!config?.endpoint,lastError:null},controller=null,running=false,retryPacket=null,lastResponse=null;
 function publish(status,extra={}){state={...state,status,...extra};onState(clone(state));}
 function endpoint(){if(config?.enabled!==true||!config.endpoint)throw Error('Automatic assessment is not configured. No images were sent.');const u=new URL(config.endpoint);if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname))))throw Error('The configured service must use HTTPS (or loopback for local development).');return u.href.replace(/\/$/,'');}
 async function jsonResponse(response){const s=await response.text();if(s.length>16000000)throw Error('Service response exceeded the size limit.');let x;try{x=JSON.parse(s);}catch{throw Error('The service returned invalid JSON; no assessment was saved.');}if(!response.ok)throw Error(x.error?.message||'Service request failed ('+response.status+').');return x;}
 async function check(){const base=endpoint();const r=await fetchImpl(base+'/health',{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});const x=await jsonResponse(r);if(x.schema!=='hewrs.review-service.status.v1'||x.provider!=='openai'||x.revision!=='hewrs.remote-image-review.v1')throw Error('Incompatible automatic review service.');return x;}
 function stale(token){if(controller?.signal.aborted)throw Error('Cancelled. A provider request already sent may still incur usage.');if(!isCurrent(token))throw Error('Selection, context or rejection data changed. No returned assessment was activated.');}
 async function run({token,consent=false}={}){
  if(running)throw Error('Automatic image review is already running.');
  endpoint();if(consent!==true)throw Error('Confirm the image transfer and possible API charge first.');if(typeof token!=='string'||token.length<32||token.startsWith('sk-'))throw Error('Enter the private service access token, not an OpenAI API key.');
  running=true;controller=new AbortController();const snapshot=capture();let sent=false;
  try{
   publish('preparing',{lastError:null});
   const health=await check();stale(snapshot);if(!health.configured)throw Error('Service activation is incomplete: '+health.blocked_by.join(', '));
   // Reuse the exact packet for retry after a save failure; server idempotence
   // avoids another call for that identical request. No automatic paid retries.
   const packet=retryPacket&&retryPacket.signature===JSON.stringify(snapshot)?retryPacket.packet:await prepare();stale(snapshot);
   if(health.catalogue_fingerprint!==packet.request.catalogue_fingerprint)throw Error('Service catalogue differs from this app; no images were sent.');
   retryPacket={signature:JSON.stringify(snapshot),packet};publish('requesting');
   sent=true;const response=await fetchImpl(endpoint()+'/assess',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({consent:true,packet}),signal:controller.signal});sent=true;
   const body=await jsonResponse(response);stale(snapshot);
   if(body.bundle?.cases?.length!==1||body.bundle.cases[0].packet?.request_sha256!==packet.request_sha256||body.bundle.cases[0].packet?.board_data_url!==packet.board_data_url)throw Error('Returned assessment does not match the exact submitted outfit/image.');
   const s=body.bundle.cases[0].result;if(s.method!=='remote_model_component_image_review'||s.provider?.prompt_sha256!==health.prompt_sha256||s.provider?.service_revision!==health.revision||s.owner_approved!==false)throw Error('Remote assessment provenance mismatch.');
   publish('validating');await verify(body.bundle,{evaluationOnly:true});stale(snapshot);
   const a=body.activation,g=health.image_quality_gate;
   const released=a?.allowed===true&&a.status==='experimental_image_quality_pass'&&g?.allowed===true&&a.evidence_sha256===g.evidence_sha256&&a.evaluation_id===g.evaluation_id&&a.request_sha256===packet.request_sha256&&a.board_sha256===packet.request.board.sha256&&a.catalogue_fingerprint===packet.request.catalogue_fingerprint&&a.model===s.provider.model&&a.prompt_sha256===s.provider.prompt_sha256&&JSON.stringify(a)===JSON.stringify(s.activation);
   if(!released){lastResponse={evaluation_only:true,cached:body.cached===true,usage:body.usage||null,verdict:s.verdict,provider:clone(s.provider),bundle:clone(body.bundle),reason:a?.reason||'No matching quality release. No ranking change was made.'};publish('evaluation_only',{result:{verdict:s.verdict,cached:body.cached===true,evaluation_only:true},lastError:null});return clone(lastResponse);}
   // Defense in depth: the default verifier also refuses manual import of
   // unreleased provider assessments.
   await verify(body.bundle);stale(snapshot);publish('saving');
   // Once persistence starts the result is a valid assessment, not a wardrobe
   // selection. Import independently applies current rejections before ranking.
   const persisted=await save(body.bundle);lastResponse={cached:body.cached===true,usage:body.usage||null,verdict:s.verdict,provider:clone(s.provider),persisted};
   publish('saved',{result:lastResponse,lastError:null});return clone(lastResponse);
  }catch(e){publish(controller.signal.aborted?'cancelled':'stopped',{lastError:controller.signal.aborted?'Cancelled. A provider call already sent may still incur usage.':e.message,request_may_have_reached_provider:sent});throw e;}
  finally{running=false;controller=null;}
 }
 function cancel(){if(running)controller?.abort();}
 return Object.freeze({run,cancel,check,state:()=>clone({...state,running}),last:()=>lastResponse&&clone(lastResponse)});
}
return Object.freeze({create,revision:'hewrs.auto-image-client.v1'});
});
