'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function memoryStorage(){const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(k)};}
function load({storage=memoryStorage(),baseline=false}={}){
 const context=vm.createContext({console,setTimeout,clearTimeout,URL,URLSearchParams,AbortController,performance,localStorage:storage,crypto:require('node:crypto').webcrypto});
 // All engine inputs/records in these tests are JSON data. Clone them inside
 // their realm: injecting Node's structuredClone instead gives host prototypes
 // to plain records, which the existing feedback validator correctly refuses.
 // The Chromium test exercises the browser's native structuredClone separately.
 vm.runInContext('globalThis.structuredClone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));',context);
 const paths=JSON.parse(fs.readFileSync(path.join(root,'tools/build.py'),'utf8').match(/SCRIPTS=(\[[^\n]+\])/)[1].replaceAll("'",'"'));
 for(const name of ['src/tie-exposure.js','src/tie-feedback.js','src/render-image-loader.js',...paths.filter(p=>p!=='src/application.js')]){
  const candidate=name==='src/automatic-engine.js'?'src/outfit-refill-engine.js':name;
  const source=baseline&&name==='src/automatic-engine.js'?cp.execFileSync('git',['show','febe4148fc0b27ee2018d84408714ee1fe712015:src/outfit-refill-engine.js'],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024}):fs.readFileSync(path.join(root,candidate),'utf8');
  vm.runInContext(source,context,{filename:candidate});
 }
 const connection=context.HEWRSCleanConnection.create(context.HEWRS_INPUTS);
 const feedback=context.HEWRSOutfitFeedback.create({storage,validateSelection:s=>connection.validateSelection(s)});
 const ties=context.HEWRSTieFeedback.create({storage,feedback:context.HEWRSOutfitFeedback,validateSelection:s=>connection.validateSelection(s)});
 const gate={refresh(){const a=feedback.refresh(),b=ties.refresh();return {...a,active:[...a.active,...b.active],token:a.token+'\n'+b.token};},snapshot(){return this.refresh();},match(s,c){const a=feedback.match(s,c),b=ties.match(s,c);return {allowed:a.allowed&&b.allowed,reasons:[...a.reasons,...b.reasons]};},assertCurrent(t){if(this.refresh().token!==t)throw Error('Feedback changed');}};
 connection.ownerFeedback.set(gate);
 return {g:context,connection,feedback,ties,storage,gate};
}
function config(occasion='work',preferences={}){return {automatic:true,stylistMode:'research',preferences:{...Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(k=>[k,{mode:'any'}])),...preferences},localDate:'2026-11-18',occasion,style:'AUTO',formality:'any',environment:{source:'not_assessed',date:'2026-11-18'}};}
module.exports={load,memoryStorage,config,root};
