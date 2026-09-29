/* V1.11 presentation adapter for the approved original-palette facelift.
 * Source authority: V1.10 connection, renderer, catalogue and local-state module.
 * This file does not score outfits, modify garment data or own a storage schema. */
(function(root){'use strict';
const $=id=>document.getElementById(id),copy=x=>structuredClone(x),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const need=(v,m)=>{if(!v)throw Error(m);};
const connection=root.HEWRSCleanConnection.create(root.HEWRS_INPUTS);
let backend;try{backend=root.localStorage;}catch{backend=null;}
const visualStylist=root.HEWRSVisualStylistClient.create();connection.hybrid.setService(visualStylist);
// Styling mode is separate from wear/Favorites. Credentials never enter storage.
const STYLIST_KEY='hewrs:stylist-mode:v2';let stylistPreferenceWarning=null;
try{const savedMode=backend?.getItem(STYLIST_KEY),legacyMode=backend?.getItem('hewrs:stylist-mode:v1');if(savedMode&&['research','curated','visual','heuristic'].includes(savedMode))connection.hybrid.setMode(savedMode);else if(savedMode)stylistPreferenceWarning='Unrecognized saved stylist mode retained; the local wardrobe generator is active.';else if(legacyMode==='visual'){connection.hybrid.setMode('visual');}else if(legacyMode){stylistPreferenceWarning='Engine upgraded to Research-based wardrobe generator. Your old saved method is retained for rollback; Curated references and the previous heuristic remain selectable here.';}}catch{stylistPreferenceWarning='Stylist mode is session-only.';}
function setStylistMode(m){connection.hybrid.setMode(m);try{backend?.setItem(STYLIST_KEY,m);}catch{stylistPreferenceWarning='Stylist mode is session-only.';}invalidateRecommendations('Styling method changed; generate a new list.');updateHome();}
async function renderForStylist(selection){
 const canvas=document.createElement('canvas'),off=root.HEWRSAtomicRenderer.create(canvas,connection,{resolveUrl});
 try{const result=await off.render(selection);need(!result.cancelled,'Visual candidate cancelled');const crop=document.createElement('canvas');crop.width=280;crop.height=660;
  const cc=crop.getContext('2d');cc.fillStyle='#e9e6df';cc.fillRect(0,0,280,660);
  // Exact garment pixels only. Source rows 0..399 (the face) are not transmitted.
  cc.drawImage(canvas,0,400,996,2348,0,0,280,660);return crop.toDataURL('image/jpeg',0.88);
 }finally{off.cancel();canvas.width=canvas.height=1;}
}
function stylistSheet(){
 const {body,actions}=openSheet('Stylist settings',{list:true,cancel:()=>visualStylist.cancel()});
 const methods=selectField('Recommendation method',[{value:'research',label:'Research-based wardrobe generator — local (up to 20)'},{value:'curated',label:'Curated reference library — finite saved looks'},{value:'visual',label:'Live visual AI — secure service required'},{value:'heuristic',label:'V1.18.0 heuristic — existing model'}],connection.hybrid.mode(),'stylist-method');body.append(methods.wrap);
 const details=el('p','Research-based wardrobe generator composes new combinations from your supported wardrobe using published styling guidance and disclosed local rules. It is not live AI or a trained visual model. Curated references are a separate finite library and may return only 1–3 looks for a suit. All methods retain exact locks, weather, history and repetition limits.','fx-caption');body.append(details);
 const state=el('p',visualStylist.configured()?(visualStylist.ready()?'Secure stylist session connected.':'Service configured; sign in before live generation.'):'Live AI is not connected. The server must be deployed and configured before it can be enabled.','fx-caption');state.id='stylist-connection-status';body.append(state);
 if(stylistPreferenceWarning)body.append(el('p',stylistPreferenceWarning,'fx-warning'));
 body.append(el('p','Live mode uses up to two paid provider requests per Generate. It sends garment images (face cropped out), names, selected constraints and coarse weather bands. No precise coordinates, wear log or Favorites are sent. Provider storage is disabled in the request; that does not guarantee zero provider retention.','fx-caption'));
 if(visualStylist.configured()){
  body.append(el('p','Service: '+visualStylist.endpoint(),'fx-caption'));const pw=el('input');pw.type='password';pw.autocomplete='current-password';pw.id='stylist-password';pw.placeholder='Private service password — never your API key';pw.setAttribute('aria-label','Private stylist service password');body.append(pw);
  const agree=el('label',undefined,'fx-check-row'),check=el('input');check.type='checkbox';check.id='stylist-cost-consent';agree.append(check,el('span','Allow the configured paid visual service for this session.'));body.append(agree);
  const login=button('Connect visual service',async()=>{need(check.checked,'Confirm image processing and paid service use first.');const value=pw.value;pw.value='';const out=await visualStylist.login(value);state.textContent=out.live_ready?'Secure session connected. Select Live visual AI and Apply.':'Signed in, but the server has not enabled a provider/model. Live generation remains unavailable.';});login.id='stylist-connect';body.append(login);
  body.append(button('Disconnect',async()=>{await visualStylist.logout();state.textContent='Disconnected; credentials removed from this page.';}));
 }
 actions.append(button('Cancel',()=>dismissSheet()),button('Apply method',()=>{const chosen=methods.input.value;need(chosen!=='visual'||visualStylist.ready(),'Live visual service is not connected. Curated reference library works without it.');setStylistMode(chosen);dismissSheet(false);status(chosen==='research'?'Research-based wardrobe generator selected. New eligible combinations; no private service or paid AI request.':chosen==='curated'?'Local curated reference library selected. No AI provider request will be made.':chosen==='visual'?'Live visual styling selected. Actual wardrobe images will be reviewed on Generate.':'Existing V1.18.0 heuristic selected.');},true));
}

const weather=root.HEWRSWeather.create({backend});
const autoWeather=root.HEWRSAutoWeather.create({weather,backend,today:localToday,
 onState:s=>{if(root.HEWRS_READY){updateHome();if(pageName==='home'&&!modal&&['needs_permission','permission_denied','error','blocked'].includes(s.status))status(s.message,s.status==='error'||s.status==='blocked');}},
 onApplied:(value)=>{ctx={...ctx,localDate:value.date};invalidateRecommendations('Weather refreshed automatically. Generate for the updated conditions.');updateHome();if(pageName==='home'&&!modal)status(weatherSummary(value));}
});
async function refreshAutomaticWeather(trigger='resume',force=false,duringSubmit=false){
 if(!root.HEWRS_READY||modal||busy&&!duringSubmit)return {status:'paused'};
 return autoWeather.refresh({date:ctx.localDate,trigger,force});
}
const favorites=root.HEWRSFavorites.create(connection,root.HEWRS_INPUT_SHA256,backend);
const store=root.HEWRSLocalState.create(connection,root.HEWRS_INPUT_SHA256,backend),ui=root.HEWRSFaceliftModel.create(connection),urlCache=new Map();
function resolveUrl(d){need(Object.hasOwn(connection.assetPaths,d.sha256),'Unbound image hash; no fallback');if(root.HEWRS_EMBEDDED_IMAGES){if(!urlCache.has(d.sha256)){const v=root.HEWRS_EMBEDDED_IMAGES[d.sha256];need(v,'Embedded image missing');urlCache.set(d.sha256,'data:image/png;base64,'+v);}return urlCache.get(d.sha256);}return connection.assetPaths[d.sha256];}
const renderer=root.HEWRSAtomicRenderer.create($('avatar'),connection,{resolveUrl});
const defaultSelection={suitId:'S05',shirtId:'DS036',state:'T017',shoeId:'shoe-8',watchId:null};
const usage=root.HEWRSRotationInsights.create(connection,root.HEWRS_INPUT_SHA256);
const names={topwear:'Suit / Blazer',shirt:'Shirt',tie:'Tie',shoes:'Shoes',bottoms:'Bottoms',watch:'Watch'};
const groupLabels={suits:'Suits',blazers:'Blazers',shirts:'Dress Shirts',ties:'Ties',shoes:'Shoes',pants:'Pants',jeans:'Jeans',tshirts:'T-Shirts',watches:'Watches'};
const styleLabels={AUTO:'Automatic',CLASSIC:'Classical',HYBRID:'Hybrid',MODERN:'Modern'};
let optionHistoryToken=null;
let current=null,currentOption=null,score=null,origin='manual',mode='engine',pageName='home',generation=0,report=null,lastRequest=null,options=[],optionIndex=-1,producing=null,restorePreview=null,modal=null,modalEpoch=0,logTransaction=null,busy=false;
let ctx={occasion:'clinic',formality:'any',style:'AUTO',localDate:localToday()};
function localToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function icon(name){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const[k,v]of Object.entries({class:'fx-icon',viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.5','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))n.setAttribute(k,v);const u=document.createElementNS(n.namespaceURI,'use');u.setAttribute('href','#fx-icon-'+name);n.append(u);return n;}
function ids(s){if(!s)return 'No outfit selected';return (s.shirtOnly?'Shirt only · '+s.pantId:s.blazerId?s.blazerId+' · '+s.pantId:s.suitId)+' · '+s.shirtId+' · '+(s.state==='NO_TIE'?'No Tie':s.state);}
function status(text,error=false){$('status').textContent=text;$('home-notice').textContent=text;$('home-notice').dataset.error=String(error);}
function errorText(error){return error instanceof Error?error.message:String(error);}
function setMode(v){need(['anchor','engine'].includes(v),'Unknown selection workflow');mode=v;for(const k of ['anchor','engine'])$('mode-'+k).setAttribute('aria-pressed',String(v===k));}
function updateHome(){
 for(const cat of ui.categories){const q=ui.label(cat),b=$('pref-'+cat);b.dataset.choice=q.mode;$('pref-'+cat+'-mode').textContent=q.mode==='any'?'Engine':q.mode==='family'?'Category preference':q.mode==='included'?'Matching trousers':'My selection';$('pref-'+cat+'-id').textContent=q.id||'';$('pref-'+cat+'-value').textContent=q.name;b.title=names[cat]+': '+(q.id?q.id+' — ':'')+q.name;b.disabled=q.mode==='included';b.setAttribute('aria-label',b.title+(q.mode==='included'?'; separate Bottoms inactive':''));}
 $('lock-count').textContent=ui.lockCount()+' selected';$('work-label').textContent={clinic:'Clinic',hospital:'Hospital',work:'Work'}[ctx.occasion]||ctx.occasion;$('style-label').textContent=styleLabels[ctx.style]||ctx.style;$('style-button').querySelector('small').textContent={research:'Research-based wardrobe',curated:'Finite reference library',visual:'Visual AI',heuristic:'Existing model'}[connection.hybrid.mode()];$('header-date').textContent=ctx.localDate;$('view-current').hidden=!current;
 const w=weather.snapshot();let stale=false;try{stale=!!w&&!root.HEWRSWeather.fresh(w,ctx.localDate);}catch{stale=true;}const label=$('weather-label');if(label)label.textContent=autoWeather.status().pending?'Updating weather…':!w||w.source==='not_assessed'?'Weather / location':stale?'Refresh weather':w.source==='manual'?'Manual weather':Math.round(w.airF)+'°F · Feels '+Math.round(w.feelsF)+'°F';$('weather-button').title=weatherSummary(w);if($('season-label'))$('season-label').textContent=w?.season||'Not set';if($('season-caption'))$('season-caption').textContent=w?.source==='manual'?'Manual':w?.season?'Location / date':'Set weather';
}
function showPage(name){need(['home','outfits','wardrobe','rotation'].includes(name),'Unknown route');pageName=name;for(const k of ['home','outfits','wardrobe','rotation'])$('page-'+k).hidden=k!==name;for(const n of document.querySelectorAll('[data-page]')){if(n.dataset.page===name)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');}$('back-home').hidden=name==='home';$('weather-button').hidden=name!=='home';$('quick-log').hidden=name!=='outfits';if(name==='wardrobe')renderGroups();if(name==='rotation')refreshHistory();if(name==='home')updateHome();}
function dismissSheet(cancel=true){root.HEWRSSheetLayout.end();if(!modal){if($('fx-sheet').open)$('fx-sheet').close();return;}const old=modal;modal=null;modalEpoch++;if(cancel)old.cancel?.();if($('fx-sheet').open)$('fx-sheet').close();old.focus?.focus?.();}
function openSheet(title,{cancel,list=false}={}){autoWeather.cancel();dismissSheet();const focus=document.activeElement,token=++modalEpoch;modal={token,cancel,focus};$('fx-sheet-title').textContent=title;$('fx-sheet-body').replaceChildren();$('fx-sheet-actions').replaceChildren();$('fx-sheet-error').textContent='';root.HEWRSSheetLayout.begin($('fx-sheet'),list);$('fx-sheet').showModal();return {body:$('fx-sheet-body'),actions:$('fx-sheet-actions'),token};}
function sheetError(e){$('fx-sheet-error').textContent=errorText(e);}
function button(text,fn,primary=false){const n=el('button',text,primary?'fx-primary':'');n.type='button';n.onclick=async()=>{try{await fn();}catch(e){sheetError(e);}};return n;}
function message(title,text){const{body,actions}=openSheet(title);body.append(el('p',text,'fx-caption'));actions.append(button('Close',()=>dismissSheet()));}
function selectField(label,rows,value,id){const wrap=el('label',label),sel=el('select');if(id)sel.id=id;for(const r of rows){const o=new Option(r.label,r.value);o.disabled=!!r.disabled;sel.add(o);}sel.value=value;wrap.append(sel);return {wrap,input:sel};}
function currentContext(){return {occasion:ctx.occasion,requiredFormality:ctx.formality};}
function weatherSummary(value){if(!value||value.source==='not_assessed')return 'Weather not assessed';const place=(value.locationBasis==='saved_coordinates'?'Saved location — ':'')+(value.place?.label||value.locationLabel||'Manual location');return (value.source==='manual'?'Manual conditions':value.source==='forecast'?'Daily forecast':'Current model estimate')+' · '+place+' · '+(Number.isFinite(value.airF)?Math.round(value.airF)+'°F, feels '+Math.round(value.feelsF)+'°F · ':'')+root.HEWRSWeather.LABELS[value.temperatureBand]+' · '+root.HEWRSWeather.LABELS[value.precipitation]+' · '+value.season+' · '+value.date;}
function weatherSheet(){
 let draft=weather.snapshot(),draftDate=ctx.localDate,ticket=0,pending=false,controller=null,chosenPlace=draft?.place||null,retryAction=null,draftAuto=autoWeather.settings().mode!=='off'&&!!draft?.automaticUpdate;
 const cancelLookup=()=>{ticket++;controller?.abort();controller=null;pending=false;autoWeather.cancel();};
 const {body,actions,token}=openSheet('Location & weather',{list:true,cancel:cancelLookup});
 const active=()=>modal?.token===token;
 const note=el('p','Use device location, or search a city without GPS permission. Only the two Open-Meteo services receive the requested coordinates/search; weather is not added to wear history.','fx-caption');
 const version=el('p','HEWRS 1.17.4 · Weather status and lookup errors appear below.','fx-version-note');version.id='weather-build';
 const dateWrap=el('label','Weather / work date'),dateInput=el('input');dateInput.type='date';dateInput.id='weather-date';dateInput.value=draftDate;dateWrap.append(dateInput);
 const dateNote=el('p',undefined,'fx-caption');dateNote.id='weather-date-note';
 const info=el('p',weather.status().blocked||weatherSummary(draft),'fx-caption fx-weather-status');info.id='weather-result';info.setAttribute('role','status');info.setAttribute('aria-live','polite');
 const controls=el('div',undefined,'fx-context-form');
 const search=el('input');search.type='search';search.id='weather-city';search.placeholder='City or postal code';search.enterKeyHint='search';search.autocomplete='off';search.setAttribute('aria-label','City or postal code');
 const matches=el('div',undefined,'fx-picker-list');matches.id='weather-locations';
 function explainDate(){dateNote.textContent='Phone / browser today: '+localToday()+'. '+(draftDate!==localToday()?'A different work date is selected. Tap Today for today’s conditions. ':'')+'Apply also uses this date for new recommendations; existing wear records are unchanged.';}
 function ready(){try{return !!draft&&root.HEWRSWeather.fresh(draft,draftDate)&&!weather.status().blocked;}catch{return false;}}
 function syncButtons(){enableAuto.disabled=pending;applyWeather.disabled=pending||!ready();locate.disabled=pending;find.disabled=pending;refresh.disabled=pending||!chosenPlace;cancelBtn.hidden=!pending;retry.hidden=pending||!retryAction;body.setAttribute('aria-busy',String(pending));}
 function setFields(){temp.input.value=draft?.temperatureBand||'';precip.input.value=draft?.precipitation||'';seas.input.value=draft?.season||'';location.value=draft?.place?.label||draft?.locationLabel||'';info.dataset.error='false';info.textContent=weatherSummary(draft)+(draft?.observedAt?' · provider time '+draft.observedAt+' ('+(draft.timezone||'local')+')':'')+(draft?' · Review, then tap Apply.':'');explainDate();syncButtons();}
 function showFailure(e){if(e.code==='CANCELLED')return;info.dataset.error='true';info.textContent=(e.code?'['+e.code+'] ':'')+e.message+' Saved weather was not replaced.';syncButtons();info.scrollIntoView({block:'nearest'});}
 async function request(fn){draftAuto=false;cancelLookup();const my=++ticket;controller=new AbortController();pending=true;retryAction=()=>request(fn);info.dataset.error='false';info.textContent='Starting lookup for '+draftDate+'…';syncButtons();const opts={signal:controller.signal,onProgress:p=>{if(active()&&my===ticket)info.textContent=p.message;}};try{const value=await fn(opts);if(!active()||my!==ticket)return;draft=value;chosenPlace=value.place||chosenPlace;pending=false;controller=null;retryAction=null;setFields();}catch(e){if(active()&&my===ticket){pending=false;controller=null;showFailure(e);}}finally{if(active()&&my===ticket)syncButtons();}}
 const locate=button('Use my location',()=>{search.blur();return request(o=>weather.locate(draftDate,o));});locate.id='weather-use-location';
 const refresh=button('Refresh selected location',()=>request(o=>weather.fetchAt(chosenPlace,draftDate,o)));refresh.id='weather-refresh';
 async function searchCity(){search.blur();cancelLookup();const my=++ticket;controller=new AbortController();pending=true;retryAction=searchCity;matches.replaceChildren();info.dataset.error='false';info.textContent='Searching cities…';syncButtons();try{const found=await weather.search(search.value,{signal:controller.signal});if(!active()||my!==ticket)return;pending=false;controller=null;retryAction=null;info.textContent=found.length?'Choose the intended city below to load its weather.':'No matching location. Try a city name, such as Boston, MA, or use manual conditions.';for(const p of found){const n=button(p.label,()=>request(o=>weather.fetchAt(p,draftDate,o)));n.classList.add('fx-choice');n.dataset.weatherLocation=p.label;matches.append(n);}syncButtons();(found.length?matches:info).scrollIntoView({block:'nearest'});}catch(e){if(active()&&my===ticket){pending=false;controller=null;showFailure(e);}}finally{if(active()&&my===ticket)syncButtons();}}
 const find=button('Search city',searchCity);find.id='weather-search';search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();searchCity().catch(sheetError);}};
 const retry=button('Retry lookup',()=>retryAction?.());retry.id='weather-retry';retry.hidden=true;
 const cancelBtn=button('Cancel lookup',()=>{cancelLookup();info.textContent='Lookup cancelled. Saved conditions are unchanged.';syncButtons();});cancelBtn.id='weather-cancel-lookup';cancelBtn.hidden=true;
 const today=button('Today',()=>{dateInput.value=localToday();changeDate();});today.id='weather-today';
 function changeDate(){draftAuto=false;cancelLookup();draftDate=dateInput.value;draft=null;retryAction=null;setFields();info.textContent='Choose location/search again for '+draftDate+', or enter manual conditions.';}
 dateInput.onchange=changeDate;
 const temp=selectField('Temperature band (feels like)',[{value:'',label:'Select temperature band'},...root.HEWRSWeather.BANDS.map(value=>({value,label:root.HEWRSWeather.LABELS[value]}))],draft?.temperatureBand||'','weather-temperature');
 const precip=selectField('Precipitation',[{value:'',label:'Select precipitation'},...root.HEWRSWeather.PRECIP.map(value=>({value,label:root.HEWRSWeather.LABELS[value]}))],draft?.precipitation||'','weather-precipitation');
 const seas=selectField('Season',[{value:'',label:'Select season'},...root.HEWRSWeather.SEASONS.map(value=>({value,label:value}))],draft?.season||'','weather-season');
 const locWrap=el('label','Manual location label (optional)'),location=el('input');location.id='weather-manual-location';location.type='text';location.maxLength=150;locWrap.append(location);
 function manual(){draftAuto=false;cancelLookup();retryAction=null;draft=temp.input.value&&precip.input.value&&seas.input.value?{source:'manual',date:draftDate,temperatureBand:temp.input.value,precipitation:precip.input.value,season:seas.input.value,locationLabel:location.value}:null;info.dataset.error='false';info.textContent=draft?weatherSummary(draft)+' · Review, then tap Apply.':'Select temperature, precipitation and season for manual conditions.';syncButtons();}
 for(const n of [temp.input,precip.input,seas.input,location])n.onchange=manual;
 const autoNote=el('p','Automatic local weather: authorize once, then refresh on opening, returning to this tab, and before generation. The browser owns permission expiry. When permission is not granted, saved-location weather is labelled and no repeated GPS prompt is started.','fx-caption');
 const autoStatus=el('p',autoWeather.status().message||('Automatic mode: '+autoWeather.settings().mode),'fx-caption');autoStatus.id='weather-auto-status';autoStatus.setAttribute('role','status');
 const autoTodayWrap=el('label','Use today for automatic weather'),autoToday=el('input');autoToday.id='weather-auto-today';autoToday.type='checkbox';autoToday.checked=autoWeather.settings().dateMode==='today';autoTodayWrap.prepend(autoToday);Object.assign(autoTodayWrap.style,{flexDirection:'row',alignItems:'center',gap:'10px'});Object.assign(autoToday.style,{minHeight:'20px',height:'20px',width:'20px',padding:'0',flexShrink:'0',accentColor:'var(--gold)'});
 const enableAuto=button('Enable automatic local weather',async()=>{cancelLookup();const my=++ticket;pending=true;enableAuto.disabled=true;syncButtons();autoStatus.textContent='Waiting for the browser’s location decision…';const result=await autoWeather.enable({date:draftDate,dateMode:autoToday.checked?'today':'selected'});if(!active()||my!==ticket)return;pending=false;enableAuto.disabled=false;autoStatus.textContent=result.message||'Automatic weather was not enabled.';if(result.status==='ready'){draft=weather.snapshot();draftDate=draft.date;dateInput.value=draftDate;chosenPlace=draft.place;draftAuto=true;setFields();info.textContent=weatherSummary(draft)+' · Automatic weather is saved and enabled.';}else{info.textContent=result.message;info.dataset.error='true';}syncButtons();});enableAuto.id='weather-auto-enable';
 const stopAuto=button('Turn off automatic weather',()=>{cancelLookup();autoWeather.disable();draftAuto=false;autoStatus.textContent=autoWeather.status().message;enableAuto.disabled=false;syncButtons();});stopAuto.id='weather-auto-disable';
 const autoRow=el('div',undefined,'fx-weather-lookup-row');autoRow.append(enableAuto,stopAuto);
 const dateRow=el('div',undefined,'fx-weather-date-row');dateRow.append(dateWrap,today);
 const lookupRow=el('div',undefined,'fx-weather-lookup-row');lookupRow.append(locate,refresh);
 const searchRow=el('div',undefined,'fx-weather-search-row');searchRow.append(search,find);
 const retryRow=el('div',undefined,'fx-weather-lookup-row');retryRow.append(retry,cancelBtn);
 controls.append(autoNote,autoStatus,autoTodayWrap,autoRow,dateRow,dateNote,lookupRow,searchRow,info,retryRow,matches,el('h3','Manual fallback'),temp.wrap,precip.wrap,seas.wrap,locWrap);
 const attribution=el('p','Weather: Open-Meteo model estimates. City search: GeoNames via Open-Meteo. Forecast dates use the daily feels-like high; saved live readings expire after 90 minutes. Unknown fabric/sole facts remain unassessed.','fx-caption');
 body.append(note,controls,attribution,version);
 const skip=button('Use without weather',()=>{need(root.HEWRSLocalState.date(draftDate),'Select a valid weather/work date');cancelLookup();autoWeather.disable();weather.apply({source:'not_assessed',date:draftDate});ctx={...ctx,localDate:draftDate};dismissSheet(false);invalidateRecommendations('Weather explicitly not assessed. Generate again.');updateHome();});skip.id='weather-skip';
 const applyWeather=button('Apply',()=>{need(!pending,'Wait for the lookup to finish');need(ready(),'Choose a valid location/date result or complete the manual conditions');cancelLookup();if(!draftAuto)autoWeather.disable();weather.apply(draft);ctx={...ctx,localDate:draftDate};dismissSheet(false);invalidateRecommendations('Weather settings updated. Generate again for current conditions.');updateHome();status(weatherSummary(weather.snapshot()));},true);applyWeather.id='weather-apply';
 actions.append(button('Cancel',()=>dismissSheet()),skip,applyWeather);setFields();
}
function largerOutfit(){
 need(current&&!busy,'Wait for the outfit to finish loading');
 const {body,actions}=openSheet('Larger outfit view',{list:true});
 body.append(el('p',ids(current)+' · Display zoom only; garment geometry is unchanged.','fx-caption'));
 const wrap=el('div',undefined,'fx-large-preview'),canvas=el('canvas');canvas.id='large-avatar';canvas.width=996;canvas.height=2748;canvas.setAttribute('aria-label','Enlarged copy of the current outfit');canvas.getContext('2d').drawImage($('avatar'),0,0);wrap.dataset.fit='false';wrap.append(canvas);
 const hint=el('p','Scroll to see the whole outfit. Fit shows it all at once.','fx-caption');body.append(wrap,hint);
 const fit=button('Fit',()=>{wrap.dataset.fit='true';body.scrollTop=0;}),large=button('Larger',()=>{wrap.dataset.fit='false';body.scrollTop=0;});fit.id='large-outfit-fit';large.id='large-outfit-zoom';actions.append(fit,large,button('Close',()=>dismissSheet()));
}

function contextSheet(kind){
 if(kind==='weather'||kind==='season'){weatherSheet();return;}
 const{body,actions}=openSheet(kind==='style'?'Style':'Work & date'),form=el('div',undefined,'fx-context-form'),draft=copy(ctx);body.append(form);
 if(kind==='style'){form.append(button('Stylist settings · '+connection.hybrid.mode(),stylistSheet));const s=selectField('Existing style profile',Object.entries(styleLabels).map(([value,label])=>({value,label})),draft.style,'style-select');form.append(s.wrap);s.input.onchange=()=>draft.style=s.input.value;}
 else{const s=selectField('Setting',[{value:'clinic',label:'Clinic'},{value:'hospital',label:'Hospital'},{value:'work',label:'Work'},{value:'dinner',label:'Dinner — not connected in current build',disabled:true},{value:'weekend',label:'Weekend — not connected in current build',disabled:true}],draft.occasion,'occasion-select');const f=selectField('Required formality',[{value:'any',label:'Unspecified'},{value:'tie_required',label:'Tie required'},{value:'suit_required',label:'Suit required'},{value:'open_collar_allowed',label:'Open collar allowed'}],draft.formality,'formality-select');const l=el('label','Wear / rotation date'),d=el('input');d.type='date';d.id='local-date';d.value=draft.localDate;l.append(d);form.append(s.wrap,f.wrap,l);s.input.onchange=()=>draft.occasion=s.input.value;f.input.onchange=()=>draft.formality=f.input.value;d.onchange=()=>draft.localDate=d.value;}
 actions.append(button('Cancel',()=>dismissSheet()),button('Apply',()=>{need(root.HEWRSLocalState.date(draft.localDate),'Enter a valid local calendar date');if(draft.localDate!==ctx.localDate)autoWeather.setDateMode(draft.localDate===localToday()?'today':'selected');ctx=draft;dismissSheet(false);updateHome();},true));
}
function openPicker(cat){
 if(cat==='bottoms'&&ui.included())return;
 const{body,actions}=openSheet(names[cat],{cancel:()=>ui.cancel(),list:true});ui.begin(cat);
 const seg=el('div',undefined,'fx-segment'),engine=button('Engine Choice',()=>{ui.choose({mode:'any'});setSegment(true);renderChoices();}),mine=button('My Selection',()=>{if(ui.draft().choice?.mode==='any')ui.choose(null);setSegment(false);renderChoices();});engine.id='picker-engine';mine.id='picker-mine';seg.append(engine,mine);body.append(seg);
 const note=el('p','Apply changes only this preference. Cancel discards the draft.','fx-caption');body.append(note);
 const search=el('input',undefined,'fx-search');search.type='search';search.id='picker-search';search.placeholder='Search actual name or ID';search.setAttribute('aria-label','Search '+names[cat]);
 const filters=el('div',undefined,'fx-picker-filter');let filter={query:'',type:'',brand:'',color:''};
 const pickerScope=ui.scope(cat),pickerRows=pickerScope.limited?ui.filter(cat):ui.rows[cat];
 const typeRows=[{value:'',label:'All types'},...([...new Set(pickerRows.map(x=>x.kind))].map(v=>({value:v,label:({'suit':'Suits',blazer:'Blazers','shirt-only':'Shirt only'})[v]||v})))];const types=selectField('Type',typeRows,'','picker-type');
 const brands=selectField('Brand',[{value:'',label:'All brands'},...[...new Set(pickerRows.map(x=>x.brand).filter(Boolean))].sort().map(v=>({value:v,label:v}))],'','picker-brand');filters.append(types.wrap,brands.wrap);
 const family=ui.families[cat]?selectField('Color',[{value:'',label:'All colors'},...ui.families[cat].map(v=>({value:v,label:v.charAt(0).toUpperCase()+v.slice(1)}))],'','picker-color'):null;if(family)filters.append(family.wrap);
 const list=el('div',undefined,'fx-picker-list');list.id='picker-list';const count=el('p','', 'fx-caption');count.id='picker-count';body.append(search,filters,count,list);
 const apply=button('Apply',()=>{ui.commit();dismissSheet(false);updateHome();status('Preference applied. Generate to display the resulting outfit.');},true);apply.id='picker-apply';actions.append(button('Cancel',()=>dismissSheet()),apply);
 function setSegment(isEngine){engine.setAttribute('aria-pressed',String(isEngine));mine.setAttribute('aria-pressed',String(!isEngine));}
 function addChoice(c,label,id,extra='',disabled=false){const n=el('button',undefined,'fx-choice');n.type='button';if(id){n.dataset.itemId=id;n.append(el('span',id,'fx-choice-id'));}n.append(el('span',label,'fx-choice-name'));if(extra)n.append(el('small',extra));n.disabled=disabled;n.setAttribute('aria-pressed',String(JSON.stringify(c)===JSON.stringify(ui.draft()?.choice)));n.onclick=()=>{ui.choose(c);setSegment(c.mode==='any');renderChoices();};list.append(n);}
 function renderChoices(){const d=ui.draft();if(!d)return;list.replaceChildren();const selected=d.choice;setSegment(selected?.mode==='any');const deferredDraft=pickerScope.limited&&selected?.mode==='item'&&!ui.availability(cat,selected.id).visual_available;apply.disabled=!selected||deferredDraft;note.textContent=deferredDraft?selected.id+' is retained from your suit selection. Choose an available shirt for this mode; Cancel keeps your preferences.':'Apply changes only this preference. Cancel discards the draft.';
  if(cat==='tie')addChoice({mode:'none'},'No Tie','NO_TIE','Intentional open-collar selection; not Engine / Any');
  if(cat==='watch')addChoice({mode:'none'},'No watch selected','NO_WATCH','Watch ID and name are sufficient for this release');
  if(family&&filter.color)addChoice({mode:'family',id:filter.color},'Engine chooses within '+filter.color+' family','CATEGORY: '+filter.color,'Category preference, not an exact item');
  const found=ui.filter(cat,filter);count.textContent=pickerScope.limited?found.length+' of '+pickerScope.available_count+' shirts in this release. The other '+pickerScope.deferred_count+' remain in Wardrobe and suit mode.':found.length+' current items. '+(cat==='shoes'?'Engine can choose any registered shoe, or keep your exact selection.':cat==='topwear'?'Engine can choose a suit or blazer, or build around your selected item.':cat==='watch'?'Watch photos are deferred.':'Filters narrow this list; Apply a family preference explicitly to constrain Engine.');
  for(const r of found)addChoice({mode:'item',id:r.id},r.label,r.sourceId||r.id,r.available?'':'Source connection unavailable; catalogue identity retained',!r.available);
  if(!found.length)list.append(el('div','No current item matches these filters.','fx-empty'));
 }
 function changed(){filter={query:search.value,type:types.input.value,brand:brands.input.value,color:family?.input.value||''};const chosen=ui.draft()?.choice;if(chosen?.mode==='item'&&!ui.filter(cat,filter).some(x=>x.id===chosen.id)){ui.choose(null);$('fx-sheet-error').textContent='The previous draft item is outside these filters. Choose an item or family before Apply.';}else if(chosen?.mode==='family'&&filter.color!==chosen.id){ui.choose(null);}renderChoices();}
 search.oninput=changed;types.input.onchange=changed;brands.input.onchange=changed;if(family)family.input.onchange=changed;renderChoices();root.HEWRSSheetLayout.focusSearch(search);
}
function setBusy(value){busy=value;$('cancel-work').hidden=!value;$('generate-options').disabled=value;$('generate-options').textContent=value?'Building outfits…':'Generate Options →';$('stage').classList.toggle('busy',value);$('regenerate').disabled=value||!producing;$('large-view').disabled=value||!current;updateLogButtons();}
function updateLogButtons(){const blocked=busy||!current||current.state==='REFERENCE'||!!logTransaction?.pending||$('outfit-output').hidden||!!store.status().blocked;$('record-wear').disabled=blocked;$('quick-log').disabled=blocked;}
function itemsFor(s){if(!s)return [];
 const top=s.shirtOnly?{id:null,name:'Shirt only — no jacket'}:s.blazerId?{id:s.blazerId,name:connection.blazerConnection.knownBlazer(s.blazerId).label}:{id:s.suitId,name:connection.features.get(s.suitId)?.description||s.suitId};
 const pants=s.pantId?{id:s.pantId,name:connection.blazerConnection.knownPant(s.pantId).label}:{id:null,name:'Included with suit'};
 const shoe=connection.catalogue.shoes.find(x=>x.id===s.shoeId),watch=connection.catalogue.watches.find(x=>x.id===s.watchId);
 return [{role:'Suit / Blazer',...top},{role:'Shirt',id:s.shirtId,name:connection.records[s.shirtId].label},{role:'Tie',id:s.state==='NO_TIE'?null:s.state,name:s.state==='NO_TIE'?'No Tie':s.state==='REFERENCE'?'Retained reference':connection.features.get(s.state)?.description||s.state},{role:'Shoes',id:s.shoeId,name:shoe?.name||s.shoeId},{role:'Bottoms',...pants},{role:'Watch',id:s.watchId,name:watch?.name||'No watch selected'}];
}
function selectionKey(s){return JSON.stringify(connection.historyIds(s));}
function displayCurrent(){if(!current)return;
 $('selection-ids').textContent=ids(current);$('selection-origin').textContent=origin==='engine'?(currentOption?._hewrsConnected?.preference?(currentOption._hewrsConnected.is_recommendation?'Personalized choice · confirmed-history rotation':'Personalized outfit option'):(currentOption?._hewrsConnected?.is_recommendation?'Local rotation choice':'Compatibility option')):'Your selection';
 const pref=currentOption?._hewrsConnected?.preference;
 const stylist=currentOption?._hewrsConnected?.stylist;
 $('score-value').textContent=stylist?'—':pref?pref.score.toFixed(1):Number.isFinite(score?.display_score)?score.display_score.toFixed(2):'—';$('score-label').textContent=stylist?(stylist.method==='visual'?'Live visual assessment · '+stylist.grade:'Curated reference · no numerical grade'):pref?(pref.revision==='hewrs.researched-work-styling.v1_21_0'?'Research-informed fit · local rules':'Personal styling fit · heuristic'):(score?.style?.classification||score?.status||'Unavailable')+(score?.status==='new_ensemble_estimate'?' · ensemble estimate':'');
 if(stylist)$('selection-origin').textContent=stylist.method==='visual'?'Visual AI · '+stylist.model:'Curated reference · '+stylist.reference_id;
 const summary=$('item-summary');summary.replaceChildren();for(const r of itemsFor(current)){const t=el('span',undefined,'fx-item-mini');t.title=r.role+': '+(r.id?r.id+' — ':'')+r.name;t.append(el('span',r.id||r.role,'fx-mini-id'),el('span',r.name,'fx-mini-name'));summary.append(t);}
 const w=itemsFor(current).find(x=>x.role==='Watch');$('representation').textContent=w.id?w.id+' · '+w.name:'No watch selected';
 $('option-count').textContent=options.length&&optionIndex>=0?'Option '+(optionIndex+1)+' of '+options.length:'Current selection';$('prev-option').disabled=busy||options.length<2||optionIndex<=0;$('next-option').disabled=busy||options.length<2||optionIndex>=options.length-1;$('open-results').disabled=!options.length;
 updateLogButtons();$('view-current').hidden=false;
}
function presentFrame(){ $('outfit-empty').hidden=true;$('outfit-output').hidden=false; }
function presentEmpty(text){$('outfit-empty').textContent=text;$('outfit-empty').hidden=false;$('outfit-output').hidden=true;$('option-count').textContent='0 options';updateLogButtons();}
function sessionValue(s,o,date,context){return {selection:copy(s),origin:o,mode,localDate:date,context:copy(context)};}
async function apply(s,opts={}){
 autoWeather.cancel();
 const token=opts.token??++generation;if(opts.token===undefined)renderer.cancel();connection.validateSelection(s);if(s.shirtOnly&&opts.origin&&opts.origin!=='manual')throw Error('Shirt-only is an exact manual selection');
 const previousSelection=current?copy(current):null;const priorBusy=busy;setBusy(true);status(current?'Loading next outfit…':'Loading approved source layers…');
 try{if(opts.historyToken)store.assertCurrent(opts.historyToken);const out=await renderer.render(s);if(token!==generation||out.cancelled)return {cancelled:true};
  if(opts.historyToken){try{store.assertCurrent(opts.historyToken);}catch(e){if(previousSelection)await renderer.render(previousSelection);else $('outfit-output').hidden=true;throw e;}}
  current=copy(s);origin=opts.origin||'manual';currentOption=opts.option||null;score=opts.score||connection.scoreSelection(s,opts.context||currentContext());
  if(s.shirtOnly)setMode('anchor');if(opts.localDate)ctx.localDate=opts.localDate;if(opts.context){ctx.occasion=opts.context.occasion;ctx.formality=opts.context.requiredFormality;}
  if(!opts.keepPreferences)ui.fromSelection(s);presentFrame();displayCurrent();updateHome();
  if(opts.save!==false){try{store.saveSession(sessionValue(s,origin,ctx.localDate,opts.context||currentContext()));if(opts.historyToken)optionHistoryToken=store.readForGeneration().token;}catch(e){status('Outfit ready. '+e.message,true);refreshHistory();return out;}}
  refreshHistory();status(origin==='engine'?'Engine result ready.':'Selection ready.');return out;
 }catch(e){if(token===generation)status('Selection not applied: '+e.message,true);throw e;}
 finally{if(token===generation){setBusy(priorBusy&&opts.token!==undefined);displayCurrent();}}
}
async function selectOption(index){if(optionHistoryToken){try{store.assertCurrent(optionHistoryToken);}catch(e){invalidateRecommendations(e.message);throw e;}}need(index>=0&&index<options.length,'Option unavailable');const o=options[index],q=lastRequest;need(connection.controller.verifyCachedOption(o,q,connection.catalogue),'Results are no longer current; generate again');const b=connection.selectionFromOption(o,q);const out=await apply(b.selection,{historyToken:optionHistoryToken,origin:'engine',option:o,score:o._hewrsConnected.compatibility,context:q.context,localDate:q.localDate,keepPreferences:true});if(!out.cancelled){optionIndex=index;displayCurrent();}return out;}
async function generate(c,extra={}){
 autoWeather.cancel();
 const q=connection.makeRequest(c),previousKey=current?selectionKey(current):null,previousRequest=lastRequest?JSON.stringify(lastRequest):null,token=++generation;renderer.cancel();lastRequest=copy(q);options=[];report=null;optionIndex=-1;currentOption=null;
 producing={kind:'engine',config:copy(c),prefs:copy(extra.prefs||ui.snapshot()),mode,context:copy(ctx)};setBusy(true);status('Building outfits…');
 try{const read=store.readForGeneration();optionHistoryToken=read.token;const r=await connection.controller.generateAsync(q,connection.catalogue,read.events,{isCancelled:()=>token!==generation,renderForStylist,onProgress:p=>{if(token===generation)status((p.phase==='rendering-for-visual-review'?'Preparing actual outfit images: ':'Building outfits… ')+(p.examined||0)+(p.total?' / '+p.total:''));}});if(token!==generation||r.status==='cancelled')return {cancelled:true};
  store.assertCurrent(read.token);need(connection.controller.verifyOptionSet(r.options||[],q),'Returned options violate current physical-item limits or source bindings');report=r;options=r.options||[];$('outfit-summary').textContent=options.length+' options · '+(r.stylist?(r.stylist.live_ai_used?'Live visual outfit assessment. ':'Local curated reference selection; no live AI. '):q.automatic?(q.stylist?.mode==='research'?'Research-based wardrobe generator; no live AI. ':'Existing heuristic ranking. '):'')+(r.diagnostics?.examined||0)+' source candidates checked. Unanchored ties: once per list; other items: at most twice; No Tie: at most twice unless selected.'+(q.automatic?' '+weatherSummary(q.environment)+(r.reason?' '+r.reason:''):'');
  if(!options.length){presentEmpty(r.reason||(r.status==='mapping_required'?'No recorded numeric profile for these exact trousers. Anchor remains available.':'No scored result for these preferences. No item was substituted.'));status('No scored result. Preferences retained.');showPage('outfits');return r;}
  let index=0;if(previousKey&&previousRequest===JSON.stringify(q)){const match=options.findIndex(o=>selectionKey(connection.selectionFromOption(o,q).selection)===previousKey);if(match>=0)index=match;}
  const o=options[index],b=connection.selectionFromOption(o,q);const frame=await apply(b.selection,{token,historyToken:read.token,origin:'engine',option:o,score:o._hewrsConnected.compatibility,context:q.context,localDate:q.localDate,keepPreferences:true});if(token!==generation||frame.cancelled)return {cancelled:true};optionIndex=index;presentFrame();displayCurrent();showPage('outfits');return r;
 }catch(e){if(token===generation){options=[];optionHistoryToken=null;report={status:'error',reason:e.message};optionIndex=-1;currentOption=null;origin='manual';refreshHistory();presentEmpty('Generation failed: '+e.message);status('Generation failed: '+e.message,true);showPage('outfits');}throw e;}
 finally{if(token===generation){setBusy(false);displayCurrent();}}
}
async function submit(){if(busy)return;try{await refreshAutomaticWeather('generate');need(root.HEWRSLocalState.date(ctx.localDate),'Enter a valid local date');const tentative=ui.operation(mode,{...ctx,environment:{source:'not_assessed',date:ctx.localDate}});const op=tentative.kind==='manual'?tentative:ui.operation(mode,{...ctx,environment:weather.request(ctx.localDate)});if(op.kind==='manual'){options=[];optionIndex=-1;lastRequest=null;report=null;producing={kind:'manual',selection:copy(op.selection),prefs:copy(op.prefs),mode,context:copy(ctx)};$('outfit-summary').textContent='Exact manual selection; existing score-source holds do not block supported rendering.';const r=await apply(op.selection,{origin:'manual',keepPreferences:true,context:currentContext(),localDate:ctx.localDate});if(!r.cancelled)showPage('outfits');}else await generate(op.config,{prefs:op.prefs});}catch(e){status(e.message,true);}}
function cancel(){visualStylist.cancel();autoWeather.cancel();generation++;renderer.cancel();setBusy(false);status('Pending work cancelled. Previous complete outfit retained.');if(current){presentFrame();displayCurrent();}}
function invalidateRecommendations(reason='Local history changed. Generate again for a current rotation recommendation.'){optionHistoryToken=null;options=[];lastRequest=null;report=null;optionIndex=-1;currentOption=null;origin='manual';producing=null;$('outfit-summary').textContent=reason;displayCurrent();}
function details(){if(!current)return;const{body,actions}=openSheet('Outfit details');if(currentOption?._hewrsConnected?.preference?.explanation)body.append(el('p',currentOption._hewrsConnected.preference.explanation,'fx-caption'));if(currentOption?._hewrsConnected?.stylist)body.append(el('p',currentOption._hewrsConnected.stylist.explanation,'fx-caption'));for(const r of itemsFor(current)){const row=el('div',undefined,'fx-details-item');row.append(el('strong',r.role+(r.id?' · '+r.id:'')),el('span',r.name));body.append(row);}body.append(el('p','Watch ID and name are shown; watch imagery is deferred.','fx-caption'));actions.append(button('Close',()=>dismissSheet()));}
function scoreDetails(){const{body,actions}=openSheet('Score details');body.append(el('p',Number.isFinite(score?.display_score)?score.display_score.toFixed(2)+' / 10 — Original compatibility estimate — '+(score.style?.classification||score.status):'A score is unavailable for this selection. It is not zero.','fx-caption'),el('pre',JSON.stringify({stylist:currentOption?._hewrsConnected?.stylist||null,personalized_preference:currentOption?._hewrsConnected?.preference||null,list_curation:currentOption?._hewrsConnected?.curation||null,original_compatibility_unchanged:score,weather:currentOption?._hewrsConnected?.environment||null,accessories:currentOption?._hewrsConnected?.accessory_assessment||null},null,2)));actions.append(button('Close',()=>dismissSheet()));}
function resultSheet(){const{body,actions}=openSheet('Outfit options');if(!options.length)body.append(el('p',report?.reason||'No current Engine options.','fx-caption'));for(const [i,o]of options.entries()){const s=connection.selectionFromOption(o,lastRequest).selection;const b=el('button',undefined,'fx-choice');b.append(el('span',(i+1)+' · '+ids(s),'fx-choice-id'),el('span',connection.records[s.shirtId].label,'fx-choice-name'),el('span',o._hewrsConnected.stylist?(o._hewrsConnected.stylist.method==='visual'?'Visual AI · '+o._hewrsConnected.stylist.grade:'Curated reference'):o._hewrsConnected.preference?o._hewrsConnected.preference.score.toFixed(1)+' / 10 · '+(o._hewrsConnected.preference.revision==='hewrs.researched-work-styling.v1_21_0'?'research-informed local fit':'personal styling fit'):o._hewrsConnected.compatibility.display_score.toFixed(2)+' / 10 · original compatibility','fx-option-score'));b.onclick=async()=>{try{dismissSheet();await selectOption(i);showPage('outfits');}catch(e){status(e.message,true);}};body.append(b);}actions.append(button('Close',()=>dismissSheet()));}
function canLog(){return !!current&&!busy&&!$('outfit-output').hidden&&current.state!=='REFERENCE'&&!store.status().blocked;}
function startLog(){if(!canLog()||logTransaction?.pending)return;if(modal?.kind==='wear')return;
 const sel=copy(current),o=origin,date=ctx.localDate,id='wear_'+(root.crypto?.randomUUID?.()||Date.now()+'_'+Math.random().toString(16).slice(2));const{body,actions,token}=openSheet('Log This Outfit',{cancel:()=>{if(!logTransaction?.pending)logTransaction=null;updateLogButtons();}});modal.kind='wear';
 logTransaction={id,selection:sel,origin:o,done:false,pending:false,token};body.append(el('p',ids(sel),'fx-caption'));const label=el('label','Actual wear date','fx-context-form'),d=el('input');d.type='date';d.id='wear-date';d.value=date;label.append(d);const check=el('label',undefined,'fx-check-row'),c=el('input');c.type='checkbox';c.id='repeat-incident';check.append(c,el('span','Record a controlled repetition incident'));body.append(label,check,el('p','Confirm only an outfit actually worn. Viewing or generating never logs wear.','fx-caption'));
 const confirm=button('Confirm actual wear',async()=>{const tx=logTransaction;if(!tx||tx.done||tx.pending||tx.token!==token)return;need(root.HEWRSLocalState.date(d.value),'Enter a valid wear date');tx.pending=true;confirm.disabled=true;updateLogButtons();try{store.addEvent(connection.createHistoryEvent(tx.selection,{id:tx.id,localDate:d.value,origin:tx.origin==='engine'?'engine':'manual',controlledRepetition:c.checked}));tx.done=true;dismissSheet(false);logTransaction=null;invalidateRecommendations();refreshHistory();status(store.status().persistent?'Wear recorded.':'Wear recorded in session memory. Export to retain it.');}catch(e){tx.pending=false;confirm.disabled=false;sheetError(e);}finally{updateLogButtons();}},true);confirm.id='confirm-wear';actions.append(button('Cancel',()=>dismissSheet()),confirm);
}
function wardrobeRows(group){
 if(group==='suits')return ui.rows.topwear.filter(r=>r.kind==='suit').map(r=>({...r,id:r.sourceId,category:'topwear',choiceId:r.id,view:connection.assemblies.registeredView(r.sourceId),detail:connection.suitSources.resolveCanonical(r.sourceId)}));
 if(group==='blazers')return ui.rows.topwear.filter(r=>r.kind==='blazer').map(r=>({...r,id:r.sourceId,category:'topwear',choiceId:r.id,detail:connection.blazerConnection.knownBlazer(r.sourceId)}));
 if(group==='shirts')return ui.rows.shirt.map(r=>({...r,category:'shirt',choiceId:r.id}));
 if(group==='ties')return ui.rows.tie.map(r=>({...r,category:'tie',choiceId:r.id}));
 if(group==='watches')return ui.rows.watch.map(r=>({...r,category:'watch',choiceId:r.id}));
 if(group==='pants'){
  const active=new Map(ui.rows.bottoms.map(r=>[connection.blazerConnection.knownPant(r.id).historyId,r]));
  return connection.catalogue.pants.map(r=>active.has(r.id)?{...active.get(r.id),historyId:r.id,category:'bottoms',choiceId:active.get(r.id).id}:({id:r.id,label:r.name||r.id,available:false,detail:r,kind:'retained catalogue record'}));
 }
 if(group==='shoes'){const registered=new Map(ui.rows.shoes.map(r=>[r.id,r]));return connection.catalogue.shoes.map(r=>registered.has(r.id)?({...registered.get(r.id),category:'shoes',choiceId:r.id}):({id:r.id,label:r.name||r.id,available:false,detail:r,kind:r.disabled?'Inactive / retained record':'No registered image connection'}));}
 return (connection.catalogue[group]||[]).map(r=>({id:r.id,label:r.name||r.brand||r.id,available:false,detail:r,kind:'Catalogue record; rendering unconnected'}));
}
function wardrobeGroups(){const preferred=Object.keys(groupLabels);return [...preferred,...Object.keys(connection.catalogue).filter(k=>Array.isArray(connection.catalogue[k])&&!preferred.includes(k))];}
function renderGroups(){const box=$('wardrobe-groups');box.replaceChildren();const groups=wardrobeGroups();$('group-count').textContent=groups.length+' groups';for(const k of groups){const rows=wardrobeRows(k),b=el('button',undefined,'fx-category-card');b.type='button';b.dataset.category=k;const txt=el('span');txt.append(el('strong',groupLabels[k]||k),el('small',rows.length+' records'));b.append(icon(groupLabels[k]?k:'wardrobe'),txt,el('span','›'));b.onclick=()=>browseCategory(k);box.append(b);}}
function browseCategory(group){const{body,actions}=openSheet(groupLabels[group]||group,{list:true}),search=el('input',undefined,'fx-search'),list=el('div',undefined,'fx-picker-list');search.type='search';search.placeholder='Search actual name or ID';search.id='wardrobe-search';search.setAttribute('aria-label','Search wardrobe');list.id='wardrobe-list';const rows=wardrobeRows(group);body.append(search,list);function draw(){list.replaceChildren();const q=search.value.trim().toLowerCase();for(const r of rows.filter(x=>(x.id+' '+x.label).toLowerCase().includes(q))){const b=el('button',undefined,'fx-choice');b.type='button';b.dataset.recordId=r.id;b.append(el('span',r.id,'fx-choice-id'),el('span',r.label,'fx-choice-name'));if(!r.available)b.append(el('small',r.kind||'Image route not connected'));b.onclick=()=>itemDetails(r,group);list.append(b);}if(!list.children.length)list.append(el('p','No current item matches.','fx-caption'));}search.oninput=draw;draw();actions.append(button('Close',()=>dismissSheet()));root.HEWRSSheetLayout.focusSearch(search);}
function itemDetails(r,group){const{body,actions,token}=openSheet((groupLabels[group]||group)+' · '+r.id);body.append(el('h3',r.label),el('p',r.id,'fx-caption'));if(r.view){const img=el('img',undefined,'fx-bound-image');img.alt=r.id+' saved suit control; not current selection';img.src=resolveUrl(r.view);body.append(img,el('p','Saved DS001 / T001 / shoe-8 assembly. This is a read-only reference, not a newly selected outfit.','fx-caption'));}
 else body.append(el('p',group==='watches'?'Watch ID/name display; images deferred.':'This item detail view does not substitute an unbound image.','fx-caption'));
 if(r.detail){const d=el('details'),summary=el('summary','Source record');d.append(summary,el('pre',JSON.stringify(r.detail,null,2)));body.append(d);}
 if(r.category&&r.available){actions.append(button('Use exact item',()=>{ui.set(r.category,{mode:'item',id:r.choiceId});setMode('anchor');dismissSheet(false);showPage('home');updateHome();status('Exact '+(groupLabels[group]||group)+' preference applied. Generate to display the resulting outfit.');},true));}
 actions.append(button('Back to category',()=>browseCategory(group)));body.append(el('p','Renaming is unavailable: the current build has no persistent rename handler.','fx-caption'));
}
function historyRow(event,withButton=false){const row=el('article',undefined,'fx-history-row');row.append(el('strong',event.localDate+' · '+event.origin),el('p',ids(event.canonical_selection)));const watch=connection.catalogue.watches.find(w=>w.id===event.items.watch?.id);row.append(el('p',event.items.shoes.id+(watch?' · '+watch.id+' — '+watch.name:'')));if(withButton)row.append(button('View recorded selection',async()=>{dismissSheet();options=[];optionIndex=-1;report=null;lastRequest=null;producing=null;await apply(event.canonical_selection,{origin:'manual',localDate:event.localDate});showPage('outfits');}));return row;}
function refreshHistory(){refreshFavoriteCount();const s=store.snapshot(),st=store.status();$('wear-count').textContent=st.blocked?'—':s.events.length;$('repeat-limit').textContent=Number.isFinite(root.HEWRS_INPUTS.logicData.rotationPolicy?.maxMonthlyRepeatIncidents)?String(root.HEWRS_INPUTS.logicData.rotationPolicy.maxMonthlyRepeatIncidents):'—';$('storage-banner').textContent=st.blocked||(st.persistent?'Saved in this browser’s existing candidate ledger.':'Session memory only. Export to retain records.');const list=$('history-preview');list.replaceChildren();if(st.blocked)list.append(el('p','Wear history unavailable. Saved data is retained; generation cannot treat it as an empty history.','fx-warning'));else{if(!s.events.length)list.append(el('p','No wear recorded in this application.','fx-caption'));for(const e of s.events.slice(-2).reverse())list.append(historyRow(e));}$('clear-log').disabled=!s.events.length||!!st.blocked;}
function logSheet(){const{body,actions}=openSheet('Recent Log');if(store.status().blocked){body.append(el('p','Wear history unavailable. Original saved data retained; not an empty log.','fx-warning'));actions.append(button('Close',()=>dismissSheet()));return;}const s=store.snapshot();if(!s.events.length)body.append(el('p','No confirmed wear records.','fx-caption'));for(const e of [...s.events].reverse())body.append(historyRow(e,true));actions.append(button('Close',()=>dismissSheet()));}
function confirmClear(){const before=store.snapshot();const{body,actions}=openSheet('Clear Wear Log');body.append(el('p','Remove '+before.events.length+' confirmed wear records from this application’s ledger? This does not alter the catalogue, current outfit or production history.','fx-warning'));actions.append(button('Cancel',()=>dismissSheet()),button('Confirm clear',()=>{const now=store.snapshot();need(now.revision===before.revision,'History changed; reopen Clear before proceeding');const preview=store.previewImport(JSON.stringify({...now,events:[]}));store.restore(preview);dismissSheet(false);invalidateRecommendations();refreshHistory();status('Local wear log cleared.');}));}
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}

// Favorites use a separate namespace. Saving/removing/importing one never
// records wear, changes a recommendation or rewrites the existing ledger.
function refreshFavoriteCount(){
 const label=$('favorites-button').querySelector('small'),st=favorites.status();
 label.textContent=st.blocked?'Saved data needs review':favorites.snapshot().items.length+' saved outfits';
}
function favoriteDescription(s){return itemsFor(s).map(i=>i.role+': '+(i.id?i.id+' — ':'')+i.name).join('\n');}
function canFavoriteCurrent(){return !!current&&!busy&&!$('outfit-output').hidden&&current.state!=='REFERENCE'&&$('avatar').dataset.status==='ready'&&JSON.stringify(renderer.last())===JSON.stringify(current);}
function saveCurrentFavorite(){
 need(canFavoriteCurrent(),'Display a complete outfit before saving it');
 const result=favorites.add(current,{id:'favorite_'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)),created_at:new Date().toISOString()});
 refreshFavoriteCount();return result;
}
function showFavorites(notice=''){
 const {body,actions}=openSheet('Favorites',{list:true}),st=favorites.status();
 body.append(el('p',st.blocked||(st.persistent?'Saved in this browser. Favorites do not count as wear and do not sync automatically between devices.':'Session memory only. Export Favorites to retain them.'),'fx-caption'));
 const live=el('p',notice,'fx-caption');live.id='favorite-notice';live.setAttribute('role','status');body.append(live);
 const savedCurrent=canFavoriteCurrent()?favorites.find(current):null;
 const save=button(savedCurrent?'Current outfit already saved':'Save current outfit',()=>{const result=saveCurrentFavorite();showFavorites(result.added?(result.persistent?'Outfit saved as a Favorite. Wear count unchanged.':'Favorite kept in session memory only. Export to retain it.'):'This exact outfit is already saved; no duplicate added.');},true);
 save.id='save-favorite';save.disabled=!!st.blocked||!canFavoriteCurrent()||!!savedCurrent;body.append(save);
 if(current)body.append(el('p','Current: '+ids(current)+' · '+current.shoeId+(current.watchId?' · '+current.watchId:''),'fx-caption'));
 const search=el('input',undefined,'fx-search');search.type='search';search.placeholder='Search saved outfits by ID or name';search.id='favorite-search';search.setAttribute('aria-label','Search Favorites');body.append(search);
 const list=el('div');list.id='favorites-list';body.append(list);
 function draw(){
  list.replaceChildren();const q=search.value.trim().toLowerCase();
  const rows=[...favorites.snapshot().items].reverse().filter(i=>favoriteDescription(i.selection).toLowerCase().includes(q));
  if(!rows.length)list.append(el('p',q?'No matching Favorites.':'No favorite outfits saved yet.','fx-caption'));
  for(const item of rows){
   const row=el('article',undefined,'fx-history-row');row.dataset.favoriteId=item.id;
   row.append(el('strong',ids(item.selection)),el('p',connection.records[item.selection.shirtId].label));
   const watch=connection.catalogue.watches.find(w=>w.id===item.selection.watchId);
   row.append(el('p',item.selection.shoeId+(watch?' · '+watch.id+' — '+watch.name:'')));
   const view=button('Open outfit',()=>openFavorite(item.id));view.dataset.favoriteOpen=item.id;view.disabled=busy;
   const remove=button('Remove favorite',()=>confirmRemoveFavorite(item.id));remove.dataset.favoriteRemove=item.id;remove.disabled=!!st.blocked;
   row.append(view,remove);list.append(row);
  }
 }
 search.oninput=draw;draw();
 const data=button('Export / Import favorites',favoriteBackup);data.id='favorite-data';actions.append(button('Close',()=>dismissSheet()),data);
}
async function openFavorite(id){
 need(!busy,'Finish or cancel the current render first');
 const item=favorites.snapshot().items.find(x=>x.id===id);need(item,'Favorite is no longer present');
 // A favorite is an exact manual selection, never a saved score or recommendation.
 // Render atomically before changing the remembered session. Persist only
 // the current selection through the existing handler; never add a wear event.
 const token=modal?.token;
 const out=await apply(item.selection,{origin:'manual',save:false});if(out.cancelled)return;
 options=[];optionIndex=-1;lastRequest=null;report=null;producing=null;currentOption=null;
 setMode('anchor');displayCurrent();updateHome();
 $('outfit-summary').textContent='Favorite opened as an exact manual selection. No wear recorded and no saved recommendation score reused.';
 if(modal?.token===token)dismissSheet(false);showPage('outfits');
 try{store.saveSession(sessionValue(item.selection,'manual',ctx.localDate,currentContext()));refreshHistory();status(store.status().persistent?'Favorite opened and current outfit saved. Wear history unchanged.':'Favorite opened in session memory. Export to retain it. Wear history unchanged.');}catch(e){refreshHistory();status('Favorite displayed. '+e.message,true);}
}
function confirmRemoveFavorite(id){
 const snap=favorites.snapshot(),item=snap.items.find(i=>i.id===id);need(item,'Favorite is no longer present');
 const{body,actions}=openSheet('Remove favorite');body.append(el('p','Remove '+ids(item.selection)+' from Favorites only? Your current outfit and wear history stay unchanged.','fx-caption'));
 const confirm=button('Confirm removal',()=>{favorites.remove(id,snap.revision);refreshFavoriteCount();showFavorites('Favorite removed. Wear history unchanged.');},true);confirm.id='confirm-favorite-removal';
 actions.append(button('Cancel',()=>showFavorites()),confirm);
}
function favoriteBackup(){
 let preview=null;const {body,actions,token}=openSheet('Favorites backup');
 body.append(el('p','Favorites only—not a wear-history backup. Import adds new exact outfits and keeps existing favorites. It does not overwrite wear history or the current outfit.','fx-caption'));
 const exp=button('Export favorites',()=>download('HEWRS_FAVORITES_'+localToday()+'.json',favorites.exportText()));exp.id='export-favorites';
 const file=el('input');file.type='file';file.accept='.json,application/json';file.id='favorites-file';file.setAttribute('aria-label','Select Favorites backup');
 const pre=el('pre');pre.id='favorites-import-preview';pre.hidden=true;
 const confirm=button('Confirm import',()=>{need(preview,'Select a validated Favorites backup first');const result=favorites.merge(preview);preview=null;refreshFavoriteCount();showFavorites(result.added+' favorites imported; '+result.already_saved+' already saved. Wear history unchanged.');},true);confirm.id='confirm-favorites-import';confirm.disabled=true;
 file.onchange=async()=>{preview=null;confirm.disabled=true;pre.hidden=true;try{const f=file.files[0];if(!f)return;need(f.size<=1000000,'Favorites backup is too large');const candidate=favorites.previewImport(await f.text());if(modal?.token!==token)return;preview=candidate;pre.textContent=JSON.stringify({existing:candidate.existing,incoming:candidate.incoming,add:candidate.added,already_saved:candidate.already_saved,total:candidate.total,action:'Add new exact favorites; keep existing IDs. No changes to wear or current outfit.'},null,2);pre.hidden=false;confirm.disabled=!candidate.added;$('fx-sheet-error').textContent='';}catch(e){if(modal?.token===token)sheetError(e);}};
 const content=el('div',undefined,'fx-data-actions');content.append(exp,el('label','Import a Favorites backup'),file,pre);body.append(content);
 actions.append(button('Back',()=>showFavorites()),confirm);
}

