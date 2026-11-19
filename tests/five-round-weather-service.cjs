'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const g=vm.createContext({structuredClone,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,Date,console});
for(const name of ['weather-context','visual-stylist-client'])vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),g);
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS:',name);}
async function main(){
 const W=g.HEWRSWeather;
 for(const millimetres of [0,0.3,1,100])for(const code of [-1,4,44,49,54,100,NaN,Infinity,2.5]){
  assert.throws(()=>W.precipitation(code,millimetres),/Unknown weather code|Precipitation data/);
 }
 check('Unknown weather codes never become valid wet-weather recommendations',()=>{});
 const groups={dry:[0,1,2,3,45,48],lightRain:[51,53,55,61,80],heavyRain:[63,65,81,82,95,96,99],snowIce:[56,57,66,67,71,73,75,77,85,86]};
 for(const [expected,codes]of Object.entries(groups))for(const code of codes)assert.equal(W.precipitation(code,0),expected);
 check('All existing valid weather-code classifications are unchanged',()=>{});
 const privateRequest={source_lock:'synthetic',prefs:{shirt:{mode:'item',id:'DS029'}},context:{occasion:'work'},executiveStyle:'AUTO',localDate:'2026-11-19',environment:{source:'manual',temperatureBand:'cool',precipitation:'dry',season:'Fall',place:{latitude:10.123456,longitude:20.123456},secret:'omit'},history:'omit',favorites:'omit',credentials:'omit'};
 const outgoing=g.HEWRSVisualStylistClient.publicRequest(privateRequest);
 check('Visual request allowlist omits precise place, history, Favorites and credentials',()=>{assert.equal(JSON.stringify(outgoing).includes('omit'),false);assert.equal(JSON.stringify(outgoing).includes('10.123456'),false);assert.deepEqual(Object.keys(outgoing).sort(),['context','date','executiveStyle','prefs','source_lock','weather']);});
 let release,signal;
 const client=g.HEWRSVisualStylistClient.create({config:{endpoint:'https://synthetic.invalid'},fetcher:async(_url,options)=>{signal=options.signal;return {ok:true,status:200,text:()=>new Promise(resolve=>release=resolve)};}});
 const login=client.login('synthetic-test-password');
 while(!release)await new Promise(resolve=>setTimeout(resolve,0));
 client.disconnect();assert.equal(signal.aborted,true);
 release(JSON.stringify({schema:'hewrs.visual-stylist.v1',token:'synthetic-token',expires_at:Date.now()/1000+300,live_ready:true}));
 await assert.rejects(login,/CANCELLED/);
 check('A late service reply cannot sign back in after Disconnect',()=>assert.equal(client.ready(),false));
 for(const endpoint of ['http://synthetic.invalid','https://user:password@synthetic.invalid','https://synthetic.invalid?token=x','https://synthetic.invalid/#secret'])assert.throws(()=>g.HEWRSVisualStylistClient.create({config:{endpoint}}),/SERVICE_CONFIGURATION/);
 check('Service endpoints reject insecure transport and embedded credentials',()=>{});
 console.log('FIVE ROUND WEATHER/SERVICE:',passed,'checks passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
