"""Units and building blocks (docs/BUILD_BRIEF.md section 9, 'Units')."""
import math
import unittest

from noisemodel import db, facade, outdoor
from noisemodel.assumptions import Assumptions


class TestDb(unittest.TestCase):
    def test_two_equal_levels_add_3_01(self):
        self.assertAlmostEqual(db.energy_sum([60.0, 60.0]) - 60.0, 3.0103, places=3)

    def test_energy_mean(self):
        self.assertAlmostEqual(db.energy_mean([50.0, 50.0, 50.0]), 50.0, places=9)
        self.assertAlmostEqual(db.energy_mean([60.0, -math.inf]), 60.0 - 3.0103, places=3)

    def test_level_of_zero_energy_is_none(self):
        self.assertIsNone(db.level(0.0))
        self.assertIsNone(db.energy_sum([]))


class TestPropagation(unittest.TestCase):
    def setUp(self):
        self.a = Assumptions.load()

    def test_barrier_check_case(self):
        # R2 E1: delta = 0.2509 m gives N = 0.805 and 12.24 dB (V1 table)
        self.assertAlmostEqual(outdoor.barrier_loss(0.2509, self.a), 12.24, delta=0.01)

    def test_barrier_branch_joins(self):
        self.assertAlmostEqual(outdoor.barrier_loss(5.03 / 3.21, self.a), 20.0, delta=0.01)
        self.assertAlmostEqual(outdoor.barrier_loss(-0.1916 / 3.21, self.a), 0.0, delta=0.01)
        self.assertAlmostEqual(outdoor.barrier_loss(0.0, self.a), 5.0, delta=1e-9)
        self.assertEqual(outdoor.barrier_loss(-1.0, self.a), 0.0)
        self.assertEqual(outdoor.barrier_loss(50.0, self.a), 20.0)

    def test_orientation_points(self):
        cases = {0: 0.0, 45: 1.25, 90: 3.01, 135: 6.02, 162: 10.0, 180: 10.0}
        for alpha, expected in cases.items():
            self.assertAlmostEqual(outdoor.orientation_loss(alpha, self.a), expected, delta=0.01)

    def test_foliage_steps(self):
        self.assertEqual(outdoor.foliage_loss(9.9, self.a), 0.0)
        self.assertEqual(outdoor.foliage_loss(15.0, self.a), 1.0)
        self.assertAlmostEqual(outdoor.foliage_loss(30.0, self.a), 1.5)
        self.assertEqual(outdoor.foliage_loss(500.0, self.a), 10.0)


class TestRoom(unittest.TestCase):
    def test_sabine_33_6_m3(self):
        a = Assumptions.load()
        self.assertAlmostEqual(facade.sabine(33.6, a), 10.82, delta=0.005)


class TestAssumptions(unittest.TestCase):
    def test_every_entry_has_value_unit_source_status(self):
        a = Assumptions.load()
        statuses = set()
        for key, entry in a.entries():
            for field in ("value", "unit", "source", "status"):
                self.assertIn(field, entry, key)
            statuses.add(entry["status"])
        self.assertTrue(statuses <= {"sourced", "calibrated", "placeholder", "derived"}, statuses)

    def test_v1_labels_corrected(self):
        a = Assumptions.load()
        self.assertEqual(a.status("facade.incidence_constant"), "derived")
        self.assertEqual(a.status("facade.incidence_constant_line_source"), "derived")
        self.assertEqual(a.status("propagation.orientation.back_wall_loss"), "placeholder")
        self.assertEqual(a.status("reporting.range_default"), "placeholder")
        self.assertEqual(a.status("reporting.range_measured_windows"), "placeholder")
        self.assertEqual(a.status("validation.bedroom_1990s_65db"), "derived")
        self.assertEqual(a.status("propagation.foliage.max_path"), "placeholder")

    def test_v1_missing_keys_present(self):
        a = Assumptions.load()
        for key in ("propagation.foliage.max_tree_path_from_road", "doors_exterior.default",
                    "partitions.default_wall", "partitions.default_door", "partitions.door_area",
                    "rooms.roof_height_choice"):
            self.assertIsNotNone(a.entry(key), key)

    def test_override_by_key(self):
        a = Assumptions.load(overrides={"rooms.reverberation_time": 0.4})
        self.assertEqual(a.value("rooms.reverberation_time"), 0.4)
        self.assertEqual(a.status("rooms.reverberation_time"), "override")
        self.assertIn("rooms.reverberation_time", a.used)


if __name__ == "__main__":
    unittest.main()
