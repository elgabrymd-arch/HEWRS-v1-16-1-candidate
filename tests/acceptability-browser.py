"""Actual shipped bundle and source renders; isolated synthetic storage. No provider."""
from pathlib import Path
import os,sys,json,re,base64,time,traceback,hashlib
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).parent));import option_card_harness as h
R=Path(__file__).resolve().parents[1];B=Path(os.environ['HEWRS_BASELINE']);E=R/'evidence/acceptability_v1_23_0/browser';E.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];frames=[];start=time.monotonic();resources=json.loads((R/'STARTUP_RESOURCES.json').read_text());pilot=json.loads((R/'data/preference-pilot.json').read_text());follow=json.loads((R/'data/preference-followup.json').read_text())
KEY='hewrs:outfit-preferences:v1'
source=json.loads((R/'data/inputs.json').read_text())
# This is a synthetic test fixture, intentionally different from owner feedback.
def synthetic_seed():
 rows=[]
 for i,p in enumerate(pilot['records'][:16]):
  rows.append(dict(id='pref_synthetic_'+str(i),created_at='2026-09-29T20:00:00.000Z',a=p['a'],b=p['b'],vote='both'if p['topwear']in ['S01','S03','B01','B03']else'neither',reason='no_reason',partition=p['partition'],pilot_id=p['id'],context=p['context'],source_revision=p['source_revision']))
 # Read only the public input lock; never preload an owner's feedback in this test.
 lock=re.search(r'HEWRS_INPUT_SHA256\s*=\s*[\'\"]([^\'\"]+)',(R/'data/inputs.js').read_text()).group(1)
 return {KEY:json.dumps(dict(schema='hewrs.outfit-preferences.v1',source_lock=lock,revision=len(rows),enabled=True,comparisons=rows)),'learning-sentinel':'KEEP'}
def save():
 (E/'RESULT.json').write_text(json.dumps(dict(scope='New shipped bundle with injected lazy delivery, synthetic storage and real wardrobe layers; not hosted/Safari acceptance.',passed=sum(c['passed']for c in checks),failed=sum(not c['passed']for c in checks),checks=checks,frames=frames,errors=errors,seconds=time.monotonic()-start),indent=2))
def ck(name,ok,detail=None):
 checks.append(dict(name=name,passed=bool(ok),detail=detail));save();print('PASS'if ok else'FAIL',name,flush=True)
 if not ok:raise AssertionError(name+' '+str(detail))
def load(p,seed=None):
 p.set_default_timeout(45000);p.set_content((R/'app.template.html').read_text().replace('<!--STYLE-->','<style>'+(R/'src/application.css').read_text()+'</style>').replace('<!--SCRIPTS-->',''))
 p.evaluate('''seed=>{const m=new Map(Object.entries(seed));globalThis.__STORAGE_MAP=m;globalThis.__STORAGE_CALLS=[];Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>{__STORAGE_CALLS.push([k,v]);m.set(k,v)},removeItem:k=>m.delete(k)}});globalThis.HEWRS_EMBEDDED_IMAGES={};globalThis.__INDEX_TAGS=[];const append=document.head.appendChild.bind(document.head);document.head.appendChild=function(n){if(n.dataset?.hewrsLazyIndex){__INDEX_TAGS.push(n);return n;}return append(n);};}''',seed or {'learning-sentinel':'KEEP'})
 tag=re.search(r'<script[^>]+data-boot="true"[^>]*>',(R/'index.html').read_text()).group(0);attrs=dict(re.findall(r'(data-[a-z-]+)="([^"]*)"',tag))
 p.evaluate('x=>{const s=document.createElement("script");for(const[k,v]of Object.entries(x.attrs))s.setAttribute(k,v);s.textContent=x.code;document.head.appendChild(s);}',dict(attrs=attrs,code=(R/'src/runtime-loader.js').read_text()))
 p.add_script_tag(content=(R/'data/inputs.js').read_text());p.add_script_tag(content=(R/resources['startup_scripts'][2]).read_text())
 p.wait_for_function('()=>globalThis.HEWRS_READY===true||globalThis.HEWRS_LOAD_ERROR');assert not p.evaluate('globalThis.HEWRS_LOAD_ERROR||null')
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.evaluate('d=>globalThis.HEWRS_EMBEDDED_UI_IMAGES=d',{f.stem:'data:image/png;base64,'+base64.b64encode(f.read_bytes()).decode()for f in (R/'ui/option-cards').glob('*.png')})
def supply(p):
 p.add_script_tag(content=(R/'data/option-index.js').read_text());p.evaluate('()=>{const n=__INDEX_TAGS.at(-1);if(n)n.onload()}')
