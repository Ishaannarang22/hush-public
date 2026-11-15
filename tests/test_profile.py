"""Unit profile tests (docs/UNIT_PROFILE_PLAN.md section 13): auto-fill, fields, per-element materials,
labels, worth checking, changes and bad edits. Context records are made up (tests/fixtures)."""
import copy
import json
import os
import unittest

from helpers import load_sample, one_room, simple_road
from noisemodel import profile as P
from noisemodel.assumptions import Assumptions
from noisemodel.predict import predict, run

HERE = os.path.dirname(os.path.abspath(__file__))
BED_WALL = "wall:z6q9f2tfcd3aumsmgkzh94ssb"
LIVING_WALL = "wall:xg384kwe2cs7c69dayf84kudd"
UNKNOWN_BED_SIDE = "wall:hfdi1ts2fsg6ph5cky3xhit7a"
ENTRY_SIDE = "wall:dxi2egrhtf3w58ykn9uf22z6d"
BEDROOM = "cdz3fkt38kae7tapstpt0eaeb"
LIVING = "613htqkzf66zz7hf7n8kzszed"


def volterra():
    return load_sample("property.zzvymDx5ty7.json"), load_sample("sources.zzvymDx5ty7.json")


def made_up_context(model_id):
    with open(os.path.join(HERE, "fixtures", "context.made_up.json")) as fh:
        rows = json.load(fh)["properties"]
    return next(r for r in rows if r["matterportModelId"] == model_id)


def field(profile, key):
    return P.index(profile)[key]


def two_door_unit():
    """A made-up one-room unit with two outside doors on two walls, both facing the road."""
    second = {"id": "w2", "azimuth_deg": 0.0, "area_m2": 9.6, "wall_type": None, "window_area_m2": 0.0,
              "window_type": None, "door_area_m2": 1.8, "door_type": None}
    prop = one_room(window_area=0.0, door_area=1.8, extra_walls=[second])
    return prop, simple_road(65.0)


def run_with(prop, src, edits):
    prop2, src2, log = P.apply(prop, src, None, edits)
    return predict(prop2, src2, with_fixes=False), prop2, log


def room(result, rid):
    return next(r for r in result["rooms"] if r["id"] == rid)


class TestAutoFill(unittest.TestCase):
    def test_without_context_every_field_is_filled_from_scan_map_inference_or_default(self):
        for prop, src in (volterra(), (load_sample("property.yale.json"), load_sample("sources.yale.json"))):
            prof = P.build(prop, src)
            self.assertTrue(prof["fields"])
            for e in prof["fields"]:
                self.assertIn(e["label"], ("scan", "map", "inferred", "assumed"), e["key"])
                self.assertIn("value", e)
                if e["field"] != "year_built":  # "not known" is the stated default for the year
                    self.assertIsNotNone(e["value"], e["key"])
                self.assertTrue(e["note"], e["key"])

    def test_with_context_each_field_takes_the_first_source_with_a_value(self):
        prop, src = volterra()
        prof = P.build(prop, src, made_up_context("zzvymDx5ty7"))
        self.assertEqual((field(prof, "year_built")["value"], field(prof, "year_built")["label"]), (1995, "costar"))
        self.assertEqual((field(prof, "era")["value"], field(prof, "era")["label"]), ("1980_1999", "inferred"))
        self.assertEqual((field(prof, "storeys")["value"], field(prof, "storeys")["label"]), (4, "costar"))
        self.assertEqual((field(prof, "unit_floor")["value"], field(prof, "unit_floor")["label"]), (2, "costar"))
        owm = field(prof, "outside_wall_material")
        self.assertEqual((owm["value"], owm["label"]), ("brick_veneer", "inferred"))  # masonry is a class, not cladding
        wt = field(prof, "window_type@" + BED_WALL)
        self.assertEqual((wt["value"], wt["label"]), ("double_pane_1980_1999", "costar"))
        # a scanned value beats the listing: the surveyed sliding door stays sliding glass
        self.assertEqual(field(prof, "door_material@" + LIVING_WALL)["label"], "scan")
        self.assertEqual(field(prof, "door_material@" + LIVING_WALL)["value"], "sliding_glass")
        # the scan beats CoStar for sides
        self.assertEqual(field(prof, "exposure@" + BED_WALL)["label"], "scan")

    def test_a_missing_listing_feature_is_not_a_no(self):
        prop, src = volterra()
        prof = P.build(prop, src, {"listingFeatures": ["Ceiling fan"], "yearBuilt": 1970})
        wt = field(prof, "window_type@" + BED_WALL)
        self.assertEqual(wt["label"], "assumed")
        self.assertEqual(wt["value"], "single_pane")  # the 1960-1979 era default, not a listing "no"
        prof = P.build(prop, src, {"listingFeatures": [], "yearBuilt": 2014})
        self.assertEqual(field(prof, "window_type@" + BED_WALL)["value"], "double_pane_2000_on")

    def test_auto_filled_run_equals_todays_run_when_context_adds_nothing(self):
        prop, src = volterra()
        today = predict(prop, src, with_fixes=False)
        for context in (None, {"constructionMaterial": "Masonry", "name": "x"}):
            prop2, src2, log = P.apply(prop, src, P.build(prop, src, context), [])
            self.assertEqual(log["data"], [])
            self.assertEqual(json.dumps(predict(prop2, src2, with_fixes=False)), json.dumps(today))

    def test_every_change_from_context_is_stated(self):
        prop, src = volterra()
        _, _, log = P.apply(prop, src, P.build(prop, src, made_up_context("zzvymDx5ty7")), [])
        changed = {x["field"] for x in log["data"]}
        self.assertEqual(changed, {"year_built", "era", "storeys", "unit_floor", "window_type"})
        for x in log["data"]:
            self.assertIn(x["label"], ("costar", "inferred"))
            self.assertTrue(x["text"])

    def test_profile_fields_file_lists_the_fill_order_for_every_field(self):
        spec = P.spec()
        for fid, d in spec["fields"].items():
            self.assertTrue(set(d["fill"]) <= set(spec["labels"]) - {"edited"}, fid)
            self.assertIn(d["scope"], ("building", "unit"))


