# Rejection read failure repair

Development branch: `fix/rejection-read-failure-20261118`.
Base: `ec4280a500174cef9b87f1a05f23878da186569d`.

## Problem

The preceding diagnostic reproduced a startup defect in the actual candidate:
an unreadable outfit-feedback record caused the application to substitute an
empty in-memory ledger. Previously saved outfit exclusions then stopped being
enforced, although their original bytes remained in localStorage.

This change implements the first repair from that diagnosis. The 30,000-record
storage migration and expanded candidate search are separate subsequent work.

## Resulting behavior

- Startup retains the actual outfit-feedback store and its blocked state when
  it cannot validate saved records. It never substitutes an empty rejection log.
- Both outfit and tie feedback are checked before a generator is invoked, before
  applying a manual or generated selection, and before refill begins.
- A changed or unreadable rejection record during asynchronous generation or
  rendering prevents the pending result or pixels from being published.
- A visible error on Home and Outfits pauses generation and outfit display.
  Existing main and reviewed previews are hidden; internal accepted options and
  original feedback bytes are retained. Pending work is cancelled.
- **Retry rejection check** reads and validates both existing ledgers. It resumes
  controls only after the read succeeds and reconciles the retained options
  against all saved exclusions. It does not generate outfits, call an AI service,
  delete records, or repair a malformed record automatically.
- Persistence status remains dynamic through the public application wrapper.
  A transient read failure can recover on the same page with the original store
  and the original exclusions still active.
- Healthy initial validation does not cancel the existing automatic-weather
  startup request. Recovery does not automatically restart reviewed searches.

## Publication boundaries

The shared controller validates feedback before invoking either a synchronous
or asynchronous producer, then verifies that the feedback revision is unchanged
before accepting its result. The visible avatar and reviewed canvas retain
their existing offscreen rendering and final feedback checks.

Card export also needs protection because its anonymous canvases intentionally
do not use the visible-avatar wrapper. Opening and preparing an export must
validate feedback, and an asynchronous export must recheck its captured feedback
token before publishing a download link. A feedback read failure cancels an open
card export and revokes its temporary download URLs.

Enlarged outfit views and the options list validate feedback before opening.
An error also closes any already-open outfit view, options list or card export,
so a stale outfit cannot remain visible through a separate presentation.

## Scope and preservation

Only the candidate application, shared rejection bridge, rejection UI and their
generated delivery are changed. The Standard application, wardrobe records,
images, avatar renderer, scoring, occasion policy, engine search, feedback
schemas and existing saved-record bytes remain unchanged.

The four API backup refs from the preceding audit remain separate. This branch
does not merge PR #9, deploy a site, copy personal browser data, or make provider
requests. It does not establish 30,000-record support.

## Verification

The new bridge tests use the actual outfit and tie ledger modules with producer
and canvas spies. Their purpose is to verify rejection of work and pixel commits
at the read boundary; they are not presented as real-engine generation tests.
The Chromium tests exercise the actual packaged candidate with fresh synthetic
profiles at a 390 × 844 viewport and block all non-local requests.

```sh
python tools/build_tie_candidate.py --verify-base --write
python tools/build_tie_candidate.py --verify-base --check
node tests/rejection-read-failure.cjs
node tests/tie-feedback.cjs
node tests/tie-exposure.cjs
node tests/rejection-cumulative-refill.cjs
node tests/rejection-same-generation-guard.cjs
python tests/rejection-read-failure-browser.py
python tests/tie-feedback-rotation-browser.py
```

The older `rejection-scale-audit.cjs` full diagnostic intentionally asserts the
former empty-store fallback and belongs to its pinned audit commit. Do not run
it on this repaired candidate as a pass/fail regression or overwrite the
preserved baseline observations. Its fixture-only mode is independent of that
old-defect assertion.

The dedicated workflow checks protected source files, reproduces the candidate
bundle, runs the focused guards and existing feedback regressions, then verifies
failure/recovery and healthy generation/refill in Chromium. It performs no
deployment.

## Verified result — November 18, 2026

The dedicated [CI run 44378646012](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44378646012)
passed against implementation commit `be75a0c2091f668624f8d2a9ad877aaf98beedfe`.
The following evidence commit changes documentation and saved observations only.

| Verification | Result |
| --- | --- |
| New rejection read guards | 15 tests passed |
| Existing tie-feedback semantics | 9 tests passed |
| Existing tie-exposure semantics | 10 tests passed |
| Cumulative rejection and same-generation fixtures | Both passed |
| Actual Chromium failure/recovery checks | 31 assertions passed |
| Existing Chromium generation, rejection and refill checks | 40 assertions passed |
| Original protected sources and candidate build reproduction | Passed |
| Uncaught browser page errors | 0 |
| External/provider requests | 0 |

The startup assertions capture the interface before probing the ledger, so the
probe cannot create the blocked state being tested. Both malformed saved records
and a storage read exception blocked generation at startup with no options,
visible pixel commits or lazy index request. Failed retry retained the original
bytes. A successful retry restored use of the same ledgers and preserved their
exclusions. One real generation after recovery returned 20 valid options with
both saved bans enforced and the avatar ready.

The new browser tests also exercised corruption during native generation and
image loading, reviewed-outfit rendering, PNG preparation, revocation of a
prepared download after a real cross-tab storage event, and closure of an open
enlarged view. The two mobile screenshots were visually reviewed at 390 × 844.
All profiles and rejection records used for testing were synthetic.

Saved evidence:

- `evidence/rejection_read_failure/RESULT.json` — 31 assertions and observations.
- `evidence/rejection_read_failure/CI_VALIDATION.json` — tested commit, workflow,
  artifact digest, protected build hash and individual evidence-file digests.
- `evidence/rejection_read_failure/*.png` — blocked Home and recovered outfit.
- `evidence/tie_feedback_rotation/RESULT.json` — the 40 healthy regressions rerun
  against this implementation, with associated screenshots and synthetic backup.

Artifact SHA-256:
`a3c8f40ed6493a58de902b3f866fb31832e481fd645d4d1af0a74ecb96ee4f8f`.

Candidate runtime SHA-256:
`750a74e768d1368a2c8ab682e2056e5c5359dea068b42032659f0b502e37230e`.

This confirms the read-failure repair. It does not establish 30,000-record
capacity, change the bounded engine search, recover corrupt records
automatically, or change the live application.
