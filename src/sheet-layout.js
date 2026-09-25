/* V1.16.4: layout/focus adapter for the existing modal. No selection,
 * rendering, catalogue, network or browser-storage operations. */
(function(root){'use strict';
let active=null,frame=0;
const props=['--fx-visible-height','--fx-list-height','--fx-keyboard-bottom'];
function dimensions(v,layoutHeight){
  const h=Number(v?.height),top=Number(v?.offsetTop)||0,lh=Number(layoutHeight);
  const visible=Number.isFinite(h)&&h>0?h:(Number.isFinite(lh)&&lh>0?lh:600);
  const gap=visible<420?8:16;
  const usable=Math.max(1,visible-gap);
  return {visible:usable,list:Math.min(760,usable),bottom:Math.max(0,(Number.isFinite(lh)?lh:visible)-visible-top)};
}
function sync(){
  frame=0;
  if(!active)return;
  const vv=root.visualViewport;
  // Keep pinch zoom available; do not resize the sheet around a magnified view.
  if(vv&&Math.abs((Number(vv.scale)||1)-1)>0.02)return;
  const m=dimensions(vv,root.innerHeight);
  for(const [key,value]of Object.entries({'--fx-visible-height':m.visible,'--fx-list-height':m.list,'--fx-keyboard-bottom':m.bottom})){
    const text=Math.round(value*100)/100+'px';
    if(active.style.getPropertyValue(key)!==text)active.style.setProperty(key,text);
  }
}
function schedule(){if(active&&!frame)frame=root.requestAnimationFrame(sync);}
function begin(sheet,list=false){
  end();active=sheet;sheet.dataset.listSheet=String(list);sync();
  const body=sheet.querySelector('.fx-sheet-body');if(body)body.scrollTop=0;
  sheet.scrollTop=0;
}
function end(){
  if(frame&&root.cancelAnimationFrame)root.cancelAnimationFrame(frame);frame=0;
  if(active){for(const key of props)active.style.removeProperty(key);delete active.dataset.listSheet;active=null;}
}
function focusSearch(search){
  // Touch pickers open without forcing the software keyboard. Search remains
  // available by tapping it; desktop keyboard workflow keeps immediate focus.
  const touch=root.matchMedia?.('(pointer: coarse)').matches===true;
  const target=touch?active?.querySelector('#fx-sheet-close'):search;
  target?.focus?.({preventScroll:true});
}
root.addEventListener?.('resize',schedule,{passive:true});
root.addEventListener?.('orientationchange',schedule,{passive:true});
root.visualViewport?.addEventListener('resize',schedule,{passive:true});
root.visualViewport?.addEventListener('scroll',schedule,{passive:true});
root.HEWRSSheetLayout=Object.freeze({version:'1.16.4',begin,end,focusSearch,dimensions});
})(globalThis);
