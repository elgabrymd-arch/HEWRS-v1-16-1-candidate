'use strict';
/* Explicit historical-contract runner for exactly two immutable Issue 19
 * tests. Their oracles are the old garment RGB values, formerly permitted
 * B06 ties and the literal ed326c1f runtime. Those assertions remain intact.
 *
 * Use NODE_OPTIONS=--require=./tests/issue22-retained-source-baseline.cjs so
 * the collar test's fresh child processes use this same pinned baseline.
 * Do not preload current Issue 22 tests: they must exercise the shipped app,
 * its new cloth, and its hard no-tie guard. Other test files are refused here.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const permitted=new Set(['avatar-v3-shirt-collar-fit.cjs','issue19-cuff-underlay.cjs']);
const target=path.basename(process.argv[1]||'');
assert.ok(permitted.has(target),'Historical baseline preload is restricted to the two immutable source-oracle tests');
const harness=require('./avatar-v3-fit-runtime.cjs'),original=harness.load;
const entrypoint='avatar-v3-issue22-baseline.html';
const expectedHtml='dd7c401d29ab12cf3fb2d9d2938ddd9753291c42982d60f326c3bf367dd9afba';
const expectedRuntime='ed326c1f8f1b513a3a960ebf508c27e80df688ff41c9aad756e63fa35c34d8f1';
assert.equal(harness.digest(fs.readFileSync(path.join(harness.ROOT,entrypoint))),expectedHtml,'Exact released Issue 19 entrypoint');
harness.load=function historicalLoad(options={}){
  // An explicitly requested older Issue 19 oracle is never redirected.
  if(Object.hasOwn(options,'entrypoint'))return original(options);
  const result=original({...options,entrypoint});
  assert.equal(result.metadata.runtime_sha256,expectedRuntime,'Exact historical source-oracle runtime');
  return result;
};
console.log('ISSUE22_HISTORICAL_CONTRACT='+JSON.stringify({test:target,entrypoint,
  runtime_sha256:expectedRuntime,current_issue22_validation:false,
  reason:'Original RGB/geometry assertions and formerly legal B06 ties retain their exact released baseline; current Issue 22 is verified separately.'}));
