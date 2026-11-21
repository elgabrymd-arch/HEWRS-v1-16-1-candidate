#!/usr/bin/env python3
"""Generate a reversible, source-locked AVATAR_V3 candidate from immutable V2.

No model-generated face. No original garment, avatar, or saved-state mutations.
The result is an isolated source candidate, NOT installed as a wardrobe renderer.
"""
from pathlib import Path
import argparse
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
W, H = 996, 2748
HEAD_END = 800
CENTER_X = 498
HEAD_TOP_WIDTH_SCALE = 0.920
UPPER_VERTICAL_OFFSET = 36.0
WRIST_ROTATION_DEGREES = {"left_hand": 4.0, "right_hand": -4.0}
V2 = {
    "avatar": "a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d",
    "left_hand": "8f7dcd492af271648ab6fdad83ca6cd401177aac05317d536cdb4b44149c4e34",
    "right_hand": "3cd3d8ec5d3e66dcf9cd1e525e952e87a1057f968e846f453f314de65669d3d9",
}
EVIDENCE = ROOT / "evidence" / "avatar_v3"
MANIFEST = ROOT / "data" / "avatar-v3-candidate.json"

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def original(name):
    p = ROOT / "assets" / (V2[name] + ".png")
    assert sha(p) == V2[name], f"Changed immutable V2 source: {name}"
    im = Image.open(p).convert("RGBA")
    assert im.size == (W, H), f"Invalid original dimensions: {name}"
    return im

def reduce_head_neck(im):
    """Warp only V2's head/neck alpha island (rows < 800).

    X width fades continuously to original alignment at the garment neck.
    Y shift reduces head height while staying fixed at the neck endpoint.
    Bilinear sampling in premultiplied-alpha RGB avoids dark halo fragments.
    Body/hands below the neck are copied byte-exactly at the pixel level.
    """
    pixels = np.asarray(im, dtype=np.uint8)
    out = np.array(pixels, copy=True)
    source_y = np.arange(HEAD_END + 1, dtype=np.float64)
    forward_y = source_y + UPPER_VERTICAL_OFFSET * np.maximum(
        0.0, 1.0 - source_y / HEAD_END
    ) ** 2
    xx = np.arange(W, dtype=np.float64)
    for dy in range(HEAD_END):
        sy = np.interp(dy, forward_y, source_y)
        sy = max(0., min(float(HEAD_END - 1), sy))
        fade = max(0., 1.0 - sy / HEAD_END)
        # At the crown the head shrinks 8%; neck width approaches normal at cuffless endpoint.
        x_scale = 1.0 - (1.0 - HEAD_TOP_WIDTH_SCALE) * fade ** 1.2
        source_x = CENTER_X + (xx - CENTER_X) / x_scale
        x0 = np.floor(source_x).astype(np.int32)
        x1 = x0 + 1
        valid = (source_x >= 0) & (source_x < W - 1)
        x0 = np.clip(x0, 0, W - 1)
        x1 = np.clip(x1, 0, W - 1)
        y0, y1 = int(sy), min(HEAD_END, int(sy) + 1)
        wx = (source_x - np.floor(source_x)).astype(np.float32)
        wy = np.float32(sy - y0)
        a00 = pixels[y0,x0].astype(np.float32)
        a01 = pixels[y0,x1].astype(np.float32)
        a10 = pixels[y1,x0].astype(np.float32)
        a11 = pixels[y1,x1].astype(np.float32)
        w00 = ((1-wx)*(1-wy))[:,None]
        w01 = (wx*(1-wy))[:,None]
        w10 = ((1-wx)*wy)[:,None]
        w11 = (wx*wy)[:,None]
        samples = [(a00,w00), (a01,w01), (a10,w10), (a11,w11)]
        alpha = sum(px[:,3:4]*weight for px,weight in samples)
        premult = sum(px[:,:3]*px[:,3:4]/255.0*weight for px,weight in samples)
        rgb = np.divide(premult * 255.0, np.maximum(alpha,1e-6))
        row = np.hstack([rgb, alpha])
        row = np.uint8(np.rint(np.clip(row,0,255)))
        row[~valid] = 0
        out[dy] = row
    assert np.array_equal(out[HEAD_END:], pixels[HEAD_END:]), "Unexpected change to hands/body"
    return Image.fromarray(out, "RGBA")

def wrist_pivot(im):
    bbox = im.getchannel("A").getbbox()
    assert bbox and 0 <= bbox[0] < bbox[2] <= W, "Missing hand alpha"
    band = im.getchannel("A").crop((bbox[0],bbox[1],bbox[2],min(bbox[1]+18,bbox[3])))
    x = np.asarray(band, dtype=np.uint8)
    yy, xx = np.nonzero(x > 50)
    if len(xx) == 0:
        return ((bbox[0]+bbox[2])/2,bbox[1])
    # Preserve hand sleeve connection; rotation is about the proximal cuff, not the palm.
    return (float(bbox[0])+float(xx.mean()), float(bbox[1])+float(yy.mean()))

