'use strict';
// Read registered current sources through the same connection stack used by
// generation. Synthetic in-memory storage only; no browser/owner profile.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {load}=require('../tests/tie-engine-loader.cjs');
const h=load(),g=h.g,c=h.connection;
const activeDelivery=JSON.parse(execFileSync(process.env.PYTHON||'python3',['tools/verify_active_delivery.py','--describe'],{cwd:root,encoding:'utf8'}));
const continuous=activeDelivery.kind==='continuous'?JSON.parse(fs.readFileSync(path.join(root,'data/continuous-shirts.json'),'utf8')):null;
for(const [sha,source]of Object.entries(continuous?.assetPaths||{}))if(Object.hasOwn(c.assetPaths,sha)&&c.assetPaths[sha]!==source)throw Error('Continuous source remaps an original asset: '+sha);
const plain=value=>JSON.parse(JSON.stringify(value));
const shirts=c.manifest.shirt_order.map(id=>({
 id,record:plain(c.records[id]),feature:plain(c.features.get(id)),manifest:plain(c.manifest.shirts[id]),
 nonSuit:plain(c.nonSuitSources.registry.shirts[id]),
 registration:c.batch10.shirts[id]?plain(c.batch10.shirts[id]):null,
 thumbnails:plain(g.HEWRS_OPTION_CARD_THUMBNAILS.shirts[id]),
 nonSuitThumbnails:g.HEWRS_NON_SUIT_CARD_THUMBNAILS?.[id]?plain(g.HEWRS_NON_SUIT_CARD_THUMBNAILS[id]):null,
 routeAvailability:{blazer:plain(c.nonSuitSources.inspect(id,'blazer')),shirtOnly:plain(c.nonSuitSources.inspect(id,'shirt-only'))}
}));
const out={schema:'hewrs.current-catalogue-audit.v1',input_sha256:g.HEWRS_INPUT_SHA256,
 runtime_sha256:activeDelivery.runtime_sha256,active_delivery:activeDelivery,
 roster:{shirts:shirts.map(s=>s.id),suits:plain(c.suitSources.ids),blazers:plain(c.blazerConnection.availableIds),
  pants:plain(c.blazerConnection.pantIds),shoes:Object.keys(c.shoeLayers),ties:Object.keys(c.manifest.ties),
  watches:c.catalogue.watches.map(w=>w.id)},
 assetPaths:{...plain(c.assetPaths),...(continuous?.assetPaths||{})},shirts,
 continuousShirts:continuous?{schema:continuous.schema,ids:continuous.ids,source_input_sha256:continuous.source_input_sha256,garment_data_sha256:activeDelivery.source_sha256['data/continuous-shirts.json']}:null,
 suitStatic:plain(c.manifest.static),tieFidelity:plain(g.HEWRS_TIE_FIDELITY),
 nonSuitFullStates:plain(c.shirtOnlyConnection.data.shirts),
 limits:['This file records registered source contracts. It does not by itself prove visual correctness.']};
const destination=path.resolve(root,process.argv[2]||'evidence/five_round_20261119/CATALOGUE.json');
fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(root,destination),roster:Object.fromEntries(Object.entries(out.roster).map(([k,v])=>[k,v.length])),assetPaths:Object.keys(out.assetPaths).length}));
