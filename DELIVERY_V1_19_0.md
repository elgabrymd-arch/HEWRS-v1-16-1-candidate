# HEWRS V1.19.0 — implemented curated references + private visual-stylist integration

## What this release is
This continues the existing application. It introduces two **explicitly different** selection methods and retains the V1.18.0 heuristic as a third, explicitly named method. It does not pretend that a new formula is the assistant's reasoning or that static outfits are live AI.

**Available immediately after frontend installation:** the local curated reference library, the actual Generate/navigation workflow, source/weather/lock checks, the original repetition limits and history guards. The default unlocked test returns fifteen curated outfits using actual wardrobe layers.

**Implemented but NOT deployed or real-provider-verified:** the private authenticated backend and the frontend's two-stage live visual proposal/assessment integration. It needs private HTTPS hosting, explicit server-side model/key configuration and authorized usage costs. The public GitHub frontend contains no provider key, service password or enabled endpoint. No live provider call or paid service was used during development.

## Reference library
The library contains 94 complete, explicitly authored reference records: 15 from the independent no-anchor set, 15 from the independently styled S10 set, and 64 new editorial alternatives covering the 18 suits and 14 blazers. These are stored exact full outfits, not a Cartesian recombination generator or 94 individual owner-approved ratings. The owner preferred the overall earlier sets; individual new alternatives remain editorial proposals.

Every record names exact owned topwear, shirt, tie/No Tie, trousers when separate, shoes and a specifically identified watch. No inferred real watch is substituted for `watch-R18`. The reserved watch slot remains in the database/history but is no longer eligible for automatic recommendation, including the retained heuristic mode.

With no locks, no weather restriction, Clinic/AUTO and empty synthetic history, 89/94 references pass the current source checks. Five remain recorded but excluded by existing source-premise holds: REF_FREE_12, REF_S10_10, LIB_014, LIB_025 and LIB_052. No frozen grade was selected arbitrarily or averaged to fill those gaps. Fourteen of the previously preferred unanchored reference looks appear unchanged; the excluded reference is replaced by an eligible explicitly authored look to complete fifteen.

This finite library is a dependable local reference mode, **not broad combinatorial AI**. Exact topwear anchors returned 1–3 matching reference outfits in most tests, with S10 returning 14. Other restrictive locks can return none. The interface explains the count; it never silently adds heuristic filler and labels it curated. The retained V1.18 heuristic can still generate from its wider eligible pool when deliberately selected. No promise is made of fifteen curated references for every anchor/weather condition.

Explicit shoe/watch anchors can adapt those accessory IDs on an existing reference and are labelled accordingly; the full selection is revalidated. Shirt, tie and topwear are not silently replaced to manufacture a reference match.

## Live visual pipeline
1. **Proposal:** authenticated private service receives actual rendered garment boards, exact ID/name/source descriptors and the two independent reference sets. The model is asked to propose new full combinations from the wardrobe rather than re-rank only the old fifteen. The provider and model are explicitly configured on the server, not supplied by an arbitrary browser request.
2. **Source validation and rendering:** the frontend checks all proposed selections against actual garment routes, applicable source assessments, genuine hard rejects, formality/style, weather and locks. Up to twenty eligible reference looks are combined with up to forty new proposals. Every retained candidate is rendered from the current approved layers.
3. **Visual assessment:** every candidate's actual garment-only image is sent, not just numeric/color features. Source rows0–399 containing the face are excluded; output is280×660JPEG. The model must return each candidate ID exactly once with a coarse recommended/strong/exploratory/avoid assessment and explanation. Unknown, duplicated, missing, refused or incomplete responses are errors, not substitutes.
4. **Final list:** the existing physical-ID two-use limit, exact-anchor exception, No Tie cap and duplicate policy apply. Confirmed-history rotation operates only within the same editorial/visual grade tier. The result is labelled Live visual assessment with the configured provider/model. It is not a new frozen compatibility score or a personally trained model.

The model receives no precise coordinates, Favorites, confirmed wear ledger or browser backups. Coarse weather, work date, style and exact selected constraints are sent. Wardrobe descriptions and images are content for styling, not permission to invent IDs or tools. Watch imagery remains absent; the service assesses only the actual identified name/record, without pretending to have seen a watch image.

The service uses two Responses requests at most per Generate. A cancelled request may already have incurred a provider charge. `store:false` is supplied but is not represented as a guarantee of zero provider retention. A real API round-trip, model availability, provider cost, TLS deployment and actual iPhone/service integration remain untested in this delivery.

## Original scores versus aesthetic eligibility
The wardrobe database and all original scores/calculations remain intact. A curated/live candidate with a finite historical estimate is not rejected solely for falling below the legacy numerical aesthetic floor. Source conflicts with no applicable value, unsupported routes and explicit `hard_reject` remain blocked. The raw assessment remains unaltered in Score Details; the new metadata explicitly records any aesthetic-floor override. This distinction implements the approved separation between an opinionated score and a truly unsupported selection.

No new 9.99-style number is created for curated or visual results. Local references show their rationale; live responses use coarse grades. The old V1.18.0 heuristic mode remains available and labelled as such, not relabelled AI.

The original confirmed-history selector is used only within the same top editorial/visual assessment tier. The internal constant utility used to invoke its existing history/cooldown logic is disclosed as a technical adapter, not a measured styling grade. Reference order and model order remain the respective starting orders. Current history is validated before computation, and a history revision change during a network request or image rendering cancels the stale result. No record is cleared or migrated.

