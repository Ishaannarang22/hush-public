"""Quiet Score and cross-check tolerance logic (docs/UNIT_PROFILE_PLAN.md sections 6, 6a and 13)."""
import os
import unittest

from helpers import load_sample
from noisemodel import crosscheck, score
from noisemodel.assumptions import Assumptions
from noisemodel.predict import predict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rooms(*specs):
    return {"rooms": [{"id": i, "name": i, "type": t, "night_dba": n, "dnl_dba": d, "range_db": 5}
                      for i, t, n, d in specs]}


class TestQuietScore(unittest.TestCase):
    def setUp(self):
        self.a = Assumptions.load()

    def test_anchor_points(self):
        r = score.score(rooms(("bed", "bedroom", 30.0, 33.0), ("liv", "living", 20.0, 45.0)), self.a)
        self.assertEqual(round(r["rooms"]["bed"]["score"]), 67)  # WHO 30 dBA overnight
        self.assertEqual(r["rooms"]["liv"]["score"], 50.0)  # HUD DNL 45

    def test_values_clamp_at_0_and_100(self):
        r = score.score(rooms(("bed", "bedroom", 10.0, 20.0), ("b2", "bedroom", 70.0, 70.0),
                              ("liv", "living", None, None)), self.a)
        self.assertEqual(r["rooms"]["bed"]["score"], 100.0)
        self.assertEqual(r["rooms"]["b2"]["score"], 0.0)
        self.assertEqual(r["rooms"]["liv"]["score"], 100.0)  # below the 15 dBA floor
        self.assertEqual(r["rooms"]["b2"]["range"], [0.0, 0.0])

    def test_a_louder_room_never_scores_higher(self):
        prev = None
        for level in [x / 2.0 for x in range(20, 140)]:
            s = score.linear(level, self.a.value("score.daily_anchors"))
            if prev is not None:
                self.assertLessEqual(s, prev)
            prev = s

    def test_unit_is_the_weighted_worst_bedroom_and_main_living_room(self):
        r = score.score(rooms(("b1", "bedroom", 30.0, 0), ("b2", "bedroom", 35.0, 0), ("liv", "living", 0, 45.0),
                              ("den", "living", 0, 30.0), ("bath", "bathroom", 0, 50.0)),
                        self.a, areas={"liv": 30.0, "den": 10.0})
        worst_bed = (50 - 35.0) / 30 * 100
        self.assertAlmostEqual(r["unit"]["score"], round(0.6 * worst_bed + 0.4 * 50.0, 1))
        self.assertEqual([x["room"] for x in r["unit"]["from"]], ["b2", "liv"])
        only_living = score.score(rooms(("liv", "living", 0, 45.0)), self.a)
        self.assertEqual(only_living["unit"]["score"], 50.0)
        self.assertIsNone(score.score(rooms(("bath", "bathroom", 0, 45.0)), self.a)["unit"])

    def test_range_follows_the_level_range(self):
        r = score.score(rooms(("liv", "living", 0, 45.0)), self.a, ranges={"liv": 3})
        self.assertEqual(r["rooms"]["liv"]["range"], [40.0, 60.0])

    def test_score_uses_the_noisemodel_result_only(self):
        prop, src = load_sample("property.zzvymDx5ty7.json"), load_sample("sources.zzvymDx5ty7.json")
        res = predict(prop, src, with_fixes=False)
        r = score.score(res, self.a)
        bed = next(x for x in res["rooms"] if x["type"] == "bedroom")
        self.assertEqual(r["rooms"][bed["id"]]["level_db"], bed["night_dba"])
        self.assertIn("eight-band room balance is not used", r["method"])

    def test_outdoor_dnl_energy_sums_the_modes(self):
        o = score.outdoor_dnl({"outdoor_free_field": {"road": {"dnl_dba": 60.0}, "aircraft": {"dnl_dba": 60.0}}})
        self.assertAlmostEqual(o, 63.0103, places=3)

    def test_no_outdoor_score_and_the_road_limit_is_stated(self):
        # Interim decision 1: no outdoor 0 to 100 score; decision 2: the counted-roads limit is stated.
        self.assertFalse(hasattr(score, "outdoor_score"))
        self.assertIsNone(Assumptions.load().entry("score.crosscheck.outdoor_anchors"))
        r = score.score(rooms(("liv", "living", 0, 45.0)), self.a)
        self.assertIn("only the roads it is given", r["limits"][0])
        self.assertFalse(any("outdoor" in k for k in r))


def line(dnl):
    return 103.6 - 0.54 * dnl


