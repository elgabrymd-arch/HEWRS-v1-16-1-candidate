/* Local, explicit complete-outfit comparisons. No wear/Favorites reads, network,
 * image generation or implicit dislikes. Pairwise logistic model with L2 shrinkage.
 * Coordinates are semantic heuristics; predictions are not calibrated probabilities.
 */
(function(root){'use strict';
const KEY='hewrs:outfit-preferences:v1',SCHEMA='hewrs.outfit-preferences.v1',REV='hewrs.pairwise-outfit-model.v1_22_0';
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
function empty(reason='No directional comparisons saved'){return {revision:REV,id:'untrained',active:false,enabled:true,counts:{directional:0,informative:0,topwear_groups:0,neutral:0,validation:0,excluded:0},weights:FEATURES.map(()=>0),feature_names:FEATURES.slice(),bound:.35,reason,source_revision:root.HEWRSSourceCorrections.revision};}
function delta(model,x){if(!model?.active||!model.enabled)return 0;let u=0;for(let i=0;i<FEATURES.length;i++)u+=model.weights[i]*x[i];return .35*Math.tanh(u);}
function predict(model,a,b){const x=a.map((v,i)=>v-b[i]);const u=x.reduce((v,d,i)=>v+(model.weights[i]||0)*d,0);return Math.abs(u)<.01?'tie':u>0?'A':'B';}
function fit(rows,describe,{enabled=true}={}){
 const m=empty(),train=[],hold=[],tops=new Set();m.enabled=enabled;
 for(const row of rows){try{const a=describe(row.a,row.context),b=describe(row.b,row.context);
  if(row.a.suitId==='S02'||row.b.suitId==='S02'){m.counts.excluded++;continue;} // source/render mismatch cannot teach an appearance preference
  if(!a.eligible||!b.eligible){m.counts.excluded++;continue;}
  if(row.partition==='validation'){hold.push({row,a,b});m.counts.validation++;continue;}
  if(!['A','B'].includes(row.vote)){m.counts.neutral++;continue;}
  m.counts.directional++;const x=a.vector.map((v,i)=>v-b.vector[i]);if(Math.max(...x.map(Math.abs))<.001)continue;
  train.push({x,y:row.vote==='A'?1:0});m.counts.informative++;tops.add(top(row.a));tops.add(top(row.b));
 }catch{m.counts.excluded++;}}
 m.counts.topwear_groups=tops.size;
 // Never use tie equality/both/neither as fabricated one-sided labels.
 const w=FEATURES.map(()=>0),lambda=.20;
 for(let epoch=0;epoch<240&&train.length;epoch++){
  const grad=w.map(v=>lambda*v);for(const r of train){const u=clip(w.reduce((a,v,i)=>a+v*r.x[i],0),-30,30),p=1/(1+Math.exp(-u));for(let j=0;j<w.length;j++)grad[j]+=(p-r.y)*r.x[j]/train.length;}
  for(let j=0;j<w.length;j++)w[j]-=.6*grad[j];
 }
 m.weights=w.map(x=>Number(x.toFixed(8)));m.active=enabled&&train.length>=8&&tops.size>=3;
 m.reason=!enabled?'Learning paused; baseline research rules are used.':m.active?'Experimental local preference overlay; no independent taste validation claimed.':'Collect at least 8 informative A/B decisions across 3 topwear groups. Both/neither are retained but do not count as directional labels.';
 m.regularization={method:'pairwise logistic difference; L2',lambda,epochs:240,max_adjustment:.35};
 m.validation={count:0,correct:0,ties:0,scope:'Held-out topwear comparisons are never fitted. Small samples do not establish generalization.'};
 for(const h of hold){if(!['A','B'].includes(h.row.vote))continue;const p=predict(m,h.a.vector,h.b.vector);m.validation.count++;if(p==='tie')m.validation.ties++;else if(p===h.row.vote)m.validation.correct++;}
 m.id=fingerprint(JSON.stringify({revision:REV,enabled,weights:m.weights,counts:m.counts,source:m.source_revision}));return m;
}
function validateModel(m){need(m&&m.revision===REV&&m.source_revision===root.HEWRSSourceCorrections.revision,'Preference model/source version mismatch');need(Array.isArray(m.weights)&&m.weights.length===FEATURES.length&&m.weights.every(x=>Number.isFinite(x)&&Math.abs(x)<=5),'Invalid fitted coefficients');need(typeof m.active==='boolean'&&typeof m.enabled==='boolean'&&m.bound===.35,'Invalid learning limits');if(m.active)need(m.enabled&&m.counts.informative>=8&&m.counts.topwear_groups>=3,'Insufficient explicit evidence');return copy(m);}
function create(connection,sourceLock,backend){let raw=null,blocked=null,state={schema:SCHEMA,source_lock:sourceLock,revision:0,enabled:true,comparisons:[]};
 function validate(v){need(exact(v,['schema','source_lock','revision','enabled','comparisons'])&&v.schema===SCHEMA&&v.source_lock===sourceLock,'This is not a matching outfit-preference backup');need(Number.isSafeInteger(v.revision)&&v.revision>=0&&typeof v.enabled==='boolean'&&Array.isArray(v.comparisons)&&v.comparisons.length<=MAX,'Invalid preference state');
  const ids=new Set(),pairs=new Set();for(const r of v.comparisons){need(exact(r,['id','created_at','a','b','vote','reason','partition','pilot_id','context','source_revision']),'Unexpected comparison fields');need(/^pref_[A-Za-z0-9_-]{1,100}$/.test(r.id)&&!ids.has(r.id),'Invalid or duplicate preference ID');ids.add(r.id);
   need(typeof r.created_at==='string'&&/^\d{4}-\d{2}-\d{2}T.*Z$/.test(r.created_at)&&Number.isFinite(Date.parse(r.created_at)),'Invalid preference time');
   for(const s of [r.a,r.b]){connection.validateSelection(s);need(!s.shirtOnly&&s.state!=='REFERENCE','Only complete suit/blazer outfits are fitted');}
   const pk=pairKey(r.a,r.b);need(key(r.a)!==key(r.b)&&!pairs.has(pk),'Duplicate or identical comparison; edit/undo the original instead');pairs.add(pk);
   need(['A','B','both','neither'].includes(r.vote)&&REASONS.includes(r.reason),'Unknown vote or reason');
   need(['training','validation'].includes(r.partition)&&r.source_revision===root.HEWRSSourceCorrections.revision,'Different interpretation; review source before importing');
   need(exact(r.context,['occasion','requiredFormality'])&&['clinic','hospital','work'].includes(r.context.occasion)&&['any','tie_required','suit_required','open_collar_allowed'].includes(r.context.requiredFormality),'Invalid preference context');
   need(r.pilot_id===null||typeof r.pilot_id==='string'&&r.pilot_id.length<100,'Invalid pilot identity');
   const hold=new Set(root.HEWRS_PREFERENCE_PILOT?.validation_topwear||[]);if(hold.has(top(r.a))||hold.has(top(r.b)))need(r.partition==='validation','Reserved topwear cannot enter fitting');
  }return copy(v);}
 function read(){try{const incoming=backend?backend.getItem(KEY):raw;need(incoming===null||incoming.length<=MAX_BYTES,'Preference data too large');if(backend)state=incoming===null?{schema:SCHEMA,source_lock:sourceLock,revision:0,enabled:true,comparisons:[]}:validate(JSON.parse(incoming));raw=incoming;blocked=null;return {state:copy(state),token:{raw,revision:state.revision}};}catch(e){blocked='Preference feedback unavailable; original data retained: '+e.message;throw Error(blocked);}}
 function current(token){need(!blocked,blocked);need(token&&token.revision===state.revision&&token.raw===raw,'Preferences changed during selection');if(backend)need(backend.getItem(KEY)===token.raw,'Preference feedback changed in another tab; generate again');return true;}
 function commit(v,token){current(token);const out=validate(v),text=JSON.stringify(out);need(text.length<=MAX_BYTES,'Preference store limit reached');if(backend){backend.setItem(KEY,text);need(backend.getItem(KEY)===text,'Preference save not confirmed');}state=out;raw=text;return copy(state);}
 function add(r,token){need(r.a.suitId!=='S02'&&r.b.suitId!=='S02','S02 source/render mismatch: its comparisons are not saved for learning yet');const describe=connection.hybrid.researchPreference.describeSelection;need(describe(r.a,r.context).eligible&&describe(r.b,r.context).eligible,'Feedback pair has a current source/eligibility issue');return commit({...state,revision:state.revision+1,comparisons:[...state.comparisons,copy(r)]},token);}
 function model(){const r=read();return {...r,model:fit(r.state.comparisons,connection.hybrid.researchPreference.describeSelection,{enabled:r.state.enabled})};}
 function undo(id,token){need(state.comparisons.at(-1)?.id===id,'Last comparison changed; review before undo');return commit({...state,revision:state.revision+1,comparisons:state.comparisons.slice(0,-1)},token);}
 function setEnabled(enabled,token){return commit({...state,revision:state.revision+1,enabled:!!enabled},token);}
 function previewImport(text){need(typeof text==='string'&&text.length<=MAX_BYTES,'Preference file too large');const incoming=validate(JSON.parse(text)),now=read(),merged=copy(now.state.comparisons);let added=0,same=0;
  for(const r of incoming.comparisons){const found=merged.find(x=>x.id===r.id||pairKey(x.a,x.b)===pairKey(r.a,r.b));if(found){need(JSON.stringify(found)===JSON.stringify(r),'Conflicting preference ID or pair; no records were replaced');same++;}else{merged.push(r);added++;}}
  const data=validate({...now.state,revision:now.state.revision+1,comparisons:merged});return {data,token:now.token,added,already_saved:same};}
 function merge(p){need(p&&p.data&&p.token,'Import preview required');return commit(p.data,p.token);}
 try{read();}catch{}
 const exclusive=fn=>root.navigator?.locks?.request?root.navigator.locks.request(KEY,{mode:'exclusive'},fn):Promise.resolve().then(fn);
 return Object.freeze({key:KEY,exclusive,read,assertCurrent:current,model,add,undo,setEnabled,validate,snapshot:()=>copy(state),status:()=>({blocked,persistent:!!backend,namespace:KEY}),exportText:()=>{const r=read();return JSON.stringify(r.state,null,2);},previewImport,merge,pairKey,selectionKey:key});
}
root.HEWRSOutfitLearning=Object.freeze({KEY,SCHEMA,REV,FEATURES,REASONS,empty,vector,delta,predict,fit,validateModel,create,pairKey,selectionKey:key});
})(globalThis);
