#!/usr/bin/env python3
"""Build isolated AI Five entrypoints from the verified primary V3 page.

Never writes index.html, app.html, an approved runtime, or browser records.
The fixture endpoint is intentionally unresolvable and only browser tests
intercept it. The default candidate remains disabled.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BINDING = ROOT / "data/ai-five-wardrobe-binding.json"
MODULES = ["src/ai-five-exclusion.js", "src/ai-five-native.js", "src/ai-five-flow.js",
           "data/ai-five-service-config.js", "src/ai-five-client.js", "src/ai-five-panel.js"]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def tag(path):
    sha = digest(ROOT / path)
    sri = base64.b64encode(bytes.fromhex(sha)).decode()
    return f'<script defer src="{path}?v={sha[:16]}" integrity="sha256-{sri}"></script>'

def build(fixture=False):
    release = json.loads((ROOT / "AVATAR_V3_RELEASE.json").read_text())
    binding = json.loads(BINDING.read_text())
    assert binding["runtime_sha256"] == release["runtime_sha256"] == digest(ROOT / release["runtime"])
    assert binding["entrypoints"] == release["entrypoints"]
    for path, sha in binding["entrypoints"].items():
        assert digest(ROOT / path) == sha, path
    for path, sha in binding["issue22_modules"].items():
        assert digest(ROOT / path) == sha, path
    for name in ("matching_index", "picker_previews"):
        row = binding[name]
        assert digest(ROOT / row["path"]) == row["sha256"], name
    html = (ROOT / "index.html").read_text()
    assert html == (ROOT / "app.html").read_text()
    assert html.count("</body>") == 1 and not any(path in html for path in MODULES)
    fingerprint = hashlib.sha256(json.dumps(binding, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    config = (ROOT / MODULES[3]).read_text()
    assert config.count("enabled:false") == 1 and fingerprint in config and binding["source_lock"] in config
    paths = MODULES[:]
    target = ROOT / "ai-five-preview.html"
    if fixture:
        paths[3] = "data/ai-five-fixture-config.js"
        (ROOT / paths[3]).write_text(config.replace("enabled:false", "enabled:true")
                                     .replace("https://hewrs-ai-service.onrender.com", "https://ai-five-contract-fixture.invalid"))
        html = html.replace("connect-src 'self' ", "connect-src 'self' https://ai-five-contract-fixture.invalid ", 1)
        target = ROOT / "ai-five-fixture.html"
    # Original defer scripts appear at the end of body, so append after all of them.
    html = html.replace("</body>", "\n".join(tag(path) for path in paths) + "\n</body>")
    target.write_text(html)
    print(json.dumps({"entrypoint": target.name, "sha256": digest(target),
                      "base_runtime": release["runtime_sha256"], "catalogue_fingerprint": fingerprint,
                      "fixture": fixture, "production_files_modified": False}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", action="store_true")
    build(parser.parse_args().fixture)
