#!/usr/bin/env python3
"""Reconcile source/default entrypoints to owner-accepted Standard; never publish.
No garment, renderer, classification, provider, or browser-storage changes.
"""
from pathlib import Path
import hashlib, json, re, subprocess
R=Path(__file__).resolve().parents[1]
ACCEPTED='5e071d9be76cbcba0f8a1d1c60720bb9a57feab1'
BUNDLE='runtime/hewrs-bbbcec41d08f91585f4a.js'
BUNDLE_SHA='bbbcec41d08f91585f4ab40cd4b15b2cddfb08df35e04a6122747066ba637150'
HTML_SHA='e5a4e23588ffef53c8668de5afd181e87f90cb1efcbec5442a341a1cd35cceb8'
ALIGN={
 'src/owner-feedback.js':(None,'54ac378212c068eeeb0460ee07996a79ec9a0e4c26cf65f7e86b445f3157839f'),
 'src/automatic-engine.js':('462e5717827b4025263f23be99adb0723f87e5cd4eeb640093de6224be506e0b','4d14bc7418cd6439e3af05ccd41097c15756ed283ac6ed151791963b5bb41cca'),
 'src/hybrid-stylist.js':('6de893e2c7120be8688778b263fefcabb817a4d1d50144e1be4e5a424626f21e','4a8cf486a3c21d83f51b726d2de58c645e9ccf15931630b4e59eb7118d1ccf34'),
 'src/owner-feedback-integration.js':(None,'ba32d6d31754eb29e717a6c47b9d1acd43441e47f2bcfe0d5d5bbd1d665594ab'),
 'src/application.js':('73830b233146daab208c4366909f5f7982b390bf09bf51c8fa6f05841ff687e4','16758bf257fdf91eb339e5cfae4e265b687704cd36b503968416265e90a3ad58'),
}
def sha(data): return hashlib.sha256(data).hexdigest()
def once(text,old,new):
 if text.count(old)!=1: raise ValueError('Ambiguous build anchor: '+old[:65])
 return text.replace(old,new,1)
