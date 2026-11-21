#!/usr/bin/env python3
"""Build source-photo geometry for the isolated continuous-shirt candidate.

This tool writes coordinate meshes and their provenance, never edits a raster.
The browser projects source photographs using one connected mesh per garment.
"""
from pathlib import Path
import argparse
import copy
import hashlib
import json
import numpy as np
import scipy
from scipy.interpolate import RBFInterpolator
from scipy.spatial import Delaunay

ROOT = Path(__file__).resolve().parents[1]
COORDS = ROOT / 'provenance/continuous-shirt-sources/coordinates'
LOCK = '3e60ce18a0295c6801983ce91dda296efec458b275f523523dee1e3915db7516'
TARGET = {
    'neck_left': [386, 412], 'neck_right': [614, 412],
    'tip_left': [373, 540], 'tip_right': [623, 540],
    'v_bottom': [499, 615],
    'shoulder_left': [158, 515], 'shoulder_right': [838, 515],
    'armpit_left': [218, 810], 'armpit_right': [778, 810],
    'cuff_left_outer': [104, 1390], 'cuff_left_inner': [210, 1373],
    'cuff_right_inner': [781, 1370], 'cuff_right_outer': [876, 1390],
    'waist_left': [209, 1230], 'waist_center': [498, 1240],
    'waist_right': [787, 1230], 'placket_center': [498, 925],
}
TIED = {'tip_left': [407, 551], 'tip_right': [589, 551],
        'v_bottom': [499, 465], 'top_button': [499, 480]}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def descriptor(record):
    path = Path(record['path'])
    if not path.is_absolute():
        path = ROOT / path
    rel = str(path.relative_to(ROOT))
    sha = digest(path)
    if record.get('sha256') and record['sha256'] != sha:
        raise ValueError('Source hash differs: ' + str(path))
    return {'sha256': sha, 'url': rel,
            'rect': [0, 0, record['width'], record['height']],
            'role': 'CONTINUOUS_SHIRT_PHOTOGRAPH_SOURCE'}


def interpolate_outline(points, step=15):
    """Sample the recorded boundary without smoothing away a source edge."""
    out = []
    for a, b in zip(points, points[1:] + points[:1]):
        a, b = np.asarray(a, float), np.asarray(b, float)
        count = max(1, int(np.ceil(np.linalg.norm(b - a) / step)))
        out.extend((a + (b-a)*t/count).tolist() for t in range(count))
    return out


def serialized_area_statistics(vertices, triangles):
    """Measure the emitted mesh, independent of BLAS interpolation roundoff."""
    # Mesh coordinates are serialized to four decimal places. Integer
    # determinants bind these diagnostics to the actual delivered geometry,
    # not platform-dependent floating-point tails from RBF interpolation.
    scaled = [[int(round(value * 10000)) for value in point] for point in vertices]
    ratios = []
    for triangle in triangles:
        a, b, c = [scaled[int(index)] for index in triangle]
        source_area = (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])
        destination_area = (b[2]-a[2])*(c[3]-a[3])-(c[2]-a[2])*(b[3]-a[3])
        if source_area * destination_area <= 0:
            raise ValueError('Serialized mesh contains a folded or degenerate triangle')
        ratios.append(destination_area / source_area)
    return {
        'min_area_ratio': round(min(ratios), 9),
        'max_area_ratio': round(max(ratios), 9),
        'area_ratio_basis': 'serialized_four_decimal_mesh_integer_determinants',
    }