## Frontend controls
Home → Style → Stylist settings:
- **Curated reference library — local** (default).
- **Live visual AI — secure service required** (cannot activate until configured and signed in).
- **V1.18.0 heuristic — existing model**.

The stylist method has its own small browser preference; wear and Favorites keys/schema are unchanged. An expiring service session token stays only in page memory. Reload/restart can require service sign-in again. This is unrelated to, and does not revoke, the existing automatic-weather/location permissions. An unconfigured/offline service produces a clear message; it does not trigger paid requests or silently fall back.

## Private backend safeguards
The separate backend is standard-library Python and ships OFF by default. It implements a PBKDF2-hashed private service password, expiring random tokens with stored token hashes, exact allowed origins plus authentication, fixed provider URL/model, no arbitrary forwarding/tools, no Authorization-bearing redirects, bounded requests/images/output, strict returned IDs/schema, single-use expiring jobs bound to session/request/candidates, a one-request provider lease and daily attempted-call quotas persisted across restart. HTTP worker threads are bounded. API keys and credentials do not enter the public frontend or package.

The service bundle includes its exact visual-source manifest, private setup instructions, password-hash helper, environment template and offline tests. Its HTTPS reverse-proxy file is a configuration example, not a deployed domain. No infrastructure spending or account changes were performed. These protections were unit/transport-tested; they are not a penetration-test or zero-risk certificate.

## Three completed verification passes
### Pass1 — source, inventory and calculations
The source tree was reconstructed from verified mounted V1.17.1 source, V1.17.2 tie update and V1.18.0 cumulative update. The exact V1.18.0 baseline passed all1974payload hashes plus its manifest. The original fullZIPcontainer hash was not independently remeasured.

All original848runtime images,50suit shirts,18non-suit shirts,47ties,18suits,14blazers, physical trouser/shoe/watch IDs and approved visual geometry remain unchanged. Five new preservation checks freshly compare all136canonical features,2350frozen shirt–tie lookups and112392original ensemble calculations, with zero differences. Existing No Tie formula, base history policy and two-use module remain byte-identical.

### Pass2 — routing, authentication and failure states
Twenty-one new frontend functional checks passed. Coverage includes all32topwear anchors with truthful limited-library counts, the unanchored fifteen, independent physical-ID counters, source conflicts, explicit accessory locks, family locks, formality, weather, reservedwatch exclusion, all39817suit routes, tampered metadata/IDs, cancellation, unavailable live service and request data minimization. One transport unit test uses a declared fixture renderer; it is not counted as real-image evidence.

Twenty-one private-service checks passed using an injected fixture provider. They include password/origin/authentication/expiry, source mismatch, unknown IDs, exact/family locks, invalid or external image URLs, provider refusal/incomplete/malformed output, unknown/duplicate ranking IDs, empty tie-string rejection, job replay/session/request/expiry binding, daily quota across restart and concurrent-request blocking. Actual localHTTP session/preflight/proposal requests were also exercised against that injected provider. No real OpenAI request was made.

### Pass3 — actual wardrobe renders, interface, installation and rollback
Fifteen new Chromium regression/workflow checks passed. All90native outfit frames are pixel-identical to the independent V1.18.0 baseline; the old848image bytes remain preserved. The actual Generate button and all15navigation positions display the exact curated records with all six preferences unlocked. The new modal/Apply/Cancel behavior and five viewport sizes, including390×350, were tested.

A separate explicit service fixture executes the real proposal→offscreen rendering→image assessment path. All20reviewed candidates receive real280×660JPEGs from the current compositor. The fixture is identified as OFFLINE_TEST_FIXTURE/NOT_A_LIVE_MODEL and is not published as a genuine model assessment. The actual crop is compared with the same registered selection. Wear/Favorites remain unchanged. Corrupt-history and mid-request history-revision tests block/cancel without changing the prior outfit pixels or overwriting records.

The visual-service resource boards were actually rendered from the current source:32topwear controls,50shirt inserts,47tie layers,35registeredfootwearpairs and24physicaltrouserlayers, with the two prior independent look references. They are existing owner wardrobe images, not generatively substituted clothes.

Installation and exact rollback checks, package syntax/manifest/CRC and endpoint-configuration checks are recorded in PACKAGING_CHECKS.json and the external receipt. Old evidence in inherited folders is historical, not newly repeated. An early unit-test fixture omitted setInterval; the corrected final run passed21. An initial package check treated the change ledger as protected; the packaging ledger/rollback copy were corrected before the final checks. No incomplete failed invocation contributes to the final count. Browser success is in-memory Chromium with synthetic storage, not hosted/Safari/API certification.

## Installation and service activation
The frontend cumulative update supports exactV1.17.4 orV1.18.0. Copy **contents of FILES_TO_COPY** into the existing candidate repository; preserve .git, other files and browser data. Commit/push normally. This activates the local curated workflow and the explicit service-settings interface, **not paid live AI**.

Commit summary: `V1.19.0 — curated references and private visual-stylist integration`

The private server ZIP is separate. Do not copy it into FILES_TO_COPY or upload credentials into the public repository. After private hosting and provider/model/budget configuration, tools/configure_visual_service.py pins the exact HTTPS endpoint and CSP origin in a verified frontend copy. Its setup README describes the remaining live acceptance check.

`python -B tools/verify_v1190.py` verifies the installed source. `python -B tools/rollback_v1190.py --output NEW_FOLDER` restores exactV1.18.0 without browser access. When starting from1.17.4, the restored1.18.0 includes its existing rollback to1.17.4. The separate stylist preference is harmless to older code; no data clearing is required.

No GitHub write, public deployment, owner-history access, provider credential request in chat, API billing or live-provider call was performed.
