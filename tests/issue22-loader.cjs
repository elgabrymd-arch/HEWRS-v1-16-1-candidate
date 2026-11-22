'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function memoryStorage(){const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(k)};}
function load({issue22=true,index=true,storage=memoryStorage()}={}){
 const g=vm.createContext({console,setTimeout,clearTimeout,URL,URLSearchParams,AbortController,performance,localStorage:storage,crypto:crypto.webcrypto});
 vm.runInContext('globalThis.structuredClone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));',g);
 const scripts=JSON.parse(fs.readFileSync(root+'/tools/build.py','utf8').match(/SCRIPTS=(\[[^\n]+\])/)[1].replaceAll("'",'"'));
 function run(name){
  let source=fs.readFileSync(path.join(root,name),'utf8');
  if(issue22&&name==='vendor/ensemble-completion.js'){
   const anchor='map.set(r.id,normalize(r));';
   if(source.split(anchor).length!==2)throw Error('Issue 22 normalization anchor changed.');
   source=source.replace(anchor,'map.set(r.id,globalThis.HEWRSIssue22Matching.normalizeProfile(r,normalize(r)));');
  }
  vm.runInContext(source,g,{filename:name});
 }
 for(const name of ['src/tie-exposure.js','src/tie-feedback.js','src/render-image-loader.js',...scripts.filter(p=>p!=='src/application.js')]){
  if(name==='data/option-index.js'&&!index)continue;
  run(name==='src/automatic-engine.js'?'src/outfit-refill-engine.js':name==='data/option-index.js'&&issue22?'data/issue22-option-index.js':name);
  if(issue22&&name==='src/source-corrections.js'){run('data/issue22-garment-dna.js');run('src/issue22-matching.js');}
  if(issue22&&name==='vendor/ensemble-completion.js')vm.runInContext('HEWRSIssue22Matching.installEngine();',g);
 }
 const connection=g.HEWRSCleanConnection.create(g.HEWRS_INPUTS);
 return {g,connection,storage,run};
}
function config(occasion='work',style='AUTO',preferences={}){return {automatic:true,stylistMode:'research',preferences:{...Object.fromEntries(['topwear','shirt','tie','shoes','bottoms','watch'].map(k=>[k,{mode:'any'}])),...preferences},localDate:'2026-11-22',occasion,style,formality:'any',environment:{source:'not_assessed',date:'2026-11-22'}};}
module.exports={load,memoryStorage,config,root};