def make_mesh(row, mode, source, patch, target_changes):
    landmarks = row['landmarks']
    targets = copy.deepcopy(TARGET)
    targets.update(target_changes.get('both', {}))
    if mode == 'tied':
        targets.update(TIED)
    targets.update(target_changes.get(mode, {}))
    controls = [(landmarks[k], value) for k, value in targets.items() if k in landmarks]
    if len(controls) < 15:
        raise ValueError('Insufficient garment registration landmarks')
    src = np.asarray([p[0] for p in controls], float)
    dst = np.asarray([p[1] for p in controls], float)
    field = RBFInterpolator(src, dst, kernel='thin_plate_spline', smoothing=0)
    outline_points = copy.deepcopy(row['outline'])
    # Contact the immutable native neck at its lower side step. This moves
    # actual garment boundary pixels; it never expands into donor skin.
    if mode == 'no_tie':
        boundary = np.asarray(row['outline'], float)
        right_root = np.asarray(landmarks['neck_right'])
        left_root = np.asarray(landmarks['neck_left'])
        right_index = int(np.argmin(np.linalg.norm(boundary-right_root, axis=1)))
        left_index = int(np.argmin(np.linalg.norm(boundary-left_root, axis=1)))
        def arc(start,end):
            indices=[start]
            while indices[-1]!=end:
                indices.append((indices[-1]+1)%len(boundary))
            return indices
        arcs=[arc(right_index,left_index),arc(left_index,right_index)]
        neck_indices=min(arcs,key=lambda ix:np.linalg.norm(np.diff(boundary[ix],axis=0),axis=1).sum())
        neck = boundary[neck_indices]
        mapped = field(neck)
        additions, edge_insertions = [], {}
        for y,left_x,right_x in [(430,387,614),(450,393,590),(460,395,588),(475,398,585)]:
            for side, x in [('left', left_x), ('right', right_x)]:
                options = []
                for i in range(len(neck)-1):
                    a,b = mapped[i],mapped[i+1]
                    if (a[1]-y)*(b[1]-y) <= 0 and abs(a[1]-b[1]) > 1e-6:
                        t=(y-a[1])/(b[1]-a[1]); point=neck[i]+t*(neck[i+1]-neck[i]); current=a+t*(b-a)
                        if (side=='left' and current[0]<499) or (side=='right' and current[0]>499):
                            options.append((point,current,i,t))
                if options:
                    point,current,index,t=min(options,key=lambda p:abs(p[1][0]-x))
                    # Never open a neckline that already contacts native skin.
                    wanted=max(x,current[0]) if side=='left' else min(x,current[0])
                    additions.append((point,[wanted,y]))
                    edge_insertions.setdefault(neck_indices[index],[]).append((t,point.tolist()))
        if additions:
            src=np.vstack([src,[p[0] for p in additions]])
            dst=np.vstack([dst,[p[1] for p in additions]])
            field=RBFInterpolator(src,dst,kernel='thin_plate_spline',smoothing=0)
            outline_points=[]
            for i,p in enumerate(row['outline']):
                outline_points.append(p)
                outline_points.extend(point for _,point in sorted(edge_insertions.get(i,[])))
    outline = interpolate_outline(outline_points)
    leaves = [interpolate_outline(c, 9) for c in row['collar_leaves']]
    cuffs = [interpolate_outline(c, 15) for c in row.get('cuff_contours', [])]
    bounds = np.asarray(row['outline'], float)
    low = np.maximum(0, bounds.min(axis=0)-60)
    high = np.minimum(np.asarray(source['rect'][2:]), bounds.max(axis=0)+60)
    grid = [[x, y] for y in np.linspace(low[1], high[1], int((high[1]-low[1])/40)+2)
            for x in np.linspace(low[0], high[0], int((high[0]-low[0])/40)+2)]
    # A texture mesh is independent of an irregularly sampled silhouette.
    # Project every outline through this same piecewise-affine map, rather
    # than creating nearly collinear sliver triangles along source edges.
    vertices = np.unique(np.round(np.asarray(grid + src.tolist()), 5), axis=0)
    projected = field(vertices)
    triangulation = Delaunay(vertices)
    triangles = triangulation.simplices
    def project(points):
        points=np.asarray(points,float)
        simplex=triangulation.find_simplex(points)
        if np.any(simplex<0):
            raise ValueError('Source contour lies outside registered texture mesh')
        transform=triangulation.transform[simplex]
        bary=np.einsum('nij,nj->ni',transform[:,:2,:],points-transform[:,2,:])
        weights=np.column_stack([bary,1-bary.sum(axis=1)])
        return np.einsum('ni,nij->nj',weights,projected[triangles[simplex]])
    sa = vertices[triangles]
    da = projected[triangles]
    cross = lambda a, b: a[:, 0]*b[:, 1]-a[:, 1]*b[:, 0]
    signed_s = cross(sa[:, 1]-sa[:, 0], sa[:, 2]-sa[:, 0])
    signed_d = cross(da[:, 1]-da[:, 0], da[:, 2]-da[:, 0])
    flipped = np.where(signed_s*signed_d <= 0)[0]
    if len(flipped):
        samples=[{'source':sa[i].round(3).tolist(),'destination':da[i].round(3).tolist(),
                  'source_area':round(float(signed_s[i]),6),'destination_area':round(float(signed_d[i]),6)} for i in flipped[:3]]
        raise ValueError(f'{row.get("id")}/{mode}: {len(flipped)} folded mesh triangles: {samples}')
    combined = np.hstack([vertices, projected]).round(4).tolist()
    surface = {
        'type': 'mesh', 'source': source, 'vertices': combined,
        'triangles': triangles.tolist(),
        'contours': [project(outline).round(4).tolist()], 'fill_rule': 'evenodd',
    }
    if patch:
        surface['source_patches'] = patch
    front = dict(surface, contours=[project(c).round(4).tolist() for c in leaves])
    cuff_surfaces = [dict(surface, contours=[project(c).round(4).tolist()]) for c in cuffs]
    if not cuff_surfaces:
        cuff_surfaces = [dict(surface, clip_rect=[0, 1320, 996, 85])]
    registration = {k: {'source': landmarks[k], 'destination': targets[k]}
                    for k in targets if k in landmarks}
    return {'body': surface, 'rear': None,
            'front_collar': front if mode == 'tied' else None, 'cuffs': cuff_surfaces}, {
        'controls': registration, 'vertices': len(vertices), 'triangles': len(triangles),
        'folded_triangles': len(flipped), **serialized_area_statistics(combined, triangles),
    }


