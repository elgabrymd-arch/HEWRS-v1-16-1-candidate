# HEWRS option cards — V1.23.2 (includes shoe-15)

This is a cumulative incremental update for your existing app. It installs over
exact V1.23.0 (from the seven-part handoff) OR exact V1.23.1-shoe15. The correct
starting version is detected from its manifest. The previous shoe-15 patch does
not have to be installed separately. This is not a standalone app.

The running Outfits screen now keeps the full outfit on the left and the current
item pictures/IDs/names on the right. Tap a thumbnail to enlarge its picture.
Item pictures opens all roles. Navigation, Full/Collar/Enlarge, Standard view,
export, weather, scoring, Favorites, history and feedback are retained.

## Apply to the existing local app folder

Extract the ZIP. In its extracted HEWRS_OPTION_CARDS_UPDATE_V1_23_2 folder run:

    python -B apply_update.py "/path/to/current/app" --dry-run
    python -B apply_update.py "/path/to/current/app"
    python -B "/path/to/current/app/tools/verify_card_layout.py"

The target is the folder containing your existing index.html and
PACKAGE_SHA256.json, NOT the whole private handoff directory. Use Python 3.9+;
the installer/verifier use the standard library only. No npm build is required.
The source bundle, entry points, CSS fingerprint and SRI are already built.

The installer checks every baseline file and patch payload before changing any
file. It refuses unknown versions or edited/extra app files (Git metadata and
Python bytecode caches are ignored). Existing later edits are not overwritten.
No browser storage, feedback, wear, Favorites, network, Git or credentials are
accessed. Do not clear browser data to apply this update.

Producing or applying this local ZIP does NOT update the hosted site. Deployment
must use the updated existing application folder. Do not publish this whole ZIP
or the private handoff. UPDATE is a partial file tree, not a complete site.

## Rollback

Choose the same starting version reported during installation:

    python -B apply_update.py "/path/to/current/app" --rollback-to 1.23.1-shoe15 --dry-run
    python -B apply_update.py "/path/to/current/app" --rollback-to 1.23.1-shoe15

Or, to restore the original V1.23.0 before either correction:

    python -B apply_update.py "/path/to/current/app" --rollback-to 1.23.0 --dry-run
    python -B apply_update.py "/path/to/current/app" --rollback-to 1.23.0

Rollback also verifies every current file before restoring original bytes and
removing new paths. Later changes cause a refusal, not a blind overwrite.

## Contents

UPDATE/ contains the changed/new app files, including the shoe-15 correction,
rebuilt runtime, source, current manifest, tests and evidence. ROLLBACK/ contains
exact original changed files for both supported baselines. MANIFESTS/ contains
the exact version manifests. PATCH.json gives per-file before/after identities.
CORRECTION_REPORT.md describes executed tests and limits. PACKAGING_TESTS.json
records the actual apply/rollback checks for both baselines.

The real Classic/Hybrid zero-result condition, missing shoe connections, other
shoe appearance issues and rejected-outfit recurrence are not fixed by this UI
change. Physical iPhone/Safari and hosted-cache behavior have not been tested.
