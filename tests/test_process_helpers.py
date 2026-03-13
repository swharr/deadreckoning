import importlib.util
import unittest
from datetime import date
from pathlib import Path


def load_module(path: str, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


REPO_ROOT = Path(__file__).resolve().parent.parent
process = load_module(str(REPO_ROOT / "scripts" / "process.py"), "process_module")


class ProcessHelpersTest(unittest.TestCase):
    def test_resolve_as_of_date_prefers_history_snapshot(self):
        resolved = process.resolve_as_of_date(
            {"lastSnapshot": "2026-03-13"},
            REPO_ROOT / "data" / "latest.xlsx",
            date(2026, 3, 1),
        )
        self.assertEqual(resolved, date(2026, 3, 13))

    def test_bayesian_removal_rate_shrinks_to_prior_with_low_exposure(self):
        low_exposure_rate = process.bayesian_removal_rate(observed_removed=0, exposure=10)
        high_exposure_rate = process.bayesian_removal_rate(observed_removed=200, exposure=5000)

        self.assertGreater(low_exposure_rate, 0.01)
        self.assertLess(high_exposure_rate, 0.05)
        self.assertGreater(high_exposure_rate, low_exposure_rate)


if __name__ == "__main__":
    unittest.main()