class TestEachField(unittest.TestCase):
    """For every field and allowed value: the right input changes and the result moves the right way."""

    def setUp(self):
        self.prop, self.src = volterra()
        self.prof = P.build(self.prop, self.src)

    def _wall(self, prop, wid):
        _, w, where = P._wall(prop, wid)
        return w, where

    def test_every_value_of_every_field_reaches_its_input(self):
        for e in self.prof["fields"]:
            values = [c["value"] for c in e["choices"]] if e["kind"] == "choice" else P.alternatives(e)
            for v in values:
                if v == e["value"]:
                    continue
                if e["field"] == "unit_floor" and v > 1:
                    edits = [{"field": "storeys", "value": 5}]
                else:
                    edits = []
                edits = edits + [{"field": e["field"], "target": e["target"], "value": v}]
                prop2, _, log = P.apply(self.prop, self.src, self.prof, edits)
                self.assertEqual(log["rejected"], [])
                self.assertEqual(P.index(log["profile"])[e["key"]]["value"], v, (e["key"], v))
                self.assertEqual(P.index(log["profile"])[e["key"]]["label"], "edited")
                f, wid = e["field"], (e["target"] or "")[5:]
                if f in ("window_type", "wall_material", "door_material", "window_area_m2"):
                    w, _ = self._wall(prop2, wid)
                    key = {"window_type": "window_type", "wall_material": "wall_type", "door_material": "door_type",
                           "window_area_m2": "window_area_m2"}[f]
                    self.assertEqual(w[key], v, (e["key"], v))
                elif f == "exposure":
                    _, where = self._wall(prop2, wid)
                    self.assertEqual(where, "outdoor" if v == "outdoors" else "boundary", (e["key"], v))
                elif f == "era":
                    self.assertEqual(prop2["era"]["value"], v)
                elif f in ("year_built", "storeys", "unit_floor"):
                    self.assertEqual(prop2[f], v)
                elif f == "outside_wall_material":
                    self.assertTrue(all(w["wall_type"] == v for r in prop2["rooms"] for w in r.get("exterior_walls") or []))
                elif f == "windows_open":
                    self.assertEqual(self._wall(prop2, BED_WALL[5:])[0]["window_open"], v == "open")

    def test_single_pane_is_louder_than_laminated(self):
        single, _, _ = run_with(self.prop, self.src, [{"field": "window_type", "target": BED_WALL, "value": "single_pane"}])
        lam, _, _ = run_with(self.prop, self.src, [{"field": "window_type", "target": BED_WALL, "value": "laminated_acoustic"}])
        self.assertGreater(room(single, BEDROOM)["night_dba"], room(lam, BEDROOM)["night_dba"])

    def test_a_side_marked_neighbouring_unit_stops_letting_outdoor_sound_in(self):
        res, prop2, _ = run_with(self.prop, self.src, [{"field": "exposure", "target": BED_WALL, "value": "neighbouring_unit"}])
        bed = room(res, BEDROOM)
        self.assertFalse(any(k.startswith(BED_WALL[5:]) for k in bed["paths_24h"]))
        self.assertLess(bed["dnl_dba"], room(predict(self.prop, self.src, with_fixes=False), BEDROOM)["dnl_dba"])
        self.assertNotIn(BED_WALL[5:], [w["wall"] for w in res["outdoor"]])

    def test_a_side_marked_outdoors_lets_outdoor_sound_in(self):
        res, _, _ = run_with(self.prop, self.src, [{"field": "exposure", "target": UNKNOWN_BED_SIDE, "value": "outdoors"}])
        bed = room(res, BEDROOM)
        self.assertTrue(any(k.startswith(UNKNOWN_BED_SIDE[5:]) for k in bed["paths_24h"]))
        self.assertGreater(bed["dnl_dba"], room(predict(self.prop, self.src, with_fixes=False), BEDROOM)["dnl_dba"])

    def test_window_open_is_louder(self):
        base = predict(self.prop, self.src, with_fixes=False)
        res, _, _ = run_with(self.prop, self.src, [{"field": "windows_open", "value": "open"}])
        self.assertGreater(room(res, BEDROOM)["night_dba"], room(base, BEDROOM)["night_dba"] + 5)

    def test_older_construction_is_louder(self):
        new, _, _ = run_with(self.prop, self.src, [{"field": "year_built", "value": 2015}])
        old, prop2, _ = run_with(self.prop, self.src, [{"field": "year_built", "value": 1950}])
        self.assertEqual(prop2["era"]["value"], "before_1960")
        self.assertGreater(room(old, BEDROOM)["dnl_dba"], room(new, BEDROOM)["dnl_dba"])

    def test_bigger_window_is_louder_and_a_heavier_wall_is_quieter(self):
        big, _, _ = run_with(self.prop, self.src, [{"field": "window_area_m2", "target": BED_WALL, "value": 5.0}])
        base = predict(self.prop, self.src, with_fixes=False)
        self.assertGreater(room(big, BEDROOM)["dnl_dba"], room(base, BEDROOM)["dnl_dba"])
        vinyl, _, _ = run_with(self.prop, self.src, [{"field": "wall_material", "target": BED_WALL, "value": "vinyl_siding_2x4"}])
        self.assertGreater(room(vinyl, BEDROOM)["dnl_dba"], room(base, BEDROOM)["dnl_dba"])

    def test_an_upper_floor_takes_the_upper_floor_wall_of_its_era(self):
        # With no barrier in the sources the receiver height alone changes nothing ("small alone", plan 3);
        # in a 2000-onward building an upper floor takes the fibre-cement wall (OITC 37 against brick 40).
        res, prop2, log = run_with(self.prop, self.src, [{"field": "storeys", "value": 5}, {"field": "unit_floor", "value": 3}])
        self.assertEqual(prop2["unit_floor"], 3)
        self.assertEqual(P.index(log["profile"])["outside_wall_material"]["value"], "fiber_cement_upper_floor")
        base = predict(self.prop, self.src, with_fixes=False)
        self.assertGreater(room(res, BEDROOM)["dnl_dba"], room(base, BEDROOM)["dnl_dba"])