function backup(){restorePreview=null;const{body,actions,token}=openSheet('Backup & Restore');body.append(el('p','This backup contains the current outfit and wear history. Favorites have a separate export/import inside Favorites.','fx-caption'));const st=store.status();body.append(el('p',st.blocked||(st.persistent?'Using the existing application ledger and source lock.':'Session memory only. Export to retain current records.'),'fx-caption'));
 const exportButton=button('Export current backup',()=>download('HEWRS_LOCAL_BACKUP_'+localToday()+'.json',store.exportText()));exportButton.id='export-backup';const f=el('input');f.type='file';f.accept='.json,application/json';f.id='backup-file';f.setAttribute('aria-label','Select existing application backup');const pre=el('pre');pre.id='import-preview';pre.hidden=true;const restore=button('Confirm restore',async()=>{need(restorePreview,'Select a validated backup first');const preview=restorePreview;store.restore(preview);restorePreview=null;restore.disabled=true;dismissSheet(false);invalidateRecommendations();refreshHistory();const s=store.snapshot().session;if(s){setMode(s.mode);ctx={occasion:s.context.occasion,formality:s.context.requiredFormality,style:'AUTO',localDate:s.localDate};await apply(s.selection,{origin:'manual',context:s.context,localDate:s.localDate,save:false});}updateHome();status('Validated backup restored through the existing application handler.');},true);restore.id='confirm-restore';restore.disabled=true;
 f.onchange=async()=>{restorePreview=null;restore.disabled=true;pre.hidden=true;try{const file=f.files[0];if(!file)return;const v=store.previewImport(await file.text());if(modal?.token!==token)return;restorePreview=v;pre.textContent=JSON.stringify({current_records:store.snapshot().events.length,backup_records:v.events.length,selection:v.session?.selection||null,action:'Replace this candidate ledger only after confirmation; no merge or production migration.'},null,2);pre.hidden=false;restore.disabled=false;$('fx-sheet-error').textContent='';}catch(e){sheetError(e);}};
 const content=el('div',undefined,'fx-data-actions');content.append(exportButton,el('label','Import a current-format backup'),f,pre);body.append(content);actions.append(button('Cancel',()=>dismissSheet()),restore);
}

