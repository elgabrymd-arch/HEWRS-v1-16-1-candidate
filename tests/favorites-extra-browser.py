#!/usr/bin/env python3
"""Additional actual DOM failure/cancellation guards; all storage synthetic."""
import json,base64,importlib.util
from pathlib import Path
from playwright.sync_api import sync_playwright
import facelift_harness as h
R=Path(__file__).resolve().parents[1];h.R=R;E=R/'evidence/favorites_v1_16_6';checks=[]
def ck(n,x):
 checks.append({'name':n,'passed':bool(x)})
 if not x:raise AssertionError(n)
def supply(page,hashes):
 present=set(page.evaluate('Object.keys(HEWRS_EMBEDDED_IMAGES)'))
 for sha,path in hashes.items():
  if sha not in present:page.evaluate('x=>{Object.assign(HEWRS_EMBEDDED_IMAGES,x);}',{sha:base64.b64encode((R/path).read_bytes()).decode()})
h.supply=supply
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=b.new_page(viewport={'width':390,'height':700},is_mobile=True,has_touch=True)
 h.load(p,storage={'sentinel':'unchanged'})
 # Favorite not preloaded on purpose; create exact bookmark but no donor image payload.
 target={'shirtOnly':True,'pantId':'PG002','shirtId':'DS023','state':'T017','shoeId':'shoe-8','watchId':None}
 p.evaluate('''s=>{HEWRSApp.favorites.add(s,{id:'favorite_FAILURE_TEST',created_at:'2026-09-27T03:41:53.000Z'});HEWRSApp.showPage('rotation');}''',target)
 current=p.evaluate('HEWRSApp.state().selection');wear=p.evaluate('HEWRSApp.store.exportText()');favorite=p.evaluate('HEWRSApp.favorites.exportText()')
 p.click('#favorites-button');p.click('[data-favorite-open="favorite_FAILURE_TEST"]');p.wait_for_function('()=>document.querySelector("#fx-sheet-error").textContent.length>0')
 ck('Missing favorite image fails without substituting an outfit or writing wear',p.evaluate('HEWRSApp.state().selection')==current and p.evaluate('HEWRSApp.store.exportText()')==wear and p.evaluate('HEWRSApp.favorites.exportText()')==favorite)
 p.click('#fx-sheet-close');h.ensure(p,[target]);p.evaluate('s=>HEWRSApp.apply(s,{save:false})',target);p.evaluate('HEWRSApp.showPage("rotation")');p.click('#favorites-button');p.click('#favorite-data')
 p.set_input_files('#favorites-file',{'name':'existing.json','mimeType':'application/json','buffer':favorite.encode()});p.wait_for_function('()=>!document.querySelector("#favorites-import-preview").hidden')
 ck('Duplicate-only file is previewed but cannot trigger a redundant write',p.locator('#confirm-favorites-import').is_disabled() and p.evaluate('HEWRSApp.favorites.exportText()')==favorite)
 p.get_by_role('button',name='Back',exact=True).click();p.click('#fx-sheet-close')
 p.evaluate('''()=>{const s={suitId:'S05',shirtId:'DS035',state:'REFERENCE',shoeId:'shoe-8',watchId:null};globalThis.TEST_REF=s;}''');ref=p.evaluate('TEST_REF');h.ensure(p,[ref]);p.evaluate('s=>HEWRSApp.apply(s,{save:false})',ref);p.evaluate('HEWRSApp.showPage("rotation")');p.click('#favorites-button')
 ck('Retained reference cannot be saved as an exact favorite outfit',p.locator('#save-favorite').is_disabled())
 p.click('#fx-sheet-close');p.evaluate('HEWRSApp.showPage("wardrobe")');p.click('#data-button');ck('Existing wear backup dialog explains separate Favorites backup', 'Favorites have a separate export/import' in p.locator('#fx-sheet-body').inner_text())
 b.close()
(E/'EXTRA_BROWSER.json').write_text(json.dumps({'schema':'hewrs.favorites.extra-browser.v1_16_6','scope':__doc__,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks},indent=2)+'\n');print(checks)
