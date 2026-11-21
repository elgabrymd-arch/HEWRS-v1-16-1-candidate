#!/usr/bin/env python3
"""Isolated actual-browser investigation of the reviewed-dialog overflow."""
import argparse
import functools
import importlib.util
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('matrix', ROOT / 'tests/issue19-browser.py')
matrix = importlib.util.module_from_spec(spec)
spec.loader.exec_module(matrix)
PROBES = {
    'original': '',
    'buttons': '.rd-dialog button{max-width:100%;min-width:0;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere}',
    'grid_children': '.rd-dialog .rd-visuals>*{min-width:0;max-width:100%}.rd-dialog .rd-head h2{min-width:0;overflow-wrap:anywhere}',
    'summaries': '.rd-dialog summary{overflow-wrap:anywhere;white-space:normal;max-width:100%}',
}
PROBES['combined'] = ''.join(PROBES.values())
SNAPSHOT = r'''()=>{
 const d=document.getElementById('rd-dialog'),box=d.getBoundingClientRect(),surface=document.getElementById('rd-canvas').getBoundingClientRect();
 const items=[...d.querySelectorAll('*')].map(e=>{
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);
  return {tag:e.tagName,id:e.id,classes:e.className,text:e.textContent?.trim().slice(0,160),
   x:r.x,right:r.right,width:r.width,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,
   display:s.display,whiteSpace:s.whiteSpace,minWidth:s.minWidth,maxWidth:s.maxWidth,
   overflowWrap:s.overflowWrap,boxSizing:s.boxSizing};
 }).filter(e=>e.width>0&&(e.right>box.left+d.clientWidth+1||e.scrollWidth>e.clientWidth+1));
 return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
   dialog:{left:box.left,width:d.clientWidth,scrollWidth:d.scrollWidth,open:d.open},
   canvas:{left:surface.left,right:surface.right,height:surface.height},offenders:items};
}'''

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--browser',required=True);args=parser.parse_args()
    output=ROOT/'evidence/issue19-layout-diagnostic'/args.browser;output.mkdir(parents=True,exist_ok=True)
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self,*_): pass
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    rows=[]
    try:
        with sync_playwright() as pw:
            browser=getattr(pw,args.browser).launch(headless=True)
            context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
            page=context.new_page();page.set_default_timeout(120000)
            page.goto(f'http://127.0.0.1:{server.server_port}/index.html',wait_until='domcontentloaded')
            page.wait_for_function('globalThis.HEWRS_READY&&HEWRSApp.rejection')
            page.evaluate('async()=>{await HEWRSApp.rejection.ready;await HEWRSApp.ownerFeedback.sync();}')
            selected=matrix.FIT.selection('DS001','NO_TIE','B01')
            record=page.evaluate(matrix.FIT_FRAME,{'selected':selected,'ignoredHashes':[]})
            assert record['status']=='ready' and record['last']==selected
            for phase,css in PROBES.items():
                style=page.add_style_tag(content=css) if css else None
                for width in [320,390,430,768]:
                    page.set_viewport_size({'width':width,'height':844})
                    page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
                    row={'phase':phase,'width':width,'css':css,**page.evaluate(SNAPSHOT)};rows.append(row)
                    page.evaluate('()=>document.getElementById("rd-dialog").scrollTop=0')
                    page.screenshot(path=str(output/f'{phase}-{width}-top.png'))
                    page.locator('#rd-canvas').scroll_into_view_if_needed()
                    page.screenshot(path=str(output/f'{phase}-{width}-preview.png'))
                    (output/'RESULT.json').write_text(json.dumps({'browser':args.browser,'rows':rows},indent=2)+'\n')
                    print(json.dumps({'phase':phase,'width':width,'dialog':row['dialog'],'offenders':row['offenders']}),flush=True)
                if style: style.evaluate('(e)=>e.remove()')
            context.close();browser.close()
    finally: server.shutdown();server.server_close()

if __name__=='__main__': main()
