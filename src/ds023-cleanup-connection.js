/* V1.16.2: bounded DS023 non-suit alpha-only repair. No ID/history/score change. */
(function(root){'use strict';
const prior=root.HEWRSCleanConnection,need=(ok,msg)=>{if(!ok)throw Error(msg);};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function create(inputs){
 const base=prior.create(inputs),d=structuredClone(root.HEWRS_DS023_CLEANUP);
 need(d?.schema==='hewrs.ds023-alpha-composite.v1_16_2'&&d.id==='DS023'&&d.history_id===base.records.DS023.history_id,'Invalid exact DS023 correction identity');
 need(d.canvas.join(',')==='996,2748'&&d.source_input_sha256===root.HEWRS_INPUT_SHA256,'Changed DS023 geometry/source lock');
 need(base.batch10.shirts.DS023.source_sha256===d.owner_source_sha256,'Changed DS023 uploaded donor');
 need(d.shirt_only_trouser_ownership==='EXACT_EXISTING_TROUSER_LAYER_FOREGROUND_AT_WAIST','Unknown trouser compositing operation');
 for(const mode of ['tied','no_tie']){
  const m=d.modes[mode],old=base.batch10.shirts.DS023.modes[mode].base;
  need(JSON.stringify(m.baseline)===JSON.stringify(old),'DS023 correction baseline mismatch');
  const q=m.base;need(q.rect?.join(',')==='0,0,996,2748'&&/^[a-f0-9]{64}$/.test(q.sha256),'Malformed corrected body descriptor');
  need(d.assetPaths[q.sha256]==='assets/'+q.sha256+'.png'&&q.url===d.assetPaths[q.sha256],'Unbound corrected body image');
 }
 need(Object.keys(d.assetPaths).length===2,'Unexpected correction payload');
 return Object.freeze({...base,ds023Cleanup:freeze(d),assetPaths:Object.freeze({...base.assetPaths,...d.assetPaths})});
}
root.HEWRSCleanConnection=Object.freeze({create});
})(globalThis);
