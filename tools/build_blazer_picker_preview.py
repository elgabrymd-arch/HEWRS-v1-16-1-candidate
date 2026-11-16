#!/usr/bin/env python3
"""Build only the opt-in Blazer picker preview; preserve accepted Standard bytes."""
from pathlib import Path
import base64
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASELINE = "40c9756656e3e50a183dc2da2ff81ff9df5d9bbc"


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def integrity(path):
    return "sha256-" + base64.b64encode(bytes.fromhex(sha(path))).decode()


def build():
    release = json.loads((ROOT / "STANDARD_RELEASE.json").read_text())
    for path in release["standard_entrypoints"]:
        assert sha(path) == release["entrypoint_sha256"], "Standard entrypoint changed: " + path
    assert sha(release["runtime"]) == release["runtime_sha256"], "Standard runtime changed"
    source = json.loads((ROOT / "data/blazer-connection.json").read_text())
    added = json.loads((ROOT / "data/additional-blazers.json").read_text())
    labels = {
        "B01": "Medium navy", "B02": "Midnight navy", "B03": "Slate blue",
        "B04": "Dark navy", "B05": "Chocolate brown", "B06": "Pale sage",
        "B07": "Warm grey", "B08": "Cream / ivory", "B09": "Charcoal",
        "B10": "Camel / taupe", "B11": "Espresso brown", "B12": "Chestnut brown",
        "B13": "Plum / burgundy", "B14": "Black", "B15": "Stone / warm greige",
    }
    items = {}
    for identifier, record in source["blazers"].items():
        if identifier in ("B01", "B02"):
            path = f"vendor/b01_b02_v1_12/{identifier}_OWNER_APPROVED_VISUAL_REFERENCE.png"
        elif identifier == "B03":
            path = record["checkpoint_control"]["url"]
        else:
            path = f"evidence/blazers_v1_9/source/{identifier}_PHONE.jpg"
        expected = record["latest_reference"]["sha256"]
        assert sha(path) == expected, "Wrong approved reference: " + identifier
        width, height = Image.open(ROOT / path).size
        items[identifier] = {
            "src": path, "sha256": expected, "width": width, "height": height,
            "label": labels[identifier], "source_kind": "owner_approved_reference",
            "object_position": "50% 26%", "history_id": record["historyId"],
        }
    for record in added["records"]:
        binding = record["binding"]
        identifier = binding["id"]
        assert identifier not in items
        assert identifier == "B15", "Review the native avatar source for the new blazer"
        thumbnail = json.loads((ROOT / "data/blazer-picker-b15-avatar.json").read_text())
        assert thumbnail["schema"] == "hewrs.blazer-picker-native-avatar.v1"
        assert thumbnail["selection"]["blazerId"] == identifier
        assert thumbnail["source_lock"] == added["source_lock"]
        assert thumbnail["source_assembly"] == "APPROVED_B15_GARMENT_ONLY_REGISTERED_LAYER"
        assert thumbnail["runtime"] == {"path": release["runtime"], "sha256": release["runtime_sha256"]}
        assert thumbnail["jacket"]["sha256"] == binding["assembly"]["jacket"]["sha256"]
        assert thumbnail["ownership_mask"]["sha256"] == binding["assembly"]["ownership"]["sha256"]
        assert thumbnail["standard_unchanged"] and thumbnail["saved_state_unchanged"]
        for descriptor in thumbnail["sources"]:
            assert sha(descriptor["path"]) == descriptor["sha256"], "Native avatar source changed"
        assert sha(thumbnail["src"]) == thumbnail["sha256"], "Wrong native B15 preview"
        width, height = Image.open(ROOT / thumbnail["src"]).size
        assert (width, height) == (thumbnail["width"], thumbnail["height"]) == (996, 2748)
        items[identifier] = {
            "src": thumbnail["src"], "sha256": thumbnail["sha256"],
            "width": width, "height": height, "label": labels[identifier],
            "source_kind": "native_avatar_preview", "object_position": "50% 26%",
            "history_id": binding["historyId"],
        }
    assert list(items) == [f"B{i:02d}" for i in range(1, 16)], "Blazer coverage changed; review bindings"
    manifest = {"schema": "hewrs.blazer-picker-images.v1", "source_lock": added["source_lock"],
                "baseline_commit": BASELINE, "items": items}
    js = "/* Existing approved references and native avatar render; presentation only. */\n"
    js += "globalThis.HEWRS_BLAZER_PICKER_IMAGES = " + json.dumps(manifest, indent=2) + ";\n"
    (ROOT / "data/blazer-picker-images.js").write_text(js)
    html = (ROOT / "index.html").read_text()
    # The preview CDN redirects existing binary images to this exact repository.
    # Permit only that image source in the opt-in page; Standard CSP stays intact.
    html = html.replace("img-src 'self' data: blob:;",
                        "img-src 'self' data: blob: https://raw.githubusercontent.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/;", 1)
    start = html.index("<title>")
    stop = html.index("</title>", start) + len("</title>")
    html = html[:start] + "<title>HEWRS · Blazer photo selector preview</title>" + html[stop:]
    css = "src/blazer-picker-preview.css"
    html = html.replace("</head>", '<meta name="robots" content="noindex,nofollow">\n'
                        + f'<link rel="stylesheet" href="{css}?v={sha(css)[:16]}" integrity="{integrity(css)}">\n</head>', 1)
    html = html.replace("Dress with intention", "Blazer photo selector · Test version", 1)
    tags = []
    for path in ("data/blazer-picker-images.js", "src/blazer-picker-preview.js"):
        tags.append(f'<script defer src="{path}?v={sha(path)[:16]}" integrity="{integrity(path)}"></script>')
    tags.append('''<script>
window.addEventListener('DOMContentLoaded', function () {
  var query = new URLSearchParams(location.search);
  if (query.get('show') !== 'blazers') return;
  if (!globalThis.HEWRS_READY || !globalThis.HEWRSApp) return;
  HEWRSApp.openPicker('topwear');
  var type = document.getElementById('picker-type');
  if (type) { type.value = 'blazer'; type.dispatchEvent(new Event('change', {bubbles:true})); }
  var item = query.get('item');
  var search = document.getElementById('picker-search');
  if (search && Object.hasOwn(HEWRS_BLAZER_PICKER_IMAGES.items, item)) {
    search.value = item; search.dispatchEvent(new Event('input', {bubbles:true}));
  }
});
</script>''')
    html = html.replace("</body>", "\n".join(tags) + "\n</body>", 1)
    (ROOT / "blazer-picker-preview.html").write_text(html)
    print(json.dumps({"preview": "blazer-picker-preview.html", "blazers": len(items),
                      "approved_references": 14, "native_avatar_previews": 1, "standard_unchanged": True}))


if __name__ == "__main__":
    build()
