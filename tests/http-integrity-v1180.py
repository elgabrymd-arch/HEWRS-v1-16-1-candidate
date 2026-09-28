#!/usr/bin/env python3
"""Local HTTP byte-delivery check only; not a real browser/origin persistence test."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.request import urlopen
from urllib.parse import quote,unquote,urlsplit
import threading,hashlib,json,re,functools,ast,subprocess
R=Path(__file__).resolve().parents[1]
E=R/'evidence/recalibration_v1_18_0'
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(R)))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
base='http://127.0.0.1:'+str(server.server_address[1])+'/'
sha=lambda raw:hashlib.sha256(raw).hexdigest()
html=(R/'index.html').read_text()
refs=re.findall(r'<script[^>]+src="([^"]+)"',html)+re.findall(r'<link[^>]+href="([^"]+)"',html)
paths=['index.html','app.html']+refs+[p.relative_to(R).as_posix()for root in ['assets','assemblies']for p in (R/root).rglob('*')if p.is_file()and p.suffix.lower()in ['.png','.jpg','.jpeg','.webp']]
checks=[]
try:
 for resource in paths:
  actual=urlopen(base+quote(resource,safe='/?=&'),timeout=10).read()
  p=R/unquote(urlsplit(resource).path);expected=p.read_bytes()
  assert actual==expected,resource
  checks.append({'resource':resource,'bytes':len(actual),'sha256':sha(actual)})
finally:
 server.shutdown();server.server_close();thread.join()
scripts=re.findall(r'<script[^>]+src="([^?"]+)(?:[^"]*)"',html)
for name in scripts:subprocess.run(['node','--check',str(R/name)],check=True,capture_output=True)
for name in ['tools/verify_v1180.py','tools/rollback_v1180.py','tests/preference-browser-v1180.py','tests/http-integrity-v1180.py']:ast.parse((R/name).read_text())
result={'status':'PASS','scope':__doc__,'resource_count':len(checks),'active_javascript_parse_count':len(scripts),'python_parse_count':4,'checks':checks}
(E/'HTTP_AND_SYNTAX.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items()if k!='checks'}))