class TestPerElementMaterials(unittest.TestCase):
    def test_only_doors_and_walls_that_face_out_are_listed(self):
        prop, src = volterra()
        prof = P.build(prop, src)
        exterior = {"wall:" + w["id"] for r in prop["rooms"] for w in r.get("exterior_walls") or []}
        walls = {e["target"] for e in prof["fields"] if e["field"] == "wall_material"}
        doors = {e["target"] for e in prof["fields"] if e["field"] == "door_material"}
        self.assertEqual(walls, exterior)
        self.assertEqual(doors, {LIVING_WALL, ENTRY_SIDE})  # the sliding door and the entry door, no interior door
        partitions = {"wall:" + p["id"] for p in prop["partitions"]} | {"wall:" + p["id"][2:] for p in prop["partitions"]}
        self.assertFalse(partitions & {e["target"] for e in prof["fields"] if e["target"]})
        interior = {"wall:" + w["id"] for w in prop["other_boundary_walls"] if w["exposure"] == "not_outdoor"
                    and "entry door" not in w["exposure_source"]}
        self.assertFalse(interior & {e["target"] for e in prof["fields"] if e["target"]})

    def test_changing_one_door_leaves_the_other_door_unchanged(self):
        prop, src = two_door_unit()
        prof = P.build(prop, src)
        self.assertEqual({e["target"] for e in prof["fields"] if e["field"] == "door_material"}, {"wall:w1", "wall:w2"})
        def door_energy(edits):
            prop2, src2, _ = P.apply(prop, src, None, edits)
            _, raw = run(prop2, src2)
            r = raw["bed"]
            return {k: r["paths"][k] * 10 ** (r["l24"] / 10.0) for k in ("w1:door", "w2:door")}

        base = door_energy([])
        one = door_energy([{"field": "door_material", "target": "wall:w1", "value": "sliding_glass"}])
        both = door_energy([{"field": "door_material", "target": "wall:w1", "value": "sliding_glass"},
                            {"field": "door_material", "target": "wall:w2", "value": "solid_core_storm"}])
        self.assertAlmostEqual(one["w2:door"], base["w2:door"], delta=1e-9 * base["w2:door"])
        self.assertLess(one["w1:door"], base["w1:door"])  # sliding glass EWR 20 beats the hollow-core default 18
        self.assertLess(both["w2:door"], base["w2:door"])

    def test_a_wall_override_beats_the_building_value_for_that_wall_only(self):
        prop, src = volterra()
        prop2, _, log = P.apply(prop, src, None, [
            {"field": "outside_wall_material", "value": "cement_stucco_2x6", "edited_by": "manager"},
            {"field": "wall_material", "target": BED_WALL, "value": "concrete_block", "edited_by": "resident"},
        ])
        idx = P.index(log["profile"])
        self.assertEqual(P._wall(prop2, BED_WALL[5:])[1]["wall_type"], "concrete_block")
        self.assertEqual(P._wall(prop2, LIVING_WALL[5:])[1]["wall_type"], "cement_stucco_2x6")
        self.assertEqual(idx["wall_material@" + LIVING_WALL]["label"], "inferred")
        self.assertEqual(idx["wall_material@" + BED_WALL]["label"], "edited")
        # the order the two edits are given in does not matter
        prop3, _, _ = P.apply(prop, src, None, [
            {"field": "wall_material", "target": BED_WALL, "value": "concrete_block"},
            {"field": "outside_wall_material", "value": "cement_stucco_2x6"},
        ])
        self.assertEqual(P._wall(prop3, BED_WALL[5:])[1]["wall_type"], "concrete_block")

    def test_every_choice_has_a_rating_in_assumptions_and_is_read_from_it(self):
        a = Assumptions.load()
        for fid, section in (("window_type", "windows"), ("wall_material", "walls"), ("door_material", "doors_exterior"),
                             ("outside_wall_material", "walls")):
            ch = P.choices(fid, a)
            self.assertTrue(ch)
            for c in ch:
                self.assertIsInstance(a.value("%s.%s" % (section, c)), (int, float))
            rated = [k for k, v in a._tree[section].items() if isinstance(v, dict) and isinstance(v.get("value"), (int, float))
                     and not k.endswith("_offset")]
            self.assertEqual(ch, rated)
        self.assertNotIn("default", P.choices("door_material", a))
        self.assertNotIn("roof", P.choices("wall_material", a))

    def test_a_new_rated_entry_in_assumptions_becomes_a_choice(self):
        a = Assumptions.load()
        a._tree["doors_exterior"]["metal_faced"] = {"value": 26, "unit": "EWR", "source": "test", "status": "placeholder"}
        self.assertIn("metal_faced", P.choices("door_material", a))


