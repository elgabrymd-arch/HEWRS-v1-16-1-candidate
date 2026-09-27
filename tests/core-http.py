#!/usr/bin/env python3
"""Local HTTP byte delivery, not browser execution or remote deployment."""
from pathlib import Path
import json,threading,http.server,functools,urllib.request,urllib.parse,hashlib,re
R=Path(__file__).resolve().parents[1];E=R/'evidence/core_v1_17_0'
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(R)));threading.Thread(target=s.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{s.server_port}/';urls=['index.html','app.html','RELEASE_STATUS.json','RELEASE_SCOPE.json']+re.findall(r'(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"',(R/'index.html').read_text());rows=[]
try:
 for u in urls:
  with urllib.request.urlopen(base+u,timeout=10)as q:b=q.read()
  p=R/urllib.parse.urlparse(u).path;h=hashlib.sha256(b).hexdigest();assert h==hashlib.sha256(p.read_bytes()).hexdigest(),u;rows.append({'url':u,'sha256':h,'bytes':len(b)})
 (E/'HTTP.json').write_text(json.dumps({'status':'PASS','count':len(rows),'scope':__doc__,'resources':rows},indent=2)+'\n');print('HTTP exact-byte checks',len(rows))
finally:s.shutdown();s.server_close()
