/* V1.17.4 automatic weather coordinator.
 * Reuses the existing provider transport; no scoring, clothing or wear writes.
 * A silent refresh calls geolocation ONLY when the browser reports granted.
 * Prompt/denied/unsupported queries use a labelled saved place, never a hidden
 * permission workaround. First-time prompting is an explicit Enable action.
 */
(function(root){'use strict';
const KEY='hewrs:automatic-weather:v1',SCHEMA='hewrs.automatic-weather.v1';
const clone=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};
function validate(v){need(v?.schema===SCHEMA&&['device','saved','off'].includes(v.mode)&&['today','selected'].includes(v.dateMode),'Invalid automatic-weather settings');return {schema:SCHEMA,mode:v.mode,dateMode:v.dateMode};}
function create({weather,backend=null,permissions=root.navigator?.permissions,now=()=>Date.now(),today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');},onState=()=>{},onApplied=()=>{},minimumIntervalMs=15*60000,permissionTimeoutMs=2000}={}){
 need(weather?.snapshot&&weather?.locate&&weather?.fetchAt,'Existing weather transport is required');
 let settings=null,raw=null,blocked=null,flight=null,controller=null,epoch=0,lastAttempt=0,hasAttempt=false;
 let state={status:'idle',pending:false,permission:'unknown',message:'',usingSavedLocation:false};
 try{if(backend){raw=backend.getItem(KEY);if(raw!==null)settings=validate(JSON.parse(raw));}}catch(e){blocked='Automatic-weather settings retained, not reset: '+e.message;}
 function config(){if(settings)return clone(settings);const s=weather.snapshot();return {schema:SCHEMA,mode:s?.source==='manual'||s?.source==='not_assessed'?'off':s?.place&&!s.place.label.startsWith('Device location (')?'saved':'device',dateMode:'today'};}
 function report(p){state={...state,...p};onState(clone(state));return clone(state);}
 function save(next){need(!blocked,blocked);next=validate(next);if(backend){need(backend.getItem(KEY)===raw,'Automatic-weather settings changed in another tab; reload before saving');const text=JSON.stringify(next);backend.setItem(KEY,text);need(backend.getItem(KEY)===text,'Automatic-weather settings could not be saved');raw=text;}settings=next;}
 function cancel(){epoch++;controller?.abort();controller=null;flight=null;if(state.pending)report({status:'cancelled',pending:false,message:'Automatic lookup paused; saved weather unchanged.'});}
 function disable(){cancel();save({...config(),mode:'off'});report({status:'off',pending:false,message:'Automatic weather is off. Manual settings are retained.',usingSavedLocation:false});}
 function setDateMode(mode){need(['today','selected'].includes(mode),'Invalid weather date mode');cancel();save({...config(),dateMode:mode});hasAttempt=false;}
 async function permission(){if(!permissions?.query)return 'unsupported';let timer;try{return await Promise.race([Promise.resolve().then(()=>permissions.query({name:'geolocation'})).then(p=>['granted','denied','prompt'].includes(p?.state)?p.state:'unsupported'),new Promise(resolve=>timer=setTimeout(()=>resolve('unsupported'),permissionTimeoutMs))]);}catch{return 'unsupported';}finally{clearTimeout(timer);}}
 function errorState(e){return {status:e.code==='LOCATION_DENIED'?'permission_denied':'error',pending:false,errorCode:e.code||'AUTO_WEATHER_ERROR',message:(e.code?'['+e.code+'] ':'')+e.message+' Previous weather was not replaced.'};}
 function targetDate(date,c){return c.dateMode==='today'?today():date;}
 function refresh({date=today(),force=false,allowPrompt=false,trigger='resume',enableDateMode=null}={}){
  if(flight)return flight;
  const cfg=enableDateMode?{...config(),dateMode:enableDateMode}:config();
  if(blocked||weather.status().blocked)return Promise.resolve(report({status:'blocked',pending:false,message:blocked||weather.status().blocked}));
  if(cfg.mode==='off'&&!allowPrompt)return Promise.resolve(report({status:'off',pending:false,message:'Manual weather selected; automatic updates are off.'}));
  const dateToUse=targetDate(date,cfg),previous=weather.snapshot();
  const isFresh=previous&&root.HEWRSWeather.fresh(previous,dateToUse,now());
  if(!force&&!allowPrompt&&hasAttempt&&now()-lastAttempt<minimumIntervalMs&&(isFresh||state.status==='error'))return Promise.resolve({...clone(state),skipped:'refresh_interval'});
  lastAttempt=now();hasAttempt=true;const token=++epoch,start=JSON.stringify(previous);controller=new AbortController();const local=controller;
  report({status:'updating',pending:true,errorCode:null,message:'Updating local weather…',trigger});
  const progress=p=>{if(token===epoch)report({message:p.message});};
  const job=(async()=>{
   try{
    let status=allowPrompt?'explicit-request':await permission();if(token!==epoch)return {status:'cancelled'};
    report({permission:status});let value,via;
    if(allowPrompt||(cfg.mode==='device'&&status==='granted')){
     value=await weather.locate(dateToUse,{signal:local.signal,onProgress:progress});via='device';
    }else if(previous?.place){
     value=await weather.fetchAt(previous.place,dateToUse,{signal:local.signal,onProgress:progress});via='saved';
    }else{
     return report({status:status==='denied'?'permission_denied':'needs_permission',pending:false,usingSavedLocation:false,message:status==='denied'?'Location is denied for this website. Allow it in browser settings or select a city. No new prompt was opened.':'Enable automatic local weather once. Subsequent updates reuse granted permission; the browser controls whether permission expires.'});
    }
    if(token!==epoch||local.signal.aborted)return {status:'cancelled'};
    need(JSON.stringify(weather.snapshot())===start,'Weather changed during the automatic lookup; the newer selection was preserved');
    // Keep place provenance honest. A saved fallback is NOT a new device fix.
    value={...value,automaticUpdate:true,locationBasis:via==='device'?'current_device_fix':'saved_coordinates',automaticTrigger:trigger};
    if(allowPrompt)save({...cfg,mode:'device'});
    weather.apply(value);
    const result=report({status:'ready',pending:false,permission:allowPrompt?'granted-on-explicit-request':status,usingSavedLocation:via==='saved',updatedAt:now(),date:dateToUse,message:via==='saved'?'Weather refreshed automatically for the saved location; device position was not rechecked.':'Weather refreshed automatically for your device location.'});
    onApplied(clone(value),{date:dateToUse,locationBasis:value.locationBasis,automatic:true});return {...result,selection:clone(value)};
   }catch(e){if(token!==epoch||e.code==='CANCELLED')return {status:'cancelled'};return report(errorState(e));}
   finally{if(token===epoch){controller=null;flight=null;if(state.pending)report({pending:false});}}
  })();flight=job;return job;
 }
 async function enable({date=today(),dateMode='today'}={}){
  need(['today','selected'].includes(dateMode),'Invalid automatic-weather date mode');cancel();
  // Date preference is only saved with a successful explicit location request.
  return refresh({date,force:true,allowPrompt:true,trigger:'enable',enableDateMode:dateMode});
 }
 return Object.freeze({refresh,enable,disable,cancel,setDateMode,settings:config,status:()=>({...clone(state),blocked,persistent:!!backend}),key:KEY});
}
root.HEWRSAutoWeather=Object.freeze({create,KEY,SCHEMA,validate});
})(globalThis);