class TestCrossCheckTolerance(unittest.TestCase):
    """Made-up lookups only (interim decision 3): rank 0.8 or better across ten separate addresses, and on
    HowLoud's scale a median gap of 2 points or less and no gap above 5. A missing lookup is not a pass."""

    def rows(self, n=10, offset=0.5):
        return [{"address": "A%d" % i, "our_dnl": 45.0 + 3 * i, "theirs": line(45.0 + 3 * i) + offset}
                for i in range(n)]

    def test_inside_tolerance_gives_result(self):
        ev = crosscheck.evaluate(self.rows())
        self.assertEqual(ev["status"], "RESULT", ev["reasons"])
        self.assertEqual(ev["rank_correlation"], 1.0)  # louder for us, lower (louder) score for them
        self.assertEqual(crosscheck.first_line(ev["status"], ev["reasons"]), "RESULT: within tolerance")

    def test_one_address_6_points_off_gives_alert(self):
        rows = self.rows()
        rows[4]["theirs"] = line(rows[4]["our_dnl"]) - 6.0
        ev = crosscheck.evaluate(rows)
        self.assertEqual(ev["status"], "ALERT")
        self.assertTrue(any("A4 gap 6.0 points is above 5" in r for r in ev["reasons"]), ev["reasons"])
        self.assertTrue(crosscheck.first_line(ev["status"], ev["reasons"]).startswith("ALERT:"))

    def test_one_address_25_points_off_gives_alert(self):
        rows = self.rows()
        rows[4]["theirs"] -= 25.0
        self.assertEqual(crosscheck.evaluate(rows)["status"], "ALERT")

    def test_median_gap_above_2_gives_alert(self):
        ev = crosscheck.evaluate(self.rows(offset=2.5))
        self.assertEqual(ev["status"], "ALERT")
        self.assertTrue(any("median gap 2.5" in r for r in ev["reasons"]))

    def test_a_missing_lookup_is_not_a_pass(self):
        rows = self.rows(11)
        rows[3]["theirs"] = None
        ev = crosscheck.evaluate(rows)
        self.assertEqual(ev["status"], "ALERT")
        self.assertEqual(ev["missing"], ["A3"])

    def test_too_few_addresses_and_bad_ranking_give_alert(self):
        self.assertEqual(crosscheck.evaluate(self.rows(9))["status"], "ALERT")
        rows = self.rows()
        rows[0]["theirs"], rows[9]["theirs"] = rows[9]["theirs"], rows[0]["theirs"]
        ev = crosscheck.evaluate(rows)
        self.assertEqual(ev["status"], "ALERT")
        self.assertLess(ev["rank_correlation"], 0.8)

    def test_points_near_one_building_count_as_one_address(self):
        rows = self.rows(12)
        for i, r in enumerate(rows):
            r["group"] = "A" if i < 6 else "B"
        ev = crosscheck.evaluate(rows)
        self.assertEqual((ev["status"], ev["addresses"], ev["compared"]), ("ALERT", 2, 12))
        self.assertEqual(len(ev["reasons"]), 1)  # only the address count fails

    def test_document_exists_with_a_result_or_alert_first_line(self):
        st = crosscheck.status()
        self.assertIn(st["status"], ("result", "alert"))
        self.assertTrue(st["line"].startswith(("RESULT:", "ALERT:")))
        if st["status"] == "alert":
            self.assertFalse(st["settled"])
            self.assertTrue(st["notice"])


