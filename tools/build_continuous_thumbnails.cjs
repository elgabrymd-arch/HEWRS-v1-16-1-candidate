#!/usr/bin/env node
'use strict';
/* Reproduce the sixteen continuous-shirt card descriptors from the real renderer.
 * Native avatar/accessory layers resolve to a temporary transparent bitmap.
 * Only the named descriptors and newly hash-addressed UI images may be written.
 * Usage: node tools/build_continuous_thumbnails.cjs --write [--review-dir PATH]
 *        node tools/build_continuous_thumbnails.cjs --check
 * With neither flag, render a review without changing repository files.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),W=996,H=2748,CARD_W=192,CARD_H=224,PADDING=8;
const IDS=['DS001','DS014','DS017','DS023','DS034','DS035','DS036','DS051'];
const MODES=[['no_tie','NO_TIE'],['tied','T001']];
const DATA='data/continuous-shirts.json',DATA_JS='data/continuous-shirts.js',RENDERER='src/continuous-shirts.js';
const MANIFEST='data/option-card-thumbnails.json',MANIFEST_JS='data/option-card-thumbnails.js';
const PREFIX='globalThis.HEWRS_OPTION_CARD_THUMBNAILS=';
const args=process.argv.slice(2),write=args.includes('--write'),check=args.includes('--check');
assert.ok(!(write&&check),'Choose --write or --check');
let reviewDir=null;
for(let i=0;i<args.length;i++){
 if(['--write','--check'].includes(args[i]))continue;
 if(args[i]==='--review-dir'&&args[i+1]){reviewDir=path.resolve(args[++i]);continue;}
 throw Error('Unknown or incomplete argument: '+args[i]);
}
let native,nativeModule;
try{nativeModule=require.resolve('@napi-rs/canvas');}catch(_){nativeModule=require.resolve(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','@napi-rs/canvas'));}
native=require(nativeModule);
const nativeVersion=JSON.parse(fs.readFileSync(path.join(path.dirname(nativeModule),'package.json'),'utf8')).version;
const {createCanvas,Image,ImageData}=native;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=name=>fs.readFileSync(path.join(ROOT,name));
const pinned=new Map([DATA,DATA_JS,RENDERER,MANIFEST,MANIFEST_JS].map(name=>[name,read(name)]));
const before=JSON.parse(pinned.get(MANIFEST)),continuous=JSON.parse(pinned.get(DATA));
const javascript=pinned.get(MANIFEST_JS).toString();
assert.ok(javascript.startsWith(PREFIX)&&javascript.endsWith(';\n'),'Unexpected thumbnail JavaScript wrapper');
assert.deepEqual(JSON.parse(javascript.slice(PREFIX.length,-2)),before,'Thumbnail JSON/JavaScript differ');
assert.equal(before.schema,'hewrs.option-card-thumbnails.v1_21_1');
assert.equal(before.source_lock,continuous.source_input_sha256);
assert.deepEqual([...continuous.ids].sort(),[...IDS].sort());
for(const id of IDS)for(const [mode]of MODES){const d=before.shirts[id][mode];assert.equal(d.source_key,id+'/'+mode);assert.equal(d.width,CARD_W);assert.equal(d.height,CARD_H);}

function makeCanvas(w=W,h=H){const c=createCanvas(w,h);c.dataset={};c.style={};return c;}
function pixels(c){return Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);}
function alphaBounds(c){
 const rgba=pixels(c);let x0=c.width,y0=c.height,x1=0,y1=0;
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(rgba[(y*c.width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
 assert.ok(x1>x0&&y1>y0,'Empty garment preview');return [x0,y0,x1,y1];
}
function collectSources(garment){
 const out=new Map();
 function add(d){if(!d)return;out.set(d.sha256,d);if(d.display_alpha_mask)add(d.display_alpha_mask);}
 for(const s of [garment.rear,garment.body,garment.front_collar,...(garment.cuffs||[])])if(s){add(s.type==='native'?s.layer:s.source);for(const p of s.source_patches||[])add(p.source);}
 return [...out.values()];
}
function withoutTargets(value){const out=structuredClone(value);for(const id of IDS)for(const [mode]of MODES)out.shirts[id][mode]=null;return out;}

// Locate JSON values by their structural path, leaving every other byte intact.
function descriptorSpans(text){
 let at=0;const out=new Map(),targets=new Set(IDS.flatMap(id=>MODES.map(([mode])=>'shirts/'+id+'/'+mode)));
 const ws=()=>{while(/\s/.test(text[at]||'')&&at<text.length)at++;};
 function string(){const start=at++;while(at<text.length){if(text[at]==='\\'){at+=2;continue;}if(text[at++]==='"')return JSON.parse(text.slice(start,at));}throw Error('Unterminated JSON string');}
 function value(parts){
  ws();const start=at,ch=text[at];
  if(ch==='{'){
   at++;ws();if(text[at]!=='}')while(true){assert.equal(text[at],'"');const key=string();ws();assert.equal(text[at++],':');value([...parts,key]);ws();if(text[at]===','){at++;ws();continue;}break;}
   assert.equal(text[at++],'}');
  }else if(ch==='['){
   at++;ws();let index=0;if(text[at]!==']')while(true){value([...parts,String(index++)]);ws();if(text[at]===','){at++;ws();continue;}break;}assert.equal(text[at++],']');
  }else if(ch==='"')string();
  else{while(at<text.length&&!/[\s,}\]]/.test(text[at]))at++;assert.ok(at>start,'Invalid JSON token');}
  const key=parts.join('/');if(targets.has(key))out.set(key,{start,end:at});
 }
 value([]);ws();assert.equal(at,text.length);assert.equal(out.size,16);return out;
}
function replaceDescriptors(text,next,pretty){
 const spans=descriptorSpans(text);let result=text;
 for(const [key,{start,end}]of [...spans].sort((a,b)=>b[1].start-a[1].start)){
  const [,id,mode]=key.split('/'),indent=text.slice(text.lastIndexOf('\n',start-1)+1,start).match(/^\s*/)[0];
  let replacement=JSON.stringify(next.shirts[id][mode],null,pretty?2:undefined);
  if(pretty)replacement=replacement.split('\n').map((line,n)=>(n?indent:'')+line).join('\n');
  result=result.slice(0,start)+replacement+result.slice(end);
 }
 const strip=raw=>{let text=raw;for(const {start,end}of [...descriptorSpans(raw).values()].sort((a,b)=>b.start-a.start))text=text.slice(0,start)+'null'+text.slice(end);return text;};
 assert.equal(strip(result),strip(text),'Bytes outside target descriptors changed');
 assert.deepEqual(JSON.parse(result),next);return result;
}
function writeImage(relative,bytes){
 const dest=path.join(ROOT,relative);
 if(fs.existsSync(dest))assert.ok(fs.readFileSync(dest).equals(bytes),'Hash-named image has different bytes: '+relative);
 else if(write){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
 else if(check)throw Error('Missing generated thumbnail: '+relative);
}

async function main(){
 const {g,connection:base}=require('../tests/tie-engine-loader.cjs').load();
 g.Image=Image;g.ImageData=ImageData;g.document={createElement(tag){assert.equal(tag,'canvas');return makeCanvas();}};
 vm.runInContext(pinned.get(DATA_JS).toString(),g,{filename:DATA_JS});
 assert.deepEqual(JSON.parse(JSON.stringify(g.HEWRS_CONTINUOUS_SHIRTS)),continuous,'Continuous JSON/JavaScript differ');
 vm.runInContext(pinned.get(RENDERER).toString(),g,{filename:RENDERER});
 const contract=g.HEWRSContinuousShirts.contract(g.HEWRS_CONTINUOUS_SHIRTS,base);
 const connection=Object.freeze({...base,continuousShirts:contract,assetPaths:Object.freeze({...base.assetPaths,...contract.assetPaths})});
 const overrideKeys=Object.keys(g.HEWRS_NON_SUIT_CARD_THUMBNAILS||{});
 assert.deepEqual(IDS.filter(id=>overrideKeys.includes(id)),[],'A target non-suit override would hide the corrected main descriptor');
 const blank=makeCanvas(),transparent='data:image/png;base64,'+blank.toBuffer('image/png').toString('base64');blank.width=blank.height=1;
 let allowed=new Set();const verifiedSources=new Map(),suppressed=new Set();
 function resolveUrl(d){
  if(allowed.has(d.sha256)){
   const relative=connection.assetPaths[d.sha256],file=path.resolve(ROOT,relative);
   assert.ok(file.startsWith(ROOT+path.sep),'Source escapes repository');
   if(!verifiedSources.has(d.sha256)){const bytes=fs.readFileSync(file);assert.equal(sha(bytes),d.sha256,'Changed garment source: '+relative);verifiedSources.set(d.sha256,{path:relative,sha256:d.sha256,size_bytes:bytes.length});}
   return file;
  }
  assert.deepEqual([...d.rect],[0,0,W,H],'Only native non-garment layers may be omitted');suppressed.add(d.sha256);return transparent;
 }
 const visible=makeCanvas(),renderer=g.HEWRSAtomicRenderer.create(visible,connection,{resolveUrl});
 const next=structuredClone(before),outputs=[],reportRows=[];
 if(reviewDir){fs.mkdirSync(path.join(reviewDir,'native'),{recursive:true});fs.mkdirSync(path.join(reviewDir,'thumbnails'),{recursive:true});}
 for(const id of IDS){
  const pair=[];
  for(const [mode,state]of MODES){
   const selection={shirtOnly:true,pantId:'PG002',shirtId:id,state,shoeId:'shoe-8',watchId:null},plan=renderer.plan(selection);
   assert.equal(plan.operation,'CONTINUOUS_SOURCE_SHIRT');assert.equal(plan.kind,'shirt-only');assert.equal(plan.jacket,undefined);
   const sources=collectSources(plan.garment);allowed=new Set(sources.map(d=>d.sha256));
   for(const d of [plan.avatar,plan.shoes,plan.pants,plan.tie,...plan.hands].filter(Boolean))assert.ok(!allowed.has(d.sha256),'Garment/accessory source collision');
   const result=await renderer.render(selection);assert.equal(result.status,'ready');assert.equal(result.source_result.legacy_shirt_layers_used,false);
   const frame=makeCanvas();frame.getContext('2d').putImageData(visible.getContext('2d').getImageData(0,0,W,H),0,0);
   const bounds=alphaBounds(frame),rgba=pixels(frame);assert.ok(bounds[1]>=350&&bounds[3]<1500,'Non-garment pixels escaped the shirt region');
   if(reviewDir)fs.writeFileSync(path.join(reviewDir,'native',id+'-'+mode+'.png'),frame.toBuffer('image/png'));
   pair.push({mode,state,frame,bounds,rgbaSha:sha(rgba),sources,geometrySha:sha(JSON.stringify(plan.garment)),primarySource:(plan.garment.body.source||plan.garment.body.layer).sha256});
  }
  const bounds=[Math.min(...pair.map(x=>x.bounds[0])),Math.min(...pair.map(x=>x.bounds[1])),Math.max(...pair.map(x=>x.bounds[2])),Math.max(...pair.map(x=>x.bounds[3]))];
  const cropW=bounds[2]-bounds[0],cropH=bounds[3]-bounds[1],scale=Math.min((CARD_W-2*PADDING)/cropW,(CARD_H-2*PADDING)/cropH),drawW=cropW*scale,drawH=cropH*scale;
  for(const item of pair){
   const card=makeCanvas(CARD_W,CARD_H),ctx=card.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   ctx.drawImage(item.frame,...[bounds[0],bounds[1],cropW,cropH],(CARD_W-drawW)/2,(CARD_H-drawH)/2,drawW,drawH);
   const bytes=card.toBuffer('image/png'),digest=sha(bytes),relative='ui/option-cards/'+digest+'.png';
   const sources=item.sources.map(d=>{const actual=verifiedSources.get(d.sha256);assert.ok(actual,'Garment source was not verified');return actual;}).sort((a,b)=>a.path.localeCompare(b.path));
   const descriptor={...next.shirts[id][item.mode],src:relative,sha256:digest,width:CARD_W,height:CARD_H,source_kind:'continuous_garment_preview',render_state:item.state,garment_mode:item.mode,source_sha256:item.primarySource,source_layers:sources,render_data_sha256:sha(pinned.get(DATA)),renderer_sha256:sha(pinned.get(RENDERER)),garment_geometry_sha256:item.geometrySha,native_rgba_sha256:item.rgbaSha,crop_xyxy:bounds,omitted_layers:['avatar','tie','pants','shoes','hands'],render_engine:'@napi-rs/canvas@'+nativeVersion};
   assert.equal(descriptor.source_key,id+'/'+item.mode);next.shirts[id][item.mode]=descriptor;
   const row={id,mode:item.mode,render_state:item.state,native_alpha_bounds:item.bounds,crop_xyxy:bounds,thumbnail_sha256:digest,src:relative,source_sha256:item.primarySource,native_rgba_sha256:item.rgbaSha};
   outputs.push({relative,bytes,card,id,mode:item.mode});reportRows.push(row);
   if(reviewDir)fs.writeFileSync(path.join(reviewDir,'thumbnails',id+'-'+item.mode+'.png'),bytes);
   item.frame.width=item.frame.height=1;
  }
  console.log(JSON.stringify({shirt:id,states:pair.map(x=>x.mode),crop_xyxy:bounds}));
 }
 renderer.cancel();visible.width=visible.height=1;
 assert.deepEqual(withoutTargets(next),withoutTargets(before),'Unrelated descriptors changed');
 const json=replaceDescriptors(pinned.get(MANIFEST).toString(),next,true),js=PREFIX+replaceDescriptors(javascript.slice(PREFIX.length,-2),next,false)+';\n';
 for(const [name,bytes]of pinned)assert.ok(read(name).equals(bytes),'Input changed during generation: '+name);
 for(const source of verifiedSources.values())assert.equal(sha(read(source.path)),source.sha256,'Source changed during generation: '+source.path);
 for(const output of outputs)writeImage(output.relative,output.bytes);
 if(check){assert.equal(read(MANIFEST).toString(),json,'Thumbnail JSON is stale');assert.equal(read(MANIFEST_JS).toString(),js,'Thumbnail JavaScript is stale');}
 if(write){fs.writeFileSync(path.join(ROOT,MANIFEST),json);fs.writeFileSync(path.join(ROOT,MANIFEST_JS),js);}
 const report={schema:'hewrs.continuous-garment-thumbnails.v1',status:check?'CHECK_PASSED':write?'WRITTEN':'PREVIEW_ONLY',ids:IDS,descriptor_count:outputs.length,unique_png_count:new Set(outputs.map(x=>x.relative)).size,card_size:[CARD_W,CARD_H],native_canvas:[W,H],renderer_sha256:sha(pinned.get(RENDERER)),render_data_sha256:sha(pinned.get(DATA)),input_source_lock:continuous.source_input_sha256,native_canvas_version:nativeVersion,non_target_descriptors_unchanged:true,non_target_manifest_bytes_unchanged:true,original_sources_unchanged:true,non_suit_override_target_ids:[],suppressed_native_source_count:suppressed.size,manifests:{[MANIFEST]:sha(json),[MANIFEST_JS]:sha(js)},frames:reportRows};
 if(reviewDir){
  const cellW=216,cellH=272,sheet=makeCanvas(cellW*4,cellH*4),ctx=sheet.getContext('2d');ctx.fillStyle='#18232f';ctx.fillRect(0,0,sheet.width,sheet.height);
  outputs.forEach((x,n)=>{const px=n%4*cellW,py=Math.floor(n/4)*cellH;ctx.fillStyle='#edf0f3';ctx.fillRect(px+6,py+6,cellW-12,cellH-12);ctx.fillStyle='#253245';ctx.font='bold 14px sans-serif';ctx.fillText(x.id+' / '+(x.mode==='no_tie'?'OPEN':'CLOSED'),px+12,py+26);ctx.drawImage(x.card,px+12,py+36);});
  fs.writeFileSync(path.join(reviewDir,'contact-sheet.png'),sheet.toBuffer('image/png'));sheet.width=sheet.height=1;
  fs.writeFileSync(path.join(reviewDir,'RESULT.json'),JSON.stringify(report,null,2)+'\n');
 }
 for(const x of outputs)x.card.width=x.card.height=1;
 console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
