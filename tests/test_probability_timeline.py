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


class SurvivalBlendHelperTest(unittest.TestCase):
    """Test the extracted compute_survival_blend() helper."""

    def test_returns_float_probability(self):
        """Basic smoke test: helper returns a float in [0, 1]."""
        district_snapshots = [
            {"date": "2026-02-10", "count": 4000},
            {"date": "2026-02-13", "count": 4500},
            {"date": "2026-02-18", "count": 4700},
            {"date": "2026-02-21", "count": 4800},
        ]
        statewide_snapshots = [
            {"date": "2026-02-10", "total": 100000},
            {"date": "2026-02-13", "total": 120000},
            {"date": "2026-02-18", "total": 140000},
            {"date": "2026-02-21", "total": 150000},
        ]
        result = process.compute_survival_blend(
            verified=4800,
            threshold=5000,
            d_num=1,
            as_of_date=date(2026, 2, 21),
            district_snapshots=district_snapshots,
            statewide_snapshots=statewide_snapshots,
            peak_verified=4800,
            post_deadline_removed=0,
            rejection_rate=0.02,
            growth_proj_raw=5100.0,
            days_to_deadline=16,
            snapshot_count=4,
        )
        self.assertIsInstance(result, float)
        self.assertGreaterEqual(result, 0.0)
        self.assertLessEqual(result, 1.0)

    def test_above_threshold_returns_high_prob(self):
        """District well above threshold should have high survival probability."""
        district_snapshots = [
            {"date": "2026-02-10", "count": 5500},
            {"date": "2026-02-13", "count": 5800},
            {"date": "2026-02-18", "count": 6000},
            {"date": "2026-02-21", "count": 6200},
        ]
        statewide_snapshots = [
            {"date": "2026-02-10", "total": 100000},
            {"date": "2026-02-13", "total": 120000},
            {"date": "2026-02-18", "total": 140000},
            {"date": "2026-02-21", "total": 155000},
        ]
        result = process.compute_survival_blend(
            verified=6200,
            threshold=5000,
            d_num=1,
            as_of_date=date(2026, 2, 21),
            district_snapshots=district_snapshots,
            statewide_snapshots=statewide_snapshots,
            peak_verified=6200,
            post_deadline_removed=0,
            rejection_rate=0.01,
            growth_proj_raw=6500.0,
            days_to_deadline=16,
            snapshot_count=4,
        )
        self.assertGreater(result, 0.7)


if __name__ == "__main__":
    unittest.main()
