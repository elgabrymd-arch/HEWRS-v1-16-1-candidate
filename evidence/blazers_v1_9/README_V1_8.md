# HEWRS connected application V1.8

## Restored connection

B03 Engine ranking now consumes the **existing 15 local physical-trouser/profile
bindings** from `HEWRS_Trouser_Profile_Bindings.json`. The recovered source is
15,859 bytes and matches its original recorded SHA-256:

`538cdf147e1af4c83c88a5b7bfbc6cf9bc5128b6461200be3ea01588348cb960`

The current B03 route retains the existing DS001 tied assembly, 47 ties, 24
physical trouser identities and 35 registered footwear pairs. Exact tie, tie
family, and Engine-selected tied outfits use the inherited calculation,
context, style, and confirmed-wear rotation rules. The unsupported B03 no-tie
configuration is excluded **before** scoring/ranking; it is not replaced with a
tied outfit or synthesized image.

Fifteen trousers have an existing scoring profile: PT001–PT007, PB001–PB004,
PG001, PG002, PN002, and PG003. The source distinguishes eleven prior retained
bindings and four local bindings, including its disclosed color normalizations.
These source states remain intact; this update does not declare them newly
approved per-garment frozen judgments or change `production_approval: false`.

The other nine source rows remain null: PBR001, PBR002, PN001, PN003–PN007, PW002.
Their exact Anchor display and confirmed-wear recording remain available. No
shade proposal, shared image, or RGB measurement is used to fabricate a profile.

## Preservation and request integrity

- All V1.7 image files, masks, assembly descriptors, geometry and renderers are
  unchanged. No garment regeneration or new visual derivative is included.
- The original numerical inputs, 188 approved shirt/tie records, 98 stored
  blazer/pant foundation records, scoring equations, and source lock are unchanged.
- All existing suit routes remain in place. B01/B02 revision reconciliation,
  B04–B14 wearable binding, other blazer shirt modes, and watches are not changed.
- The older null/proposal crosswalk remains as historical source data; the restored
  runtime crosswalk is a separate read-only module. Its physical IDs and original
  asset hashes are checked against the existing trouser representation.
- Engine requests must carry the exact source-bound physical/profile pair and
  provenance. Modified values, fabricated evidence and attempts to activate null
  profiles are rejected. Candidate validation uses those same checks.
- Wear/backup code and the storage key/source lock are unchanged. V1.7 backups
  remain readable; generating or viewing an outfit does not add a wear event.
- Test wear data under `evidence/profiles_v1_8/TEST_BACKUP.json` is a test fixture,
  not the owner's wear history and not loaded on application startup.

## Run and verify

From this source directory:

```sh
python tools/verify_v18.py
node tests/profile-routing.cjs
python tests/profile-browser.py
python tools/build.py
python -m http.server 8080
```

Open `app.html` through the local server. A self-contained file may be generated
with `python tools/build.py --standalone HEWRS_CONNECTED_APP_V1_8.html`.

The functional suite uses Node.js. The browser suite requires Playwright and
`/usr/bin/chromium`. It supplies the exact packaged scripts/PNGs in memory and
is **not** a hosted, Safari, physical-iPhone or real-origin restart test.
Its output destination can be changed using `HEWRS_BROWSER_OUTPUT`;
`HEWRS_TEST_OUTPUT` controls the functional result file. The verifier reads
only and does not regenerate or repair sources.

## Evidence

Current results are under `evidence/profiles_v1_8`. Earlier evidence and test
files retain their historical versions. In particular, the V1.7 blazer tests
assert the then-unavailable profile mapping; they are not the active V1.8
profile test entry point. Use the two current suites listed above.

The source JSON was recovered from its complete readable file contents after
raw-file transfer was unavailable. Re-serialization matched the original file
hash exactly; no missing values were inferred. Its original scope and labels
are preserved in `evidence/profiles_v1_8/source`.

The candidate source tree has no production `index.html`. No GitHub write,
production data migration or deployment was performed.
