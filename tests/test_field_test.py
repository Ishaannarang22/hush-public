"""Field test mode (docs/BUILD_BRIEF.md section 8a)."""
import json
import os
import unittest

from noisemodel import fieldtest
from noisemodel.predict import predict, to_json

from helpers import SAMPLES, deep, load_sample, yale


def measured(**kw):
    block = {"wall": "bed1-n", "mode": "ambient", "outdoor_dba": 68.0, "outdoor_position": "free_field",
             "speaker_angle_deg": None, "indoor_dba": {"bed1": 43.5, "corridor": 31.0},
             "indoor_background_dba": {"bed1": 29.0, "corridor": 28.0}, "note": "test"}
    block.update(kw)
    return block


def predicted(result, room_id):
    for r in result["field_test"]["rooms"]:
        if r["room"] == room_id:
            return r
    raise KeyError(room_id)


class TestFieldTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.prop, cls.src = yale()

    def run_with(self, **kw):
        src = deep(self.src)
        src["measured"] = measured(**kw)
        return predict(self.prop, src)

    def test_yale_output_byte_identical_without_measured_block(self):
        self.assertNotIn("measured", self.src)
        with open(os.path.join(SAMPLES, "levels.yale.json")) as fh:
            committed = fh.read()
        self.assertEqual(to_json(predict(self.prop, self.src)), committed)

    def test_measured_block_leaves_normal_predictions_alone(self):
        plain = json.loads(to_json(predict(self.prop, self.src)))
        with_test = json.loads(to_json(self.run_with()))
        self.assertIn("field_test", with_test)
        self.assertNotIn("field_test", plain)
        for key in plain:
            if key not in ("field_test", "warnings"):
                self.assertEqual(plain[key], with_test[key], key)

    def test_speaker_at_0_degrees_is_3_db_louder_than_ambient(self):
        amb = predicted(self.run_with(mode="ambient"), "bed1")["predicted_dba"]
        spk = predicted(self.run_with(mode="speaker", speaker_angle_deg=0), "bed1")["predicted_dba"]
        self.assertAlmostEqual(spk - amb, 3.0, delta=0.01)

    def test_speaker_angle_uses_cosine(self):
        s0 = predicted(self.run_with(mode="speaker", speaker_angle_deg=0), "bed1")["predicted_dba"]
        s60 = predicted(self.run_with(mode="speaker", speaker_angle_deg=60), "bed1")["predicted_dba"]
        self.assertAlmostEqual(s0 - s60, 3.01, delta=0.01)

    def test_2m_from_wall_is_3_db_quieter_than_free_field(self):
        ff = predicted(self.run_with(outdoor_position="free_field"), "bed1")["predicted_dba"]
        two = predicted(self.run_with(outdoor_position="2m_from_wall"), "bed1")["predicted_dba"]
        self.assertAlmostEqual(ff - two, 3.0, delta=0.01)
        self.assertIn("2m_from_wall", self.run_with(outdoor_position="2m_from_wall")["field_test"]["position_rule"])

    def test_other_walls_get_no_sound(self):
        res = self.run_with()
        self.assertEqual(res["field_test"]["walls_with_sound"], ["bed1-n"])

    def test_background_subtraction(self):
        self.assertAlmostEqual(fieldtest.background_corrected(43.5, 29.0), 43.34, delta=0.01)
        self.assertEqual(round(fieldtest.background_corrected(43.5, 29.0), 1), 43.3)
        row = predicted(self.run_with(), "bed1")
        self.assertEqual(row["measured_dba"], 43.3)
        self.assertFalse(row["not_reliable"])

    def test_close_to_background_is_flagged(self):
        row = predicted(self.run_with(), "corridor")  # 31.0 over 28.0: 3 dB
        self.assertTrue(row["not_reliable"])
        res = self.run_with(indoor_dba={"bed1": 35.0}, indoor_background_dba={"bed1": 29.0})
        row = predicted(res, "bed1")
        self.assertTrue(row["not_reliable"])
        self.assertIn("too close to background", row["note"])

    def test_output_fields(self):
        row = predicted(self.run_with(), "bed1")
        for key in ("predicted_dba", "measured_dba", "difference_db", "predicted_reduction_db",
                    "measured_reduction_db", "range_db", "inside_range"):
            self.assertIn(key, row)
        self.assertAlmostEqual(row["difference_db"], row["predicted_dba"] - row["measured_dba"], delta=0.051)
        self.assertEqual(row["range_db"], 3)

    def test_templates_are_valid_json_with_comments(self):
        src = load_sample("sources.fieldtest.template.json")
        prop = load_sample("property.fieldtest.template.json")
        self.assertIn("measured", src)
        for key in ("wall", "mode", "outdoor_dba", "outdoor_position", "speaker_angle_deg",
                    "indoor_dba", "indoor_background_dba", "note"):
            self.assertIn(key, src["measured"])
            self.assertIn(key, src["measured"]["_comments"])
        self.assertIn("_comments", prop)


if __name__ == "__main__":
    unittest.main()
