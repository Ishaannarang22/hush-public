"""Fresh-input regression checks for the combined pipeline and mechanical source adapter."""
import copy
import math
import unittest
from noisemodel.pipeline import NoiseModelPipeline
from noisemodel import outdoor, export_lab
from noisemodel.assumptions import Assumptions
from helpers import load_sample


class TestPipeline(unittest.TestCase):
    def test_empty_inputs_do_not_reuse_saved_predictions(self):
        result = NoiseModelPipeline().run({'sourceInputs': {}})
        self.assertTrue(all(not rows for rows in result['labSources']['blocks'].values()))
        self.assertTrue(all(not b['by_source'] for w in result['outdoor'] for b in w['blocks'].values()))

    def test_measured_geometry_changes_rebuild_the_property(self):
        runner = NoiseModelPipeline()
        baseline = runner.run({})
        openings = copy.deepcopy(baseline['survey']['openings'])
        next(o for o in openings if o['kind'] == 'window')['widthM'] *= .5
        changed = runner.run({'openings': openings})
        self.assertNotEqual(baseline['inputHash'], changed['inputHash'])
        before = [w for r in baseline['property']['rooms'] for w in r['exterior_walls']]
        after = [w for r in changed['property']['rooms'] for w in r['exterior_walls']]
        self.assertLess(sum(w.get('window_area_m2', 0) for w in after), sum(w.get('window_area_m2', 0) for w in before))

    def test_only_catalog_properties_and_bounded_lists(self):
        with self.assertRaises(ValueError): NoiseModelPipeline().run({'modelId': '../../etc/passwd'})
        with self.assertRaises(ValueError): NoiseModelPipeline().run({'sourceInputs': {'roads': [{}] * 501}})


class TestMechanical(unittest.TestCase):
    def setUp(self):
        self.a = Assumptions.load()
        self.machine = {'id': 'ac', 'lat': 30, 'lon': -95 + 20/(111320*math.cos(math.radians(30))),
                        'height_m': 1.5, 'level_at_1m_dba': 80, 'evidence': 'Illustrative test source'}

    def levels(self, machines):
        return outdoor.wall_levels([{'id': 'east', 'azimuth': 90}], {'mechanical': machines}, 1.5, (30, -95), self.a, [])[0]['east']['mechanical']

    def test_distance_duty_and_energy_addition(self):
        base = self.levels([self.machine])[12]
        self.assertAlmostEqual(base, 80-20*math.log10(20), places=5)
        half = self.levels([dict(self.machine, duty_fraction=.5)])[12]
        self.assertAlmostEqual(base-half, 10*math.log10(2), places=6)
        two = self.levels([self.machine, self.machine])[12]
        self.assertAlmostEqual(two-base, 10*math.log10(2), places=6)
        self.assertIsNone(self.levels([dict(self.machine, duty_fraction=0)])[12])

    def test_night_only_equipment_is_exported(self):
        prop = load_sample('property.zzvymDx5ty7.json')
        machine = dict(self.machine, lat=prop['lat'], lon=prop['lon']+.0003, active_blocks=['overnight'])
        lab, _ = export_lab.build(prop, {'mechanical': [machine]})
        self.assertEqual(len(lab['blocks']['overnight']), 1)
        self.assertEqual(lab['blocks']['midday'], [])
        s = lab['blocks']['overnight'][0]
        d = lab['derivation'][s['id']]
        self.assertAlmostEqual(export_lab.a_weighted(s['spectrumDbAt1m'])-20*math.log10(d['receiver_to_source_m']), d['wall_level_dba']['overnight'], delta=.02)

    def test_invalid_duty_and_missing_provenance_fail(self):
        for machine in [dict(self.machine, duty_fraction=-1), dict(self.machine, evidence=None), dict(self.machine, lat=float('nan'))]:
            with self.assertRaises(ValueError): self.levels([machine])
