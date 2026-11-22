#!/usr/bin/env node
'use strict';
/* Bound native image/canvas memory with independent process batches. Every
 * assigned case still renders both the exact current and frozen application;
 * no expected pixels, canvas calls or sources are replaced by mocks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),args=process.argv.slice(2),options={shard:1,shards:1};
for(let n=0;n<args.length;n+=2){assert.ok(['--shard','--shards'].includes(args[n]),'Unknown matrix option');options[args[n].slice(2)]=Number(args[n+1]);}
assert.ok(Number.isInteger(options.shards)&&Number.isInteger(options.shard)&&options.shards>0&&options.shard>0&&options.shard<=options.shards,'Invalid one-based shard');
const count=total=>Array.from({length:total},(_,i)=>i).filter(i=>i%options.shards===options.shard-1).length;
const targets=count(534),controls=count(212),total=targets+controls,batch=8;
const output=path.join(ROOT,'evidence/issue22/native',...(options.shards>1?['shard-'+options.shard]:[]));fs.mkdirSync(output,{recursive:true});
let merged=null;
for(let offset=0;offset<total;offset+=batch){
 const result=cp.spawnSync(process.execPath,['--expose-gc',path.join(__dirname,'issue22-render-matrix-worker.cjs'),'--shard',String(options.shard),'--shards',String(options.shards),'--offset',String(offset),'--limit',String(batch)],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});
 if(result.status!==0){process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');throw Error('Native matrix batch '+offset+' failed: '+(result.signal||result.status));}
 const row=JSON.parse(fs.readFileSync(path.join(output,'batch-'+String(offset).padStart(4,'0')+'.json'),'utf8'));
 assert.equal(row.status,'PASS');assert.equal(row.offset,offset);assert.equal(row.shard,options.shard);assert.equal(row.shards,options.shards);
 if(!merged)merged={...row,rows:[],controls:[],corrected_pixels_total:0,prohibited_tie_render_cases:0};
 assert.deepEqual(row.runtime,merged.runtime,'Exact runtime must remain fixed between process batches');
 merged.rows.push(...row.rows);merged.controls.push(...row.controls);merged.corrected_pixels_total+=row.corrected_pixels_total;merged.prohibited_tie_render_cases+=row.prohibited_tie_render_cases;
 console.log('MATRIX_BATCH '+JSON.stringify({shard:options.shard,completed:merged.rows.length+merged.controls.length,total}));
}
assert.equal(merged.rows.length,targets);assert.equal(merged.controls.length,controls);assert.equal(merged.prohibited_tie_render_cases,141);
assert.equal(new Set(merged.rows.map(r=>JSON.stringify(r.selection))).size,targets,'No duplicated target can replace an omitted render');
assert.equal(new Set(merged.controls.map(r=>JSON.stringify(r.selection))).size,controls,'No duplicated control can replace an omitted render');
delete merged.offset;delete merged.limit;merged.target_renders=targets;merged.unrelated_control_renders=controls;merged.independent_process_batch_size=batch;
fs.writeFileSync(path.join(output,'RESULT.json'),JSON.stringify(merged,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',shard:options.shard,shards:options.shards,target_renders:targets,unrelated_control_renders:controls,prohibited_tie_render_cases:141}));
