#!/usr/bin/env python3
"""Build this clean source tree as static HTML or an offline single-file application.
Reads only this new tree. Never reads or changes a production index.html.
"""
from pathlib import Path
import argparse,base64,json,re,hashlib
R=Path(__file__).resolve().parents[1]
SCRIPTS=['src/runtime-loader.js','data/inputs.js','src/style-occasion-policy.js','data/owner-source-corrections.js','src/source-corrections.js','data/shoe-photo-corrections.js','src/shoe-photo-corrections.js','vendor/hewrs-logic.js','vendor/approved-scores.js','vendor/ensemble-completion.js','vendor/release-guards.js','vendor/request-contract.js','src/controller.js','vendor/watch-classification.js','src/canonical-bindings-browser.js','vendor/active50-renderer.js','data/approved-suits.js','src/suit-resolver97-browser.js','src/approved-suit-sources.js','data/suit-assembly.js','data/ds035-coverage.js','data/ds035-edge.js','src/suit-assemblies.js','data/additional-blazers.js','src/additional-blazers.js','src/connection.js','data/blazer-connection.js','data/trouser-profiles.js','src/trouser-profiles.js','data/batch10.js','src/batch10-contract.js','src/blazer-connection.js','data/shirt-only.js','src/shirt-only-connection.js','data/non-suit-sources.js','src/non-suit-sources.js','data/ds023-cleanup.js','src/ds023-cleanup-connection.js','data/ds023-edges.js','src/ds023-edges-connection.js','src/ds035-coverage-renderer.js','src/ds035-edge-renderer.js','src/atomic-renderer.js','src/blazer-renderer.js','src/b01-b02-renderer.js','src/shirt-only-renderer.js','src/batch10-renderer.js','src/mixed-renderer.js','src/local-state.js','src/favorites-state.js','src/rotation-insights.js','data/option-index.js','src/legacy-accessories.js','src/weather-context.js','src/automatic-weather.js','src/option-set-policy.js','src/outfit-preference.js','src/automatic-engine.js','data/stylist-library.js','src/outfit-learning.js','data/preference-pilot.js','data/preference-followup.js','src/researched-preference.js','src/hybrid-stylist.js','data/stylist-service-config.js','src/visual-stylist-client.js','src/facelift-state.js','src/source-aware-pickers.js','src/automatic-preferences.js','src/sheet-layout.js','data/tie-fidelity.js','src/tie-fidelity.js','data/option-card-thumbnails.js','src/option-cards.js','src/preference-panel.js','src/application.js']
def build(standalone=None):
 t=(R/'app.template.html').read_text()
 # One dependency-ordered UI bundle; historical files remain the source of truth.
 # The original large option-index is requested only by Generate, not by Home.
 def fingerprint(path):return hashlib.sha256((R/path).read_bytes()).hexdigest()
 index='data/option-index.js';loader='src/runtime-loader.js';inputs='data/inputs.js'
 included=[x for x in SCRIPTS if x not in {loader,inputs,index}]
 code='/* HEWRS V1.24.2 approved B15 fit startup bundle; generated from tools/build.py. */\n'
 for x in included:
  code+='\n/* SOURCE: '+x+' */\n'+(R/x).read_text()+'\n;\n'
 directory=R/'runtime';directory.mkdir(exist_ok=True)
 name='runtime/hewrs-'+hashlib.sha256(code.encode()).hexdigest()[:20]+'.js'
 (R/name).write_text(code)
 sri=lambda path:'sha256-'+base64.b64encode(bytes.fromhex(fingerprint(path))).decode()
 tags=[f'<script defer src="{loader}?v={fingerprint(loader)[:16]}" integrity="{sri(loader)}" data-boot="true" data-engine-index="{index}?v={fingerprint(index)[:16]}" data-engine-integrity="{sri(index)}"></script>',
       f'<script defer src="{inputs}?v={fingerprint(inputs)[:16]}" integrity="{sri(inputs)}"></script>',
       f'<script defer src="{name}" integrity="{sri(name)}"></script>']
 html=t.replace('<!--STYLE-->','<link rel="stylesheet" href="src/application.css?v='+fingerprint('src/application.css')[:16]+'">').replace('<!--SCRIPTS-->','\n'.join(tags))
 record={'schema':'hewrs.fast-startup.v1_22_1','startup_scripts':[loader,inputs,name],'bundle_sources':included,'deferred_index':index,'script_order':SCRIPTS,'bytes_if_current_sources_were_unbundled':sum((R/x).stat().st_size for x in SCRIPTS if x!=loader),'bytes_at_home':sum((R/x).stat().st_size for x in [loader,inputs,name]),'resource_integrity':{x:{'bytes':(R/x).stat().st_size,'sha256':fingerprint(x)}for x in [loader,inputs,name,index,'src/application.css']}}
 (R/'STARTUP_RESOURCES.json').write_text(json.dumps(record,indent=2)+'\n')
 (R/'app.html').write_text(html)
 (R/'index.html').write_text(html)
 if standalone:
  images={p.stem:base64.b64encode(p.read_bytes()).decode('ascii') for p in sorted(list((R/'assets').glob('*.png'))+list((R/'assemblies').glob('*.png')))}
  ui_images={p.stem:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode('ascii') for p in sorted((R/'ui/option-cards').glob('*.png'))}
  script='<script>globalThis.HEWRS_EMBEDDED_IMAGES='+json.dumps(images,separators=(',',':'))+';</script>\n'
  script+='<script>globalThis.HEWRS_EMBEDDED_SOURCE_EVIDENCE='+json.dumps({'S02':'data:image/png;base64,'+base64.b64encode((R/'ui/source-evidence/S02-owner-crop.png').read_bytes()).decode('ascii')})+';</script>\n'
  script+='<script>globalThis.HEWRS_EMBEDDED_UI_IMAGES='+json.dumps(ui_images,separators=(',',':'))+';</script>\n'
  for p in SCRIPTS:
   source=(R/p).read_text()
   if re.search(r'</script',source,re.I):raise ValueError('Unsafe literal script terminator in '+p)
   script+='<script>\n'+source+'\n</script>\n'
  single=t.replace('<!--STYLE-->','<style>'+ (R/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->',script)
  Path(standalone).write_text(single)
  print(json.dumps({'standalone':str(standalone),'bytes':Path(standalone).stat().st_size,'embedded_images':len(images)}))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--standalone',type=Path);args=a.parse_args();build(args.standalone)
