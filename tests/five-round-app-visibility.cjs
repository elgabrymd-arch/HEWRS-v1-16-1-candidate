'use strict';
// Execute the actual final presentation boundary independently of generation.
// This catches navigation redisplaying a retained-but-rejected selection.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/outfit-refill-application.js','utf8');
const start=source.indexOf('function presentFrame()'),end=source.indexOf('\nfunction diagnosticSnapshot()',start);
assert.ok(start>=0&&end>start);
const baseline=process.argv.includes('--expect-baseline-defect');
const current={suitId:'S05',shirtId:'DS029',state:'T029',shoeId:'shoe-1',watchId:null};
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,disabled:false,dataset:{},textContent:'',replaceChildren(...children){this.children=children;}});return nodes.get(id);};
let allowed=false,throwRead=false,checks=0;
const context=vm.createContext({current:structuredClone(current),feedbackReadError:null,busy:false,options:[],
 $:node,el:(_tag,text)=>({textContent:text}),currentContext:()=>({occasion:'work',requiredFormality:'any'}),
 rejectionGate:()=>({allowed:()=>{if(throwRead)throw Error('Synthetic stale rejection snapshot');return allowed;}}),
 setFeedbackReadError(error){context.feedbackReadError=error.message;node('outfit-output').hidden=true;},
 status(){},updateLogButtons(){node('record-wear').disabled=node('outfit-output').hidden;node('quick-log').disabled=node('outfit-output').hidden;}
});
vm.runInContext(source.slice(start,end),context);
function present(){return vm.runInContext('presentFrame()',context);}
function check(name,fn){fn();checks++;console.log('PASS:',name);}
present();
if(baseline){assert.equal(node('outfit-output').hidden,false);console.log('REPRODUCED: final presentation boundary redisplays a rejected retained selection');process.exit(0);}
check('Rejected retained outfit cannot be redisplayed by navigation',()=>{assert.equal(node('outfit-output').hidden,true);assert.equal(node('record-wear').disabled,true);assert.equal(node('quick-log').disabled,true);});
check('Rejection remains visible as an explanation',()=>assert.equal(node('outfit-empty').hidden,false));
allowed=true;present();
check('An allowed current outfit remains displayable',()=>{assert.equal(node('outfit-output').hidden,false);assert.equal(node('outfit-empty').hidden,true);});
allowed=false;context.current.state='NO_TIE';present();
check('No Tie selections receive the same rejection guard',()=>assert.equal(node('outfit-output').hidden,true));
context.current.state='REFERENCE';present();
check('A retained non-recommendation reference still displays',()=>assert.equal(node('outfit-output').hidden,false));
context.current.state='T029';throwRead=true;present();
check('Unreadable rejection state cannot expose a retained frame',()=>{assert.equal(node('outfit-output').hidden,true);assert.match(context.feedbackReadError,/stale/);});
throwRead=false;allowed=true;present();
check('Existing failed-read state still blocks display',()=>assert.equal(node('outfit-output').hidden,true));
context.feedbackReadError=null;context.current=null;present();
check('Missing current selection cannot expose old canvas pixels',()=>assert.equal(node('outfit-output').hidden,true));
console.log('FIVE ROUND APP VISIBILITY:',checks,'checks passed');
