# Tie feedback and suggestion variety candidate

Development branch: `fix/tie-feedback-rotation-20261118`.
Base: `febe4148fc0b27ee2018d84408714ee1fe712015`.

## Rejection controls

The main outfit card now exposes the rejection scope directly. The owner chooses
the scope and whether it applies to every occasion or the current occasion.

| Scope | What it excludes |
| --- | --- |
| Entire clothing combination | The same topwear, trousers, shirt and tie with any shoes/watch; existing behavior. |
| Exact clothing + shoes | That clothing and shoe combination with any watch; existing behavior. |
| Shirt–tie pair | Only the selected shirt ID with the selected tie ID, across other outfit pieces. Each item remains available with other partners. |
| Tie itself | Only the selected tie ID, with any shirt or outfit. |

Reason checkboxes and notes do not turn an existing outfit rejection into an item
ban. Selecting a diagnostic does not override an explicitly chosen scope.
An open-collar outfit cannot create a tie or shirt–tie rejection.

`Reject once` expires on the next Generate or page reload. `Never show again`
persists until Undo. The manager labels scope and occasion, supports individual
Undo, and exports/imports both feedback ledgers. Older outfit backups retain
their original meaning.

Tie exclusions are applied during native candidate search and checked again
before a list or visible avatar is accepted. Refill preserves accepted option
records in order and appends eligible replacements, up to the existing limit.

## Variety between generated lists

Each successfully displayed native Research/Heuristic list records the ties
included in its options. This begins with an empty history when this candidate
is first used. There is no reconstruction of past suggestions from wear logs,
Favorites, old rejections or external user data.

Work, Dinner and Weekend have separate counts. Navigation, reloading, manual
selection, failed generation and cancelled generation do not increment them.
Refill records only newly appended options. Each tied option counts once;
repeated exact tie anchors count once per included row. No Tie records no tie
exposure.

The existing eligibility checks, numerical scores, learned preferences, item
limits, exact owner approvals and confirmed-wear recommendation remain intact.
During subsequent list curation, a less frequently suggested tie can replace
the previous choice only if it is within **0.05 points of both its raw preference
score and its variety-adjusted utility**. Exact tie anchors and an existing
No Tie choice bypass this adjustment. The original scores are not modified.

This improves opportunities for comparable eligible ties. It does not promise
that all 47 ties will appear, force weak outfits into the list, or bypass the
selected occasion, weather, locks or rejection rules.

## Data and failure handling

- Existing outfit feedback remains in `hewrs:outfit-feedback:v1:event:`.
- Explicit tie feedback uses `hewrs:tie-feedback:v1:event:`.
- Suggestion exposure uses `hewrs:tie-exposure:v1:event:`.
- New events use independent immutable keys; no shared counter overwrites.
- Corrupt tie feedback blocks unchecked results. Corrupt exposure disables only
  the optional variety adjustment and produces a visible tracking warning.
- Combined feedback import validates both merges before writing. Browser
  storage has no multi-key transaction; a quota failure is reported as an
  incomplete import and retrying the same backup safely resumes it.
- Exposure remains local to the browser and is separate from wear/rejection
  backups. It is bounded at 5,000 events, with a visible warning on storage or
  capacity failure. Existing records are never silently discarded.

## Candidate build and verification

The frozen Standard source and release manifest are unchanged. Regenerate only
the candidate runtime and candidate entrypoint integrity values with:

```sh
python tools/build_tie_candidate.py --verify-base --write
python tools/build_tie_candidate.py --verify-base --check
node tests/tie-feedback.cjs
node tests/tie-exposure.cjs
node tests/tie-engine-integration.cjs
node tests/rejection-cumulative-refill.cjs
node tests/rejection-same-generation-guard.cjs
python tests/tie-feedback-rotation-browser.py
```

The dedicated GitHub Actions workflow verifies the pinned base, protected source
files, candidate bundle and real Chromium behavior. Its evidence uses synthetic
browser storage and blocks external/provider requests. It performs no deployment.

This branch is independent of the separate AI Five feature branches.
