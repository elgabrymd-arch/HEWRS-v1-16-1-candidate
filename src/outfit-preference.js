/* V1.18.0: owner-authorized complete-outfit preference model.
 * All values below are explicit heuristic calibrations, NOT measured colours,
 * recovered scores, universal aesthetic facts, or a trained personal model.
 * Original DNA, legacy compatibility/index/holds and images are not modified.
 * No ID-specific outfit bonuses, forced colour quotas or brand/price bonuses.
 */
(function(root){'use strict';
const REV='hewrs.complete-outfit-preference.v1_18_0';
const clip=(v,lo=0,hi=10)=>Math.max(lo,Math.min(hi,v)), round=v=>Math.round(v*1e6)/1e6;
const text=v=>(Array.isArray(v)?v.join('; '):String(v||'')).toLowerCase();
const clone=x=>structuredClone(x);
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
// Ordinal coordinates permit relational comparisons only. Source adjectives
// override defaults; uncertain/absent source wording is retained explicitly.
const colours={white:[null,4.9,.02,'neutral'],ivory:[null,4.7,.08,'warm-neutral'],cream:[null,4.5,.12,'warm-neutral'],stone:[null,3.9,.08,'neutral'],beige:[38,3.7,.16,'warm-neutral'],tan:[38,3.4,.30,'warm'],greige:[null,3.65,.08,'warm-neutral'],taupe:[30,3.0,.16,'warm-neutral'],chestnut:[25,2.65,.38,'warm'],chocolate:[28,1.95,.28,'warm'],espresso:[28,1.0,.20,'warm'],brown:[30,2.6,.28,'warm'],charcoal:[null,1.4,.04,'neutral'],grey:[null,3.0,.04,'neutral'],black:[null,.4,.02,'neutral'],navy:[220,1.35,.3,'cool'],blue:[218,3.0,.4,'cool'],lavender:[280,3.9,.25,'cool'],purple:[280,2.1,.42,'cool'],pink:[345,4.0,.26,'warm-cool'],mauve:[340,3.0,.24,'warm-cool'],burgundy:[345,1.9,.38,'warm-cool'],rust:[23,2.85,.55,'warm'],red:[0,2.5,.72,'warm'],gold:[43,3.5,.50,'warm'],sage:[100,4.0,.14,'cool'],olive:[75,2.6,.23,'warm-neutral'],green:[115,3.0,.37,'cool']};
const colourWords=[['ivory',/\b(?:ivory|off.white|ecru)\b/],['cream',/\b(?:cream|oatmeal)\b/],['greige',/\b(?:greige|mushroom beige)\b/],['taupe',/\btaupe\b/],['chestnut',/\bchestnut\b/],['espresso',/\bespresso\b/],['chocolate',/\bchocolate\b/],['beige',/\b(?:beige|sand|mushroom)\b/],['tan',/\b(?:tan|camel|khaki)\b/],['stone',/\bstone\b/],['lavender',/\b(?:lavender|lilac)\b/],['navy',/\b(?:navy|midnight)\b/],['charcoal',/\b(?:charcoal|graphite)\b/],['grey',/\b(?:grey|gray|silver|pearl)\b/],['blue',/\b(?:blue|cornflower|periwinkle|cobalt)\b/],['brown',/\b(?:brown|tobacco)\b/],['rust',/\b(?:rust|orange|terracotta|cognac)\b/],['gold',/\b(?:gold|golden|bronze|ochre|mustard)\b/],['burgundy',/\b(?:burgundy|wine|oxblood)\b/],['red',/\bred\b/],['mauve',/\bmauve\b/],['pink',/\b(?:pink|rose|fuchsia|magenta)\b/],['purple',/\b(?:purple|aubergine|plum)\b/],['sage',/\b(?:sage|pistachio)\b/],['olive',/\bolive\b/],['green',/\b(?:green|mint|teal)\b/],['black',/\bblack\b/],['white',/\bwhite\b/]];
function colour(wording){const s=text(wording);let shade=null,pos=Infinity;
 for(const [k,re]of colourWords){const m=s.match(re);if(m&&m.index<pos){shade=k;pos=m.index;}}
 // Whole compound descriptors take priority over the incidental first colour.
 if(/\bmushroom beige\b|\bwarm greige\b/.test(s))shade='greige';
 if(/\btaupe[ /-]+(?:medium |mid-)?brown\b/.test(s))shade='taupe';
 if(/\bcharcoal[ -]+blue\b|\bsilver-blue\b/.test(s))shade='blue';
 if(!shade&&/\b(?:dark|black) ground\b|\bnear.black\b/.test(s))shade='black';
 if(!shade)return {shade:'unknown',family:'unknown',value:null,hue:null,saturation:null,temperature:'unknown',wording,measurement:false};
 let[h,v,sat,temp]=colours[shade];
 if(/\bvery dark\b|\bnear.black\b/.test(s))v=Math.min(v,.75);
 else if(/\bmedium.to.dark\b/.test(s))v=Math.min(v,1.7);
 else if(/\bmedium.dark\b|\bmid.dark\b/.test(s))v=Math.min(v,2.0);
 else if(/\bdarker\b/.test(s))v=Math.min(v,3.0);
 else if(/\bdark\b|\bdeep\b/.test(s))v=Math.min(v,1.6);
 else if(/\bvery pale\b|\bvery light\b|\bice\b|\bpowder\b/.test(s))v=Math.max(v,4.5);
 else if(/\blight.to.medium\b|\bmedium.light\b/.test(s))v=Math.max(v,3.6);
 else if(/\blight\b|\bpale\b|\bsky blue\b/.test(s))v=Math.max(v,4.2);
 if(/\bvivid\b|\bfuchsia\b|\bmagenta\b|\broyal blue\b/.test(s))sat=Math.max(sat,.8);
 if(/\bmuted\b|\bdesaturated\b|\btonal\b|\bslate\b/.test(s))sat=Math.min(sat,.28);
 const family=['ivory','cream'].includes(shade)?'cream':['greige','beige','stone','tan'].includes(shade)?'beige':['taupe','chestnut','chocolate','espresso','brown'].includes(shade)?'brown':shade;
 return {shade,family,value:v,hue:h,saturation:sat,temperature:temp,wording,measurement:false};
}
function pattern(row){const s=text(row.pattern_text),scaleText=text(row.scale_text),contrastText=text(row.contrast_text),combined=s+' '+scaleText;
 const compound=/compound|layered|windowpane over|over micro.check/.test(combined);
 const type=/windowpane|check|plaid|lattice|houndstooth|gingham|tattersall|prince of wales|\bgrid\b/.test(s)?'grid':/stripe|regimental/.test(s)?'linear':/paisley|floral|scroll|vine/.test(s)?'organic':/horsebit|medallion|geometric|monogram|dot|motif|honeycomb|print/.test(s)?'geometric':/solid/.test(s)?'solid':/herringbone|weave|textur|basket/.test(s)?'texture':'unknown';
 const recordedScale=typeof row.recorded_scale==='number',recordedContrast=typeof row.recorded_contrast==='number';
 let scale=recordedScale?row.recorded_scale:type==='solid'?0:type==='texture'?1:2.5;
 if(compound)scale=Math.max(scale,3);else if(/bold|large|oversized|bengal/.test(combined))scale=3.5;else if(/fine|narrow|pencil|micro|small/.test(combined))scale=1;
 let contrast=recordedContrast?row.recorded_contrast:type==='solid'?0:2.5;
 // Explicit contrast descriptors take precedence over pattern-name shorthand.
 if(/very low|extremely faint|almost invisible/.test(contrastText+' '+s))contrast=.6;
 else if(/low.to.moderate|low.moderate|medium.low/.test(contrastText))contrast=1.7;
 else if(/medium.high|moderate.high/.test(contrastText))contrast=3.5;
 else if(/\bhigh\b/.test(contrastText))contrast=4;
 else if(/\bmoderate\b|\bmedium\b/.test(contrastText))contrast=2.5;
 else if(/\blow\b/.test(contrastText))contrast=1.2;
 else if(!compound&&/tonal|subtle|near.solid|micro|fine.*herringbone/.test(s))contrast=Math.min(contrast,1.2);
 if(compound)contrast=Math.max(contrast,2.5);
 const quiet=!compound&&(type==='solid'||contrast<=1.2||type==='texture');
 return {family:type,scale,contrast,quiet,compound,layers:compound?['windowpane','micro-check']:[type],wording:row.pattern_text,scale_wording:row.scale_text,contrast_wording:row.contrast_text,measurement:false};
}
function profile(row){const primary=colour(row.primary_text),accents=(Array.isArray(row.secondary_text)?row.secondary_text:String(row.secondary_text||'').split(/[;,]/)).filter(x=>!/^(?:none|no accents?)$/i.test(String(x).trim())).map(colour);
 return root.HEWRSSourceCorrections.profile(row,{id:row.id,category:row.category,primary,accents,pattern:pattern(row),surface:row.texture_text||null,construction:row.construction_text||null,source:clone(row.source||null),interpretation:'separate preference-model semantics; no original DNA mutation'});
}
function create(connection){const profiles=new Map([...connection.features].map(([id,r])=>[id,profile(r)]));
 for(const id of connection.blazerConnection.pantIds){const p=connection.blazerConnection.knownPant(id);profiles.set('pants-'+id,profile({id:'pants-'+id,category:'pants',primary_text:p.record.shade,pattern_text:'Shared colour representative',texture_text:null,source:p.record.evidence}));}
 const need=id=>{const p=profiles.get(id);if(!p)throw Error('No preference source profile for '+id);return p;};
 function palette(parts){const cs=parts.map(p=>p.primary).filter(c=>c.value!==null);if(!cs.length)return 7;
  const chromatic=cs.filter(c=>c.hue!==null&&c.saturation>.25),high=cs.filter(c=>c.saturation>=.7).length;
  let score=8.65;
  // Saturated opposition is not an automatic reward. Muted warm/cool palettes
  // remain eligible and high-quality; neutral/tonal palettes are not penalized.
  if(high>1)score-=.65*(high-1);
  for(let i=0;i<chromatic.length;i++)for(let j=i+1;j<chromatic.length;j++){let d=Math.abs(chromatic[i].hue-chromatic[j].hue);d=Math.min(d,360-d);if(d>100&&chromatic[i].saturation>.6&&chromatic[j].saturation>.6)score-=.55;}
  if(parts.some(a=>parts.some(b=>a!==b&&a.accents.some(x=>x.family===b.primary.family&&x.family!=='unknown'))))score+=.2;
  return clip(score);
 }
 function hierarchy(parts){let score=9.2;const visible=parts.filter(p=>!p.pattern.quiet&&p.pattern.family!=='unknown');
  for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=visible[i].pattern,b=visible[j].pattern,gap=Math.abs(a.scale-b.scale);
   if(a.family===b.family&&gap<.8)score-=1.25;else if(a.family===b.family&&gap<1.6)score-=.5;else if(gap<.6&&Math.min(a.contrast,b.contrast)>2.8)score-=.55;
   if(a.compound&&b.compound)score-=.8;
  }
  const dominant=visible.filter(p=>p.pattern.contrast>=3.5&&p.pattern.scale>=2.5);if(dominant.length>1)score-=.65*(dominant.length-1);
  return clip(score);
 }
 function clothing(topId,shirtId,tieId,pantId,legacyScore){const top=need(topId),shirt=need(shirtId),tie=tieId==='NO_TIE'?null:need(tieId),pant=pantId?need('pants-'+pantId):null;
  const parts=[top,shirt,...(tie?[tie]:[]),...(pant?[pant]:[])],tv=top.primary.value,sv=shirt.primary.value,gap=tv===null||sv===null?null:Math.abs(tv-sv);
  let structure=8.5,reason;
  if(tie){const tieV=tie.primary.value,d=sv===null||tieV===null?null:sv-tieV;
   const focal=d===null?7.5:d>=.7?9.25:d>=.3?8.4:d>=-.35?7.3:Math.abs(d)<1?7.0:6.5;
   const outline=gap===null?7.5:gap>=.5?9.0:d!==null&&d>=.7?8.9:7.4;
   structure=.72*focal+.28*outline;reason=d!==null&&d>=.7?'Tie gives a clear focal point; jacket-shirt contrast need not be maximized.':'Tonal or reverse-value tied look; evaluated without a categorical dark-shirt ban.';
  }else{structure=gap===null?7.5:gap>=.5?9.15:shirt.pattern.quiet&&top.pattern.quiet?8.0:8.85;reason='Open collar has its own readable value/texture structure on the same quality scale; no missing-tie penalty.';}
  const pal=palette(parts),pat=hierarchy(parts);
  let form=9.0;if(tie&&/button.down|denim/.test(text(shirt.construction)+' '+text(shirt.surface))&&/double.breasted|peak/.test(text(top.construction)))form=8.0;
  let surface=8.5;const ts=text(top.surface),ss=text(shirt.surface);if(/nap|hairy|brushed|boucle/.test(ts)&&/lustrous|satin|shiny/.test(ss))surface=7.2;
  let foundation=9;if(pant){const pv=pant.primary.value,pg=pv===null||tv===null?null:Math.abs(pv-tv);foundation=pg===null?7.5:pg<.5&&pant.primary.family===top.primary.family?7.0:pg<.6?8.3:9.1;}
  // Legacy ensemble estimates are retained as a small stabilizing input, not
  // treated as the new preference or allowed to swamp whole-outfit structure.
  const components={structure:round(structure),palette:round(pal),pattern_hierarchy:round(pat),formality:form,surface,blazer_trouser_foundation:foundation,legacy_compatibility:legacyScore};
  const weights={structure:.32,palette:.20,pattern_hierarchy:.20,formality:.06,surface:.04,blazer_trouser_foundation:.08,legacy_compatibility:.10};
  const value=Object.keys(weights).reduce((s,k)=>s+weights[k]*components[k],0);
  return {revision:REV,score:round(value),kind:'personalized_heuristic_not_frozen_compatibility',components,weights,reason,ids:{topwear:topId,shirt:shirtId,tie:tieId,pants:pantId},profiles:{topwear:top,shirt,tie,pants:pant}};
 }
 function shoe(item,c,q){const p=c.profiles,top=p.topwear,pant=p.pants||top,suit=top.category==='suit',tied=!!p.tie,s=text(item.color),type=item.subcategory;
  const col=colour(s),light=col.value===null?2.5:col.value,warm=['brown','rust','beige','gold'].includes(col.family),statement=/emboss|monogram|two.tone|woven|studd|metallic/.test(s);
  let form=type==='Dress Shoes'?(suit&&tied?9.5:9.0):type==='Loafers'?(suit&&tied?8.85:9.35):type==='Drivers'?6.0:5.2;
  const pv=pant.primary.value,tv=top.primary.value,warmTop=/warm/.test(top.primary.temperature);
  let ground=8.8;
  if(light>=3.2){ground=warmTop&&tv>=3.2&&pv>=3?9.0:(pv<2||tv<2)?7.0:7.7;}
  else if(col.family==='black')ground=warmTop&&tv>3.3&&!tied?8.0:9.15;
  else if(['brown','burgundy'].includes(col.family))ground=warmTop?9.35:9.05;
  else if(col.family==='navy')ground=8.5;
  const pattern=statement&&c.components.pattern_hierarchy<8.5?7.2:statement?8.3:9.2;
  const surface=/suede/.test(s)&&suit&&tied?8.2:/suede/.test(s)&&!suit?9.1:8.8;
  return {score:round(clip(.40*form+.35*ground+.15*pattern+.10*surface)),formality:form,grounding:ground,pattern,surface,colour:col,revision:REV,kind:'separate_contextual_accessory_preference',price_or_brand_bonus:0,unknown_material_not_invented:true};
 }
 function watch(item,c,q){if(!item)return {score:9.0,kind:'intentional_no_watch',revision:REV};
  const cat=root.watchFormalityCategory(item),s=text(item.color),quiet=!['statement','diamondStatement'].includes(cat),busy=c.components.pattern_hierarchy<8.5;
  const form=({dress:9.3,integratedSport:9.0,sport:8.2,statement:8,diamondStatement:7.3})[cat]||8.5;
  const visual=busy&&!quiet?7.2:quiet?9:8.3;
  const metal=root.HEWRSLegacyAccessories.metal(item),warm=/warm/.test(c.profiles.topwear.primary.temperature);const coherence=metal==='gold'?warm?9:8.4:8.9;
  return {score:round(clip(.45*form+.35*visual+.20*coherence)),formality:form,visual,coherence,revision:REV,price_or_brand_bonus:0,kind:'separate_contextual_watch_preference'};
 }
 function complete(c,sh,wa){return {revision:REV,score:round(.90*c.score+.075*sh.score+.025*wa.score),clothing_score:c.score,clothing:clone(c.components),shoe:clone(sh),watch:clone(wa),weights:{clothing:.90,shoes:.075,watch:.025},kind:'personalized_heuristic_not_frozen_compatibility',measurement:false,explanation:c.reason};}
 function signature(c){const p=c.profiles;return {topFamily:p.topwear.primary.family,topPattern:p.topwear.pattern.family,shirtShade:p.shirt.primary.shade,shirtDepth:p.shirt.primary.value>=3.6?'light':p.shirt.primary.value>=2.3?'medium':'dark',shirtPattern:p.shirt.pattern.quiet?'quiet':p.shirt.pattern.family,tieFamily:p.tie?.primary.family||'NO_TIE',tiePattern:p.tie?(p.tie.pattern.quiet?'quiet':p.tie.pattern.family):'NO_TIE'};}
 function similarity(a,b){let n=0;for(const[k,w]of Object.entries({topFamily:.1,topPattern:.05,shirtShade:.30,shirtDepth:.10,shirtPattern:.15,tieFamily:.2,tiePattern:.1}))if(a[k]===b[k])n+=w;return n;}
 function redundancy(e,selected,q){if(!selected.length)return 0;const sig=signature(e.entry.preference);let max=0,total=0;for(const old of selected){const s=similarity(sig,signature(old.entry.preference));max=Math.max(max,s);total+=s;}return round(.12*max+.06*total/selected.length);}
 return Object.freeze({revision:REV,matchesFamily:(id,wanted)=>{const p=need(id).primary;return (wanted==='taupe'?p.shade==='taupe':wanted==='grey'?['grey','charcoal','stone'].includes(p.family):wanted==='pink'?['pink','mauve'].includes(p.family):p.family===wanted);},profile:id=>clone(need(id)),profiles:()=>[...profiles.values()].map(clone),clothing,shoe,watch,complete,signature,redundancy,maximumComplete:score=>.9*score+1.0,curationBand:.20,description:'Versioned personal preference from complete outfits; all ordinal values inferred from recorded wording. Preserved compatibility and eligibility remain separate.'});
}
root.HEWRSOutfitPreference=Object.freeze({create,colour,pattern,profile,revision:REV});
})(globalThis);
