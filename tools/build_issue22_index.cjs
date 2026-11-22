#!/usr/bin/env node
/* V3-only source-index recalculation. The frozen index and input file remain
 * exact. Recalculate all existing rows for the six fact-changed garments;
 * existing shirt recovery/additional-blazer extensions still run on demand. */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {load,root}=require('../tests/issue22-loader.cjs');
const {g,connection:c}=load({index:false}),check=process.argv.includes('--check');
const original=JSON.parse(fs.readFileSync(root+'/data/option-index.json','utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex');
const affected=new Set(g.HEWRSIssue22Matching.ids);let recalculated=0,changed=0;
const groups=original.groups.map(group=>{
 if(!affected.has(group.topwearId))return group;
 const rows=group.rows.map(row=>{
  const result=c.engine.evaluate({topwearId:group.topwearId,shirtId:row[0],tieId:row[1]==='NO_TIE'?null:row[1],...(group.pantProfileId?{pantProfileId:group.pantProfileId}:{}),context:{occasion:'clinic',requiredFormality:'any'},versionPolicy:'strict'});
  const current=[row[0],row[1],result.score??null,result.display_score??null,result.candidate_eligible?1:0,result.status];
  recalculated++;if(JSON.stringify(current)!==JSON.stringify(row))changed++;return current;
 });
 return {...group,rows};
});
const status={};let rows=0;for(const group of groups)for(const row of group.rows){rows++;status[row[5]]=(status[row[5]]||0)+1;}
const addedFiles=['data/issue22-garment-dna.json','src/issue22-matching.js'];
const index={...original,current_source_revision:g.HEWRSSourceCorrections.revision,groups,counts:{rows,groups:groups.length,status},
 engine_files:{...original.engine_files,...Object.fromEntries(addedFiles.map(file=>[file,hash(file)]))},
 issue22:{revision:g.HEWRSIssue22Matching.revision,baseline_index_sha256:hash('data/option-index.json'),recalculated_rows:recalculated,changed_rows:changed,affected_ids:[...affected],unrelated_groups:'byte-identical JSON records',historical_sources:'preserved'}};
for(const [file,content]of [['data/issue22-option-index.json',JSON.stringify(index)+'\n'],['data/issue22-option-index.js','globalThis.HEWRS_OPTION_INDEX='+JSON.stringify(index)+';\n']]){
 if(check){if(fs.readFileSync(root+'/'+file,'utf8')!==content)throw Error('Issue 22 index differs: '+file);}else fs.writeFileSync(root+'/'+file,content);
}
console.log('ISSUE22_INDEX='+JSON.stringify(index.issue22));