def main():
 raw=(R/BUNDLE).read_bytes();html=(R/'stage10-integration.html').read_bytes()
 assert sha(raw)==BUNDLE_SHA and sha(html)==HTML_SHA,'Accepted release changed'
 code=raw.decode('utf-8');marks=list(re.finditer(r'\n/\* SOURCE: ([^*]+) \*/\n',code))
 sources={};roundtrip=code[:marks[0].start()]
 for i,m in enumerate(marks):
  end=marks[i+1].start() if i+1<len(marks) else len(code)
  section=code[m.end():end];assert section.endswith('\n;\n')
  text=section[:-3];name=m.group(1);assert name not in sources
  sources[name]=text.encode('utf-8');roundtrip+=m.group(0)+text+'\n;\n'
 assert len(sources)==107 and roundtrip.encode('utf-8')==raw
 mismatch=[]
 for name,content in sources.items():
  p=R/name;current=p.read_bytes() if p.exists() else None
  if current!=content:
   assert name in ALIGN,'Unexpected source mismatch: '+name
   before,after=ALIGN[name]
   assert (sha(current) if current is not None else None)==before
   assert sha(content)==after
   mismatch.append(name)
 assert set(mismatch)==set(ALIGN),'Unexpected source alignment scope'
 for name in mismatch:
  p=R/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(sources[name])
 template=html.decode('utf-8')
 css=re.search(r'<link rel="stylesheet" href="src/application\.css\?v=[a-f0-9]+">',template);assert css
 template=once(template,css.group(0),'<!--STYLE-->')
 startup=re.search(r'<script defer src="src/runtime-loader\.js[^\n]+\n<script defer src="data/inputs\.js[^\n]+\n<script defer src="runtime/hewrs-[a-f0-9]+\.js"[^\n]+</script>',template);assert startup
 template=once(template,startup.group(0),'<!--SCRIPTS-->')
 assert template.count('<!--STYLE-->')==1 and template.count('<!--SCRIPTS-->')==1
 (R/'app.template.html').write_text(template,encoding='utf-8')
 build=(R/'tools/build.py').read_text('utf-8')
 scripts=['src/runtime-loader.js','data/inputs.js']+list(sources)
 scripts.insert(scripts.index('src/legacy-accessories.js'),'data/option-index.js')
 script_match=re.search(r'^SCRIPTS=\[[^\n]+\]',build,re.M);assert script_match
 build=once(build,script_match.group(0),'SCRIPTS='+repr(scripts))
 build=once(build,'def build(standalone=None):\n',"def build(standalone=None):\n if standalone:\n  raise ValueError('Standard includes separately loaded review panels; build the full application folder, not the legacy single-file export.')\n")
 build=once(build," directory=R/'runtime';directory.mkdir(exist_ok=True)"," frozen=json.loads((R/'STANDARD_RELEASE.json').read_text())\n if hashlib.sha256(code.encode()).hexdigest()!=frozen['runtime_sha256']:\n  raise ValueError('Standard runtime differs from the accepted baseline. Review a new release explicitly; no files were published.')\n directory=R/'runtime';directory.mkdir(exist_ok=True)")
 anchor=" record={'schema':'hewrs.fast-startup.v1_22_1'"
 build=once(build,anchor," if hashlib.sha256(html.encode()).hexdigest()!=frozen['entrypoint_sha256']:\n  raise ValueError('Standard launch page differs from the accepted baseline; release review required.')\n"+anchor)
 build=once(build," (R/'STARTUP_RESOURCES.json').write_text"," record['accepted_standard_commit']=frozen['accepted_commit']\n record['integration_resources']=frozen['integration_resources']\n (R/'STARTUP_RESOURCES.json').write_text")
 build=build.replace('Build this clean source tree as static HTML or an offline single-file application.\nReads only this new tree. Never reads or changes a production index.html.','Rebuild the owner-accepted HEWRS Standard default application.\nWrites local index.html/app.html only after the frozen runtime and HTML match.\nNetwork publication and browser-storage changes are never performed here.')
 (R/'tools/build.py').write_text(build,encoding='utf-8')
 paths=[]
 for _,url in re.findall(r'(src|href)="([^"]+)"',html.decode()):
  name=url.split('?')[0]
  if not name.startswith(('#','http:','https:','data:')) and name not in paths:
   assert (R/name).is_file(),'Missing release dependency: '+name
   paths.append(name)
 manifest={'schema':'hewrs.standard.accepted-release.v1','accepted_commit':ACCEPTED,'runtime':BUNDLE,'runtime_sha256':BUNDLE_SHA,'entrypoint_sha256':HTML_SHA,'standard_entrypoints':['index.html','app.html'],'retained_acceptance_entrypoint':'stage10-integration.html','module_count':107,'modules':{n:sha(b) for n,b in sources.items()},'integration_resources':{n:sha((R/n).read_bytes()) for n in paths},'rollback_branch':'backup/standard-before-default-handoff-20261113','browser_data_copied':False,'api_creative_enabled':False}
 (R/'STANDARD_RELEASE.json').write_text(json.dumps(manifest,indent=2)+'\n')
 out=R/'release/standard';out.mkdir(parents=True,exist_ok=True)
 report={'accepted_commit':ACCEPTED,'runtime_unchanged':True,'avatar_and_garment_assets_unchanged':True,'restored_sources':{n:{'previous_sha256':ALIGN[n][0],'accepted_sha256':ALIGN[n][1]} for n in mismatch},'basis':'Exact extraction from accepted runtime; not new implementations','private_browser_data_accessed':False}
 (out/'SOURCE_ALIGNMENT.json').write_text(json.dumps(report,indent=2)+'\n')
 subprocess.run(['python','tools/build.py'],cwd=R,check=True)
 assert (R/'index.html').read_bytes()==html and (R/'app.html').read_bytes()==html
 assert (R/BUNDLE).read_bytes()==raw
 print(json.dumps({'default_handoff':'prepared_not_published','runtime_sha256':BUNDLE_SHA,'entrypoint_sha256':HTML_SHA,'source_modules_aligned':mismatch,'module_count':len(sources)},indent=2))
if __name__=='__main__': main()
