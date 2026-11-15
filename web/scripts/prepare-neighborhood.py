"""Build the public, georeferenced neighborhood scene from saved source downloads.

Run from the repository root. Raw source responses remain in work/neighborhood.
Only selected map fields are published; no sponsor records or credentials are copied.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, maximum_filter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'web/public/neighborhood'
WORK = ROOT / 'work/neighborhood'
LAT, LON = 29.7955898, -95.7051799
R = 6378137
SCALE = math.cos(math.radians(LAT))
OX, OY = R * math.radians(LON), R * math.log(math.tan(math.pi / 4 + math.radians(LAT) / 2))


def project(lon, lat):
    return [round((R * math.radians(lon) - OX) * SCALE, 3),
            round((OY - R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))) * SCALE, 3)]


structures = json.loads((WORK / 'structures.json').read_text())['features']
buildings = []
for feature in structures:
    p = feature['properties']
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    for index, polygon in enumerate(polygons):
        rings = [[project(*v) for v in ring[:-1]] for ring in polygon]
        if len(rings[0]) < 3:
            continue
        kind = p.get('PRIM_OCC') or p.get('OCC_CLS') or 'Building'
        area = round(p.get('SQMETERS') or 0, 1)
        center = project(p['LONGITUDE'], p['LATITUDE'])
        volterra = p['BUILD_ID'] in [37416771, 37415187, 37415175]
        # Heights are absent in this source snapshot. Keep the estimate explicit.
        height = 9.3 if volterra else 10.5 if 'Multi' in kind and area > 400 else 3.2 if area < 190 else 5.8 if 'Single' in kind else 7.5
        buildings.append({'id': f"us-{p['BUILD_ID']}-{index}", 'rings': rings,
                          'center': center, 'area': area, 'height': height,
                          'heightBasis': 'CoStar: 3 stories; floor height estimated' if volterra else 'Estimated display height; source has no height',
                          'type': kind, 'address': p.get('PROP_ADDR'),
                          'name': 'Volterra at Westlake' if volterra else None,
                          'reference': 'zzvymDx5ty7' if p['BUILD_ID'] == 37416771 else None,
                          'sourceId': p['BUILD_ID'], 'source': 'ORNL / FEMA USA Structures',
                          'imageDate': p.get('IMAGE_DATE')})

# The saved TxDOT segment is independent of the aerial imagery provider.
# Two directions share this measured centerline; lane offsets are illustrative.
road_record = json.loads((ROOT / 'samples/sources.zzvymDx5ty7.json').read_text())['roads'][0]
roads, zones = [], []
for direction, vertices in [('northbound', road_record['geometry']),
                            ('southbound', list(reversed(road_record['geometry'])))]:
    roads.append({'id': f'txdot-365902-{direction}', 'points': [project(*v) for v in vertices],
                  'kind': 'secondary', 'name': 'Greenhouse Road', 'lanes': 2,
                  'lanesKnown': True, 'oneway': False, 'bridge': False,
                  'maxspeed': f"{road_record['speed_kmh']} km/h", 'source': 'TxDOT 2020 Roadway Inventory',
                  'geometryEvidence': road_record['geometry_source']})

imagery = []
for name in ['district', 'volterra', 'context']:
    meta = json.loads((OUT / f'{name}.json').read_text())
    xmin, ymin, xmax, ymax = meta['boundsMercator']
    meta['bounds'] = [round((xmin - OX) * SCALE, 3), round((OY - ymax) * SCALE, 3),
                      round((xmax - OX) * SCALE, 3), round((OY - ymin) * SCALE, 3)]
    imagery.append(meta)

# Canopy candidates are derived from the actual aerial pixels, never placed on a
# fabricated street plan. This color classifier is not a species/height survey.
base = imagery[0]
rgb = np.asarray(Image.open(OUT / 'district.jpg')).astype(float)
r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
score = np.maximum(0, g - .62*r - .38*b - 8) * ((g < 115) & (g > 23))
score = gaussian_filter(score, 1.3)
mask = Image.new('L', (base['width'], base['height']))
draw = ImageDraw.Draw(mask)
xmin, zmin, xmax, zmax = base['bounds']
def pixel(v):
    return ((v[0]-xmin)/(xmax-xmin)*base['width'], (v[1]-zmin)/(zmax-zmin)*base['height'])
for building in buildings:
    draw.polygon([pixel(v) for v in building['rings'][0]], fill=255)
for road in roads:
    draw.line([pixel(v) for v in road['points']], fill=255, width=14 if road['kind'] == 'motorway' else 8)
score[np.array(mask)>0] = 0
peaks = (score == maximum_filter(score, size=17)) & (score > 8)
ys, xs = np.where(peaks)
ranked = sorted(zip(xs.tolist(), ys.tolist()), key=lambda v: -score[v[1], v[0]])
# Spatial stratification prevents dense distant woodland from displacing every
# street tree around the apartments. Keep at most two local peaks per image cell.
cells = {}
distributed = []
for x, y in ranked:
    cell = (x // 64, y // 64)
    if cells.get(cell, 0) < 2:
        distributed.append((x, y))
        cells[cell] = cells.get(cell, 0) + 1
ranked = distributed[:1800]
trees = [{'id': f'canopy-{x}-{y}', 'position': [round(xmin+x/base['width']*(xmax-xmin), 2), round(zmin+y/base['height']*(zmax-zmin), 2)],
          'height': 7 + ((x*17+y*11)%40)/10, 'evidence': 'Aerial color classification; position approximate, species and height unverified'} for x,y in ranked]

result = {'schemaVersion': 1, 'name': 'Greenhouse Road · Houston', 'retrieved': '2026-11-14',
          'origin': {'lat': LAT, 'lon': LON, 'mercatorX': OX, 'mercatorY': OY, 'scale': SCALE},
          'coordinateSystem': 'local-meters-y-up', 'buildings': buildings, 'roads': roads,
          'zones': zones, 'trees': trees, 'imagery': imagery,
          'sources': [{'name':'USA Structures', 'url':'https://gis-fema.hub.arcgis.com/datasets/fedmaps::usa-structures/about', 'license':'ORNL / FEMA; public map data'},
                      {'name':'TxDOT 2020 Roadway Inventory', 'url':'https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_2020_Roadway_Inventory_/FeatureServer/0', 'license':'Texas Department of Transportation public inventory; archived segment 365902'},
                      {'name':'World Imagery', 'url':base['service'], 'license':base['attribution']},
                      {'name':'Poly Haven', 'url':'https://polyhaven.com/license', 'license':'CC0'}],
          'acoustics': {'status':'not-connected', 'sourceSpectra':None, 'predictions':None},
          'limitations': ['Building footprints are mapped, not field surveyed.', 'Display heights, roof profiles and facade details are approximations.', 'Canopy markers are image-derived candidates, not a tree inventory.', 'Moving vehicles illustrate road trajectories, not observed traffic counts.', 'Construction activity and bedroom counts are not inferred from building shapes.']}
(OUT / 'scene.json').write_text(json.dumps(result, separators=(',', ':')))
print(f"Wrote {len(buildings)} real footprints, {len(roads)} roads, {len(trees)} canopy candidates, {len(zones)} mapped construction areas.")
