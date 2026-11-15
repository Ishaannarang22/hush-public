"""Robustness (docs/BUILD_BRIEF.md section 9; V1 5b, 5c)."""
import json
import math
import unittest

from noisemodel.predict import predict, to_json

from helpers import one_room, room, simple_road, walk_levels, yale


def warnings_text(result):
    return " ".join(result["warnings"]).lower()


class TestRobustness(unittest.TestCase):
    def test_every_mode_at_the_map_floor(self):
        src = {"property_id": "t", "outdoor_levels_dba": {"road": 45.0, "rail": 45.0, "aviation": 45.0}}
        res = predict(one_room(), src)
        block = room(res, "bed")["blocks"]["midday"]
        self.assertIsNone(block["dba"])
        self.assertIsNone(room(res, "bed")["dnl_dba"])
        self.assertIn("45", warnings_text(res))
        self.assertIn("floor", warnings_text(res))
        json.loads(to_json(res))

    def test_window_larger_than_wall(self):
        res = predict(one_room(window_area=12.0), simple_road())
        self.assertIn("larger than", warnings_text(res))
        v = room(res, "bed")["blocks"]["midday"]["dba"]
        self.assertTrue(math.isfinite(v))
        clamped = predict(one_room(window_area=9.6), simple_road())
        self.assertAlmostEqual(v, room(clamped, "bed")["blocks"]["midday"]["dba"], places=9)

    def test_room_with_no_surfaces(self):
        prop = one_room()
        prop["rooms"].append({"id": "void", "type": "closet", "area_m2": 2.0, "height_m": 2.4,
                              "volume_m3": 4.8, "exterior_walls": []})
        res = predict(prop, simple_road())
        void = room(res, "void")
        self.assertIsNone(void["blocks"]["midday"]["dba"])
        self.assertIn("void", warnings_text(res))

    def test_missing_year_built_uses_default_era(self):
        prop = one_room(era=None)
        res = predict(prop, simple_road())
        self.assertIn("1980_1999", warnings_text(res))
        self.assertAlmostEqual(room(res, "bed")["blocks"]["midday"]["dba"], 41.2, delta=0.05)

    def test_missing_volume_and_height(self):
        prop = one_room()
        del prop["rooms"][0]["volume_m3"]
        del prop["rooms"][0]["height_m"]
        res = predict(prop, simple_road())
        self.assertTrue(math.isfinite(room(res, "bed")["blocks"]["midday"]["dba"]))
        self.assertIn("height", warnings_text(res))

    def test_no_nan_and_levels_inside_15_to_100(self):
        prop, src = yale()
        res = predict(prop, src)
        text = to_json(res)
        self.assertNotIn("NaN", text)
        self.assertNotIn("Infinity", text)
        found = 0
        for path, v in walk_levels(json.loads(text)):
            found += 1
            self.assertTrue(15.0 <= v <= 100.0, (path, v))
        self.assertGreater(found, 50)

    def test_loud_input_stays_finite(self):
        # 90 dBA L24 next to a freeway (R1 conflict 8); a flat 95 would give a correct outdoor DNL of 101
        res = predict(one_room(), simple_road(level=90.0))
        text = to_json(res)
        self.assertNotIn("NaN", text)
        for path, v in walk_levels(json.loads(text)):
            self.assertTrue(15.0 <= v <= 100.0, (path, v))


if __name__ == "__main__":
    unittest.main()
