# HEWRS V1.17.4 — S10/S11 eligibility and automatic local weather

## Reproduced defect and targeted correction

The exact delivered V1.17.3 source was reconstructed from mounted, verified inputs.
Its 1,880-file tree passed its own verifier before modification. The original full
V1.17.3 ZIP-container hash was not freshly measured; source-file identity was checked.

With S10 or S11 anchored, each had 1,921 scored clothing candidates in the test.
Under a mild/dry Fall weather fixture, the old pipeline rejected them all: the legacy
catalogue arrays contain Spring and Summer, and the weather filter treated that
calendar label as a hard ban in Fall. With weather explicitly not assessed, both
returned 15. This reproduced the user's message without missing suit assets or
missing ensemble scores. It does not prove every possible selected-lock failure
has that same cause.

The new pipeline keeps the same season arrays and records an advisory rather than
using them as a mandatory exclusion. An incomplete seasonal catalogue tag is not
proof of unsuitable fibre weight. Existing inferred material/temperature scoring,
precipitation, footwear exclusions, minimum weather threshold, formality, genuine
source holds and selected locks remain active. No numerical compatibility or DNA
record is changed. The generic zero-result message now distinguishes missing scored
clothing from actual weather or accessory constraints and reports observed causes.

In fresh tests, S10 and S11 each produce 15 under the reproduced mild/dry Fall
conditions, and all 18 suits independently produce 15 in each of the four mild/dry
season fixtures (72 cases). This is not an unconditional guarantee of 15 for
incompatible locks, severe weather, or missing score-source decisions.

## Automatic local weather

The added coordinator reuses the existing location/provider service and weather
storage. A separate `hewrs:automatic-weather:v1` key stores only mode/date preferences;
wear and Favorites storage keys, schemas and bytes are not migrated or rewritten.

- Use **Location & weather → Enable automatic local weather** for initial activation.
  The click allows the browser's native location permission request. On success the
  result is saved and applied automatically; a second Apply is not needed.
- Opening/reopening the app, returning to the tab and generating options trigger
  refresh. Repeated foreground requests are throttled for 15 minutes. Nothing here
  runs when the app/browser is closed; no background location service is installed.
- When browser permission is `granted`, silent refresh obtains device coordinates
  and fetches current conditions. No additional HEWRS permission dialog is added.
- When permission is `prompt`, `denied`, or cannot be queried, automatic refresh
  does NOT request GPS. It refreshes an existing saved place, explicitly labelled
  **Saved location**, or requests the one-time Enable/city action if no place exists.
  A saved-place refresh is never claimed to be a new current-location fix.
- Manual weather, selected-city fallback and **Use without weather** remain usable.
  Applying manual weather or opting out disables automatic replacement. An explicit
  Work date is respected; the follow-today setting prevents yesterday's saved date
  from being reused unintentionally during automatic normal daily use.
- Cancellation, newer manual changes, provider failure and blocked/corrupt settings
  cannot silently replace existing weather. Errors stay specific. Corrupt settings
  and failed writes are not reset or reported as a successful save.

Browsers require permission for current device location and control its lifetime.
HEWRS cannot bypass that permission or guarantee that Safari will never ask again.
This implementation avoids automatically initiating a new permission prompt when
permission is not granted. See the primary API documentation:
https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition
https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API

## Preserved data and behavior

The existing 136 feature records, 2,350 frozen Shirt–Tie lookups, and all 112,392
freshly evaluated ensemble results match V1.17.3, including source holds/conflicts.
The existing formula weights, independent No Tie calculation, confirmed-wear
rotation policy and two-use list caps are unchanged. Exact anchors exempt only
that exact physical item; family selections do not grant blanket exceptions.

All 848 V1.17.3 assets/assemblies image files are preserved. No new runtime garment
image is added. 47 source-restored tie routes, accepted DS023 matte corrections,
avatar/shirt/suit geometry, source locks, physique, palette, mobile-sheet behavior,
Favorites and wear history are preserved. There are 18 connected non-suit shirts,
50 suit-mode shirts, 18 suits and 14 blazers. The other 32 non-suit shirts remain
deferred; shirt-only ranking is still not invented.