class TestLabelsAndEdits(unittest.TestCase):
    def setUp(self):
        self.prop, self.src = volterra()

    def test_an_edit_wins_and_the_replaced_value_stays_in_the_log(self):
        edits = [{"field": "window_type", "target": BED_WALL, "value": "with_storm", "edited_by": "resident",
                  "edited_at": "2026-11-14T19:40:00-05:00"}]
        _, _, log = P.apply(self.prop, self.src, None, edits)
        e = P.index(log["profile"])["window_type@" + BED_WALL]
        self.assertEqual((e["value"], e["label"], e["edited_by"]), ("with_storm", "edited", "resident"))
        self.assertEqual(e["edited_at"], "2026-11-14T19:40:00-05:00")
        self.assertEqual(log["applied"][0]["replaced"], {"value": "double_pane_2000_on", "label": "assumed"})
        self.assertEqual(e["replaced"]["value"], "double_pane_2000_on")

    def test_an_edit_beats_costar(self):
        prof = P.build(self.prop, self.src, made_up_context("zzvymDx5ty7"))
        prop2, _, log = P.apply(self.prop, self.src, prof, [{"field": "year_built", "value": 2016}])
        self.assertEqual(prop2["year_built"], 2016)
        self.assertEqual(prop2["era"]["value"], "2000_on")
        self.assertEqual(P.index(log["profile"])["year_built"]["replaced"], {"value": 1995, "label": "costar"})
        self.assertEqual(P.index(log["profile"])["storeys"]["label"], "costar")  # untouched values keep their label

    def test_a_later_edit_of_the_same_field_wins(self):
        prop2, _, log = P.apply(self.prop, self.src, None, [
            {"field": "window_type", "target": BED_WALL, "value": "single_pane"},
            {"field": "window_type", "target": BED_WALL, "value": "laminated_acoustic"}])
        self.assertEqual(P._wall(prop2, BED_WALL[5:])[1]["window_type"], "laminated_acoustic")
        self.assertEqual(log["applied"][1]["replaced"]["value"], "single_pane")

    def test_a_managers_building_edit_reaches_every_unit_of_the_building(self):
        building = {"schemaVersion": 1, "edits": [
            {"field": "outside_wall_material", "value": "eifs_stucco_2x6", "edited_by": "manager"},
            {"field": "window_type", "target": BED_WALL, "value": "single_pane", "edited_by": "manager"}]}
        unit_a = copy.deepcopy(self.prop)
        unit_b = copy.deepcopy(self.prop)
        unit_b["id"] = "matterport-zzvymDx5ty7-unit-b"
        unit_b["unit_floor"], unit_b["storeys"] = 3, 3
        resident_b = [{"field": "window_type", "target": BED_WALL, "value": "with_storm", "edited_by": "resident"}]
        for unit, own in ((unit_a, []), (unit_b, resident_b)):
            merged = P.merge_edits(building, own)
            self.assertEqual([e["field"] for e in merged if e.get("applies_to") == "building"], ["outside_wall_material"])
            prop2, _, log = P.apply(unit, self.src, None, merged)
            self.assertTrue(all(w["wall_type"] == "eifs_stucco_2x6" for r in prop2["rooms"] for w in r["exterior_walls"]))
            self.assertEqual(P.index(log["profile"])["outside_wall_material"]["label"], "edited")
        # the resident's own edit applies to unit B only
        a2, _, _ = P.apply(unit_a, self.src, None, P.merge_edits(building, []))
        b2, _, _ = P.apply(unit_b, self.src, None, P.merge_edits(building, resident_b))
        self.assertIsNone(P._wall(a2, BED_WALL[5:])[1]["window_type"])
        self.assertEqual(P._wall(b2, BED_WALL[5:])[1]["window_type"], "with_storm")

    def test_apply_never_mutates_its_inputs(self):
        before = json.dumps(self.prop, sort_keys=True)
        prof = P.build(self.prop, self.src)
        pbefore = json.dumps(prof, sort_keys=True)
        P.apply(self.prop, self.src, prof, [{"field": "exposure", "target": BED_WALL, "value": "corridor"},
                                            {"field": "windows_open", "value": "open"}])
        self.assertEqual(json.dumps(self.prop, sort_keys=True), before)
        self.assertEqual(json.dumps(prof, sort_keys=True), pbefore)


