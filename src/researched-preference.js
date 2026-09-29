/* V1.20.0 local, research-informed styling rules.
 * Sources/qualifiers: RESEARCH_RULES_V1_20_0.md and data/styling-research.json.
 * Numeric weights are disclosed engineering judgments, NOT designer ratings,
 * measured colours, a trained taste model, or live visual-AI assessment.
 * This module reads wardrobe facts. It does not edit DNA or historical scores.
 */
(function(root){'use strict';
const REV='hewrs.researched-work-styling.v1_20_0',old=root.HEWRSOutfitPreference;
const clip=(v,lo=0,hi=10)=>Math.max(lo,Math.min(hi,v)),r=v=>Math.round(v*1e6)/1e6,copy=x=>structuredClone(x),txt=x=>String(x||'').toLowerCase();
const warm=new Set(['brown','beige','cream','rust','gold','olive']),neutral=new Set(['white','cream','beige','grey','charcoal','black']);
function col(t){let c=old.colour(t),s=txt(t);
 // Retain the dominant compound, not incidental tokens or accent adjectives.
 if(/\b(?:warm )?charcoal brown\b/.test(s))c={...c,shade:'brown',family:'brown',hue:30,value:1.8,saturation:.14,temperature:'warm-neutral'};
 if(/\bmedium\/dark chocolate\b/.test(s))c={...c,value:1.8};
 return c;
}
function pat(row){let p=old.pattern(row),s=txt(row.pattern_text),cs=txt(row.contrast_text);
 // Do not let a fine ground erase a second visible motif. Preserve type/layers.
 if(/motif over|monogram.*weave|geometric.*weave/.test(s))p={...p,family:'geometric',layers:['motif','ground-weave'],compound:false,scale:2.2,contrast:/tonal/.test(s)?1.5:p.contrast,quiet:false};
 if(/herringbone|micro.basket/.test(s)&&!/windowpane|check over/.test(s))p={...p,family:'texture',quiet:true,contrast:Math.min(p.contrast,1.2)};
 if(/very low|extremely faint|almost invisible/.test(cs+' '+s))p={...p,quiet:true,contrast:Math.min(p.contrast,.65)};
 return p;
}
function create(c){const inherited=old.create(c),profiles=new Map();
 for(const [id,row]of c.features){const p=old.profile(row);p.primary=col(row.primary_text);p.accents=(Array.isArray(row.secondary_text)?row.secondary_text:String(row.secondary_text||'').split(/[;,]/)).filter(x=>x&&!/^none$/i.test(String(x))).map(col);p.pattern=pat(row);profiles.set(id,p);}
 for(const id of c.blazerConnection.pantIds){const d=c.blazerConnection.knownPant(id),p=inherited.profile('pants-'+id);p.primary=col(d.record.shade);profiles.set('pants-'+id,p);}
 function get(id){const p=profiles.get(id);if(!p)throw Error('Missing research wardrobe profile '+id);return p;}
 function prominence(p){if(!p)return 0;const a=p.pattern;if(a.family==='solid')return 0;if(a.quiet)return Math.min(.3,a.contrast*.13);return clip(a.contrast/4*(.6+Math.min(a.scale,4)/8)+(a.compound?.24:0),0,1.4);}
 function hueGap(a,b){if(a.hue===null||b.hue===null)return null;let d=Math.abs(a.hue-b.hue);return Math.min(d,360-d);}
 function pair(a,b){if(a.family==='unknown'||b.family==='unknown')return 8;
  const d=hueGap(a,b),muted=Math.min(a.saturation,b.saturation)<.32;
  if(neutral.has(a.family)||neutral.has(b.family))return 9;
  if(d!==null&&d<=55)return 9.15; // tonal or neighbouring tones
  if(warm.has(a.family)&&['blue','navy'].includes(b.family)||warm.has(b.family)&&['blue','navy'].includes(a.family))return 9.1;
  if(['blue','navy'].includes(a.family)&&['pink','mauve','lavender','purple','burgundy'].includes(b.family)||['blue','navy'].includes(b.family)&&['pink','mauve','lavender','purple','burgundy'].includes(a.family))return 9.05;
  return muted?8.8:8.0;
 }
 // Contextual directions, not all-or-nothing colour matching. Qualitative
 // directions are synthesized from CT/Kamiceria/Boggi; the ordinal numbers
 // and the preference for restrained work looks are our implementation choices.
 function shirtDirection(t,s,tied){const tf=t.primary.family,sf=s.primary.family;let m;
  if(['grey','charcoal','black'].includes(tf))m={white:9.5,cream:9.55,blue:9.5,lavender:9.55,pink:9.45,mauve:9.25,beige:9.25,brown:9.05,grey:9.3,navy:8.8,black:8.5,burgundy:8.9};
  else if(['blue','navy'].includes(tf))m={white:9.5,cream:9.55,blue:9.55,lavender:9.4,pink:9.5,mauve:9.25,beige:9.3,brown:9.15,grey:9.2,navy:8.7,black:8.4,burgundy:8.9};
  else if(warm.has(tf))m={white:9.4,cream:9.6,blue:9.6,lavender:9.45,pink:9.3,mauve:9.2,beige:9.4,brown:9.1,grey:9.0,navy:9.05,black:8.3,burgundy:8.95};
  else m={white:9.4,cream:9.55,blue:9.35,lavender:9.3,pink:9.2,beige:9.35,brown:9.25,grey:9.1,navy:9.1,black:8.5,burgundy:8.8};
  let v=m[sf]??8.8;
  if(!tied&&['brown','navy','black','burgundy'].includes(sf)&&Math.abs(t.primary.value-s.primary.value)>=.7)v+=.4;
  return clip(v);
 }
 function tieDirection(t,s,i){if(!i)return 9.35;const f=s.primary.family,tf=t.primary.family;let m;
  if(['blue','navy'].includes(f))m={navy:9.5,burgundy:9.6,brown:9.4,purple:9.3,rust:9.2,grey:9.0,black:8.9,blue:9.1,gold:8.8,red:8.85,pink:8.8,lavender:8.8};
  else if(['lavender','purple','pink','mauve'].includes(f))m={navy:9.6,purple:9.45,burgundy:9.35,brown:9.1,grey:9.3,black:9.0,blue:9.15,rust:8.8,gold:8.6,red:8.5,pink:8.7,lavender:8.9};
  else if(['brown','beige'].includes(f))m={navy:9.55,brown:9.3,burgundy:9.3,purple:9.1,grey:9.1,blue:9.2,black:8.9,rust:8.9,gold:8.8,red:8.4,pink:8.7};
  else m={navy:9.6,burgundy:9.5,brown:warm.has(tf)?9.45:9.2,purple:9.35,grey:9.0,black:9.0,blue:9.25,rust:warm.has(tf)?9.25:9.05,gold:8.95,red:8.75,pink:8.95,lavender:9.0};
  return m[i.primary.family]??8.8;
 }
 // Small semantic reference prior: compare recorded garment properties, not
 // exact IDs. These are the two overall preferred example sets, NOT a fitted
 // personal model or inferred individual owner ratings. Source-held references
 // do not train a replacement numerical score.
 const templates=[];
 for(const ref of root.HEWRS_STYLIST_LIBRARY?.records||[]){if(!['free-reference','s10-reference'].includes(ref.set))continue;const x=ref.selection;
  try{const a=c.scoreSelection(x,{occasion:'clinic',requiredFormality:'any'});if(!Number.isFinite(a.score)||a.hard_conflict?.hard_reject)continue;
   templates.push({topwear:get(x.suitId||x.blazerId),shirt:get(x.shirtId),tie:x.state==='NO_TIE'?null:get(x.state),pants:x.pantId?get('pants-'+x.pantId):null});
  }catch{}
 }
 function propertySimilarity(a,b){if(!a||!b)return a===b?1:0;const x=a.primary,y=b.primary;const same=x.shade===y.shade?1:x.family===y.family?.88:neutral.has(x.family)&&neutral.has(y.family)?.65:.25;
  const depth=x.value===null||y.value===null?.5:Math.max(0,1-Math.abs(x.value-y.value)/3.5);
  const patt=a.pattern.quiet&&b.pattern.quiet?1:a.pattern.family===b.pattern.family?Math.max(.4,1-Math.abs(a.pattern.scale-b.pattern.scale)/5):.35;
  return .50*same+.25*depth+.25*patt;
 }
 function referenceSimilarity(p){if(!templates.length)return 8;let best=0;for(const x of templates){if((!!p.pants)!=(!!x.pants))continue;const v=.28*propertySimilarity(p.topwear,x.topwear)+.30*propertySimilarity(p.shirt,x.shirt)+.30*propertySimilarity(p.tie,x.tie)+.12*propertySimilarity(p.pants,x.pants);best=Math.max(best,v);}return 10*best;}
 function clothing(topId,shirtId,tieId,pantId,legacyScore){const t=get(topId),s=get(shirtId),tie=tieId==='NO_TIE'?null:get(tieId),p=pantId?get('pants-'+pantId):null,parts=[t,s,...(tie?[tie]:[]),...(p?[p]:[])];
  const tv=t.primary.value,sv=s.primary.value,iv=tie?.primary.value,d=sv===null||iv===null?null:sv-iv,gap=tv===null||sv===null?null:Math.abs(tv-sv),pr=parts.map(prominence),reasons=[],cautions=[];
  // CT dark-tie/light-shirt guidance is a contextual preference, not a ban.
  let value=8.6;
  if(tie){value=d===null?8:d>=.6?9.4:d>=.2?8.8:d>=-.2?8:6.5;
   if(d!==null&&d>=.6)reasons.push('The tie is deeper than the shirt, giving a readable focal point.');
   else if(d!==null&&d<-.2)cautions.push('Reverse-value tie: more expressive than the default work styling.');
   if(sv!==null&&sv<2.0&&iv!==null&&iv<2.0)value-=.55;
   if(gap!==null&&gap<.35&&(d===null||d<.6))value-=.55;
  }else{value=gap===null?8:gap>=.5?9.1:prominence(t)+prominence(s)>.45?8.7:8.1;reasons.push('Open collar keeps the outfit uncluttered; no missing-tie penalty.');}
  // Relative pattern scales and one leading focal element. Subtle weaves stay subtle.
  let hierarchy=9.5;const visible=parts.map((x,i)=>({x,p:pr[i]})).filter(z=>z.p>.38);
  for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=visible[i],b=visible[j],delta=Math.abs(a.x.pattern.scale-b.x.pattern.scale);
   if(a.x.pattern.family===b.x.pattern.family&&delta<.8)hierarchy-=1.35*Math.min(1,a.p+b.p);
   else if(delta<.65&&Math.min(a.p,b.p)>.65)hierarchy-=.65;
  }
  if(visible.length>=3){hierarchy-=.9*(visible.length-2);cautions.push('Three visible patterns require extra restraint.');}
  const strongest=[...pr].sort((a,b)=>b-a);if(strongest[1]>.55)hierarchy-=.65*(strongest[1]-.55)/.45;
  if(strongest[0]<.9&&visible.length<3)reasons.push('Pattern scale and prominence leave a clear visual hierarchy.');
  // Palette coherence includes meaningful secondary-colour links; no bonus for maximum opposition.
  let palette=(pair(t.primary,s.primary)+(tie?pair(s.primary,tie.primary):9)+(p?pair(t.primary,p.primary):9))/3;
  const colourLinks=[];if(tie)for(const x of [t,s])if(tie.accents.some(a=>a.family===x.primary.family&&a.family!=='unknown')||x.accents.some(a=>a.family===tie.primary.family&&a.family!=='unknown'))colourLinks.push(x.id);
  if(colourLinks.length){palette+=.18;reasons.push('A recorded accent links the tie to another garment.');}
  const strong=parts.filter(x=>x.primary.saturation>=.6);if(strong.length>1)palette-=.65*(strong.length-1);
  // Layer separation in odd-jacket outfits: assess trousers, not a pseudo matching suit.
  let foundation=9.2;
  if(p){const same=p.primary.family===t.primary.family,pg=p.primary.value===null||tv===null?null:Math.abs(p.primary.value-tv);foundation=pg===null?8:same&&pg<.65?6.7:pg<.4?8.0:9.25;
   if(same&&pg<.65)cautions.push('Jacket and trousers are close in shade without being a matching suit.');else reasons.push('Separate trousers have deliberate colour/value separation from the blazer.');}
  // Shirt character can carry warmth/colour. No per-ID, skin-colour, colour quota or brand term.
  let formality=9.1,surface=8.9;
  if(tie&&/button.down|denim/.test(txt(s.construction)+' '+txt(s.surface))&&/peak|double.breasted/.test(txt(t.construction)))formality-=.7;
  if(/nap|hairy|brushed|boucle/.test(txt(t.surface))&&/satin|shiny/.test(txt(s.surface)))surface-=.7;
  const components={reference_structure:r(referenceSimilarity({topwear:t,shirt:s,tie,pants:p})),shirt_palette_direction:r(shirtDirection(t,s,!!tie)),tie_palette_direction:r(tieDirection(t,s,tie)),value_structure:r(clip(value)),palette:r(clip(palette)),pattern_hierarchy:r(clip(hierarchy)),formality:r(clip(formality)),surface:r(clip(surface)),blazer_trouser_foundation:r(clip(foundation)),legacy_compatibility:legacyScore};
  const weights={reference_structure:.10,shirt_palette_direction:.153,tie_palette_direction:.162,value_structure:.162,palette:.072,pattern_hierarchy:.198,formality:.036,surface:.027,blazer_trouser_foundation:.072,legacy_compatibility:.018};
  let score=Object.keys(weights).reduce((n,k)=>n+weights[k]*components[k],0);
  return {revision:REV,score:r(score),components,weights,ids:{topwear:topId,shirt:shirtId,tie:tieId,pants:pantId},profiles:{topwear:t,shirt:s,tie,pants:p},prominence:pr,reasons,cautions,reason:[...reasons,...cautions].join(' '),kind:'research_informed_local_rule_estimate',measured:false};
 }
 function shoe(item,o,q){const t=o.profiles.topwear,p=o.profiles.pants||t,ss=txt(item.color),colour=col(ss),type=item.subcategory,suit=t.category==='suit',tied=!!o.profiles.tie,pv=p.primary.value,v=colour.value;
  let formality=type==='Dress Shoes'?(tied?9.5:9.0):type==='Loafers'?(tied?8.9:9.35):type==='Drivers'?6.8:6.2;
  if(/lug sole|chunky|heavy sole/.test(ss)&&suit&&tied)formality-=.75;
  let grounding=8.6,reason='Footwear assessed against the trousers and dress level, not price or brand.';
  if(colour.family==='black'){grounding=['navy','blue','charcoal','grey','black'].includes(p.primary.family)?9.35:warm.has(p.primary.family)&&pv>=3.3?8.35:8.85;}
  else if(['brown','burgundy','rust','beige'].includes(colour.family)){
   const dark=v!==null&&v<2.3,light=v!==null&&v>=3.1;
   grounding=pv!==null&&pv<2.0?(dark?9.3:light?7.6:8.5):warm.has(p.primary.family)?9.25:9.1;
   if(p.primary.family==='black')grounding=dark?8.6:7.0; // BOSS permits very dark brown/deep red; no universal ban
  }else if(colour.family==='navy'){grounding=['blue','navy','grey'].includes(p.primary.family)?9:8.6;}
  else if(colour.family==='sage')grounding=pv>=3?8.9:8;
  const decorative=/monogram|damier|two.tone|studd|metallic|woven.*canvas/.test(ss),busy=Math.max(...o.prominence)>.68;
  const restraint=decorative?(busy?7.3:8.2):9.3;
  let surface=/suede/.test(ss)?(!suit||!tied?9.25:8.7):9;
  // Source-backed examples allow suede with tailoring. Weather module decides wet suitability.
  return {score:r(clip(.38*formality+.40*grounding+.14*restraint+.08*surface)),formality,grounding,restraint,surface,colour,revision:REV,reason,price_or_brand_bonus:0,kind:'research_informed_shoe_context',measurements:false};
 }
 function watch(item,o,q){const w=inherited.watch(item,{...o,components:{...o.components,pattern_hierarchy:o.components.pattern_hierarchy}},q);return {...w,revision:REV,kind:'contextual_watch_preference_not_designer_grade'};}
 function complete(o,sh,wa){return {revision:REV,score:r(.87*o.score+.10*sh.score+.03*wa.score),clothing_score:o.score,clothing:copy(o.components),shoe:copy(sh),watch:copy(wa),weights:{clothing:.87,shoes:.10,watch:.03},research_rule_ids:['R1_VALUE','R2_PATTERN','R3_PALETTE','R4_SEPARATES','R5_FOOTWEAR','R6_CONTEXT'],explanation:o.reason,reasons:copy(o.reasons),cautions:copy(o.cautions),kind:'research_informed_local_rules_not_live_ai',measurement:false};}
 function signature(o){const p=o.profiles;return {topId:p.topwear.id,topFamily:p.topwear.primary.family,topPattern:p.topwear.pattern.quiet?'quiet':p.topwear.pattern.family,shirtId:p.shirt.id,shirtShade:p.shirt.primary.shade,shirtDepth:p.shirt.primary.value>=3.6?'light':p.shirt.primary.value>=2.3?'medium':'dark',shirtPattern:p.shirt.pattern.quiet?'quiet':p.shirt.pattern.family,tieFamily:p.tie?.primary.family||'NO_TIE',tiePattern:p.tie?(p.tie.pattern.quiet?'quiet':p.tie.pattern.family):'NO_TIE'};}
 function redundancy(e,selected,q){if(!selected.length)return 0;const a=signature(e.entry.preference);let max=0,sum=0;for(const old of selected){const b=signature(old.entry.preference);let n=0;for(const[k,w]of Object.entries({topFamily:.06,topPattern:.04,shirtShade:.23,shirtDepth:.06,shirtPattern:.12,tieFamily:.25,tiePattern:.12}))if(a[k]===b[k])n+=w;
  if(q.prefs.topwear.mode!=='item'&&a.topId===b.topId)n+=.12;if(q.prefs.shirt.mode!=='item'&&a.shirtId===b.shirtId)n+=.12;max=Math.max(max,n);sum+=n;}
  return r(.15*max+.10*sum/selected.length);}
 return Object.freeze({revision:REV,reference_templates:templates.length,clothing,shoe,watch,complete,signature,redundancy,matchesFamily:(id,f)=>{const a=get(id).primary;return f==='taupe'?a.shade==='taupe':f==='grey'?['grey','charcoal','stone'].includes(a.family):f==='pink'?['pink','mauve'].includes(a.family):a.family===f;},profile:id=>copy(get(id)),profiles:()=>[...profiles.values()].map(copy),curationBand:.25,maximumComplete:score=>.87*score+1.3,description:'Local wardrobe generator with published qualitative style guidance; all weights are disclosed heuristics, not live AI or designer-endorsed scores.'});
}
root.HEWRSResearchPreference=Object.freeze({create,revision:REV,colour:col,pattern:pat});
})(globalThis);
