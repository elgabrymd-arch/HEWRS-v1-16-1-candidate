'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {load}=require('./tie-engine-loader.cjs');
const {g,connection:c}=load(),root=path.resolve(__dirname,'..');
vm.runInContext(fs.readFileSync(path.join(root,'data/option-card-thumbnails.js'),'utf8'),g);
const source=fs.readFileSync(path.join(root,'src/photo-picker-integration.js'),'utf8');
const immutableBefore=JSON.stringify({records:c.records,features:c.features.all?.()||[...c.manifest.shirt_order].map(id=>c.features.get(id)),manifest:c.manifest,catalogue:c.catalogue,thumbs:g.HEWRS_OPTION_CARD_THUMBNAILS,nonSuit:g.HEWRS_NON_SUIT_CARD_THUMBNAILS});
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.parentNode=null;this.dataset={};this.attributes={};this.className='';this.textContent='';this.hidden=false;this.classList={add:(...names)=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),...names])].join(' ');}};}
 get firstChild(){return this.children[0]||null;}
 append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
 remove(){if(this.parentNode){const p=this.parentNode;p.children.splice(p.children.indexOf(this),1);this.parentNode=null;}}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name]??null;}
 querySelectorAll(selector){const match=n=>selector.startsWith('#')?n.id===selector.slice(1):selector==='button.fx-choice[data-item-id]'?n.tagName==='button'&&n.className.split(' ').includes('fx-choice')&&!!n.dataset.itemId:selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):n.tagName===selector;const out=[];for(const child of this.children){if(match(child))out.push(child);out.push(...child.querySelectorAll(selector));}return out;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function picker(topKind,id='DS026',category='shirt'){
 const ui=g.HEWRSFaceliftModel.create(c);
 if(topKind==='suit')ui.set('topwear',{mode:'item',id:c.aliases.get('S05')});
 if(topKind==='blazer')ui.set('topwear',{mode:'item',id:c.blazerConnection.knownBlazer('B03').historyId});
 if(topKind==='shirt-only')ui.set('topwear',{mode:'item',id:'ui:shirt-only'});
 ui.begin(category);const row=ui.filter(category).find(r=>r.id===id);assert.ok(row,'Actual contextual picker must offer '+id);
 const body=new Element('div');body.id='fx-sheet-body';const list=new Element('div');list.id='picker-list';body.append(list);
 const button=new Element('button');button.className='fx-choice';button.dataset.itemId=id;const label=new Element('span');label.className='fx-choice-name';label.textContent=row.label;button.append(label);list.append(button);
 g.document={readyState:'complete',getElementById:key=>key===body.id?body:null,createElement:tag=>new Element(tag)};
 g.MutationObserver=class{observe(){}disconnect(){}};g.HEWRSApp={ui,connection:c};
 vm.runInContext(source,g,{filename:'src/photo-picker-integration.js'});
 return {ui,button,img:button.querySelector('img'),label};
}
test('Exact blazer and shirt-only pickers use the same approved DS026 detail as their option card',()=>{
 for(const mode of ['blazer','shirt-only']){
  const h=picker(mode),selection={...(mode==='blazer'?{blazerId:'B03'}:{shirtOnly:true}),pantId:'PG001',shirtId:'DS026',state:'NO_TIE',shoeId:'shoe-1',watchId:null};
  const card=g.HEWRSOptionCards.create(c).model(selection).items.find(x=>x.role==='Shirt');
  assert.notEqual(card.image.sha256,g.HEWRS_OPTION_CARD_THUMBNAILS.shirts.DS026.no_tie.sha256,'Approved small-check non-suit and larger-check suit details are intentionally distinct');
  assert.equal(h.img.src,card.image.src,mode+' picker must preview its actual approved rendering context');
  assert.equal(h.img.dataset.sourceSha256,card.image.sha256);
 }
});
test('Every registered non-suit no-tie override is displayed under an exact blazer anchor',()=>{
 for(const [id,states]of Object.entries(g.HEWRS_NON_SUIT_CARD_THUMBNAILS)){
  if(!states.no_tie)continue;const h=picker('blazer',id);assert.equal(h.img.src,states.no_tie.src,id);assert.equal(h.img.dataset.sourceSha256,states.no_tie.sha256);
 }
});
test('Suit and unanchored pickers preserve the original suit detail and exact tie thumbnails',()=>{
 for(const top of ['suit',null]){
  assert.equal(picker(top).img.src,g.HEWRS_OPTION_CARD_THUMBNAILS.shirts.DS026.no_tie.src);
  assert.equal(picker(top,'T029','tie').img.src,g.HEWRS_OPTION_CARD_THUMBNAILS.ties.T029.src);
 }
});
test('Photo decoration does not change a draft, exact item, choice ordering or duplicate an image',()=>{
 const h=picker('blazer'),before=JSON.stringify({prefs:h.ui.snapshot(),draft:h.ui.draft()});
 g.HEWRSPhotoPickers.refresh();g.HEWRSPhotoPickers.refresh();assert.equal(h.button.querySelectorAll('img').length,1);
 assert.equal(JSON.stringify({prefs:h.ui.snapshot(),draft:h.ui.draft()}),before);assert.equal(h.button.dataset.itemId,'DS026');
 h.img.onerror();assert.equal(h.img.hidden,true);assert.equal(h.button.querySelector('.hewrs-shirt-picker-unavailable').hidden,false);
});
test('DS002 and DS004 show their existing pinned garment descriptions in picker and option cards',()=>{
 const ui=g.HEWRSFaceliftModel.create(c),cards=g.HEWRSOptionCards.create(c);
 for(const [id,label]of [['DS002','Cream/white; Check/grid'],['DS004','White; Fine horizontal stripe']]){
  assert.equal(c.features.get(id).description,label,'Pinned source is authoritative');
  assert.equal(ui.rows.shirt.find(r=>r.id===id).label,label,'Picker label '+id);
  assert.equal(cards.model({suitId:'S05',shirtId:id,state:'NO_TIE',shoeId:'shoe-1',watchId:null}).items.find(x=>x.role==='Shirt').name,label,'Option-card label '+id);
  ui.set('shirt',{mode:'item',id});assert.equal(ui.label('shirt').name,label,'Home label '+id);
 }
});
test('Presentation inspection preserves all garment records, source metadata and approved thumbnail descriptors',()=>{
 const after=JSON.stringify({records:c.records,features:c.features.all?.()||[...c.manifest.shirt_order].map(id=>c.features.get(id)),manifest:c.manifest,catalogue:c.catalogue,thumbs:g.HEWRS_OPTION_CARD_THUMBNAILS,nonSuit:g.HEWRS_NON_SUIT_CARD_THUMBNAILS});
 assert.equal(after,immutableBefore);
});
