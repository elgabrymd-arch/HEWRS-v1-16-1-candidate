/* HEWRS picker imagery: exact garment-ID decoration only.
   No preference, engine, rendering or storage modification. */
(function(root){"use strict";
 const approved="3e60ce18a0295c6801983ce91dda296efec458b275f523523dee1e3915db7516";
 const enhanced=new WeakSet();let observer=null;
 function refresh(){
  const app=root.HEWRSApp,category=app?.ui?.draft()?.category;
  if(!["shirt","tie"].includes(category))return;
  const body=document.getElementById("fx-sheet-body"),list=body?.querySelector("#picker-list");
  const manifest=root.HEWRS_OPTION_CARD_THUMBNAILS;
  if(!list||!manifest||manifest.source_lock!==approved||root.HEWRS_INPUT_SHA256!==approved)return;
  const map=category==="shirt"?manifest.shirts:manifest.ties;
  const nonSuit=category==="shirt"&&["blazer","shirt-only"].includes(app.ui.selectedTop()?.kind);
  observer?.disconnect();
  try{
   for(const button of list.querySelectorAll("button.fx-choice[data-item-id]")){
    if(enhanced.has(button))continue;
    const id=button.dataset.itemId,row=app.ui.rows[category]?.find(x=>x.id===id&&x.sourceId===id);
    const override=nonSuit?root.HEWRS_NON_SUIT_CARD_THUMBNAILS?.[id]?.no_tie:null;
    const descriptor=override||(category==="shirt"?map?.[id]?.no_tie:map?.[id]);
    const key=category==="shirt"?id+"/no_tie":id;
    const sourceMatches=descriptor&&(override?descriptor.source_kind==="registered_reconstruction_detail"&&new RegExp("^"+id+"/no_tie/batch[1-5]-reconstructed-shirt$").test(descriptor.source_key):descriptor.source_key===key);
    if(!row||!sourceMatches||!/^ui\/option-cards\/[a-f0-9]{64}\.png$/.test(descriptor.src)||!/^[a-f0-9]{64}$/.test(descriptor.sha256)||descriptor.sha256+".png"!==descriptor.src.split("/").pop())continue;
    const name=button.querySelector(".fx-choice-name");if(!name)continue;
    const picture=document.createElement("span");picture.className="hewrs-"+category+"-picker-image";
    const img=document.createElement("img");img.width=192;img.height=224;img.alt="";img.setAttribute("aria-hidden","true");img.loading="eager";img.decoding="async";img.dataset.sourceId=id;img.dataset.sourceSha256=descriptor.sha256;img.dataset.sourceKey=descriptor.source_key;
    if(override)picture.title="Approved reconstructed shirt detail for blazer and shirt-only outfits.";
    const fallback=document.createElement("span");fallback.className="hewrs-"+category+"-picker-unavailable";fallback.hidden=true;fallback.textContent="Image unavailable · "+id;
    img.onerror=()=>{img.hidden=true;fallback.hidden=false;};
    picture.append(img,fallback);
    const copy=document.createElement("span");copy.className="hewrs-"+category+"-picker-copy";
    while(button.firstChild)copy.append(button.firstChild);
    button.append(picture,copy);button.classList.add("hewrs-"+category+"-picker-choice");
    if(category==="tie"&&typeof row.color==="string"&&row.color.trim())name.textContent=row.color.trim();
    button.setAttribute("aria-label",id+" — "+row.label);
    enhanced.add(button);img.src=descriptor.src;
   }
  }finally{observer?.observe(body,{childList:true,subtree:true});}
 }
 function start(){const body=document.getElementById("fx-sheet-body");if(!body)return;observer=new MutationObserver(refresh);observer.observe(body,{childList:true,subtree:true});refresh();}
 root.HEWRSPhotoPickers=Object.freeze({refresh,revision:"integrated-photo-pickers-v2-context"});
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})(globalThis);
