"""Calibration targets (docs/BUILD_BRIEF.md section 9, 'Targets'; R3 E3; V1 4b)."""
import math
import unittest

from noisemodel import facade
from noisemodel.assumptions import Assumptions
from noisemodel.predict import predict

from helpers import one_room, room, simple_road


def r3_bedroom(a, era, window_fraction=0.15, level=65.0):
    """65 dBA free field on one 9.6 m2 front wall of the 4 x 3.5 x 2.4 m bedroom."""
    wall_r, window_r, f = facade.era_ratings(a, era)
    s = 9.6
    t = facade.wall_transmission(s, wall_r, [
        {"kind": "window", "area": window_fraction * s, "R": window_r, "leak_fraction": f}], a)
    return level + facade.incidence_constant(a) + 10 * math.log10(t["total"] / facade.sabine(33.6, a))


class TestTargets(unittest.TestCase):
    def setUp(self):
        self.a = Assumptions.load()

    def test_four_era_rows(self):
        expected = {"before_1960": 45.1, "1960_1979": 41.5, "1980_1999": 41.2, "2000_on": 38.2}
        for era, v in expected.items():
            self.assertAlmostEqual(r3_bedroom(self.a, era), v, delta=0.05, msg=era)

    def test_1990s_bedroom_end_to_end(self):
        res = predict(one_room(era="1980_1999"), simple_road(level=65.0, profile="flat"))
        self.assertAlmostEqual(room(res, "bed")["blocks"]["midday"]["dba"], 41.2, delta=0.05)
        lo, hi = self.a.value("validation.bedroom_1990s_65db")
        self.assertTrue(lo <= room(res, "bed")["blocks"]["midday"]["dba"] <= hi)

    def test_all_glass_wall_reduction_at_least_18(self):
        for era in ("before_1960", "1960_1979", "1980_1999", "2000_on"):
            inside = r3_bedroom(self.a, era, window_fraction=1.0)
            self.assertGreaterEqual(65.0 - inside, 18.0, era)
        # V1 4b: 1990s all-glass wall with the leak cap gives 45.6 dBA (NLR 19.4)
        self.assertAlmostEqual(r3_bedroom(self.a, "1980_1999", window_fraction=1.0), 45.6, delta=0.05)

    def test_leak_cap_leaves_15_percent_case_unchanged(self):
        self.assertAlmostEqual(r3_bedroom(self.a, "1980_1999", window_fraction=0.15), 41.2, delta=0.05)


if __name__ == "__main__":
    unittest.main()
