'use strict';
// Actual application entrypoints under delayed rejection checks and navigation.
// Deferred I/O isolates action ownership; no image, engine or provider substitute
// is counted as pixel/source validation here.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(ROOT,'src/outfit-refill-application.js'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const selection={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-8',watchId:null},idle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({delayedGate=false}={}){
 const nodes=new Map(),checks=[],gates=[],sheets=[],pages=[],errors=[];let copies=0,releaseRender;
 function node(tag,text){const n={tag,textContent:text||'',children:[],dataset:{},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(){},getContext:()=>({drawImage(){copies++;}})};Object.defineProperty(n,'id',{get(){return this._id;},set(id){this._id=id;nodes.set(id,this);}});return n;}
 const c=vm.createContext({need:(v,m)=>{if(!v)throw Error(m);},copy:structuredClone,generation:3,pageName:'outfits',modalEpoch:0,modal:null,busy:false,current:structuredClone(selection),currentOption:null,
  options:[{_hewrsConnected:{canonical_selection:selection,compatibility:{display_score:8}}}],lastRequest:{context:{occasion:'work'}},report:{},cardPresentation:{selection,date:'2026-11-19'},optionIndex:0,producing:{kind:'engine'},
  $:id=>{if(!nodes.has(id))nodes.set(id,node('div'));return nodes.get(id);},el:node,document:{createElement:node},button:(text,fn)=>({...node('button',text),onclick:fn}),
  root:{HEWRSFaceliftModel:{shirtLabel:()=> 'Registered shirt'}},connection:{selectionFromOption:o=>({selection:o._hewrsConnected.canonical_selection}),catalogue:{watches:[]}},cardModel:s=>({selection:s,date:'2026-11-19'}),currentContext:()=>({occasion:'work'}),ids:()=> 'S05 DS029 T029',
  checkRejectionFeedbackAsync:()=>new Promise(resolve=>checks.push(resolve)),rejectionGate:()=>({assertCurrent(){},allowed:()=>true,withCurrent:async(_token,fn)=>delayedGate?new Promise(resolve=>gates.push(()=>resolve(fn()))):fn()}),
  URL:{revokeObjectURL(){},createObjectURL:()=> 'blob:test'},resolveUrl(){},optionCards:{},status:m=>errors.push(m),showPage:p=>{c.pageName=p;pages.push(p);},presentFrame:()=>true,displayCurrent(){},pendingInitialOutfit:null
 });
 c.dismissSheet=()=>{if(c.modal){c.modal.cancel?.();c.modal=null;c.modalEpoch++;}};
 c.openSheet=(title,settings={})=>{c.dismissSheet();c.modal={token:++c.modalEpoch,cancel:settings.cancel};const sheet={title,body:node('div'),actions:node('div'),token:c.modal.token};sheets.push(sheet);return sheet;};
 c.apply=c.selectOption=()=>{c.generation++;return new Promise(resolve=>{releaseRender=resolve;});};
 for(const [a,b] of [['async function resultSheet()','\nfunction canLog('],['async function largerOutfit()','\nfunction contextSheet('],['async function exportOptionCards()','\nfunction presentFrame('],['async function viewCurrentOutfit()','\nfunction recordTieSuggestions('],['function historyRow(','\nfunction refreshHistory(']])vm.runInContext(section(a,b),c);
 return {c,sheets,pages,errors,checks,gates,get copies(){return copies;},get releaseRender(){return releaseRender;},resolveCheck(i=0){checks[i]({token:'feedback'});}};
}
const entries=[['resultSheet','Outfit options'],['largerOutfit','Larger outfit view'],['exportOptionCards','Export option cards']];
for(const [method,title]of entries){
 for(const newer of ['modal','closed_modal','generation','page'])test(method+' preserves a newer '+newer+' while its rejection read is delayed',async()=>{
  const h=fixture(),pending=h.c[method]();assert.equal(h.checks.length,1);
  if(newer==='modal'||newer==='closed_modal'){h.c.openSheet('Newer user dialog');if(newer==='closed_modal')h.c.dismissSheet();}
  if(newer==='generation')h.c.generation++;
  if(newer==='page')h.c.pageName='home';
  h.resolveCheck();await pending;assert.equal(h.sheets.filter(s=>s.title===title).length,0);assert.equal(h.copies,0);
  if(newer==='modal')assert.equal(h.sheets.at(-1).title,'Newer user dialog');
  if(newer==='closed_modal')assert.equal(h.c.modal,null);
 });
 test(method+' opens normally when its action remains current',async()=>{const h=fixture(),pending=h.c[method]();h.resolveCheck();await pending;assert.equal(h.sheets.at(-1).title,title);assert.equal(h.errors.length,0);});
}
for(const newestFirst of [true,false])test('The newest overlapping view request owns the dialog, completion order '+newestFirst,async()=>{
 const h=fixture(),earlier=h.c.resultSheet(),later=h.c.exportOptionCards();
 if(newestFirst){h.resolveCheck(1);await later;h.resolveCheck(0);await earlier;}
 else{h.resolveCheck(0);await earlier;h.resolveCheck(1);await later;}
 assert.deepEqual(h.sheets.map(s=>s.title),['Export option cards']);
});
test('Larger view rechecks ownership inside the delayed durable rejection transaction',async()=>{
 const h=fixture({delayedGate:true}),pending=h.c.largerOutfit();h.resolveCheck();await idle();assert.equal(h.gates.length,1);
 h.c.openSheet('Newer user dialog');h.gates[0]();await pending;assert.deepEqual(h.sheets.map(s=>s.title),['Newer user dialog']);assert.equal(h.copies,0);
});
for(const newer of ['modal','page','generation'])test('View current respects a newer '+newer+' during rejection preflight',async()=>{
 const h=fixture(),pending=h.c.viewCurrentOutfit();if(newer==='modal')h.c.openSheet('Newer user dialog');if(newer==='page')h.c.pageName='wardrobe';if(newer==='generation')h.c.generation++;
 h.resolveCheck();await pending;assert.equal(h.pages.length,0);
});
for(const entry of ['result','history'])for(const cancelled of [true,false])test(entry+' selection '+(cancelled?'cancelled':'healthy')+' render controls navigation',async()=>{
 const h=fixture();let button;
 if(entry==='result'){const opening=h.c.resultSheet();h.resolveCheck();await opening;button=h.sheets.at(-1).body.children.find(n=>n.tag==='button');}
 else{const row=h.c.historyRow({localDate:'2026-11-19',origin:'manual',canonical_selection:selection,items:{shoes:{id:'shoe-8'}}},true);button=row.children.find(n=>n.tag==='button');}
 const pending=button.onclick();assert.equal(typeof h.releaseRender,'function');if(cancelled){h.c.generation++;h.c.pageName='home';}h.releaseRender({cancelled});await pending;
 assert.deepEqual(h.pages,cancelled?[]:['outfits']);
});