// Factual counts only. This panel has no wear, preference, Favorite or storage writes.
function showInsights(){
 const {body,actions}=openSheet('Rotation Insights',{list:true}),st=store.status();
 if(st.blocked){body.append(el('p','Wear records unavailable: '+st.blocked+' No usage counts are claimed.','fx-warning'));actions.append(button('Close',()=>dismissSheet()));return;}
 const snapshot=store.snapshot();
 body.append(el('p',(st.persistent?'Recorded in this browser only.':'Session-memory records only.')+' Counts are confirmed log entries, not all actual wear. Favorites and viewed outfits are excluded.','fx-caption'));
 const filter=el('div',undefined,'fx-context-form');
 const range=selectField('Records in range',[{value:'30',label:'Last 30 calendar days'},{value:'90',label:'Last 90 calendar days'},{value:'all',label:'All recorded dates through cutoff'}],'30','insights-range');
 const dateLabel=el('label','Through (inclusive)'),cutoff=el('input');cutoff.type='date';cutoff.id='insights-through';cutoff.value=ctx.localDate;dateLabel.append(cutoff);filter.append(range.wrap,dateLabel);body.append(filter);
 const totals=el('div');totals.id='insights-summary';totals.setAttribute('aria-live','polite');body.append(totals);
 const category=selectField('Garment group',usage.categories.map(r=>({value:r.id,label:r.label+' ('+r.count+')'})),'shirts','insights-category');
 const sort=selectField('Order',[{value:'catalogue',label:'Catalogue order'},{value:'count',label:'Most recorded in range'},{value:'last',label:'Oldest last-recorded date; unrecorded last'}],'catalogue','insights-sort');
 const search=el('input',undefined,'fx-search');search.type='search';search.id='insights-search';search.placeholder='Search physical ID or item name';search.setAttribute('aria-label','Search recorded wear');
 const check=el('label',undefined,'fx-check-row'),recorded=el('input');recorded.type='checkbox';recorded.id='insights-recorded-only';check.append(recorded,el('span','Only items with records in this range'));
 const filters=el('div',undefined,'fx-context-form');filters.append(category.wrap,sort.wrap,search,check);body.append(filters);
 const count=el('p','', 'fx-caption');count.id='insights-count';count.setAttribute('role','status');
 const list=el('div');list.id='insights-list';body.append(count,list);
 let result=null;
 function drawRows(){
  list.replaceChildren();count.textContent='';if(!result)return;
  const rows=usage.rows(result,category.input.value,{query:search.value,sort:sort.input.value,recordedOnly:recorded.checked});
  count.textContent=rows.length+' items · record counts in range; last recorded date through '+result.as_of;
  if(!rows.length)list.append(el('p','No matching records or items for these filters.','fx-caption'));
  for(const r of rows){
   const row=el('article',undefined,'fx-history-row');row.dataset.usageId=r.id;row.dataset.usageHistoryId=r.history_id;
   const plural=r.record_count===1?'record':'records',span=el('strong',r.id+' · '+r.record_count+' '+plural);row.append(span,el('p',r.label));
   row.append(el('p',r.last_recorded_through_cutoff?'Last recorded: '+r.last_recorded_through_cutoff+' · '+r.calendar_days_since_record+' calendar days before cutoff':'No wear recorded through '+result.as_of+'. This does not mean never worn.','fx-caption'));
   if(r.category==='shirts'||r.category==='pants')row.append(el('p',r.scope,'fx-caption'));list.append(row);
  }
 }
 function calculate(){
  result=null;totals.replaceChildren();list.replaceChildren();count.textContent='';
  try{
   result=usage.build(snapshot,{asOf:cutoff.value,window:range.input.value});const s=result.summary;
   totals.append(el('p',(result.from?result.from+' to '+result.as_of:'Through '+result.as_of)+' · ledger revision '+result.ledger_revision,'fx-caption'));
   const grid=el('div',undefined,'fx-stat-grid');
   for(const [title,n,sub]of [['Confirmed records',s.records,'Entries, not distinct days'],['Recorded days',s.recorded_days,'Distinct dates with a record']]){const card=el('div',undefined,'fx-card');card.append(el('small',title),el('strong',String(n),'fx-stat-number'),el('small',sub));grid.append(card);}totals.append(grid);
   totals.append(el('p',s.exact_outfits+' exact outfits · '+s.suit_records+' suit / '+s.blazer_records+' blazer / '+s.shirt_only_records+' shirt-only records.','fx-caption'));
   totals.append(el('p',s.manual_records+' manual / '+s.engine_records+' Engine-origin records · '+s.tied_records+' tied / '+s.no_tie_records+' No Tie.','fx-caption'));
   if(s.recorded_repeat_flags)totals.append(el('p',s.recorded_repeat_flags+' records marked as controlled repetition. These are saved flags, not newly inferred incidents.','fx-caption'));
   if(s.future_excluded||s.older_excluded)totals.append(el('p','Excluded from this range: '+s.future_excluded+' records after cutoff; '+s.older_excluded+' earlier records. No records were removed.','fx-caption'));
   if(!s.records)totals.append(el('p',s.ledger_records?'No confirmed records in this range. Change the range or cutoff to inspect existing records.':'No confirmed wear logged in this browser. No usage is inferred from Favorites or outfit views.','fx-caption'));
   $('fx-sheet-error').textContent='';drawRows();
  }catch(e){sheetError(e);}
 }
 for(const input of [range.input,cutoff])input.onchange=calculate;
 for(const input of [category.input,sort.input,recorded])input.onchange=drawRows;search.oninput=drawRows;
 const details=el('details'),summary=el('summary','Existing Engine rotation report');details.id='insights-engine-report';
 details.append(summary,el('p','Preserved output from the current generation, when available. The usage counts above do not recompute it or add ranking policies.','fx-caption'),el('pre',JSON.stringify(report?.rotation||{status:'unavailable',reason:'No current computed rotation report'},null,2)));body.append(details);
 body.append(el('p','Read-only snapshot. Last-recorded dates use all confirmed dates through cutoff; counts use the chosen range. Separate trousers are counted only when their physical ID was logged. No scores, cooldown decisions or automatic device sync are added.','fx-caption'));
 actions.append(button('Close',()=>dismissSheet()));calculate();
}

