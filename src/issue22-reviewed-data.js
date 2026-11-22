/* V3-only reviewed/discovery source transition. This derives in-memory current
 * records, never changes saved history, and never turns an old image judgment
 * into approval of a changed garment. Legacy packets are validated against
 * their exact historical catalogue before any unchanged outfit is rebound. */
(function(root){'use strict';
const patch=root.HEWRS_ISSUE22_REVIEWED_OVERLAY,clone=x=>structuredClone(x),need=(v,m)=>{if(!v)throw Error(m);};
need(patch?.schema==='hewrs.issue22.reviewed-overlay.v1'&&root.HEWRSIssue22Matching,'Missing Issue 22 reviewed sources.');
const changed=new Set(patch.scope),history=new Map();let historicalData=null;
const json=JSON.stringify,affected=o=>Object.values(o||{}).some(id=>changed.has(id));
const historicalIdentity=e=>json([e.id,e.outfit,e.review,e.issue22_history]);
async function hash(value){need(root.crypto?.subtle,'Secure hashing is required for reviewed source validation.');return [...new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(json(value))))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function isHistoricalEntry(entry){return !!entry?.issue22_history&&history.get(entry.id)===historicalIdentity(entry);}
function rebindUnchanged(entry){
 need(!affected(entry.outfit),'A changed outfit cannot inherit a current visual review.');
 const e=clone(entry);e.review.catalogue_fingerprint=patch.catalogue_fingerprint;
 e.issue22_source_rebind={revision:patch.revision,historical_catalogue_fingerprint:patch.baseline_catalogue_fingerprint,garment_fingerprints_unchanged:true,new_review:false};
 return e;
}
async function reviewData(input){
 need(await hash(input)===patch.review_data_sha256,'Historical review source changed; Issue 22 overlay refused.');
 historicalData=clone(input);const data=clone(input);
 data.catalogue={...data.catalogue,revision:patch.revision,parent_fingerprint:patch.baseline_catalogue_fingerprint,fingerprint:patch.catalogue_fingerprint,records:data.catalogue.records.map(r=>clone(patch.records[r.id]||r))};
 data.rules={...data.rules,catalogue_fingerprint:patch.catalogue_fingerprint};
 data.reviews={...data.reviews,catalogue_fingerprint:patch.catalogue_fingerprint,entries:data.reviews.entries.map(entry=>{
  if(!affected(entry.outfit))return rebindUnchanged(entry);
  const e={...entry,issue22_history:{status:'source_changed_requires_review',revision:patch.revision,affected_ids:Object.values(entry.outfit).filter(id=>changed.has(id)),historical_review_unchanged:true}};
  history.set(e.id,historicalIdentity(e));
  if(data.comparison_r3[e.id])data.comparison_r3[e.id]={status:'historical_source_changed',margin:null,historical:clone(data.comparison_r3[e.id])};
  return e;
 })};
 data.issue22={revision:patch.revision,historical_reviews:patch.historical_review_ids,source_files_unchanged:true,owner_approvals_added:0};
 installAssessment();return data;
}
async function discoveryFeatures(input){
 need(await hash(input)===patch.discovery_features_sha256,'Historical discovery source changed; Issue 22 overlay refused.');
 return {...clone(input),catalogue_fingerprint:patch.catalogue_fingerprint,revision:patch.revision,records:input.records.map(r=>clone(patch.features[r.id]||r))};
}
function tieGuard(outfit,request={}){return root.HEWRSIssue22Matching.tieRuleCheck(outfit,{context:request});}
function excluded(outfit,rule){return {outfit:clone(outfit),hard_constraints:{status:'excluded',reasons:rule.reasons.map(r=>r.id)},reviewable:false,recommendable:false,selection_score:null};}
function installCore(){
 const previous=root.HEWRSRebuildCore;need(previous?.create,'Reviewed core is unavailable.');if(previous.issue22_revision===patch.revision)return;
 function create(catalogue){
  const base=previous.create(catalogue);if(catalogue.fingerprint!==patch.catalogue_fingerprint)return base;
  function assess(o,q={},review,owner){const rule=tieGuard(o,q);return rule.allowed?base.assess(o,q,review,owner):excluded(o,rule);}
  function* enumerateClothing(q={}){for(const o of base.enumerateClothing(q))if(tieGuard(o,q).allowed)yield o;}
  function* enumerateFull(q={}){for(const o of base.enumerateFull(q))if(tieGuard(o,q).allowed)yield o;}
  function selectReviewed(entries,q={},owner={}){
   const original=base.selectReviewed(entries,q,owner),allowed=entries.filter(e=>tieGuard(e.outfit,q).allowed);
   if(allowed.length===entries.length)return original;
   const out=base.selectReviewed(allowed,q,owner);out.not_qualified.push(...entries.filter(e=>!tieGuard(e.outfit,q).allowed).map(e=>assess(e.outfit,q,e.review,owner)));return out;
  }
  return Object.freeze({...base,assess,enumerateClothing,enumerateFull,selectReviewed});
 }
 root.HEWRSRebuildCore=Object.freeze({...previous,create,issue22_revision:patch.revision});
}
function installSelector(){
 const previous=root.HEWRSReviewedSelector;need(previous?.create,'Reviewed selector is unavailable.');if(previous.issue22_revision===patch.revision)return;
 function create(catalogue,reviews,rules){
  if(catalogue.fingerprint!==patch.catalogue_fingerprint)return previous.create(catalogue,reviews,rules);
  const entries=clone(reviews.entries),ids=new Set(),keys=new Map();
  for(const entry of entries){
   const key=root.HEWRSRebuildCore.outfitKey(entry.outfit);need(!ids.has(entry.id)&&!keys.has(key),'Duplicate reviewed identity.');ids.add(entry.id);keys.set(key,entry);
   if(entry.issue22_history)need(isHistoricalEntry(entry),'Unverified historical review cannot bypass source validation.');
  }
  const current=entries.filter(e=>!isHistoricalEntry(e)),base=previous.create(catalogue,{...reviews,entries:current},rules),core=root.HEWRSRebuildCore.create(catalogue);
  function inspect(outfit,q={},additional={}){
   const normal=base.inspect(outfit,q,additional);if(normal.hard_constraints.status!=='pass')return normal;
   const entry=keys.get(root.HEWRSRebuildCore.outfitKey(outfit));return isHistoricalEntry(entry)?core.assess(outfit,q,entry.review):normal;
  }
  function select(q={},additional={}){const out=base.select(q,additional);out.not_qualified.push(...entries.filter(isHistoricalEntry).map(e=>inspect(e.outfit,q,additional)));return out;}
  return Object.freeze({...base,select,inspect,entries:()=>clone(entries),getReview:id=>clone(entries.find(e=>e.id===id)||null),scope:base.scope+' Changed Issue 22 garment judgments remain historical and cannot qualify.'});
 }
 root.HEWRSReviewedSelector=Object.freeze({...previous,create,issue22_revision:patch.revision});
}
function installAssessment(){
 const previous=root.HEWRSImageAssessment;if(!previous?.create||previous.issue22_revision===patch.revision)return;
 function create(options){
  if(options.catalogue?.fingerprint!==patch.catalogue_fingerprint)return previous.create(options);
  need(historicalData,'Historical assessment validation requires the pinned source catalogue.');
  const current=previous.create({...options,assetPaths:{...options.assetPaths,...patch.assetPaths}}),legacy=previous.create({catalogue:historicalData.catalogue,ownerConstraints:historicalData.rules,baseReviews:historicalData.reviews,assetPaths:options.assetPaths});
  async function verifyRequest(packet){
   if(packet?.request?.catalogue_fingerprint!==patch.baseline_catalogue_fingerprint)return current.verifyRequest(packet);
   const r=await legacy.verifyRequest(packet);need(!affected(r.outfit),'The garment appearance changed; prepare a new request from current images.');return r;
  }
  async function verify(bundle,options={}){
   if(!bundle?.cases?.some(c=>c?.packet?.request?.catalogue_fingerprint===patch.baseline_catalogue_fingerprint))return current.verify(bundle,options);
   need(bundle.cases.every(c=>c?.packet?.request?.catalogue_fingerprint===patch.baseline_catalogue_fingerprint),'Mixed historical/current source bundles are not supported.');
   const checked=await legacy.verify(bundle,options),entries=[],historical_entries=[];
   for(const entry of checked.entries){if(affected(entry.outfit))historical_entries.push(clone(entry));else entries.push(rebindUnchanged(entry));}
   return {...checked,entries,images:Object.fromEntries(entries.map(e=>[e.id,checked.images[e.id]])),historical_entries,issue22:{historical_source_verified:true,unchanged_outfits_rebound:entries.length,changed_outfits_withheld:historical_entries.length,stored_bundle_modified:false}};
  }
  return Object.freeze({...current,verify,verifyRequest});
 }
 root.HEWRSImageAssessment=Object.freeze({...previous,create,issue22_revision:patch.revision});
}
function installedModule(url){const name=url.split('?',1)[0];if(name.endsWith('/rebuild-core.js'))installCore();if(name.endsWith('/reviewed-selector.js'))installSelector();}
function label(entry){return isHistoricalEntry(entry)?'Appearance changed · historical review requires reassessment':null;}
root.HEWRSIssue22Reviewed=Object.freeze({revision:patch.revision,reviewData,discoveryFeatures,installCore,installSelector,installAssessment,installedModule,isHistoricalEntry,label});
installCore();
})(globalThis);
