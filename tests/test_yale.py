"""The demo run: output shape, sources, command line and runtime."""
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest

from noisemodel.predict import predict

from helpers import ROOT, room, yale

BLOCKS = ("overnight", "morning_rush", "midday", "evening_rush", "evening")


class TestYale(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.prop, cls.src = yale()
        cls.res = predict(cls.prop, cls.src)

    def test_every_room_has_blocks_dnl_range_and_flags(self):
        self.assertEqual(len(self.res["rooms"]), 9)
        for r in self.res["rooms"]:
            self.assertEqual(set(r["blocks"]), set(BLOCKS))
            for key in ("dnl_dba", "exceeds_hud_45", "night_dba", "exceeds_who_30_night", "range_db"):
                self.assertIn(key, r)

    def test_ranges(self):
        # +/- 3 dB where the room's windows are measured, +/- 5 otherwise
        self.assertEqual(room(self.res, "bed1")["range_db"], 3)
        self.assertEqual(room(self.res, "bed2")["range_db"], 3)
        self.assertEqual(room(self.res, "corridor")["range_db"], 5)

    def test_street_side_bedroom_is_louder(self):
        self.assertGreater(room(self.res, "bed2")["dnl_dba"], room(self.res, "bed1")["dnl_dba"])

    def test_road_check_against_bts(self):
        checks = self.res["checks"]
        self.assertEqual(checks["road_bts_dba"], 52.3)
        self.assertGreater(checks["road_detailed_minus_bts_db"], 5.0)

    def test_every_input_value_has_a_source(self):
        for r in self.prop["rooms"]:
            self.assertTrue(r.get("source"), r["id"])
            for w in r["exterior_walls"]:
                self.assertTrue(w.get("source"), w["id"])
        for p in self.prop["partitions"]:
            self.assertTrue(p.get("source"), p["id"])
        for road in self.src["roads"]:
            self.assertTrue(road.get("source"))
            self.assertTrue(road.get("geometry_source"))
        self.assertEqual(self.src["flights"], [])
        self.assertEqual(self.src["construction"], [])

    def test_assumed_values_are_listed(self):
        listed = json.dumps(self.res["assumptions_used"])
        self.assertIn("era", listed)
        self.assertIn("p-living-bed1", listed)

    def test_override_window_type(self):
        res = predict(self.prop, self.src, overrides={"window.bed1-n.type": "laminated_acoustic"})
        self.assertLess(room(res, "bed1")["dnl_dba"], room(self.res, "bed1")["dnl_dba"])

    def test_command_line_runs_under_two_seconds(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "levels.json")
            rep = os.path.join(tmp, "report.md")
            t0 = time.time()
            subprocess.run([sys.executable, "-m", "noisemodel.predict",
                            os.path.join(ROOT, "samples", "property.yale.json"),
                            os.path.join(ROOT, "samples", "sources.yale.json"),
                            "--out", out, "--report", "--report-path", rep],
                           cwd=ROOT, check=True, capture_output=True)
            elapsed = time.time() - t0
            self.assertLess(elapsed, 2.0)
            with open(out) as fh:
                self.assertEqual(json.load(fh)["property_id"], "2125-yale-unit-205")
            with open(rep) as fh:
                text = fh.read()
            for heading in ("Room ranking", "Time of day", "Why", "Fixes", "What-ifs", "Sleep",
                            "Assumptions", "Check"):
                self.assertIn(heading, text)


if __name__ == "__main__":
    unittest.main()
