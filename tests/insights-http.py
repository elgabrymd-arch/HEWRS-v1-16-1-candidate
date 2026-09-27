#!/usr/bin/env python3
"""Standard-library HTTP byte integrity, not browser acceptance."""
from pathlib import Path
import functools,http.server,threading,urllib.request,urllib.parse,re,json,hashlib
R=Path(__file__).resolve().parents[1];E=R/'evidence/insights_v1_16_7'
class H(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(H,directory=str(R)))
threading.Thread(target=s.serve_forever,daemon=True).start()
checks=[]
try:
 html=(R/'index.html').read_text();urls=re.findall(r'<script src="([^"]+)"',html)+re.findall(r'<link rel="stylesheet" href="([^"]+)"',html)
 assert len(urls)==len(set(urls))
 for q in ['index.html',*urls]:
  p=R/urllib.parse.urlsplit(q).path
  b=urllib.request.urlopen(f'http://127.0.0.1:{s.server_port}/{q}',timeout=10).read();assert b==p.read_bytes(),q
  checks.append({'url':q,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 out={'status':'PASS','scope':__doc__,'files':checks,'count':len(checks)}
finally:s.shutdown();s.server_close()
(E/'HTTP.json').write_text(json.dumps(out,indent=2)+'\n');print('PASS',len(checks))
