#!/usr/bin/env node
/* Pure acceleration cache of the current bound clothing engine. No independent scores.
 * Shares computation across colour profiles, never physical wardrobe identities.
 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const R=path.resolve(__dirname,'..'),check=process.argv.includes('--check');
const skip=new Set(['src/application.js','data/option-index.js','src/legacy-accessories.js','src/weather-context.js','src/automatic-engine.js','src/automatic-preferences.js','src/hybrid-stylist.js']);
const scripts=JSON.parse(fs.readFileSync(R+'/tools/build.py','utf8').match(/SCRIPTS=(\[[^\n]+\])/)[1].replaceAll("'",'"'));
const g=vm.createContext({console,structuredClone,Date,Math,JSON,setTimeout,clearTimeout,Uint8ClampedArray,URL,AbortController,performance});
for(const p of scripts.filter(p=>!skip.has(p)))vm.runInContext(fs.readFileSync(R+'/'+p,'utf8'),g,{filename:p});
const c=g.HEWRSCleanConnection.create(g.HEWRS_INPUTS),profiles=[...new Set(c.trouserProfiles.boundIds.map(id=>c.trouserProfiles.binding(id).profileId))].sort();
const groups=[];let rows=0;const counts={};
const hashes={};for(const f of ['data/inputs.json','vendor/hewrs-logic.js','vendor/approved-scores.js','vendor/ensemble-completion.js','src/connection.js','data/owner-source-corrections.json','src/source-corrections.js'])hashes[f]=crypto.createHash('sha256').update(fs.readFileSync(R+'/'+f)).digest('hex');
for(const top of [...c.suitSources.ids,...c.blazerConnection.availableIds])for(const profile of top[0]==='S'?[null]:profiles){
 const out=[];
 for(const sid of c.manifest.shirt_order){if(top[0]==='B'&&!c.nonSuitSources.connectedIds.includes(sid))continue;
  for(const state of c.manifest.shirts[sid].available_modes){if(state==='REFERENCE')continue;
   const r=c.engine.evaluate({topwearId:top,shirtId:sid,tieId:state==='NO_TIE'?null:state,...(profile?{pantProfileId:profile}:{}),context:{occasion:'clinic',requiredFormality:'any'},versionPolicy:'strict'});
   out.push([sid,state,r.score??null,r.display_score??null,r.candidate_eligible?1:0,r.status]);rows++;counts[r.status]=(counts[r.status]||0)+1;
  }
 }
 groups.push({topwearId:top,pantProfileId:profile,rows:out});
 console.log('indexed',top,profile||'',out.length);
}
const value={schema:'hewrs.derived-clothing-index.v1_17_0',source_input_sha256:g.HEWRS_INPUT_SHA256,normalization_revision:g.HEWRSEnsembleCompletion.normalizationRevision,current_source_revision:g.HEWRSSourceCorrections.revision,engine_files:hashes,columns:['shirt_id','state','score','display_score','candidate_eligible','status'],groups,counts:{rows,groups:groups.length,status:counts},authority:'DERIVED_CACHE_OF_EXISTING_ENGINE_RESULTS_NOT_NEW_OR_APPROVED_SCORES',environment_and_history:'Not part of compatibility; assessed at request time'};
for(const [p,t] of [['data/option-index.json',JSON.stringify(value)+'\n'],['data/option-index.js','globalThis.HEWRS_OPTION_INDEX='+JSON.stringify(value)+';\n']]){
 if(check){if(fs.readFileSync(R+'/'+p,'utf8')!==t)throw Error('Cache differs from current source engine '+p);}else fs.writeFileSync(R+'/'+p,t);
}
console.log(JSON.stringify(value.counts));