for(const entry of ['result','history'])for(const newer of ['modal','page'])test(entry+' successful render retains a newer '+newer+' route',async()=>{
 const h=fixture();let button;
 if(entry==='result'){const opening=h.c.resultSheet();h.resolveCheck();await opening;button=h.sheets.at(-1).body.children.find(n=>n.tag==='button');}
 else{const row=h.c.historyRow({localDate:'2026-11-19',origin:'manual',canonical_selection:selection,items:{shoes:{id:'shoe-8'}}},true);button=row.children.find(n=>n.tag==='button');}
 const pending=button.onclick();if(newer==='modal')h.c.openSheet('Newer user dialog');else h.c.pageName='wardrobe';h.releaseRender({cancelled:false});await pending;assert.equal(h.pages.length,0);
});
test('Closing export during its preparation rejection read prevents starting image encoding',async()=>{
 const h=fixture();let encodes=0;h.c.optionCards.png=async()=>{encodes++;return {};};const opening=h.c.exportOptionCards();h.resolveCheck();await opening;
 const prepare=h.sheets.at(-1).body.children.find(n=>n.id==='export-card-png').onclick();assert.equal(h.checks.length,2);h.c.dismissSheet();h.resolveCheck(1);await prepare;assert.equal(encodes,0);assert.equal(h.c.modal,null);
});
