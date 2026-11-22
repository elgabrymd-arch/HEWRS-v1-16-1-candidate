'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {load,memoryStorage,root}=require('./issue22-loader.cjs');
const read=file=>JSON.parse(fs.readFileSync(root+'/'+file,'utf8')),plain=value=>JSON.parse(JSON.stringify(value));
async function main(){
 const storage=memoryStorage(),{g,connection:c,run}=load({index:false,storage});
 Object.assign(g,{TextEncoder,atob,btoa});
 const realm=value=>vm.runInContext('('+JSON.stringify(value)+')',g),baseline=read('feedback-candidate/reviewed/review-data.json'),oldSemantic=read('feedback-candidate/reviewed/discovery-features.json'),patch=read('data/issue22-reviewed-overlay.json');
 const inputBytes=JSON.stringify(baseline),semanticBytes=JSON.stringify(oldSemantic),changed=new Set(patch.scope);
 run('feedback-candidate/reviewed/rebuild-core.js');
 run('data/issue22-reviewed-overlay.js');run('src/issue22-reviewed-data.js');
 run('feedback-candidate/reviewed/image-assessment.js');
 const derived=await g.HEWRSIssue22Reviewed.reviewData(realm(baseline)),semantic=await g.HEWRSIssue22Reviewed.discoveryFeatures(realm(oldSemantic));
 run('feedback-candidate/reviewed/reviewed-selector.js');g.HEWRSIssue22Reviewed.installSelector();
 run('feedback-candidate/reviewed/native-reviewed-bridge.js');run('hewrs-stage93-ranking-v2.js');run('hewrs-batch10-discovery-16eeb4d0b24f21a9.js');
 A.equal(JSON.stringify(baseline),inputBytes);A.equal(JSON.stringify(oldSemantic),semanticBytes);
 A.notEqual(derived.catalogue.fingerprint,baseline.catalogue.fingerprint);
 let preservedRecords=0,staleReviews=0,preservedReviews=0;
 for(const old of baseline.catalogue.records){
  const current=derived.catalogue.records.find(r=>r.id===old.id),sf=semantic.records.find(r=>r.id===old.id);
  A.equal(current.source_fingerprint,sf.source_fingerprint);
  if(!changed.has(old.id)){A.deepEqual(plain(current),old);A.deepEqual(plain(sf),oldSemantic.records.find(r=>r.id===old.id));preservedRecords++;}
  else{A.notEqual(current.source_fingerprint,old.source_fingerprint);A.equal(current.source.feature.issue22_revision,patch.revision);A.deepEqual(plain(current.source.historical_binding),old.source.binding);A.deepEqual(plain(current.visual_dna.observed.construction),old.visual_dna.observed.construction);}
 }
 const core=g.HEWRSRebuildCore.create(derived.catalogue),bridge=g.HEWRSNativeReviewedBridge.create(c,derived.catalogue,derived.reviews,derived.rules);
 for(const entry of derived.reviews.entries){
  const old=baseline.reviews.entries.find(e=>e.id===entry.id),a=bridge.inspect(entry.outfit);
  if(changed.has(entry.outfit.topwear)){
   A.deepEqual(plain(entry.review),old.review,'Historical review bytes preserved '+entry.id);
   A.equal(g.HEWRSIssue22Reviewed.isHistoricalEntry(entry),true);A.equal(a.recommendable,false);staleReviews++;
   A.equal(g.HEWRSIssue22Reviewed.isHistoricalEntry({...entry,owner_feedback:null}),true,'Diagnostic ranking metadata preserves historical label');
   if(a.hard_constraints.status==='pass')A.ok(a.review.validation_issues.some(x=>x==='STALE_REVIEW_CATALOGUE'));
   A.match(g.HEWRSIssue22Reviewed.label(entry),/historical review requires reassessment/);
  }else{
   const compare=plain(entry.review);compare.catalogue_fingerprint=baseline.catalogue.fingerprint;A.deepEqual(compare,old.review);A.deepEqual(plain(a.review.validation_issues),[]);preservedReviews++;
  }
 }
 A.equal(bridge.entries().length,129);A.equal(staleReviews,21);A.equal(preservedReviews,108);
 const forged=plain(derived.reviews);forged.entries.find(e=>e.issue22_history).review.reason='Unverified changed review';
 A.throws(()=>g.HEWRSReviewedSelector.create(derived.catalogue,realm(forged),derived.rules),/Unverified historical review/);
 await A.rejects(()=>g.HEWRSIssue22Reviewed.reviewData(realm({...baseline,source_input_sha256:'tampered'})),/Historical review source changed/);
 await A.rejects(()=>g.HEWRSIssue22Reviewed.discoveryFeatures(realm({...oldSemantic,revision:'tampered'})),/Historical discovery source changed/);
 const styles=['AUTO','CLASSIC','HYBRID','MODERN'],occasions=['work','dinner','weekend'],feedback=g.HEWRSOutfitFeedback.create({storage});
 const ranker=g.HEWRSPersonalizedRanking.create({catalogue:derived.catalogue,bridge,feedback,numerical:derived.comparison_r3});
 const discovery=g.HEWRSWardrobeDiscovery.create({catalogue:derived.catalogue,semanticIndex:semantic,bridge,feedback,ownerConstraints:derived.rules});
 let policyCases=0,discoveryCases=0,rankCases=0;
 for(const style of styles)for(const occasion of occasions){
  const q={style,occasion,mode:'all',formality:'any',anchors:{}};
  const r=ranker.rank(realm(q),null);A.ok(r.visual.every(e=>!changed.has(e.outfit.topwear)));rankCases++;
  for(const id of ['B01','B06','B10']){
   const outfit={topwear:id,pants:'PT006',shirt:'DS001',tie:'T022',shoe:'shoe-11'};
   const a=core.assess(realm(outfit),realm(q),null);A.equal(a.hard_constraints.status,'excluded');A.ok(a.hard_constraints.reasons.includes('OWNER-'+id+'-NO-TIE'));policyCases++;
   const exact={...q,anchors:outfit};A.equal([...core.enumerateFull(realm(exact))].length,0);
   if(id==='B01')continue;
   const noTie={...q,anchors:{topwear:id,pants:'PG001',shirt:'DS001',tie:null,shoe:'shoe-11'}};
   const open=await discovery.search(realm(noTie),null,{poolLimit:60});
   A.ok(open.all_possibilities.every(e=>e.outfit.topwear===id&&e.outfit.tie===null));
   const blocked=await discovery.search(realm(exact),null,{poolLimit:60});A.equal(blocked.all_possibilities.length,0);discoveryCases+=2;
  }
 }
 // Known historical judgments stay known to exploration; a changed old verdict
 // cannot be presented as a fresh unreviewed combination to escape its history.
 const oldSuit=derived.reviews.entries.find(e=>e.outfit.topwear==='S06');
 const historicalSearch=await discovery.search(realm({style:'AUTO',occasion:'work',anchors:Object.fromEntries(Object.entries(oldSuit.outfit).filter(([role,id])=>role!=='pants'||id!==null))}),null,{poolLimit:60});
 A.equal(historicalSearch.all_possibilities.length,0);A.ok(historicalSearch.known_reviews_encountered.includes(oldSuit.id));
 // Old source-bound bundles stay byte exact. Validate all 12 packets against
 // the historical catalogue, keep 10 unrelated assessments, withhold two S06.
 const bundle=read('feedback-candidate/reviewed/completed-image-assessments.json'),bundleBytes=JSON.stringify(bundle),assetPaths=read('feedback-candidate/reviewed/assessment-asset-paths.json');
 const exchange=g.HEWRSImageAssessment.create({catalogue:derived.catalogue,ownerConstraints:derived.rules,baseReviews:derived.reviews,assetPaths:realm(assetPaths)});
 const checked=await exchange.verify(realm(bundle));
 A.equal(checked.entries.length,10);A.equal(checked.historical_entries.length,2);A.equal(JSON.stringify(bundle),bundleBytes);
 A.equal(checked.bundle_sha256,crypto.createHash('sha256').update(g.HEWRSImageAssessment.canonical(realm(bundle))).digest('hex'));
 for(const entry of checked.entries){A.equal(changed.has(entry.outfit.topwear),false);A.deepEqual(plain(core.assess(entry.outfit,{},entry.review).review.validation_issues),[]);}
 await A.rejects(()=>exchange.verifyRequest(realm(bundle.cases[0].packet)),/garment appearance changed/);
 const altered=structuredClone(bundle);altered.cases[0].result.reason='Tampered unbound result';altered.cases[0].packet.request.outfit.shirt='DS001';
 await A.rejects(()=>exchange.verify(realm(altered)),/altered|mismatch/i);
 // New assessment requests use material-corrected components and current DNA.
 const materials=read('data/issue22-materials.json');let correctedImagePaths=0;
 for(const id of patch.scope){
  const outfit=id.startsWith('S')?{topwear:id,pants:null,shirt:'DS001',tie:'T022',shoe:'shoe-11'}:{topwear:id,pants:'PT006',shirt:'DS001',tie:null,shoe:'shoe-11'};
  const refs=exchange.sourceImages(realm(outfit));
  for(const ref of refs.filter(r=>r.id===id)){
   const layer=ref.component==='suit_trousers'?'trousers':'jacket',binding=Object.values(materials.bindings).find(b=>b.garment_id===id&&b.layer===layer);
   A.equal(ref.sha256,binding.display_sha256);A.equal(ref.repository_path,binding.display_url);correctedImagePaths++;
  }
 }
 A.equal(correctedImagePaths,9);
 const fresh={topwear:'S14',pants:null,shirt:'DS001',tie:'T022',shoe:'shoe-11'};
 A.ok(!derived.reviews.entries.some(e=>JSON.stringify(e.outfit)===JSON.stringify(fresh)),'Fresh test request must be new');
 const packet=await exchange.request({outfit:realm(fresh),target:realm({style:'AUTO',occasion:'dinner'}),watchId:null,source_images:exchange.sourceImages(realm(fresh)),board:{width:1000,height:600,data_url:'data:image/png;base64,aGV3cnM='},created_at:'2026-11-22T00:00:00.000Z'});
 A.equal(packet.request.catalogue_fingerprint,derived.catalogue.fingerprint);A.equal((await exchange.verifyRequest(packet)).outfit.topwear,'S14');
 A.equal(storage.length,0,'No saved records or approvals are written by source migration');
 console.log('ISSUE22_REVIEWED='+JSON.stringify({passed:true,preservedRecords,preservedReviews,staleReviews,policyCases,discoveryCases,rankCases,unchangedBundledAssessments:checked.entries.length,historicalBundledAssessments:checked.historical_entries.length,correctedImagePaths,currentRequestVerified:true,storageWrites:0}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
