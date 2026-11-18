# Independent AI Five integration

## Intended behavior

The existing HEWRS engine produces its original twenty options. A separate AI
generation request supplies additional combinations from the owned wardrobe for
the selected Work, Dinner or Weekend occasion. The AI chooses their styling and
order. Its request contains no Classic/Modern classification, compatibility
score, curated reference outfits, learned taste, preference locks or approvals.

The additional choices must satisfy these boundaries:

- Actual, currently supported wardrobe IDs and approved rendering routes.
- The selected occasion and any explicit suit/tie requirement.
- No duplicate of the twenty actual current options or of another AI option.
  Changing only the watch does not create another outfit.
- The existing confirmed-wear rotation policy, unchanged.
- Explicit outfit rejections, including saved hides and historical Neither
  choices. The old B01/B11 garment styling instructions are exempted for AI Five
  only; the original engine and its feedback rules are unchanged.

The server requests up to fifteen independently ranked candidates so the client
can return five after local rotation and rejection checks. If fewer than five
remain, it reports the shortfall. It does not substitute local outfits or retry a
paid request automatically.

## Connection and source boundary

The client uses the separate `hewrs.ai-five.*.v1` protocol:

- `GET /v1/ai-five/status` verifies capability, authentication and wardrobe hashes.
- `POST /v1/ai-five/generate` sends the selected occasion/formality, date, coarse
  weather, source hashes, random request ID and twenty exact exclusion keys.

The backend extension is in `elgabrymd-arch/HEWRS-AI-service`, development branch
`feature/ai-five-generation-20261117`. Its existing `/assess` endpoint reviews a
supplied outfit and is not an outfit generator. Its image-review quality gate is
not used as an aesthetic filter for these independent choices and remains intact.

The new client keeps its service token in page memory, rejects provider keys,
requires a user action and generation consent, validates request/source/provider
bindings, and converts the server's strict eight-field selection schema to the
native five/six-field representation only after structural validation.

The provider currently receives source-linked wardrobe descriptions. It does not
receive new photographs or make a fresh visual inspection. General model
knowledge is not access to other users' private conversations or a live lab.

## State and preview behavior

`src/ai-five-native.js` reads the existing wear and feedback stores without writing
them. It invokes the original `HEWRSLogic.selectRotation` using canonical physical
item IDs. There is no added thirty-day exact-look ban or local aesthetic ranking.

The flow captures immutable native options and guards for the controls, weather,
wear, rejections and native generation. A change invalidates pending or displayed
AI choices. Guards and local history stay in the browser.

Cards and the full-avatar dialog use the existing detached
`HEWRSApp.renderForPreference` renderer. They do not apply an AI selection to the
native list, alter its current index or score, or log wear. No garment image,
avatar asset, original runtime bundle or wardrobe record is changed.

## Release state

`data/ai-five-service-config.js` remains `enabled:false`. The backend also has a
separate default-off `HEWRS_ENABLE_AI_FIVE` flag and requires an explicitly chosen
model. No production merge, deployment, credential change or paid provider call
is part of this development change.

Activation requires deploying the reviewed backend and frontend changes,
configuring the model and shared call budget, checking the authenticated status,
and then running an authorized live generation. Fixture results are explicitly
labelled as fixtures and cannot establish live stylist quality.

## Verification

The feature-branch workflow runs:

1. Overlap and immutable-flow tests, including watch-only duplicates and stale
   weather, wear, feedback and native generations.
2. Transport tests, including strict response normalization, source/request
   binding, cancellation, timeouts and no automatic paid retries.
3. Tests against the actual canonical validator and original rotation function.
4. The real native twenty with five owned-wardrobe fixtures.
5. Chromium against the shipped `index.html` and runtime for all three occasions.
   Only service HTTP replies are fixtures. It checks actual avatar images and
   unchanged native state, avatar pixels and all browser storage through AI
   generation and full preview, then checks explicit rejection invalidation.

The browser test intercepts the new generation endpoints and blocks other
external traffic. It uses a fresh browser profile and never uses personal
credentials or records. The previous DOM-only panel smoke was replaced because
its fake renderer and fake `apply` function could not verify real app behavior.
