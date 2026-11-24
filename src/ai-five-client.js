/* AI Five transport. No request on construction; service credentials stay in
 * memory. The old image-review and visual-stylist protocols are not compatible.
 * Only the selected occasion, coarse weather, source bindings and the actual
 * twenty exclusion keys are sent. No preferences, wear history or images.
 */
(function (root, factory) {
  'use strict';
  const api=factory(root);
  if (typeof module==='object' && module.exports) module.exports=api;
  if (root) root.HEWRSAIFiveClient=api;
})(typeof globalThis==='object'?globalThis:null,function (root) {
  'use strict';
  const STATUS='hewrs.ai-five.status.v1',REQUEST='hewrs.ai-five.request.v1',RESPONSE='hewrs.ai-five.response.v1';
  const CAPABILITY='independent_outfit_generation_v1',MAX_RESPONSE_BYTES=200000;
  const occasions=new Set(['work','dinner','weekend']);
  const formalities=new Set(['any','tie_required','suit_required','open_collar_allowed']);
  const weatherValues={source:new Set(['manual','live','forecast','not_assessed']),
    temperatureBand:new Set(['veryHot','hot','mildWarm','cool','cold','veryCold']),
    precipitation:new Set(['dry','lightRain','heavyRain','snowIce']),season:new Set(['Spring','Summer','Fall','Winter'])};
  const clone=value=>JSON.parse(JSON.stringify(value));
  function error(code,message) {const out=Error(message);out.code=code;return out;}
  function insist(value,code,message) {if (!value) throw error(code,message);}
  function record(value) {return value && typeof value==='object' && !Array.isArray(value);}
  function frozen(value) {if (value && typeof value==='object') {for (const child of Object.values(value)) frozen(child);Object.freeze(value);}return value;}
  function text(value,max=200) {return typeof value==='string' && value.length>0 && value.length<=max;}
  function canonicalSelection(selection) {
    // The strict provider schema has eight fields. Native renderer routes use
    // five suit fields or six blazer/shirt-only fields and reject mixed shapes.
    // Validate every wire field before removing inactive null/false fields.
    const fields=['suitId','blazerId','shirtOnly','pantId','shirtId','state','shoeId','watchId'];
    const id=value=>typeof value==='string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
    const fail=message=>error('AI_FIVE_SELECTION',message);
    if (!record(selection) || Object.keys(selection).length!==fields.length ||
      !fields.every(key=>Object.hasOwn(selection,key))) throw fail('AI Five selection must contain exactly the eight wardrobe fields.');
    const s=selection;
    if (typeof s.shirtOnly!=='boolean' || !['suitId','blazerId','pantId'].every(key=>s[key]===null || id(s[key])) ||
      !['shirtId','state','shoeId','watchId'].every(key=>id(s[key])) || !s.watchId.startsWith('watch-'))
      throw fail('AI Five selection contains an invalid wardrobe ID or mode.');
    const suit=s.suitId!==null,blazer=s.blazerId!==null;
    if (Number(suit)+Number(blazer)+Number(s.shirtOnly)!==1)
      throw fail('AI Five selection must specify exactly one topwear mode.');
    if (suit ? s.pantId!==null : s.pantId===null)
      throw fail('AI Five selection has conflicting or missing trousers.');
    const top=suit?{suitId:s.suitId}:blazer?{blazerId:s.blazerId,pantId:s.pantId}:{shirtOnly:true,pantId:s.pantId};
    return {...top,shirtId:s.shirtId,state:s.state,shoeId:s.shoeId,watchId:s.watchId};
  }
  function endpointFor(config) {
    if (!config?.endpoint) return null;
    let u;try {u=new URL(config.endpoint);} catch {throw error('AI_FIVE_CONFIGURATION','Invalid AI Five service endpoint.');}
    insist(u.protocol==='https:' && !u.username && !u.password && !u.search && !u.hash,
      'AI_FIVE_CONFIGURATION','AI Five requires an HTTPS endpoint without credentials, query or fragment.');
    return u.href.replace(/\/$/,'');
  }
  function publicRequest(q,{requestId,sourceLock,catalogueFingerprint}={}) {
    insist(record(q) && q.source_lock===sourceLock,'AI_FIVE_SOURCE','The AI service and current wardrobe source differ.');
    insist(/^[a-f0-9]{32}$/.test(requestId||''),'AI_FIVE_REQUEST_ID','A valid AI request identifier is required.');
    insist(occasions.has(q.context?.occasion) && formalities.has(q.context?.requiredFormality),
      'AI_FIVE_CONTEXT','A valid occasion and formality are required.');
    insist(typeof q.localDate==='string' && /^\d{4}-\d{2}-\d{2}$/.test(q.localDate) &&
      Number.isFinite(Date.parse(q.localDate+'T00:00:00Z')) && new Date(q.localDate+'T00:00:00Z').toISOString().slice(0,10)===q.localDate,
      'AI_FIVE_DATE','A valid outfit date is required.');
    const w=q.weather;
    insist(record(w) && weatherValues.source.has(w.source),'AI_FIVE_WEATHER','A valid coarse weather context is required.');
    const weather={source:w.source};
    for (const key of ['temperatureBand','precipitation','season']) {
      const value=w[key]??null;
      insist((w.source==='not_assessed' && value===null) || weatherValues[key].has(value),
        'AI_FIVE_WEATHER','Invalid or incomplete coarse weather value.');
      weather[key]=w.source==='not_assessed'?null:value;
    }
    const keys=q.excluded_outfit_keys;
    insist(Array.isArray(keys) && keys.length>=1 && keys.length<=20 && new Set(keys).size===keys.length,
      'AI_FIVE_EXCLUSIONS','Between 1 and 20 actual current HEWRS outfit identities are required.');
    for (const key of keys) {
      let parts;try {parts=JSON.parse(key);} catch {throw error('AI_FIVE_EXCLUSIONS','Invalid HEWRS outfit identity.');}
      insist(typeof key==='string' && key.length<=500 && Array.isArray(parts) && parts.length===5 &&
        parts.every(x=>text(x,80)) && JSON.stringify(parts)===key,
        'AI_FIVE_EXCLUSIONS','Invalid HEWRS outfit identity.');
    }
    return {request_id:requestId,source_lock:sourceLock,catalogue_fingerprint:catalogueFingerprint,
      context:{occasion:q.context.occasion,requiredFormality:q.context.requiredFormality},
      localDate:q.localDate,weather,excluded_outfit_keys:keys.slice()};
  }
  function create({config=root?.HEWRS_AI_FIVE_SERVICE_CONFIG,fetcher=root?.fetch?.bind(root),
    clock=()=>Date.now(),randomId,timeouts={status:15000,generate:180000},statusTtlMs=300000}={}) {
    const settings=clone(config||{}),endpoint=endpointFor(settings);
    const sourceLock=settings.source_lock,catalogueFingerprint=settings.catalogue_fingerprint;
    const enabled=settings.enabled===true && !!endpoint;
    if (enabled) insist(/^[a-f0-9]{64}$/.test(sourceLock||'') && /^[a-f0-9]{64}$/.test(catalogueFingerprint||''),
      'AI_FIVE_CONFIGURATION','AI Five configuration must pin its wardrobe sources.');
    insist(typeof clock==='function' && Number.isFinite(statusTtlMs) && statusTtlMs>0 && statusTtlMs<=300000,
      'AI_FIVE_CONFIGURATION','Invalid AI Five status timeout.');
    for (const name of ['status','generate']) insist(Number.isFinite(timeouts[name]) && timeouts[name]>0 && timeouts[name]<=180000,
      'AI_FIVE_CONFIGURATION','Invalid AI Five request timeout.');
    let token=null,health=null,healthAt=0,active=null,epoch=0;
    const configured=()=>enabled && typeof fetcher==='function';
    const ready=()=>configured() && token!==null && health?.configured===true && health?.authenticated===true &&
      clock()>=healthAt && clock()-healthAt<statusTtlMs;
    function disconnect() {epoch++;active?.controller.abort();token=null;health=null;healthAt=0;}
    function cancel() {active?.controller.abort();}
    function idle() {insist(!active,'AI_FIVE_BUSY','An AI Five request is already running.');}
    function usable() {insist(configured(),'AI_FIVE_NOT_CONFIGURED','AI Five generation is not enabled for this app. No provider request was sent.');}
    function current(operation,opts) {
      insist(operation.epoch===epoch && !operation.controller.signal.aborted && !opts.isCancelled?.(),
        'AI_FIVE_CANCELLED','AI Five request cancelled. A request already sent may still incur usage.');
    }
    async function jsonResponse(response) {
      const length=Number(response.headers?.get?.('content-length'));
      insist(!Number.isFinite(length) || length<=MAX_RESPONSE_BYTES,'AI_FIVE_RESPONSE_SIZE','AI Five service response exceeded its size limit.');
      let raw='';
      if (response.body?.getReader) {
        const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0;
        try {
          for (;;) {const chunk=await reader.read();if (chunk.done) break;bytes+=chunk.value.byteLength;
            insist(bytes<=MAX_RESPONSE_BYTES,'AI_FIVE_RESPONSE_SIZE','AI Five service response exceeded its size limit.');raw+=decoder.decode(chunk.value,{stream:true});}
          raw+=decoder.decode();
        } catch (e) {try {await reader.cancel();} catch {} throw e;}
      } else {
        raw=await response.text();
        insist(raw.length<=MAX_RESPONSE_BYTES,'AI_FIVE_RESPONSE_SIZE','AI Five service response exceeded its size limit.');
      }
      let body;try {body=JSON.parse(raw);} catch {throw error('AI_FIVE_BAD_JSON','AI Five service returned invalid JSON.');}
      if (!response.ok) {
        if (response.status===401 || response.status===403) {token=null;health=null;healthAt=0;}
        const detail=body?.error?.message;
        throw error('AI_FIVE_SERVICE_ERROR',typeof detail==='string'?detail.slice(0,300):'AI Five service rejected the request ('+response.status+').');
      }
      return body;
    }
    async function call(path,{body,kind,opts={}}) {
      usable();idle();
      const operation={controller:new AbortController(),epoch};let timed=false;
      current(operation,opts);active=operation;
      const timer=setTimeout(()=>{timed=true;operation.controller.abort();},timeouts[kind]);
      const poll=typeof opts.isCancelled==='function'?setInterval(()=>{
        try {if(opts.isCancelled()) operation.controller.abort();} catch {operation.controller.abort();}
      },100):null;
      const abort=()=>operation.controller.abort();
      if (opts.signal) {opts.signal.addEventListener('abort',abort,{once:true});if(opts.signal.aborted) abort();}
      try {
        current(operation,opts);
        const response=await fetcher(endpoint+path,{method:body?'POST':'GET',
          headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},
          ...(body?{body:JSON.stringify(body)}:{}),credentials:'omit',cache:'no-store',redirect:'error',signal:operation.controller.signal});
        current(operation,opts);
        const value=await jsonResponse(response);current(operation,opts);return value;
      } catch (e) {
        if (timed) throw error('AI_FIVE_TIMEOUT','AI Five service timed out. No automatic retry was made.');
        if (operation.controller.signal.aborted || e?.name==='AbortError' || operation.epoch!==epoch)
          throw error('AI_FIVE_CANCELLED','AI Five request cancelled. A request already sent may still incur usage.');
        throw e;
      } finally {
        clearTimeout(timer);if(poll!==null) clearInterval(poll);opts.signal?.removeEventListener('abort',abort);
        if(active===operation) active=null;
      }
    }
    function validateStatus(value) {
      insist(value?.schema===STATUS && Array.isArray(value.capabilities) && value.capabilities.includes(CAPABILITY),
        'AI_FIVE_PROTOCOL','The configured service does not support independent AI Five generation.');
      insist(value.source_lock===sourceLock && value.catalogue_fingerprint===catalogueFingerprint,
        'AI_FIVE_SOURCE','The AI service and this app use different wardrobe sources.');
      insist(typeof value.configured==='boolean' && typeof value.authenticated==='boolean' && Array.isArray(value.blocked_by) &&
        value.blocked_by.every(x=>text(x,200)) && (!value.configured || text(value.model)),
        'AI_FIVE_PROTOCOL','Invalid AI Five service readiness response.');
      insist(!value.configured || value.blocked_by.length===0,'AI_FIVE_PROTOCOL','Contradictory AI Five service readiness response.');
      return value;
    }
    async function check(opts={}) {
      usable();idle();
      health=null;healthAt=0;
      const status=validateStatus(await call('/v1/ai-five/status',{kind:'status',opts}));
      health=frozen(clone(status));healthAt=clock();return frozen(clone(status));
    }
    async function connect(serviceToken,opts={}) {
      usable();idle();
      insist(typeof serviceToken==='string' && serviceToken.length>=32 && serviceToken.length<=512 &&
        /^[A-Za-z0-9._~+\/-]+=*$/.test(serviceToken) && !/^sk-/i.test(serviceToken),
        'AI_FIVE_TOKEN','Enter the private service access token, not a provider API key.');
      epoch++;token=serviceToken;health=null;
      try {
        const status=await check(opts);
        insist(status.authenticated===true,'AI_FIVE_AUTH','The private service access token was not accepted.');
        return status;
      } catch (e) {token=null;health=null;healthAt=0;throw e;}
    }
    function identifier() {
      if (randomId) return randomId();
      insist(root?.crypto?.getRandomValues,'AI_FIVE_RANDOM','Secure random request identifiers are unavailable.');
      return Array.from(root.crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
    }
    async function propose(q,opts={}) {
      usable();idle();
      insist(ready(),'AI_FIVE_NOT_CONNECTED','Connect a compatible AI Five service before generating. No provider request was sent.');
      insist(opts.consent===true,'AI_FIVE_CONSENT','Confirm AI processing and possible provider usage before generating.');
      const request=publicRequest(q,{requestId:identifier(),sourceLock,catalogueFingerprint}),model=health.model;
      const value=await call('/v1/ai-five/generate',{kind:'generate',opts,body:{schema:REQUEST,consent:true,request}});
      insist(value?.schema===RESPONSE && value.request_id===request.request_id && value.source_lock===sourceLock &&
        value.catalogue_fingerprint===catalogueFingerprint,'AI_FIVE_RESPONSE_BINDING','AI Five response does not match this wardrobe request.');
      insist(Array.isArray(value.proposals) && value.proposals.length<=40 && value.proposals.every(p=>
        record(p) && record(p.selection) && p.occasion===request.context.occasion && text(p.rationale,2000)),
        'AI_FIVE_PROPOSALS','AI Five service returned invalid outfit proposals.');
      insist(text(value.job_id) && typeof value.cached==='boolean' && value.provider?.name==='openai' &&
        value.provider.requested_model===model && text(value.provider.model) && text(value.provider.response_id) &&
        typeof value.provider.live_call==='boolean','AI_FIVE_PROVENANCE','AI Five provider provenance could not be verified.');
      const normalized=clone(value);
      normalized.proposals=normalized.proposals.map(proposal=>({...proposal,selection:canonicalSelection(proposal.selection)}));
      return frozen(normalized);
    }
    return Object.freeze({configured,ready,endpoint:()=>endpoint,check,connect,disconnect,cancel,propose,
      diagnostics:()=>({configured:configured(),ready:ready(),running:!!active,revision:'hewrs.ai-five-client.v1'})});
  }
  return Object.freeze({create,publicRequest,STATUS,REQUEST,RESPONSE,CAPABILITY});
});
