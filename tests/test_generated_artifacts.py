import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent


class GeneratedArtifactsTest(unittest.TestCase):
    def test_public_data_has_joint_probability_fields(self):
        with open(REPO_ROOT / "public" / "data.json") as fh:
            data = json.load(fh)
        overall = data["overall"]

        self.assertIn("pBallotQualified", overall)
        self.assertIn("pDistrictRule", overall)
        self.assertIn("probabilityScope", overall)
        self.assertIn("statewideProjection", overall)

    def test_removals_output_is_aggregate_only(self):
        with open(REPO_ROOT / "data" / "removals.json") as fh:
            removals = json.load(fh)

        self.assertIn("totalRemoved", removals)
        self.assertIn("byDistrict", removals)
        self.assertNotIn("records", removals)


if __name__ == "__main__":
    unittest.main()
