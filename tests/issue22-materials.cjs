#!/usr/bin/env node
'use strict';
/* Registered-source ownership, material pixels and native compositor checks.
 * Photographic interpretation is reviewed separately on full-avatar boards.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,selection,digest,ROOT,WIDTH:W,HEIGHT:H}=require('./avatar-v3-fit-runtime.cjs');
const {SOURCES,protectedDetails,texAt}=require('../tools/build_issue22_materials.cjs');
let native;try{native=require('@napi-rs/canvas');}catch(_){native=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','@napi-rs/canvas'));}
const {createCanvas,loadImage}=native;
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'data/issue22-materials.json'),'utf8'));
const original=load({entrypoint:'avatar-v3-issue22-baseline.html'});
const corrected=load({entrypoint:'avatar-v3-issue22-baseline.html',extraModules:['data/issue22-materials.js','src/issue22-materials.js']});
async function pixels(name){const image=await loadImage(path.join(ROOT,name)),canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const result={width:image.width,height:image.height,data:Buffer.from(ctx.getImageData(0,0,image.width,image.height).data)};canvas.width=canvas.height=1;return result;}
function head(data,mask,baseline){const result=Buffer.alloc(W*600*4);for(let p=0;p<W*600;p++){const at=p*4;if(mask[at+3]===255&&mask.subarray(at,at+4).equals(baseline.subarray(at,at+4)))data.copy(result,at,at,at+4);}return result;}
async function main(){
 const result={schema:'hewrs.issue22.material-tests.v1',status:'PASS',checks:0,layers:[],renders:[],scope:Object.keys(SOURCES)};
 eq(Object.keys(manifest.bindings).length,9,'all six jackets and three paired trousers have explicit display binding');
 const tile={w:2,h:2,v:Float32Array.from([0,10,20,30])};
 for(const point of [[.5,.5],[1.5,1.5],[-.5,-.5],[200.5,-400.5]])eq(texAt(tile,...point),15,'fractional wrap has a finite continuous bilinear result');
 for(const x of [-200.01,-4,-.99,-.01,0,1.99,2,200.01])for(const y of [-.99,-.01,0,1.99,2])ok(Number.isFinite(texAt(tile,x,y))&&texAt(tile,x,y)>=0&&texAt(tile,x,y)<=30,'edge samples cannot introduce NaN black bands');
 for(const [id,layers]of Object.entries(SOURCES))for(const[kind,hash]of Object.entries(layers)){
  const row=manifest.bindings[hash];ok(row&&row.garment_id===id&&row.layer===kind,id+'/'+kind+' exact source ownership');
  eq(digest(fs.readFileSync(path.join(ROOT,row.source_url))),hash,id+'/'+kind+' original source is unchanged');
  eq(digest(fs.readFileSync(path.join(ROOT,row.display_url))),row.display_sha256,id+'/'+kind+' display has its own truthful digest');
  const [source,display]=await Promise.all([pixels(row.source_url),pixels(row.display_url)]);eq([display.width,display.height],[W,H],id+'/'+kind+' retains canvas');
  const alpha=Buffer.alloc(W*H),details=protectedDetails(id,kind);let changed=0,hardware=0,alphaChanges=0,transparentChanges=0,newBlack=0,opaque=0,sourceMean=[0,0,0],displayMean=[0,0,0];
  for(let p=0;p<W*H;p++){
   const at=p*4,a=source.data[at+3],b=display.data[at+3],x=p%W,y=Math.floor(p/W);alpha[p]=a;if(a!==b)alphaChanges++;
   if(a===0&&!source.data.subarray(at,at+4).equals(display.data.subarray(at,at+4)))transparentChanges++;
   if(!source.data.subarray(at,at+3).equals(display.data.subarray(at,at+3)))changed++;
   if(a===255){opaque++;for(let k=0;k<3;k++){sourceMean[k]+=source.data[at+k];displayMean[k]+=display.data[at+k];}
    if(source.data[at]+source.data[at+1]+source.data[at+2]>90&&display.data[at]+display.data[at+1]+display.data[at+2]===0)newBlack++;
    if(details.ellipses.some(([cx,cy,rx,ry])=>Math.hypot((x-cx)/rx,(y-cy)/ry)<=.9)){assert.ok(source.data.subarray(at,at+4).equals(display.data.subarray(at,at+4)),id+'/'+kind+' button/crest changed');hardware++;}
   }
  }
  eq(alphaChanges,0,id+'/'+kind+' every alpha byte exact');eq(transparentChanges,0,id+'/'+kind+' no background or silhouette edits');eq(digest(alpha),row.alpha_sha256,id+'/'+kind+' explicit alpha lock verified');
  ok(changed>100000,id+'/'+kind+' actual rendered fabric changed');eq(newBlack,0,id+'/'+kind+' no texture sample black-pixel defects');
  if(id.startsWith('B'))for(let k=0;k<3;k++)ok(Math.abs(sourceMean[k]/opaque-displayMean[k]/opaque)<.5,id+' source color mean preserved within half an RGB level');
  if(details.ellipses.length)ok(hardware>1000,id+' original opaque hardware fully protected');
  result.layers.push({id,layer:kind,source_sha256:hash,display_sha256:row.display_sha256,alpha_changed_pixels:alphaChanges,protected_hardware_pixels:hardware,changed_rgb_pixels:changed,linen_mean_delta:id.startsWith('B')?sourceMean.map((v,k)=>Math.round((displayMean[k]-v)/opaque*1000)/1000):null});
 }
 const contract=corrected.g.HEWRSIssue22Materials.contract;
 for(const mutate of [d=>d.scope.push('S05'),d=>delete d.bindings[Object.keys(d.bindings)[0]],d=>d.bindings[Object.keys(d.bindings)[0]].garment_id='S13',d=>d.bindings[Object.keys(d.bindings)[0]].measurements.alpha_changed_pixels=1,d=>d.bindings[Object.keys(d.bindings)[0]].rect=[1,0,W,H],d=>d.bindings[Object.keys(d.bindings)[0]].display_url='../avatar.png']){
  const modified=structuredClone(manifest);mutate(modified);assert.throws(()=>contract(modified,original.connection),/Issue22 material:/);checks++;
 }
 const legacySelection=selection('DS013','NO_TIE','S06'),legacyPlan=original.renderer.plan(legacySelection),correctedLegacyPlan=corrected.renderer.plan(legacySelection);
 eq(Array.isArray(legacyPlan),true,'legacy shirt/suit renderer exposes an array plan');
 eq(Array.isArray(correctedLegacyPlan),true,'material annotations preserve the legacy array API');
 eq(JSON.parse(JSON.stringify(correctedLegacyPlan)),JSON.parse(JSON.stringify(legacyPlan)),'legacy plan elements retain original exact descriptors');
 eq(correctedLegacyPlan.issue22_material_sources.length,2,'legacy array plan exposes truthful jacket and trouser display lineage');
 const avatar=original.connection.manifest.static.avatar;
 eq(digest(fs.readFileSync(path.join(ROOT,avatar.url))),avatar.sha256,'immutable approved avatar byte identity');
 const avatarMask=(await pixels(avatar.url)).data;
 for(const id of [...Object.keys(SOURCES),'S05','B03','B08','shirt-only']){
  const s=selection('DS001','NO_TIE',id),before=await original.capture(s),after=await corrected.capture(s),affected=Object.hasOwn(SOURCES,id);
  // Some opaque source-neck pixels are intentionally covered by registered
  // collar/jacket masks. Protect every source skin pixel actually exposed in
  // the approved baseline, without treating garment-over-neck as skin.
  eq(digest(head(after.rgba,avatarMask,before.rgba)),digest(head(before.rgba,avatarMask,before.rgba)),id+' every exposed opaque approved face/neck pixel preserved');
  if(affected){ok(after.rgba_sha256!==before.rgba_sha256,id+' native full-avatar uses new material');eq(after.result.issue22_material_sources.length,Object.keys(SOURCES[id]).length,id+' actual display provenance reported');eq(JSON.parse(JSON.stringify(after.plan.issue22_material_sources)),JSON.parse(JSON.stringify(after.result.issue22_material_sources)),id+' plan and committed display provenance agree');}
  else{eq(after.rgba_sha256,before.rgba_sha256,id+' unrelated full-avatar pixels exact');eq(after.result.issue22_material_sources,undefined,id+' unrelated render is pass-through');}
  result.renders.push({id,changed:affected,before_rgba_sha256:before.rgba_sha256,after_rgba_sha256:after.rgba_sha256,head_identical:true});if(global.gc)global.gc();
 }
 eq(original.storage.snapshot(),[],'original isolated storage untouched');eq(corrected.storage.snapshot(),[],'corrected isolated storage untouched');
 result.checks=checks;const out=path.join(ROOT,'evidence/issue22/material-tests.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log('ISSUE22_MATERIALS='+JSON.stringify({status:result.status,checks,layers:result.layers.length,renders:result.renders.length}));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
