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
