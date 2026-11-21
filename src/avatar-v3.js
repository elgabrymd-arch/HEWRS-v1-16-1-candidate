/* AVATAR_V3 persistent source profile: replace native avatar/hand descriptors.
 * Immutable V2 remains available as the exact comparison and rollback profile.
 * The primary entrypoint identifies promotion; the review page stays a preview.
 */
(function(root){'use strict';
const previous=root.HEWRSCleanConnection,clone=x=>structuredClone(x);
const integrated=root.document?.documentElement?.dataset?.avatarProfile==='AVATAR_V3';
const need=(p,m)=>{if(!p)throw Error('AVATAR_V3: '+m);};
const V2=Object.freeze({
 avatar:'a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d',
 left_hand:'8f7dcd492af271648ab6fdad83ca6cd401177aac05317d536cdb4b44149c4e34',
 right_hand:'3cd3d8ec5d3e66dcf9cd1e525e952e87a1057f968e846f453f314de65669d3d9',
});
const V3=Object.freeze({
 avatar:'4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93',
 left_hand:'26af452854f6f89c86617d83e9848ae71922d2ff4701877e7903f59c55ebb2b8',
 right_hand:'cfca4394b3d208184fef4f267671af834432ac2f6bd89acea83242a9e118863b'
});
const names=Object.freeze(['avatar','left_hand','right_hand']);
const desc=n=>Object.freeze({url:'assets/'+V3[n]+'.png',sha256:V3[n],rect:[0,0,996,2748],
  role:'AVATAR_V3_SOURCE_'+n.toUpperCase()});
const target=Object.freeze(Object.fromEntries(names.map(n=>[n,desc(n)])));
const hands=Object.freeze([target.left_hand,target.right_hand]);
function checkPair(pair,label){
 need(Array.isArray(pair)&&pair.length===2&&pair[0]?.sha256===V2.left_hand&&pair[1]?.sha256===V2.right_hand,label+' differs from V2 registered hands');
}
function create(...args){
 const c=previous.create(...args);need(c.manifest?.static?.avatar?.sha256===V2.avatar,'immutable V2 avatar missing');
 for(const n of names)need(c.manifest.static[n]?.sha256===V2[n],'immutable V2 '+n+' missing');
 const originalAssetPaths=c.assetPaths;
 for(const n of names){need(!Object.hasOwn(originalAssetPaths,V3[n]),'V3 hash already mapped');}
 const assets=Object.freeze({...originalAssetPaths,...Object.fromEntries(names.map(n=>[V3[n],target[n].url]))});
 const stat=Object.freeze({...c.manifest.static,...target});
 const manifest=Object.freeze({...c.manifest,static:stat});
 const assemblies=Object.freeze({...c.assemblies,forSelection:(...a)=>{
  const m=c.assemblies.forSelection(...a);
  for(const n of names)need(m.static[n]?.sha256===V2[n],'suit assembly '+n+' changed');
  return {...m,static:{...m.static,...target}};
 }});
 const bdata=c.blazerConnection?.data,a=bdata?.assembly;
 checkPair(a?.hands,'blazer');
 const blazerData=Object.freeze({...bdata,assembly:Object.freeze({...a,hands})});
 const blazer=Object.freeze({...c.blazerConnection,data:blazerData});
 const sdata=c.shirtOnlyConnection?.data;need(sdata?.avatar?.sha256===V2.avatar,'shirt-only avatar changed');
 const ss={};
 for(const [id,row] of Object.entries(sdata.shirts)){
  checkPair(row.hands,'shirt-only '+id);
  ss[id]={...row,hands};
 }
 const shirtOnlyData=Object.freeze({...sdata,avatar:target.avatar,shirts:Object.freeze(ss)});
 const shirtOnly=Object.freeze({...c.shirtOnlyConnection,data:shirtOnlyData});
 const source=c.continuousShirts, masks={};
 for(const [id,m] of Object.entries(source?.jacket_masks||{})){
  if(m.hand_source_sha256){
   need(m.hand_source_sha256.join(',')===[V2.left_hand,V2.right_hand].join(','),'jacket '+id+' hand source lock differs');
   masks[id]={...m,hand_source_sha256:[V3.left_hand,V3.right_hand],
     v2_hand_source_sha256:[V2.left_hand,V2.right_hand]};
  } else masks[id]=m;
 }
 const continuous=Object.freeze({...source,jacket_masks:Object.freeze(masks)});
 return Object.freeze({...c,manifest,assemblies,blazerConnection:blazer,shirtOnlyConnection:shirtOnly,
  continuousShirts:continuous,assetPaths:assets,
  avatarV3:Object.freeze({source_sha256:V2.avatar,sha256:V3.avatar,
    hands:[V3.left_hand,V3.right_hand],revision:'AVATAR_V3',
    production_integrated:integrated,source_profile:'AVATAR_V3'})});
}
need(previous?.create,'source connection missing');
root.HEWRSCleanConnection=Object.freeze({create});
root.HEWRSAvatarV3=Object.freeze({source:V2,candidate:V3,kind:integrated?'INTEGRATED':'REVIEW',
  terms:'Persistent V3 source profile with immutable V2 comparison sources'});
})(globalThis);
