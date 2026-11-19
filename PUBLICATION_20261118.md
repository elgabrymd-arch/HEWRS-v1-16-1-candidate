# HEWRS publication — November 18, 2026

## Published and verified

The integrated tie feedback, persistent rejection storage and search/refill
changes are published to the existing application:

https://elgabrymd-arch.github.io/HEWRS-v1-16-1-candidate/

The existing bookmark and the release-specific URL both serve the verified HTML:

https://elgabrymd-arch.github.io/HEWRS-v1-16-1-candidate/?hewrs-publication=f745df827dfc

Release commit: `f745df827dfc79aea52f816219fbcf68cbc510ae`.
Release tree: `84183726b391c873992d8fe6fc104dc19e19ffce`.
Publication was authorized by the owner's “Please do publish” instruction.
[Pull request 10](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/pull/10)
was merged, and
[GitHub Pages deployment 44443498595](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44443498595)
completed successfully.

## Live verification

[Live verification run 44443499156](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44443499156)
passed all **32 checks** against the published HTTPS application. The checkout
provided expected hashes only; no local application responses were substituted.

- Both HTML entrypoints and all 29 startup/style/index dependencies matched the
  release bytes: 31 matching files in total.
- The application loaded, generated 20 valid options and displayed the avatar
  and garment thumbnails.
- Twenty consecutive permanent clothing rejections each produced 20 valid
  choices. Every prior rejected combination remained excluded. Surviving
  options retained their records and order within the same generation.
- All 20 permanent exclusions survived a page reload, and the manager displayed
  all 20 records.
- Wear history and Favorites were unchanged.
- No application request failed, no HTTP error or uncaught browser exception
  occurred, and no external/provider request was made.

The test used a fresh Chromium 141.0.7390.37 profile at 390 × 844. It did not
access the owner's browser, rejection history or phone. The post-rejection
screenshot was visually checked: avatar, garment pictures, IDs and navigation
were present.

The full storage/search suite also passed again after the release URL changes in
[run 44443274564](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44443274564),
including native Chromium and WebKit with 30,000 active exclusions. The existing
Stage 10 verification passed in
[run 44443499083](https://github.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/actions/runs/44443499083).

## Release integrity and preservation

The application JavaScript is byte-identical to the previously verified
integration. Three changed script URLs were given content-hash query values in
both entrypoints so existing caches cannot combine old modules with the new
HTML. Runtime SHA-256:
`bc29e962604013f47c130135b6094c8eb0907b0b5d2edc9fa5b666e67bca4a25`.

The prior published main commit is retained at
`backup/pre-rejection-storage-release-20261118`:
`a5f571dccc09a2bd68ee60ad524e64cd0f8f9454`.
The wardrobe, approved avatar and existing styling assets were preserved.
Independent AI Five/API work remains saved separately and is not activated by
this release.

Close older HEWRS tabs and open the release in the same browser normally used
for the app. Keep the existing browser data. The application migrates its old
rejection records without deleting the original localStorage records. Actual
owner-device performance was not measured by this verification.

## Evidence

`evidence/rejection_publication/RESULT.json` contains all 32 checks, the 31 file
identities, the synthetic rejected selections and storage status. Four live
screenshots are saved beside it. The downloaded Actions artifact was verified
before extraction:

- Artifact: `14492231756`, `HEWRS_LIVE_REJECTION_PUBLICATION_EVIDENCE`.
- ZIP size: 378,657 bytes.
- ZIP SHA-256:
  `dc5d2430524ce9df0aad755d9e20f66ffcbbdd0711dfa485c94f6c048a8ec982`.

This publication record supersedes the earlier development report's
“not deployed” status. The evidence branch records results without changing the
published application tree.
