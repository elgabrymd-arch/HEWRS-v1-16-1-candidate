"""Exact V2/V3 source contracts and declared geometry-only pixel comparison.

V3 intentionally changes the registered head/neck and hands, then remaps the
two sleeve bands. A V2 comparison may differ only within those source alpha
footprints and the exact pose destination bands. Garment descriptors are
compared separately; this mask never authorizes another garment source.
"""
import base64
import hashlib
import io
import json
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

SOURCE_LAYERS = {
    'v2': {
        'avatar': 'a4dd223fa59824df6b96af01e37d10b70a35e77fa7cb942d2356e3008e00aa3d',
        'left_hand': '8f7dcd492af271648ab6fdad83ca6cd401177aac05317d536cdb4b44149c4e34',
        'right_hand': '3cd3d8ec5d3e66dcf9cd1e525e952e87a1057f968e846f453f314de65669d3d9',
    },
    'v3': {
        'avatar': '4959b08a7ae11a28da972e92caa9c1d74c4bfe9f89fd2721a64938f6b2aaff93',
        'left_hand': '26af452854f6f89c86617d83e9848ae71922d2ff4701877e7903f59c55ebb2b8',
        'right_hand': 'cfca4394b3d208184fef4f267671af834432ac2f6bd89acea83242a9e118863b',
    },
}
POSE_REVISION = 'AVATAR_V3_ARM_POSE_CANDIDATE_1'
POSE_CONTROLS = [[0, 0], [600, 0], [720, -5], [950, -24], [1100, -17],
                 [1260, 3], [1420, 15], [1550, 12], [1660, 0], [2748, 0]]
# Half-open destination boxes taken from src/avatar-v3-pose.js. No central
# torso or leg pixels are exempted except exact source-avatar/hand alpha.
POSE_BOXES = ((80, 600, 250, 1660), (747, 600, 916, 1660))

AVATAR_PROFILE = r'''async () => {
 const app=HEWRSApp,c=app.connection,sources={},loaded={};
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 for(const name of ['avatar','left_hand','right_hand']){
  const d=c.manifest.static[name];sources[name]=d.sha256;
  const response=await fetch(app.resolveUrl(d));
  if(!response.ok)throw Error('Avatar source did not load: '+name);
  loaded[name]=await digest(await response.arrayBuffer());
 }
 return {version:c.avatarV3?'v3':'v2',sources,loaded_sources:loaded,
  avatar_sha256:sources.avatar,pose_revision:app.renderer.stats().avatarV3Pose||null,
  pose_controls:globalThis.HEWRSAvatarV3ArmPose?.controls||null,
  pose_parameters:globalThis.HEWRSAvatarV3ArmPose?.spec||null};
}'''

# Only the six explicitly pinned avatar descriptors are omitted. Every
# original garment, tie, shoe, mask and placement remains in the signature.
PLAN_SOURCES = r'''plan => {
 const ignored=new Set(''' + json.dumps([h for layers in SOURCE_LAYERS.values() for h in layers.values()]) + r'''),result=[];
 function visit(value,path='plan'){
  if(!value||typeof value!=='object')return;
  if(typeof value.sha256==='string'&&!ignored.has(value.sha256))
   result.push({path,sha256:value.sha256,rect:value.rect||null});
  for(const key of Object.keys(value).sort())if(value[key]&&typeof value[key]==='object')visit(value[key],path+'/'+key);
 }
 visit(plan);return result;
}'''


def validate_profile(value):
    """Fail unknown, partially substituted, or unbound source identities."""
    version = value.get('version')
    if version not in SOURCE_LAYERS:
        raise AssertionError('Unknown avatar profile: ' + str(version))
    expected = SOURCE_LAYERS[version]
    if value.get('sources') != expected or value.get('loaded_sources') != expected:
        raise AssertionError('Declared or fetched avatar/hand bytes differ from the exact ' + version + ' source pins')
    if value.get('avatar_sha256') != expected['avatar']:
        raise AssertionError('Avatar identity differs from selected source profile')
    if version == 'v3':
        parameters = value.get('pose_parameters') or {}
        if (value.get('pose_revision') != POSE_REVISION
                or value.get('pose_controls') != POSE_CONTROLS
                or parameters.get('head_unchanged_to_row') != 600
                or parameters.get('legs_unchanged_from_row') != 1660):
            raise AssertionError('V3 pose no longer matches the declared comparison envelope')
    elif value.get('pose_revision') is not None:
        raise AssertionError('V2 sources unexpectedly use a V3 pose transform')
    return value


