"""The Matterport loader (docs/BUILD_BRIEF.md sections 5 and 9, Loader).

Most tests use a made-up two-room floor plan, written here, to show the loader has no property-specific
code. The last class checks the saved zzvymDx5ty7 response and its committed property file.
"""
import copy
import json
import math
import unittest

from noisemodel.matterport import build_property, polygon_area, stitch
from noisemodel.predict import predict

from helpers import load_sample, room

FT = 0.3048


def edge(eid, a, b, openings=None, kind="wall", thickness=0.12):
    return {"id": eid, "type": kind, "thickness": thickness, "openings": openings or [],
            "vertices": [{"position": {"x": a[0], "y": a[1]}}, {"position": {"x": b[0], "y": b[1]}}]}


def made_up_plan():
    """Room A 4 x 3 m and room B 3 x 3 m side by side, sharing the edge x = 4 with a 0.9 x 2.0 m doorway.
    Model +x points east and +y north (geoLocationOf samples 10 m east and 10 m north of the origin)."""
    door = {"id": "door-ab", "type": "doorway", "width": 0.9, "height": 2.0, "lowerElevation": 0.0,
            "relativeCenter": 0.5}
    shared = edge("e-shared", (4, 0), (4, 3), [door])
    room_a = {"id": "room-a", "tags": ["bedroom"], "floor": {"id": "f1", "sequence": 0},
              "dimensions": {"height": 2.5 / FT, "units": "imperial"},
              "dimensionEstimates": {"height": 2.5 / FT, "lowerElevation": 0.0, "units": "imperial"},
              # unordered and partly reversed, as the API returns them
              "boundary": {"edges": [edge("a-north", (4, 3), (0, 3)), edge("a-south", (0, 0), (4, 0)),
                                     edge("a-west", (0, 0), (0, 3)), copy.deepcopy(shared)]},
              "holes": []}
    room_b = {"id": "room-b", "tags": ["kitchen", "living"], "floor": {"id": "f1", "sequence": 0},
              "dimensions": {"units": "metric"},
              "dimensionEstimates": {"lowerElevation": 0.0, "units": "metric"},
              "boundary": {"edges": [edge("b-south", (4, 0), (7, 0)), copy.deepcopy(shared),
                                     edge("b-east", (7, 0), (7, 3),
                                          [{"id": "entry", "type": "doorway", "width": 1.0, "height": 2.1,
                                            "lowerElevation": 0.0, "relativeCenter": 0.5}]),
                                     edge("b-north", (7, 3), (4, 3))]},
              "holes": []}
    lat0, lon0 = 30.0, -95.0
    dlat = 10.0 / 110574.0
    dlon = 10.0 / (111320.0 * math.cos(math.radians(lat0)))
    return {"data": {"model": {
        "id": "TESTPLAN001", "name": "made-up plan",
        "address": {"address": "1 Test St"},
        "geolocation": {"lat": str(lat0), "long": str(lon0)},
        "geocoordinates": {"source": "test",
                           "origin": {"lat": str(lat0), "long": str(lon0)},
                           "plusX10m": {"lat": str(lat0), "long": str(lon0 + dlon)},
                           "plusY10m": {"lat": str(lat0 + dlat), "long": str(lon0)}},
        "rooms": [room_a, room_b]}}}


def survey(openings=None, exposure=None, model_id="TESTPLAN001"):
    return {"schemaVersion": 1, "modelId": model_id, "units": "meters", "openings": openings or [],
            "exposure": exposure or []}


WINDOW = {"id": "w1", "wallId": "a-south", "kind": "window", "centerFraction": 0.5, "widthM": 1.5, "heightM": 1.2,
          "lowerElevationM": 0.9, "evidence": {"kind": "measured", "source": "test"}, "operable": True}


def walls_of(prop):
    return {w["id"]: w for r in prop["rooms"] for w in r["exterior_walls"]}


