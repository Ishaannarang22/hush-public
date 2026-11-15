"""--export-lab (docs/BUILD_BRIEF.md section 7a): shapes from web/src/acoustics/engine/domain.ts,
spectra that reproduce the wall level, room ids from the saved Matterport response, and the demo command."""
import json
import math
import os
import subprocess
import sys
import tempfile
import time
import unittest

from noisemodel import export_lab
from noisemodel.predict import predict

from helpers import ROOT, load_sample, walk_levels

MODEL = "zzvymDx5ty7"
BLOCKS = ("overnight", "morning_rush", "midday", "evening_rush", "evening")


def valid_source_data(test, s):
    """SourceData: {id, position: Vec, spectrumDbAt1m: number[8], enabled, evidence: Evidence}."""
    test.assertEqual(set(s), {"id", "position", "spectrumDbAt1m", "enabled", "evidence"})
    test.assertIsInstance(s["id"], str)
    test.assertEqual(set(s["position"]), {"x", "y", "z"})
    for k in "xyz":
        test.assertTrue(math.isfinite(s["position"][k]))
    test.assertEqual(len(s["spectrumDbAt1m"]), 8)
    for x in s["spectrumDbAt1m"]:
        test.assertTrue(isinstance(x, (int, float)) and math.isfinite(x))
    test.assertIsInstance(s["enabled"], bool)
    test.assertIn(s["evidence"]["kind"], ("measured", "assumed", "derived"))
    test.assertTrue(s["evidence"]["source"])
    test.assertTrue(set(s["evidence"]) <= {"kind", "source", "note"})


class TestLabExport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.prop = load_sample("property.%s.json" % MODEL)
        cls.src = load_sample("sources.%s.json" % MODEL)
        cls.raw = load_sample("matterport_model_%s.json" % MODEL)
        cls.result = predict(cls.prop, cls.src)
        cls.lab, cls.targets = export_lab.build(cls.prop, cls.src, result=cls.result)

    def test_demo_output_is_finite_and_in_range(self):
        text = json.dumps(self.result, allow_nan=False)
        found = 0
        for path, v in walk_levels(json.loads(text)):
            found += 1
            self.assertTrue(15.0 <= v <= 100.0, (path, v))
        self.assertGreater(found, 50)

    def test_committed_files_match_a_fresh_export(self):
        self.assertEqual(self.lab, load_sample("lab_sources.%s.json" % MODEL))
        self.assertEqual(self.targets, load_sample("room_targets.%s.json" % MODEL))

    def test_sources_have_the_simulation_shape(self):
        self.assertEqual(self.lab["coordinateSystem"], "local-meters-y-up")
        self.assertEqual(self.lab["modelId"], MODEL)
        self.assertEqual(set(self.lab["blocks"]), set(BLOCKS))
        n = 0
        for block in BLOCKS:
            for s in self.lab["blocks"][block]:
                valid_source_data(self, s)
                self.assertEqual(s["evidence"]["kind"], "derived")
                self.assertIn("point source stands in for a road", s["evidence"]["note"])
                n += 1
        self.assertEqual(n, 5)   # one road, five blocks

    def test_spectrum_plus_distance_reproduces_the_wall_level(self):
        outdoor = {w["wall"]: w for w in self.result["outdoor"]}
        for block in BLOCKS:
            for s in self.lab["blocks"][block]:
                d = self.lab["derivation"][s["id"]]
                r = math.sqrt(sum((s["position"][k] - d["receiver"][k]) ** 2 for k in "xyz"))
                at_wall = export_lab.a_weighted(s["spectrumDbAt1m"]) - 20.0 * math.log10(r)
                self.assertAlmostEqual(at_wall, d["wall_level_dba"][block], delta=0.1)
                # and that is the model's own outdoor level at the wall (one road here)
                model_level = outdoor[d["reference_wall"]]["blocks"][block]["by_source"]["road"]
                self.assertAlmostEqual(at_wall, model_level, delta=0.1)

    def test_source_is_outside_the_wall_along_its_outward_normal(self):
        s = self.lab["blocks"]["midday"][0]
        d = self.lab["derivation"][s["id"]]
        g = next(w["geometry"] for r in self.prop["rooms"] for w in r["exterior_walls"] if w["id"] == d["reference_wall"])
        mx, mz = (g["a"][0] + g["b"][0]) / 2, (g["a"][1] + g["b"][1]) / 2
        vx, vz = s["position"]["x"] - mx, s["position"]["z"] - mz
        self.assertAlmostEqual(math.hypot(vx, vz), d["distance_to_source_m"], delta=0.01)
        self.assertGreater(vx * g["outward"][0] + vz * g["outward"][1], 0.99 * math.hypot(vx, vz))

    def test_spectrum_shape_is_the_simulation_road_profile(self):
        s = self.lab["blocks"]["midday"][0]["spectrumDbAt1m"]
        for x, ref in zip(s, export_lab.ROAD_SHAPE):
            self.assertAlmostEqual(x - s[0], ref, places=6)

    def test_room_targets_keyed_by_matterport_room_ids(self):
        ids = {r["id"] for r in self.raw["data"]["model"]["rooms"]}
        self.assertEqual(set(self.targets["rooms"]), ids)
        self.assertEqual(self.targets["weighting"], "A")
        self.assertIn("A-weighted", self.targets["note"])
        by_id = {r["id"]: r for r in self.result["rooms"]}
        for rid, t in self.targets["rooms"].items():
            self.assertEqual(set(t["blocks"]), set(BLOCKS))
            self.assertEqual(t["dnl_dba"], by_id[rid]["dnl_dba"])
            for block in BLOCKS:
                b = t["blocks"][block]
                self.assertEqual(b["dba"], by_id[rid]["blocks"][block]["dba"])
                lo, hi = b["range_dba"]
                self.assertAlmostEqual(hi - lo, 2 * t["range_db"], places=6)

    def test_yale_exports_targets_but_no_sources_without_plan_geometry(self):
        prop, src = load_sample("property.yale.json"), load_sample("sources.yale.json")
        lab, targets = export_lab.build(prop, src)
        self.assertEqual(sum(len(v) for v in lab["blocks"].values()), 0)
        self.assertTrue(lab["omitted"])
        self.assertIn("613htqkzf66zz7hf7n8kzszed", targets["rooms"])   # Yale's own matterport_id


