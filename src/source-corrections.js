/* Current owner facts are versioned overlays; historical inputs remain byte-for-byte intact.
 * The raw-input SHA stays the history identity lock. A separate interpretation revision
 * invalidates dependent recommendation indexes. Never mutate photos or past wear IDs. */
(function(root){'use strict';
const d=root.HEWRS_OWNER_SOURCE_CORRECTIONS,copy=x=>structuredClone(x);
function apply(input){const out=copy(input),r=out.features.records.find(x=>x.id===d.item);if(!r)throw Error('Owner correction target absent');
 Object.assign(r,copy(d.fields),{source:{source_id:d.source_photo,authority:"current owner photograph and direct correction",confirmed_at:d.owner_confirmation,historical_source:copy(d.historical_feature.source)},current_source_revision:d.revision,current_interpretation:copy(d.interpretation)});return out;}
function profile(row,p){if(row.current_source_revision!==d.revision)return p;
 const out=copy(p);out.primary.value=d.interpretation.value;
 if('saturation'in out.primary)out.primary.saturation=d.interpretation.saturation;
 out.pattern.contrast=d.interpretation.contrast;out.pattern.quiet=d.interpretation.quiet;
 out.current_source_revision=d.revision;out.interpretation_basis=d.interpretation.basis;return out;}
root.HEWRSSourceCorrections=Object.freeze({revision:d.revision,apply,profile,record:()=>copy(d)});
})(globalThis);
