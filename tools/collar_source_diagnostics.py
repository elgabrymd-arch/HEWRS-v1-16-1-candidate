#!/usr/bin/env python3
"""Isolated collar-artwork review. Does not modify garment sources, app, or avatar."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "evidence" / "collar_candidate"
FOCUS = ("DS001", "DS014", "DS017", "DS023", "DS034", "DS035", "DS036", "DS051")
MODES = ("no_tie", "tied")
BOUNDS = (320, 350, 680, 590)
REG = json.loads((ROOT / "data/non-suit-sources.json").read_text())
BATCH = json.loads((ROOT / "data/batch10.json").read_text())
SHIRT_ONLY = json.loads((ROOT / "data/shirt-only.json").read_text())

def load(desc):
    key = desc["sha256"]
    path = ROOT / "assets" / (key + ".png")
    if not path.is_file():
        raise AssertionError("Missing original registered layer: " + str(path))
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != key:
        raise AssertionError("Source image SHA mismatch: " + str(path))
    with Image.open(path) as source:
        if source.size != (996, 2748):
            raise AssertionError("Wrong native canvas size: " + str(path))
        return source.convert("RGBA")

avatar = load(SHIRT_ONLY["avatar"])
tie = load(BATCH["ties"]["T001"])
OUT.mkdir(parents=True, exist_ok=True)
rows = []
tiles = []

def support_metrics(components):
    metrics = {}
    for key in ("rear", "body", "left", "right"):
        with Image.open(ROOT / "assets" / (components[key]["sha256"] + ".png")) as im:
            a = im.getchannel("A")
            metrics[key] = list(a.getbbox()) if a.getbbox() else None
    return metrics

for shirt_id in FOCUS:
    row = {"id": shirt_id, "modes": {}}
    shirt = REG["shirts"][shirt_id]
    for mode in MODES:
        c = shirt["components"][mode]
        canvas = Image.new("RGBA", (996, 2748), (0, 0, 0, 0))
        # Same garment-layer order as the source renderer. The neutral grid
        # and cropping are diagnostic only; this is not an app-frame assertion.
        for part in (load(c["rear"]), avatar, load(c["body"])):
            canvas.alpha_composite(part)
        if mode == "tied":
            canvas.alpha_composite(tie)
        for part in (load(c["left"]), load(c["right"])):
            canvas.alpha_composite(part)
        crop = canvas.crop(BOUNDS).convert("RGB")
        d = ImageDraw.Draw(crop, "RGB")
        # Coordinate grid: 20 native pixels, central seam x = 500.
        for x in range((BOUNDS[0] + 19) // 20 * 20, BOUNDS[2], 20):
            u = x - BOUNDS[0]
            d.line([(u, 0), (u, crop.height)], fill=(77, 77, 77), width=1)
        for y in range((BOUNDS[1] + 19) // 20 * 20, BOUNDS[3], 20):
            v = y - BOUNDS[1]
            d.line([(0, v), (crop.width, v)], fill=(77, 77, 77), width=1)
        tile = Image.new("RGB", (380, 279), (245, 245, 245))
        tile.paste(crop, (10, 28))
        dd = ImageDraw.Draw(tile)
        dd.text((10, 7), f"{shirt_id}  {mode.upper()}  [DIAGNOSTIC, NOT APPROVED]", fill=(25, 25, 25))
        tiles.append(tile)
        row["modes"][mode] = {
            "component_sha256": {k: c[k]["sha256"] for k in ("rear", "body", "left", "right")},
            "component_alpha_bounds_xyxy": support_metrics(c),
            "crop_bbox_xyxy": list(BOUNDS),
            "review": "REQUIRES_PHOTOGRAPHIC_REPAIR_AND_OWNER_VISUAL_CHECK",
        }
    rows.append(row)

sheet = Image.new("RGB", (380 * 4, 279 * 4), (220, 220, 220))
for n, tile in enumerate(tiles):
    sheet.paste(tile, ((n % 4) * 380, (n // 4) * 279))
name = OUT / "PRIORITY_COLLARS_BASELINE.png"
sheet.save(name, optimize=True)
report = {
    "schema": "hewrs.collar-source-diagnostic.v1",
    "baseline_commit": "f114d7dbedab3430761a29d77328ae80ac0882e4",
    "status": "OPEN_UNCORRECTED",
    "scope": "eight priority shirt identities, two states each",
    "render_type": "registered layers plus existing S05 visible-body avatar; local diagnostic, not exact suit/blazer compositing",
    "source_images_modified": False,
    "app_files_modified": False,
    "collar_preview_sha256": hashlib.sha256(name.read_bytes()).hexdigest(),
    "priority_defects": {
      "DS001, DS014": "tied non-suit: flat neckband/skin opening",
      "DS017, DS034, DS035, DS036, DS051": "open collar: hard or missing collar-placket fabric join",
      "DS023": "open collar: cutout jaggies"
    },
    "items": rows
}
(OUT / "REPORT.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"status": report["status"], "cases": len(tiles),
                  "sheet": str(name.relative_to(ROOT)),
                  "sha256": report["collar_preview_sha256"]}))