class TestBadEdits(unittest.TestCase):
    def setUp(self):
        self.prop, self.src = volterra()

    def assertRejected(self, edit, words, prefix=None):
        with self.assertRaises(P.ProfileError) as cm:
            P.apply(self.prop, self.src, None, (prefix or []) + [edit])
        self.assertIn(words, str(cm.exception))
        _, _, log = P.apply(self.prop, self.src, None, (prefix or []) + [edit], strict=False)
        self.assertEqual(len(log["rejected"]), 1)

    def test_impossible_edits_are_rejected_with_a_plain_message(self):
        self.assertRejected({"field": "window_area_m2", "target": BED_WALL, "value": 12.0}, "does not fit its wall")
        self.assertRejected({"field": "window_area_m2", "target": LIVING_WALL, "value": 8.0}, "of door")
        self.assertRejected({"field": "unit_floor", "value": 4}, "above the building's 3 floors",
                            prefix=[{"field": "storeys", "value": 3}])
        self.assertRejected({"field": "window_type", "target": BED_WALL, "value": "triple_glazed"}, "not a choice")
        self.assertRejected({"field": "window_area_m2", "target": BED_WALL, "value": -1}, "cannot be below")
        self.assertRejected({"field": "unit_floor", "value": 1.5}, "whole number")
        self.assertRejected({"field": "colour", "value": "red"}, "no profile field")
        self.assertRejected({"field": "window_type", "target": "wall:nope", "value": "single_pane"}, "does not apply")

    def test_unlikely_edits_are_accepted_and_flagged(self):
        _, _, log = P.apply(self.prop, self.src, None, [
            {"field": "era", "value": "1960_1979"},
            {"field": "window_type", "target": BED_WALL, "value": "laminated_acoustic"}])
        self.assertEqual(len(log["applied"]), 2)
        self.assertTrue(any("Unlikely" in f for f in log["flags"]))


