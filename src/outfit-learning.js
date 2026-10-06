/* Explicit local A/B preference + separate Both/Neither acceptability.
 * No inferred votes, causes, individual-item approval, network or wear reads. */
(function(root){'use strict';
const KEY='hewrs:outfit-preferences:v1',SCHEMA='hewrs.outfit-preferences.v1',REV='hewrs.dual-outfit-learning.v1_24_0';
const MAX=2000,MAX_BYTES=2500000,copy=x=>structuredClone(x),clip=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),t=x=>String(x||'').toLowerCase();
const FEATURES=['tie_visual_prominence','competing_focal_elements','palette_saturation','layer_value_distance','light_tie_readability','open_collar','palette_coherence','shirt_depth','tie_pattern_contrast','shoe_formality','shoe_trouser_grounding','shoe_decoration'];
const REASONS=['no_reason','tie_dominant','palette_disconnected','patterns_compete','shoe_choice','layers_not_distinct','other'];
function need(v,s){if(!v)throw Error(s);}
function exact(v,ks){return v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));}
function key(s){return JSON.stringify([s.suitId||s.blazerId||'SHIRT_ONLY',s.pantId||null,s.shirtId,s.state,s.shoeId,s.watchId]);}
function pairKey(a,b){return [key(a),key(b)].sort().join('::');}
function top(s){return s.suitId||s.blazerId||'SHIRT_ONLY';}
function fingerprint(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);}
function vector(o,sh){const ps=o.profiles,parts=[ps.topwear,ps.shirt,ps.tie,ps.pants].filter(Boolean),prom=[...(o.prominence||[])].sort((a,b)=>b-a),tie=ps.tie;
 const v=parts.map(x=>x.primary.value).filter(Number.isFinite),sats=parts.map(x=>x.primary.saturation||0),tp=tie?clip((tie.pattern.contrast||0)/4)*.60+clip(tie.primary.saturation||0)*.40:0;
 return [tp,clip(prom[1]||0),sats.reduce((a,b)=>a+b,0)/Math.max(1,sats.length),v.length>1?clip((Math.max(...v)-Math.min(...v))/5):0,tie&&/pale_tonal|lighter_tie/.test(o.value_route||'')?clip(o.components.value_structure/10):0,tie?0:1,clip(o.components.palette/10),clip((ps.shirt.primary.value??2.5)/5),tie?clip((tie.pattern.contrast||0)/5):0,clip((sh.formality??8)/10),clip((sh.grounding??8)/10),clip(1-(sh.restraint??9)/10)].map(x=>Number(x.toFixed(7)));
}

