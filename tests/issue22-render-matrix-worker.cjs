#!/usr/bin/env node
'use strict';
/* Actual shipped runtime and same-renderer baseline. Every supported active
 * shirt/state is rendered with the seven targets; unrelated garments must
 * remain pixel-identical, including the frozen head and hands. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,selection,digest,crop,ROOT,WIDTH,HEIGHT}=require('./avatar-v3-fit-runtime.cjs');
const TARGETS=['S06','S13','S14','B01','B06','B10','B08'],LINEN=new Set(['B01','B06','B10']);
// The material PNGs retain their original alpha. Only the S06 display
// contour correction may differ in the final frame, inside these exact
// independently declared rectangles; all other garments remain exact.
const S06_CONTOUR_BOUNDS=[[620,410,100,90],[60,460,280,720],[660,460,300,720]];
function alphaDifference(a,b,allowed=[]){
 let changed=0,outside=0;
 for(let i=3;i<a.length;i+=4)if(a[i]!==b[i]){
  changed++;const pixel=(i-3)/4,x=pixel%WIDTH,y=Math.floor(pixel/WIDTH);
  if(!allowed.some(([left,top,width,height])=>x>=left&&x<left+width&&y>=top&&y<top+height))outside++;
 }
 return {changed,outside};
}
function pixelDifference(a,b){let count=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])count++;return count;}
const region=(rgba,start,end)=>rgba.subarray(start*WIDTH*4,end*WIDTH*4);
async function main(){
 const args=process.argv.slice(2),options={shard:1,shards:1,offset:0,limit:8};
 for(let n=0;n<args.length;n+=2){assert.ok(['--shard','--shards','--offset','--limit'].includes(args[n]),'Unknown matrix option');options[args[n].slice(2)]=Number(args[n+1]);}
 assert.ok(Number.isInteger(options.shards)&&Number.isInteger(options.shard)&&options.shards>0&&options.shard>0&&options.shard<=options.shards,'Invalid one-based shard');
 const targetCount=Array.from({length:534},(_,n)=>n).filter(n=>n%options.shards===options.shard-1).length;
 const assigned=(n,control=false)=>n%options.shards===options.shard-1&&Math.floor(n/options.shards)+(control?targetCount:0)>=options.offset&&Math.floor(n/options.shards)+(control?targetCount:0)<options.offset+options.limit;
 const output=path.join(ROOT,'evidence/issue22/native',...(options.shards>1?['shard-'+options.shard]:[]));fs.mkdirSync(output,{recursive:true});
 const old=load({entrypoint:'avatar-v3-issue22-baseline.html'}),now=load();
 assert.equal(old.connection.manifest.static.avatar.sha256,now.connection.manifest.static.avatar.sha256);
 const allShirts=[...now.connection.limits.shirt_ids].sort(),rows=[],controls=[];
 let changes=0,denials=0,targetIndex=0,controlIndex=0;
 for(const top of TARGETS)for(const shirt of allShirts){
  const states=LINEN.has(top)||now.connection.records[shirt].no_tie_only?['NO_TIE']:['NO_TIE','T001'];
  for(const state of states){
   if(!assigned(targetIndex++))continue;
   const s=selection(shirt,state,top),before=await old.capture(s),after=await now.capture(s);
   assert.deepEqual(JSON.parse(JSON.stringify(after.selection)),s);
   const alpha=alphaDifference(before.rgba,after.rgba,top==='S06'?S06_CONTOUR_BOUNDS:[]);
   if(top==='S06'){
    assert.ok(alpha.changed>0,top+'/'+shirt+'/'+state+' S06 contour correction must change final alpha');
    assert.equal(alpha.outside,0,top+'/'+shirt+'/'+state+' S06 contour alpha bounded');
   }else assert.equal(alpha.changed,0,top+'/'+shirt+'/'+state+' exact final alpha');
   assert.ok(region(before.rgba,0,350).equals(region(after.rgba,0,350)),top+' frozen head');
   assert.ok(region(before.rgba,2600,HEIGHT).equals(region(after.rgba,2600,HEIGHT)),top+' footwear');
   if(top.startsWith('B'))assert.ok(region(before.rgba,1700,HEIGHT).equals(region(after.rgba,1700,HEIGHT)),top+' unchanged trousers and shoes');
   const count=pixelDifference(before.rgba,after.rgba);assert.ok(count>0,top+' correction must visibly change actual frame');changes+=count;
   rows.push({selection:s,rgba_sha256:after.rgba_sha256,baseline_rgba_sha256:before.rgba_sha256,changed_pixels:count,
    alpha_changed_pixels:alpha.changed,alpha_changed_outside_authorized_contours:alpha.outside,
    head_unchanged:true,footwear_unchanged:true,elapsed_ms:after.elapsed_ms});
   if(shirt==='DS001'||shirt==='DS013'){
    const label=[top,shirt,state].join('-');
    for(const [name,png]of [['before',before.png],['after',after.png]]){
     const dir=path.join(output,name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,label+'.png'),png);
    }
    const dir=path.join(output,'phone');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,label+'.png'),crop(now.canvas,[0,0,WIDTH,HEIGHT],360));
   }
   if(rows.length%25===0)console.log('TARGET_RENDERS '+rows.length+' '+top+' '+shirt+' '+state);
   if(global.gc)global.gc();
  }
 }
 const tops=[...now.connection.limits.suits,...now.connection.blazerConnection.availableIds,'shirt-only'].filter(id=>!TARGETS.includes(id));
 for(const top of tops)for(const shirt of ['DS001','DS013','DS027','DS035'])for(const state of top==='B11'?['NO_TIE']:['NO_TIE','T001']){
  if(!assigned(controlIndex++,true))continue;
  const s=selection(shirt,state,top),a=await old.capture(s),b=await now.capture(s);
  assert.equal(b.rgba_sha256,a.rgba_sha256,'Unrelated full-avatar pixels changed: '+top+'/'+shirt+'/'+state);
  controls.push({selection:s,rgba_sha256:b.rgba_sha256,unchanged:true});
  if(controls.length%25===0)console.log('CONTROL_RENDERS '+controls.length+' '+top);
  if(global.gc)global.gc();
 }
 if(options.offset===0)for(const top of LINEN)for(let n=1;n<=47;n++){
  const s=selection('DS001','T'+String(n).padStart(3,'0'),top),before=Buffer.from(now.canvas.getContext('2d').getImageData(0,0,WIDTH,HEIGHT).data);
  assert.throws(()=>now.renderer.plan(s),error=>error.code==='HEWRS_LINEN_NO_TIE');
  await assert.rejects(now.renderer.render(s),error=>error.code==='HEWRS_LINEN_NO_TIE');
  assert.ok(before.equals(Buffer.from(now.canvas.getContext('2d').getImageData(0,0,WIDTH,HEIGHT).data)),'Prohibited tied request painted pixels');denials++;
 }
 assert.equal(targetIndex,534,'Complete target shirt/state universe');
 assert.equal(controlIndex,212,'Complete unrelated garment/control universe');
 assert.equal(rows.length,Array.from({length:targetIndex},(_,i)=>i).filter(i=>assigned(i)).length,'Every assigned target rendered');
 assert.equal(controls.length,Array.from({length:controlIndex},(_,i)=>i).filter(i=>assigned(i,true)).length,'Every assigned unrelated control rendered');
 const result={schema:'hewrs.issue22.native-render-matrix.v1',status:'PASS',runtime:now.metadata,
  shard:options.shard,shards:options.shards,offset:options.offset,limit:options.limit,total_target_cases:targetIndex,total_control_cases:controlIndex,
  target_renders:rows.length,unrelated_control_renders:controls.length,prohibited_tie_render_cases:denials,
  display_alpha_contract:{S06:{policy:'bounded_contour_correction',bounds:S06_CONTOUR_BOUNDS},other_garments:'exact_baseline_alpha',
   material_png_alpha:'exact_source_alpha; independently verified by issue22-materials.cjs'},
  unchanged_avatar_head:true,unchanged_footwear:true,
  corrected_pixels_total:changes,rows,controls,visual_acceptance:'separate independent review of captured full avatars'};
 fs.writeFileSync(path.join(output,'batch-'+String(options.offset).padStart(4,'0')+'.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,target_renders:rows.length,unrelated_control_renders:controls.length,prohibited_tie_render_cases:denials}));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