## Five audit passes — newly performed

1. **Baseline and failure reproduction.** Exact V1.17.3 source validation, frozen
   baseline retained separately, S10/S11 with and without the seasonal veto.
2. **Eligibility and data integrity.** 11 suit/season checks; all 18 suits across
   four seasons; actual heat/snow and score-hold exclusions; 5 DNA checks including
   full 112,392 fresh numerical comparisons and 2,350 Shirt–Tie lookups.
3. **Automatic behavior and option constraints.** 22 automatic-weather checks,
   21 provider/transport checks, and 26 inherited option-policy checks rerun. This
   includes granted/prompt/denied/unsupported permission, labelled saved-place
   fallback, failures, date modes, cancellation, manual precedence, corrupt/stale
   storage and current option caps. Functional total: **85 passed, zero failed**.
4. **Rendered UI and state isolation.** **19 Chromium checks passed, zero failed**;
   **166 unchanged frames** pixel-equal to V1.17.3; 30 actual S10/S11 options opened
   and matched to their IDs. Actual Enable control and no-extra-Apply behavior,
   simulated reopening with granted or prompt permission, saved-location label,
   manual override, network error, cancel, and five panel viewport sizes were
   checked. Wear/Favorites bytes stay unchanged. Preview images were inspected.
5. **Delivery and rollback.** Full package/changed-file hashes, original modified
   source bytes, exact V1.17.3 rollback and installation from each supported source
   baseline are checked separately. A source-file manifest is not a claim of live
   deployment. Delivery receipt records final ZIP identities and installation runs.

Two initial browser invocations stopped on harness issues: a string predicate
conflicted with the existing CSP, and a restored fixture lacked an embedded image
for its seeded outfit. The tests were corrected to use function predicates and
preload the seeded fixture. The application CSP was not weakened; neither aborted
run is included in the 19 final passing checks. Those intermediate reports remain
under `test_fixture_attempts`. Final browser results came from a complete rerun.

## Test limitations

Successful weather-provider and location-permission responses were simulated in
in-memory Chromium, using actual local app scripts and image bytes. This is not a
new physical iPhone/Safari permission/restart certification. An ordinary localhost
persistent-profile attempt returned `ERR_BLOCKED_BY_ADMINISTRATOR` before app load,
with zero HTTP requests. It was not bypassed or counted as a pass. Previous owner
reports of successful provider lookup and other accepted clothing/mobile checks
remain historical reports, not evidence of the new automatic behavior.

No GitHub upload, public deployment, production overwrite, storage clearing or
owner-history access was performed. Browser-controlled permissions can expire.
Source seams and limited source resolution are unchanged. All 15-output claims
above refer to the documented eligible fixtures, not every possible combination.

## Install and roll back

The cumulative update supports the exact **V1.17.2 or V1.17.3** source trees. The
V1.17.2 path includes the previous colour/two-use option correction; installing that
intermediate ZIP separately is unnecessary. Both supported versions keep the
existing 18-shirt scope. Copy the CONTENTS of `FILES_TO_COPY` into the current
candidate repository, replace matching files and keep all other folders and `.git`.
Do not clear browser data. The existing candidate site address remains unchanged.

Suggested Git commit summary:
`V1.17.4 — fix suit eligibility and enable automatic local weather`

The optional `install_update.py` verifies baseline and update bytes and creates a
NEW separate complete folder; it refuses an existing destination. The delivered
`python -B tools/verify_v1174.py` checks the complete target folder.

`python -B tools/rollback_v1174.py --check` checks original rollback bytes.
`python -B tools/rollback_v1174.py --output NEW_FOLDER` restores exact V1.17.3 in a
new destination. Older code ignores the extra automatic-mode preference key;
weather and user data do not need deletion or migration. Historical source scripts
and evidence remain present but their old tests are not current acceptance checks.

`CHANGED_FILES.json` lists every changed/new file and its before/after hash, excluding
its own and the package manifest's self-hashes. `PACKAGE_SHA256.json` covers every
other payload. Read-only package verification does not create new test evidence.
