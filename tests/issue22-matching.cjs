'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {load,memoryStorage,config,root}=require('./issue22-loader.cjs');
const {g,connection:c}=load(),realm=value=>vm.runInContext('('+JSON.stringify(value)+')',g),plain=value=>JSON.parse(JSON.stringify(value));
const data=JSON.parse(fs.readFileSync(root+'/data/issue22-garment-dna.json','utf8'));
const original=JSON.parse(fs.readFileSync(root+'/data/inputs.json','utf8'));
const originalIndex=JSON.parse(fs.readFileSync(root+'/data/option-index.json','utf8'));
const index=JSON.parse(fs.readFileSync(root+'/data/issue22-option-index.json','utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex');
A.equal(hash('data/inputs.json'),'3e60ce18a0295c6801983ce91dda296efec458b275f523523dee1e3915db7516');
A.equal(hash('data/option-index.json'),'b8959a8681eb8cfe6cdcdb84b0f682e40398aa617f0b15d4255e53076aebd5e7');
A.deepEqual(plain(g.HEWRS_ISSUE22_GARMENT_DNA),data,'data/JS source identity');
const before=JSON.stringify(g.HEWRS_INPUTS),effective=g.HEWRSIssue22Matching.apply(g.HEWRS_INPUTS);
A.equal(JSON.stringify(g.HEWRS_INPUTS),before,'Raw input remains unchanged');
const baseline=g.HEWRS_OWNER_SOURCE_CORRECTIONS;
let preserved=0;
for(const row of original.features.records){
 const current=effective.features.records.find(x=>x.id===row.id);
 if(!data.scope.includes(row.id)&&row.id!==baseline.item){A.deepEqual(plain(current),row,'Unrelated feature '+row.id);preserved++;}
 if(data.scope.includes(row.id)){
  for(const key of ['id','category','construction_text','asset_binding','historical_fields_unchanged','eligibility','seasonal_restrictions'])A.deepEqual(plain(current[key]),row[key],row.id+' '+key);
  A.equal(current.issue22_revision,data.revision);
  A.deepEqual(plain(current.source.historical_source),row.source);
 }
}
for(const id of ['B01','B06','B10']){
 const raw=original.features.records.find(x=>x.id===id),current=c.features.get(id);
 A.equal(current.primary_text,raw.primary_text,id+' original color');
 A.equal(current.pattern_text,raw.pattern_text,id+' original pattern');
 A.equal(current.mode_policy,'NO_TIE_ONLY');A.match(current.texture_text,/matte linen/);
 const normalized=c.engine.get(id);A.equal(normalized.relaxedTailoring,true);A.equal(normalized.surface,'pronounced');
}
A.match(c.features.get('S06').primary_text,/Neutral medium-dark grey/);
A.match(c.features.get('S06').pattern_text,/interlocking/);
A.equal(c.engine.get('S06').primary.value,2.4);
A.equal(c.engine.get('S06').primary.temperature,'neutral');
A.equal(c.engine.get('S06').pattern.contrast,1.2);
A.equal(c.engine.get('S06').pattern.quiet,true);
A.match(c.features.get('S13').pattern_text,/interlocking check/);
A.equal(c.engine.get('S13').primary.family,'blue');
A.equal(c.engine.get('S13').primary.value,1.8);
A.equal(c.engine.get('S13').pattern.quiet,true);
A.equal(c.engine.get('S14').primary.family,'blue');
A.equal(c.engine.get('S14').primary.value,3);
A.equal(c.engine.get('S14').pattern.family,'nearSolid');
A.equal(c.engine.get('S14').pattern.quiet,true);
A.deepEqual(plain(c.features.get('B08')),original.features.records.find(x=>x.id==='B08'),'B08 DNA stays exact');
const F=g.HEWRSOutfitFeedback,styles=['AUTO','CLASSIC','HYBRID','MODERN'],occasions=['work','dinner','weekend'];
const sample=id=>({blazerId:id,pantId:'PG001',shirtId:'DS001',state:'NO_TIE',shoeId:'shoe-11',watchId:null});
let policyCases=0,sourceCases=0;
const profile=c.trouserProfiles.binding('PG001').profileId;
for(const id of data.linen_no_tie_ids)for(const style of styles)for(const occasion of occasions){
 const context={occasion,requiredFormality:'any',executiveStyle:style};
 for(let n=1;n<=47;n++){
  const state='T'+String(n).padStart(3,'0'),s=sample(id);s.state=state;
  const rule=F.ownerRuleCheck(s,{context});A.equal(rule.allowed,false);
  A.ok(rule.reasons.some(x=>x.id==='OWNER-'+id+'-NO-TIE'),id+'/'+style+'/'+occasion+'/'+state);policyCases++;
  const result=c.engine.evaluate({topwearId:id,shirtId:'DS001',tieId:state,pantProfileId:profile,context,versionPolicy:'strict'});
  A.equal(result.candidate_eligible,false);A.equal(result.score,null);A.ok(result.reason_codes.includes('OWNER-'+id+'-NO-TIE'));sourceCases++;
 }
 A.equal(g.HEWRSIssue22Matching.tieRuleCheck(sample(id),{context}).allowed,true);
 A.equal(g.HEWRSIssue22Matching.tieRuleCheck({topwearId:id,tieId:null},{partial:true,context}).allowed,true);
 A.equal(g.HEWRSIssue22Matching.tieRuleCheck({blazerId:id},{partial:true,context}).allowed,true);
 A.equal(g.HEWRSIssue22Matching.tieRuleCheck({blazerId:id},{context}).allowed,false);
 A.equal(g.HEWRSIssue22Matching.tieRuleCheck({...sample(id),tieId:'T022'},{context}).allowed,false);
 A.equal(g.HEWRSIssue22Matching.tieRuleCheck(sample(id),{context:{occasion,requiredFormality:'tie_required'}}).allowed,false);
}
A.ok(F.ownerRuleCheck(sample('B01'),{context:{occasion:'work'}}).reasons.some(x=>x.id==='OWNER-B01-NOT-WORK'));
A.ok(F.ownerRuleCheck({...sample('B01'),pantId:'PT006'},{context:{occasion:'dinner',owner_use_case:'summer_weekend_dinner'}}).allowed);
A.ok(F.ownerRuleCheck({...sample('B11'),state:'T001'}).reasons.some(x=>x.id==='OWNER-B11-NO-TIE'));
A.ok(F.ownerRuleCheck({...sample('B11'),shoeId:'shoe-1'}).reasons.some(x=>x.id==='OWNER-B11-FOOTWEAR'));
A.equal(F.ownerRuleCheck(sample('B11')).allowed,true);
for(const id of ['B01','B06','B10']){
 const ranking=c.rawEngine.rank({topwearId:id,shirtIds:['DS001','DS002'],tieIds:['T001','T022'],configuration:'both',pantProfileId:profile,context:{occasion:'work',requiredFormality:'any'},versionPolicy:'strict',includeAll:true,limit:200});
 A.equal(ranking.examined,6);A.equal(ranking.all.filter(x=>x.result.status==='owner_rule_rejected').length,4);
 A.ok(ranking.ranked.every(x=>x.result.ids.tie===null));
}
// The raw evaluator consumes topwearId while native rendering consumes suitId
// or blazerId. Conflicting aliases must not mask a linen identity in either
// direction, even when an ignored field names an unrelated valid garment.
let conflictingIdentityCases=0;
for(const q of [
 {topwearId:'B06',suitId:'S05'},
 {topwearId:'B10',blazerId:'B03'},
 {topwearId:'S05',blazerId:'B06'},
 {topwearId:'B03',topwear:'B10'},
 {topwearId:'B03',topwear:{_canonical:{id:'B06'}}}
]){
 const request={...q,shirtId:'DS001',tieId:'T001',pantProfileId:profile,context:{occasion:'work',requiredFormality:'any'},versionPolicy:'strict'};
 A.equal(g.HEWRSIssue22Matching.tieRuleCheck(request,{partial:true}).allowed,false);
 const evaluated=c.rawEngine.evaluate(request);A.equal(evaluated.candidate_eligible,false);A.ok(evaluated.reason_codes.includes('ISSUE22-CONFLICTING-TOPWEAR-IDS'));
 const ranked=c.rawEngine.rank({...request,shirtIds:['DS001'],tieIds:['T001'],configuration:'both',includeAll:true,limit:20});
 A.equal(ranked.ranked.length,0);A.ok(ranked.all.every(e=>!e.result.candidate_eligible));conflictingIdentityCases++;
}
A.equal(g.HEWRSIssue22Matching.tieRuleCheck({topwearId:'B06',blazerId:'B06',tieId:null},{partial:true}).allowed,true,'Identical canonical aliases remain valid');
// Old favorites/rejection records remain readable and exportable. Eligibility
// is checked when selected, without mutating or silently removing saved data.
const storage=memoryStorage(),saved=realm({...sample('B06'),state:'T001'});
A.deepEqual(plain(c.validateSelection(saved)),plain(saved));
const favorites=g.HEWRSFavorites.create(c,g.HEWRS_INPUT_SHA256,storage);
favorites.add(saved,realm({id:'favorite_issue22_legacy',created_at:'2026-11-21T00:00:00.000Z'}));
const exportBefore=favorites.exportText(),feedback=F.create({storage});feedback.refresh();
A.equal(feedback.allowed(saved,{occasion:'work'}),false);A.equal(favorites.exportText(),exportBefore);
A.equal(favorites.snapshot().items.length,1);
const open=realm(sample('B06')),rows=[{selection:saved},{selection:open}];
A.equal(feedback.reorder(rows,x=>x.selection,{occasion:'work'}).length,1);
A.equal(feedback.alternative(saved,rows,x=>x.selection,{occasion:'work'}).selection.state,'NO_TIE');
// The index binds current effective facts; unrelated groups remain exact.
A.equal(index.current_source_revision,g.HEWRSSourceCorrections.revision);
A.equal(index.source_input_sha256,originalIndex.source_input_sha256);
let unaffectedGroups=0,recalculatedGroups=0;
for(let n=0;n<index.groups.length;n++){
 const now=index.groups[n],old=originalIndex.groups[n];
 if(!data.scope.includes(now.topwearId)){A.deepEqual(now,old);unaffectedGroups++;continue;}
 recalculatedGroups++;A.equal(now.rows.length,old.rows.length);
 for(const row of now.rows.filter((_,i)=>i%137===0)){
  const current=c.engine.evaluate({topwearId:now.topwearId,shirtId:row[0],tieId:row[1]==='NO_TIE'?null:row[1],...(now.pantProfileId?{pantProfileId:now.pantProfileId}:{}),context:{occasion:'clinic',requiredFormality:'any'},versionPolicy:'strict'});
  A.deepEqual(row,[row[0],row[1],current.score??null,current.display_score??null,current.candidate_eligible?1:0,current.status]);
 }
 if(data.linen_no_tie_ids.includes(now.topwearId))A.ok(now.rows.filter(row=>row[1]!=='NO_TIE').every(row=>row[4]===0),'No tied cache candidate');
}
const generation=[],controls=[];
for(const id of ['B06','B10'])for(const style of styles)for(const occasion of occasions){
 const alias=c.blazerConnection.knownBlazer(id).historyId;
 const q=c.makeRequest(realm(config(occasion,style,{topwear:{mode:'item',id:alias},watch:{mode:'none'}})));
 const result=c.controller.generate(q,c.catalogue,[]);
 A.equal(c.controller.verifyOptionSet(result.options,q),true);
 for(const option of result.options){const selection=c.selectionFromOption(option,q).selection;A.equal(selection.blazerId,id);A.equal(selection.state,'NO_TIE');A.equal(F.ownerRuleCheck(selection,{context:q.context}).allowed,true);}
 generation.push({id,style,occasion,returned:result.options.length});
}
for(const style of styles)for(const occasion of occasions){
 const q=c.makeRequest(realm(config(occasion,style,{topwear:{mode:'item',id:c.blazerConnection.knownBlazer('B10').historyId},tie:{mode:'item',id:'T022'}})));
 const result=c.controller.generate(q,c.catalogue,[]);A.equal(result.options.length,0,'Explicit tied linen request cannot substitute tie or blazer');
}
for(const style of styles)for(const occasion of occasions){
 const q=c.makeRequest(realm(config(occasion,style))),result=c.controller.generate(q,c.catalogue,[]);
 A.equal(c.controller.verifyOptionSet(result.options,q),true);
 A.equal(result.options.length,20,style+'/'+occasion+' fresh generation');
 for(const option of result.options){const s=c.selectionFromOption(option,q).selection;A.equal(F.ownerRuleCheck(s,{context:q.context}).allowed,true);if(data.linen_no_tie_ids.includes(s.blazerId))A.equal(s.state,'NO_TIE');}
 controls.push({style,occasion,returned:result.options.length});
}
console.log('ISSUE22_MATCHING='+JSON.stringify({passed:true,policyCases,sourceCases,conflictingIdentityCases,preservedFeatures:preserved,unaffectedIndexGroups:unaffectedGroups,recalculatedIndexGroups:recalculatedGroups,indexRecalculatedRows:index.issue22.recalculated_rows,indexChangedRows:index.issue22.changed_rows,savedDataPreserved:true,generation,controls}));
