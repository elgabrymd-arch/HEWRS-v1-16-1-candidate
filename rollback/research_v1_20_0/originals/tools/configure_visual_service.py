#!/usr/bin/env python3
"""Pin one HTTPS private-stylist endpoint and its exact CSP origin.
No passwords or API keys are accepted. This creates a locally configured variant
of the delivered package and regenerates its file-integrity manifest.
"""
from pathlib import Path
from urllib.parse import urlsplit
import argparse,hashlib,json,subprocess,sys,re
R=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--endpoint',required=True);a=p.parse_args();url=a.endpoint.rstrip('/');u=urlsplit(url)
 if u.scheme!='https' or not u.hostname or u.username or u.password or u.query or u.fragment or any(c in url for c in ['"',"'",';','<','>',' ','\n','\r']):p.error('Use one HTTPS endpoint without credentials, query, fragment or whitespace.')
 origin=u.scheme+'://'+u.netloc;template=R/'app.template.html';text=template.read_text()
 m=re.search(r'connect-src ([^;]+);',text)
 if not m:raise SystemExit('Missing existing connect-src. No security policy was changed.')
 manifest_path=R/'PACKAGE_SHA256.json';manifest=json.loads(manifest_path.read_text());old=digest(manifest_path.read_bytes())
 for row in manifest['files']:
  f=R/row['path']
  if not f.is_file() or f.stat().st_size!=row['bytes'] or digest(f.read_bytes())!=row['sha256']:raise SystemExit('Refusing configuration on a mismatched source tree: '+row['path'])
 known={row['path']for row in manifest['files']}|{'PACKAGE_SHA256.json','.gitattributes','.DS_Store','desktop.ini','Thumbs.db'}
 extra=[str(f.relative_to(R))for f in R.rglob('*')if f.is_file()and '.git'not in f.parts and '__pycache__'not in f.parts and str(f.relative_to(R))not in known]
 if extra:raise SystemExit('Refusing to publish unverified extra files (including possible secrets): '+', '.join(extra))
 record=R/'VISUAL_SERVICE_CONFIGURATION.json';previous=json.loads(record.read_text())if record.exists()else{}
 values=m[1].split();prev=previous.get('origin')
 if prev and prev!=origin:values=[x for x in values if x!=prev]
 if origin not in values:values.append(origin)
 text=text[:m.start(1)]+' '.join(values)+text[m.end(1):];template.write_text(text)
 (R/'data/stylist-service-config.js').write_text('globalThis.HEWRS_VISUAL_SERVICE_CONFIG='+json.dumps({'schema':'hewrs.visual-service-config.v1','endpoint':url},separators=(',',':'))+';\n')
 subprocess.run([sys.executable,'-B',str(R/'tools/build.py')],check=True)
 record.write_text(json.dumps({'schema':'hewrs.locally-configured-service.v1','endpoint':url,'origin':origin,'previous_package_manifest_sha256':old,'provider_key_in_browser':False,'deployment_performed':False},indent=2)+'\n')
 manifest['files']=[{'path':str(f.relative_to(R)),'bytes':f.stat().st_size,'sha256':digest(f.read_bytes())}for f in sorted(R.rglob('*'))if f.is_file()and f.name!='PACKAGE_SHA256.json'and '.git'not in f.parts and '__pycache__'not in f.parts]
 # Include nested historical package manifests as original payloads.
 for f in sorted(R.rglob('PACKAGE_SHA256.json')):
  if f!=manifest_path and '.git'not in f.parts:manifest['files'].append({'path':str(f.relative_to(R)),'bytes':f.stat().st_size,'sha256':digest(f.read_bytes())})
 manifest['files'].sort(key=lambda r:r['path']);manifest['configuration']='Exact user-configured service origin; provider credentials remain server-only.';manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
 print('Configured endpoint only; no service was deployed or called. Run tools/verify_v1190.py, then commit the configured frontend files. Keep all provider/service secrets outside this repository.')
def digest(raw):return hashlib.sha256(raw).hexdigest()
if __name__=='__main__':main()
