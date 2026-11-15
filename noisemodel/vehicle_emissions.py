"""Vehicle pass-by spectra for the neighborhood's moving point sources.

Reuse the road model's REMEL and band normalization. Do not assign a whole
road's hourly Leq to every car: each rendered vehicle contributes exactly once.
"""
import json
import math
from pathlib import Path
from .assumptions import Assumptions
from .outdoor import remel, road_hourly_volumes, block_hours, VEHICLE_CLASSES
from .export_lab import spectrum_for, SHAPE_NOTE


def build():
    a = Assumptions.load()
    distance = a.value('road.reference_distance')
    # Point-source normalization preserves the model's pass-by level at D0.
    # This is an instantaneous illustration, not the road's hourly Leq model.
    spectra = {kind: [spectrum_for(remel(kind, speed, a) + 20 * math.log10(distance))
                      for speed in range(1, 141)] for kind in VEHICLE_CLASSES}
    path = Path(__file__).resolve().parents[1] / 'samples/sources.zzvymDx5ty7.json'
    road = json.loads(path.read_text())['roads'][0]
    hourly = road_hourly_volumes(road, a)
    flows = {block: {kind: sum(hourly[h][kind] for h in hours) / len(hours)
                     for kind in VEHICLE_CLASSES}
             for block, hours in block_hours(a).items()}
    return {
        'schemaVersion': 1, 'model': 'FHWA TNM REMEL · existing Hush noise model',
        'referenceDistanceM': distance, 'speedMinKmh': 1, 'speedMaxKmh': 140,
        'spectra': spectra, 'spectrumNote': SHAPE_NOTE,
        'methodNote': 'Individual pass-by point sources; no hourly road Leq is added. Vehicle positions and counts are scenarios, not tracked cars. Near-road point-source accuracy is unvalidated.',
        'archivedRoad': {key: road[key] for key in ['id', 'name', 'aadt', 'aadt_year', 'speed_kmh', 'source', 'count_record']},
        'hourlyVolumes': flows, 'assumptions': a.used,
    }


if __name__ == '__main__':
    print(json.dumps(build(), allow_nan=False))