class TestWindowSurveyForTheSimulation(unittest.TestCase):
    """The survey file passes the simulation's parseOpeningDataset and importer checks (importer.ts,
    geometry.ts), so one file feeds both."""

    def test_survey_is_a_valid_opening_dataset_that_fits_its_walls(self):
        d = load_sample("windows.%s.json" % MODEL)
        raw = load_sample("matterport_model_%s.json" % MODEL)
        self.assertEqual((d["schemaVersion"], d["modelId"], d["units"]), (1, MODEL, "meters"))
        edges, base = {}, {}
        for r in raw["data"]["model"]["rooms"]:
            est = r.get("dimensionEstimates") or {}
            b = (est.get("lowerElevation") or 0.0) * (0.3048 if est.get("units") == "imperial" else 1.0)
            h = (r.get("dimensions") or {}).get("height") or est.get("height")
            h = h * 0.3048 if h else 2.7   # the simulation's assumedHeightM
            for e in r["boundary"]["edges"]:
                edges.setdefault(e["id"], (e, b, h))
        ids = set()
        for o in d["openings"]:
            self.assertNotIn(o["id"], ids)
            ids.add(o["id"])
            self.assertIn(o["kind"], ("window", "door", "opening"))
            self.assertTrue(0 <= o["centerFraction"] <= 1 and o["widthM"] > 0 and o["heightM"] > 0)
            self.assertIn(o["evidence"]["kind"], ("measured", "assumed"))
            self.assertTrue(o["evidence"]["source"])
            e, b, h = edges[o["wallId"]]
            (ax, ay), (bx, by) = [(v["position"]["x"], v["position"]["y"]) for v in e["vertices"]]
            width = math.hypot(bx - ax, by - ay)
            c = o["centerFraction"] * width
            self.assertGreaterEqual(c - o["widthM"] / 2, -0.025)
            self.assertLessEqual(c + o["widthM"] / 2, width + 0.025)
            self.assertGreaterEqual(o["lowerElevationM"], b - 0.06)
            self.assertLessEqual(o["lowerElevationM"] + o["heightM"], b + h + 0.06)


class TestDemoCommand(unittest.TestCase):
    def test_demo_command_under_two_seconds_and_writes_every_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "levels.json")
            t0 = time.time()
            subprocess.run([sys.executable, "-m", "noisemodel.predict",
                            os.path.join(ROOT, "samples", "property.%s.json" % MODEL),
                            os.path.join(ROOT, "samples", "sources.%s.json" % MODEL),
                            "--out", out, "--report", "--report-path", os.path.join(tmp, "report.md"),
                            "--export-lab"], cwd=ROOT, check=True, capture_output=True)
            self.assertLess(time.time() - t0, 2.0)
            for name in ("levels.json", "report.md", "lab_sources.%s.json" % MODEL, "room_targets.%s.json" % MODEL):
                self.assertTrue(os.path.exists(os.path.join(tmp, name)), name)
            with open(out) as fh:
                self.assertEqual(json.load(fh), json.loads(json.dumps(load_sample("levels.%s.json" % MODEL))))


if __name__ == "__main__":
    unittest.main()