def make_jacket_rear(record, garment):
    """Project verified own-collar cloth into a selected coat's rear stand.

    This small photographic surface sits behind the immutable avatar and
    selected coat. It never changes the visible front leaves or body mesh.
    """
    body = garment['body']
    if record['source_sha256'] != body['source']['sha256']:
        raise ValueError('Rear stand does not belong to the selected shirt source')
    src = np.asarray(record['source_quad'], float)
    dst = np.asarray(record['destination_quad'], float)
    contour = np.asarray(record['destination_contour'], float)
    if src.shape != (4, 2) or dst.shape != (4, 2) or contour.ndim != 2 or contour.shape[1] != 2 or len(contour) < 3:
        raise ValueError('Invalid source-bound rear stand quadrilateral')
    if not np.isfinite(np.concatenate([src.ravel(), dst.ravel(), contour.ravel()])).all():
        raise ValueError('Nonfinite rear stand geometry')
    if np.any(src < 0) or np.any(src > body['source']['rect'][2:]):
        raise ValueError('Rear stand source quad exceeds its photograph')
    if np.any(contour < 0) or np.any(contour > [996, 2748]):
        raise ValueError('Rear stand contour exceeds native canvas')
    triangles = [[0, 1, 2], [0, 2, 3]]
    cross = lambda a, b: a[0]*b[1]-a[1]*b[0]
    for tri in triangles:
        a, b, c = src[tri]
        x, y, z = dst[tri]
        if cross(b-a, c-a) * cross(y-x, z-x) <= 1e-6:
            raise ValueError('Rear stand contains a folded or degenerate triangle')
    if np.any(Delaunay(dst).find_simplex(contour) < 0):
        raise ValueError('Rear stand contour exceeds its projected cloth quad')
    result = {'type': 'mesh', 'source': copy.deepcopy(body['source']),
              'vertices': np.hstack([src, dst]).round(4).tolist(),
              'triangles': triangles, 'contours': [contour.round(4).tolist()],
              'fill_rule': 'evenodd'}
    if body.get('source_patches'):
        result['source_patches'] = copy.deepcopy(body['source_patches'])
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--ids', default='DS001,DS014,DS017,DS023,DS034,DS035,DS036,DS051')
    p.add_argument('--coordinates', type=Path, default=COORDS)
    args = p.parse_args()
    derivative_index = json.loads((ROOT/'provenance/continuous-shirt-sources/generated/index.json').read_text())
    derivatives = {r['id']: r for r in derivative_index}
    closed_sources = json.loads((ROOT/'provenance/continuous-shirt-sources/generated/closed-index.json').read_text())
    rear_path = args.coordinates/'b03-rear-stands.json'
    rear_stands = json.loads(rear_path.read_text())
    if rear_stands.get('schema') != 'hewrs.b03-rear-stand.v1':
        raise ValueError('Missing measured B03 rear-stand source geometry')
    changes_path = args.coordinates/'target-adjustments.json'
    changes = json.loads(changes_path.read_text()) if changes_path.exists() else {}
    result = {'schema': 'hewrs.continuous-shirts.v1', 'revision': 'continuous-photo-mesh-v1',
              'source_input_sha256': LOCK, 'canvas': [996, 2748],
              'ids': args.ids.split(','), 'shirts': {}, 'assetPaths': {}, 'jacket_masks': {}}
    report = {'schema': 'hewrs.continuous-shirt-registration.v1',
              'build_dependencies': {'numpy': np.__version__, 'scipy': scipy.__version__},
              'shirts': {}}
    for sid in result['ids']:
        basis = {'DS014': 'DS001', 'DS034': 'DS051'}.get(sid, sid)
        row = json.loads((args.coordinates/(basis+'.json')).read_text())
        row['id'] = sid
        source = descriptor(derivatives['DS034'] if sid == 'DS034' else row['source'])
        result['assetPaths'][source['sha256']] = source['url']
        patch = []
        if sid == 'DS035':
            patch_source = descriptor(derivatives['DS035'])
            result['assetPaths'][patch_source['sha256']] = patch_source['url']
            # Scope the generated edit to the existing recorded label removal.
            patch = [{'source': patch_source, 'source_rect': [495, 718, 63, 147],
                      'destination_rect': [495, 718, 63, 147], 'boundary_blend': True}]
        output = {'id': sid, 'history_id': 'shirt-'+sid, 'source_reference': row.get('reference'), 'modes': {}}
        report['shirts'][sid] = {'source_sha256': source['sha256'], 'geometry_basis': basis,
                                'coordinate_sha256': digest(args.coordinates/(basis+'.json')), 'modes': {}}
        for mode in ('no_tie', 'tied'):
            mode_row, mode_patch = row, copy.deepcopy(patch)
            mode_coordinate_path = args.coordinates/(basis+'.json')
            if mode == 'tied':
                tied_basis = sid if (args.coordinates/(sid+'_tied.json')).exists() else basis
                tied_path=args.coordinates/(tied_basis+'_tied.json')
                if not tied_path.exists():
                    raise ValueError('Missing independently constructed closed collar: '+str(tied_path))
                mode_row=json.loads(tied_path.read_text()); mode_row['id']=sid
                mode_coordinate_path=tied_path
                closed_id='DS001' if sid=='DS014' else sid
                closure=descriptor(closed_sources[closed_id])
                result['assetPaths'][closure['sha256']]=closure['url']
                collar_points=np.asarray([p for c in row['collar_leaves']+mode_row['collar_leaves'] for p in c])
                lo=collar_points.min(0)-[30,20]
                hi=collar_points.max(0)+[30,30]
                hi[1]=max(hi[1],row['landmarks']['v_bottom'][1]+55)
                lo=np.floor(lo).astype(int); hi=np.ceil(hi).astype(int)
                rect=[int(lo[0]),int(lo[1]),int(hi[0]-lo[0]),int(hi[1]-lo[1])]
                scale=[closure['rect'][2]/source['rect'][2],closure['rect'][3]/source['rect'][3]]
                sample=[rect[0]*scale[0],rect[1]*scale[1],rect[2]*scale[0],rect[3]*scale[1]]
                mode_patch.append({'source':closure,'source_rect':sample,'destination_rect':rect,'feather':12})
            output['modes'][mode], report['shirts'][sid]['modes'][mode] = make_mesh(mode_row, mode, source, mode_patch, changes.get(sid, {}))
            report['shirts'][sid]['modes'][mode]['coordinate_sha256'] = digest(mode_coordinate_path)
        rear_id = 'DS001' if sid == 'DS014' else sid
        rear_record = rear_stands['shirts'][rear_id]
        output['jacket_rear'] = {'B03': {
            mode: make_jacket_rear(rear_record[mode], output['modes'][mode])
            for mode in ('no_tie', 'tied')}}
        report['shirts'][sid]['jacket_rear'] = {
            'topwear': 'B03', 'source_jacket_sha256': rear_stands['jacket_sha256'],
            'coordinate_sha256': digest(rear_path), 'geometry_record': rear_id,
            'role': 'Own photographic collar cloth behind immutable avatar and selected coat; front/body geometry unchanged.'}
        result['shirts'][sid] = output
    jacket_path = args.coordinates/'jacket-masks.json'
    if jacket_path.exists():
        result['jacket_masks'] = json.loads(jacket_path.read_text())
    if result['jacket_masks'].get('B03', {}).get('source_sha256') != rear_stands['jacket_sha256']:
        raise ValueError('Rear stand is not bound to the selected B03 source')
    encoded = json.dumps(result, separators=(',', ':'))
    (ROOT/'data/continuous-shirts.json').write_text(encoded+'\n')
    (ROOT/'data/continuous-shirts.js').write_text('/* Generated source geometry. Run tools/build_continuous_shirts.py. */\nglobalThis.HEWRS_CONTINUOUS_SHIRTS='+encoded+';\n')
    report_path = ROOT/'provenance/continuous-shirt-sources/registration.json'
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'shirts': result['ids'], 'data_bytes': len(encoded), 'registration': str(report_path)}))


if __name__ == '__main__':
    main()