class TestHowLoudLookups(unittest.TestCase):
    """Alejandro's manual HowLoud lookups (issue #36 comment 6887893159), recorded in the repo."""

    @classmethod
    def setUpClass(cls):
        import json
        with open(crosscheck.LOOKUPS) as fh:
            cls.doc = json.load(fh)
        cls.ev = crosscheck.evaluate_lookups(cls.doc)

    def test_every_lookup_is_recorded(self):
        rows = self.doc["rows"]
        self.assertEqual(len(rows), 24)  # 2 demo addresses, 12 distance points, 10 more separate addresses
        self.assertEqual(sum(1 for r in rows if r["distance_m"] is not None), 12)
        g = {r["distance_m"]: (r["our_outdoor_dnl"], r["score"]) for r in rows if r["road"] == "S Greenhouse Rd"}
        y = {r["distance_m"]: (r["our_outdoor_dnl"], r["score"]) for r in rows if r["road"] == "Yale St"}
        self.assertEqual(g, {None: (69.9, 67), 20: (71.2, 65), 40: (66.6, 67), 80: (62.0, 70), 160: (57.4, 74),
                             320: (52.4, 78), 640: (46.9, 74)})
        self.assertEqual(y, {None: (66.8, 68), 20: (64.9, 68), 40: (60.3, 71), 80: (55.6, 74), 160: (50.5, 75),
                             320: (44.7, 76), 640: (38.0, 76)})
        self.assertIn("HOWLOUD_API_KEY", self.doc["lookup"]["key_handling"])
        keys = set()

        def walk(node):
            if isinstance(node, dict):
                keys.update(k.lower() for k in node)
                for v in node.values():
                    walk(v)
            elif isinstance(node, list):
                for v in node:
                    walk(v)
        walk(self.doc)
        self.assertFalse(keys & {"key", "api_key", "apikey", "x-api-key", "token"})

    def test_rank_correlations_match_the_comment(self):
        d = self.ev["diagnostics"]
        self.assertEqual(round(d["within_160_m"]["rank_correlation"], 2), 0.99)
        self.assertEqual(round(d["all_distance_points"]["rank_correlation"], 2), 0.90)

    def test_fitted_line_matches_the_comment(self):
        near = [(r["our_outdoor_dnl"], r["score"]) for r in self.doc["rows"]
                if r["distance_m"] is not None and r["distance_m"] <= 160]
        n = len(near)
        mx, my = sum(p[0] for p in near) / n, sum(p[1] for p in near) / n
        b = sum((p[0] - mx) * (p[1] - my) for p in near) / sum((p[0] - mx) ** 2 for p in near)
        c = my - b * mx
        self.assertEqual((round(c, 1), round(b, 2)), (103.6, -0.54))
        self.assertEqual(round(max(abs(p[1] - (c + b * p[0])) for p in near), 1), 1.5)  # unrounded fit
        ln = Assumptions.load().value("score.crosscheck.howloud_line")
        self.assertEqual((ln["intercept"], ln["slope"]), (103.6, -0.54))

    def test_gaps_on_the_eight_near_points_pass_and_all_twelve_fail(self):
        d = self.ev["diagnostics"]
        # with the line as stated (103.6, -0.54): median 0.49, largest 1.40 (1.51 with the unrounded fit)
        self.assertEqual(round(d["within_160_m"]["median_gap"], 1), 0.5)
        self.assertEqual(round(d["within_160_m"]["max_gap"], 1), 1.4)
        self.assertEqual((d["all_distance_points"]["max_gap"], d["all_distance_points"]["max_gap_at"]),
                         (7.08, "yale-640m"))

    def test_status_line_is_what_the_rules_give(self):
        # Twelve separate addresses carry the test and pass every rule.
        self.assertEqual(self.ev["status"], "RESULT")
        self.assertEqual((self.ev["addresses"], self.ev["compared"]), (12, 12))
        self.assertEqual(self.ev["reasons"], [])
        self.assertGreaterEqual(self.ev["rank_correlation"], 0.8)
        self.assertLessEqual(self.ev["median_gap"], 2)
        self.assertLessEqual(self.ev["max_gap"], 5)
        with open(crosscheck.DOC) as fh:
            self.assertEqual(fh.readline().strip(), crosscheck.first_line(self.ev["status"], self.ev["reasons"]))

    def test_ten_more_separate_addresses_are_recorded(self):
        more = [r for r in self.doc["rows"] if r.get("method") == "all_counted_roads_800m"]
        self.assertEqual(len(more), 10)
        self.assertTrue(all(r["distance_m"] is None and r["score"] is not None and r["our_outdoor_dnl"] for r in more))
        self.assertEqual(len({r["address"] for r in more}), 10)

    def test_distance_points_are_diagnostics_and_do_not_decide_the_status(self):
        # Several points near one building are reported but do not carry the test (roles_note).
        d = self.ev["diagnostics"]
        self.assertEqual(d["every_row"]["compared"], 24)
        self.assertGreater(d["every_row"]["max_gap"], 5)   # the 640 m point, a stated limit of single-road inputs
        self.assertEqual(self.ev["status"], "RESULT")
        only_distance = {"sites": self.doc["sites"], "rows": [r for r in self.doc["rows"] if r["distance_m"] is not None]}
        ev = crosscheck.evaluate_lookups(only_distance)
        self.assertEqual((ev["status"], ev["addresses"]), ("ALERT", 0))  # no separate address, so never a pass

    def test_tolerances_are_the_interim_decision(self):
        a = Assumptions.load()
        self.assertEqual([a.value("score.crosscheck." + k) for k in
                          ("rank_correlation_min", "min_addresses", "median_gap_max", "any_gap_max")],
                         [0.8, 10, 2, 5])
        for old in ("median_difference_max", "any_difference_max", "outdoor_anchors"):
            self.assertIsNone(a.entry("score.crosscheck." + old))


if __name__ == "__main__":
    unittest.main()
