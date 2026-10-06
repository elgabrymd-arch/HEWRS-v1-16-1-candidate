/* V1.24.0 owner-approved controls. Numerical occasion weights are explicit
 * engineering choices, not new wardrobe facts or fitted owner preferences.
 * Reading an old context never rewrites the stored source record. */
(function(root){'use strict';
 const revision='hewrs.style-and-occasion.v1_24_0';
 const work=new Set(['work','clinic','hospital','office']);
 function occasion(value='work') {if(work.has(value))return 'work';if(value==='dinner'||value==='weekend')return value;throw Error('Unknown occasion: '+String(value));}
 function known(value){try{occasion(value);return true;}catch{return false;}}
 function context(value={}){return {...value,occasion:occasion(value.occasion||'work'),requiredFormality:value.requiredFormality||'any'};}
 function dressMode(value){return {work:'work',dinner:'fancyDinner',weekend:'weekend'}[occasion(value)];}
 const labels=Object.freeze({work:'Work',dinner:'Dinner',weekend:'Weekend'});
 function noTieCap(q){return q?.executiveStyle==='MODERN'||(q?.prefs?.tie||q?.tie)?.mode==='none'?null:2;}
 const profiles=Object.freeze({
  work:Object.freeze({weight:0,description:'One workplace: hospital, clinic and office. Original clothing preference unchanged.'}),
  dinner:Object.freeze({weight:.08,description:'Evening tailoring; tie and suit are not compulsory. Explicit formality remains binding.',suit_tied:9.3,suit_open:9.2,blazer_tied:9.0,blazer_open:9.3}),
  weekend:Object.freeze({weight:.08,description:'Relaxed tailored/smart-casual wardrobe. Open collars preferred, not forced; exact ties remain binding.',suit_tied:7.7,suit_open:8.7,blazer_tied:8.0,blazer_open:9.6})
 });
 function clothingAssessment(o,q={}){
  const oc=occasion(q.context?.occasion||'work'),p=profiles[oc],type=o.profiles.topwear.category==='suit'?'suit':'blazer',mode=o.profiles.tie?'tied':'open';
  const fit=p.weight?p[type+'_'+mode]:o.score,score=Math.round(((1-p.weight)*o.score+p.weight*fit)*1e6)/1e6;
  return {...o,score,occasion_profile:{revision,occasion:oc,profile_score:fit,profile_weight:p.weight,base_clothing_score:o.score,description:p.description,basis:'declared_engineering_profile_not_owner_rating',forced_tie_or_no_tie:false}};
 }
 const featureLabels=Object.freeze({relaxed_tailoring:'Relaxed tailoring',lustrous_shirt:'Lustrous shirt',open_collar:'Open collar',sneakers:'Sneakers'});
 function styleText(style){if(!style?.classification)return 'Style not assessed';const label={CLASSIC:'Classic',HYBRID:'Hybrid',MODERN:'Modern'}[style.classification],reasons=(style.modern_interventions||[]).map(x=>featureLabels[x.id]).filter(Boolean);return label+' · '+(reasons.length?reasons.join(' + '):style.classic_foundation===false?'Contemporary foundation':'Classic foundation');}
 root.HEWRSStyleOccasions=Object.freeze({revision,occasion,known,context,dressMode,labels,noTieCap,profiles,clothingAssessment,styleText});
})(globalThis);