@lru_cache(maxsize=2)
def permitted_mask(root):
    """Source-alpha union plus exact pose destination bands, with checksum."""
    root = Path(root)
    mask = Image.new('L', (996, 2748), 0)
    for layers in SOURCE_LAYERS.values():
        for sha in layers.values():
            raw = (root / 'assets' / (sha + '.png')).read_bytes()
            if hashlib.sha256(raw).hexdigest() != sha:
                raise AssertionError('Comparison mask source bytes differ: ' + sha)
            image = Image.open(io.BytesIO(raw)).convert('RGBA')
            if image.size != mask.size:
                raise AssertionError('Comparison mask source dimensions differ: ' + sha)
            mask = ImageChops.lighter(mask, image.getchannel('A').point(lambda a: 255 if a else 0))
    draw = ImageDraw.Draw(mask)
    for left, top, right, bottom in POSE_BOXES:
        draw.rectangle((left, top, right - 1, bottom - 1), fill=255)
    return mask


def comparison_policy(profile):
    if profile['version'] == 'v3':
        return {
            'name': 'explicit_v3_head_neck_hands_and_pose_envelope',
            'source_alpha_union': SOURCE_LAYERS,
            'pose_destination_boxes_xyxy_half_open': [list(box) for box in POSE_BOXES],
            'pose_revision': POSE_REVISION,
            'outside_mask_requirement': 'exact native RGBA equality; zero tolerance',
            'garment_requirement': 'exact source descriptor signature; avatar/hand pins checked separately',
        }
    return {'name': 'exact_original_pixels', 'outside_mask_requirement': 'complete native RGBA equality; zero tolerance'}


def native_difference(current_png, baseline_png, current_hash, baseline_hash,
                      profile, baseline_profile, root):
    """Compare every decoded native pixel; permit only the explicit V2->V3 mask."""
    pictures = [Image.open(io.BytesIO(base64.b64decode(value.split(',', 1)[1]))).convert('RGBA')
                for value in (current_png, baseline_png)]
    if any(image.size != (996, 2748) for image in pictures):
        raise AssertionError('Comparison is not a complete native frame')
    if [hashlib.sha256(image.tobytes()).hexdigest() for image in pictures] != [current_hash, baseline_hash]:
        raise AssertionError('Decoded comparison pixels differ from browser RGBA digests')
    channels = ImageChops.difference(*pictures).split()
    changed = channels[0]
    for channel in channels[1:]:
        changed = ImageChops.lighter(changed, channel)
    changed = changed.point(lambda value: 255 if value else 0)
    transition = profile['version'] == 'v3' and baseline_profile['version'] == 'v2'
    if transition:
        mask = permitted_mask(str(Path(root).resolve()))
        forbidden = ImageChops.subtract(changed, mask)
    else:
        mask = Image.new('L', (996, 2748), 0)
        forbidden = changed
    return {
        'policy': comparison_policy(profile) if transition else comparison_policy({'version': 'v2'}),
        'baseline_profile': baseline_profile['version'], 'current_profile': profile['version'],
        'native_dimensions': [996, 2748], 'changed_pixels': changed.histogram()[255],
        'changed_bbox_xyxy': changed.getbbox(), 'outside_permitted_mask_changed_pixels': forbidden.histogram()[255],
        'outside_permitted_mask_changed_bbox_xyxy': forbidden.getbbox(),
        'permitted_mask_sha256': hashlib.sha256(mask.tobytes()).hexdigest(),
        'permitted_mask_pixels': mask.histogram()[255],
    }