def guard(p):
 return p.evaluate('({events:HEWRSApp.store.snapshot().events,favorites:HEWRSApp.favorites.snapshot(),feedback:__STORAGE_MAP.get(HEWRSOutfitLearning.KEY)||null,sentinel:__STORAGE_MAP.get("learning-sentinel")})')
def native(p):
 return p.evaluate('()=>{const d=document.getElementById("avatar").getContext("2d").getImageData(0,0,996,2748).data;let h=2166136261;for(const x of d)h=Math.imul(h^x,16777619);return h>>>0}')
def state(p):return dict(p.evaluate('Array.from(__STORAGE_MAP.entries())'))
with sync_playwright()as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  seed=synthetic_seed();p=b.new_page(viewport=dict(width=1280,height=1000));requests=[];p.on('request',lambda r:requests.append(r.url));load(p,seed)
  ck('Fast Home remains usable before images/index and never rewrites existing feedback',p.evaluate('HEWRS_READY&&!HEWRS_OUTFIT_READY&&!globalThis.HEWRS_OPTION_INDEX')and state(p)==seed and not p.evaluate('__STORAGE_CALLS')and not requests)
  p.evaluate('HEWRSApp.preferencePanel.open()');ck('Panel distinguishes active acceptability from inactive A/B ranking','acceptability: active' in p.locator('#pref-acceptability-status').inner_text()and'A/B preference ranking: inactive' in p.locator('#pref-learning-counts').inner_text());p.screenshot(path=str(E/'SYNTHETIC_LEARNING_STATUS.png'))
  before=guard(p);h.ensure(p,R,[follow['records'][0]['a'],follow['records'][0]['b']]);p.click('#pref-start-followup');p.wait_for_function('()=>!document.getElementById("pref-vote-both").disabled');ck('New shirt comparison opens two exact wardrobe renders without requiring another pilot',p.evaluate('()=>Array.from(document.querySelectorAll("#pref-pair-grid img")).every(x=>x.naturalWidth>0)')and 'only the shirt changes' in p.locator('#fx-sheet-body').inner_text()and guard(p)==before)
  p.screenshot(path=str(E/'SHIRT_COMPARISON_DESKTOP.png'));p.set_viewport_size(dict(width=390,height=780));p.screenshot(path=str(E/'SHIRT_COMPARISON_PHONE.png'))
  p.locator('#pref-pair-grid').get_by_text('Collar detail',exact=True).first.click();ck('Follow-up collar detail uses actual image crop and does not record feedback',p.locator('#pref-pair-grid').get_by_text('Full outfit',exact=True).count()==1 and guard(p)==before)
  p.click('#pref-vote-both');after=guard(p);last=p.evaluate('HEWRSApp.learning.snapshot().comparisons.at(-1)');ck('Both work stores precisely that new response; no pairwise winner is fabricated',last['vote']=='both'and last['a']==follow['records'][0]['a']and last['b']==follow['records'][0]['b']and last['pilot_id']=='FOLLOWUP_1230_01'and p.evaluate('HEWRSApp.learning.model().model.counts.informative')==0)
  ck('New response preserves every previous answer, wear and Favorites',p.evaluate('HEWRSApp.learning.snapshot().comparisons.slice(0,16)')==json.loads(seed[KEY])['comparisons']and before['events']==after['events']and before['favorites']==after['favorites']and before['sentinel']==after['sentinel'])
  ck('Voting does not auto-advance or infer a second vote',p.locator('#pref-next').is_visible()and p.evaluate('HEWRSApp.learning.snapshot().comparisons.length')==17)
  p.click('#pref-next');h.ensure(p,R,[follow['records'][1]['a'],follow['records'][1]['b']]);# navigation may start images before fixture preload; reopen after supplying exact sources
  p.evaluate('p=>HEWRSApp.preferencePanel.showPair(p,()=>{},()=>{})',follow['records'][1]);p.wait_for_function('()=>!document.getElementById("pref-vote-neither").disabled');p.click('#pref-vote-neither');ck('Neither response is retained as complete-outfit rejection, not an A/B vote',p.evaluate('HEWRSApp.learning.snapshot().comparisons.at(-1).vote')=='neither'and p.evaluate('HEWRSApp.learning.model().model.counts.informative')==0)
  p.evaluate('HEWRSApp.preferencePanel.open()');counts=p.locator('#pref-start-followup').inner_text();ck('Old pilot progress and new follow-up progress remain separate','2/12' in counts and '16/24' in p.locator('#pref-start-pilot').inner_text())
  base=guard(p);p.click('#pref-learning-toggle');ck('Pause stops both channels without erasing feedback',not p.evaluate('HEWRSApp.learning.model().model.active')and len(json.loads(guard(p)['feedback'])['comparisons'])==18);p.click('#pref-learning-toggle');ck('Resume restores both fits from saved responses',p.evaluate('HEWRSApp.learning.model().model.acceptability.active'))
  p.click('#pref-export');with_download=p.locator('a.lb-download');
  with p.expect_download()as dl:with_download.click()
  export=Path(E/'SYNTHETIC_PREFERENCE_EXPORT.json');dl.value.save_as(export);ck('Separate export retains schema and all exact answers without wear/Favorites',json.loads(export.read_text())==p.evaluate('HEWRSApp.learning.snapshot()')and guard(p)['events']==base['events']and guard(p)['favorites']==base['favorites'])
  p.evaluate('HEWRSApp.preferencePanel.open()');p.click('#pref-undo');p.locator('#fx-sheet-actions').get_by_text('Confirm undo',exact=True).click();ck('Undo removes only the last follow-up response',p.evaluate('HEWRSApp.learning.snapshot().comparisons.length')==17 and p.evaluate('HEWRSApp.learning.snapshot().comparisons.at(-1).vote')=='both')
  saved=state(p);p.close();p=b.new_page(viewport=dict(width=390,height=780));load(p,saved);p.evaluate('HEWRSApp.preferencePanel.open()');ck('Fresh page refits from same saved v1 answers without startup writes',state(p)==saved and p.evaluate('HEWRSApp.learning.model().model.acceptability.active')and not p.evaluate('__STORAGE_CALLS'))
  # New whole-outfit pair, with different topwear, no inferred recommendation.
  pair=follow['records'][4];h.ensure(p,R,[pair['a'],pair['b']]);p.evaluate('x=>HEWRSApp.preferencePanel.showPair(x,()=>{},()=>{})',pair);p.wait_for_function('()=>!document.getElementById("pref-vote-A").disabled');ck('Whole-outfit follow-up changes actual topwear and shirt/tie, with correct IDs','S05' in p.locator('#fx-sheet-body').inner_text()and'S10' in p.locator('#fx-sheet-body').inner_text());p.screenshot(path=str(E/'WHOLE_OUTFIT_PHONE.png'))
  layouts=[]
  for w,hh in [(320,568),(390,350),(390,780),(430,932),(1280,1000)]:
   p.set_viewport_size(dict(width=w,height=hh));v=p.evaluate('()=>({horizontal:document.documentElement.scrollWidth>innerWidth+1,buttons:Array.from(document.querySelectorAll("#fx-sheet-actions button")).filter(b=>!b.disabled).map(b=>({left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right}))})');layouts.append(dict(w=w,h=hh,**v));assert not v['horizontal'];assert all(x['left']>=-1 and x['right']<=w+1 for x in v['buttons'])
  ck('Comparison controls retain bounds across five desktop/phone-sized viewports',True,layouts)
  before=guard(p);p.locator('#fx-sheet-actions').get_by_text('Skip without saving',exact=True).click();ck('Skip/cancel creates no preference, wear or favorite record',guard(p)==before)
  # Reserved new comparisons do not change either fitted coefficient vector.
  pair=follow['records'][8];h.ensure(p,R,[pair['a'],pair['b']]);p.evaluate('x=>HEWRSApp.preferencePanel.showPair(x,()=>{},()=>{})',pair);p.wait_for_function('()=>!document.getElementById("pref-vote-both").disabled');m=p.evaluate('HEWRSApp.learning.model().model');p.click('#pref-vote-both');n=p.evaluate('HEWRSApp.learning.model().model');ck('Reserved Both response is saved for diagnosis and never fitted',m['weights']==n['weights']and m['acceptability']['weights']==n['acceptability']['weights']and n['counts']['validation']==m['counts']['validation']+1)
  # Clean synthetic fixture for actual model-driven generation.
  p.close();p=b.new_page(viewport=dict(width=1280,height=1000));load(p,seed);matrix=json.loads((R/'evidence/acceptability_v1_23_0/GENERATION_MATRIX.json').read_text());row=next(x for x in matrix['rows']if x['mode']=='synthetic_acceptability'and x['id']=='S10');h.ensure(p,R,row['selections']);
  p.evaluate('()=>{HEWRSApp.ui.reset();HEWRSApp.ui.set("topwear",{mode:"item",id:HEWRSApp.connection.aliases.get("S10")});HEWRSApp.setMode("engine");HEWRSApp.weather.apply({source:"not_assessed",date:"2026-09-29"});}');p.click('#work-button');p.locator('#local-date').fill('2026-09-29');p.locator('#local-date').dispatch_event('change');p.locator('#fx-sheet-actions').get_by_text('Apply',exact=True).click();before=guard(p);p.click('#generate-options');p.wait_for_function('()=>__INDEX_TAGS.length===1');supply(p);p.wait_for_function('()=>!HEWRSApp.state().busy&&HEWRSApp.state().page==="outfits"',timeout=120000)
  opts=p.evaluate('HEWRSApp.state().report.options');sels=[x['_hewrsConnected']['canonical_selection']for x in opts];ck('Actual Generate applies active acceptance to all20 options in Node-matching order',sels==row['selections']and all(x['_hewrsConnected']['preference']['learning']['acceptability_active']for x in opts))
  ck('Card says learned acceptability, not an activated A/B ranker','learned acceptability' in p.locator('#score-label').inner_text()and all(not x['_hewrsConnected']['preference']['learning']['pairwise_active']for x in opts));p.screenshot(path=str(E/'ACCEPTABILITY_GENERATED_CARD.png'))
  for i,s in enumerate(row['selections']):
   if i:p.click('#next-option');p.wait_for_function('i=>!HEWRSApp.state().busy&&HEWRSApp.state().optionIndex===i',arg=i)
   assert p.evaluate('HEWRSApp.renderer.last()')==s;frames.append(dict(type='generated-navigation',position=i+1,selection=s,native_fnv1a=native(p)))
  ck('All20 actual card positions retain exact IDs and generated images',len(frames)==20)
  ck('Generate and navigation never write feedback, wear or Favorites',guard(p)==before)
  # A real preference revision change must invalidate a pending generation.
  previous=native(p);p.evaluate('()=>{HEWRSApp.showPage("home");HEWRSApp.ui.reset();HEWRSApp.setMode("engine")}');p.click('#generate-options');p.wait_for_function('HEWRSApp.state().busy');p.evaluate('()=>{const l=HEWRSApp.learning;l.setEnabled(false,l.read().token);HEWRSApp.feedbackChanged()}');p.wait_for_function('()=>!HEWRSApp.state().busy',timeout=45000);ck('Preference change cancels obsolete ranking and preserves the previous outfit',native(p)==previous)
  # Renderer controls: exact same source layers before/after modification.
  p.close();new=b.new_page();load(new);old=b.new_page();h.load(old,B)
  controls=[dict(suitId=f'S{i:02}',shirtId='DS023',state='T017',shoeId='shoe-8',watchId=None)for i in range(1,19)]+[dict(blazerId=f'B{i:02}',pantId='PG002',shirtId='DS001',state='NO_TIE',shoeId='shoe-8',watchId=None)for i in range(1,15)]
  for s in controls:
   h.ensure(new,R,[s]);h.ensure(old,B,[s]);new.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);old.evaluate('s=>HEWRSApp.apply(s,{save:false})',s);a=native(old);z=native(new);assert a==z;frames.append(dict(type='renderer-control',selection=s,baseline_fnv1a=a,current_fnv1a=z))
  ck('32 same-selection render controls preserve native-frame hashes',sum(f['type']=='renderer-control'for f in frames)==32);new.close();old.close()
  bad=b.new_page();load(bad,{KEY:'{invalid'});bad.evaluate('HEWRSApp.preferencePanel.open()');ck('Corrupt feedback remains explicit and byte-preserved','unavailable' in bad.locator('#fx-sheet-body').inner_text()and state(bad)[KEY]=='{invalid');bad.close()
  ck('No uncaught application error',not errors,errors)
 except Exception:
  errors.append(traceback.format_exc());checks.append(dict(name='Complete browser run',passed=False,detail=errors[-1]));print(errors[-1],flush=True)
  try:p.screenshot(path=str(E/'ATTEMPT_FAILURE.png'))
  except:pass
 finally:save();b.close()
if any(not x['passed']for x in checks):sys.exit(1)
