#!/usr/bin/env python3
"""Export corrected B15 through the accepted native renderer, without Apply."""
import argparse
import base64
import functools
import hashlib
import io
import json
import shutil
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SELECTION = {
    "blazerId": "B15", "pantId": "PB001", "shirtId": "DS001",
    "state": "NO_TIE", "shoeId": "shoe-15", "watchId": None,
}
SOURCE_ASSEMBLY = "APPROVED_B15_GARMENT_ONLY_REGISTERED_LAYER"
JACKET_SHA256 = "e34e249bf344b0130e1f0b805285444758801a80a7c07b1c787687de7e36569a"
OWNERSHIP_SHA256 = "9a04fc204573cd59bf8c647698ba14b542c200d32d041218c86e2ea14074d860"


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_standard(release):
    actual = {}
    for name in release["standard_entrypoints"]:
        actual[name] = digest(ROOT / name)
        assert actual[name] == release["entrypoint_sha256"], "Standard HTML changed: " + name
    name = release["runtime"]
    actual[name] = digest(ROOT / name)
    assert actual[name] == release["runtime_sha256"], "Accepted Standard runtime changed"
    return actual


def verify_source(descriptor):
    path = (ROOT / descriptor["path"]).resolve()
    path.relative_to(ROOT.resolve())
    assert digest(path) == descriptor["sha256"], "Native source bytes differ: " + descriptor["path"]
    with Image.open(path) as source:
        assert source.size == (996, 2748), "Native source dimensions differ: " + descriptor["path"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    release = json.loads((ROOT / "STANDARD_RELEASE.json").read_text())
    baseline_hashes = verify_standard(release)
    errors, external, missing = [], [], []
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f"http://127.0.0.1:{server.server_address[1]}"
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
              globalThis.__B15_EXPORT_STORAGE_WRITES = [];
              for (const operation of ['setItem', 'removeItem', 'clear']) {
                const original = Storage.prototype[operation];
                Storage.prototype[operation] = function (...args) {
                  __B15_EXPORT_STORAGE_WRITES.push({operation,
                    area: this === localStorage ? 'local' : 'session'});
                  return original.apply(this, args);
                };
              }
            })();""")
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("response", lambda response: missing.append(response.url) if response.status >= 400 else None)
            page.goto(origin + "/index.html", wait_until="domcontentloaded")
            page.wait_for_function("globalThis.HEWRS_READY === true && !!globalThis.HEWRSApp")
            result = page.evaluate("""async (selection) => {
              const app = HEWRSApp;
              const sortedStorage = store => Object.fromEntries(Object.keys(store).sort()
                .map(key => [key, store.getItem(key)]));
              const state = () => JSON.stringify({
                local: sortedStorage(localStorage), session: sortedStorage(sessionStorage),
                preferences: app.ui.snapshot(), wear: app.store.snapshot(),
                favorites: app.favorites.snapshot(), application: app.state()
              });
              const before = state();
              const writeStart = __B15_EXPORT_STORAGE_WRITES.length;
              const canvas = document.createElement('canvas');
              const renderer = HEWRSAtomicRenderer.create(canvas, app.connection,
                {resolveUrl: app.resolveUrl});
              try {
                const plan = renderer.plan(selection);
                if (JSON.stringify(plan.avatar) !== JSON.stringify(app.connection.manifest.static.avatar))
                  throw Error('Renderer does not use the frozen avatar descriptor');
                const native = await renderer.render(selection);
                if (native.cancelled || native.status !== 'ready') throw Error('Native B15 render failed');
                if (JSON.stringify(native.selection) !== JSON.stringify(selection))
                  throw Error('Native B15 selection changed');
                const source = descriptor => ({...descriptor,
                  path: app.connection.assetPaths[descriptor.sha256]});
                const sourceList = [plan.avatar, plan.shoes, plan.pants, plan.shirt,
                  plan.ownership, plan.jacket, ...plan.cuffs, ...plan.hands].map(source);
                const png = canvas.toDataURL('image/png');
                const writes = __B15_EXPORT_STORAGE_WRITES.slice(writeStart);
                if (writes.length || state() !== before)
                  throw Error('Detached rendering changed saved state');
                return {
                  png, width: canvas.width, height: canvas.height,
                  selection: native.selection,
                  source_assembly: native.source_result?.source_assembly,
                  implementation_scope: native.source_result?.implementation_scope,
                  appearance_authorization: native.source_result?.appearance_authorization,
                  source_lock: HEWRS_INPUT_SHA256,
                  avatar: source(plan.avatar), jacket: source(plan.jacket),
                  ownership_mask: source(plan.ownership), sources: sourceList,
                  saved_state_unchanged: true, storage_writes_during_render: 0
                };
              } finally {
                renderer.cancel();
                canvas.width = canvas.height = 1;
              }
            }""", SELECTION)
            chromium_version = browser.version
            context.close()
            browser.close()
        assert not errors, "Browser errors: " + repr(errors)
        assert not external, "Unexpected external requests: " + repr(external)
        assert not missing, "Missing local resources: " + repr(missing)
        assert result["selection"] == SELECTION, "Exact B15 recipe changed"
        assert (result["width"], result["height"]) == (996, 2748), "Native canvas dimensions changed"
        assert result["source_assembly"] == SOURCE_ASSEMBLY, "Unapproved B15 render route"
        assert result["implementation_scope"] == "OWNER_APPROVED_BLAZER_ONLY_NO_DONOR_AVATAR_OR_OTHER_GARMENTS"
        assert result["jacket"]["sha256"] == JACKET_SHA256, "Wrong B15 jacket layer"
        assert result["ownership_mask"]["sha256"] == OWNERSHIP_SHA256, "Wrong B15 visibility mask"
        for descriptor in result["sources"]:
            verify_source(descriptor)
        assert verify_standard(release) == baseline_hashes, "Standard changed during export"
        header, encoded = result.pop("png").split(",", 1)
        assert header == "data:image/png;base64", "Native canvas did not export PNG"
        png = base64.b64decode(encoded, validate=True)
        with Image.open(io.BytesIO(png)) as decoded:
            assert decoded.size == (996, 2748), "PNG dimensions differ from native canvas"
            pixel_sha256 = hashlib.sha256(decoded.convert("RGBA").tobytes()).hexdigest()
        source_commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip()
        metadata = {
            "schema": "hewrs.blazer-picker-native-avatar.v1",
            **result,
            "sha256": hashlib.sha256(png).hexdigest(),
            "pixel_sha256": pixel_sha256,
            "runtime": {"path": release["runtime"], "sha256": release["runtime_sha256"]},
            "standard_hashes": baseline_hashes,
            "standard_unchanged": True,
            "source_commit": source_commit,
            "chromium_version": chromium_version,
            "recipe": "Exact 996x2748 detached HEWRSAtomicRenderer canvas; PNG export; no resize, crop, recolor or generated donor avatar",
            "owner_browser_accessed": False,
        }
        (args.output / "B15_NATIVE_AVATAR.png").write_bytes(png)
        (args.output / "B15_NATIVE_AVATAR.json").write_text(json.dumps(metadata, indent=2) + "\n")
        print(json.dumps({"image": "B15_NATIVE_AVATAR.png", "provenance": "B15_NATIVE_AVATAR.json",
                          "sha256": metadata["sha256"], "dimensions": [996, 2748],
                          "source_assembly": metadata["source_assembly"],
                          "saved_state_unchanged": True, "standard_unchanged": True}))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
