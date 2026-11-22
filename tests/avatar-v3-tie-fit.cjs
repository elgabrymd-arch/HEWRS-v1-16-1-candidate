#!/usr/bin/env node
'use strict';
/* Real source/geometry and renderer lifetime checks; this is not visual approval. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,selection,makeCanvas,digest,ROOT}=require('./avatar-v3-fit-runtime.cjs');
async function main(){
  const h=load(),g=h.g,c=h.connection,fit=g.HEWRSAvatarV3TieFit;
  assert.equal(fit.spec.revision,'AVATAR_V3_TIE_FIT_1');
  assert.equal(fit.ids.length,47);
  const originalInputs=digest(fs.readFileSync(path.join(ROOT,'data/inputs.json')));
  const originalFidelity=digest(fs.readFileSync(path.join(ROOT,'data/tie-fidelity.json')));
  const data=JSON.parse(fs.readFileSync(path.join(ROOT,'data/tie-fidelity.json'),'utf8'));
  const image=filename=>new Promise((resolve,reject)=>{const x=new g.Image();x.onload=()=>resolve(x);x.onerror=reject;x.src=filename;});
  const canvas=makeCanvas(),ctx=canvas.getContext('2d',{willReadFrequently:true});
  let verified=0,bindings=0,sharedAlpha=null;
  const rows=[];
  for(const id of fit.ids){
    const descriptor=c.avatarV3TieFit.sourceById[id],filename=h.resolveUrl(descriptor);
    assert.equal(descriptor.sha256,data.ties[id].layers.non_suit.sha256);
    assert.equal(digest(fs.readFileSync(filename)),descriptor.sha256,'immutable tie photograph/display bytes');
    const src=await image(filename),projected=fit.project(src,descriptor);
    ctx.clearRect(0,0,996,2748);ctx.drawImage(src,0,0);
    const oldKnot=Buffer.from(ctx.getImageData(0,0,996,530).data);
    const projectedCtx=projected.getContext('2d',{willReadFrequently:true});
    const knot=Buffer.from(projectedCtx.getImageData(0,0,996,530).data);
    assert.equal(digest(knot),digest(oldKnot),'photographic knot stays at its final collar anchor: '+id);
    const px=projectedCtx.getImageData(0,0,996,2748).data;
    let minY=2748,maxY=-1,minX=996,maxX=-1,holes=0;
    for(let y=0;y<2748;y++){
      let count=0;
      for(let x=0;x<996;x++)if(px[(y*996+x)*4+3]){
        count++;minY=Math.min(minY,y);maxY=Math.max(maxY,y);minX=Math.min(minX,x);maxX=Math.max(maxX,x);
      }
      if(y>=467&&y<=1210&&!count)holes++;
    }
    assert.equal(minY,467);assert.equal(maxY,1210);assert.equal(holes,0,'tie has no missing horizontal row');
    assert.ok(minX>=422&&maxX<575,'tie remains in the source-bounded placket area');
    assert.ok(px[(1210*996+498)*4+3]>0,'point meets upper waistband');
    const alpha=Buffer.alloc(996*2748);
    for(let i=3,n=0;i<px.length;i+=4,n++)alpha[n]=px[i];
    const alphaHash=digest(alpha);
    if(sharedAlpha===null)sharedAlpha=alphaHash;
    assert.equal(alphaHash,sharedAlpha,'all physical ties use identical tested opacity geometry');
    const legacy=fit.project(src,{...descriptor,avatar_v3_tie_fit:{revision:fit.spec.revision,target_end:1251}});
    const legacyCtx=legacy.getContext('2d',{willReadFrequently:true});
    assert.ok(legacyCtx.getImageData(498,1250,1,1).data[3]>0,'legacy visible hem receives the complete pointed tip');
    assert.ok(legacyCtx.getImageData(422,1251,153,1).data.every(v=>v===0),'legacy tie stops at the displayed waistband');
    legacy.width=legacy.height=1;
    for(const suit of c.limits.suits){
      const manifest=c.assemblies.forSelection(suit,'shoe-8','DS003');
      assert.equal(manifest.ties[id].display_layer.sha256,descriptor.sha256,'suit keeps the exact physical tie');bindings++;
    }
    rows.push({id,source_sha256:descriptor.sha256,bounds:[minX,minY,maxX+1,maxY+1],empty_rows:holes});
    projected.width=projected.height=1;verified++;
    if(global.gc)global.gc();
  }
  assert.equal(c.manifest.ties.T001.display_layer.sha256,
    JSON.parse(fs.readFileSync(path.join(ROOT,'data/inputs.json'),'utf8')).manifest.ties.T001.display_layer.sha256,
    'original input manifest is not a display mutation target');
  assert.equal(digest(fs.readFileSync(path.join(ROOT,'data/inputs.json'))),originalInputs);
  assert.equal(digest(fs.readFileSync(path.join(ROOT,'data/tie-fidelity.json'))),originalFidelity);
  // A generated tie canvas belongs to the instance's loader cache. Reusing the
  // legacy suit must not dispose it or retain pixels from another selected tie.
  const first=await h.capture(selection('DS003','T001','S11'));
  await h.capture(selection('DS003','T017','S11'));
  const again=await h.capture(selection('DS003','T001','S11'));
  assert.equal(again.rgba_sha256,first.rgba_sha256,'legacy cached tie is not destroyed after drawing');
  const before=digest(Buffer.from(h.canvas.getContext('2d').getImageData(0,0,996,2748).data));
  const old=h.renderer.render(selection('DS003','T003','S11'));
  const newest=h.renderer.render(selection('DS003','T047','S11'));
  assert.equal(digest(Buffer.from(h.canvas.getContext('2d').getImageData(0,0,996,2748).data)),before,'no incomplete frame committed');
  const results=await Promise.all([old,newest]);assert.equal(results[0].cancelled,true);assert.equal(results[1].status,'ready');
  assert.equal(h.renderer.last().state,'T047');
  const fresh=load(),complete=await fresh.capture(selection('DS003','T047','S11'));
  assert.equal(digest(Buffer.from(h.canvas.getContext('2d').getImageData(0,0,996,2748).data)),complete.rgba_sha256,
    'latest cancelled/restarted tie equals a fresh complete frame');
  for(const [shirt,mode,end]of [['DS003','B03',1251],['DS003','shirt-only',1211],['DS002','shirt-only',1251],['DS034','B03',1211]]){
    const plan=h.plan(selection(shirt,'T001',mode));
    assert.equal(plan.tie.avatar_v3_tie_fit.target_end,end,'per-plan visible waistband: '+shirt+'/'+mode);
  }
  console.log(JSON.stringify({status:'PASS_SOURCE_GEOMETRY_AND_LIFETIME_NOT_VISUAL_APPROVAL',ties:verified,suit_bindings:bindings,
    same_id_sources:true,knots_unscaled:true,body_continuous:true,tip_y:1210,source_files_unchanged:true,
    legacy_tip_y:1250,shared_alpha_sha256:sharedAlpha,cached_repeat:true,rapid_selection_atomic:true,rows},null,2));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
