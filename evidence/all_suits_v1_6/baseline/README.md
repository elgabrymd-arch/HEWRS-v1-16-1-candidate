# HEWRS Connected Application V1.5

DS035 image-right shirt/lapel extraction-edge cleanup, applied only on the
14 already connected S11-template suit routes. Other selection coverage is
unchanged from V1.4. No clothing, avatar or measurement approval is reopened.

## Run

From this directory, run `python -m http.server 8000`, then open
`http://localhost:8000/app.html`. `app.html` is the candidate entry point; this
package does not create or replace a production `index.html`.

`python tools/build.py --standalone /path/to/HEWRS_CONNECTED_APP_V1_5.html`
builds an offline copy with the same code and embedded original images.

## This change

`data/ds035-edge.json` records the donor sources, exact masks and method.
The new fields copy colours only from DS035's existing body layers. They remove
the opaque grey/black extraction strip that the previous transparent-pixel
underfill could not repair. The patch is a new integration derivative, not a
recovered or previously approved original. Original image files are unchanged.

The cleanup covers the image-right shirt/lapel strip only. It includes the
non-fabric outer fringe stored in the right-collar cutout (778 source-mask
positions in tied mode; 85 in no-tie mode). The actual light collar fabric
and its inner contour are excluded. The patch does not resize or reposition
any layer, retouch tie motifs, or paint the face/neck. The tie's complete alpha
support is protected, including partly transparent tie-edge pixels. Actual
jacket edges retain their original RGB, shape and alpha: their partly
transparent pixels blend with the cleaned underlying fabric; fully opaque
jacket pixels cannot change. Opacity changes are restricted to residual transparent dots inside the same edge mask.

`src/ds035-edge-renderer.js` wraps, but does not modify, the V1.4 coverage
renderer and original Active50 renderer. It runs only on the offscreen frame
before the existing atomic display commit. It fails closed for mismatched
suit, shirt, state, bounds and original DS035 body hashes. Original S05-template
routes do not run the correction. Input/score/source-lock and saved-data code
remain byte-identical to V1.4.

## Reproduce and verify

```
python tools/build_ds035_edge.py --check
python tools/verify.py
for test in tests/*.cjs; do node "$test" || exit 1; done
python tests/edge-browser.py
```

The browser harness uses exact packaged code and PNG bytes in memory. It
compares each changed route against the unchanged V1.4 coverage compositor.
It does not establish physical-iPhone, Safari, hosted delivery, or persistent
browser-restart behaviour. Other browser harnesses are inherited V1.3/V1.4
history and retain those historical test scopes; `tests/edge-browser.py` is
the V1.5 browser entry point.

## Files

- `evidence/edge_v1_5/RESULT.json`: final implementation and preservation result.
- `evidence/edge_v1_5/BROWSER.json`: actual browser execution and full-frame comparisons.
- `evidence/edge_v1_5/ROUTING.json`: negative/positive correction routing checks.
- `evidence/edge_v1_5/*BEFORE_AFTER.png`: native-coordinate actual-render comparisons.
- `evidence/edge_v1_5/PARENT_README.md`: retained V1.4 documentation.

The existing four fully connected suit paths and DS035-only wider-suit paths,
blazer/shirt-only and watch-rendering boundaries are unchanged. No GitHub
write, deployment, history migration, or live application change is included.
