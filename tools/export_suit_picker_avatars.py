#!/usr/bin/env python3
"""Export exact current suit previews; retain S02's confirmed cloth photograph."""
import argparse
import base64
import functools
import hashlib
import io
import json
import shutil
import subprocess
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

from export_b15_picker_avatar import ROOT, Quiet, digest, verify_source, verify_standard

SUIT_IDS = [f"S{i:02d}" for i in range(1, 19)]
AVATAR_SHA256 = "a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d"
S02_PATH = "ui/source-evidence/S02-owner-crop.png"
S02_SHA256 = "6b0b52b796c0c97b1445d45469e8b7945684d321a447e915947daf0fa90ee2be"
THUMBNAIL_WIDTH = 360
THUMBNAIL_HEIGHT = round(2748 * THUMBNAIL_WIDTH / 996)

STATE_JS = """() => {
  const storage = x => Object.fromEntries(Object.keys(x).sort().map(k => [k, x.getItem(k)]));
  return JSON.stringify({local: storage(localStorage), session: storage(sessionStorage),
    preferences: HEWRSApp.ui.snapshot(), wear: HEWRSApp.store.snapshot(),
    favorites: HEWRSApp.favorites.snapshot(), application: HEWRSApp.state()});
}"""

RENDER_JS = """async ({selection, width, height, avatarSha}) => {
  const app = HEWRSApp, connection = app.connection;
  const pair = connection.suitSources.resolveCanonical(selection.suitId);
  const canvas = document.createElement('canvas');
  const renderer = HEWRSAtomicRenderer.create(canvas, connection, {resolveUrl: app.resolveUrl});
  const thumbnail = document.createElement('canvas');
  const descriptor = d => ({...d, path: connection.assetPaths[d.sha256]});
  try {
    const plan = renderer.plan(selection);
    if (!Array.isArray(plan)) throw Error('Expected an ordered native suit source plan');
    const avatar = connection.manifest.static.avatar;
    const plannedAvatar = plan.find(d => d.sha256 === avatar.sha256);
    if (avatar.sha256 !== avatarSha || JSON.stringify(plannedAvatar) !== JSON.stringify(avatar))
      throw Error('Suit plan does not preserve the frozen avatar');
    const jacket = plan.find(d => d.sha256 === pair.jacket.sha256);
    const trousers = plan.find(d => d.sha256 === pair.trousers.sha256);
    if (!jacket || !trousers) throw Error('Suit plan does not use the exact approved garment pair');
    const sources = new Map();
    function collect(value) {
      if (!value || typeof value !== 'object') return;
      if (value.sha256 && value.rect) {
        const source = descriptor(value);
        if (!source.path) throw Error('Unbound native source');
        sources.set(source.sha256, source);
      }
      for (const child of Object.values(value)) collect(child);
    }
    collect(plan);
    const result = await renderer.render(selection);
    if (result.cancelled || result.status !== 'ready' ||
        JSON.stringify(result.selection) !== JSON.stringify(selection))
      throw Error('Native suit render did not preserve the exact selection');
    if (result.source_result?.source_compositor_template !== 'S05' ||
        result.source_result?.original_result?.review !== 'ACTIVE50_STAGING_EXISTING_COMPONENTS')
      throw Error('Unexpected native suit compositor route');
    if (canvas.width !== 996 || canvas.height !== 2748) throw Error('Native geometry changed');
    const rgba = canvas.getContext('2d').getImageData(0, 0, 996, 2748).data;
    const fullHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', rgba))]
      .map(x => x.toString(16).padStart(2, '0')).join('');
    thumbnail.width = width; thumbnail.height = height;
    const context = thumbnail.getContext('2d');
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(canvas, 0, 0, width, height);
    return {png: thumbnail.toDataURL('image/png'), provenance: {
      selection: result.selection, native_width: 996, native_height: 2748,
      native_rgba_sha256: fullHash, avatar: descriptor(avatar),
      jacket: descriptor(jacket), trousers: descriptor(trousers),
      sources: [...sources.values()], template: pair.template,
      source_compositor_template: result.source_result.source_compositor_template,
      review: result.source_result.original_result.review,
      recipe: 'Exact native renderer canvas; proportional high-quality canvas downsample only'
    }};
  } finally {
    renderer.cancel(); canvas.width = canvas.height = thumbnail.width = thumbnail.height = 1;
  }
}"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    image_dir = args.output / "suit-picker-images"
    image_dir.mkdir(parents=True, exist_ok=True)
    release = json.loads((ROOT / "STANDARD_RELEASE.json").read_text())
    baseline_hashes = verify_standard(release)
    assert digest(ROOT / S02_PATH) == S02_SHA256, "S02 confirmed owner photograph changed"
    with Image.open(ROOT / S02_PATH) as source:
        s02_dimensions = source.size
    errors, external, missing = [], [], []
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f"http://127.0.0.1:{server.server_address[1]}"
    items, provenance, verified_sources = {}, {}, set()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True, executable_path=shutil.which("chromium"), args=["--no-sandbox"]
            )
            context = browser.new_context(viewport={"width": 1280, "height": 900})

            def route(request):
                if request.request.url.startswith(origin + "/"):
                    request.continue_()
                else:
                    external.append(request.request.url)
                    request.abort()

            context.route("**/*", route)
            context.add_init_script("""(() => {
              globalThis.__SUIT_EXPORT_STORAGE_WRITES = [];
              for (const operation of ['setItem', 'removeItem', 'clear']) {
                const original = Storage.prototype[operation];
                Storage.prototype[operation] = function (...args) {
                  __SUIT_EXPORT_STORAGE_WRITES.push(operation);
                  return original.apply(this, args);
                };
              }
            })();""")
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("response", lambda response: missing.append(response.url) if response.status >= 400 else None)
            page.goto(origin + "/index.html", wait_until="domcontentloaded")
            page.wait_for_function("globalThis.HEWRS_READY === true && !!globalThis.HEWRSApp")
            before = page.evaluate(STATE_JS)
            write_start = page.evaluate("__SUIT_EXPORT_STORAGE_WRITES.length")
            facts = page.evaluate("""() => {
              const connection = HEWRSApp.connection;
              return {source_lock: HEWRS_INPUT_SHA256,
                correction: HEWRSSourceCorrections.record(),
                rows: connection.suitSources.ids.map(id => ({id,
                  history_id: connection.aliases.get(id),
                  label: connection.features.get(id).primary_text,
                  row: HEWRSApp.ui.rows.topwear.find(r => r.kind === 'suit' && r.sourceId === id)
                }))};
            }""")
            assert [row["id"] for row in facts["rows"]] == SUIT_IDS, "Suit source order changed"
            correction = facts["correction"]
            assert correction["item"] == "S02" and correction["source_image_path"] == S02_PATH
            assert correction["source_image_sha256"] == S02_SHA256
            for row in facts["rows"]:
                suit_id, label, history_id = row["id"], row["label"], row["history_id"]
                assert isinstance(label, str) and label.strip(), "Missing current suit color"
                assert row["row"]["id"] == history_id, "Picker and source identities differ"
                if suit_id == "S02":
                    assert label == correction["fields"]["primary_text"], "S02 current color correction lost"
                    items[suit_id] = {
                        "src": S02_PATH, "sha256": S02_SHA256,
                        "width": s02_dimensions[0], "height": s02_dimensions[1],
                        "label": label.strip(), "history_id": history_id,
                        "source_kind": "owner_reference_photo", "object_position": "50% 50%",
                        "source_note": "Original cloth photo",
                    }
                    provenance[suit_id] = {
                        "source_photo": {"path": S02_PATH, "sha256": S02_SHA256},
                        "appearance_status": "ORIGINAL_CLOTH_REFERENCE_RENDER_PENDING",
                        "current_source_revision": correction["revision"],
                        "owner_confirmation": correction["owner_confirmation"],
                        "visual_limit": correction["visual_limit"],
                    }
                    continue
                selection = {"suitId": suit_id, "shirtId": "DS001", "state": "NO_TIE",
                             "shoeId": "shoe-15", "watchId": None}
                result = page.evaluate(RENDER_JS, {"selection": selection,
                    "width": THUMBNAIL_WIDTH, "height": THUMBNAIL_HEIGHT, "avatarSha": AVATAR_SHA256})
                proof = result["provenance"]
                assert proof["selection"] == selection
                assert proof["avatar"]["sha256"] == AVATAR_SHA256
                for descriptor in proof["sources"]:
                    key = (descriptor["path"], descriptor["sha256"])
                    if key not in verified_sources:
                        verify_source(descriptor)
                        verified_sources.add(key)
                assert page.evaluate(STATE_JS) == before, "Suit export changed application or saved state"
                assert page.evaluate("__SUIT_EXPORT_STORAGE_WRITES.length") == write_start, "Suit export wrote storage"
                header, encoded = result["png"].split(",", 1)
                assert header == "data:image/png;base64"
                png = base64.b64decode(encoded, validate=True)
                with Image.open(io.BytesIO(png)) as thumbnail:
                    assert thumbnail.size == (THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
                    proof["thumbnail_rgba_sha256"] = hashlib.sha256(thumbnail.convert("RGBA").tobytes()).hexdigest()
                sha256 = hashlib.sha256(png).hexdigest()
                (image_dir / (sha256 + ".png")).write_bytes(png)
                items[suit_id] = {
                    "src": "ui/option-cards/" + sha256 + ".png", "sha256": sha256,
                    "width": THUMBNAIL_WIDTH, "height": THUMBNAIL_HEIGHT,
                    "label": label.strip(), "history_id": history_id,
                    "source_kind": "native_avatar_preview", "object_position": "50% 26%",
                }
                proof["saved_state_unchanged"] = True
                proof["storage_writes_during_render"] = 0
                provenance[suit_id] = proof
                print("Exported " + suit_id + " from unchanged native suit sources", flush=True)
            assert page.evaluate(STATE_JS) == before
            assert page.evaluate("__SUIT_EXPORT_STORAGE_WRITES.length") == write_start
            chromium_version = browser.version
            context.close()
            browser.close()
        assert not errors, "Browser errors: " + repr(errors)
        assert not external, "Unexpected external requests: " + repr(external)
        assert not missing, "Missing local resources: " + repr(missing)
        assert verify_standard(release) == baseline_hashes, "Standard changed during export"
        assert list(items) == SUIT_IDS and list(provenance) == SUIT_IDS
        manifest = {
            "schema": "hewrs.suit-picker-images.v1", "source_lock": facts["source_lock"],
            "runtime": {"path": release["runtime"], "sha256": release["runtime_sha256"]},
            "standard_hashes": baseline_hashes,
            "standard_unchanged": True, "saved_state_unchanged": True,
            "owner_browser_accessed": False, "storage_writes_during_render": 0,
            "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
            "chromium_version": chromium_version,
            "items": items, "provenance": provenance,
        }
        (args.output / "SUIT_PICKER_IMAGES.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(json.dumps({"manifest": "SUIT_PICKER_IMAGES.json", "native_previews": 17,
                          "existing_owner_photos": 1, "thumbnail_dimensions": [THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT],
                          "standard_unchanged": True, "saved_state_unchanged": True}))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
