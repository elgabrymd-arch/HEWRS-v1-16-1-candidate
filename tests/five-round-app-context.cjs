'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/outfit-refill-application.js','utf8'),start=source.indexOf('function invalidateRecommendations('),end=source.indexOf('\nfunction details()',start);
const calls={native:0,visual:0,weather:0};
const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};
const c=vm.createContext({generation:5,busy:true,optionHistoryToken:'history',optionPreferenceToken:'learning',options:[{}],lastRequest:{old:true},lastAttemptRequest:{old:true},report:{},optionIndex:0,currentOption:{},origin:'engine',producing:{},rejectionRemoved:{},$,
 renderer:{cancel:()=>calls.native++},visualStylist:{cancel:()=>calls.visual++},autoWeather:{cancel:()=>calls.weather++},setBusy:value=>c.busy=value,displayCurrent(){},presentEmpty(){}});
vm.runInContext(source.slice(start,end),c);
vm.runInContext('invalidateRecommendations("Weather settings updated")',c);
assert.equal(c.generation,6);assert.equal(c.busy,false);assert.equal(c.lastRequest,null);assert.equal(c.options.length,0);assert.deepEqual(calls,{native:1,visual:1,weather:1});
console.log('PASS: Changing recommendation context cancels pending generation and all rendering/provider work');
c.generation=20;c.busy=false;
vm.runInContext('invalidateRecommendations("Fresh automatic weather before submit",{cancelPending:false})',c);
assert.equal(c.generation,20);assert.deepEqual(calls,{native:1,visual:1,weather:1});
console.log('PASS: Automatic weather refresh before generation preserves the submitting action');
