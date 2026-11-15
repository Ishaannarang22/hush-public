"""Road emission (R7) and time of day (R9, V1 5a)."""
import math
import unittest

from noisemodel import db, outdoor
from noisemodel.assumptions import Assumptions

HALF_PI = math.pi / 2


def r7_hour(a, model, soft):
    # R7 worked example 1: 1400 veh/h, 4% trucks split 0.486 -> MT 27, HT 29, A 1344; 50 km/h; D 15 m; whole road.
    total = []
    for cls, n in (("auto", 1344), ("medium_truck", 27), ("heavy_truck", 29)):
        l0 = outdoor.remel(cls, 50.0, a, model=model)
        total.append(outdoor.class_leq(l0, n, 50.0, 15.0, -HALF_PI, HALF_PI, soft, a))
    return db.energy_sum(total)


class TestRoad(unittest.TestCase):
    def setUp(self):
        self.a = Assumptions.load()

    def test_r7_worked_example_soft(self):
        self.assertAlmostEqual(r7_hour(self.a, "rd77", True), 66.4, delta=0.05)

    def test_r7_worked_example_hard(self):
        self.assertAlmostEqual(r7_hour(self.a, "rd77", False), 67.6, delta=0.05)

    def test_r7_worked_example_tnm(self):
        self.assertAlmostEqual(r7_hour(self.a, "tnm", True), 65.8, delta=0.05)

    def test_tnm_remels_match_pd96_table37(self):
        for cls, expected in (("auto", 73.81), ("medium_truck", 79.91), ("heavy_truck", 83.96)):
            self.assertAlmostEqual(outdoor.remel(cls, 88.5, self.a, model="tnm"), expected, delta=0.01)

    def test_soft_segment_terms(self):
        # R7 E5 table
        rad = math.radians
        self.assertAlmostEqual(outdoor.segment_term(-HALF_PI, HALF_PI, True, self.a), -1.18, delta=0.01)
        self.assertAlmostEqual(outdoor.segment_term(rad(-22), rad(55), True, self.a), -3.96, delta=0.01)
        self.assertAlmostEqual(outdoor.segment_term(rad(-22), rad(55), False, self.a), -3.69, delta=0.01)
        self.assertAlmostEqual(outdoor.segment_term(0.0, HALF_PI, True, self.a), -4.19, delta=0.01)

    def test_yale_count_at_15_m(self):
        # R7: Yale 2016 count, soft, infinite road, D = 15 m gives 63.0 dBA (TNM REMELs) and 63.3 (RD-77-108).
        road = {"id": "yale", "aadt": 21301, "medium_trucks_per_day": 383, "heavy_trucks_per_day": 298,
                "speed_kmh": 48.28, "road_class": "arterial",
                "geometry": [[-95.399277, 29.76], [-95.399277, 29.85]]}
        rx = outdoor.project(-95.399432, 29.805907, 29.805907, -95.399432)
        l24 = outdoor.road_l24(road, rx, (29.805907, -95.399432), self.a)
        self.assertAlmostEqual(l24, 63.0, delta=0.1)
        a77 = Assumptions.load(overrides={"road.emission_model": "rd77"})
        self.assertAlmostEqual(outdoor.road_l24(road, rx, (29.805907, -95.399432), a77), 63.3, delta=0.1)

    def test_polyline_pieces_sum_to_whole_road(self):
        # R7 E5: the pieces of a straight road energy-sum back to the whole road.
        whole = outdoor.segment_term(-HALF_PI, HALF_PI, True, self.a)
        cuts = [-90, -57, -22, 55, 90]
        parts = [outdoor.segment_term(math.radians(cuts[i]), math.radians(cuts[i + 1]), True, self.a)
                 for i in range(4)]
        self.assertAlmostEqual(db.energy_sum(parts), whole, delta=0.01)


class TestTime(unittest.TestCase):
    def setUp(self):
        self.a = Assumptions.load()

    def test_hourly_shares_sum_to_one(self):
        for profile in ("arterial", "freeway", "hud_road", "rail", "aviation", "flat"):
            shares = outdoor.hourly_shares(profile, self.a)
            self.assertEqual(len(shares), 24)
            self.assertAlmostEqual(sum(shares), 1.0, places=12, msg=profile)

    def test_energy_mean_of_24_hours_equals_24_hour_level(self):
        road = {"id": "r", "aadt": 21301, "medium_trucks_per_day": 383, "heavy_trucks_per_day": 298,
                "speed_kmh": 48.28, "road_class": "arterial",
                "geometry": [[-95.399277, 29.80], [-95.399277, 29.81]]}
        rx = outdoor.project(-95.399432, 29.805907, 29.805907, -95.399432)
        hourly = outdoor.road_hourly(road, rx, (29.805907, -95.399432), self.a)
        self.assertEqual(len(hourly), 24)
        self.assertAlmostEqual(db.energy_mean(hourly),
                               outdoor.road_l24(road, rx, (29.805907, -95.399432), self.a), places=6)

    def test_block_offsets_from_hud_profile(self):
        # SOUND_MODEL.md 3.2 / V1: -3.979, +0.492, +1.335, +1.335, -0.555
        hourly = outdoor.hourly_levels(0.0, outdoor.hourly_shares("hud_road", self.a))
        blocks = outdoor.block_levels(hourly, self.a)
        expected = {"overnight": -3.979, "morning_rush": 0.492, "midday": 1.335,
                    "evening_rush": 1.335, "evening": -0.555}
        for b, v in expected.items():
            self.assertAlmostEqual(blocks[b], v, delta=0.001, msg=b)

    def test_dnl_from_hourly_values(self):
        # HUD profile: DNL = L24 + 3.71 from the hourly values (not 4.74 from block averages, V1 5a)
        hourly = outdoor.hourly_levels(50.0, outdoor.hourly_shares("hud_road", self.a))
        self.assertAlmostEqual(outdoor.dnl(hourly, self.a), 53.7107, delta=0.001)

    def test_r9_arterial_offsets(self):
        hourly = outdoor.hourly_levels(0.0, outdoor.hourly_shares("arterial", self.a))
        blocks = outdoor.block_levels(hourly, self.a)
        expected = {"overnight": -5.76, "morning_rush": 0.85, "midday": 1.62,
                    "evening_rush": 2.03, "evening": -2.15}
        for b, v in expected.items():
            self.assertAlmostEqual(blocks[b], v, delta=0.02, msg=b)

    def test_rush_not_quieter_than_midday_for_yale_count(self):
        # V1 5g is solved by the R9 shares: evening_rush is the loudest road block on an arterial.
        hourly = outdoor.hourly_levels(0.0, outdoor.hourly_shares("arterial", self.a))
        blocks = outdoor.block_levels(hourly, self.a)
        self.assertGreater(blocks["evening_rush"], blocks["midday"])


if __name__ == "__main__":
    unittest.main()
