/* Exact isolated function from the uploaded controller ancestor; no accessor auto-ranking, DOM, or storage. */
function watchFormalityCategory(watchItem){
  const name = ((watchItem.name||'')+' '+(watchItem.color||'')).toLowerCase();
  if(/skeleton|tourbillon/.test(name)) return 'statement';
  if(/diamond|baguette/.test(name)) return 'diamondStatement';
  if(/nautilus|aquanaut|royal oak|cubitus/.test(name)) return 'integratedSport';
  if(/gmt|daytona|chronograph|diver/.test(name)) return 'sport';
  return 'dress'; // Datejust, Day-Date, and anything else without a sportier signal
}
