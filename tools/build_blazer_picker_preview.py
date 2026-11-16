#!/usr/bin/env python3
"""Build only the opt-in Suit / Blazer picker; preserve accepted Standard bytes."""
from pathlib import Path
import base64
import hashlib
import json
import re
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
BASELINE = "40c9756656e3e50a183dc2da2ff81ff9df5d9bbc"
AVATAR_SHA256 = "a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d"
UNMODIFIED_SUIT_ITEMS_SHA256 = "ef387c6def364917b098de99d5bf59f8dd684d533a616b2831309493d452471c"
PHOTO_MATCH_IDS = {"S02", "S13"}
S13_APPROVED_SHA256 = "510ca7db687817fe34239f07bb18914022d81beeaffcb4c294b721409ed6836a"
S02_APPROVED_PATTERN_SHA256 = "f4695fb61944ee6dbad35e16c616bed4f7dbe3734ba46ff49a1e6ddb441a85c2"


def sha(path):
    resolved = (ROOT / path).resolve()
    resolved.relative_to(ROOT.resolve())
    return hashlib.sha256(resolved.read_bytes()).hexdigest()


def integrity(path):
    return "sha256-" + base64.b64encode(bytes.fromhex(sha(path))).decode()


def validate_photo_match(identifier, thumbnail, provenance):
    assert identifier in PHOTO_MATCH_IDS, "Photo-match scope must remain S02/S13"
    assert thumbnail["source_kind"] == "corrected_avatar_preview"
    assert (thumbnail["width"], thumbnail["height"]) == (996, 2748)
    assert thumbnail["history_id"] == "suit-" + str(int(identifier[1:]) - 1)
    if identifier == "S13":
        assert thumbnail["source_note"] == "Approved photo match"
        assert thumbnail["owner_approved"] is True and provenance["owner_approved"] is True
        assert provenance["appearance_status"] == "PHOTO_MATCH_OWNER_APPROVED"
        assert thumbnail["sha256"] == S13_APPROVED_SHA256, "Approved S13 pixels changed"
        approval = provenance["owner_approval"]
        assert approval["approved_image_sha256"] == S13_APPROVED_SHA256
        assert approval["scope"] == "suit_appearance" and approval["date"] == "2026-11-16"
    else:
        assert thumbnail["source_note"] == "Pattern approved · color review"
        assert thumbnail["owner_approved"] is False and provenance["owner_approved"] is False
        assert thumbnail["pattern_approved"] is True and provenance["pattern_approved"] is True
        assert provenance["appearance_status"] == "PHOTO_MATCH_COLOR_REVIEW_PENDING"
        pattern = provenance["pattern_reference"]
        assert pattern["sha256"] == S02_APPROVED_PATTERN_SHA256
        assert sha(pattern["path"]) == S02_APPROVED_PATTERN_SHA256, "Approved S02 pattern source changed"
        approval = provenance["pattern_approval"]
        assert approval["approved_image_sha256"] == S02_APPROVED_PATTERN_SHA256
        assert approval["scope"] == "pattern_only" and approval["date"] == "2026-11-16"
        assert provenance["color_choice"] == "previous_brown"
        assert provenance["color_reference"] == provenance["before"], "Wrong approved brown reference"
    assert provenance["selection"]["suitId"] == identifier
    assert (provenance["native_width"], provenance["native_height"]) == (996, 2748)
    assert provenance["preserve_non_garment_pixels"] is True
    # Original private photos and generated intermediates remain private. Their
    # hashes identify inputs; the build only reads the packaged native sources.
    for field in ("input_photo_sha256", "generated_image_sha256", "native_non_garment_rgba_sha256"):
        assert re.fullmatch(r"[a-f0-9]{64}", provenance[field]), "Missing input identity: " + field
    avatar = provenance["avatar"]
    assert avatar["sha256"] == AVATAR_SHA256
    assert sha(avatar["path"]) == AVATAR_SHA256, "Frozen avatar source changed"
    assert Image.open(ROOT / avatar["path"]).size == (996, 2748)
    assert provenance["sources"], "Candidate requires its native source inputs"
    assert any(d["path"] == avatar["path"] and d["sha256"] == AVATAR_SHA256
               for d in provenance["sources"]), "Frozen avatar missing from source inputs"
    for descriptor in provenance["sources"]:
        assert sha(descriptor["path"]) == descriptor["sha256"], "Photo-match native source changed"
    for name in ("before", "ownership_mask"):
        descriptor = provenance[name]
        assert sha(descriptor["path"]) == descriptor["sha256"], "Photo-match proof asset changed: " + name
        with Image.open(ROOT / descriptor["path"]) as image:
            assert image.size == (996, 2748), "Photo-match proof geometry changed: " + name
    assert sha(thumbnail["src"]) == thumbnail["sha256"], "Photo-match candidate bytes changed"
    with Image.open(ROOT / thumbnail["src"]) as image:
        assert image.size == (996, 2748), "Photo-match candidate geometry changed"
        candidate = image.convert("RGBA")
    with Image.open(ROOT / provenance["before"]["path"]) as image:
        before = image.convert("RGBA")
    with Image.open(ROOT / provenance["ownership_mask"]["path"]) as image:
        # Zero ownership means fully protected. Any nonzero ownership permits
        # garment RGB changes, while the entire alpha channel remains frozen.
        protected = image.convert("L").point(lambda value: 255 if value == 0 else 0)
    alpha_difference = ImageChops.difference(candidate.getchannel("A"), before.getchannel("A"))
    alpha_changed = sum(alpha_difference.histogram()[1:])
    assert alpha_changed == 0, "Photo-match candidate changed original alpha"
    zero = Image.new("RGBA", (996, 2748), (0, 0, 0, 0))
    protected_candidate = Image.composite(candidate, zero, protected)
    protected_before = Image.composite(before, zero, protected)
    channels = ImageChops.difference(protected_candidate, protected_before).split()
    changed = channels[0]
    for channel in channels[1:]:
        changed = ImageChops.lighter(changed, channel)
    non_garment_changed = sum(changed.histogram()[1:])
    assert non_garment_changed == 0, "Photo-match candidate changed protected non-garment pixels"
    protected_hash = hashlib.sha256(protected_candidate.tobytes()).hexdigest()
    before_hash = hashlib.sha256(protected_before.tobytes()).hexdigest()
    verification = provenance["verification"]
    assert protected_hash == provenance["native_non_garment_rgba_sha256"], "Candidate protected-pixel proof mismatch"
    assert before_hash == verification["native_non_garment_rgba_before_sha256"], "Original protected-pixel proof mismatch"
    assert protected_hash == before_hash
    assert verification["non_garment_pixels_changed"] == non_garment_changed == 0
    assert verification["alpha_pixels_changed"] == alpha_changed == 0
    assert hashlib.sha256(candidate.tobytes()).hexdigest() == provenance["native_rgba_sha256"], "Candidate native RGBA proof mismatch"


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
    suits = json.loads((ROOT / "data/suit-picker-images.json").read_text())
    assert suits["schema"] == "hewrs.suit-picker-images.v1"
    assert suits["source_lock"] == added["source_lock"]
    assert list(suits["items"]) == [f"S{i:02d}" for i in range(1, 19)]
    assert suits["runtime"] == {"path": release["runtime"], "sha256": release["runtime_sha256"]}
    assert suits["standard_unchanged"] and suits["saved_state_unchanged"]
    unmodified = {key: value for key, value in suits["items"].items() if key not in PHOTO_MATCH_IDS}
    encoded = json.dumps(unmodified, sort_keys=True, separators=(",", ":")).encode()
    assert hashlib.sha256(encoded).hexdigest() == UNMODIFIED_SUIT_ITEMS_SHA256, "Unrelated suit preview changed"
    correction = json.loads((ROOT / "data/owner-source-corrections.json").read_text())
    corrected_ids = set()
    for identifier, thumbnail in suits["items"].items():
        assert sha(thumbnail["src"]) == thumbnail["sha256"], "Wrong suit image: " + identifier
        assert Image.open(ROOT / thumbnail["src"]).size == (thumbnail["width"], thumbnail["height"])
        provenance = suits["provenance"][identifier]
        if thumbnail["source_kind"] == "corrected_avatar_preview":
            validate_photo_match(identifier, thumbnail, provenance)
            corrected_ids.add(identifier)
        elif identifier == "S02":
            assert thumbnail["src"] == correction["source_image_path"]
            assert thumbnail["sha256"] == correction["source_image_sha256"]
            assert thumbnail["source_kind"] == "owner_reference_photo"
            assert thumbnail["source_note"] == "Original cloth photo"
        else:
            assert thumbnail["source_kind"] == "native_avatar_preview"
            assert provenance["selection"]["suitId"] == identifier
            for descriptor in provenance["sources"]:
                assert sha(descriptor["path"]) == descriptor["sha256"], "Native suit source changed"
    assert not corrected_ids or corrected_ids == PHOTO_MATCH_IDS, "Both requested photo matches must be present"
    suit_manifest = {key: suits[key] for key in ("schema", "source_lock", "items")}
    (ROOT / "data/suit-picker-images.js").write_text(
        ("/* Corrected suits: S13 owner-approved; S02 approved pattern with color review pending. */\n"
         if corrected_ids else "/* Native suit references; S02 retains the confirmed owner cloth photograph. */\n")
        + "globalThis.HEWRS_SUIT_PICKER_IMAGES = " + json.dumps(suit_manifest, indent=2) + ";\n")
    html = (ROOT / "index.html").read_text()
    # The preview CDN redirects existing binary images to this exact repository.
    # Permit only that image source in the opt-in page; Standard CSP stays intact.
    html = html.replace("img-src 'self' data: blob:;",
                        "img-src 'self' data: blob: https://raw.githubusercontent.com/elgabrymd-arch/HEWRS-v1-16-1-candidate/;", 1)
    start = html.index("<title>")
    stop = html.index("</title>", start) + len("</title>")
    html = html[:start] + "<title>HEWRS · Suit / Blazer photo selector preview</title>" + html[stop:]
    css = "src/blazer-picker-preview.css"
    html = html.replace("</head>", '<meta name="robots" content="noindex,nofollow">\n'
                        + f'<link rel="stylesheet" href="{css}?v={sha(css)[:16]}" integrity="{integrity(css)}">\n</head>', 1)
    html = html.replace("Dress with intention", "Suit / Blazer photo selector · Test version", 1)
    tags = []
    for path in ("data/blazer-picker-images.js", "data/suit-picker-images.js", "src/blazer-picker-preview.js"):
        tags.append(f'<script defer src="{path}?v={sha(path)[:16]}" integrity="{integrity(path)}"></script>')
    tags.append('''<script>
window.addEventListener('DOMContentLoaded', function () {
  var query = new URLSearchParams(location.search);
  var show = query.get('show');
  var kind = show === 'blazers' ? 'blazer' : show === 'suits' ? 'suit' : null;
  if (!kind) return;
  if (!globalThis.HEWRS_READY || !globalThis.HEWRSApp) return;
  HEWRSApp.openPicker('topwear');
  var type = document.getElementById('picker-type');
  if (type) { type.value = kind; type.dispatchEvent(new Event('change', {bubbles:true})); }
  var item = query.get('item');
  var search = document.getElementById('picker-search');
  var images = kind === 'suit' ? HEWRS_SUIT_PICKER_IMAGES : HEWRS_BLAZER_PICKER_IMAGES;
  if (search && Object.hasOwn(images.items, item)) {
    search.value = item; search.dispatchEvent(new Event('input', {bubbles:true}));
  }
});
</script>''')
    html = html.replace("</body>", "\n".join(tags) + "\n</body>", 1)
    (ROOT / "blazer-picker-preview.html").write_text(html)
    print(json.dumps({"preview": "blazer-picker-preview.html", "blazers": len(items),
                      "suits": len(suits["items"]), "standard_unchanged": True}))


if __name__ == "__main__":
    build()
