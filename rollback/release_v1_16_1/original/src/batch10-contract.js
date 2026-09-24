/* V1.16: exact original-cohort source registrations, not a replacement wardrobe.
 * V11's 32-ID manifest is provenance only; these sixteen use current Active50
 * components. No garment approval, score, history or frozen source is replaced.
 */
(function(root){'use strict';
const EXPECTED=['DS002','DS004','DS005','DS006','DS007','DS008','DS015','DS018','DS019','DS021','DS022','DS023','DS024','DS025','DS027','DS047'];
const need=(v,m)=>{if(!v)throw Error(m);};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function contract(inputs){
 const d=structuredClone(root.HEWRS_BATCH10);
 need(d?.schema==='hewrs.non-suit-batch16.v1_16'&&d.canvas.join(',')==='996,2748','Missing batch source registration');
 need(d.source_input_sha256===root.HEWRS_INPUT_SHA256,'Changed current input identity');
 need(JSON.stringify(d.ids)===JSON.stringify(EXPECTED)&&Object.keys(d.shirts).length===16,'Changed batch identity universe');
 function descriptor(v){need(v&&/^[a-f0-9]{64}$/.test(v.sha256)&&v.rect?.join(',')==='0,0,996,2748','Malformed batch layer');need(d.assetPaths[v.sha256]||inputs.assets[v.sha256],'Unbound batch layer');}
 for(const id of d.ids){const r=d.shirts[id],s=inputs.manifest.shirts[id];need(r.id===id&&r.history_id==='shirt-'+id&&s,'Mismatched batch ID');
  need(r.states.length===48&&r.states.every(x=>s.available_modes.includes(x)),'Changed source tie universe');
  for(const mode of ['no_tie','tied']){const p=r.modes[mode];descriptor(p.base);for(const role of ['left','right','left_cuff','right_cuff']){descriptor(p[role]);
   const current=s.states[mode][role];
   if(p[role].sha256!==current.sha256)need(['left_cuff','right_cuff'].includes(role)&&['DS002','DS004','DS005','DS015','DS022'].includes(id)&&r.derived_cuffs_for_empty_current_components[role]?.sha256===p[role].sha256,'Replaced current component without declared source derivation');
  }}
 }
 need(Object.keys(d.ties).length===47,'Incomplete tie registrations');
 for(let n=1;n<=47;n++){const id='T'+String(n).padStart(3,'0');need(inputs.manifest.ties[id],'Unknown tie ID');descriptor(d.ties[id]);}
 for(const [hash,path]of Object.entries(d.assetPaths))need(path==='assets/'+hash+'.png','Unexpected registration asset path');
 return freeze(d);
}
root.HEWRSBatch10=Object.freeze({contract});
})(globalThis);
