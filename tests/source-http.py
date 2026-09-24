#!/usr/bin/env python3
"""Check exact static-file delivery through a temporary local HTTP server.
No external service is contacted; this is not a browser/site deployment test.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading,hashlib,json,urllib.request,re,os
R=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(R),**kwargs)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
base='http://127.0.0.1:'+str(server.server_port)+'/'
paths=['index.html','app.html','src/application.css']
paths+=re.findall(r'<script src="([^"]+)"', (R/'index.html').read_text())
paths +=[str(p.relative_to(R)) for p in sorted([*(R/'assets').glob('*.png'),*(R/'assemblies').glob('*.png')])]
rows=[]
try:
 for name in paths:
  with urllib.request.urlopen(base+name,timeout=10) as response:
   data=response.read();expect=(R/name).read_bytes()
   if response.status!=200 or data!=expect:raise ValueError('Static delivery mismatch '+name)
   rows.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
finally:server.shutdown();server.server_close();thread.join()
result={'status':'PASS','checked':len(rows),'files':rows,'scope':'Temporary localhost HTTP file delivery only. Not a browser, remote deployment, Safari or physical iPhone check.'}
out=Path(os.environ.get('HEWRS_HTTP_OUTPUT',R/'evidence/blazers_v1_9/HTTP_FILES.json'));out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':'PASS','checked':len(rows)}))
