'use strict';
// Current picker -> photo utility -> current application. Execute the real UI
// modules and retain exact registered images in both corrected/previous modes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
function element(tag='div'){
 const n={tag,children:[],dataset:{},style:{},attributes:{},textContent:'',hidden:false,append(...v){this.children.push(...v);},prepend(...v){this.children.unshift(...v);},setAttribute(k,v){this.attributes[k]=String(v);},getAttribute(k){return k==='src'?this.src:this.attributes[k]??null;},addEventListener(type,fn){this['on'+type]=fn;},remove(){this.removed=true;},querySelectorAll(){return [];}};
 return n;
}
test('Current suit picker exposes an existing registered photo-review page',()=>{
 const body=element(),list=element(),type={value:'suit'};body.querySelector=selector=>selector==='#picker-list'?list:selector==='#picker-type'?type:body.children.find(x=>x.id===selector.slice(1))||null;
 const c=vm.createContext({document:{readyState:'complete',createElement:element,getElementById:id=>id==='fx-sheet-body'?body:null},MutationObserver:class{observe(){}disconnect(){}},HEWRSApp:{ui:{draft:()=>({category:'topwear'}),rows:{topwear:[]}}}});
 vm.runInContext(read('data/suit-picker-images.js'),c);c.HEWRS_INPUT_SHA256=c.HEWRS_SUIT_PICKER_IMAGES.source_lock;
 vm.runInContext(read('src/blazer-picker-preview.js'),c);
 const note=body.children.find(x=>x.id==='hewrs-suit-photo-review');assert.ok(note);const link=note.children[0];assert.equal(link.href,'suit-photo-review.html?item=S02');assert.ok(fs.existsSync(path.join(ROOT,link.href.split('?')[0])));assert.equal(note.hidden,false);
 type.value='blazer';c.HEWRSBlazerPickerPreview.refresh();assert.equal(note.hidden,true);assert.equal(body.children.length,1);
});
for(const selected of ['S02','S13'])test(selected+' photo utility returns to the current app and retains exact approved/previous image sources',()=>{
 const ids=new Map(),footer=element('footer'),suits=['S02','S13'].map(s=>({...element('button'),dataset:{suit:s}})),modes=['corrected','before'].map(mode=>({...element('button'),dataset:{mode}}));
 const byId=id=>{if(!ids.has(id))ids.set(id,element());return ids.get(id);};
 const c=vm.createContext({URLSearchParams,location:{search:'?item='+selected},history:{replaceState(){}},document:{getElementById:byId,querySelector:()=>footer,querySelectorAll:selector=>selector==='[data-suit]'?suits:modes}});
 vm.runInContext(read('data/suit-picker-images.js'),c);const before=JSON.stringify(c.HEWRS_SUIT_PICKER_IMAGES);
 vm.runInContext(read('src/suit-photo-review.js'),c);
 const registered=c.HEWRS_SUIT_PICKER_IMAGES.items[selected],older=selected==='S02'?'602f0e20ad7c078df99c569c9f6dd0d5460e0ca1bf1b0fb64b0efacc88c87a11':'78665b0d498df9edb4b127661170468d482cd772b58b6be7ca6a7f33dc95c8fa';
 for(const mode of modes){mode.onclick();const expected=mode.dataset.mode==='corrected'?registered.src:'ui/suit-photo-review/'+older+'.png';for(const id of ['full-image','detail-image']){assert.equal(byId(id).src,expected);assert.ok(fs.existsSync(path.join(ROOT,expected)));}assert.equal(byId('picker-link').href,'index.html');assert.equal(byId('picker-link').textContent,'Back to HEWRS');assert.ok(fs.existsSync(path.join(ROOT,byId('picker-link').href)));}
 assert.equal(JSON.stringify(c.HEWRS_SUIT_PICKER_IMAGES),before);assert.match(read('suit-photo-review.html'),/id="picker-link"[^>]*href="index\.html"[^>]*>Back to HEWRS/);
});
