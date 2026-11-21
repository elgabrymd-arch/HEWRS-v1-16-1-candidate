# Continuous shirt correction candidate

This candidate replaces the defective shirt construction for **DS001, DS014,
DS017, DS023, DS034, DS035, DS036 and DS051** in the complete HEWRS app. It is
prepared against main commit `f114d7dbedab3430761a29d77328ae80ac0882e4`.
Owner approval of this candidate has not been granted. Rejected PR #15 is not
the basis of this implementation.

## Garment construction

Each corrected shirt uses one continuous photographic surface for its collar,
shoulders, placket, torso and sleeves. The renderer projects the original source
through a connected triangle mesh. Its exterior contour and collar leaves use
the same projection, so a separately fitted legacy collar cannot reappear over
the new body. The front collar is also intersected with the garment body before
it overlays the selected tie.

The No Tie state follows the open collar in the registered source. Tied states
use a separately constructed closed collar whose skin-facing boundary meets the
existing tie knot. Only the recorded upper-collar rectangle is taken from that
derivative; the original torso, sleeves and waist remain the source outside it.
The selected tie retains its existing asset and identity. All T001–T047
bindings remain available.

Jacket openings and cuff visibility are resolved from the selected assembly.
The cuff surface is bounded by the selected sleeve hem and original hand cap,
so upper-sleeve cloth cannot protrude beside the coat. B03 uses a narrow rear
stand sampled from each shirt's own verified collar cloth, behind the original
avatar and coat, to close its documented right-neck gap. B02's foreign gray
neckline strip is removed by a source-bound vector clip. These adjustments do
not rewrite the original jacket or hand images. The original hands render last.
Untargeted shirts continue through the existing
renderer. The complete app retains its existing selection, scoring, history,
Favorites, rejection, export and persistence behavior.

## Source authority and limits

`provenance/continuous-shirt-sources/SOURCE_IDENTITY.json` records the exact
source bundle, catalogue mapping and image hashes. The worn source images are
owner-approved catalogue replica visuals. They are not described as proven raw
camera photographs or calibrated color measurements.

DS001 and DS014 intentionally share a byte-identical catalogue photograph while
retaining separate shirt and brand identities. DS034 uses the previously
authorized DS051 shape basis with a black reconstruction. DS035's recorded
label removal is confined to its small source rectangle; harmonic boundary
matching removes the entire lettering interior while retaining the original
border and every pixel outside the rectangle. Original source files remain
unchanged.

Closed-collar reconstruction is derived visual evidence, not a claim that a new
physical garment photograph was recovered. Source-edge measurements carry the
small uncertainties documented in the coordinate files. The avatar and existing
jacket artwork also retain their original photographic and registration limits.
Native test success is separate from visual review and owner acceptance.

## Preserved identities and assets

The avatar remains **AVATAR_V2_MASTER**, native size **996 × 2748**, SHA-256
`a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d`.
The frozen input file, original assets and assemblies, source scoring records,
accepted Standard release and original main runtime are preserved. The existing
fifty-shirt active roster is retained, with DS049 still retired.

Sixteen picker/card descriptors are replaced by previews of the corresponding
new open and closed garments. The other thumbnail descriptors and all original
thumbnail files remain unchanged. Preview images have their own content hashes
and source, data and renderer provenance.

## Reproduction and verification

Geometry generation uses NumPy 2.3.5 and SciPy 1.17.0. The registration report
pins both open and closed coordinate files, source photographs, controls and
mesh orientation checks.

```sh
python tools/build_continuous_shirts.py
node --expose-gc tools/build_continuous_thumbnails.cjs --write
node --expose-gc tools/build_continuous_thumbnails.cjs --check
python tools/build_continuous_candidate.py --write
python tools/build_continuous_candidate.py
node --expose-gc tests/continuous-shirts.cjs
node --expose-gc tests/continuous-shirts-bundle.cjs
```

The thumbnail generator and native tests require `@napi-rs/canvas`. The candidate
workflow installs version 0.1.100 independently of application dependencies.
`CONTINUOUS_CANDIDATE.json` records the complete runtime, source-data and
entrypoint hashes. Both entrypoints pin their scripts and styles by content hash
and SRI.

The browser gate exercises the complete app in Chromium and WebKit, captures
native full outfits and 390-pixel phone views, checks every exact tie binding,
and runs the existing Favorites, rejection, persistence and cancellation audit.
All non-targeted shirt renders retain their baseline pixel comparison. The
eight intentional corrections are separately checked against their frozen
avatar and source contract, with full-outfit visual evidence.

## Integration boundary

The correction branch and the separate test deployment are review candidates.
They do not authorize a merge to main or replacement of the live GitHub Pages
app. The candidate's tested tree and exact commit must be reviewed before final
integration. Verification reports must distinguish source preservation,
functional test results, visual findings and owner approval.
