/* Local-only suit compositor. Never loads source portraits for final composition. */
'use strict';
const canvas=document.getElementById('avatar'), ctx=canvas.getContext('2d',{willReadFrequently:true});
const select=document.getElementById('suit'), status=document.getElementById('status');
const imageCache=new Map();let requestToken=0,registry=null,pins=null;
window.hewrsTest={ready:false,selected:null,history:[],error:null};
function require(condition,message){if(!condition)throw new Error(message);}
async function asset(path,expected){
  require(!path.startsWith('approved/')&&!path.startsWith('evidence/')&&!path.startsWith('held/'),'Source or legacy image cannot enter final compositor');
  expected=expected||(pins&&pins.files[path]);require(expected,'Asset lacks a pinned hash: '+path);const key=path+'|'+expected;if(imageCache.has(key))return imageCache.get(key);
  const response=await fetch(path);require(response.ok,'Missing asset: '+path);const bytes=await response.arrayBuffer();
  if(expected){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');require(hash===expected,'Hash mismatch: '+path);}
  const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}));require(image.width===996&&image.height===2748,'Wrong canvas: '+path);imageCache.set(key,image);return image;
}
function pix(image){const c=document.createElement('canvas');c.width=996;c.height=2748;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,0,0);return x.getImageData(0,0,996,2748).data;}
async function showSuit(sid){
 const token=++requestToken;window.hewrsTest.ready=false;status.className='';status.textContent='Loading '+sid+'…';
 try{
  const entry=registry.items.find(x=>x.suit_id===sid);require(entry&&entry.static_test_eligible,'Suit not eligible');require(entry.production_enabled===false,'Unexpected deployment flag');
  for(const [field,filename] of [['jacket','JACKET'],['trousers','TROUSERS']])require(entry[field].path===`static/layers/${sid}/${filename}.png`&&entry[field].role==='REGISTERED_GARMENT_RGBA','Wrong ID or class');
  const c='controls/', t='templates/'+entry.template_in_cp93+'/';
  const names=['SHOE8_APPROVED64_UNMODIFIED','FROZEN_HEAD_NECK_VISIBILITY','LEFT_HAND_UNMODIFIED','RIGHT_HAND_UNMODIFIED','LEFT_CUFF_UNMODIFIED','RIGHT_CUFF_UNMODIFIED','AVATAR_FROZEN_UNMODIFIED','FACE_PROTECTION_MASK'];
  const values=await Promise.all(names.map(n=>asset(c+n+'.png')));const controls=Object.fromEntries(names.map((n,i)=>[n,values[i]]));
  const [jacket,trousers,shirt]=await Promise.all([asset(entry.jacket.path,entry.jacket.sha256),asset(entry.trousers.path,entry.trousers.sha256),asset(t+'SHIRT.png')]);
  if(token!==requestToken)return;
  ctx.clearRect(0,0,996,2748);
  const ordered=[controls.SHOE8_APPROVED64_UNMODIFIED,trousers,controls.FROZEN_HEAD_NECK_VISIBILITY,shirt,jacket,controls.LEFT_HAND_UNMODIFIED,controls.RIGHT_HAND_UNMODIFIED,controls.LEFT_CUFF_UNMODIFIED,controls.RIGHT_CUFF_UNMODIFIED];for(const image of ordered)ctx.drawImage(image,0,0);
  let frame=ctx.getImageData(0,0,996,2748),face=pix(controls.FACE_PROTECTION_MASK),avatar=pix(controls.AVATAR_FROZEN_UNMODIFIED);
  for(let i=0;i<frame.data.length;i+=4)if(face[i]>0){frame.data[i]=avatar[i];frame.data[i+1]=avatar[i+1];frame.data[i+2]=avatar[i+2];frame.data[i+3]=avatar[i+3];}
  if(entry.template_in_cp93==='S05'){
   const p=t+'historical_control/';const [windowImage,alphaImage,referenceImage]=await Promise.all([asset(p+'S04_C71_SHIRT_WINDOW.png'),asset(p+'S04_C71_JACKET_ALPHA.png'),asset(p+'S04_C71_SHIRT_RESTORE_REFERENCE.png')]);
   if(token!==requestToken)return;const w=pix(windowImage),a=pix(alphaImage),r=pix(referenceImage);
   for(let i=0;i<frame.data.length;i+=4)if(w[i+3]===255&&a[i]===0){for(let k=0;k<4;k++)frame.data[i+k]=r[i+k];}
  }
  ctx.putImageData(frame,0,0);select.value=sid;canvas.dataset.suitId=sid;
  window.hewrsTest.selected=sid;window.hewrsTest.history.push(sid);window.hewrsTest.error=null;window.hewrsTest.ready=true;
  status.textContent=sid+' — registered jacket + trousers\nFrozen avatar and supporting controls\nStatic test only; not a live-app release';
 }catch(e){if(token!==requestToken)return;window.hewrsTest.error=String(e);window.hewrsTest.ready=false;status.className='error';status.textContent=String(e);throw e;}
}
window.showSuit=showSuit;
(async()=>{pins=await(await fetch('INPUT_PINS.json')).json();registry=await(await fetch('REGISTER.json')).json();require(registry.schema==='hewrs.suit.static.v2'&&registry.ids.length===18,'Invalid register');for(const id of registry.ids){const o=document.createElement('option');o.value=id;o.textContent=id;select.appendChild(o);}select.addEventListener('change',()=>showSuit(select.value));document.getElementById('previous').onclick=()=>showSuit(registry.ids[(registry.ids.indexOf(select.value)+17)%18]);document.getElementById('next').onclick=()=>showSuit(registry.ids[(registry.ids.indexOf(select.value)+1)%18]);await showSuit('S05');})().catch(e=>{status.className='error';status.textContent=String(e);window.hewrsTest.error=String(e);});
