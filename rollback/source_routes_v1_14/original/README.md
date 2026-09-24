# HEWRS connected application V1.13

## Installed in this update

DS001 and DS014 now support NO_TIE under all 14 blazers, with 24 physical
trouser IDs and 35 registered shoe pairs. Both shirts also support all 47 ties.
Their independent catalogue/history IDs are retained. The exact shared visual
binding is established by the CP25 full-shirt files and both modes of current
Active50 components; it is not a colour-based or positional substitution.

Blazer Engine requires one of these exact shirt IDs and supports exact ties,
tie families, ANY and explicit NO_TIE. The existing 15 numerical trouser profiles
and nine unscored manual trouser selections are unchanged. NO_TIE serializes as
an intentional null tie, not ANY or an automatically substituted T001.

Shirt-only Anchor supports DS001/DS014 with NO_TIE or any of 47 ties. No shirt-only
ranking model is added. Watch ID/name display remains sufficient; no watch images
are required. Existing all-18-suit/Active50 routes and the V1.11 facelift stay intact.

## Exact source and image change

One new 996 x 2748 full-shirt NO_TIE integration layer is derived from the
original white DS001 body, its reconstructed pre-tie chest and the current
approved DS001/DS014 open-collar/body components. It is a new derivative, not a
recovered original asset. Original source files are never overwritten. Only the
narrow chest/neck transition changes; original sleeves and all rows 1198 onward
are retained exactly. The old avatar in a provenance intermediate is not the
runtime avatar. Runtime retains the existing current avatar and jacket masks.

The complete method, copied original code/input hashes, exact changed-region
counts and the shared-identity proof are in
`evidence/open_collar_v1_13/DERIVATION.json`. The small source blend is confined
to the crop transition; no new cloth texture or different shirt is substituted.
Existing shirt-only sleeve transitions and the upper-trouser band remain
unretouched. This does not reopen previous garment or avatar approvals.

## Test evidence and limits

`evidence/open_collar_v1_13/RESULT.json` is the current result. Original test
reports and earlier scripts remain historical evidence; their old assertions
that NO_TIE/DS014 were unavailable are not current approval requirements.
The final Chromium run uses actual packaged scripts/image bytes in memory;
it is not a hosted test, Safari/iPhone result or a browser-restart persistence
certification. The first harness run hit CSP's prohibition on evaluated string
predicates; its partial result is retained. The test was corrected to a function
predicate without weakening application CSP.

All original source, score, profile, facelift and storage bytes outside the
explicit changes are pinned to V1.12. No source data, scoring judgments or
history IDs are invented or silently migrated. Deterministic test wear is
isolated; no real production user ledger is touched.

## Remaining release boundary

The other 48 shirt identities are not yet connected in blazer/shirt-only mode;
their suit routes are unchanged. Shirt-only numerical ranking is not installed.
The application remains a development build, not a complete product release.
No GitHub write, production overwrite or deployment was performed. Final hosted
and physical-iPhone/Safari tests are still required. Existing source-score
limitations and intentionally unavailable UI functions are not silently closed.

## Run and verify

Keep the complete folder structure with `index.html`, `assets`, `data`, `src`,
`vendor`, and `assemblies`. `index.html` alone is not self-contained.

```
python tools/verify_v113.py
node tests/open-collar.cjs
python tools/build_open_collar.py --check
python tools/reconstruct_ds001_pre_tie.py
python tools/build.py
```

The optional browser run needs Playwright, Chromium, and a separate original
V1.12 extraction for regressions:

```
HEWRS_BASELINE_V112=/path/to/HEWRS_CONNECTED_APP_V1_12 python tests/open-collar-browser.py
```

The browser evidence path can be placed outside this package with
`HEWRS_V113_BROWSER`. Functional output can be moved with `HEWRS_V113_FUNCTIONAL`.
Original source reconstruction requires Pillow, NumPy, SciPy and the packages
used by the bundled original shirt construction scripts. No fonts are bundled.

## Rollback

Restore V1.12 application files only. Do not replace or erase the user's ledger
with an older backup. New NO_TIE/DS014 non-suit selections are not supported by
V1.12; preserve/export their records before choosing to view them in older code.
This is a schema-compatible additive selection update, not a history migration.
