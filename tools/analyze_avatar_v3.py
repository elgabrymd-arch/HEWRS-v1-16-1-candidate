#!/usr/bin/env python3
"""Read-only survey of the frozen avatar sources for an isolated V3 proposal.

Never modifies the V2 source, saved user state, or production build.
"""
from pathlib import Path
from collections import defaultdict
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
AVATAR_SHA = "a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d"
FILE = ROOT / "assets" / (AVATAR_SHA + ".png")
OUT = ROOT / "evidence" / "avatar_v3" / "source-survey.json"
VIEW = OUT.with_name("v2-original-baseline.png")

def survey():
    assert hashlib.sha256(FILE.read_bytes()).hexdigest() == AVATAR_SHA, "Frozen V2 avatar changed"
    original = Image.open(FILE).convert("RGBA")
    assert original.size == (996, 2748), "Unexpected V2 raster size"
    w, h = original.size
    a = original.getchannel("A")
    rows = {}
    for y in sorted(set(list(range(0, 1101, 25)) + [1300, 1400, 1600, 2000, 2747])):
        band = a.crop((0, y, w, y + 1))
        bbox = band.getbbox()
        rows[str(y)] = None if not bbox else {
            "left": bbox[0], "right_exclusive": bbox[2],
            "alpha_coverage": sum(v > 16 for v in band.getdata())
        }
    skin_by_row = {}
    pix = original.load()
    for y in range(0, 851, 25):
        loc = []
        for x in range(w):
            r, g, b, alpha = pix[x, y]
            if alpha > 160 and r > 85 and r > g * 1.1 and g > b * 0.93 and r - b > 28:
                loc.append(x)
        skin_by_row[str(y)] = {
            "count": len(loc),
            "left": min(loc) if loc else None,
            "right": max(loc) if loc else None
        }
    doc = json.loads((ROOT / "data/inputs.json").read_text())
    descriptors = []
    def walk(obj, path="", depth=0):
        if depth > 18 or len(descriptors) > 300: return
        if isinstance(obj, dict):
            if isinstance(obj.get("sha256"), str) and (obj.get("rect") or obj.get("url")):
                if any(t in path.lower() for t in ("avatar", "hand", "arm", "static")):
                    descriptors.append({
                        "path": path, "sha256": obj["sha256"],
                        "url": obj.get("url"), "rect": obj.get("rect")
                    })
            for k, v in obj.items():
                if isinstance(v, (dict,list)):
                    walk(v, path + "/" + str(k), depth + 1)
        elif isinstance(obj, list):
            for i, v in enumerate(obj[:150]):
                if isinstance(v, (dict,list)): walk(v, path + "/" + str(i), depth + 1)
    walk(doc)
    hand_sources = {
        "left": "8f7dcd492af271648ab6fdad83ca6cd401177aac05317d536cdb4b44149c4e34",
        "right": "3cd3d8ec5d3e66dcf9cd1e525e952e87a1057f968e846f453f314de65669d3d9"
    }
    hands = {}
    for hand, sha in hand_sources.items():
        target = ROOT / "assets" / (sha + ".png")
        assert hashlib.sha256(target.read_bytes()).hexdigest() == sha, "Registered hand changed"
        im = Image.open(target).convert("RGBA")
        assert im.size == (996, 2748), "Unexpected hand dimensions"
        alpha = im.getchannel("A")
        bound = alpha.getbbox()
        rows_h = {}
        for y in range(max(0, bound[1]-30), min(h, bound[3]+30), 30):
            b = alpha.crop((0,y,w,y+1)).getbbox()
            rows_h[str(y)] = None if not b else [b[0], b[2]]
        hands[hand] = {"sha256":sha,"alpha_bbox":bound,"rows":rows_h}
        original_thumb = Image.new("RGBA", original.size, "#eeeeee")
    original_thumb.alpha_composite(original)
    original_thumb.convert("RGB").resize((332, 916)).save(VIEW)
    report = {
        "schema": "hewrs.avatar_v3.source_survey.v1",
        "source": str(FILE.relative_to(ROOT)),
        "frozen_sha256": AVATAR_SHA,
        "dimensions": [w,h],
        "alpha_bbox": a.getbbox(),\n        "hand_sources": hands,
        "alpha_rows": rows,
        "skin_rows": skin_by_row,
        "input_root_keys": list(doc.keys()),
        "relevant_registered_descriptors": descriptors[:200],
        "review_status": "unmodified_baseline_only",
        "production_modified": False
    }
    OUT.write_text(json.dumps(report, indent=2) + "\n")
    print("AVATAR_V3_SOURCE_SURVEY=" + json.dumps({
        "hash": AVATAR_SHA, "bbox": report["alpha_bbox"],
        "input_keys": report["input_root_keys"],
        "alpha_rows": {k:v for k,v in rows.items() if int(k)%100==0},
        "skin_rows": {k:v for k,v in skin_by_row.items() if int(k)%100==0},
        "descriptors": descriptors[:25], "hands": hands
    }))
    return report

if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    survey()