class TestStitch(unittest.TestCase):
    def test_outline_stitches_into_closed_polygon(self):
        plan = made_up_plan()["data"]["model"]["rooms"][0]
        pts, used = stitch(plan["boundary"]["edges"])
        self.assertEqual(len(pts), 4)
        self.assertEqual(sorted(used), [0, 1, 2, 3])
        self.assertAlmostEqual(polygon_area(pts), 12.0, places=6)

    def test_open_outline_is_rejected(self):
        plan = made_up_plan()["data"]["model"]["rooms"][0]
        pts, used = stitch(plan["boundary"]["edges"][:3])
        self.assertEqual(pts, [])

    def test_room_with_open_outline_is_skipped_with_warning(self):
        resp = made_up_plan()
        resp["data"]["model"]["rooms"][1]["boundary"]["edges"].pop()
        prop, warnings = build_property(resp, survey([WINDOW]))
        self.assertEqual([r["id"] for r in prop["rooms"]], ["room-a"])
        self.assertTrue(any("does not close" in w for w in warnings))

    def test_spur_edge_is_not_a_wall(self):
        resp = made_up_plan()
        resp["data"]["model"]["rooms"][0]["boundary"]["edges"].append(edge("spur", (2, 3), (2, 2.5)))
        prop, warnings = build_property(resp, survey([WINDOW]))
        ids = [w["id"] for w in prop["other_boundary_walls"]] + list(walls_of(prop))
        self.assertNotIn("spur", ids)
        self.assertTrue(any("spur" in w for w in warnings))


