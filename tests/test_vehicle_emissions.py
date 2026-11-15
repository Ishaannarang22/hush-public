import math
from noisemodel.vehicle_emissions import build
from noisemodel.outdoor import remel
from noisemodel.assumptions import Assumptions
from noisemodel.export_lab import a_weighted


def test_individual_emissions_use_shared_model_and_preserve_reference_level():
    model, a = build(), Assumptions.load()
    for kind in ('auto', 'medium_truck', 'heavy_truck'):
        assert len(model['spectra'][kind]) == 140
        for speed in (1, 22, 50, 89, 120, 140):
            spectrum = model['spectra'][kind][speed - 1]
            assert len(spectrum) == 8
            at_reference = a_weighted(spectrum) - 20 * math.log10(model['referenceDistanceM'])
            assert abs(at_reference - remel(kind, speed, a)) < .006
    assert a_weighted(model['spectra']['medium_truck'][49]) > a_weighted(model['spectra']['auto'][49])


def test_archived_counts_keep_their_original_age_and_are_not_live_vehicle_counts():
    model = build()
    assert model['archivedRoad']['aadt'] == 13626
    assert model['archivedRoad']['aadt_year'] == 2016
    assert len(model['hourlyVolumes']) == 5
    assert 'not tracked cars' in model['methodNote']
