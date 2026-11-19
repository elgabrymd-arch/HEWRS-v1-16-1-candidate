'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/outfit-refill-application.js','utf8');
const extract=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
const baseline=process.argv.includes('--expect-baseline-defects');
let passed=0,failed=0;
function check(name,okay){console.log((okay?'PASS: ':'FAIL: ')+name);okay?passed++:failed++;}
const noop=()=>{};
function dom(){const nodes=new Map(),buttons=new Map();function el(tag,text){const n={tag,textContent:text||'',children:[],dataset:{},style:{},append(...v){this.children.push(...v);},setAttribute:noop,querySelector:()=>el('small')};Object.defineProperty(n,'id',{set(v){this._id=v;nodes.set(v,this);},get(){return this._id;}});return n;}return {el,$:id=>{if(!nodes.has(id)){const n=el('div');n.id=id;}return nodes.get(id);},buttons,button(text,fn){const n=el('button',text);n.onclick=fn;buttons.set(text,n);return n;}};}
function wardrobe(){const d=dom(),calls={persisted:0,cancelled:0,invalidated:0},prefs={shirt:{mode:'any'}};
 const c=vm.createContext({...d,root:{HEWRSAdditionalBlazers:{has:()=>false}},groupLabels:{shirts:'Dress Shirts'},ui:{snapshot:()=>structuredClone(prefs),set:(cat,choice)=>prefs[cat]=choice},generation:0,mode:'engine',renderer:{cancel:()=>calls.cancelled++},setBusy:noop,
  persistHomePreferences:()=>calls.persisted++,invalidateRecommendations:()=>calls.invalidated++,setMode:m=>c.mode=m,dismissSheet:noop,showPage:noop,updateHome:noop,status:noop,browseCategory:noop,
  openSheet:()=>({body:d.el('div'),actions:d.el('div'),token:1})});
 vm.runInContext(extract('function itemDetails(','function historyRow('),c);
 c.record={id:'DS029',label:'Ice-blue herringbone',category:'shirt',choiceId:'DS029',available:true};
 vm.runInContext('itemDetails(record,"shirts")',c);d.buttons.get('Use exact item').onclick();
 check('Wardrobe exact item persists its Home preference',calls.persisted===1&&prefs.shirt.id==='DS029');
 check('Wardrobe exact item invalidates obsolete recommendations and cancels pending work',calls.invalidated===1&&calls.cancelled===1&&c.generation===1);
}
async function importRace(kind){const d=dom();let releaseA,releaseB,confirmed=null;
 const a=new Promise(resolve=>releaseA=resolve),b=new Promise(resolve=>releaseB=resolve);
 const c=vm.createContext({...d,restorePreview:null,modal:{token:1},localToday:()=> '2026-11-19',need:(v,m)=>{if(!v)throw Error(m);},download:noop,sheetError:e=>{throw e;},dismissSheet:noop,refreshFavoriteCount:noop,showFavorites:noop,
  openSheet:()=>({body:d.el('div'),actions:d.el('div'),token:1}),
  store:{status:()=>({persistent:true}),snapshot:()=>({events:[]}),previewImport:text=>({tag:text,events:[],session:null})},
  favorites:{exclusive:async fn=>fn(),previewImport:text=>({tag:text,added:1}),merge:preview=>{confirmed=preview.tag;return {added:1,already_saved:0};},exportText:()=>''}});
 const isWear=kind==='wear';
 vm.runInContext(isWear?extract('function backup()','\n// Factual counts only'):extract('function favoriteBackup()','\nfunction backup()'),c);
 vm.runInContext(isWear?'backup()':'favoriteBackup()',c);
 const file=d.$(isWear?'backup-file':'favorites-file');
 file.files=[{size:20,text:()=>a}];const pendingA=file.onchange();
 file.files=[{size:20,text:()=>b}];const pendingB=file.onchange();
 releaseB('B');await pendingB;releaseA('A');await pendingA;
 if(!isWear)await d.$('confirm-favorites-import').onclick();
 check(kind+' import keeps the most recently selected file after out-of-order reads',(isWear?c.restorePreview.tag:confirmed)==='B');
}
async function main(){wardrobe();await importRace('wear');await importRace('favorites');if(baseline){assert.equal(failed,4);console.log('REPRODUCED: four application action/preview failures');}else{assert.equal(failed,0);console.log('FIVE ROUND APP ACTIONS:',passed,'checks passed');}}
main().catch(error=>{console.error(error);process.exitCode=1;});