class TestChangesAndWorthChecking(unittest.TestCase):
    def setUp(self):
        self.prop, self.src = volterra()
        with open(os.path.join(os.path.dirname(HERE), "samples", "edits.zzvymDx5ty7.example.json")) as fh:
            self.edits = json.load(fh)

    def test_per_edit_changes_sum_to_the_total_change(self):
        cmp = P.compare(self.prop, self.src, None, self.edits)
        self.assertEqual(len(cmp["changes"]), 3)
        total = sum(c["unit_change_raw"] for c in cmp["changes"])
        self.assertAlmostEqual(total, cmp["total_change_raw"], places=9)
        self.assertAlmostEqual(cmp["edited"]["score"]["unit"]["score"] - cmp["baseline"]["score"]["unit"]["score"],
                               cmp["total_change_raw"], delta=0.11)

    def test_an_edit_can_lower_the_score_and_is_reported_the_same_way(self):
        cmp = P.compare(self.prop, self.src, None, [{"field": "windows_open", "value": "open"}])
        self.assertLess(cmp["changes"][0]["unit_change"], 0)

    def test_rejected_edits_change_nothing_in_compare(self):
        cmp = P.compare(self.prop, self.src, None, [{"field": "window_area_m2", "target": BED_WALL, "value": 99}])
        self.assertTrue(cmp["changes"][0]["rejected"])
        self.assertEqual(cmp["changes"][0]["unit_change"], 0.0)

    def test_scan_and_edited_fields_are_never_listed(self):
        wc = P.worth_checking(self.prop, self.src, None, self.edits)
        listed = {x["key"] for x in wc}
        prof = P.apply(self.prop, self.src, None, self.edits)[2]["profile"]
        for e in prof["fields"]:
            if e["label"] in ("scan", "edited"):
                self.assertNotIn(e["key"], listed)
        self.assertNotIn("window_type@" + BED_WALL, listed)

    def test_a_field_whose_alternatives_change_nothing_ranks_last(self):
        wc = P.worth_checking(self.prop, self.src)
        flat = [x for x in wc if x["spread_raw"] == 0]
        self.assertTrue(flat)
        self.assertIn("door_material@" + ENTRY_SIDE, {x["key"] for x in flat})
        first_flat = wc.index(flat[0])
        self.assertTrue(all(x["spread_raw"] == 0 for x in wc[first_flat:]))
        self.assertEqual(wc, sorted(wc, key=lambda x: -x["spread_raw"]))
        self.assertGreater(wc[0]["spread_raw"], 0)
        self.assertIn("could move your score by up to", wc[0]["text"])


