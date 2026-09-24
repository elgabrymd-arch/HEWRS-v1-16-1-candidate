#!/usr/bin/env python3
"""Additional real UI callbacks; exact source with a memory-only storage fixture."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from facelift_harness import R,load
E=Path(os.environ.get('HEWRS_FACELIFT_EXTRA_OUTPUT',R/'evidence/facelift_v1_11/browser_extra'));E.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def ck(name,v):
 checks.append({'name':name,'passed':bool(v)});print(('PASS ' if v else 'FAIL ')+name,flush=True)
 if not v:raise AssertionError(name)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);p=b.new_page(viewport={'width':390,'height':844},accept_downloads=True);p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  load(p,storage={'production_sentinel':'UNCHANGED'})
  before=p.evaluate('HEWRSApp.ui.snapshot()');p.click('#pref-shirt');p.fill('#picker-search','DS017');p.locator('[data-item-id="DS017"]').click();p.mouse.click(5,5);ck('Backdrop discards draft without modifying Home',not p.locator('#fx-sheet').is_visible() and p.evaluate('HEWRSApp.ui.snapshot()')==before)
  p.evaluate('HEWRSApp.showPage("outfits")');p.click('#record-wear');p.click('#confirm-wear');ck('Real confirmation records one exact event',p.evaluate('HEWRSApp.store.snapshot().events.length')==1)
  p.evaluate('HEWRSApp.showPage("wardrobe")');p.click('#data-button');expected=p.evaluate('HEWRSApp.store.exportText()')
  with p.expect_download() as dl:p.click('#export-backup')
  download=dl.value;file=E/'TEST_EXPORTED_BACKUP.json';download.save_as(str(file));ck('Actual export button downloads exact current-format backup',file.read_text()==expected and download.suggested_filename.startswith('HEWRS_LOCAL_BACKUP_'));p.keyboard.press('Escape')
  p.evaluate('HEWRSApp.showPage("rotation")');selection=p.evaluate('HEWRSApp.store.snapshot().session');p.click('#clear-log');p.get_by_role('button',name='Confirm clear',exact=True).click();ck('Confirmed Clear changes only local events and retains session',p.evaluate('HEWRSApp.store.snapshot().events.length')==0 and p.evaluate('HEWRSApp.store.snapshot().session')==selection and p.evaluate("__STORAGE_MAP.get('production_sentinel')==='UNCHANGED'"))
  p.evaluate('HEWRSApp.showPage("wardrobe")');p.click('#data-button');p.set_input_files('#backup-file',{'name':'TEST_EXPORTED_BACKUP.json','mimeType':'application/json','buffer':file.read_bytes()});p.wait_for_function('()=>!document.getElementById("confirm-restore").disabled');p.click('#confirm-restore');p.wait_for_function('()=>!document.getElementById("fx-sheet").open&&!HEWRSApp.state().busy');ck('Exported backup restores the exact event after explicit confirmation',p.evaluate('HEWRSApp.store.snapshot().events')==json.loads(expected)['events'])
  p.evaluate('HEWRSApp.showPage("rotation")');p.click('#clear-log');p.evaluate('HEWRSApp.store.saveSession(HEWRSApp.store.snapshot().session)');p.get_by_role('button',name='Confirm clear',exact=True).click();ck('Concurrent source revision prevents stale Clear',p.evaluate('HEWRSApp.store.snapshot().events.length')==1 and 'History changed' in p.inner_text('#fx-sheet-error'));p.keyboard.press('Escape')
  p.evaluate('HEWRSApp.showPage("home")');p.click('#weather-button');ck('No prototype weather is substituted','no connected weather provider' in p.inner_text('#fx-sheet-body'));p.keyboard.press('Escape');p.click('#season-button');ck('No prototype season eligibility is introduced','no connected season provider' in p.inner_text('#fx-sheet-body'));p.keyboard.press('Escape')
  ck('No JavaScript errors',not errors)
 finally:
  (E/'EXTRA_BROWSER.json').write_text(json.dumps({'scope':'Actual UI callbacks in in-memory Chromium; download capture and explicit storage fixture, not a physical phone or browser restart. Test event only; not owner wear data.','passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'page_errors':errors},indent=2)+'\n');b.close()
