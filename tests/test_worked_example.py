"""SOUND_MODEL.md section 5, reproduced to 0.05 dB at every step the V1 review table lists."""
import math
import unittest

from noisemodel import facade, outdoor, rooms
from noisemodel.assumptions import Assumptions
from noisemodel.predict import predict

from helpers import room, worked_example

TOL = 0.05


class TestWorkedExampleSteps(unittest.TestCase):
    def setUp(self):
        self.a = Assumptions.load()
        self.hourly = outdoor.hourly_levels(54.8, outdoor.hourly_shares("hud_road", self.a))
        self.blocks = outdoor.block_levels(self.hourly, self.a)

    def test_step1_midday(self):
        self.assertAlmostEqual(self.blocks["midday"], 56.14, delta=TOL)

    def test_step2_to_5_wall_level(self):
        self.assertAlmostEqual(outdoor.orientation_loss(90, self.a), 3.01, delta=TOL)
        self.assertEqual(outdoor.foliage_loss(0.04 * 40, self.a), 0.0)
        self.assertAlmostEqual(self.blocks["midday"] - outdoor.orientation_loss(90, self.a), 53.13, delta=TOL)

    def test_step6_to_12_composite(self):
        s = 3.703 * 2.865
        self.assertAlmostEqual(s, 10.61, delta=0.005)
        wall_r, window_r, f = 40.0, 23.0, 0.01
        t = facade.wall_transmission(s, wall_r, [
            {"kind": "window", "area": 0.15 * s, "R": window_r, "leak_fraction": f}], self.a)
        self.assertAlmostEqual(t["parts"]["wall"], 0.000902, delta=0.000001)
        self.assertAlmostEqual(t["parts"]["window"], 0.007976, delta=0.000001)
        self.assertAlmostEqual(t["parts"]["leak"], 0.015914, delta=0.000002)
        self.assertAlmostEqual(t["total"], 0.024791, delta=0.000003)
        self.assertAlmostEqual(-10 * math.log10(t["total"] / s), 26.31, delta=TOL)

    def test_step13_to_19_rooms(self):
        a_bed = facade.sabine(56.68, self.a) + 1.6
        a_cor = facade.sabine(23.24, self.a) + 1.6
        self.assertAlmostEqual(a_bed, 19.85, delta=0.005)
        self.assertAlmostEqual(a_cor, 9.08, delta=0.005)
        p = 6.4 * 10 ** -2.5 + 1.6
        self.assertAlmostEqual(p, 1.6202, delta=0.0001)
        c = [[0.0, p / a_bed], [p / a_cor, 0.0]]
        self.assertAlmostEqual(c[1][0], 0.1784, delta=0.0001)
        self.assertAlmostEqual(c[0][1], 0.0816, delta=0.0001)
        e = rooms.solve([1.0, 0.0], c)
        self.assertAlmostEqual(10 * math.log10(e[0]), 0.0637, delta=0.001)


class TestWorkedExampleEndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        prop, src = worked_example()
        cls.result = predict(prop, src)

    def test_bedroom_midday(self):
        self.assertAlmostEqual(room(self.result, "bed1")["blocks"]["midday"]["dba"], 27.15, delta=TOL)

    def test_corridor_midday(self):
        self.assertAlmostEqual(room(self.result, "corridor")["blocks"]["midday"]["dba"], 19.67, delta=TOL)

    def test_bedroom_all_blocks(self):
        expected = {"overnight": 21.84, "morning_rush": 26.31, "midday": 27.15,
                    "evening_rush": 27.15, "evening": 25.26}
        bed = room(self.result, "bed1")
        for b, v in expected.items():
            self.assertAlmostEqual(bed["blocks"][b]["dba"], v, delta=TOL, msg=b)

    def test_bedroom_l24_and_dnl(self):
        bed = room(self.result, "bed1")
        self.assertAlmostEqual(bed["l24_dba"], 25.82, delta=TOL)
        self.assertAlmostEqual(bed["dnl_dba"], 29.53, delta=TOL)
        self.assertFalse(bed["exceeds_hud_45"])
        self.assertFalse(bed["exceeds_who_30_night"])

    def test_path_shares(self):
        # leak 64.2, window 32.2, wall 3.6 percent of the facade energy
        shares = room(self.result, "bed1")["paths_24h"]
        facade_total = sum(v for k, v in shares.items() if k.startswith("bed1-n:"))
        self.assertAlmostEqual(shares["bed1-n:leak"] / facade_total, 0.642, delta=0.002)
        self.assertAlmostEqual(shares["bed1-n:window"] / facade_total, 0.322, delta=0.002)
        self.assertAlmostEqual(shares["bed1-n:wall"] / facade_total, 0.036, delta=0.002)
        self.assertEqual(room(self.result, "bed1")["blocks"]["midday"]["dominant"]["path"], "frame leakage")

    def test_door_closed(self):
        # door closed instead: bedroom 27.46 dBA, corridor 7.2 (under the 15 dBA output floor, so null)
        prop, src = worked_example()
        prop["partitions"][0]["door"] = "closed"
        result = predict(prop, src)
        self.assertAlmostEqual(room(result, "bed1")["blocks"]["midday"]["dba"], 27.46, delta=TOL)
        corridor = room(result, "corridor")["blocks"]["midday"]
        self.assertIsNone(corridor["dba"])
        self.assertTrue(corridor["below_15_dba"])


if __name__ == "__main__":
    unittest.main()
