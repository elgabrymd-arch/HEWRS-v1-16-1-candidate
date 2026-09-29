/* V1.21.1 — presentation-only option card.
 * No scoring, generation, history, preference, storage or image-compositor writes.
 * Text and thumbnail IDs are derived together from the committed selection.
 */
(function(root){'use strict';
const need=(v,m)=>{if(!v)throw Error(m);};
function model(selection,items,position=-1,count=0){
 need(selection&&Array.isArray(items),'Option card requires a committed selection');
 const by=new Map(items.map(r=>[r.role,r]));
 const top=by.get('Suit / Blazer'),shirt=by.get('Shirt'),tie=by.get('Tie'),shoe=by.get('Shoes'),bottom=by.get('Bottoms'),watch=by.get('Watch');
 need(top&&shirt&&tie&&shoe&&bottom&&watch,'Incomplete committed item list');
 need(shirt.id===selection.shirtId&&shoe.id===selection.shoeId&&watch.id===(selection.watchId||null),'Item list differs from the committed selection');
 need(top.id===(selection.suitId||selection.blazerId||null)&&bottom.id===(selection.pantId||null),'Topwear/trousers mismatch');
 need(tie.id===(selection.state==='NO_TIE'?null:selection.state),'Tie state mismatch');
 const numbered=Number.isInteger(position)&&position>=0&&position<count;
 return {heading:numbered?'Option '+(position+1):'Your outfit',count:numbered?(position+1)+' / '+count:'Current selection',top:{...top,role:selection.shirtOnly?'Topwear':selection.blazerId?'Blazer':'Suit'},rows:[{...shirt,group:'shirts'},{...tie,group:'ties'},{...shoe,group:'shoes'}],meta:[{...bottom,role:'Trousers'},{...watch}],selection:structuredClone(selection)};
}
function create({document,registry=root.HEWRS_OPTION_CARD_THUMBNAILS}={}){
 need(document&&registry?.schema==='hewrs.option-card-thumbnails.v1_21_1','Missing option-card view/source registry');
 const $=id=>document.getElementById(id),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 let lastKey=null,last=null;
 function label(r){return r.id?r.id+' — '+r.name:r.name;}
 function render(selection,items,position,count){
  const m=model(selection,items,position,count);$('card-option-title').textContent=m.heading;
  const key=JSON.stringify([m.selection,items]);last=m;
  if(key===lastKey)return;lastKey=key;
  const top=$('card-topwear');top.replaceChildren(make('span',m.top.role,'card-role'),make('strong',m.top.id||'Shirt only','card-item-id'),make('span',m.top.name,'card-item-name'));
  const rows=$('card-garments');rows.replaceChildren();
  for(const r of m.rows){
   const row=make('div',undefined,'card-garment-row');row.dataset.cardRole=r.role;row.dataset.itemId=r.id||'NO_TIE';
   const thumb=make('div',undefined,'card-thumbnail'),text=make('div',undefined,'card-garment-copy');
   const d=r.id?registry[r.group]?.[r.id]:null;
   if(d){
    need(d.id===r.id&&/^ui-assets\/option-cards\/(DS\d{3}|T\d{3}|shoe-\d+)\.png$/.test(d.url),'Unbound option-card preview');
    const im=make('img');im.width=240;im.height=240;im.alt=r.id+' — '+r.name+'; registered wardrobe detail';im.decoding='async';im.dataset.itemId=r.id;
    im.onerror=()=>{if(im.isConnected){thumb.replaceChildren(make('span','Preview unavailable','card-preview-fallback'));thumb.dataset.status='unavailable';}};
    im.onload=()=>{if(im.isConnected)thumb.dataset.status='ready';};
    im.src=root.HEWRS_OPTION_CARD_IMAGES?.[d.sha256]||d.url;thumb.append(im);thumb.dataset.sourceHash=d.sha256;
   }else{thumb.append(make('span',r.id==='REFERENCE'?'REF':'NO TIE','card-preview-fallback'));thumb.dataset.status='text';}
   text.append(make('span',r.role,'card-role'),make('strong',r.id||'No Tie','card-item-id'),make('span',r.name,'card-item-name'));
   row.append(thumb,text);rows.append(row);
  }
  const meta=$('card-secondary-items');meta.replaceChildren();
  for(const r of m.meta){const n=make('div',undefined,'card-meta-item');n.dataset.cardRole=r.role;n.dataset.itemId=r.id||'';n.append(make('span',r.role,'card-role'),make('span',label(r),'card-meta-value'));meta.append(n);}
  $('editorial-card').dataset.selection=JSON.stringify(m.selection);$('editorial-card').dataset.status='ready';
 }
 return Object.freeze({render,snapshot:()=>last?structuredClone(last):null});
}
root.HEWRSOptionCards=Object.freeze({model,create,version:'1.21.1'});
})(globalThis);
