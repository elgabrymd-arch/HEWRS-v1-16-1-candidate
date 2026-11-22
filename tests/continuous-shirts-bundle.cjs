#!/usr/bin/env node
'use strict';
/* Execute the real entrypoint's script dependencies and compiled engine prefix
 * in their shipped order. The application DOM remains a separate browser gate.
 * This catches connection-wrapper ordering bugs hidden by test-only insertion. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),baseline=JSON.parse(fs.readFileSync(path.join(ROOT,'CONTINUOUS_CANDIDATE.json'),'utf8'));
const metadata=JSON.parse(execFileSync('python3',[path.join(ROOT,'tools/verify_active_delivery.py'),'--describe'],{cwd:ROOT,encoding:'utf8'}));
assert.ok(['continuous','avatar-v3'].includes(metadata.kind),'recognized active continuous-shirt delivery');
assert.equal(metadata.continuous_runtime||metadata.runtime,baseline.runtime,'exact continuous baseline runtime');
assert.equal(metadata.continuous_runtime_sha256||metadata.runtime_sha256,baseline.runtime_sha256,'exact continuous baseline hash');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const code=fs.readFileSync(path.join(ROOT,metadata.runtime),'utf8');assert.equal(digest(code),metadata.runtime_sha256,'compiled runtime hash');
for(const [name,sha]of Object.entries(baseline.modules))assert.equal(digest(fs.readFileSync(path.join(ROOT,name))),sha,'compiled module is current: '+name);
const application='/* PREVIEW SOURCE: src/outfit-refill-application.js */',end=code.indexOf(application);assert.ok(end>0&&code.indexOf(application,end+1)<0,'unique compiled application boundary');
const markers=['/* SOURCE: src/mixed-renderer.js */','/* CONTINUOUS SHIRT SOURCE: data/continuous-shirts.js */','/* CONTINUOUS SHIRT SOURCE: src/continuous-shirts.js */','/* SOURCE: src/owner-feedback-integration.js */','/* SOURCE: src/tie-fidelity.js */'];
if(metadata.kind==='avatar-v3'){
 markers.splice(3,0,'/* ISOLATED AVATAR_V3 SOURCE: src/avatar-v3.js */','/* V3 SOURCE-BOUND COLLAR FIT: src/avatar-v3-collar-fit.js */');
 markers.push('/* V3 ISSUE 19 SOURCE: src/avatar-v3-tie-fit.js */','/* V3 ISSUE 19 SOURCE: src/avatar-v3-shirt-collar-fit.js */','/* ISOLATED V3 POSE: src/avatar-v3-pose.js */','/* V3 ISSUE 19 SOURCE: src/avatar-v3-cuff-fit.js */');
}
const positions=markers.map(marker=>code.indexOf(marker));assert.ok(positions.every((p,i)=>p>=0&&p<end&&(!i||p>positions[i-1])),'real wrapper dependency order');
let native;try{native=require('@napi-rs/canvas');}catch(_){native=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','@napi-rs/canvas'));}
const {createCanvas,Image,ImageData}=native;function canvas(){const c=createCanvas(996,2748);c.dataset={};return c;}
const values=new Map(),storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(k)};
const g=vm.createContext({console,setTimeout,clearTimeout,URL,URLSearchParams,AbortController,performance,localStorage:storage,crypto:crypto.webcrypto,Image,ImageData});
vm.runInContext('globalThis.structuredClone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));',g);
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(m=>m[1].split('?')[0]);
g.document={createElement:()=>canvas(),documentElement:{dataset:{avatarProfile:html.match(/\bdata-avatar-profile="([^"]+)"/)?.[1]}}};
const runtimeIndex=scripts.indexOf(metadata.runtime);assert.ok(runtimeIndex>=0,'entrypoint selects the compiled candidate');
for(const name of scripts.slice(0,runtimeIndex))vm.runInContext(fs.readFileSync(path.join(ROOT,name),'utf8'),g,{filename:name});
vm.runInContext(code.slice(0,end),g,{filename:metadata.runtime+'#engine-prefix'});
const connection=g.HEWRSCleanConnection.create(g.HEWRS_INPUTS);
assert.equal(connection.continuousShirts.ids.length,8);assert.equal(connection.tieFidelity.ids.length,47);assert.equal(typeof connection.ownerFeedback.set,'function');
if(metadata.kind==='avatar-v3'){assert.equal(connection.avatarV3.production_integrated,true);assert.equal(g.HEWRSAvatarV3.kind,'INTEGRATED');}
const feedback=g.HEWRSOutfitFeedback.create({storage,validateSelection:s=>connection.validateSelection(s)}),ties=g.HEWRSTieFeedback.create({storage,feedback:g.HEWRSOutfitFeedback,validateSelection:s=>connection.validateSelection(s)});
const gate={refresh(){const a=feedback.refresh(),b=ties.refresh();return {...a,active:[...a.active,...b.active],token:a.token+'\n'+b.token};},snapshot(){return this.refresh();},match(s,c){const a=feedback.match(s,c),b=ties.match(s,c);return {allowed:a.allowed&&b.allowed,reasons:[...a.reasons,...b.reasons]};},assertCurrent(token){if(this.refresh().token!==token)throw Error('Synthetic feedback changed');}};connection.ownerFeedback.set(gate);
const visible=canvas(),renderer=g.HEWRSAtomicRenderer.create(visible,connection,{resolveUrl:d=>path.join(ROOT,connection.assetPaths[d.sha256]||d.url)});
const base={shoeId:'shoe-8',watchId:null},frames=[{...base,shirtOnly:true,pantId:'PG002',shirtId:'DS023',state:'NO_TIE'},{...base,blazerId:'B03',pantId:'PG002',shirtId:'DS001',state:'T001'},{...base,suitId:'S05',shirtId:'DS035',state:'T001'}];
async function main(){
 const results=[];for(const selected of frames){
  const before=performance.now(),result=await renderer.render(selected),plan=renderer.plan(selected);
  assert.equal(result.status,'ready');assert.equal(plan.operation,'CONTINUOUS_SOURCE_SHIRT');assert.equal(plan.avatar.sha256,metadata.avatar_sha256);assert.equal(result.source_result.legacy_shirt_layers_used,false);
  if(selected.state!=='NO_TIE')assert.equal(plan.tie.sha256,connection.tieFidelity.replace(connection.batch10.ties[selected.state]).sha256);
  results.push({selection:selected,rgba_sha256:digest(Buffer.from(visible.getContext('2d').getImageData(0,0,996,2748).data)),elapsed_ms:Math.round(performance.now()-before)});if(global.gc)global.gc();
 }
 console.log(JSON.stringify({status:'PASS',type:'COMPILED_ENGINE_PREFIX_NATIVE_SMOKE_NOT_BROWSER_APPROVAL',delivery:metadata.kind,runtime:metadata.runtime,continuous_baseline_runtime:baseline.runtime,compiled_wrapper_order:markers,continuous_ids:[...connection.continuousShirts.ids],tie_fidelity_preserved:true,owner_feedback_preserved:true,frames:results},null,2));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
