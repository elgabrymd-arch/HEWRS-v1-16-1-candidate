# HEWRS V1.16.2 — DS023 compositing correction

## Result and scope

This continues the existing V1.16.1 application. It corrects DS023 in blazer and
shirt-only modes without replacing the avatar, original images, current collar
leaves, ties, trousers, shoes, geometry inputs, catalogue, scores or history.
There are still 18 connected non-suit shirt IDs and 32 gated IDs. No new shirt
ID or numerical policy is added. The original full source ZIP was freshly
checked as SHA-256 `f8452d8be7c337ed5c2cdccb2757ea74de7d50fa3bef65e15298b404a6bfac3b`.

## What changed

**Side wedges:** The uploaded DS023 donor itself contains opaque grey background
between its sleeves and torso. The previous registration carried this into the
application. Two bounded connected background regions are made transparent in
separately named tied and NO_TIE bases. Their mixed-colour three-pixel fringes
receive alpha-only cleanup. No donor cloth is painted, recoloured, generated,
stretched or replaced by this correction. All RGB values in the two new base
images are identical to their respective previous base images.

**Tied neck:** The existing native upper-body/collar components already specify
a transparent neck opening. The previous body registration respected that
opening only for NO_TIE. Applying the same visibility rule to the tied base
removes 4,370 obstructing body-registration pixels. The original avatar skin
is revealed at its existing coordinates. Front collar leaves and tie images
are not changed, moved or regenerated. NO_TIE's already-correct neck opening
is preserved.

**Waist overlap:** Only for DS023 shirt-only mode, the existing selected trouser
layer is drawn once in front of the shirt rather than behind it. This uses its
original upper edge and restores the tucked-shirt overlap. It does **not** add
a belt, alter the trouser silhouette or reconstruct a detailed waistband.
The original trouser images have a straight, simplified upper edge, which
remains visible. A fully naturalistic waistband is not claimed.

The blazer/NO_TIE B03 control is intentionally pixel-identical: its jacket
already conceals these side backgrounds and its open neckline was already
correct. B03 tied changes only the neck obstruction. No source is switched
under any suit; the DS023 suit appearance remains the V1.16.1 appearance.

## Evidence

The final run passed **33 functional checks and 17 Chromium checks**, with
zero failures. **185 unaffected outfit frames were pixel-identical** to
V1.16.1; **168 DS023 render selections** exercised the changed route. All
**699 previous runtime images remain byte-identical**; only two separate
alpha-cleaned body images were added. A separate HTTP test delivered **746
static files** with exact bytes. Exact V1.16.1 rollback was tested.

The current functional, image-derivation and Chromium results are in
`evidence/ds023_v1_16_2/`. Counts and final pass/fail status are bound in
`RELEASE_STATUS.json`, not inferred from historical receipts. The final tests
include exact old-image hashes, identical RGB in both corrected bases, actual
transparent-gap and native-skin assertions, and a native-trouser waist-pixel
comparison. They also cover all 48 DS023 states in shirt-only mode and under
B03, controls under every blazer, all 24 physical trouser IDs, unchanged suit
and other-shirt frames, picker Apply/Cancel, error-frame retention, rapid
switch cancellation and isolated history identities.

The four comparison pairs in `DS023_BEFORE_AFTER_PHONE.png` are actual rendered
frames, each at 120-pixel whole-outfit width. They were visually inspected.
The full-frame PNGs are included. The unaffected regression matrix is not
presented as a visual-approval process.

One development test caught double compositing of semi-transparent trouser
edges when the pants were drawn twice. The shipped renderer instead draws
that trouser layer once in its correct order; pixels below the hands are now
identical to the old controls. An early test harness also used a legacy
component URL rather than its current hash-resolved path. That harness lookup
was corrected. Neither intermediate issue is represented as a final pass.

## Material limits

Browser checks load actual scripts and image bytes into in-memory Chromium;
test storage is an isolated synthetic map. The separate local HTTP test checks
static bytes only. No newly hosted loading, real localStorage, browser-process
restart, or physical iPhone/Safari acceptance is claimed. The owner's existing
GitHub candidate is not edited or deployed by creating these files.

This is a targeted DS023 correction, not a cleanup of every shirt. Small
inherited collar/cuff transitions and the simplified trouser waistband remain.
Shirt-only numerical ranking is still absent; existing score holds and the 32
unconnected non-suit IDs stay explicit. Watch ID/name remains sufficient.

## Package, update and rollback

Use the complete source tree, not `index.html` alone. The smaller update ZIP
contains `FILES_TO_COPY/`: copying its **contents** over the existing V1.16.1
candidate folder updates that same candidate without deleting its other files
or `.git` folder. Do not copy the enclosing `FILES_TO_COPY` folder itself.
Do not delete the repository or clear browser storage. Keep the original
V1.16.1 ZIP as an independent backup.

`CHANGED_FILES.json` gives the exact before/after file hashes.
`PACKAGE_SHA256.json` lists every payload other than itself. The current
read-only command is `python -B tools/verify_v1162.py`. Historical verifiers
remain available for their respective old releases.

`python -B tools/rollback_v1162.py --check` validates restoration bytes without
writing. `python -B tools/rollback_v1162.py --output NEW_FOLDER` reconstructs
exact V1.16.1 into a separate new folder; it refuses to overwrite the current
source tree or any existing destination. It never accesses browser data.
The source lock, localStorage key, history schema, and exact physical IDs
remain unchanged. Copying a source update at the same origin is not an
instruction to delete, migrate or rewrite wear history.
