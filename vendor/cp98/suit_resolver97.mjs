/** HANDOFF98 adapter for unchanged CP97 data. Original CP97 resolver is preserved in its ZIP. Not deployed. */
/** Read-only integration helper. It does not seed wardrobes, score outfits,
 * alter the avatar, write app state, or deploy. Held assets cannot be selected.
 */
const IDS = Array.from({length:18},(_,i)=>`S${String(i+1).padStart(2,'0')}`);

export function resolveSuit(registry, suitId) {
  if (!IDS.includes(suitId)) throw new Error('Unknown suit ID');
  if (!registry || registry.checkpoint !== 97 || registry.schema !== 'hewrs.suit.static.v2') throw new Error('Wrong checkpoint');
  if (JSON.stringify(registry.ids)!==JSON.stringify(IDS) || JSON.stringify(registry.items?.map(x=>x.suit_id))!==JSON.stringify(IDS)) throw new Error('Duplicate, missing or unordered ID');
  if (registry.held_ids?.length || registry.live_deployment_allowed!==false || registry.latest_complete_production_ready!==false) throw new Error('False release or stale hold');
  const item = registry.items.find(x=>x.suit_id===suitId);
  if (!item || item.static_test_eligible !== true || item.production_enabled !== false) throw new Error('Asset is not eligible for static testing');
  for (const [field,name] of [['jacket','JACKET'],['trousers','TROUSERS']]) {
    const asset=item[field];
    if (asset?.role !== 'REGISTERED_GARMENT_RGBA' || asset.path !== `static/layers/${suitId}/${name}.png`) throw new Error('Source-photo, cross-ID or legacy layer substitution');
    if (!/^[0-9a-f]{64}$/.test(asset.sha256)) throw new Error('Invalid asset hash');
  }
  if (item.static_composite.role !== 'FROZEN_AVATAR_COMPOSITE' || item.static_composite.path !== `static/renders/${suitId}.png`) throw new Error('Wrong composite type');
  return Object.freeze({suitId,jacket:Object.freeze({...item.jacket}),trousers:Object.freeze({...item.trousers}),template:item.template_in_cp93,scope:'STATIC_SUIT_TEST_ONLY'});
}
export async function checkedFetch(asset, baseURL, fetchImpl=fetch) {
  const url=new URL(asset.path,baseURL), base=new URL(baseURL);
  if (url.origin!==base.origin || !url.pathname.startsWith(base.pathname)) throw new Error('Asset escapes package root');
  const response=await fetchImpl(url);
  if (!response.ok) throw new Error(`Asset load failed: ${response.status}`);
  const bytes=await response.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  if (hash!==asset.sha256) throw new Error('Asset checksum mismatch');
  return bytes;
}
/** Load both garments before changing display; late results cannot undo a newer selection. */
export function createAtomicSuitSelector(registry, loadCheckedAsset, commitPair) {
  let revision=0;
  return async function select(suitId) {
    const request=++revision; // Even invalid selections cancel an older in-flight request.
    const selected=resolveSuit(registry,suitId);
    const [jacket,trousers]=await Promise.all([loadCheckedAsset(selected.jacket),loadCheckedAsset(selected.trousers)]);
    if (request!==revision) return {committed:false,reason:'superseded'};
    commitPair({suitId,jacket,trousers,template:selected.template});
    return {committed:true,suitId};
  };
}
