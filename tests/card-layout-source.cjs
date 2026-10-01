'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto');
const R=path.resolve(__dirname,'..'),B=process.env.HEWRS_BASELINE;
if(!B)throw Error('Set HEWRS_BASELINE to the verified V1.23.1-shoe15 folder.');
const g=require('./core-loader.cjs')(R),c=g.HEWRSCleanConnection.create(g.HEWRS_INPUTS),cards=g.HEWRSOptionCards.create(c),checks=[];
const j=x=>JSON.parse(JSON.stringify(x));
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function ck(name,f){try{const result=f();checks.push({name,passed:true,result:result??null});}catch(e){checks.push({name,passed:false,error:e.stack});}console.log(checks.at(-1).passed?'PASS':'FAIL',name);}
const s={suitId:'S05',shirtId:'DS001',state:'T017',shoeId:'shoe-15',watchId:null};
ck('Exact model unchanged from shoe-15 baseline for all connected shirts, ties, suits, shoes, trousers and watches',()=>{
 const gb=require('./core-loader.cjs')(B),cb=gb.HEWRSCleanConnection.create(gb.HEWRS_INPUTS),old=gb.HEWRSOptionCards.create(cb);let n=0;
 const all=[...c.manifest.shirt_order.map(shirtId=>({...s,shirtId,state:'NO_TIE'})),...c.tieFidelity.ids.map(state=>({...s,state})),...c.suitSources.ids.map(suitId=>({...s,suitId})),...Object.keys(c.shoeLayers).map(shoeId=>({...s,shoeId})),...Object.keys(g.HEWRS_OPTION_CARD_THUMBNAILS.pants).map(pantId=>({blazerId:'B03',pantId,shirtId:'DS001',state:'NO_TIE',shoeId:'shoe-15',watchId:null})),...c.blazerConnection.availableIds.map(blazerId=>({blazerId,pantId:'PG002',shirtId:'DS001',state:'T017',shoeId:'shoe-15',watchId:null})),...c.catalogue.watches.filter(x=>!x.disabled).map(x=>({...s,watchId:x.id}))];
 for(const sel of all){try{c.validateSelection(sel);}catch{continue;}assert.deepEqual(j(cards.model(sel,{position:1,total:20,date:'2026-10-01'})),j(old.model(sel,{position:1,total:20,date:'2026-10-01'})));n++;}return n;
});
ck('All image and assembly files, source corrections and thumbnails byte-identical to V1.23.1',()=>{
 const entries=JSON.parse(fs.readFileSync(B+'/PACKAGE_SHA256.json')).files;let n=0;for(const f of entries){if(/^(assets|assemblies|ui|data)\//.test(f.path)){assert.equal(sha(R+'/'+f.path),sha(B+'/'+f.path),f.path);n++;}}return n;
});
ck('Every non-presentation executable file unchanged including all engine,source,weather,storage and preference code',()=>{
 const allowed=new Set(['src/application.js','src/application.css','src/option-cards.js','tools/build.py','app.template.html','app.html','index.html','STARTUP_RESOURCES.json','PACKAGE_SHA256.json','RELEASE_STATUS.json','RELEASE_SCOPE.json']);let n=0;
 for(const f of JSON.parse(fs.readFileSync(B+'/PACKAGE_SHA256.json')).files){if(allowed.has(f.path))continue;assert.equal(sha(R+'/'+f.path),f.sha256,f.path);n++;}return n;
});
ck('Generation,apply,feedback,history and scoring functions in application.js preserved exactly',()=>{
 function fn(text,name){const st=text.indexOf('function '+name+'(');assert.ok(st>=0,name);const end=text.indexOf('\nfunction ',st+10),asyncEnd=text.indexOf('\nasync function ',st+10);const next=[end,asyncEnd].filter(x=>x>st);return text.slice(st,next.length?Math.min(...next):undefined).trim();}
 const a=fs.readFileSync(R+'/src/application.js','utf8'),b=fs.readFileSync(B+'/src/application.js','utf8');const names=['apply','generate','selectOption','restoreInitialOutfit','itemsFor','largerOutfit','details','startLog','scoreDetails','exportOptionCards','setCardLayout'];for(const n of names)assert.equal(fn(a,n),fn(b,n),n);return names;
});
ck('All navigation,view,export,history and preference controls retained exactly once',()=>{
 const t=fs.readFileSync(R+'/app.template.html','utf8');const ids=['avatar','prev-option','next-option','full-view','detail-view','large-view','layout-cards','layout-standard','export-option-cards','outfit-preferences','record-wear','regenerate','option-count','card-item-pictures'];for(const id of ids)assert.equal((t.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);assert.ok(t.indexOf('id="option-card"')<t.indexOf('class="lb-toolbar"'));return ids;
});
ck('Presentation module does not write private state or generate/re-rank outfits',()=>{const t=fs.readFileSync(R+'/src/option-cards.js','utf8');assert.ok(!/localStorage|setItem\(|addEvent\(|generateAsync\(|controller\.generate|OPENAI_API_KEY/.test(t));assert.equal(cards.model(s).items[3].image.source_kind,'owner_reference_photo');assert.equal(cards.model(s).items[5].image,null);});
const result={schema:'hewrs.card-layout.source.v1_23_2',passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length,checks};const E=R+'/evidence/card_layout_v1_23_2';fs.mkdirSync(E,{recursive:true});fs.writeFileSync(E+'/SOURCE_CHECKS.json',JSON.stringify(result,null,2)+'\n');if(result.failed)process.exit(1);
