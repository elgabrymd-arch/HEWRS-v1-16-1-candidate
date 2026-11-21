'use strict';
// Execute the actual lazy-module loader. A stale cached dependency must never
// execute as part of a newer reviewed panel; load failure must stay retryable.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'src/reviewed-rejection-integration.js'),'utf8');
const manifest=source.match(/const MODULE_DELIVERY=Object\.freeze\((\{[\s\S]*?\})\);/)[0];
const loader=source.match(/^function js\(url\).*$/m)[0];
function environment(){
 const tags=[],c=vm.createContext({document:{head:{append(n){tags.push(n);}}},el:()=>({remove(){this.removed=true;}})});
 vm.runInContext(manifest+'\n'+loader+'\nglobalThis.load=js;',c);return {tags,load:c.load};
}
for(const file of Object.keys(JSON.parse(manifest.match(/Object\.freeze\((.*)\);/s)[1])))test('Reviewed module pins exact current bytes: '+file,async()=>{
 const {tags,load}=environment(),promise=load(file+'?v=old-cache-key');assert.equal(tags.length,1);
 const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest();
 assert.equal(tags[0].src,file+'?v='+digest.toString('hex').slice(0,16));assert.equal(tags[0].integrity,'sha256-'+digest.toString('base64'));
 tags[0].onload();await promise;
});
test('Unknown module cannot be appended; failed module is removed and a subsequent load can succeed',async()=>{
 const {tags,load}=environment();await assert.rejects(load('unknown.js'),/Unknown candidate module/);assert.equal(tags.length,0);
 const file='feedback-candidate/reviewed/reviewed-selector.js',failed=load(file);tags[0].onerror();await assert.rejects(failed,/failed to load/);assert.equal(tags[0].removed,true);
 const retry=load(file);assert.equal(tags.length,2);tags[1].onload();await retry;
});
