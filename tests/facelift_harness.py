"""Exact scripts/images in memory-loaded Chromium. No hosted/device claim."""
from pathlib import Path
import base64,importlib.util
R=Path(__file__).resolve().parents[1]
DEFAULT={'suitId':'S05','shirtId':'DS036','state':'T017','shoeId':'shoe-8','watchId':None}
def ensure(page,selections):
 hashes=page.evaluate('''selections=>{const a=globalThis.HEWRSApp||__SOURCE;const out={};function walk(v){if(!v||typeof v!=='object')return;if(v.sha256&&a.connection.assetPaths[v.sha256])out[v.sha256]=a.connection.assetPaths[v.sha256];for(const n of Object.values(v))if(n&&typeof n==='object')walk(n);}for(const s of selections)walk(a.renderer.plan(s));return out;}''',selections)
 supply(page,hashes)
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'));batch={};size=0
 for sha,path in hashes.items():
  if sha in present:continue
  f=R/path;b64=base64.b64encode(f.read_bytes()).decode('ascii');batch[sha]=b64;size+=len(b64)
  if size>2_000_000:page.evaluate('x=>Object.assign(HEWRS_EMBEDDED_IMAGES,x)',batch);batch={};size=0
 if batch:page.evaluate('x=>Object.assign(HEWRS_EMBEDDED_IMAGES,x)',batch)
def load(page,baseline=False,storage=None,preload=None):
 rollback=R/'rollback/facelift_v1_11'
 def source(name):
  alt=rollback/name
  return (alt if baseline and alt.is_file() else R/name).read_text()
 page.set_content(source('app.template.html').replace('<!--STYLE-->','<style>'+source('src/application.css')+'</style>').replace('<!--SCRIPTS-->',''))
 if storage is not None:
  page.evaluate('''seed=>{const m=new Map(Object.entries(seed));globalThis.__STORAGE_CALLS=[];globalThis.__STORAGE_MAP=m;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(k){__STORAGE_CALLS.push(['get',k]);return m.get(k)??null;},setItem(k,v){__STORAGE_CALLS.push(['set',k]);m.set(k,v);},removeItem(k){__STORAGE_CALLS.push(['remove',k]);m.delete(k);}}});}''',storage)
 page.evaluate('globalThis.HEWRS_EMBEDDED_IMAGES={};')
 spec=importlib.util.spec_from_file_location('builder',R/'tools/build.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
 for f in mod.SCRIPTS:
  if f=='src/application.js' or (baseline and f=='src/facelift-state.js'):continue
  page.add_script_tag(content=source(f))
 page.evaluate('''()=>{const connection=HEWRSCleanConnection.create(HEWRS_INPUTS);const canvas=document.createElement('canvas');const renderer=HEWRSAtomicRenderer.create(canvas,connection,{resolveUrl:d=>'data:image/png;base64,'+HEWRS_EMBEDDED_IMAGES[d.sha256]});globalThis.__SOURCE={connection,renderer};}''')
 ensure(page,[DEFAULT,*(preload or [])])
 page.add_script_tag(content=source('src/application.js'))
 page.wait_for_function('()=>globalThis.HEWRS_READY===true||globalThis.HEWRS_LOAD_ERROR',timeout=30000)
 err=page.evaluate('globalThis.HEWRS_LOAD_ERROR||null')
 if err:raise RuntimeError(err)
 page.evaluate('delete globalThis.__SOURCE;')
