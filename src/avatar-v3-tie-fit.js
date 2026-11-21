/* V3 display registration for every selectable physical tie.
 * Original suit inserts end at y788, before several jacket apertures close.
 * Use the SAME tie's existing full photographic display, keep the knot fixed,
 * and register its tip to the upper waistband. The selected original jacket
 * remains above the tie; no jacket is closed, repainted or made transparent.
 * Source descriptors identify immutable inputs; this module owns only their
 * documented display projection. Scores, identities and storage are untouched.
 */
(function(root){'use strict';
const previousConnection=root.HEWRSCleanConnection,previousLoader=root.HEWRSRenderImageLoader,previousRenderer=root.HEWRSAtomicRenderer;
const W=996,H=2748,TOP=467,KNOT_END=530,SOURCE_END=1188,TARGET_END=1211;
const IDS=Object.freeze(Array.from({length:47},(_,i)=>'T'+String(i+1).padStart(3,'0')));
const need=(value,message)=>{if(!value)throw Error('AVATAR_V3 tie fit: '+message);};
const spec=Object.freeze({revision:'AVATAR_V3_TIE_FIT_1',canvas:Object.freeze([W,H]),
  knot_anchor:Object.freeze([498,TOP]),knot_end:KNOT_END,
  source_body_rows:Object.freeze([KNOT_END,SOURCE_END]),
  target_body_rows:Object.freeze([KNOT_END,TARGET_END]),tip_y:TARGET_END-1,
  upper_waistband_y:1211,legacy_foreground_shirt_waistband_y:1251,
  bounds:Object.freeze([422,TOP,575,1251]),
  suit_source:'same_physical_tie_existing_full_non_suit_fidelity',
  method:'fixed_knot_single_body_projection_beneath_original_selected_jacket',
  source_files_changed:false,jacket_geometry_changed:false});
need(previousConnection?.create&&previousLoader?.create,'source connection and loader required');
need(root.HEWRSAvatarV3?.candidate?.avatar==='4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93',
  'approved V3 avatar required');
const sources=new Map();
const data=root.HEWRS_TIE_FIDELITY;
need(data?.schema==='hewrs.tie-fidelity.v1_17_2','registered fidelity sources required');
for(const id of IDS){
  const d=data.ties?.[id]?.layers?.non_suit;
  need(d?.rect?.join(',')===[0,0,W,H].join(',')&&data.assetPaths[d.sha256]===d.url,'full source absent: '+id);
  need(!sources.has(d.sha256),'ambiguous physical tie source');sources.set(d.sha256,id);
}
function project(image,descriptor){
  need(sources.has(descriptor.sha256),'unregistered tie source');
  need(descriptor.rect?.join(',')===[0,0,W,H].join(','),'tie source rectangle changed');
  need((image.naturalWidth||image.width)===W&&(image.naturalHeight||image.height)===H,'tie source dimensions changed');
  const end=descriptor.avatar_v3_tie_fit?.target_end||TARGET_END;
  need(end===1211||end===1251,'unregistered displayed waistband');
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  // Do not scale the photographic knot. Body coordinates have a monotone
  // small vertical scale, with its original pointed alpha contour retained.
  ctx.drawImage(image,0,0,W,KNOT_END,0,0,W,KNOT_END);
  ctx.drawImage(image,0,KNOT_END,W,SOURCE_END-KNOT_END,0,KNOT_END,W,end-KNOT_END);
  return canvas;
}
function registered(descriptor,end){
  return Object.freeze({...descriptor,avatar_v3_tie_fit:Object.freeze({revision:spec.revision,target_end:end})});
}
function connect(...args){
  const base=previousConnection.create(...args);
  need(base.avatarV3&&base.tieFidelity,'approved V3/fidelity connection required');
  const sourceById=Object.freeze(Object.fromEntries(IDS.map(id=>{
    const d=base.tieFidelity.replace(base.batch10.ties[id]);
    need(d.sha256===data.ties[id].layers.non_suit.sha256,'same-ID source mismatch: '+id);
    return [id,d];
  })));
  const assemblies=Object.freeze({...base.assemblies,forSelection(...selection){
    const manifest=base.assemblies.forSelection(...selection);
    for(const id of IDS){
      need(manifest.ties[id].display_layer.sha256===data.ties[id].layers.suit.sha256,'suit baseline source changed: '+id);
      manifest.ties[id].display_layer=registered(sourceById[id],TARGET_END);
    }
    return manifest;
  }});
  return Object.freeze({...base,assemblies,avatarV3TieFit:Object.freeze({spec,sourceById})});
}
root.HEWRSCleanConnection=Object.freeze({create:connect});
function create(visible,connection,options={}){
  // This selection scope belongs to ONE renderer instance, not to a shared
  // global connection. Every inherited plan snapshots its source descriptors
  // synchronously before image decoding; racing requests retain their own
  // target registration and cannot change another renderer's tie length.
  let end=TARGET_END;
  const registeredCache=new Map();
  const fidelity=Object.freeze({...connection.tieFidelity,replace(descriptor){
    const source=connection.tieFidelity.replace(descriptor);
    if(!source||!sources.has(source.sha256))return source;
    const key=source.sha256+'/'+end;
    if(!registeredCache.has(key))registeredCache.set(key,registered(source,end));
    return registeredCache.get(key);
  }});
  const scoped=Object.freeze({...connection,tieFidelity:fidelity});
  const inherited=previousRenderer.create(visible,scoped,options);
  function select(input){
    const s=connection.validateSelection(input),nonSuit=!!s.shirtOnly||!!s.blazerId;
    const continuous=connection.continuousShirts.ids.includes(s.shirtId);
    const row=connection.batch10.shirts[s.shirtId];
    const foreground=!!s.shirtOnly&&row?.shirt_only_trouser_ownership==='EXACT_EXISTING_TROUSER_LAYER_FOREGROUND_AT_WAIST';
    // The retained legacy full-shirt layer ends at row1250 over its pants;
    // continuous/foreground-pants and suit routes show the waistband at1211.
    // Match the displayed join without moving original shirt or trouser art.
    end=nonSuit&&!continuous&&!foreground?1251:TARGET_END;
    return s;
  }
  return Object.freeze({...inherited,
    async render(input){return inherited.render(select(input));},
    plan(input){return inherited.plan(select(input));},
    stats:()=>({...inherited.stats(),avatarV3TieFit:spec.revision})});
}
root.HEWRSAtomicRenderer=Object.freeze({create});
root.HEWRSRenderImageLoader=Object.freeze({create(options={}){
  const decode=options.decode||((image)=>image);
  return previousLoader.create({...options,decode:(image,descriptor)=>
    decode(sources.has(descriptor.sha256)?project(image,descriptor):image,descriptor)});
}});
root.HEWRSAvatarV3TieFit=Object.freeze({spec,ids:IDS,project});
})(globalThis);
