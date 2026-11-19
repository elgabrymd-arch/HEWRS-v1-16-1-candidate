'use strict';
// Read registered current sources through the same connection stack used by
// generation. Synthetic in-memory storage only; no browser/owner profile.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {load}=require('../tests/tie-engine-loader.cjs');
const h=load(),g=h.g,c=h.connection;
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
 runtime_sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'runtime/outfit-refill-preview.js'))).digest('hex'),
 roster:{shirts:shirts.map(s=>s.id),suits:plain(c.suitSources.ids),blazers:plain(c.blazerConnection.availableIds),
  pants:plain(c.blazerConnection.pantIds),shoes:Object.keys(c.shoeLayers),ties:Object.keys(c.manifest.ties),
  watches:c.catalogue.watches.map(w=>w.id)},
 assetPaths:plain(c.assetPaths),shirts,
 suitStatic:plain(c.manifest.static),tieFidelity:plain(g.HEWRS_TIE_FIDELITY),
 nonSuitFullStates:plain(c.shirtOnlyConnection.data.shirts),
 limits:['This file records registered source contracts. It does not by itself prove visual correctness.']};
const destination=path.resolve(root,process.argv[2]||'evidence/five_round_20261119/CATALOGUE.json');
fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({output:path.relative(root,destination),roster:Object.fromEntries(Object.entries(out.roster).map(([k,v])=>[k,v.length])),assetPaths:Object.keys(out.assetPaths).length}));
