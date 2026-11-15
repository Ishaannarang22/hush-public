"""Behaviour checks (docs/BUILD_BRIEF.md section 9, 'Behaviour')."""
import unittest

from noisemodel import report
from noisemodel.predict import predict

from helpers import deep, one_room, room, simple_road, yale


def midday(result, room_id="bed"):
    return room(result, room_id)["blocks"]["midday"]["dba"]


def wall_out(result, wall_id, block="midday", source="road"):
    for w in result["outdoor"]:
        if w["wall"] == wall_id:
            return w["blocks"][block]["by_source"][source], w
    raise KeyError(wall_id)


class TestBehaviour(unittest.TestCase):
    def test_bigger_window_is_louder(self):
        small = predict(one_room(window_area=1.0), simple_road())
        big = predict(one_room(window_area=3.0), simple_road())
        self.assertGreater(midday(big), midday(small))

    def test_more_trees_is_quieter_and_caps_hold(self):
        far = dict(distance=300.0)
        bare = predict(one_room(), simple_road(**far))
        trees = predict(one_room(), simple_road(tree_cover={"fraction": 0.5}, **far))
        self.assertLess(midday(trees), midday(bare))
        # fully wooded, plus three rows of buildings: trees + rows capped at 10
        wooded = predict(one_room(), simple_road(tree_cover={"fraction": 1.0},
                                                 building_rows={"first_row_built_fraction": 0.8,
                                                                "further_rows": 2}, **far))
        _, w = wall_out(wooded, "w1")
        self.assertLessEqual(w["foliage_loss_db"] + w["rows_loss_db"], 10.0 + 1e-9)
        self.assertLessEqual(w["total_shielding_db"], 25.0 + 1e-9)

    def test_orientation_or_rows_never_both(self):
        res = predict(one_room(azimuth=180.0),
                      simple_road(building_rows={"first_row_built_fraction": 0.5, "further_rows": 0}))
        _, w = wall_out(res, "w1")
        self.assertEqual(w["orientation_loss_db"], 0.0)
        self.assertEqual(w["rows_loss_db"], 3.0)

    def test_back_wall_never_more_than_25_db_below_front(self):
        front = one_room(azimuth=0.0, extra_walls=[{
            "id": "w2", "azimuth_deg": 180.0, "area_m2": 9.6, "window_area_m2": None,
            "door_area_m2": 0}])
        src = simple_road(tree_cover={"fraction": 1.0}, distance=300.0,
                          barriers=[{"id": "b", "path_difference_m": 10.0}])
        res = predict(front, src)
        unshielded = predict(front, simple_road(distance=300.0))
        front_free, _ = wall_out(unshielded, "w1")
        back, w2 = wall_out(res, "w2")
        self.assertLessEqual(front_free - back, 25.0 + 1e-9)
        self.assertLessEqual(w2["total_shielding_db"], 25.0 + 1e-9)

    def test_interior_room_quieter_than_rooms_that_feed_it(self):
        prop, src = yale()
        res = predict(prop, src)
        exterior = {r["id"] for r in prop["rooms"] if r["exterior_walls"]}
        neighbours = {}
        for p in prop["partitions"]:
            neighbours.setdefault(p["room_a"], set()).add(p["room_b"])
            neighbours.setdefault(p["room_b"], set()).add(p["room_a"])
        def dnl(room_id):  # null means below the 15 dBA output floor
            v = room(res, room_id)["dnl_dba"]
            return 0.0 if v is None else v

        checked = 0
        for r in prop["rooms"]:
            if r["id"] in exterior:
                continue
            level = dnl(r["id"])
            feeders = [dnl(n) for n in neighbours[r["id"]] if n in exterior]
            loudest = max(dnl(n) for n in neighbours[r["id"]])
            for f in feeders:
                self.assertLess(level, f, r["id"])
            self.assertLess(level, loudest, r["id"])
            checked += 1
        self.assertEqual(checked, 6)

    def test_opening_an_interior_door_raises_the_quieter_room(self):
        prop, src = yale()
        closed = predict(prop, src)
        opened_prop = deep(prop)
        for p in opened_prop["partitions"]:
            if p["id"] == "p-living-bed1":
                p["door"] = "open"
        opened = predict(opened_prop, src)
        quieter = min(("living", "bed1"), key=lambda r: room(closed, r)["dnl_dba"])
        self.assertGreater(room(opened, quieter)["dnl_dba"], room(closed, quieter)["dnl_dba"])

    def test_aircraft_ignore_barriers_and_wall_facing(self):
        def run(azimuth, barrier):
            src = {"property_id": "t", "outdoor_levels_dba": {"road": None, "rail": None, "aviation": 60.0}}
            if barrier:
                src["barriers"] = [{"id": "b", "path_difference_m": 5.0}]
                src["tree_cover"] = {"fraction": 1.0}
            return midday(predict(one_room(azimuth=azimuth), src))
        base = run(0.0, False)
        self.assertAlmostEqual(run(180.0, False), base, places=9)
        self.assertAlmostEqual(run(90.0, True), base, places=9)

    def test_detailed_aircraft_ignore_wall_facing_and_give_a_peak(self):
        flight = {"aircraft_type": None, "time": "2026-11-10T07:12:00-06:00", "groundspeed_kt": 160,
                  "track": [[-95.45, 29.8, 400.0], [-95.35, 29.8, 300.0]]}
        res = [predict(one_room(azimuth=az), {"property_id": "t", "flights": [flight] * 40})
               for az in (0.0, 180.0)]
        beds = [room(r, "bed") for r in res]
        self.assertAlmostEqual(beds[0]["blocks"]["morning_rush"]["peak_dba"],
                               beds[1]["blocks"]["morning_rush"]["peak_dba"], places=9)
        self.assertAlmostEqual(beds[0]["l24_dba"], beds[1]["l24_dba"], places=9)
        self.assertIsNotNone(beds[0]["blocks"]["morning_rush"]["peak_dba"])
        self.assertIsNone(beds[0]["blocks"]["midday"]["peak_dba"])
        self.assertGreater(beds[0]["blocks"]["morning_rush"]["peak_dba"], beds[0]["l24_dba"])

    def test_every_fix_lowers_the_room(self):
        prop = one_room()
        prop["rooms"].append({"id": "hall", "type": "corridor", "area_m2": 6.0, "height_m": 2.4,
                              "volume_m3": 14.4, "exterior_walls": []})
        prop["partitions"].append({"id": "p", "room_a": "bed", "room_b": "hall", "area_m2": 8.0,
                                   "kind": "wall", "door": "closed"})
        fixes = report.fixes(prop, simple_road(), "bed")
        # laminated, storm and seal; the door sweep changes this source room by under 0.05 dB and is
        # reported as negligible, not as a fix
        self.assertGreaterEqual(len(fixes), 3)
        for fx in fixes:
            self.assertLess(fx["delta_db"], 0.0, fx["action"])

    def test_every_fix_lowers_the_yale_bedrooms(self):
        prop, src = yale()
        for bed in ("bed1", "bed2"):
            fixes = report.fixes(prop, src, bed)
            self.assertTrue(fixes)
            for fx in fixes:
                self.assertLess(fx["delta_db"], 0.0, (bed, fx["action"]))

    def test_windows_open_is_louder(self):
        prop = one_room(window_area=1.44)
        shut = predict(prop, simple_road())
        opened = predict(prop, simple_road(), overrides={"window.w1.open": True})
        self.assertGreater(midday(opened), midday(shut) + 5.0)
        self.assertAlmostEqual(midday(opened), 65.0 - 12.0, delta=0.01)


if __name__ == "__main__":
    unittest.main()
