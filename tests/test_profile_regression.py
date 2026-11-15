"""No profile, no change (docs/UNIT_PROFILE_PLAN.md section 13, first test).

tests/fixtures/main_fingerprints.json was written from `main` (fd69dd3) before any unit-profile code. With no
profile in use, levels.json, the report and every key of the pipeline response that existed on `main` must be
byte-identical for both demo properties. The pipeline may only add the profile keys.
"""
import json
import os
import unittest

import fingerprints

PROFILE_KEYS = {"profile", "score", "scoreCrosscheck"}


class TestNoProfileNoChange(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(fingerprints.FIXTURE) as fh:
            cls.main = json.load(fh)
        cls.now = fingerprints.compute(extra_pipeline_keys=PROFILE_KEYS)

    def test_both_demo_properties_are_covered(self):
        self.assertEqual(set(self.main), {"zzvymDx5ty7", "D9CVkjeMoQx"})

    def test_levels_json_is_byte_identical(self):
        for model in self.main:
            self.assertEqual(self.now[model]["levels_json"], self.main[model]["levels_json"], model)

    def test_report_is_byte_identical(self):
        for model in self.main:
            self.assertEqual(self.now[model]["report_md"], self.main[model]["report_md"], model)

    def test_every_existing_pipeline_key_is_byte_identical(self):
        for model in self.main:
            self.assertEqual(self.now[model]["pipeline"], self.main[model]["pipeline"], model)

    def test_pipeline_only_adds_the_profile_keys(self):
        from noisemodel.pipeline import NoiseModelPipeline
        for model in self.main:
            out = NoiseModelPipeline(fingerprints.NoContext()).run({"modelId": model})
            added = set(out) - set(self.main[model]["pipeline"]) - fingerprints.VOLATILE
            self.assertEqual(added, PROFILE_KEYS, model)

    def test_committed_sample_outputs_still_match(self):
        from noisemodel.predict import predict, to_json
        for model, (pp, sp) in fingerprints.DEMOS.items():
            with open(os.path.join(fingerprints.ROOT, pp)) as fh:
                prop = json.load(fh)
            with open(os.path.join(fingerprints.ROOT, sp)) as fh:
                src = json.load(fh)
            name = "levels.%s.json" % ("yale" if model == "D9CVkjeMoQx" else model)
            with open(os.path.join(fingerprints.ROOT, "samples", name)) as fh:
                self.assertEqual(to_json(predict(prop, src)), fh.read(), name)


if __name__ == "__main__":
    unittest.main()
