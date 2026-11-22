/* The current linen instruction is a display constraint as well as a ranking
 * constraint. Historical selections stay readable, but direct rendering,
 * exports and restored favorites cannot display a prohibited tied blazer. */
(function(root){'use strict';
const previous=root.HEWRSAtomicRenderer,policy=root.HEWRSIssue22Matching;
if(!previous?.create||!policy?.tieRuleCheck)throw Error('Issue 22 rendering dependencies are missing.');
function create(canvas,connection,options={}){
 const renderer=previous.create(canvas,connection,options);
 function requireAllowed(selection){
  const rule=policy.tieRuleCheck(selection);
  if(!rule.allowed){
   renderer.cancel();
   const error=Error(rule.reasons.map(row=>row.message).join(' '));
   error.code='HEWRS_LINEN_NO_TIE';error.reasons=structuredClone(rule.reasons);throw error;
  }
  return selection;
 }
 return Object.freeze({...renderer,
  plan(selection){return renderer.plan(requireAllowed(selection));},
  async render(selection){return renderer.render(requireAllowed(selection));},
  stats(){return {...renderer.stats(),issue22_no_tie_revision:policy.revision};}
 });
}
root.HEWRSAtomicRenderer=Object.freeze({create});
})(globalThis);
