# HEWRS V1.23.1 — shoe-15 correction

## Delivered change

This is an implemented local app update over the verified V1.23.0 source, not a
new wardrobe and not a live deployment. It changes only shoe-15's active appearance
and thumbnail routing. The current brown color family was not the fundamental
problem: the old prepared image had flat, posterized light/dark patches.

The latest owner reference (1 October 2026, 01:45:56 UTC) is preserved byte-for-byte.
The new option-card thumbnail is a crop/resampling of that photograph, not of the
old avatar layer. The active avatar layer uses RGB samples from the photograph
registered into the exact existing shoe-15 alpha. No blanket brightness, hue,
saturation, contrast or palette filter is applied. Fine material variation and
the black sole come from the supplied image.

The second shoe is mirrored from the sampled source. The frontal projection is
an approximation, not a recovered true-front photograph. The source was not color
calibrated. Earlier wording such as "too dark" or "cognac" did not establish a
measured target and was not used to impose a guessed recolor. The neutral current
label is "Loro Piana Loafers — Warm Brown Suede Penny"; the brand is retained from
the catalogue, not inferred anew from an unlabelled image.

## Preserved

Shoe-15 keeps the same ID, 996 × 2748 canvas, position, size and pixel-for-pixel
alpha/outline. The original image remains available at its original hash/path.
All 848 original asset/assembly files are unchanged. No other shoe is replaced,
activated or renumbered. Source scores, style code, weather, original palette,
clothing, avatar, history, Favorites and saved-feedback code are unchanged.
No browser data was written in the successful correction tests.

## Newly executed checks

* The pristine baseline verifier passed before editing: 2,607 payloads; three
  startup scripts; deferred index; generated bundle matches its source.
* Nine source/runtime checks passed. These cover all 18 suit descriptor routes,
  exact shoe universe, source/thumbnail hashes, other catalogue records, unchanged
  original scores for two controlled selections, history IDs and baseline guards.
* Forty browser assertions passed using the actual rebuilt bundle, real raster
  images and isolated memory storage. Eight baseline-versus-corrected native
  frames were compared: S05 tied/open, S11/DS035 open, B01 tied, B02 open,
  B03/DS007 tied, shirt-only/DS007 open, and an unchanged shoe-8 control.
* No tested pixel outside the original shoe-15 alpha changed. Face, hands,
  clothing and native canvas geometry matched. The shoe-8 control was entirely
  pixel-identical. All seven shoe-15 cases displayed changed shoe pixels.
* Actual picker selection, decoded photograph thumbnail, original shoe ID and
  a real 1400 × 1900 PNG card export were checked.

Counts are different kinds of checks, not independent aesthetic evaluations.
The images are review output, not an assertion of a new owner appearance approval.

## Limits and incomplete attempts

A full four-style baseline/correction generator regression was attempted in
parallel. One process was killed and the command timed out. It did not yield a
complete corrected-style parity result and is NOT counted as a passed test.
Partial baseline AUTO and CLASSIC runs each returned 20. The prior conversation's
four-style results remain historical evidence, not a newly completed matrix.

A normal HTTPS browser navigation was blocked by the execution environment before
loading the app. Successful browser tests therefore injected the unchanged actual
startup payloads and image bytes into offline Chromium. They are not physical
Safari tests, production-cache tests, network SRI execution tests or a live-site
verification. Bundle/SRI correspondence is checked separately from file bytes.

The initial phone layout is unchanged. The item-picture phone capture deliberately
scrolls to the existing panel. This update does not fix the separate hidden-card
layout, rejected-outfit recurrence, missing sixteen shoe bindings, other shoe
colors, or the owner's reported zero-result condition.

## Reversible installation

Use the delivered update ZIP with an exact V1.23.0 app folder, not the whole private
handoff folder. Its README and apply_update.py provide a hash-checked dry run,
installation and rollback. The installer checks every original payload before
writing; it never accesses a browser profile or public repository.

The update has NOT been pushed to GitHub, Netlify or any other service. A downloaded
patch does not by itself change the live app. Existing private source/handoff
material is not included as new public seed data.

## Evidence paths

`evidence/shoe15_v1_23_1/SOURCE_TESTS.json`
`evidence/shoe15_v1_23_1/IMAGE_INVARIANTS.json`
`evidence/shoe15_v1_23_1/browser/RESULT.json`
`evidence/shoe15_v1_23_1/INCOMPLETE_ATTEMPTS.json`
`data/shoe-photo-corrections.json`