class TestMadeUpPlan(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.prop, cls.warnings = build_property(made_up_plan(), survey([WINDOW], [
            {"wallId": "b-east", "exposure": "not_outdoor", "evidence": {"kind": "derived", "source": "entry"}}]))

    def test_rooms_keep_matterport_ids_area_height_volume(self):
        a = room({"rooms": self.prop["rooms"]}, "room-a")
        self.assertEqual(a["matterport_id"], "room-a")
        self.assertAlmostEqual(a["area_m2"], 12.0, places=3)
        self.assertAlmostEqual(a["height_m"], 2.5, places=3)   # imperial feet converted
        self.assertAlmostEqual(a["volume_m3"], 30.0, places=2)
        self.assertEqual(a["type"], "bedroom")

    def test_missing_height_uses_documented_fallback_and_is_flagged(self):
        b = room({"rooms": self.prop["rooms"]}, "room-b")
        self.assertEqual(b["height_status"], "assumed")
        self.assertEqual(b["height_m"], 2.4)   # rooms.height_default
        self.assertTrue(any("room-b" in w and "height" in w for w in self.warnings))

    def test_shared_edge_is_one_partition_with_the_doorway_as_its_door(self):
        parts = [p for p in self.prop["partitions"] if p["edge_id"] == "e-shared"]
        self.assertEqual(len(parts), 1)
        p = parts[0]
        self.assertEqual({p["room_a"], p["room_b"]}, {"room-a", "room-b"})
        self.assertEqual(p["door"], "closed")
        self.assertAlmostEqual(p["door_area_m2"], 1.8, places=3)
        self.assertAlmostEqual(p["area_m2"], 3.0 * 2.4, places=3)   # length x lower room height

    def test_boundary_edge_is_one_exterior_wall_with_bearing(self):
        walls = walls_of(self.prop)
        self.assertEqual(list(walls), ["a-south"])   # the only wall with a window
        w = walls["a-south"]
        self.assertEqual(w["exposure"], "outdoor")
        self.assertAlmostEqual(w["azimuth_deg"], 180.0, places=1)   # outward normal -y = south
        self.assertAlmostEqual(w["window_area_m2"], 1.8, places=3)
        self.assertEqual(w["window_area_status"], "measured")
        self.assertFalse(w["window_fixed"])
        others = {o["id"]: o for o in self.prop["other_boundary_walls"]}
        self.assertEqual(others["a-west"]["azimuth_deg"], 270.0)
        self.assertEqual(others["a-north"]["azimuth_deg"], 0.0)
        self.assertEqual(others["b-east"]["azimuth_deg"], 90.0)
        self.assertEqual(len(others) + len(walls), 6)   # every boundary edge once

    def test_exposure_defaults_and_overrides(self):
        others = {o["id"]: o for o in self.prop["other_boundary_walls"]}
        self.assertEqual(others["b-east"]["exposure"], "not_outdoor")
        self.assertEqual(others["a-west"]["exposure"], "unknown")
        self.assertTrue(any("unknown exposure" in w and "a-west" in w for w in self.warnings))

    def test_exposed_wall_without_survey_entry_falls_back_to_15_percent(self):
        prop, warnings = build_property(made_up_plan(), survey([WINDOW], [
            {"wallId": "a-west", "exposure": "outdoor", "evidence": {"kind": "assumed", "source": "test"}}]))
        self.assertIsNone(walls_of(prop)["a-west"]["window_area_m2"])
        self.assertTrue(any("a-west" in w and "15%" in w for w in warnings))

    def test_assumed_window_gives_the_wider_range(self):
        win = dict(WINDOW, evidence={"kind": "assumed", "source": "by eye"})
        prop, _ = build_property(made_up_plan(), survey([win]))
        res = predict(prop, {"roads": [], "outdoor_levels_dba": {"road": 65.0}}, with_fixes=False)
        self.assertEqual(room(res, "room-a")["range_db"], 5)
        prop, _ = build_property(made_up_plan(), survey([WINDOW]))
        res = predict(prop, {"roads": [], "outdoor_levels_dba": {"road": 65.0}}, with_fixes=False)
        self.assertEqual(room(res, "room-a")["range_db"], 3)

    def test_model_runs_on_loader_output(self):
        res = predict(self.prop, {"roads": [], "outdoor_levels_dba": {"road": 65.0}})
        a, b = room(res, "room-a"), room(res, "room-b")
        self.assertIsNotNone(a["dnl_dba"])
        self.assertLess(b["dnl_dba"], a["dnl_dba"])   # B has no exposed wall; it is fed by A
        self.assertTrue(any("unknown exposure" in w for w in res["warnings"]))

    def test_invisible_shared_edge_is_an_open_partition(self):
        resp = made_up_plan()
        for r in resp["data"]["model"]["rooms"]:
            for e in r["boundary"]["edges"]:
                if e["id"] == "e-shared":
                    e["type"] = "invisible"
        prop, _ = build_property(resp, survey([WINDOW]))
        p = [p for p in prop["partitions"] if p["edge_id"] == "e-shared"][0]
        self.assertEqual(p["kind"], "opening")

    def test_survey_is_checked(self):
        with self.assertRaises(ValueError):
            build_property(made_up_plan(), survey([WINDOW], model_id="OTHER"))
        with self.assertRaises(ValueError):
            build_property(made_up_plan(), survey([dict(WINDOW, wallId="e-shared")]))
        with self.assertRaises(ValueError):
            build_property(made_up_plan(), survey([dict(WINDOW, evidence={})]))

    def test_quaternion_fallback_when_no_geolocationof(self):
        resp = made_up_plan()
        geo = resp["data"]["model"]["geocoordinates"]
        for k in ("origin", "plusX10m", "plusY10m"):
            geo.pop(k)
        geo.update({"latitude": 30.0, "longitude": -95.0, "rotation": {"x": 0, "y": 0, "z": 0.0, "w": 1.0}})
        prop, warnings = build_property(resp, survey([WINDOW]))
        self.assertAlmostEqual(walls_of(prop)["a-south"]["azimuth_deg"], 180.0, places=1)
        self.assertTrue(any("quaternion" in w for w in warnings))


class TestSavedResponse(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = load_sample("matterport_model_zzvymDx5ty7.json")
        cls.survey = load_sample("windows.zzvymDx5ty7.json")
        cls.prop, cls.warnings = build_property(cls.raw, cls.survey,
                                                response_path="samples/matterport_model_zzvymDx5ty7.json",
                                                survey_path="samples/windows.zzvymDx5ty7.json")

    def test_committed_property_is_the_loader_output(self):
        self.assertEqual(self.prop, load_sample("property.zzvymDx5ty7.json"))

    def test_no_keys_or_download_links_in_the_saved_response(self):
        text = json.dumps(self.raw)
        self.assertNotIn("Authorization", text)
        for a in self.raw["data"]["model"]["matterpak"]["assets"]:
            self.assertIsNone(a["url"])

    def test_rooms_partitions_and_walls(self):
        ids = [r["id"] for r in self.raw["data"]["model"]["rooms"]]
        self.assertEqual([r["id"] for r in self.prop["rooms"]], ids)
        self.assertEqual(len(self.prop["partitions"]), 12)
        walls = walls_of(self.prop)
        self.assertEqual(sorted(walls), ["xg384kwe2cs7c69dayf84kudd", "z6q9f2tfcd3aumsmgkzh94ssb"])
        for w in walls.values():
            self.assertAlmostEqual(w["azimuth_deg"], 84.0, delta=0.2)
        self.assertEqual(walls["xg384kwe2cs7c69dayf84kudd"]["door_type"], "sliding_glass")
        self.assertEqual(walls["z6q9f2tfcd3aumsmgkzh94ssb"]["window_area_status"], "measured")

    def test_every_value_has_a_source(self):
        for r in self.prop["rooms"]:
            self.assertTrue(r["source"])
            for w in r["exterior_walls"]:
                self.assertTrue(w["source"])
        for p in self.prop["partitions"]:
            self.assertTrue(p["source"])


if __name__ == "__main__":
    unittest.main()
