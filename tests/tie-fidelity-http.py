#!/usr/bin/env python3
"""Check exact local HTTP delivery; not a hosted-browser/device test."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import http.server,socketserver,threading,urllib.request,hashlib,json,importlib.util
R=Path(__file__).resolve().parents[1];E=R/'evidence/tie_fidelity_v1_17_2'
class H(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(R),**kw)
 def log_message(self,*a):pass
server=socketserver.TCPServer(('127.0.0.1',0),H);threading.Thread(target=server.serve_forever,daemon=True).start();port=server.server_address[1]
spec=importlib.util.spec_from_file_location('b',R/'tools/build.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
paths=['index.html','app.html','src/application.css',*m.SCRIPTS,*json.loads((R/'data/tie-fidelity.json').read_text())['assetPaths'].values()];rows=[]
try:
 for p in sorted(set(paths)):
  with urllib.request.urlopen(f'http://127.0.0.1:{port}/{p}?v=1172',timeout=10)as res:raw=res.read();ctype=res.headers.get('Content-Type')
  h=hashlib.sha256(raw).hexdigest();assert raw==(R/p).read_bytes();rows.append({'path':p,'bytes':len(raw),'sha256':h,'content_type':ctype})
finally:server.shutdown();server.server_close()
(E/'HTTP.json').write_text(json.dumps({'status':'PASS','boundary':'Standard-library localhost HTTP byte-delivery check; not hosted, physical Safari, or browser-origin acceptance.','resources':len(rows),'rows':rows},indent=2)+'\n');print('PASS HTTP',len(rows))