// These are independent evidence channels. The original A/B activation guard is
// NOT relaxed. Both/neither label complete outfits only, not isolated garments.
const ACCEPT_LIMITS=Object.freeze({unique_outfits:8,positive:3,negative:3,groups:3,groups_per_label:2});
function acceptanceEmpty(){return {active:false,weights:FEATURES.map(()=>0),intercept:0,bound:.20,counts:{comparisons:0,label_occurrences:0,unique_outfits:0,positive:0,negative:0,groups:0,positive_groups:0,negative_groups:0,conflicting_outfits:0},thresholds:{...ACCEPT_LIMITS},reason:'No usable Both work / Neither works evidence.',method:'Balanced logistic complete-outfit acceptability; centered semantic features; L2',validation:{unique_outfits:0,positive:0,negative:0,correct:0,incorrect:0,uncertain:0,conflicting_outfits:0,scope:'Reserved records are not fitted. Diagnostic sign agreement, not calibrated accuracy or approval.'}};}
function empty(reason='No explicit comparisons saved'){return {revision:REV,id:'untrained',active:false,relative_active:false,enabled:true,counts:{directional:0,informative:0,topwear_groups:0,neutral:0,validation:0,excluded:0,duplicate_pairs:0},weights:FEATURES.map(()=>0),feature_names:FEATURES.slice(),bound:.35,acceptability:acceptanceEmpty(),reason,source_revision:root.HEWRSSourceCorrections.revision};}
function sum(w,x){return w.reduce((n,v,i)=>n+v*x[i],0);}
function signals(model,x){if(!model?.enabled||!model.active)return {pairwise:0,acceptability:0,total:0};
 const pairwise=model.relative_active?.35*Math.tanh(sum(model.weights,x)):0;
 const a=model.acceptability,acceptability=a?.active?.20*Math.tanh(a.intercept+sum(a.weights,x.map(v=>v-.5))):0;
 return {pairwise,acceptability,total:clip(pairwise+acceptability,-.35,.35)};
}
function delta(model,x){return signals(model,x).total;}
function predict(model,a,b){const u=sum(model.weights,a.map((v,i)=>v-b[i]));return Math.abs(u)<.01?'tie':u>0?'A':'B';}
function acceptPrediction(a,x){const u=a.intercept+sum(a.weights,x.map(v=>v-.5));return {signal:u,classification:Math.abs(u)<.10?'uncertain':u>0?'works':'does_not_work'};}
function importance(model){if(!model?.active||!model.enabled)return FEATURES.map(()=>0);if(!model.acceptability.active)return model.weights.map(Math.abs);return FEATURES.map((_,i)=>(model.relative_active?.35*Math.abs(model.weights[i]):0)+.20*Math.abs(model.acceptability.weights[i]));}
function upperBound(model,x=null,fixed=9){if(!model?.active||!model.enabled)return 0;
 const pair=model.relative_active?.35*Math.tanh(model.weights.reduce((n,w,i)=>n+(x&&i<fixed?w*x[i]:Math.max(0,w)),0)):0;
 const a=model.acceptability,accept=a.active?.20*Math.tanh(a.intercept+a.weights.reduce((n,w,i)=>n+(x&&i<fixed?w*(x[i]-.5):.5*Math.abs(w)),0)):0;
 return clip(pair+accept,-.35,.35);
}
function contextPairKey(a,b,context){return pairKey(a,b)+'::'+JSON.stringify([root.HEWRSStyleOccasions.occasion(context?.occasion||'work'),context?.requiredFormality||'any']);}
function labelKey(s,context){return key(s)+'::'+JSON.stringify([root.HEWRSStyleOccasions.occasion(context?.occasion||'work'),context?.requiredFormality||'any']);}
function addLabel(map,s,context,description,label){const k=labelKey(s,context);if(!map.has(k))map.set(k,{vector:description.vector,labels:new Set(),group:top(s)});map.get(k).labels.add(label);}
function consistentLabels(map){const valid=[],bad=[];for(const [k,v]of map){if(v.labels.size!==1){bad.push(k);continue;}valid.push({x:v.vector.map(v=>v-.5),y:[...v.labels][0],group:v.group,key:k});}return {valid,conflicts:bad.length};}
function acceptEligible(c){return c.unique_outfits>=ACCEPT_LIMITS.unique_outfits&&c.positive>=ACCEPT_LIMITS.positive&&c.negative>=ACCEPT_LIMITS.negative&&c.groups>=ACCEPT_LIMITS.groups&&c.positive_groups>=ACCEPT_LIMITS.groups_per_label&&c.negative_groups>=ACCEPT_LIMITS.groups_per_label;}
function fit(rows,describe,{enabled=true}={}){
 const m=empty(),train=[],hold=[],tops=new Set(),labels=new Map(),heldLabels=new Map(),seenPairs=new Set();m.enabled=enabled;
 const reserved=new Set(root.HEWRS_PREFERENCE_PILOT?.validation_topwear||[]);
 for(const row of rows){try{
  const pk=pairKey(row.a,row.b);if(seenPairs.has(pk)){m.counts.duplicate_pairs++;continue;}seenPairs.add(pk);
  const a=describe(row.a,row.context),b=describe(row.b,row.context);
  if(row.a.suitId==='S02'||row.b.suitId==='S02'||!a.eligible||!b.eligible||!['A','B','both','neither'].includes(row.vote)){m.counts.excluded++;continue;}
  const validation=row.partition==='validation'||reserved.has(top(row.a))||reserved.has(top(row.b));
  if(validation){hold.push({row,a,b});m.counts.validation++;if(['both','neither'].includes(row.vote)){const y=row.vote==='both'?1:0;addLabel(heldLabels,row.a,row.context,a,y);addLabel(heldLabels,row.b,row.context,b,y);}continue;}
  if(['both','neither'].includes(row.vote)){m.counts.neutral++;m.acceptability.counts.comparisons++;m.acceptability.counts.label_occurrences+=2;const y=row.vote==='both'?1:0;addLabel(labels,row.a,row.context,a,y);addLabel(labels,row.b,row.context,b,y);continue;}
  // A/B is relative preference only: winner need not be acceptable, loser need
  // not be unacceptable. Never fabricate absolute labels from these choices.
  m.counts.directional++;const x=a.vector.map((v,i)=>v-b.vector[i]);if(Math.max(...x.map(Math.abs))<.001)continue;
  train.push({x,y:row.vote==='A'?1:0});m.counts.informative++;tops.add(top(row.a));tops.add(top(row.b));
 }catch{m.counts.excluded++;}}
 m.counts.topwear_groups=tops.size;
 // Original directional estimator is unchanged, including its original guard.
 const w=FEATURES.map(()=>0),lambda=.20;
 for(let epoch=0;epoch<240&&train.length;epoch++){
  const grad=w.map(v=>lambda*v);for(const r of train){const u=clip(sum(w,r.x),-30,30),p=1/(1+Math.exp(-u));for(let j=0;j<w.length;j++)grad[j]+=(p-r.y)*r.x[j]/train.length;}
  for(let j=0;j<w.length;j++)w[j]-=.6*grad[j];
 }
 m.weights=w.map(x=>Number(x.toFixed(8)));m.relative_active=enabled&&train.length>=8&&tops.size>=3;
 // Deduplicate identical complete-outfit labels across comparisons; do not
 // amplify a garment merely because it was shown repeatedly. Contradictory
 // labels are retained in the feedback store but excluded from this estimator.
 const a=m.acceptability,clean=consistentLabels(labels),samples=clean.valid,yes=samples.filter(x=>x.y),no=samples.filter(x=>!x.y);
 Object.assign(a.counts,{unique_outfits:samples.length,positive:yes.length,negative:no.length,groups:new Set(samples.map(x=>x.group)).size,positive_groups:new Set(yes.map(x=>x.group)).size,negative_groups:new Set(no.map(x=>x.group)).size,conflicting_outfits:clean.conflicts});
 const aw=FEATURES.map(()=>0);let intercept=0;const acceptLambda=.25;
 // Equal total weight per label: this deliberately avoids treating a selected
 // pilot's fraction of acceptable outfits as an estimated population base rate.
 for(let epoch=0;epoch<240&&yes.length&&no.length;epoch++){
  const grad=aw.map(v=>acceptLambda*v);let gb=acceptLambda*intercept;
  for(const s of samples){const p=1/(1+Math.exp(-clip(intercept+sum(aw,s.x),-30,30))),e=(p-s.y)*.5/(s.y?yes.length:no.length);gb+=e;for(let j=0;j<aw.length;j++)grad[j]+=e*s.x[j];}
  for(let j=0;j<aw.length;j++)aw[j]-=.6*grad[j];intercept-=.6*gb;
 }
 a.weights=aw.map(x=>Number(x.toFixed(8)));a.intercept=Number(intercept.toFixed(8));a.active=enabled&&acceptEligible(a.counts);
 a.regularization={lambda:acceptLambda,epochs:240,class_weight:'balanced',deduplication:'exact complete outfit and context',conflict_policy:'exclude contradictory labels; preserve raw feedback',probability_calibrated:false};
 a.reason=!enabled?'Acceptability learning paused.':a.active?'Experimental acceptability adjustment from explicit Both/Neither. No garment is banned and no cause of a vote is inferred.':'Needs 8 distinct labelled outfits across 3 training groups, at least 3 per label and 2 groups per label. No forced A/B answers.';
 m.active=enabled&&(m.relative_active||a.active);
 m.reason=!enabled?'Learning paused; baseline research rules are used.':m.relative_active&&a.active?'A/B ranking and Both/Neither acceptability are active as separate, bounded estimates.':m.relative_active?'A/B ranking is active; acceptability has insufficient balanced evidence.':a.active?'Both/Neither acceptability is active. A/B ranking remains inactive until 8 informative choices span 3 training groups.':'No learned channel is active yet. Existing responses are preserved; each channel has its own evidence requirements.';
 m.regularization={method:'pairwise logistic difference; L2',lambda,epochs:240,max_adjustment:.35,combined_bound:.35};
 m.validation={count:0,correct:0,ties:0,scope:'Reserved A/B comparisons are never fitted. Provisional diagnostic, not a taste certificate.'};
 for(const h of hold){if(!['A','B'].includes(h.row.vote))continue;const p=predict(m,h.a.vector,h.b.vector);m.validation.count++;if(p==='tie')m.validation.ties++;else if(p===h.row.vote)m.validation.correct++;}
 const held=consistentLabels(heldLabels);a.validation.conflicting_outfits=held.conflicts;
 for(const r of held.valid){const v=acceptPrediction(a,r.x.map(v=>v+.5));a.validation.unique_outfits++;a.validation[r.y?'positive':'negative']++;if(v.classification==='uncertain')a.validation.uncertain++;else if((v.classification==='works')===!!r.y)a.validation.correct++;else a.validation.incorrect++;}
 m.id=fingerprint(JSON.stringify({revision:REV,enabled,weights:m.weights,relative_active:m.relative_active,counts:m.counts,acceptability:{weights:a.weights,intercept:a.intercept,counts:a.counts,active:a.active},source:m.source_revision}));return m;
}
function validateModel(m){need(m&&m.revision===REV&&m.source_revision===root.HEWRSSourceCorrections.revision,'Preference model/source version mismatch');
 const validWeights=w=>Array.isArray(w)&&w.length===FEATURES.length&&w.every(x=>Number.isFinite(x)&&Math.abs(x)<=5);
 need(validWeights(m.weights)&&m.acceptability&&validWeights(m.acceptability.weights)&&Number.isFinite(m.acceptability.intercept)&&Math.abs(m.acceptability.intercept)<=5,'Invalid fitted coefficients');
 need(typeof m.active==='boolean'&&typeof m.relative_active==='boolean'&&typeof m.enabled==='boolean'&&typeof m.acceptability.active==='boolean'&&m.bound===.35&&m.acceptability.bound===.20,'Invalid learning limits');
 need(m.active===(m.enabled&&(m.relative_active||m.acceptability.active)),'Invalid active learning status');
 if(m.relative_active)need(m.enabled&&m.counts.informative>=8&&m.counts.topwear_groups>=3,'Insufficient A/B evidence');
 if(m.acceptability.active)need(m.enabled&&acceptEligible(m.acceptability.counts),'Insufficient Both/Neither evidence');return copy(m);
}