class TestPipelineAndCommandLine(unittest.TestCase):
    def test_pipeline_with_edits_returns_before_and_after(self):
        from fingerprints import NoContext
        from noisemodel.pipeline import NoiseModelPipeline
        edits = load_sample("edits.zzvymDx5ty7.example.json")
        out = NoiseModelPipeline(NoContext()).run({"modelId": "zzvymDx5ty7", "edits": edits["edits"] + [
            {"field": "unit_floor", "value": 0}]})
        for key in ("profile", "score", "baseline", "changes", "worthChecking", "scoreCrosscheck", "totalChange"):
            self.assertIn(key, out)
        self.assertEqual(len(out["editsRejected"]), 1)
        self.assertGreater(out["score"]["unit"]["score"], out["baseline"]["score"]["unit"]["score"])
        # The notice is present only while docs/SCORE_CROSSCHECK.md starts with ALERT.
        settled = out["scoreCrosscheck"]["settled"]
        self.assertEqual(bool(out["score"]["crosscheck_notice"]), not settled)
        self.assertEqual(bool(out["scoreCrosscheck"]["notice"]), not settled)
        # the other outputs move with the edits: the edited bedroom wall carries laminated glass
        wall = next(w for r in out["property"]["rooms"] for w in r["exterior_walls"] if w["id"] == BED_WALL[5:])
        self.assertEqual(wall["window_type"], "laminated_acoustic")
        self.assertNotEqual(out["legacyRoomPrediction"]["rooms"],
                            NoiseModelPipeline(NoContext()).run({"modelId": "zzvymDx5ty7"})["legacyRoomPrediction"]["rooms"])

    def test_pipeline_rejects_a_malformed_edits_document(self):
        from fingerprints import NoContext
        from noisemodel.pipeline import NoiseModelPipeline
        with self.assertRaises(ValueError):
            NoiseModelPipeline(NoContext()).run({"modelId": "zzvymDx5ty7", "edits": "window_type=laminated"})

    def test_command_line_profile_adds_the_report_sections(self):
        import subprocess
        import sys
        import tempfile
        root = os.path.dirname(HERE)
        with tempfile.TemporaryDirectory() as tmp:
            rp, out = os.path.join(tmp, "report.md"), os.path.join(tmp, "levels.json")
            subprocess.run([sys.executable, "-m", "noisemodel.predict", "samples/property.zzvymDx5ty7.json",
                            "samples/sources.zzvymDx5ty7.json", "--out", out, "--report", "--report-path", rp,
                            "--profile", "--edits", "samples/edits.zzvymDx5ty7.example.json"],
                           cwd=root, check=True, capture_output=True)
            with open(rp) as fh:
                md = fh.read()
            with open(out) as fh:
                levels = json.load(fh)
        self.assertIn("## Unit profile", md)
        self.assertIn("## Before and after", md)
        self.assertIn("score", levels)
        self.assertEqual(len(levels["changes"]), 3)


class TestSamples(unittest.TestCase):
    def test_committed_profile_sample_is_current(self):
        prop, src = volterra()
        res = predict(prop, src, with_fixes=False)
        shown = P._relabel(P.build(prop, src, None, result=res), P.build(prop, src))
        shown["dataChanges"] = []
        self.assertEqual(load_sample("profile.zzvymDx5ty7.json"), json.loads(json.dumps(shown)))

    def test_example_edits_file_is_valid(self):
        prop, src = volterra()
        doc = load_sample("edits.zzvymDx5ty7.example.json")
        self.assertEqual((doc["schemaVersion"], doc["modelId"]), (1, "zzvymDx5ty7"))
        _, _, log = P.apply(prop, src, None, doc)
        self.assertEqual(log["rejected"], [])


if __name__ == "__main__":
    unittest.main()
