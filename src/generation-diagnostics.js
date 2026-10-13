/* V1.24.3: explain an empty verified search, never change ranking or relax locks.
 * Style alternatives are search directions, not preapproved complete outfits.
 * Diagnostic export omits stored votes, wear/Favorites, credentials and location. */
(function(root){'use strict';
const styleNames={AUTO:'Automatic',CLASSIC:'Classic',HYBRID:'Hybrid',MODERN:'Modern'};
function anchorName(c,q){const id=q?.prefs?.topwear?.mode==='item'?q.prefs.topwear.id:null;if(!id)return null;
 for(const s of c.suitSources.ids)if(c.aliases.get(s)===id)return s;
 for(const b of c.blazerConnection.availableIds)if(c.blazerConnection.knownBlazer(b).historyId===id)return b;
 return id;
}
function describe(c,q,d,profiles=[]){
 const anchor=anchorName(c,q),label=styleNames[q.executiveStyle]||q.executiveStyle,rr=d.rejection_reasons||{},checked=d.domain_evaluated||0;
 let code='NO_ELIGIBLE_OUTFIT',title='No matching outfits',message='No complete outfit passed the current selections and eligibility rules.',detail='',alternativeStyles=[];
 if(q.prefs.tie.mode==='none'&&q.context.requiredFormality==='tie_required'){
  code='TIE_REQUIREMENT_CONFLICT';title='Two selections conflict';message='No Tie is selected, but the occasion requires a tie. Change one of those selections; neither has been changed automatically.';
 }else if(anchor?.startsWith('B')&&q.context.requiredFormality==='suit_required'){
  code='SUIT_REQUIREMENT_CONFLICT';title='Two selections conflict';message=anchor+' is a blazer, but Suit required is selected. Keep the blazer and change required formality, or choose a suit.';
 }else if(d.unbound_trouser_ids?.length){code='TROUSER_PROFILE_UNAVAILABLE';message='The selected trousers have no connected numerical profile. Their identity is retained; no replacement was selected.';
 }else if(!d.numeric_candidates){code='SOURCE_ELIGIBILITY';message='No source-eligible scored clothing matches these selections. Existing source holds and unsupported combinations have not been overridden.';
 }else if(checked>0&&rr.STYLE_LOCK===checked){
  code='STYLE_UNAVAILABLE';title='No '+label+' match'+(anchor?' for '+anchor:'');message='The search completed, but no outfit met the current '+label+' classification with these selections. This is not an image-loading error.';
  alternativeStyles=['HYBRID','CLASSIC','MODERN'].filter(s=>s!==q.executiveStyle&&profiles.some(p=>p.classification===s));
  const max=profiles.length?Math.max(...profiles.map(p=>p.modern_intervention_count||0)):null;
  if(q.executiveStyle==='MODERN'&&max!==null&&max<3&&profiles.every(p=>p.classic_foundation===true))detail='The checked clothing and footwear provide at most '+max+' qualifying modern elements. The current Modern rule requires three, or a recorded nonclassic foundation. Watches do not count; removing the No Tie limit does not change that rule.';
  else if(q.executiveStyle==='CLASSIC'&&profiles.length&&profiles.every(p=>p.modern_intervention_count>0||p.classic_foundation===false))detail='Every checked combination has a nonclassic foundation or a qualifying modern clothing/footwear element, so none passes the current strict Classic filter.';
 }else if(rr.WEATHER){code='WEATHER_EXCLUSION';title='No match for these conditions';message='Current weather excludes the checked clothing/footwear combinations that passed style. The weather setting and exact selections have been kept.';detail=Object.keys(rr).filter(k=>k.startsWith('WEATHER: ')).map(k=>k.slice(9)).slice(0,3).join('; ');
 }else if(rr.SHOE_LOCK_OR_SUITABILITY||rr.WATCH_OR_STYLE_LOCK){code='ACCESSORY_ELIGIBILITY';message='The checked clothing could not be completed with accessories that pass the current selections and eligibility rules.';}
 return {schema:'hewrs.generation-outcome.v1_24_3',kind:'no_match',code,title,message,detail,anchor,requested_style:q.executiveStyle,source_eligible_clothing:d.numeric_candidates||0,complete_candidates_checked:checked,alternative_styles:alternativeStyles,alternatives_require_new_search:true,locks_automatically_changed:false};
}
function safeError(value){if(!value)return null;const text=String(value);if(/feedback unavailable|Invalid preference|JSON|Unexpected token|Unexpected end|local state|stored|storage/i.test(text))return 'Stored data or JSON validation failed. Original records were retained; raw data is omitted from this diagnostic.';return text;}
function snapshot({version,context,preferences,method,request,report,error}){
 const environment=request?.environment;
 return {schema:'hewrs.redacted-generation-diagnostic.v1_24_3',app_version:version,created_at:new Date().toISOString(),context,preferences,method,requested_style:request?.executiveStyle||context?.style||null,source_revision:request?.current_source_revision||null,status:report?.status||'not_generated',no_match:report?.no_match||null,error:safeError(error),returned_options:report?.options?.length||0,counts:report?.diagnostics?{enumerated:report.diagnostics.enumerated,numeric_candidates:report.diagnostics.numeric_candidates,domain_evaluated:report.diagnostics.domain_evaluated,rejection_reasons:report.diagnostics.rejection_reasons}:null,weather:environment?{source:environment.source,date:environment.date,temperatureBand:environment.temperatureBand,precipitation:environment.precipitation}:null,privacy:'No saved responses, learned coefficients, wear events, Favorites, credentials, coordinates, place names or account data included.'};
}
root.HEWRSGenerationDiagnostics=Object.freeze({describe,snapshot,anchorName,version:'1.24.3'});
})(globalThis);