function create(connection,sourceLock,backend){let raw=null,blocked=null,state={schema:SCHEMA,source_lock:sourceLock,revision:0,enabled:true,comparisons:[]};
 function validate(v){need(exact(v,['schema','source_lock','revision','enabled','comparisons'])&&v.schema===SCHEMA&&v.source_lock===sourceLock,'This is not a matching outfit-preference backup');need(Number.isSafeInteger(v.revision)&&v.revision>=0&&typeof v.enabled==='boolean'&&Array.isArray(v.comparisons)&&v.comparisons.length<=MAX,'Invalid preference state');
  const ids=new Set(),pairs=new Set();for(const r of v.comparisons){need(exact(r,['id','created_at','a','b','vote','reason','partition','pilot_id','context','source_revision']),'Unexpected comparison fields');need(/^pref_[A-Za-z0-9_-]{1,100}$/.test(r.id)&&!ids.has(r.id),'Invalid or duplicate preference ID');ids.add(r.id);
   need(typeof r.created_at==='string'&&/^\d{4}-\d{2}-\d{2}T.*Z$/.test(r.created_at)&&Number.isFinite(Date.parse(r.created_at)),'Invalid preference time');
   for(const s of [r.a,r.b]){connection.validateSelection(s);need(!s.shirtOnly&&s.state!=='REFERENCE','Only complete suit/blazer outfits are fitted');}
   const pk=contextPairKey(r.a,r.b,r.context);need(key(r.a)!==key(r.b)&&!pairs.has(pk),'Duplicate or identical comparison; edit/undo the original instead');pairs.add(pk);
   need(['A','B','both','neither'].includes(r.vote)&&REASONS.includes(r.reason),'Unknown vote or reason');
   need(['training','validation'].includes(r.partition)&&r.source_revision===root.HEWRSSourceCorrections.revision,'Different interpretation; review source before importing');
   need(exact(r.context,['occasion','requiredFormality'])&&root.HEWRSStyleOccasions.known(r.context.occasion)&&['any','tie_required','suit_required','open_collar_allowed'].includes(r.context.requiredFormality),'Invalid preference context');
   need(r.pilot_id===null||typeof r.pilot_id==='string'&&r.pilot_id.length<100,'Invalid pilot identity');
   const hold=new Set(root.HEWRS_PREFERENCE_PILOT?.validation_topwear||[]);if(hold.has(top(r.a))||hold.has(top(r.b)))need(r.partition==='validation','Reserved topwear cannot enter fitting');
  }return copy(v);}
 function read(){try{const incoming=backend?backend.getItem(KEY):raw;need(incoming===null||incoming.length<=MAX_BYTES,'Preference data too large');if(backend)state=incoming===null?{schema:SCHEMA,source_lock:sourceLock,revision:0,enabled:true,comparisons:[]}:validate(JSON.parse(incoming));raw=incoming;blocked=null;return {state:copy(state),token:{raw,revision:state.revision}};}catch(e){blocked='Preference feedback unavailable; original data retained: '+e.message;throw Error(blocked);}}
 function current(token){need(!blocked,blocked);need(token&&token.revision===state.revision&&token.raw===raw,'Preferences changed during selection');if(backend)need(backend.getItem(KEY)===token.raw,'Preference feedback changed in another tab; generate again');return true;}
 function commit(v,token){current(token);const out=validate(v),text=JSON.stringify(out);need(text.length<=MAX_BYTES,'Preference store limit reached');if(backend){backend.setItem(KEY,text);need(backend.getItem(KEY)===text,'Preference save not confirmed');}state=out;raw=text;return copy(state);}
 function add(r,token){need(r.a.suitId!=='S02'&&r.b.suitId!=='S02','S02 source/render mismatch: its comparisons are not saved for learning yet');const describe=connection.hybrid.researchPreference.describeSelection;need(describe(r.a,r.context).eligible&&describe(r.b,r.context).eligible,'Feedback pair has a current source/eligibility issue');return commit({...state,revision:state.revision+1,comparisons:[...state.comparisons,copy(r)]},token);}
 function model(context={occasion:'work',requiredFormality:'any'}){const r=read(),oc=root.HEWRSStyleOccasions.occasion(context.occasion||'work'),rows=r.state.comparisons.filter(x=>root.HEWRSStyleOccasions.occasion(x.context.occasion)===oc),m=fit(rows,connection.hybrid.researchPreference.describeSelection,{enabled:r.state.enabled});m.context_scope={occasion:oc,records_in_scope:rows.length,other_occasion_records_retained:r.state.comparisons.length-rows.length};m.id=fingerprint(m.id+'|'+oc);return {...r,model:m};}
 function undo(id,token){need(state.comparisons.at(-1)?.id===id,'Last comparison changed; review before undo');return commit({...state,revision:state.revision+1,comparisons:state.comparisons.slice(0,-1)},token);}
 function setEnabled(enabled,token){return commit({...state,revision:state.revision+1,enabled:!!enabled},token);}
 function previewImport(text){need(typeof text==='string'&&text.length<=MAX_BYTES,'Preference file too large');const incoming=validate(JSON.parse(text)),now=read(),merged=copy(now.state.comparisons);let added=0,same=0;
  for(const r of incoming.comparisons){const found=merged.find(x=>x.id===r.id||contextPairKey(x.a,x.b,x.context)===contextPairKey(r.a,r.b,r.context));if(found){need(JSON.stringify(found)===JSON.stringify(r),'Conflicting preference ID or pair; no records were replaced');same++;}else{merged.push(r);added++;}}
  const data=validate({...now.state,revision:now.state.revision+1,comparisons:merged});return {data,token:now.token,added,already_saved:same};}
 function merge(p){need(p&&p.data&&p.token,'Import preview required');return commit(p.data,p.token);}
 try{read();}catch{}
 const exclusive=fn=>root.navigator?.locks?.request?root.navigator.locks.request(KEY,{mode:'exclusive'},fn):Promise.resolve().then(fn);
 return Object.freeze({key:KEY,exclusive,read,assertCurrent:current,model,add,undo,setEnabled,validate,snapshot:()=>copy(state),status:()=>({blocked,persistent:!!backend,namespace:KEY}),exportText:()=>{const r=read();return JSON.stringify(r.state,null,2);},previewImport,merge,pairKey,contextPairKey,selectionKey:key});
}
root.HEWRSOutfitLearning=Object.freeze({KEY,SCHEMA,REV,FEATURES,REASONS,ACCEPT_LIMITS,empty,vector,delta,signals,predict,acceptPrediction,importance,upperBound,fit,validateModel,create,pairKey,contextPairKey,selectionKey:key});
})(globalThis);
