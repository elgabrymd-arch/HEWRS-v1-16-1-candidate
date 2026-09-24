#!/usr/bin/env python3
"""Build this clean source tree as static HTML or an offline single-file application.
Reads only this new tree. Never reads or changes a production index.html.
"""
from pathlib import Path
import argparse,base64,json,re
R=Path(__file__).resolve().parents[1]
SCRIPTS=['data/inputs.js','vendor/hewrs-logic.js','vendor/approved-scores.js','vendor/ensemble-completion.js','vendor/release-guards.js','vendor/request-contract.js','src/controller.js','vendor/watch-classification.js','src/canonical-bindings-browser.js','vendor/active50-renderer.js','data/approved-suits.js','src/suit-resolver97-browser.js','src/approved-suit-sources.js','data/suit-assembly.js','data/ds035-coverage.js','data/ds035-edge.js','src/suit-assemblies.js','src/connection.js','data/blazer-connection.js','data/trouser-profiles.js','src/trouser-profiles.js','src/blazer-connection.js','data/shirt-only.js','src/shirt-only-connection.js','data/non-suit-sources.js','src/non-suit-sources.js','src/ds035-coverage-renderer.js','src/ds035-edge-renderer.js','src/atomic-renderer.js','src/blazer-renderer.js','src/b01-b02-renderer.js','src/shirt-only-renderer.js','src/mixed-renderer.js','src/local-state.js','src/facelift-state.js','src/source-aware-pickers.js','src/application.js']
def build(standalone=None):
 t=(R/'app.template.html').read_text()
 html=t.replace('<!--STYLE-->','<link rel="stylesheet" href="src/application.css">').replace('<!--SCRIPTS-->','\n'.join('<script src="'+p+'"></script>' for p in SCRIPTS))
 (R/'app.html').write_text(html)
 (R/'index.html').write_text(html)
 if standalone:
  images={p.stem:base64.b64encode(p.read_bytes()).decode('ascii') for p in sorted(list((R/'assets').glob('*.png'))+list((R/'assemblies').glob('*.png')))}
  script='<script>globalThis.HEWRS_EMBEDDED_IMAGES='+json.dumps(images,separators=(',',':'))+';</script>\n'
  for p in SCRIPTS:
   source=(R/p).read_text()
   if re.search(r'</script',source,re.I):raise ValueError('Unsafe literal script terminator in '+p)
   script+='<script>\n'+source+'\n</script>\n'
  single=t.replace('<!--STYLE-->','<style>'+ (R/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->',script)
  Path(standalone).write_text(single)
  print(json.dumps({'standalone':str(standalone),'bytes':Path(standalone).stat().st_size,'embedded_images':len(images)}))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--standalone',type=Path);args=a.parse_args();build(args.standalone)
