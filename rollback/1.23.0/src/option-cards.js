/* V1.21.1 presentation only. Receives accepted selections; never generates,
 * ranks, changes wardrobe records, writes storage, or logs wear. */
(function(root){'use strict';
const clone=x=>structuredClone(x),need=(x,m)=>{if(!x)throw Error(m);};
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function create(connection){
 const thumbs=root.HEWRS_OPTION_CARD_THUMBNAILS;
 need(thumbs?.schema==='hewrs.option-card-thumbnails.v1_21_1'&&thumbs.source_lock===root.HEWRS_INPUT_SHA256,'Wrong option-card thumbnail source');
 const cache=new Map();
 function thumb(group,id,mode){const t=mode?thumbs[group]?.[id]?.[mode]:thumbs[group]?.[id];if(!t)return null;need(/^ui\/option-cards\/[a-f0-9]{64}\.png$/.test(t.src)&&t.src.endsWith(t.sha256+'.png'),'Unbound card thumbnail');return clone(t);}
 function model(selection,meta={}){
  const s=connection.validateSelection(selection),mode=s.state==='NO_TIE'?'no_tie':'tied';
  const cat=connection.catalogue,top=s.suitId?cat.suits.find(x=>x.id===connection.aliases.get(s.suitId)):null;
  const topDesc=s.shirtOnly?'No jacket':s.blazerId?connection.blazerConnection.knownBlazer(s.blazerId).label:connection.features.get(s.suitId)?.description||s.suitId;
  const topName=top?.brand&&!topDesc.toLowerCase().includes(top.brand.toLowerCase())?top.brand+' — '+topDesc:topDesc;
  const shoes=cat.shoes.find(x=>x.id===s.shoeId),watch=cat.watches.find(x=>x.id===s.watchId),tie=s.state==='NO_TIE'?null:s.state==='REFERENCE'?null:s.state;
  const items=[
   {role:s.shirtOnly?'Outfit mode':s.blazerId?'Blazer':'Suit',id:s.suitId||s.blazerId||null,name:topName,image:null},
   {role:'Shirt',id:s.shirtId,name:connection.records[s.shirtId].label,image:thumb('shirts',s.shirtId,mode)},
   {role:'Tie',id:tie,name:s.state==='NO_TIE'?'No Tie':s.state==='REFERENCE'?'Retained reference':connection.features.get(tie)?.description||tie,image:tie?thumb('ties',tie):null,empty:s.state==='NO_TIE'?'NO TIE':s.state==='REFERENCE'?'REFERENCE':null},
   {role:'Shoes',id:s.shoeId,name:shoes?.name||s.shoeId,image:thumb('shoes',s.shoeId)},
   {role:'Trousers',id:s.pantId||null,name:s.pantId?connection.blazerConnection.knownPant(s.pantId).label:'Matching trousers included with '+s.suitId,image:s.pantId?thumb('pants',s.pantId):null},
   {role:'Watch',id:s.watchId||null,name:watch?.name||'No watch selected',image:null,note:s.watchId?'ID and name; no watch image is substituted.':null}
  ];
  const position=Number.isInteger(meta.position)&&meta.position>0?meta.position:null,total=Number.isInteger(meta.total)&&meta.total>0?meta.total:null;
  return {schema:'hewrs.option-card.v1_21_1',selection:clone(s),key:JSON.stringify(s),title:position?'Option '+String(position).padStart(2,'0'):'Your selection',position,total,date:String(meta.date||''),origin:String(meta.origin||'Your selection'),scoreLabel:String(meta.scoreLabel||''),scoreValue:String(meta.scoreValue||''),items};
 }
 function mount(node,m){
  node.replaceChildren();node.dataset.selection=JSON.stringify(m.selection);
  for(const item of m.items){const row=document.createElement('div');row.className='lb-item'+(item.image||item.empty?' lb-with-swatch':'');row.dataset.role=item.role;row.dataset.itemId=item.id||'';
   if(item.image){const img=document.createElement('img');img.className='lb-swatch';img.src=root.HEWRS_EMBEDDED_UI_IMAGES?.[item.image.sha256]||item.image.src;img.width=192;img.height=224;img.alt=(item.id||'')+' — '+item.name+'; registered source detail';img.decoding='async';img.dataset.sourceKey=item.image.source_key;img.onerror=()=>{img.hidden=true;row.classList.add('lb-image-unavailable');const msg=document.createElement('small');msg.textContent='Thumbnail unavailable; item identity retained.';row.append(msg);};row.append(img);}
   else if(item.empty){const blank=document.createElement('span');blank.className='lb-swatch lb-empty-swatch';blank.textContent=item.empty;row.append(blank);}
   const text=document.createElement('div');text.className='lb-item-copy';const role=document.createElement('span');role.className='lb-item-role';role.textContent=item.role;text.append(role);
   if(item.id){const id=document.createElement('strong');id.className='lb-item-id';id.textContent=item.id;text.append(id);}
   const name=document.createElement('span');name.className='lb-item-name';name.textContent=item.name;text.append(name);if(item.note){const note=document.createElement('small');note.textContent=item.note;text.append(note);}row.append(text);node.append(row);
  }
 }
 async function image(desc){
  if(cache.has(desc.sha256))return cache.get(desc.sha256);
  const promise=new Promise((resolve,reject)=>{const im=new Image();const timer=setTimeout(()=>reject(Error('Thumbnail timeout: '+desc.source_key)),15000);im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(Error('Thumbnail unavailable: '+desc.source_key));};im.src=root.HEWRS_EMBEDDED_UI_IMAGES?.[desc.sha256]||desc.src;});cache.set(desc.sha256,promise);promise.catch(()=>cache.delete(desc.sha256));while(cache.size>24)cache.delete(cache.keys().next().value);return promise;
 }
 function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 function fit(ctx,img,x,y,w,h){const k=Math.min(w/img.width,h/img.height),ww=img.width*k,hh=img.height*k;ctx.drawImage(img,x+(w-ww)/2,y+(h-hh)/2,ww,hh);}
 function wrap(ctx,text,maxWidth){const words=String(text).split(/\s+/),lines=[];let line='';for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}if(line)lines.push(line);return lines;}
 async function png(m,native){
  need(native.width===996&&native.height===2748,'Wrong outfit canvas');
  const imgs=await Promise.all(m.items.map(x=>x.image?image(x.image):null));
  const c=canvas(1400,1900),ctx=c.getContext('2d');ctx.fillStyle='#060E19';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#D8A247';ctx.lineWidth=2;ctx.strokeRect(22,22,1356,1856);
  ctx.fillStyle='#D8A247';ctx.font='28px Georgia';ctx.fillText('HEWRS  /  YOUR WARDROBE',55,78);ctx.font='58px Georgia';ctx.fillText(m.title,55,155);ctx.font='23px Arial';ctx.fillStyle='#D6C7AE';ctx.fillText((m.total?'OF '+m.total+'  ·  ':'')+m.date,55,204);ctx.beginPath();ctx.moveTo(55,232);ctx.lineTo(1345,232);ctx.stroke();
  fit(ctx,native,48,280,540,1490);
  let y=292;
  for(let i=0;i<m.items.length;i++){const item=m.items[i],has=!!item.image||!!item.empty,x=has?824:642;ctx.font='28px Georgia';const lines=wrap(ctx,item.name,1325-x),height=Math.max(has?184:112,lines.length*36+(item.id?78:54)+(item.note?24:0));
   if(has){ctx.strokeStyle='#806632';ctx.strokeRect(642,y,152,176);if(imgs[i])fit(ctx,imgs[i],647,y+5,142,166);else{ctx.font='19px Arial';ctx.fillStyle='#D6C7AE';ctx.fillText(item.empty,650,y+92);}}
   ctx.fillStyle='#D8A247';ctx.font='20px Arial';ctx.fillText(item.role.toUpperCase(),x,y+23);let yy=y+57;
   if(item.id){ctx.fillStyle='#F1E4CB';ctx.font='bold 25px Arial';ctx.fillText(item.id,x,yy);yy+=38;}
   ctx.fillStyle='#D6C7AE';ctx.font='28px Georgia';for(const l of lines){ctx.fillText(l,x,yy);yy+=36;}
   if(item.note){ctx.font='17px Arial';ctx.fillStyle='#918C84';ctx.fillText('Watch identified by name; image not substituted.',x,yy+4);}y+=height+24;
  }
  ctx.fillStyle='#D8A247';ctx.font='23px Arial';ctx.fillText(m.scoreLabel+(m.scoreValue&&m.scoreValue!=='—'?' · '+m.scoreValue:'').trim(),55,1806);ctx.font='18px Arial';ctx.fillStyle='#918C84';ctx.fillText('Presentation export · exact wardrobe IDs · no wear recorded by export',55,1851);
  const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Card PNG export failed')),'image/png'));c.width=c.height=1;return blob;
 }
 async function thumbnailData(desc){const im=await image(desc),c=canvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);const data=c.toDataURL('image/png');c.width=c.height=1;return data;}
 async function book(records,{resolveUrl,isCancelled=()=>false,onProgress=()=>{}}={}){
  need(Array.isArray(records)&&records.length>0&&records.length<=20,'Export needs 1–20 actual options');
  const pages=[],imageData=new Map();let off=null,native=null;
  try{for(let i=0;i<records.length;i++){
   if(isCancelled())throw Error('Export cancelled; no file or wear record created.');
   if(!off||i%4===0){if(off)off.cancel();if(native)native.width=native.height=1;native=canvas(996,2748);off=root.HEWRSAtomicRenderer.create(native,connection,{resolveUrl});}
   const m=records[i];need(JSON.stringify(connection.validateSelection(m.selection))===JSON.stringify(m.selection),'Changed export selection');const result=await off.render(m.selection);need(!result.cancelled,'Export render cancelled');if(isCancelled())throw Error('Export cancelled; no file created.');
   const preview=canvas(498,1374),pc=preview.getContext('2d');pc.fillStyle='#060E19';pc.fillRect(0,0,498,1374);pc.drawImage(native,0,0,498,1374);const photo=preview.toDataURL('image/jpeg',.93);preview.width=preview.height=1;
   let rows='';for(const item of m.items){let src=null;if(item.image){if(!imageData.has(item.image.sha256))imageData.set(item.image.sha256,await thumbnailData(item.image));src=imageData.get(item.image.sha256);}rows+='<div class="item '+(src||item.empty?'swatched':'')+'" data-item-id="'+escape(item.id||'')+'">'+(src?'<img class="swatch" src="'+src+'" alt="'+escape(item.id+' '+item.name)+'">':item.empty?'<span class="swatch empty">'+escape(item.empty)+'</span>':'')+'<div><span class="role">'+escape(item.role)+'</span>'+(item.id?'<strong>'+escape(item.id)+'</strong>':'')+'<span class="name">'+escape(item.name)+'</span>'+(item.note?'<small>'+escape(item.note)+'</small>':'')+'</div></div>';}
   pages.push('<article class="card" data-option="'+(i+1)+'"><header><span class="brand">HEWRS · YOUR WARDROBE</span><h2>'+escape(m.title)+' <small>'+escape(m.total?'of '+m.total:'')+'</small></h2><p>'+escape(m.date)+' · '+escape(m.origin)+'</p></header><div class="body"><img class="outfit" src="'+photo+'" alt="'+escape(m.title+' actual outfit')+'"><div class="items">'+rows+'</div></div><footer>'+escape(m.scoreLabel)+(m.scoreValue&&m.scoreValue!=='—'?' · '+escape(m.scoreValue):'')+'</footer></article>');onProgress({completed:i+1,total:records.length});
  }}finally{if(off)off.cancel();if(native)native.width=native.height=1;cache.clear();}
  if(isCancelled())throw Error('Export cancelled; no file created.');
  const css='*{box-sizing:border-box}body{margin:0;background:#060E19;color:#F1E4CB;font:16px/1.4 Arial,sans-serif}main{max-width:1120px;margin:auto;padding:24px}.intro{color:#D6C7AE;font-size:14px}.card{border:1px solid #D8A247;border-radius:14px;margin:26px 0;padding:28px;break-after:page;break-inside:avoid}header{border-bottom:1px solid #806632;margin-bottom:18px}.brand,.role{color:#D8A247;letter-spacing:.09em;font-size:12px;text-transform:uppercase}h2{font:36px Georgia;margin:12px 0}h2 small{font:16px Arial;color:#918C84}header p{font-size:12px;color:#918C84}.body{display:grid;grid-template-columns:44% 56%;gap:20px}.outfit{width:100%;height:auto;max-height:800px;object-fit:contain}.items{padding:16px 16px 0 0;min-width:0}.item{padding:12px 0;display:grid;grid-template-columns:1fr;gap:16px;border-bottom:1px solid #233345}.item.swatched{grid-template-columns:90px 1fr}.swatch{width:90px;height:105px;object-fit:contain;border:1px solid #806632;border-radius:5px}.empty{display:grid;place-items:center;font-size:12px;color:#D6C7AE}.role,strong,.name,small{display:block;overflow-wrap:anywhere}strong{font-size:15px;margin:2px 0}.name{font:18px/1.35 Georgia;color:#D6C7AE}small{color:#918C84;font-size:11px}footer{margin-top:18px;font-size:12px;color:#D8A247}@media(max-width:620px){main{padding:12px}.card{padding:18px}.body{display:block}.outfit{height:520px}.items{padding:0}}@page{size:A4 portrait;margin:10mm}@media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}main{padding:0;width:190mm}.intro{display:none}.card{margin:0 0 10mm;padding:7mm;width:190mm;height:276mm;overflow:hidden;border-radius:0}.body{display:grid;grid-template-columns:44% 56%;gap:4mm}.outfit{height:215mm}.items{padding:0 4mm 0 0}.item{padding:3mm 0;gap:3mm}.item.swatched{grid-template-columns:20mm 1fr}.swatch{width:20mm;height:23mm}.name{font-size:11pt}.role{font-size:8pt}strong{font-size:9pt}header{margin-bottom:4mm}h2{font-size:26pt}footer{font-size:8pt}}';
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>HEWRS — '+records.length+' option cards</title><style>'+css+'</style></head><body><main><div class="intro"><h1>HEWRS · '+records.length+' option cards</h1><p>Saved snapshot of the actual selected list, in its original order. Browser Print / Save as PDF prints one card per page. Contains your avatar and wardrobe images: keep private as appropriate. No live controls, credentials, wear log or Favorites are included. Source imagery is unchanged; export previews are compressed presentation copies.</p></div>'+pages.join('')+'</main></body></html>';
  return new Blob([html],{type:'text/html;charset=utf-8'});
 }
 return Object.freeze({model,mount,png,book,escape,thumbnailCounts:()=>({shirts:Object.keys(thumbs.shirts).length,ties:Object.keys(thumbs.ties).length,shoes:Object.keys(thumbs.shoes).length,pants:Object.keys(thumbs.pants).length})});
}
root.HEWRSOptionCards=Object.freeze({create,escape,version:'1.21.1'});
})(globalThis);
