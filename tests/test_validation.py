"""The R6 validation run (docs/BUILD_BRIEF.md section 8)."""
import math
import unittest

from noisemodel import validation
from noisemodel.assumptions import Assumptions


class TestValidation(unittest.TestCase):
    def test_cases_run_and_match_the_yaml(self):
        rows = validation.run_validation(Assumptions.load())
        self.assertEqual(len(rows), 18)
        self.assertEqual(sum(1 for r in rows if r["exact"]), 10)
        for r in rows:
            self.assertTrue(math.isfinite(r["predicted"]), r["case"])

    def test_range_check_cases_land_in_the_measured_span(self):
        for r in validation.run_validation(Assumptions.load()):
            if not r["exact"]:
                self.assertTrue(21.0 <= r["predicted"] <= 32.0, (r["case"], r["predicted"]))


if __name__ == "__main__":
    unittest.main()