function resetPreferences(){const{body,actions}=openSheet('Reset preferences');body.append(el('p','Clear all six Home preferences? Your current outfit and wear history will remain unchanged.','fx-caption'));actions.append(button('Cancel',()=>dismissSheet()),button('Confirm reset',()=>{ui.reset();producing=null;dismissSheet(false);updateHome();setMode('engine');status('All six preferences are unlocked. Generate Options lets HEWRS choose the complete outfit.');}));}
// One modal owner, one router and one logging transaction for both buttons.
$('fx-sheet-close').onclick=()=>dismissSheet();$('fx-sheet').addEventListener('cancel',e=>{e.preventDefault();dismissSheet();});$('fx-sheet').addEventListener('click',e=>{if(e.target!==$('fx-sheet'))return;const r=$('fx-sheet').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismissSheet();});
for(const n of document.querySelectorAll('[data-page]'))n.onclick=()=>showPage(n.dataset.page);$('back-home').onclick=()=>showPage('home');for(const n of document.querySelectorAll('[data-picker]'))n.onclick=()=>openPicker(n.dataset.picker);
$('mode-engine').onclick=()=>{setMode('engine');status('Engine Choice. Existing preferences are kept; Reset clears them explicitly.');};$('mode-anchor').onclick=()=>{setMode('anchor');status(ui.lockCount()?'Anchor Choice. Exact pieces or category preferences remain selected.':'Choose at least one preference; switching modes does not select an item.');};
$('large-view').onclick=largerOutfit;
$('cancel-work').onclick=cancel;$('reset-preferences').onclick=resetPreferences;$('work-button').onclick=()=>contextSheet('work');$('style-button').onclick=()=>contextSheet('style');$('weather-button').onclick=()=>contextSheet('weather');$('season-button').onclick=()=>contextSheet('season');$('generate-options').onclick=submit;
$('view-current').onclick=()=>{if(current){presentFrame();displayCurrent();showPage('outfits');}};$('prev-option').onclick=()=>selectOption(optionIndex-1).catch(e=>status(e.message,true));$('next-option').onclick=()=>selectOption(optionIndex+1).catch(e=>status(e.message,true));$('open-results').onclick=resultSheet;
$('full-view').onclick=()=>{$('stage').classList.remove('detail');$('full-view').setAttribute('aria-pressed','true');$('detail-view').setAttribute('aria-pressed','false');};$('detail-view').onclick=()=>{$('stage').classList.add('detail');$('full-view').setAttribute('aria-pressed','false');$('detail-view').setAttribute('aria-pressed','true');};
$('details-button').onclick=details;$('score-button').onclick=scoreDetails;$('record-wear').onclick=startLog;$('quick-log').onclick=startLog;
$('regenerate').onclick=async()=>{if(busy||!producing)return;const p=copy(producing);ui.replace(p.prefs);ctx=copy(p.context);setMode(p.mode);updateHome();try{if(p.kind==='engine'){await refreshAutomaticWeather('regenerate');const op=ui.operation(p.mode,{...ctx,environment:weather.request(ctx.localDate)});await generate(op.config,{prefs:op.prefs});}else{await apply(p.selection,{origin:'manual',keepPreferences:true});showPage('outfits');}}catch(e){status(e.message,true);}};
$('data-button').onclick=backup;$('open-log').onclick=logSheet;$('clear-log').onclick=confirmClear;$('favorites-button').onclick=()=>showFavorites();$('insights-button').onclick=showInsights;
window.addEventListener('storage',e=>{if(e.key===store.key){generation++;renderer.cancel();setBusy(false);invalidateRecommendations('Wear data changed in another tab. Generate again to use the current history.');try{store.readForGeneration();}catch(err){status(err.message,true);}refreshHistory();}});
root.HEWRSApp=Object.freeze({version:'HEWRS_CONNECTED_APP_V1_21_0',connection,visualStylist,stylistSheet,renderForStylist,store,favorites,usage,weather,autoWeather,refreshAutomaticWeather,weatherSheet,renderer,ui,apply,generate,cancel,showPage,setMode,openPicker,submit,resolveUrl,state:()=>({selection:copy(current),origin,mode,report:copy(report),request:copy(lastRequest),optionCount:options.length,optionIndex,page:pageName,score:copy(score),sourceLock:root.HEWRS_INPUT_SHA256,preferences:ui.snapshot(),context:copy(ctx),busy})});
const saved=store.snapshot().session;if(saved){setMode(saved.mode);ctx={occasion:saved.context.occasion,formality:saved.context.requiredFormality,style:'AUTO',localDate:saved.localDate};}if(saved?.mode==='anchor')ui.fromSelection(saved.selection);else ui.reset();setMode(mode);updateHome();renderGroups();refreshHistory();for(const b of document.querySelectorAll('[data-runtime]'))if(b.dataset.choice!=='included')b.disabled=false;
apply(saved?.selection||defaultSelection,{origin:'manual',context:saved?.context||currentContext(),localDate:saved?.localDate||ctx.localDate,save:false,keepPreferences:true}).then(()=>{root.HEWRS_READY=true;setBusy(false);updateHome();status(saved?'Saved outfit restored. Engine chooses unlocked categories; Reset explicitly clears old anchors.':'Engine Choice: all categories are unlocked. Set Weather / location or generate without weather.');showPage('home');refreshAutomaticWeather('startup').catch(e=>status(e.message,true));}).catch(e=>{root.HEWRS_LOAD_ERROR=e.message;status('Initial view failed: '+e.message,true);setBusy(false);});

// Foreground-only refresh. No service worker, polling while hidden, or wear writes.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')autoWeather.cancel();else refreshAutomaticWeather('resume').catch(e=>status(e.message,true));});
root.addEventListener('pageshow',()=>refreshAutomaticWeather('pageshow').catch(e=>status(e.message,true)));
root.addEventListener('pagehide',()=>{autoWeather.cancel();visualStylist.disconnect();});
setInterval(()=>{if(document.visibilityState==='visible')refreshAutomaticWeather('interval').catch(e=>status(e.message,true));},60000);
})(globalThis);
