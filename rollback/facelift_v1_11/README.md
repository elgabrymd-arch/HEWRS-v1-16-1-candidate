# HEWRS connected application V1.10

## New connection

Anchor has a **Shirt + trousers — DS001 tied** outfit type. It combines the
existing CP49 DS001 full-shirt layer for the exact selected T001–T047 tie, the
current visible-avatar source, the original registered hands, an exact physical
trouser selection and a registered shoe pair. No jacket is rendered or recorded.

This exposes the existing native full-shirt source; it does not regenerate,
retouch, extend, resize or recolor a garment. In particular, the native shirt's
sleeve/panel transitions and the trouser source's flat upper color band are
retained. They are not presented as repaired or as a newly owner-approved
shirt-only composition. The selected full-shirt layer is the CP49 source already
used by V1.9, not an older CP25 replacement for the later Active-50 suit module.

The connection has 47 tied modes, 24 distinct physical trouser IDs using the nine
accepted color layers, and the same 35 registered shoe pairs. The source API
validates 39,480 combinations. That count is routing coverage, not an exhaustive
rendered or owner-approval count. Other shirts, NO_TIE and REFERENCE are rejected
in this route rather than replaced with DS001 or a tied collar.

**Shirt-only is Anchor-only.** No full shirt-only ensemble-ranking model has been
recovered or invented. The score field is null, not zero. Existing suit and blazer
Engine calculations are unchanged. Watch selection remains metadata-only.

## Existing application

All previous V1.9 suit and blazer connections are retained. Suits S01–S18 use the
later Active-50 components. B03–B14 retain their existing DS001 tied assemblies,
all 47 ties, 24 physical trousers and 35 registered shoe pairs. Blazer Engine keeps
its existing 15 numerical-profile mappings; nine unscored trousers remain
available manually. B01/B02 final wearable bindings are still unresolved.

No source image, scoring data, catalogue ID, profile binding, original garment
approval or historical event has been changed. The approved DS035 corrections
are not used or modified by the shirt-only route.

## History and backups

Shirt-only selections have an explicit `shirtOnly: true` discriminator and no
`suitId` or `blazerId`. Confirmed wear has `items.topwear: null`; the actual
`shirt-DS001`, `Tnnn`, `pants-Pnnn`, shoe and optional watch IDs are retained.
Only a manual confirmation creates an event. Merely viewing a selection does not.

The candidate storage key and existing source lock remain unchanged. Earlier
suit/blazer backups still validate. A backup containing a new shirt-only event
requires V1.10 or a later reader that supports that explicit selection shape;
V1.9 is not claimed to understand it. No production history is read, reset,
migrated or overwritten. New shirt-only sessions and events cannot label
an unranked manual selection as an Engine recommendation.

## Run and verify

Keep `index.html` beside the `data`, `src`, `vendor`, `assets` and `assemblies`
directories. It is not a standalone HTML file.

```sh
python tools/verify_v110.py
node tests/shirt-only.cjs
python tools/build.py
python -m http.server 8080
```

The active package verifier is `verify_v110.py`. Older tests and verification
reports remain historical. The new test checks earlier suit/blazer behavior
against the unchanged V1.9 connection and rendering paths.

```sh
python tests/shirt-only-browser.py
```

The browser suite uses Python Playwright and `/usr/bin/chromium`. It loads the
actual scripts and PNG bytes in memory. Direct local HTTP navigation was attempted
and returned `ERR_BLOCKED_BY_ADMINISTRATOR`; that is not a hosted/Safari/iPhone
pass. Storage-interface tests and UI backup handlers do not certify persistence
across a real browser restart.

`HEWRS_TEST_OUTPUT` and `HEWRS_BROWSER_OUTPUT` redirect test results outside a clean
extraction. Evidence backups contain test events only and are not read at startup.

## Evidence and limits

`evidence/shirt_only_v1_10/BASELINE_V1_9.json` pins all original V1.9 files.
`FUNCTIONAL.json` records the executed exact-ID and history tests;
`browser/BROWSER.json` records the new renders and earlier-mode comparisons.
`RESULT.json` consolidates counts and preservation checks after execution.

The first functional test incorrectly demanded a nonempty recommendation even
when the unchanged cooldown policy could withhold all options after a wear event.
Its original failure is retained. The corrected test requires equality with the
original controller, including the same withheld results; it does not modify
scoring or cooldown behavior.

This is an additional application connection, **not the finished production
release**. Final B01/B02 layers, independent blazer shirt/no-tie connections,
other shirt-only sources, watch images, outstanding numerical-source holds and
physical-device/release validation remain outside this change. Nothing is
uploaded or deployed by this package.