def relax_wrist(im, name):
    pivot = wrist_pivot(im)
    result = im.rotate(
        WRIST_ROTATION_DEGREES[name],
        resample=Image.Resampling.BICUBIC, center=pivot,
        expand=False, fillcolor=(0,0,0,0)
    )
    return result, pivot

def contact_sheet(before, after):
    size = (416, 1008)
    pair = Image.new("RGB", (size[0]*2,size[1]), "#e6e7e9")
    draw = ImageDraw.Draw(pair)
    for i, label in enumerate(("V2 — locked original", "V3 — isolated geometric proposal")):
        composite = Image.new("RGBA",(W,H),"#e6e7e9")
        for part in ("avatar","left_hand","right_hand"):
            composite.alpha_composite((before if i==0 else after)[part])
        thumb = composite.convert("RGB").resize((362,1000),Image.Resampling.LANCZOS)
        pair.paste(thumb, (i*size[0]+27,8))
        draw.text((i*size[0]+35,8),label,fill="#151515",stroke_width=1,stroke_fill="#ffffff")
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    pair.save(EVIDENCE/"avatar-v2-v3-geometry-compare.png")

def main(write=False):
    source = {name:original(name) for name in V2}
    candidate = {"avatar":reduce_head_neck(source["avatar"])}
    pivots={}
    for name in ("left_hand","right_hand"):
        candidate[name], pivot = relax_wrist(source[name],name)
        pivots[name]=[round(float(v),2) for v in pivot]
    for name, im in candidate.items():
        assert im.size==(W,H), "V3 image dimension changed"
        assert im.getchannel("A").getbbox(), "Blank V3 layer"
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    contact_sheet(source,candidate)
    filenames={}
    for name,img in candidate.items():
        p = EVIDENCE / (name + "-v3.png")
        img.save(p,format="PNG",optimize=True)
        filenames[name]={
            "sha256":sha(p),
            "review_artifact":str(p.relative_to(ROOT)),
            "url":("assets/"+sha(p)+".png") if write else None,
            "rect":[0,0,W,H],
            "original_sha256":V2[name],
        }
        if write:
            dest=ROOT / filenames[name]["url"]
            dest.write_bytes(p.read_bytes())
    manifest={
        "schema":"hewrs.avatar-v3-candidate.v1",
        "stage":"source_candidate_only",
        "enabled_in_production":False,
        "source_profile":"AVATAR_V2_MASTER",
        "variant_profile":"AVATAR_V3_PROPOSED",
        "width_height":[W,H],
        "geometry":{
            "head_top_width_scale":HEAD_TOP_WIDTH_SCALE,
            "neck_blend_end_row":HEAD_END,
            "head_top_vertical_shift_pixels":UPPER_VERTICAL_OFFSET,
            "wrist_rotation_degrees":WRIST_ROTATION_DEGREES,
            "wrist_pivots":pivots,
            "sleeve_refit_required":True,
            "shirt_collar_refit_required":True,
        },
        "source_layer_hashes":V2,
        "candidate_layers":filenames,
        "policy":"Do not merge into the app before full shirt, blazer, suit and state regression."
    }
    (EVIDENCE/"geometry.json").write_text(json.dumps(manifest,indent=2)+"\n")
    if write:
        MANIFEST.write_text(json.dumps(manifest,indent=2)+"\n")
    old=np.asarray(source["avatar"])
    new=np.asarray(candidate["avatar"])
    assert np.array_equal(old[HEAD_END:],new[HEAD_END:]), "Non-head V2 pixels changed"
    # Facial width is reduced without redistributing wardrobe or touch to original files.
    def envelope_width(arr,y):
        xs=np.flatnonzero(arr[y,:,3]>16)
        return 0 if not xs.size else int(xs[-1]-xs[0]+1)
    for y in (180,260,340):
        assert envelope_width(new,y) < envelope_width(old,y), f"Face not reduced at {y}"
    for k in V2: assert sha(ROOT/"assets"/(V2[k]+".png"))==V2[k], "Original modified"
    print("AVATAR_V3_CANDIDATE_RESULT="+json.dumps({
        "source_sha256":V2["avatar"],
        "new_hashes":{n:files["sha256"] for n,files in filenames.items()},
        "face_widths":{str(y):[envelope_width(old,y),envelope_width(new,y)] for y in (180,260,340)},
        "wrist_pivots":pivots,
        "status":"candidate_geometry_only","production_changed":False
    }))
    return manifest

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--write",action="store_true",help="Emit hashed candidate PNGs into assets (never overwrite V2)")
    main(**vars(parser.parse_args()))
