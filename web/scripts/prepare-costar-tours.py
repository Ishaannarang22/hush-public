"""Build a small, private tour catalog for the existing map crop from the CoStar kit."""
import argparse
import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--kit', type=Path, required=True)
parser.add_argument('--output', type=Path, default=ROOT / 'work/neighborhood/costar-tours.json')
args = parser.parse_args()
scene = json.loads((ROOT / 'web/public/neighborhood/scene.json').read_text())
origin = scene['origin']
bounds = [-970, -160, 450, 1480]
rows = list(csv.DictReader((args.kit / 'commercial-properties.csv').open()))
by_property = {}
for row in rows:
    if row['MatterportModelId']:
        by_property.setdefault(int(row['PropertyId']), {})[row['MatterportModelId']] = row

def attachments(value, result):
    if isinstance(value, dict):
        if value.get('videoExternalReferenceType') in (36, 234) and value.get('videoKey'):
            result[value['videoKey']] = value.get('caption') or result.get(value['videoKey'])
        for child in value.values():
            attachments(child, result)
    elif isinstance(value, list):
        for child in value:
            attachments(child, result)

properties = []
for line in (args.kit / 'data/commercial-property.jsonl').open():
    record = json.loads(line)
    address = record.get('primaryAddress') or {}
    lat, lon = address.get('latitude'), address.get('longitude')
    models = by_property.get(record['id'], {})
    if lat is None or lon is None or not models:
        continue
    x = (6378137 * math.radians(lon) - origin['mercatorX']) * origin['scale']
    z = (origin['mercatorY'] - 6378137 * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))) * origin['scale']
    if not (bounds[0] <= x <= bounds[2] and bounds[1] <= z <= bounds[3]):
        continue
    captions = {}
    attachments(record, captions)
    first = next(iter(models.values()))
    properties.append({'id': record['id'], 'name': record.get('buildingName') or first['Address'],
        'address': first['Address'], 'city': first['City'], 'state': first['State'],
        'location': {'lat': lat, 'lon': lon}, 'locationSource': 'CoStar property address',
        'tours': [{'id': model_id, 'name': captions.get(model_id) or f'Tour {i + 1}',
                   'url': f'https://my.matterport.com/show/?m={model_id}'} for i, model_id in enumerate(models)]})
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps({'source': 'CoStar sponsor export', 'studyBounds': bounds,
    'properties': properties}, indent=2))
print(f'Prepared {len(properties)} properties and {sum(len(p["tours"]) for p in properties)} tours.')
