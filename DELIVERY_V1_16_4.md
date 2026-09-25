# HEWRS V1.16.4 — mobile picker layout correction candidate

## Scope

The owner's Safari screenshot shows the Suit / Blazer picker body collapsed to a
thin strip even with the keyboard dismissed. This is a UI-only continuation of
V1.16.3. No catalogue, garment image, avatar, geometry, score or wear record is
changed. The earlier approved DS023 neckline/knot and side-wedge corrections are
retained. GitHub and the live website were not modified in this execution.

## Implemented change

- List pickers receive an explicit, bounded panel height. The panel body uses
  `flex: 1 1 auto` instead of relying on the zero-based `flex: 1` shorthand in
  an auto-height dialog. The title and Apply/Cancel footer do not shrink.
- The body is the single scroll area. The item list no longer has its own nested
  height-limited scrollbar; the last item remains reachable above the footer.
- A separate layout-only helper responds to visual-viewport resize/scroll and
  window resize. It adjusts the visible height and bottom inset without changing
  page data. Its temporary properties are removed when the sheet closes.
- Touch pickers no longer focus Search automatically, so opening the list does
  not request a software keyboard. Search is still available by tapping it.
  Desktop search focus is retained. Pinch zoom is not disabled or counter-scaled.
- Filter columns are constrained to available width, fixing an additional narrow
  screen overflow found in the first test run. The original palette is unchanged.
- Updated UI files use versioned HTML resource URLs. No cache or storage clearing
  is requested. There are no service-worker or history-schema changes.

The existing original CSS remains an exact prefix of application.css; the new
rules are limited to the existing modal. The non-picker Home page was compared
as a screenshot and remained pixel-identical in the controlled test.

## Evidence and limits

The original Chromium build did NOT reproduce the hardware Safari failure by
itself. An explicitly injected zero-flex-basis stress reduced its dialog body to
10 pixels, reproducing the observed form of collapse. The same stress left the
new body at 537 pixels at a 390 x 700 viewport. This is evidence for the sizing
correction, not proof of the precise WebKit implementation cause.

Fresh results: **16 functional checks and 25 Chromium checks passed**. These
include all six preference pickers at six viewport sizes (36 cases), four
explicitly synthetic visual-viewport states (40 total layout cases), search,
empty results, last-row accessibility, Apply/Cancel, unchanged gating and isolated
storage. The synthetic viewport exercises keyboard-sized areas and offsets; it
does not operate an actual iOS keyboard. A desktop focus check and wardrobe-list
check also passed. **16 actual outfit frames were pixel-identical to V1.16.3**,
including corrected DS023 shirt-only and blazer routes. **705 existing runtime
images** and **73 existing non-UI source/data/vendor files** remain byte-identical.
The 39,817 suit and 1,728 non-suit state checks are routing checks, not rendered
frame counts.

WebKit was not installed. The installation attempt failed with DNS errors when
retrieving its browser binary. No WebKit run, physical iPhone/Safari pass, hosted
loading check or browser-restart persistence check is claimed for this build.
**The phone test remains pending after the candidate update is installed.**

Development notes: the first browser run exposed filter-column overflow at
320px width, fixed by the scoped grid rules; a subsequent run hit a test-only
ambiguous selector, corrected to the picker container; a time-limited run stopped
before the final cases. The reported 25 passes refer to the final complete run.
The previous V1.16.3 owner-reported desktop refresh/restart pass and visual
approval remain historical results, not new V1.16.4 certifications.

## Update

Apply over **V1.16.3 only**. Make a backup outside the existing candidate folder.
Copy the CONTENTS of `FILES_TO_COPY` into the existing candidate repository root,
merging subfolders and replacing the named files. Do not copy the enclosing
FILES_TO_COPY folder, remove .git, clear browser data, or touch the legacy app.
Commit/push this local change through the existing candidate workflow. No upload
or deployment is performed by this package.

The application version will read `HEWRS_CONNECTED_APP_V1_16_4`; RELEASE_STATUS
will read `1.16.4`. Full source includes all dependencies. index.html alone is
not self-contained. The retained tools from earlier releases keep their original
version contracts; use **tools/verify_v1164.py** for the new tree.

## Verification and rollback

`python -B tools/verify_v1164.py` checks payload hashes, precise changed paths,
all original runtime images, protected non-UI code and test receipts.

`python -B tools/rollback_v1164.py --check` checks the restoration sources.
`python -B tools/rollback_v1164.py --output NEW_FOLDER` reconstructs exact V1.16.3
outside the current tree and refuses an existing destination. It does not read
or write browser storage. The supplied cumulative source-update helper can also
create a separate V1.16.4 from a pristine V1.16.3 folder.

18 non-suit shirts remain connected; 32 remain gated. Shirt-only ranking is still
absent. Watch ID/name remains sufficient. No new garment approval is requested.
