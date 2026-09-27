#!/usr/bin/env python3
"""Check actual static HTTP response bytes and the two updated script URLs.
This is not browser, hosted-site or physical-device acceptance.
"""
from pathlib import Path
import functools,http.server,threading,re,json,urllib.request,urllib.parse,hashlib
R=Path(__file__).resolve().parents[1];E=R/'evidence/favorites_v1_16_6'
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(R)))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();origin=f'http://127.0.0.1:{server.server_port}/';checks=[]
try:
 html=urllib.request.urlopen(origin).read();assert html==(R/'index.html').read_bytes()
 refs=re.findall(r'<script src="([^"]+)"',html.decode())+re.findall(r'<link rel="stylesheet" href="([^"]+)"',html.decode())
 assert 'src/application.js?v=1166'in refs and'src/favorites-state.js?v=1166'in refs
 for ref in refs:
  name=urllib.parse.urlsplit(ref).path;raw=urllib.request.urlopen(origin+ref).read();assert raw==(R/name).read_bytes(),ref
  checks.append({'url_path':ref,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'equal':True})
 (E/'HTTP.json').write_text(json.dumps({'status':'PASS','scope':__doc__,'index_equal':True,'script_urls_versioned':True,'resources':checks},indent=2)+'\n')
 print('HTTP PASS',len(checks),'resources')
finally:server.shutdown();server.server_close()
